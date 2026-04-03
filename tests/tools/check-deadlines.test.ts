import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { handleCheckDeadlines } from '../../src/tools/check-deadlines.js';
import { createSeededDatabase } from '../helpers/seed-db.js';
import type { Database } from '../../src/db.js';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = 'tests/test-check-deadlines.db';

describe('check_deadlines tool', () => {
  let db: Database;

  beforeAll(() => {
    db = createSeededDatabase(TEST_DB);
  });

  afterAll(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  test('returns grants with deadlines', () => {
    const result = handleCheckDeadlines(db, {});
    expect(result).toHaveProperty('deadlines');
    expect((result as { grants_with_deadlines: number }).grants_with_deadlines).toBeGreaterThan(0);
  });

  test('includes rolling grants', () => {
    const result = handleCheckDeadlines(db, {}) as { deadlines: { id: string; urgency: string }[] };
    const rolling = result.deadlines.find(d => d.id === 'ewco');
    expect(rolling).toBeDefined();
    expect(rolling!.urgency).toContain('no deadline');
  });

  test('includes open grants', () => {
    const result = handleCheckDeadlines(db, {}) as { deadlines: { id: string; status: string }[] };
    const open = result.deadlines.filter(d => d.status === 'open');
    expect(open.length).toBeGreaterThan(0);
  });

  test('respects grant_type filter', () => {
    const result = handleCheckDeadlines(db, { grant_type: 'capital' }) as { deadlines: { grant_type: string }[] };
    for (const d of result.deadlines) {
      expect(d.grant_type).toBe('capital');
    }
  });

  test('rejects unsupported jurisdiction', () => {
    const result = handleCheckDeadlines(db, { jurisdiction: 'DE' });
    expect(result).toHaveProperty('error', 'jurisdiction_not_supported');
  });
});
