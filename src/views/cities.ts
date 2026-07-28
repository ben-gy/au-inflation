// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import { rebased, qiOf } from '../data';
import { CITY_COLOUR, inflationColour, textOn } from '../colours';
import { lineChart, type LineSeries } from '../charts';
import { viewHead } from './shared';
import { escapeHtml, formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

export function renderCities(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta, cities } = data;
  const cityList = cities.cities;

  // latest all-groups annual per city, sorted
  const ranked = cityList
    .map((c) => ({ ...c, annual: cities.allGroups[c.code]?.annual ?? null }))
    .filter((c) => c.annual != null)
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0));
  const maxA = Math.max(...ranked.map((c) => Math.abs(c.annual ?? 0)), 1);

  root.innerHTML = `
    ${viewHead(
      'By city',
      `Inflation isn't the same everywhere. The CPI covers the eight capital cities separately — over the year to ${escapeHtml(meta.latestPeriodLabel)}, the gap between the fastest and slowest capital was ${(ranked.length ? (ranked[0].annual! - ranked[ranked.length - 1].annual!) : 0).toFixed(1)} points.`,
    )}

    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">Annual inflation by capital</div>
        <div class="panel-sub">Year to ${escapeHtml(meta.latestPeriodLabel)}, all-items CPI. The national average was ${meta.headline.annual}%.</div>
        <div class="city-bars" data-role="citybars"></div>
      </div>
      <div class="panel">
        <div class="panel-title">Prices since 2000, each capital</div>
        <div class="panel-sub">All-items ${glossaryTerm('index_number', 'index')} rebased to 2000 = 100. The capitals have diverged as housing costs pulled apart.</div>
        <div class="chart-frame" data-role="trend"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Which group rose most, in which city</div>
      <div class="panel-sub">Annual price change by ${glossaryTerm('cpi_group', 'group')} and capital, year to ${escapeHtml(meta.latestPeriodLabel)}. Redder = faster rising. Hover any cell for the exact figure.</div>
      <div class="matrix-scroll" data-role="heat"></div>
    </div>
  `;

  // city bars
  const barsSlot = root.querySelector('[data-role="citybars"]') as HTMLElement;
  barsSlot.innerHTML = ranked
    .map((c) => {
      const v = c.annual ?? 0;
      return `<div class="grouprow" data-tip="${escapeHtml(c.name)}: ${formatSignedPct(v)} annual">
        <span class="grouprow-name">${escapeHtml(c.name)}</span>
        <span class="grouprow-track"><span class="grouprow-fill" style="width:${((Math.abs(v) / maxA) * 100).toFixed(1)}%;background:${CITY_COLOUR[c.code]}"></span></span>
        <span class="grouprow-val num">${formatSignedPct(v)}</span>
      </div>`;
    })
    .join('');

  // trend
  const trendSlot = root.querySelector('[data-role="trend"]') as HTMLElement;
  const q = meta.latestQi % 4;
  const base2000 = qiOf(2000, q + 1);
  const series: LineSeries[] = cityList
    .map((c) => {
      const ag = cities.allGroups[c.code];
      if (!ag) return null;
      const s = { s: ag.s, v: ag.v };
      return { id: c.code, label: c.name.slice(0, 3), colour: CITY_COLOUR[c.code], points: rebased(s, base2000) } as LineSeries;
    })
    .filter((x): x is LineSeries => x != null);
  trendSlot.appendChild(lineChart(series, { width: 520, height: 320, endLabels: true, valueNoun: 'index', yFmt: (v) => v.toFixed(0) }));

  // heatmap: rows = groups, cols = cities
  const heatSlot = root.querySelector('[data-role="heat"]') as HTMLElement;
  const groupRows = cities.groups; // includes All groups first
  const head = `<thead><tr><th>Group</th>${cityList.map((c) => `<th>${escapeHtml(c.name.slice(0, 3))}</th>`).join('')}</tr></thead>`;
  const body = groupRows
    .map((g) => {
      const cellCode = g.code;
      const tds = cityList
        .map((c) => {
          const v = cities.heat[c.code]?.[cellCode];
          if (v == null) return `<td class="heat-empty">—</td>`;
          const bg = inflationColour(v);
          const tip = `${escapeHtml(g.name)} in ${escapeHtml(c.name)}: ${formatSignedPct(v)}`;
          return `<td style="background:${bg};color:${textOn(bg)}" data-tip="${tip}">${v.toFixed(1)}</td>`;
        })
        .join('');
      const rowClass = cellCode === '10001' ? ' class="heat-total"' : '';
      return `<tr${rowClass}><th>${escapeHtml(g.name)}</th>${tds}</tr>`;
    })
    .join('');
  heatSlot.innerHTML = `<table class="matrix">${head}<tbody>${body}</tbody></table>`;
}
