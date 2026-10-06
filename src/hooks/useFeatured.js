import { useEffect, useState } from 'react';
import { fetchFeatured } from '../services/api.js';

export function useFeatured() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchFeatured(ctrl.signal)
      .then((data) => setState({ data, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState({ data: null, error: e.message }));
    return () => ctrl.abort();
  }, []);
  return state;
}
