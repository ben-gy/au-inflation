// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>

export type ViewId =
  | 'overview'
  | 'lookup'
  | 'movers'
  | 'dollar'
  | 'basket'
  | 'wages'
  | 'cities'
  | 'overtime'
  | 'explorer'
  | 'insights';

/** A dense quarterly index series: values start at absolute quarter `s`. */
export interface Series {
  s: number;
  v: (number | null)[];
}

export interface ClassRec {
  code: string;
  name: string;
  desc: string;
  level: number;
  parent: string | null;
  order: number;
  group: string | null;
  tree: boolean;
  leaf: boolean;
  s: number;
  v: (number | null)[];
  li: number | null; // latest index number
  lq: number | null; // latest quarter index
  annual: number | null; // published annual % change
  contrib: number | null; // contribution to the CPI (weight proxy)
  cumAll: number | null;
  cum2000: number | null;
  cum10: number | null;
  cum1: number | null;
  vol: number;
  minA: number;
  maxA: number;
}

export interface Purchasing {
  year: number;
  worthNow: number;
  centsToday: number;
}

export interface Meta {
  generated: string;
  latestPeriod: string;
  latestPeriodLabel: string;
  latestYear: number;
  latestQi: number;
  firstPeriod: string;
  firstQi: number;
  basePeriodNote: string;
  headline: { annual: number; index: number; cum2000: number; cumAll: number };
  purchasing: Purchasing[];
  wpi: { latestPeriod: string; latestPeriodLabel: string; index: number; annual: number };
  groups: Array<{ code: string; name: string }>;
  cities: Array<{ code: string; name: string }>;
  counts: { classes: number; leaves: number };
  reconciliation: { annualChecked: number; contribChecked: number };
  sources: { cpi: string; wpi: string; api: string };
}

export interface Cities {
  latestPeriod: string;
  cities: Array<{ code: string; name: string }>;
  groups: Array<{ code: string; name: string }>;
  allGroups: Record<string, { s: number; v: (number | null)[]; annual: number | null; li: number }>;
  heat: Record<string, Record<string, number | null>>;
}

export interface Wages {
  s: number;
  v: (number | null)[];
  latestQi: number;
  latestPeriod: string;
  li: number;
  annual: number | null;
}

export interface Insight {
  severity: 'info' | 'good' | 'warn' | 'alert';
  title: string;
  body: string;
  links: string[];
}
