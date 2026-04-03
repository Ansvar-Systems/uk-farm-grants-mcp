# UK Farm Grants MCP

[![CI](https://github.com/Ansvar-Systems/uk-farm-grants-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/uk-farm-grants-mcp/actions/workflows/ci.yml)
[![GHCR](https://github.com/Ansvar-Systems/uk-farm-grants-mcp/actions/workflows/ghcr-build.yml/badge.svg)](https://github.com/Ansvar-Systems/uk-farm-grants-mcp/actions/workflows/ghcr-build.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

UK farm grants and capital funding via the [Model Context Protocol](https://modelcontextprotocol.io). Query FETF 2026, Capital Grants, EWCO, Countryside Stewardship -- deadlines, eligible items, stacking rules, and application guidance -- all from your AI assistant.

Part of [Ansvar Open Agriculture](https://ansvar.eu/open-agriculture).

## Why This Exists

UK farmers leave millions in grant funding unclaimed every year because the information is scattered across dozens of GOV.UK pages, PDFs, and portals. This MCP server puts it all in one place, queryable by AI. Ask about deadlines, check what equipment qualifies, find out which grants can be combined, and estimate your funding before you apply.

## Quick Start

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "uk-farm-grants": {
      "command": "npx",
      "args": ["-y", "@ansvar/uk-farm-grants-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add uk-farm-grants npx @ansvar/uk-farm-grants-mcp
```

### Streamable HTTP (remote)

```
https://mcp.ansvar.eu/uk-farm-grants/mcp
```

### Docker (self-hosted)

```bash
docker run -p 3000:3000 ghcr.io/ansvar-systems/uk-farm-grants-mcp:latest
```

### npm (stdio)

```bash
npx @ansvar/uk-farm-grants-mcp
```

## Example Queries

Ask your AI assistant:

- "What FETF grants are open right now?"
- "Show me eligible items for FETF 2026 productivity"
- "Can I combine FETF with Countryside Stewardship?"
- "What's the deadline for FETF 2026?"
- "Estimate the grant value if I buy a direct drill and GPS guidance"
- "How do I apply for EWCO woodland creation?"
- "What grants are available for slurry management?"

## Stats

| Metric | Value |
|--------|-------|
| Tools | 10 (3 meta + 7 domain) |
| Jurisdiction | GB |
| Grants covered | FETF 2026 (3 themes), Capital Grants, EWCO, CS Higher Tier, Tree Health Pilot |
| Data sources | DEFRA, RPA, Forestry Commission, Natural England |
| License (data) | Open Government Licence v3 |
| License (code) | Apache-2.0 |
| Transport | stdio + Streamable HTTP |

## Tools

| Tool | Description |
|------|-------------|
| `about` | Server metadata and links |
| `list_sources` | Data sources with freshness info |
| `check_data_freshness` | Staleness status and refresh command |
| `search_grants` | FTS5 search across grants and eligible items |
| `get_grant_details` | Full grant scheme details with eligibility |
| `check_deadlines` | Open and upcoming deadlines with urgency |
| `get_eligible_items` | Eligible items with codes, values, specs |
| `check_stacking` | Grant combination compatibility matrix |
| `get_application_process` | Step-by-step application guidance |
| `estimate_grant_value` | Total grant estimate with match-funding |

See [TOOLS.md](TOOLS.md) for full parameter documentation.

## Security Scanning

This repository runs security checks on every push:

- **CodeQL** -- static analysis for JavaScript/TypeScript
- **Gitleaks** -- secret detection across full history
- **Dependency review** -- via Dependabot
- **Container scanning** -- via GHCR build pipeline

See [SECURITY.md](SECURITY.md) for reporting policy.

## Disclaimer

This tool provides reference data for informational purposes only. It is not professional financial or agricultural advice. Grant details change -- always verify on GOV.UK before applying. See [DISCLAIMER.md](DISCLAIMER.md).

## Contributing

Issues and pull requests welcome. For security vulnerabilities, email security@ansvar.eu (do not open a public issue).

## License

Apache-2.0. Data sourced under Open Government Licence v3.
