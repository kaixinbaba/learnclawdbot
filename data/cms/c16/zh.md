---
title: "多用户 OpenClaw：共享部署、权限管理与团队配置"
description: "如何为团队运行 OpenClaw：用户隔离、共享系统提示词、用户级 API 密钥、按模型和工具的访问控制，以及使用量追踪。包含 2026 年真实配置示例。"
publishedAt: 2026-03-17
status: published
visibility: public
---

# 多用户 OpenClaw：共享部署、权限管理与团队配置

为自己运行 OpenClaw 并不复杂。但为一个拥有不同访问级别、成本中心和知识领域的十人工程师团队运行它，则是完全不同的挑战。我已经做过两次这样的部署——一次是为五人初创公司，另一次是为一个对账单追责要求极高的大型工程组织。这篇文章记录了我的经验总结。

简而言之：OpenClaw 对多用户部署支持良好，但配置层面复杂，故障模式也不直观。用户间的上下文泄漏、被归错团队的失控成本以及意外的模型访问，都是需要通过精心设计来解决的真实问题。让我们系统地逐一分析。

## 为什么共享 OpenClaw 实例更合理

最简单的做法是给每位开发者各自安装一个 OpenClaw。这看起来很清晰，但会制造协调上的噩梦：你无法强制执行一致的系统提示词，无法集中追踪成本，无法推送 MCP 服务器更新，也没有审计记录。各自安装还意味着每位开发者都要管理自己的 API 密钥，这在规模扩大后是一个安全隐患。

共享 OpenClaw 实例能带来：

- **集中密钥管理**：Anthropic、OpenAI 等提供商的 API 密钥集中存放。开发者永远看不到实际的密钥。
- **一致的系统提示词**：公司指引、编码规范和安全规则自动应用于所有人。
- **统一账单**：在一个地方查看谁在哪个模型上花了多少钱。
- **共享 MCP 服务器**：内部工具——代码搜索、数据库自省、问题追踪——所有人都可使用，无需逐人配置。
- **审计日志**：你知道谁在什么时候问了什么，以及哪个模型做出了响应。

代价是运维复杂性。你现在运行的是团队所依赖的基础设施，因此可靠性至关重要。请提前做好规划。

## 访问控制模型

在写第一行配置之前，先确定你的访问控制模型。OpenClaw 使用分层权限系统：

1. **认证**：这个用户是谁？（JWT token、用户级 API 密钥或 SSO）
2. **模型访问**：此用户可以调用哪些 AI 模型？
3. **工具访问**：他们可以使用哪些工具（网页搜索、代码执行、文件访问）？
4. **MCP 服务器访问**：哪些 MCP 服务器对他们可用？
5. **速率限制**：每小时多少请求？Token 预算是多少？
6. **上下文隔离**：用户间的对话是否相互隔离？

我使用的心智模型是：按角色思考，而不是按个人。角色只定义一次，然后分配给用户。用户可以拥有多个角色。

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

## 用户配置与 API 密钥隔离

每个用户在 users 配置中都有自己的条目。关键在于，用户不管理上游提供商的 API 密钥——这些由共享 OpenClaw 实例统一持有。用户拥有的是用于向共享实例进行身份验证的个人 OpenClaw 访问令牌。

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
      # Alice has access to an additional MCP server for her team
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
    # Contractors get more restrictive context isolation
    context_isolation: paranoid
    session_timeout_minutes: 60
    allowed_hours:
      timezone: UTC
      start: "09:00"
      end: "18:00"
```

`cost_center` 字段非常重要。通过该用户会话发出的每个 API 调用都会被标记其成本中心，这些数据会流入账单报告。这就是你无需猜测就能回答"上个月前端团队在 AI 上花了多少钱"的方式。

## 共享系统提示词

共享实例的力量在于行为一致性。公司的编码标准、安全指引和行为规范应当自动应用于所有用户。OpenClaw 通过分层系统提示词架构来实现这一点。

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

分层顺序为：`全局 → 团队 → 用户覆盖 → 对话`。用户看到一致的基础行为，团队上下文和个人上下文则叠加在上方。他们永远不会直接看到全局提示词——它在系统层面注入。

## 对话隔离

这是大多数多用户部署出错的地方。对话隔离意味着用户 A 看不到用户 B 的对话，更微妙的是，一个用户会话中的模型上下文不会渗入另一个用户的会话。

OpenClaw 提供三个隔离级别：

- **`relaxed`（宽松）**：对话分开存储，但共享缓存（如用于 RAG 的文档嵌入）可被所有用户访问。适合接受交叉共享的团队。
- **`strict`（严格）**：每个用户的对话历史完全隔离。共享知识库为只读，且只来自明确批准的来源。
- **`paranoid`（偏执）**：完全隔离。没有共享缓存。即使 MCP 服务器连接池也是按用户分配的。适用于外部合作者和承包商。

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
  max_sessions_per_user: 3  # Prevents runaway parallel sessions

  # Cross-session context: should completion of task A inform task B?
  cross_session_memory: disabled  # Enable only if you've thought this through

rag_knowledge_bases:
  shared:
    - name: company_engineering_docs
      isolation_required_role: developer  # Minimum role to access
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

对话存储后端在规模较大时非常重要。五人团队用 SQLite 没问题。二十人以上且请求量较高时，请使用 PostgreSQL 并配置合适的连接池。静态加密要求对于任何需要通过安全审查的场景都是不可谈判的。

## 团队专属 MCP 服务器配置

MCP 服务器是多用户配置变得有趣的地方。你的团队有外部用户不应访问的内部工具，不同团队也需要不同的集成。构建自定义服务器请参阅 [MCP 服务器指南](/blog/building-custom-mcp-servers-openclaw)——本节重点介绍现有服务器的访问控制。

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
    # Tool-level access control within the MCP server
    tool_access:
      search_code: [developer, senior_developer, readonly_reviewer]
      index_repository: [senior_developer]  # Indexing is write-access
      delete_index: []  # Nobody; admin-only via direct API

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
      merge_pr: [senior_developer]  # Merging requires elevated role
      push_to_main: []  # Never via AI; enforce at repo level too

  - id: platform_deployment_tools
    name: "Platform Deployment MCP"
    type: http
    endpoint: "http://deploy-mcp.internal:8082"
    auth:
      type: mtls
      cert_env: DEPLOY_MCP_CERT
      key_env: DEPLOY_MCP_KEY
    # This server is NOT in any role's default access
    # It's granted via user-level overrides only
    available_to_roles: []
    available_to_users:
      - user_alice_chen
    tool_access:
      read_deployment_status: [user_alice_chen]
      trigger_staging_deploy: [user_alice_chen]
      trigger_production_deploy: []  # Never via AI
```

每个 MCP 服务器配置中的 `tool_access` 部分是很多团队忽略的细节。仅仅说"开发者可以使用 GitHub MCP 服务器"是不够的。你需要决定他们是否可以通过它合并 PR。这是有实质差异的。当我第一次设置 GitHub MCP 访问时没有工具级别控制，一位热情的开发者用它自动合并了一个 pull request。功能本身运行得很好；判断何时使用它才是问题所在。

## 账单与使用量追踪

成本问责制是让你获得运行共享基础设施预算批准的关键功能。如果你无法回答"团队 X 上个月在 AI 上花了多少钱"，你在那次会议上只能被动应付。

```yaml
# openclaw/config/billing.yaml
usage_tracking:
  enabled: true
  backend: postgres
  connection: "${BILLING_DB_CONNECTION_STRING}"

  # What gets tracked per request
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

  # Cost rates (update these when providers change pricing)
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
    # Alert if a user calls a model they've never used before
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

`model_access_anomaly` 警报使用率不高，但很有价值。如果你的初级开发者突然开始调用 `claude-opus-4`，而他的角色只允许使用 `claude-3-7-sonnet`，那么要么是配置有误，要么是发生了意外情况。无论哪种，你都需要知道。

## 处理常见团队痛点

### 上下文泄漏

上线后我最常听到的抱怨是"我看到了像是另一个用户对话的内容"。发生这种情况的原因：

1. Session token 被共享（开发者 A 把自己的 token 给了开发者 B）
2. 对话存储后端的租户隔离存在 bug
3. 共享 RAG 知识库中索引了用户专属内容

问题 (1) 的解决方案是监控：如果你在短时间内看到同一个 token 从两个不同 IP 使用，立即使其失效并发出警报。对于 (2)，要明确测试租户隔离——编写一个测试，创建两个用户，分别存储对话，然后验证以用户 A 身份查询时绝不会返回用户 B 的数据。对于 (3)，审计进入共享知识库的内容。那里应当只有公司级别的文档，个人对话摘要绝对不能进入。

### 无泄漏的共享知识库

共享上下文的有用形式是精心策划的知识库。你的工程 Wiki、API 文档和运维手册应当对所有人开放。个人对话不应如此。

```yaml
# openclaw/config/knowledge_bases.yaml
knowledge_bases:
  engineering_wiki:
    source: confluence
    connection:
      url: "${CONFLUENCE_URL}"
      api_token_env: CONFLUENCE_API_TOKEN
    spaces_allowed:
      - ENG    # Engineering space
      - ARCH   # Architecture decisions
    spaces_denied:
      - HR     # Never index HR content
      - EXEC   # Never index executive content
    refresh_interval_hours: 6
    access: shared_read

  incident_runbooks:
    source: git
    repository: "git@github.com:company/runbooks.git"
    branch: main
    refresh_interval_hours: 1
    access: shared_read
```

明确的 `spaces_denied` 列表很重要。说"索引所有 Confluence 内容"很容易，却可能意外拉入 HR 政策、薪资档案或绩效评估模板。默认拒绝，明确允许。

### 成本分摊争议

当某个成本中心收到月度 AI 支出报告并提出异议时，你需要足够细粒度的记录来还原究竟发生了什么。你的计费后端应当能够回答："3 月 14 日，用户 bob_harris 发出了 47 次请求，共消耗 124,000 个 token，分布在 claude-3-7-sonnet 和 gpt-4o 上，费用为 1.83 美元。"如果你能提供这些数据，争议会很快解决。

至少保存 90 天的原始请求日志——不只是汇总数据。汇总数据适合仪表盘，但审计需要原始日志。

## 团队部署的安全注意事项

多用户 OpenClaw 实例的攻击面比个人实例大得多。在将其推给团队之前，请做好两件事：

第一，阅读 [OpenClaw 安全加固指南](/blog/hardening-openclaw-security)。基础内容——全面的 TLS、通过环境变量或 Vault 进行密钥管理、OpenClaw 进程的网络隔离——都在那里有所介绍。

第二，在网络层添加认证，而不仅仅依赖应用层。将你的共享 OpenClaw 实例放在 VPN 或零信任网关后面。应用层的认证（JWT 验证）是好的，但如果 OpenClaw 端口是公开的，你就完全依赖应用代码来阻止未授权访问。

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
  # Only accept connections from VPN subnet
  allowed_source_cidrs:
    - "10.8.0.0/16"   # VPN range
    - "10.0.0.0/8"    # Internal network
  deny_public_access: true

  tls:
    enabled: true
    cert_env: TLS_CERT_PATH
    key_env: TLS_KEY_PATH
    min_version: "1.3"
```

## 上线策略

不要把多用户 OpenClaw 一次性推给整个团队。我推荐的顺序：

1. **第一周**：只部署两个用户（你和另一名可信赖的开发者）。验证账单追踪、对话隔离和 MCP 访问控制。
2. **第二周**：扩展到一个完整团队（5–8 人）。每天监控账单仪表盘。修复任何意外情况。
3. **第三周**：推给其余团队。到这时，你的配置已经过测试，监控也在正常运行。

在每次扩展前运行隔离测试。只需二十分钟，可以帮你避免一次令人尴尬的数据隔离事故。

## 多用户 OpenClaw 的实际使用体验

一旦这一切运转起来，对于每位开发者而言，使用体验与个人运行 OpenClaw 几乎没有区别——只是他们不再管理 API 密钥，可以访问自己很难独立搭建的共享 MCP 服务器，而且团队的共享知识库随时在上下文中可用。摩擦减少了，因为共享基础设施接管了原本需要每人单独配置的工作。

对于运行部署的团队负责人或平台工程师来说，这变成了基础设施管理。你会花时间在容量规划上、保持模型定价表的更新，以及在承包商合同结束时吊销令牌。这是正确的取舍。另一种方案——二十位开发者、二十个独立的 OpenClaw 实例和二十套 API 密钥——是一种随着规模扩大只会变得更糟的混乱。

前期的配置复杂性是真实存在的。但一旦完成，就完成了。你不需要为每位新员工重头再来；只需创建一个用户条目并分配角色。

---

*如果你正在构建自定义 MCP 服务器来集成团队的内部工具，[MCP 服务器指南](/blog/building-custom-mcp-servers-openclaw) 提供了端到端的完整说明。关于共享实例的生产安全加固，请参阅 [OpenClaw 安全指南](/blog/hardening-openclaw-security)。*
