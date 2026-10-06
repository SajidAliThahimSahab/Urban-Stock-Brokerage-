// GET /api/search
//   ?q=apple              search text (omit for facet-only browsing)
//   &category=ETFs&sector=Technology&riskLevel=Low&minPrice=10&maxPrice=500
//   &page=1               1-based page number
//   &limit=50             rows per page, 1-100 (default 50)
//   &sort=relevance       relevance | ticker | name | price_asc | price_desc | change_desc | change_asc
//
// Response: { results, total, page, pageSize, totalPages, mode, query, sort }
//
// Two-stage search (unchanged in behaviour from the first build):
//   1. Primary: websearch_to_tsquery (synonym-expanded, OR-joined) against the
//      weighted search_vector (A: ticker/title, B: category/sector,
//      C: description), ranked with ts_rank_cd.
//   2. Typo fallback: only when stage 1 matches nothing at all, re-run with
//      pg_trgm word_similarity on ticker/title. tsquery only stems; it cannot
//      correct a misspelling, which is what trigram similarity is for.
// Facet filters apply identically to every stage via one shared WHERE fragment.
//
// Pagination: LIMIT/OFFSET with COUNT(*) OVER() so the total comes back in the
// same round trip as the page. Sort keys are looked up in a whitelist, never
// interpolated from user input.
import { pool } from '../src/db/pool.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 100;

export const SORTS = {
  ticker: 'ticker ASC',
  name: 'title ASC, ticker ASC',
  price_desc: 'price DESC, ticker ASC',
  price_asc: 'price ASC, ticker ASC',
  change_desc: 'change_pct DESC, ticker ASC',
  change_asc: 'change_pct ASC, ticker ASC',
};
export const DEFAULT_BROWSE_SORT = 'change_desc';
const RELEVANCE_ORDER = 'rank DESC, title ASC, ticker ASC';

const COLUMNS = 'id, ticker, title, description, category, sector, price, risk_level, change_pct';

// Synonym map = relevance tuning lever (see BENCHMARKS.md). Postgres stems
// but doesn't know "tech" means "technology" or "crypto" means "bitcoin".
export const SYNONYMS = {
  tech: 'technology',
  shares: 'stock',
  crypto: 'bitcoin',
  green: 'renewable',
  government: 'government treasury',
  healthcare: 'healthcare health care',
};

// Turns "Apple stock" into "apple or stock": any term can match, and
// ts_rank_cd ranks docs matching more/higher-weighted terms first.
export function expandQuery(q) {
  const words = q
    .toLowerCase()
    .replace(/["\-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'or');
  const expanded = words.flatMap((w) => (SYNONYMS[w] ? [w, ...SYNONYMS[w].split(' ')] : [w]));
  return [...new Set(expanded)].join(' or ');
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseFilters(query) {
  const filters = {};
  if (query.category) filters.category = String(query.category);
  if (query.sector) filters.sector = String(query.sector);
  if (query.riskLevel) filters.riskLevel = String(query.riskLevel);
  if (query.minPrice !== undefined && query.minPrice !== '') {
    const n = Number(query.minPrice);
    if (!Number.isNaN(n)) filters.minPrice = n;
  }
  if (query.maxPrice !== undefined && query.maxPrice !== '') {
    const n = Number(query.maxPrice);
    if (!Number.isNaN(n)) filters.maxPrice = n;
  }
  return filters;
}

export function parseParams(query = {}) {
  const q = String(query.q ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  const sort = typeof query.sort === 'string' ? query.sort : '';
  return {
    q,
    filters: parseFilters(query),
    page: clampInt(query.page, 1, 100000, 1),
    pageSize: clampInt(query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT),
    // Only whitelisted keys (or 'relevance') survive; anything else is ignored.
    sort: sort === 'relevance' || SORTS[sort] ? sort : '',
  };
}

function buildFacetClause(params, startIndex) {
  const clauses = [];
  const values = [];
  let i = startIndex;

  if (params.category) {
    clauses.push(`category = $${i}`);
    values.push(params.category);
    i += 1;
  }
  if (params.sector) {
    clauses.push(`sector = $${i}`);
    values.push(params.sector);
    i += 1;
  }
  if (params.riskLevel) {
    clauses.push(`risk_level = $${i}`);
    values.push(params.riskLevel);
    i += 1;
  }
  if (params.minPrice !== undefined) {
    clauses.push(`price >= $${i}`);
    values.push(params.minPrice);
    i += 1;
  }
  if (params.maxPrice !== undefined) {
    clauses.push(`price <= $${i}`);
    values.push(params.maxPrice);
    i += 1;
  }

  return { clause: clauses.length ? `AND ${clauses.join(' AND ')}` : '', values, nextIndex: i };
}

// --- Pure query builders: (params) -> { text, values }. No I/O, so the
// placeholder/value alignment can be unit-tested without a database. ---

export function buildBrowseQuery({ filters, sort, page, pageSize }) {
  const facet = buildFacetClause(filters, 1);
  const order = SORTS[sort] || SORTS[DEFAULT_BROWSE_SORT];
  const text = `
    SELECT ${COLUMNS}, COUNT(*) OVER() AS total_count
    FROM financial_instruments
    WHERE true ${facet.clause}
    ORDER BY ${order}
    LIMIT $${facet.nextIndex} OFFSET $${facet.nextIndex + 1};
  `;
  return { text, values: [...facet.values, pageSize, (page - 1) * pageSize] };
}

export function buildFtsQuery({ q, filters, sort, page, pageSize }) {
  const facet = buildFacetClause(filters, 2);
  const order = SORTS[sort] || RELEVANCE_ORDER;
  const text = `
    SELECT ${COLUMNS},
           ts_rank_cd(search_vector, websearch_to_tsquery('english', $1)) AS rank,
           COUNT(*) OVER() AS total_count
    FROM financial_instruments
    WHERE search_vector @@ websearch_to_tsquery('english', $1) ${facet.clause}
    ORDER BY ${order}
    LIMIT $${facet.nextIndex} OFFSET $${facet.nextIndex + 1};
  `;
  return { text, values: [expandQuery(q), ...facet.values, pageSize, (page - 1) * pageSize] };
}

// word_similarity(query, text) scores the query against the best-matching
// stretch of words in `text`, which is what a typo needs: plain similarity()
// compares against the WHOLE title, so "Apel" vs "Apple Inc. Common Stock"
// scores 0.08 and never matches, while word_similarity scores it 0.40.
// The function form does a sequential scan, which is sub-millisecond at
// ~1,800 rows; for a much larger table switch to the `<%` operator so the
// GIN trigram indexes in schema.sql can serve it.
export const TRIGRAM_THRESHOLD = 0.35;

export function buildTrgmQuery({ q, filters, sort, page, pageSize }) {
  const facet = buildFacetClause(filters, 2);
  const order = SORTS[sort] || RELEVANCE_ORDER;
  const score = 'GREATEST(word_similarity($1, ticker), word_similarity($1, title))';
  const text = `
    SELECT ${COLUMNS},
           ${score} AS rank,
           COUNT(*) OVER() AS total_count
    FROM financial_instruments
    WHERE ${score} >= ${TRIGRAM_THRESHOLD} ${facet.clause}
    ORDER BY ${order}
    LIMIT $${facet.nextIndex} OFFSET $${facet.nextIndex + 1};
  `;
  return { text, values: [q, ...facet.values, pageSize, (page - 1) * pageSize] };
}

function stripInternal(rows) {
  return rows.map(({ total_count, rank, ...row }) => row); // eslint-disable-line no-unused-vars
}

// Runs one builder. If the requested page is past the end (so no row carries a
// total_count), probe page 1 so the caller still learns the real total and can
// move the user back to the last valid page instead of showing "no results".
async function fetchPage(builder, params) {
  const { text, values } = builder(params);
  const { rows } = await pool.query(text, values);
  if (rows.length > 0) return { rows: stripInternal(rows), total: Number(rows[0].total_count) };

  if (params.page > 1) {
    const probe = builder({ ...params, page: 1, pageSize: 1 });
    const { rows: probeRows } = await pool.query(probe.text, probe.values);
    return { rows: [], total: probeRows.length ? Number(probeRows[0].total_count) : 0 };
  }
  return { rows: [], total: 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const params = parseParams(req.query);

  try {
    let result;
    let mode;
    let effectiveSort;

    if (!params.q) {
      result = await fetchPage(buildBrowseQuery, params);
      mode = 'browse';
      effectiveSort = SORTS[params.sort] ? params.sort : DEFAULT_BROWSE_SORT;
    } else {
      result = await fetchPage(buildFtsQuery, params);
      mode = 'fulltext';
      if (result.total === 0) {
        result = await fetchPage(buildTrgmQuery, params);
        mode = result.total > 0 ? 'typo-fallback' : 'no-results';
      }
      effectiveSort = SORTS[params.sort] ? params.sort : 'relevance';
    }

    res.setHeader?.('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.status(200).json({
      results: result.rows,
      total: result.total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / params.pageSize)),
      mode,
      query: params.q,
      sort: effectiveSort,
    });
  } catch (err) {
    console.error('Search query failed:', err);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}
