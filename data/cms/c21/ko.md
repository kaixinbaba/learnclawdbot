---
title: "장시간 세션을 위한 OpenClaw 컨텍스트 관리 최적화"
description: "OpenClaw의 컨텍스트 윈도우, 메모리 전략, 세션 관리를 마스터하세요. 컨텍스트 한계에 부딪히지 않고 대규모 코드베이스, 긴 문서, 다중 세션 프로젝트에서 효과적으로 작업하는 방법을 배웁니다."
publishedAt: 2026-03-22
status: published
visibility: public
---

# 장시간 세션을 위한 OpenClaw 컨텍스트 관리 최적화

컨텍스트 윈도우는 AI 어시스턴트를 사용할 때 가장 중요한 리소스 제약입니다. 현재 작업에 대해 모델이 알고 있는 모든 것——대화 기록, 공유한 파일, 제공한 배경 정보——이 모두 그 안에 들어가야 합니다. 가득 차면 오래된 정보가 제거되고 모델은 대화의 흐름을 놓치기 시작합니다.

대부분의 사람들이 이 한계를 처음 경험하는 건 대규모 코드베이스 작업에서입니다. 파일을 여러 개 공유하고 복잡한 리팩토링을 요청하면, 어느 순간 모델이 처음에 설정했던 제약 조건들을 잊어버립니다. 품질이 저하되고 대화를 처음부터 다시 시작해야 합니다.

OpenClaw가 컨텍스트를 어떻게 관리하는지 이해하고, 그 관리 방식에 맞춰 작업하면 답답했던 컨텍스트 한계 문제를 해결 가능한 엔지니어링 문제로 바꿀 수 있습니다.

## OpenClaw의 컨텍스트 처리 방식

OpenClaw의 컨텍스트는 tokens를 소비하는 여러 구성 요소로 이루어집니다:

1. **시스템 프롬프트** — 모델의 동작 방식을 정의하는 지시사항 (OpenClaw가 설정하며, 사용자 설정으로 확장 가능)
2. **대화 기록** — 현재 세션의 모든 메시지
3. **로드한 파일** — `--files` 또는 파일 포함 방식으로 공유된 파일
4. **도구 호출 결과** — MCP 서버 및 OpenClaw 내장 도구의 응답
5. **주입된 컨텍스트** — `--context`로 명시적으로 로드한 배경 정보

이 모든 것의 합계가 모델의 컨텍스트 윈도우에 맞아야 합니다. 클라우드 모델의 경우:
- Claude 3.5 Sonnet: 200K tokens
- GPT-4o: 128K tokens
- Gemini 1.5 Pro: 1M tokens (단, 비용이 높음)

로컬 모델의 경우:
- 대부분의 7B-13B 모델: 8K-32K tokens
- Llama 3.1: 최대 128K
- Mistral: 버전에 따라 32K-64K

Token 수 대략적 계산: 1 token ≈ 영어 텍스트 4자. 일반적인 200줄 코드 파일은 약 2,000-4,000 tokens입니다.

## 현재 컨텍스트 사용량 확인하기

OpenClaw는 여러 방법으로 token 사용량을 표시합니다:

```bash
# 현재 세션 통계 표시
openclaw status

# 출력:
# Session: dev-session-001
# Messages: 23
# Tokens used: 47,234 / 200,000 (23.6%)
# Model: claude-3-5-sonnet
# Active files: 4 (12,400 tokens)
```

대화 중에는 OpenClaw UI의 컨텍스트 바가 실시간 사용량을 보여줍니다. 80%에 도달하면 컨텍스트 관리 전략을 고민하기 시작하세요.

## 전략 1: 정밀한 파일 로딩

가장 흔한 실수는 일부만 필요한데 파일 전체를 로드하는 것입니다. 2,000줄 파일은 20,000 tokens 이상을 소비합니다. 익스포트 내용만 파악하면 된다면 200 tokens만으로 충분할 수도 있습니다.

**특정 섹션만 로드하기:**

```bash
# 파일 전체를 로드하는 대신
openclaw chat --files src/api/server.ts "explain the auth middleware"

# 더 나은 방법: 필요한 것을 구체적으로 설명하기
openclaw chat "Look at src/api/server.ts and explain only the auth middleware section"
```

`--files`로 로드하는 대신 OpenClaw에게 파일을 "참조"하도록 하면, 파일을 읽고 필요한 부분만 추출합니다. 이 방식이 대개 token 효율이 더 높습니다.

**glob 패턴을 사용해 관련 파일만 로드하기:**

```bash
# 피해야 할 방식: 모든 것을 로드
openclaw chat --files "src/**/*.ts" "fix the authentication bug"

# 더 나은 방식: 인증 관련 파일만 로드
openclaw chat --files "src/auth/*.ts,src/middleware/auth*.ts" "fix the authentication bug"
```

## 전략 2: 계속하기 전에 요약하기

긴 대화는 token 부채를 빠르게 쌓아갑니다. 기록에 있는 모든 메시지가 tokens를 소비합니다. 생산적인 세션에서 문제를 해결한 후, 다음 질문을 하기 전에 배운 내용을 요약하세요:

```
당신: "계속하기 전에 지금까지 확인한 내용을 요약해봅시다:
- 인증 버그는 jwt.ts 47번째 줄에 있음
- 수정 방법은 서명 검증 전에 토큰 만료를 확인하는 것
- 테스트 파일을 새로운 동작에 맞게 업데이트 필요

이 컨텍스트를 염두에 두고, session.ts의 관련된 세션 만료 문제를 다뤄봅시다"
```

명시적으로 요약하면, 그 결론에 이르기까지의 장황한 대화를 대체하는 간결한 참조 정보를 모델에게 제공할 수 있습니다. 모델은 이전 메시지를 모두 다시 읽을 필요 없이 요약을 바탕으로 작업할 수 있습니다.

## 전략 3: 다중 일정 프로젝트에는 이름 있는 세션 사용하기

OpenClaw 세션은 기본적으로 임시적입니다. 터미널을 닫으면 대화 컨텍스트가 사라집니다. 여러 날에 걸친 프로젝트에는 이름 있는 세션을 사용하세요:

```bash
# 이름 있는 세션 시작하기
openclaw chat --session my-refactor-project

# 나중에 재개하기
openclaw chat --session my-refactor-project
```

이름 있는 세션은 대화 기록을 디스크에 저장합니다. 하지만 저장한다고 해서 token 예산 문제가 해결되는 건 아닙니다——일주일치 대화 기록은 엄청난 양이 됩니다. 해결책은 세션을 집중적인 작업 단계에 사용하고, 다음 단계에서는 새 세션을 시작하는 것입니다.

**다주 프로젝트를 위한 세션 워크플로:**

```
1주차: --session refactor-phase-1
  목표: 코드베이스 이해, 문제 영역 파악
  마무리: 발견 사항 요약, 세션 종료

2주차: --session refactor-phase-2
  시작: 1주차 요약을 컨텍스트로 로드
  목표: 파악된 문제에 대한 수정 구현
  마무리: 변경 사항 요약, 세션 종료

3주차: --session refactor-phase-3
  시작: 2주차 요약 로드
  목표: 테스트 및 엣지 케이스 처리
```

## 전략 4: 배경 정보를 위한 컨텍스트 파일

여러 대화에서 유용한 정보——프로젝트 문서, 코딩 규칙, API 스키마——에는 OpenClaw의 컨텍스트 로딩 기능을 활용하세요:

```bash
# 안정적인 배경 정보가 담긴 컨텍스트 파일 만들기
cat > .openclaw-context.md << 'EOF'
# Project Context

This is a Node.js API for a SaaS billing system.
Key constraints:
- Never modify the Stripe webhook handlers without QA sign-off
- All amounts are in cents (no floats for money)
- The legacy V1 API must remain backward compatible
- Use the internal audit logger for all financial operations

Database: PostgreSQL 16
ORM: Drizzle
Auth: JWT with 24h expiry, refresh tokens stored in Redis
EOF

# 각 세션 시작 시 로드하기
openclaw chat --context .openclaw-context.md "Let's work on the invoice generation feature"
```

이 방식은 매 대화마다 컨텍스트를 다시 설명하는 것보다 효율적입니다. 컨텍스트 파일이 tokens를 소비하긴 하지만 간결하며, 내용을 정확히 제어할 수 있습니다.

## 전략 5: "워크스페이스" 패턴

대규모 코드베이스 작업에는 워크스페이스를 정의하세요: 컨텍스트 예산에 여유 있게 맞는, 가장 관련성 높은 파일들의 엄선된 집합입니다.

```bash
# 워크스페이스 설정 파일 만들기
cat > .openclaw-workspace.yaml << 'EOF'
name: auth-system
files:
  - src/auth/jwt.ts
  - src/auth/session.ts
  - src/middleware/auth.ts
  - src/models/user.ts
  - tests/auth/*.test.ts
context:
  - docs/auth-architecture.md
EOF

# 워크스페이스에서 작업하기
openclaw chat --workspace .openclaw-workspace.yaml "audit the session handling for security issues"
```

워크스페이스는 세션 간에 일관성을 유지합니다. 범위를 확장해야 할 때는 워크스페이스 파일을 업데이트하면 됩니다.

## 전략 6: 점진적 개선

긴 문서나 복잡한 작업에서는 한 번에 모든 것을 처리하려 하지 말고 단계적으로 진행하세요:

**요약 → 개요 → 초안 → 개선**

```
1단계: "이 5개의 소스 파일을 읽고 각각이 어떻게 동작하는지 한 단락으로 요약해줘"
2단계: "그 요약들을 바탕으로 인증 플로우 리팩토링 방법을 개요로 잡아줘"
3단계: "이제 개요의 첫 번째 단계를 구현해봅시다——JWT 검증 변경만"
4단계: "변경한 내용을 검토하고 엣지 케이스를 테스트해봅시다"
```

각 단계는 이전 단계의 간결한 출력을 기반으로 쌓입니다. 구현 단계에 이르면 컨텍스트에는 전체 파일 내용이 아니라 요약만 담겨 있습니다.

## 자동화에서 컨텍스트 모니터링

OpenClaw API를 스크립트로 사용하는 경우 컨텍스트 사용량을 프로그래밍 방식으로 모니터링하세요:

```typescript
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  body: JSON.stringify({
    model: "claude-3-5-sonnet",
    messages: conversationHistory,
  }),
});

const data = await response.json();

// 응답에서 token 사용량 확인
const usage = data.usage;
console.log(`Tokens used: ${usage.prompt_tokens} + ${usage.completion_tokens}`);

// 한계에 근접하면 요약 트리거
if (usage.prompt_tokens > 150000) {
  await summarizeAndCompressHistory(conversationHistory);
}
```

## 컨텍스트 오버플로우 대처하기

최선을 다했음에도 컨텍스트가 가득 찰 때:

**우아한 복구 패턴:**

1. 모델에게 현재 상태를 요약하게 하세요: "계속하기 전에 요점으로 요약해주세요: (1) 우리가 달성하려 했던 것, (2) 확인한 것, (3) 다음 단계"
2. 새 세션 시작
3. 요약을 시작 컨텍스트로 로드

```bash
# 이전 세션에서 요약 내보내기
openclaw chat --session old-session "summarize our current state for handoff to a new session" > session-handoff.txt

# 인수인계 내용으로 새 세션 시작하기
openclaw chat --context session-handoff.txt "Continue from the session summary above..."
```

## 모델별 컨텍스트 고려사항

모델마다 token 계산 특성이 다릅니다:

**Claude 모델**은 Anthropic의 토크나이저를 사용합니다. 코드는 상대적으로 효율적입니다——Claude는 코드 문법을 잘 처리하기 때문에 일부 다른 모델처럼 코드 파일이 많이 부풀지 않습니다.

**GPT 모델**은 tiktoken을 사용합니다. 영어 텍스트의 효율은 비슷하고, 특이한 문법의 코드에서는 약간 덜 효율적입니다.

**로컬 모델**은 다양합니다. Llama 기반 모델은 SentencePiece 토크나이저를 사용합니다. 전용 토크나이저를 가진 일부 클라우드 모델에 비해 아시아 언어의 token 비용이 더 높을 수 있습니다.

다국어 작업 시, 일부 토크나이저에서 한국어와 일본어, 중국어 텍스트가 동일한 내용의 영어 텍스트보다 2-3배 더 많은 tokens를 소비할 수 있다는 점을 염두에 두세요. 최종 출력이 다른 언어일지라도 컨텍스트 파일과 배경 정보는 가능하면 영어로 작성하는 것을 권장합니다.

## 자주 묻는 질문

**OpenClaw가 대화 기록을 삭제했어요——무슨 일이 일어난 건가요?**

이름 없는 세션은 기본적으로 디스크에 저장되지 않습니다. `--session session-name`을 사용해 대화를 저장하세요. 저장된 세션은 `~/.openclaw/sessions/`에서 확인할 수 있습니다.

**컨텍스트 한계에 가까워지고 있다는 걸 어떻게 알 수 있나요?**

OpenClaw는 UI에 진행 바를 표시합니다. API 사용 시에는 응답의 `usage.prompt_tokens` 필드를 모니터링하세요. 경고 임계값(예: 모델 컨텍스트 윈도우의 80%)을 설정하고 한계에 도달하기 전에 요약을 트리거하세요.

**대화를 리셋하면 컨텍스트가 지워지나요?**

네, 채팅에서 `openclaw clear` 또는 `/clear`를 실행하면 대화 기록이 지워집니다. `--files`로 로드된 파일과 `--context`로 로드된 컨텍스트도 해제됩니다. 다음 메시지는 새로운 상태에서 시작됩니다.

**로컬 모델의 컨텍스트 윈도우를 늘릴 수 있나요?**

Ollama의 컨텍스트 크기는 모델 로드 시에 설정됩니다. 늘릴 수는 있지만 품질과 성능 간의 트레이드오프가 있습니다. 모델의 학습된 컨텍스트 길이(VRAM 한계가 아님)를 넘어서면 품질이 저하됩니다:

```bash
# Ollama의 컨텍스트 크기 설정하기
OLLAMA_NUM_CTX=32768 ollama run mistral:7b
```

품질이 허용 가능한 수준으로 유지됨을 테스트로 확인한 경우에만 모델의 기본값을 초과하여 늘리세요.

컨텍스트 관리는 쌓이는 기술입니다. tokens의 작동 방식과 이를 보존하는 전략을 체득하고 나면, 대규모 코드베이스 작업이 훨씬 더 효과적으로 됩니다. 그 한계는 더 이상 넘을 수 없는 벽처럼 느껴지지 않고, 방법을 찾아 극복할 수 있는 엔지니어링 제약으로 보이기 시작합니다.
