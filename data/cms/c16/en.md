---
title: "Multi-User OpenClaw: Shared Deployments, Permissions, and Team Configuration"
description: "How to run OpenClaw for a team: user isolation, shared system prompts, per-user API keys, access control by model and tool, and usage tracking. Real configuration examples for 2026."
publishedAt: 2026-03-17
status: published
visibility: public
---

# Multi-User OpenClaw: Shared Deployments, Permissions, and Team Configuration

Running OpenClaw for yourself is straightforward. Running it for a team of ten engineers with different access levels, cost centers, and knowledge domains is a different problem entirely. I've gone through this setup twice now — once for a five-person startup and once for a larger engineering organization where billing accountability was non-negotiable. This guide documents what I learned.

The short version: OpenClaw supports multi-user deployments well, but the configuration surface is large and the failure modes are non-obvious. Context leakage between users, runaway costs attributed to the wrong team, and accidental model access are all real problems that require deliberate architecture. Let's work through them systematically.

## Why a Shared OpenClaw Instance Makes Sense

The naive approach is to give every developer their own OpenClaw installation. This seems clean but creates coordination nightmares: you can't enforce consistent system prompts, you can't track costs centrally, you can't push MCP server updates, and you have no audit trail. Individual installations also mean every developer manages their own API keys, which is a security problem at scale.

A shared OpenClaw instance gives you:

- **Central key management**: API keys for Anthropic, OpenAI, and other providers live in one place. Developers never see the actual keys.
- **Consistent system prompts**: Company guidelines, coding standards, and safety rules apply to everyone automatically.
- **Unified billing**: One place to see who is spending what on which models.
- **Shared MCP servers**: Your internal tools — code search, database introspection, issue trackers — are available to everyone without per-user configuration.
- **Audit logs**: You know who asked what, when, and which model responded.

The tradeoff is operational complexity. You're now running infrastructure that your team depends on, so reliability matters. Plan for this upfront.

## The Access Control Model

Before writing a single config line, decide on your access model. OpenClaw uses a layered permission system:

1. **Authentication**: Who is this user? (JWT tokens, API keys per user, or SSO)
2. **Model access**: Which AI models can this user call?
3. **Tool access**: Which tools (web search, code execution, file access) can they use?
4. **MCP server access**: Which MCP servers are available to them?
5. **Rate limits**: How many requests per hour? What's the token budget?
6. **Context isolation**: Are conversations separated between users?

Here's the mental model I use: think in roles, not individuals. Roles are defined once and applied to users. Users can have multiple roles.

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

## User Configuration and API Key Isolation

Each user gets their own entry in the users config. Critically, users do not manage their own API keys for upstream providers — the shared OpenClaw instance holds those. What users do have is a personal OpenClaw access token that they use to authenticate to the shared instance.

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

The `cost_center` field is important. Every API call made through this user's session gets tagged with their cost center, which flows into your billing reports. This is how you answer "how much did the frontend team spend on AI last month?" without guesswork.

## Shared System Prompts

The power of a shared instance is consistent behavior. Your company's coding standards, security guidelines, and behavioral rules should be applied to every user automatically. OpenClaw handles this through a layered system prompt architecture.

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

# User-level overrides stack on top of team prompts
# (configured per-user as shown in users.yaml)
```

The layering order is: `global → team → user-override → conversation`. Users see a consistent base behavior, but team context and individual context are layered on top. They never see the global prompt directly — it's injected at the system level.

## Conversation Isolation

This is where most multi-user setups go wrong. Conversation isolation means user A cannot see user B's conversations, and more subtly, model context from one user's session does not bleed into another's.

OpenClaw provides three isolation levels:

- **`relaxed`**: Conversations are stored separately, but shared caches (like document embeddings for RAG) can be accessed by all users. Good for teams where cross-pollination is acceptable.
- **`strict`**: Each user's conversation history is completely isolated. Shared knowledge bases are read-only and only from explicitly approved sources.
- **`paranoid`**: Full isolation. No shared caches. Even MCP server connection pools are per-user. Use this for contractors and external collaborators.

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

The conversation storage backend matters a lot at scale. For a five-person team, SQLite is fine. For twenty or more users with high request volume, use PostgreSQL with proper connection pooling. The encryption-at-rest requirement is non-negotiable for anything going through a security review.

## Team-Specific MCP Server Configuration

MCP servers are where multi-user configuration gets interesting. Your team has internal tools that external users shouldn't access, and different teams need different integrations. See the [MCP servers guide](/blog/building-custom-mcp-servers-openclaw) for building custom servers — this section focuses on access control for existing ones.

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

The `tool_access` section within each MCP server config is a detail many teams skip. It's not enough to say "developers can use the GitHub MCP server." You need to decide whether developers can merge PRs through it. That's a meaningful difference. When I first set up GitHub MCP access without tool-level controls, an enthusiastic developer used it to auto-merge a pull request. The feature worked perfectly; the judgment about when to use it was the problem.

## Billing and Usage Tracking

Cost accountability is the feature that gets you budget approval for running shared infrastructure. If you can't answer "what did team X spend on AI last month," you'll spend that meeting on the defensive.

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
  # Generates daily usage reports per cost center
  daily_report:
    enabled: true
    recipients:
      - engineering-leads@company.com
    format: csv  # or json, html

  # Monthly billing summary for finance
  monthly_summary:
    enabled: true
    recipients:
      - finance@company.com
      - cto@company.com
    group_by:
      - cost_center
      - model
```

The `model_access_anomaly` alert is underused but valuable. If your junior developer suddenly starts calling `claude-opus-4` when their role only allows `claude-3-7-sonnet`, either someone's configuration is wrong or something unexpected is happening. Either way, you want to know.

## Handling Common Team Pain Points

### Context Leakage

The most common complaint I hear from teams after going live is "I saw something that looked like another user's conversation." This happens when:

1. Session tokens are shared (developer A gives their token to developer B)
2. The conversation storage backend has a bug in tenant isolation
3. Shared RAG knowledge bases are indexed with user-specific content

The fix for (1) is monitoring: if you see the same token used from two different IPs in a short window, invalidate it and alert. For (2), test your tenant isolation explicitly — write a test that creates two users, stores conversations for both, and verifies that querying as user A never returns user B's data. For (3), audit what goes into your shared knowledge bases. Only company-wide documentation should live there. Personal conversation summaries must not.

### Shared Knowledge Bases Without Leakage

The useful version of shared context is a curated knowledge base. Your engineering wiki, API documentation, and runbooks should be available to everyone. Individual conversations should not.

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
    access: shared_read  # All users with developer role+

  incident_runbooks:
    source: git
    repository: "git@github.com:company/runbooks.git"
    branch: main
    refresh_interval_hours: 1
    access: shared_read
```

The explicit `spaces_denied` list matters. It's easy to say "index all of Confluence" and accidentally pull in HR policies, salary bands, or performance review templates. Deny by default, allow explicitly.

### Cost Allocation Disputes

When a cost center gets their monthly AI spend report and disputes it, you need records granular enough to reconstruct exactly what happened. Your billing backend should store enough to answer: "On March 14th, user bob_harris made 47 requests totaling 124,000 tokens across claude-3-7-sonnet and gpt-4o, costing $1.83." If you can produce that, disputes resolve quickly.

Store raw request logs — not just aggregates — for at least 90 days. Aggregates are fine for dashboards, but raw logs are what you need for audits.

## Security Considerations for Team Deployments

The security surface of a multi-user OpenClaw instance is meaningfully larger than a personal instance. Two things to do before you put this in front of your team:

First, read the [OpenClaw security hardening guide](/blog/hardening-openclaw-security). The basics — TLS everywhere, secret management via environment variables or Vault, network isolation for the OpenClaw process — are covered there.

Second, add authentication at the network layer, not just the application layer. Put your shared OpenClaw instance behind a VPN or zero-trust gateway. Authentication at the application layer (JWT validation) is good, but if OpenClaw's port is publicly accessible, you're relying entirely on your application code to prevent unauthorized access.

```yaml
# openclaw/config/auth.yaml
authentication:
  method: jwt
  jwt:
    issuer: "https://auth.company.com"
    audience: "openclaw-internal"
    public_key_env: JWT_PUBLIC_KEY
    algorithm: RS256

  # Or use API key authentication for service accounts
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

## Rollout Strategy

Don't roll out multi-user OpenClaw to your entire team simultaneously. Here's the sequence I recommend:

1. **Week 1**: Deploy with two users (you and one other trusted developer). Validate billing tracking, conversation isolation, and MCP access controls.
2. **Week 2**: Expand to one full team (5–8 people). Monitor the billing dashboard daily. Fix anything unexpected.
3. **Week 3**: Roll out to remaining teams. By this point your configurations are tested and your monitoring is working.

Run the isolation tests before each expansion wave. It takes twenty minutes and will save you from an embarrassing data separation incident.

## What Multi-User OpenClaw Actually Feels Like

Once this is working, the experience for individual developers is almost identical to running OpenClaw personally — except they don't manage API keys, they get access to shared MCP servers they couldn't easily set up themselves, and the team's shared knowledge base is always available in context. The friction goes down because shared infrastructure handles what was previously per-developer setup.

For the team lead or platform engineer running the deployment, it becomes infrastructure management. You'll spend time on capacity planning, keeping model pricing tables current, and occasionally revoking a token when a contractor's engagement ends. That's the right tradeoff. The alternative — twenty developers with twenty separate OpenClaw instances and twenty sets of API keys — is chaos that scales poorly.

The configuration complexity upfront is real. But once it's done, it's done. You don't rebuild it for each new hire; you just create a user entry and assign a role.

---

*If you're building custom MCP servers to integrate with your team's internal tools, the [MCP servers guide](/blog/building-custom-mcp-servers-openclaw) covers that end-to-end. For production security hardening of your shared instance, see the [OpenClaw security guide](/blog/hardening-openclaw-security).*
