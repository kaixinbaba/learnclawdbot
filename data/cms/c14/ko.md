---
title: "OpenClaw용 커스텀 MCP 서버 구축: 실전 가이드"
description: "OpenClaw에 커스텀 MCP(Model Context Protocol) 서버를 구축하고 통합하는 방법을 알아봅니다. 첫 번째 도구부터 인증, 오류 처리, 테스트를 갖춘 프로덕션 수준의 통합까지."
publishedAt: 2026-03-15
status: published
visibility: public
---

# OpenClaw용 커스텀 MCP 서버 구축: 실전 가이드

Model Context Protocol(MCP)은 OpenClaw를 단순히 설정 가능한 도구가 아니라 진정으로 확장 가능한 플랫폼으로 만드는 핵심입니다. 처음 접했을 때는 프롬프트에서 함수를 호출하는 또 다른 래퍼 패턴에 불과하다고 생각했습니다. 하지만 그 이상입니다. MCP는 AI 모델이 외부 도구를 발견하고, 호출하고, 결과를 받는 방식을 표준화된 방법으로 정의합니다. 즉, 여러분이 구축한 도구는 OpenClaw가 지원하는 모든 모델에서 동일하게 작동합니다.

이 가이드는 실제 MCP 서버를 구축하는 전 과정을 다룹니다. 기본 구조에서 시작하여 인증, 오류 처리, 스트리밍, 그리고 프로덕션 서버를 안정적으로 유지하는 테스트 패턴까지 살펴봅니다.

## MCP가 실제로 하는 일

코드를 작성하기 전에 프로토콜 흐름을 이해하는 것이 중요합니다. OpenClaw가 대화를 시작할 때, 설정된 모든 MCP 서버에 `tools/list` 요청을 보냅니다. 서버는 각 사용 가능한 도구의 스키마를 응답합니다——이름, 설명, 타입이 있는 입력 파라미터입니다. 모델은 이 스키마를 대화와 함께 참조합니다.

모델이 도구를 사용하기로 결정하면, OpenClaw는 해당 서버에 `tools/call` 요청을 보냅니다. 서버는 작업을 실행하고 결과를 반환합니다. 모델은 결과를 받아 응답을 이어갑니다.

이것이 완전한 루프입니다: 발견 → 호출 → 결과. 이 설계의 우아함은 모델이 도구별 코드가 전혀 필요 없다는 점입니다——스키마만으로 동작합니다.

```
사용자 메시지 → 모델이 도구 스키마를 읽음 → 모델이 도구 호출 결정 →
OpenClaw가 MCP 서버에 tools/call 전송 → 서버 실행 →
결과가 모델에 반환 → 모델이 응답 계속
```

이 설계의 중요한 함의는 누구나 구축한 MCP 서버를 MCP 호환 클라이언트라면 어디서든 사용할 수 있다는 것입니다. 프로토콜 사양은 공개되어 있고, 커뮤니티도 그 주변에서 성장하고 있습니다. OpenClaw용으로 구축한 도구는 이론적으로 이 프로토콜을 지원하는 다른 AI 환경에서도 작동합니다.

## 개발 환경 설정

Node.js 20 이상과 공식 MCP SDK가 필요합니다:

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

`tsconfig.json`을 생성합니다:

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

일반 JavaScript 대신 TypeScript를 선택한 이유는 두 가지입니다. MCP SDK에는 IDE가 스키마 구조를 자동완성할 수 있는 완전한 타입 정의가 포함되어 있고, Zod의 유효성 검사 오류도 의미 있는 타입 추론을 생성하여 오류 처리 코드를 간결하게 만듭니다. JavaScript를 선호한다면 같은 패턴을 사용하되 타입 어노테이션만 제거하면 됩니다.

## 첫 번째 MCP 서버

하나의 도구(날씨 조회)를 노출하는 최소한의 동작하는 서버입니다:

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

실행: `npx tsx src/server.ts`

이 서버는 stdio를 통해 통신합니다. OpenClaw가 프로세스를 시작하고 stdin/stdout을 통해 통신합니다. 트랜스포트 레이어가 프레이밍을 처리하므로 원시 바이트를 다룰 필요가 없습니다.

## OpenClaw에 등록하기

OpenClaw 설정 파일(`~/.openclaw/config.yaml`)에 서버를 추가합니다:

```yaml
mcpServers:
  weather:
    command: node
    args:
      - /path/to/my-mcp-server/dist/server.js
    env:
      WEATHER_API_KEY: "${WEATHER_API_KEY}"
```

개발 중 tsx를 사용하는 경우:

```yaml
mcpServers:
  weather:
    command: npx
    args:
      - tsx
      - /path/to/my-mcp-server/src/server.ts
```

OpenClaw를 재시작하고 서버가 로드되었는지 확인합니다:

```bash
openclaw mcp list
# Should show: weather (1 tool)

openclaw mcp tools weather
# Should show: get_weather
```

## 여러 도구 처리하기

실제 서버는 여러 관련 도구를 노출합니다. 세 가지 도구를 가진 데이터베이스 검사 서버 예시입니다:

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

switch 패턴은 도구가 10~15개 이하일 때 잘 작동합니다. 그 이상이라면 레지스트리 패턴을 고려하세요:

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

## 실제로 도움이 되는 오류 처리

일반적인 오류 메시지는 프로덕션에서 쓸모가 없습니다. 도구가 실패했을 때, 모델은 무엇이 잘못됐는지 설명하거나 대안을 제시하기 위한 충분한 컨텍스트가 필요합니다. MCP에는 구조화된 오류 타입이 있습니다:

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

`InvalidParams`와 `InternalError`의 구분은 중요합니다——모델이 이를 다르게 처리합니다. 파라미터 오류는 모델이 다른 인수로 재시도해야 한다는 것을 의미합니다. 내부 오류는 도구 자체에 문제가 있다는 것을 의미합니다.

## 인증 패턴

MCP 서버는 로컬 프로세스로 실행되므로 OpenClaw가 주입하는 환경 변수에 접근할 수 있습니다. 다음 세 가지 패턴이 잘 작동합니다:

### 환경 변수를 통한 API 키

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

OpenClaw에서 설정:

```yaml
mcpServers:
  my-service:
    command: node
    args: ["/path/to/server.js"]
    env:
      MY_SERVICE_API_KEY: "${MY_SERVICE_API_KEY}"
```

### OAuth 토큰 자동 갱신

만료되는 토큰을 사용하는 서비스의 경우:

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

### 다중 사용자 컨텍스트

다중 사용자 OpenClaw 배포의 경우, 환경 변수에서 사용자 컨텍스트를 읽을 수 있습니다:

```typescript
const USER_CONTEXT = process.env.OPENCLAW_USER_ID;

async function handleToolCall(args: unknown) {
  // Log which user triggered this tool call
  console.error(`Tool called by user: ${USER_CONTEXT}`);
  // ... rest of handler
}
```

## MCP 서버 테스트하기

MCP 서버를 직접 테스트하는 것은 간단합니다——stdin으로 JSON을 받아 stdout으로 JSON을 반환합니다. 단위 테스트 예시:

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

테스트 헬퍼:

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

실제 OpenClaw MCP 클라이언트를 사용한 통합 테스트의 경우:

```bash
# Run the MCP inspector tool for interactive testing
npx @modelcontextprotocol/inspector node dist/server.js
```

Inspector 도구를 사용하면 도구를 수동으로 호출하고 전체 요청/응답 사이클을 검사할 수 있습니다.

## 풍부한 콘텐츠 반환하기

도구 결과가 반드시 JSON 문자열일 필요는 없습니다. MCP는 구조화된 콘텐츠를 지원합니다:

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

모든 모델이 이미지 콘텐츠를 동등하게 처리하지는 않습니다——Claude와 GPT-4o는 잘 처리하지만, 소형 모델은 텍스트 부분만 처리할 수 있습니다. 이미지 콘텐츠가 선택적인 경우, 텍스트만으로도 유용한 도구 응답을 설계하세요.

## 성능 고려사항

모델의 관점에서 MCP 호출은 동기적입니다——모델이 응답을 계속하기 전에 결과를 기다립니다. 이것이 도구 레이턴시를 중요하게 만드는 이유입니다:

- **200ms 미만**: 사용자가 인식하지 못함
- **200ms~2s**: 눈에 띄지만, 일회성 조회는 허용 가능
- **2s 이상**: 경험을 해침. 작업 ID를 반환하고 별도의 상태 확인 도구를 고려하세요

느린 작업에는 작업 패턴이 효과적입니다:

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

모델은 자연스럽게 `start_export`를 호출하여 작업 ID를 받고, 완료될 때까지 `check_export_status`를 호출합니다. 폴링 루프는 모델이 알아서 처리합니다——올바른 상태 값만 반환하면 됩니다.

## 구축할 만한 실용적인 서버 예시

즉각적인 실용 가치가 있는 몇 가지 서버 아이디어입니다:

**Git 작업 서버**: `git_log`, `git_diff`, `git_status`, `create_branch`. OpenClaw를 저장소 상태를 실제로 검사할 수 있는 코드 리뷰 어시스턴트로 만듭니다.

**파일 시스템 서버** (범위 제한): 특정 경로에 제한된 `read_file`, `write_file`, `list_directory`. OpenClaw에 원시 셸 접근 권한을 주는 것보다 더 제어 가능합니다.

**Jira/Linear 통합**: `list_issues`, `get_issue`, `update_issue`, `create_issue`. OpenClaw를 프로젝트 관리 어시스턴트로 전환합니다.

**내부 API 게이트웨이**: 내부 API를 래핑하는 단일 서버로 인증과 속도 제한을 중앙에서 처리합니다. 각 내부 서비스가 MCP를 알 필요 없이 자체 도구를 가질 수 있습니다.

커뮤니티는 [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers)에서 오픈소스 MCP 서버 목록을 관리합니다. 처음부터 구축하기 전에 필요한 것에 가까운 것이 이미 존재하는지 확인하세요.

## 주의해야 할 사항

**무한 도구 호출 루프**: 도구의 설명이 자신의 출력에 대한 응답에서도 유용해 보이면 모델이 반복적으로 호출할 수 있습니다. 예상되는 호출 패턴이 명확하도록 도구 설명을 작성하세요.

**도구 이름 충돌**: 두 MCP 서버가 같은 이름의 도구를 노출하면 동작이 정의되지 않습니다. 도구 이름에 네임스페이스를 붙이세요: `weather_get_forecast`, `db_run_query`, `git_diff_file`.

**스키마 드리프트**: 도구의 동작은 변했는데 스키마가 업데이트되지 않으면, 모델이 이전 스키마를 기반으로 인수를 전달합니다. 동작이 변경될 때마다 반드시 서버 버전을 올리고 스키마를 업데이트하세요.

**대용량 결과**: 10,000개의 데이터베이스 결과 행을 반환하는 것은 작동하지만 상당한 컨텍스트를 소비합니다. 가변적인 양의 데이터를 반환할 수 있는 모든 도구에 `limit` 파라미터를 추가하고 합리적인 기본값을 설정하세요.

MCP는 OpenClaw를 확장하기 위한 올바른 추상화 레이어입니다. 서버 하나를 구축하고 나면 패턴이 충분히 명확해져서 추가 서버를 빠르게 만들 수 있습니다. 제한 요소는 모델이 무엇을 할 수 있기를 원하느냐는 문제가 됩니다——통합 코드와 씨름하는 것보다 훨씬 나은 문제입니다.
