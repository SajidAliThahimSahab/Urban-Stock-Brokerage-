import { useEffect, useState } from 'react';
import { searchInstruments } from '../services/api.js';

export function useSuggestions(query, enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || query.trim().length < 1) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setLoading(true);
    searchInstruments({ q: query, limit: 6 }, ctrl.signal)
      .then((res) => {
        setItems(res.results);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setItems([]);
          setLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [query, enabled]);
  return { items, loading };
}
