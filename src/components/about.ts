// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { Meta } from '../types';
import { glossaryTerm } from '../glossary';
import { formatDate, formatNumber } from '../utils/format';

/** About modal: what this is, where the data comes from, and what it cannot tell you. */
export function createAbout(meta: Meta): { open: () => void; close: () => void } {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'About Cost of Living');

  modal.innerHTML = `
    <button class="modal-close" aria-label="Close">✕</button>
    <h2>About Cost of Living</h2>
    <p>
      This tracks every item in Australia's ${glossaryTerm('cpi', 'Consumer Price Index')} — the official
      "shopping basket" the ABS uses to measure ${glossaryTerm('inflation', 'inflation')}. It covers
      ${formatNumber(meta.counts.classes)} price series across ${meta.groups.length} broad groups and 8 capital cities,
      quarterly from ${meta.firstPeriod.replace('-Q', ' Q')} to <strong>${meta.latestPeriodLabel}</strong>.
    </p>
    <p>
      It exists to answer a question the headline number can't: <strong>what actually got more expensive?</strong>
      Overall inflation was ${meta.headline.annual}% over the latest year — but that single figure hides enormous
      spread. Tobacco, education, health and housing have soared, while computers, clothing and phone plans have
      fallen. Type an item into the search box to trace its own price story, or open
      ${glossaryTerm('base_year', 'Risers &amp; Fallers')} to see the whole basket ranked.
    </p>

    <h3>Where the data comes from</h3>
    <ul>
      <li>
        <strong>ABS Consumer Price Index</strong> — index numbers, published annual changes and
        ${glossaryTerm('contribution', 'contributions')} for every ${glossaryTerm('expenditure_class', 'expenditure class')},
        weighted average of the eight capital cities plus each capital.
      </li>
      <li>
        <strong>ABS Wage Price Index</strong> — total hourly wage growth (all industries, Australia,
        ${glossaryTerm('seasonal', 'seasonally adjusted')}), used to compare pay against prices.
      </li>
    </ul>

    <h3>How to read the numbers</h3>
    <ul>
      <li>
        Prices are shown as ${glossaryTerm('index_number', 'index numbers')}, with 2011–12 set to 100. Only the
        <em>change</em> in the index means anything — a value of 143.6 means prices are 43.6% above their 2011–12 level.
      </li>
      <li>
        "Since 2000" and similar figures are ${glossaryTerm('base_year', 'cumulative changes')} from a chosen base
        year. Pick an earlier base and the rises look bigger.
      </li>
      <li>
        The ${glossaryTerm('weight', 'basket weights')} shown are each item's contribution to the overall index —
        roughly how much of a household's spending it represents.
      </li>
    </ul>

    <h3>How often it updates</h3>
    <p>
      An automated pipeline rebuilds the site each quarter, matching the ABS's quarterly CPI release. Data current to
      ${meta.latestPeriodLabel} (built ${formatDate(meta.generated)}). Two independent ABS series are cross-checked
      on every build — computed vs published annual change, and the groups' contributions summing to the whole — so a
      parsing error can't slip through.
    </p>

    <h3>Important limits — please read</h3>
    <ul>
      <li>
        <strong>Averages, not your bill.</strong> The CPI is a national average basket. Your own cost of living depends
        on what you buy and where you live — a renter, a mortgage-holder and a retiree feel very different inflation.
      </li>
      <li>
        <strong>Quality changes are adjusted for.</strong> The ABS strips out quality improvements, which is a big part
        of why electronics "fall" — today's cheaper TV is also far better than the one it replaced.
      </li>
      <li>
        <strong>Prices, not spending.</strong> This measures the price of a fixed basket, not how much people actually
        spend or whether they can afford it.
      </li>
      <li>
        <strong>Capital cities.</strong> The CPI covers the eight capital cities; regional and remote prices can differ.
      </li>
    </ul>

    <h3>Licence</h3>
    <p>
      ABS data is published under CC BY 4.0. This site is an independent project and is not affiliated with the
      Australian Bureau of Statistics.
    </p>
  `;

  document.body.append(overlay, modal);
  const close = () => {
    overlay.classList.remove('open');
    modal.classList.remove('open');
  };
  const open = () => {
    overlay.classList.add('open');
    modal.classList.add('open');
    (modal.querySelector('.modal-close') as HTMLElement)?.focus();
  };
  overlay.addEventListener('click', close);
  modal.querySelector('.modal-close')?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
  return { open, close };
}
