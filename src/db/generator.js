// Pure data-generation logic for the financial_instruments dataset.
// No database dependency here on purpose — this module is imported both by
// seed.js (which inserts into Postgres) and by scripts/benchmark.js and any
// test, so the data shape can be verified without a live DB connection.
//
// Strategy: a small set of CURATED "anchor" records guarantees the TRD's 8
// core benchmark queries, 3 typo queries, and realistic sector/category
// coverage resolve deterministically. The remaining records are generated
// procedurally from realistic name/sector/category combinations to reach
// 1,800 total, with guaranteed-unique tickers.

export const CATEGORIES = ['Equities', 'Bonds', 'Mutual Funds', 'ETFs', 'IPOs'];
export const SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer Discretionary',
  'Consumer Staples', 'Industrials', 'Real Estate', 'Utilities', 'Materials',
  'Communication Services', 'Automotive',
];
export const RISK_LEVELS = ['Low', 'Medium', 'High'];

// Anchors cover every PRD benchmark query's expected #1 result, plus a
// handful of other recognizable names so the dataset doesn't feel sparse
// at the top of common searches.
export const ANCHOR_INSTRUMENTS = [
  {
    ticker: 'AAPL', title: 'Apple Inc.', category: 'Equities', sector: 'Technology',
    price: 227.52, riskLevel: 'Low', changePct: 1.24,
    description: 'Designs, manufactures, and markets consumer electronics, software, and services including the iPhone, Mac, and Apple Watch.',
  },
  {
    ticker: 'TSLA', title: 'Tesla, Inc.', category: 'Equities', sector: 'Automotive',
    price: 248.98, riskLevel: 'High', changePct: -2.11,
    description: 'Designs and manufactures electric vehicles, battery energy storage, and solar products.',
  },
  {
    ticker: 'XLK', title: 'Technology Select Sector SPDR Fund', category: 'ETFs', sector: 'Technology',
    price: 214.33, riskLevel: 'Medium', changePct: 0.87,
    description: 'Tracks the technology sector of the S&P 500, including large-cap software, hardware, and semiconductor companies.',
  },
  {
    ticker: 'UST10Y', title: 'US 10-Year Treasury Bond', category: 'Bonds', sector: 'Finance',
    price: 98.40, riskLevel: 'Low', changePct: 0.05,
    description: 'A government-issued bond backed by the full faith and credit of the United States Treasury, maturing in 10 years.',
  },
  {
    ticker: 'VGHCX', title: 'Vanguard Health Care Fund', category: 'Mutual Funds', sector: 'Healthcare',
    price: 231.17, riskLevel: 'Medium', changePct: 0.41,
    description: 'An actively managed mutual fund investing in pharmaceutical, biotechnology, and healthcare services companies.',
  },
  {
    ticker: 'CTEI', title: 'CleanTech Energy IPO 2026', category: 'IPOs', sector: 'Energy',
    price: 18.50, riskLevel: 'High', changePct: 6.32,
    description: 'Upcoming public offering for a renewable energy company specializing in solar and wind infrastructure.',
  },
  {
    ticker: 'SPY', title: 'SPDR S&P 500 ETF Trust', category: 'ETFs', sector: 'Finance',
    price: 571.26, riskLevel: 'Low', changePct: 0.33,
    description: 'Tracks the S&P 500 index, offering broad exposure to 500 of the largest publicly traded US companies.',
  },
  {
    ticker: 'BITO', title: 'Bitcoin Strategy ETF', category: 'ETFs', sector: 'Finance',
    price: 24.61, riskLevel: 'High', changePct: -3.87,
    description: 'Provides exposure to bitcoin futures contracts without requiring direct ownership of the underlying cryptocurrency.',
  },
  // Supplementary anchors — broaden coverage without being load-bearing for
  // a specific benchmark query.
  {
    ticker: 'MSFT', title: 'Microsoft Corporation', category: 'Equities', sector: 'Technology',
    price: 429.84, riskLevel: 'Low', changePct: 0.56,
    description: 'Develops software, cloud computing services, and hardware including Windows, Azure, and Surface devices.',
  },
  {
    ticker: 'NKE', title: 'Nike, Inc.', category: 'Equities', sector: 'Consumer Discretionary',
    price: 78.42, riskLevel: 'Medium', changePct: -0.92,
    description: 'Designs, markets, and sells athletic footwear, apparel, and equipment worldwide.',
  },
  {
    ticker: 'JPM', title: 'JPMorgan Chase & Co.', category: 'Equities', sector: 'Finance',
    price: 218.76, riskLevel: 'Low', changePct: 0.71,
    description: 'A global financial services firm offering investment banking, commercial banking, and asset management.',
  },
  {
    ticker: 'VNQ', title: 'Vanguard Real Estate ETF', category: 'ETFs', sector: 'Real Estate',
    price: 92.14, riskLevel: 'Medium', changePct: -0.18,
    description: 'Tracks an index of US real estate investment trusts (REITs) across commercial and residential property.',
  },
  {
    ticker: 'MUB30', title: 'Municipal Bond Fund 30-Year', category: 'Bonds', sector: 'Finance',
    price: 101.22, riskLevel: 'Low', changePct: 0.02,
    description: 'A tax-advantaged bond fund investing in long-term municipal debt issued by US state and local governments.',
  },
  {
    ticker: 'FSKAX', title: 'Fidelity Total Market Index Fund', category: 'Mutual Funds', sector: 'Finance',
    price: 142.83, riskLevel: 'Medium', changePct: 0.29,
    description: 'A broad index mutual fund tracking the performance of the entire US stock market.',
  },
  {
    ticker: 'NRGX', title: 'NorthRidge Energy Exploration IPO', category: 'IPOs', sector: 'Energy',
    price: 22.00, riskLevel: 'High', changePct: 4.10,
    description: 'Upcoming public offering for an oil and gas exploration company operating in the Permian Basin.',
  },
];

const COMPANY_PREFIXES = [
  'North', 'South', 'East', 'West', 'Summit', 'Harbor', 'Metro', 'Union',
  'Granite', 'Cedar', 'Pioneer', 'Vertex', 'Crestline', 'Meridian', 'Atlas',
  'Beacon', 'Anchor', 'Ridgeline', 'Sterling', 'Ironwood', 'Lumen', 'Cobalt',
  'Westfield', 'Highland', 'Bridgeport', 'Fairmont', 'Redstone', 'Silverline',
  'Brightwater', 'Clearview',
];

const COMPANY_SUFFIXES_BY_CATEGORY = {
  Equities: ['Inc.', 'Corporation', 'Holdings', 'Group', 'Technologies', 'Industries'],
  'Mutual Funds': ['Growth Fund', 'Income Fund', 'Index Fund', 'Balanced Fund', 'Value Fund'],
  ETFs: ['ETF', 'Sector Fund', 'Index Trust', 'Growth ETF'],
  Bonds: ['Bond', 'Municipal Bond Fund', 'Corporate Bond Trust', 'Treasury Note'],
  IPOs: ['IPO', 'Public Offering', 'IPO 2026'],
};

const SECTOR_DESCRIPTORS = {
  Technology: 'software, hardware, and digital infrastructure',
  Healthcare: 'pharmaceuticals, medical devices, and healthcare services',
  Finance: 'banking, insurance, and financial services',
  Energy: 'oil, gas, and renewable power generation',
  'Consumer Discretionary': 'retail, apparel, and consumer goods',
  'Consumer Staples': 'food, beverage, and household products',
  Industrials: 'manufacturing, aerospace, and industrial equipment',
  'Real Estate': 'commercial and residential property investment',
  Utilities: 'electric, water, and gas utility services',
  Materials: 'chemicals, mining, and raw materials production',
  'Communication Services': 'media, telecommunications, and entertainment',
  Automotive: 'vehicle manufacturing and automotive technology',
};

const PRICE_RANGES = {
  Equities: [8, 650],
  Bonds: [85, 110],
  'Mutual Funds': [12, 320],
  ETFs: [18, 580],
  IPOs: [6, 45],
};

// Deterministic pseudo-random generator (seeded) so the dataset is
// reproducible across runs — important for a benchmark suite that compares
// results before/after a tuning change.
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, random) {
  return arr[Math.floor(random() * arr.length)];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function tickerFromName(name, usedTickers) {
  const base = name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'XXXX';
  if (!usedTickers.has(base)) {
    usedTickers.add(base);
    return base;
  }
  // Deterministic, exhaustive, collision-free: try BASE2, BASE3, ... up to
  // BASE999. With a VARCHAR(10) ticker column and a 4-char base this has
  // headroom up to 6 digits of suffix, far beyond what 1,800 records with
  // 30 prefixes could ever collide into. No randomness and no wall-clock
  // reads here on purpose — both broke reproducibility (same seed produced
  // different output) when this used to fall back to Date.now().
  for (let n = 2; n <= 999999; n += 1) {
    const candidate = `${base}${n}`;
    if (!usedTickers.has(candidate)) {
      usedTickers.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Exhausted ticker suffix space for base "${base}" — widen COMPANY_PREFIXES or the ticker column.`);
}

/**
 * Generates the full dataset: curated anchors + procedural filler, up to
 * `targetCount` total records (default 1,800 per the PRD's minimum).
 * Pure function of (targetCount, seed) — same inputs always produce the
 * same dataset, which matters for reproducible before/after tuning
 * comparisons in the benchmark suite.
 */
export function generateInstruments(targetCount = 1800, seed = 42) {
  const random = mulberry32(seed);
  const usedTickers = new Set(ANCHOR_INSTRUMENTS.map((a) => a.ticker));
  const records = ANCHOR_INSTRUMENTS.map((a) => ({ ...a }));

  const remaining = Math.max(0, targetCount - records.length);

  for (let i = 0; i < remaining; i += 1) {
    const category = pick(CATEGORIES, random);
    const sector = pick(SECTORS, random);
    const suffix = pick(COMPANY_SUFFIXES_BY_CATEGORY[category], random);
    const prefix = pick(COMPANY_PREFIXES, random);
    // Second word keeps names from colliding too often while staying
    // readable, e.g. "Northgate Meridian Technologies".
    const prefix2 = random() > 0.55 ? ` ${pick(COMPANY_PREFIXES, random)}` : '';
    const title = `${prefix}${prefix2} ${suffix}`.replace(/\s+/g, ' ').trim();
    const ticker = tickerFromName(`${prefix}${prefix2}`, usedTickers);

    const [lo, hi] = PRICE_RANGES[category];
    const price = round2(lo + random() * (hi - lo));

    const riskWeights = category === 'Bonds'
      ? ['Low', 'Low', 'Low', 'Medium']
      : category === 'IPOs'
        ? ['High', 'High', 'Medium']
        : RISK_LEVELS;
    const riskLevel = pick(riskWeights, random);

    const changePct = round2((random() - 0.5) * (riskLevel === 'High' ? 12 : riskLevel === 'Medium' ? 5 : 1.5));

    records.push({
      ticker,
      title,
      category,
      sector,
      price,
      riskLevel,
      changePct,
      description: `A ${riskLevel.toLowerCase()}-risk ${category.toLowerCase()} instrument in the ${sector.toLowerCase()} sector, focused on ${SECTOR_DESCRIPTORS[sector]}.`,
    });
  }

  return records;
}
