// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/** One colour per CPI group, used identically across every view. */

export const ALL_GROUPS = '10001';

export const GROUP_COLOUR: Record<string, string> = {
  '20001': '#e08a2e', // Food and non-alcoholic beverages — amber
  '20006': '#9c3d6e', // Alcohol and tobacco — mulberry
  '20002': '#c65d86', // Clothing and footwear — rose
  '20003': '#2f6f8f', // Housing — teal-blue (the dominant weight)
  '20004': '#6f8ca0', // Furnishings, household equipment — slate
  '115486': '#3f9c9b', // Health — aqua
  '20005': '#c0492f', // Transport — rust
  '115488': '#7d6bb0', // Communication — violet
  '115489': '#d8a52c', // Recreation and culture — gold
  '115493': '#3d7f5a', // Education — forest
  '126670': '#8a7a5c', // Insurance and financial services — khaki
};

export const ANALYTICAL_COLOUR = '#9a8f80';
export const ALL_GROUPS_COLOUR = '#12433f'; // ink teal — the headline series

export function groupColour(groupCode: string | null): string {
  if (!groupCode) return ALL_GROUPS_COLOUR;
  return GROUP_COLOUR[groupCode] ?? ANALYTICAL_COLOUR;
}

/** City colours for the multi-line trend (8 capitals). */
export const CITY_COLOUR: Record<string, string> = {
  '1': '#2f6f8f', // Sydney
  '2': '#c0492f', // Melbourne
  '3': '#d8a52c', // Brisbane
  '4': '#3d7f5a', // Adelaide
  '5': '#9c3d6e', // Perth
  '6': '#3f9c9b', // Hobart
  '7': '#e08a2e', // Darwin
  '8': '#7d6bb0', // Canberra
};

// ── Diverging ramp for cumulative price change (fall = green, rise = amber→red) ──
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function mix(c1: [number, number, number], c2: [number, number, number], t: number): string {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;
}
const GREEN_DEEP: [number, number, number] = [31, 122, 74];
const NEUTRAL: [number, number, number] = [214, 205, 190];
const AMBER: [number, number, number] = [224, 148, 46];
const RED_DEEP: [number, number, number] = [176, 58, 46];

/** Colour for a cumulative % change; `cap` is the magnitude that saturates. */
export function changeColour(pct: number | null, cap = 300): string {
  if (pct == null) return '#d6cdbe';
  if (pct < 0) {
    const t = Math.min(1, Math.abs(pct) / 60); // falls saturate quickly (rare, small)
    return mix(NEUTRAL, GREEN_DEEP, t);
  }
  const t = Math.min(1, pct / cap);
  if (t < 0.5) return mix(NEUTRAL, AMBER, t / 0.5);
  return mix(AMBER, RED_DEEP, (t - 0.5) / 0.5);
}

// ── Sequential ramp for an annual-inflation heatmap (blue < 0 < white < red) ──
const BLUE: [number, number, number] = [43, 108, 176];
const WHITE: [number, number, number] = [247, 243, 235];
const HOT: [number, number, number] = [166, 40, 30];
export function inflationColour(annual: number | null, hot = 12): string {
  if (annual == null) return '#ece5d8';
  if (annual < 0) return mix(WHITE, BLUE, Math.min(1, Math.abs(annual) / 6));
  return mix(WHITE, HOT, Math.min(1, annual / hot));
}

/** Readable text colour (dark or light) for a given rgb() background. */
export function textOn(bg: string): string {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(bg);
  if (!m) return '#2c2620';
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#2c2620' : '#fdf6ea';
}
