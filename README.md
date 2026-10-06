# Urban Stock Brokerage: Search (Week 4, v2 premium UI)

React + Vite + Tailwind frontend, Vercel serverless API, PostgreSQL full-text search (weighted `tsvector` + GIN) with `pg_trgm` typo tolerance.

## Setup
1. `npm install`
2. Create a Postgres DB (local, Neon, Supabase, or Vercel Postgres). Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. `npm run db:schema` (table, trigger, GIN + trigram indexes)
4. `npm run db:seed` (1,801 deterministic records)
5. `npm run dev` (Vite serves the UI and runs `/api/*` locally on :5173) or `vercel dev`
6. `npm run test:api` (43 API checks) and `npm run benchmark` for the relevance suite (see BENCHMARKS.md)

## Deploy
Push to GitHub, import in Vercel, add `DATABASE_URL` env var. `vercel.json` handles SPA rewrites.

## What changed in v2
- **UI:** dark obsidian/navy trading-terminal look, glass cards, neon accents, mono numerals, ticker tape, a CSS-3D rotating "featured vault" (mouse tilt, pause, prev/next) and live market-breadth tiles. Pure CSS transforms, no new dependencies, reduced-motion respected.
- **Pagination:** API returns 50 rows by default, up to 100 (`limit`). UI has Previous/Next, numbered pages with ellipsis, and a 50/100 toggle. Totals come from `COUNT(*) OVER()` in the same query.
- **Filters:** asset class, risk, price presets and sector in a sidebar (drawer with focus trap on mobile), plus removable active-filter chips.
- **Search UX:** 250 ms debounce, ARIA combobox suggestions, `/` to focus, "did you mean" notice for typo matches, skeleton/loading bar, error state with Retry, empty state.

## API
`GET /api/search?q=&category=&sector=&riskLevel=&minPrice=&maxPrice=&page=1&limit=50&sort=`
- `limit` 1-100 (default 50). `sort`: `relevance | ticker | name | price_asc | price_desc | change_desc | change_asc` (whitelisted).
- Response: `{ results, total, page, pageSize, totalPages, mode, query, sort }`; `mode` is `browse | fulltext | typo-fallback | no-results`.
`GET /api/featured` returns `{ featured[8], stats{ total, advancing, declining, avgChange, topGainer, topLoser } }`.

## Architecture
- `api/search.js`, `api/featured.js`: handlers. Query builders are pure functions (tested without I/O).
- `src/db/*`: schema (weighted tsvector, GIN, trigram), seed (1,801 rows; the old generator lost 5 rows to de-duplication), pool (no SSL for localhost).
- `src/hooks`: `useSearch` (abort stale requests, page reset, overflow jump), `useSuggestions`, `useFeatured`, `useDebounce`.
- `src/components`: Header, TickerTape, Hero, SearchBar, Vault3D, MarketStats, FilterSidebar, Toolbar, ActiveFilters, ResultsTable, Pagination, EmptyState, ErrorState.
- `src/lib`: formatting, pagination math, deterministic illustrative sparklines.

## Notes
- Typo tolerance is `pg_trgm` `word_similarity` (>= 0.35), not tsquery.
- Prices and change % are sample data. Sparklines are generated per ticker and are illustrative only (the database stores no price history).
- Lighthouse was NOT run in the build sandbox. Run it on `npm run build && npm run preview` and keep the reports.
- `npm run build` (Vite) was not run in the sandbox either (the npm registry was blocked); the UI was verified with a Bun bundle in headless Chromium against a real PostgreSQL 16.

## Running Lighthouse correctly
Audit ONLY the production build, in an Incognito window with extensions off:
`npm run build && npm run preview` then open http://localhost:4173.
Auditing `npm run dev` shows `react-dom.development.js`, unminified CSS and every `src/*.jsx` file, and Chrome extensions (e.g. Adobe Acrobat) add their own scripts to the report. Neither is in the production bundle.
`npm run preview` also serves gzip and immutable cache headers for `/assets/*`, like Vercel does.

## Performance work (2.1.0)
- Production defines: `process.env.NODE_ENV` forced to production, `console`/`debugger` dropped, esbuild + CSS minify.
- 3D vault and stat tiles are a lazy chunk loaded after first paint (idle), behind same-size skeletons (no layout shift).
- Table rows, toolbar, pagination, filters are memoised; typing no longer re-renders the 50-100 rows. Results render in a React transition. Sparkline paths are cached. Vault mouse-tilt is one style write per frame.
- Measured on the built bundle (Chromium, 4x CPU throttle, mobile viewport): JS 163 KB raw / 54 KB gzip, CSS 24 KB / 6 KB gzip, CLS 0, about 70 ms blocking time on load.

## Performance pass 2 (2.2.0)
- Critical CSS is inlined into `index.html` at build time (`inlineCriticalCss` in `vite.config.js`), so no stylesheet blocks first paint. Fonts remain async.
- Table: `table-layout: fixed`, rows painted in idle-time chunks (14, then 36 at a time), lighter skeleton, no `backdrop-filter`, no blur filters, `contain` on glass cards, fewer font weights.
- Measured (built bundle, Chromium, 4x CPU throttle, mobile): total blocking time ~300 ms -> ~25 ms, layout 283 -> 148 ms, style recalculation 146 -> 49 ms.
- In Lighthouse, entries from `chrome-extension://...` (e.g. Adobe Acrobat) are not part of this app. Audit in Incognito with extensions disabled.

## v2.3.0 notes
- **Vault:** hovering a side card rotates it to the front (shortest way round, with hover-intent delay); clicking the front card opens the stock detail dialog (same record shape as a table row). Clicking a side card (or tapping on touch) brings it forward. Keyboard: Prev/Next buttons, Enter on the front card.
- **Stock detail dialog** (lazy chunk) opens from the vault and from any table row. Esc closes, focus is trapped and restored. A missing description is loaded through the existing `/api/search`, so no backend change.
- **Mobile scroll fix:** the results table no longer has its own scroll container (it trapped touch scrolling); the page scrolls normally. Header-sticky table head uses `overflow: clip`.
- **Fonts** use `display=optional` (no swap-induced relayout). On a first, uncached visit the metric-matched fallback fonts are shown; change `optional` to `swap` in `index.html` to restore the swap.
- Table renders only the columns the viewport needs (fewer DOM nodes on phones).
- Backend, schema and seed untouched.

## v2.4.0 notes
- **Vault:** the buttons are gone. Press and drag (mouse, pen or touch) to rotate with no lag; release flings and snaps to the nearest card. Focus the vault (Tab) and use Left/Right arrow keys; Enter opens the front card; clicking the front card opens details; clicking a side card brings it forward. `touch-action: pan-y` keeps vertical swipes scrolling the page natively on phones. Auto-rotation and the hover delay were removed.
- **Row windowing:** only the rows near the viewport are in the DOM (fixed 57 px rows plus spacer rows, `aria-rowcount`/`aria-rowindex` kept). DOM nodes on load: about 1,260 -> 510. Browser find-in-page only sees rendered rows.
- Skeletons pulse as one layer instead of one animation per cell.
- Backend, schema, seed: untouched.

## Live quotes (2.5.0)
- `GET /api/quote?symbol=TSLA` (new, no database access) returns a live intraday quote for one symbol from Yahoo Finance's public chart endpoint, fetched server-side. The stock detail dialog calls it when a row or vault card is opened, shows price, change, intraday chart, previous close, day range and volume, and refreshes every 30 s while the tab is visible.
- **Fallback:** any failure (unknown symbol, timeout after 4 s, HTTP 429, bad payload, no network) returns `{ live: false }` with HTTP 200 and the dialog keeps the demo record. Tickers with digits (generated demo instruments such as WEST20) are never sent upstream. Results are cached 20 s per server instance (unknown symbols 5 min) to stay under rate limits.
- **Indicator:** green pulsing "LIVE - Market open", amber "Live quote - Market closed", or neutral "Demo data". Market open/closed is inferred from the age of the last trade.
- The table, ticker tape and vault stay on the demo dataset by design (no per-row upstream calls).
- Yahoo's endpoint is unofficial, may be delayed up to 15 minutes, and has its own terms of use. For production, swap `fetchYahoo()` in `api/quote.js` for a licensed provider (Alpha Vantage, Finnhub, Polygon) returning the same shape.
- `npm run test:quote` runs 18 offline tests (mocked network).

## Changelog
- 2.5.0 Live quote endpoint with demo fallback and live/demo indicator.
- 2.4.0 Drag/keyboard vault, row windowing, lighter skeletons.
- 2.3.0 Vault hover/click, detail dialog, mobile scroll fix, fewer DOM nodes.
- 2.2.0 Inline critical CSS, chunked row rendering, lighter paint/layout.
- 2.1.0 Performance pass, `vite preview` serves `/api/*` plus gzip/cache headers, lazy overview chunk.
- 2.0.0 Premium 3D UI, 50-100 rows per page with pagination, sort, `/api/featured`, word_similarity typo fallback, seed fixed to 1,801 rows, SSL fix for local Postgres.
- 1.0.0 Initial build.
