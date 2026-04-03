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

// ── FETF Productivity Items (internal) ──────────────────────────
// Source: GOV.UK FETF 2026 items list -- Productivity theme

const FETF_PRODUCTIVITY_ITEMS = [
  // Precision farming
  { id: 'fetf-pr-001', item_code: 'FETF-PR-001', name: 'Direct drill', description: 'No-till direct drill for establishing crops without ploughing. Reduces soil disturbance and improves soil health.', specification: 'Minimum 3m working width, disc or tine coulter', grant_value: 28000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-002', item_code: 'FETF-PR-002', name: 'Minimum tillage drill', description: 'Reduced tillage drill combining cultivation and drilling in one pass.', specification: 'Minimum 3m working width', grant_value: 15000, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-pr-003', item_code: 'FETF-PR-003', name: 'GPS guidance system', description: 'RTK GPS auto-steer system for tractors. Reduces overlaps and input waste.', specification: 'RTK correction, sub-inch accuracy, auto-steer capable', grant_value: 8000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-004', item_code: 'FETF-PR-004', name: 'Variable rate controller', description: 'Controller for variable rate application of seed, fertiliser, or crop protection products based on prescription maps.', specification: 'ISOBUS compatible, GPS-linked', grant_value: 5000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-005', item_code: 'FETF-PR-005', name: 'Robotic mower', description: 'Autonomous robotic mower for orchards, vineyards, or amenity grassland.', specification: 'GPS-guided, minimum 0.5 ha capacity per charge', grant_value: 25000, grant_unit: 'per item', category: 'robotics', score: 7 },
  { id: 'fetf-pr-006', item_code: 'FETF-PR-006', name: 'Automated crop walker / scout', description: 'Autonomous or semi-autonomous crop monitoring robot with sensors for disease, pest, and weed detection.', specification: 'Multi-spectral or RGB imaging, data export capability', grant_value: 30000, grant_unit: 'per item', category: 'robotics', score: 8 },
  { id: 'fetf-pr-007', item_code: 'FETF-PR-007', name: 'Precision sprayer', description: 'Spot-spray or sensor-based sprayer that targets weeds individually, reducing herbicide use by up to 90%.', specification: 'Camera or sensor-based nozzle control, minimum 12m boom', grant_value: 20000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-008', item_code: 'FETF-PR-008', name: 'Soil scanner', description: 'Vehicle-mounted soil sensor for real-time mapping of soil properties (pH, organic matter, texture, moisture).', specification: 'NIR or conductivity-based, GPS-linked, exportable maps', grant_value: 40000, grant_unit: 'per item', category: 'precision', score: 8 },
  // Yield and crop monitoring
  { id: 'fetf-pr-009', item_code: 'FETF-PR-009', name: 'Yield mapping equipment', description: 'Combine-mounted yield monitor and mapping system for recording spatial yield data across fields.', specification: 'GPS-linked, mass flow sensor, moisture correction, exportable data', grant_value: 10000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-010', item_code: 'FETF-PR-010', name: 'Auto-steer system (RTK)', description: 'Retrofit RTK auto-steer steering kit for existing tractors. Provides centimetre-level accuracy for all field operations.', specification: 'RTK GNSS, sub-2.5cm pass-to-pass accuracy, hydraulic or electric motor steering', grant_value: 15000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-011', item_code: 'FETF-PR-011', name: 'Drone for crop monitoring', description: 'Unmanned aerial vehicle (UAV) for crop scouting, mapping canopy health, and assessing crop establishment.', specification: 'Multispectral or NDVI camera, minimum 30 min flight time, GIS-compatible output', grant_value: 10000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-012', item_code: 'FETF-PR-012', name: 'Soil moisture sensor system', description: 'Network of in-field soil moisture probes for irrigation scheduling and drought monitoring.', specification: 'Minimum 3 probes, wireless telemetry, cloud dashboard, multi-depth measurement', grant_value: 5000, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-pr-013', item_code: 'FETF-PR-013', name: 'Weather station (farm)', description: 'On-farm automatic weather station recording temperature, rainfall, humidity, wind speed, and solar radiation.', specification: 'Wireless data upload, minimum 5 sensors, disease prediction software compatible', grant_value: 4000, grant_unit: 'per item', category: 'precision', score: 6 },
  { id: 'fetf-pr-014', item_code: 'FETF-PR-014', name: 'Grain moisture meter (portable)', description: 'Portable grain moisture meter for testing moisture content at harvest and in store.', specification: 'Accuracy +/- 0.5%, multiple crop calibrations, digital display', grant_value: 1000, grant_unit: 'per item', category: 'arable', score: 5 },
  // Arable and crop processing
  { id: 'fetf-pr-015', item_code: 'FETF-PR-015', name: 'Grain cleaning equipment', description: 'Grain cleaner or dresser for removing weed seeds, chaff, and contaminants from harvested grain.', specification: 'Minimum 5 t/hr throughput, aspiration and sieve system', grant_value: 12000, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-pr-016', item_code: 'FETF-PR-016', name: 'Seed treatment equipment', description: 'Mobile or static seed treatment unit for applying fungicide, insecticide, or biological treatments to seed before drilling.', specification: 'Calibrated dosing, enclosed mixing, suitable for multiple seed types', grant_value: 6000, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-pr-017', item_code: 'FETF-PR-017', name: 'Band sprayer', description: 'Band or inter-row sprayer for targeted herbicide application in row crops, reducing chemical use by 50-70%.', specification: 'Minimum 6m working width, band nozzles at row spacing, GPS section control', grant_value: 18000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-018', item_code: 'FETF-PR-018', name: 'Mechanical weeder', description: 'Tractor-mounted mechanical weeder for inter-row or full-width weed control without herbicides.', specification: 'Minimum 3m working width, camera or GPS guidance for row following', grant_value: 12000, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-pr-019', item_code: 'FETF-PR-019', name: 'Undersowing equipment', description: 'Specialist undersowing attachment or drill for establishing cover crops or herbal leys into standing crops.', specification: 'Suitable for mounting on existing cultivation equipment, minimum 3m width', grant_value: 8000, grant_unit: 'per item', category: 'arable', score: 6 },
  // Horticulture
  { id: 'fetf-pr-020', item_code: 'FETF-PR-020', name: 'Fruit and veg harvesting aid', description: 'Mechanical harvesting platform or conveyor system for soft fruit, top fruit, or field vegetables.', specification: 'Self-propelled or tractor-mounted, adjustable height, minimum 2 picking positions', grant_value: 15000, grant_unit: 'per item', category: 'horticulture', score: 7 },
  { id: 'fetf-pr-021', item_code: 'FETF-PR-021', name: 'Polytunnel or protected cropping structure', description: 'Walk-in polytunnel or multi-span tunnel for protected cropping of fruit, vegetables, or nursery stock.', specification: 'Minimum 100m2 ground area, UV-stabilised polythene, ventilation', grant_value: 25000, grant_unit: 'per item', category: 'horticulture', score: 7 },
  { id: 'fetf-pr-022', item_code: 'FETF-PR-022', name: 'Packhouse grading and washing equipment', description: 'Post-harvest grading line, washing system, or sorting equipment for fresh produce.', specification: 'Minimum 1 t/hr throughput, food-grade materials, adjustable grading parameters', grant_value: 20000, grant_unit: 'per item', category: 'horticulture', score: 7 },
  // Water and irrigation
  { id: 'fetf-pr-023', item_code: 'FETF-PR-023', name: 'Efficient irrigation system', description: 'Drip irrigation, trickle tape, or precision sprinkler system to replace less efficient flood or rain-gun irrigation.', specification: 'Pressure-compensated emitters, filter system, minimum 1 ha coverage', grant_value: 12000, grant_unit: 'per item', category: 'water', score: 8 },
  { id: 'fetf-pr-024', item_code: 'FETF-PR-024', name: 'Rainwater harvesting system (small)', description: 'Rainwater collection from farm building roofs for livestock water or crop irrigation, reducing mains water use.', specification: 'Minimum 10,000 litre storage, first-flush diverter, pump and filtration', grant_value: 8000, grant_unit: 'per item', category: 'water', score: 7 },
  // Livestock productivity
  { id: 'fetf-pr-025', item_code: 'FETF-PR-025', name: 'Livestock weighing equipment', description: 'Platform or crate scales for routine weighing of cattle, sheep, or pigs with electronic recording.', specification: 'Electronic weigh head, minimum 2000kg capacity (cattle) or 200kg (sheep), data recording', grant_value: 4000, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-pr-026', item_code: 'FETF-PR-026', name: 'RFID/EID reading equipment', description: 'Fixed or portable panel reader for electronic identification tags, enabling automated recording of animal movements and weights.', specification: 'ISO 11784/11785, Bluetooth data transfer, compatible with herd/flock management software', grant_value: 3000, grant_unit: 'per item', category: 'livestock', score: 8 },
  { id: 'fetf-pr-027', item_code: 'FETF-PR-027', name: 'Automated feeding system', description: 'Programmable feed dispensing system for cattle, sheep, or pigs. Delivers rations based on individual animal requirements.', specification: 'EID-linked, programmable rations, minimum 50 head capacity', grant_value: 20000, grant_unit: 'per item', category: 'livestock', score: 8 },
  { id: 'fetf-pr-028', item_code: 'FETF-PR-028', name: 'Solar-powered water pump', description: 'Solar panel and pump kit for supplying livestock drinking water to remote troughs without mains electricity.', specification: 'Minimum 50W solar panel, submersible or surface pump, float valve', grant_value: 3000, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-pr-029', item_code: 'FETF-PR-029', name: 'Electric fencing (permanent, solar)', description: 'Permanent electric fencing system with solar energiser for rotational grazing or stock containment.', specification: 'Solar energiser minimum 1 joule output, permanent posts, minimum 500m', grant_value: 3000, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-pr-030', item_code: 'FETF-PR-030', name: 'Grain store monitoring system', description: 'Temperature and humidity monitoring system for grain stores with remote alerting.', specification: 'Minimum 4 temperature probes, wireless telemetry, alarm thresholds', grant_value: 3000, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-pr-031', item_code: 'FETF-PR-031', name: 'Grain drying equipment', description: 'On-farm continuous-flow or batch grain dryer for reducing moisture content post-harvest.', specification: 'Minimum 5 t/hr drying capacity, temperature control, moisture monitoring', grant_value: 40000, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-pr-032', item_code: 'FETF-PR-032', name: 'Variable rate fertiliser spreader', description: 'GPS-controlled fertiliser spreader with automatic rate adjustment from prescription maps.', specification: 'ISOBUS section control, GPS-linked, minimum 12m spread width, weigh cells', grant_value: 18000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-033', item_code: 'FETF-PR-033', name: 'Crop sensor (canopy)', description: 'Tractor-mounted or handheld canopy sensor for measuring crop biomass and nitrogen status in real time.', specification: 'NDVI or equivalent vegetation index, GPS-tagged readings, ISOBUS integration', grant_value: 8000, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-pr-034', item_code: 'FETF-PR-034', name: 'Cover crop drill', description: 'Specialist drill or broadcaster designed for establishing cover crops after harvest, including into stubble.', specification: 'Suitable for small seeds, minimum 3m width, can operate in uncultivated stubble', grant_value: 10000, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-pr-035', item_code: 'FETF-PR-035', name: 'Compost turner', description: 'Tractor-mounted or self-propelled compost windrow turner for on-farm composting of green waste or FYM.', specification: 'Minimum 2m windrow width, PTO or self-propelled', grant_value: 15000, grant_unit: 'per item', category: 'arable', score: 5 },
  { id: 'fetf-pr-036', item_code: 'FETF-PR-036', name: 'Lime spreader (GPS)', description: 'GPS-controlled lime or calcium application equipment with variable rate capability.', specification: 'GPS section control, minimum 6m spread width, rate adjustment from soil maps', grant_value: 12000, grant_unit: 'per item', category: 'precision', score: 6 },
  { id: 'fetf-pr-037', item_code: 'FETF-PR-037', name: 'Autonomous weeding robot', description: 'Fully autonomous weeding robot using cameras and AI to detect and destroy weeds mechanically or with micro-dose spot spray.', specification: 'Camera-based weed detection, minimum 0.5 ha/hr, autonomous navigation', grant_value: 45000, grant_unit: 'per item', category: 'robotics', score: 8 },
  { id: 'fetf-pr-038', item_code: 'FETF-PR-038', name: 'Fruit tree pruning platform', description: 'Self-propelled or tractor-mounted elevated work platform for orchard pruning, picking, and canopy management.', specification: 'Minimum 3m working height, all-terrain capable, safety harness points', grant_value: 18000, grant_unit: 'per item', category: 'horticulture', score: 6 },
  // Additional productivity items
  { id: 'fetf-pr-039', item_code: 'FETF-PR-039', name: 'Variable rate seed drill', description: 'Drill with GPS-controlled variable rate seeding capability, adjusting seed rate based on prescription maps for optimised plant populations.', specification: 'ISOBUS compatible, GPS section control, variable rate 50-400 seeds/m2, minimum 3m width', grant_value: 22000, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-pr-040', item_code: 'FETF-PR-040', name: 'Optical grain sorter', description: 'Automated optical sorting machine for grain, separating by colour, size, and quality to remove contaminants, mycotoxin-affected kernels, and foreign material.', specification: 'Camera or NIR based, minimum 2 t/hr throughput, reject bin, food-grade materials', grant_value: 25000, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-pr-041', item_code: 'FETF-PR-041', name: 'Automated livestock ventilation control', description: 'Automated environmental control system for livestock buildings, managing fans, inlets, and cooling based on temperature, humidity, and CO2 sensors.', specification: 'Multiple sensor inputs, automated fan speed control, alarm system, smartphone monitoring', grant_value: 10000, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-pr-042', item_code: 'FETF-PR-042', name: 'Camera-based weed detection sprayer', description: 'Spot-spray system using real-time camera and AI to identify and target individual weeds with micro-doses, reducing herbicide use by up to 95%.', specification: 'Camera per nozzle or section, AI weed identification, minimum 12m boom, individual nozzle control', grant_value: 30000, grant_unit: 'per item', category: 'precision', score: 9 },
  { id: 'fetf-pr-043', item_code: 'FETF-PR-043', name: 'Forage analysis system (NIR)', description: 'Portable or in-line NIR analyser for rapid forage and silage quality assessment (dry matter, protein, energy, fibre).', specification: 'NIR-based, field-portable or harvester-mounted, calibrated for UK forages', grant_value: 8000, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-pr-044', item_code: 'FETF-PR-044', name: 'Electrostatic sprayer', description: 'Electrostatic crop sprayer providing superior droplet coverage and adhesion, reducing spray volume and drift.', specification: 'Electrostatic charging at nozzle, minimum 6m boom, adjustable droplet size', grant_value: 15000, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-pr-045', item_code: 'FETF-PR-045', name: 'Automated egg collection system', description: 'Automated belt or chain egg collection system for poultry houses, reducing labour and egg damage.', specification: 'Belt or chain conveyor, gentle handling, capacity matched to flock size, packing station interface', grant_value: 12000, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-pr-046', item_code: 'FETF-PR-046', name: 'Robotic milking arm (upgrade component)', description: 'Teat detection and attachment module or arm upgrade for existing automatic milking systems to improve attachment speed and reliability.', specification: 'Compatible with existing AMS, laser or camera-based teat detection, self-cleaning', grant_value: 35000, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-pr-047', item_code: 'FETF-PR-047', name: 'Tramline management system', description: 'GPS-controlled tramline system for managing permanent wheelings across fields, reducing random compaction.', specification: 'GPS-linked, compatible with multiple implements, automatic tramline switching', grant_value: 5000, grant_unit: 'per item', category: 'precision', score: 6 },
  { id: 'fetf-pr-048', item_code: 'FETF-PR-048', name: 'Soil health testing kit (biological)', description: 'Soil biological activity testing kit for measuring earthworm counts, respiration rate, and microbial biomass as soil health indicators.', specification: 'Portable field kit, CO2 burst test or equivalent, recording forms', grant_value: 500, grant_unit: 'per item', category: 'precision', score: 5 },
];

// ── FETF Slurry Items (internal) ────────────────────────────────
// Source: GOV.UK FETF 2026 items list -- Slurry theme

const FETF_SLURRY_ITEMS = [
  { id: 'fetf-sl-001', item_code: 'FETF-SL-001', name: 'Slurry store cover', description: 'Fixed or floating cover for existing slurry stores to reduce ammonia emissions.', specification: 'Must cover entire store surface, certified for ammonia reduction', grant_value: 10000, grant_unit: 'per item', category: 'storage', score: 8 },
  { id: 'fetf-sl-002', item_code: 'FETF-SL-002', name: 'Trailing shoe applicator', description: 'Slurry application equipment that places slurry at soil level in bands, reducing ammonia losses by 30-60% compared to splash plate.', specification: 'Minimum 6m working width, shoe or dribble bar type', grant_value: 30000, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-sl-003', item_code: 'FETF-SL-003', name: 'Slurry separation equipment', description: 'Mechanical separator to split slurry into liquid and solid fractions for more targeted nutrient application.', specification: 'Screw press or roller type, minimum 10 m3/hr throughput', grant_value: 35000, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-sl-004', item_code: 'FETF-SL-004', name: 'Slurry acidification system', description: 'System to reduce slurry pH, cutting ammonia emissions during storage and application.', specification: 'In-store or in-line acidification, acid dosing and mixing', grant_value: 25000, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-sl-005', item_code: 'FETF-SL-005', name: 'New slurry store', description: 'New above-ground circular or rectangular slurry store to increase storage capacity to at least 6 months.', specification: 'Minimum 6 months storage capacity, compliant with SSAFO regulations', grant_value: 50000, grant_unit: 'per item', category: 'storage', score: 9 },
  // New slurry items
  { id: 'fetf-sl-006', item_code: 'FETF-SL-006', name: 'Slurry sampling equipment', description: 'Portable slurry sampling kit and analysis system for testing nutrient content (N, P, K) before field application.', specification: 'NIR or lab-calibrated, portable, results within 24 hours', grant_value: 1500, grant_unit: 'per item', category: 'analysis', score: 7 },
  { id: 'fetf-sl-007', item_code: 'FETF-SL-007', name: 'Flow meter for slurry application', description: 'In-line flow meter fitted to slurry tanker or umbilical system for accurate measurement of application rate per hectare.', specification: 'Electromagnetic or Coriolis type, GPS-linked, minimum accuracy +/- 5%', grant_value: 3500, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-sl-008', item_code: 'FETF-SL-008', name: 'Dribble bar applicator', description: 'Low-level dribble bar for applying slurry in narrow bands on the soil surface, reducing ammonia volatilisation compared to splash plate.', specification: 'Minimum 6m working width, individual outlet pipes, anti-drip valves', grant_value: 20000, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-sl-009', item_code: 'FETF-SL-009', name: 'Umbilical slurry system', description: 'Drag-hose (umbilical) slurry application system for applying slurry without tanker compaction. Pumps slurry from store via long hose to field applicator.', specification: 'Minimum 100m hose length, suitable for trailing shoe or dribble bar, pump minimum 50 m3/hr', grant_value: 35000, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-sl-010', item_code: 'FETF-SL-010', name: 'Slurry lagoon cover (floating)', description: 'Floating cover for earth-banked slurry lagoons to reduce ammonia and odour emissions during storage.', specification: 'Covers entire lagoon surface, UV-resistant, anchored against wind', grant_value: 12000, grant_unit: 'per item', category: 'storage', score: 7 },
  { id: 'fetf-sl-011', item_code: 'FETF-SL-011', name: 'Slurry stirrer / agitator', description: 'Electric or hydraulic slurry store agitator for mixing slurry before pumping and application, ensuring consistent nutrient content.', specification: 'Suitable for stores over 500 m3, submersible or top-mount, variable speed', grant_value: 6000, grant_unit: 'per item', category: 'processing', score: 6 },
  { id: 'fetf-sl-012', item_code: 'FETF-SL-012', name: 'Weeping wall system', description: 'Weeping wall (passive separation) system for farmyard manure, allowing liquid to drain through a permeable wall into a collection channel.', specification: 'Minimum 10m wall length, concrete base and collection channel, permeable wall panels', grant_value: 18000, grant_unit: 'per item', category: 'processing', score: 6 },
  { id: 'fetf-sl-013', item_code: 'FETF-SL-013', name: 'Solid/liquid separation tank', description: 'Settlement tank or reception pit for gravity separation of slurry into solid and liquid fractions before storage.', specification: 'Minimum 20 m3 capacity, outlet at two levels, SSAFO-compliant construction', grant_value: 10000, grant_unit: 'per item', category: 'processing', score: 6 },
  { id: 'fetf-sl-014', item_code: 'FETF-SL-014', name: 'Slurry injection system (shallow)', description: 'Shallow disc injector for placing slurry directly into the soil surface, near-eliminating ammonia emissions.', specification: 'Minimum 4m working width, disc injection to 50mm depth, suitable for grassland', grant_value: 28000, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-sl-015', item_code: 'FETF-SL-015', name: 'Automatic store level monitor', description: 'Ultrasonic or pressure-based level monitor for slurry stores with remote alerts when approaching capacity.', specification: 'Wireless telemetry, smartphone alerts, accuracy +/- 5cm', grant_value: 1500, grant_unit: 'per item', category: 'storage', score: 5 },
  // Additional slurry items
  { id: 'fetf-sl-016', item_code: 'FETF-SL-016', name: 'Slurry pH testing equipment', description: 'Portable pH meter and testing kit for monitoring slurry acidity, helping optimise acidification treatment and application timing.', specification: 'Portable pH probe rated for slurry, temperature compensation, accuracy +/- 0.1 pH', grant_value: 800, grant_unit: 'per item', category: 'analysis', score: 5 },
  { id: 'fetf-sl-017', item_code: 'FETF-SL-017', name: 'Slurry tanker with DRIBBLE bar', description: 'Vacuum tanker fitted with dribble bar for low-emission slurry application during field spreading.', specification: 'Minimum 10,000 litre capacity, dribble bar minimum 6m, GPS rate control optional', grant_value: 40000, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-sl-018', item_code: 'FETF-SL-018', name: 'Slurry transfer pump (electric)', description: 'Fixed or portable electric transfer pump for moving slurry between stores or to application equipment, reducing reliance on tractor PTO.', specification: 'Minimum 30 m3/hr flow rate, electric motor, chopper impeller for long fibres', grant_value: 8000, grant_unit: 'per item', category: 'processing', score: 6 },
  { id: 'fetf-sl-019', item_code: 'FETF-SL-019', name: 'Dirty water separation system', description: 'System for separating lightly contaminated yard washings from concentrated slurry, allowing dirty water to be applied to land with shorter closed period.', specification: 'Gravity or pump-based separation, compliant with NVZ rules, minimum 5 m3/hr', grant_value: 15000, grant_unit: 'per item', category: 'processing', score: 7 },
];

// ── FETF Animal Health Items (internal) ─────────────────────────
// Source: GOV.UK FETF 2026 items list -- Animal Health and Welfare theme

const FETF_ANIMAL_HEALTH_ITEMS = [
  { id: 'fetf-ah-001', item_code: 'FETF-AH-001', name: 'Cattle crush with weigh head', description: 'Fixed or mobile cattle crush with integrated electronic weigh head for routine health checks and treatment.', specification: 'Electronic weigh head with data recording, minimum 1500kg capacity', grant_value: 5500, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-002', item_code: 'FETF-AH-002', name: 'Sheep handling system', description: 'Modular sheep handling race and pen system for efficient gathering, sorting, and treatment.', specification: 'Race, drafting gate, and holding pens, minimum 50 head capacity', grant_value: 8000, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-003', item_code: 'FETF-AH-003', name: 'Automatic footbath', description: 'Automatic walk-through footbath for cattle or sheep to prevent and treat lameness.', specification: 'Automatic chemical dosing, walk-through design', grant_value: 6000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-004', item_code: 'FETF-AH-004', name: 'EID tag reader', description: 'Electronic identification tag reader (handheld or panel) for individual animal tracking and health records.', specification: 'ISO 11784/11785 compliant, Bluetooth or USB data transfer', grant_value: 2000, grant_unit: 'per item', category: 'monitoring', score: 9 },
  { id: 'fetf-ah-005', item_code: 'FETF-AH-005', name: 'Calf debudding equipment', description: 'Thermoelectric calf disbudding iron with temperature control for humane horn bud removal.', specification: 'Temperature-controlled, suitable for calves up to 8 weeks', grant_value: 500, grant_unit: 'per item', category: 'welfare', score: 6 },
  // New animal health items
  { id: 'fetf-ah-006', item_code: 'FETF-AH-006', name: 'Automatic cattle weighing crate', description: 'Walk-over or walk-through automatic weighing crate that records individual cattle weights via EID without manual handling.', specification: 'EID-linked, automatic data capture, minimum 2000kg capacity, walk-through design', grant_value: 12000, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-007', item_code: 'FETF-AH-007', name: 'Sheep race with auto-drafting gates', description: 'Sheep race fitted with electronic drafting gates linked to EID reader for automatic sorting by weight, age, or health status.', specification: 'EID-linked drafting, minimum 3-way sort, minimum 200 head/hr throughput', grant_value: 10000, grant_unit: 'per item', category: 'handling', score: 8 },
  { id: 'fetf-ah-008', item_code: 'FETF-AH-008', name: 'Calf jackets (bulk purchase)', description: 'Insulated calf jackets for maintaining body temperature in newborn and young calves, reducing cold stress and mortality.', specification: 'Waterproof outer, fleece lining, adjustable straps, minimum 20 jackets', grant_value: 800, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-009', item_code: 'FETF-AH-009', name: 'Livestock camera monitoring system', description: 'CCTV or IP camera system for remote monitoring of livestock housing, calving pens, or lambing sheds.', specification: 'Night vision, minimum 2 cameras, remote viewing via smartphone, recording capability', grant_value: 3500, grant_unit: 'per item', category: 'monitoring', score: 7 },
  { id: 'fetf-ah-010', item_code: 'FETF-AH-010', name: 'Automatic heat detection system', description: 'Collar, ear tag, or pedometer-based system for detecting oestrus in dairy or beef cattle, improving conception rates.', specification: 'Activity monitoring, rumination tracking, alerts to smartphone, minimum 50 units', grant_value: 10000, grant_unit: 'per item', category: 'monitoring', score: 8 },
  { id: 'fetf-ah-011', item_code: 'FETF-AH-011', name: 'Lameness scoring system', description: 'Automated lameness detection system using camera or floor-sensor technology to identify lame cattle early.', specification: 'Camera or pressure-mat based, automated scoring, individual cow identification', grant_value: 6000, grant_unit: 'per item', category: 'monitoring', score: 7 },
  { id: 'fetf-ah-012', item_code: 'FETF-AH-012', name: 'Milk recording equipment', description: 'In-line milk meters or portable milk recording jars for individual cow yield and quality recording.', specification: 'ICAR-approved, individual cow yield measurement, conductivity or SCC indicator', grant_value: 4000, grant_unit: 'per item', category: 'monitoring', score: 7 },
  { id: 'fetf-ah-013', item_code: 'FETF-AH-013', name: 'Automatic teat sprayer', description: 'Post-milking automatic teat disinfection sprayer fitted to parlour exit for consistent application of teat dip.', specification: 'Individual quarter coverage, adjustable spray pattern, chemical metering', grant_value: 5000, grant_unit: 'per item', category: 'welfare', score: 6 },
  { id: 'fetf-ah-014', item_code: 'FETF-AH-014', name: 'Parlour cluster flush system', description: 'Automatic cluster flushing system for cleaning milking units between cows, reducing mastitis transmission.', specification: 'Hot water or peracetic acid flush, automatic activation, per-cluster operation', grant_value: 4000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-015', item_code: 'FETF-AH-015', name: 'Bulk tank cooling optimisation', description: 'Upgrade or retrofit for bulk milk tank cooling to improve energy efficiency and milk quality. Includes pre-cooling plate heat exchangers.', specification: 'Plate heat exchanger, variable speed compressor or ice-bank system', grant_value: 5000, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-016', item_code: 'FETF-AH-016', name: 'Automatic calf feeder', description: 'Computerised calf feeder dispensing milk or milk replacer to individual calves in controlled portions via EID.', specification: 'EID recognition, programmable feed curves, minimum 25 calf capacity, cleaning cycle', grant_value: 8000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-017', item_code: 'FETF-AH-017', name: 'Poultry environmental control system', description: 'Automated ventilation, heating, and humidity control system for poultry houses to maintain optimal welfare conditions.', specification: 'Temperature and humidity sensors, automated fan and heater control, alarm system', grant_value: 10000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-018', item_code: 'FETF-AH-018', name: 'Free-range poultry veranda', description: 'Covered outdoor veranda or winter garden attached to poultry house, providing sheltered outdoor access during housing orders.', specification: 'Minimum 2m depth, full house length, mesh sides, solid roof', grant_value: 18000, grant_unit: 'per item', category: 'welfare', score: 7 },
  { id: 'fetf-ah-019', item_code: 'FETF-AH-019', name: 'Pig environmental enrichment', description: 'Permanent enrichment devices and rootable substrates dispensers for pig housing, meeting welfare requirements.', specification: 'Durable, replaceable, minimum 10 units, dispensing or hanging type', grant_value: 2000, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-020', item_code: 'FETF-AH-020', name: 'Livestock ventilation fan (ACNV)', description: 'Automatically controlled natural ventilation (ACNV) fan system for livestock buildings, improving air quality and reducing heat stress.', specification: 'Thermostatically controlled, minimum 1.2m diameter, ridge or wall mount, variable speed', grant_value: 5000, grant_unit: 'per item', category: 'welfare', score: 6 },
  // Additional animal health items
  { id: 'fetf-ah-021', item_code: 'FETF-AH-021', name: 'Sheep foot trimming cradle', description: 'Hydraulic or manual sheep foot trimming cradle for safe, ergonomic hoof trimming and treatment.', specification: 'Adjustable restraint, safe rollover or tilt design, suitable for breeds up to 100kg', grant_value: 3500, grant_unit: 'per item', category: 'handling', score: 6 },
  { id: 'fetf-ah-022', item_code: 'FETF-AH-022', name: 'Calving camera system', description: 'Dedicated calving pen camera with night vision and smartphone alerts for detecting early signs of calving, reducing calf mortality.', specification: 'IR night vision, motion detection, tail-lift alert sensors, minimum 2 cameras, mobile app', grant_value: 2500, grant_unit: 'per item', category: 'monitoring', score: 7 },
  { id: 'fetf-ah-023', item_code: 'FETF-AH-023', name: 'Mastitis rapid test kit', description: 'Rapid on-farm mastitis pathogen identification kit for targeted antibiotic treatment, supporting responsible antibiotic use.', specification: 'Results within 24 hours, identifies major mastitis pathogens, minimum 50 test cassettes', grant_value: 1500, grant_unit: 'per item', category: 'monitoring', score: 7 },
  { id: 'fetf-ah-024', item_code: 'FETF-AH-024', name: 'Livestock water trough thermostat', description: 'Frost-free water trough heating element with thermostat, ensuring continuous drinking water access in winter.', specification: 'Thermostatically controlled, energy-efficient, suitable for outdoor troughs, minimum 5 units', grant_value: 1000, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-025', item_code: 'FETF-AH-025', name: 'Cattle brush (automatic)', description: 'Automatic rotating cattle brush for self-grooming, improving cow comfort and reducing ectoparasites and stress.', specification: 'Rotating brush, automatic start on contact, wall or post mount, minimum 1 unit', grant_value: 1200, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-026', item_code: 'FETF-AH-026', name: 'SCC (somatic cell count) inline sensor', description: 'In-line milk sensor for real-time somatic cell count estimation during milking, enabling early mastitis detection per quarter.', specification: 'Optical or conductivity-based, per-quarter measurement, integration with herd management software', grant_value: 6000, grant_unit: 'per item', category: 'monitoring', score: 8 },
  { id: 'fetf-ah-027', item_code: 'FETF-AH-027', name: 'Lamb warming box', description: 'Electric or gas-heated lamb warming box for reviving hypothermic newborn lambs, reducing lamb mortality.', specification: 'Thermostatically controlled, minimum 2 lamb capacity, easy-clean surfaces', grant_value: 800, grant_unit: 'per item', category: 'welfare', score: 5 },
  { id: 'fetf-ah-028', item_code: 'FETF-AH-028', name: 'Pig farrowing monitoring system', description: 'Camera and sensor-based farrowing monitoring for detecting when sows begin farrowing, alerting stockpeople to attend.', specification: 'Camera per crate, activity detection, smartphone alerts, suitable for minimum 10 crates', grant_value: 5000, grant_unit: 'per item', category: 'monitoring', score: 7 },
];

// ── Official FETF Published Items (GOV.UK) ─────────────────────
// Source: GOV.UK Annex 3 & 4 — FETF 2023 Productivity, Slurry, and Animal Health
// These are the official RPA-published item lists with real item codes and
// grant values. Mapped to the 2026 grant scheme structure. Item codes use
// the official FETF numbering (FETF1, FETF26, FETF56, etc.).
//
// Productivity & Slurry: https://www.gov.uk/government/publications/farming-equipment-and-technology-fund-fetf-2023/annex-3-fetf-2023-productivity-and-slurry-eligible-items
// Animal Health: https://www.gov.uk/government/publications/farming-equipment-and-technology-fund-fetf-2023/annex-4-fetf-2023-animal-health-and-welfare-eligible-items

const FETF_OFFICIAL_PRODUCTIVITY_ITEMS = [
  // Horticulture
  { id: 'fetf-off-001', item_code: 'FETF1', name: 'Electronic tray filling machine', description: 'Automatic tray filling machine for horticultural nurseries, filling module or plug trays with growing media at consistent density.', specification: 'Electronic control, adjustable fill depth, minimum 200 trays/hr', grant_value: 5938, grant_unit: 'per item', category: 'horticulture', score: 6 },
  { id: 'fetf-off-002', item_code: 'FETF2', name: 'Electronic row seeder', description: 'Precision vacuum seeder for sowing individual seeds into module trays at specified spacing.', specification: 'Electronic vacuum, programmable spacing, multiple nozzle heads', grant_value: 10470, grant_unit: 'per item', category: 'horticulture', score: 7 },
  { id: 'fetf-off-003', item_code: 'FETF3', name: 'Five row seeder', description: 'Manual or semi-automatic five-row seeder for direct sowing of vegetable and salad crops in the field.', specification: 'Five row, adjustable spacing, belt or plate drive', grant_value: 670, grant_unit: 'per item', category: 'horticulture', score: 5 },
  { id: 'fetf-off-004', item_code: 'FETF4', name: 'Paper pot transplanter', description: 'Transplanting machine using paper chain pot system for rapid transplanting of vegetable seedlings at exact spacing.', specification: 'Compatible with standard paper pot chains, adjustable row width', grant_value: 542, grant_unit: 'per item', category: 'horticulture', score: 5 },
  { id: 'fetf-off-005', item_code: 'FETF5', name: 'Inter row weeders 1.8m', description: 'Tractor-mounted inter-row weeder for mechanical weed control in vegetable and horticultural crops, 1.8m working width.', specification: '1.8m working width, adjustable tines or blades, camera guidance optional', grant_value: 24139, grant_unit: 'per item', category: 'horticulture', score: 8 },
  { id: 'fetf-off-006', item_code: 'FETF6', name: 'Inter row hoe 3m', description: 'Tractor-mounted inter-row hoe for mechanical weed control in row crops, 3m working width.', specification: '3m working width, adjustable hoe blades, parallelogram linkage', grant_value: 9015, grant_unit: 'per item', category: 'horticulture', score: 7 },
  { id: 'fetf-off-007', item_code: 'FETF7', name: 'Inter row hoe 6m', description: 'Tractor-mounted inter-row hoe for large-scale mechanical weed control, 6m working width.', specification: '6m working width, hydraulic folding, camera or GPS guidance', grant_value: 22745, grant_unit: 'per item', category: 'horticulture', score: 8 },
  { id: 'fetf-off-008', item_code: 'FETF8', name: 'Salad leaf harvester', description: 'Mechanical harvester for cutting and collecting baby leaf salad crops in the field.', specification: 'Adjustable cutting height, collection conveyor, minimum 1m cutting width', grant_value: 1027, grant_unit: 'per item', category: 'horticulture', score: 6 },
  { id: 'fetf-off-009', item_code: 'FETF9', name: 'Mobile vertical frost fans', description: 'Mobile frost protection fans for horticultural crops, mixing warmer air from above the inversion layer to protect crops from frost damage.', specification: 'Mobile unit, minimum 5m tower height, petrol or electric drive', grant_value: 4776, grant_unit: 'per item', category: 'horticulture', score: 6 },
  { id: 'fetf-off-010', item_code: 'FETF10', name: 'Fruit ripeness spectrometers', description: 'Handheld or in-line spectrometer for non-destructive measurement of fruit ripeness, sugar content (Brix), and quality.', specification: 'NIR spectrometer, portable, calibrated for key fruit species', grant_value: 2448, grant_unit: 'per item', category: 'horticulture', score: 6 },
  { id: 'fetf-off-011', item_code: 'FETF200P', name: 'Tractor mounted flail mulcher (large)', description: 'Large tractor-mounted flail mulcher for managing crop residues, cover crops, and green manures.', specification: 'PTO-driven, minimum 2m working width, adjustable height', grant_value: 960, grant_unit: 'per item', category: 'horticulture', score: 5 },

  // Forestry
  { id: 'fetf-off-012', item_code: 'FETF11', name: 'Forestry mounder', description: 'Excavator-mounted mounding head for preparing planting sites in forestry, creating raised mounds for tree planting.', specification: 'Excavator-mounted, adjustable mound size, suitable for restock sites', grant_value: 12280, grant_unit: 'per item', category: 'forestry', score: 7 },
  { id: 'fetf-off-013', item_code: 'FETF12', name: 'Smaller self-propelled forwarders', description: 'Compact self-propelled timber forwarder for extracting timber from woodland to roadside in small-scale forestry operations.', specification: 'Self-propelled, maximum 8 tonne payload, suitable for thinning operations', grant_value: 24467, grant_unit: 'per item', category: 'forestry', score: 7 },
  { id: 'fetf-off-014', item_code: 'FETF13', name: 'Harvesting head', description: 'Harvesting head attachment for excavator or forwarder for felling, delimbing, and cross-cutting trees in forestry operations.', specification: 'Suitable for trees up to 400mm diameter, feed rollers, measuring system', grant_value: 16079, grant_unit: 'per item', category: 'forestry', score: 7 },
  { id: 'fetf-off-015', item_code: 'FETF14', name: 'Tree shears (300mm)', description: 'Hydraulic tree shears for felling trees up to 300mm diameter, mounted on excavator or skid steer.', specification: '300mm maximum cutting diameter, hydraulic drive, quick-attach compatible', grant_value: 3219, grant_unit: 'per item', category: 'forestry', score: 5 },
  { id: 'fetf-off-016', item_code: 'FETF15', name: 'Tree shears (650mm)', description: 'Heavy-duty hydraulic tree shears for felling larger trees up to 650mm diameter.', specification: '650mm maximum cutting diameter, hydraulic drive, accumulator', grant_value: 11000, grant_unit: 'per item', category: 'forestry', score: 6 },
  { id: 'fetf-off-017', item_code: 'FETF16', name: 'Forestry grab/grapple', description: 'Hydraulic timber grab or grapple for loading, stacking, and handling timber.', specification: 'Hydraulic rotation, minimum 0.2m2 grab area, suitable for round timber', grant_value: 1198, grant_unit: 'per item', category: 'forestry', score: 5 },
  { id: 'fetf-off-018', item_code: 'FETF17', name: 'Timber cranes', description: 'Hydraulic knuckle-boom crane for loading timber onto trailers and lorries.', specification: 'Hydraulic, minimum 3m reach, suitable for mounting on trailer or truck', grant_value: 5391, grant_unit: 'per item', category: 'forestry', score: 6 },
  { id: 'fetf-off-019', item_code: 'FETF18', name: 'Forestry/timber trailers small', description: 'Small forestry trailer for transporting timber from woodland to processing or storage.', specification: 'Maximum 6 tonne capacity, bolsters, suitable for tractor towing', grant_value: 3425, grant_unit: 'per item', category: 'forestry', score: 5 },
  { id: 'fetf-off-020', item_code: 'FETF19', name: 'Forestry/timber trailers large', description: 'Large forestry trailer for transporting timber, with integrated crane or grapple loading.', specification: 'Minimum 8 tonne capacity, hydraulic bolsters, crane-ready', grant_value: 4800, grant_unit: 'per item', category: 'forestry', score: 6 },
  { id: 'fetf-off-021', item_code: 'FETF20', name: 'Timber winches', description: 'PTO-driven or hydraulic timber winch for extracting timber from difficult terrain.', specification: 'Minimum 3 tonne pulling capacity, wire rope, PTO or hydraulic drive', grant_value: 3400, grant_unit: 'per item', category: 'forestry', score: 5 },
  { id: 'fetf-off-022', item_code: 'FETF201P', name: 'Automatic tree planter', description: 'Tractor-mounted automatic tree planting machine for efficient restock and new woodland planting.', specification: 'Tractor-mounted, minimum 500 trees/hr planting rate, adjustable spacing', grant_value: 23732, grant_unit: 'per item', category: 'forestry', score: 7 },
  { id: 'fetf-off-023', item_code: 'FETF202P', name: 'Forestry mulcher', description: 'Tractor or excavator-mounted forestry mulcher for clearing brash, stumps, and undergrowth before replanting.', specification: 'PTO or hydraulic drive, minimum 1.5m working width, suitable for stumps up to 200mm', grant_value: 4492, grant_unit: 'per item', category: 'forestry', score: 6 },

  // Arable
  { id: 'fetf-off-024', item_code: 'FETF44', name: 'Direct drill 3m', description: 'No-till direct drill for establishing arable crops without prior cultivation, 3m working width.', specification: '3m working width, disc or tine coulters, press wheels', grant_value: 12054, grant_unit: 'per item', category: 'arable', score: 8 },
  { id: 'fetf-off-025', item_code: 'FETF205P', name: 'Direct drill 4m', description: 'No-till direct drill for establishing arable crops, 4m working width for larger fields.', specification: '4m working width, disc or tine coulters, press wheels, transport width under 3m', grant_value: 14276, grant_unit: 'per item', category: 'arable', score: 8 },
  { id: 'fetf-off-026', item_code: 'FETF45', name: 'Direct drill 6m', description: 'Large no-till direct drill for establishing arable crops at scale, 6m working width.', specification: '6m working width, hydraulic folding, disc coulters, press wheels, GPS section control', grant_value: 18720, grant_unit: 'per item', category: 'arable', score: 8 },
  { id: 'fetf-off-027', item_code: 'FETF206P', name: 'Direct drill with fertiliser (3m)', description: 'Combined direct drill and fertiliser placement unit for one-pass establishment with starter fertiliser.', specification: '3m working width, separate seed and fertiliser metering, placement boots', grant_value: 25000, grant_unit: 'per item', category: 'arable', score: 8 },
  { id: 'fetf-off-028', item_code: 'FETF207P', name: 'Air drill for cover crops', description: 'Pneumatic seed broadcaster or drill for establishing cover crops into standing crops or stubble.', specification: 'Air-assisted delivery, suitable for small seeds, minimum 3m application width', grant_value: 796, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-029', item_code: 'FETF51', name: 'Retro fitted yield monitoring', description: 'Retrofit yield monitoring kit for combine harvesters, enabling field-level yield mapping.', specification: 'Mass flow sensor, GPS, moisture sensor, compatible with existing combines, data export', grant_value: 1373, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-off-030', item_code: 'FETF54', name: 'Continuous grain dryer controls', description: 'Retrofit automatic control system for continuous-flow grain dryers, optimising energy use and grain quality.', specification: 'Temperature and moisture sensors, automatic burner and airflow control, data logging', grant_value: 2094, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-031', item_code: 'FETF55', name: 'Grain stirrers', description: 'Auger-type grain stirring system for floor-stored grain, preventing hot spots and improving ventilation efficiency.', specification: 'Multiple augers, timer or temperature-controlled operation, suitable for floor stores', grant_value: 7934, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-032', item_code: 'FETF208P', name: 'Tractor mounted stubble rake (6m)', description: 'Tractor-mounted stubble rake for shallow cultivation and weed germination after harvest.', specification: '6m working width, adjustable tine angle, suitable for stubble management', grant_value: 5800, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-033', item_code: 'FETF209P', name: 'Inter row companion drills (3m)', description: 'Companion crop or inter-row drill for establishing secondary crops between rows of the main crop.', specification: '3m working width, adjustable row spacing, suitable for legume companions', grant_value: 13400, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-off-034', item_code: 'FETF210P', name: 'Inter row companion drills (6m)', description: 'Large companion crop drill for inter-row sowing at scale, 6m working width.', specification: '6m working width, hydraulic folding, adjustable row spacing', grant_value: 13400, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-off-035', item_code: 'FETF211P', name: 'Liquid fertiliser applicator (3m)', description: 'Tractor-mounted liquid fertiliser applicator for precise nutrient placement, 3m working width.', specification: '3m working width, dribble bar or injection, GPS rate control', grant_value: 6362, grant_unit: 'per item', category: 'arable', score: 7 },
  { id: 'fetf-off-036', item_code: 'FETF212P', name: 'Liquid fertiliser applicator (6m)', description: 'Large liquid fertiliser applicator for field-scale nutrient placement, 6m working width.', specification: '6m working width, dribble bar or injection, GPS rate control, section control', grant_value: 7354, grant_unit: 'per item', category: 'arable', score: 7 },

  // Livestock productivity
  { id: 'fetf-off-037', item_code: 'FETF52', name: 'Pasture plate meter', description: 'Rising plate meter for measuring grass height and estimating dry matter yield for grazing management decisions.', specification: 'Calibrated rising plate, electronic counter, data recording and export', grant_value: 232, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-off-038', item_code: 'FETF84', name: 'Chemical free disinfection system', description: 'Electrolysed water or UV-based disinfection system for livestock housing and equipment without chemical residues.', specification: 'Generates disinfectant from water and salt, portable or fixed, food-safe', grant_value: 15000, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-off-039', item_code: 'FETF88', name: 'Heat and service detector', description: 'Tail-paint, scratch card, or mount detector device for visual detection of oestrus activity in cattle.', specification: 'Visual indicator, suitable for dairy or beef cattle', grant_value: 438, grant_unit: 'per item', category: 'livestock', score: 5 },
  { id: 'fetf-off-040', item_code: 'FETF89', name: 'Calving detector', description: 'Intravaginal or tail-mounted sensor for detecting the onset of calving and sending alerts to the farmer.', specification: 'Wireless alert to smartphone, temperature or pressure sensor', grant_value: 92, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-off-041', item_code: 'FETF90', name: 'Heat detection system base unit', description: 'Base station/receiver unit for automated oestrus detection systems using collar or ear tag sensors.', specification: 'Receiver/base unit, compatible with collar or tag sensors, farm management software integration', grant_value: 740, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-off-042', item_code: 'FETF91', name: 'Heat detection system ear tag/collar', description: 'Individual ear tag or collar sensor for automated oestrus and health monitoring per animal.', specification: 'Activity and rumination monitoring, wireless, battery life minimum 3 years', grant_value: 29, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-off-043', item_code: 'FETF92', name: 'Realtime milk analysis', description: 'In-line milk analysis sensor measuring fat, protein, lactose, SCC, or conductivity during milking.', specification: 'Per-cow or per-quarter, real-time display, integration with parlour software', grant_value: 560, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-off-044', item_code: 'FETF96', name: 'Badger proof feed troughs', description: 'Enclosed or elevated feed troughs designed to prevent badger access to cattle feed, reducing TB transmission risk.', specification: 'Galvanised steel, enclosed design, suitable for ad-lib feeding, minimum 1.2m height', grant_value: 136, grant_unit: 'per item', category: 'livestock', score: 6 },
  { id: 'fetf-off-045', item_code: 'FETF97', name: 'Badger proof lick holders', description: 'Enclosed mineral lick holders designed to prevent badger access to cattle supplements.', specification: 'Enclosed design, galvanised steel, suitable for standard mineral lick blocks', grant_value: 68, grant_unit: 'per item', category: 'livestock', score: 5 },
  { id: 'fetf-off-046', item_code: 'FETF103', name: 'Robotic silage pusher', description: 'Autonomous robot that pushes silage or TMR feed back within reach of livestock in feed passages.', specification: 'Autonomous navigation, programmable schedule, suitable for concrete feed passages', grant_value: 5800, grant_unit: 'per item', category: 'livestock', score: 7 },

  // Resource management
  { id: 'fetf-off-047', item_code: 'FETF21', name: 'Rainwater harvesting (5,000L)', description: 'Small rainwater harvesting system collecting roof water for livestock or crop use, 5,000 litre capacity.', specification: 'Minimum 5,000 litre tank, first-flush diverter, guttering and downpipes', grant_value: 939, grant_unit: 'per item', category: 'water', score: 6 },
  { id: 'fetf-off-048', item_code: 'FETF22', name: 'Rainwater harvesting (50,000L)', description: 'Large rainwater harvesting system collecting roof water, 50,000 litre capacity for significant farm water needs.', specification: 'Minimum 50,000 litre tank, first-flush diverter, pump and filtration system', grant_value: 3336, grant_unit: 'per item', category: 'water', score: 7 },
  { id: 'fetf-off-049', item_code: 'FETF23', name: 'UV water treatment system', description: 'Ultraviolet water treatment unit for disinfecting borehole or rainwater for livestock drinking supply.', specification: 'UV-C sterilisation, flow-rated for farm water demand, indicator lamp', grant_value: 244, grant_unit: 'per item', category: 'water', score: 5 },
  { id: 'fetf-off-050', item_code: 'FETF24', name: 'Hydraulic ram pumps', description: 'Water-powered hydraulic ram pump for lifting water from streams or springs without electricity.', specification: 'No electricity required, suitable for continuous operation, minimum 2m head', grant_value: 2184, grant_unit: 'per item', category: 'water', score: 6 },
  { id: 'fetf-off-051', item_code: 'FETF25', name: 'Irrigation sensor', description: 'Soil-based irrigation scheduling sensor for optimising water application timing and volume.', specification: 'Tensiometer or capacitance type, wireless data transmission, cloud dashboard', grant_value: 478, grant_unit: 'per item', category: 'water', score: 6 },
  { id: 'fetf-off-052', item_code: 'FETF40', name: 'Heat recovery unit', description: 'Heat recovery system for recovering waste heat from milk cooling or refrigeration for hot water production.', specification: 'Plate or shell-tube heat exchanger, compatible with bulk tank cooling circuit', grant_value: 2610, grant_unit: 'per item', category: 'energy', score: 6 },
  { id: 'fetf-off-053', item_code: 'FETF41', name: 'Plate heat exchanger (plate cooler)', description: 'Plate cooler for pre-cooling milk before it enters the bulk tank, using mains water.', specification: 'Stainless steel plates, flow-matched to milking speed, water recovery for livestock', grant_value: 1350, grant_unit: 'per item', category: 'energy', score: 6 },
  { id: 'fetf-off-054', item_code: 'FETF43', name: 'Variable speed drive', description: 'Variable speed drive (inverter) for vacuum pumps, milk pumps, or fan motors to reduce energy consumption.', specification: 'Suitable for 3-phase motors, programmable speed, energy monitoring display', grant_value: 1775, grant_unit: 'per item', category: 'energy', score: 6 },
  { id: 'fetf-off-055', item_code: 'FETF49', name: 'Nitrogen level measurement (light reflectance)', description: 'Crop canopy sensor using light reflectance to estimate nitrogen status for variable rate application.', specification: 'Active light reflectance sensor, GPS-tagged readings, ISOBUS output', grant_value: 6675, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-off-056', item_code: 'FETF50', name: 'Variable rate controller', description: 'ISOBUS-compatible controller for variable rate application of seed, fertiliser, or chemicals from prescription maps.', specification: 'ISOBUS compatible, GPS-linked, supports multiple application types', grant_value: 1850, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-off-057', item_code: 'FETF53', name: 'Chlorophyll meter', description: 'Handheld chlorophyll meter for rapid non-destructive assessment of crop nitrogen status via leaf greenness.', specification: 'Handheld, instant reading, calibrated for cereals and oilseeds', grant_value: 217, grant_unit: 'per item', category: 'precision', score: 5 },
  { id: 'fetf-off-058', item_code: 'FETF213P', name: 'Remote soil moisture sensing', description: 'Remote wireless soil moisture sensor with cloud-based data logging for field-level moisture monitoring.', specification: 'Wireless telemetry, capacitance probe, minimum 30cm depth, smartphone app', grant_value: 206, grant_unit: 'per item', category: 'precision', score: 6 },
  { id: 'fetf-off-059', item_code: 'FETF214P', name: 'Soil health monitor package', description: 'Comprehensive soil health monitoring package including pH, organic matter, and biological activity testing.', specification: 'Combined chemical and biological test kit, calibrated for UK soils', grant_value: 331, grant_unit: 'per item', category: 'precision', score: 5 },
  { id: 'fetf-off-060', item_code: 'FETF215P', name: 'Weed wiper 2.4m', description: 'Tractor-mounted weed wiper for selective herbicide application to tall weeds above the crop canopy.', specification: '2.4m working width, rope wick or sponge applicator, drip-free design', grant_value: 1041, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-061', item_code: 'FETF216P', name: 'Camera guided inter row sprayer (3m)', description: 'Camera-guided inter-row sprayer for targeted herbicide application between crop rows, 3m working width.', specification: '3m boom, camera guidance, individual nozzle control, GPS data logging', grant_value: 4365, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-off-062', item_code: 'FETF217P', name: 'Camera guided inter row sprayer (6m)', description: 'Camera-guided inter-row sprayer for targeted herbicide application, 6m working width for larger operations.', specification: '6m boom, camera guidance, individual nozzle control, hydraulic folding, GPS', grant_value: 6255, grant_unit: 'per item', category: 'precision', score: 8 },
  { id: 'fetf-off-063', item_code: 'FETF218P', name: 'Robotic drill and guided hoe', description: 'Combined robotic direct-drill and precision guided hoe for autonomous crop establishment and mechanical weeding.', specification: 'Autonomous operation, camera-based guidance, combined drilling and hoeing', grant_value: 25000, grant_unit: 'per item', category: 'robotics', score: 9 },

  // General
  { id: 'fetf-off-064', item_code: 'FETF46', name: 'GPS light bar', description: 'GPS-based parallel tracking light bar for tractor guidance, reducing overlaps in field operations.', specification: 'GPS receiver, light bar display, DGPS or WAAS correction', grant_value: 306, grant_unit: 'per item', category: 'precision', score: 5 },
  { id: 'fetf-off-065', item_code: 'FETF47', name: 'Assisted steer system (retro-fitted)', description: 'Retrofit assisted/auto-steer system for tractors, providing GPS-guided steering assistance.', specification: 'Retrofit compatible, GPS-based, electric or hydraulic motor assist', grant_value: 1051, grant_unit: 'per item', category: 'precision', score: 7 },
  { id: 'fetf-off-066', item_code: 'FETF48', name: 'Real time inline forage crop analysis', description: 'In-line NIR sensor for real-time analysis of forage quality (dry matter, protein, fibre) during harvesting.', specification: 'NIR sensor, harvester-mounted, real-time display, data logging', grant_value: 7536, grant_unit: 'per item', category: 'livestock', score: 7 },
  { id: 'fetf-off-067', item_code: 'FETF219P', name: 'Cameras for monitoring farmyard', description: 'CCTV camera system for monitoring farm buildings, yards, and storage areas for security and management.', specification: 'Minimum 2 cameras, night vision, remote viewing, weatherproof', grant_value: 110, grant_unit: 'per item', category: 'general', score: 5 },
  { id: 'fetf-off-068', item_code: 'FETF109', name: 'Central tyre inflation system', description: 'Central tyre inflation system allowing tractor tyre pressures to be adjusted from the cab for road and field conditions.', specification: 'In-cab control, all four wheels, automatic deflation/inflation, pressure monitoring', grant_value: 3140, grant_unit: 'per item', category: 'precision', score: 6 },
  { id: 'fetf-off-069', item_code: 'FETF110', name: 'Cover crop roller 3m', description: 'Crimper roller for terminating cover crops mechanically before drilling, 3m working width.', specification: '3m working width, chevron or straight blades, front or rear mounted', grant_value: 1952, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-070', item_code: 'FETF111', name: 'Cover crop roller 6m', description: 'Large crimper roller for terminating cover crops at scale, 6m working width.', specification: '6m working width, hydraulic folding, chevron blades', grant_value: 3313, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-071', item_code: 'FETF112', name: 'Grassland sward lifters', description: 'Grassland subsoiler or sward lifter for aerating compacted grassland without full cultivation.', specification: 'Leg-type subsoiler, minimum 2m width, adjustable depth, low soil disturbance', grant_value: 2804, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-072', item_code: 'FETF114', name: 'Biological control applicator', description: 'Specialist applicator for deploying biological pest control agents (parasitoid wasps, nematodes) in glasshouses or field crops.', specification: 'Suitable for sachets, cards, or liquid application, adjustable distribution rate', grant_value: 906, grant_unit: 'per item', category: 'horticulture', score: 6 },
  { id: 'fetf-off-073', item_code: 'FETF117', name: 'Crop storage sensor system', description: 'Wireless sensor system for monitoring temperature and humidity in crop stores (grain, potato, onion).', specification: 'Minimum 4 sensors, wireless data logger, cloud alerts, multi-zone', grant_value: 1927, grant_unit: 'per item', category: 'arable', score: 6 },
  { id: 'fetf-off-074', item_code: 'FETF118', name: 'Digital weather station', description: 'Farm-based digital weather station for recording local conditions and supporting spray timing and disease forecasting.', specification: 'Temperature, rainfall, humidity, wind speed, wireless upload, disease model compatible', grant_value: 575, grant_unit: 'per item', category: 'precision', score: 5 },
  { id: 'fetf-off-075', item_code: 'FETF220P', name: 'Grain protein monitor', description: 'In-line or portable grain protein analyser for segregating grain by protein content at harvest or intake.', specification: 'NIR-based, calibrated for wheat, barley, and oilseeds, rapid result', grant_value: 4236, grant_unit: 'per item', category: 'arable', score: 6 },
];

const FETF_OFFICIAL_SLURRY_ITEMS = [
  { id: 'fetf-off-sl-001', item_code: 'FETF26', name: 'Robotic slurry pusher/collector', description: 'Autonomous robotic scraper for pushing or collecting slurry from cubicle house floors and passageways.', specification: 'Autonomous operation, programmable schedule, suitable for slatted or solid floors', grant_value: 7573, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-off-sl-002', item_code: 'FETF27', name: 'Slurry separators', description: 'Mechanical screw press or rotary screen separator for separating slurry into solid and liquid fractions.', specification: 'Screw press or screen type, minimum 5 m3/hr throughput, self-cleaning', grant_value: 7613, grant_unit: 'per item', category: 'processing', score: 7 },
  { id: 'fetf-off-sl-003', item_code: 'FETF28', name: 'Flow rate monitoring of slurry', description: 'In-line flow meter for measuring slurry application rate during spreading.', specification: 'Electromagnetic flow meter, GPS-linked, accuracy +/- 5%, display in cab', grant_value: 2134, grant_unit: 'per item', category: 'analysis', score: 7 },
  { id: 'fetf-off-sl-004', item_code: 'FETF29', name: 'Real time inline nutrient analysis', description: 'In-line NIR sensor for real-time measurement of slurry nutrient content (N, P, K) during application.', specification: 'NIR sensor, tanker or umbilical mounted, real-time display, GPS data logging', grant_value: 10803, grant_unit: 'per item', category: 'analysis', score: 9 },
  { id: 'fetf-off-sl-005', item_code: 'FETF30', name: 'Nurse tank (50m3)', description: 'Mobile 50m3 nurse tank for intermediate storage of slurry near fields during spreading operations.', specification: '50m3 capacity, road-towable, fill and discharge connections', grant_value: 11400, grant_unit: 'per item', category: 'storage', score: 6 },
  { id: 'fetf-off-sl-006', item_code: 'FETF31', name: 'Nurse tank (100m3)', description: 'Large 100m3 nurse tank for intermediate storage, reducing tanker road journeys during spreading.', specification: '100m3 capacity, road-towable or static, high-capacity fill connections', grant_value: 14700, grant_unit: 'per item', category: 'storage', score: 7 },
  { id: 'fetf-off-sl-007', item_code: 'FETF32', name: 'Dribble bar (6m)', description: 'Dribble bar attachment for slurry tanker, applying slurry in narrow bands at ground level, 6m width.', specification: '6m working width, individual outlet pipes, anti-drip valves', grant_value: 4200, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-off-sl-008', item_code: 'FETF33', name: 'Dribble bar (10m)', description: 'Wide dribble bar for slurry tanker, 10m width for efficient low-emission application.', specification: '10m working width, hydraulic folding, individual outlets, anti-drip', grant_value: 5400, grant_unit: 'per item', category: 'application', score: 8 },
  { id: 'fetf-off-sl-009', item_code: 'FETF34', name: 'Shallow injection systems (3m)', description: 'Shallow disc injector for placing slurry below the soil surface, near-eliminating ammonia emissions, 3m width.', specification: '3m working width, disc injection to 50mm depth, suitable for grassland', grant_value: 8250, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-off-sl-010', item_code: 'FETF35', name: 'Shallow injection systems (6m)', description: 'Wide shallow disc injector for high-capacity slurry injection, 6m width.', specification: '6m working width, disc injection to 50mm depth, hydraulic folding', grant_value: 8984, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-off-sl-011', item_code: 'FETF36', name: 'Trailing shoe slurry system (6m)', description: 'Trailing shoe applicator placing slurry at soil level beneath the crop canopy, 6m width.', specification: '6m working width, spring-loaded shoes, suitable for grassland and arable stubble', grant_value: 7375, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-off-sl-012', item_code: 'FETF37', name: 'Trailing shoe slurry system (8m+)', description: 'Large trailing shoe applicator for high-output slurry application, 8m or wider working width.', specification: '8m+ working width, hydraulic folding, spring-loaded shoes, anti-drip', grant_value: 8017, grant_unit: 'per item', category: 'application', score: 9 },
  { id: 'fetf-off-sl-013', item_code: 'FETF38', name: 'Umbilical hose reeler', description: 'Hose reel system for umbilical slurry application, reducing tanker traffic and soil compaction.', specification: 'Minimum 100m hose, powered reeler, suitable for trailing shoe or dribble bar', grant_value: 3300, grant_unit: 'per item', category: 'application', score: 7 },
  { id: 'fetf-off-sl-014', item_code: 'FETF39', name: 'Trailed compartmented reeler', description: 'Trailed multi-compartment hose reel for systematic umbilical slurry application with automatic lane switching.', specification: 'Compartmented drum, automatic lane change, minimum 200m working length', grant_value: 5400, grant_unit: 'per item', category: 'application', score: 7 },
  { id: 'fetf-off-sl-015', item_code: 'FETF203S', name: 'Mobile slurry chopper pump', description: 'Portable slurry pump with chopper blade for breaking up solids and transferring slurry between stores or to tanker.', specification: 'Chopper impeller, portable/towable, PTO or electric drive, minimum 30 m3/hr', grant_value: 4355, grant_unit: 'per item', category: 'processing', score: 6 },
  { id: 'fetf-off-sl-016', item_code: 'FETF204S', name: 'Remote control for engine-driven pumps', description: 'Wireless remote control system for engine-driven slurry pumps, enabling safe operation from a distance.', specification: 'Wireless remote, start/stop/throttle control, safety kill switch, minimum 50m range', grant_value: 5220, grant_unit: 'per item', category: 'processing', score: 5 },
];

const FETF_OFFICIAL_ANIMAL_HEALTH_ITEMS = [
  // Cattle
  { id: 'fetf-off-ah-001', item_code: 'FETF56', name: 'Mobile cattle handling system', description: 'Portable cattle handling system with crush, race, and pen sections for use at multiple locations.', specification: 'Galvanised steel, trailer-mounted, includes crush and minimum 10m race', grant_value: 5570, grant_unit: 'per item', category: 'cattle-handling', score: 8 },
  { id: 'fetf-off-ah-002', item_code: 'FETF57', name: 'Fixed cattle handling system', description: 'Permanent cattle handling system with crush, race, collecting pen, and dispersal pen.', specification: 'Galvanised steel, concrete base, minimum 10m race, single-file and group pens', grant_value: 4102, grant_unit: 'per item', category: 'cattle-handling', score: 8 },
  { id: 'fetf-off-ah-003', item_code: 'FETF58', name: 'Cattle crush (automatic)', description: 'Automatic self-catching cattle crush with head scoop for restraining cattle during treatment.', specification: 'Automatic head catch, adjustable width, minimum 1500kg capacity', grant_value: 1343, grant_unit: 'per item', category: 'cattle-handling', score: 7 },
  { id: 'fetf-off-ah-004', item_code: 'FETF59', name: 'Cattle crush (manual)', description: 'Manual head-yoke cattle crush for routine handling and treatment.', specification: 'Manual head yoke, adjustable width, galvanised steel frame', grant_value: 1279, grant_unit: 'per item', category: 'cattle-handling', score: 6 },
  { id: 'fetf-off-ah-005', item_code: 'FETF60', name: 'Hydraulic or pneumatic operated squeeze crush', description: 'Power-operated squeeze crush providing gentle whole-body restraint for cattle during veterinary procedures.', specification: 'Hydraulic or pneumatic squeeze, adjustable pressure, head restraint', grant_value: 4360, grant_unit: 'per item', category: 'cattle-handling', score: 7 },
  { id: 'fetf-off-ah-006', item_code: 'FETF61', name: 'Squeeze crush (manual)', description: 'Manual squeeze crush for cattle, providing side and head restraint during treatment and examination.', specification: 'Manual squeeze mechanism, adjustable width, access panels for vet procedures', grant_value: 2060, grant_unit: 'per item', category: 'cattle-handling', score: 6 },
  { id: 'fetf-off-ah-007', item_code: 'FETF62', name: 'Head scoop for cattle crush', description: 'Retrofit head scoop attachment for cattle crush, improving head restraint during dosing and examination.', specification: 'Compatible with standard crushes, adjustable height, self-catching option', grant_value: 252, grant_unit: 'per item', category: 'cattle-handling', score: 5 },
  { id: 'fetf-off-ah-008', item_code: 'FETF63', name: 'Foot trimming add-on to cattle crushes', description: 'Retrofit foot trimming cradle attachment for existing cattle crushes, enabling hoof care without a specialist crush.', specification: 'Fits standard crush frames, leg restraint, adjustable height', grant_value: 336, grant_unit: 'per item', category: 'cattle-handling', score: 6 },
  { id: 'fetf-off-ah-009', item_code: 'FETF64', name: 'Specialist foot trimming cattle crush', description: 'Purpose-built hydraulic foot trimming crush for professional cattle hoof care.', specification: 'Hydraulic tilt or rollover, belly band, individual leg restraints', grant_value: 1918, grant_unit: 'per item', category: 'cattle-handling', score: 7 },
  { id: 'fetf-off-ah-010', item_code: 'FETF65', name: 'Calving gate', description: 'Calving gate or yoke attachment for cattle crush, providing safe access to cow during assisted calving.', specification: 'Rear access gate, adjustable width, compatible with standard races', grant_value: 229, grant_unit: 'per item', category: 'cattle-handling', score: 6 },
  { id: 'fetf-off-ah-011', item_code: 'FETF66', name: 'Cattle auto ID shedding gate (auto drafting)', description: 'EID-linked automatic drafting gate for sorting cattle by weight, health status, or other criteria.', specification: 'EID reader, 3-way draft, programmable criteria, minimum 200 head/hr', grant_value: 2776, grant_unit: 'per item', category: 'cattle-handling', score: 8 },
  { id: 'fetf-off-ah-012', item_code: 'FETF67', name: 'Auto cattle weighing equipment', description: 'Walk-over or walk-through automatic cattle weighing platform with EID for recording individual weights.', specification: 'EID-linked, automatic data capture, minimum 2000kg capacity, load cells', grant_value: 1800, grant_unit: 'per item', category: 'cattle-handling', score: 8 },
  { id: 'fetf-off-ah-013', item_code: 'FETF68', name: 'EID panel reader for cattle', description: 'Fixed panel EID reader for automatic identification of cattle passing through race or gateway.', specification: 'ISO 11784/11785, panel mount, Bluetooth data transfer, weatherproof', grant_value: 620, grant_unit: 'per item', category: 'cattle-monitoring', score: 8 },
  { id: 'fetf-off-ah-014', item_code: 'FETF85', name: 'Automated footbaths for cattle', description: 'Automatic walk-through footbath with chemical dosing for routine foot care and lameness prevention.', specification: 'Automatic chemical mixing and dosing, walk-through design, drainage', grant_value: 2321, grant_unit: 'per item', category: 'cattle-welfare', score: 7 },
  { id: 'fetf-off-ah-015', item_code: 'FETF86', name: 'Cluster flush', description: 'Automatic milking cluster flushing system for sanitising clusters between cows to reduce mastitis transmission.', specification: 'Hot water or disinfectant flush, automatic operation, per-unit flushing', grant_value: 258, grant_unit: 'per item', category: 'cattle-welfare', score: 7 },
  { id: 'fetf-off-ah-016', item_code: 'FETF87', name: 'Hand-held automatic teat washing system', description: 'Portable automatic teat cleaning system using warm water or sanitiser spray for pre-milking hygiene.', specification: 'Rechargeable, heated water, spray or cup applicator, food-safe materials', grant_value: 2581, grant_unit: 'per item', category: 'cattle-welfare', score: 6 },
  { id: 'fetf-off-ah-017', item_code: 'FETF93', name: 'Mobile calf milk pasteuriser and dispenser', description: 'Combined pasteuriser and dispenser for feeding waste milk or colostrum safely to calves.', specification: 'Batch pasteurisation, temperature control, mobile on wheels, minimum 50L capacity', grant_value: 3246, grant_unit: 'per item', category: 'cattle-welfare', score: 7 },
  { id: 'fetf-off-ah-018', item_code: 'FETF94', name: 'Auto calf feeder with washing facility', description: 'Automatic calf milk feeder with self-cleaning cycle, dispensing controlled rations via EID.', specification: 'EID recognition, programmable feed curves, automatic cleaning, minimum 25 calves', grant_value: 3402, grant_unit: 'per item', category: 'cattle-welfare', score: 7 },
  { id: 'fetf-off-ah-019', item_code: 'FETF95', name: 'Additional feed station', description: 'Extra feeding station for automatic calf feeder systems, allowing more calves per machine.', specification: 'Compatible with existing auto feeder, separate teat and bowl, hygiene flush', grant_value: 649, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-020', item_code: 'FETF98', name: 'Rotating cow brush', description: 'Automatic rotating cow brush for self-grooming, improving cow comfort and reducing skin parasites.', specification: 'Rotating brush, auto-start on contact, wall or post mount, heavy-duty motor', grant_value: 600, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-021', item_code: 'FETF99', name: 'Swinging brushes for calves', description: 'Smaller swinging or rotating brushes sized for calves and young stock.', specification: 'Suitable for calves under 200kg, wall mount, auto-start on contact', grant_value: 386, grant_unit: 'per item', category: 'cattle-welfare', score: 4 },
  { id: 'fetf-off-ah-022', item_code: 'FETF221A', name: 'Perimeter fencing', description: 'Badger-proof perimeter fencing around cattle buildings or feed stores to reduce TB biosecurity risk.', specification: 'Weldmesh or close-spaced wire, minimum 1.5m height, buried base, per metre', grant_value: 168, grant_unit: 'per item', category: 'cattle-welfare', score: 6 },
  { id: 'fetf-off-ah-023', item_code: 'FETF222A', name: 'Cow mattresses', description: 'Cubicle mattresses for dairy or beef cattle, improving lying comfort and reducing hock injuries.', specification: 'Minimum 50mm foam or rubber, waterproof cover, standard cubicle fit', grant_value: 26, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-024', item_code: 'FETF223A', name: 'Mobile calf handling crate', description: 'Portable calf handling crate for safe restraint during dehorning, tagging, and treatment.', specification: 'Adjustable width, head restraint, suitable for calves up to 150kg, portable', grant_value: 327, grant_unit: 'per item', category: 'cattle-handling', score: 6 },
  { id: 'fetf-off-ah-025', item_code: 'FETF224A', name: 'Slatted floor inserts (cattle)', description: 'Rubber or plastic inserts for concrete slatted floors to improve foot comfort and reduce lameness in cattle.', specification: 'Fits standard slat widths, durable rubber or plastic, non-slip surface', grant_value: 3, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-026', item_code: 'FETF225A', name: 'Heat lamps for calves', description: 'Infrared heat lamps for calf pens to reduce cold stress in newborn and young calves.', specification: 'Infrared ceramic or quartz, safety guard, adjustable height, minimum 250W', grant_value: 25, grant_unit: 'per item', category: 'cattle-welfare', score: 4 },
  { id: 'fetf-off-ah-027', item_code: 'FETF226A', name: 'Rubber flooring mats for cattle', description: 'Rubber matting for cattle standing areas, feed passages, and parlour approaches to reduce lameness.', specification: 'Minimum 18mm thickness, anti-slip surface, suitable for scraper use', grant_value: 16, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-028', item_code: 'FETF227A', name: 'Hanging ball toy for calves', description: 'Enrichment toy (hanging ball) for calf pens to provide mental stimulation and reduce abnormal behaviours.', specification: 'Durable plastic or rubber, chain suspension, suitable for pen mounting', grant_value: 29, grant_unit: 'per item', category: 'cattle-welfare', score: 3 },
  { id: 'fetf-off-ah-029', item_code: 'FETF228A', name: 'Calf coat', description: 'Insulated waterproof calf coat for maintaining body temperature in newborn and young calves.', specification: 'Waterproof outer, fleece lining, adjustable straps, machine washable', grant_value: 7, grant_unit: 'per item', category: 'cattle-welfare', score: 4 },
  { id: 'fetf-off-ah-030', item_code: 'FETF229A', name: 'Flexible cubicle dividers', description: 'Flexible rubber or plastic cubicle dividers allowing cows to lie down and rise freely.', specification: 'Flexible material, standard cubicle mounting, allows natural rising movement', grant_value: 43, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-031', item_code: 'FETF230A', name: 'Outdoor calf housing: Pair', description: 'Outdoor calf hutch for pair housing, providing fresh air and reducing respiratory disease transmission.', specification: 'Weatherproof, ventilated, suitable for 2 calves, minimum 3m2 floor area', grant_value: 604, grant_unit: 'per item', category: 'cattle-welfare', score: 6 },
  { id: 'fetf-off-ah-032', item_code: 'FETF231A', name: 'Outdoor calf housing: Group', description: 'Larger outdoor calf shelter for group housing of 5-10 calves with natural ventilation.', specification: 'Weatherproof, ventilated, suitable for 5-10 calves, minimum 10m2 floor area', grant_value: 1738, grant_unit: 'per item', category: 'cattle-welfare', score: 6 },
  { id: 'fetf-off-ah-033', item_code: 'FETF232A', name: 'Louvre ventilation system', description: 'Adjustable louvre ventilation panels for cattle buildings to improve air quality and reduce respiratory disease.', specification: 'Adjustable louvres, wall or ridge mount, manual or automatic control', grant_value: 115, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-034', item_code: 'FETF233A', name: 'Static cow brush', description: 'Fixed-position scratching post or brush for cows, providing basic self-grooming.', specification: 'Fixed mount, durable bristles, suitable for outdoor or housed cattle', grant_value: 65, grant_unit: 'per item', category: 'cattle-welfare', score: 4 },
  { id: 'fetf-off-ah-035', item_code: 'FETF234A', name: 'Rubber coverings for slatted floors for cattle buildings', description: 'Rubber overlay for concrete slats in cattle buildings, improving foot comfort and grip.', specification: 'Vulcanised rubber, fits standard slat widths, bolt or adhesive fixing', grant_value: 25, grant_unit: 'per item', category: 'cattle-welfare', score: 5 },
  { id: 'fetf-off-ah-036', item_code: 'FETF235A', name: 'Automated mobility/body condition scoring system', description: 'Camera-based automated system for scoring cattle mobility (lameness) and body condition without handling.', specification: 'Camera system, AI analysis, individual cow identification, dashboard reporting', grant_value: 2360, grant_unit: 'per item', category: 'cattle-monitoring', score: 8 },

  // Sheep
  { id: 'fetf-off-ah-037', item_code: 'FETF69', name: 'Mobile sheep handling systems', description: 'Portable sheep handling system with race, drafting gate, and pens for use at multiple locations.', specification: 'Trailer-mounted, minimum 10m race, drafting gate, holding pens for 50+ sheep', grant_value: 3568, grant_unit: 'per item', category: 'sheep-handling', score: 8 },
  { id: 'fetf-off-ah-038', item_code: 'FETF70', name: 'Fixed sheep handling system', description: 'Permanent sheep handling system with race, drafting gates, and collecting yard.', specification: 'Galvanised steel, concrete or hard-standing base, race and drafting gate', grant_value: 2178, grant_unit: 'per item', category: 'sheep-handling', score: 7 },
  { id: 'fetf-off-ah-039', item_code: 'FETF71', name: 'Sheep handler', description: 'Manual or semi-automatic sheep handler (turnover crate) for foot trimming, tagging, and treatment.', specification: 'Rollover or tilt mechanism, adjustable restraint, single-person operation', grant_value: 1166, grant_unit: 'per item', category: 'sheep-handling', score: 7 },
  { id: 'fetf-off-ah-040', item_code: 'FETF72', name: 'Automatic weighing and drafting crate for sheep', description: 'Walk-through sheep crate with automatic weighing and EID-linked drafting to sort sheep by weight.', specification: 'EID reader, auto-weigh, minimum 3-way draft, minimum 300 head/hr throughput', grant_value: 5478, grant_unit: 'per item', category: 'sheep-handling', score: 9 },
  { id: 'fetf-off-ah-041', item_code: 'FETF73', name: 'Sheep conveyor', description: 'Mechanical sheep conveyor for moving sheep through handling system, reducing stress and labour.', specification: 'Belt or roller conveyor, adjustable speed, minimum 5m length, non-slip surface', grant_value: 4600, grant_unit: 'per item', category: 'sheep-handling', score: 7 },
  { id: 'fetf-off-ah-042', item_code: 'FETF74', name: 'EID panel reader for sheep', description: 'Fixed panel EID reader for automatic identification of sheep passing through race or gateway.', specification: 'ISO 11784/11785, panel mount, Bluetooth, compatible with sheep EID tags', grant_value: 597, grant_unit: 'per item', category: 'sheep-monitoring', score: 8 },
  { id: 'fetf-off-ah-043', item_code: 'FETF75', name: 'Electronic weigh crate for sheep', description: 'Manual sheep weighing crate with electronic weigh head and data recording.', specification: 'Electronic weigh head, minimum 200kg capacity, data recording, EID option', grant_value: 1020, grant_unit: 'per item', category: 'sheep-handling', score: 7 },
  { id: 'fetf-off-ah-044', item_code: 'FETF83', name: 'Mobile sheep dip', description: 'Portable sheep plunge dip for treating ectoparasites (scab, lice, ticks, blowfly).', specification: 'Self-draining, minimum 500 litre capacity, portable/towable, drip pen', grant_value: 6220, grant_unit: 'per item', category: 'sheep-welfare', score: 7 },
  { id: 'fetf-off-ah-045', item_code: 'FETF236A', name: 'Plastic slats', description: 'Plastic slatted flooring for sheep housing, improving hygiene and reducing foot rot.', specification: 'UV-resistant plastic, non-slip surface, suitable for sheep weights, per m2', grant_value: 19, grant_unit: 'per item', category: 'sheep-welfare', score: 5 },
  { id: 'fetf-off-ah-046', item_code: 'FETF237A', name: 'Snacker feeder', description: 'Tractor-mounted snacker feeder for distributing concentrates to sheep in the field.', specification: 'PTO-driven, adjustable flow rate, 3-point linkage, minimum 500kg hopper', grant_value: 628, grant_unit: 'per item', category: 'sheep-welfare', score: 5 },
  { id: 'fetf-off-ah-047', item_code: 'FETF238A', name: 'Lamb creep feeder with shelter', description: 'Lamb creep feeder with weather protection, allowing lambs access to supplementary feed.', specification: 'Adjustable entry width (lamb only), weather shelter, minimum 50kg hopper', grant_value: 311, grant_unit: 'per item', category: 'sheep-welfare', score: 5 },
  { id: 'fetf-off-ah-048', item_code: 'FETF239A', name: 'Lamb auto milk feeder', description: 'Automatic milk feeder for orphan or pet lambs, dispensing warm milk replacer on demand.', specification: 'Temperature-controlled, multiple teat stations, minimum 10 lamb capacity', grant_value: 820, grant_unit: 'per item', category: 'sheep-welfare', score: 6 },
  { id: 'fetf-off-ah-049', item_code: 'FETF240A', name: 'Foam disinfectant equipment', description: 'Foam disinfection lance or system for cleaning and disinfecting sheep handling equipment and housing.', specification: 'Foam lance, compatible with approved disinfectants, pressure washer attachment', grant_value: 862, grant_unit: 'per item', category: 'sheep-welfare', score: 5 },
  { id: 'fetf-off-ah-050', item_code: 'FETF241A', name: 'Turnover crate', description: 'Sheep turnover crate for safe restraint during foot trimming, dagging, and treatment.', specification: 'Manual or hydraulic rollover, padded restraint, single-person operation', grant_value: 578, grant_unit: 'per item', category: 'sheep-handling', score: 6 },
  { id: 'fetf-off-ah-051', item_code: 'FETF242A', name: 'Automated footbath for sheep', description: 'Automatic walk-through footbath for sheep with chemical dosing for foot rot prevention.', specification: 'Walk-through design, automatic dosing, minimum 2m length, drainage', grant_value: 2650, grant_unit: 'per item', category: 'sheep-welfare', score: 7 },
  { id: 'fetf-off-ah-052', item_code: 'FETF243A', name: 'Sheep race', description: 'Standalone sheep race for directing sheep single-file through handling system.', specification: 'Galvanised steel, minimum 5m length, adjustable width, anti-backup gate', grant_value: 331, grant_unit: 'per item', category: 'sheep-handling', score: 6 },

  // Pigs
  { id: 'fetf-off-ah-053', item_code: 'FETF76', name: 'Fixed handling system for pigs', description: 'Permanent pig handling system with race, weigh platform, and sorting gates.', specification: 'Steel or aluminium panels, non-slip floor, race with sorting gate', grant_value: 840, grant_unit: 'per item', category: 'pig-handling', score: 7 },
  { id: 'fetf-off-ah-054', item_code: 'FETF77', name: 'Electronic pig weighing and sorting facility', description: 'Automated pig weighing and sorting system using RFID for precision feeding and selection.', specification: 'RFID reader, automatic weighing, sorting gate, minimum 3-way draft', grant_value: 1160, grant_unit: 'per item', category: 'pig-handling', score: 8 },
  { id: 'fetf-off-ah-055', item_code: 'FETF104', name: 'Enclosed piglet creeps with heat pad', description: 'Enclosed heated creep area for piglets with thermostatically controlled heat pad.', specification: 'Enclosed creep, thermostat-controlled heat pad, insulated lid', grant_value: 155, grant_unit: 'per item', category: 'pig-welfare', score: 6 },
  { id: 'fetf-off-ah-056', item_code: 'FETF244A', name: 'Slatted floor inserts (pigs)', description: 'Rubber or plastic inserts for pig housing slatted floors to improve foot comfort.', specification: 'Fits standard pig housing slat widths, durable, non-slip', grant_value: 3, grant_unit: 'per item', category: 'pig-welfare', score: 4 },
  { id: 'fetf-off-ah-057', item_code: 'FETF245A', name: 'Automatic curtain system for pig housing', description: 'Automatic side curtain system for pig buildings, regulating ventilation and temperature.', specification: 'Motorised curtain, thermostat controlled, UV-resistant material', grant_value: 38, grant_unit: 'per item', category: 'pig-welfare', score: 5 },
  { id: 'fetf-off-ah-058', item_code: 'FETF246A', name: 'Hanging enrichment toys for pigs', description: 'Hanging chains, balls, or other enrichment devices for pigs to reduce boredom and tail biting.', specification: 'Durable, non-toxic, chain or rope suspension, per unit', grant_value: 8, grant_unit: 'per item', category: 'pig-welfare', score: 4 },
  { id: 'fetf-off-ah-059', item_code: 'FETF247A', name: 'Individual ad lib farrowing feeder', description: 'Individual feed hopper for sows in farrowing crates allowing ad-lib access to feed.', specification: 'Stainless steel or plastic, adjustable flow, individual crate mount', grant_value: 130, grant_unit: 'per item', category: 'pig-welfare', score: 5 },
  { id: 'fetf-off-ah-060', item_code: 'FETF248A', name: 'Electronic sow feeder', description: 'Electronic sow feeding station dispensing individual rations to group-housed sows via RFID ear tag.', specification: 'RFID recognition, programmable rations, anti-theft gate, feed weighing', grant_value: 2200, grant_unit: 'per item', category: 'pig-welfare', score: 7 },
  { id: 'fetf-off-ah-061', item_code: 'FETF249A', name: 'Foraging tower', description: 'Foraging enrichment tower dispensing straw, hay, or other rootable material for pigs.', specification: 'Gravity-fed, refillable hopper, height-adjustable, durable construction', grant_value: 55, grant_unit: 'per item', category: 'pig-welfare', score: 5 },
  { id: 'fetf-off-ah-062', item_code: 'FETF250A', name: 'Insulated farrowing ark', description: 'Insulated outdoor farrowing ark for free-range sow herds, providing shelter for farrowing.', specification: 'Insulated walls and roof, draught-free, easy clean, suitable for outdoor sows', grant_value: 264, grant_unit: 'per item', category: 'pig-welfare', score: 6 },
  { id: 'fetf-off-ah-063', item_code: 'FETF251A', name: 'Robot pen cleaner', description: 'Autonomous robotic cleaner for pig pen floors, reducing labour and improving hygiene.', specification: 'Autonomous navigation, programmable schedule, suitable for solid or part-slatted floors', grant_value: 10187, grant_unit: 'per item', category: 'pig-welfare', score: 8 },
  { id: 'fetf-off-ah-064', item_code: 'FETF252A', name: 'Water tank drinker with stand', description: 'Portable water tank drinker on stand for outdoor pig paddocks.', specification: 'Minimum 200L tank, low-level drinker, frost-resistant valve, adjustable height', grant_value: 150, grant_unit: 'per item', category: 'pig-welfare', score: 4 },
  { id: 'fetf-off-ah-065', item_code: 'FETF253A', name: 'Auto-monitoring system for pig housing', description: 'Environmental monitoring base station for pig housing, tracking temperature, humidity, and air quality.', specification: 'Base unit with multiple sensor inputs, cloud alerts, data logging', grant_value: 853, grant_unit: 'per item', category: 'pig-monitoring', score: 7 },
  { id: 'fetf-off-ah-066', item_code: 'FETF254A', name: 'Feed bin weighing equipment for pigs', description: 'Weighing system for pig feed bins to monitor feed usage and detect feeding problems.', specification: 'Load cells, wireless data, compatible with standard feed bins', grant_value: 225, grant_unit: 'per item', category: 'pig-monitoring', score: 5 },
  { id: 'fetf-off-ah-067', item_code: 'FETF255A', name: 'Rubber coverings for slatted floors for pig buildings', description: 'Rubber overlay for pig building slats to improve comfort and reduce foot injuries.', specification: 'Vulcanised rubber, fits pig housing slat widths, bolt or adhesive fixing', grant_value: 25, grant_unit: 'per item', category: 'pig-welfare', score: 4 },
  { id: 'fetf-off-ah-068', item_code: 'FETF256A', name: 'Portable loading ramp', description: 'Portable loading ramp for pigs with non-slip flooring and adjustable height.', specification: 'Non-slip surface, adjustable height, side panels, suitable for all pig sizes', grant_value: 2239, grant_unit: 'per item', category: 'pig-handling', score: 6 },
  { id: 'fetf-off-ah-069', item_code: 'FETF257A', name: 'Enrichment block holder', description: 'Holder for mineral or enrichment blocks in pig pens, keeping blocks accessible and clean.', specification: 'Wall or post mount, adjustable height, holds standard blocks', grant_value: 11, grant_unit: 'per item', category: 'pig-welfare', score: 3 },

  // Poultry
  { id: 'fetf-off-ah-070', item_code: 'FETF258A', name: 'Automatic curtain system for poultry housing', description: 'Motorised side curtain system for poultry houses, regulating ventilation and light.', specification: 'Motorised, thermostat or timer controlled, UV-resistant material', grant_value: 38, grant_unit: 'per item', category: 'poultry-welfare', score: 5 },
  { id: 'fetf-off-ah-071', item_code: 'FETF259A', name: 'Auto-monitoring system for poultry housing', description: 'Environmental monitoring system for poultry houses tracking temperature, humidity, ammonia, and CO2.', specification: 'Base unit, multiple sensor inputs, automatic alerts, data logging', grant_value: 853, grant_unit: 'per item', category: 'poultry-monitoring', score: 7 },
  { id: 'fetf-off-ah-072', item_code: 'FETF260A', name: 'Automatic weigh scale for poultry', description: 'Automated platform scales for poultry houses providing daily average bird weights.', specification: 'Floor-mounted platform, automated data collection, radio data transfer', grant_value: 328, grant_unit: 'per item', category: 'poultry-monitoring', score: 6 },
  { id: 'fetf-off-ah-073', item_code: 'FETF261A', name: 'Feed bin weighing equipment for poultry', description: 'Weighing system for poultry feed bins to monitor daily feed consumption.', specification: 'Load cells, wireless data, compatible with standard feed bins', grant_value: 225, grant_unit: 'per item', category: 'poultry-monitoring', score: 5 },
  { id: 'fetf-off-ah-074', item_code: 'FETF262A', name: 'Poultry perches (mushroom)', description: 'Mushroom-shaped perches for poultry houses, encouraging natural roosting behaviour.', specification: 'Plastic or wood, mushroom shape, suitable for laying hens, per unit', grant_value: 12, grant_unit: 'per item', category: 'poultry-welfare', score: 4 },
  { id: 'fetf-off-ah-075', item_code: 'FETF263A', name: 'Broiler perch', description: 'Low-level perches designed for broiler chickens to encourage activity and leg strength.', specification: 'Low height, smooth surface, suitable for broiler weights, per unit', grant_value: 18, grant_unit: 'per item', category: 'poultry-welfare', score: 4 },
  { id: 'fetf-off-ah-076', item_code: 'FETF264A', name: 'Automatic enrichment feeder for poultry', description: 'Timed or sensor-activated enrichment feeder dispensing pecking material for poultry.', specification: 'Timer or sensor activated, holds grain or grit, adjustable dispensing rate', grant_value: 108, grant_unit: 'per item', category: 'poultry-welfare', score: 5 },
  { id: 'fetf-off-ah-077', item_code: 'FETF265A', name: 'Freestanding platforms and ramps', description: 'Platforms and ramps for poultry houses enabling vertical movement and reducing keel bone damage.', specification: 'Stable construction, non-slip surface, adjustable height, per unit', grant_value: 150, grant_unit: 'per item', category: 'poultry-welfare', score: 5 },
  { id: 'fetf-off-ah-078', item_code: 'FETF266A', name: 'Nipple drinker system', description: 'Nipple drinker line system for poultry houses providing clean water with minimal wastage.', specification: 'Nipple drinkers on pipe line, adjustable height, drip cups, per unit', grant_value: 16, grant_unit: 'per item', category: 'poultry-welfare', score: 5 },
  { id: 'fetf-off-ah-079', item_code: 'FETF267A', name: 'Housing platforms and ramps', description: 'Built-in raised platforms and ramps in poultry housing for multi-level use of building space.', specification: 'Integrated into housing frame, non-slip surface, per square metre', grant_value: 60, grant_unit: 'per item', category: 'poultry-welfare', score: 5 },
  { id: 'fetf-off-ah-080', item_code: 'FETF268A', name: 'Spin feeder', description: 'Motorised scatter feeder (spin feeder) for distributing grain across poultry range or house floor.', specification: 'Motorised, timer-controlled, adjustable spread pattern, hopper capacity minimum 25kg', grant_value: 890, grant_unit: 'per item', category: 'poultry-welfare', score: 6 },
  { id: 'fetf-off-ah-081', item_code: 'FETF269A', name: 'Poultry feed system for split feeding', description: 'Dual-line feed system enabling split feeding (morning/afternoon different rations) for laying hens.', specification: 'Dual feed lines, programmable dispensing, compatible with existing feed systems', grant_value: 4162, grant_unit: 'per item', category: 'poultry-welfare', score: 7 },
  { id: 'fetf-off-ah-082', item_code: 'FETF270A', name: '3D weighing camera system for poultry', description: 'Camera-based 3D imaging system for automated bird weighing and flock uniformity assessment.', specification: 'Overhead camera, 3D imaging, automated weight estimation, data dashboard', grant_value: 1125, grant_unit: 'per item', category: 'poultry-monitoring', score: 7 },
  { id: 'fetf-off-ah-083', item_code: 'FETF271A', name: 'Ultrasonic water meter', description: 'Ultrasonic water meter for poultry houses to monitor daily water consumption as a health indicator.', specification: 'Non-invasive clamp-on, data logging, daily consumption tracking, alarm thresholds', grant_value: 506, grant_unit: 'per item', category: 'poultry-monitoring', score: 6 },

  // General livestock
  { id: 'fetf-off-ah-084', item_code: 'FETF78', name: 'Individual electronic weigh system', description: 'Portable electronic weighing system for individual livestock with data recording.', specification: 'Electronic weigh head, minimum 500kg capacity, data recording, Bluetooth', grant_value: 348, grant_unit: 'per item', category: 'general-handling', score: 7 },
  { id: 'fetf-off-ah-085', item_code: 'FETF79', name: 'Weigh bars and weigh platforms for weighing livestock', description: 'Livestock weigh bars or platform scale for weighing cattle or sheep in existing handling systems.', specification: 'Weigh bars or platform, electronic indicator, minimum 1500kg capacity', grant_value: 358, grant_unit: 'per item', category: 'general-handling', score: 7 },
  { id: 'fetf-off-ah-086', item_code: 'FETF80', name: 'Weigh bars or platform for animals less than 300kg', description: 'Smaller weigh platform for sheep, calves, and pigs under 300kg.', specification: 'Platform or bars, electronic indicator, minimum 300kg capacity, portable', grant_value: 364, grant_unit: 'per item', category: 'general-handling', score: 6 },
  { id: 'fetf-off-ah-087', item_code: 'FETF81', name: 'EID handheld recorder device', description: 'Handheld EID reader with data recording for on-farm animal identification and record keeping.', specification: 'ISO 11784/11785, on-board memory, Bluetooth, data export to PC', grant_value: 376, grant_unit: 'per item', category: 'general-monitoring', score: 8 },
  { id: 'fetf-off-ah-088', item_code: 'FETF82', name: 'EID handheld device (stick reader)', description: 'Stick-type EID reader for reading livestock ear tags at arm length.', specification: 'ISO 11784/11785, stick form factor, Bluetooth, rechargeable battery', grant_value: 232, grant_unit: 'per item', category: 'general-monitoring', score: 7 },
  { id: 'fetf-off-ah-089', item_code: 'FETF100', name: 'Cameras for monitoring livestock', description: 'Camera system for remote monitoring of livestock in buildings, calving pens, or lambing sheds.', specification: 'Night vision, minimum 2 cameras, remote viewing, weatherproof, recording', grant_value: 110, grant_unit: 'per item', category: 'general-monitoring', score: 6 },
  { id: 'fetf-off-ah-090', item_code: 'FETF101', name: 'Auto EID drench gun', description: 'Automatic dosing gun with EID reader for recording treatments against individual animal records.', specification: 'EID reader integrated, automatic dose recording, adjustable dose volume', grant_value: 318, grant_unit: 'per item', category: 'general-welfare', score: 7 },
  { id: 'fetf-off-ah-091', item_code: 'FETF102', name: 'Auto vaccination gun for livestock', description: 'Automatic repeating vaccination gun for efficient vaccination of large flocks or herds.', specification: 'Automatic refilling, adjustable dose, suitable for IM and SC injection', grant_value: 340, grant_unit: 'per item', category: 'general-welfare', score: 6 },
  { id: 'fetf-off-ah-092', item_code: 'FETF105', name: 'Positive pressure tube ventilation system', description: 'Positive-pressure tube ventilation for livestock buildings, distributing fresh air evenly through perforated tubes.', specification: 'Fan unit with perforated tube, minimum 10m length, thermostat controlled', grant_value: 604, grant_unit: 'per item', category: 'general-welfare', score: 6 },
  { id: 'fetf-off-ah-093', item_code: 'FETF107', name: 'Electric fencing package', description: 'Complete electric fencing kit for livestock containment or rotational grazing.', specification: 'Energiser, posts, wire/tape, minimum 500m, solar or mains powered', grant_value: 641, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-094', item_code: 'FETF108', name: 'Thermal image camera', description: 'Handheld thermal imaging camera for detecting early signs of inflammation, fever, or injury in livestock.', specification: 'Thermal imaging, minimum 160x120 resolution, livestock calibrated', grant_value: 263, grant_unit: 'per item', category: 'general-monitoring', score: 7 },
  { id: 'fetf-off-ah-095', item_code: 'FETF272A', name: 'Solar powered electric fence energiser', description: 'Solar-powered electric fence energiser for remote paddocks without mains electricity.', specification: 'Solar panel, battery, minimum 1 joule output, weatherproof', grant_value: 100, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-096', item_code: 'FETF273A', name: 'Protective matting for range/pasture', description: 'Rubber or plastic matting for high-traffic areas of poultry range or livestock paddocks.', specification: 'Interlocking or roll-out, non-slip, permeable, per m2', grant_value: 8, grant_unit: 'per item', category: 'general-welfare', score: 4 },
  { id: 'fetf-off-ah-097', item_code: 'FETF274A', name: 'Blinds for livestock housing', description: 'Roller blinds for livestock building openings to control ventilation, light, and wind exposure.', specification: 'Manual or motorised, UV-resistant material, adjustable', grant_value: 22, grant_unit: 'per item', category: 'general-welfare', score: 4 },
  { id: 'fetf-off-ah-098', item_code: 'FETF275A', name: 'Chimney ventilation unit', description: 'Chimney-type passive ventilation unit for livestock buildings, using thermal buoyancy to extract stale air.', specification: 'Ridge-mounted, minimum 600mm diameter, adjustable damper, weather cap', grant_value: 450, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-099', item_code: 'FETF276A', name: 'High volume low speed ventilation fans', description: 'Large-diameter slow-speed ceiling fans for livestock buildings, improving air circulation and reducing heat stress.', specification: 'Minimum 3m diameter, variable speed, ceiling or truss mount, minimum 1.5m clearance', grant_value: 1950, grant_unit: 'per item', category: 'general-welfare', score: 6 },
  { id: 'fetf-off-ah-100', item_code: 'FETF277A', name: 'Temperature and humidity sensor', description: 'Wireless temperature and humidity sensor for monitoring conditions in livestock buildings.', specification: 'Wireless data transmission, cloud dashboard, accuracy +/- 0.5C, alert thresholds', grant_value: 45, grant_unit: 'per item', category: 'general-monitoring', score: 5 },
  { id: 'fetf-off-ah-101', item_code: 'FETF278A', name: 'Water bowsers with integrated trough', description: 'Mobile water bowser with integrated drinking trough for livestock in remote fields.', specification: 'Minimum 1000L capacity, integrated trough, float valve, road-towable', grant_value: 1843, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-102', item_code: 'FETF279A', name: 'Vaccine refrigerator with external monitor', description: 'Dedicated vaccine refrigerator with external temperature display and alarm for maintaining cold chain.', specification: 'Pharmaceutical grade, 2-8C range, external display, temperature alarm, data logger', grant_value: 300, grant_unit: 'per item', category: 'general-welfare', score: 6 },
  { id: 'fetf-off-ah-103', item_code: 'FETF280A', name: 'Handheld digital brix refractometer', description: 'Digital Brix refractometer for testing colostrum quality in cattle and sheep.', specification: 'Digital display, automatic temperature compensation, accuracy +/- 0.2%', grant_value: 82, grant_unit: 'per item', category: 'general-monitoring', score: 5 },
  { id: 'fetf-off-ah-104', item_code: 'FETF281A', name: 'Water heater', description: 'Water heater for warming drinking water for livestock during cold weather.', specification: 'Thermostatically controlled, minimum 50L capacity, submersible or flow-through', grant_value: 70, grant_unit: 'per item', category: 'general-welfare', score: 4 },
  { id: 'fetf-off-ah-105', item_code: 'FETF282A', name: 'Vermin proof feed storage (portable)', description: 'Portable vermin-proof feed storage bin for storing concentrates and supplements.', specification: 'Sealed lid, minimum 200L capacity, rodent-proof, portable/wheeled', grant_value: 163, grant_unit: 'per item', category: 'general-welfare', score: 4 },
  { id: 'fetf-off-ah-106', item_code: 'FETF283A', name: 'Ammonia sensor', description: 'Fixed ammonia sensor for livestock buildings to monitor air quality and trigger ventilation.', specification: 'Electrochemical sensor, 0-100 ppm range, alarm output, data logging', grant_value: 362, grant_unit: 'per item', category: 'general-monitoring', score: 6 },
  { id: 'fetf-off-ah-107', item_code: 'FETF284A', name: 'Carbon dioxide sensor', description: 'CO2 sensor for livestock buildings to monitor ventilation adequacy.', specification: 'NDIR sensor, 0-5000 ppm range, alarm output, data logging, weatherproof', grant_value: 178, grant_unit: 'per item', category: 'general-monitoring', score: 5 },
  { id: 'fetf-off-ah-108', item_code: 'FETF285A', name: 'Dust sensor', description: 'Particulate matter sensor for livestock buildings to monitor dust levels affecting respiratory health.', specification: 'PM2.5 and PM10 measurement, real-time display, data logging, alarm', grant_value: 39, grant_unit: 'per item', category: 'general-monitoring', score: 5 },
  { id: 'fetf-off-ah-109', item_code: 'FETF286A', name: 'Water dosing pump', description: 'Proportional water dosing pump for adding supplements, vitamins, or treatments to livestock drinking water.', specification: 'Proportional dosing, adjustable rate, suitable for livestock water lines', grant_value: 150, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-110', item_code: 'FETF287A', name: 'Mobile livestock shade', description: 'Portable shade structure for livestock in open pastures to reduce heat stress.', specification: 'Mobile/towable, minimum 20m2 shade area, UV-resistant, livestock-proof', grant_value: 4003, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-111', item_code: 'FETF288A', name: 'Tunnel ventilation fan', description: 'High-capacity tunnel ventilation fan for livestock buildings with length ventilation systems.', specification: 'Minimum 900mm diameter, high volume, low noise, weatherproof housing', grant_value: 355, grant_unit: 'per item', category: 'general-welfare', score: 5 },
  { id: 'fetf-off-ah-112', item_code: 'FETF289A', name: 'Handheld colostrum milking kit', description: 'Portable hand-milking kit for collecting colostrum from cows or ewes for newborn feeding.', specification: 'Food-grade materials, collection bottle, easy-clean', grant_value: 46, grant_unit: 'per item', category: 'general-welfare', score: 4 },
];

// ── EWCO Items ──────────────────────────────────────────────────
// Source: Forestry Commission England Woodland Creation Offer payment rates

const EWCO_ITEMS = [
  { id: 'ewco-001', item_code: 'EWCO-001', name: 'Standard creation payment - broadleaf', description: 'Payment for new broadleaf woodland creation per hectare. Covers establishment costs.', specification: 'Minimum 1 ha, minimum 1,100 trees per ha', grant_value: 8500, grant_unit: 'per ha', category: 'creation', score: null },
  { id: 'ewco-002', item_code: 'EWCO-002', name: 'Standard creation payment - conifer', description: 'Payment for new conifer woodland creation per hectare. Covers establishment costs.', specification: 'Minimum 1 ha, minimum 2,250 trees per ha for conifer', grant_value: 6800, grant_unit: 'per ha', category: 'creation', score: null },
  { id: 'ewco-003', item_code: 'EWCO-003', name: 'Maintenance payment (years 1-10)', description: 'Annual maintenance payment for the first 10 years after woodland creation. Covers weeding, beating up, and protection maintenance.', specification: 'Payable annually for 10 years following creation', grant_value: 300, grant_unit: 'per ha/year', category: 'maintenance', score: null },
  { id: 'ewco-004', item_code: 'EWCO-004', name: 'Infrastructure - fencing and gates', description: 'Contribution toward deer/stock fencing and gates needed to protect new woodland.', specification: 'Actual costs reimbursed, must be necessary for woodland establishment', grant_value: 0, grant_unit: 'actual cost', category: 'infrastructure', score: null },
  { id: 'ewco-005', item_code: 'EWCO-005', name: 'Additional contribution - nature recovery', description: 'Additional per-hectare payment for woodland creation that contributes to nature recovery (native species, connectivity, buffering protected sites).', specification: 'Native broadleaf species, located to enhance ecological connectivity', grant_value: 2800, grant_unit: 'per ha', category: 'additional', score: null },
  // New EWCO items
  { id: 'ewco-006', item_code: 'EWCO-006', name: 'Conifer maintenance payment (years 1-10)', description: 'Annual maintenance payment for conifer woodland for the first 10 years. Lower rate than broadleaf reflecting different management needs.', specification: 'Payable annually for 10 years following conifer creation', grant_value: 200, grant_unit: 'per ha/year', category: 'maintenance', score: null },
  { id: 'ewco-007', item_code: 'EWCO-007', name: 'Additional contribution - flood risk', description: 'Additional per-hectare payment for woodland creation that reduces downstream flood risk through slowing water flow and increasing infiltration.', specification: 'Within a priority flood catchment, confirmed by Environment Agency mapping', grant_value: 1200, grant_unit: 'per ha', category: 'additional', score: null },
  { id: 'ewco-008', item_code: 'EWCO-008', name: 'Additional contribution - water quality', description: 'Additional per-hectare payment for riparian or catchment woodland that improves water quality by reducing sediment and nutrient runoff.', specification: 'Within 50m of watercourse or in water quality priority area', grant_value: 600, grant_unit: 'per ha', category: 'additional', score: null },
  { id: 'ewco-009', item_code: 'EWCO-009', name: 'Additional contribution - public access', description: 'Additional per-hectare payment for new woodland with dedicated public access (permissive paths, open access).', specification: 'Permissive footpath or open access, maintained for agreement duration', grant_value: 2200, grant_unit: 'per ha', category: 'additional', score: null },
  { id: 'ewco-010', item_code: 'EWCO-010', name: 'Infrastructure - deer/stock fencing', description: 'Standard deer or stock fencing to protect new woodland from browsing damage. Paid per linear metre.', specification: 'Minimum 1.8m height (deer) or 1.1m (stock), post and wire construction', grant_value: 10, grant_unit: 'per metre', category: 'infrastructure', score: null },
  { id: 'ewco-011', item_code: 'EWCO-011', name: 'Infrastructure - gates', description: 'Field gates or pedestrian gates for access through fenced woodland areas.', specification: 'Standard field gate (3.6m) or pedestrian gate (1.2m), galvanised', grant_value: 350, grant_unit: 'per gate', category: 'infrastructure', score: null },
  { id: 'ewco-012', item_code: 'EWCO-012', name: 'Infrastructure - tree guards', description: 'Individual tree guards (spiral or mesh) for protecting individual trees in open or parkland plantings.', specification: 'Spiral guard or mesh guard with stake, biodegradable preferred', grant_value: 2, grant_unit: 'per tree', category: 'infrastructure', score: null },
  { id: 'ewco-013', item_code: 'EWCO-013', name: 'Additional contribution - close to settlements', description: 'Additional payment for woodland creation near urban areas or settlements, providing amenity and wellbeing benefits.', specification: 'Within 500m of settlement boundary, public access provided', grant_value: 1600, grant_unit: 'per ha', category: 'additional', score: null },
  // Additional EWCO items
  { id: 'ewco-014', item_code: 'EWCO-014', name: 'Natural colonisation option', description: 'Payment for allowing natural tree regeneration (natural colonisation) rather than planting. Suitable for areas adjacent to existing woodland seed sources.', specification: 'Minimum 1 ha, adjacent to existing seed source, deer/stock fencing required, monitoring plan', grant_value: 6000, grant_unit: 'per ha', category: 'creation', score: null },
  { id: 'ewco-015', item_code: 'EWCO-015', name: 'Additional contribution - riparian buffer', description: 'Additional per-hectare payment for riparian woodland creation along watercourses, providing shade, bank stabilisation, and aquatic habitat benefits.', specification: 'Within 15m of watercourse, minimum 0.5 ha, native species suited to wet ground', grant_value: 900, grant_unit: 'per ha', category: 'additional', score: null },
  { id: 'ewco-016', item_code: 'EWCO-016', name: 'Veteran tree protection (supplement)', description: 'Additional payment where woodland creation design includes buffer zones around existing veteran or ancient trees.', specification: 'Buffer zone minimum 15 x crown radius, no planting within buffer, ground protection during operations', grant_value: 400, grant_unit: 'per tree', category: 'additional', score: null },
  { id: 'ewco-017', item_code: 'EWCO-017', name: 'Mixed broadleaf and conifer creation', description: 'Payment for mixed woodland creation combining broadleaf and conifer species for timber production and biodiversity.', specification: 'Minimum 20% broadleaf by area, species mix approved by FC, minimum 1 ha', grant_value: 7500, grant_unit: 'per ha', category: 'creation', score: null },
];

// ── Capital Grants 2026 Items ──────────────────────────────────
// Source: DEFRA Farming Transformation Fund Capital Grants guidance

const CAPITAL_GRANTS_ITEMS = [
  { id: 'cg-001', item_code: 'CG-001', name: 'Rainwater harvesting system', description: 'Rainwater collection and storage infrastructure for irrigation or livestock water supply.', specification: 'Minimum 50,000 litre capacity', grant_value: 20000, grant_unit: 'per item', category: 'water', score: null },
  { id: 'cg-002', item_code: 'CG-002', name: 'Reservoir construction', description: 'On-farm water storage reservoir for irrigation. Reduces reliance on abstraction.', specification: 'Minimum 5,000 m3, lined', grant_value: 250000, grant_unit: 'per item', category: 'water', score: null },
  { id: 'cg-003', item_code: 'CG-003', name: 'Solar panel array (farm buildings)', description: 'Rooftop or ground-mounted solar PV system for farm buildings.', specification: 'Grid-connected, minimum 10 kWp', grant_value: 40000, grant_unit: 'per item', category: 'energy', score: null },
  // New Capital Grants items
  { id: 'cg-004', item_code: 'CG-004', name: 'Slurry store (new build)', description: 'Purpose-built slurry store providing at least 6 months storage capacity. Reduces pollution risk and enables precise nutrient application timing.', specification: 'Minimum 6 months storage, above or below ground, SSAFO-compliant, with cover', grant_value: 500000, grant_unit: 'per item', category: 'slurry', score: null },
  { id: 'cg-005', item_code: 'CG-005', name: 'Roofing for existing yard or manure store', description: 'Roofing over existing concrete yards, middens, or manure stores to prevent clean rainwater mixing with dirty water, reducing slurry volumes.', specification: 'Steel-framed, minimum 200m2 coverage, guttering and clean water drainage', grant_value: 100000, grant_unit: 'per item', category: 'infrastructure', score: null },
  { id: 'cg-006', item_code: 'CG-006', name: 'Concrete yard renewal', description: 'Replacement or upgrade of existing concrete yards to prevent pollution from cracked surfaces and improve drainage separation.', specification: 'Minimum 150mm reinforced concrete, falls to drainage, channel drainage system', grant_value: 50000, grant_unit: 'per item', category: 'infrastructure', score: null },
  { id: 'cg-007', item_code: 'CG-007', name: 'Permanent livestock handling facilities', description: 'New permanent cattle or sheep handling facilities including collecting yard, race, crush, and loading ramp.', specification: 'Galvanised steel construction, concrete base, compliant with livestock welfare codes', grant_value: 30000, grant_unit: 'per item', category: 'livestock', score: null },
  { id: 'cg-008', item_code: 'CG-008', name: 'Water supply infrastructure', description: 'New or upgraded mains-connected or borehole water supply for livestock or crop irrigation, including pipework and troughs.', specification: 'WRAS-approved fittings, minimum 20mm supply pipe, frost-protected', grant_value: 25000, grant_unit: 'per item', category: 'water', score: null },
  { id: 'cg-009', item_code: 'CG-009', name: 'Stock-proof fencing (permanent)', description: 'Permanent stock-proof fencing for livestock containment, grazing management, or river/watercourse exclusion.', specification: 'Post and rail or post and wire, minimum 1.1m height, pressure-treated timber or galvanised steel', grant_value: 20000, grant_unit: 'per item', category: 'livestock', score: null },
  // Additional Capital Grants items
  { id: 'cg-010', item_code: 'CG-010', name: 'Livestock building (new)', description: 'New purpose-built livestock housing for cattle, sheep, or pigs. Must meet welfare codes and planning requirements.', specification: 'Steel-framed, concrete floor, adequate ventilation, minimum 200m2, compliant with welfare codes', grant_value: 350000, grant_unit: 'per item', category: 'livestock', score: null },
  { id: 'cg-011', item_code: 'CG-011', name: 'Grain store (new build)', description: 'New on-farm grain storage facility with integrated drying and monitoring, reducing post-harvest losses.', specification: 'Minimum 500 tonne capacity, insulated, temperature monitoring, ventilation or drying floor', grant_value: 200000, grant_unit: 'per item', category: 'arable', score: null },
  { id: 'cg-012', item_code: 'CG-012', name: 'Anaerobic digester (small-scale)', description: 'Small-scale anaerobic digestion plant for on-farm energy from livestock slurry and crop waste.', specification: 'Minimum 50 kW electrical output, CHP unit, digestate storage, planning consent', grant_value: 500000, grant_unit: 'per item', category: 'energy', score: null },
  { id: 'cg-013', item_code: 'CG-013', name: 'Packhouse (new build or upgrade)', description: 'New or upgraded packhouse for grading, packing, and cold storage of horticultural produce.', specification: 'Cold storage capability, food-grade surfaces, minimum 100m2', grant_value: 250000, grant_unit: 'per item', category: 'horticulture', score: null },
  { id: 'cg-014', item_code: 'CG-014', name: 'Slurry lagoon (lined)', description: 'New lined earth-banked slurry lagoon providing minimum 6 months storage capacity for farms that cannot build above-ground stores.', specification: 'HDPE or clay lined, SSAFO compliant, capacity calculation provided, freeboard minimum 300mm', grant_value: 400000, grant_unit: 'per item', category: 'slurry', score: null },
];

// ── Countryside Stewardship Higher Tier Items ───────────────────
// Source: Natural England CS Higher Tier options and payment rates

const CS_HIGHER_TIER_ITEMS = [
  { id: 'csht-001', item_code: 'CSHT-001', name: 'HK6 Maintenance of species-rich grassland', description: 'Annual revenue payment for maintaining existing species-rich grassland through appropriate cutting and/or grazing management.', specification: '5-year agreement, cutting dates after 15 July (varies by habitat), no fertiliser or herbicide', grant_value: 182, grant_unit: 'per ha/year', category: 'grassland', score: null },
  { id: 'csht-002', item_code: 'CSHT-002', name: 'HK7 Restoration of species-rich grassland', description: 'Annual revenue payment for restoring degraded grassland to species-rich condition through management changes and optional seed introduction.', specification: '5-year agreement, reduce stocking rate, cease fertiliser, cut and remove after 15 July', grant_value: 309, grant_unit: 'per ha/year', category: 'grassland', score: null },
  { id: 'csht-003', item_code: 'CSHT-003', name: 'HS6 Maintenance of rough grazing for birds', description: 'Payment for maintaining rough grassland and moorland in suitable condition for ground-nesting birds (waders, raptors).', specification: '5-year agreement, light grazing only, predator control where agreed, no drainage improvements', grant_value: 88, grant_unit: 'per ha/year', category: 'birds', score: null },
  { id: 'csht-004', item_code: 'CSHT-004', name: 'HS7 Restoration of rough grazing for birds', description: 'Payment for restoring rough grazing to improve habitat for breeding waders, raptors, and other upland birds.', specification: '5-year agreement, reduce stocking density, block grips/drains, raise water table', grant_value: 309, grant_unit: 'per ha/year', category: 'birds', score: null },
  { id: 'csht-005', item_code: 'CSHT-005', name: 'HF4 Nectar flower mix', description: 'Payment for establishing and maintaining a nectar-rich flower mix to support pollinators and beneficial insects.', specification: '5-year agreement, minimum 0.5 ha blocks, sow approved seed mix, cut once after September', grant_value: 511, grant_unit: 'per ha/year', category: 'pollinators', score: null },
  { id: 'csht-006', item_code: 'CSHT-006', name: 'HE10 Floristically enhanced grass margin', description: 'Payment for creating and maintaining flower-rich grass margins at field edges to support pollinators and farmland wildlife.', specification: 'Minimum 4m width, sow wildflower and grass mix, cut once per year after August', grant_value: 539, grant_unit: 'per ha/year', category: 'pollinators', score: null },
  { id: 'csht-007', item_code: 'CSHT-007', name: 'HB3 Create woodland edge habitat', description: 'Payment for creating a graded woodland edge with shrubs and herbaceous vegetation, providing a transition between woodland and open farmland.', specification: 'Minimum 6m width, native shrub species, managed by rotational cutting', grant_value: 335, grant_unit: 'per ha/year', category: 'woodland', score: null },
  { id: 'csht-008', item_code: 'CSHT-008', name: 'HW2 Create traditional orchard', description: 'Payment for planting and maintaining a traditional orchard with standard fruit trees at wide spacing, managed for biodiversity.', specification: 'Native or heritage fruit varieties, standard trees (1.8m+ stem), maximum 150 trees/ha', grant_value: 264, grant_unit: 'per tree', category: 'orchard', score: null },
  { id: 'csht-009', item_code: 'CSHT-009', name: 'HK8 Creation of species-rich grassland', description: 'Payment for converting arable or improved grassland to species-rich grassland through seed sowing and appropriate management.', specification: 'Approved native seed mix, no fertiliser, cut and remove annually', grant_value: 377, grant_unit: 'per ha/year', category: 'grassland', score: null },
  { id: 'csht-010', item_code: 'CSHT-010', name: 'HB5 Hedgerow management (both sides)', description: 'Payment for management of existing hedgerows on a 3-year rotation, allowing hedgerows to grow taller and wider for wildlife.', specification: 'Cut on 3-year rotation, maintain minimum 2m height, no flailing during nesting season', grant_value: 13, grant_unit: 'per 100m/year', category: 'boundary', score: null },
  { id: 'csht-011', item_code: 'CSHT-011', name: 'HB11 Planting new hedgerow', description: 'Capital payment for planting a new native hedgerow with guard protection and subsequent management.', specification: 'Minimum 5 native species per 30m, double-row planting, guards and stakes', grant_value: 11, grant_unit: 'per metre', category: 'boundary', score: null },
  { id: 'csht-012', item_code: 'CSHT-012', name: 'HL9 Arable reversion to grassland with low fertiliser input', description: 'Payment for converting arable land to permanent grassland managed with low fertiliser inputs.', specification: 'Grass and legume mix, maximum 50 kg N/ha/year, no ploughing for agreement duration', grant_value: 311, grant_unit: 'per ha/year', category: 'grassland', score: null },
  { id: 'csht-013', item_code: 'CSHT-013', name: 'HF12 Creation of winter bird food plots', description: 'Payment for planting and maintaining seed-rich crop plots that provide winter food for farmland birds.', specification: 'Minimum 0.4 ha, sow approved seed mix (quinoa, linseed, millet), retain until March', grant_value: 640, grant_unit: 'per ha/year', category: 'birds', score: null },
  { id: 'csht-014', item_code: 'CSHT-014', name: 'HJ5 In-field grass strips', description: 'Payment for establishing permanent grass strips through arable fields to reduce run-off and provide wildlife corridors.', specification: 'Minimum 4m wide, grass mix, no pesticides, cut once annually', grant_value: 557, grant_unit: 'per ha/year', category: 'water', score: null },
  { id: 'csht-015', item_code: 'CSHT-015', name: 'HP2 Restoration of lowland raised bog', description: 'Payment for restoring lowland raised bogs through ditch blocking, scrub removal, and water level management.', specification: 'Agreed restoration plan, block drainage, remove invasive scrub', grant_value: 150, grant_unit: 'per ha/year', category: 'wetland', score: null },
  // Additional CS Higher Tier items
  { id: 'csht-016', item_code: 'CSHT-016', name: 'HK15 Haymaking supplement', description: 'Additional annual payment on top of HK6/HK7 for cutting and removing hay instead of grazing, to promote wildflower seed set.', specification: 'Cut after 15 July (or as agreed), remove hay within 2 weeks, no grazing until September', grant_value: 85, grant_unit: 'per ha/year', category: 'grassland', score: null },
  { id: 'csht-017', item_code: 'CSHT-017', name: 'HS2 Moorland management', description: 'Payment for managing upland moorland for conservation, including controlled burning plans, grazing, and bracken control.', specification: '5-year agreement, burning plan if applicable, reduced stocking density, bracken spraying allowed', grant_value: 45, grant_unit: 'per ha/year', category: 'moorland', score: null },
  { id: 'csht-018', item_code: 'CSHT-018', name: 'HW1 Woodland management plan implementation', description: 'Payment for implementing an approved woodland management plan on existing woodland, including thinning, coppicing, and ride management.', specification: 'Forestry Commission approved management plan, minimum 3 ha, 10-year agreement', grant_value: 100, grant_unit: 'per ha/year', category: 'woodland', score: null },
  { id: 'csht-019', item_code: 'CSHT-019', name: 'HN2 Coastal saltmarsh management', description: 'Payment for managing coastal saltmarsh through appropriate grazing, creek maintenance, and invasive species control.', specification: 'Light grazing only, no fertiliser, monitor for Spartina and sea purslane encroachment', grant_value: 275, grant_unit: 'per ha/year', category: 'coastal', score: null },
  { id: 'csht-020', item_code: 'CSHT-020', name: 'HR6 Water level management supplement', description: 'Additional payment for managing water levels on wetland and floodplain grassland, using sluices, pumps, and controlled drainage.', specification: 'Water level management plan agreed with Environment Agency, target water levels maintained', grant_value: 95, grant_unit: 'per ha/year', category: 'wetland', score: null },
  { id: 'csht-021', item_code: 'CSHT-021', name: 'HQ3 Arable field margins (pollen and nectar)', description: 'Payment for establishing and maintaining pollen and nectar flower margins at arable field edges to support pollinators.', specification: 'Minimum 4m width, approved wildflower mix, cut once in autumn, no pesticides on margin', grant_value: 495, grant_unit: 'per ha/year', category: 'pollinators', score: null },
  { id: 'csht-022', item_code: 'CSHT-022', name: 'HF13 Fallow plots for ground-nesting birds', description: 'Payment for leaving fallow plots within cropped fields to provide nesting habitat for skylark, lapwing, and other ground-nesting birds.', specification: 'Minimum 0.2 ha plots, minimum 2 per field, left uncropped March-August', grant_value: 524, grant_unit: 'per ha/year', category: 'birds', score: null },
  { id: 'csht-023', item_code: 'CSHT-023', name: 'HB12 Hedgerow restoration (gapping up)', description: 'Capital payment for restoring gaps in existing hedgerows by planting new whips to restore the hedge as a continuous feature.', specification: 'Minimum 5 native species per 30m section, plant at 6 per metre in gaps, guards and stakes', grant_value: 7, grant_unit: 'per metre', category: 'boundary', score: null },
];

// ── Stacking Rules ──────────────────────────────────────────────
// Based on DEFRA published guidance on combining grants

const STACKING_RULES = [
  // FETF inter-theme and with Capital Grants
  { grant_a: 'fetf-2026-productivity', grant_b: 'capital-grants-2026', compatible: 0, conditions: 'FETF and Capital Grants cannot fund the same items. If you receive FETF for an item, you cannot claim Capital Grants for the same item or purpose.' },
  { grant_a: 'fetf-2026-slurry', grant_b: 'capital-grants-2026', compatible: 0, conditions: 'FETF slurry items and Capital Grants cannot both fund the same slurry infrastructure. A new slurry store funded under FETF cannot also be funded under Capital Grants.' },
  { grant_a: 'fetf-2026-animal-health', grant_b: 'capital-grants-2026', compatible: 0, conditions: 'FETF animal health items and Capital Grants cannot fund the same equipment. Handling facilities under Capital Grants and weighing equipment under FETF are permitted if they are different items.' },

  // FETF with Countryside Stewardship
  { grant_a: 'fetf-2026-productivity', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. FETF funds equipment; Countryside Stewardship pays for environmental management actions. Different purposes, no overlap.' },
  { grant_a: 'fetf-2026-slurry', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. Slurry equipment (FETF) complements environmental management (CS). No double payment for same activity.' },
  { grant_a: 'fetf-2026-animal-health', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. FETF animal health equipment and CS environmental management serve different purposes. No overlap in funded activities.' },

  // Capital Grants with Countryside Stewardship
  { grant_a: 'capital-grants-2026', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. Capital Grants fund infrastructure; CS pays revenue for environmental actions. Ensure no double payment for capital items already covered under CS capital options.' },

  // EWCO combinations
  { grant_a: 'cs-higher-tier', grant_b: 'ewco', compatible: 1, conditions: 'Compatible with restrictions. CS and EWCO can apply to different land parcels on the same holding. Cannot receive both payments for the same parcel of land.' },
  { grant_a: 'ewco', grant_b: 'fetf-2026-productivity', compatible: 1, conditions: 'Compatible. EWCO covers woodland creation; FETF covers farm equipment. Different purposes, different land use.' },
  { grant_a: 'ewco', grant_b: 'fetf-2026-slurry', compatible: 1, conditions: 'Compatible. EWCO covers woodland creation on eligible land; FETF slurry covers livestock manure management. No overlap.' },
  { grant_a: 'ewco', grant_b: 'fetf-2026-animal-health', compatible: 1, conditions: 'Compatible. EWCO covers woodland creation; FETF animal health covers livestock equipment. Different land uses.' },
  { grant_a: 'ewco', grant_b: 'capital-grants-2026', compatible: 1, conditions: 'Compatible. EWCO funds woodland on eligible land; Capital Grants fund farm infrastructure. Different land parcels permitted.' },

  // FETF inter-theme (all three)
  { grant_a: 'fetf-2026-productivity', grant_b: 'fetf-2026-slurry', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },
  { grant_a: 'fetf-2026-productivity', grant_b: 'fetf-2026-animal-health', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },
  { grant_a: 'fetf-2026-slurry', grant_b: 'fetf-2026-animal-health', compatible: 1, conditions: 'Compatible. Different FETF themes can be combined, but the total across all FETF themes is capped at £50,000 per applicant per round.' },

  // Tree Health Pilot combinations
  { grant_a: 'tree-health-pilot', grant_b: 'ewco', compatible: 1, conditions: 'Compatible. Tree Health covers felling diseased trees; EWCO covers replanting and new woodland creation. Can be applied to the same site sequentially (fell then replant).' },
  { grant_a: 'tree-health-pilot', grant_b: 'cs-higher-tier', compatible: 1, conditions: 'Compatible. Tree Health funds disease management; CS funds environmental management on other land. Different activities.' },
  { grant_a: 'tree-health-pilot', grant_b: 'fetf-2026-productivity', compatible: 1, conditions: 'Compatible. Tree Health covers woodland disease management; FETF covers farm equipment. Different purposes.' },

  // FTF Water combinations (historical reference)
  { grant_a: 'ftf-water', grant_b: 'fetf-2026-productivity', compatible: 1, conditions: 'Compatible if items are different. FTF Water funded water infrastructure; FETF funds equipment. Closed but relevant for existing agreement holders.' },
  { grant_a: 'ftf-water', grant_b: 'capital-grants-2026', compatible: 0, conditions: 'Cannot fund the same water infrastructure under both schemes. Choose one route for each project.' },

  // CS Higher Tier additional combinations
  { grant_a: 'cs-higher-tier', grant_b: 'capital-grants-2026', compatible: 1, conditions: 'Compatible with restrictions. CS Higher Tier capital options (hedgerow planting, fencing) cannot overlap with Capital Grants for the same item. Revenue options (grassland management) are fully compatible with Capital Grants infrastructure.' },
  { grant_a: 'cs-higher-tier', grant_b: 'tree-health-pilot', compatible: 1, conditions: 'Compatible. CS environmental management and Tree Health disease management serve different purposes. Woodland within CS agreement can also receive Tree Health support for diseased trees.' },

  // EWCO additional combinations
  { grant_a: 'ewco', grant_b: 'tree-health-pilot', compatible: 1, conditions: 'Compatible and complementary. Tree Health covers felling diseased trees; EWCO covers replanting and new woodland creation on the same site or adjacent land.' },
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
      ...FETF_OFFICIAL_PRODUCTIVITY_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-productivity' })),
      ...FETF_OFFICIAL_SLURRY_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-slurry' })),
      ...FETF_OFFICIAL_ANIMAL_HEALTH_ITEMS.map(i => ({ ...i, grant_id: 'fetf-2026-animal-health' })),
      ...EWCO_ITEMS.map(i => ({ ...i, grant_id: 'ewco' })),
      ...CAPITAL_GRANTS_ITEMS.map(i => ({ ...i, grant_id: 'capital-grants-2026' })),
      ...CS_HIGHER_TIER_ITEMS.map(i => ({ ...i, grant_id: 'cs-higher-tier' })),
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
  const content = JSON.stringify({ GRANTS, FETF_PRODUCTIVITY_ITEMS, FETF_SLURRY_ITEMS, FETF_ANIMAL_HEALTH_ITEMS, FETF_OFFICIAL_PRODUCTIVITY_ITEMS, FETF_OFFICIAL_SLURRY_ITEMS, FETF_OFFICIAL_ANIMAL_HEALTH_ITEMS, EWCO_ITEMS, CAPITAL_GRANTS_ITEMS, CS_HIGHER_TIER_ITEMS, STACKING_RULES, APPLICATION_GUIDANCE });
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
