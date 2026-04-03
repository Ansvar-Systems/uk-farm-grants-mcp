import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import type { Database } from '../db.js';

interface EstimateArgs {
  grant_id: string;
  items?: string[];
  area_ha?: number;
  jurisdiction?: string;
}

export function handleEstimateGrantValue(db: Database, args: EstimateArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  const grant = db.get<{
    id: string;
    name: string;
    match_funding_pct: number;
    max_grant_value: number | null;
  }>(
    `SELECT id, name, match_funding_pct, max_grant_value FROM grants WHERE id = ? AND jurisdiction = ?`,
    [args.grant_id, jv.jurisdiction]
  );

  if (!grant) {
    return {
      error: 'grant_not_found',
      message: `No grant found with id '${args.grant_id}' in jurisdiction ${jv.jurisdiction}.`,
    };
  }

  let selectedItems: {
    item_code: string;
    name: string;
    grant_value: number;
    grant_unit: string;
  }[] = [];

  if (args.items && args.items.length > 0) {
    // Fetch specific items by item_code
    const placeholders = args.items.map(() => '?').join(',');
    selectedItems = db.all(
      `SELECT item_code, name, grant_value, grant_unit
       FROM grant_items
       WHERE grant_id = ? AND jurisdiction = ? AND item_code IN (${placeholders})`,
      [args.grant_id, jv.jurisdiction, ...args.items]
    );
  } else {
    // Fetch all items for this grant
    selectedItems = db.all(
      `SELECT item_code, name, grant_value, grant_unit
       FROM grant_items
       WHERE grant_id = ? AND jurisdiction = ?`,
      [args.grant_id, jv.jurisdiction]
    );
  }

  // Calculate totals
  let totalGrantValue = 0;
  const breakdown: {
    item_code: string;
    name: string;
    grant_value: number;
    grant_unit: string;
    calculated_value: number;
  }[] = [];

  for (const item of selectedItems) {
    let calcValue = item.grant_value;

    // For per-hectare items, multiply by area
    const isPerHa = item.grant_unit && (item.grant_unit.includes('/ha') || item.grant_unit.includes('per ha'));
    if (isPerHa && args.area_ha) {
      calcValue = item.grant_value * args.area_ha;
    }

    totalGrantValue += calcValue;
    breakdown.push({
      item_code: item.item_code,
      name: item.name,
      grant_value: item.grant_value,
      grant_unit: item.grant_unit,
      calculated_value: Math.round(calcValue * 100) / 100,
    });
  }

  // Apply grant cap
  const cappedValue = grant.max_grant_value
    ? Math.min(totalGrantValue, grant.max_grant_value)
    : totalGrantValue;

  const capped = grant.max_grant_value ? totalGrantValue > grant.max_grant_value : false;

  // Calculate match funding requirement
  const matchFundingRequired = grant.match_funding_pct > 0
    ? Math.round((cappedValue / (100 - grant.match_funding_pct)) * grant.match_funding_pct * 100) / 100
    : 0;

  const totalProjectCost = Math.round((cappedValue + matchFundingRequired) * 100) / 100;

  return {
    grant_id: grant.id,
    grant_name: grant.name,
    jurisdiction: jv.jurisdiction,
    items_selected: breakdown.length,
    area_ha: args.area_ha ?? null,
    breakdown,
    subtotal: Math.round(totalGrantValue * 100) / 100,
    grant_cap: grant.max_grant_value,
    capped,
    grant_value: Math.round(cappedValue * 100) / 100,
    match_funding_pct: grant.match_funding_pct,
    match_funding_required: matchFundingRequired,
    total_project_cost: totalProjectCost,
    currency: 'GBP',
    note: capped
      ? `Total exceeds the grant cap of ${grant.max_grant_value}. Grant value has been capped.`
      : undefined,
    _meta: buildMeta(),
  };
}
