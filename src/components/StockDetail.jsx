import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_DOT, RISK_CLASS, formatChange, formatPrice, toneClass } from '../lib/format.js';
import { sparkPath } from '../lib/series.js';
import { fetchQuote, searchInstruments } from '../services/api.js';

const REFRESH_MS = 30_000;
// Same rule as the server: generated demo tickers (WEST20, ...) contain digits and are never looked up.
const liveEligible = (t) => /^[A-Z][A-Z.\-]{0,9}$/.test(t);

function Fact({ label, children }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

function money(n, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return formatPrice(n);
  }
}

// Scales the live intraday closes (and the previous-close baseline) into one SVG box.
function livePaths(series, prev, w = 400, h = 110, pad = 4) {
  const vals = series.map((p) => p[1]);
  const min = Math.min(...vals, prev);
  const max = Math.max(...vals, prev);
  const span = max - min || 1;
  const y = (v) => (h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i / (vals.length - 1)) * (w - pad * 2)).toFixed(1)} ${y(v)}`).join(' ');
  return { line, baseline: y(prev) };
}

function StatusBadge({ status, quote }) {
  if (status === 'live') {
    const open = quote.marketState === 'open';
    const asOf = quote.asOf ? new Date(quote.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    return (
      <span className={`chip ${open ? 'border-gain/40 text-gain' : 'border-amber/40 text-amber'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'animate-pulse bg-gain' : 'bg-amber'}`} aria-hidden="true" />
        {open ? 'LIVE · Market open' : 'Live quote · Market closed'}
        {asOf && <span className="text-dim">· {asOf}</span>}
      </span>
    );
  }
  if (status === 'loading') {
    return <span className="chip">Checking live quote…</span>;
  }
  return <span className="chip">Demo data</span>;
}

// Same record shape as a table row. The featured vault only carries a subset of
// columns, so a missing description is fetched through the existing search API.
// Live market data is layered on top when available; otherwise the demo record
// is shown unchanged, so a failed or rate-limited request is invisible to users.
export default function StockDetail({ item, onClose, onFindSimilar }) {
  const [full, setFull] = useState(item.description ? item : null);
  const [live, setLive] = useState(null);
  const [status, setStatus] = useState(liveEligible(item.ticker) ? 'loading' : 'demo');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (item.description) return undefined;
    const ctrl = new AbortController();
    searchInstruments({ q: item.ticker, limit: 5 }, ctrl.signal)
      .then((res) => setFull(res.results.find((r) => r.ticker === item.ticker) || item))
      .catch(() => setFull(item));
    return () => ctrl.abort();
  }, [item]);

  // Live quote: fetched on open, refreshed every 30 s while the tab is visible.
  useEffect(() => {
    if (!liveEligible(item.ticker)) return undefined;
    let ctrl = new AbortController();
    let timer = 0;
    let alive = true;
    const load = async () => {
      ctrl = new AbortController();
      try {
        const q = await fetchQuote(item.ticker, ctrl.signal);
        if (!alive) return;
        if (q.live) {
          setLive(q);
          setStatus('live');
        } else {
          setStatus((s) => (s === 'live' ? s : 'demo')); // keep the last good quote on a transient failure
        }
      } catch {
        /* aborted */
      }
    };
    const tick = () => {
      if (document.visibilityState === 'visible') load();
      timer = window.setTimeout(tick, REFRESH_MS);
    };
    load();
    timer = window.setTimeout(tick, REFRESH_MS);
    return () => {
      alive = false;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [item.ticker]);

  useEffect(() => {
    const el = dialogRef.current;
    const opener = document.activeElement;
    el.querySelector('button')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll('button, [href]')];
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose]);

  const d = full || item;
  const isLive = status === 'live' && live;
  const price = isLive ? live.price : Number(d.price);
  const changePct = isLive ? live.changePct : Number(d.change_pct);
  const up = changePct >= 0;
  const paths = useMemo(() => (isLive ? livePaths(live.series, live.previousClose) : null), [isLive, live]);
  const fmt = (n) => (isLive ? money(n, live.currency) : formatPrice(n));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} className="glass relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-7" style={{ background: '#0d1730' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs text-mute">
              <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[d.category] || 'bg-mute'}`} aria-hidden="true" />
              {d.category} · {d.sector}
            </p>
            <h2 id="detail-title" className="mt-1 text-2xl font-semibold tracking-tight">
              <span className="font-mono">{d.ticker}</span>
            </h2>
            <p className="text-sm text-mute">{d.title}</p>
          </div>
          <button type="button" className="btn !px-3 !py-1.5" onClick={onClose} aria-label="Close details">Close</button>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-2">
          <p className="font-mono text-3xl font-semibold">{fmt(price)}</p>
          <p className={`pb-1 font-mono text-base ${toneClass(changePct)}`}>
            {isLive && <span>{live.change > 0 ? '+' : ''}{live.change.toFixed(2)} </span>}
            {formatChange(changePct)}
          </p>
          <div className="pb-1" aria-live="polite"><StatusBadge status={status} quote={live} /></div>
        </div>
        {isLive && (
          <p className="mt-1 text-xs text-dim">
            {live.name ? `${live.name}` : d.ticker}{live.exchange ? ` · ${live.exchange}` : ''} · today vs previous close
          </p>
        )}

        <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] p-3">
          <svg viewBox="0 0 400 110" className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label={isLive ? `Intraday price chart for ${d.ticker}` : `Illustrative trend for ${d.ticker}`}>
            {isLive && <line x1="0" x2="400" y1={paths.baseline} y2={paths.baseline} stroke="rgba(148,163,208,0.35)" strokeDasharray="4 4" />}
            <path d={isLive ? paths.line : sparkPath(d.ticker, d.change_pct, 400, 110)} fill="none" stroke={up ? '#2FE6A8' : '#FF6B86'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mt-1 text-[11px] text-dim">
            {isLive ? 'Intraday, 5-minute intervals. Dashed line is the previous close.' : 'Illustrative trend generated from the demo dataset, not real price history.'}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Asset class">{d.category}</Fact>
          <Fact label="Sector">{d.sector}</Fact>
          <Fact label="Risk">
            <span className={`rounded-full border px-2 py-0.5 text-xs ${RISK_CLASS[d.risk_level] || ''}`}>{d.risk_level || 'n/a'}</span>
          </Fact>
          <Fact label="Day change"><span className={`font-mono ${toneClass(changePct)}`}>{formatChange(changePct)}</span></Fact>
          {isLive && (
            <>
              <Fact label="Prev close"><span className="font-mono">{fmt(live.previousClose)}</span></Fact>
              <Fact label="Day range"><span className="font-mono">{live.dayLow != null && live.dayHigh != null ? `${live.dayLow.toFixed(2)} - ${live.dayHigh.toFixed(2)}` : 'n/a'}</span></Fact>
              <Fact label="Volume"><span className="font-mono">{live.volume != null ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(live.volume) : 'n/a'}</span></Fact>
            </>
          )}
        </dl>

        <p className="mt-4 min-h-[3.5rem] text-sm leading-relaxed text-mute">
          {full ? d.description : <span className="skeleton block h-12 w-full" aria-hidden="true" />}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => onFindSimilar(d)}>More in {d.sector}</button>
          <button type="button" className="btn" onClick={onClose}>Back to results</button>
        </div>
        <p className="mt-4 text-[11px] text-dim">
          {isLive
            ? 'Live quote via Yahoo Finance, refreshed every 30 seconds; may be delayed up to 15 minutes. Name, sector, risk and description come from the demo dataset. Not investment advice.'
            : 'Sample data for demonstration, not investment advice.'}
        </p>
      </div>
    </div>
  );
}
