// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import { cumChange, qiOf, rebased, valueAt } from '../data';
import { lineChart, type LineSeries } from '../charts';
import { viewHead } from './shared';
import { formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

const CPI_COLOUR = '#c0492f';
const WPI_COLOUR = '#2f6f8f';
const REAL_COLOUR = '#12433f';

export function renderWages(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta, wages } = data;
  const all = data.byCode.get('10001')!;
  const cpiS = { s: all.s, v: all.v };
  const wpiS = { s: wages.s, v: wages.v };

  // overlap window
  const startQi = Math.max(cpiS.s, wpiS.s);
  const endQi = Math.min(all.lq ?? meta.latestQi, wages.latestQi);
  const baseQi = startQi;

  // real wage index = WPI / CPI * 100, rebased to base
  const realPoints: Array<[number, number]> = [];
  const wpiBase = valueAt(wpiS, baseQi);
  const cpiBase = valueAt(cpiS, baseQi);
  if (wpiBase && cpiBase) {
    for (let qi = startQi; qi <= endQi; qi++) {
      const w = valueAt(wpiS, qi);
      const c = valueAt(cpiS, qi);
      if (w != null && c != null) realPoints.push([qi, (w / wpiBase / (c / cpiBase)) * 100]);
    }
  }

  const wageSince = cumChange(wpiS, startQi, wages.latestQi);
  const priceSince = cumChange(cpiS, startQi, endQi);
  const realSince = wageSince != null && priceSince != null ? ((1 + wageSince / 100) / (1 + priceSince / 100) - 1) * 100 : null;

  // recent (since 2020) crunch
  const q = meta.latestQi % 4;
  const c20 = qiOf(2020, q + 1);
  const wage20 = cumChange(wpiS, c20, wages.latestQi);
  const price20 = cumChange(cpiS, c20, endQi);
  const real20 = wage20 != null && price20 != null ? ((1 + wage20 / 100) / (1 + price20 / 100) - 1) * 100 : null;

  root.innerHTML = `
    ${viewHead(
      'Wages vs prices',
      `A pay rise only helps if it beats inflation. This tracks the ${glossaryTerm('wpi', 'Wage Price Index')} against the CPI since 1997 — and the ${glossaryTerm('real_wage', 'real wage')}, which is what your pay actually buys.`,
    )}

    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Wages since ${Math.floor(startQi / 4)}</div><div class="stat-value rise">${formatSignedPct(wageSince, 0)}</div><div class="stat-note">total wage growth</div></div>
      <div class="stat"><div class="stat-label">Prices since ${Math.floor(startQi / 4)}</div><div class="stat-value rise">${formatSignedPct(priceSince, 0)}</div><div class="stat-note">total inflation</div></div>
      <div class="stat"><div class="stat-label">Real wage, whole period</div><div class="stat-value ${real(realSince)}">${formatSignedPct(realSince, 0)}</div><div class="stat-note">buying power gained</div></div>
      <div class="stat"><div class="stat-label">Real wage since 2020</div><div class="stat-value ${real(real20)}">${formatSignedPct(real20, 1)}</div><div class="stat-note">the recent squeeze</div></div>
    </div>

    <div class="panel">
      <div class="panel-title">Wages and prices, indexed to ${Math.floor(startQi / 4)} = 100</div>
      <div class="panel-sub">Both lines start together. When the ${badge(CPI_COLOUR, 'price')} line pulls above the ${badge(WPI_COLOUR, 'wage')} line, households are falling behind.</div>
      <div class="chart-frame" data-role="chart1"></div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch line" style="background:${WPI_COLOUR}"></span>Wages (WPI)</span>
        <span class="legend-item"><span class="legend-swatch line" style="background:${CPI_COLOUR}"></span>Prices (CPI)</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">The real wage</div>
      <div class="panel-sub">Wages adjusted for inflation, rebased to ${Math.floor(startQi / 4)} = 100. Above 100 means pay has outpaced prices; the fall after 2020 is the sharpest real-wage decline in the series.</div>
      <div class="chart-frame" data-role="chart2"></div>
      <div class="callout">
        ${
          real20 != null && real20 < 0
            ? `Since 2020, wages rose ${formatSignedPct(wage20, 1)} while prices rose ${formatSignedPct(price20, 1)} — a <strong class="fall">${formatSignedPct(real20, 1)}</strong> hit to real buying power. A pay rise that trails inflation is a pay cut in real terms.`
            : `Since 2020, wages ${wage20 != null && price20 != null && wage20 > price20 ? 'outpaced' : 'trailed'} prices, a real change of <strong>${formatSignedPct(real20, 1)}</strong>.`
        }
      </div>
    </div>
  `;

  const s1: LineSeries[] = [
    { id: 'wpi', label: 'Wages', colour: WPI_COLOUR, points: rebased(wpiS, baseQi), width: 2.6 },
    { id: 'cpi', label: 'Prices', colour: CPI_COLOUR, points: rebased(cpiS, baseQi, wpiS.s), width: 2.6 },
  ];
  (root.querySelector('[data-role="chart1"]') as HTMLElement).appendChild(
    lineChart(s1, { width: 960, height: 360, endLabels: true, valueNoun: 'index', yFmt: (v) => v.toFixed(0) }),
  );

  (root.querySelector('[data-role="chart2"]') as HTMLElement).appendChild(
    lineChart([{ id: 'real', label: 'Real wage', colour: REAL_COLOUR, points: realPoints, width: 2.6 }], {
      width: 960,
      height: 320,
      endLabels: false,
      valueNoun: 'index',
      yFmt: (v) => v.toFixed(0),
      annotations: [{ x: qiOf(2020, 4), label: '2020' }],
    }),
  );
}

function real(v: number | null): string {
  if (v == null) return '';
  return v < 0 ? 'fall' : 'rise';
}
function badge(colour: string, label: string): string {
  return `<span class="ib" style="color:${colour};font-weight:600">${label}</span>`;
}
