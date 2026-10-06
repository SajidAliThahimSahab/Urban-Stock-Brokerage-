import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Fail loudly and immediately rather than letting every query fail with a
  // confusing connection error later.
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and point it at your ' +
    'Postgres instance (local, Neon, Supabase, or Vercel Postgres all work).'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1|\[::1\]/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
});
