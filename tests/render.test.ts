// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Headless jsdom render of EVERY view + the drawer + the About modal against the
// REAL built data (public/data/*.json), asserting no NaN/undefined/throw.
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, type Dataset } from '../src/data';
import type { ViewContext } from '../src/viewContext';
import { renderOverview } from '../src/views/overview';
import { renderLookup } from '../src/views/lookup';
import { renderMovers } from '../src/views/movers';
import { renderDollar } from '../src/views/dollar';
import { renderBasket } from '../src/views/basket';
import { renderWages } from '../src/views/wages';
import { renderCities } from '../src/views/cities';
import { renderOvertime } from '../src/views/overtime';
import { renderExplorer } from '../src/views/explorer';
import { renderInsights } from '../src/views/insights';
import { createDrilldown } from '../src/components/drilldown';
import { createAbout } from '../src/components/about';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
function load(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

let data: Dataset;
beforeAll(() => {
  data = buildDataset(load('meta.json'), load('classes.json'), load('cities.json'), load('wages.json'), load('insights.json'));
});

function assertClean(root: HTMLElement, label: string): void {
  const text = root.textContent || '';
  expect(text.includes('NaN'), `${label} contains NaN`).toBe(false);
  expect(text.includes('undefined'), `${label} contains undefined`).toBe(false);
  expect(text.includes('Infinity'), `${label} contains Infinity`).toBe(false);
  expect(root.children.length, `${label} rendered nothing`).toBeGreaterThan(0);
  // no NaN in any SVG coordinate
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const html = svg.outerHTML;
    expect(html.includes('NaN'), `${label} SVG has NaN coords`).toBe(false);
  }
}

function ctxFor(): { ctx: ViewContext; opened: string[] } {
  const opened: string[] = [];
  const ctx: ViewContext = {
    data,
    openItem: (c) => opened.push(c),
    goTo: () => {},
    compare: () => {},
  };
  return { ctx, opened };
}

const VIEWS: Array<[string, (root: HTMLElement, ctx: ViewContext, seed?: string[]) => void]> = [
  ['overview', renderOverview],
  ['lookup', (r, c, s) => renderLookup(r, c, s)],
  ['movers', renderMovers],
  ['dollar', renderDollar],
  ['basket', renderBasket],
  ['wages', renderWages],
  ['cities', renderCities],
  ['overtime', renderOvertime],
  ['explorer', renderExplorer],
  ['insights', renderInsights],
];

describe('data integrity', () => {
  it('has the expected shape', () => {
    expect(data.classes.length).toBeGreaterThan(100);
    expect(data.byCode.get('10001')).toBeTruthy();
    expect(data.leaves.length).toBeGreaterThan(50);
    expect(data.groups.length).toBe(11);
    expect(data.meta.headline.annual).toBeTypeOf('number');
    expect(data.insights.length).toBeGreaterThan(3);
  });
  it('every class series is contiguous (no internal nulls)', () => {
    for (const c of data.classes) {
      const firstNonNull = c.v.findIndex((x) => x != null);
      const lastNonNull = c.v.length - 1 - [...c.v].reverse().findIndex((x) => x != null);
      for (let i = firstNonNull; i <= lastNonNull; i++) expect(c.v[i], `${c.name} has an internal gap`).not.toBeNull();
    }
  });
});

describe('every view renders cleanly against real data', () => {
  for (const [name, render] of VIEWS) {
    it(`renders ${name}`, () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      const { ctx } = ctxFor();
      expect(() => render(root, ctx), `${name} threw`).not.toThrow();
      assertClean(root, name);
      root.remove();
    });
  }
});

describe('the per-item drawer renders for a range of items', () => {
  it('opens for a leaf, a group and an item with no cum2000', () => {
    const drill = createDrilldown(data);
    for (const code of ['40090', '20003', '126670', '10001']) {
      if (!data.byCode.has(code)) continue;
      expect(() => drill.open(code), `drawer threw for ${code}`).not.toThrow();
      const drawer = document.querySelector('.drawer') as HTMLElement;
      expect(drawer.textContent || '').not.toContain('NaN');
      expect(drawer.textContent || '').not.toContain('undefined');
    }
    drill.close();
  });
});

describe('the About modal renders', () => {
  it('builds without NaN/undefined', () => {
    const about = createAbout(data.meta);
    about.open();
    const modal = document.querySelectorAll('.modal');
    const last = modal[modal.length - 1] as HTMLElement;
    expect(last.textContent || '').not.toContain('NaN');
    expect(last.textContent || '').not.toContain('undefined');
    about.close();
  });
});

describe('basket treemap tiles are in-bounds', () => {
  it('every rendered tile rect sits within the svg viewBox', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const { ctx } = ctxFor();
    renderBasket(root, ctx);
    const svg = root.querySelector('svg.treemap') as SVGSVGElement;
    expect(svg).toBeTruthy();
    const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(' ').map(Number);
    const [, , W, H] = vb;
    for (const rect of Array.from(svg.querySelectorAll('rect'))) {
      const x = Number(rect.getAttribute('x'));
      const y = Number(rect.getAttribute('y'));
      const w = Number(rect.getAttribute('width'));
      const h = Number(rect.getAttribute('height'));
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(x + w).toBeLessThanOrEqual(W + 2);
      expect(y + h).toBeLessThanOrEqual(H + 2);
    }
    root.remove();
  });
});
