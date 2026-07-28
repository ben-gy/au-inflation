// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import { points, valueAt, qiOf } from '../data';
import { ALL_GROUPS_COLOUR } from '../colours';
import { lineChart } from '../charts';
import { attachSvgZoom } from '../utils/svgZoom';
import { viewHead } from './shared';
import { formatDollar } from '../utils/format';
import { glossaryTerm } from '../glossary';

export function renderDollar(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta } = data;
  const all = data.byCode.get('10001')!;
  const s = { s: all.s, v: all.v };
  const latestIdx = all.li!;
  const latestQ = (meta.latestQi % 4) + 1;
  const minYear = Math.ceil(all.s / 4);

  let year = 2000;

  root.innerHTML = `
    ${viewHead(
      'The shrinking dollar',
      `As prices rise, each dollar buys less — its ${glossaryTerm('purchasing_power', 'purchasing power')} falls. Pick a year to see what money from then is worth today, and how much you'd need now to match it.`,
    )}
    <div class="grid-2">
      <div class="panel dollar-panel">
        <div class="dollar-slider-row">
          <label class="field-label" for="ppyear">A dollar in</label>
          <input id="ppyear" type="range" min="${minYear}" max="${meta.latestYear - 1}" value="${year}" step="1" class="range" />
          <output class="dollar-year" data-role="year">${year}</output>
        </div>
        <div class="dollar-big">
          <div class="dollar-line">$1 in <span data-role="y1">${year}</span> buys about</div>
          <div class="dollar-cents" data-role="cents">—</div>
          <div class="dollar-line">worth of goods today</div>
        </div>
        <div class="dollar-flip">
          <div class="dollar-flip-item">
            <div class="dollar-flip-val" data-role="need">—</div>
            <div class="dollar-flip-lbl">needed today to match $1 in <span data-role="y2">${year}</span></div>
          </div>
          <div class="dollar-flip-item">
            <div class="dollar-flip-val" data-role="hundred">—</div>
            <div class="dollar-flip-lbl">what $100 then is worth now</div>
          </div>
        </div>
        <p class="stat-note" data-role="ppnote"></p>
      </div>
      <div class="panel">
        <div class="panel-title">The all-items price level since 1948</div>
        <div class="panel-sub">The ${glossaryTerm('index_number', 'CPI index')} (2011–12 = 100). Prices are more than ${(all.cumAll! / 100).toFixed(0)}× higher than in 1948 — the line barely moved for decades, then climbed steeply through the 1970s–80s inflation era.</div>
        <div class="chart-frame" data-role="chart"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">What a dollar has been worth, by decade</div>
      <div class="panel-sub">Cents of today's purchasing power for $1 from each year. The steepest erosion was the high-inflation 1970s and 80s.</div>
      <div class="pp-bars" data-role="ppbars"></div>
    </div>
  `;

  const chartSlot = root.querySelector('[data-role="chart"]') as HTMLElement;
  const svg = lineChart([{ id: 'all', label: '', colour: ALL_GROUPS_COLOUR, points: points(s), width: 2.6 }], {
    width: 520,
    height: 300,
    endLabels: false,
    valueNoun: 'index',
    yFmt: (v) => v.toFixed(0),
    annotations: [
      { x: qiOf(1975, 1), label: "'70s" },
      { x: qiOf(2000, 3), label: 'GST' },
    ],
  });
  chartSlot.appendChild(svg);
  attachSvgZoom(svg, { maxScale: 14 });

  function idxForYear(y: number): number | null {
    return valueAt(s, qiOf(y, latestQ)) ?? valueAt(s, qiOf(y, 1)) ?? valueAt(s, qiOf(y, 3));
  }

  function update(): void {
    const idx = idxForYear(year);
    const cents = idx ? (idx / latestIdx) * 100 : null;
    const need = idx ? latestIdx / idx : null;
    (root.querySelector('[data-role="year"]') as HTMLElement).textContent = String(year);
    (root.querySelector('[data-role="y1"]') as HTMLElement).textContent = String(year);
    (root.querySelector('[data-role="y2"]') as HTMLElement).textContent = String(year);
    (root.querySelector('[data-role="cents"]') as HTMLElement).textContent = cents != null ? `${cents.toFixed(0)}c` : '—';
    (root.querySelector('[data-role="need"]') as HTMLElement).textContent = need != null ? formatDollar(need) : '—';
    (root.querySelector('[data-role="hundred"]') as HTMLElement).textContent = cents != null ? formatDollar(cents) : '—';
    (root.querySelector('[data-role="ppnote"]') as HTMLElement).innerHTML =
      need != null
        ? `Prices have risen ${((need - 1) * 100).toFixed(0)}% since ${year}. Something that cost $10 then would cost about ${formatDollar(need * 10)} today — assuming it rose with the average basket.`
        : '';
  }

  root.querySelector('#ppyear')?.addEventListener('input', (e) => {
    year = Number((e.target as HTMLInputElement).value);
    update();
  });

  // decade bars
  const ppSlot = root.querySelector('[data-role="ppbars"]') as HTMLElement;
  ppSlot.innerHTML = meta.purchasing
    .map((p) => {
      return `<button class="pp-bar-row" data-year="${p.year}" data-tip="$1 in ${p.year} = ${p.centsToday.toFixed(1)}c today">
        <span class="pp-bar-year num">${p.year}</span>
        <span class="pp-bar-track"><span class="pp-bar-fill" style="width:${p.centsToday.toFixed(1)}%"></span></span>
        <span class="pp-bar-val num">${p.centsToday.toFixed(0)}c</span>
      </button>`;
    })
    .join('');
  ppSlot.querySelectorAll('[data-year]').forEach((b) =>
    b.addEventListener('click', () => {
      year = Number(b.getAttribute('data-year'));
      (root.querySelector('#ppyear') as HTMLInputElement).value = String(year);
      update();
    }),
  );

  update();
}
