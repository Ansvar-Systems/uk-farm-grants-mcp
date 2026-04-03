import { buildMeta } from '../metadata.js';
import type { Database } from '../db.js';

interface Source {
  name: string;
  authority: string;
  official_url: string;
  retrieval_method: string;
  update_frequency: string;
  license: string;
  coverage: string;
  last_retrieved?: string;
}

export function handleListSources(db: Database): { sources: Source[]; _meta: ReturnType<typeof buildMeta> } {
  const lastIngest = db.get<{ value: string }>('SELECT value FROM db_metadata WHERE key = ?', ['last_ingest']);

  const sources: Source[] = [
    {
      name: 'DEFRA Farming and Countryside Programme',
      authority: 'Department for Environment, Food and Rural Affairs',
      official_url: 'https://www.gov.uk/guidance/funding-for-farmers',
      retrieval_method: 'MANUAL_EXTRACTION',
      update_frequency: 'per grant round',
      license: 'Open Government Licence v3',
      coverage: 'Grant schemes, eligibility, payment rates, deadlines',
      last_retrieved: lastIngest?.value,
    },
    {
      name: 'RPA FETF Grant Guidance',
      authority: 'Rural Payments Agency',
      official_url: 'https://www.gov.uk/government/collections/farming-equipment-and-technology-fund',
      retrieval_method: 'MANUAL_EXTRACTION',
      update_frequency: 'per FETF round',
      license: 'Open Government Licence v3',
      coverage: 'FETF eligible items, specifications, grant values, scoring',
      last_retrieved: lastIngest?.value,
    },
    {
      name: 'Forestry Commission EWCO',
      authority: 'Forestry Commission',
      official_url: 'https://www.gov.uk/guidance/england-woodland-creation-offer',
      retrieval_method: 'MANUAL_EXTRACTION',
      update_frequency: 'annual',
      license: 'Open Government Licence v3',
      coverage: 'Woodland creation payment rates, maintenance payments, eligibility',
      last_retrieved: lastIngest?.value,
    },
    {
      name: 'Natural England Countryside Stewardship',
      authority: 'Natural England',
      official_url: 'https://www.gov.uk/government/collections/countryside-stewardship',
      retrieval_method: 'MANUAL_EXTRACTION',
      update_frequency: 'annual',
      license: 'Open Government Licence v3',
      coverage: 'CS Higher Tier options, payment rates, eligibility',
      last_retrieved: lastIngest?.value,
    },
  ];

  return {
    sources,
    _meta: buildMeta({ source_url: 'https://www.gov.uk/guidance/funding-for-farmers' }),
  };
}
