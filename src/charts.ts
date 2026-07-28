// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/** Hand-rolled SVG chart primitives. No chart library — see factory rules. */
import { escapeHtml, formatNumber } from './utils/format';
import { qYear } from './data';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const norm = max / mag;
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * mag;
}

export function ticks(max: number, count = 5): number[] {
  const top = niceCeil(max);
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

// ── Multi-series line chart (x = quarter index) ──────────────────────────────
export interface LineSeries {
  id: string;
  label: string;
  colour: string;
  points: Array<[number, number]>; // [quarterIndex, value]
  dashed?: boolean;
  width?: number;
}
export interface Annotation {
  x: number; // quarter index
  label: string;
}
export interface LineOpts {
  width?: number;
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  invertY?: boolean;
  yTickVals?: number[];
  yFmt?: (v: number) => string;
  valueNoun?: string;
  gapThreshold?: number;
  onPick?: (id: string) => void;
  endLabels?: boolean;
  dots?: boolean;
  annotations?: Annotation[];
  zeroLine?: boolean;
}

const MARGIN = { top: 20, right: 118, bottom: 34, left: 54 };

export function lineChart(series: LineSeries[], opts: LineOpts = {}): SVGSVGElement {
  const width = opts.width ?? 960;
  const height = opts.height ?? 380;
  const m = MARGIN;
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const gap = opts.gapThreshold ?? 1;
  const yFmt = opts.yFmt ?? ((v: number) => formatNumber(v));
  const noun = opts.valueNoun ?? '';

  const allX = series.flatMap((s) => s.points.map((p) => p[0]));
  const allY = series.flatMap((s) => s.points.map((p) => p[1]));
  const xDomain = opts.xDomain ?? [Math.min(...allX), Math.max(...allX)];
  const yDomain = opts.yDomain ?? [Math.min(0, ...allY), niceCeil(Math.max(...allY, 1))];
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;

  const xAt = (x: number) => m.left + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW);
  const yAt = (y: number) => {
    const t = y1 === y0 ? 0.5 : (y - y0) / (y1 - y0);
    return opts.invertY ? m.top + t * plotH : m.top + plotH - t * plotH;
  };

  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img' });

  const yTickVals = opts.yTickVals ?? ticks(Math.max(...allY, 1), 4);
  for (const t of yTickVals) {
    if (t < Math.min(y0, y1) || t > Math.max(y0, y1)) continue;
    const y = yAt(t);
    svg.appendChild(el('line', { class: 'grid-line', x1: m.left, y1: y, x2: m.left + plotW, y2: y }));
    const lbl = el('text', { class: 'axis-label', x: m.left - 6, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
    lbl.textContent = yFmt(t);
    svg.appendChild(lbl);
  }
  if (opts.zeroLine && y0 < 0 && y1 > 0) {
    const zy = yAt(0);
    svg.appendChild(el('line', { class: 'axis-line', x1: m.left, y1: zy, x2: m.left + plotW, y2: zy }));
  }

  // annotations (vertical markers)
  for (const a of opts.annotations ?? []) {
    if (a.x < x0 || a.x > x1) continue;
    const px = xAt(a.x);
    svg.appendChild(el('line', { class: 'annot-line', x1: px, y1: m.top, x2: px, y2: m.top + plotH }));
    const lbl = el('text', { class: 'annot-label', x: px + 3, y: m.top + 10, 'text-anchor': 'start' });
    lbl.textContent = a.label;
    svg.appendChild(lbl);
  }

  // x labels (years)
  const yr0 = qYear(x0);
  const yr1 = qYear(x1);
  const span = yr1 - yr0;
  const step = Math.max(1, Math.ceil(span / 10 / 5) * 5);
  for (let yr = Math.ceil(yr0 / step) * step; yr <= yr1; yr += step) {
    const px = xAt(yr * 4 + (x0 % 4));
    const lbl = el('text', { class: 'axis-label', x: px, y: height - m.bottom + 14, 'text-anchor': 'middle' });
    lbl.textContent = String(yr);
    svg.appendChild(lbl);
  }
  svg.appendChild(el('line', { class: 'axis-line', x1: m.left, y1: m.top + plotH, x2: m.left + plotW, y2: m.top + plotH }));

  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a[0] - b[0]);
    let seg: Array<[number, number]> = [];
    const flush = () => {
      if (seg.length >= 2) {
        svg.appendChild(
          el('polyline', {
            points: seg.map(([x, y]) => `${xAt(x).toFixed(1)},${yAt(y).toFixed(1)}`).join(' '),
            fill: 'none',
            stroke: s.colour,
            'stroke-width': s.width ?? 2.4,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
            'stroke-dasharray': s.dashed ? '5 4' : '',
          }),
        );
      }
      seg = [];
    };
    let prevX: number | null = null;
    for (const p of pts) {
      if (prevX != null && p[0] - prevX > gap) flush();
      seg.push(p);
      prevX = p[0];
    }
    flush();
    if (opts.dots) {
      for (const [x, y] of pts) {
        svg.appendChild(
          el('circle', {
            cx: xAt(x),
            cy: yAt(y),
            r: 2.4,
            fill: s.colour,
            'data-tip': `${s.label} · ${qYear(x)} Q${(x % 4) + 1}: ${yFmt(y)}${noun ? ` ${noun}` : ''}`,
            'aria-label': `${s.label} ${qYear(x)} ${yFmt(y)}`,
          }),
        );
      }
    }
    if (opts.endLabels !== false && pts.length) {
      const last = pts[pts.length - 1];
      const lbl = el('text', {
        x: xAt(last[0]) + 8,
        y: yAt(last[1]),
        'dominant-baseline': 'middle',
        'font-size': 11,
        'font-weight': 600,
        fill: s.colour,
      });
      lbl.textContent = s.label;
      svg.appendChild(lbl);
    }
  }
  return svg;
}

// ── Diverging horizontal bars (risers & fallers) ─────────────────────────────
export interface DivItem {
  code: string;
  label: string;
  value: number; // signed %
  colour: string;
  group?: string | null;
}
export interface DivRect {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pure layout: one rect per item. Zero maps to the mid axis. Testable. */
export function divergingLayout(
  values: number[],
  width: number,
  rowH: number,
  gap: number,
  maxAbs?: number,
): { rects: DivRect[]; zeroX: number; height: number } {
  const cap = maxAbs ?? Math.max(1, ...values.map((v) => Math.abs(v)));
  const negMax = Math.max(0, ...values.map((v) => (v < 0 ? -v : 0)));
  const posMax = Math.max(0, ...values.map((v) => (v > 0 ? v : 0)));
  const total = negMax + posMax || 1;
  const negW = (negMax / total) * width;
  const zeroX = negW;
  const rects: DivRect[] = values.map((v, index) => {
    const y = index * (rowH + gap);
    if (v >= 0) {
      const w = (Math.min(v, cap) / total) * width;
      return { index, x: zeroX, y, w, h: rowH };
    }
    const w = (Math.min(-v, cap) / total) * width;
    return { index, x: zeroX - w, y, w, h: rowH };
  });
  return { rects, zeroX, height: values.length * (rowH + gap) };
}

export interface DivOpts {
  width?: number;
  rowH?: number;
  gap?: number;
  onPick?: (code: string) => void;
  valueFmt?: (v: number) => string;
}

export function divergingBars(items: DivItem[], opts: DivOpts = {}): SVGSVGElement {
  const width = opts.width ?? 640;
  const rowH = opts.rowH ?? 22;
  const gap = opts.gap ?? 4;
  const labelW = 168;
  const valW = 62;
  const barW = width - labelW - valW;
  const fmt = opts.valueFmt ?? ((v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}%`);
  const { rects, zeroX, height } = divergingLayout(
    items.map((i) => i.value),
    barW,
    rowH,
    gap,
  );
  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img' });
  // zero axis
  svg.appendChild(el('line', { class: 'grid-line', x1: labelW + zeroX, y1: 0, x2: labelW + zeroX, y2: height, 'stroke-dasharray': '2 3' }));
  items.forEach((it, i) => {
    const r = rects[i];
    const g = el('g', { style: opts.onPick ? 'cursor:pointer' : '' });
    const cy = r.y + rowH / 2;
    // label (left)
    const lbl = el('text', { x: labelW - 8, y: cy, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'div-label' });
    lbl.textContent = it.label.length > 30 ? it.label.slice(0, 29) + '…' : it.label;
    g.appendChild(lbl);
    // bar
    g.appendChild(
      el('rect', {
        x: labelW + r.x,
        y: r.y,
        width: Math.max(1, r.w),
        height: r.h,
        rx: 2,
        fill: it.colour,
        'data-tip': `${it.label}: ${fmt(it.value)}`,
        'aria-label': `${it.label} ${fmt(it.value)}`,
      }),
    );
    // value (right)
    const vlbl = el('text', { x: width - 6, y: cy, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'div-value' });
    vlbl.textContent = fmt(it.value);
    g.appendChild(vlbl);
    if (opts.onPick) g.addEventListener('click', () => opts.onPick!(it.code));
    svg.appendChild(g);
  });
  return svg;
}

// ── Histogram ────────────────────────────────────────────────────────────────
export interface HistBin {
  lo: number;
  hi: number;
  count: number;
}
export function histogramChart(
  bins: HistBin[],
  opts: { width?: number; height?: number; colour?: string; xFmt?: (v: number) => string; onPick?: (i: number) => void } = {},
): SVGSVGElement {
  const width = opts.width ?? 900;
  const height = opts.height ?? 260;
  const m = { top: 14, right: 16, bottom: 40, left: 46 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const maxC = niceCeil(Math.max(...bins.map((b) => b.count), 1));
  const xFmt = opts.xFmt ?? ((v: number) => formatNumber(v));
  const colour = opts.colour ?? 'var(--accent-primary)';
  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img' });

  for (const t of ticks(maxC, 4)) {
    const y = m.top + plotH - (t / maxC) * plotH;
    svg.appendChild(el('line', { class: 'grid-line', x1: m.left, y1: y, x2: m.left + plotW, y2: y }));
    const lbl = el('text', { class: 'axis-label', x: m.left - 6, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
    lbl.textContent = formatNumber(t);
    svg.appendChild(lbl);
  }
  const slot = plotW / Math.max(1, bins.length);
  const barW = Math.max(1, slot * 0.86);
  bins.forEach((b, i) => {
    const x = m.left + i * slot + (slot - barW) / 2;
    const h = Math.max(0.5, (b.count / maxC) * plotH);
    const y = m.top + plotH - h;
    const tip = escapeHtml(`${xFmt(b.lo)} to ${xFmt(b.hi)}: ${formatNumber(b.count)} items`);
    const bar = el('rect', { class: 'bar', x, y, width: barW, height: h, rx: 2, fill: colour, 'data-tip': tip, 'aria-label': tip });
    if (opts.onPick) {
      bar.style.cursor = 'pointer';
      bar.addEventListener('click', () => opts.onPick!(i));
    }
    svg.appendChild(bar);
    if (i % Math.max(1, Math.ceil(bins.length / 10)) === 0) {
      const lbl = el('text', { class: 'axis-label', x: x + barW / 2, y: height - m.bottom + 14, 'text-anchor': 'middle' });
      lbl.textContent = xFmt(b.lo);
      svg.appendChild(lbl);
    }
  });
  svg.appendChild(el('line', { class: 'axis-line', x1: m.left, y1: m.top + plotH, x2: m.left + plotW, y2: m.top + plotH }));
  return svg;
}

export { escapeHtml };
