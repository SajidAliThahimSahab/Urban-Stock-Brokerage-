import { memo } from 'react';
import { getPageItems } from '../lib/pagination.js';

function Pagination({ page, totalPages, onPage, disabled }) {
  if (!totalPages || totalPages <= 1) return null;
  const items = getPageItems(page, totalPages);
  const base = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 font-mono text-xs transition-colors';
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" className={`${base} border-line px-3 text-mute hover:border-line-strong hover:text-ink disabled:opacity-40`} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="font-mono text-xs text-mute sm:hidden" aria-live="polite">Page {page} / {totalPages}</span>
      <ul className="hidden items-center gap-1.5 sm:flex">
        {items.map((it) =>
          typeof it === 'number' ? (
            <li key={it}>
              <button type="button" disabled={disabled} aria-current={it === page ? 'page' : undefined} aria-label={`Page ${it}`}
                className={`${base} ${it === page ? 'border-volt bg-volt/15 text-volt-soft' : 'border-line text-mute hover:border-line-strong hover:text-ink'}`}
                onClick={() => onPage(it)}>{it}</button>
            </li>
          ) : (
            <li key={it} aria-hidden="true" className="px-1 text-dim">…</li>
          ),
        )}
      </ul>
      <button type="button" className={`${base} border-line px-3 text-mute hover:border-line-strong hover:text-ink disabled:opacity-40`} disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

export default memo(Pagination);
