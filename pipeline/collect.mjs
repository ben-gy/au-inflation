// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/**
 * collect.mjs — download the ABS SDMX slices this site needs into pipeline/.cache/.
 *
 * Sources (all public, no auth, CC BY 4.0):
 *   - ABS Consumer Price Index (dataflow ABS,CPI,1.1.0)
 *       dims: MEASURE.INDEX.TSEST.REGION.FREQ
 *       MEASURE 1 = Index numbers, 3 = % change from previous year,
 *                   4 = Contribution to CPI index number
 *       TSEST  10 = Original
 *       REGION 50 = Australia (weighted average of 8 capitals), 1..8 = capitals
 *   - ABS Wage Price Index (dataflow ABS,WPI,1.2.0)
 *       dims: MEASURE.INDEX.SECTOR.INDUSTRY.TSEST.REGION.FREQ
 *       INDEX THRPEB = Total hourly rates of pay excluding bonuses
 *       SECTOR 7 = Private and Public, INDUSTRY TOT = All industries,
 *       TSEST 20 = Seasonally Adjusted, REGION AUS
 *
 * The structure (dimension code lists) is fetched too, so the hierarchy of
 * expenditure classes (parent/description) is built from the authoritative
 * source rather than hand-typed.
 *
 * Downloads are cached; the structure files always refresh (they are tiny).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'pipeline', '.cache');

const BASE = 'https://data.api.abs.gov.au/rest';
const CSV = 'application/vnd.sdmx.data+csv';
const STRUCT = 'application/vnd.sdmx.structure+json';

// The 11 CPI groups + All-groups CPI — the codes used for by-city and the
// group-level heatmap. All-groups is 10001.
const GROUP_CODES = [
  '10001', // All groups CPI
  '20001', // Food and non-alcoholic beverages
  '20006', // Alcohol and tobacco
  '20002', // Clothing and footwear
  '20003', // Housing
  '20004', // Furnishings, household equipment and services
  '115486', // Health
  '20005', // Transport
  '115488', // Communication
  '115489', // Recreation and culture
  '115493', // Education
  '126670', // Insurance and financial services
];

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function log(msg) {
  process.stdout.write(`[collect] ${msg}\n`);
}

function fetchTo(url, dest, { accept, minBytes = 512, json = false, refresh = false } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!refresh && fs.existsSync(dest) && fs.statSync(dest).size >= minBytes) {
    log(`cached  ${path.basename(dest)}`);
    return dest;
  }
  log(`fetch   ${url}`);
  execFileSync(
    'curl',
    ['-sSL', '--fail', '--retry', '4', '--retry-delay', '3', '-H', `Accept: ${accept}`, '-A', UA, '-o', dest, url],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const size = fs.statSync(dest).size;
  if (size < minBytes) throw new Error(`Downloaded ${url} but got only ${size} bytes — source may have moved.`);
  if (json) JSON.parse(fs.readFileSync(dest, 'utf8')); // fail loud on an error page
  log(`ok      ${path.basename(dest)} (${size.toLocaleString()} bytes)`);
  return dest;
}

function dataUrl(flow, key) {
  return `${BASE}/data/${flow}/${key}?format=csvfile`;
}

function main() {
  fs.mkdirSync(CACHE, { recursive: true });

  // ── Structure: the CPI INDEX code list (hierarchy, names, descriptions) ──
  fetchTo(`${BASE}/codelist/ABS/CL_CPI_INDEX`, path.join(CACHE, 'cpi-index-codelist.json'), {
    accept: STRUCT,
    minBytes: 5000,
    json: true,
    refresh: true,
  });

  // ── CPI data slices for Australia (region 50) ──
  // 1. Index numbers, every expenditure class, full history.
  fetchTo(dataUrl('ABS,CPI,1.1.0', '1..10.50.Q'), path.join(CACHE, 'cpi-index-aus.csv'), {
    accept: CSV,
    minBytes: 200_000,
    refresh: true,
  });
  // 2. Published % change from previous year — for the reconciliation gate.
  fetchTo(dataUrl('ABS,CPI,1.1.0', '3..10.50.Q'), path.join(CACHE, 'cpi-annual-aus.csv'), {
    accept: CSV,
    minBytes: 100_000,
    refresh: true,
  });
  // 3. Contribution to the CPI index number — basket weights + reconciliation.
  //    ABS publishes contributions only for the most recent ~year of quarters
  //    (all codes), so this slice is small by design.
  fetchTo(dataUrl('ABS,CPI,1.1.0', '4..10.50.Q'), path.join(CACHE, 'cpi-contrib-aus.csv'), {
    accept: CSV,
    minBytes: 15_000,
    refresh: true,
  });

  // ── CPI by capital city — All-groups + the 11 groups, 8 capitals (1..8) ──
  const cityKey = `1.${GROUP_CODES.join('+')}.10.1+2+3+4+5+6+7+8.Q`;
  fetchTo(dataUrl('ABS,CPI,1.1.0', cityKey), path.join(CACHE, 'cpi-cities.csv'), {
    accept: CSV,
    minBytes: 50_000,
    refresh: true,
  });

  // ── Wage Price Index: total hourly rates ex bonuses, all sectors + industries,
  //    seasonally adjusted, Australia. Index (1) and annual % change (3). ──
  fetchTo(dataUrl('ABS,WPI,1.2.0', '1.THRPEB.7.TOT.20.AUS.Q'), path.join(CACHE, 'wpi-index.csv'), {
    accept: CSV,
    minBytes: 3_000,
    refresh: true,
  });

  log('all sources ready');
}

main();
