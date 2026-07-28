// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { ViewContext } from '../viewContext';
import type { ClassRec } from '../types';
import { groupColour } from '../colours';
import { histogramChart, type HistBin } from '../charts';
import { viewHead, sparkline } from './shared';
import { escapeHtml, formatSignedPct } from '../utils/format';
import { glossaryTerm } from '../glossary';

type SortKey = 'name' | 'group' | 'annual' | 'cum2000' | 'cum10' | 'contrib' | 'li';

export function renderExplorer(root: HTMLElement, ctx: ViewContext): void {
  const { data } = ctx;
  const { meta } = data;

  let scope: 'leaf' | 'all' = 'leaf';
  let groupFilter = 'all';
  let query = '';
  let sortKey: SortKey = 'cum2000';
  let sortDir: 1 | -1 = -1;
  let histFilter: [number, number] | null = null;

  root.innerHTML = `
    ${viewHead(
      'Explorer',
      `Every one of the ${meta.counts.classes} price series in the basket — sort, search and filter. Click any row for its full trajectory. The histogram shows how the ${glossaryTerm('base_year', 'since-2000 change')} is distributed; click a bar to filter.`,
    )}
    <div class="controls">
      <input class="text-input" data-role="q" type="search" placeholder="Search items…" aria-label="Search" style="min-width:200px" />
      <div class="seg" role="tablist">
        <button class="seg-btn" data-scope="leaf" aria-pressed="true">Items only</button>
        <button class="seg-btn" data-scope="all" aria-pressed="false">All series</button>
      </div>
      <select data-role="group">
        <option value="all">All groups</option>
        ${meta.groups.map((g) => `<option value="${g.code}">${escapeHtml(g.name)}</option>`).join('')}
      </select>
      <button class="chip" data-role="clear" hidden>Clear filter ✕</button>
    </div>

    <div class="panel">
      <div class="panel-title">Distribution of price change since 2000</div>
      <div class="panel-sub">How many items fall in each band. Most sit well above zero; a cluster of technology and clothing items is below it.</div>
      <div class="chart-scroll" data-role="hist"></div>
    </div>

    <div class="table-scroll">
      <table class="data">
        <thead><tr>
          <th class="sortable" data-sort="name">Item</th>
          <th class="sortable" data-sort="group">Group</th>
          <th>Trend</th>
          <th class="sortable t-right" data-sort="annual">Annual</th>
          <th class="sortable t-right" data-sort="cum2000">Since 2000</th>
          <th class="sortable t-right" data-sort="cum10">10-yr</th>
          <th class="sortable t-right" data-sort="contrib">Weight</th>
          <th class="sortable t-right" data-sort="li">Index</th>
        </tr></thead>
        <tbody data-role="tbody"></tbody>
      </table>
    </div>
    <p class="stat-note" data-role="count" style="margin-top:var(--space-sm)"></p>
  `;

  const tbody = root.querySelector('[data-role="tbody"]') as HTMLElement;
  const histSlot = root.querySelector('[data-role="hist"]') as HTMLElement;
  const countSlot = root.querySelector('[data-role="count"]') as HTMLElement;
  const clearBtn = root.querySelector('[data-role="clear"]') as HTMLButtonElement;

  function pool(): ClassRec[] {
    return data.classes.filter((c) => (scope === 'leaf' ? c.leaf : c.code !== '10001'));
  }
  function filtered(): ClassRec[] {
    const q = query.trim().toLowerCase();
    return pool().filter((c) => {
      if (groupFilter !== 'all' && c.group !== groupFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.desc || '').toLowerCase().includes(q)) return false;
      if (histFilter && (c.cum2000 == null || c.cum2000 < histFilter[0] || c.cum2000 >= histFilter[1])) return false;
      return true;
    });
  }
  function sorted(rows: ClassRec[]): ClassRec[] {
    return rows.slice().sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;
      if (sortKey === 'name') {
        av = a.name;
        bv = b.name;
      } else if (sortKey === 'group') {
        av = groupName(a);
        bv = groupName(b);
      } else {
        av = a[sortKey] as number | null;
        bv = b[sortKey] as number | null;
      }
      if (typeof av === 'string' && typeof bv === 'string') return sortDir * av.localeCompare(bv);
      const an = av == null ? -Infinity : (av as number);
      const bn = bv == null ? -Infinity : (bv as number);
      return sortDir * (an - bn);
    });
  }
  function groupName(c: ClassRec): string {
    if (!c.group) return c.tree ? '—' : 'Analytical';
    return data.byCode.get(c.group)?.name ?? '';
  }

  function paintHist(): void {
    const vals = pool()
      .map((c) => c.cum2000)
      .filter((v): v is number => v != null);
    const lo = Math.floor(Math.min(...vals) / 50) * 50;
    const hi = Math.ceil(Math.max(...vals) / 50) * 50;
    const step = 50;
    const bins: HistBin[] = [];
    for (let x = lo; x < hi; x += step) bins.push({ lo: x, hi: x + step, count: vals.filter((v) => v >= x && v < x + step).length });
    histSlot.innerHTML = '';
    histSlot.appendChild(
      histogramChart(bins, {
        width: 900,
        height: 220,
        colour: '#2f6f8f',
        xFmt: (v) => `${v}%`,
        onPick: (i) => {
          const b = bins[i];
          histFilter = histFilter && histFilter[0] === b.lo ? null : [b.lo, b.hi];
          clearBtn.hidden = !histFilter;
          paintTable();
        },
      }),
    );
  }

  function paintTable(): void {
    const rows = sorted(filtered());
    tbody.innerHTML = rows
      .map((c) => {
        return `<tr class="clickable" data-code="${c.code}">
          <td><span class="dot" style="background:${groupColour(c.group ?? c.code)}"></span><span class="name-cell">${escapeHtml(c.name)}</span></td>
          <td>${escapeHtml(groupName(c))}</td>
          <td>${sparkline({ s: c.s, v: c.v }, groupColour(c.group ?? c.code), c.s >= 2000 * 4 ? c.s : 2000 * 4)}</td>
          <td class="t-num ${cls(c.annual)}">${formatSignedPct(c.annual)}</td>
          <td class="t-num ${cls(c.cum2000)}">${formatSignedPct(c.cum2000, 0)}</td>
          <td class="t-num ${cls(c.cum10)}">${formatSignedPct(c.cum10, 0)}</td>
          <td class="t-num">${c.contrib != null ? c.contrib.toFixed(2) : '—'}</td>
          <td class="t-num">${c.li != null ? c.li.toFixed(1) : '—'}</td>
        </tr>`;
      })
      .join('');
    tbody.querySelectorAll('[data-code]').forEach((tr) => tr.addEventListener('click', () => ctx.openItem(tr.getAttribute('data-code')!)));
    countSlot.textContent = `${rows.length} of ${pool().length} series${histFilter ? ` · filtered to ${histFilter[0]}%–${histFilter[1]}% since 2000` : ''}`;
    root.querySelectorAll('th[data-sort]').forEach((th) => {
      const active = th.getAttribute('data-sort') === sortKey;
      th.innerHTML = th.innerHTML.replace(/\s*[▲▼]$/, '') + (active ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    });
  }

  function cls(v: number | null): string {
    if (v == null) return '';
    return v > 0.05 ? 'rise' : v < -0.05 ? 'fall' : '';
  }

  let timer: number | undefined;
  root.querySelector('[data-role="q"]')?.addEventListener('input', (e) => {
    window.clearTimeout(timer);
    const val = (e.target as HTMLInputElement).value;
    timer = window.setTimeout(() => {
      query = val;
      paintTable();
    }, 250);
  });
  root.querySelector('[data-role="group"]')?.addEventListener('change', (e) => {
    groupFilter = (e.target as HTMLSelectElement).value;
    paintTable();
  });
  root.querySelectorAll('[data-scope]').forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.getAttribute('data-scope') as 'leaf' | 'all';
      root.querySelectorAll('[data-scope]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      histFilter = null;
      clearBtn.hidden = true;
      paintHist();
      paintTable();
    }),
  );
  root.querySelectorAll('th[data-sort]').forEach((th) =>
    th.addEventListener('click', () => {
      const k = th.getAttribute('data-sort') as SortKey;
      if (sortKey === k) sortDir = (sortDir * -1) as 1 | -1;
      else {
        sortKey = k;
        sortDir = k === 'name' || k === 'group' ? 1 : -1;
      }
      paintTable();
    }),
  );
  clearBtn.addEventListener('click', () => {
    histFilter = null;
    clearBtn.hidden = true;
    paintTable();
  });

  paintHist();
  paintTable();
}
