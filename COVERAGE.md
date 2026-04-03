# Coverage

## What Is Included

- **FETF 2026** -- Productivity, Slurry, and Animal Health themes with eligible items, grant values, specifications, and scoring
- **Farming Transformation Fund Capital Grants** -- Large-scale capital investment grants with match-funding requirements
- **England Woodland Creation Offer (EWCO)** -- Per-hectare creation payments, maintenance payments, infrastructure, nature recovery top-ups
- **Countryside Stewardship Higher Tier** -- Revenue payments for environmental management on sensitive sites
- **Tree Health Pilot** -- Grants for managing diseased woodland
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
