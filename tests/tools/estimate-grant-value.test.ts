import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { handleEstimateGrantValue } from '../../src/tools/estimate-grant-value.js';
import { createSeededDatabase } from '../helpers/seed-db.js';
import type { Database } from '../../src/db.js';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = 'tests/test-estimate-value.db';

describe('estimate_grant_value tool', () => {
  let db: Database;

  beforeAll(() => {
    db = createSeededDatabase(TEST_DB);
  });

  afterAll(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  test('calculates total for selected items', () => {
    const result = handleEstimateGrantValue(db, {
      grant_id: 'fetf-2026-productivity',
      items: ['FETF-PR-001', 'FETF-PR-003'],
    });
    // 28000 + 8000 = 36000
    expect((result as { grant_value: number }).grant_value).toBe(36000);
    expect((result as { items_selected: number }).items_selected).toBe(2);
    expect((result as { match_funding_required: number }).match_funding_required).toBe(0);
  });

  test('applies grant cap when exceeded', () => {
    // All 3 items: 28000 + 8000 + 25000 = 61000, cap is 50000
    const result = handleEstimateGrantValue(db, {
      grant_id: 'fetf-2026-productivity',
    });
    expect((result as { subtotal: number }).subtotal).toBe(61000);
    expect((result as { grant_value: number }).grant_value).toBe(50000);
    expect((result as { capped: boolean }).capped).toBe(true);
  });

  test('calculates match funding for capital grants', () => {
    const result = handleEstimateGrantValue(db, {
      grant_id: 'capital-grants-2026',
    });
    // Capital grants: 60% match funding (40% grant)
    // No items seeded for capital-grants-2026, so value is 0
    expect((result as { match_funding_pct: number }).match_funding_pct).toBe(60);
  });

  test('calculates per-hectare items with area', () => {
    const result = handleEstimateGrantValue(db, {
      grant_id: 'ewco',
      items: ['EWCO-001'],
      area_ha: 10,
    });
    // 8500/ha * 10 ha = 85000
    expect((result as { grant_value: number }).grant_value).toBe(85000);
  });

  test('returns error for unknown grant', () => {
    const result = handleEstimateGrantValue(db, { grant_id: 'nonexistent' });
    expect(result).toHaveProperty('error', 'grant_not_found');
  });

  test('rejects unsupported jurisdiction', () => {
    const result = handleEstimateGrantValue(db, { grant_id: 'fetf-2026-productivity', jurisdiction: 'NL' });
    expect(result).toHaveProperty('error', 'jurisdiction_not_supported');
  });
});
