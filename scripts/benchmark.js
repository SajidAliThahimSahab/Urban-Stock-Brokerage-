// Run: BASE_URL=http://localhost:3000 npm run benchmark
// Fires the 8 core + 3 typo + 2 zero-result queries at the live API and
// reports top-1 and top-3 precision. Run once before tuning (set
// SYNONYMS = {} in api/search.js) and once after, then record both in
// BENCHMARKS.md.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const CORE = [
  ['Apple stock', 'AAPL'], ['Tech ETF', 'XLK'], ['Government Bonds', 'UST10Y'],
  ['Tesla shares', 'TSLA'], ['Healthcare mutual fund', 'VGHCX'],
  ['Green energy IPO', 'CTEI'], ['S&P 500 index', 'SPY'], ['Crypto ETF', 'BITO'],
];
const TYPO = [['Apel', 'AAPL'], ['Teslas', 'TSLA'], ['Healtcare', 'VGHCX']];
const ZERO = ['XYZABC999', 'qqqzzzxxx000'];

async function run(q) {
  const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=10`);
  if (!res.ok) throw new Error(`${q}: HTTP ${res.status}`);
  const start = performance.now();
  const data = await res.json();
  return { tickers: data.results.map((r) => r.ticker), mode: data.mode, ms: performance.now() - start };
}

let top1 = 0, top3 = 0, total = 0;
for (const [label, set] of [['CORE', CORE], ['TYPO', TYPO]]) {
  for (const [q, expected] of set) {
    const { tickers, mode } = await run(q);
    const hit1 = tickers[0] === expected;
    const hit3 = tickers.slice(0, 3).includes(expected);
    total += 1; if (hit1) top1 += 1; if (hit3) top3 += 1;
    console.log(`${hit1 ? 'PASS' : hit3 ? 'TOP3' : 'FAIL'}  [${label}] "${q}" -> expected ${expected}, got ${tickers.slice(0, 3).join(', ') || 'none'} (${mode})`);
  }
}
let zeroOk = 0;
for (const q of ZERO) {
  const { tickers, mode } = await run(q);
  const ok = tickers.length === 0;
  if (ok) zeroOk += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [ZERO] "${q}" -> ${tickers.length} results (${mode})`);
}
console.log(`\nTop-1 precision: ${top1}/${total}  |  Top-3 precision: ${top3}/${total}  |  Zero-result handled: ${zeroOk}/${ZERO.length}`);
