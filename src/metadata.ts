export interface Meta {
  disclaimer: string;
  data_age: string;
  source_url: string;
  copyright: string;
  server: string;
  version: string;
}

const DISCLAIMER =
  'This server provides guidance on UK farm grants based on published DEFRA and RPA information. ' +
  'Grant details, deadlines, and payment rates may change. Always verify current terms on GOV.UK ' +
  'before applying. This is not a grant application service.';

export function buildMeta(overrides?: Partial<Meta>): Meta {
  return {
    disclaimer: DISCLAIMER,
    data_age: overrides?.data_age ?? 'unknown',
    source_url: overrides?.source_url ?? 'https://www.gov.uk/guidance/funding-for-farmers',
    copyright: 'Data: Crown Copyright (Open Government Licence v3). Server: Apache-2.0 Ansvar Systems.',
    server: 'uk-farm-grants-mcp',
    version: '0.1.0',
    ...overrides,
  };
}
