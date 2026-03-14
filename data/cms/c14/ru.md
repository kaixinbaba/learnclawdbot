---
title: "Создание кастомных MCP-серверов для OpenClaw: практическое руководство"
description: "Узнайте, как создавать и интегрировать кастомные MCP-серверы (Model Context Protocol) с OpenClaw. От первого инструмента до интеграций производственного уровня с аутентификацией, обработкой ошибок и тестированием."
publishedAt: 2026-03-15
status: published
visibility: public
---

# Создание кастомных MCP-серверов для OpenClaw: практическое руководство

Model Context Protocol (MCP) — это то, что делает OpenClaw по-настоящему расширяемым, а не просто настраиваемым. Когда я впервые с ним столкнулся, решил, что это очередной паттерн-обёртка — ещё один способ вызывать функции из промпта. На самом деле всё глубже. MCP определяет стандартизированный способ, которым AI-модели обнаруживают внешние инструменты, вызывают их и получают результаты. Это означает, что любой инструмент, который вы создадите, будет работать одинаково с каждой моделью, поддерживаемой OpenClaw.

В этом руководстве рассматривается создание реального MCP-сервера: от базовой структуры до аутентификации, обработки ошибок, стриминга и паттернов тестирования, обеспечивающих стабильность продакшн-серверов.

## Что на самом деле делает MCP

Прежде чем писать код, стоит разобраться с потоком протокола. Когда OpenClaw начинает разговор, он опрашивает все настроенные MCP-серверы через запрос `tools/list`. Сервер отвечает схемой каждого доступного инструмента — названием, описанием, входными параметрами с типами. Модель видит эти схемы вместе с контекстом разговора.

Когда модель решает использовать инструмент, OpenClaw отправляет запрос `tools/call` на соответствующий сервер. Сервер выполняет операцию и возвращает результат. Модель получает результат и продолжает генерировать ответ.

Вот и весь цикл: обнаружение → вызов → результат. Элегантность в том, что модели не нужен специфический для инструмента код — она работает только по схеме.

```
Сообщение пользователя → Модель читает схемы инструментов → Модель решает вызвать инструмент →
OpenClaw отправляет tools/call на MCP-сервер → Сервер выполняет →
Результат возвращается модели → Модель продолжает ответ
```

Важное следствие этой архитектуры: любой MCP-сервер, созданный кем угодно, может использоваться любым совместимым с MCP клиентом. Спецификация протокола открыта, и вокруг неё растёт сообщество. Инструмент, созданный для OpenClaw, теоретически работает и в других AI-средах, поддерживающих этот протокол.

## Настройка среды разработки

Вам понадобится Node.js 20+ и официальный MCP SDK:

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

Создайте `tsconfig.json`:

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

Я выбрал TypeScript вместо обычного JavaScript по двум причинам: MCP SDK имеет полные определения типов, что позволяет IDE автодополнять структуры схем, а ошибки валидации Zod также генерируют осмысленные выводы типов, упрощая код обработки ошибок. Если вы предпочитаете JavaScript, те же паттерны работают без аннотаций типов.

## Ваш первый MCP-сервер

Вот минимально рабочий сервер, предоставляющий один инструмент — запрос погоды:

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

Запуск: `npx tsx src/server.ts`

Этот сервер общается через stdio. OpenClaw запускает процесс и взаимодействует с ним через stdin/stdout. Транспортный уровень занимается фреймингом — вам не нужно работать с сырыми байтами.

## Регистрация в OpenClaw

Добавьте сервер в конфигурацию OpenClaw (`~/.openclaw/config.yaml`):

```yaml
mcpServers:
  weather:
    command: node
    args:
      - /path/to/my-mcp-server/dist/server.js
    env:
      WEATHER_API_KEY: "${WEATHER_API_KEY}"
```

Или для разработки с tsx:

```yaml
mcpServers:
  weather:
    command: npx
    args:
      - tsx
      - /path/to/my-mcp-server/src/server.ts
```

Перезапустите OpenClaw и убедитесь, что сервер загрузился:

```bash
openclaw mcp list
# Should show: weather (1 tool)

openclaw mcp tools weather
# Should show: get_weather
```

## Обработка нескольких инструментов

Реальные серверы предоставляют несколько связанных инструментов. Вот сервер инспекции базы данных с тремя инструментами:

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

Паттерн switch хорошо работает до 10–15 инструментов. Если инструментов больше, рассмотрите паттерн реестра:

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

## Обработка ошибок, которая реально помогает

Общие сообщения об ошибках бесполезны в продакшне. Когда инструмент сбоит, модели нужен достаточный контекст, чтобы объяснить что пошло не так или предложить альтернативы. У MCP есть структурированные типы ошибок:

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

Различие между `InvalidParams` и `InternalError` важно — модель обрабатывает их по-разному. Ошибки параметров предлагают модели повторить попытку с другими аргументами. Внутренние ошибки указывают на то, что проблема в самом инструменте.

## Паттерны аутентификации

MCP-серверы запускаются как локальные процессы, поэтому имеют доступ к любым переменным окружения, которые инжектирует OpenClaw. Три паттерна хорошо работают:

### API-ключ через переменные окружения

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

Настройка в OpenClaw:

```yaml
mcpServers:
  my-service:
    command: node
    args: ["/path/to/server.js"]
    env:
      MY_SERVICE_API_KEY: "${MY_SERVICE_API_KEY}"
```

### Автоматическое обновление OAuth-токена

Для сервисов с истекающими токенами:

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

### Многопользовательский контекст

Для многопользовательских инсталляций OpenClaw можно читать контекст пользователя из переменных окружения:

```typescript
const USER_CONTEXT = process.env.OPENCLAW_USER_ID;

async function handleToolCall(args: unknown) {
  // Log which user triggered this tool call
  console.error(`Tool called by user: ${USER_CONTEXT}`);
  // ... rest of handler
}
```

## Тестирование MCP-сервера

Тестировать MCP-серверы напрямую просто — они принимают JSON через stdin и возвращают JSON через stdout. Для юнит-тестов:

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

Тестовый хелпер:

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

Для интеграционных тестов с реальным MCP-клиентом OpenClaw:

```bash
# Run the MCP inspector tool for interactive testing
npx @modelcontextprotocol/inspector node dist/server.js
```

Inspector позволяет вручную вызывать инструменты и изучать полный цикл запрос/ответ.

## Возврат богатого контента

Результаты инструментов необязательно должны быть JSON-строками. MCP поддерживает структурированный контент:

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

Не все модели одинаково хорошо обрабатывают графический контент — Claude и GPT-4o справляются хорошо, небольшие модели могут обрабатывать только текстовые части. Если изображения опциональны, проектируйте ответы инструментов так, чтобы они были полезны и в режиме только-текст.

## Соображения о производительности

С точки зрения модели, вызовы MCP синхронны — модель ждёт результата, прежде чем продолжать ответ. Именно поэтому задержка инструмента важна:

- **Менее 200мс**: Незаметно для пользователей
- **200мс–2с**: Заметно, но приемлемо для разовых запросов
- **Более 2с**: Нарушает опыт. Рассмотрите возврат идентификатора задачи и отдельного инструмента проверки статуса

Для медленных операций подходит паттерн задач:

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

Модель естественным образом вызовет `start_export`, дождётся идентификатора задачи, затем будет вызывать `check_export_status` до завершения. Цикл опроса она обработает сама — вам нужно лишь возвращать правильные значения статуса.

## Практические примеры для создания

Несколько идей серверов, которые имеют непосредственную практическую ценность:

**Сервер Git-операций**: `git_log`, `git_diff`, `git_status`, `create_branch`. Превращает OpenClaw в ассистента code review, способного реально проверять состояние репозитория.

**Сервер файловой системы** (с ограниченной областью): `read_file`, `write_file`, `list_directory` — только для определённых путей. Более управляемый, чем предоставление OpenClaw прямого доступа к оболочке.

**Интеграция с Jira/Linear**: `list_issues`, `get_issue`, `update_issue`, `create_issue`. Превращает OpenClaw в ассистента управления проектами.

**Внутренний API-шлюз**: Единый сервер, оборачивающий внутренние API и централизованно обрабатывающий аутентификацию и ограничение запросов. Каждый внутренний сервис получает свои инструменты, не зная ничего про MCP.

Сообщество поддерживает список открытых MCP-серверов на [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers). Прежде чем строить с нуля, проверьте, не существует ли уже чего-то близкого к нужному.

## На что обратить внимание

**Бесконечные циклы вызовов инструментов**: Если описание инструмента делает его полезным в ответ на его собственный вывод, модель может вызывать его снова и снова. Пишите описания инструментов так, чтобы ожидаемый паттерн вызова был очевиден.

**Коллизии имён инструментов**: Если два MCP-сервера предоставляют инструмент с одинаковым именем, поведение не определено. Используйте пространства имён в названиях инструментов: `weather_get_forecast`, `db_run_query`, `git_diff_file`.

**Дрейф схемы**: Если поведение инструмента изменилось, а схема — нет, модель будет передавать аргументы по старой схеме. Всегда повышайте версию сервера и обновляйте схему при изменении поведения.

**Большие результаты**: Возврат 10 000 строк из базы данных сработает, но потребует значительного контекста. Добавляйте параметры `limit` к каждому инструменту, который может возвращать переменное количество данных, и устанавливайте разумные значения по умолчанию.

MCP — правильный уровень абстракции для расширения OpenClaw. Когда вы построите первый сервер, паттерн станет достаточно понятным, чтобы создавать дополнительные серверы быстро. Ограничивающим фактором становится вопрос о том, что вы хотите, чтобы модель умела делать — а это куда более приятная проблема, чем борьба с интеграционным кодом.
