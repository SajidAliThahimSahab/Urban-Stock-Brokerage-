// Run with: npm run db:schema
// Applies schema.sql (table, triggers, GIN/trigram/B-tree indexes) to
// whatever database DATABASE_URL points at. Safe to re-run — every
// statement in schema.sql uses CREATE ... IF NOT EXISTS or CREATE OR
// REPLACE.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
  console.log('Applying schema.sql...');
  await pool.query(sql);
  console.log('Schema applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});
