import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { useSuggestions } from '../hooks/useSuggestions.js';
import { formatChange, formatPrice, toneClass, CATEGORY_DOT } from '../lib/format.js';
import HighlightMatch from './HighlightMatch.jsx';

const SearchBar = forwardRef(function SearchBar({ value, debounced, onChange, onPick }, ref) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { items, loading } = useSuggestions(debounced, open && value.trim().length > 0);

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showList = open && value.trim().length > 0;

  function pick(item) {
    onPick(item);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (items.length ? (a + 1) % items.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (items.length ? (a <= 0 ? items.length - 1 : a - 1) : -1));
    } else if (e.key === 'Enter') {
      if (showList && active >= 0 && items[active]) {
        e.preventDefault();
        pick(items[active]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else onChange('');
    }
  }

  return (
    <div className="relative w-full" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="glass glow-volt flex items-center gap-3 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-volt/60">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-volt" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <label htmlFor={`${id}-input`} className="sr-only">Search stocks, ETFs, bonds, funds and IPOs</label>
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck="false"
          value={value}
          placeholder="Search ticker, company or sector, e.g. AAPL, tech, crypto"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-dim focus:outline-none"
        />
        {value ? (
          <button type="button" className="rounded-md px-2 py-1 text-xs text-mute hover:text-ink" onClick={() => { onChange(''); inputRef.current?.focus(); }} aria-label="Clear search">
            Clear
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-line px-2 py-0.5 font-mono text-xs text-dim sm:inline" aria-hidden="true">/</kbd>
        )}
      </div>

      {showList && (
        <div className="glass absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-navy-900/95 shadow-2xl">
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {items.map((it, i) => (
              <li
                key={it.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? 'bg-volt/10' : ''}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[it.category] || 'bg-mute'}`} aria-hidden="true" />
                <span className="w-16 shrink-0 font-mono text-sm font-semibold text-ink">
                  <HighlightMatch text={it.ticker} query={debounced} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-mute">
                  <HighlightMatch text={it.title} query={debounced} />
                </span>
                <span className="hidden font-mono text-xs text-mute sm:inline">{formatPrice(it.price)}</span>
                <span className={`font-mono text-xs ${toneClass(it.change_pct)}`}>{formatChange(it.change_pct)}</span>
              </li>
            ))}
          </ul>
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-mute" role="status">
              {loading ? 'Searching…' : 'No quick matches. Press Enter to search everything.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

export default SearchBar;
