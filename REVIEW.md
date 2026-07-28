# Cost of Living — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-inflation/ *(redirects to the custom domain)*
- **Custom domain:** https://au-inflation.benrichardson.dev

## What it is

Every item in Australia's Consumer Price Index basket, tracked since 1948, built around
the idea a single inflation figure hides: **not everything gets more expensive.** Since
2000 tobacco is up 837% and computing fell 90%; 14 basket items are cheaper than in 2000.
Ten views — look-up, risers & fallers, the shrinking dollar, the basket treemap, wages vs
prices, by-city, over-time heatmap, explorer, insights — plus a per-item drawer.

## Data

- ABS Consumer Price Index (SDMX API) — 158 expenditure classes, 8 capitals, quarterly 1948→2025-Q3.
- ABS Wage Price Index (SDMX API) — quarterly 1997→2026-Q1.

Two hard reconciliation gates (computed vs published annual change; group contributions
summing to the whole) pass on every build, and the quarterly data pipeline ran green on CI.
