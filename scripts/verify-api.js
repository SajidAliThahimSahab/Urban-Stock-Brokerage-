// Run: npm run test:api   (needs DATABASE_URL, a schema and a seeded table)
// Calls the real /api/search and /api/featured handlers against your database
// and asserts pagination, sorting, facets, search, typo fallback and the
// parameter alignment of every SQL builder. Exits non-zero on any failure.
import search, {
  parseParams, buildBrowseQuery, buildFtsQuery, buildTrgmQuery, MAX_LIMIT,
} from '../api/search.js';
import featured from '../api/featured.js';
import { pool } from '../src/db/pool.js';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function call(handler, query = {}) {
  let status = 200;
  let body;
  const res = {
    status(code) { status = code; return this; },
    json(b) { body = b; },
    setHeader() {},
  };
  await handler({ method: 'GET', query }, res);
  return { status, body };
}

const isSorted = (rows, key, dir) => rows.every((r, i) => i === 0
  || (dir === 'desc' ? Number(rows[i - 1][key]) >= Number(r[key]) : Number(rows[i - 1][key]) <= Number(r[key])));

async function main() {
  console.log('Pagination');
  const { rows: [{ count: dbTotal }] } = await pool.query('SELECT COUNT(*)::int AS count FROM financial_instruments');
  check('table holds at least 1,800 rows', dbTotal >= 1800, `(got ${dbTotal})`);

  const p1 = (await call(search, {})).body;
  check('default page returns 50 rows', p1.results.length === 50, `(got ${p1.results.length})`);
  check('total matches the table count', p1.total === dbTotal);
  check('totalPages = ceil(total / 50)', p1.totalPages === Math.ceil(dbTotal / 50));

  const p100 = (await call(search, { limit: '100' })).body;
  check('limit=100 returns 100 rows', p100.results.length === 100);
  check('limit=500 is clamped to the maximum', (await call(search, { limit: '500' })).body.results.length === MAX_LIMIT);
  check('junk limit falls back to 50', (await call(search, { limit: 'abc' })).body.results.length === 50);

  const p2 = (await call(search, { page: '2' })).body;
  const ids1 = new Set(p1.results.map((r) => r.id));
  check('page 2 shares no rows with page 1', p2.results.every((r) => !ids1.has(r.id)));

  const lastPage = p1.totalPages;
  const last = (await call(search, { page: String(lastPage) })).body;
  check('last page holds the remainder', last.results.length === dbTotal - (lastPage - 1) * 50, `(got ${last.results.length})`);

  const beyond = (await call(search, { page: '9999' })).body;
  check('page past the end is empty but keeps the real total', beyond.results.length === 0 && beyond.total === dbTotal);

  console.log('Sorting');
  const byPriceDesc = (await call(search, { sort: 'price_desc', limit: '100' })).body.results;
  check('price_desc is descending', isSorted(byPriceDesc, 'price', 'desc'));
  const byChangeAsc = (await call(search, { sort: 'change_asc', limit: '100' })).body.results;
  check('change_asc is ascending', isSorted(byChangeAsc, 'change_pct', 'asc'));
  const byTicker = (await call(search, { sort: 'ticker', limit: '100' })).body.results.map((r) => r.ticker);
  check('ticker sort is alphabetical', byTicker.every((t, i) => i === 0 || byTicker[i - 1] <= t));
  const hostile = await call(search, { sort: 'price; DROP TABLE financial_instruments' });
  check('hostile sort value is ignored, not executed', hostile.status === 200 && hostile.body.sort === 'change_desc');
  const stillThere = await pool.query('SELECT COUNT(*)::int AS count FROM financial_instruments');
  check('table survived the injection attempt', stillThere.rows[0].count === dbTotal);

  console.log('Facets');
  const etfs = (await call(search, { category: 'ETFs', limit: '100' })).body;
  const { rows: [{ count: etfCount }] } = await pool.query("SELECT COUNT(*)::int AS count FROM financial_instruments WHERE category = 'ETFs'");
  check('category filter returns only that class', etfs.results.every((r) => r.category === 'ETFs'));
  check('category total matches a direct count', etfs.total === etfCount);
  const combo = (await call(search, { category: 'Equities', riskLevel: 'High', minPrice: '50', maxPrice: '200', limit: '100' })).body;
  check('combined facets all apply', combo.results.every((r) => r.category === 'Equities' && r.risk_level === 'High' && Number(r.price) >= 50 && Number(r.price) <= 200));

  console.log('Search');
  const apple = (await call(search, { q: 'Apple stock' })).body;
  check('"Apple stock" ranks AAPL first', apple.results[0]?.ticker === 'AAPL', `(got ${apple.results[0]?.ticker})`);
  const tech = (await call(search, { q: 'technology', limit: '50' })).body;
  check('multi-page search reports a total above one page', tech.total > 50, `(total ${tech.total})`);
  const tech2 = (await call(search, { q: 'technology', limit: '50', page: '2' })).body;
  check('search page 2 differs from page 1', tech2.results.length > 0 && tech2.results[0].id !== tech.results[0].id);
  const techBeyond = (await call(search, { q: 'technology', page: '9999' })).body;
  check('search past the end keeps total and stays fulltext', techBeyond.results.length === 0 && techBeyond.total === tech.total && techBeyond.mode === 'fulltext');
  const nvda = (await call(search, { q: 'NVDA' })).body;
  check('featured ticker NVDA is searchable', nvda.results[0]?.ticker === 'NVDA');
  const relevanceSorted = (await call(search, { q: 'fund', sort: 'price_desc', limit: '50' })).body.results;
  check('explicit sort overrides relevance inside a search', isSorted(relevanceSorted, 'price', 'desc'));

  console.log('Typo tolerance and empty results');
  const typo = (await call(search, { q: 'Apel' })).body;
  check('"Apel" uses the trigram fallback', typo.mode === 'typo-fallback');
  check('"Apel" finds AAPL in the top 3', typo.results.slice(0, 3).some((r) => r.ticker === 'AAPL'));
  const zero = (await call(search, { q: 'XYZABC999' })).body;
  check('nonsense query returns no-results with total 0', zero.mode === 'no-results' && zero.total === 0 && zero.results.length === 0);

  console.log('Featured endpoint');
  const f = (await call(featured)).body;
  check('8 featured instruments, in order', f.featured.length === 8 && f.featured[0].ticker === 'NVDA');
  check('breadth stats are coherent', f.stats.total === dbTotal && f.stats.advancing + f.stats.declining <= f.stats.total);
  check('top gainer is positive', Number(f.stats.topGainer.change_pct) > 0);

  console.log('SQL builders (placeholder/value alignment)');
  const base = parseParams({ q: 'tech etf', category: 'ETFs', sector: 'Technology', riskLevel: 'Low', minPrice: '5', maxPrice: '900', page: '3', limit: '100' });
  for (const [name, builder] of [['browse', buildBrowseQuery], ['fts', buildFtsQuery], ['trigram', buildTrgmQuery]]) {
    for (const filters of [{}, base.filters, { category: 'Bonds' }, { minPrice: 1 }]) {
      const { text, values } = builder({ ...base, filters });
      const used = [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      const max = Math.max(...used);
      const unique = new Set(used);
      check(`${name} builder with ${Object.keys(filters).length} filters`, max === values.length && unique.size === max, `(max $${max}, ${values.length} values)`);
    }
  }
  const offsetCheck = buildBrowseQuery({ ...base, filters: {} });
  check('offset = (page - 1) * pageSize', offsetCheck.values.at(-1) === 200 && offsetCheck.values.at(-2) === 100);

  await pool.end();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:', failures.join('; '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
