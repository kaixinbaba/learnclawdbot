---
title: "OpenClaw 디버깅 완전 가이드: 로그 해석, 요청 추적, 근본 원인 분석"
description: "OpenClaw 문제를 체계적으로 진단하는 가이드: 로그 읽는 법, 요청 추적, 모델 API 오류 식별, MCP 서버 장애 디버깅, 가장 흔한 프로덕션 문제 수정 방법."
publishedAt: 2026-03-18
status: published
visibility: public
---

# OpenClaw 디버깅 완전 가이드: 로그 해석, 요청 추적, 근본 원인 분석

밤 11시에 터미널에서 OpenClaw 로그 출력을 멍하니 바라보며 보낸 시간이 인정하고 싶은 것보다 훨씬 많다. 스테이징 환경에서는 잘 동작하던 배포가 프로덕션에서 왜 조용히 요청을 드롭하는지 파악하려 했던 것이다. 좋은 소식은 어디를 봐야 할지만 알면 OpenClaw의 관측 가능성이 꽤 탄탄하다는 것이다. 나쁜 소식은 패턴을 모르면 로그가 노이즈의 벽처럼 느껴진다는 것이다.

이 가이드는 내가 OpenClaw를 본격적으로 디버깅하기 시작했을 때 처음부터 가지고 있었으면 했던 모든 것을 담았다. 로그 읽는 법, 클라이언트에서 모델 백엔드를 거쳐 돌아오는 요청 추적 방법, 그리고 내가 가장 자주 만나는 장애를 진단하는 방법을 단계별로 다룬다.

---

## 디버그 모드 활성화

무엇보다 먼저, 실제로 유용한 로그가 필요하다. OpenClaw의 기본 로그 레벨(`info`)은 무언가가 일어나고 있다는 것만 알려주고, *왜* 실패하는지는 알려주지 않는다.

설정 파일에서 로그 레벨을 `debug`로 설정한다:

```yaml
# openclaw.config.yaml
logging:
  level: debug
  format: json        # 구조화된 JSON — 파싱이 훨씬 쉽다
  output: stdout      # 또는 파일 경로
  include_request_body: true   # 경고: 부주의하면 헤더에 API 키가 기록될 수 있다
  trace_id: true      # 모든 요청에 trace ID 첨부
```

설정 파일을 건드리고 싶지 않다면 환경 변수로 설정할 수 있다:

```bash
OPENCLAW_LOG_LEVEL=debug OPENCLAW_LOG_FORMAT=json ./openclaw serve
```

`info`와 `debug` 출력의 차이는 극적이다. `info` 레벨에서는 이것만 보인다:

```
2026-03-18T09:12:44Z INFO  Request completed status=200 duration=1.2s
```

`debug` 레벨에서는 모델 선택, 토큰 계산, MCP 서버 디스패치, 응답 조립을 포함한 완전한 요청 생명 주기를 볼 수 있다. 진짜 진단에 필요한 것이 바로 그것이다.

**`include_request_body`에 관한 중요한 참고:** 나는 프로덕션에서는 꺼두고 적극적으로 디버깅할 때만 활성화한다. 요청 본문에는 사용자 메시지가 포함되어 있어 민감한 데이터가 들어 있을 수 있다. 일시적으로 활성화하고, 문제를 재현하고, 그 다음에 다시 끈다.

---

## 구조화된 로그 출력 이해하기

`format: json`을 설정하면 OpenClaw는 구조화된 JSON 로그를 출력한다. 각 로그 행은 유효한 JSON 객체다. 정상적인 요청 주기는 다음과 같다:

```json
{"ts":"2026-03-18T09:12:44.001Z","level":"debug","msg":"Request received","trace_id":"req_a4f9b2","method":"POST","path":"/v1/chat","client_ip":"10.0.1.15"}
{"ts":"2026-03-18T09:12:44.003Z","level":"debug","msg":"Session resolved","trace_id":"req_a4f9b2","session_id":"sess_7c3d1a","context_tokens":4821,"context_limit":128000}
{"ts":"2026-03-18T09:12:44.004Z","level":"debug","msg":"Model selected","trace_id":"req_a4f9b2","model":"deepseek-r1","backend":"deepseek","routing_reason":"default"}
{"ts":"2026-03-18T09:12:44.005Z","level":"debug","msg":"MCP dispatch begin","trace_id":"req_a4f9b2","servers":["filesystem","search"],"tool_calls_pending":0}
{"ts":"2026-03-18T09:12:44.006Z","level":"debug","msg":"Model request sent","trace_id":"req_a4f9b2","backend":"deepseek","prompt_tokens":4821,"temperature":0.7}
{"ts":"2026-03-18T09:12:46.312Z","level":"debug","msg":"Model response received","trace_id":"req_a4f9b2","completion_tokens":387,"finish_reason":"stop","latency_ms":2306}
{"ts":"2026-03-18T09:12:46.313Z","level":"info","msg":"Request completed","trace_id":"req_a4f9b2","status":200,"duration_ms":2312}
```

모든 로그 행은 `trace_id`(위의 `req_a4f9b2`)를 공유한다. 이것이 단일 요청이 시스템을 통과하는 과정을 추적하는 주요 도구다. 문제가 생기면 trace ID로 grep하면 전체 경위를 알 수 있다.

```bash
# 특정 요청 추적
grep "req_a4f9b2" /var/log/openclaw/app.log | jq '.'

# 지난 한 시간의 실패한 요청 모두 찾기
cat /var/log/openclaw/app.log | jq 'select(.level == "error") | select(.ts > "2026-03-18T08:00:00Z")'

# 느린 요청(5초 초과) 찾기
cat /var/log/openclaw/app.log | jq 'select(.duration_ms > 5000)'
```

`jq`에 익숙하지 않다면 기본 사용법을 배워라. 구조화된 로그 분석이 고통스러운 작업에서 효율적인 작업으로 바뀐다.

---

## 내장 Trace 뷰어 사용하기

OpenClaw에는 `http://localhost:8080/debug/traces`에서 접근할 수 있는 웹 기반 trace 뷰어가 포함되어 있다(관리 인터페이스가 활성화된 경우). 이는 요청 타이밍의 폭포수 뷰를 제공한다. 브라우저 네트워크 패널과 유사하지만 AI 요청 파이프라인용이다.

활성화 방법:

```yaml
admin:
  enabled: true
  port: 8080
  bind: 127.0.0.1   # 공개적으로 노출하지 않는다
  trace_retention: 500   # 최근 500개의 trace를 메모리에 유지
```

trace 뷰어는 재현할 수 있는 지연 시간 문제가 있을 때 가장 유용하다. 세션 조회, 모델 API 호출, MCP 도구 실행, 응답 스트리밍 중 어디서 시간이 소비되는지 정확히 확인할 수 있다. 커스텀 MCP 서버가 각 호출 시 콜드 DNS 조회를 수행해 모든 요청에 800ms의 지연을 추가하고 있던 케이스를 이것으로 찾은 적이 있다. 로그 타임스탬프만으로는 명확하지 않았지만 폭포수에서는 바로 보였다.

뷰어는 저장된 모든 trace의 완전한 요청 및 응답 페이로드도 보여주므로, `include_request_body`를 전체 시스템에서 활성화하지 않고도 프롬프트 구성 버그를 잡는 데 유용하다.

---

## 장애 시나리오 1: 모델 API 오류

가장 자주 만나는 장애이며 몇 가지 뚜렷한 범주로 나뉜다.

### 속도 제한 오류

로그 특징:

```json
{"ts":"2026-03-18T10:45:22Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","retry_after":60,"attempt":1}
{"ts":"2026-03-18T10:45:22Z","level":"warn","msg":"Backing off before retry","trace_id":"req_c8e2d1","backoff_ms":5000,"attempt":1}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","attempt":2}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Request failed after max retries","trace_id":"req_c8e2d1","attempts":2,"final_status":429}
```

`status: 429`가 명확한 신호다. OpenClaw는 기본적으로 백오프하며 재시도하지만, 속도 제한이 지속적으로 걸리면 재시도는 실패를 지연시킬 뿐이다.

**진단:** 동시에 OpenClaw에 접근하는 동시 사용자나 자동화 프로세스 수를 확인한다. 속도 제한 오류는 시간적으로 집중되어 나타난다. 무작위로 분산되지 않고 묶음으로 보인다.

```bash
# 429 오류를 분 단위로 카운트
cat /var/log/openclaw/app.log | jq -r 'select(.status == 429) | .ts[0:16]' | sort | uniq -c
```

**수정:** OpenClaw에서 백엔드별 속도 제한 설정을 구성하거나, 여러 API 키를 설정하고 라운드 로빈 라우팅을 활성화한다:

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

### 인증 실패

로그 특징:

```json
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Model API error","trace_id":"req_f1a9c3","backend":"anthropic","status":401,"error":"Invalid API key"}
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Authentication failed — check API key config","trace_id":"req_f1a9c3","backend":"anthropic"}
```

401은 명확하다: API 키가 잘못되었거나, 만료되었거나, 없는 것이다. 혼란스러운 버전은 일부 요청은 성공하고 다른 요청은 실패할 때다. 이는 보통 여러 백엔드가 설정되어 있고 그 중 하나에 잘못된 키가 있다는 의미다.

**백엔드를 격리하는 curl 테스트:**

```bash
# OpenClaw를 우회하여 모델 백엔드를 직접 테스트
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

유효한 응답이 오면 키는 문제없고, 문제는 OpenClaw 설정에 있다. 401이 오면 문제를 찾은 것이다.

### 컨텍스트 길이 초과

로그 특징:

```json
{"ts":"2026-03-18T11:15:43Z","level":"error","msg":"Model API error","trace_id":"req_b7d2e4","backend":"deepseek","status":400,"error":"context_length_exceeded","detail":"max_tokens 128000, requested 134521"}
{"ts":"2026-03-18T11:15:43Z","level":"warn","msg":"Context exceeded model limit","trace_id":"req_b7d2e4","context_tokens":134521,"model_limit":128000,"session_id":"sess_9a4b7c"}
```

이것은 미묘한데, 개별 요청 크기가 아닌 세션 길이와 상관관계가 있기 때문이다. 한동안 진행된 대화는 모델의 제한에 도달할 때까지 컨텍스트를 계속 쌓는다.

**진단:** 같은 `session_id`에 대한 요청 간 `context_tokens` 필드를 확인한다. 모델 제한에 가까워지는 것이 보이면 곧 실패한다.

**수정:** 세션 설정에서 자동 컨텍스트 자르기 또는 요약을 활성화한다:

```yaml
sessions:
  context_management:
    strategy: truncate_oldest    # 또는 요약 모델이 설정된 경우 "summarize"
    max_context_tokens: 120000   # 모델의 실제 제한보다 낮게 버퍼 유지
    warn_at_tokens: 100000
```

---

## 장애 시나리오 2: MCP 서버 연결 실패

커스텀 MCP 서버를 실행하고 있다면([MCP 서버 가이드](/blog/building-custom-mcp-servers-openclaw) 참조), 언젠가는 장애를 만난다. 증상은 다양하다: 실행되지 않는 도구, 무음 타임아웃, 또는 "도구 사용 불가"로 사용자에게 나타나는 오류.

### 연결 거부

로그 특징:

```json
{"ts":"2026-03-18T12:30:15Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":1}
{"ts":"2026-03-18T12:30:15Z","level":"warn","msg":"MCP server marked unhealthy","server":"my-custom-tools","consecutive_failures":1}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":2}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server unavailable — tool calls will fail","server":"my-custom-tools","consecutive_failures":2}
```

`ECONNREFUSED`는 설정된 포트에서 프로세스가 실행되고 있지 않거나, 다른 포트에서 수신 대기 중임을 의미한다. 먼저 확인할 것:

```bash
# MCP 서버 프로세스가 실행 중인가?
ps aux | grep my-custom-tools

# 예상 포트에서 수신 대기 중인 것이 있는가?
lsof -i :9001

# OpenClaw에서 접근할 수 있는가? (같은 호스트에서)
curl -v http://127.0.0.1:9001/health
```

### MCP 프로토콜 오류

진단하기 더 어렵다. MCP 서버 프로세스는 실행 중이지만 잘못된 형식의 응답을 반환할 때 발생한다:

```json
{"ts":"2026-03-18T13:05:22Z","level":"error","msg":"MCP protocol error","trace_id":"req_d4a7b9","server":"filesystem","error":"invalid JSON in response","raw_response":"<html>404 Not Found</html>"}
{"ts":"2026-03-18T13:05:22Z","level":"debug","msg":"MCP server response dump","server":"filesystem","response_bytes":27,"content_type":"text/html"}
```

`raw_response` 필드가 서버가 실제로 무엇을 반환했는지 알려준다. JSON 필드 안에 HTML 404 페이지가 있다면 엔드포인트 URL 설정이 잘못된 것이다. MCP 서버에 직접 접근하는 것이 아니라 nginx 프록시에 접근하고 있을 가능성이 높다.

```bash
# MCP 서버의 도구 목록을 직접 테스트
curl -X POST http://127.0.0.1:9001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

정상적인 MCP 서버는 도구 정의가 담긴 JSON-RPC 응답을 반환한다. 그 외의 것은 서버 수준의 문제를 나타낸다.

### MCP 타임아웃

```json
{"ts":"2026-03-18T13:45:01Z","level":"warn","msg":"MCP tool call timed out","trace_id":"req_a2c8d5","server":"search","tool":"web_search","timeout_ms":10000,"elapsed_ms":10003}
{"ts":"2026-03-18T13:45:01Z","level":"error","msg":"Tool call failed","trace_id":"req_a2c8d5","server":"search","tool":"web_search","error":"timeout"}
```

도구 호출이 설정된 타임아웃에 도달했다. 이는 보통 MCP 서버가 느린 작업을 하고 있다는 의미다. 외부 HTTP 호출, 데이터베이스 쿼리, 또는 단순히 과부하 상태.

**수정:** 해당 작업이 본질적으로 느리면 해당 서버의 타임아웃을 늘리고, MCP 서버 내부에 타임아웃을 추가해 멈추지 않고 빠르게 실패하도록 한다:

```yaml
mcp_servers:
  search:
    url: http://localhost:9002
    timeout_ms: 30000    # 기본 10s에서 증가
    retry:
      attempts: 2
      delay_ms: 1000
```

---

## 장애 시나리오 3: 스트리밍 중 WebSocket 연결 끊김

WebSocket을 통한 응답 스트리밍은 특히 고부하에서 예측하기 어려운 부분이다. 실패 모드는 보통 클라이언트가 응답 중간에 연결이 끊기는 것을 보는 것이며, 오류 없이 메시지가 잘린 형태로 나타난다.

서버 측 로그 특징:

```json
{"ts":"2026-03-18T14:20:33Z","level":"debug","msg":"WebSocket stream started","trace_id":"req_g9h1i2","client_ip":"10.0.1.22","session_id":"sess_3e7f2b"}
{"ts":"2026-03-18T14:20:41Z","level":"warn","msg":"WebSocket write error","trace_id":"req_g9h1i2","error":"write: broken pipe","bytes_sent":12840,"completion_pct":67}
{"ts":"2026-03-18T14:20:41Z","level":"info","msg":"WebSocket connection closed (client disconnect)","trace_id":"req_g9h1i2","clean_close":false}
```

`broken pipe`와 `clean_close: false`는 클라이언트가 연결을 끊었다는 것을 알려준다. OpenClaw가 닫은 것이 아니다. 흔한 원인들:

**로드 밸런서 타임아웃:** 로드 밸런서의 타임아웃이 OpenClaw 스트림 기간보다 짧다. 로드 밸런서의 유휴 연결 타임아웃을 확인한다. nginx의 경우:

```nginx
proxy_read_timeout 120s;    # 예상되는 가장 긴 응답 시간보다 길어야 한다
proxy_send_timeout 120s;
```

**클라이언트 측 타임아웃:** 브라우저 또는 클라이언트 앱의 요청 타임아웃이 스트림 완료 전에 발생한다. 흔하지는 않지만 일어난다.

**네트워크 불안정:** broken pipe 오류가 특정 시간에 집중되어 나타나면 네트워크 모니터링과 연관지어 분석한다.

클라이언트 연결 끊김과 서버 측 오류를 구별하려면 `clean_close`를 확인한다. 값이 `false`이고 OpenClaw의 선행 오류가 없으면, 클라이언트가 포기한 것이다. 연결 종료 이전에 모델 오류나 OOM 이벤트가 있다면 서버가 원인이다.

---

## 장애 시나리오 4: 높은 지연 시간

높은 지연 시간은 가장 좌절스러운 장애인데, 시스템이 기술적으로는 동작하고 있기 때문이다. 그냥 느릴 뿐이다. trace 뷰어가 여기서 크게 도움이 되지만, 로그만으로도 분석할 수 있다.

모델 자체는 빠르지만 MCP가 느렸던 높은 지연 시간 요청:

```json
{"ts":"2026-03-18T15:10:01Z","level":"debug","msg":"Model request sent","trace_id":"req_k3l5m7","latency_checkpoint":"model_start"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"Model response received","trace_id":"req_k3l5m7","latency_ms":2100,"latency_checkpoint":"model_end"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"MCP tool call begin","trace_id":"req_k3l5m7","server":"database","tool":"query_records"}
{"ts":"2026-03-18T15:10:11Z","level":"debug","msg":"MCP tool call complete","trace_id":"req_k3l5m7","server":"database","tool":"query_records","latency_ms":8200}
{"ts":"2026-03-18T15:10:11Z","level":"info","msg":"Request completed","trace_id":"req_k3l5m7","duration_ms":10350}
```

모델에 2.1초. 데이터베이스 MCP 도구에 8.2초. 합계: 10.35초. 세그먼트별 타이밍이 있으면 병목이 명확하다.

내가 겪은 다른 높은 지연 시간 원인들:
- **세션 역직렬화:** 대용량 컨텍스트를 가진 세션을 매 요청마다 Redis에서 로드한다. 수정: 직렬화 형식을 확인하고 역직렬화된 세션을 메모리에 캐싱하는 것을 고려한다.
- **모델 라우팅 콜드 스타트:** 백엔드로의 첫 번째 요청은 연결 풀 웜업 중 더 오래 걸린다. 수정: keepalive 연결을 설정한다.
- **고부하에서의 큐잉:** 요청이 다른 요청 뒤에서 대기한다. 수정: 워커를 추가하거나 수평 확장한다. 로그에서 높은 `queue_wait_ms`로 나타난다.

[DeepSeek로 로컬 라우팅을 사용하는 경우](/blog/openclaw-deepseek-low-cost), 높은 지연 시간은 종종 추론 노드가 GPU 메모리 압박을 받고 있다는 의미다. `nvidia-smi` 또는 동등한 메트릭을 OpenClaw 타이밍 데이터와 연관지어 확인한다.

---

## 장애 시나리오 5: 메모리와 세션 문제

OpenClaw 세션은 비교적 가볍지만, 대용량 컨텍스트를 가진 장기 실행 세션이 있으면 메모리가 문제가 될 수 있다.

세션 메모리 압박의 징후:

```json
{"ts":"2026-03-18T16:00:02Z","level":"warn","msg":"Session store near capacity","active_sessions":4821,"max_sessions":5000,"memory_mb":1840}
{"ts":"2026-03-18T16:00:15Z","level":"error","msg":"Session evicted under memory pressure","session_id":"sess_8b2e9d","age_minutes":47,"context_tokens":98000}
{"ts":"2026-03-18T16:00:15Z","level":"warn","msg":"Client will receive session expired error","session_id":"sess_8b2e9d"}
```

세션이 퇴출되면 해당 사용자의 다음 요청은 새로운 대화처럼 나타난다. 히스토리가 사라진다. 이는 사용자에게 혼란스럽고, 세션 용량이 너무 낮거나 세션이 너무 많은 컨텍스트를 보유하고 있다는 신호다.

**수정:** 세션당 컨텍스트 제한을 낮추고, 퇴출된 세션을 복원할 수 있도록 Redis 지속성을 활성화하거나, 메모리 제한을 늘린다:

```yaml
sessions:
  max_active: 10000
  store: redis              # 지속적, 메모리 압박 회피
  redis_url: redis://localhost:6379
  max_context_tokens: 50000  # 세션당 더 적극적인 제한
  idle_timeout_minutes: 60   # 유휴 세션을 더 빨리 퇴출
```

---

## 체계적인 문제 해결 체크리스트

새로운 버그 리포트를 받으면 이 순서로 처리한다:

1. **trace ID를 얻는다.** 사용자가 장애를 보고하면, OpenClaw가 응답에 `X-Trace-Id` 헤더를 반환하는지 확인한다. 있다면 즉시 grep한다.

2. **로그 레벨을 확인한다.** `info` 레벨이라면, 일시적으로 `debug`로 올리고 문제를 재현한다. 볼 수 없는 것은 진단할 수 없다.

3. **오류 로그에서 장애 유형을 파악한다.** 모델 API의 4xx인가? MCP 서버의 연결 오류인가? 프로토콜 수준의 연결 끊김인가?

4. **모델 백엔드를 격리한다.** curl을 사용해 모델 API를 직접 테스트한다(위의 401 섹션 참조). OpenClaw와 백엔드 중 어느 쪽이 문제인지 알 수 있다.

5. **MCP 서버를 격리한다.** MCP 도구 호출이 관련되어 있다면, curl을 사용해 각 MCP 서버를 직접 테스트한다. 정상적인 서버는 `tools/list` 호출에 올바르게 응답한다.

6. **타이밍을 확인한다.** 지연 시간이 문제라면, trace 뷰어나 `jq`를 사용해 세그먼트별 타이밍을 비교한다. 시간이 실제로 어디서 소비되는지 찾는다.

7. **세션 상태를 확인한다.** 사용자가 대화 히스토리를 잃거나 예상치 못한 리셋을 경험하고 있다면, 세션 퇴출 경고를 찾고 세션 스토어의 건강 상태를 확인한다.

8. **리소스 사용률을 확인한다.** OOM 킬, CPU 스파이크, GPU 메모리 압박은 모두 연쇄 장애를 일으킨다. 시스템 메트릭을 로그의 장애 타이밍과 연관지어 분석한다.

9. **최근 설정 변경을 검토한다.** 내가 조사한 대부분의 프로덕션 장애는 사소해 보이는 설정 변경으로 거슬러 올라간다. 설정 파일의 git diff를 확인한다.

10. **격리된 환경에서 재현한다.** 수정을 작성하기 전에 문제를 일관되게 재현할 수 있는지 확인한다. curl 또는 간단한 스크립트를 사용해 실패하는 정확한 요청을 발생시킨다.

---

## 빠른 참조: 로그 패턴과 그 의미

| 로그 메시지 | 가능한 원인 |
|---|---|
| `status: 429` | 모델 API 속도 제한 |
| `status: 401` | 잘못되거나 누락된 API 키 |
| `context_length_exceeded` | 세션 컨텍스트가 모델 제한 초과 |
| `connect ECONNREFUSED` | MCP 서버가 실행되지 않고 있음 |
| `invalid JSON in response` | MCP 서버 엔드포인트 URL 설정 오류 |
| `write: broken pipe` | 클라이언트가 연결을 끊음 (로드 밸런서 타임아웃 확인) |
| `clean_close: false` | WebSocket 비정상 종료 |
| `Session evicted` | 세션 스토어가 용량에 도달 |
| `queue_wait_ms > 1000` | 워커 풀이 포화, 더 많은 용량 필요 |

---

## 마치며

분산 시스템 디버깅이 완전히 체계적으로 되는 경우는 없다. 이해되지 않는 로그 행이 항상 있고, 세 가지를 동시에 볼 때까지 의미가 없는 타이밍 문제도 항상 있다. 하지만 OpenClaw의 로깅 인프라는 영웅적인 노력 없이도 대부분의 장애의 근본 원인을 찾는 데 충분한 신호를 제공한다.

내가 가장 시간을 절약하는 데 도움이 된 습관들: 프로덕션에서 항상 구조화된 JSON 로깅을 사용한다, 항상 먼저 `trace_id`를 확인한다, 그리고 OpenClaw의 라우팅 로직을 탓하기 전에 모델 백엔드와 MCP 서버를 격리해서 테스트한다. 대부분의 경우 문제는 보이는 것보다 단순하고, 첫 번째 `jq` 쿼리에서 찾게 된다.

커스텀 MCP 서버를 구축하면서 원인 불명의 장애를 겪고 있다면, [MCP 서버 가이드](/blog/building-custom-mcp-servers-openclaw)에서 사람들이 가장 많이 걸리는 프로토콜 수준의 세부 사항을 다룬다. 모델 백엔드가 DeepSeek이고 예상치 못한 지연 시간이 발생한다면, [DeepSeek 설정 가이드](/blog/openclaw-deepseek-low-cost)에서 도움이 될 추론 측 튜닝을 다룬다.

행운을 빈다. 당신의 `trace_id`가 언제나 유용한 곳으로 이어지길 바란다.
