import { memo } from 'react';
import { SORT_OPTIONS, formatInt } from '../lib/format.js';

function Toolbar({ data, loading, sort, onSort, pageSize, onPageSize, onOpenFilters, filterCount }) {
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-ink" aria-live="polite" role="status">
          {data ? (
            data.total ? <>Showing <span className="font-mono">{formatInt(from)}-{formatInt(to)}</span> of <span className="font-mono">{formatInt(data.total)}</span> instruments</> : 'No instruments found'
          ) : 'Loading instruments…'}
        </p>
        {data?.mode === 'typo-fallback' && <p className="text-xs text-amber">No exact match. Showing close matches for “{data.query}”.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn lg:hidden" onClick={onOpenFilters}>
          Filters{filterCount ? ` (${filterCount})` : ''}
        </button>
        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select id="sort" value={sort} onChange={(e) => onSort(e.target.value)} className="rounded-lg border border-line bg-navy-900 px-3 py-2 text-sm text-ink">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Rows per page">
          {[50, 100].map((n) => (
            <button key={n} type="button" aria-pressed={pageSize === n} onClick={() => onPageSize(n)}
              className="px-3 py-2 font-mono text-xs text-mute hover:text-ink aria-pressed:bg-volt/15 aria-pressed:text-volt-soft">{n}</button>
          ))}
        </div>
      </div>
      {loading && <span className="sr-only">Updating results</span>}
    </div>
  );
}

export default memo(Toolbar);
