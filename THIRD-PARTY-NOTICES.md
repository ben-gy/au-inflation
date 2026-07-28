# Third-party notices

This site ships **no third-party runtime components**. The entire application is
first-party TypeScript, hand-rolled SVG charts, and system fonts — there are no
bundled JavaScript libraries, no web fonts, and no external map/tile libraries.
(Verified from the build's source maps: no `node_modules` sources are emitted into
`dist/`.)

The build toolchain (Vite, TypeScript, Vitest, jsdom and their dependencies) runs
only at build time and is **not** distributed in the deployed site (`dist/`). Those
tools keep their own licences in `node_modules/`.

The served copy of this file is `public/third-party-notices.txt`.

## Data sources (not code — attribution required by their licences)

- **Australian Bureau of Statistics — Consumer Price Index, Australia**, via the
  ABS Data API (data.api.abs.gov.au, dataflow `CPI`). © Commonwealth of Australia,
  licensed **CC BY 4.0**.
- **Australian Bureau of Statistics — Wage Price Index, Australia**, via the ABS
  Data API (dataflow `WPI`). © Commonwealth of Australia, licensed **CC BY 4.0**.

Both licences require attribution, which is preserved in the site's footer and its
"About" panel. This site is an independent project and is not affiliated with or
endorsed by the Australian Bureau of Statistics.
