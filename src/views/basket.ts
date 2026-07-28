// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import type { ClassRec } from '../types';
import { squarify } from '../treemap';
import { groupColour, changeColour, textOn } from '../colours';
import { el } from '../charts';
import { viewHead, groupLegend } from './shared';
import { formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

export function renderBasket(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const allContrib = data.byCode.get('10001')?.contrib ?? 100;

  let drill: string | null = null; // a group code, or null for the whole basket
  let colourMode: 'group' | 'change' = 'group';

  root.innerHTML = `
    ${viewHead(
      'The basket',
      `What Australians actually spend on. Each tile's size is that item's ${glossaryTerm('weight', 'weight')} in the CPI — its ${glossaryTerm('contribution', 'contribution')} to the index. Housing and food dominate, so their prices move the headline most.`,
    )}
    <div class="controls">
      <div class="seg" role="tablist" aria-label="Colour by">
        <button class="seg-btn" data-cmode="group" aria-pressed="true">Colour by group</button>
        <button class="seg-btn" data-cmode="change" aria-pressed="false">Colour by price rise since 2000</button>
      </div>
      <button class="btn-ghost" data-role="back" hidden>← Whole basket</button>
      <span class="field-label" data-role="crumb"></span>
    </div>
    <div class="panel">
      <div class="treemap-wrap" data-role="tm"></div>
      <div data-role="legend"></div>
      <p class="stat-note">Tile size = share of household spending. Click a group to zoom in; click an item for its full price story.</p>
    </div>
  `;

  const tmSlot = root.querySelector('[data-role="tm"]') as HTMLElement;
  const legendSlot = root.querySelector('[data-role="legend"]') as HTMLElement;
  const backBtn = root.querySelector('[data-role="back"]') as HTMLButtonElement;
  const crumb = root.querySelector('[data-role="crumb"]') as HTMLElement;

  function tilesFor(): ClassRec[] {
    if (drill) {
      // leaves within this group
      return data.leaves.filter((c) => c.group === drill && (c.contrib ?? 0) > 0);
    }
    // top level: the 11 groups
    return data.groups.filter((g) => (g.contrib ?? 0) > 0);
  }

  function paint(): void {
    const W = Math.min(1180, Math.max(320, tmSlot.clientWidth || 900));
    const H = Math.round(W * 0.52);
    const tiles = tilesFor().slice().sort((a, b) => (b.contrib ?? 0) - (a.contrib ?? 0));
    const rects = squarify(tiles.map((t) => t.contrib ?? 0), W, H);
    const svg = el('svg', { class: 'chart treemap', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });

    tiles.forEach((t, i) => {
      const r = rects[i];
      if (r.w <= 0 || r.h <= 0) return;
      const share = ((t.contrib ?? 0) / allContrib) * 100;
      const fill = colourMode === 'group' ? groupColour(t.group ?? t.code) : changeColour(t.cum2000);
      const g = el('g', { style: 'cursor:pointer' });
      const tip = `${t.name} · ${share.toFixed(1)}% of basket · ${formatSignedPct(t.cum2000, 0)} since 2000`;
      g.appendChild(
        el('rect', {
          x: r.x + 1,
          y: r.y + 1,
          width: Math.max(0, r.w - 2),
          height: Math.max(0, r.h - 2),
          rx: 3,
          fill,
          stroke: '#fffdf9',
          'stroke-width': 1.5,
          'data-tip': tip,
          'aria-label': tip,
        }),
      );
      // label if it fits
      if (r.w > 62 && r.h > 26) {
        const tc = textOn(fill.startsWith('rgb') ? fill : hexToRgb(fill));
        const name = el('text', { x: r.x + 7, y: r.y + 17, 'font-size': Math.min(13, Math.max(10, r.w / 9)), 'font-weight': 600, fill: tc });
        name.textContent = fit(t.name, r.w);
        g.appendChild(name);
        if (r.h > 42) {
          const sub = el('text', { x: r.x + 7, y: r.y + 33, 'font-size': 11, fill: tc, opacity: 0.85 });
          sub.textContent = `${share.toFixed(1)}%`;
          g.appendChild(sub);
        }
      }
      g.addEventListener('click', () => {
        if (!drill && data.children.has(t.code)) {
          drill = t.code;
          render();
        } else {
          ctx.openItem(t.code);
        }
      });
      svg.appendChild(g);
    });
    tmSlot.innerHTML = '';
    tmSlot.appendChild(svg);

    legendSlot.innerHTML =
      colourMode === 'group'
        ? groupLegend(data.groups, groupColour)
        : `<div class="ramp-legend"><span>Cheaper</span><span class="ramp"></span><span>Dearer since 2000</span></div>`;
  }

  function render(): void {
    backBtn.hidden = !drill;
    crumb.textContent = drill ? (data.byCode.get(drill)?.name ?? '') : '';
    paint();
  }

  backBtn.addEventListener('click', () => {
    drill = null;
    render();
  });
  root.querySelectorAll('[data-cmode]').forEach((b) =>
    b.addEventListener('click', () => {
      colourMode = b.getAttribute('data-cmode') as 'group' | 'change';
      root.querySelectorAll('[data-cmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }),
  );
  window.addEventListener('resize', paint, { passive: true });

  render();
}

function fit(name: string, w: number): string {
  const max = Math.floor(w / 7.2);
  return name.length > max ? name.slice(0, Math.max(3, max - 1)) + '…' : name;
}
function hexToRgb(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 'rgb(120,120,120)';
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
