// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import { annualPoints } from '../data';
import { ALL_GROUPS_COLOUR, changeColour, groupColour } from '../colours';
import { lineChart } from '../charts';
import { viewHead } from './shared';
import { escapeHtml, formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

export function renderOverview(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta } = data;
  const all = data.byCode.get('10001')!;
  const leaves = data.leaves.filter((c) => c.cum2000 != null);
  const risers = [...leaves].sort((a, b) => (b.cum2000 ?? 0) - (a.cum2000 ?? 0));
  const fallers = [...leaves].filter((c) => (c.cum2000 ?? 0) < 0).sort((a, b) => (a.cum2000 ?? 0) - (b.cum2000 ?? 0));
  const topRise = risers[0];
  const bigFall = fallers[0] ?? risers[risers.length - 1];
  const pp2000 = meta.purchasing.find((p) => p.year === 2000);

  // group annual bars (latest)
  const groupsSorted = [...data.groups].sort((a, b) => (b.annual ?? -99) - (a.annual ?? -99));
  const maxAnnual = Math.max(...data.groups.map((g) => Math.abs(g.annual ?? 0)), 1);

  root.innerHTML = `
    ${viewHead(
      'Cost of Living',
      `Every item in Australia's ${glossaryTerm('cpi', 'Consumer Price Index')} basket, tracked since 1948. Overall ${glossaryTerm('inflation', 'inflation')} was ${meta.headline.annual}% over the year to ${escapeHtml(meta.latestPeriodLabel)} — but that one number hides an enormous range.`,
    )}

    <div class="hero">
      <div class="hero-lead">
        <div class="hero-kicker">The one thing the headline hides</div>
        <div class="big-stat">Not everything gets<br><span class="hl-rise">more expensive</span>.</div>
        <p class="hero-copy">
          Since 2000, ${glossaryTerm('expenditure_class', 'tobacco')} is up <strong class="rise">${formatSignedPct(topRise.cum2000, 0)}</strong>
          and rents, health and schooling have soared — while
          <strong class="fall">${escapeHtml(bigFall.name.toLowerCase())}</strong> actually cost
          <strong class="fall">${formatSignedPct(bigFall.cum2000, 0)}</strong> less. ${fallers.length} of the basket's
          items are cheaper now than in 2000. Inflation is an average of winners and losers.
        </p>
        <div class="hero-actions">
          <button class="btn-primary" data-go="movers">See risers &amp; fallers →</button>
          <button class="btn-ghost" data-go="lookup">Look up an item</button>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-panel-title">The overall basket, year on year</div>
        <div class="chart-frame" data-role="hero-chart"></div>
        <div class="hero-panel-note">Annual change in the all-items CPI. The 2022 spike is the sharpest since the early 1990s; the long fall through the 1990s followed the shift to inflation targeting.</div>
      </div>
    </div>

    <div class="stat-grid">
      <button class="stat clickable" data-go="dollar">
        <div class="stat-label">Inflation now</div>
        <div class="stat-value accent">${meta.headline.annual}%</div>
        <div class="stat-note">year to ${escapeHtml(meta.latestPeriodLabel)}</div>
      </button>
      <button class="stat clickable" data-code="${topRise.code}">
        <div class="stat-label">Biggest riser since 2000</div>
        <div class="stat-value rise">${formatSignedPct(topRise.cum2000, 0)}</div>
        <div class="stat-note">${escapeHtml(topRise.name)}</div>
      </button>
      <button class="stat clickable" data-code="${bigFall.code}">
        <div class="stat-label">Biggest faller since 2000</div>
        <div class="stat-value fall">${formatSignedPct(bigFall.cum2000, 0)}</div>
        <div class="stat-note">${escapeHtml(bigFall.name)}</div>
      </button>
      <button class="stat clickable" data-go="dollar">
        <div class="stat-label">A 2000 dollar today</div>
        <div class="stat-value">${pp2000 ? pp2000.centsToday.toFixed(0) : '—'}c</div>
        <div class="stat-note">buys what $1 did in 2000</div>
      </button>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">Inflation by group, latest year</div>
        <div class="panel-sub">Annual price change for each of the ${meta.groups.length} ${glossaryTerm('cpi_group', 'CPI groups')} in the year to ${escapeHtml(meta.latestPeriodLabel)}.</div>
        <div class="grouprow-list" data-role="grouprows"></div>
      </div>
      <div class="panel">
        <div class="panel-title">Since 2000: the extremes</div>
        <div class="panel-sub">The five steepest rises and the items that fell most. Click any for its full trajectory.</div>
        <div class="extremes" data-role="extremes"></div>
      </div>
    </div>
  `;

  // hero chart — all groups annual since 1970
  const heroSlot = root.querySelector('[data-role="hero-chart"]') as HTMLElement;
  const svg = lineChart(
    [{ id: 'all', label: '', colour: ALL_GROUPS_COLOUR, points: annualPoints({ s: all.s, v: all.v }, 1970 * 4), width: 3 }],
    {
      width: 520,
      height: 240,
      endLabels: false,
      valueNoun: '',
      yFmt: (v) => `${v.toFixed(0)}%`,
      zeroLine: true,
      annotations: [
        { x: 2000 * 4 + 2, label: 'GST' },
        { x: 2020 * 4 + 1, label: 'COVID' },
      ],
    },
  );
  heroSlot.appendChild(svg);

  // group rows
  const grSlot = root.querySelector('[data-role="grouprows"]') as HTMLElement;
  grSlot.innerHTML = groupsSorted
    .map((g) => {
      const v = g.annual ?? 0;
      const w = (Math.abs(v) / maxAnnual) * 100;
      return `<button class="grouprow" data-code="${g.code}">
        <span class="grouprow-name">${escapeHtml(g.name)}</span>
        <span class="grouprow-track"><span class="grouprow-fill ${v < 0 ? 'fall' : 'rise'}" style="width:${w.toFixed(1)}%;background:${groupColour(g.code)}"></span></span>
        <span class="grouprow-val num">${formatSignedPct(g.annual)}</span>
      </button>`;
    })
    .join('');

  // extremes
  const exSlot = root.querySelector('[data-role="extremes"]') as HTMLElement;
  const top5 = risers.slice(0, 5);
  const fall5 = fallers.slice(0, 5);
  const maxAbs = Math.max(...[...top5, ...fall5].map((c) => Math.abs(c.cum2000 ?? 0)), 1);
  const rowHtml = (c: (typeof top5)[number]) => {
    const v = c.cum2000 ?? 0;
    return `<button class="extreme-row" data-code="${c.code}" data-tip="${escapeHtml(c.name)}: ${formatSignedPct(v, 0)} since 2000">
      <span class="extreme-name">${escapeHtml(c.name)}</span>
      <span class="extreme-track"><span class="extreme-fill" style="width:${((Math.abs(v) / maxAbs) * 100).toFixed(1)}%;background:${changeColour(v)}"></span></span>
      <span class="extreme-val num ${v < 0 ? 'fall' : 'rise'}">${formatSignedPct(v, 0)}</span>
    </button>`;
  };
  exSlot.innerHTML = `
    <div class="extreme-head rise">Up the most</div>
    ${top5.map(rowHtml).join('')}
    <div class="extreme-head fall">Down the most</div>
    ${fall5.map(rowHtml).join('')}`;

  // wire clicks
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ctx.goTo(b.getAttribute('data-go') as any)));
  root.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => ctx.openItem(b.getAttribute('data-code')!)));
}
