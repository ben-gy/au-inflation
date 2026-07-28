# Cost of Living

**What actually got more expensive in Australia — every item in the CPI basket, tracked since 1948, and whether wages kept up.**

🔗 **Live:** [https://au-inflation.benrichardson.dev](https://au-inflation.benrichardson.dev)

## What is this?

The Australian Bureau of Statistics publishes the Consumer Price Index (CPI) as dry
index tables. That is where the headline "inflation was 3.2%" comes from — but the
single number hides an enormous range that no one outside an economics desk can easily
see. This site turns 158 expenditure classes across roughly 300 quarters into one
searchable interface built around a counter-intuitive idea: **not everything gets more
expensive.**

Since 2000, tobacco is up more than 800%, and rents, health and schooling have soared —
while audio-visual and computing equipment cost about 90% *less*, and clothing and phone
plans have fallen too. Fourteen of the basket's items are cheaper now than in 2000.
Inflation is an average of winners and losers, and this tool lets you look up any item,
compare cities, watch the shrinking dollar, and check whether pay packets kept pace with
prices.

The data is cross-checked on every build: the change computed from the index numbers must
match the ABS's independently published annual figures, and the eleven groups' contributions
must sum to the whole index — so a parsing error can't slip through.

## Who is this for?

Anyone worried about the cost of living — renters comparing Sydney with Brisbane,
retirees on a fixed income, students doing an economics assignment, and journalists who
need the exact number for a cost-of-living story. It answers "why is everything so
expensive?" with specifics instead of a single average.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| ABS Consumer Price Index (SDMX API) | Index numbers, annual changes and contributions for every expenditure class, 8 capitals + weighted average, 1948→present | Quarterly |
| ABS Wage Price Index (SDMX API) | Total hourly wage index, all industries, Australia, 1997→present | Quarterly |

## Features

- **Look up an item** — type "rent", "petrol" or "childcare" and chart its price against the basket; add several to compare, deep-linkable.
- **Risers & Fallers** — the whole basket ranked by cumulative price change since a chosen base year; the signature view.
- **The shrinking dollar** — an interactive purchasing-power widget and the annotated long-run price level.
- **The basket** — a squarified treemap of what households actually spend on, drill group → item.
- **Wages vs prices** — the WPI against the CPI, and the real-wage line showing the post-2020 squeeze.
- **By city** — the eight capitals compared, plus a city × group inflation heatmap.
- **Over time** — a group × decade heatmap of average inflation.
- **Explorer** — a sortable table of every series with sparklines and a click-to-filter histogram, plus auto-detected **Insights**.

## Tech Stack

- **Runtime:** Vanilla TypeScript (no framework, no runtime dependencies)
- **Build:** Vite 6
- **Testing:** Vitest (71 tests — parser + reconciliation gates, positional layout, and a headless render of every view against the real built data)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline that pulls the ABS SDMX API each quarter and commits JSON to `public/data/`

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview

# Rebuild the data (fetches from the ABS API)
node pipeline/collect.mjs && node pipeline/aggregate.mjs
```

## How it works

`pipeline/collect.mjs` downloads the CPI and WPI slices from the ABS SDMX API.
`pipeline/aggregate.mjs` parses them with a dependency-free RFC-4180 reader (shared with
the tests), runs the two reconciliation gates, and writes compact JSON to `public/data/`.
The browser loads that JSON and renders everything client-side with hand-rolled SVG — index
series are stored densely (a start quarter plus an array of values) so cumulative changes,
rebasing and purchasing power are computed on the fly.

## License

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see [ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

A separate commercial licence without the AGPL's source-disclosure obligations is
available on request: <hi@ben.gy>.

Third-party components keep their own licences — see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
Data sources keep theirs, and their attribution requirements are listed in the site's
own methodology/sources section.
