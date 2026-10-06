const BASE_URL = '/api';

function toQueryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

async function getJson(path, params, signal) {
  const qs = params ? toQueryString(params) : '';
  const response = await fetch(`${BASE_URL}/${path}${qs ? `?${qs}` : ''}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

/** @param {{q?,category?,sector?,riskLevel?,minPrice?,maxPrice?,page?,limit?,sort?}} params */
export const searchInstruments = (params, signal) => getJson('search', params, signal);
export const fetchFeatured = (signal) => getJson('featured', undefined, signal);

/** Live quote for one symbol. Always resolves; { live: false } means "use demo data". */
export async function fetchQuote(symbol, signal) {
  try {
    const res = await fetch(`${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}`, { signal });
    if (!res.ok) return { live: false, reason: 'http' };
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return { live: false, reason: 'network' };
  }
}
