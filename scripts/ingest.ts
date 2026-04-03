/**
 * UK Farm Grants MCP -- Data Ingestion Script
 *
 * Sources:
 * 1. DEFRA Farming and Countryside Programme -- grant scheme details
 * 2. RPA FETF Grant Guidance -- eligible items, specifications, payment rates
 * 3. Forestry Commission EWCO -- woodland creation payments
 * 4. Natural England Countryside Stewardship -- revenue scheme details
 *
 * Grant data is published on GOV.UK as web pages and PDFs. The grant details,
 * eligible items, and payment rates are manually extracted from official sources
 * and encoded as structured data here. This is the standard approach when the
 * authoritative source is not machine-readable.
 *
 * Usage: npm run ingest
 */

import { createDatabase, type Database } from '../src/db.js';
import { mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

// ── Grant Schemes ───────────────────────────────────────────────

const GRANTS = [
  {
    id: 'fetf-2026-productivity',
    name: 'FETF 2026 - Productivity',
    grant_type: 'capital',
    authority: 'RPA',
    budget: '£50 million (shared across FETF themes)',
    status: 'open',
    open_date: '2026-02-05',
    close_date: '2026-04-28',
    description: 'Farming Equipment and Technology Fund 2026 -- Productivity theme. Capital grants for equipment that improves farm productivity through precision farming, robotics, and efficient machinery. Items are fully funded up to the grant cap.',
    eligible_applicants: 'Farmers, horticulturalists, and forestry businesses in England with BPS-eligible land registered on the Rural Payments service.',
    match_funding_pct: 0,
    max_grant_value: 50000,
  },
  {
    id: 'fetf-2026-slurry',
    name: 'FETF 2026 - Slurry',
    grant_type: 'capital',
    authority: 'RPA',
    budget: 'Part of £50m FETF allocation',
    status: 'open',
    open_date: '2026-02-05',
    close_date: '2026-04-28',
    description: 'Farming Equipment and Technology Fund 2026 -- Slurry theme. Capital grants for slurry management equipment that reduces ammonia emissions and improves nutrient use efficiency.',
    eligible_applicants: 'Farmers in England with livestock and slurry management needs, registered on the Rural Payments service.',
    match_funding_pct: 0,
    max_grant_value: 50000,
  },
  {
    id: 'fetf-2026-animal-health',
    name: 'FETF 2026 - Animal Health and Welfare',
    grant_type: 'capital',
    authority: 'RPA',
    budget: 'Part of £50m FETF allocation',
    status: 'open',
    open_date: '2026-02-05',
    close_date: '2026-04-28',
    description: 'Farming Equipment and Technology Fund 2026 -- Animal Health and Welfare theme. Capital grants for equipment that improves animal health monitoring, handling, and welfare outcomes.',
    eligible_applicants: 'Livestock farmers in England registered on the Rural Payments service.',
    match_funding_pct: 0,
    max_grant_value: 50000,
  },
  {
    id: 'capital-grants-2026',
    name: 'Farming Transformation Fund - Capital Grants 2026',
    grant_type: 'capital',
    authority: 'RPA',
    budget: '£225 million',
    status: 'upcoming',
    open_date: '2026-07-01',
    close_date: null,
    description: 'Larger capital grants for farm infrastructure, buildings, and major equipment. Requires a detailed business case and match funding. Covers water management, energy efficiency, and productivity improvements.',
    eligible_applicants: 'Farm businesses in England. Must demonstrate how the investment will improve productivity or environmental outcomes.',
    match_funding_pct: 60,
    max_grant_value: 500000,
  },
  {
    id: 'ewco',
    name: 'England Woodland Creation Offer',
    grant_type: 'revenue+capital',
    authority: 'Forestry Commission',
    budget: 'Ongoing allocation',
    status: 'rolling',
    open_date: null,
    close_date: null,
    description: 'Pays for new woodland creation in England. Covers standard creation payments per hectare (broadleaf and conifer), maintenance payments for 10 years, infrastructure costs, and additional contributions for nature recovery and water quality.',
    eligible_applicants: 'Landowners and land managers in England with eligible land not currently woodland. Minimum 1 hectare, land must not be high-grade agricultural land (Grade 1 or 2) unless justified.',
    match_funding_pct: 0,
    max_grant_value: null,
  },
  {
    id: 'cs-higher-tier',
    name: 'Countryside Stewardship Higher Tier',
    grant_type: 'revenue',
    authority: 'Natural England',
    budget: 'Demand-led',
    status: 'open',
    open_date: '2026-02-01',
    close_date: '2026-07-31',
    description: 'Revenue payments for environmental management on the most sensitive sites. Covers habitat creation and restoration, species recovery, flood risk management, and water quality improvements. Agreements typically run 5 years. Applications require a Farm Environment Record and endorsement from Natural England.',
    eligible_applicants: 'Land managers in England with sites of high environmental value (SSSIs, priority habitats, or areas identified in local targeting statements).',
    match_funding_pct: 0,
    max_grant_value: null,
  },
  {
    id: 'ftf-water',
    name: 'Farming Transformation Fund - Water Management',
    grant_type: 'capital',
    authority: 'RPA',
    budget: '£30 million',
    status: 'closed',
    open_date: '2025-06-01',
    close_date: '2025-11-30',
    description: 'Capital grants for water storage, irrigation improvements, and water efficiency measures. Required 60% match funding. Now closed -- included here for stacking reference and historical context.',
    eligible_applicants: 'Farm businesses in England growing irrigated crops.',
    match_funding_pct: 60,
    max_grant_value: 500000,
  },
  {
    id: 'tree-health-pilot',
    name: 'Tree Health Pilot Scheme',
    grant_type: 'capital',
    authority: 'Forestry Commission',
    budget: 'Ongoing allocation',
    status: 'rolling',
    open_date: null,
    close_date: null,
    description: 'Grants to support management of tree pests and diseases, including ash dieback. Covers felling diseased trees, restocking, and biosecurity measures. Rolling applications.',
    eligible_applicants: 'Woodland owners and managers in England affected by notifiable tree diseases.',
    match_funding_pct: 0,
    max_grant_value: null,
  },
];

// ── FETF Productivity Items ─────────────────────────────────────
// Source: GOV.UK FETF 2026 items list

const FETF_PRODUCTIVITY_ITEMS = [
  { id: 'fetf-pr-001', item_code: 'FETF-PR-001', name: 'Direct drill', description: 'No-till direct drill for establishing crops without ploughing. Reduces soil disturbance and improves soil health.', specification: 'Minimum 3m working width, disc or tine coulter', grant_value: 28000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-002', item_code: 'FETF-PR-002', name: 'Minimum tillage drill', description: 'Reduced tillage drill combining cultivation and drilling in one pass.', specification: 'Minimum 3m working width', grant_value: 15000, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-pr-003', item_code: 'FETF-PR-003', name: 'GPS guidance system', description: 'RTK GPS auto-steer system for tractors. Reduces overlaps and input waste.', specification: 'RTK correction, sub-inch accuracy, auto-steer capable', grant_value: 8000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-004', item_code: 'FETF-PR-004', name: 'Variable rate controller', description: 'Controller for variable rate application of seed, fertiliser, or crop protection products based on prescription maps.', specification: 'ISOBUS compatible, GPS-linked', grant_value: 5000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-005', item_code: 'FETF-PR-005', name: 'Robotic mower', description: 'Autonomous robotic mower for orchards, vineyards, or amenity grassland.', specification: 'GPS-guided, minimum 0.5 ha capacity per charge', grant_value: 25000, grant_unit: 'per item', category: 'robotics', score: 7 },
  { id: 'fetf-pr-006', item_code: 'FETF-PR-006', name: 'Automated crop walker / scout', description: 'Autonomous or semi-autonomous crop monitoring robot with sensors for disease, pest, and weed detection.', specification: 'Multi-spectral or RGB imaging, data export capability', grant_value: 30000, grant_unit: 'per item', category: 'robotics', score: 8 },
  { id: 'fetf-pr-007', item_code: 'FETF-PR-007', name: 'Precision sprayer', description: 'Spot-spray or sensor-based sprayer that targets weeds individually, reducing herbicide use by up to 90%.', specification: 'Camera or sensor-based nozzle control, minimum 12m boom', grant_value: 20000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-008', item_code: 'FETF-PR-008', name: 'Soil scanner', description: 'Vehicle-mounted soil sensor for real-time mapping of soil properties (pH, organic matter, texture, moisture).', specification: 'NIR or conductivity-based, GPS-linked, exportable maps', grant_value: 40000, grant_unit: 'per item', category: 'precision', score: 8 },
];

// ── FETF Slurry Items ───────────────────────────────────────────

const FETF_SLURRY_ITEMS = [
  { id: 'fetf-sl-001', item_code: 'FETF-SL-001', name: 'Slurry store cover', description: 'Fixed or floating cover for existing slurry stores to reduce ammonia emissions.', specification: 'Must cover entire store surface, certified for ammonia reduction', grant_value: 10000, grant_unit: 'per item', category: 'storage', score: 8 },
  { id: 'fetf-sl-002', item_code: 'FETF-SL-002', name: 'Trailing shoe applicator', description: 'Slurry application equipment that places slurry at soil level in bands, reducing ammonia losses by 30-60% compared to splash plate.', specification: 'Minimum 6m working width, shoe or dribble bar type', grant_value: 30000, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-sl-003', item_code: 'FETF-SL-003', name: 'Slurry separation equipment', description: 'Mechanical separator to split slurry into liquid and solid fractions for more targeted nutrient application.', specification: 'Screw press or roller type, minimum 10 m3/hr throughput', grant_value: 35000, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-sl-004', item_code: 'FETF-SL-004', name: 'Slurry acidification system', description: 'System to reduce slurry pH, cutting ammonia emissions during storage and application.', specification: 'In-store or in-line acidification, acid dosing and mixing', grant_value: 25000, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-sl-005', item_code: 'FETF-SL-005', name: 'New slurry store', description: 'New above-ground circular or rectangular slurry store to increase storage capacity to at least 6 months.', specification: 'Minimum 6 months storage capacity, compliant with SSAFO regulations', grant_value: 50000, grant_unit: 'per item', category: 'storage', score: 9 },
];

// ── FETF Animal Health Items ────────────────────────────────────

const FETF_ANIMAL_HEALTH_ITEMS = [
  { id: 'fetf-ah-001', item_code: 'FETF-AH-001', name: 'Cattle crush with weigh head', description: 'Fixed or mobile cattle crush with integrated electronic weigh head for routine health checks and treatment.', specification: 'Electronic weigh head with data recording, minimum 1500kg capacity', grant_value: 5500, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-002', item_code: 'FETF-AH-002', name: 'Sheep handling system', description: 'Modular sheep handling race and pen system for efficient gathering, sorting, and treatment.', specification: 'Race, drafting gate, and holding pens, minimum 50 head capacity', grant_value: 8000, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-003', item_code: 'FETF-AH-003', name: 'Automatic footbath', description: 'Automatic walk-through footbath for cattle or sheep to prevent and treat lameness.', specification: 'Automatic chemical dosing, walk-through design', grant_value: 6000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-004', item_code: 'FETF-AH-004', name: 'EID tag reader', description: 'Electronic identification tag reader (handheld or panel) for individual animal tracking and health records.', specification: 'ISO 11784/11785 compliant, Bluetooth or USB data transfer', grant_value: 2000, grant_unit: 'per item', category: 'monitoring', score: 9 },
  { id: 'fetf-ah-005', item_code: 'FETF-AH-005', name: 'Calf debudding equipment', description: 'Thermoelectric calf disbudding iron with temperature control for humane horn bud removal.', specification: 'Temperature-controlled, suitable for calves up to 8 weeks', grant_value: 500, grant_unit: 'per item', category: 'welfare', score: 6 },
];

// ── EWCO Items ──────────────────────────────────────────────────

const EWCO_ITEMS = [
  { id: 'ewco-001', item_code: 'EWCO-001', name: 'Standard creation payment - broadleaf', description: 'Payment for new broadleaf woodland creation per hectare. Covers establishment costs.', specification: 'Minimum 1 ha, minimum 1,100 trees per ha', grant_value: 8500, grant_unit: 'per ha', category: 'creation', score: null },
  { id: 'ewco-002', item_code: 'EWCO-002', name: 'Standard creation payment - conifer', description: 'Payment for new conifer woodland creation per hectare. Covers establishment costs.', specification: 'Minimum 1 ha, minimum 2,250 trees per ha for conifer', grant_value: 6800, grant_unit: 'per ha', category: 'creation', score: null },
  { id: 'ewco-003', item_code: 'EWCO-003', name: 'Maintenance payment (years 1-10)', description: 'Annual maintenance payment for the first 10 years after woodland creation. Covers weeding, beating up, and protection maintenance.', specification: 'Payable annually for 10 years following creation', grant_value: 300, grant_unit: 'per ha/year', category: 'maintenance', score: null },
  { id: 'ewco-004', item_code: 'EWCO-004', name: 'Infrastructure - fencing and gates', description: 'Contribution toward deer/stock fencing and gates needed to protect new woodland.', specification: 'Actual costs reimbursed, must be necessary for woodland establishment', grant_value: 0, grant_unit: 'actual cost', category: 'infrastructure', score: null },
  { id: 'ewco-005', item_code: 'EWCO-005', name: 'Additional contribution - nature recovery', description: 'Additional per-hectare payment for woodland creation that contributes to nature recovery (native species, connectivity, buffering protected sites).', specification: 'Native broadleaf species, located to enhance ecological connectivity', grant_value: 2800, grant_unit: 'per ha', category: 'additional', score: null },
];

// ── Capital Grants 2026 Items (representative examples) ─────────

const CAPITAL_GRANTS_ITEMS = [
  { id: 'cg-001', item_code: 'CG-001', name: 'Rainwater harvesting system', description: 'Rainwater collection and storage infrastructure for irrigation or livestock water supply.', specification: 'Minimum 50,000 litre capacity', grant_value: 20000, grant_unit: 'per item', category: 'water', score: null },
  { id: 'cg-002', item_code: 'CG-002', name: 'Reservoir construction', description: 'On-farm water storage reservoir for irrigation. Reduces reliance on abstraction.', specification: 'Minimum 5,000 m3, lined', grant_value: 250000, grant_unit: 'per item', category: 'water', score: null },
  { id: 'cg-003', item_code: 'CG-003', name: 'Solar panel array (farm buildings)', description: 'Rooftop or ground-mounted solar PV system for farm buildings.', specification: 'Grid-connected, minimum 10 kWp', grant_value: 40000, grant_unit: 'per item', category: 'energy', score: null },
];

// ── Stacking Rules ──────────────────────────────────────────────
// Based on DEFRA published guidance on combining grants

const STACKING_RULES = [
  { grant_a: 'fetf-2026-productivity', grant_b: 'capital-grants-2026', compatible: 0, conditions: 'FETF and Capital Grants cannot fund the same items. If you receive FETF for an item, you cannot claim Capital Grants for the same item or purpose.' },
  { grant_a: 'fetf-2026-productivity', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. FETF funds equipment; Countryside Stewardship pays for environmental management actions. Different purposes, no overlap.' },
  { grant_a: 'fetf-2026-slurry', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. Slurry equipment (FETF) complements environmental management (CS). No double payment for same activity.' },
  { grant_a: 'capital-grants-2026', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. Capital Grants fund infrastructure; CS pays revenue for environmental actions. Ensure no double payment for capital items already covered under CS capital options.' },
  { grant_a: 'cs-higher-tier', grant_b: 'ewco', compatible: 1, conditions: 'Compatible with restrictions. CS and EWCO can apply to different land parcels on the same holding. Cannot receive both payments for the same parcel of land.' },
  { grant_a: 'ewco', grant_b: 'fetf-2026-productivity', compatible: 1, conditions: 'Compatible. EWCO covers woodland creation; FETF covers farm equipment. Different purposes, different land use.' },
  { grant_a: 'fetf-2026-productivity', grant_b: 'fetf-2026-slurry', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },
  { grant_a: 'fetf-2026-productivity', grant_b: 'fetf-2026-animal-health', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },
  { grant_a: 'fetf-2026-slurry', grant_b: 'fetf-2026-animal-health', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },
];

// ── Application Guidance ────────────────────────────────────────

const APPLICATION_GUIDANCE = [
  // FETF Productivity
  { grant_id: 'fetf-2026-productivity', step_order: 1, description: 'Register or sign in to the Rural Payments service at gov.uk. You need a Single Business Identifier (SBI) linked to BPS-eligible land.', evidence_required: 'SBI number, Rural Payments login', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-productivity', step_order: 2, description: 'Check the published FETF items list on GOV.UK to confirm the equipment you want is eligible and note the item codes and grant values.', evidence_required: null, portal: 'https://www.gov.uk/government/collections/farming-equipment-and-technology-fund' },
  { grant_id: 'fetf-2026-productivity', step_order: 3, description: 'Submit your online application through the Rural Payments service before the closing date (28 April 2026). Select items by code and confirm eligibility declarations.', evidence_required: 'Item codes, declaration of eligibility', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-productivity', step_order: 4, description: 'If successful, you will receive a Grant Funding Agreement (GFA). Purchase items from any supplier, then submit a claim with invoices and proof of payment.', evidence_required: 'Invoices, proof of payment, photos of installed equipment', portal: 'https://www.ruralpayments.service.gov.uk/' },

  // FETF Slurry
  { grant_id: 'fetf-2026-slurry', step_order: 1, description: 'Register or sign in to the Rural Payments service. You need an SBI linked to a livestock holding.', evidence_required: 'SBI number, CPH number', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-slurry', step_order: 2, description: 'Review the FETF slurry items list on GOV.UK. Check specifications match your planned purchase.', evidence_required: null, portal: 'https://www.gov.uk/government/collections/farming-equipment-and-technology-fund' },
  { grant_id: 'fetf-2026-slurry', step_order: 3, description: 'Submit online application before 28 April 2026. Select slurry items by code.', evidence_required: 'Item codes, eligibility declarations', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-slurry', step_order: 4, description: 'On approval, purchase items and submit claim with invoices and evidence of installation.', evidence_required: 'Invoices, proof of payment, installation photos', portal: 'https://www.ruralpayments.service.gov.uk/' },

  // FETF Animal Health
  { grant_id: 'fetf-2026-animal-health', step_order: 1, description: 'Register on the Rural Payments service with your SBI and CPH number.', evidence_required: 'SBI, CPH number', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-animal-health', step_order: 2, description: 'Check the FETF animal health items list. Confirm your livestock type is eligible for the items you want.', evidence_required: null, portal: 'https://www.gov.uk/government/collections/farming-equipment-and-technology-fund' },
  { grant_id: 'fetf-2026-animal-health', step_order: 3, description: 'Submit online application before 28 April 2026.', evidence_required: 'Item codes, livestock declarations', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'fetf-2026-animal-health', step_order: 4, description: 'Purchase approved items and submit claim with supporting evidence.', evidence_required: 'Invoices, proof of payment, photos', portal: 'https://www.ruralpayments.service.gov.uk/' },

  // Capital Grants 2026
  { grant_id: 'capital-grants-2026', step_order: 1, description: 'Complete the online eligibility checker on GOV.UK when the round opens (estimated July 2026).', evidence_required: 'Business details, project outline', portal: 'https://www.gov.uk/guidance/farming-transformation-fund' },
  { grant_id: 'capital-grants-2026', step_order: 2, description: 'If eligible, submit a full application with a detailed business case, project costs, and planning permissions where required.', evidence_required: 'Business plan, cost quotes (minimum 3), planning permissions', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'capital-grants-2026', step_order: 3, description: 'RPA assesses applications against scoring criteria. Successful applicants receive a Grant Funding Agreement.', evidence_required: null, portal: null },
  { grant_id: 'capital-grants-2026', step_order: 4, description: 'Complete the project within the agreed timeframe (typically 2 years). Submit claims in tranches with evidence of expenditure.', evidence_required: 'Invoices, bank statements, project completion evidence, photos', portal: 'https://www.ruralpayments.service.gov.uk/' },

  // EWCO
  { grant_id: 'ewco', step_order: 1, description: 'Check land eligibility using the Forestry Commission online map tool. Land must not be ancient woodland, SSSI (unless agreed), or Grade 1/2 agricultural land.', evidence_required: 'Land parcels, OS grid references', portal: 'https://www.gov.uk/guidance/england-woodland-creation-offer' },
  { grant_id: 'ewco', step_order: 2, description: 'Prepare a Woodland Creation Design Plan with species mix, planting density, and maintenance schedule. Consult with Forestry Commission woodland creation officer.', evidence_required: 'Woodland Creation Design Plan, species list, planting map', portal: null },
  { grant_id: 'ewco', step_order: 3, description: 'Submit application to the Forestry Commission. Applications are processed on a rolling basis.', evidence_required: 'Design plan, landowner consent, environmental assessment', portal: 'https://www.gov.uk/guidance/england-woodland-creation-offer' },
  { grant_id: 'ewco', step_order: 4, description: 'On approval, plant trees according to the agreed plan. Claim creation payment after planting verification.', evidence_required: 'Planting completion evidence, verification visit', portal: null },
  { grant_id: 'ewco', step_order: 5, description: 'Claim annual maintenance payments for years 1-10 by confirming the woodland is being maintained (weeding, beating up failed trees, fence maintenance).', evidence_required: 'Annual maintenance declaration', portal: null },

  // CS Higher Tier
  { grant_id: 'cs-higher-tier', step_order: 1, description: 'Contact Natural England to discuss your site and agree which Higher Tier options are appropriate.', evidence_required: 'Site details, Farm Environment Record (FER)', portal: 'https://www.gov.uk/government/collections/countryside-stewardship' },
  { grant_id: 'cs-higher-tier', step_order: 2, description: 'Complete a Farm Environment Record (FER) identifying environmental features on your land.', evidence_required: 'FER, habitat maps', portal: null },
  { grant_id: 'cs-higher-tier', step_order: 3, description: 'Submit Higher Tier application through the Rural Payments service before the deadline (31 July 2026).', evidence_required: 'FER, management plan, endorsement from Natural England', portal: 'https://www.ruralpayments.service.gov.uk/' },
  { grant_id: 'cs-higher-tier', step_order: 4, description: 'If accepted, sign a 5-year agreement. Annual revenue payments are made automatically based on declared option areas.', evidence_required: 'Annual declarations', portal: 'https://www.ruralpayments.service.gov.uk/' },

  // Tree Health Pilot
  { grant_id: 'tree-health-pilot', step_order: 1, description: 'Confirm you have woodland affected by a notifiable tree disease (e.g. ash dieback, Phytophthora ramorum).', evidence_required: 'Woodland location, disease identification', portal: 'https://www.gov.uk/guidance/tree-health-pilot-scheme' },
  { grant_id: 'tree-health-pilot', step_order: 2, description: 'Contact the Forestry Commission to discuss management options and apply for a felling licence if required.', evidence_required: 'Felling licence application', portal: null },
  { grant_id: 'tree-health-pilot', step_order: 3, description: 'Submit application with a management plan covering felling, restocking, and biosecurity measures.', evidence_required: 'Management plan, restocking proposal', portal: 'https://www.gov.uk/guidance/tree-health-pilot-scheme' },
];

// ── Ingestion Logic ─────────────────────────────────────────────

function ingest(db: Database): void {
  const tx = db.instance.transaction(() => {
    // Clear existing data
    db.run('DELETE FROM search_index');
    db.run('DELETE FROM application_guidance');
    db.run('DELETE FROM stacking_rules');
    db.run('DELETE FROM grant_items');
    db.run('DELETE FROM grants');

    // Insert grants
    const insertGrant = db.instance.prepare(
      `INSERT INTO grants (id, name, grant_type, authority, budget, status, open_date, close_date, description, eligible_applicants, match_funding_pct, max_grant_value, jurisdiction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const g of GRANTS) {
      insertGrant.run(g.id, g.name, g.grant_type, g.authority, g.budget, g.status, g.open_date, g.close_date, g.description, g.eligible_applicants, g.match_funding_pct, g.max_grant_value, 'GB');
    }

    // Insert grant items
    const insertItem = db.instance.prepare(
      `INSERT INTO grant_items (id, grant_id, item_code, name, description, specification, grant_value, grant_unit, category, score, jurisdiction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const allItems = [
      ...FETF_PRODUCTIVITY_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-productivity' })),
      ...FETF_SLURRY_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-slurry' })),
      ...FETF_ANIMAL_HEALTH_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-animal-health' })),
      ...EWCO_ITEMS.map(i => ({ ...i, grant_id: 'ewco' })),
      ...CAPITAL_GRANTS_ITEMS.map(i => ({ ...i, grant_id: 'capital-grants-2026' })),
    ];

    for (const i of allItems) {
      insertItem.run(i.id, i.grant_id, i.item_code, i.name, i.description, i.specification, i.grant_value, i.grant_unit, i.category, i.score, 'GB');
    }

    // Insert stacking rules
    const insertRule = db.instance.prepare(
      `INSERT INTO stacking_rules (grant_a, grant_b, compatible, conditions, jurisdiction)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const r of STACKING_RULES) {
      insertRule.run(r.grant_a, r.grant_b, r.compatible, r.conditions, 'GB');
    }

    // Insert application guidance
    const insertGuidance = db.instance.prepare(
      `INSERT INTO application_guidance (grant_id, step_order, description, evidence_required, portal, jurisdiction)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const g of APPLICATION_GUIDANCE) {
      insertGuidance.run(g.grant_id, g.step_order, g.description, g.evidence_required, g.portal, 'GB');
    }

    // Build FTS5 search index
    const insertSearch = db.instance.prepare(
      `INSERT INTO search_index (title, body, grant_type, jurisdiction) VALUES (?, ?, ?, ?)`
    );

    // Index grants
    for (const g of GRANTS) {
      insertSearch.run(
        g.name,
        `${g.description} Eligible applicants: ${g.eligible_applicants}. Authority: ${g.authority}. Budget: ${g.budget}. Status: ${g.status}.`,
        g.grant_type,
        'GB'
      );
    }

    // Index grant items
    for (const i of allItems) {
      const grant = GRANTS.find(g => g.id === i.grant_id);
      insertSearch.run(
        `${i.name} -- ${grant?.name ?? i.grant_id}`,
        `${i.description} Specification: ${i.specification}. Grant value: £${i.grant_value} ${i.grant_unit}. Category: ${i.category}. Item code: ${i.item_code}.`,
        grant?.grant_type ?? 'capital',
        'GB'
      );
    }

    // Update metadata
    const now = new Date().toISOString().split('T')[0];
    db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('last_ingest', ?)", [now]);
    db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('build_date', ?)", [now]);
  });

  tx();
}

function computeSourceHash(): string {
  const content = JSON.stringify({ GRANTS, FETF_PRODUCTIVITY_ITEMS, FETF_SLURRY_ITEMS, FETF_ANIMAL_HEALTH_ITEMS, EWCO_ITEMS, CAPITAL_GRANTS_ITEMS, STACKING_RULES, APPLICATION_GUIDANCE });
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ── Main ────────────────────────────────────────────────────────

mkdirSync('data', { recursive: true });
const db = createDatabase('data/database.db');

console.log('Ingesting UK farm grants data...');
ingest(db);

// Count records
const grantCount = db.get<{ c: number }>('SELECT count(*) as c FROM grants')!.c;
const itemCount = db.get<{ c: number }>('SELECT count(*) as c FROM grant_items')!.c;
const ruleCount = db.get<{ c: number }>('SELECT count(*) as c FROM stacking_rules')!.c;
const guidanceCount = db.get<{ c: number }>('SELECT count(*) as c FROM application_guidance')!.c;
const ftsCount = db.get<{ c: number }>('SELECT count(*) as c FROM search_index')!.c;

console.log(`Ingested: ${grantCount} grants, ${itemCount} items, ${ruleCount} stacking rules, ${guidanceCount} guidance steps, ${ftsCount} FTS entries`);

// Write coverage.json
const sourceHash = computeSourceHash();
const coverage = {
  mcp_name: 'UK Farm Grants MCP',
  jurisdiction: 'GB',
  build_date: new Date().toISOString().split('T')[0],
  grants: grantCount,
  grant_items: itemCount,
  stacking_rules: ruleCount,
  application_guidance_steps: guidanceCount,
  fts_entries: ftsCount,
  source_hash: sourceHash,
};
writeFileSync('data/coverage.json', JSON.stringify(coverage, null, 2));

// Write source hashes
writeFileSync('data/.source-hashes.json', JSON.stringify({ source_hash: sourceHash }, null, 2));

db.close();
console.log('Done. Database at data/database.db');
