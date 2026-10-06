import { memo, useEffect, useRef, useState } from 'react';
import { RISK_CLASS, formatChange, formatPrice, toneClass } from '../lib/format.js';
import { sparkPath } from '../lib/series.js';
import { useMedia } from '../hooks/useMedia.js';
import HighlightMatch from './HighlightMatch.jsx';

const EMPTY = [];
// Row windowing. Rows have a fixed height, so only the ones near the viewport
// are in the DOM; spacer rows stand in for the rest. The page scrolls natively
// (no inner scroll container), the window just follows window.scrollY.
const ROW_H = 57; // px, matches the fixed row height class below
const OVERSCAN = 6;
const INITIAL = 14;

// Geometry comes from IntersectionObserver entries (computed by the browser during its
// normal rendering step), so JS never reads layout here: no forced reflow. The rendered
// rows are observed; whenever one crosses the margin the window is recomputed from that
// row's reported rect and its index.
const MARGIN = ROW_H * 6;

function useRowWindow(count, tbodyRef) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, INITIAL) });
  useEffect(() => {
    const el = tbodyRef.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      setRange((r) => (r.end === count ? r : { start: 0, end: count }));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        const ri = Number(entry.target.dataset.ri);
        const top = entry.boundingClientRect.top - ri * ROW_H; // viewport-relative top of the first row
        const vh = entry.rootBounds ? entry.rootBounds.height - 2 * MARGIN : 800;
        const first = Math.max(0, Math.floor(-top / ROW_H) - OVERSCAN);
        const last = Math.min(count, Math.ceil((vh - top) / ROW_H) + OVERSCAN);
        // Snap to blocks of 4 rows so small scrolls don't re-render.
        const start = Math.floor(first / 4) * 4;
        const end = Math.min(count, Math.ceil(last / 4) * 4);
        setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
      },
      { rootMargin: `${MARGIN}px 0px ${MARGIN}px 0px` },
    );
    el.querySelectorAll('tr[data-ri]').forEach((tr) => io.observe(tr));
    return () => io.disconnect();
  }, [count, range.start, range.end, tbodyRef]);
  return { start: Math.min(range.start, count), end: Math.min(Math.max(range.end, Math.min(count, INITIAL)), count) };
}

function SkeletonRows({ count }) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={i} className="border-t border-line" aria-hidden="true">
      <td className="px-2 py-3 sm:px-3"><div className="skeleton h-4 w-5" /></td>
      <td className="px-2 py-3 sm:px-3"><div className="skeleton h-8 w-full max-w-[12rem]" /></td>
      <td className="px-2 py-3 sm:px-3"><div className="skeleton ml-auto h-4 w-16" /></td>
      <td className="px-2 py-3 sm:px-3"><div className="skeleton ml-auto h-4 w-12" /></td>
    </tr>
  ));
}

const Row = memo(function Row({ r, ri, index, query, onOpen, wide, mid }) {
  return (
    <tr className="h-[57px] cursor-pointer border-t border-line hover:bg-white/[0.04]" data-ri={ri} aria-rowindex={index + 1} onClick={() => onOpen(r)}>
      <td className="px-2 py-2.5 font-mono text-xs text-dim sm:px-3">{index}</td>
      <td className="px-2 py-2.5 sm:px-3">
        <div className="flex items-center gap-3">
          {mid && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5 font-mono text-[10px] font-semibold" aria-hidden="true">
              {r.ticker.slice(0, 4)}
            </span>
          )}
          <button type="button" className="min-w-0 flex-1 text-left" onClick={(e) => { e.stopPropagation(); onOpen(r); }} aria-label={`View details for ${r.ticker}, ${r.title}`}>
            <span className="block truncate font-medium text-ink">
              <span className="font-mono"><HighlightMatch text={r.ticker} query={query} /></span>
              <span className="px-1.5 text-dim">·</span>
              <HighlightMatch text={r.title} query={query} />
            </span>
            <span className="block truncate text-xs text-mute">{r.category} · {r.sector}</span>
          </button>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-[13px] sm:px-3 sm:text-sm">{formatPrice(r.price)}</td>
      <td className={`px-2 py-2.5 text-right font-mono text-[13px] sm:px-3 sm:text-sm ${toneClass(r.change_pct)}`}>{formatChange(r.change_pct)}</td>
      {wide && (
        <td className="px-3 py-2.5">
          <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true">
            <path d={sparkPath(r.ticker, r.change_pct)} fill="none" stroke={Number(r.change_pct) >= 0 ? '#2FE6A8' : '#FF6B86'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </td>
      )}
      {mid && (
        <td className="px-3 py-2.5">
          <span className={`rounded-full border px-2 py-0.5 text-xs ${RISK_CLASS[r.risk_level]}`}>{r.risk_level}</span>
        </td>
      )}
    </tr>
  );
});

function ResultsTable({ data, loading, query, onOpen }) {
  const rows = data?.results || EMPTY;
  const tbodyRef = useRef(null);
  const { start, end } = useRowWindow(rows.length, tbodyRef);
  const mid = useMedia('(min-width: 640px)');
  const wide = useMedia('(min-width: 768px)');
  const offset = data ? (data.page - 1) * data.pageSize : 0;
  const busy = loading && data;
  return (
    <div className="glass relative overflow-clip rounded-2xl" id="results">
      {busy && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-volt/10" role="progressbar" aria-label="Loading results">
          <div className="h-full w-1/3 animate-indeterminate bg-volt" />
        </div>
      )}
      {/* No inner scroll container: the page itself scrolls, so touch scrolling never gets trapped inside the table. */}
      <table aria-rowcount={rows.length ? offset + rows.length + 1 : undefined} className={`w-full table-fixed border-collapse text-sm ${busy ? 'opacity-50' : ''}`}>
        <caption className="sr-only">Financial instruments matching your search. Select a row for details.</caption>
        <colgroup>
          <col className="w-9 sm:w-11" />
          <col />
          <col className="w-[5.5rem] sm:w-28" />
          <col className="w-[4.5rem] sm:w-24" />
          {wide && <col className="w-24" />}
          {mid && <col className="w-20" />}
        </colgroup>
        <thead className="sticky top-14 z-10 bg-navy-900 text-left text-xs uppercase tracking-wider text-dim">
          <tr>
            <th scope="col" className="px-2 py-3 font-medium sm:px-3">#</th>
            <th scope="col" className="px-2 py-3 font-medium sm:px-3">Instrument</th>
            <th scope="col" className="px-2 py-3 text-right font-medium sm:px-3">Price</th>
            <th scope="col" className="px-2 py-3 text-right font-medium sm:px-3">Chg</th>
            {wide && <th scope="col" className="px-3 py-3 font-medium">Trend*</th>}
            {mid && <th scope="col" className="px-3 py-3 font-medium">Risk</th>}
          </tr>
        </thead>
        <tbody ref={tbodyRef} className={data ? '' : 'animate-pulse'}>
          {!data && <SkeletonRows count={8} />}
          {start > 0 && <tr aria-hidden="true" style={{ height: start * ROW_H }} />}
          {rows.slice(start, end).map((r, i) => (
            <Row key={r.id} r={r} ri={start + i} index={offset + start + i + 1} query={query} onOpen={onOpen} wide={wide} mid={mid} />
          ))}
          {end < rows.length && <tr aria-hidden="true" style={{ height: (rows.length - end) * ROW_H }} />}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2 text-[11px] text-dim">*Trend lines are illustrative, generated from the demo dataset. Prices are sample data, not live quotes.</p>
    </div>
  );
}

export default memo(ResultsTable);
