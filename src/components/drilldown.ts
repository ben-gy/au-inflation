// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { Dataset } from '../data';
import { qLabel, qiOf, annualPoints, rebased } from '../data';
import type { ClassRec } from '../types';
import { groupColour } from '../colours';
import { lineChart, type LineSeries } from '../charts';
import { escapeHtml, formatSignedPct, formatNumber } from '../utils/format';
// formatNumber is used by the rebased-index axis formatter below.

/** Per-item drill-down drawer. Hash-linkable (#item=<code>). */
export function createDrilldown(data: Dataset): { open: (code: string) => void; close: () => void } {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.innerHTML = '<div class="drawer-head"></div><div class="drawer-body"></div>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  drawer.appendChild(closeBtn);

  document.body.append(overlay, drawer);

  let mode: 'index' | 'annual' = 'index';

  const close = () => {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    if (location.hash.startsWith('#item=')) history.replaceState(null, '', location.pathname + location.search);
  };

  const open = (code: string) => {
    const rec = data.byCode.get(code);
    if (!rec) return;
    mode = 'index';
    render(rec);
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawer.scrollTop = 0;
    closeBtn.focus();
    history.replaceState(null, '', `#item=${encodeURIComponent(rec.code)}`);
  };

  function render(rec: ClassRec): void {
    const head = drawer.querySelector('.drawer-head') as HTMLElement;
    const body = drawer.querySelector('.drawer-body') as HTMLElement;
    const grp = rec.group ? data.byCode.get(rec.group) : null;
    const colour = groupColour(rec.group);
    const { meta } = data;

    // rank among leaves by cum2000
    const leaves = data.leaves.filter((c) => c.cum2000 != null).sort((a, b) => (b.cum2000 ?? 0) - (a.cum2000 ?? 0));
    const rank = rec.cum2000 != null ? leaves.findIndex((c) => c.code === rec.code) + 1 : null;

    head.innerHTML = `
      <div class="drawer-eyebrow" style="color:${colour}">${escapeHtml(grp ? grp.name : rec.tree ? 'CPI group' : 'Analytical series')}</div>
      <div class="drawer-title">${escapeHtml(rec.name)}</div>
      <div class="drawer-sub">${escapeHtml(rec.desc || 'An item in the Consumer Price Index basket.')}</div>`;

    const first = rec.s;
    const parts: string[] = [];
    parts.push(`
      <div class="drawer-section">
        <div class="kv-grid">
          <div class="kv"><div class="kv-label">Annual inflation</div><div class="kv-value ${signClass(rec.annual)}">${formatSignedPct(rec.annual)}</div><div class="stat-note">year to ${escapeHtml(meta.latestPeriodLabel)}</div></div>
          <div class="kv"><div class="kv-label">Since 2000</div><div class="kv-value ${signClass(rec.cum2000)}">${formatSignedPct(rec.cum2000, 0)}</div></div>
          <div class="kv"><div class="kv-label">Over 10 years</div><div class="kv-value ${signClass(rec.cum10)}">${formatSignedPct(rec.cum10, 0)}</div></div>
          <div class="kv"><div class="kv-label">Index (2011–12=100)</div><div class="kv-value">${rec.li != null ? rec.li.toFixed(1) : '—'}</div></div>
        </div>
        ${rank ? `<p class="stat-note" style="margin-top:var(--space-sm)">Ranked <strong>#${rank}</strong> of ${leaves.length} basket items by price rise since 2000.</p>` : ''}
      </div>`);

    parts.push(`
      <div class="drawer-section">
        <div class="drawer-section-head">
          <h3>Price trajectory</h3>
          <div class="seg" role="tablist" aria-label="Chart metric">
            <button class="seg-btn" data-mode="index" aria-pressed="${mode === 'index'}">Price (rebased)</button>
            <button class="seg-btn" data-mode="annual" aria-pressed="${mode === 'annual'}">Inflation %</button>
          </div>
        </div>
        <div class="chart-frame" data-role="chart"></div>
        <p class="stat-note" data-role="chart-note"></p>
      </div>`);

    // contribution to the basket
    if (rec.contrib != null) {
      const allContrib = data.byCode.get('10001')?.contrib ?? 100;
      const share = (rec.contrib / allContrib) * 100;
      parts.push(`
        <div class="drawer-section">
          <h3>Share of the basket</h3>
          <div class="compare-row">
            <div class="compare-label">Weight in CPI</div>
            <div class="compare-track"><div class="compare-fill" style="width:${Math.min(100, share * 3).toFixed(1)}%;background:${colour}"></div></div>
            <div class="compare-val">${share.toFixed(1)}%</div>
          </div>
          <p class="stat-note" style="margin-top:var(--space-sm)">About ${share.toFixed(1)}% of a typical household's spending, by the CPI's contribution weights.</p>
        </div>`);
    }

    body.innerHTML = parts.join('');
    paintChart();

    body.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.getAttribute('data-mode') as 'index' | 'annual';
        body.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        paintChart();
      }),
    );

    function paintChart(): void {
      const slot = body.querySelector('[data-role="chart"]') as HTMLElement;
      const note = body.querySelector('[data-role="chart-note"]') as HTMLElement;
      if (!slot) return;
      slot.innerHTML = '';
      const s = { s: rec.s, v: rec.v };
      let series: LineSeries[];
      let yFmt: (v: number) => string;
      let noun: string;
      if (mode === 'index') {
        const base2000 = qiOf(2000, (meta.latestQi % 4) + 1);
        const baseQi = base2000 >= rec.s ? base2000 : rec.s;
        series = [{ id: rec.code, label: rec.name.length > 14 ? rec.name.slice(0, 13) + '…' : rec.name, colour, points: rebased(s, baseQi) }];
        yFmt = (v) => formatNumber(v);
        noun = 'index';
        note.textContent = `Price index rebased so ${qLabel(baseQi)} = 100. A value of 200 means the price has doubled since then.`;
      } else {
        series = [{ id: rec.code, label: 'Inflation', colour, points: annualPoints(s) }];
        yFmt = (v) => `${v.toFixed(0)}%`;
        noun = '';
        note.textContent = `Year-on-year price change each quarter, from ${escapeHtml(qLabel(first))} onward.`;
      }
      const svg = lineChart(series, {
        width: 452,
        height: 280,
        endLabels: false,
        dots: false,
        valueNoun: noun,
        yFmt,
        zeroLine: mode === 'annual',
      });
      slot.appendChild(svg);
    }
  }

  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
  });

  return { open, close };
}

function signClass(v: number | null): string {
  if (v == null) return '';
  return v > 0.05 ? 'rise' : v < -0.05 ? 'fall' : '';
}
