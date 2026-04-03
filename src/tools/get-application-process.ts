import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import type { Database } from '../db.js';

interface ApplicationProcessArgs {
  grant_id: string;
  jurisdiction?: string;
}

export function handleGetApplicationProcess(db: Database, args: ApplicationProcessArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  const grant = db.get<{ id: string; name: string; status: string; authority: string }>(
    `SELECT id, name, status, authority FROM grants WHERE id = ? AND jurisdiction = ?`,
    [args.grant_id, jv.jurisdiction]
  );

  if (!grant) {
    return {
      error: 'grant_not_found',
      message: `No grant found with id '${args.grant_id}' in jurisdiction ${jv.jurisdiction}.`,
    };
  }

  const steps = db.all<{
    step_order: number;
    description: string;
    evidence_required: string | null;
    portal: string | null;
  }>(
    `SELECT step_order, description, evidence_required, portal
     FROM application_guidance
     WHERE grant_id = ? AND jurisdiction = ?
     ORDER BY step_order`,
    [args.grant_id, jv.jurisdiction]
  );

  return {
    grant_id: grant.id,
    grant_name: grant.name,
    status: grant.status,
    authority: grant.authority,
    total_steps: steps.length,
    steps: steps.map(s => ({
      step: s.step_order,
      description: s.description,
      evidence_required: s.evidence_required,
      portal: s.portal,
    })),
    _meta: buildMeta(),
  };
}
