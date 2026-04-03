import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import type { Database } from '../db.js';

interface EligibleItemsArgs {
  grant_id: string;
  category?: string;
  jurisdiction?: string;
}

export function handleGetEligibleItems(db: Database, args: EligibleItemsArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  // Verify grant exists
  const grant = db.get<{ id: string; name: string; max_grant_value: number }>(
    `SELECT id, name, max_grant_value FROM grants WHERE id = ? AND jurisdiction = ?`,
    [args.grant_id, jv.jurisdiction]
  );

  if (!grant) {
    return {
      error: 'grant_not_found',
      message: `No grant found with id '${args.grant_id}' in jurisdiction ${jv.jurisdiction}.`,
    };
  }

  let query = `SELECT id, item_code, name, description, specification, grant_value, grant_unit, category, score
               FROM grant_items
               WHERE grant_id = ? AND jurisdiction = ?`;
  const params: unknown[] = [args.grant_id, jv.jurisdiction];

  if (args.category) {
    query += ` AND LOWER(category) = LOWER(?)`;
    params.push(args.category);
  }

  query += ` ORDER BY category, item_code`;

  const items = db.all<{
    id: string;
    item_code: string;
    name: string;
    description: string;
    specification: string;
    grant_value: number;
    grant_unit: string;
    category: string;
    score: number | null;
  }>(query, params);

  // Group by category
  const categories: Record<string, typeof items> = {};
  for (const item of items) {
    const cat = item.category || 'uncategorised';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  return {
    grant_id: args.grant_id,
    grant_name: grant.name,
    max_grant_value: grant.max_grant_value,
    jurisdiction: jv.jurisdiction,
    total_items: items.length,
    categories: Object.keys(categories).length,
    items_by_category: categories,
    _meta: buildMeta(),
  };
}
