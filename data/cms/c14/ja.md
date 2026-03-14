---
title: "OpenClaw 向けカスタム MCP サーバーの構築：実践ガイド"
description: "OpenClaw にカスタム MCP（Model Context Protocol）サーバーを構築・統合する方法を学びます。最初のツールから、認証・エラーハンドリング・テストを備えたプロダクション品質の統合まで。"
publishedAt: 2026-03-15
status: published
visibility: public
---

# OpenClaw 向けカスタム MCP サーバーの構築：実践ガイド

Model Context Protocol（MCP）は、OpenClaw を単に「設定可能」なツールではなく、真の意味で「拡張可能」なプラットフォームにする仕組みです。最初に目にしたとき、プロンプトから関数を呼び出すためのラッパーパターンに過ぎないと思っていました。しかし、それ以上のものです。MCP は AI モデルが外部ツールを発見し、呼び出し、結果を受け取るための標準化された方式を定義します。つまり、あなたが構築したツールは OpenClaw がサポートするすべてのモデルで、まったく同じように動作します。

このガイドでは、実際の MCP サーバーを構築する全工程を扱います。基本構造から始まり、認証、エラーハンドリング、ストリーミング、そしてプロダクションサーバーを安定させるテストパターンまで解説します。

## MCP が実際に何をするのか

コードを書く前に、プロトコルのフローを理解しておく価値があります。OpenClaw が会話を開始するとき、設定済みのすべての MCP サーバーに対して `tools/list` リクエストを送ります。サーバーは利用可能な各ツールのスキーマを返します——名前、説明、型付きの入力パラメータです。モデルはこのスキーマを会話とともに参照します。

モデルがツールを使用すると判断したとき、OpenClaw は該当サーバーに `tools/call` リクエストを送ります。サーバーは操作を実行し、結果を返します。モデルは結果を受け取り、応答を続けます。

これが完全なループです：発見 → 呼び出し → 結果。この設計の美しさは、モデルがツール固有のコードを一切必要としない点にあります——スキーマだけで動作します。

```
ユーザーメッセージ → モデルがツールスキーマを読む → モデルがツール呼び出しを決定 →
OpenClaw が MCP サーバーに tools/call を送信 → サーバーが実行 →
結果がモデルに返る → モデルが応答を続ける
```

この設計の重要な意義は、誰でも構築した MCP サーバーが MCP 対応のクライアントであればどれでも利用できるという点です。プロトコル仕様は公開されており、コミュニティもその周辺で成長し続けています。OpenClaw 向けに構築したツールは、理論上、このプロトコルをサポートする他の AI 環境でも機能します。

## 開発環境のセットアップ

Node.js 20 以上と公式 MCP SDK が必要です：

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

`tsconfig.json` を作成します：

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

素の JavaScript ではなく TypeScript を選ぶ理由は二つあります。MCP SDK にはスキーマ構造を IDE がオートコンプリートできる完全な型定義が含まれており、Zod のバリデーションエラーも意味のある型推論を生成するため、エラーハンドリングコードが簡潔になります。JavaScript を好む場合も同じパターンが使えますが、型アノテーションは省略します。

## 最初の MCP サーバー

1つのツール（天気検索）を公開する、最小限の動作するサーバーを以下に示します：

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

実行方法：`npx tsx src/server.ts`

このサーバーは stdio 経由で通信します。OpenClaw がプロセスを起動し、stdin/stdout を通じてやり取りします。トランスポート層がフレーミングを処理するため、生のバイト列を扱う必要はありません。

## OpenClaw への登録

OpenClaw の設定ファイル（`~/.openclaw/config.yaml`）にサーバーを追加します：

```yaml
mcpServers:
  weather:
    command: node
    args:
      - /path/to/my-mcp-server/dist/server.js
    env:
      WEATHER_API_KEY: "${WEATHER_API_KEY}"
```

開発中に tsx を使用する場合：

```yaml
mcpServers:
  weather:
    command: npx
    args:
      - tsx
      - /path/to/my-mcp-server/src/server.ts
```

OpenClaw を再起動し、サーバーが読み込まれたことを確認します：

```bash
openclaw mcp list
# Should show: weather (1 tool)

openclaw mcp tools weather
# Should show: get_weather
```

## 複数ツールの処理

実際のサーバーは複数の関連ツールを公開します。以下は3つのツールを持つデータベース検査サーバーの例です：

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

switch パターンはツール数が 10〜15 個程度であれば問題なく動作します。それを超える場合は、レジストリパターンを検討してください：

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

## 実際に役立つエラーハンドリング

汎用的なエラーメッセージはプロダクションでは意味がありません。ツールが失敗したとき、モデルは何が問題だったかを説明したり、代替案を提示したりするための十分なコンテキストを必要とします。MCP には構造化されたエラー型があります：

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

`InvalidParams` と `InternalError` の区別は重要です——モデルはこれらを異なる方法で処理します。パラメータエラーはモデルに異なる引数で再試行を促します。内部エラーはツール自体に問題があることを示します。

## 認証パターン

MCP サーバーはローカルプロセスとして動作するため、OpenClaw が注入する任意の環境変数にアクセスできます。以下の3つのパターンが実用的です：

### 環境変数による API キー

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

OpenClaw で設定する方法：

```yaml
mcpServers:
  my-service:
    command: node
    args: ["/path/to/server.js"]
    env:
      MY_SERVICE_API_KEY: "${MY_SERVICE_API_KEY}"
```

### OAuth トークンの自動更新

有効期限付きトークンを使用するサービスの場合：

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

### マルチユーザーコンテキスト

マルチユーザーの OpenClaw デプロイでは、環境変数からユーザーコンテキストを読み取れます：

```typescript
const USER_CONTEXT = process.env.OPENCLAW_USER_ID;

async function handleToolCall(args: unknown) {
  // Log which user triggered this tool call
  console.error(`Tool called by user: ${USER_CONTEXT}`);
  // ... rest of handler
}
```

## MCP サーバーのテスト

MCP サーバーのテストは簡単です——stdin 経由で JSON を受け取り、stdout 経由で JSON を返します。単体テストの例：

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

テストヘルパー：

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

実際の OpenClaw MCP クライアントを使った統合テストには：

```bash
# Run the MCP inspector tool for interactive testing
npx @modelcontextprotocol/inspector node dist/server.js
```

Inspector ツールを使うと、ツールを手動で呼び出し、リクエスト/レスポンスの全サイクルを確認できます。

## リッチなコンテンツの返し方

ツールの結果は JSON 文字列である必要はありません。MCP は構造化されたコンテンツをサポートしています：

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

すべてのモデルが画像コンテンツを同じように処理するわけではありません——Claude と GPT-4o は適切に処理しますが、小型モデルはテキスト部分のみを処理するかもしれません。画像コンテンツがオプションの場合は、テキストのみでも有用なツールレスポンスを設計してください。

## パフォーマンスに関する考慮事項

モデルの観点から見ると、MCP 呼び出しは同期的です——モデルは応答を続ける前に結果を待ちます。これがツールのレイテンシを重要にする理由です：

- **200ms 未満**：ユーザーには気づかれない
- **200ms〜2s**：気づかれるが、単発の検索なら許容範囲
- **2s 以上**：体験を損なう。ジョブ ID を返し、別のステータス確認ツールを用意することを検討する

時間のかかる処理にはジョブパターンが有効です：

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

モデルは自然に `start_export` を呼び出してジョブ ID を取得し、完了するまで `check_export_status` を呼び出し続けます。ポーリングループはモデル自身が処理します——適切なステータス値を返すだけで十分です。

## 構築する価値のある実用的なサーバー例

すぐに実用的な価値をもたらすサーバーのアイデアをいくつか紹介します：

**Git 操作サーバー**：`git_log`、`git_diff`、`git_status`、`create_branch`。OpenClaw をリポジトリの状態を実際に検査できるコードレビューアシスタントに変えます。

**ファイルシステムサーバー**（スコープ限定）：特定パスに限定した `read_file`、`write_file`、`list_directory`。OpenClaw にシェルの生のアクセス権を与えるよりも制御しやすくなります。

**Jira/Linear 統合**：`list_issues`、`get_issue`、`update_issue`、`create_issue`。OpenClaw をプロジェクト管理アシスタントに変えます。

**内部 API ゲートウェイ**：内部 API をラップする単一サーバーで、認証とレート制限を一元管理します。各内部サービスが MCP を意識することなく、それぞれのツールを持てます。

コミュニティは [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers) にオープンソースの MCP サーバーリストを維持しています。ゼロから構築する前に、必要なものに近いものがすでに存在しないか確認してください。

## 注意すべき落とし穴

**ツール呼び出しの無限ループ**：ツールの説明が、自身の出力への応答でも有用に見えてしまう場合、モデルがそれを繰り返し呼び出す可能性があります。想定される呼び出しパターンが明確になるようにツールの説明を書きましょう。

**ツール名の衝突**：2つの MCP サーバーが同じ名前のツールを公開すると、動作は未定義になります。ツール名には名前空間をつけましょう：`weather_get_forecast`、`db_run_query`、`git_diff_file`。

**スキーマの乖離**：ツールの動作は変わったのにスキーマが更新されていない場合、モデルは古いスキーマに基づいて引数を渡します。動作が変わったときは必ずサーバーバージョンを上げ、スキーマも更新してください。

**大きな結果**：10,000行のデータベース結果を返すことは動作しますが、大量のコンテキストを消費します。可変量のデータを返す可能性のあるすべてのツールに `limit` パラメータを追加し、適切なデフォルト値を設定してください。

MCP は OpenClaw を拡張するための適切な抽象化レイヤーです。一つのサーバーを構築すると、パターンが十分に明確になり、追加のサーバーを素早く作成できるようになります。制限要因は、モデルに何ができるようにしたいかという問題になります——それは統合コードと格闘するよりずっと良い問題です。
