---
title: "Building Custom MCP Servers for OpenClaw: A Practical Guide"
description: "Learn how to build and integrate custom MCP (Model Context Protocol) servers with OpenClaw. From your first tool to production-grade integrations with authentication, error handling, and testing."
publishedAt: 2026-03-15
status: published
visibility: public
---

# Building Custom MCP Servers for OpenClaw: A Practical Guide

The Model Context Protocol (MCP) is what makes OpenClaw genuinely extensible rather than just configurable. When I first looked at it, I assumed it was a wrapper pattern — another way to call functions from a prompt. It's more than that. MCP defines how AI models discover, call, and receive results from external tools in a standardized way, which means any tool you build works identically across every model OpenClaw supports.

This guide covers building a real MCP server: from the basic structure through authentication, error handling, streaming, and the testing patterns that keep production servers stable.

## What MCP Actually Does

Before writing code, it's worth understanding the protocol flow. When OpenClaw starts a conversation, it queries any configured MCP servers using a `tools/list` request. The server responds with a schema for each available tool — name, description, input parameters with types. The model sees this schema alongside the conversation.

When the model decides to use a tool, OpenClaw sends a `tools/call` request to the appropriate server. The server executes the operation and returns a result. The model sees the result and continues its response.

That's the full loop: discover → call → result. The elegance is that the model never needs tool-specific code — it works from the schema alone.

```
User message → Model reads tool schemas → Model decides to call tool →
OpenClaw sends tools/call to MCP server → Server executes →
Result returns to model → Model continues response
```

## Setting Up the Development Environment

You'll need Node.js 20+ and the official MCP SDK:

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

## Your First MCP Server

Here's a minimal working server that exposes one tool — a weather lookup:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  {
    name: "weather-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the tool schema
const GetWeatherSchema = z.object({
  city: z.string().describe("City name to get weather for"),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

// Handle tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_weather",
        description: "Get current weather conditions for a city",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name to get weather for",
            },
            units: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              default: "celsius",
            },
          },
          required: ["city"],
        },
      },
    ],
  };
});

// Handle tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_weather") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = GetWeatherSchema.parse(request.params.arguments);

  // In a real server, call your actual weather API here
  const weather = await fetchWeather(args.city, args.units);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(weather, null, 2),
      },
    ],
  };
});

async function fetchWeather(city: string, units: string) {
  // Replace with real API call
  return {
    city,
    temperature: units === "celsius" ? 18 : 64,
    condition: "Partly cloudy",
    humidity: 65,
    wind_speed_kmh: 12,
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

Run it: `npx tsx src/server.ts`

This server communicates over stdio. OpenClaw spawns the process and talks to it through stdin/stdout. The transport handles framing — you don't deal with raw bytes.

## Registering with OpenClaw

Add the server to your OpenClaw config (`~/.openclaw/config.yaml`):

```yaml
mcpServers:
  weather:
    command: node
    args:
      - /path/to/my-mcp-server/dist/server.js
    env:
      WEATHER_API_KEY: "${WEATHER_API_KEY}"
```

Or for development with tsx:

```yaml
mcpServers:
  weather:
    command: npx
    args:
      - tsx
      - /path/to/my-mcp-server/src/server.ts
```

Restart OpenClaw and verify the server loaded:

```bash
openclaw mcp list
# Should show: weather (1 tool)

openclaw mcp tools weather
# Should show: get_weather
```

## Handling Multiple Tools

Real servers expose multiple related tools. Here's a database inspection server with three tools:

```typescript
const tools = [
  {
    name: "list_tables",
    description: "List all tables in the database with row counts",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Database schema name",
          default: "public",
        },
      },
    },
  },
  {
    name: "describe_table",
    description: "Get column definitions and indexes for a table",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Table name" },
        schema: { type: "string", default: "public" },
      },
      required: ["table_name"],
    },
  },
  {
    name: "run_query",
    description: "Execute a read-only SQL query and return results",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL query to execute (SELECT only)",
        },
        limit: {
          type: "number",
          description: "Maximum rows to return",
          default: 100,
        },
      },
      required: ["sql"],
    },
  },
];

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_tables":
      return handleListTables(args);
    case "describe_table":
      return handleDescribeTable(args);
    case "run_query":
      return handleRunQuery(args);
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});
```

The switch pattern works fine up to 10-15 tools. Beyond that, consider a registry pattern:

```typescript
type ToolHandler = (args: unknown) => Promise<CallToolResult>;

const toolRegistry = new Map<string, ToolHandler>([
  ["list_tables", handleListTables],
  ["describe_table", handleDescribeTable],
  ["run_query", handleRunQuery],
]);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = toolRegistry.get(request.params.name);
  if (!handler) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }
  return handler(request.params.arguments);
});
```

## Error Handling That Actually Helps

Generic error messages are useless in production. When a tool fails, the model needs enough context to explain what went wrong or suggest alternatives. MCP has structured error types:

```typescript
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

async function handleRunQuery(args: unknown) {
  const parsed = RunQuerySchema.safeParse(args);
  if (!parsed.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid query parameters: ${parsed.error.message}`
    );
  }

  const { sql, limit } = parsed.data;

  // Reject non-SELECT queries
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith("select")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Only SELECT queries are allowed. Received: " + sql.substring(0, 50)
    );
  }

  try {
    const results = await db.query(sql, { limit });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            rows: results.rows,
            row_count: results.rows.length,
            truncated: results.rows.length >= limit,
          }),
        },
      ],
    };
  } catch (err) {
    // Distinguish database errors from infrastructure errors
    if (err instanceof DatabaseError) {
      throw new McpError(
        ErrorCode.InternalError,
        `Query failed: ${err.message}. Check syntax and table names.`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Database connection error. Is the database reachable?`
    );
  }
}
```

The distinction between `InvalidParams` and `InternalError` matters — the model handles them differently. Param errors suggest the model should retry with different arguments. Internal errors suggest the tool itself has a problem.

## Authentication Patterns

MCP servers run as local processes, so they have access to any environment variables OpenClaw injects. Three patterns work well:

### API Key via Environment

```typescript
const API_KEY = process.env.MY_SERVICE_API_KEY;
if (!API_KEY) {
  throw new Error("MY_SERVICE_API_KEY environment variable is required");
}

// Use in requests
const response = await fetch("https://api.myservice.com/data", {
  headers: { "Authorization": `Bearer ${API_KEY}` },
});
```

Configure in OpenClaw:

```yaml
mcpServers:
  my-service:
    command: node
    args: ["/path/to/server.js"]
    env:
      MY_SERVICE_API_KEY: "${MY_SERVICE_API_KEY}"
```

### OAuth Token Refresh

For services with expiring tokens:

```typescript
class TokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60000) {
      return this.accessToken;
    }
    await this.refresh();
    return this.accessToken!;
  }

  private async refresh() {
    const response = await fetch("https://auth.service.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      }),
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
  }
}

const tokenManager = new TokenManager();

// In your tool handler:
const token = await tokenManager.getToken();
```

### Per-User Context

For multi-user OpenClaw deployments, you can read user context from environment variables:

```typescript
const USER_CONTEXT = process.env.OPENCLAW_USER_ID;

async function handleToolCall(args: unknown) {
  // Log which user triggered this tool call
  console.error(`Tool called by user: ${USER_CONTEXT}`);
  // ... rest of handler
}
```

## Testing Your MCP Server

Testing MCP servers directly is straightforward — they accept JSON over stdin and return JSON over stdout. For unit tests:

```typescript
import { describe, it, expect } from "vitest";
import { createTestServer } from "./test-helpers.js";

describe("run_query tool", () => {
  it("rejects non-SELECT queries", async () => {
    const { callTool } = await createTestServer();

    await expect(
      callTool("run_query", { sql: "DELETE FROM users" })
    ).rejects.toThrow("Only SELECT queries are allowed");
  });

  it("respects row limit", async () => {
    const { callTool } = await createTestServer();

    const result = await callTool("run_query", {
      sql: "SELECT * FROM large_table",
      limit: 5,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.rows.length).toBeLessThanOrEqual(5);
  });
});
```

Test helper:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

export async function createTestServer() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const { default: createServer } = await import("./server.js");
  const server = createServer();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  return {
    callTool: async (name: string, args: unknown) => {
      return client.callTool({ name, arguments: args as Record<string, unknown> });
    },
    listTools: async () => {
      return client.listTools();
    },
  };
}
```

For integration tests with the actual OpenClaw MCP client:

```bash
# Run the MCP inspector tool for interactive testing
npx @modelcontextprotocol/inspector node dist/server.js
```

The inspector lets you manually invoke tools and inspect the full request/response cycle.

## Returning Rich Content

Tool results don't have to be JSON strings. MCP supports structured content:

```typescript
// Text result
return {
  content: [{ type: "text", text: "Operation complete" }],
};

// Multiple content blocks
return {
  content: [
    { type: "text", text: "Query returned 47 rows:" },
    { type: "text", text: JSON.stringify(rows, null, 2) },
  ],
};

// Image result (base64 encoded)
return {
  content: [
    {
      type: "image",
      data: imageBase64,
      mimeType: "image/png",
    },
  ],
};

// Mixed text and image
return {
  content: [
    { type: "text", text: "Here's a screenshot of the dashboard:" },
    { type: "image", data: screenshotBase64, mimeType: "image/png" },
  ],
};
```

Not all models handle image content equally — Claude handles it well, GPT-4o handles it well, smaller models may only process the text portions. Design your tool responses to be useful as text-only if image content is optional.

## Performance Considerations

MCP calls are synchronous from the model's perspective — the model waits for the result before continuing. This matters for tool latency:

- **Under 200ms**: Invisible to users
- **200ms–2s**: Noticeable, acceptable for one-off lookups
- **2s+**: Disruptive, consider returning a job ID and a separate status-check tool

For slow operations, the job pattern:

```typescript
// Tool 1: Start the job
{
  name: "start_export",
  description: "Start a data export. Returns a job ID.",
  // ...
}

// Tool 2: Check status
{
  name: "check_export_status",
  description: "Check the status of an export job. Returns status and download URL when complete.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string" },
    },
    required: ["job_id"],
  },
}
```

The model naturally calls `start_export`, waits for the job ID, then calls `check_export_status` until completion. It will handle the polling loop itself — you just need to return the right status values.

## Practical Examples to Build

A few server ideas that have immediate practical value:

**Git operations server**: `git_log`, `git_diff`, `git_status`, `create_branch`. Makes OpenClaw into a code review assistant that can actually inspect the repository state.

**Filesystem server** (scoped): `read_file`, `write_file`, `list_directory` limited to specific paths. More controllable than giving OpenClaw raw shell access.

**Jira/Linear integration**: `list_issues`, `get_issue`, `update_issue`, `create_issue`. Turns OpenClaw into a project management assistant.

**Internal API gateway**: A single server that wraps your internal APIs, handling auth and rate limiting centrally. Each internal service gets its own tools without each needing to know about MCP.

The community maintains a list of open-source MCP servers at [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers). Before building from scratch, check if something close to what you need already exists.

## What to Watch Out For

**Infinite tool loops**: If a tool's description makes it seem useful in response to its own output, the model may call it repeatedly. Write tool descriptions that make the expected call pattern clear.

**Tool name collisions**: If two MCP servers expose a tool with the same name, behavior is undefined. Namespace your tool names: `weather_get_forecast`, `db_run_query`, `git_diff_file`.

**Schema drift**: If your tool's behavior changes but the schema doesn't, the model will pass arguments based on the old schema. Always bump the server version and update the schema when behavior changes.

**Large results**: Returning 10,000 rows of database results will work but will consume significant context. Add `limit` parameters to every tool that can return variable amounts of data, and set sensible defaults.

MCP is the right abstraction layer for extending OpenClaw. Once you've built one server, the pattern is clear enough that additional servers are fast to add. The limiting factor becomes what you want the model to be able to do — which is a better problem to have than fighting with integration code.
