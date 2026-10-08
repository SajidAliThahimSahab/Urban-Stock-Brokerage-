<div align="center">

# 📈 Urban Stock Brokerage

### Search, Typeahead, Filters & Relevance Tuning

**Week 4 Specialist Advanced Task** · PostgreSQL Full-Text Search · GIN Indexing · Trigram Typo Tolerance · Faceted Filtering · 1,801 deterministic financial records

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-FTS%20%2B%20pg__trgm-4169E1?logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)
![Relevance](https://img.shields.io/badge/Top--1%20precision-7%2F8-2FE6A8)
![Lighthouse](https://img.shields.io/badge/Lighthouse-Desktop%20100%2F99%20%C2%B7%20Mobile%2091--92-38D6FF)

[Summary](#1-executive-summary) · [Architecture](#2-architecture-and-tech-stack) · [Features](#3-core-features) · [Benchmark](#4-relevance-benchmark-and-tuning-report) · [Performance](#5-performance-optimization-evidence) · [Setup](#6-local-setup-and-deployment-guide) · [Reflections](#7-reflections-limitations-and-future-improvements) · [Changelog](#8-version-history)

</div>

---

## 1. Executive summary

This project is a search experience for a fictional urban stock brokerage. A user can type a ticker, a company name or a theme ("Tech ETF", "Crypto ETF", "Government Bonds"), get ranked results in a few hundred milliseconds, narrow them with filters, and open a detail view for any instrument.

What was built and measured:

| Area | Result |
|---|---|
| Dataset | 1,801 deterministic records: 334 Equities, 353 Bonds, 347 Mutual Funds, 376 ETFs, 391 IPOs; 12 sectors; prices $6.24 to $649.80 |
| Search engine | Weighted `tsvector` (A: ticker and title, B: category and sector, C: description) with a GIN index, ranked by `ts_rank_cd` |
| Typo tolerance | `pg_trgm` `word_similarity` fallback (threshold 0.35) with GIN trigram indexes |
| Relevance benchmark | 8 core queries: **7/8 top-1** (production) versus 4/8 for a naive engine. 3/3 typo queries and 2/2 zero-result queries handled. One honest miss: "Tech ETF" |
| Typeahead | 250 ms debounce, ARIA combobox, keyboard navigation, match highlighting, stale-request cancellation |
| Filters | Asset class, sector, risk level and price presets, combinable with search and sorting |
| Pagination | 50 or 100 rows per page, total count from the same query |
| Tests | 43 API checks (`npm run test:api`), 18 quote tests (`npm run test:quote`), a 13-query benchmark (`npm run benchmark`) |
| Lighthouse (Vercel deployment, navigation mode) | Desktop 100 / 99. Mobile 91 to 92 (see section 5 for what is and is not solved) |

## 2. Architecture and tech stack

```
Browser (React 18 + Vite 5 + Tailwind 3)
   |  fetch, 250 ms debounce, AbortController
   v
Vercel serverless functions (/api)
   |-- search.js    GET /api/search    full-text, typo fallback, filters, sort, pagination
   |-- featured.js  GET /api/featured  8 featured instruments + market stats
   '-- quote.js     GET /api/quote     optional live quote (no database)
   |  pg (connection pool)
   v
PostgreSQL 16 (Neon in production)
   financial_instruments + weighted tsvector trigger + GIN + trigram GIN + B-tree facet indexes
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18, Vite 5, Tailwind 3 | Fast builds, small bundles, utility CSS that is pruned at build time |
| API | Vercel-style serverless handlers (`api/*.js`) | One file per endpoint; query builders are pure functions, so placeholder and value alignment is unit-tested without a database |
| Database | PostgreSQL full-text search plus `pg_trgm` | Ranking, stemming and typo tolerance without an external search service |
| Local dev | Vite middleware serves `/api/*` for both `npm run dev` and `npm run preview` | No Vercel CLI needed |

Project layout:

```
api/                 search.js, featured.js, quote.js
src/db/              schema.sql, seed.js, generator.js, pool.js, runSchema.js
src/hooks/           useSearch, useSuggestions, useFeatured, useDebounce, useMedia
src/components/      SearchBar, FilterSidebar, ResultsTable, Pagination, Vault3D, StockDetail, ...
src/lib/             formatting, pagination math, deterministic illustrative sparklines
scripts/             verify-api.js, verify-quote.js, benchmark.js
BENCHMARKS.md        the benchmark write-up (same numbers as section 4 below)
```

## 3. Core features

### 3.1 Debounced typeahead with keyboard navigation and match highlighting
- 250 ms debounce (`useDebounce`), as specified in the task brief. Typing does not re-render the result rows.
- Suggestions (6 at a time) come from the same `/api/search` endpoint. Stale requests are aborted with `AbortController`.
- ARIA combobox pattern: Arrow Up/Down move through suggestions, Enter selects, Escape closes, `/` focuses the search box from anywhere.
- `HighlightMatch` highlights the matched terms in both the ticker and the title.
- A "did you mean" notice is shown when the typo fallback answered the query.
- Loading bar and skeleton rows while fetching, an empty state for no results, and an error state with a Retry button.

### 3.2 Multi-faceted filtering
- **Asset class** (Equities, Bonds, Mutual Funds, ETFs, IPOs), **sector** (12 values), **risk level** (Low, Medium, High) and **price presets** (Under $25, $25 to $100, $100 to $500, $500+).
- Filters combine with each other and with the search text. They are applied by one shared, parameterised `WHERE` fragment, so every search stage behaves identically.
- Removable active-filter chips; a drawer with focus trap on mobile.
- Sorting: relevance, ticker, name, price (both directions), change % (both directions). Sort keys come from a whitelist and are never interpolated from user input.
- B-tree indexes on category, sector, risk level and price back the facets.

### 3.3 Weighted `tsvector` and `pg_trgm` similarity
Two mechanisms are used on purpose, because they solve different problems:

1. **Full-text search (stemming, stopwords, ranking).** A trigger builds `search_vector` on insert and update:
   - weight **A**: ticker and title (identity matches rank highest)
   - weight **B**: category and sector (so "tech ETF" prefers an ETF in the Technology sector)
   - weight **C**: description (searchable, but cannot outrank an A or B match)

   The query is `websearch_to_tsquery` over an OR-joined, synonym-expanded string, ranked by `ts_rank_cd`. A GIN index covers `search_vector`.
2. **Typo tolerance (trigrams).** `tsquery` only stems; it cannot repair a misspelling. When full-text search returns nothing, the API re-runs the query with `GREATEST(word_similarity(q, ticker), word_similarity(q, title)) >= 0.35`. `word_similarity` is used rather than `similarity` because "Apel" against the whole title "Apple Inc. Common Stock" scores only 0.08 with `similarity`, but 0.40 with `word_similarity`.

The response carries a `mode` field: `browse`, `fulltext`, `typo-fallback` or `no-results`.

### 3.4 Other features
- **Row windowing:** only the rows near the viewport are in the DOM; fixed-height rows plus spacer rows keep `aria-rowcount` and `aria-rowindex` correct.
- **3D featured vault:** a CSS-3D carousel of 8 instruments, sorted A to Z, with auto-play, drag, arrow-key control and click-to-open details. It uses only the seeded demo data.
- **Stock detail dialog:** opens from a table row or a vault card, with focus trap and Esc to close. It can show a live quote (section 7) and always falls back to the demo record.

## 4. Relevance benchmark and tuning report

All numbers below were measured against a real PostgreSQL 16 instance loaded with the 1,801-row seed. Re-run them with `npm run benchmark` (see section 6).

### 4.1 The 8 core benchmark queries (expected versus actual, production configuration)

| # | Query | Expected #1 | Actual top 3 | Result |
|---|---|---|---|---|
| 1 | Apple stock | AAPL | AAPL, MSFT, NVDA | PASS (#1) |
| 2 | Tech ETF | XLK | ANCH71, ATLA53, BEAC23 | **FAIL** (XLK is #22 of 667 matches) |
| 3 | Government Bonds | UST10Y | UST10Y, MUB30, ANCH20 | PASS (#1) |
| 4 | Tesla shares | TSLA | TSLA, AAPL, MSFT | PASS (#1) |
| 5 | Healthcare mutual fund | VGHCX | VGHCX, ATLA31, ATLA49 | PASS (#1) |
| 6 | Green energy IPO | CTEI | CTEI, NRGX, ANCH34 | PASS (#1) |
| 7 | S&P 500 index | SPY | SPY, FSKAX, ANCH51 | PASS (#1) |
| 8 | Crypto ETF | BITO | BITO, ANCH13, ANCH32 | PASS (#1) |

**Top-1 precision: 7/8 (87.5%). Top-3 precision: 7/8.** Across all 13 benchmark queries (8 core, 3 typo, 2 zero-result), the benchmark script reports top-1 10/11 and zero-result handling 2/2.

### 4.2 Before and after tuning matrix

Four configurations were run through the same ranking query. Each row shows where the expected instrument landed ("@1" means rank 1, "-" means it did not appear in the top 10, "none" means the engine returned no rows).

| Query (expected) | C0 Naive: raw AND query, flat weights | C1 OR-joined, flat weights | C2 OR-joined + field weights (A/B/C) | C3 Production: C2 + synonyms |
|---|---|---|---|---|
| Apple stock (AAPL) | @1 | @1 | @1 | @1 |
| Tech ETF (XLK) | none | - | - | - (miss) |
| Government Bonds (UST10Y) | @1 | @2 | @2 | **@1** |
| Tesla shares (TSLA) | none | @1 | @1 | @1 |
| Healthcare mutual fund (VGHCX) | @1 | - | - | **@1** |
| Green energy IPO (CTEI) | none | @6 | **@1** | @1 |
| S&P 500 index (SPY) | @1 | @1 | @1 | @1 |
| Crypto ETF (BITO) | none | - | - | **@1** |
| **Top-1 precision** | 4/8 | 3/8 | 4/8 | **7/8** |
| **Top-3 precision** | 4/8 | 4/8 | 5/8 | **7/8** |

Reading the matrix:
- **C0 to C1 (OR-joining the terms).** A plain AND query returns nothing as soon as one word is not in the record ("Tesla shares" has no "shares" in TSLA's record). OR-joining fixes recall, but with flat weights the extra recall lets noise outrank the right answer, so top-1 dips from 4/8 to 3/8.
- **C1 to C2 (field weights).** Weighting ticker and title above category and sector above description moves "Green energy IPO" from rank 6 to rank 1 and lifts top-3 from 4/8 to 5/8.
- **C2 to C3 (synonym expansion).** This is the largest gain, from 4/8 to 7/8 top-1. Postgres stems "technology" to "technolog", which never equals "tech", so "Tech ETF", "Crypto ETF" and "Healthcare mutual fund" cannot reach their targets without a synonym map. The map is small and explicit: `tech -> technology`, `shares -> stock`, `crypto -> bitcoin`, `green -> renewable`, `government -> government treasury`, `healthcare -> healthcare health care`.

### 4.3 Typo queries (3)

| Query | Expected | Actual | Mode | How it works |
|---|---|---|---|---|
| Apel | AAPL | AAPL (1 result) | `typo-fallback` | Full-text finds nothing; `word_similarity("Apel", "Apple Inc. Common Stock")` = 0.40, above the 0.35 threshold |
| Healtcare | VGHCX | VGHCX (1 result) | `typo-fallback` | Same fallback path; the misspelled word shares most trigrams with "Health Care" |
| Teslas | TSLA | TSLA (1 result) | `fulltext` | No fallback needed: the English stemmer reduces "teslas" to "tesla" |

### 4.4 Zero-result queries (2)

| Query | Results | Mode | Behaviour |
|---|---|---|---|
| `XYZABC999` | 0 | `no-results` | Full-text finds nothing, trigram fallback finds nothing above 0.35, the UI shows its empty state |
| `qqqzzzxxx000` | 0 | `no-results` | Same path; no false positives from the trigram stage |

### 4.5 Known miss and what would fix it
"Tech ETF" does not return XLK first. About 667 records match at least one of "technology" or "etf", and many generated Technology ETFs tie or outrank XLK. Options for a next iteration: boost records that match both the sector and the category, add a curated "anchor" boost for well-known tickers, or switch from OR to a hybrid (AND first, OR as fallback). It was left as a documented miss rather than hard-coding XLK.

## 5. Performance optimization evidence

**Where things stand.** On the Vercel deployment, Lighthouse in navigation mode reports desktop 100 / 99 and mobile 91 to 92. Mobile stays above 90, but Lighthouse still lists "Minimize main-thread work" on mobile, so this is not fully eliminated. The remaining cost is mostly React 18 itself, hydrating the first screen and laying out the table under Lighthouse's 4x mobile CPU slowdown.

What was done, grouped by the three areas that matter:

### Bundle size
- `NODE_ENV` forced to production, `console` and `debugger` dropped, esbuild and CSS minification.
- The overview (vault and stats) and the detail dialog are lazy chunks (`React.lazy`), loaded after first paint.
- Tailwind `corePlugins` pruned: filter, backdrop, scroll-snap, skew and font-variant-numeric utilities are disabled because the app does not use them. This removes the large universal `--tw-*` variable block that every element would otherwise resolve.
- Result in a local production bundle (Bun, not Vite): main JS about 55 KB gzip, CSS about 24 KB raw (about 6 KB gzip).

### Layout shift
- Critical CSS is inlined into `index.html` by a build plugin, so no stylesheet blocks first paint.
- Fonts load without blocking (`display=optional`) with metric-matched fallbacks.
- Lazy sections are replaced by same-size skeletons while loading.
- Measured cumulative layout shift in headless Chromium: **0**.

### Main-thread work
- **Row windowing:** DOM nodes on load dropped from about 1,260 to about 510. Rows have a fixed 57 px height and `table-layout: fixed`.
- **No forced reflow:** the window used to call `getBoundingClientRect` on every scroll frame, and the vault used a `ResizeObserver` that wrote CSS variables. The row window now reads geometry from `IntersectionObserver` entries, and the vault radius is pure CSS (`clamp()` with container-query units). The mouse-tilt rectangle is read once, inside a `pointerenter` handler. In instrumented runs the page performed 0 geometry reads on mobile and 1 on desktop during load and scrolling.
- Rows, toolbar, pagination and filters are `memo`ised; results render inside `startTransition`; sparkline paths are cached; skeletons pulse as a single layer.
- Local measurements (Chromium, 4x CPU throttle, 390 px viewport): about 13 to 15 layout passes for load plus a long scroll, no layout shift, and no page errors.

**Honest limits.** Lighthouse and `vite build` were not run in the development sandbox. The Lighthouse scores above are from the deployed site, and local numbers are from a Bun bundle in headless Chromium, so they are noisy and are evidence of direction, not a replacement for a Lighthouse report. Run Lighthouse in an Incognito window with extensions disabled (extensions such as PDF viewers add their own scripts to the report).

## 6. Local setup and deployment guide

### Prerequisites
Node.js 20 or newer and a PostgreSQL 13+ database that supports the `pg_trgm` extension (local Postgres, Neon, Supabase or Vercel Postgres all do).

### Steps
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure the environment.** Copy `.env.example` to `.env` and set your connection string:
   ```bash
   cp .env.example .env
   # DATABASE_URL=postgres://user:password@localhost:5432/urban_brokerage
   ```
   For Neon use the pooled string with `?sslmode=require`. Do not commit `.env`.
3. **Create the schema.** This creates the extension, the table, the weighted-vector trigger, the GIN index, the two trigram GIN indexes and the four B-tree facet indexes:
   ```bash
   npm run db:schema
   ```
4. **Seed the data.** This inserts the 1,801 deterministic records (a seeded generator, so every run produces the same dataset and the benchmark stays reproducible):
   ```bash
   npm run db:seed
   ```
5. **Run the app.** Vite serves the UI and the `/api/*` handlers on one port:
   ```bash
   npm run dev                      # development
   npm run build && npm run preview # production build, served with gzip and cache headers
   ```
6. **Verify.**
   ```bash
   npm run test:api     # 43 API checks (needs DATABASE_URL)
   npm run test:quote   # 18 offline quote tests (mocked network)
   BASE_URL=http://localhost:5173 npm run benchmark   # the 13-query relevance suite
   ```

### API reference
`GET /api/search?q=&category=&sector=&riskLevel=&minPrice=&maxPrice=&page=1&limit=50&sort=`
- `limit` is 1 to 100 (default 50). `sort`: `relevance | ticker | name | price_asc | price_desc | change_desc | change_asc`.
- Response: `{ results, total, page, pageSize, totalPages, mode, query, sort }`.

`GET /api/featured` returns `{ featured[8], stats }`. `GET /api/quote?symbol=TSLA` returns a live quote or `{ live: false }`.

### Deploying to Vercel
1. Push the repository to GitHub and import it in Vercel (framework preset: Vite).
2. Add the environment variable `DATABASE_URL` (Project Settings, Environment Variables) for Production and Preview, using the same connection string as in `.env`.
3. Run `npm run db:schema` and `npm run db:seed` once against that database from your machine (the seed is not run by the deployment).
4. Deploy. `vercel.json` rewrites `/api/*` to the serverless functions, rewrites everything else to `index.html`, and gives `/assets/*` immutable cache headers.

## 7. Reflections, limitations and future improvements

### What I learned
- **Full-text search is not fuzzy search.** Stemming, synonyms and typo tolerance are three separate problems, and each needed its own mechanism. Measuring them separately (the C0 to C3 matrix) made it obvious which lever produced which gain.
- **Recall and precision pull against each other.** OR-joining the query helped recall but initially hurt top-1; field weights and synonyms are what turned the extra recall into correct ranking.
- **Measure before and after.** Several "obvious" performance ideas (for example scroll handlers that read layout) were the actual source of forced reflow, and the fix was to stop reading layout rather than to read it faster.
- **Pure functions make query code testable.** Because the SQL builders take parameters and return `{ text, values }`, the 43 API checks catch placeholder misalignment without mocking a database.

### Limitations
- **Live quotes use an unofficial endpoint.** `/api/quote` calls Yahoo Finance's public chart endpoint from the server. It is unofficial, may be delayed up to 15 minutes, can be rate-limited (HTTP 429) and has its own terms of use. Any failure returns `{ live: false }` and the UI keeps the demo record and shows a "Demo data" badge. Tickers containing digits (generated demo instruments) are never sent upstream. For production, swap `fetchYahoo()` for a licensed provider (Alpha Vantage, Finnhub, Polygon).
- **Prices and sparklines are sample data.** The table, ticker tape and vault use the seeded dataset; trend lines are generated per ticker and are illustrative. The database stores no price history.
- **"Tech ETF" misses XLK** (section 4.5), and about 80 generated bonds are titled "... Treasury Note", so a bare "Treasury" query returns many near-ties.
- **The GIN indexes are not used at this size.** With 1,801 rows, the planner chooses a sequential scan (cost about 236), which is correct and fast. The indexes are there for scale. The trigram fallback calls `word_similarity()` as a function, which scans sequentially; for a much larger table it should switch to the `<%` operator so the trigram GIN indexes can serve it.
- **Mobile Lighthouse is 91 to 92, not 100.** See section 5.
- Browser find-in-page only sees rendered (windowed) rows.

### Future improvements
1. Fix the "Tech ETF" miss with a sector-plus-category boost or an AND-first, OR-fallback hybrid, and add it to the benchmark as a regression test.
2. Replace the static synonym map with a `synonym` thesaurus dictionary in Postgres so the vocabulary can be edited without a deploy.
3. Add prefix matching (`:*`) to the typeahead so "micro" suggests Microsoft before the user finishes typing.
4. Move the typo fallback to the `<%` operator and add `EXPLAIN ANALYZE` checks once the dataset is much larger.
5. Record per-query latency in CI (the benchmark currently reports precision only, because timing from a shared sandbox is not reliable).
6. Reduce mobile main-thread time further: render fewer initial rows, defer the vault until it scrolls into view, and run Lighthouse in CI with a performance budget.
7. Integrate a licensed market-data provider and cache quotes at the edge.

## 8. Version history

<details>
<summary><b>Click to expand the full changelog (1.0.0 to 2.6.0)</b></summary>

| Version | What changed |
|---|---|
| **2.6.0** | Forced-reflow fix (IntersectionObserver row window, CSS-only vault radius, one cached tilt read), pruned Tailwind core plugins, vault auto-plays A to Z (pauses on hover, focus, drag), demo-data-only vault |
| **2.5.0** | `/api/quote` live endpoint with demo fallback and a live/demo indicator in the detail dialog |
| **2.4.0** | Drag, fling and keyboard vault (buttons removed), row windowing (about 1,260 to 510 DOM nodes), single-layer skeleton pulse |
| **2.3.0** | Vault hover and click, stock detail dialog, mobile scroll fix (no inner scroller), `display=optional` fonts, fewer DOM nodes on phones |
| **2.2.0** | Inline critical CSS, chunked row rendering, lighter paint and layout. Measured (4x CPU, mobile): total blocking time about 300 ms to 25 ms, layout 283 to 148 ms, style recalculation 146 to 49 ms |
| **2.1.0** | Production defines and minification, lazy overview chunk, `vite preview` serves `/api/*` plus gzip and cache headers. Measured: JS 163 KB raw / 54 KB gzip, CSS 24 KB / 6 KB gzip, CLS 0 |
| **2.0.0** | Premium 3D UI, 50 to 100 rows per page with pagination, sort, `/api/featured`, `word_similarity` typo fallback, seed fixed to 1,801 rows, SSL fix for local Postgres |
| **1.0.0** | Initial build |

</details>

### Detail dialog and vault behaviour (current)
- **Vault:** sorted A to Z, auto-plays every 2 s. Auto-play pauses on hover, focus or drag, and resumes shortly after. Press and drag (mouse, pen or touch) to rotate; release flings and snaps to the nearest card. Focus it and use Left/Right arrows; Enter or a click on the front card opens details; clicking a side card brings it forward. `touch-action: pan-y` keeps vertical swipes scrolling the page on phones. Reduced-motion users get no auto-play.
- **Stock detail dialog** (lazy chunk): opens from the vault and from any table row. Esc closes; focus is trapped and restored. A missing description is loaded through `/api/search`, so no backend change was needed.
- **Mobile scroll fix:** the results table has no inner scroll container (it trapped touch scrolling); the page scrolls natively and the sticky header uses `overflow: clip`.
- **Fonts** use `display=optional` (no swap-induced relayout). On a first uncached visit the metric-matched fallback fonts show; change `optional` to `swap` in `index.html` to restore the swap.

### Running Lighthouse correctly
Audit only the production build, in an Incognito window with extensions off:

```bash
npm run build && npm run preview   # then open http://localhost:4173
```

Auditing `npm run dev` shows `react-dom.development.js`, unminified CSS and every `src/*.jsx` file, and Chrome extensions (for example Adobe Acrobat) add their own scripts to the report. Neither is in the production bundle. `npm run preview` serves gzip and immutable cache headers for `/assets/*`, like Vercel does.

### Live quotes (`/api/quote`)
- `GET /api/quote?symbol=TSLA` (no database access) returns a live intraday quote from Yahoo Finance's public chart endpoint, fetched server-side. The dialog shows price, change, intraday chart, previous close, day range and volume, and refreshes every 30 s while the tab is visible.
- **Fallback:** any failure (unknown symbol, 4 s timeout, HTTP 429, bad payload, no network) returns `{ live: false }` with HTTP 200 and the dialog keeps the demo record. Tickers with digits (generated instruments such as WEST20) are never sent upstream. Results are cached 20 s per server instance (unknown symbols 5 min).
- **Indicator:** green pulsing "LIVE - Market open", amber "Live quote - Market closed", or neutral "Demo data". Open or closed is inferred from the age of the last trade.
- The table, ticker tape and vault stay on the demo dataset by design.

---

## Notes on the dataset
Seed data is deterministic and clearly fictional apart from a small set of well-known anchor tickers (AAPL, TSLA, MSFT, NVDA, SPY and others) used by the benchmark. The seed produces exactly 1,801 rows; an earlier generator lost five rows to de-duplication and was corrected. Nothing in this repository is investment advice.

---

<div align="center">

Built by **Sajid Ali Thahim** · SDC Internship · Week 4 Specialist Advanced Task · Field **Web Development**

</div>
