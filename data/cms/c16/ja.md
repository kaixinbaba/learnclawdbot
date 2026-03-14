---
title: "マルチユーザー OpenClaw：共有デプロイ、権限管理、チーム設定"
description: "チームで OpenClaw を運用する方法：ユーザー分離、共有システムプロンプト、ユーザーごとの API キー、モデルとツールによるアクセス制御、使用量の追跡。2026 年の実際の設定例付き。"
publishedAt: 2026-03-17
status: published
visibility: public
---

# マルチユーザー OpenClaw：共有デプロイ、権限管理、チーム設定

自分用に OpenClaw を動かすのは簡単です。しかし、アクセスレベル、コストセンター、知識領域がそれぞれ異なる 10 人規模のエンジニアチームのために動かすのは、まったく別の問題です。私はこのセットアップを 2 度経験しました。1 度目は 5 人のスタートアップ、2 度目は請求の説明責任が絶対条件だった大規模エンジニアリング組織です。この記事は、そこで学んだことをまとめたものです。

端的に言うと、OpenClaw はマルチユーザーデプロイに十分対応できますが、設定の範囲が広く、障害のパターンも直感的ではありません。ユーザー間のコンテキスト漏洩、誤ったチームに帰属する暴走コスト、意図しないモデルへのアクセス——これらはいずれも意図的なアーキテクチャ設計で解決が必要な現実の問題です。順を追って体系的に見ていきましょう。

## 共有 OpenClaw インスタンスが有効な理由

最も単純なアプローチは、各開発者に独自の OpenClaw インストールを提供することです。これはすっきりしているように見えますが、調整上の悪夢を生み出します。一貫したシステムプロンプトを強制できない、コストを一元管理できない、MCP サーバーの更新を展開できない、監査証跡もない。個別インストールはまた、各開発者が自分の API キーを管理することも意味し、規模が大きくなるとセキュリティ上の問題になります。

共有 OpenClaw インスタンスがもたらすメリット：

- **集中キー管理**：Anthropic、OpenAI などのプロバイダーの API キーを一箇所に集約。開発者は実際のキーを見ることがありません。
- **一貫したシステムプロンプト**：会社のガイドライン、コーディング規約、安全ルールが自動的に全員に適用されます。
- **統一した請求管理**：誰がどのモデルにいくら使っているかを一箇所で確認できます。
- **共有 MCP サーバー**：社内ツール——コード検索、データベース内省、課題トラッカー——を、ユーザーごとの設定なしに全員が利用できます。
- **監査ログ**：誰がいつ何を尋ね、どのモデルが応答したかを把握できます。

トレードオフは運用の複雑さです。チームが依存するインフラを運用することになるため、信頼性が重要です。事前に計画してください。

## アクセス制御モデル

設定を 1 行も書く前に、アクセス制御モデルを決めましょう。OpenClaw は階層型の権限システムを使用しています。

1. **認証**：このユーザーは誰か？（JWT トークン、ユーザーごとの API キー、または SSO）
2. **モデルアクセス**：このユーザーはどの AI モデルを呼び出せるか？
3. **ツールアクセス**：どのツール（ウェブ検索、コード実行、ファイルアクセス）を使えるか？
4. **MCP サーバーアクセス**：どの MCP サーバーが利用可能か？
5. **レート制限**：1 時間あたりのリクエスト数は？トークン予算は？
6. **コンテキスト分離**：ユーザー間で会話は分離されているか？

私が使っているメンタルモデルは、個人ではなくロールで考えることです。ロールは一度定義し、ユーザーに適用します。ユーザーは複数のロールを持てます。

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

## ユーザー設定と API キーの分離

各ユーザーは users 設定に独自のエントリを持ちます。重要な点は、ユーザーが上流プロバイダーの API キーを管理しないことです——それらは共有 OpenClaw インスタンスが保持します。ユーザーが持つのは、共有インスタンスへの認証に使う個人の OpenClaw アクセストークンです。

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

`cost_center` フィールドは重要です。このユーザーのセッションを通じたすべての API 呼び出しには、そのコストセンターがタグ付けされ、請求レポートに反映されます。「先月フロントエンドチームが AI にいくら使ったか」を推測なしに答えられるのはこのためです。

## 共有システムプロンプト

共有インスタンスの力は一貫した動作にあります。会社のコーディング規約、セキュリティガイドライン、行動ルールは自動的に全ユーザーに適用されるべきです。OpenClaw は階層型システムプロンプトアーキテクチャでこれを実現します。

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

レイヤーの順序は `グローバル → チーム → ユーザーオーバーライド → 会話` です。ユーザーは一貫したベースの動作を見ますが、チームコンテキストと個人コンテキストがその上に重なります。グローバルプロンプトをユーザーが直接見ることはありません——それはシステムレベルで注入されます。

## 会話の分離

ここが、ほとんどのマルチユーザーセットアップが失敗する場所です。会話の分離とは、ユーザー A がユーザー B の会話を見られないこと、そしてより微妙な問題として、あるユーザーのセッションのモデルコンテキストが別のユーザーのセッションに漏れ出ないことを意味します。

OpenClaw は 3 つの分離レベルを提供します：

- **`relaxed`（緩い）**：会話は別々に保存されますが、共有キャッシュ（RAG 用の文書埋め込みなど）はすべてのユーザーがアクセスできます。相互共有を許容するチームに適しています。
- **`strict`（厳格）**：各ユーザーの会話履歴は完全に分離されます。共有ナレッジベースは読み取り専用で、明示的に承認されたソースからのみアクセスできます。
- **`paranoid`（偏執的）**：完全分離。共有キャッシュなし。MCP サーバーの接続プールさえもユーザーごとに分かれます。外部協力者や請負業者に使用してください。

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

会話ストレージのバックエンドは規模に応じて重要です。5 人チームなら SQLite で十分です。20 人以上でリクエスト量が多い場合は、適切な接続プールを持つ PostgreSQL を使ってください。保存時の暗号化は、セキュリティレビューを通過する必要がある場合に絶対に外せない要件です。

## チーム専用の MCP サーバー設定

MCP サーバーは、マルチユーザー設定が興味深くなる部分です。チームには外部ユーザーがアクセスすべきでない社内ツールがあり、チームごとに異なる統合が必要です。カスタムサーバーの構築については [MCP サーバーガイド](/blog/building-custom-mcp-servers-openclaw) を参照してください。このセクションでは既存サーバーのアクセス制御に焦点を当てます。

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

各 MCP サーバー設定内の `tool_access` セクションは、多くのチームが省略する詳細です。「開発者は GitHub MCP サーバーを使える」というだけでは不十分です。開発者がそれを通じて PR をマージできるかどうかを決める必要があります。それは意味のある違いです。私が最初にツールレベルの制御なしで GitHub MCP アクセスを設定したとき、熱心な開発者がそれを使って pull request を自動マージしました。機能は完璧に動作しました。問題は、いつ使うかという判断でした。

## 請求と使用量の追跡

コストの説明責任は、共有インフラ運用の予算承認を得るための機能です。「チーム X が先月 AI に何を使ったか」に答えられなければ、その会議は守りの姿勢しか取れません。

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

`model_access_anomaly` アラートは使われていないことが多いですが、価値があります。初級開発者が突然 `claude-opus-4` を呼び出し始めたとき、そのロールでは `claude-3-7-sonnet` しか許可されていないなら、設定ミスか予期しない何かが起きています。どちらにせよ、知っておく必要があります。

## チームの共通の課題への対処

### コンテキスト漏洩

本番稼働後に最もよく聞くのは「他のユーザーの会話のようなものを見た」という訴えです。これが起きる原因：

1. Session トークンが共有されている（開発者 A が自分のトークンを開発者 B に渡した）
2. 会話ストレージバックエンドのテナント分離にバグがある
3. 共有 RAG ナレッジベースにユーザー固有のコンテンツがインデックスされている

(1) の解決策はモニタリングです。短時間に同じトークンが 2 つの異なる IP から使われたら、即座に無効化してアラートを出します。(2) については、テナント分離を明示的にテストしてください。2 人のユーザーを作成し、両者の会話を保存し、ユーザー A として照会したときにユーザー B のデータが返ってこないことを確認するテストを書きましょう。(3) については、共有ナレッジベースに入れるものを監査してください。そこには会社全体向けのドキュメントだけが入るべきです。個人の会話まとめは絶対に入れてはなりません。

### 漏洩のない共有ナレッジベース

共有コンテキストの有用な形は、厳選されたナレッジベースです。エンジニアリング Wiki、API ドキュメント、ランブックは全員が利用できるべきです。個人の会話はそうではありません。

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

明示的な `spaces_denied` リストは重要です。「Confluence 全体をインデックスする」と言うのは簡単ですが、HR ポリシー、給与水準、人事評価テンプレートを誤って取り込む可能性があります。デフォルトで拒否し、明示的に許可しましょう。

### コスト配分の争議

コストセンターが月次の AI 支出レポートを受け取って異議を申し立てる場合、何が起きたかを再構築するのに十分な粒度の記録が必要です。請求バックエンドは次のように答えられるだけの情報を保存すべきです：「3 月 14 日、ユーザー bob_harris は claude-3-7-sonnet と gpt-4o にわたって合計 124,000 トークンの 47 リクエストを行い、費用は 1.83 ドルでした。」これを提示できれば、争議はすぐに解決します。

集計データだけでなく、生のリクエストログを少なくとも 90 日間保存してください。集計データはダッシュボードには十分ですが、監査には生ログが必要です。

## チームデプロイのセキュリティ考慮事項

マルチユーザー OpenClaw インスタンスの攻撃面は、個人用インスタンスよりも大幅に大きくなります。チームに展開する前に 2 つのことをしてください。

まず、[OpenClaw セキュリティ強化ガイド](/blog/hardening-openclaw-security) を読んでください。基本——全面 TLS、環境変数または Vault によるシークレット管理、OpenClaw プロセスのネットワーク分離——はそこで説明されています。

次に、アプリケーション層だけでなく、ネットワーク層でも認証を追加してください。共有 OpenClaw インスタンスを VPN またはゼロトラストゲートウェイの後ろに置いてください。アプリケーション層の認証（JWT 検証）は良いのですが、OpenClaw のポートが公開されていれば、不正アクセスを防ぐためにアプリケーションコードのみに頼ることになります。

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

## 展開戦略

マルチユーザー OpenClaw をチーム全体に一度に展開しないでください。私が推奨する順序：

1. **第 1 週**：2 人のユーザー（あなたと信頼できる開発者 1 人）のみでデプロイ。請求追跡、会話分離、MCP アクセス制御を検証する。
2. **第 2 週**：1 つのチーム全体（5〜8 人）に拡大。請求ダッシュボードを毎日監視し、予期しないことがあれば修正する。
3. **第 3 週**：残りのチームに展開。この時点で設定がテスト済みで、モニタリングも機能しています。

各拡大フェーズの前に分離テストを実行してください。20 分かかりますが、恥ずかしいデータ分離インシデントを防ぐことができます。

## マルチユーザー OpenClaw の実際の使い心地

これが動いたとき、個々の開発者にとっての体験は OpenClaw を個人で使う場合とほぼ同じです——ただし API キーの管理が不要で、自分では簡単にセットアップできなかった共有 MCP サーバーにアクセスでき、チームの共有ナレッジベースが常にコンテキストで利用できます。共有インフラが、以前は開発者ごとに個別に設定していたものを担ってくれるため、摩擦が減ります。

デプロイを担当するチームリードやプラットフォームエンジニアにとっては、これはインフラ管理になります。キャパシティプランニング、モデル価格テーブルの更新、請負業者の契約終了時のトークン失効処理に時間を費やすことになります。それは正しいトレードオフです。代替案——20 人の開発者、20 個の独立した OpenClaw インスタンス、20 セットの API キー——は、規模が拡大するにつれて悪化する混乱です。

最初の設定の複雑さは確かに存在します。でも一度完成すれば、それで終わりです。新しい人が入るたびに最初からやり直す必要はありません。ユーザーエントリを作成してロールを割り当てるだけです。

---

*チームの社内ツールを統合するためのカスタム MCP サーバーを構築している場合は、[MCP サーバーガイド](/blog/building-custom-mcp-servers-openclaw) にエンドツーエンドの説明があります。共有インスタンスの本番セキュリティ強化については、[OpenClaw セキュリティガイド](/blog/hardening-openclaw-security) を参照してください。*
