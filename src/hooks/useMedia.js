import { useSyncExternalStore } from 'react';

// Lets the table skip rendering columns that CSS would only hide: fewer DOM
// nodes means less style/layout work on phones.
export function useMedia(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
