#!/usr/bin/env node

import {
  Leadpipe,
  LeadpipeError,
  type AudiencePreviewInput,
  type AudienceQueryInput,
  type AudienceUpdateInput,
  type TopicSearchParams,
  type TopicsMoversParams,
} from "@leadpipe/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "0.2.0";

const yesNoSchema = z.enum(["y", "n"]);
const topicTypeSchema = z.enum(["b2b", "b2c", "both"]);
const audienceStatusSchema = z.enum(["draft", "active", "paused"]);

const audienceFiltersSchema = z.object({
  companyIndustry: z.array(z.string()).optional(),
  seniority: z.array(z.string()).optional(),
  companySize: z.array(z.string()).optional(),
  department: z.array(z.string()).optional(),
  state: z.string().optional(),
  companyRevenueRange: z.array(z.string()).optional(),
  ageRange: z.array(z.string()).optional(),
  gender: z.string().optional(),
  isB2b: yesNoSchema.optional(),
  jobTitle: z.string().max(200).optional(),
  hasBusinessEmail: z.boolean().optional(),
  hasPersonalEmail: z.boolean().optional(),
  hasLinkedin: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  companyDomain: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
});

const audienceConfigSchema = z.object({
  topicIds: z.array(z.number().int()).min(1).max(10),
  minScore: z.number().int().min(1).max(100).optional(),
  maxScore: z.number().int().min(1).max(100).optional(),
  minTopicOverlap: z.number().int().min(1).max(10).optional(),
  filters: audienceFiltersSchema.optional(),
  sourceUrl: z.string().url().optional(),
});

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildClient(): Leadpipe {
  const apiKey = getRequiredEnv("LEADPIPE_API_KEY");
  const baseUrl = process.env.LEADPIPE_BASE_URL?.trim() || "https://api.aws53.cloud";
  return new Leadpipe({ apiKey, baseUrl });
}

function getApiConfig() {
  return {
    apiKey: getRequiredEnv("LEADPIPE_API_KEY"),
    baseUrl: process.env.LEADPIPE_BASE_URL?.trim() || "https://api.aws53.cloud",
  };
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function sanitizeConfig(config: z.infer<typeof audienceConfigSchema>) {
  return omitUndefined({
    ...config,
    ...(config.filters ? { filters: omitUndefined(config.filters) } : {}),
  });
}

function sanitizeUpdateInput(
  input: Omit<z.infer<
    z.ZodObject<{
      id: z.ZodString;
      name: z.ZodOptional<z.ZodString>;
      status: z.ZodOptional<typeof audienceStatusSchema>;
      config: z.ZodOptional<typeof audienceConfigSchema>;
      audienceSize: z.ZodOptional<z.ZodNumber>;
    }>
  >, "id">,
): AudienceUpdateInput {
  return omitUndefined({
    ...input,
    ...(input.config ? { config: sanitizeConfig(input.config) } : {}),
  }) as AudienceUpdateInput;
}

const AUTH_RESOURCE_URI = "leadpipe://docs/auth";
const WORKFLOWS_RESOURCE_URI = "leadpipe://docs/workflows";

function summarizeResult(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, any>;

  if (Array.isArray(record.data)) {
    const count = record.data.length;
    const meta = record.meta;
    if (meta && typeof meta === "object") {
      const parts = [
        typeof meta.status === "string" ? `status=${meta.status}` : null,
        `rows=${count}`,
        typeof meta.totalCount === "number" ? `total=${meta.totalCount}` : null,
        typeof meta.hasMore === "boolean" ? `hasMore=${meta.hasMore}` : null,
        typeof meta.dataDate === "string" ? `dataDate=${meta.dataDate}` : null,
      ].filter(Boolean);
      return parts.join(", ");
    }
    return `rows=${count}`;
  }

  if (record.data && typeof record.data === "object") {
    const inner = record.data as Record<string, any>;

    if (typeof inner.totalCount === "number" && Array.isArray(inner.sample)) {
      return `totalCount=${inner.totalCount}, sampleSize=${inner.sample.length}, dataDate=${inner.dataDate ?? "unknown"}`;
    }

    if (typeof inner.status === "string" && "runId" in inner) {
      return `status=${inner.status}, totalCount=${inner.totalCount ?? 0}, dataDate=${inner.dataDate ?? "unknown"}, runId=${inner.runId ?? "none"}`;
    }

    if (Array.isArray(inner.types) && Array.isArray(inner.industries) && Array.isArray(inner.categories)) {
      return `types=${inner.types.length}, industries=${inner.industries.length}, categories=${inner.categories.length}, total=${inner.total ?? "unknown"}`;
    }

    if (typeof inner.downloadUrl === "string") {
      return `rows=${inner.rows ?? "unknown"}, dataDate=${inner.dataDate ?? "unknown"}, cached=${inner.cached ?? "unknown"}`;
    }

    if (typeof inner.company !== "undefined" && Array.isArray(inner.topics)) {
      return `company=${inner.company ?? "unknown"}, matchedTopics=${inner.topics.length}`;
    }

    if (typeof inner.total === "number" && inner.fields && typeof inner.fields === "object") {
      return `total=${inner.total}, fieldCount=${Object.keys(inner.fields).length}, dataDate=${inner.dataDate ?? "unknown"}`;
    }

    if (typeof inner.healthy === "boolean" && inner.organization && typeof inner.organization === "object") {
      const org = inner.organization as Record<string, any>;
      return `healthy=${inner.healthy}, org=${org.name ?? "unknown"}, status=${org.status ?? "unknown"}`;
    }

    if (typeof inner.id === "string" && typeof inner.domain === "string" && typeof inner.status === "string") {
      return `id=${inner.id}, domain=${inner.domain}, status=${inner.status}`;
    }
  }

  return null;
}

function textResult(data: unknown, label?: string) {
  const summary = summarizeResult(data);
  const text = [
    label ?? null,
    summary ? `Summary: ${summary}` : null,
    JSON.stringify(data, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");

  const structuredContent =
    data !== null && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { result: data };

  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

function errorResult(error: unknown) {
  if (error instanceof LeadpipeError) {
    const payload = {
      error: {
        status: error.status,
        code: error.code ?? null,
        method: error.method,
        url: error.url,
        message: error.message,
      },
      payload: error.payload ?? null,
    };

    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  }

  const fallback = {
    error: {
      message: error instanceof Error ? error.message : "Unknown error",
    },
  };

  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(fallback, null, 2) }],
    structuredContent: fallback,
  };
}

async function withToolResult<T>(handler: () => Promise<T>, label?: string) {
  try {
    return textResult(await handler(), label);
  } catch (error) {
    return errorResult(error);
  }
}

async function requestDataApi<T>(
  config: ReturnType<typeof getApiConfig>,
  method: string,
  path: string,
  options: { query?: Record<string, string | number | boolean | null | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(path, config.baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = new Headers({
    accept: "application/json",
    "x-api-key": config.apiKey,
  });

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body } : {}),
  });

  const text = await response.text();
  const parsed = text.trim().length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new LeadpipeError({
      status: response.status,
      method,
      url: url.toString(),
      payload: parsed,
      message:
        parsed && typeof parsed === "object" && "message" in (parsed as Record<string, unknown>) && typeof (parsed as Record<string, unknown>).message === "string"
          ? ((parsed as Record<string, unknown>).message as string)
          : `${method} ${url.pathname} failed with ${response.status}`,
    });
  }

  return parsed as T;
}

function createServer(client: Leadpipe): McpServer {
  const apiConfig = getApiConfig();
  const server = new McpServer(
    {
      name: "leadpipe-mcp",
      version: VERSION,
      websiteUrl: "https://leadpipe.com",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    "list_topics",
    {
      title: "List Topics",
      description: "Browse Leadpipe intent topics. Supports filtering by type, industry, category, and text query.",
      inputSchema: {
        type: topicTypeSchema.optional(),
        industry: z.string().max(100).optional(),
        category: z.string().max(100).optional(),
        q: z.string().max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      withToolResult(
        async () => client.intent.topics.list(omitUndefined(args) as Parameters<typeof client.intent.topics.list>[0]),
        "Topic catalog response",
      ),
  );

  server.registerTool(
    "get_topic_facets",
    {
      title: "Get Topic Facets",
      description: "Get available types, industries, and categories for topic discovery filters.",
      annotations: { readOnlyHint: true },
    },
    async () => withToolResult(async () => client.intent.topics.facets(), "Topic facets response"),
  );

  server.registerTool(
    "search_topics",
    {
      title: "Search Topics",
      description: "Search intent topics by name for autocomplete or discovery.",
      inputSchema: {
        q: z.string().min(1).max(100),
        industry: z.string().max(100).optional(),
        type: topicTypeSchema.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      withToolResult(async () => client.intent.topics.search(omitUndefined(args) as TopicSearchParams), "Topic search response"),
  );

  server.registerTool(
    "get_topic_trend",
    {
      title: "Get Topic Trend",
      description: "Get the daily trend time series for a single topic.",
      inputSchema: {
        topicId: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ topicId }) => withToolResult(async () => client.intent.topics.trend(topicId), "Topic trend response"),
  );

  server.registerTool(
    "compare_topics",
    {
      title: "Compare Topics",
      description: "Compare daily trend series for multiple topics.",
      inputSchema: {
        topicIds: z.array(z.number().int().positive()).min(1).max(10),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ topicIds }) => withToolResult(async () => client.intent.topics.compare(topicIds), "Topic comparison response"),
  );

  server.registerTool(
    "get_topic_movers",
    {
      title: "Get Topic Movers",
      description: "Get top topics by day-over-day audience growth or decline.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
        direction: z.enum(["up", "down"]).optional(),
        type: topicTypeSchema.optional(),
        industry: z.string().max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      withToolResult(async () => client.intent.topics.movers(omitUndefined(args) as TopicsMoversParams), "Topic movers response"),
  );

  server.registerTool(
    "analyze_website_topics",
    {
      title: "Analyze Website Topics",
      description: "Analyze a website URL and return matched intent topics.",
      inputSchema: {
        url: z.string().url(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ url }) => withToolResult(async () => client.intent.topics.analyze({ url }), "Website topic analysis response"),
  );

  server.registerTool(
    "get_audience_filters",
    {
      title: "Get Audience Filters",
      description: "Get available ICP filter values for audience preview and query.",
      annotations: { readOnlyHint: true },
    },
    async () => withToolResult(async () => client.intent.audiences.filters(), "Audience filter options"),
  );

  server.registerTool(
    "preview_audience",
    {
      title: "Preview Audience",
      description: "Preview audience size and masked sample rows before loading full results.",
      inputSchema: {
        topicIds: z.array(z.number().int()).min(1).max(10),
        minScore: z.number().int().min(1).max(100).optional(),
        maxScore: z.number().int().min(1).max(100).optional(),
        minTopicOverlap: z.number().int().min(1).max(10).optional(),
        filters: audienceFiltersSchema.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      withToolResult(
        async () => client.intent.audiences.preview(omitUndefined({
          ...args,
          ...(args.filters ? { filters: omitUndefined(args.filters) } : {}),
        }) as AudiencePreviewInput),
        "Audience preview response",
      ),
  );

  server.registerTool(
    "query_audience",
    {
      title: "Query Audience",
      description: "Run an ad hoc audience query or browse a saved audience run via the public query endpoint.",
      inputSchema: {
        audienceId: z.string().uuid().optional(),
        topicIds: z.array(z.number().int()).min(1).max(10).optional(),
        minScore: z.number().int().min(1).max(100).optional(),
        maxScore: z.number().int().min(1).max(100).optional(),
        minTopicOverlap: z.number().int().min(1).max(10).optional(),
        filters: audienceFiltersSchema.optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().nullable().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      withToolResult(
        async () =>
          client.intent.audiences.query(omitUndefined({
            ...args,
            ...(args.filters ? { filters: omitUndefined(args.filters) } : {}),
          }) as AudienceQueryInput),
        "Audience query response",
      ),
  );

  server.registerTool(
    "list_audiences",
    {
      title: "List Audiences",
      description: "List saved audiences for the authenticated organization.",
      annotations: { readOnlyHint: true },
    },
    async () => withToolResult(async () => client.intent.audiences.list(), "Saved audiences response"),
  );

  server.registerTool(
    "get_audience",
    {
      title: "Get Audience",
      description: "Get one saved audience by id.",
      inputSchema: {
        id: z.string().uuid(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => withToolResult(async () => client.intent.audiences.get(id), "Audience detail response"),
  );

  server.registerTool(
    "create_audience",
    {
      title: "Create Audience",
      description: "Create a saved audience configuration.",
      inputSchema: {
        name: z.string().min(1).max(255),
        config: audienceConfigSchema,
      },
    },
    async ({ name, config }) =>
      withToolResult(async () => client.intent.audiences.create({ name, config: sanitizeConfig(config) as any }), "Audience created"),
  );

  server.registerTool(
    "update_audience",
    {
      title: "Update Audience",
      description: "Update a saved audience, including activating or pausing it.",
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        status: audienceStatusSchema.optional(),
        config: audienceConfigSchema.optional(),
        audienceSize: z.number().int().nonnegative().optional(),
      },
    },
    async ({ id, ...input }) =>
      withToolResult(
        async () => client.intent.audiences.update(id, sanitizeUpdateInput(input) as any),
        "Audience updated",
      ),
  );

  server.registerTool(
    "delete_audience",
    {
      title: "Delete Audience",
      description: "Delete a saved audience by id.",
      inputSchema: {
        id: z.string().uuid(),
      },
    },
    async ({ id }) => withToolResult(async () => client.intent.audiences.delete(id), "Audience deleted"),
  );

  server.registerTool(
    "get_audience_status",
    {
      title: "Get Audience Status",
      description: "Get the current materialization status for the latest run or a specific date.",
      inputSchema: {
        id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, date }) => withToolResult(async () => client.intent.audiences.status(id, date ? { date } : undefined), "Audience status response"),
  );

  server.registerTool(
    "get_audience_results",
    {
      title: "Get Audience Results",
      description: "Get paginated full audience results for the latest run or a specific date.",
      inputSchema: {
        id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, date, limit, cursor }) =>
      withToolResult(
        async () => client.intent.audiences.results(id, { ...(date ? { date } : {}), ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) }),
        "Audience results response",
      ),
  );

  server.registerTool(
    "list_audience_runs",
    {
      title: "List Audience Runs",
      description: "List available daily runs for a saved audience.",
      inputSchema: {
        id: z.string().uuid(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => withToolResult(async () => client.intent.audiences.runs(id), "Audience runs response"),
  );

  server.registerTool(
    "get_audience_stats",
    {
      title: "Get Audience Stats",
      description: "Get field fill rates for the latest run or a specific audience date.",
      inputSchema: {
        id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, date }) => withToolResult(async () => client.intent.audiences.stats(id, date ? { date } : undefined), "Audience stats response"),
  );

  server.registerTool(
    "export_audience",
    {
      title: "Export Audience",
      description: "Generate or reuse a CSV export for the latest run or a specific date and return a signed download URL.",
      inputSchema: {
        id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
    },
    async ({ id, date }) => withToolResult(async () => client.intent.audiences.export(id, date ? { date } : undefined), "Audience export response"),
  );

  server.registerTool(
    "query_visitor_data",
    {
      title: "Query Visitor Data",
      description: "Query resolved visitor data. Pass email for a single visitor journey, or use timeframe/domain/page filters for broader results.",
      inputSchema: {
        email: z.string().email().optional(),
        page: z.number().int().min(1).optional(),
        timeframe: z.enum(["24h", "7d", "14d", "30d", "90d", "all"]).optional(),
        domain: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ email, page, timeframe, domain }) =>
      withToolResult(
        async () =>
          requestDataApi(
            apiConfig,
            "GET",
            "/v1/data",
            { query: omitUndefined({ email, page, timeframe, domain }) },
          ),
        "Visitor data response",
      ),
  );

  server.registerTool(
    "list_pixels",
    {
      title: "List Pixels",
      description: "List all tracking pixels for the authenticated organization.",
      annotations: { readOnlyHint: true },
    },
    async () => withToolResult(async () => requestDataApi(apiConfig, "GET", "/v1/data/pixels"), "Pixel list response"),
  );

  server.registerTool(
    "create_pixel",
    {
      title: "Create Pixel",
      description: "Create a new tracking pixel for a domain.",
      inputSchema: {
        domain: z.string().min(1).max(255),
        name: z.string().min(1).max(255).optional(),
      },
    },
    async ({ domain, name }) =>
      withToolResult(
        async () => requestDataApi(apiConfig, "POST", "/v1/data/pixels", { body: omitUndefined({ domain, name }) }),
        "Pixel created",
      ),
  );

  server.registerTool(
    "update_pixel",
    {
      title: "Update Pixel",
      description: "Pause, activate, or update excluded paths for a pixel.",
      inputSchema: {
        id: z.string().uuid(),
        status: z.enum(["active", "paused"]).optional(),
        excludedPaths: z.union([z.array(z.string().min(2).max(500).regex(/^\/.*/)).max(50), z.null()]).optional(),
      },
    },
    async ({ id, status, excludedPaths }) =>
      withToolResult(
        async () =>
          requestDataApi(apiConfig, "PATCH", `/v1/data/pixels/${id}`, {
            body: omitUndefined({ status, excludedPaths }),
          }),
        "Pixel updated",
      ),
  );

  server.registerTool(
    "get_account_status",
    {
      title: "Get Account Status",
      description: "Get account health, credit status, pixel counts, and intent audience slot status.",
      annotations: { readOnlyHint: true },
    },
    async () => withToolResult(async () => requestDataApi(apiConfig, "GET", "/v1/data/account"), "Account status response"),
  );

  server.registerPrompt(
    "discover-audience-topics",
    {
      title: "Discover Audience Topics",
      description: "Guide an agent through topic discovery, comparison, and preview before building an audience.",
      argsSchema: {
        goal: z.string().describe("The user's targeting goal or campaign objective."),
        audienceType: topicTypeSchema.optional(),
      },
    },
    async ({ goal, audienceType }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Find the best Leadpipe intent topics for this goal: ${goal}. ` +
              `${audienceType ? `Prefer ${audienceType} topics. ` : ""}` +
              `Use search_topics, get_topic_trend, compare_topics, and get_topic_movers to narrow the topic set. ` +
              `Then use preview_audience before recommending a saved audience.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "operate-saved-audience",
    {
      title: "Operate Saved Audience",
      description: "Guide an agent through checking status, reading results, and exporting a saved audience.",
      argsSchema: {
        audienceId: z.string().uuid().describe("Saved audience id."),
        goal: z.string().optional().describe("Optional user intent for what to do with the audience."),
      },
    },
    async ({ audienceId, goal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Work with Leadpipe audience ${audienceId}. ` +
              `${goal ? `Goal: ${goal}. ` : ""}` +
              `First call get_audience_status. If ready, inspect get_audience_results and get_audience_stats. ` +
              `If the user needs delivery, call export_audience. If not ready, explain the materializing state clearly.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "investigate-visitor-data",
    {
      title: "Investigate Visitor Data",
      description: "Guide an agent through checking visitor activity, account health, and pixel state for a domain or email.",
      argsSchema: {
        domain: z.string().optional(),
        email: z.string().email().optional(),
      },
    },
    async ({ domain, email }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Investigate Leadpipe visitor data. ` +
              `${domain ? `Domain: ${domain}. ` : ""}` +
              `${email ? `Email: ${email}. ` : ""}` +
              `Start with get_account_status. Then call query_visitor_data` +
              `${email ? " for the email journey" : domain ? " filtered by the domain" : ""}. ` +
              `If this looks like a tracking setup issue, inspect list_pixels and update_pixel as needed.`,
          },
        },
      ],
    }),
  );

  server.registerResource(
    "leadpipe-auth-guide",
    AUTH_RESOURCE_URI,
    {
      title: "Leadpipe Auth Guide",
      description: "Authentication and environment configuration for the Leadpipe MCP server.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: AUTH_RESOURCE_URI,
          text: [
            "# Leadpipe MCP Auth",
            "",
            "Required environment variable:",
            "- `LEADPIPE_API_KEY=sk_...`",
            "",
            "Optional environment variable:",
            "- `LEADPIPE_BASE_URL=https://api.aws53.cloud`",
            "",
            "This MCP server is designed for authenticated agent workflows and expects an API key.",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerResource(
    "leadpipe-workflows-guide",
    WORKFLOWS_RESOURCE_URI,
    {
      title: "Leadpipe Workflows Guide",
      description: "Recommended agent workflows for topic discovery, audience preview, saved audiences, and exports.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: WORKFLOWS_RESOURCE_URI,
          text: [
            "# Leadpipe MCP Workflows",
            "",
            "## Discovery",
            "1. `search_topics`",
            "2. `get_topic_trend` or `compare_topics`",
            "3. `get_topic_movers`",
            "",
            "## Build Audience",
            "1. `get_audience_filters`",
            "2. `preview_audience`",
            "3. `create_audience`",
            "4. `update_audience` with `status=active`",
            "",
            "## Read Results",
            "1. `get_audience_status`",
            "2. `get_audience_results`",
            "3. `get_audience_stats`",
            "4. `export_audience`",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerResource(
    "leadpipe-data-api-guide",
    "leadpipe://docs/data-api",
    {
      title: "Leadpipe Data API Guide",
      description: "Overview of the visitor data, pixels, and account tools exposed by this MCP server.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "leadpipe://docs/data-api",
          text: [
            "# Leadpipe Data API",
            "",
            "## Visitor Data",
            "- `query_visitor_data`",
            "",
            "## Pixels",
            "- `list_pixels`",
            "- `create_pixel`",
            "- `update_pixel`",
            "",
            "## Account",
            "- `get_account_status`",
          ].join("\n"),
        },
      ],
    }),
  );

  return server;
}

async function main() {
  const client = buildClient();
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Leadpipe MCP server running on stdio");
}

main().catch((error) => {
  console.error("Leadpipe MCP server failed:", error);
  process.exit(1);
});
