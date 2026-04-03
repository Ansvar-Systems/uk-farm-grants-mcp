import { createDatabase, type Database } from '../../src/db.js';

export function createSeededDatabase(dbPath: string): Database {
  const db = createDatabase(dbPath);

  // Grants
  db.run(
    `INSERT INTO grants (id, name, grant_type, authority, budget, status, open_date, close_date, description, eligible_applicants, match_funding_pct, max_grant_value, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['fetf-2026-productivity', 'FETF 2026 - Productivity', 'capital', 'RPA', '£50 million', 'open', '2026-02-05', '2026-04-28', 'Farming Equipment and Technology Fund 2026 -- Productivity theme.', 'Farmers in England with BPS-eligible land.', 0, 50000, 'GB']
  );
  db.run(
    `INSERT INTO grants (id, name, grant_type, authority, budget, status, open_date, close_date, description, eligible_applicants, match_funding_pct, max_grant_value, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['fetf-2026-slurry', 'FETF 2026 - Slurry', 'capital', 'RPA', 'Part of £50m FETF', 'open', '2026-02-05', '2026-04-28', 'FETF 2026 Slurry theme.', 'Livestock farmers in England.', 0, 50000, 'GB']
  );
  db.run(
    `INSERT INTO grants (id, name, grant_type, authority, budget, status, open_date, close_date, description, eligible_applicants, match_funding_pct, max_grant_value, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ewco', 'England Woodland Creation Offer', 'revenue+capital', 'Forestry Commission', 'Ongoing', 'rolling', null, null, 'Woodland creation payments.', 'Landowners in England.', 0, null, 'GB']
  );
  db.run(
    `INSERT INTO grants (id, name, grant_type, authority, budget, status, open_date, close_date, description, eligible_applicants, match_funding_pct, max_grant_value, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['capital-grants-2026', 'Capital Grants 2026', 'capital', 'RPA', '£225 million', 'upcoming', '2026-07-01', null, 'Larger capital grants.', 'Farm businesses in England.', 60, 500000, 'GB']
  );

  // Grant items
  db.run(
    `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['fetf-pr-001', 'fetf-2026-productivity', 'FETF-PR-001', 'Direct drill', 'No-till direct drill', 'Min 3m width', 28000, 'per item', 'precision', 8, 'GB']
  );
  db.run(
    `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['fetf-pr-003', 'fetf-2026-productivity', 'FETF-PR-003', 'GPS guidance system', 'RTK GPS auto-steer', 'RTK sub-inch', 8000, 'per item', 'precision', 9, 'GB']
  );
  db.run(
    `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['fetf-pr-005', 'fetf-2026-productivity', 'FETF-PR-005', 'Robotic mower', 'Autonomous robotic mower', 'GPS-guided', 25000, 'per item', 'robotics', 7, 'GB']
  );
  db.run(
    `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ewco-001', 'ewco', 'EWCO-001', 'Standard creation payment - broadleaf', 'Broadleaf creation', 'Min 1 ha', 8500, 'per ha', 'creation', null, 'GB']
  );
  db.run(
    `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ewco-003', 'ewco', 'EWCO-003', 'Maintenance payment (years 1-10)', 'Annual maintenance', 'Payable annually', 300, 'per ha/year', 'maintenance', null, 'GB']
  );

  // Stacking rules
  db.run(
    `INSERT INTO stacking_rules (grant_a, grant_b, compatible, conditions, jurisdiction)
     VALUES (?, ?, ?, ?, ?)`,
    ['fetf-2026-productivity', 'capital-grants-2026', 0, 'Cannot fund same items.', 'GB']
  );
  db.run(
    `INSERT INTO stacking_rules (grant_a, grant_b, compatible, conditions, jurisdiction)
     VALUES (?, ?, ?, ?, ?)`,
    ['fetf-2026-productivity', 'fetf-2026-slurry', 1, 'Different FETF themes can be combined, capped at £50,000 total.', 'GB']
  );
  db.run(
    `INSERT INTO stacking_rules (grant_a, grant_b, compatible, conditions, jurisdiction)
     VALUES (?, ?, ?, ?, ?)`,
    ['ewco', 'fetf-2026-productivity', 1, 'Compatible. Different purposes.', 'GB']
  );

  // Application guidance
  db.run(
    `INSERT INTO application_guidance (grant_id, step_order, description, evidence_required, portal, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['fetf-2026-productivity', 1, 'Register on Rural Payments service.', 'SBI number', 'https://www.ruralpayments.service.gov.uk/', 'GB']
  );
  db.run(
    `INSERT INTO application_guidance (grant_id, step_order, description, evidence_required, portal, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['fetf-2026-productivity', 2, 'Check eligible items list.', null, 'https://www.gov.uk/', 'GB']
  );

  // FTS5 search index
  db.run(
    `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`,
    ['FETF 2026 - Productivity', 'Farming Equipment and Technology Fund 2026 Productivity theme. Capital grants for precision farming equipment.', 'capital', 'GB']
  );
  db.run(
    `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`,
    ['Direct drill -- FETF 2026 - Productivity', 'No-till direct drill for establishing crops. Grant value £28,000. Category: precision.', 'capital', 'GB']
  );
  db.run(
    `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`,
    ['GPS guidance system -- FETF 2026 - Productivity', 'RTK GPS auto-steer system for tractors. Grant value £8,000. Category: precision.', 'capital', 'GB']
  );
  db.run(
    `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`,
    ['England Woodland Creation Offer', 'Woodland creation payments per hectare, broadleaf and conifer.', 'revenue+capital', 'GB']
  );
  db.run(
    `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`,
    ['FETF 2026 - Slurry', 'FETF slurry theme. Trailing shoe applicator, slurry store cover, separation equipment.', 'capital', 'GB']
  );

  // Metadata
  db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_ingest', ?)", [new Date().toISOString().split('T')[0]]);

  return db;
}
