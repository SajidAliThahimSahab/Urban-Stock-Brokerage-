import { memo, useEffect, useRef } from 'react';
import { CATEGORIES, PRICE_PRESETS, RISK_LEVELS, SECTORS } from '../lib/format.js';

function Group({ title, children }) {
  return (
    <fieldset className="border-b border-line pb-4 last:border-b-0">
      <legend className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-dim">{title}</legend>
      {children}
    </fieldset>
  );
}

export function hasFilters(f) {
  return Object.values(f).some((v) => v !== undefined && v !== '');
}

function Panel({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: filters[key] === value ? undefined : value });
  const presetActive = (p) => filters.minPrice === p.minPrice && filters.maxPrice === p.maxPrice;
  const setPreset = (p) => {
    const next = { ...filters, minPrice: p.minPrice, maxPrice: p.maxPrice };
    onChange(presetActive(p) ? { ...filters, minPrice: undefined, maxPrice: undefined } : next);
  };
  return (
    <div className="space-y-4">
      <Group title="Asset class">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip-btn" aria-pressed={filters.category === c} onClick={() => set('category', c)}>{c}</button>
          ))}
        </div>
      </Group>
      <Group title="Risk level">
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
          {RISK_LEVELS.map((r) => (
            <button key={r} type="button" aria-pressed={filters.riskLevel === r} onClick={() => set('riskLevel', r)}
              className="border-r border-line px-2 py-2 text-xs text-mute last:border-r-0 hover:text-ink aria-pressed:bg-volt/15 aria-pressed:text-volt-soft">{r}</button>
          ))}
        </div>
      </Group>
      <Group title="Price">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip-btn" aria-pressed={presetActive(p)} onClick={() => setPreset(p)}>{p.label}</button>
          ))}
        </div>
      </Group>
      <Group title="Sector">
        <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
          {SECTORS.map((s) => (
            <button key={s} type="button" aria-pressed={filters.sector === s} onClick={() => set('sector', s)}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-mute hover:bg-white/5 hover:text-ink aria-pressed:bg-volt/10 aria-pressed:text-volt-soft">
              {s}
              {filters.sector === s && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </Group>
    </div>
  );
}

function FilterSidebar({ filters, onChange, open, onClose, total }) {
  const drawerRef = useRef(null);
  const active = hasFilters(filters);

  useEffect(() => {
    if (!open) return undefined;
    const el = drawerRef.current;
    const focusables = () => el.querySelectorAll('button, [href], select, input');
    focusables()[0]?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = [...focusables()];
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const header = (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold">Filters</h2>
      {active && <button type="button" className="text-xs text-volt hover:underline" onClick={() => onChange({})}>Clear all</button>}
    </div>
  );

  return (
    <>
      <aside aria-label="Filter instruments" className="glass sticky top-[72px] hidden max-h-[calc(100vh-88px)] w-64 shrink-0 self-start overflow-y-auto rounded-2xl p-4 lg:block">
        {header}
        <Panel filters={filters} onChange={onChange} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
          <div ref={drawerRef} className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-navy-900 p-4 shadow-2xl">
            {header}
            <div className="flex-1 overflow-y-auto"><Panel filters={filters} onChange={onChange} /></div>
            <button type="button" className="btn-primary mt-4" onClick={onClose}>Show {total != null ? total.toLocaleString('en-US') : ''} results</button>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(FilterSidebar);
