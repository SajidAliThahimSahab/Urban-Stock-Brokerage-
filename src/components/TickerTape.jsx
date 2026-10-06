import { memo } from 'react';
import { formatChange, formatPrice, toneClass } from '../lib/format.js';

function TickerTape({ items }) {
  if (!items?.length) {
    return <div className="tape border-b border-line bg-navy-950" aria-hidden="true" />;
  }
  const loop = [...items, ...items];
  return (
    <div className="tape border-b border-line bg-navy-950" role="region" aria-label="Market ticker, hover to pause">
      <div className="tape-track">
        {loop.map((it, i) => (
          <div className="tape-item" key={`${it.ticker}-${i}`} aria-hidden={i >= items.length ? 'true' : undefined}>
            <span className="font-mono font-semibold text-ink">{it.ticker}</span>
            <span className="font-mono text-mute">{formatPrice(it.price)}</span>
            <span className={`font-mono ${toneClass(it.change_pct)}`}>{formatChange(it.change_pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TickerTape);
