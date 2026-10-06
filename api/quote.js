// GET /api/quote?symbol=TSLA
//
// On-demand live quote for ONE symbol, used by the stock detail dialog.
// Source: Yahoo Finance's public chart endpoint (no API key), called from the
// server so the browser never hits CORS and the upstream URL stays private.
//
// It never throws at the client: any failure (bad symbol, unknown ticker,
// timeout, 429, malformed payload) returns HTTP 200 with { live: false, reason }
// and the UI keeps showing the demo record. The database is not touched.
//
// NOTE: this is an unofficial endpoint with no SLA and its own terms of use.
// For a production product swap fetchYahoo() for a licensed provider (e.g.
// Alpha Vantage, Finnhub, Polygon) behind the same response shape.

const UPSTREAM = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const TIMEOUT_MS = 4000;
const CACHE_MS = 20_000; // per server instance; protects against rate limits
const NEG_CACHE_MS = 5 * 60_000; // remember unknown symbols for a while
const MAX_CACHE = 200;

const cache = new Map(); // symbol -> { at, ttl, value }

// Demo tickers with digits (e.g. WEST20) are generated and don't exist on any
// exchange, so they are never sent upstream.
export function isLiveEligible(symbol) {
  return /^[A-Z][A-Z.\-]{0,9}$/.test(symbol);
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Pure: Yahoo chart payload -> our response shape (or null if unusable).
export function parseYahoo(json, symbol) {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta) return null;
  const price = num(meta.regularMarketPrice);
  const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  if (price === null || prev === null || prev === 0) return null;

  const closes = r.indicators?.quote?.[0]?.close || [];
  const times = r.timestamp || [];
  const series = [];
  for (let i = 0; i < closes.length; i += 1) {
    const c = num(closes[i]);
    if (c !== null) series.push([times[i] ?? i, +c.toFixed(4)]);
  }
  if (series.length < 2) return null;

  const change = price - prev;
  return {
    live: true,
    symbol,
    name: meta.longName || meta.shortName || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency: meta.currency || 'USD',
    marketState: marketState(meta, times),
    price: +price.toFixed(4),
    previousClose: +prev.toFixed(4),
    change: +change.toFixed(4),
    changePct: +((change / prev) * 100).toFixed(2),
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    asOf: num(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : null,
    series,
    source: 'Yahoo Finance',
  };
}

// The chart endpoint has no explicit state flag, so infer it: if the last
// regular-session trade is recent (< 20 min) the market is trading.
function marketState(meta, times) {
  const t = num(meta.regularMarketTime);
  const nowS = Date.now() / 1000;
  if (t !== null && nowS - t < 20 * 60) return 'open';
  void times;
  return 'closed';
}

async function fetchYahoo(symbol) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${UPSTREAM}${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UrbanBrokerageDemo/2.5)', Accept: 'application/json' },
    });
    if (res.status === 404) return { value: { live: false, reason: 'unknown-symbol' }, ttl: NEG_CACHE_MS };
    if (!res.ok) return { value: { live: false, reason: res.status === 429 ? 'rate-limited' : 'upstream-error' }, ttl: 15_000 };
    const parsed = parseYahoo(await res.json(), symbol);
    return parsed
      ? { value: parsed, ttl: CACHE_MS }
      : { value: { live: false, reason: 'no-data' }, ttl: NEG_CACHE_MS };
  } catch (err) {
    return { value: { live: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' }, ttl: 10_000 };
  } finally {
    clearTimeout(timer);
  }
}

export async function getQuote(symbol, now = Date.now()) {
  const hit = cache.get(symbol);
  if (hit && now - hit.at < hit.ttl) return hit.value;
  const { value, ttl } = await fetchYahoo(symbol);
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(symbol, { at: now, ttl, value });
  return value;
}

export function _clearCache() {
  cache.clear();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const symbol = String(req.query?.symbol ?? '').trim().toUpperCase();
  if (!isLiveEligible(symbol)) {
    res.status(200).json({ live: false, reason: 'not-listed' });
    return;
  }
  const quote = await getQuote(symbol);
  res.setHeader?.('Cache-Control', quote.live ? 'public, s-maxage=15, stale-while-revalidate=30' : 'public, s-maxage=60');
  res.status(200).json(quote);
}
