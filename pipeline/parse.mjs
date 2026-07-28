// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/**
 * parse.mjs — dependency-free parsers, hierarchy builder and reconciliation gates
 * for the ABS CPI + WPI SDMX CSV slices. Imported by both aggregate.mjs and the
 * vitest suite, so every rule here is unit-tested.
 */

// ── RFC-4180 CSV reader (handles quoted fields with embedded commas/newlines) ──
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // swallow; \n handles the row break
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse an SDMX data CSV into an array of row objects keyed by header. */
export function parseSdmx(text) {
  const rows = parseCsv(text).filter((r) => r.length > 1 && r.some((c) => c !== ''));
  if (!rows.length) return [];
  const header = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const o = {};
    for (let j = 0; j < header.length; j++) o[header[j]] = r[j];
    out.push(o);
  }
  return out;
}

// ── Quarter maths ──
// A quarter is encoded as an absolute integer: year*4 + (q-1).
// "1948-Q3" -> 1948*4 + 2 = 7794.
export function quarterIndex(period) {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) throw new Error(`Bad period: ${period}`);
  return Number(m[1]) * 4 + (Number(m[2]) - 1);
}
export function quarterFromIndex(qi) {
  const year = Math.floor(qi / 4);
  const q = (qi % 4) + 1;
  return `${year}-Q${q}`;
}
export function quarterYear(qi) {
  return Math.floor(qi / 4);
}
const MONTHS = ['March', 'June', 'September', 'December'];
export function periodLabel(period) {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) return period;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Coerce an SDMX OBS_VALUE to a finite number or null (blank = not published). */
export function num(v) {
  if (v == null || v === '' || v === 'NaN') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ── CPI INDEX code-list → hierarchy ──
// Each code carries {parent, name, description, order}. Level is derived by
// walking parents (All groups = level 0).
export function buildHierarchy(codelistJson) {
  const codes = codelistJson.data.codelists[0].codes;
  const map = new Map();
  for (const c of codes) {
    const orderAnn = (c.annotations || []).find((a) => a.type === 'ORDER');
    map.set(c.id, {
      code: c.id,
      name: c.name,
      description: c.description || '',
      parent: c.parent || null,
      order: orderAnn ? Number(orderAnn.text) : 0,
      level: null,
    });
  }
  const levelOf = (code, guard = 0) => {
    const n = map.get(code);
    if (!n) return 0;
    if (n.level != null) return n.level;
    if (!n.parent || guard > 12) {
      n.level = 0;
      return 0;
    }
    n.level = levelOf(n.parent, guard + 1) + 1;
    return n.level;
  };
  for (const code of map.keys()) levelOf(code);
  return map;
}

/**
 * Parse a MEASURE=1 (index numbers) SDMX CSV into a per-code contiguous series.
 * Returns Map<code, {s: startQuarterIndex, v: (number|null)[]}> where v is dense
 * across quarters (null fills any internal gap). Also returns the global period
 * span. Rows for codes with a single measure only.
 */
export function parseIndexSeries(text) {
  const rows = parseSdmx(text);
  const byCode = new Map();
  for (const r of rows) {
    const code = r.INDEX;
    const period = r.TIME_PERIOD;
    const value = num(r.OBS_VALUE);
    if (value == null) continue;
    const qi = quarterIndex(period);
    let arr = byCode.get(code);
    if (!arr) {
      arr = [];
      byCode.set(code, arr);
    }
    arr.push([qi, value]);
  }
  const series = new Map();
  let gmin = Infinity;
  let gmax = -Infinity;
  for (const [code, arr] of byCode) {
    arr.sort((a, b) => a[0] - b[0]);
    const s = arr[0][0];
    const e = arr[arr.length - 1][0];
    const v = new Array(e - s + 1).fill(null);
    for (const [qi, value] of arr) v[qi - s] = value;
    series.set(code, { s, v });
    gmin = Math.min(gmin, s);
    gmax = Math.max(gmax, e);
  }
  return { series, gmin, gmax };
}

/** value of a {s,v} series at absolute quarter qi, or null. */
export function valueAt(series, qi) {
  if (!series) return null;
  const i = qi - series.s;
  if (i < 0 || i >= series.v.length) return null;
  return series.v[i];
}
export function lastValue(series) {
  for (let i = series.v.length - 1; i >= 0; i--) if (series.v[i] != null) return series.v[i];
  return null;
}
export function lastQuarter(series) {
  for (let i = series.v.length - 1; i >= 0; i--) if (series.v[i] != null) return series.s + i;
  return null;
}

/** Cumulative % change of a series from quarter `fromQi` to quarter `toQi`. */
export function cumChange(series, fromQi, toQi) {
  const a = valueAt(series, fromQi);
  const b = valueAt(series, toQi);
  if (a == null || b == null || a === 0) return null;
  return (b / a - 1) * 100;
}

// ── Reconciliation gate 1: computed vs published annual change (All groups) ──
// (index[t]/index[t-4]-1)*100 must equal ABS-published MEASURE-3, within tol.
export function reconcileAnnual(indexSeries, annualRows, code = '10001', tol = 0.15) {
  const s = indexSeries.get(code);
  const violations = [];
  if (!s) return [{ period: '-', reason: `no index series for ${code}` }];
  const published = new Map();
  for (const r of annualRows) {
    if (r.INDEX !== code) continue;
    const p = num(r.OBS_VALUE);
    if (p != null) published.set(quarterIndex(r.TIME_PERIOD), p);
  }
  let checked = 0;
  for (const [qi, pub] of published) {
    const computed = cumChange(s, qi - 4, qi);
    if (computed == null) continue;
    checked++;
    if (Math.abs(computed - pub) > tol) {
      violations.push({ period: quarterFromIndex(qi), computed: +computed.toFixed(2), published: pub });
    }
  }
  return { violations, checked };
}

// ── Reconciliation gate 2: group contributions sum to the All-groups index ──
// Sum of the 11 groups' MEASURE-4 contribution == All-groups MEASURE-1 index,
// at every quarter, within tol.
export function reconcileContribSum(indexSeries, contribRows, groupCodes, allCode = '10001', tol = 0.2) {
  const all = indexSeries.get(allCode);
  const violations = [];
  if (!all) return { violations: [{ period: '-', reason: 'no all-groups index' }], checked: 0 };
  // contribution per (period, code)
  const byPeriod = new Map();
  for (const r of contribRows) {
    if (!groupCodes.includes(r.INDEX)) continue;
    const v = num(r.OBS_VALUE);
    if (v == null) continue;
    const qi = quarterIndex(r.TIME_PERIOD);
    let m = byPeriod.get(qi);
    if (!m) {
      m = new Map();
      byPeriod.set(qi, m);
    }
    m.set(r.INDEX, v);
  }
  let checked = 0;
  for (const [qi, m] of byPeriod) {
    if (m.size < groupCodes.length) continue; // only quarters where all 11 groups exist
    const idx = valueAt(all, qi);
    if (idx == null) continue;
    let sum = 0;
    for (const v of m.values()) sum += v;
    checked++;
    if (Math.abs(sum - idx) > tol) {
      violations.push({ period: quarterFromIndex(qi), sum: +sum.toFixed(2), index: idx });
    }
  }
  return { violations, checked };
}

/** Latest contribution (MEASURE 4) value per code, at the latest common period. */
export function latestContribByCode(contribRows) {
  let latestQi = -Infinity;
  for (const r of contribRows) {
    if (num(r.OBS_VALUE) == null) continue;
    latestQi = Math.max(latestQi, quarterIndex(r.TIME_PERIOD));
  }
  const out = new Map();
  for (const r of contribRows) {
    if (quarterIndex(r.TIME_PERIOD) !== latestQi) continue;
    const v = num(r.OBS_VALUE);
    if (v != null) out.set(r.INDEX, v);
  }
  return { latestQi, byCode: out };
}

/** Latest published annual % change (MEASURE 3) per code. */
export function latestAnnualByCode(annualRows) {
  // per code, the value at that code's own latest available period
  const byCode = new Map();
  for (const r of annualRows) {
    const v = num(r.OBS_VALUE);
    if (v == null) continue;
    const qi = quarterIndex(r.TIME_PERIOD);
    const cur = byCode.get(r.INDEX);
    if (!cur || qi > cur.qi) byCode.set(r.INDEX, { qi, value: v });
  }
  return byCode;
}
