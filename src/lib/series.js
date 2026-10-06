// Illustrative sparkline data. The database stores only a price and a daily
// change, not history, so we synthesise a deterministic path per ticker that
// ends consistent with the sign of its change. It is labelled as illustrative
// in the UI and must not be read as real price history.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pathCache = new Map();
/** Memoised SVG path for a ticker: rows re-render often, the maths shouldn't. */
export function sparkPath(ticker, change, w = 80, h = 24) {
  const key = `${ticker}|${Number(change) >= 0 ? 1 : 0}|${w}x${h}`;
  let p = pathCache.get(key);
  if (!p) {
    p = seriesPath(makeSeries(ticker, change), w, h);
    if (pathCache.size > 600) pathCache.clear();
    pathCache.set(key, p);
  }
  return p;
}

export function makeSeries(ticker, change, points = 24) {
  const rnd = mulberry32(hash(ticker));
  const drift = Math.sign(Number(change) || 0.01) * 0.6;
  let v = 50;
  const out = [];
  for (let i = 0; i < points; i += 1) {
    v += (rnd() - 0.5) * 8 + drift * (i / points) * 3;
    out.push(v);
  }
  return out;
}

export function seriesPath(values, w = 80, h = 24, pad = 2) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}
