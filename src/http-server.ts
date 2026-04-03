import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createDatabase, type Database } from './db.js';
import { handleAbout } from './tools/about.js';
import { handleListSources } from './tools/list-sources.js';
import { handleCheckFreshness } from './tools/check-freshness.js';
import { handleSearchGrants } from './tools/search-grants.js';
import { handleGetGrantDetails } from './tools/get-grant-details.js';
import { handleCheckDeadlines } from './tools/check-deadlines.js';
import { handleGetEligibleItems } from './tools/get-eligible-items.js';
import { handleCheckStacking } from './tools/check-stacking.js';
import { handleGetApplicationProcess } from './tools/get-application-process.js';
import { handleEstimateGrantValue } from './tools/estimate-grant-value.js';

const SERVER_NAME = 'uk-farm-grants-mcp';
const SERVER_VERSION = '0.1.0';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const SearchArgsSchema = z.object({
  query: z.string(),
  grant_type: z.string().optional(),
  min_value: z.number().optional(),
  jurisdiction: z.string().optional(),
  limit: z.number().optional(),
});

const GrantDetailsArgsSchema = z.object({
  grant_id: z.string(),
  jurisdiction: z.string().optional(),
});

const DeadlineArgsSchema = z.object({
  grant_type: z.string().optional(),
  jurisdiction: z.string().optional(),
});

const EligibleItemsArgsSchema = z.object({
  grant_id: z.string(),
  category: z.string().optional(),
  jurisdiction: z.string().optional(),
});

const StackingArgsSchema = z.object({
  grant_ids: z.array(z.string()),
  jurisdiction: z.string().optional(),
});

const ApplicationProcessArgsSchema = z.object({
  grant_id: z.string(),
  jurisdiction: z.string().optional(),
});

const EstimateArgsSchema = z.object({
  grant_id: z.string(),
  items: z.array(z.string()).optional(),
  area_ha: z.number().optional(),
  jurisdiction: z.string().optional(),
});

const TOOLS = [
  {
    name: 'about',
    description: 'Get server metadata: name, version, coverage, data sources, and links.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_sources',
    description: 'List all data sources with authority, URL, license, and freshness info.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'check_data_freshness',
    description: 'Check when data was last ingested, staleness status, and how to trigger a refresh.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'search_grants',
    description: 'Search UK farm grants by keyword. Covers FETF, Capital Grants, EWCO, Countryside Stewardship, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Free-text search query (e.g. "slurry equipment", "woodland creation")' },
        grant_type: { type: 'string', description: 'Filter by grant type (e.g. capital, revenue)' },
        min_value: { type: 'number', description: 'Minimum grant value in GBP' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
        limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_grant_details',
    description: 'Get full details for a specific grant scheme: budget, eligibility, deadlines, match funding.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_id: { type: 'string', description: 'Grant ID (e.g. fetf-2026-productivity, ewco, cs-higher-tier)' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
      required: ['grant_id'],
    },
  },
  {
    name: 'check_deadlines',
    description: 'List open and upcoming grant deadlines, sorted by urgency. Shows days remaining and closing status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_type: { type: 'string', description: 'Filter by grant type (e.g. capital, revenue)' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
    },
  },
  {
    name: 'get_eligible_items',
    description: 'List eligible items for a grant with codes, values, and specifications. Filter by category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_id: { type: 'string', description: 'Grant ID (e.g. fetf-2026-productivity)' },
        category: { type: 'string', description: 'Filter by item category (e.g. precision, slurry, handling)' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
      required: ['grant_id'],
    },
  },
  {
    name: 'check_stacking',
    description: 'Check whether multiple grants can be combined (stacked). Checks all pair combinations and returns compatibility matrix.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of grant IDs to check compatibility (minimum 2)',
        },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
      required: ['grant_ids'],
    },
  },
  {
    name: 'get_application_process',
    description: 'Get step-by-step application guidance for a grant, including evidence requirements and portal links.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_id: { type: 'string', description: 'Grant ID (e.g. fetf-2026-productivity)' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
      required: ['grant_id'],
    },
  },
  {
    name: 'estimate_grant_value',
    description: 'Calculate total grant value from selected items. Applies grant cap and calculates match-funding requirement.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        grant_id: { type: 'string', description: 'Grant ID (e.g. fetf-2026-productivity)' },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of item codes to include. If omitted, includes all items.',
        },
        area_ha: { type: 'number', description: 'Area in hectares (for per-hectare payment items like EWCO)' },
        jurisdiction: { type: 'string', description: 'ISO 3166-1 alpha-2 code (default: GB)' },
      },
      required: ['grant_id'],
    },
  },
];

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
}

function registerTools(server: Server, db: Database): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'about':
          return textResult(handleAbout());
        case 'list_sources':
          return textResult(handleListSources(db));
        case 'check_data_freshness':
          return textResult(handleCheckFreshness(db));
        case 'search_grants':
          return textResult(handleSearchGrants(db, SearchArgsSchema.parse(args)));
        case 'get_grant_details':
          return textResult(handleGetGrantDetails(db, GrantDetailsArgsSchema.parse(args)));
        case 'check_deadlines':
          return textResult(handleCheckDeadlines(db, DeadlineArgsSchema.parse(args)));
        case 'get_eligible_items':
          return textResult(handleGetEligibleItems(db, EligibleItemsArgsSchema.parse(args)));
        case 'check_stacking':
          return textResult(handleCheckStacking(db, StackingArgsSchema.parse(args)));
        case 'get_application_process':
          return textResult(handleGetApplicationProcess(db, ApplicationProcessArgsSchema.parse(args)));
        case 'estimate_grant_value':
          return textResult(handleEstimateGrantValue(db, EstimateArgsSchema.parse(args)));
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });
}

const db = createDatabase();
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

function createMcpServer(): Server {
  const mcpServer = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );
  registerTools(mcpServer, db);
  return mcpServer;
}

async function handleMCPRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
    return;
  }

  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await mcpServer.connect(transport);

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
    mcpServer.close().catch(() => {});
  };

  await transport.handleRequest(req, res);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, { transport, server: mcpServer });
  }
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: SERVER_NAME, version: SERVER_VERSION }));
    return;
  }

  if (url.pathname === '/mcp' || url.pathname === '/') {
    try {
      await handleMCPRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }));
      }
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.log(`${SERVER_NAME} v${SERVER_VERSION} listening on port ${PORT}`);
});
