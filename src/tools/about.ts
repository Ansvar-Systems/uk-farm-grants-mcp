import { buildMeta } from '../metadata.js';
import { SUPPORTED_JURISDICTIONS } from '../jurisdiction.js';

export function handleAbout() {
  return {
    name: 'UK Farm Grants MCP',
    description:
      'UK farm grants and capital funding made queryable by AI. Covers FETF 2026, Capital Grants, ' +
      'EWCO, Countryside Stewardship, deadlines, eligible items, and stacking rules. Data sourced ' +
      'from DEFRA, RPA, Forestry Commission, and Natural England.',
    version: '0.1.0',
    jurisdiction: [...SUPPORTED_JURISDICTIONS],
    data_sources: [
      'DEFRA Farming and Countryside Programme',
      'RPA FETF Grant Guidance',
      'Forestry Commission EWCO',
      'Natural England Countryside Stewardship',
    ],
    tools_count: 10,
    links: {
      homepage: 'https://ansvar.eu/open-agriculture',
      repository: 'https://github.com/Ansvar-Systems/uk-farm-grants-mcp',
      mcp_network: 'https://ansvar.ai/mcp',
    },
    _meta: buildMeta(),
  };
}
