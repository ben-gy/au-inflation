// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml } from './utils/format';

export interface GlossaryEntry {
  title: string;
  body: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  cpi: {
    title: 'Consumer Price Index (CPI)',
    body: 'A measure of how the average price of a fixed "basket" of goods and services bought by households changes over time. When people say "inflation", they usually mean the change in the CPI. The ABS publishes it every three months.',
  },
  inflation: {
    title: 'Inflation',
    body: 'The rate at which prices rise. "Annual inflation of 3.2%" means the CPI is 3.2% higher than a year earlier — the same basket of goods costs 3.2% more.',
  },
  index_number: {
    title: 'Index number',
    body: 'Prices are expressed relative to a base period set to 100. The ABS base is 2011–12 = 100. An index of 143.6 means prices are 43.6% higher than in 2011–12. The index itself is not a dollar amount — only its change matters.',
  },
  base_year: {
    title: 'Base year',
    body: 'The starting point a price change is measured from. "Up 97% since 2000" compares today’s price with the price in the year 2000. Change the base year and the numbers change — earlier bases show bigger cumulative rises.',
  },
  expenditure_class: {
    title: 'Expenditure class',
    body: 'The most detailed level of the CPI basket — 87 categories like "Bread", "Rents", "Tobacco" or "Audio, visual and computing equipment". Each rolls up into one of 11 broad groups.',
  },
  cpi_group: {
    title: 'CPI group',
    body: 'The 11 top-level categories of the basket: Food, Alcohol & tobacco, Clothing & footwear, Housing, Furnishings, Health, Transport, Communication, Recreation, Education, and Insurance & financial services.',
  },
  weight: {
    title: 'Basket weight',
    body: 'How much of a typical household’s spending goes to each category. Housing and food carry the most weight, so their price moves matter most to the headline number. Shown here as each item’s contribution to the overall index.',
  },
  contribution: {
    title: 'Contribution to the CPI',
    body: 'How many index points a category adds to the all-groups figure — its weight combined with its price level. The 11 groups’ contributions add up to the all-groups index. It is the standard way to see what the basket is made of.',
  },
  real_wage: {
    title: 'Real wage',
    body: 'Wages adjusted for inflation — what your pay actually buys. If wages rise 3% but prices rise 5%, your real wage fell about 2%: a pay rise that trails inflation is a pay cut in real terms.',
  },
  wpi: {
    title: 'Wage Price Index (WPI)',
    body: 'The ABS measure of how much wages rise for the same jobs, stripping out promotions and changes in the mix of jobs. It is the cleanest read on "pay rises" and is compared here against the CPI.',
  },
  purchasing_power: {
    title: 'Purchasing power',
    body: 'How much a fixed amount of money can buy. As prices rise, a dollar buys less — its purchasing power falls. $1 in 2000 buys only about 51c worth of goods today.',
  },
  tradables: {
    title: 'Tradables vs non-tradables',
    body: 'Tradables are goods and services whose prices are set on world markets (petrol, electronics, clothing). Non-tradables (rent, education, hairdressing) are set locally. Non-tradables have driven most of the recent rise.',
  },
  seasonal: {
    title: 'Original vs seasonally adjusted',
    body: 'The CPI figures here are "original" — the actual measured prices. Wages are seasonally adjusted to remove regular calendar patterns so the underlying trend is clearer.',
  },
};

/** Render an inline glossary link + info icon around some text. */
export function glossaryTerm(term: string, text: string): string {
  const t = escapeHtml(term);
  return `<span class="glossary-link" data-term="${t}" tabindex="0" role="button">${escapeHtml(text)}</span><button class="info-icon" data-term="${t}" aria-label="What is ${escapeHtml(text)}?">i</button>`;
}
