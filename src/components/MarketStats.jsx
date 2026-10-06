import { memo } from 'react';
import { formatChange, formatInt, toneClass } from '../lib/format.js';

function Tile({ label, children }) {
  return (
    <div className="glass rounded-2xl p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:border-line-strong">
      <p className="text-xs uppercase tracking-wider text-dim">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function MarketStats({ stats, onPick }) {
  if (!stats) {
    return (
      <div className="grid animate-pulse grid-cols-2 gap-3 lg:grid-cols-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[92px] rounded-2xl" />)}
      </div>
    );
  }
  const adv = (stats.advancing / Math.max(1, stats.total)) * 100;
  const dec = (stats.declining / Math.max(1, stats.total)) * 100;
  return (
    <div id="markets" className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      <Tile label="Instruments indexed">
        <p className="font-mono text-2xl font-semibold">{formatInt(stats.total)}</p>
      </Tile>
      <Tile label="Market breadth">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${stats.advancing} advancing, ${stats.declining} declining`}>
          <span className="bg-gain" style={{ width: `${adv}%` }} />
          <span className="bg-loss" style={{ width: `${dec}%`, marginLeft: 'auto' }} />
        </div>
        <p className="mt-2 font-mono text-xs"><span className="text-gain">{formatInt(stats.advancing)} up</span> <span className="text-dim">/</span> <span className="text-loss">{formatInt(stats.declining)} down</span></p>
      </Tile>
      {[['Top gainer', stats.topGainer], ['Top decliner', stats.topLoser]].map(([label, row]) => (
        <Tile key={label} label={label}>
          {row ? (
            <button type="button" className="text-left" onClick={() => onPick(row)}>
              <span className="font-mono text-lg font-semibold">{row.ticker}</span>{' '}
              <span className={`font-mono text-sm ${toneClass(row.change_pct)}`}>{formatChange(row.change_pct)}</span>
              <span className="block truncate text-xs text-mute">{row.title}</span>
            </button>
          ) : null}
        </Tile>
      ))}
    </div>
  );
}

export default memo(MarketStats);
