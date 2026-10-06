// Offline tests for api/quote.js: no network and no database needed.
//   node scripts/verify-quote.js
import handler, { getQuote, isLiveEligible, parseYahoo, _clearCache } from '../api/quote.js';

let pass = 0;
let fail = 0;
const ok = (c, m) => { if (c) { pass += 1; console.log(`  ok   ${m}`); } else { fail += 1; console.log(`  FAIL ${m}`); } };

const nowS = Math.floor(Date.now() / 1000);
const payload = (over = {}) => ({
  chart: { result: [{
    meta: { symbol: 'TSLA', longName: 'Tesla, Inc.', fullExchangeName: 'NasdaqGS', currency: 'USD', regularMarketPrice: 250.5, chartPreviousClose: 245, regularMarketTime: nowS - 60, regularMarketDayHigh: 252, regularMarketDayLow: 244, regularMarketVolume: 1234567, ...over },
    timestamp: [1, 2, 3, 4],
    indicators: { quote: [{ close: [245.1, null, 249.9, 250.5] }] },
  }], error: null },
});

const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; }, setHeader() {} }; return r; };
const realFetch = globalThis.fetch;
const mockFetch = (fn) => { globalThis.fetch = fn; _clearCache(); };

console.log('eligibility');
ok(isLiveEligible('TSLA') && isLiveEligible('BRK-B') && isLiveEligible('BF.B'), 'real-looking tickers pass');
ok(!isLiveEligible('WEST20') && !isLiveEligible('') && !isLiveEligible('../etc') && !isLiveEligible('TSLA;DROP'), 'generated / hostile symbols are rejected');

console.log('parse');
const p = parseYahoo(payload(), 'TSLA');
ok(p && p.live && p.price === 250.5 && p.previousClose === 245, 'price and previous close');
ok(p.change === 5.5 && p.changePct === 2.24, 'change and percent computed');
ok(p.series.length === 3, 'null closes dropped from series');
ok(p.marketState === 'open', 'recent trade -> open');
ok(parseYahoo(payload({ regularMarketTime: nowS - 3 * 3600 }), 'TSLA').marketState === 'closed', 'old trade -> closed');
ok(parseYahoo({ chart: { result: null, error: { code: 'Not Found' } } }, 'X') === null, 'error payload -> null');
ok(parseYahoo(payload({ regularMarketPrice: 'abc' }), 'X') === null, 'garbage price -> null');

console.log('handler + fallback');
mockFetch(async () => ({ ok: true, status: 200, json: async () => payload() }));
let r = res(); await handler({ method: 'GET', query: { symbol: 'tsla' } }, r);
ok(r.code === 200 && r.body.live === true && r.body.symbol === 'TSLA', 'live quote returned (lower-case input normalised)');

let calls = 0;
mockFetch(async () => { calls += 1; return { ok: true, status: 200, json: async () => payload() }; });
await getQuote('AAPL'); await getQuote('AAPL');
ok(calls === 1, 'second request served from cache');

mockFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
r = res(); await handler({ method: 'GET', query: { symbol: 'MSFT' } }, r);
ok(r.code === 200 && r.body.live === false && r.body.reason === 'rate-limited', '429 -> graceful fallback, HTTP 200');

mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
r = res(); await handler({ method: 'GET', query: { symbol: 'ZZZZ' } }, r);
ok(r.body.live === false && r.body.reason === 'unknown-symbol', '404 -> unknown-symbol');

mockFetch(async () => { throw new Error('ECONNREFUSED'); });
r = res(); await handler({ method: 'GET', query: { symbol: 'NVDA' } }, r);
ok(r.code === 200 && r.body.live === false && r.body.reason === 'network', 'network error -> fallback');

mockFetch(async (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))));
r = res(); await handler({ method: 'GET', query: { symbol: 'SPY' } }, r);
ok(r.body.live === false && r.body.reason === 'timeout', 'hang -> timeout fallback (4 s)');

mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: {} }] } }) }));
r = res(); await handler({ method: 'GET', query: { symbol: 'JPM' } }, r);
ok(r.body.live === false && r.body.reason === 'no-data', 'malformed payload -> fallback');

let called = false;
mockFetch(async () => { called = true; return { ok: true, json: async () => payload() }; });
r = res(); await handler({ method: 'GET', query: { symbol: 'WEST20' } }, r);
ok(!called && r.body.live === false, 'generated tickers never hit upstream');
r = res(); await handler({ method: 'POST', query: {} }, r);
ok(r.code === 405, 'non-GET rejected');

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
