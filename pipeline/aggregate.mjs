// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/**
 * aggregate.mjs — read the cached ABS slices, run the two reconciliation gates,
 * and write the site's data JSON into public/data/. Fails the build if a gate trips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSdmx,
  buildHierarchy,
  parseIndexSeries,
  valueAt,
  lastValue,
  lastQuarter,
  cumChange,
  quarterIndex,
  quarterFromIndex,
  quarterYear,
  periodLabel,
  num,
  reconcileAnnual,
  reconcileContribSum,
  latestContribByCode,
  latestAnnualByCode,
} from './parse.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'pipeline', '.cache');
const OUT = path.join(ROOT, 'public', 'data');

const GROUP_CODES = [
  '20001', '20006', '20002', '20003', '20004', '115486',
  '20005', '115488', '115489', '115493', '126670',
];
const ALL = '10001';
const CITY_NAMES = { 1: 'Sydney', 2: 'Melbourne', 3: 'Brisbane', 4: 'Adelaide', 5: 'Perth', 6: 'Hobart', 7: 'Darwin', 8: 'Canberra' };

function log(m) {
  process.stdout.write(`[aggregate] ${m}\n`);
}
function read(name) {
  return fs.readFileSync(path.join(CACHE, name), 'utf8');
}
function die(m) {
  console.error(`[aggregate] ${m}`);
  process.exit(1);
}
function fmt(n) {
  return Number(n).toLocaleString('en-AU');
}

// ── 1. Parse ──────────────────────────────────────────────────────────────────
log('parsing sources…');
const hierarchy = buildHierarchy(JSON.parse(read('cpi-index-codelist.json')));
const { series: indexSeries, gmin, gmax } = parseIndexSeries(read('cpi-index-aus.csv'));
const annualRows = parseSdmx(read('cpi-annual-aus.csv'));
const contribRows = parseSdmx(read('cpi-contrib-aus.csv'));
log(`parsed ${indexSeries.size} index series, ${annualRows.length} annual rows, ${contribRows.length} contribution rows`);

const latestQi = gmax;
const latestPeriod = quarterFromIndex(latestQi);
log(`period span ${quarterFromIndex(gmin)} → ${latestPeriod}`);

// ── 2. Reconciliation gate 1 — computed vs published annual (All groups) ─────
const g1 = reconcileAnnual(indexSeries, annualRows, ALL, 0.15);
if (g1.violations.length > 0) {
  console.error('[aggregate] RECONCILIATION 1 FAILED — computed vs published annual (All groups):');
  for (const v of g1.violations.slice(0, 10)) console.error('  ', JSON.stringify(v));
  die(`${g1.violations.length} mismatches across ${g1.checked} quarters`);
}
log(`gate 1 OK — computed annual == published for All groups across ${g1.checked} quarters (0 mismatches)`);

// ── 3. Reconciliation gate 2 — group contributions sum to All-groups index ───
const g2 = reconcileContribSum(indexSeries, contribRows, GROUP_CODES, ALL, 0.2);
if (g2.violations.length > 0) {
  console.error('[aggregate] RECONCILIATION 2 FAILED — group contributions sum != All-groups index:');
  for (const v of g2.violations.slice(0, 10)) console.error('  ', JSON.stringify(v));
  die(`${g2.violations.length} mismatches across ${g2.checked} quarters`);
}
log(`gate 2 OK — 11 group contributions sum to the All-groups index across ${g2.checked} quarters (0 mismatches)`);

// ── 4. Structural assertions ─────────────────────────────────────────────────
if (quarterYear(gmin) > 1948) die(`CPI history should start in 1948, got ${quarterFromIndex(gmin)}`);
if (quarterYear(gmax) < 2024) die(`CPI history should reach 2024+, got ${latestPeriod}`);
if (!indexSeries.has(ALL)) die('missing All-groups CPI series');
for (const gc of GROUP_CODES) if (!indexSeries.has(gc)) die(`missing group series ${gc}`);

// ── 5. Group ancestry: for each code, its top-level group (child of All groups) ─
function groupOf(code) {
  let cur = hierarchy.get(code);
  if (!cur) return null;
  if (code === ALL) return null;
  let guard = 0;
  while (cur && cur.parent && cur.parent !== ALL && guard < 12) {
    cur = hierarchy.get(cur.parent);
    guard++;
  }
  return cur && cur.parent === ALL ? cur.code : GROUP_CODES.includes(code) ? code : null;
}
// children within the expenditure tree
const childrenOf = new Map();
for (const node of hierarchy.values()) {
  if (node.parent) {
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
    childrenOf.get(node.parent).push(node.code);
  }
}
// reachable from ALL (the genuine expenditure tree)
const inTree = new Set();
(function walk(code) {
  inTree.add(code);
  for (const ch of childrenOf.get(code) || []) walk(ch);
})(ALL);

// ── 6. Latest published annual + latest contribution per code ────────────────
const annualByCode = latestAnnualByCode(annualRows);
const { byCode: contribByCode } = latestContribByCode(contribRows);

// base quarters for cumulative windows (match Q of the latest period)
const q = latestQi % 4;
const base2000 = 2000 * 4 + q;
const base10 = latestQi - 40;
const base1 = latestQi - 4;

function annualComputedSeries(s) {
  // stdev + min/max of the computed annual series, for volatility insight
  const arr = [];
  for (let qi = s.s + 4; qi <= s.s + s.v.length - 1; qi++) {
    const c = cumChange(s, qi - 4, qi);
    if (c != null) arr.push(c);
  }
  if (!arr.length) return { vol: 0, min: 0, max: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const vol = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return { vol, min: Math.min(...arr), max: Math.max(...arr) };
}

// ── 7. Build classes.json ────────────────────────────────────────────────────
const classes = [];
for (const [code, s] of indexSeries) {
  const node = hierarchy.get(code);
  if (!node) continue;
  const li = lastValue(s);
  const lq = lastQuarter(s);
  const grp = groupOf(code);
  const an = annualByCode.get(code);
  const av = annualComputedSeries(s);
  const kids = (childrenOf.get(code) || []).filter((c) => indexSeries.has(c) && inTree.has(c));
  classes.push({
    code,
    name: node.name,
    desc: node.description,
    level: node.level,
    parent: node.parent,
    order: node.order,
    group: grp,
    tree: inTree.has(code),
    leaf: inTree.has(code) && kids.length === 0,
    s: s.s,
    v: s.v,
    li: li != null ? +li.toFixed(1) : null,
    lq,
    annual: an ? +an.value.toFixed(1) : null,
    contrib: contribByCode.has(code) ? +contribByCode.get(code).toFixed(3) : null,
    cumAll: round2(cumChange(s, s.s, latestQi)),
    cum2000: round2(cumChange(s, base2000, latestQi)),
    cum10: round2(cumChange(s, base10, latestQi)),
    cum1: round2(cumChange(s, base1, latestQi)),
    vol: +av.vol.toFixed(2),
    minA: +av.min.toFixed(1),
    maxA: +av.max.toFixed(1),
  });
}
function round2(n) {
  return n == null ? null : +n.toFixed(2);
}
log(`built ${classes.length} class series (tree: ${classes.filter((c) => c.tree).length}, leaves: ${classes.filter((c) => c.leaf).length})`);

// ── 8. Cities ────────────────────────────────────────────────────────────────
const cityRows = parseSdmx(read('cpi-cities.csv'));
const cityIdx = new Map(); // `${region}|${code}` -> [[qi,val]]
for (const r of cityRows) {
  const v = num(r.OBS_VALUE);
  if (v == null) continue;
  const key = `${r.REGION}|${r.INDEX}`;
  if (!cityIdx.has(key)) cityIdx.set(key, []);
  cityIdx.get(key).push([quarterIndex(r.TIME_PERIOD), v]);
}
function densify(pairs) {
  pairs.sort((a, b) => a[0] - b[0]);
  const s = pairs[0][0];
  const e = pairs[pairs.length - 1][0];
  const v = new Array(e - s + 1).fill(null);
  for (const [qi, val] of pairs) v[qi - s] = val;
  return { s, v };
}
const cityAllGroups = {};
const cityHeat = {};
for (const rc of Object.keys(CITY_NAMES)) {
  const allKey = `${rc}|${ALL}`;
  if (cityIdx.has(allKey)) {
    const ser = densify(cityIdx.get(allKey));
    const lq = lastQuarter(ser);
    cityAllGroups[rc] = { s: ser.s, v: ser.v, annual: round2(cumChange(ser, lq - 4, lq)), li: +lastValue(ser).toFixed(1) };
  }
  cityHeat[rc] = {};
  for (const gc of [ALL, ...GROUP_CODES]) {
    const key = `${rc}|${gc}`;
    if (!cityIdx.has(key)) continue;
    const ser = densify(cityIdx.get(key));
    const lq = lastQuarter(ser);
    cityHeat[rc][gc] = round2(cumChange(ser, lq - 4, lq));
  }
}
const cities = {
  latestPeriod,
  cities: Object.entries(CITY_NAMES).map(([code, name]) => ({ code, name })),
  groups: [ALL, ...GROUP_CODES].map((code) => ({ code, name: hierarchy.get(code).name })),
  allGroups: cityAllGroups,
  heat: cityHeat,
};

// ── 9. Wages (WPI) ───────────────────────────────────────────────────────────
const wpiRows = parseSdmx(read('wpi-index.csv'));
const wpiPairs = [];
for (const r of wpiRows) {
  const v = num(r.OBS_VALUE);
  if (v != null) wpiPairs.push([quarterIndex(r.TIME_PERIOD), v]);
}
if (wpiPairs.length < 40) die(`WPI series too short: ${wpiPairs.length} points`);
const wpi = densify(wpiPairs);
const wpiLq = lastQuarter(wpi);
const wages = {
  s: wpi.s,
  v: wpi.v,
  latestQi: wpiLq,
  latestPeriod: quarterFromIndex(wpiLq),
  li: +lastValue(wpi).toFixed(1),
  annual: round2(cumChange(wpi, wpiLq - 4, wpiLq)),
};

// ── 10. Headline + purchasing power ──────────────────────────────────────────
const allSer = indexSeries.get(ALL);
const allLatest = lastValue(allSer);
const headlineAnnual = annualByCode.get(ALL);
const purchasing = [];
for (const y of [1948, 1960, 1970, 1980, 1990, 2000, 2010, 2020]) {
  const qi = y * 4 + q;
  const v = valueAt(allSer, qi) ?? valueAt(allSer, y * 4) ?? valueAt(allSer, y * 4 + 2);
  if (v != null) purchasing.push({ year: y, worthNow: +(allLatest / v).toFixed(2), centsToday: +((v / allLatest) * 100).toFixed(1) });
}

// ── 11. Insights ─────────────────────────────────────────────────────────────
const leaves = classes.filter((c) => c.leaf);
const insights = [];
{
  // fastest riser since 2000
  const risers = leaves.filter((c) => c.cum2000 != null).sort((a, b) => b.cum2000 - a.cum2000);
  const top = risers[0];
  if (top)
    insights.push({
      severity: 'alert',
      title: `${top.name} rose the most since 2000`,
      body: `Prices for ${top.name.toLowerCase()} are up ${top.cum2000.toFixed(0)}% since 2000 — the steepest climb of any item in the basket. Over the same period the overall CPI rose ${classes.find((c) => c.code === ALL).cum2000.toFixed(0)}%.`,
      links: [top.code],
    });
  // the fallers
  const fallers = leaves.filter((c) => c.cum2000 != null && c.cum2000 < 0).sort((a, b) => a.cum2000 - b.cum2000);
  if (fallers.length)
    insights.push({
      severity: 'good',
      title: `${fallers.length} things are actually cheaper than in 2000`,
      body: `Not everything gets dearer. ${fallers.length} items cost less than they did in 2000 — led by ${fallers[0].name.toLowerCase()} (${fallers[0].cum2000.toFixed(0)}%). Falling technology and clothing prices quietly offset the rises.`,
      links: fallers.slice(0, 3).map((c) => c.code),
    });
  // biggest current annual mover
  const movers = leaves.filter((c) => c.annual != null).sort((a, b) => b.annual - a.annual);
  if (movers[0])
    insights.push({
      severity: 'warn',
      title: `Rising fastest right now: ${movers[0].name}`,
      body: `In the year to ${periodLabel(latestPeriod)}, ${movers[0].name.toLowerCase()} rose ${movers[0].annual.toFixed(1)}% — the fastest annual increase in the basket, against overall inflation of ${headlineAnnual.value.toFixed(1)}%.`,
      links: [movers[0].code],
    });
  const fallingNow = movers[movers.length - 1];
  if (fallingNow && fallingNow.annual < 0)
    insights.push({
      severity: 'good',
      title: `Falling fastest right now: ${fallingNow.name}`,
      body: `${fallingNow.name} fell ${Math.abs(fallingNow.annual).toFixed(1)}% over the year to ${periodLabel(latestPeriod)} — the biggest annual price drop in the basket.`,
      links: [fallingNow.code],
    });
  // most volatile
  const volat = leaves.filter((c) => c.vol > 0).sort((a, b) => b.vol - a.vol)[0];
  if (volat)
    insights.push({
      severity: 'info',
      title: `The wildest ride: ${volat.name}`,
      body: `${volat.name} has the most volatile price of any item — its annual inflation has swung between ${volat.minA.toFixed(0)}% and +${volat.maxA.toFixed(0)}%. Weather, fuel and global supply make it lurch.`,
      links: [volat.code],
    });
  // city divergence
  const latestByCity = Object.entries(cityHeat)
    .map(([rc, m]) => ({ city: CITY_NAMES[rc], v: m[ALL] }))
    .filter((x) => x.v != null)
    .sort((a, b) => b.v - a.v);
  if (latestByCity.length >= 2) {
    const hi = latestByCity[0];
    const lo = latestByCity[latestByCity.length - 1];
    insights.push({
      severity: 'info',
      title: `Inflation isn't the same in every city`,
      body: `Over the year to ${periodLabel(latestPeriod)}, prices rose fastest in ${hi.city} (${hi.v.toFixed(1)}%) and slowest in ${lo.city} (${lo.v.toFixed(1)}%) — a ${(hi.v - lo.v).toFixed(1)} point gap between capitals.`,
      links: [],
    });
  }
  // real-wage crunch (since 2020-Q4 vs prices)
  {
    const startY = 2020;
    const startQi = startY * 4 + q;
    const wageChg = cumChange(wpi, startQi, wpiLq);
    const priceChg = cumChange(allSer, startQi, latestQi);
    if (wageChg != null && priceChg != null) {
      const real = ((1 + wageChg / 100) / (1 + priceChg / 100) - 1) * 100;
      insights.push({
        severity: real < 0 ? 'alert' : 'good',
        title: real < 0 ? 'Wages have not kept up with prices' : 'Wages have outpaced prices',
        body: `Since ${startY}, wages rose ${wageChg.toFixed(1)}% while prices rose ${priceChg.toFixed(1)}% — a real change in buying power of ${real >= 0 ? '+' : ''}${real.toFixed(1)}%. ${real < 0 ? 'A pay rise that trails inflation is a pay cut in real terms.' : ''}`.trim(),
        links: [],
      });
    }
  }
  // purchasing power headline
  const pp2000 = purchasing.find((p) => p.year === 2000);
  if (pp2000)
    insights.push({
      severity: 'info',
      title: `The shrinking dollar`,
      body: `A dollar in 2000 buys about ${pp2000.centsToday.toFixed(0)}c worth of goods today — you now need $${pp2000.worthNow.toFixed(2)} to buy what $1 bought in 2000. Since 1948, prices are up more than ${(classes.find((c) => c.code === ALL).cumAll / 100).toFixed(0)}-fold.`,
      links: [],
    });
}

// ── 12. Meta ─────────────────────────────────────────────────────────────────
function quarterEndDate(period) {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  const ends = { 1: '03-31', 2: '06-30', 3: '09-30', 4: '12-31' };
  return `${m[1]}-${ends[m[2]]}`;
}
const meta = {
  generated: quarterEndDate(latestPeriod),
  latestPeriod,
  latestPeriodLabel: periodLabel(latestPeriod),
  latestYear: quarterYear(latestQi),
  latestQi,
  firstPeriod: quarterFromIndex(gmin),
  firstQi: gmin,
  basePeriodNote: 'ABS CPI index reference base: 2011–12 = 100.',
  headline: {
    annual: +headlineAnnual.value.toFixed(1),
    index: +allLatest.toFixed(1),
    cum2000: classes.find((c) => c.code === ALL).cum2000,
    cumAll: classes.find((c) => c.code === ALL).cumAll,
  },
  purchasing,
  wpi: {
    latestPeriod: wages.latestPeriod,
    latestPeriodLabel: periodLabel(wages.latestPeriod),
    index: wages.li,
    annual: wages.annual,
  },
  groups: GROUP_CODES.map((code) => ({ code, name: hierarchy.get(code).name })),
  cities: Object.entries(CITY_NAMES).map(([code, name]) => ({ code, name })),
  counts: { classes: classes.length, leaves: leaves.length },
  reconciliation: { annualChecked: g1.checked, contribChecked: g2.checked },
  sources: {
    cpi: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia',
    wpi: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia',
    api: 'https://data.api.abs.gov.au/',
  },
};

// ── 13. Write ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));
fs.writeFileSync(path.join(OUT, 'classes.json'), JSON.stringify(classes));
fs.writeFileSync(path.join(OUT, 'cities.json'), JSON.stringify(cities));
fs.writeFileSync(path.join(OUT, 'wages.json'), JSON.stringify(wages));
fs.writeFileSync(path.join(OUT, 'insights.json'), JSON.stringify(insights));

for (const f of ['meta.json', 'classes.json', 'cities.json', 'wages.json', 'insights.json']) {
  const sz = fs.statSync(path.join(OUT, f)).size;
  log(`wrote   ${f} (${sz.toLocaleString()} bytes)`);
}
log(`done — latest ${latestPeriod} (${periodLabel(latestPeriod)}), headline annual ${meta.headline.annual}%`);
