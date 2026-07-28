// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { describe, expect, it } from 'vitest';
import { squarify } from '../src/treemap';
import { divergingLayout } from '../src/charts';

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

describe('squarify treemap layout', () => {
  const values = [40, 25, 15, 10, 6, 3, 1];
  const W = 600;
  const H = 400;
  const rects = squarify(values, W, H);

  it('returns one rect per value with finite coords', () => {
    expect(rects).toHaveLength(values.length);
    for (const r of rects) {
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.y)).toBe(true);
      expect(Number.isFinite(r.w)).toBe(true);
      expect(Number.isFinite(r.h)).toBe(true);
    }
  });
  it('keeps every rect within the canvas', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.y).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 0.01);
    }
  });
  it('has no overlapping rectangles', () => {
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBeLessThan(0.5);
  });
  it('conserves total area proportional to value', () => {
    const total = values.reduce((a, b) => a + b, 0);
    const area = rects.reduce((a, r) => a + r.w * r.h, 0);
    expect(area).toBeCloseTo(W * H, -1);
    // biggest value -> biggest rect
    const biggest = rects.reduce((m, r) => (r.w * r.h > m.w * m.h ? r : m));
    expect(biggest.index).toBe(0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('divergingLayout', () => {
  const values = [800, 300, 90, 0, -20, -90];
  const W = 500;
  const rowH = 20;
  const gap = 4;
  const { rects, zeroX, height } = divergingLayout(values, W, rowH, gap);

  it('produces one rect per value with finite coords', () => {
    expect(rects).toHaveLength(values.length);
    for (const r of rects) {
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.w)).toBe(true);
      expect(r.w).toBeGreaterThanOrEqual(0);
    }
  });
  it('positive bars start at the zero axis, negatives end at it', () => {
    values.forEach((v, i) => {
      if (v >= 0) expect(rects[i].x).toBeCloseTo(zeroX, 5);
      else expect(rects[i].x + rects[i].w).toBeCloseTo(zeroX, 5);
    });
  });
  it('keeps bars within the plot width', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01);
    }
  });
  it('rows do not vertically overlap and total height matches', () => {
    for (let i = 1; i < rects.length; i++) expect(rects[i].y).toBeGreaterThanOrEqual(rects[i - 1].y + rowH);
    expect(height).toBe(values.length * (rowH + gap));
  });
  it('the largest magnitude bar is the widest', () => {
    const widest = rects.reduce((m, r) => (r.w > m.w ? r : m));
    expect(widest.index).toBe(0); // 800
  });
});
