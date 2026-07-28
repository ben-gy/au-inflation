// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ClassRec, Cities, Insight, Meta, Series, Wages } from './types';

export interface Dataset {
  meta: Meta;
  classes: ClassRec[];
  byCode: Map<string, ClassRec>;
  children: Map<string, ClassRec[]>;
  leaves: ClassRec[];
  groups: ClassRec[];
  cities: Cities;
  wages: Wages;
  insights: Insight[];
}

const MONTHS = ['March', 'June', 'September', 'December'];

export function qYear(qi: number): number {
  return Math.floor(qi / 4);
}
export function qNum(qi: number): number {
  return (qi % 4) + 1;
}
export function qLabelShort(qi: number): string {
  return `Q${qNum(qi)} ${qYear(qi)}`;
}
export function qLabel(qi: number): string {
  return `${MONTHS[qNum(qi) - 1]} ${qYear(qi)}`;
}
/** Absolute quarter index for a calendar year at a given quarter-of-year (1..4). */
export function qiOf(year: number, quarter: number): number {
  return year * 4 + (quarter - 1);
}

export function valueAt(s: Series, qi: number): number | null {
  const i = qi - s.s;
  if (i < 0 || i >= s.v.length) return null;
  return s.v[i];
}
export function lastQi(s: Series): number {
  for (let i = s.v.length - 1; i >= 0; i--) if (s.v[i] != null) return s.s + i;
  return s.s;
}
export function firstQi(s: Series): number {
  return s.s;
}

/** Cumulative % change of a series between two quarters. */
export function cumChange(s: Series, fromQi: number, toQi: number): number | null {
  const a = valueAt(s, fromQi);
  const b = valueAt(s, toQi);
  if (a == null || b == null || a === 0) return null;
  return (b / a - 1) * 100;
}

/** Year-on-year % change of a series at quarter qi. */
export function annualAt(s: Series, qi: number): number | null {
  return cumChange(s, qi - 4, qi);
}

/**
 * Rebase a series so a chosen base quarter = 100, returning [qi, value] points
 * from `fromQi` onward. Used to make different items comparable on one axis.
 */
export function rebased(s: Series, baseQi: number, fromQi?: number): Array<[number, number]> {
  const base = valueAt(s, baseQi);
  if (base == null || base === 0) return [];
  const start = Math.max(s.s, fromQi ?? s.s);
  const out: Array<[number, number]> = [];
  for (let qi = start; qi <= s.s + s.v.length - 1; qi++) {
    const val = valueAt(s, qi);
    if (val != null) out.push([qi, (val / base) * 100]);
  }
  return out;
}

/** Raw [qi, value] index points from `fromQi` onward. */
export function points(s: Series, fromQi?: number): Array<[number, number]> {
  const start = Math.max(s.s, fromQi ?? s.s);
  const out: Array<[number, number]> = [];
  for (let qi = start; qi <= s.s + s.v.length - 1; qi++) {
    const val = valueAt(s, qi);
    if (val != null) out.push([qi, val]);
  }
  return out;
}

/** Annual-inflation [qi, %] points from `fromQi` onward. */
export function annualPoints(s: Series, fromQi?: number): Array<[number, number]> {
  const start = Math.max(s.s + 4, fromQi ?? s.s + 4);
  const out: Array<[number, number]> = [];
  for (let qi = start; qi <= s.s + s.v.length - 1; qi++) {
    const a = annualAt(s, qi);
    if (a != null) out.push([qi, a]);
  }
  return out;
}

// ── Search ──
export interface SearchHit {
  code: string;
  name: string;
  group: string | null;
  cum2000: number | null;
  annual: number | null;
}

export function searchClasses(classes: ClassRec[], q: string, limit = 12): SearchHit[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const scored: Array<{ c: ClassRec; score: number }> = [];
  for (const c of classes) {
    const name = c.name.toLowerCase();
    const desc = (c.desc || '').toLowerCase();
    let score = -1;
    if (name === term) score = 100;
    else if (name.startsWith(term)) score = 80;
    else if (name.includes(term)) score = 60;
    else if (desc.includes(term)) score = 30;
    if (score < 0) continue;
    // prefer leaves (concrete items) and higher-weight items
    if (c.leaf) score += 8;
    if (c.code === '10001') score += 5;
    score += Math.min(6, (c.contrib ?? 0) / 5);
    scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ c }) => ({
    code: c.code,
    name: c.name,
    group: c.group,
    cum2000: c.cum2000,
    annual: c.annual,
  }));
}

export async function loadDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL || '/';
  const url = (f: string) => `${base}data/${f}`.replace(/\/\//g, '/');
  const [meta, classes, cities, wages, insights] = await Promise.all([
    fetch(url('meta.json')).then((r) => r.json() as Promise<Meta>),
    fetch(url('classes.json')).then((r) => r.json() as Promise<ClassRec[]>),
    fetch(url('cities.json')).then((r) => r.json() as Promise<Cities>),
    fetch(url('wages.json')).then((r) => r.json() as Promise<Wages>),
    fetch(url('insights.json')).then((r) => r.json() as Promise<Insight[]>),
  ]);

  const byCode = new Map(classes.map((c) => [c.code, c]));
  const children = new Map<string, ClassRec[]>();
  for (const c of classes) {
    if (c.parent && c.tree) {
      if (!children.has(c.parent)) children.set(c.parent, []);
      children.get(c.parent)!.push(c);
    }
  }
  for (const arr of children.values()) arr.sort((a, b) => a.order - b.order);
  const leaves = classes.filter((c) => c.leaf);
  const groups = meta.groups.map((g) => byCode.get(g.code)!).filter(Boolean);

  return { meta, classes, byCode, children, leaves, groups, cities, wages, insights };
}

/** Build the dataset from already-parsed JSON (used by tests). */
export function buildDataset(meta: Meta, classes: ClassRec[], cities: Cities, wages: Wages, insights: Insight[]): Dataset {
  const byCode = new Map(classes.map((c) => [c.code, c]));
  const children = new Map<string, ClassRec[]>();
  for (const c of classes) {
    if (c.parent && c.tree) {
      if (!children.has(c.parent)) children.set(c.parent, []);
      children.get(c.parent)!.push(c);
    }
  }
  for (const arr of children.values()) arr.sort((a, b) => a.order - b.order);
  const leaves = classes.filter((c) => c.leaf);
  const groups = meta.groups.map((g) => byCode.get(g.code)!).filter(Boolean);
  return { meta, classes, byCode, children, leaves, groups, cities, wages, insights };
}
