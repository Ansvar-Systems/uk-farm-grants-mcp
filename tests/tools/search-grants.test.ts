import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { handleSearchGrants } from '../../src/tools/search-grants.js';
import { createSeededDatabase } from '../helpers/seed-db.js';
import type { Database } from '../../src/db.js';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = 'tests/test-search-grants.db';

describe('search_grants tool', () => {
  let db: Database;

  beforeAll(() => {
    db = createSeededDatabase(TEST_DB);
  });

  afterAll(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  test('returns results for precision query', () => {
    const result = handleSearchGrants(db, { query: 'precision' });
    expect(result).toHaveProperty('results_count');
    expect((result as { results_count: number }).results_count).toBeGreaterThan(0);
  });

  test('returns results for drill query', () => {
    const result = handleSearchGrants(db, { query: 'drill' });
    expect(result).toHaveProperty('results_count');
    expect((result as { results_count: number }).results_count).toBeGreaterThan(0);
  });

  test('respects grant_type filter', () => {
    const result = handleSearchGrants(db, { query: 'capital grants equipment', grant_type: 'capital' });
    if ('results' in result) {
      for (const r of (result as { results: { grant_type: string }[] }).results) {
        expect(r.grant_type).toBe('capital');
      }
    }
  });

  test('rejects unsupported jurisdiction', () => {
    const result = handleSearchGrants(db, { query: 'drill', jurisdiction: 'FR' });
    expect(result).toHaveProperty('error', 'jurisdiction_not_supported');
  });
});
