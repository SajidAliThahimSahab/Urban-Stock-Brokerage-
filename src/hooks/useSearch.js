import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { searchInstruments } from '../services/api.js';

const filterKey = (f) => JSON.stringify(f);

/**
 * Fetches one page of results. Previous data stays on screen while the next
 * request is in flight (no layout jump). Page resets to 1 whenever the query,
 * filters, sort or page size change.
 */
export function useSearch({ query, filters, sort, pageSize }) {
  const signature = `${query}|${filterKey(filters)}|${sort}|${pageSize}`;
  const [state, setState] = useState({ signature, page: 1 });
  let page = state.page;
  if (state.signature !== signature) {
    // derived state during render: reset the page without an extra effect pass
    setState({ signature, page: 1 });
    page = 1;
  }
  const setPage = useCallback((p) => setState((s) => ({ ...s, page: p })), []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const controller = useRef(null);

  useEffect(() => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setLoading(true);
    setError(null);
    searchInstruments({ q: query, ...filters, sort, page, limit: pageSize }, ctrl.signal)
      .then((res) => {
        if (res.results.length === 0 && res.total > 0 && page > 1) {
          setPage(res.totalPages); // page overflow -> jump to last valid page
          return;
        }
        // Rendering 50-100 rows is non-urgent: let typing/clicks stay responsive.
        startTransition(() => setData(res));
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Something went wrong');
        setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterKey(filters), sort, pageSize, page, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, page, setPage, retry };
}
