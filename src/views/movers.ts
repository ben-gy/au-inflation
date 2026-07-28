// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import type { ClassRec } from '../types';
import { cumChange, qiOf } from '../data';
import { changeColour, groupColour } from '../colours';
import { divergingBars, type DivItem } from '../charts';
import { viewHead, groupLegend } from './shared';
import { escapeHtml } from '../utils/format';
import { glossaryTerm } from '../glossary';

export function renderMovers(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta } = data;
  const latestQ = (meta.latestQi % 4) + 1;
  const years = [1948, 1960, 1970, 1980, 1990, 2000, 2010, 2020].filter((y) => y <= meta.latestYear - 1);

  let baseYear = 2000;
  let groupFilter = 'all';
  let scope: 'leaf' | 'group' = 'leaf';

  root.innerHTML = `
    ${viewHead(
      'Risers &amp; Fallers',
      `The whole basket ranked by how much each item's price has changed since a base year. This is the story a single inflation figure hides: since 2000, some things are up 800% and others are actually cheaper.`,
    )}
    <div class="controls">
      <span class="field-label">Since</span>
      <select data-role="base">${years.map((y) => `<option value="${y}" ${y === baseYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <span class="field-label">Show</span>
      <div class="seg" role="tablist">
        <button class="seg-btn" data-scope="leaf" aria-pressed="true">Individual items</button>
        <button class="seg-btn" data-scope="group" aria-pressed="false">Broad groups</button>
      </div>
      <span class="field-label">Group</span>
      <select data-role="group">
        <option value="all">All groups</option>
        ${meta.groups.map((g) => `<option value="${g.code}">${escapeHtml(g.name)}</option>`).join('')}
      </select>
    </div>
    <div class="panel">
      <div class="panel-title" data-role="title"></div>
      <div class="panel-sub">Bars run right (dearer, amber→red) or left (cheaper, green) from the zero line. ${glossaryTerm('base_year', 'Change the base year')} and every number rebases. Click any bar for that item's full story.</div>
      <div class="split-stats" data-role="split"></div>
      <div class="chart-scroll" data-role="chart"></div>
      ${groupLegend(data.groups, groupColour)}
    </div>
  `;

  const chartSlot = root.querySelector('[data-role="chart"]') as HTMLElement;
  const titleSlot = root.querySelector('[data-role="title"]') as HTMLElement;
  const splitSlot = root.querySelector('[data-role="split"]') as HTMLElement;

  function paint(): void {
    const baseQi = qiOf(baseYear, latestQ);
    const pool = (scope === 'leaf' ? data.leaves : data.groups).filter((c) => groupFilter === 'all' || c.group === groupFilter || c.code === groupFilter);
    const rows = pool
      .map((c) => ({ c, val: cumChange({ s: c.s, v: c.v }, baseQi, meta.latestQi) }))
      .filter((r): r is { c: ClassRec; val: number } => r.val != null)
      .sort((a, b) => b.val - a.val);

    const risers = rows.filter((r) => r.val > 0).length;
    const fallers = rows.filter((r) => r.val < 0).length;
    splitSlot.innerHTML = `
      <div class="split-pill rise"><strong>${risers}</strong> dearer</div>
      <div class="split-pill fall"><strong>${fallers}</strong> cheaper</div>
      <div class="split-pill muted">${rows.length} items with a ${baseYear} price</div>`;

    titleSlot.textContent = `Price change since ${baseYear} · ${scope === 'leaf' ? 'individual items' : 'broad groups'}`;

    const items: DivItem[] = rows.map((r) => ({
      code: r.c.code,
      label: r.c.name,
      value: r.val,
      colour: changeColour(r.val),
      group: r.c.group,
    }));
    chartSlot.innerHTML = '';
    const svg = divergingBars(items, {
      width: 680,
      rowH: scope === 'leaf' ? 18 : 26,
      gap: 4,
      onPick: (code) => ctx.openItem(code),
    });
    chartSlot.appendChild(svg);
  }

  root.querySelector('[data-role="base"]')?.addEventListener('change', (e) => {
    baseYear = Number((e.target as HTMLSelectElement).value);
    paint();
  });
  root.querySelector('[data-role="group"]')?.addEventListener('change', (e) => {
    groupFilter = (e.target as HTMLSelectElement).value;
    paint();
  });
  root.querySelectorAll('[data-scope]').forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.getAttribute('data-scope') as 'leaf' | 'group';
      root.querySelectorAll('[data-scope]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }),
  );

  paint();
}
