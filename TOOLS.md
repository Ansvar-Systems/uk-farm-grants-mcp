# Tools Reference

## Meta Tools

### `about`

Get server metadata: name, version, coverage, data sources, and links.

**Parameters:** None

**Returns:** Server name, version, jurisdiction list, data source names, tool count, homepage/repository links.

---

### `list_sources`

List all data sources with authority, URL, license, and freshness info.

**Parameters:** None

**Returns:** Array of data sources, each with `name`, `authority`, `official_url`, `retrieval_method`, `update_frequency`, `license`, `coverage`, `last_retrieved`.

---

### `check_data_freshness`

Check when data was last ingested, staleness status, and how to trigger a refresh.

**Parameters:** None

**Returns:** `status` (fresh/stale/unknown), `last_ingest`, `days_since_ingest`, `staleness_threshold_days`, `refresh_command`.

---

## Domain Tools

### `search_grants`

Search UK farm grants by keyword. Covers FETF, Capital Grants, EWCO, Countryside Stewardship, and more.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Free-text search query (e.g. "slurry equipment", "woodland creation") |
| `grant_type` | string | No | Filter by grant type (e.g. capital, revenue) |
| `min_value` | number | No | Minimum grant value in GBP |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |
| `limit` | number | No | Max results (default: 20, max: 50) |

**Example:** `{ "query": "precision farming equipment" }`

---

### `get_grant_details`

Get full details for a specific grant scheme: budget, eligibility, deadlines, match funding.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_id` | string | Yes | Grant ID (e.g. fetf-2026-productivity, ewco, cs-higher-tier) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** Grant name, type, authority, budget, status, dates, description, eligibility, match funding requirement, eligible items count.

**Example:** `{ "grant_id": "fetf-2026-productivity" }`

---

### `check_deadlines`

List open and upcoming grant deadlines, sorted by urgency. Shows days remaining and closing status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_type` | string | No | Filter by grant type (e.g. capital, revenue) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** Array of grants with `status`, `open_date`, `close_date`, `days_remaining`, `urgency` (closing soon / approaching / open / rolling).

---

### `get_eligible_items`

List eligible items for a grant with codes, values, and specifications. Filter by category.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_id` | string | Yes | Grant ID (e.g. fetf-2026-productivity) |
| `category` | string | No | Filter by item category (e.g. precision, slurry, handling) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** Items grouped by category, each with `item_code`, `name`, `description`, `specification`, `grant_value`, `grant_unit`, `score`.

**Example:** `{ "grant_id": "fetf-2026-productivity", "category": "precision" }`

---

### `check_stacking`

Check whether multiple grants can be combined (stacked). Checks all pair combinations and returns compatibility matrix.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_ids` | string[] | Yes | Array of grant IDs to check compatibility (minimum 2) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** `all_compatible` flag, array of pair results with `compatible`, `conditions`.

**Example:** `{ "grant_ids": ["fetf-2026-productivity", "cs-higher-tier", "ewco"] }`

---

### `get_application_process`

Get step-by-step application guidance for a grant, including evidence requirements and portal links.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_id` | string | Yes | Grant ID (e.g. fetf-2026-productivity) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** Ordered steps with `description`, `evidence_required`, `portal` URL.

**Example:** `{ "grant_id": "ewco" }`

---

### `estimate_grant_value`

Calculate total grant value from selected items. Applies grant cap and calculates match-funding requirement.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `grant_id` | string | Yes | Grant ID (e.g. fetf-2026-productivity) |
| `items` | string[] | No | Array of item codes to include. If omitted, includes all items |
| `area_ha` | number | No | Area in hectares (for per-hectare payment items like EWCO) |
| `jurisdiction` | string | No | ISO 3166-1 alpha-2 code (default: GB) |

**Returns:** Item breakdown, subtotal, grant cap, capped value, match-funding percentage and amount, total project cost.

**Example:** `{ "grant_id": "fetf-2026-productivity", "items": ["FETF-PR-001", "FETF-PR-003"] }`
