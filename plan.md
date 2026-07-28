# Site Plan: Cost of Living

## Overview
- **Name:** Cost of Living
- **Repo name:** au-inflation
- **Tagline:** What actually got more expensive in Australia — every item in the CPI basket, tracked since 1948, and whether wages kept up.

### Naming Convention
Plain topic name, no country code in the name. `country: "AU"` in the index entry renders the flag. "Cost of Living" reads for a general audience better than "Inflation" or "CPI".

## Target Audience
Anyone worried about the cost of living — the single biggest hip-pocket concern in Australia — plus journalists, students, renters and retirees who want to know *which* things rose and *how much*, not just "inflation was 3.2%". Also economically literate readers who want to compare their city, or check whether wages have kept pace with prices. Mostly general public on desktop and phone; a few analysts on desktop.

## Value Proposition
The ABS publishes the CPI as dry index tables. Nobody outside an economics desk can answer "how much more does bread / rent / a TV / cigarettes cost than 25 years ago?" from those tables. This site turns 158 expenditure classes × 300 quarters into a single searchable interface built around one counter-intuitive idea a headline inflation number hides: **not everything gets more expensive.** Tobacco, education, health, housing and insurance have exploded, while audio-visual/computing equipment, telecoms, clothing and toys have *fallen* in price. Look up any item, watch its price line, compare cities, and see whether your pay packet kept up.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth? |
|--------|-----|-------------------|-----------------|-------|
| ABS Consumer Price Index (SDMX) | https://data.api.abs.gov.au/rest/data/ABS,CPI,1.1.0/ | Index numbers, % changes and contributions for 158 expenditure classes (11 groups → subgroups → classes), 8 capitals + weighted average, quarterly 1948→present | Quarterly (late Jan/Apr/Jul/Oct) | No |
| ABS Wage Price Index (SDMX) | https://data.api.abs.gov.au/rest/data/ABS,WPI,1.2.0/ | Total hourly wage index, all industries, Australia, quarterly 1997→present | Quarterly | No |

## Key Features
1. **Look up any item** — type "rent", "bananas", "cigarettes" and chart its price trajectory + inflation, compare several on one axis, deep-linkable.
2. **Risers & Fallers** (signature) — diverging bars of cumulative % change since a chosen base year for every class; from computing/TVs (−90%) to tobacco (+800%).
3. **The shrinking dollar** — interactive purchasing-power: what $100 in year X buys today; long-run index with GST/COVID annotations.
4. **The basket** — squarified treemap of what Australians actually spend on (CPI weights), drill group→class.
5. **Wages vs prices** — WPI vs CPI and the real-wage line (the 2021–24 real pay cut).
6. **By city** — 8 capitals compared; city × group inflation heatmap.
7. **Inflation over time heatmap** — group × decade, the 1970s–80s era vs the low-inflation 2010s vs the 2022 spike.
8. Sortable **Explorer** of every class with sparklines + a click-through distribution histogram, and auto-detected **Insights**.

## Target Audience (detailed)
Stressed households googling "why is everything so expensive"; a renter comparing Sydney vs Brisbane; a retiree on a fixed income; a journalist needing the exact number for a cost-of-living story; a student doing an economics assignment. Phone-first for the general public, desktop for the analysts. They bring anxiety and scepticism — the site must be clear, trustworthy and non-partisan, and never feel like a trading terminal.

## Style Direction
**Tone:** calm, civic, trustworthy — a public-broadcaster explainer, not a finance terminal.
**Colour palette:** light, warm-neutral paper background with a deep teal/ink primary and a warm amber accent for "rising prices"; green for falling, red for sharp rises. The warm paper + ink feels editorial and human (cost of living is emotional), the amber-to-green diverging ramp carries the whole "some things rose, some fell" argument.
**UI density:** balanced — news-site density, generous on mobile, denser tables on desktop.
**Dark/light theme:** light (general/consumer/civic audience).
**Reference sites for tone:** ABC News data explainers, the ONS "shopping prices" tracker, fuelaustralia.org.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (single-page, tabbed views, hand-rolled SVG — no framework needed).
- **Data strategy:** pipeline. CPI is published **quarterly**, so the cron is **quarterly** (proportional). Embeds the latest data quarter, not a run timestamp, so re-runs are idempotent.
- **Key libraries:** none at runtime (hand-rolled SVG charts + squarified treemap from patterns/). No Leaflet — the data is temporal/categorical; 8 capitals is not choropleth-worthy (same deliberate no-map call as au-baby-names). Honestly noted.

## Layout
Sticky header (brand + item search + About). Sticky nav tabs. Max-width 1600px content. Views render into a single `#view-root`. Sticky footer with attribution + source. Per-item drill-down slide-in drawer (hash-linkable `#item=Rents`). Panels stack to one column < 768px; every wide chart/table lives in its own `overflow-x:auto` scroller.

## Pages/Views
Overview · Look up an item · Risers & Fallers · The shrinking dollar · The basket · Wages vs prices · By city · Over time (heatmap) · Explorer · Insights (10 views).

## Visualization Strategy
Design research: the best price-tracker explainers (ONS shopping-prices, The Economist "price of everything", ABC cost-of-living pieces) all lead with **cumulative change since a base year as a diverging ranked bar** — because the story *is* the spread between winners and losers, which a single index line cannot show. That is the signature view here. For "look up an item" the bar is a multi-line index chart (rebased so lines are comparable). For composition, a weight treemap. For the wages story, two lines + a derived real-wage line. For the temporal texture, a group × decade heatmap.

- **Table view** (Explorer) — sortable/filterable, sparkline per class. Always.
- **Diverging bar** (Risers & Fallers) — cumulative change since base year, every class, amber↑/green↓. **Signature.**
- **Multi-line index chart** (Look up an item, Wages vs prices, City trends) — rebased index comparison, hover tooltips, deep-linkable.
- **Squarified treemap** (The basket) — CPI weights, drill group→class, from patterns/treemap.ts.
- **Heatmap / matrix** (Over time: group × decade annual inflation; By city: city × group) — cell intensity = inflation, hover exact.
- **Histogram** (Explorer) — distribution of since-2000 change, click-to-filter the table.
- **Interactive purchasing-power widget** (The shrinking dollar) — year slider → "$1 then = Xc now", plus the annotated long-run line.
- **Insight cards** — auto-detected outliers (fastest riser, the only fallers, biggest current mover, most volatile, city divergence, the real-wage crunch).

Every mark gets a `[data-tip]` hover tooltip; dense SVGs (long-run line, risers/fallers) get zoom/pan via patterns/svgZoom.ts; treemap cells click to drill; explorer rows and bars click to the per-item drawer.

## Reconciliation gates (pipeline, hard-fail)
Two INDEPENDENTLY-published ABS columns must agree, so agreement proves a correct parse:
1. **Computed vs published annual change** — `(index[t]/index[t−4]−1)×100` (from MEASURE 1) must equal the ABS-published MEASURE 3 for All-groups at every quarter, within 0.15pp.
2. **Contribution sum** — the 11 top-level groups' MEASURE-4 contributions must sum to the All-groups MEASURE-1 index at every quarter, within 0.2.
