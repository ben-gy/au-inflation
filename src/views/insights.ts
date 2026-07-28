// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import { viewHead } from './shared';
import { escapeHtml } from '../utils/format';

export function renderInsights(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { insights } = data;

  root.innerHTML = `
    ${viewHead('Insights', `Findings pulled automatically from the data each quarter — the outliers, the crunch and the surprises worth knowing.`)}
    <div class="insight-grid" data-role="grid"></div>
  `;

  const grid = root.querySelector('[data-role="grid"]') as HTMLElement;
  grid.innerHTML = insights
    .map((ins) => {
      const chips = ins.links
        .map((code) => {
          const c = data.byCode.get(code);
          return c ? `<button class="chip" data-code="${code}">${escapeHtml(c.name)}</button>` : '';
        })
        .join('');
      return `<div class="insight ${ins.severity}">
        <h3>${escapeHtml(ins.title)}</h3>
        <p>${escapeHtml(ins.body)}</p>
        ${chips ? `<div class="insight-links">${chips}</div>` : ''}
      </div>`;
    })
    .join('');
  grid.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => ctx.openItem(b.getAttribute('data-code')!)));
}
