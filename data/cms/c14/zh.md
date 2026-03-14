---
title: "为 OpenClaw 构建自定义 MCP 服务器：实战指南"
description: "学习如何为 OpenClaw 构建并集成自定义 MCP（模型上下文协议）服务器。从第一个工具的雏形，到具备认证、错误处理和测试能力的生产级集成。"
publishedAt: 2026-03-15
status: published
visibility: public
---

# 为 OpenClaw 构建自定义 MCP 服务器：实战指南

模型上下文协议（MCP）是让 OpenClaw 实现真正可扩展性的核心机制——而不仅仅是可配置性。当我第一次接触它时，以为不过是另一种包装模式，另一种从提示词中调用函数的方式。但事实不止于此。MCP 定义了 AI 模型以标准化方式发现、调用外部工具并接收结果的完整规范，这意味着你构建的任何工具在 OpenClaw 支持的每个模型上都能以完全相同的方式运行。

本指南涵盖构建一个真实 MCP 服务器的全过程：从基本结构出发，逐步实现认证、错误处理、流式传输，以及确保生产服务器稳定运行的测试模式。

## MCP 究竟做什么

在动手写代码之前，先理解协议流程是值得的。当 OpenClaw 开始一次对话时，它会通过 `tools/list` 请求查询所有已配置的 MCP 服务器。服务器针对每个可用工具返回一个 schema——包括名称、描述、带类型的输入参数。模型在对话过程中能看到这些 schema。

当模型决定使用某个工具时，OpenClaw 向对应服务器发送 `tools/call` 请求。服务器执行操作并返回结果。模型看到结果后继续生成响应。

这就是完整的循环：发现 → 调用 → 结果。其优雅之处在于，模型永远不需要工具专属的代码——它只需要根据 schema 工作。

```
用户消息 → 模型读取工具 schema → 模型决定调用工具 →
OpenClaw 向 MCP 服务器发送 tools/call → 服务器执行 →
结果返回给模型 → 模型继续响应
```

这套设计的深远影响在于：任何人构建的 MCP 服务器都可以被任何兼容 MCP 的客户端使用。你为 OpenClaw 构建的工具理论上也能与其他支持该协议的 AI 环境配合工作。协议规范是公开的，社区也在围绕它不断发展壮大。

## 搭建开发环境

你需要 Node.js 20+ 版本以及官方 MCP SDK：

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

创建 `tsconfig.json`：

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

我选择使用 TypeScript 而非普通 JavaScript，原因有两点：一是 MCP SDK 提供了完整的类型定义，能让 IDE 对 schema 结构进行自动补全；二是 Zod 的验证错误也会生成有意义的类型推断，从而简化错误处理代码。如果你更倾向于 JavaScript，同样的模式也适用，只需去掉类型注解即可。

## 你的第一个 MCP 服务器

下面是一个最简可用的服务器示例，它对外暴露一个工具——天气查询：

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

运行它：`npx tsx src/server.ts`

该服务器通过 stdio 进行通信。OpenClaw 会生成这个进程，并通过 stdin/stdout 与它交互。传输层负责帧处理——你无需关心原始字节。

## 向 OpenClaw 注册服务器

将服务器添加到你的 OpenClaw 配置文件（`~/.openclaw/config.yaml`）：

```yaml
mcpServers:
  weather:
    command: node
    args:
      - /path/to/my-mcp-server/dist/server.js
    env:
      WEATHER_API_KEY: "${WEATHER_API_KEY}"
```

或者在开发阶段使用 tsx：

```yaml
mcpServers:
  weather:
    command: npx
    args:
      - tsx
      - /path/to/my-mcp-server/src/server.ts
```

重启 OpenClaw 并验证服务器已加载：

```bash
openclaw mcp list
# Should show: weather (1 tool)

openclaw mcp tools weather
# Should show: get_weather
```

## 处理多个工具

真实的服务器会暴露多个相关工具。下面是一个具有三个工具的数据库检查服务器：

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

switch 模式在工具数量不超过 10-15 个时运行良好。超出这个范围后，可以考虑使用注册表模式：

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

## 真正有帮助的错误处理

通用错误消息在生产环境中毫无价值。当工具失败时，模型需要足够的上下文来解释出了什么问题或建议替代方案。MCP 提供了结构化的错误类型：

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

`InvalidParams` 与 `InternalError` 之间的区别很重要——模型处理它们的方式不同。参数错误意味着模型应该用不同的参数重试。内部错误则意味着工具本身存在问题。

## 认证模式

MCP 服务器作为本地进程运行，因此可以访问 OpenClaw 注入的任何环境变量。以下三种模式效果良好：

### 通过环境变量传递 API Key

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

在 OpenClaw 中配置：

```yaml
mcpServers:
  my-service:
    command: node
    args: ["/path/to/server.js"]
    env:
      MY_SERVICE_API_KEY: "${MY_SERVICE_API_KEY}"
```

### OAuth Token 自动刷新

对于使用过期令牌的服务：

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

### 多用户上下文

对于多用户 OpenClaw 部署，可以从环境变量中读取用户上下文：

```typescript
const USER_CONTEXT = process.env.OPENCLAW_USER_ID;

async function handleToolCall(args: unknown) {
  // Log which user triggered this tool call
  console.error(`Tool called by user: ${USER_CONTEXT}`);
  // ... rest of handler
}
```

## 测试你的 MCP 服务器

直接测试 MCP 服务器非常简单——它们通过 stdin 接受 JSON，并通过 stdout 返回 JSON。单元测试示例：

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

测试辅助函数：

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

对于使用实际 OpenClaw MCP 客户端的集成测试：

```bash
# Run the MCP inspector tool for interactive testing
npx @modelcontextprotocol/inspector node dist/server.js
```

Inspector 工具允许你手动调用工具并检查完整的请求/响应周期。

## 返回丰富的内容类型

工具结果不必是 JSON 字符串。MCP 支持结构化内容：

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

并非所有模型对图片内容的处理能力都相同——Claude 和 GPT-4o 处理得很好，小型模型可能只会处理文本部分。如果图片内容是可选的，请将工具响应设计为纯文本时也能正常使用。

## 性能注意事项

从模型的视角来看，MCP 调用是同步的——模型在继续生成响应之前会等待结果。这让工具延迟变得重要：

- **200ms 以内**：用户无感知
- **200ms–2s**：可察觉，对于偶发性查询可接受
- **2s 以上**：体验受损，考虑返回任务 ID 并提供独立的状态查询工具

对于耗时操作，可以采用任务模式：

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

模型会自然地先调用 `start_export`，等待任务 ID，然后循环调用 `check_export_status` 直到完成。轮询循环由它自行处理——你只需要返回正确的状态值。

## 实用服务器构建思路

以下几种服务器具有立竿见影的实用价值：

**Git 操作服务器**：`git_log`、`git_diff`、`git_status`、`create_branch`。让 OpenClaw 成为一个能真正检查仓库状态的代码审查助手。

**文件系统服务器**（有范围限制的）：`read_file`、`write_file`、`list_directory`，限定在特定路径下。比直接给 OpenClaw 原始 shell 访问权限更可控。

**Jira/Linear 集成**：`list_issues`、`get_issue`、`update_issue`、`create_issue`。将 OpenClaw 变成项目管理助手。

**内部 API 网关**：一个包装内部 API 的单一服务器，集中处理认证和限流。每个内部服务都拥有自己的工具，无需各自了解 MCP。

社区在 [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers) 上维护了一份开源 MCP 服务器列表。从头构建之前，先检查一下是否已有接近你需求的现成方案。

## 需要警惕的问题

**工具调用无限循环**：如果一个工具的描述让模型认为在自身输出的响应中也适合调用它，模型可能会反复调用。编写工具描述时，要清楚地说明预期的调用场景。

**工具名称冲突**：如果两个 MCP 服务器暴露同名工具，行为是未定义的。为工具名称添加命名空间：`weather_get_forecast`、`db_run_query`、`git_diff_file`。

**Schema 漂移**：如果工具的行为变了但 schema 没有更新，模型会按照旧 schema 传入参数。每次行为变更时，务必同步更新服务器版本号和 schema。

**大体量结果**：返回一万行数据库记录虽然可行，但会消耗大量上下文。为所有可能返回可变数据量的工具添加 `limit` 参数，并设置合理的默认值。

MCP 是扩展 OpenClaw 的正确抽象层。一旦你构建了第一个服务器，模式就足够清晰，后续服务器的开发速度会大大加快。真正的限制因素变成了你希望模型能做什么——这比跟集成代码较劲要好得多。
