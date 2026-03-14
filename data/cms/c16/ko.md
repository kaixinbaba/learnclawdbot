---
title: "멀티유저 OpenClaw: 공유 배포, 권한 관리, 팀 설정"
description: "팀을 위한 OpenClaw 운영 방법: 사용자 격리, 공유 시스템 프롬프트, 사용자별 API 키, 모델 및 툴별 접근 제어, 사용량 추적. 2026년 실제 설정 예시 포함."
publishedAt: 2026-03-17
status: published
visibility: public
---

# 멀티유저 OpenClaw: 공유 배포, 권한 관리, 팀 설정

혼자 OpenClaw를 운영하는 건 간단합니다. 하지만 접근 레벨, 비용 센터, 지식 영역이 각기 다른 엔지니어 10명을 위해 운영하는 건 전혀 다른 문제입니다. 저는 이 설정을 두 번 경험했습니다. 한 번은 5인 스타트업에서, 또 한 번은 비용 책임 추적이 필수였던 대형 엔지니어링 조직에서입니다. 이 글은 그 과정에서 배운 것들을 정리한 것입니다.

짧게 요약하면: OpenClaw는 멀티유저 배포를 잘 지원하지만, 설정 범위가 넓고 장애 패턴이 직관적이지 않습니다. 사용자 간 컨텍스트 유출, 엉뚱한 팀에 귀속되는 비용 초과, 의도치 않은 모델 접근 — 이 모든 것이 의도적인 아키텍처 설계로 해결해야 할 실제 문제입니다. 체계적으로 하나씩 살펴보겠습니다.

## 공유 OpenClaw 인스턴스가 합리적인 이유

가장 단순한 접근법은 각 개발자에게 독립적인 OpenClaw 설치본을 제공하는 것입니다. 깔끔해 보이지만 조율 문제가 생깁니다. 일관된 시스템 프롬프트를 강제할 수 없고, 비용을 중앙에서 추적할 수 없으며, MCP 서버 업데이트를 배포할 수 없고, 감사 추적도 없습니다. 개별 설치는 또한 각 개발자가 자신의 API 키를 관리한다는 것을 의미하며, 규모가 커질수록 보안 문제가 됩니다.

공유 OpenClaw 인스턴스가 주는 것:

- **중앙 키 관리**: Anthropic, OpenAI 등 제공업체의 API 키를 한 곳에 보관합니다. 개발자들은 실제 키를 볼 수 없습니다.
- **일관된 시스템 프롬프트**: 회사 지침, 코딩 규범, 안전 규칙이 모든 사람에게 자동으로 적용됩니다.
- **통합 청구**: 누가 어떤 모델에 얼마를 쓰는지 한 곳에서 확인합니다.
- **공유 MCP 서버**: 내부 도구——코드 검색, 데이터베이스 내성, 이슈 트래커——를 사용자별 설정 없이 모두가 사용할 수 있습니다.
- **감사 로그**: 누가 언제 무엇을 물었고 어떤 모델이 응답했는지 파악합니다.

트레이드오프는 운영 복잡성입니다. 이제 팀이 의존하는 인프라를 운영하는 것이므로 안정성이 중요합니다. 미리 계획을 세우세요.

## 접근 제어 모델

설정을 한 줄도 쓰기 전에 접근 제어 모델을 결정하세요. OpenClaw는 계층형 권한 시스템을 사용합니다.

1. **인증**: 이 사용자는 누구인가? (JWT 토큰, 사용자별 API 키, 또는 SSO)
2. **모델 접근**: 이 사용자는 어떤 AI 모델을 호출할 수 있는가?
3. **툴 접근**: 어떤 툴(웹 검색, 코드 실행, 파일 접근)을 사용할 수 있는가?
4. **MCP 서버 접근**: 어떤 MCP 서버를 이용할 수 있는가?
5. **속도 제한**: 시간당 요청 수는? 토큰 예산은?
6. **컨텍스트 격리**: 사용자 간에 대화가 분리되는가?

제가 사용하는 멘탈 모델은 개인이 아닌 역할로 생각하는 것입니다. 역할은 한 번 정의하고 사용자에게 적용합니다. 사용자는 여러 역할을 가질 수 있습니다.

```yaml
# openclaw/config/roles.yaml
roles:
  - name: developer
    description: "Standard developer access"
    models:
      allowed:
        - claude-3-7-sonnet-20250219
        - gpt-4o
      denied:
        - claude-opus-4  # Cost-restricted; needs approval
    tools:
      allowed:
        - web_search
        - code_execution
        - file_read
      denied:
        - file_write_external  # No writes to external filesystems
    mcp_servers:
      allowed:
        - internal_code_search
        - jira_integration
        - github_integration
    rate_limits:
      requests_per_hour: 200
      tokens_per_day: 500000
    context_isolation: strict

  - name: senior_developer
    extends: developer
    models:
      allowed:
        - claude-opus-4
        - claude-3-7-sonnet-20250219
        - gpt-4o
        - o3
    rate_limits:
      requests_per_hour: 500
      tokens_per_day: 2000000

  - name: readonly_reviewer
    description: "Code reviewers with read-only tool access"
    models:
      allowed:
        - claude-3-7-sonnet-20250219
    tools:
      allowed:
        - file_read
        - web_search
    mcp_servers:
      allowed:
        - internal_code_search
    rate_limits:
      requests_per_hour: 100
      tokens_per_day: 200000
    context_isolation: strict
```

## 사용자 설정과 API 키 격리

각 사용자는 users 설정에 자신만의 항목을 가집니다. 중요한 점은 사용자가 업스트림 제공업체의 API 키를 관리하지 않는다는 것입니다——그것들은 공유 OpenClaw 인스턴스가 보유합니다. 사용자가 가지는 것은 공유 인스턴스에 인증하는 데 사용하는 개인 OpenClaw 액세스 토큰입니다.

```yaml
# openclaw/config/users.yaml
users:
  - id: user_alice_chen
    name: "Alice Chen"
    email: alice@company.com
    roles:
      - senior_developer
    team: platform
    cost_center: engineering-platform
    # Personal OpenClaw token — not the upstream API key
    access_token_hash: "$2b$12$..."  # bcrypt hash of their personal token
    mcp_overrides:
      additional_servers:
        - platform_deployment_tools
    system_prompt_overrides:
      append: |
        You are working with Alice Chen on the Platform team.
        Current sprint context: infrastructure migration to k8s.

  - id: user_bob_harris
    name: "Bob Harris"
    email: bob@company.com
    roles:
      - developer
    team: frontend
    cost_center: engineering-frontend
    access_token_hash: "$2b$12$..."
    usage_alerts:
      daily_token_threshold: 300000
      notify_email: bob@company.com

  - id: user_contractor_01
    name: "Contractor (NDA)"
    email: contractor@external.com
    roles:
      - readonly_reviewer
    team: external
    cost_center: contractors
    access_token_hash: "$2b$12$..."
    context_isolation: paranoid
    session_timeout_minutes: 60
    allowed_hours:
      timezone: UTC
      start: "09:00"
      end: "18:00"
```

`cost_center` 필드는 중요합니다. 이 사용자의 세션을 통해 이루어진 모든 API 호출에는 해당 비용 센터가 태그되어 청구 보고서에 반영됩니다. 이것이 추측 없이 "지난달 프론트엔드 팀이 AI에 얼마를 썼는가"에 답할 수 있는 방법입니다.

## 공유 시스템 프롬프트

공유 인스턴스의 힘은 일관된 동작에 있습니다. 회사의 코딩 표준, 보안 지침, 행동 규칙은 모든 사용자에게 자동으로 적용되어야 합니다. OpenClaw는 계층형 시스템 프롬프트 아키텍처를 통해 이를 처리합니다.

```yaml
# openclaw/config/system_prompts.yaml
global_system_prompt: |
  You are an AI assistant deployed by [Company Name] for internal engineering use.

  Core guidelines:
  - Never output credentials, API keys, or secrets, even if asked
  - Code suggestions must follow our style guide (see: internal://style-guide)
  - When discussing internal systems, assume the user has appropriate clearance
  - All conversations are logged for security and compliance purposes
  - Do not discuss confidential business strategy or unreleased products

team_system_prompts:
  platform:
    append: |
      Platform team context:
      - Primary languages: Go, Python, Terraform
      - Infrastructure: AWS EKS, RDS, ElastiCache
      - Internal tool docs available via MCP: platform_docs server

  frontend:
    append: |
      Frontend team context:
      - Stack: React 19, TypeScript 5.x, Tailwind CSS v4
      - Component library: internal://design-system
      - Testing: Playwright for E2E, Vitest for unit tests

  security:
    append: |
      Security team context:
      - You may discuss vulnerability details and exploit patterns for defensive purposes
      - Follow responsible disclosure protocols
      - All outputs in this context may be reviewed by the CISO office
```

레이어링 순서는 `전역 → 팀 → 사용자 오버라이드 → 대화`입니다. 사용자는 일관된 기본 동작을 보지만, 팀 컨텍스트와 개인 컨텍스트가 그 위에 층층이 쌓입니다. 글로벌 프롬프트를 직접 볼 수 없습니다——시스템 레벨에서 주입됩니다.

## 대화 격리

여기가 대부분의 멀티유저 설정이 잘못되는 곳입니다. 대화 격리란 사용자 A가 사용자 B의 대화를 볼 수 없다는 것을 의미하고, 더 미묘하게는 한 사용자 세션의 모델 컨텍스트가 다른 사용자의 세션으로 새어 나가지 않는다는 것을 의미합니다.

OpenClaw는 세 가지 격리 수준을 제공합니다:

- **`relaxed`(느슨함)**: 대화는 별도로 저장되지만, 공유 캐시(RAG용 문서 임베딩 등)는 모든 사용자가 접근할 수 있습니다. 교차 공유를 허용하는 팀에 적합합니다.
- **`strict`(엄격함)**: 각 사용자의 대화 기록이 완전히 격리됩니다. 공유 지식 베이스는 읽기 전용이며 명시적으로 승인된 소스에서만 접근 가능합니다.
- **`paranoid`(편집증)**: 완전 격리. 공유 캐시 없음. MCP 서버 연결 풀조차 사용자별로 분리됩니다. 외부 협력자와 계약자에게 사용하세요.

```yaml
# openclaw/config/isolation.yaml
conversation_storage:
  backend: postgres  # or redis, sqlite for small teams
  connection: "${DB_CONNECTION_STRING}"
  encryption_at_rest: true
  encryption_key_env: OPENCLAW_DB_ENCRYPTION_KEY

session_management:
  default_isolation: strict
  session_ttl_hours: 24
  max_sessions_per_user: 3
  cross_session_memory: disabled

rag_knowledge_bases:
  shared:
    - name: company_engineering_docs
      isolation_required_role: developer
      read_only: true
    - name: public_api_documentation
      isolation_required_role: readonly_reviewer
      read_only: true

  team_specific:
    platform:
      - name: platform_runbooks
        write_allowed_role: senior_developer
    frontend:
      - name: design_system_docs
        write_allowed_role: developer
```

대화 스토리지 백엔드는 규모에 따라 많이 중요합니다. 5인 팀이라면 SQLite로 충분합니다. 20명 이상이고 요청량이 많다면 적절한 연결 풀링이 있는 PostgreSQL을 사용하세요. 저장 시 암호화 요구사항은 보안 검토를 통과해야 하는 모든 경우에 협상 불가능합니다.

## 팀별 MCP 서버 설정

MCP 서버는 멀티유저 설정이 흥미로워지는 부분입니다. 팀에는 외부 사용자가 접근해서는 안 되는 내부 도구가 있고, 팀마다 다른 통합이 필요합니다. 커스텀 서버 구축은 [MCP 서버 가이드](/blog/building-custom-mcp-servers-openclaw)를 참조하세요——이 섹션은 기존 서버의 접근 제어에 집중합니다.

```yaml
# openclaw/config/mcp_servers.yaml
mcp_servers:
  - id: internal_code_search
    name: "Internal Code Search"
    type: http
    endpoint: "http://code-search.internal:8080"
    auth:
      type: service_account
      token_env: MCP_CODE_SEARCH_TOKEN
    available_to_roles:
      - developer
      - senior_developer
      - readonly_reviewer
    rate_limit:
      requests_per_minute: 60
    tool_access:
      search_code: [developer, senior_developer, readonly_reviewer]
      index_repository: [senior_developer]
      delete_index: []

  - id: github_integration
    name: "GitHub MCP"
    type: http
    endpoint: "http://github-mcp.internal:8081"
    auth:
      type: oauth_service
      client_id_env: GITHUB_MCP_CLIENT_ID
      client_secret_env: GITHUB_MCP_CLIENT_SECRET
    available_to_roles:
      - developer
      - senior_developer
    tool_access:
      read_pr: [developer, senior_developer, readonly_reviewer]
      create_pr: [developer, senior_developer]
      merge_pr: [senior_developer]
      push_to_main: []

  - id: platform_deployment_tools
    name: "Platform Deployment MCP"
    type: http
    endpoint: "http://deploy-mcp.internal:8082"
    auth:
      type: mtls
      cert_env: DEPLOY_MCP_CERT
      key_env: DEPLOY_MCP_KEY
    available_to_roles: []
    available_to_users:
      - user_alice_chen
    tool_access:
      read_deployment_status: [user_alice_chen]
      trigger_staging_deploy: [user_alice_chen]
      trigger_production_deploy: []
```

각 MCP 서버 설정 내의 `tool_access` 섹션은 많은 팀이 건너뛰는 세부 사항입니다. "개발자가 GitHub MCP 서버를 사용할 수 있다"는 것만으로는 충분하지 않습니다. 개발자가 그것을 통해 PR을 병합할 수 있는지 결정해야 합니다. 그것은 의미 있는 차이입니다. 툴 레벨 제어 없이 GitHub MCP 접근을 처음 설정했을 때, 열정적인 개발자가 그것을 사용해 pull request를 자동 병합했습니다. 기능은 완벽하게 작동했습니다. 문제는 언제 사용할지에 대한 판단이었습니다.

## 청구 및 사용량 추적

비용 책임 추적은 공유 인프라 운영을 위한 예산 승인을 받는 기능입니다. "팀 X가 지난달 AI에 얼마를 썼는가"에 답할 수 없다면, 그 회의에서는 수세에 몰릴 것입니다.

```yaml
# openclaw/config/billing.yaml
usage_tracking:
  enabled: true
  backend: postgres
  connection: "${BILLING_DB_CONNECTION_STRING}"

  track_fields:
    - user_id
    - cost_center
    - team
    - model_id
    - input_tokens
    - output_tokens
    - cached_tokens
    - mcp_servers_used
    - tools_used
    - request_timestamp
    - response_latency_ms
    - session_id

  model_costs:
    claude-3-7-sonnet-20250219:
      input_per_million: 3.00
      output_per_million: 15.00
      cache_read_per_million: 0.30
    claude-opus-4:
      input_per_million: 15.00
      output_per_million: 75.00
    gpt-4o:
      input_per_million: 2.50
      output_per_million: 10.00
    o3:
      input_per_million: 10.00
      output_per_million: 40.00

alerts:
  - type: user_daily_spend
    threshold_usd: 20.00
    notify:
      - user
      - team_lead

  - type: team_monthly_spend
    threshold_usd: 500.00
    notify:
      - team_lead
      - finance@company.com

  - type: model_access_anomaly
    enabled: true
    notify:
      - security@company.com

reporting:
  daily_report:
    enabled: true
    recipients:
      - engineering-leads@company.com
    format: csv

  monthly_summary:
    enabled: true
    recipients:
      - finance@company.com
      - cto@company.com
    group_by:
      - cost_center
      - model
```

`model_access_anomaly` 알림은 잘 활용되지 않지만 가치가 있습니다. 주니어 개발자가 갑자기 `claude-opus-4`를 호출하기 시작하는데 그의 역할이 `claude-3-7-sonnet`만 허용한다면, 설정이 잘못된 것이거나 예상치 못한 일이 발생한 것입니다. 어느 쪽이든 알아야 합니다.

## 일반적인 팀 고충 처리

### 컨텍스트 유출

라이브 이후 가장 많이 듣는 불만은 "다른 사용자의 대화처럼 보이는 것을 봤다"는 것입니다. 이것이 일어나는 이유:

1. Session 토큰이 공유됨 (개발자 A가 자신의 토큰을 개발자 B에게 줌)
2. 대화 스토리지 백엔드에 테넌트 격리 버그가 있음
3. 공유 RAG 지식 베이스에 사용자별 콘텐츠가 인덱싱됨

(1)의 해결책은 모니터링입니다. 같은 토큰이 짧은 시간 내에 두 다른 IP에서 사용되는 것을 보면 즉시 무효화하고 알림을 보냅니다. (2)는 테넌트 격리를 명시적으로 테스트하세요——두 사용자를 만들고, 각각 대화를 저장하고, 사용자 A로 조회했을 때 사용자 B의 데이터가 절대 반환되지 않는지 확인하는 테스트를 작성하세요. (3)은 공유 지식 베이스에 무엇이 들어가는지 감사하세요. 회사 전체 문서만 그곳에 있어야 합니다. 개인 대화 요약은 절대 안 됩니다.

### 유출 없는 공유 지식 베이스

공유 컨텍스트의 유용한 형태는 엄선된 지식 베이스입니다. 엔지니어링 Wiki, API 문서, 런북은 모두가 이용할 수 있어야 합니다. 개인 대화는 그렇지 않아야 합니다.

```yaml
# openclaw/config/knowledge_bases.yaml
knowledge_bases:
  engineering_wiki:
    source: confluence
    connection:
      url: "${CONFLUENCE_URL}"
      api_token_env: CONFLUENCE_API_TOKEN
    spaces_allowed:
      - ENG
      - ARCH
    spaces_denied:
      - HR
      - EXEC
    refresh_interval_hours: 6
    access: shared_read

  incident_runbooks:
    source: git
    repository: "git@github.com:company/runbooks.git"
    branch: main
    refresh_interval_hours: 1
    access: shared_read
```

명시적인 `spaces_denied` 목록이 중요합니다. "Confluence 전체를 인덱싱한다"고 말하기는 쉽지만, HR 정책, 급여 수준, 인사 평가 템플릿을 실수로 가져올 수 있습니다. 기본 거부, 명시적 허용.

### 비용 배분 분쟁

비용 센터가 월간 AI 지출 보고서를 받고 이의를 제기할 때, 정확히 무슨 일이 있었는지 재구성하기에 충분히 세부적인 기록이 필요합니다. 청구 백엔드는 다음에 답할 수 있을 만큼의 정보를 저장해야 합니다: "3월 14일, 사용자 bob_harris는 claude-3-7-sonnet과 gpt-4o에 걸쳐 총 124,000 토큰의 47개 요청을 했으며, 비용은 1.83달러였습니다." 이것을 제시할 수 있다면 분쟁은 빠르게 해결됩니다.

집계 데이터만이 아닌 원시 요청 로그를 최소 90일 동안 저장하세요. 집계 데이터는 대시보드에는 충분하지만, 감사에는 원시 로그가 필요합니다.

## 팀 배포의 보안 고려사항

멀티유저 OpenClaw 인스턴스의 공격 표면은 개인 인스턴스보다 의미 있게 큽니다. 팀에 배포하기 전에 두 가지를 해야 합니다.

첫째, [OpenClaw 보안 강화 가이드](/blog/hardening-openclaw-security)를 읽으세요. 기본 사항——전면적인 TLS, 환경 변수 또는 Vault를 통한 시크릿 관리, OpenClaw 프로세스의 네트워크 격리——은 거기서 다룹니다.

둘째, 애플리케이션 레이어만이 아닌 네트워크 레이어에서도 인증을 추가하세요. 공유 OpenClaw 인스턴스를 VPN이나 제로트러스트 게이트웨이 뒤에 두세요. 애플리케이션 레이어 인증(JWT 검증)은 좋지만, OpenClaw 포트가 공개되어 있다면 무단 접근을 막는 것은 오직 애플리케이션 코드에만 의존하는 셈입니다.

```yaml
# openclaw/config/auth.yaml
authentication:
  method: jwt
  jwt:
    issuer: "https://auth.company.com"
    audience: "openclaw-internal"
    public_key_env: JWT_PUBLIC_KEY
    algorithm: RS256

  api_keys:
    enabled: true
    storage: postgres
    rotation_policy:
      max_age_days: 90
      alert_before_expiry_days: 14

network:
  allowed_source_cidrs:
    - "10.8.0.0/16"
    - "10.0.0.0/8"
  deny_public_access: true

  tls:
    enabled: true
    cert_env: TLS_CERT_PATH
    key_env: TLS_KEY_PATH
    min_version: "1.3"
```

## 배포 전략

멀티유저 OpenClaw를 전체 팀에 한꺼번에 배포하지 마세요. 제가 권장하는 순서:

1. **1주차**: 두 명의 사용자(당신과 신뢰할 수 있는 개발자 한 명)로만 배포합니다. 청구 추적, 대화 격리, MCP 접근 제어를 검증합니다.
2. **2주차**: 한 팀 전체(5–8명)로 확장합니다. 청구 대시보드를 매일 모니터링하세요. 예상치 못한 것이 있으면 수정합니다.
3. **3주차**: 나머지 팀에 배포합니다. 이 시점에는 설정이 테스트되고 모니터링이 작동합니다.

각 확장 단계 전에 격리 테스트를 실행하세요. 20분이 걸리지만 당혹스러운 데이터 분리 사고를 예방할 수 있습니다.

## 멀티유저 OpenClaw의 실제 사용 경험

이것이 작동하면, 개별 개발자에게는 OpenClaw를 개인적으로 사용하는 것과 거의 동일한 경험입니다——단지 API 키를 관리하지 않아도 되고, 스스로 설정하기 어려웠던 공유 MCP 서버에 접근할 수 있으며, 팀의 공유 지식 베이스가 항상 컨텍스트에서 사용 가능합니다. 공유 인프라가 이전에는 개발자마다 개별적으로 설정했던 것을 처리하므로 마찰이 줄어듭니다.

배포를 담당하는 팀 리드나 플랫폼 엔지니어에게는 인프라 관리가 됩니다. 용량 계획, 모델 가격 테이블 최신화, 계약자의 계약 종료 시 토큰 폐기에 시간을 쓸 것입니다. 그것이 올바른 트레이드오프입니다. 대안——20명의 개발자, 독립적인 OpenClaw 인스턴스 20개, API 키 세트 20개——은 규모가 커질수록 악화되는 혼돈입니다.

초기 설정 복잡성은 실제로 존재합니다. 하지만 한 번 완료되면, 끝입니다. 새 직원이 올 때마다 처음부터 다시 만들 필요가 없습니다. 사용자 항목을 만들고 역할을 할당하기만 하면 됩니다.

---

*팀의 내부 도구를 통합하기 위한 커스텀 MCP 서버를 구축하고 있다면, [MCP 서버 가이드](/blog/building-custom-mcp-servers-openclaw)에서 엔드투엔드 내용을 다룹니다. 공유 인스턴스의 프로덕션 보안 강화에 대해서는 [OpenClaw 보안 가이드](/blog/hardening-openclaw-security)를 참조하세요.*
