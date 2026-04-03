import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import { ftsSearch, type Database } from '../db.js';

interface SearchArgs {
  query: string;
  grant_type?: string;
  min_value?: number;
  jurisdiction?: string;
  limit?: number;
}

export function handleSearchGrants(db: Database, args: SearchArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  const limit = Math.min(args.limit ?? 20, 50);
  let results = ftsSearch(db, args.query, limit);

  if (args.grant_type) {
    results = results.filter(r => r.grant_type.toLowerCase() === args.grant_type!.toLowerCase());
  }

  // If min_value specified, also query grants table to filter by max_grant_value
  let grantMatches: { id: string; name: string; max_grant_value: number | null }[] = [];
  if (args.min_value !== undefined) {
    grantMatches = db.all(
      `SELECT id, name, max_grant_value FROM grants
       WHERE jurisdiction = ? AND max_grant_value >= ?`,
      [jv.jurisdiction, args.min_value]
    );
    const matchIds = new Set(grantMatches.map(g => g.name));
    results = results.filter(r => matchIds.has(r.title.split(' -- ')[0]) || matchIds.has(r.title));
  }

  return {
    query: args.query,
    jurisdiction: jv.jurisdiction,
    results_count: results.length,
    results: results.map(r => ({
      title: r.title,
      body: r.body,
      grant_type: r.grant_type,
      relevance_rank: r.rank,
    })),
    _meta: buildMeta(),
  };
}
