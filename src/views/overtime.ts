// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import type { Series } from '../types';
import { valueAt, qiOf } from '../data';
import { inflationColour, textOn } from '../colours';
import { viewHead } from './shared';
import { escapeHtml } from '../utils/format';
import { glossaryTerm } from '../glossary';

/** Average annualised inflation of a series across a decade [y0, y0+9]. */
function decadeInflation(s: Series, y0: number): number | null {
  const q = 3; // use Q3 anchors (Sep) for a consistent 10-year window
  const start = qiOf(y0 - 1, q + 1); // end of prior year
  const end = qiOf(y0 + 9, q + 1);
  const a = valueAt(s, start);
  const b = valueAt(s, end);
  if (a == null || b == null || a <= 0) return null;
  return (Math.pow(b / a, 1 / 10) - 1) * 100;
}

export function renderOvertime(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta } = data;
  const all = data.byCode.get('10001')!;
  const decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].filter((d) => d <= meta.latestYear);

  const rows = [all, ...data.groups];

  root.innerHTML = `
    ${viewHead(
      'Inflation over time',
      `Average annual ${glossaryTerm('inflation', 'inflation')} for each group, decade by decade. The 1970s and 80s were an era of double-digit inflation across the board; the 2010s were the calmest in the record; then prices jumped again in the 2020s.`,
    )}
    <div class="panel">
      <div class="panel-title">Average annual inflation by group and decade</div>
      <div class="panel-sub">Each cell is the average yearly price rise over that decade (the 2020s cover ${meta.latestYear - 2020 + 1} years so far). Redder = faster. Hover for the exact rate; click a group row to open it.</div>
      <div class="matrix-scroll">
        <table class="matrix heat-time">
          <thead><tr><th>Group</th>${decades.map((d) => `<th>${d}s</th>`).join('')}</tr></thead>
          <tbody data-role="rows"></tbody>
        </table>
      </div>
      <div class="ramp-legend"><span>Falling</span><span class="ramp ramp-infl"></span><span>Rising fast</span></div>
    </div>

    <div class="panel">
      <div class="panel-title">The calmest and wildest decades</div>
      <div class="panel-sub">All-items CPI, average annual inflation per decade.</div>
      <div class="decade-bars" data-role="decbars"></div>
    </div>
  `;

  const rowsSlot = root.querySelector('[data-role="rows"]') as HTMLElement;
  rowsSlot.innerHTML = rows
    .map((r) => {
      const s = { s: r.s, v: r.v };
      const cells = decades
        .map((d) => {
          const val = decadeInflation(s, d);
          if (val == null) return `<td class="heat-empty">—</td>`;
          const bg = inflationColour(val);
          return `<td style="background:${bg};color:${textOn(bg)}" data-tip="${escapeHtml(r.name)}, ${d}s: ${val.toFixed(1)}% a year">${val.toFixed(1)}</td>`;
        })
        .join('');
      const cls = r.code === '10001' ? ' class="heat-total clickable"' : ' class="clickable"';
      return `<tr${cls} data-code="${r.code}"><th>${escapeHtml(r.name)}</th>${cells}</tr>`;
    })
    .join('');
  rowsSlot.querySelectorAll('[data-code]').forEach((tr) => tr.addEventListener('click', () => ctx.openItem(tr.getAttribute('data-code')!)));

  // decade bars for all-items
  const decSlot = root.querySelector('[data-role="decbars"]') as HTMLElement;
  const allS = { s: all.s, v: all.v };
  const decVals = decades.map((d) => ({ d, v: decadeInflation(allS, d) })).filter((x) => x.v != null);
  const maxV = Math.max(...decVals.map((x) => x.v!), 1);
  decSlot.innerHTML = decVals
    .map(
      (x) =>
        `<div class="grouprow" data-tip="${x.d}s: ${x.v!.toFixed(1)}% a year"><span class="grouprow-name num">${x.d}s</span><span class="grouprow-track"><span class="grouprow-fill" style="width:${((x.v! / maxV) * 100).toFixed(1)}%;background:${inflationColour(x.v)}"></span></span><span class="grouprow-val num">${x.v!.toFixed(1)}%</span></div>`,
    )
    .join('');
}
