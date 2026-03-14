---
title: "Многопользовательский OpenClaw: совместные развёртывания, права доступа и командная конфигурация"
description: "Как запустить OpenClaw для команды: изоляция пользователей, общие системные промпты, API-ключи на пользователя, контроль доступа по моделям и инструментам, отслеживание использования. Реальные примеры конфигурации 2026 года."
publishedAt: 2026-03-17
status: published
visibility: public
---

# Многопользовательский OpenClaw: совместные развёртывания, права доступа и командная конфигурация

Запустить OpenClaw для себя несложно. Запустить его для команды из десяти инженеров с разными уровнями доступа, центрами затрат и областями знаний — совершенно другая задача. Я прошёл через этот процесс дважды: однажды для стартапа из пяти человек и ещё раз для крупной инженерной организации, где строгий учёт затрат был обязательным требованием. Это руководство документирует то, чему я научился.

Если коротко: OpenClaw хорошо поддерживает многопользовательские развёртывания, но область конфигурации обширна, а режимы отказов неочевидны. Утечка контекста между пользователями, неконтролируемые расходы, приписанные не той команде, и случайный доступ к моделям — всё это реальные проблемы, требующие продуманной архитектуры. Разберём их по порядку.

## Почему общий экземпляр OpenClaw имеет смысл

Самый простой подход — дать каждому разработчику собственную установку OpenClaw. Это выглядит аккуратно, но порождает координационный хаос: нельзя применить единые системные промпты, нельзя централизованно отслеживать расходы, нельзя обновлять MCP-серверы, нет журнала аудита. Индивидуальные установки также означают, что каждый разработчик управляет собственными API-ключами — при масштабировании это становится проблемой безопасности.

Общий экземпляр OpenClaw даёт:

- **Централизованное управление ключами**: API-ключи Anthropic, OpenAI и других провайдеров хранятся в одном месте. Разработчики никогда не видят реальные ключи.
- **Единые системные промпты**: корпоративные правила, стандарты кодирования и требования безопасности применяются ко всем автоматически.
- **Единый биллинг**: одно место, где видно, кто сколько тратит на каких моделях.
- **Общие MCP-серверы**: внутренние инструменты — поиск по коду, интроспекция базы данных, системы отслеживания задач — доступны всем без индивидуальной настройки.
- **Журналы аудита**: известно, кто что спрашивал, когда и какая модель отвечала.

Компромисс — операционная сложность. Теперь вы управляете инфраструктурой, от которой зависит команда, поэтому надёжность важна. Планируйте это заранее.

## Модель контроля доступа

Прежде чем написать хоть одну строку конфигурации, определитесь с моделью доступа. OpenClaw использует многоуровневую систему разрешений:

1. **Аутентификация**: кто этот пользователь? (JWT-токены, API-ключи на пользователя или SSO)
2. **Доступ к моделям**: какие AI-модели может вызывать этот пользователь?
3. **Доступ к инструментам**: какими инструментами (веб-поиск, выполнение кода, доступ к файлам) он может пользоваться?
4. **Доступ к MCP-серверам**: какие MCP-серверы ему доступны?
5. **Ограничения частоты**: сколько запросов в час? Каков лимит токенов?
6. **Изоляция контекста**: изолированы ли разговоры между пользователями?

Моя ментальная модель: думайте ролями, а не людьми. Роли определяются один раз и назначаются пользователям. У пользователя может быть несколько ролей.

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

## Конфигурация пользователей и изоляция API-ключей

У каждого пользователя есть своя запись в конфигурации users. Принципиально важно: пользователи не управляют API-ключами для провайдеров — их хранит общий экземпляр OpenClaw. У пользователей есть личный токен доступа OpenClaw, который используется для аутентификации в общем экземпляре.

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

Поле `cost_center` очень важно. Каждый API-вызов через сессию этого пользователя помечается его центром затрат и попадает в отчёты о расходах. Именно так вы отвечаете на вопрос «сколько потратила команда фронтенда на AI в прошлом месяце?» без догадок.

## Общие системные промпты

Сила общего экземпляра — единообразное поведение. Стандарты кодирования, правила безопасности и поведенческие нормы компании должны автоматически применяться ко всем пользователям. OpenClaw реализует это через многоуровневую архитектуру системных промптов.

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

Порядок уровней: `глобальный → командный → переопределение пользователя → разговор`. Пользователи видят единообразное базовое поведение, а командный и личный контексты накладываются поверх. Глобальный промпт они не видят напрямую — он инжектируется на системном уровне.

## Изоляция разговоров

Здесь ошибается большинство многопользовательских установок. Изоляция разговоров означает, что пользователь A не видит разговоры пользователя B, и что более тонко — контекст модели одной сессии не «просачивается» в другую.

OpenClaw предоставляет три уровня изоляции:

- **`relaxed` (мягкий)**: разговоры хранятся отдельно, но общие кэши (например, векторные вложения документов для RAG) доступны всем пользователям. Подходит командам, где перекрёстный обмен допустим.
- **`strict` (строгий)**: история разговоров каждого пользователя полностью изолирована. Общие базы знаний — только для чтения и только из явно одобренных источников.
- **`paranoid` (параноидальный)**: полная изоляция. Нет общих кэшей. Даже пулы соединений MCP-серверов — на пользователя. Используйте для подрядчиков и внешних сотрудников.

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

Бэкенд хранилища разговоров сильно важен при масштабировании. Для пяти человек SQLite достаточно. Для двадцати и более с высоким объёмом запросов используйте PostgreSQL с правильным пулом соединений. Шифрование при хранении — обязательное требование для всего, что проходит проверку безопасности.

## Командная конфигурация MCP-серверов

MCP-серверы — это то место, где многопользовательская конфигурация становится интересной. В вашей команде есть внутренние инструменты, к которым внешние пользователи не должны иметь доступа, а разным командам нужны разные интеграции. Для создания пользовательских серверов смотрите [руководство по MCP-серверам](/blog/building-custom-mcp-servers-openclaw) — этот раздел сосредоточен на контроле доступа для существующих.

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

Раздел `tool_access` в конфигурации каждого MCP-сервера — деталь, которую многие команды пропускают. Недостаточно сказать «разработчики могут использовать GitHub MCP-сервер». Нужно решить, могут ли они через него сливать PR. Это существенная разница. Когда я впервые настроил доступ к GitHub MCP без контроля на уровне инструментов, энтузиаст-разработчик использовал его для автоматического слияния pull request. Функция работала идеально; проблема была в суждении о том, когда её использовать.

## Биллинг и отслеживание использования

Учёт затрат — это функция, которая позволяет получить одобрение бюджета на запуск общей инфраструктуры. Если вы не можете ответить на вопрос «сколько потратила команда X на AI в прошлом месяце?», на той встрече придётся только защищаться.

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

Оповещение `model_access_anomaly` используется редко, но ценно. Если младший разработчик вдруг начинает вызывать `claude-opus-4`, а его роль разрешает только `claude-3-7-sonnet`, значит либо конфигурация неправильная, либо происходит что-то неожиданное. В любом случае об этом нужно знать.

## Решение типичных командных проблем

### Утечка контекста

Самая частая жалоба, которую я слышу от команд после запуска: «я видел что-то похожее на разговор другого пользователя». Это происходит когда:

1. Session-токены используются совместно (разработчик A передал свой токен разработчику B)
2. В бэкенде хранилища разговоров есть баг в изоляции тенантов
3. В общие базы знаний RAG проиндексирован пользовательский контент

Решение (1) — мониторинг: если один и тот же токен используется с двух разных IP за короткий промежуток времени, немедленно аннулируйте его и отправьте оповещение. Для (2) явно протестируйте изоляцию тенантов — напишите тест, который создаёт двух пользователей, сохраняет разговоры для обоих и проверяет, что запрос от пользователя A никогда не возвращает данные пользователя B. Для (3) проверяйте, что попадает в общие базы знаний. Там должна быть только документация уровня компании. Личные итоги разговоров — ни в коем случае.

### Общие базы знаний без утечек

Полезная форма общего контекста — тщательно отобранная база знаний. Инженерная вики, документация API и runbook-ы должны быть доступны всем. Личные разговоры — нет.

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

Явный список `spaces_denied` важен. Легко сказать «индексировать весь Confluence» и случайно втянуть HR-политики, диапазоны зарплат или шаблоны аттестаций. Запрещать по умолчанию, явно разрешать.

### Споры по распределению затрат

Когда центр затрат получает месячный отчёт о расходах на AI и оспаривает его, вам нужны достаточно детальные записи, чтобы восстановить картину. Биллинговый бэкенд должен хранить достаточно данных, чтобы ответить: «14 марта пользователь bob_harris сделал 47 запросов, израсходовав 124 000 токенов на claude-3-7-sonnet и gpt-4o, стоимостью $1,83.» Если вы можете это предоставить, споры разрешаются быстро.

Храните необработанные журналы запросов — не только агрегаты — минимум 90 дней. Агрегаты подходят для дашбордов, но для аудита нужны «сырые» логи.

## Соображения по безопасности при командном развёртывании

Поверхность атаки многопользовательского экземпляра OpenClaw значительно больше, чем у личного. Сделайте две вещи до того, как предоставите его команде.

Во-первых, прочитайте [руководство по усилению безопасности OpenClaw](/blog/hardening-openclaw-security). Основное — TLS везде, управление секретами через переменные среды или Vault, сетевая изоляция процесса OpenClaw — описано там.

Во-вторых, добавьте аутентификацию на сетевом уровне, а не только на прикладном. Разместите общий экземпляр OpenClaw за VPN или шлюзом с нулевым доверием. Аутентификация на прикладном уровне (проверка JWT) — это хорошо, но если порт OpenClaw доступен публично, защита от несанкционированного доступа полностью зависит от кода приложения.

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

## Стратегия развёртывания

Не разворачивайте многопользовательский OpenClaw на всю команду одновременно. Рекомендуемая последовательность:

1. **Неделя 1**: разверните только с двумя пользователями (вы и один доверенный разработчик). Проверьте отслеживание биллинга, изоляцию разговоров и контроль доступа MCP.
2. **Неделя 2**: расширьте до одной полной команды (5–8 человек). Ежедневно следите за дашбордом биллинга. Исправляйте всё неожиданное.
3. **Неделя 3**: разверните для остальных команд. К этому моменту конфигурации протестированы, мониторинг работает.

Перед каждым расширением выполняйте тесты изоляции. Это займёт двадцать минут и убережёт от неловкого инцидента с разделением данных.

## Как на самом деле ощущается многопользовательский OpenClaw

Когда это работает, опыт отдельного разработчика практически идентичен личному использованию OpenClaw — только не нужно управлять API-ключами, есть доступ к общим MCP-серверам, которые сложно настроить самостоятельно, и общая база знаний команды всегда доступна в контексте. Трений меньше, потому что общая инфраструктура берёт на себя то, что раньше настраивал каждый разработчик индивидуально.

Для тимлида или платформенного инженера, управляющего развёртыванием, это превращается в управление инфраструктурой. Придётся заниматься планированием мощностей, поддерживать актуальность таблиц стоимости моделей и периодически отзывать токены при завершении контрактов. Это правильный компромисс. Альтернатива — двадцать разработчиков с двадцатью отдельными установками OpenClaw и двадцатью наборами API-ключей — это хаос, который плохо масштабируется.

Сложность настройки на старте — реальная. Но когда она сделана, она сделана. Не нужно переделывать её для каждого нового сотрудника; просто создайте запись пользователя и назначьте роль.

---

*Если вы создаёте собственные MCP-серверы для интеграции с внутренними инструментами команды, [руководство по MCP-серверам](/blog/building-custom-mcp-servers-openclaw) охватывает весь процесс от начала до конца. Для усиления безопасности общего экземпляра в продакшене смотрите [руководство по безопасности OpenClaw](/blog/hardening-openclaw-security).*
