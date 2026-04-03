/**
 * Regenerate data/coverage.json from the current database.
 * Usage: npm run coverage:update
 */

import { createDatabase } from '../src/db.js';
import { writeFileSync } from 'fs';

const db = createDatabase();

const grants = db.get<{ c: number }>('SELECT count(*) as c FROM grants')!.c;
const items = db.get<{ c: number }>('SELECT count(*) as c FROM grant_items')!.c;
const rules = db.get<{ c: number }>('SELECT count(*) as c FROM stacking_rules')!.c;
const guidance = db.get<{ c: number }>('SELECT count(*) as c FROM application_guidance')!.c;
const fts = db.get<{ c: number }>('SELECT count(*) as c FROM search_index')!.c;
const lastIngest = db.get<{ value: string }>('SELECT value FROM db_metadata WHERE key = ?', ['last_ingest']);

db.close();

const coverage = {
  mcp_name: 'UK Farm Grants MCP',
  jurisdiction: 'GB',
  build_date: lastIngest?.value ?? new Date().toISOString().split('T')[0],
  grants,
  grant_items: items,
  stacking_rules: rules,
  application_guidance_steps: guidance,
  fts_entries: fts,
};

writeFileSync('data/coverage.json', JSON.stringify(coverage, null, 2));
console.log('Updated data/coverage.json:', coverage);
