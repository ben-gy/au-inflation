// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/** Formatting helpers. All display numbers flow through here. */

export function formatNumber(n: number | null | undefined, dp = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function formatPercent(n: number | null | undefined, dp = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(dp)}%`;
}

/** A signed percent, e.g. +3.2% / −1.4%. Uses a real minus sign. */
export function formatSignedPct(n: number | null | undefined, dp = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 0) return `−${Math.abs(n).toFixed(dp)}%`;
  return `+${n.toFixed(dp)}%`;
}

export function formatDollar(n: number | null | undefined, dp = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
