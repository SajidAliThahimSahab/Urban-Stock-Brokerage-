-- Urban Brokerage Search — Schema
-- Run once against a fresh database before seeding.
--
-- Two search mechanisms are set up here, deliberately:
--   1. tsvector/tsquery (native full-text search) — handles stemming
--      ("fund" matches "funds"), stopword removal, and weighted ranking.
--      It does NOT correct misspellings; that's a separate concern.
--   2. pg_trgm (trigram similarity) — handles typo tolerance. "Apel" has no
--      stem relationship to "Apple" a dictionary-based stemmer could find,
--      but trigram similarity catches it because the two strings share most
--      of their 3-character substrings. The API queries both and combines
--      them (see api/search.js) rather than claiming tsquery alone does
--      fuzzy matching, which it does not.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS financial_instruments (
  id            SERIAL PRIMARY KEY,
  ticker        VARCHAR(10)     NOT NULL UNIQUE,
  title         VARCHAR(255)    NOT NULL,
  description   TEXT            NOT NULL DEFAULT '',
  category      VARCHAR(50)     NOT NULL CHECK (category IN ('Equities', 'Bonds', 'Mutual Funds', 'ETFs', 'IPOs')),
  sector        VARCHAR(100)    NOT NULL,
  price         DECIMAL(10, 2)  NOT NULL CHECK (price >= 0),
  risk_level    VARCHAR(20)     NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  change_pct    DECIMAL(6, 2)   NOT NULL DEFAULT 0,   -- daily % change, drives gain/loss display only
  search_vector TSVECTOR,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Weighted vector: A = ticker/title (exact-identity matches rank highest),
-- B = category/sector (a search like "tech ETF" should rank an ETF in the
-- Technology sector above an unrelated instrument that merely mentions
-- "technology" in its description), C = description (lowest weight, still
-- searchable but shouldn't outrank an A/B match).
CREATE OR REPLACE FUNCTION financial_instruments_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.ticker, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.sector, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_instruments_search_vector ON financial_instruments;
CREATE TRIGGER trg_financial_instruments_search_vector
  BEFORE INSERT OR UPDATE ON financial_instruments
  FOR EACH ROW EXECUTE FUNCTION financial_instruments_search_vector_update();

-- GIN index for the weighted tsvector — sub-millisecond keyword lookups
-- even across thousands of rows.
CREATE INDEX IF NOT EXISTS idx_financial_search_gin
  ON financial_instruments USING gin(search_vector);

-- Trigram GIN indexes for typo-tolerant fallback search on the two fields
-- most likely to be misspelled by a user (ticker and title).
CREATE INDEX IF NOT EXISTS idx_financial_ticker_trgm
  ON financial_instruments USING gin(ticker gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_financial_title_trgm
  ON financial_instruments USING gin(title gin_trgm_ops);

-- Supporting B-tree indexes for the faceted filter sidebar, so filtering by
-- category/sector/risk/price doesn't fall back to a sequential scan once
-- the dataset is combined with a search query.
CREATE INDEX IF NOT EXISTS idx_financial_category ON financial_instruments(category);
CREATE INDEX IF NOT EXISTS idx_financial_sector ON financial_instruments(sector);
CREATE INDEX IF NOT EXISTS idx_financial_risk ON financial_instruments(risk_level);
CREATE INDEX IF NOT EXISTS idx_financial_price ON financial_instruments(price);
