import { buildMeta } from '../metadata.js';
import { validateJurisdiction } from '../jurisdiction.js';
import type { Database } from '../db.js';

interface DeadlineArgs {
  grant_type?: string;
  jurisdiction?: string;
}

interface GrantDeadline {
  id: string;
  name: string;
  grant_type: string;
  authority: string;
  status: string;
  open_date: string | null;
  close_date: string | null;
  days_remaining: number | null;
  urgency: string;
}

export function handleCheckDeadlines(db: Database, args: DeadlineArgs) {
  const jv = validateJurisdiction(args.jurisdiction);
  if (!jv.valid) return jv.error;

  let query = `SELECT id, name, grant_type, authority, status, open_date, close_date
               FROM grants
               WHERE jurisdiction = ? AND status IN ('open', 'upcoming', 'rolling')`;
  const params: unknown[] = [jv.jurisdiction];

  if (args.grant_type) {
    query += ` AND grant_type = ?`;
    params.push(args.grant_type);
  }

  query += ` ORDER BY CASE WHEN close_date IS NULL THEN 1 ELSE 0 END, close_date ASC`;

  const rows = db.all<{
    id: string;
    name: string;
    grant_type: string;
    authority: string;
    status: string;
    open_date: string | null;
    close_date: string | null;
  }>(query, params);

  const now = new Date();
  const deadlines: GrantDeadline[] = rows.map(r => {
    let daysRemaining: number | null = null;
    let urgency = 'no deadline';

    if (r.close_date) {
      const closeDate = new Date(r.close_date);
      daysRemaining = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        urgency = 'closed';
      } else if (daysRemaining <= 14) {
        urgency = 'closing soon';
      } else if (daysRemaining <= 30) {
        urgency = 'approaching';
      } else {
        urgency = 'open';
      }
    } else if (r.status === 'rolling') {
      urgency = 'rolling -- no deadline';
    }

    return {
      id: r.id,
      name: r.name,
      grant_type: r.grant_type,
      authority: r.authority,
      status: r.status,
      open_date: r.open_date,
      close_date: r.close_date,
      days_remaining: daysRemaining,
      urgency,
    };
  });

  return {
    jurisdiction: jv.jurisdiction,
    checked_at: now.toISOString().split('T')[0],
    grants_with_deadlines: deadlines.length,
    deadlines,
    _meta: buildMeta(),
  };
}
