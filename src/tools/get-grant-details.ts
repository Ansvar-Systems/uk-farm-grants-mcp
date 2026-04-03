import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import type { Database } from '../db.js';

interface GrantDetailsArgs {
  grant_id: string;
  jurisdiction?: string;
}

export function handleGetGrantDetails(db: Database, args: GrantDetailsArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  const grant = db.get<{
    id: string;
    name: string;
    grant_type: string;
    authority: string;
    budget: string;
    status: string;
    open_date: string;
    close_date: string;
    description: string;
    eligible_applicants: string;
    match_funding_pct: number;
    max_grant_value: number;
  }>(
    `SELECT * FROM grants WHERE id = ? AND jurisdiction = ?`,
    [args.grant_id, jv.jurisdiction]
  );

  if (!grant) {
    return {
      error: 'grant_not_found',
      message: `No grant found with id '${args.grant_id}' in jurisdiction ${jv.jurisdiction}.`,
    };
  }

  const itemCount = db.get<{ c: number }>(
    `SELECT count(*) as c FROM grant_items WHERE grant_id = ? AND jurisdiction = ?`,
    [args.grant_id, jv.jurisdiction]
  );

  return {
    ...grant,
    eligible_items_count: itemCount?.c ?? 0,
    match_funding_note: grant.match_funding_pct > 0
      ? `You must provide ${grant.match_funding_pct}% match funding. The grant covers ${100 - grant.match_funding_pct}% of eligible costs.`
      : 'Fully funded -- no match funding required.',
    _meta: buildMeta({ source_url: 'https://www.gov.uk/guidance/funding-for-farmers' }),
  };
}
