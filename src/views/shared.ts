// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ClassRec, Series } from '../types';
import { points, valueAt } from '../data';
import { escapeHtml } from '../utils/format';

export function viewHead(title: string, sub: string): string {
  return `<div class="view-head"><h1 class="view-title">${title}</h1><p class="view-sub">${sub}</p></div>`;
}

/** A tiny inline sparkline of a series' index over a window. */
export function sparkline(s: Series, colour: string, fromQi?: number, w = 96, h = 26): string {
  const pts = points(s, fromQi);
  if (pts.length < 2) return '';
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const xAt = (x: number) => (x1 === x0 ? w / 2 : ((x - x0) / (x1 - x0)) * (w - 2) + 1);
  const yAt = (y: number) => (y1 === y0 ? h / 2 : h - 2 - ((y - y0) / (y1 - y0)) * (h - 4));
  const d = pts.map((p) => `${xAt(p[0]).toFixed(1)},${yAt(p[1]).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/** Legend of the group swatches. */
export function groupLegend(groups: ClassRec[], colourOf: (code: string) => string): string {
  return `<div class="legend">${groups
    .map((g) => `<span class="legend-item"><span class="legend-swatch" style="background:${colourOf(g.code)}"></span>${escapeHtml(g.name)}</span>`)
    .join('')}</div>`;
}

/** Value of a series at the latest quarter it has. */
export function latest(s: Series): number | null {
  for (let i = s.v.length - 1; i >= 0; i--) if (s.v[i] != null) return s.v[i];
  return null;
}
export { valueAt };
