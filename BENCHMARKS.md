# Relevance Benchmark Suite

Run `npm run benchmark` (API must be running; `BASE_URL` defaults to http://localhost:3000).
Run it twice: **baseline** (set `SYNONYMS = {}` in `api/search.js`) and **tuned** (default). Results below were measured against real PostgreSQL 16 with the 1,801-row seed.

## 8 core queries
| # | Query | Expected #1 | Baseline | Tuned |
|---|---|---|---|---|
| 1 | Apple stock | AAPL | PASS (AAPL #1) | PASS (AAPL #1) |
| 2 | Tech ETF | XLK (Technology Select Sector SPDR Fund) | FAIL (ANCH13, ANCH32, ANCH5) | FAIL (ANCH71, ATLA53, BEAC23); known miss |
| 3 | Government Bonds | UST10Y (US 10-Year Treasury Bond) | TOP3 (UST10Y #2) | PASS (UST10Y #1) |
| 4 | Tesla shares | TSLA | PASS (TSLA #1) | PASS (TSLA #1) |
| 5 | Healthcare mutual fund | VGHCX (Vanguard Health Care Fund) | FAIL (ATLA31, ATLA49, BRID12) | PASS (VGHCX #1) |
| 6 | Green energy IPO | CTEI (CleanTech Energy IPO 2026) | PASS (CTEI #1) | PASS (CTEI #1) |
| 7 | S&P 500 index | SPY | PASS (SPY #1) | PASS (SPY #1) |
| 8 | Crypto ETF | BITO (Bitcoin Strategy ETF) | FAIL (ANCH13, ANCH32, ANCH5) | PASS (BITO #1) |

## 3 typo queries
| Query | Expected | Result |
|---|---|---|
| Apel | AAPL | PASS #1 (trigram fallback) |
| Teslas | TSLA | PASS #1 (stemming handles it) |
| Healtcare | VGHCX | PASS #1 (trigram fallback) |

## 2 zero-result edge cases
`XYZABC999`, `qqqzzzxxx000` both return 0 results (PASS) and show the empty state.

## Tuning levers applied
1. **Field weights:** A = ticker/title, B = category/sector, C = description (`schema.sql`).
2. **OR-joined, synonym-expanded query** (`expandQuery` in `api/search.js`): `tech→technology`, `crypto→bitcoin`, `green→renewable`, `shares→stock`, `government→treasury`, `healthcare→health care`. Without this, "Tech ETF" cannot reach XLK (Postgres stems "technology" to "technolog", which never equals "tech").
3. **Trigram fallback** only when full-text returns nothing.

## Summary
- **Baseline** (`SYNONYMS = {}`): top-1 7/11, top-3 8/11, zero-result 2/2.
- **Tuned**: top-1 10/11, top-3 10/11, zero-result 2/2.
- **Open issue:** "Tech ETF" still misses XLK, because many generated Technology ETFs tie or outrank it. A next step would be to boost exact sector+category matches or add `XLK`-style anchors to a curated ranking.
- The typo fallback now uses `word_similarity` (threshold 0.35) instead of `similarity`; plain `similarity` could not match "Apel" to "Apple Inc. Common Stock".

## Known caveat
~80 generated bonds are titled "... Treasury Note", so a bare query like "Treasury" returns many near-ties. The benchmark query "Government Bonds" is unaffected because only UST10Y mentions "government".

## Method note
Baseline and tuned runs hit the same handler through a local HTTP wrapper (no Vercel CLI); the baseline used a copy of `api/search.js` with `SYNONYMS = {}`. Timing is not reported because it was measured on a shared sandbox.
