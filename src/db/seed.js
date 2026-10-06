// Run with: npm run db:seed
// Truncates financial_instruments and inserts the full generated dataset
// plus custom featured popular tickers (AAPL, TSLA, SPY, etc.) for presentations.
import 'dotenv/config';
import { pool } from './pool.js';
import { generateInstruments } from './generator.js';

const BATCH_SIZE = 200;
const targetCount = Number(process.env.SEED_COUNT) || 1800;

// Popular featured instruments to guarantee successful searches during presentations
const FEATURED_INSTRUMENTS = [
  {
    ticker: 'AAPL',
    title: 'Apple Inc. Common Stock',
    description: 'Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories, and sells a variety of related services.',
    category: 'Equities',
    sector: 'Technology',
    price: 225.50,
    riskLevel: 'Medium',
    changePct: 1.45,
  },
  {
    ticker: 'TSLA',
    title: 'Tesla, Inc. Common Stock',
    description: 'Tesla designs, develops, manufactures, sells, and leases high-performance fully electric vehicles and energy generation and storage systems.',
    category: 'Equities',
    sector: 'Technology',
    price: 242.80,
    riskLevel: 'High',
    changePct: -2.10,
  },
  {
    ticker: 'SPY',
    title: 'SPDR S&P 500 ETF Trust',
    description: 'An exchange-traded fund designed to track the general performance of the S&P 500 Index, holding all constituent stocks.',
    category: 'ETFs',
    sector: 'Finance',
    price: 540.20,
    riskLevel: 'Low',
    changePct: 0.65,
  },
  {
    ticker: 'MSFT',
    title: 'Microsoft Corporation Common Stock',
    description: 'Microsoft develops and supports a wide range of software products, services, devices, and solutions including cloud platforms.',
    category: 'Equities',
    sector: 'Technology',
    price: 430.10,
    riskLevel: 'Low',
    changePct: 1.12,
  },
  {
    ticker: 'NVDA',
    title: 'NVIDIA Corporation Common Stock',
    description: 'NVIDIA pioneered GPU-accelerated computing for gaming, visualization, data centers, and artificial intelligence development.',
    category: 'Equities',
    sector: 'Technology',
    price: 124.30,
    riskLevel: 'High',
    changePct: 3.40,
  },
];

function buildInsertStatement(batch, startIndex) {
  const columns = ['ticker', 'title', 'description', 'category', 'sector', 'price', 'risk_level', 'change_pct'];
  const values = [];
  const rows = batch.map((record, i) => {
    const base = startIndex + i * columns.length;
    values.push(
      record.ticker,
      record.title,
      record.description,
      record.category,
      record.sector,
      record.price,
      record.riskLevel,
      record.changePct,
    );
    const placeholders = columns.map((_, c) => `$${base + c + 1}`);
    return `(${placeholders.join(', ')})`;
  });

  const sql = `
    INSERT INTO financial_instruments (${columns.join(', ')})
    VALUES ${rows.join(', ')}
    ON CONFLICT (ticker) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      sector = EXCLUDED.sector,
      price = EXCLUDED.price,
      risk_level = EXCLUDED.risk_level,
      change_pct = EXCLUDED.change_pct;
  `;
  return { sql, values };
}

async function main() {
  console.log(`Generating records (including featured presentation items)...`);
  // Generate the full target count, then let the featured items win any ticker
  // clash below. (Generating targetCount minus the featured count used to
  // leave the table at 1,796 rows once AAPL/TSLA/SPY/MSFT were de-duplicated,
  // under the PRD's 1,800-record minimum.)
  const generated = generateInstruments(targetCount);
  
  // Combine and deduplicate by ticker to avoid Postgres conflict batch errors
  const rawRecords = [...FEATURED_INSTRUMENTS, ...generated];
  const seenTickers = new Set();
  const records = [];
  for (const r of rawRecords) {
    if (!seenTickers.has(r.ticker)) {
      seenTickers.add(r.ticker);
      records.push(r);
    }
  }

  console.log(`Inserting ${records.length} unique records in batches of ${BATCH_SIZE}...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { sql, values } = buildInsertStatement(batch, 0);
      await client.query(sql, values);
      inserted += batch.length;
      process.stdout.write(`\r  ${inserted} / ${records.length}`);
    }
    await client.query('COMMIT');
    console.log('\nSeed complete.');

    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM financial_instruments');
    console.log(`Total rows in financial_instruments: ${rows[0].count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});