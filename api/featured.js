// GET /api/featured
// Powers the hero: the featured "vault" cards, the ticker tape, and the
// market-breadth tiles. Four small queries over ~1,800 rows,
// run in parallel; cached at the CDN for a minute.
import { pool } from '../src/db/pool.js';

export const FEATURED_TICKERS = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'SPY', 'JPM', 'XLK', 'BITO'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const [featured, breadth, gainer, loser] = await Promise.all([
      pool.query(
        `SELECT id, ticker, title, category, sector, price, risk_level, change_pct
         FROM financial_instruments
         WHERE ticker = ANY($1::text[])
         ORDER BY array_position($1::text[], ticker::text)`,
        [FEATURED_TICKERS],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE change_pct > 0)::int AS advancing,
                COUNT(*) FILTER (WHERE change_pct < 0)::int AS declining,
                COALESCE(ROUND(AVG(change_pct)::numeric, 2), 0) AS avg_change
         FROM financial_instruments`,
      ),
      pool.query(
        `SELECT ticker, title, change_pct FROM financial_instruments
         ORDER BY change_pct DESC, ticker ASC LIMIT 1`,
      ),
      pool.query(
        `SELECT ticker, title, change_pct FROM financial_instruments
         ORDER BY change_pct ASC, ticker ASC LIMIT 1`,
      ),
    ]);

    const b = breadth.rows[0];
    res.setHeader?.('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      featured: featured.rows,
      stats: {
        total: b.total,
        advancing: b.advancing,
        declining: b.declining,
        avgChange: Number(b.avg_change),
        topGainer: gainer.rows[0] || null,
        topLoser: loser.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('Featured query failed:', err);
    res.status(500).json({ error: 'Could not load market overview.' });
  }
}
