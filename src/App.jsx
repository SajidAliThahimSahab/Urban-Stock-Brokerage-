import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import TickerTape from './components/TickerTape.jsx';
import Hero from './components/Hero.jsx';
import SearchBar from './components/SearchBar.jsx';
import FilterSidebar from './components/FilterSidebar.jsx';
import Toolbar from './components/Toolbar.jsx';
import ActiveFilters from './components/ActiveFilters.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import Pagination from './components/Pagination.jsx';
import EmptyState from './components/EmptyState.jsx';
import ErrorState from './components/ErrorState.jsx';
import { useDebounce } from './hooks/useDebounce.js';
import { useSearch } from './hooks/useSearch.js';
import { useFeatured } from './hooks/useFeatured.js';

const StockDetail = lazy(() => import('./components/StockDetail.jsx'));
const Overview = lazy(() => import('./components/Overview.jsx'));

// Same footprint as the real content, so swapping it in causes no layout shift.
function OverviewSkeleton() {
  return (
    <>
      <div className="glass min-h-[452px] animate-pulse rounded-3xl max-sm:min-h-[380px]" aria-hidden="true" />
      <div className="grid animate-pulse grid-cols-2 gap-3 lg:grid-cols-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[92px] rounded-2xl" />)}
      </div>
    </>
  );
}

function useAfterIdle(timeout = 700) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window;
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setReady(true), { timeout }) : w.setTimeout(() => setReady(true), 200);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : w.clearTimeout(id));
  }, [timeout]);
  return ready;
}

export default function App() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [drawer, setDrawer] = useState(false);
  const query = useDebounce(input.trim(), 250);
  const { data, loading, error, page, setPage, retry } = useSearch({ query, filters, sort, pageSize });
  const { data: featured } = useFeatured();
  const searchRef = useRef(null);
  const tableTop = useRef(null);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const overviewReady = useAfterIdle();
  const [detail, setDetail] = useState(null);
  const openDetail = useCallback((item) => setDetail(item), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const findSimilar = useCallback((item) => {
    setDetail(null);
    setInput('');
    setFilters({ sector: item.sector });
    tableTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);
  const openDrawer = useCallback(() => setDrawer(true), []);
  const changePage = useCallback((p) => {
    setPage(p);
    tableTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [setPage]);
  const pickItem = useCallback((item) => {
    setInput(item.ticker);
    setPage(1);
    tableTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [setPage]);
  const reset = () => { setInput(''); setFilters({}); setSort(''); searchRef.current?.focus(); };

  useEffect(() => { document.title = query ? `${query} | Urban Brokerage` : 'Urban Brokerage | Search Stocks, ETFs, Bonds & IPOs'; }, [query]);

  const filterCount = Object.entries(filters).filter(([k, v]) => v !== undefined && k !== 'maxPrice').length + (filters.maxPrice !== undefined && filters.minPrice === undefined ? 1 : 0);
  const showEmpty = data && data.total === 0 && !error;
  const stale = loading && data;

  return (
    <div className="min-h-screen">
      <a href="#results" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-volt focus:px-3 focus:py-2 focus:text-obsidian">Skip to results</a>
      <Header />
      <TickerTape items={featured?.featured} />
      <main>
        <Hero>
          <SearchBar ref={searchRef} value={input} debounced={query} onChange={setInput} onPick={pickItem} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-mute" aria-label="Try a search">
            <span className="py-1">Try:</span>
            {['AAPL', 'tech', 'crypto', 'Apel'].map((s) => (
              <button key={s} type="button" className="chip-btn" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        </Hero>

        <section className="mx-auto grid max-w-[1400px] gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[1fr_260px]" aria-label="Market overview">
          {overviewReady ? (
            <Suspense fallback={<OverviewSkeleton />}>
              <Overview featured={featured} onPick={pickItem} onOpen={openDetail} />
            </Suspense>
          ) : (
            <OverviewSkeleton />
          )}
        </section>

        <section id="instruments" className="mx-auto flex max-w-[1400px] gap-5 px-4 pb-16 sm:px-6" aria-label="Instruments">
          <FilterSidebar filters={filters} onChange={setFilters} open={drawer} onClose={closeDrawer} total={data?.total} />
          <div className="min-w-0 flex-1 space-y-3" ref={tableTop} style={{ scrollMarginTop: 76 }}>
            <Toolbar data={data} loading={stale} sort={sort} onSort={setSort} pageSize={pageSize} onPageSize={setPageSize} onOpenFilters={openDrawer} filterCount={filterCount} />
            <ActiveFilters filters={filters} onChange={setFilters} />
            {error && !data ? (
              <ErrorState message={error} onRetry={retry} />
            ) : showEmpty ? (
              <EmptyState query={query} onReset={reset} />
            ) : (
              <>
                {error && <ErrorState message={error} onRetry={retry} />}
                <ResultsTable data={data} loading={loading} query={query} onOpen={openDetail} />
                <Pagination page={page} totalPages={data?.totalPages} onPage={changePage} disabled={stale} />
              </>
            )}
          </div>
        </section>
      </main>
      {detail && (
        <Suspense fallback={null}>
          <StockDetail item={detail} onClose={closeDetail} onFindSimilar={findSimilar} />
        </Suspense>
      )}
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-dim">
        Urban Brokerage search demo. Sample data for demonstration, not investment advice.
      </footer>
    </div>
  );
}
