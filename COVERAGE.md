# Coverage

## What Is Included

- **FETF 2026** -- Productivity (123 items), Slurry (35 items), and Animal Health (140 items) themes with eligible items, grant values, specifications, and scoring. Includes all official RPA-published items from GOV.UK Annex 3 and Annex 4.
- **Farming Transformation Fund Capital Grants** -- 14 large-scale capital investment grants with match-funding requirements (slurry stores, buildings, grain stores, AD plants)
- **England Woodland Creation Offer (EWCO)** -- 17 options: per-hectare creation payments, maintenance, infrastructure (fencing, gates, tree guards), nature recovery, flood risk, water quality, natural colonisation
- **Countryside Stewardship Higher Tier** -- 23 revenue payment options for environmental management (grassland, moorland, woodland, coastal, pollinators, birds, wetland)
- **Tree Health Pilot** -- Grants for managing diseased woodland
- **8 grant schemes, 352 eligible items, 23 stacking rules**
- **Stacking rules** -- Which grants can and cannot be combined, with conditions
- **Application guidance** -- Step-by-step process for each grant with evidence requirements and portal links
- **Deadline tracking** -- Open, upcoming, and rolling grant windows with days remaining

## Jurisdictions

| Code | Country | Status |
|------|---------|--------|
| GB | Great Britain (England focus) | Supported |

## What Is NOT Included

- **SFI (Sustainable Farming Incentive)** -- Separate scheme, planned for future version
- **BPS (Basic Payment Scheme)** -- Being phased out, not covered
- **Scotland, Wales, Northern Ireland** -- Devolved agriculture policy, different grant schemes
- **Historic closed rounds** -- Only FTF Water included for stacking reference
- **Full Countryside Stewardship options list** -- Only Higher Tier covered in v0.1.0
- **Real-time application status** -- This is reference data, not connected to the Rural Payments portal

## Known Gaps

1. FETF item lists may be updated by RPA between rounds -- check GOV.UK for the latest
2. Capital Grants 2026 opening date is estimated (July 2026) -- not yet confirmed by DEFRA
3. EWCO payment rates may be updated annually by the Forestry Commission
4. Stacking rules are based on current published guidance and may change between grant rounds

## Data Freshness

Run `check_data_freshness` to see when data was last updated. The ingestion pipeline runs on a schedule; manual triggers available via `gh workflow run ingest.yml`.
