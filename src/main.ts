// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import './styles.css';
import { loadDataset, searchClasses, type Dataset } from './data';
import type { ViewId } from './types';
import type { ViewContext } from './viewContext';
import { initTooltip } from './components/tooltip';
import { initGlossary } from './components/glossaryPopover';
import { createAbout } from './components/about';
import { createDrilldown } from './components/drilldown';
import { groupColour } from './colours';
import { renderOverview } from './views/overview';
import { renderLookup } from './views/lookup';
import { renderMovers } from './views/movers';
import { renderDollar } from './views/dollar';
import { renderBasket } from './views/basket';
import { renderWages } from './views/wages';
import { renderCities } from './views/cities';
import { renderOvertime } from './views/overtime';
import { renderExplorer } from './views/explorer';
import { renderInsights } from './views/insights';
import { escapeHtml, formatSignedPct } from './utils/format';

// Nav tabs are words only — never count badges.
const VIEWS: Array<{ id: ViewId; label: string; render: (root: HTMLElement, ctx: ViewContext, seed?: string[]) => void }> = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'lookup', label: 'Look up an item', render: (r, c, s) => renderLookup(r, c, s) },
  { id: 'movers', label: 'Risers & Fallers', render: renderMovers },
  { id: 'dollar', label: 'Shrinking Dollar', render: renderDollar },
  { id: 'basket', label: 'The Basket', render: renderBasket },
  { id: 'wages', label: 'Wages vs Prices', render: renderWages },
  { id: 'cities', label: 'By City', render: renderCities },
  { id: 'overtime', label: 'Over Time', render: renderOvertime },
  { id: 'explorer', label: 'Explorer', render: renderExplorer },
  { id: 'insights', label: 'Insights', render: renderInsights },
];

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="#12433f"/>
  <polyline points="6,22 12,16 17,19 26,8" fill="none" stroke="#e79a3a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="26" cy="8" r="2.4" fill="#e79a3a"/>
</svg>`;

function parseHash(): { view: ViewId | null; item: string | null } {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { view: null, item: null };
  if (h.startsWith('item=')) return { view: null, item: decodeURIComponent(h.slice('item='.length)) };
  const view = VIEWS.find((v) => v.id === h)?.id ?? null;
  return { view, item: null };
}

function shell(app: HTMLElement, data: Dataset): void {
  const { meta } = data;

  app.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#overview">${LOGO}<span>Cost of Living</span><span class="brand-sub">Australia · CPI to ${escapeHtml(meta.latestPeriodLabel)}</span></a>
        <div class="search-wrap header-search">
          <input class="search-input" type="search" placeholder="Search an item — rent, petrol, bread…" aria-label="Search an item" autocomplete="off" />
          <div class="search-results" role="listbox"></div>
        </div>
        <div class="header-spacer"></div>
        <button class="icon-btn" data-role="about" aria-label="About this site" title="About this site">?</button>
      </div>
    </header>
    <nav class="nav-tabs" aria-label="Views">
      <div class="nav-inner" role="tablist">
        ${VIEWS.map((v) => `<button class="nav-tab" role="tab" data-view="${v.id}" aria-selected="false">${v.label}</button>`).join('')}
      </div>
    </nav>
    <main class="main-content" id="view-root"></main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span>
          Data: <a href="${meta.sources.cpi}" target="_blank" rel="noopener">ABS Consumer Price Index</a> &amp;
          <a href="${meta.sources.wpi}" target="_blank" rel="noopener">Wage Price Index</a>, CC BY 4.0.
          Current to ${escapeHtml(meta.latestPeriodLabel)}. Capital cities; averages, not your bill.
        </span>
        <span>
          Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> ·
          <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a>
        </span>
      </div>
    </footer>
  `;

  const viewRoot = app.querySelector('#view-root') as HTMLElement;
  const about = createAbout(meta);
  const drill = createDrilldown(data);
  let current: ViewId = 'overview';
  let lookupSeed: string[] | undefined;

  const ctx: ViewContext = {
    data,
    openItem: (code) => drill.open(code),
    goTo: (v) => show(v),
    compare: (codes) => {
      lookupSeed = codes;
      show('lookup');
    },
  };

  function show(id: ViewId, pushHash = true): void {
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    drill.close();
    current = view.id;
    app.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-view') === current)));
    viewRoot.innerHTML = '';
    try {
      view.render(viewRoot, ctx, id === 'lookup' ? lookupSeed : undefined);
    } catch (err) {
      viewRoot.innerHTML = '<div class="error-box">Something went wrong rendering this view. Try another tab.</div>';
      if (import.meta.env.DEV) console.error(err);
    }
    if (id !== 'lookup') lookupSeed = undefined;
    if (pushHash) history.replaceState(null, '', `#${current}`);
    window.scrollTo({ top: 0 });
  }

  app.querySelector('.nav-inner')?.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-view]');
    if (btn) show(btn.getAttribute('data-view') as ViewId);
  });
  app.querySelector('[data-role="about"]')?.addEventListener('click', () => about.open());
  app.querySelector('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    show('overview');
  });

  // ── Header search ──
  const input = app.querySelector('.header-search .search-input') as HTMLInputElement;
  const results = app.querySelector('.header-search .search-results') as HTMLElement;
  let hits: ReturnType<typeof searchClasses> = [];
  let cursor = -1;
  const closeSearch = () => {
    results.innerHTML = '';
    cursor = -1;
  };
  const paintResults = () => {
    results.innerHTML = hits
      .map(
        (h, i) => `
        <button class="search-item" data-code="${escapeHtml(h.code)}" role="option" aria-selected="${i === cursor}">
          <span class="dot" style="background:${groupColour(h.group)}"></span>
          <strong>${escapeHtml(h.name)}</strong>
          <em>${formatSignedPct(h.cum2000, 0)} since 2000</em>
        </button>`,
      )
      .join('');
  };
  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      hits = searchClasses(data.classes, input.value);
      cursor = -1;
      paintResults();
    }, 250);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
      input.blur();
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = (cursor + 1) % hits.length;
      paintResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = (cursor - 1 + hits.length) % hits.length;
      paintResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = hits[cursor >= 0 ? cursor : 0];
      if (pick) {
        drill.open(pick.code);
        input.value = '';
        closeSearch();
      }
    }
  });
  results.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-code]');
    if (!btn) return;
    drill.open(btn.getAttribute('data-code') as string);
    input.value = '';
    closeSearch();
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.header-search')) closeSearch();
  });

  // ── Routing ──
  const initial = parseHash();
  show(initial.view ?? 'overview', !initial.item);
  if (initial.item) drill.open(initial.item);
  window.addEventListener('hashchange', () => {
    const { view, item } = parseHash();
    if (item) drill.open(item);
    else if (view && view !== current) show(view, false);
  });
}

function renderError(app: HTMLElement, retry: () => void): void {
  app.innerHTML = `
    <main class="main-content">
      <div class="error-box">
        <strong>Could not load the data.</strong>
        <p style="margin-top:8px">Check your connection and try again.</p>
        <button type="button">Retry</button>
      </div>
    </main>`;
  app.querySelector('button')?.addEventListener('click', retry);
}

async function boot(): Promise<void> {
  const app = document.getElementById('app') as HTMLElement;
  app.innerHTML = `
    <main class="main-content">
      <div class="loading">Loading 77 years of prices…</div>
      <div class="skeleton"></div>
    </main>`;
  initTooltip();
  initGlossary();
  try {
    const data = await loadDataset();
    shell(app, data);
  } catch {
    renderError(app, () => {
      void boot();
    });
  }
}

void boot();

export type { Dataset };
