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

// ── FETF Slurry Items ───────────────────────────────────────────
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

// ── FETF Animal Health Items ────────────────────────────────────
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
  const content = JSON.stringify({ GRANTS, FETF_PRODUCTIVITY_ITEMS, FETF_SLURRY_ITEMS, FETF_ANIMAL_HEALTH_ITEMS, EWCO_ITEMS, CAPITAL_GRANTS_ITEMS, CS_HIGHER_TIER_ITEMS, STACKING_RULES, APPLICATION_GUIDANCE });
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
