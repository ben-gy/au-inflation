// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Interaction wiring: the drill-down / filter paths that use plain HTML controls
// or un-zoomed SVG (so a dispatched click faithfully exercises the handler).
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, type Dataset } from '../src/data';
import type { ViewContext } from '../src/viewContext';
import { renderOverview } from '../src/views/overview';
import { renderMovers } from '../src/views/movers';
import { renderExplorer } from '../src/views/explorer';
import { renderBasket } from '../src/views/basket';
import { renderInsights } from '../src/views/insights';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8'));

let data: Dataset;
beforeAll(() => {
  data = buildDataset(load('meta.json'), load('classes.json'), load('cities.json'), load('wages.json'), load('insights.json'));
});

function harness(): { root: HTMLElement; ctx: ViewContext; opened: string[]; went: string[] } {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const opened: string[] = [];
  const went: string[] = [];
  const ctx: ViewContext = { data, openItem: (c) => opened.push(c), goTo: (v) => went.push(v), compare: () => {} };
  return { root, ctx, opened, went };
}
function click(el: Element): void {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

describe('overview interactions', () => {
  it('a stat tile with a code opens that item', () => {
    const { root, ctx, opened } = harness();
    renderOverview(root, ctx);
    const stat = root.querySelector('.stat[data-code]') as HTMLElement;
    expect(stat).toBeTruthy();
    click(stat);
    expect(opened.length).toBe(1);
    expect(data.byCode.has(opened[0])).toBe(true);
  });
  it('a group row opens the group', () => {
    const { root, ctx, opened } = harness();
    renderOverview(root, ctx);
    const row = root.querySelector('.grouprow[data-code]') as HTMLElement;
    click(row);
    expect(opened.length).toBe(1);
  });
  it('a hero action navigates', () => {
    const { root, ctx, went } = harness();
    renderOverview(root, ctx);
    click(root.querySelector('[data-go="movers"]') as HTMLElement);
    expect(went).toContain('movers');
  });
});

describe('movers interactions (un-zoomed diverging bars)', () => {
  it('renders one row per basket item and a bar click opens it', () => {
    const { root, ctx, opened } = harness();
    renderMovers(root, ctx);
    const groups = root.querySelectorAll('svg.chart g');
    expect(groups.length).toBeGreaterThan(50); // ~87 leaves have a 2000 price
    click(groups[0]);
    expect(opened.length).toBe(1);
  });
  it('switching to broad groups reduces the rows to ~11', () => {
    const { root, ctx } = harness();
    renderMovers(root, ctx);
    click(root.querySelector('[data-scope="group"]') as HTMLElement);
    const rows = root.querySelectorAll('svg.chart g').length;
    expect(rows).toBeLessThanOrEqual(11);
    expect(rows).toBeGreaterThan(5);
  });
});

describe('explorer interactions', () => {
  it('a table row opens the item', () => {
    const { root, ctx, opened } = harness();
    renderExplorer(root, ctx);
    const row = root.querySelector('tbody tr[data-code]') as HTMLElement;
    click(row);
    expect(opened.length).toBe(1);
  });
  it('a histogram bar click filters the table', () => {
    const { root, ctx } = harness();
    renderExplorer(root, ctx);
    const before = root.querySelectorAll('tbody tr').length;
    const bar = root.querySelector('[data-role="hist"] rect.bar') as SVGElement;
    click(bar);
    const after = root.querySelectorAll('tbody tr').length;
    expect(after).toBeLessThanOrEqual(before);
    expect((root.querySelector('[data-role="clear"]') as HTMLElement).hidden).toBe(false);
  });
});

describe('basket interactions', () => {
  it('renders the 11 groups then drills into a group on click', () => {
    const { root, ctx } = harness();
    renderBasket(root, ctx);
    const tiles = root.querySelectorAll('svg.treemap g');
    expect(tiles.length).toBe(11);
    click(tiles[0]);
    const back = root.querySelector('[data-role="back"]') as HTMLButtonElement;
    expect(back.hidden).toBe(false); // now showing a group's items
  });
});

describe('insights interactions', () => {
  it('every insight chip resolves to a real item', () => {
    const { root, ctx, opened } = harness();
    renderInsights(root, ctx);
    const chips = root.querySelectorAll('.chip[data-code]');
    for (const chip of Array.from(chips)) expect(data.byCode.has(chip.getAttribute('data-code')!)).toBe(true);
    if (chips.length) {
      click(chips[0]);
      expect(opened.length).toBe(1);
    }
  });
});
