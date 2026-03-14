---
title: "Debugging OpenClaw: Logs, Request Traces, and Root Cause Analysis"
description: "Systematic guide to diagnosing OpenClaw problems: how to read logs, trace requests, identify model API errors, debug MCP server failures, and fix the most common production issues."
publishedAt: 2026-03-18
status: published
visibility: public
---

# Debugging OpenClaw: Logs, Request Traces, and Root Cause Analysis

I've spent more time than I'd like to admit staring at OpenClaw log output in a terminal at 11pm, trying to figure out why a deployment that worked fine in staging is silently dropping requests in production. The good news: OpenClaw's observability story is actually pretty solid once you know where to look. The bad news: if you don't know the patterns, the logs can feel like a wall of noise.

This guide is everything I wish I'd had when I first started debugging OpenClaw seriously. We'll go through how to read logs, how to trace a request from client to model backend and back, and how to diagnose the failures I've hit most often.

---

## Enabling Debug Mode

Before anything else, you need logs that are actually useful. OpenClaw's default log level (`info`) tells you that things are happening but not *why* they're failing.

Set the log level to `debug` in your config:

```yaml
# openclaw.config.yaml
logging:
  level: debug
  format: json        # structured JSON — much easier to parse
  output: stdout      # or a file path
  include_request_body: true   # WARNING: this logs API keys in headers if you're not careful
  trace_id: true      # attach a trace ID to every request
```

Or via environment variable if you don't want to touch the config file:

```bash
OPENCLAW_LOG_LEVEL=debug OPENCLAW_LOG_FORMAT=json ./openclaw serve
```

The difference between `info` and `debug` output is dramatic. At `info` level you get:

```
2026-03-18T09:12:44Z INFO  Request completed status=200 duration=1.2s
```

At `debug` level you get the full request lifecycle, including model selection, token counting, MCP server dispatch, and response assembly. That's what you need for real diagnosis.

**One important note on `include_request_body`:** I keep this off in production and only enable it when actively debugging. The request body includes user messages, which might contain sensitive data. Enable it temporarily, reproduce the issue, then turn it off again.

---

## Understanding Structured Log Output

OpenClaw emits structured JSON logs when `format: json` is set. Each log line is a valid JSON object. Here's what a normal request cycle looks like:

```json
{"ts":"2026-03-18T09:12:44.001Z","level":"debug","msg":"Request received","trace_id":"req_a4f9b2","method":"POST","path":"/v1/chat","client_ip":"10.0.1.15"}
{"ts":"2026-03-18T09:12:44.003Z","level":"debug","msg":"Session resolved","trace_id":"req_a4f9b2","session_id":"sess_7c3d1a","context_tokens":4821,"context_limit":128000}
{"ts":"2026-03-18T09:12:44.004Z","level":"debug","msg":"Model selected","trace_id":"req_a4f9b2","model":"deepseek-r1","backend":"deepseek","routing_reason":"default"}
{"ts":"2026-03-18T09:12:44.005Z","level":"debug","msg":"MCP dispatch begin","trace_id":"req_a4f9b2","servers":["filesystem","search"],"tool_calls_pending":0}
{"ts":"2026-03-18T09:12:44.006Z","level":"debug","msg":"Model request sent","trace_id":"req_a4f9b2","backend":"deepseek","prompt_tokens":4821,"temperature":0.7}
{"ts":"2026-03-18T09:12:46.312Z","level":"debug","msg":"Model response received","trace_id":"req_a4f9b2","completion_tokens":387,"finish_reason":"stop","latency_ms":2306}
{"ts":"2026-03-18T09:12:46.313Z","level":"info","msg":"Request completed","trace_id":"req_a4f9b2","status":200,"duration_ms":2312}
```

Every log line shares a `trace_id` (`req_a4f9b2` above). This is your primary tool for following a single request through the system. When something goes wrong, grep for the trace ID and you get the full story.

```bash
# Follow a specific request
grep "req_a4f9b2" /var/log/openclaw/app.log | jq '.'

# Find all failed requests in the last hour
cat /var/log/openclaw/app.log | jq 'select(.level == "error") | select(.ts > "2026-03-18T08:00:00Z")'

# Find slow requests (over 5 seconds)
cat /var/log/openclaw/app.log | jq 'select(.duration_ms > 5000)'
```

If you're not already comfortable with `jq`, learn the basics. It transforms structured log analysis from painful to fast.

---

## Using the Built-in Trace Viewer

OpenClaw ships with a web-based trace viewer at `http://localhost:8080/debug/traces` (available when the admin interface is enabled). This gives you a waterfall view of request timing — similar to a browser network panel but for your AI request pipeline.

To enable it:

```yaml
admin:
  enabled: true
  port: 8080
  bind: 127.0.0.1   # don't expose this publicly
  trace_retention: 500   # keep last 500 traces in memory
```

The trace viewer is most useful when you have a latency problem you can reproduce. You can see exactly where time is spent: session lookup, model API call, MCP tool execution, response streaming. I've used it to find a case where a custom MCP server was adding 800ms of latency on every request because it was doing a cold DNS lookup on each call — not obvious from the log timestamps alone, but obvious in the waterfall.

The viewer also shows you the full request and response payloads for any stored trace, which is useful for catching prompt construction bugs without enabling `include_request_body` system-wide.

---

## Failure Scenario 1: Model API Errors

These are the failures you'll hit most often, and they break down into a few distinct categories.

### Rate Limit Errors

Log signature:

```json
{"ts":"2026-03-18T10:45:22Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","retry_after":60,"attempt":1}
{"ts":"2026-03-18T10:45:22Z","level":"warn","msg":"Backing off before retry","trace_id":"req_c8e2d1","backoff_ms":5000,"attempt":1}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","attempt":2}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Request failed after max retries","trace_id":"req_c8e2d1","attempts":2,"final_status":429}
```

The dead giveaway is `status: 429`. OpenClaw will retry with backoff by default, but if your rate limits are consistently being hit, retries just delay the failure.

**Diagnosis:** Check how many concurrent users or automated processes are hitting OpenClaw at once. Rate limit errors cluster in time — you'll see a burst of them together, not randomly distributed.

```bash
# Count 429 errors by minute
cat /var/log/openclaw/app.log | jq -r 'select(.status == 429) | .ts[0:16]' | sort | uniq -c
```

**Fix:** Configure backend-specific rate limit settings in OpenClaw, or set up multiple API keys and enable round-robin routing:

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

### Authentication Failures

Log signature:

```json
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Model API error","trace_id":"req_f1a9c3","backend":"anthropic","status":401,"error":"Invalid API key"}
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Authentication failed — check API key config","trace_id":"req_f1a9c3","backend":"anthropic"}
```

A 401 is unambiguous: the API key is wrong, expired, or missing. The confusing version of this is when it works for some requests and fails for others — this usually means you have multiple backends configured and one has an invalid key.

**Curl test to isolate the backend:**

```bash
# Test the model backend directly, bypassing OpenClaw
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

If this returns a valid response, the key is fine and the problem is in OpenClaw's config. If it returns 401, you've found your issue.

### Context Length Exceeded

Log signature:

```json
{"ts":"2026-03-18T11:15:43Z","level":"error","msg":"Model API error","trace_id":"req_b7d2e4","backend":"deepseek","status":400,"error":"context_length_exceeded","detail":"max_tokens 128000, requested 134521"}
{"ts":"2026-03-18T11:15:43Z","level":"warn","msg":"Context exceeded model limit","trace_id":"req_b7d2e4","context_tokens":134521,"model_limit":128000,"session_id":"sess_9a4b7c"}
```

This one is subtle because it correlates with session length, not individual request size. A conversation that has been running for a while accumulates context until it hits the model's limit.

**Diagnosis:** Look at the `context_tokens` field across requests for the same `session_id`. When you see it approaching the model's limit, it'll fail soon.

**Fix:** Enable automatic context truncation or summarization in your session config:

```yaml
sessions:
  context_management:
    strategy: truncate_oldest    # or "summarize" if you have a summarization model configured
    max_context_tokens: 120000   # leave a buffer below the model's actual limit
    warn_at_tokens: 100000
```

---

## Failure Scenario 2: MCP Server Connection Failures

If you're running custom MCP servers (see the [MCP servers guide](/blog/building-custom-mcp-servers-openclaw)), you'll eventually see them fail. The symptoms vary: tools that don't execute, silent timeouts, or errors that bubble up to the user as "tool not available."

### Connection Refused

Log signature:

```json
{"ts":"2026-03-18T12:30:15Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":1}
{"ts":"2026-03-18T12:30:15Z","level":"warn","msg":"MCP server marked unhealthy","server":"my-custom-tools","consecutive_failures":1}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":2}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server unavailable — tool calls will fail","server":"my-custom-tools","consecutive_failures":2}
```

`ECONNREFUSED` means the process at the configured port isn't running, or is listening on a different port. First thing to check:

```bash
# Is the MCP server process running?
ps aux | grep my-custom-tools

# Is something listening on the expected port?
lsof -i :9001

# Can OpenClaw reach it? (from the same host)
curl -v http://127.0.0.1:9001/health
```

### MCP Protocol Errors

Harder to diagnose. These happen when the MCP server process is running but returning malformed responses:

```json
{"ts":"2026-03-18T13:05:22Z","level":"error","msg":"MCP protocol error","trace_id":"req_d4a7b9","server":"filesystem","error":"invalid JSON in response","raw_response":"<html>404 Not Found</html>"}
{"ts":"2026-03-18T13:05:22Z","level":"debug","msg":"MCP server response dump","server":"filesystem","response_bytes":27,"content_type":"text/html"}
```

The `raw_response` field tells you exactly what the server returned. An HTML 404 page in a JSON field means you've misconfigured the endpoint URL — you're probably hitting an nginx proxy instead of the MCP server directly.

```bash
# Test the MCP server's tool listing directly
curl -X POST http://127.0.0.1:9001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

A healthy MCP server returns a JSON-RPC response with your tool definitions. Anything else indicates a problem at the server level.

### MCP Timeout

```json
{"ts":"2026-03-18T13:45:01Z","level":"warn","msg":"MCP tool call timed out","trace_id":"req_a2c8d5","server":"search","tool":"web_search","timeout_ms":10000,"elapsed_ms":10003}
{"ts":"2026-03-18T13:45:01Z","level":"error","msg":"Tool call failed","trace_id":"req_a2c8d5","server":"search","tool":"web_search","error":"timeout"}
```

The tool call hit the configured timeout. This usually means the MCP server is doing something slow — an external HTTP call, a database query, or just being overloaded.

**Fix:** Increase the timeout for that specific server if the operation is inherently slow, and add internal timeouts within your MCP server so it fails fast rather than hanging:

```yaml
mcp_servers:
  search:
    url: http://localhost:9002
    timeout_ms: 30000    # increase from default 10s
    retry:
      attempts: 2
      delay_ms: 1000
```

---

## Failure Scenario 3: WebSocket Disconnects During Streaming

Streaming responses via WebSocket is where things get unpredictable, especially under load. The failure mode is usually that the client sees the connection drop mid-response, which manifests as a truncated message with no error.

Log signature on the server side:

```json
{"ts":"2026-03-18T14:20:33Z","level":"debug","msg":"WebSocket stream started","trace_id":"req_g9h1i2","client_ip":"10.0.1.22","session_id":"sess_3e7f2b"}
{"ts":"2026-03-18T14:20:41Z","level":"warn","msg":"WebSocket write error","trace_id":"req_g9h1i2","error":"write: broken pipe","bytes_sent":12840,"completion_pct":67}
{"ts":"2026-03-18T14:20:41Z","level":"info","msg":"WebSocket connection closed (client disconnect)","trace_id":"req_g9h1i2","clean_close":false}
```

`broken pipe` and `clean_close: false` tell you the client dropped the connection — OpenClaw didn't close it. The common causes:

**Load balancer timeout:** Your LB has a shorter timeout than OpenClaw's stream duration. Check your LB idle connection timeout. For nginx:

```nginx
proxy_read_timeout 120s;    # must be longer than your longest expected response
proxy_send_timeout 120s;
```

**Client-side timeout:** The browser or client app has a request timeout that fires before the stream completes. Less common but it happens.

**Network instability:** If you see broken pipe errors clustering at specific times, correlate with your network monitoring.

To tell the difference between a client drop and a server-side error, look at `clean_close`. If it's `false` and there's no preceding error from OpenClaw, the client bailed. If there's a model error or an OOM event before the connection close, the server is the culprit.

---

## Failure Scenario 4: High Latency

High latency is the most frustrating failure because the system technically works — it just works slowly. The trace viewer helps enormously here, but you can also do this from logs.

A high-latency request where the model itself was fast but MCP was slow:

```json
{"ts":"2026-03-18T15:10:01Z","level":"debug","msg":"Model request sent","trace_id":"req_k3l5m7","latency_checkpoint":"model_start"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"Model response received","trace_id":"req_k3l5m7","latency_ms":2100,"latency_checkpoint":"model_end"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"MCP tool call begin","trace_id":"req_k3l5m7","server":"database","tool":"query_records"}
{"ts":"2026-03-18T15:10:11Z","level":"debug","msg":"MCP tool call complete","trace_id":"req_k3l5m7","server":"database","tool":"query_records","latency_ms":8200}
{"ts":"2026-03-18T15:10:11Z","level":"info","msg":"Request completed","trace_id":"req_k3l5m7","duration_ms":10350}
```

The model took 2.1 seconds. The database MCP tool took 8.2 seconds. Total: 10.35 seconds. The bottleneck is obvious once you have per-segment timing.

Other high-latency causes I've seen:
- **Session deserialization:** A session with a huge context being loaded from Redis on every request. Fix: check your serialization format and consider caching deserialized sessions in memory.
- **Cold model routing:** First request to a backend takes longer while the connection pool warms up. Fix: configure keepalive connections.
- **Queuing under load:** Requests wait behind other requests. Fix: add more workers or horizontal scaling. You'll see this as high `queue_wait_ms` in the logs.

If you're on [DeepSeek with local routing](/blog/openclaw-deepseek-low-cost), high latency often means the inference node is under GPU memory pressure — check your `nvidia-smi` or equivalent metrics alongside the OpenClaw timing data.

---

## Failure Scenario 5: Memory and Session Issues

OpenClaw sessions are relatively lightweight, but if you have long-running sessions with large contexts, memory can become a problem.

Signs of session memory pressure:

```json
{"ts":"2026-03-18T16:00:02Z","level":"warn","msg":"Session store near capacity","active_sessions":4821,"max_sessions":5000,"memory_mb":1840}
{"ts":"2026-03-18T16:00:15Z","level":"error","msg":"Session evicted under memory pressure","session_id":"sess_8b2e9d","age_minutes":47,"context_tokens":98000}
{"ts":"2026-03-18T16:00:15Z","level":"warn","msg":"Client will receive session expired error","session_id":"sess_8b2e9d"}
```

A session getting evicted means the next request from that user will appear as a fresh conversation — their history is gone. This is confusing to users and a sign that your session capacity is too low or your sessions are holding too much context.

**Fix:** Lower context limits per session, enable Redis persistence so evicted sessions can be restored, or increase the memory limit:

```yaml
sessions:
  max_active: 10000
  store: redis              # persistent, avoids in-memory pressure
  redis_url: redis://localhost:6379
  max_context_tokens: 50000  # more aggressive limit per session
  idle_timeout_minutes: 60   # evict idle sessions sooner
```

---

## Systematic Troubleshooting Checklist

When I get a new bug report, I work through this in order:

1. **Get the trace ID.** If the user reports a failure, check if OpenClaw returns a `X-Trace-Id` header in the response. If so, grep for it immediately.

2. **Check the log level.** If you're at `info` level, temporarily bump to `debug` and reproduce the issue. You can't diagnose what you can't see.

3. **Identify the failure type from the error log.** Is it a 4xx from the model API? A connection error from an MCP server? A protocol-level disconnect?

4. **Isolate the model backend.** Use curl to test the model API directly (see the 401 section above). This tells you whether OpenClaw or the backend is the problem.

5. **Isolate MCP servers.** If MCP tool calls are involved, test each MCP server directly with `curl`. Healthy servers respond correctly to a `tools/list` call.

6. **Check timing.** If latency is the issue, use the trace viewer or `jq` to compare per-segment timing. Find where time is actually being spent.

7. **Check session state.** If users are losing conversation history or getting unexpected resets, look for session eviction warnings and check your session store health.

8. **Check resource utilization.** OOM kills, CPU spikes, and GPU memory pressure all cause cascading failures. Correlate your system metrics with the timing of failures in the logs.

9. **Review recent config changes.** Most production failures I've investigated trace back to a config change that seemed minor. Check your git diff for the config files.

10. **Reproduce in isolation.** Before writing a fix, make sure you can reproduce the problem consistently. Use curl or a simple script to fire the exact request that's failing.

---

## Quick Reference: Log Patterns and What They Mean

| Log message | Likely cause |
|---|---|
| `status: 429` | Rate limit hit on model API |
| `status: 401` | Invalid or missing API key |
| `context_length_exceeded` | Session context too large for model |
| `connect ECONNREFUSED` | MCP server not running |
| `invalid JSON in response` | Wrong endpoint URL for MCP server |
| `write: broken pipe` | Client disconnected (check LB timeout) |
| `clean_close: false` | Unclean WebSocket termination |
| `Session evicted` | Session store at capacity |
| `queue_wait_ms > 1000` | Worker pool saturated, need more capacity |

---

## Final Thoughts

Debugging distributed systems is never fully systematic — there's always a log line you don't understand or a timing issue that doesn't make sense until you look at three things at once. But OpenClaw's logging infrastructure gives you enough signal to find the root cause of most failures without heroics.

The habits that have saved me the most time: always use structured JSON logging in production, always check the `trace_id` first, and test model backends and MCP servers in isolation before blaming OpenClaw's routing logic. Most of the time the problem is simpler than it looks, and you'll find it in the first `jq` query.

If you're building custom MCP servers and hitting unexplained failures, the [MCP servers guide](/blog/building-custom-mcp-servers-openclaw) covers the protocol-level details that trip people up most often. If your model backend is DeepSeek and you're seeing unexpected latency, the [DeepSeek setup guide](/blog/openclaw-deepseek-low-cost) covers inference-side tuning that can help.

Good luck. May your `trace_id` always lead somewhere useful.
