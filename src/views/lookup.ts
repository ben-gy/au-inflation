// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import type { ClassRec } from '../types';
import { annualPoints, cumChange, qiOf, rebased, searchClasses } from '../data';
import { groupColour } from '../colours';
import { lineChart, type LineSeries } from '../charts';
import { attachSvgZoom } from '../utils/svgZoom';
import { viewHead } from './shared';
import { escapeHtml, formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

const PALETTE = ['#12433f', '#c0492f', '#d8a52c', '#2f6f8f', '#9c3d6e', '#3d7f5a'];
// Tobacco, Electricity, Child care, Automotive fuel, Bread, Beer
const SUGGESTED = ['40090', '40055', '115498', '40081', '40005', '40087'];

export function renderLookup(root: HTMLElement, ctx: ViewContext, seed?: string[]): void {
  const { data } = ctx;
  const { meta } = data;
  const latestQ = (meta.latestQi % 4) + 1;

  // Default story: tobacco soaring vs computing collapsing vs rents climbing.
  let selected: string[] = (seed && seed.length ? seed : ['40090', '40098', '30014']).filter((c) => data.byCode.has(c)).slice(0, 6);
  if (!selected.length) selected = ['10001'];
  let mode: 'index' | 'annual' = 'index';
  let baseYear = 2000;
  const years = [1960, 1970, 1980, 1990, 2000, 2010, 2020].filter((y) => y <= meta.latestYear - 1);

  root.innerHTML = `
    ${viewHead(
      'Look up an item',
      `Type any item — "rent", "bananas", "childcare" — and chart its price against the ${meta.counts.classes}-item basket. Add several to compare on one axis. Prices are ${glossaryTerm('index_number', 'rebased')} so different items line up.`,
    )}
    <div class="panel">
      <div class="lookup-controls">
        <div class="search-wrap inline">
          <input class="text-input lookup-input" type="search" placeholder="Add an item to compare…" aria-label="Search items" autocomplete="off" />
          <div class="search-results" role="listbox"></div>
        </div>
        <div class="seg" role="tablist" aria-label="Metric">
          <button class="seg-btn" data-mode="index" aria-pressed="true">Price (rebased)</button>
          <button class="seg-btn" data-mode="annual" aria-pressed="false">Inflation %</button>
        </div>
        <span class="field-label" data-role="baselbl">Rebase to</span>
        <select data-role="base">${years.map((y) => `<option value="${y}" ${y === baseYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <div class="chips" data-role="chips"></div>
      <div class="suggested" data-role="suggested"></div>
      <div class="chart-frame" data-role="chart"></div>
      <div class="lookup-table" data-role="table"></div>
    </div>
  `;

  const chartSlot = root.querySelector('[data-role="chart"]') as HTMLElement;
  const chipSlot = root.querySelector('[data-role="chips"]') as HTMLElement;
  const tableSlot = root.querySelector('[data-role="table"]') as HTMLElement;
  const input = root.querySelector('.lookup-input') as HTMLInputElement;
  const results = root.querySelector('.search-results') as HTMLElement;
  const baseLbl = root.querySelector('[data-role="baselbl"]') as HTMLElement;
  const baseSel = root.querySelector('[data-role="base"]') as HTMLSelectElement;

  function colourFor(i: number): string {
    return PALETTE[i % PALETTE.length];
  }

  function paint(): void {
    // chips
    chipSlot.innerHTML = selected
      .map((code, i) => {
        const c = data.byCode.get(code)!;
        return `<span class="chip-tag" style="border-color:${colourFor(i)}"><span class="chip-dot" style="background:${colourFor(i)}"></span>${escapeHtml(c.name)}<button class="chip-x" data-remove="${code}" aria-label="Remove ${escapeHtml(c.name)}">✕</button></span>`;
      })
      .join('');

    const baseQi = qiOf(baseYear, latestQ);
    baseLbl.style.visibility = mode === 'index' ? 'visible' : 'hidden';
    baseSel.style.visibility = mode === 'index' ? 'visible' : 'hidden';

    const series: LineSeries[] = selected.map((code, i) => {
      const c = data.byCode.get(code)!;
      const s = { s: c.s, v: c.v };
      const short = c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name;
      if (mode === 'index') {
        const bq = baseQi >= c.s ? baseQi : c.s;
        return { id: code, label: short, colour: colourFor(i), points: rebased(s, bq) };
      }
      return { id: code, label: short, colour: colourFor(i), points: annualPoints(s) };
    });

    chartSlot.innerHTML = '';
    const svg = lineChart(series, {
      width: 960,
      height: 420,
      endLabels: true,
      valueNoun: mode === 'index' ? 'index' : '',
      yFmt: mode === 'index' ? (v) => v.toFixed(0) : (v) => `${v.toFixed(0)}%`,
      zeroLine: mode === 'annual',
    });
    chartSlot.appendChild(svg);
    attachSvgZoom(svg, { maxScale: 12 });
    if (!chartSlot.querySelector('.zoom-hint')) {
      const hint = document.createElement('div');
      hint.className = 'zoom-hint';
      hint.textContent = 'Scroll to zoom · drag to pan · double-click to reset';
      chartSlot.appendChild(hint);
    }

    // comparison table
    const baseQiT = qiOf(baseYear, latestQ);
    tableSlot.innerHTML = `
      <div class="table-scroll">
        <table class="data">
          <thead><tr><th>Item</th><th>Group</th><th class="t-right">Now vs ${baseYear}</th><th class="t-right">10-yr</th><th class="t-right">Annual</th></tr></thead>
          <tbody>
            ${selected
              .map((code, i) => {
                const c = data.byCode.get(code)!;
                const since = cumChange({ s: c.s, v: c.v }, baseQiT, meta.latestQi);
                return `<tr class="clickable" data-open="${code}">
                  <td><span class="dot" style="background:${colourFor(i)}"></span><span class="name-cell">${escapeHtml(c.name)}</span></td>
                  <td>${escapeHtml(groupName(c))}</td>
                  <td class="t-num ${signCls(since)}">${formatSignedPct(since, 0)}</td>
                  <td class="t-num ${signCls(c.cum10)}">${formatSignedPct(c.cum10, 0)}</td>
                  <td class="t-num ${signCls(c.annual)}">${formatSignedPct(c.annual)}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
    tableSlot.querySelectorAll('[data-open]').forEach((tr) => tr.addEventListener('click', () => ctx.openItem(tr.getAttribute('data-open')!)));
  }

  function groupName(c: ClassRec): string {
    if (!c.group) return c.tree ? 'CPI group' : 'Analytical';
    return data.byCode.get(c.group)?.name ?? '';
  }
  function signCls(v: number | null): string {
    if (v == null) return '';
    return v > 0.05 ? 'rise' : v < -0.05 ? 'fall' : '';
  }

  function add(code: string): void {
    if (selected.includes(code)) return;
    if (selected.length >= 6) selected.shift();
    selected.push(code);
    input.value = '';
    results.innerHTML = '';
    paint();
    renderSuggested();
  }

  function renderSuggested(): void {
    const sug = root.querySelector('[data-role="suggested"]') as HTMLElement;
    const pool = SUGGESTED.filter((c) => data.byCode.has(c) && !selected.includes(c));
    sug.innerHTML = pool.length
      ? `<span class="field-label">Try:</span>${pool
          .map((code) => `<button class="chip-add" data-add="${code}">+ ${escapeHtml(data.byCode.get(code)!.name)}</button>`)
          .join('')}`
      : '';
    sug.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => add(b.getAttribute('data-add')!)));
  }

  // search
  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const hits = searchClasses(data.classes, input.value, 10);
      results.innerHTML = hits
        .map(
          (h) =>
            `<button class="search-item" data-add="${h.code}" role="option">
              <span class="dot" style="background:${groupColour(h.group)}"></span>
              <strong>${escapeHtml(h.name)}</strong>
              <em>${formatSignedPct(h.cum2000, 0)} since 2000</em>
            </button>`,
        )
        .join('');
      results.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => add(b.getAttribute('data-add')!)));
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.lookup-input') && !(e.target as Element).closest('.search-results')) results.innerHTML = '';
  });

  chipSlot.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-remove]');
    if (btn) {
      selected = selected.filter((c) => c !== btn.getAttribute('data-remove'));
      if (!selected.length) selected = ['10001'];
      paint();
      renderSuggested();
    }
  });
  root.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.getAttribute('data-mode') as 'index' | 'annual';
      root.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }),
  );
  baseSel.addEventListener('change', () => {
    baseYear = Number(baseSel.value);
    paint();
  });

  paint();
  renderSuggested();
}
