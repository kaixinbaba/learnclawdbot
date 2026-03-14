---
title: "调试 OpenClaw：日志解读、请求追踪与根因分析"
description: "系统化诊断 OpenClaw 问题的完整指南：如何读取日志、追踪请求、识别模型 API 错误、调试 MCP 服务器故障，以及修复最常见的生产环境问题。"
publishedAt: 2026-03-18
status: published
visibility: public
---

# 调试 OpenClaw：日志解读、请求追踪与根因分析

我在终端里盯着 OpenClaw 日志输出发呆的时间比我愿意承认的要多得多——通常是在晚上 11 点，试图弄清楚为什么一个在测试环境跑得好好的部署，到了生产环境却在悄悄丢弃请求。好消息是：一旦你知道该往哪里看，OpenClaw 的可观测性其实相当不错。坏消息是：如果你不熟悉这些规律，日志看起来就像一堵噪音之墙。

这篇指南汇集了我在认真调试 OpenClaw 时希望自己早就拥有的一切。我们将逐步讲解如何读取日志、如何追踪一个请求从客户端到模型后端再返回的完整链路，以及如何诊断我遇到最多的那些故障。

---

## 启用调试模式

在做任何事之前，你需要的是真正有用的日志。OpenClaw 默认的日志级别（`info`）只告诉你事情在发生，却不告诉你*为什么*失败。

在配置文件中将日志级别设置为 `debug`：

```yaml
# openclaw.config.yaml
logging:
  level: debug
  format: json        # 结构化 JSON——解析起来容易得多
  output: stdout      # 或指定文件路径
  include_request_body: true   # 警告：如果不小心会把 API key 记录到请求头里
  trace_id: true      # 为每个请求附加一个 trace ID
```

如果不想修改配置文件，也可以通过环境变量设置：

```bash
OPENCLAW_LOG_LEVEL=debug OPENCLAW_LOG_FORMAT=json ./openclaw serve
```

`info` 和 `debug` 输出之间的差异非常显著。在 `info` 级别，你只能看到：

```
2026-03-18T09:12:44Z INFO  Request completed status=200 duration=1.2s
```

在 `debug` 级别，你能看到完整的请求生命周期，包括模型选择、token 计数、MCP 服务器分发和响应组装。这才是真正诊断问题所需要的。

**关于 `include_request_body` 的重要提示：** 我在生产环境中保持关闭，只有在主动调试时才启用。请求体包含用户消息，可能含有敏感数据。临时启用、复现问题、然后再关闭。

---

## 理解结构化日志输出

设置 `format: json` 后，OpenClaw 会输出结构化 JSON 日志。每一行日志都是一个合法的 JSON 对象。下面是一个正常请求周期的样子：

```json
{"ts":"2026-03-18T09:12:44.001Z","level":"debug","msg":"Request received","trace_id":"req_a4f9b2","method":"POST","path":"/v1/chat","client_ip":"10.0.1.15"}
{"ts":"2026-03-18T09:12:44.003Z","level":"debug","msg":"Session resolved","trace_id":"req_a4f9b2","session_id":"sess_7c3d1a","context_tokens":4821,"context_limit":128000}
{"ts":"2026-03-18T09:12:44.004Z","level":"debug","msg":"Model selected","trace_id":"req_a4f9b2","model":"deepseek-r1","backend":"deepseek","routing_reason":"default"}
{"ts":"2026-03-18T09:12:44.005Z","level":"debug","msg":"MCP dispatch begin","trace_id":"req_a4f9b2","servers":["filesystem","search"],"tool_calls_pending":0}
{"ts":"2026-03-18T09:12:44.006Z","level":"debug","msg":"Model request sent","trace_id":"req_a4f9b2","backend":"deepseek","prompt_tokens":4821,"temperature":0.7}
{"ts":"2026-03-18T09:12:46.312Z","level":"debug","msg":"Model response received","trace_id":"req_a4f9b2","completion_tokens":387,"finish_reason":"stop","latency_ms":2306}
{"ts":"2026-03-18T09:12:46.313Z","level":"info","msg":"Request completed","trace_id":"req_a4f9b2","status":200,"duration_ms":2312}
```

每一行日志都共享同一个 `trace_id`（上面的 `req_a4f9b2`）。这是你追踪单个请求在系统中流转的主要工具。当出现问题时，grep 这个 trace ID 就能得到完整的故事。

```bash
# 追踪某个特定请求
grep "req_a4f9b2" /var/log/openclaw/app.log | jq '.'

# 找出最近一小时内所有失败的请求
cat /var/log/openclaw/app.log | jq 'select(.level == "error") | select(.ts > "2026-03-18T08:00:00Z")'

# 找出慢请求（超过 5 秒）
cat /var/log/openclaw/app.log | jq 'select(.duration_ms > 5000)'
```

如果你还不熟悉 `jq`，建议学习基础用法。它能把结构化日志分析从痛苦变成高效。

---

## 使用内置 Trace 查看器

OpenClaw 自带一个基于 Web 的 trace 查看器，地址是 `http://localhost:8080/debug/traces`（需要启用管理界面）。它提供请求时序的瀑布图视图——类似浏览器网络面板，但是针对你的 AI 请求管道。

启用方式：

```yaml
admin:
  enabled: true
  port: 8080
  bind: 127.0.0.1   # 不要对外暴露
  trace_retention: 500   # 在内存中保留最近 500 条 trace
```

当你有一个可以复现的延迟问题时，trace 查看器最为有用。你可以清楚地看到时间花在哪里：会话查找、模型 API 调用、MCP 工具执行、响应流式传输。我曾用它找到一个案例：某个自定义 MCP 服务器在每次请求时都增加了 800ms 延迟，原因是它在每次调用时做了一次冷 DNS 查询——仅从日志时间戳上不明显，但在瀑布图里一目了然。

查看器还会显示任何已存储 trace 的完整请求和响应负载，这对于在不全局启用 `include_request_body` 的情况下捕捉提示词构建 bug 很有用。

---

## 故障场景 1：模型 API 错误

这是你最常遇到的故障，可以细分为几个不同的类别。

### 速率限制错误

日志特征：

```json
{"ts":"2026-03-18T10:45:22Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","retry_after":60,"attempt":1}
{"ts":"2026-03-18T10:45:22Z","level":"warn","msg":"Backing off before retry","trace_id":"req_c8e2d1","backoff_ms":5000,"attempt":1}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","attempt":2}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Request failed after max retries","trace_id":"req_c8e2d1","attempts":2,"final_status":429}
```

`status: 429` 是明确的标志。OpenClaw 默认会以退避策略重试，但如果速率限制持续被触发，重试只是延迟了失败。

**诊断：** 检查同时访问 OpenClaw 的并发用户数或自动化进程数量。速率限制错误会在时间上聚集出现——你会看到一批同时出现，而不是随机分布。

```bash
# 按分钟统计 429 错误数量
cat /var/log/openclaw/app.log | jq -r 'select(.status == 429) | .ts[0:16]' | sort | uniq -c
```

**修复：** 在 OpenClaw 中配置后端特定的速率限制设置，或者设置多个 API key 并启用轮询路由：

```yaml
backends:
  openai:
    api_keys:
      - key: sk-key-one
        weight: 1
      - key: sk-key-two
        weight: 1
    rate_limit:
      requests_per_minute: 500
      tokens_per_minute: 90000
```

### 认证失败

日志特征：

```json
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Model API error","trace_id":"req_f1a9c3","backend":"anthropic","status":401,"error":"Invalid API key"}
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Authentication failed — check API key config","trace_id":"req_f1a9c3","backend":"anthropic"}
```

401 是明确的：API key 错误、已过期或缺失。比较让人困惑的情况是某些请求成功而其他请求失败——这通常意味着你配置了多个后端，其中一个的 key 无效。

**用 curl 隔离后端：**

```bash
# 直接测试模型后端，绕过 OpenClaw
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

如果返回有效响应，key 没有问题，问题在于 OpenClaw 的配置。如果返回 401，你已经找到了问题所在。

### 超出上下文长度

日志特征：

```json
{"ts":"2026-03-18T11:15:43Z","level":"error","msg":"Model API error","trace_id":"req_b7d2e4","backend":"deepseek","status":400,"error":"context_length_exceeded","detail":"max_tokens 128000, requested 134521"}
{"ts":"2026-03-18T11:15:43Z","level":"warn","msg":"Context exceeded model limit","trace_id":"req_b7d2e4","context_tokens":134521,"model_limit":128000,"session_id":"sess_9a4b7c"}
```

这个问题比较隐蔽，因为它与会话长度相关，而不是单个请求的大小。一段运行了一段时间的对话会持续积累上下文，直到触及模型的限制。

**诊断：** 查看同一 `session_id` 在不同请求中的 `context_tokens` 字段。当你看到它接近模型限制时，很快就会失败。

**修复：** 在会话配置中启用自动上下文截断或摘要：

```yaml
sessions:
  context_management:
    strategy: truncate_oldest    # 或者 "summarize"（如果你配置了摘要模型）
    max_context_tokens: 120000   # 低于模型实际限制，留一些缓冲
    warn_at_tokens: 100000
```

---

## 故障场景 2：MCP 服务器连接失败

如果你在运行自定义 MCP 服务器（参见 [MCP 服务器指南](/blog/building-custom-mcp-servers-openclaw)），迟早会遇到故障。症状各不相同：工具无法执行、无声超时，或者错误以"工具不可用"的形式浮现给用户。

### 连接被拒绝

日志特征：

```json
{"ts":"2026-03-18T12:30:15Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":1}
{"ts":"2026-03-18T12:30:15Z","level":"warn","msg":"MCP server marked unhealthy","server":"my-custom-tools","consecutive_failures":1}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":2}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server unavailable — tool calls will fail","server":"my-custom-tools","consecutive_failures":2}
```

`ECONNREFUSED` 意味着配置端口上没有进程在运行，或者进程在监听不同的端口。首先检查：

```bash
# MCP 服务器进程是否在运行？
ps aux | grep my-custom-tools

# 有进程在监听预期的端口吗？
lsof -i :9001

# OpenClaw 能访问到它吗？（在同一主机上）
curl -v http://127.0.0.1:9001/health
```

### MCP 协议错误

更难诊断。当 MCP 服务器进程在运行但返回格式错误的响应时会发生这种情况：

```json
{"ts":"2026-03-18T13:05:22Z","level":"error","msg":"MCP protocol error","trace_id":"req_d4a7b9","server":"filesystem","error":"invalid JSON in response","raw_response":"<html>404 Not Found</html>"}
{"ts":"2026-03-18T13:05:22Z","level":"debug","msg":"MCP server response dump","server":"filesystem","response_bytes":27,"content_type":"text/html"}
```

`raw_response` 字段告诉你服务器到底返回了什么。JSON 字段里出现一个 HTML 404 页面，说明你配置了错误的端点 URL——你可能访问了 nginx 代理而不是直接访问 MCP 服务器。

```bash
# 直接测试 MCP 服务器的工具列表
curl -X POST http://127.0.0.1:9001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

健康的 MCP 服务器会返回包含你工具定义的 JSON-RPC 响应。任何其他返回都表明服务器层面存在问题。

### MCP 超时

```json
{"ts":"2026-03-18T13:45:01Z","level":"warn","msg":"MCP tool call timed out","trace_id":"req_a2c8d5","server":"search","tool":"web_search","timeout_ms":10000,"elapsed_ms":10003}
{"ts":"2026-03-18T13:45:01Z","level":"error","msg":"Tool call failed","trace_id":"req_a2c8d5","server":"search","tool":"web_search","error":"timeout"}
```

工具调用触及了配置的超时。这通常意味着 MCP 服务器在做某件耗时的事——外部 HTTP 调用、数据库查询，或者服务器过载。

**修复：** 如果操作本身就比较慢，就增加该服务器的超时时间；同时在你的 MCP 服务器内部添加超时，让它快速失败而不是挂起：

```yaml
mcp_servers:
  search:
    url: http://localhost:9002
    timeout_ms: 30000    # 从默认的 10s 增加
    retry:
      attempts: 2
      delay_ms: 1000
```

---

## 故障场景 3：流式传输期间 WebSocket 断开

通过 WebSocket 进行流式响应是最难以预测的环节，尤其是在高负载下。失败模式通常是客户端看到连接在响应中途断开，表现为消息被截断但没有任何错误提示。

服务器端的日志特征：

```json
{"ts":"2026-03-18T14:20:33Z","level":"debug","msg":"WebSocket stream started","trace_id":"req_g9h1i2","client_ip":"10.0.1.22","session_id":"sess_3e7f2b"}
{"ts":"2026-03-18T14:20:41Z","level":"warn","msg":"WebSocket write error","trace_id":"req_g9h1i2","error":"write: broken pipe","bytes_sent":12840,"completion_pct":67}
{"ts":"2026-03-18T14:20:41Z","level":"info","msg":"WebSocket connection closed (client disconnect)","trace_id":"req_g9h1i2","clean_close":false}
```

`broken pipe` 和 `clean_close: false` 告诉你是客户端断开了连接——不是 OpenClaw 关闭的。常见原因：

**负载均衡器超时：** 你的负载均衡器的超时时间短于 OpenClaw 流式响应的持续时间。检查负载均衡器的空闲连接超时。对于 nginx：

```nginx
proxy_read_timeout 120s;    # 必须长于你预期的最长响应时间
proxy_send_timeout 120s;
```

**客户端侧超时：** 浏览器或客户端应用的请求超时在流完成之前触发。不常见，但确实会发生。

**网络不稳定：** 如果你看到 broken pipe 错误在特定时间聚集出现，将其与你的网络监控数据进行关联分析。

要区分客户端断开和服务器端错误，看 `clean_close` 字段。如果是 `false` 且之前没有来自 OpenClaw 的错误，说明是客户端放弃了。如果在连接关闭之前有模型错误或 OOM 事件，那就是服务器的问题。

---

## 故障场景 4：高延迟

高延迟是最让人沮丧的故障，因为系统在技术上是工作的——只是工作得很慢。trace 查看器在这里帮助极大，但你也可以仅从日志入手。

一个高延迟请求，模型本身很快但 MCP 很慢：

```json
{"ts":"2026-03-18T15:10:01Z","level":"debug","msg":"Model request sent","trace_id":"req_k3l5m7","latency_checkpoint":"model_start"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"Model response received","trace_id":"req_k3l5m7","latency_ms":2100,"latency_checkpoint":"model_end"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"MCP tool call begin","trace_id":"req_k3l5m7","server":"database","tool":"query_records"}
{"ts":"2026-03-18T15:10:11Z","level":"debug","msg":"MCP tool call complete","trace_id":"req_k3l5m7","server":"database","tool":"query_records","latency_ms":8200}
{"ts":"2026-03-18T15:10:11Z","level":"info","msg":"Request completed","trace_id":"req_k3l5m7","duration_ms":10350}
```

模型用了 2.1 秒。数据库 MCP 工具用了 8.2 秒。总计：10.35 秒。一旦你有了每个阶段的计时数据，瓶颈就显而易见。

我遇到过的其他高延迟原因：
- **会话反序列化：** 每次请求都从 Redis 加载包含大量上下文的会话。修复：检查序列化格式，考虑在内存中缓存已反序列化的会话。
- **模型路由冷启动：** 向后端发出的第一个请求需要更长时间来预热连接池。修复：配置长连接（keepalive）。
- **高负载下的排队：** 请求在等待其他请求处理完成。修复：增加 worker 数量或水平扩展。你会在日志中看到较高的 `queue_wait_ms`。

如果你在[使用 DeepSeek 本地路由](/blog/openclaw-deepseek-low-cost)，高延迟通常意味着推理节点处于 GPU 内存压力下——将你的 `nvidia-smi` 或类似指标与 OpenClaw 时序数据关联分析。

---

## 故障场景 5：内存和会话问题

OpenClaw 会话相对轻量，但如果你有长期运行的大上下文会话，内存可能成为问题。

会话内存压力的迹象：

```json
{"ts":"2026-03-18T16:00:02Z","level":"warn","msg":"Session store near capacity","active_sessions":4821,"max_sessions":5000,"memory_mb":1840}
{"ts":"2026-03-18T16:00:15Z","level":"error","msg":"Session evicted under memory pressure","session_id":"sess_8b2e9d","age_minutes":47,"context_tokens":98000}
{"ts":"2026-03-18T16:00:15Z","level":"warn","msg":"Client will receive session expired error","session_id":"sess_8b2e9d"}
```

会话被驱逐意味着该用户的下一个请求会像全新对话一样出现——他们的历史记录消失了。这对用户来说很困惑，说明你的会话容量太低，或者会话持有的上下文太多。

**修复：** 降低每个会话的上下文限制，启用 Redis 持久化以便恢复被驱逐的会话，或者增加内存限制：

```yaml
sessions:
  max_active: 10000
  store: redis              # 持久化存储，避免内存压力
  redis_url: redis://localhost:6379
  max_context_tokens: 50000  # 每个会话更严格的限制
  idle_timeout_minutes: 60   # 更快驱逐空闲会话
```

---

## 系统化排查清单

当我收到新的 bug 报告时，我按这个顺序进行排查：

1. **获取 trace ID。** 如果用户报告故障，检查 OpenClaw 是否在响应中返回了 `X-Trace-Id` 头。如果有，立即 grep 它。

2. **检查日志级别。** 如果你在 `info` 级别，临时切换到 `debug` 并复现问题。看不见的东西无从诊断。

3. **从错误日志中识别故障类型。** 是来自模型 API 的 4xx？MCP 服务器的连接错误？还是协议层面的断开？

4. **隔离模型后端。** 用 curl 直接测试模型 API（见上面的 401 章节）。这能告诉你是 OpenClaw 还是后端的问题。

5. **隔离 MCP 服务器。** 如果涉及 MCP 工具调用，用 curl 直接测试每个 MCP 服务器。健康的服务器对 `tools/list` 调用能正确响应。

6. **检查计时。** 如果延迟是问题所在，使用 trace 查看器或 `jq` 比较每个阶段的计时。找出时间究竟花在哪里。

7. **检查会话状态。** 如果用户在丢失对话历史或遭遇意外重置，查找会话驱逐警告，检查会话存储的健康状况。

8. **检查资源利用率。** OOM 杀进程、CPU 尖峰和 GPU 内存压力都会导致级联故障。将系统指标与日志中故障的时序关联分析。

9. **回顾最近的配置变更。** 我调查过的大多数生产故障都能追溯到一个看似微小的配置变更。检查配置文件的 git diff。

10. **在隔离环境中复现。** 在编写修复方案之前，确保你能稳定复现问题。使用 curl 或简单脚本来触发那个正在失败的精确请求。

---

## 快速参考：日志模式及其含义

| 日志信息 | 可能原因 |
|---|---|
| `status: 429` | 模型 API 触及速率限制 |
| `status: 401` | API key 无效或缺失 |
| `context_length_exceeded` | 会话上下文超出模型限制 |
| `connect ECONNREFUSED` | MCP 服务器未运行 |
| `invalid JSON in response` | MCP 服务器端点 URL 配置错误 |
| `write: broken pipe` | 客户端断开连接（检查负载均衡器超时） |
| `clean_close: false` | WebSocket 非正常终止 |
| `Session evicted` | 会话存储已满 |
| `queue_wait_ms > 1000` | Worker 池饱和，需要更大容量 |

---

## 结语

调试分布式系统从来都不完全是系统化的——总有一行日志你看不懂，或者一个时序问题直到你同时看三件事才说得通。但是 OpenClaw 的日志基础设施给你提供了足够的信号，让你无需英雄主义就能找到大多数故障的根因。

让我最省时间的习惯：生产环境永远使用结构化 JSON 日志，永远先检查 `trace_id`，以及在责怪 OpenClaw 的路由逻辑之前先隔离测试模型后端和 MCP 服务器。大多数时候问题比看起来简单，而且你会在第一个 `jq` 查询里找到它。

如果你在构建自定义 MCP 服务器并遇到不明原因的故障，[MCP 服务器指南](/blog/building-custom-mcp-servers-openclaw) 涵盖了最容易让人踩坑的协议层细节。如果你的模型后端是 DeepSeek 并且遇到意外延迟，[DeepSeek 配置指南](/blog/openclaw-deepseek-low-cost) 涵盖了能提供帮助的推理侧调优内容。

祝你好运。愿你的 `trace_id` 永远通向有用的地方。
