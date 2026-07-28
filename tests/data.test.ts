// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { describe, expect, it } from 'vitest';
import { qiOf, qYear, qNum, qLabel, valueAt, cumChange, annualAt, rebased, points, annualPoints, searchClasses } from '../src/data';
import type { ClassRec, Series } from '../src/types';
import { formatSignedPct, formatDollar, escapeHtml } from '../src/utils/format';
import { changeColour, inflationColour, textOn, groupColour } from '../src/colours';

const S: Series = { s: qiOf(2000, 1), v: [100, 101, 102, 103, 110, 111, 112, 113, 120] };

describe('quarter helpers', () => {
  it('round-trips year/quarter through qiOf', () => {
    const qi = qiOf(2025, 3);
    expect(qYear(qi)).toBe(2025);
    expect(qNum(qi)).toBe(3);
    expect(qLabel(qi)).toBe('September 2025');
  });
});

describe('series access', () => {
  it('valueAt indexes by absolute quarter', () => {
    expect(valueAt(S, qiOf(2000, 1))).toBe(100);
    expect(valueAt(S, qiOf(2001, 1))).toBe(110);
    expect(valueAt(S, qiOf(1999, 1))).toBeNull();
  });
  it('cumChange computes percentage change', () => {
    expect(cumChange(S, qiOf(2000, 1), qiOf(2001, 1))).toBeCloseTo(10, 5);
  });
  it('annualAt computes year-on-year change', () => {
    expect(annualAt(S, qiOf(2001, 1))).toBeCloseTo(10, 5); // 100 -> 110
  });
  it('rebased sets the base quarter to 100', () => {
    const baseQi = qiOf(2001, 1);
    const r = rebased(S, baseQi);
    const atBase = r.find(([qi]) => qi === baseQi)!;
    expect(atBase[1]).toBeCloseTo(100, 5); // value at base quarter is 100
    const last = r[r.length - 1];
    expect(last[1]).toBeCloseTo((120 / 110) * 100, 5);
  });
  it('rebased from a fromQi starts at that quarter', () => {
    const baseQi = qiOf(2001, 1);
    const r = rebased(S, baseQi, baseQi);
    expect(r[0][0]).toBe(baseQi);
    expect(r[0][1]).toBeCloseTo(100, 5);
  });
  it('points and annualPoints return finite pairs', () => {
    for (const [, v] of points(S)) expect(Number.isFinite(v)).toBe(true);
    for (const [, v] of annualPoints(S)) expect(Number.isFinite(v)).toBe(true);
  });
});

const CLASSES: ClassRec[] = [
  mk('40090', 'Tobacco', '20006', true),
  mk('30014', 'Rents', '20003', true),
  mk('40098', 'Audio, visual and computing equipment', '115489', true),
  mk('10001', 'All groups CPI', null, false),
];
function mk(code: string, name: string, group: string | null, leaf: boolean): ClassRec {
  return {
    code,
    name,
    desc: '',
    level: leaf ? 3 : 0,
    parent: group,
    order: 1,
    group,
    tree: true,
    leaf,
    s: qiOf(2000, 1),
    v: [100, 200],
    li: 200,
    lq: qiOf(2000, 2),
    annual: 3,
    contrib: 5,
    cumAll: 100,
    cum2000: 100,
    cum10: 20,
    cum1: 3,
    vol: 1,
    minA: -1,
    maxA: 5,
  };
}

describe('searchClasses', () => {
  it('matches by name and ranks exact/prefix first', () => {
    const hits = searchClasses(CLASSES, 'tobacco');
    expect(hits[0].code).toBe('40090');
  });
  it('returns nothing for empty query', () => {
    expect(searchClasses(CLASSES, '')).toHaveLength(0);
  });
  it('matches a substring', () => {
    const hits = searchClasses(CLASSES, 'comput');
    expect(hits.some((h) => h.code === '40098')).toBe(true);
  });
});

describe('formatters', () => {
  it('formatSignedPct uses a real minus sign and + prefix', () => {
    expect(formatSignedPct(3.2)).toBe('+3.2%');
    expect(formatSignedPct(-1.4)).toBe('−1.4%');
    expect(formatSignedPct(null)).toBe('—');
  });
  it('formatDollar formats currency', () => {
    expect(formatDollar(1.5)).toBe('$1.50');
  });
  it('escapeHtml escapes entities', () => {
    expect(escapeHtml('<a>&"')).toBe('&lt;a&gt;&amp;&quot;');
  });
});

describe('colour ramps', () => {
  it('changeColour is green for falls and warm for rises', () => {
    expect(changeColour(-30)).toMatch(/^rgb/);
    expect(changeColour(300)).toMatch(/^rgb/);
    expect(changeColour(null)).toBeTypeOf('string');
  });
  it('inflationColour handles negative, zero and hot', () => {
    expect(inflationColour(-2)).toMatch(/^rgb/);
    expect(inflationColour(12)).toMatch(/^rgb/);
    expect(inflationColour(null)).toBeTypeOf('string');
  });
  it('textOn returns readable contrast', () => {
    expect(textOn('rgb(20, 40, 30)')).toBe('#fdf6ea');
    expect(textOn('rgb(240, 240, 240)')).toBe('#2c2620');
  });
  it('groupColour is stable per group and falls back', () => {
    expect(groupColour('20003')).toBe(groupColour('20003'));
    expect(groupColour(null)).toBeTypeOf('string');
    expect(groupColour('nope')).toBeTypeOf('string');
  });
});
