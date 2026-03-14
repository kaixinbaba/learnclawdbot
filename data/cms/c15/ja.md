---
title: "OpenClaw のセキュリティ強化：API キー管理、認証、ネットワークセキュリティ"
description: "OpenClaw デプロイメントの実践的なセキュリティガイド。API キーのローテーション、nginx リバースプロキシ、レート制限、ネットワーク分離、個人・チーム環境における監査ログを解説。"
publishedAt: 2026-03-16
status: published
visibility: public
---

# OpenClaw のセキュリティ強化：API キー管理、認証、ネットワークセキュリティ

OpenClaw はインターネットに公開されることを前提として設計されています。ゲートウェイとして運用する意義はまさにそこにあります —— スマートフォン、カフェのラップトップ、チームメンバーのマシン、これらすべてが単一の管理されたエンドポイントにアクセスできる。インターネットに何かを公開した瞬間、誰かがそれを探索し始めます。通常、数分以内に。

私は自分の本番 OpenClaw 環境を強化するために週末を費やしました。nginx のログに不審なトラフィックを発見したのがきっかけです。普通のボットノイズに見えたリクエストは、実際には既知の API パスを探索するパターンでした。私のインスタンスは十分に堅牢だったので何も通過しませんでしたが、これはデフォルト設定では不十分だという有益な警告でした。

この記事は私が実際に運用しているものを記録しています。理論的なセキュリティ強化の助言ではなく、個人運用からチーム運用まで、実際の OpenClaw デプロイメントを保護するための具体的な設定とコマンドです。

## 攻撃面の把握

何かを設定する前に、実際に何を公開しているのかをマッピングする価値があります。

典型的な OpenClaw デプロイメントには 4 つの異なる攻撃面があります：

1. **HTTP ゲートウェイエンドポイント** —— クライアントがリクエストを送信する場所。これが公開されていれば、攻撃者はここを最初に狙います。
2. **OpenClaw 管理インターフェース** —— 有効な場合、プラグイン、ルート、API キーを管理します。絶対に公開してはいけません。
3. **上流 API キーを含む環境** —— Anthropic キー、OpenAI キー、DeepSeek キー。これらが漏洩すると、他人の利用費を支払うことになります。
4. **OpenClaw プロセス自体** —— Node.js ランタイム、その依存関係、アクセスできるファイルシステム。

ほとんどのチュートリアルは攻撃面 #1 を公開する方法のみを示し、#2 については何も言わず、#3 と #4 を完全に無視します。これを解決しましょう。

## API キー管理

ここは人々が最もコストの高い失敗を犯す場所です。Anthropic の API キーを `openclaw.config.yaml` に直接書き込み、そのファイルを公開 GitHub リポジトリにコミットして、1 週間後に 400 ドルの請求書を前に困惑している人を見たことがあります。

### 設定ファイルに API キーを保存しない

OpenClaw は上流プロバイダーの認証情報を環境変数から読み取ります。環境変数を使用してください。

```yaml
# Bad: key directly in config
# openclaw.config.yaml
providers:
  anthropic:
    apiKey: "sk-ant-api03-XXXX"  # Never do this

# Good: reference an env variable
providers:
  anthropic:
    apiKey: "${ANTHROPIC_API_KEY}"
```

こうすれば `openclaw.config.yaml` はシークレットを含まないため、バージョン管理に安全に保存できます。

### systemd での .env ファイルの使用

OpenClaw を systemd サービスとして実行している場合（Linux サーバーではそうすべきです）、シークレットを注入する正しい方法は `EnvironmentFile` を使うことです：

```ini
# /etc/systemd/system/openclaw.service
[Unit]
Description=OpenClaw AI Gateway
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
EnvironmentFile=/etc/openclaw/secrets.env
ExecStart=/usr/bin/node /opt/openclaw/dist/index.js
Restart=always
RestartSec=10

# Lock down the process
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/log/openclaw /var/lib/openclaw

[Install]
WantedBy=multi-user.target
```

```bash
# /etc/openclaw/secrets.env
# chmod 600, owned by root
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-key
OPENCLAW_GATEWAY_SECRET=your-long-random-gateway-secret
```

```bash
# Permissions — this is critical
sudo chmod 600 /etc/openclaw/secrets.env
sudo chown root:root /etc/openclaw/secrets.env
```

`ProtectSystem=strict` と関連する systemd オプションは、プロセスが書き込める場所を制限します。Node.js プロセスが侵害されても、任意のファイルシステム上の場所に書き込むことはできません。

### クライアント API キーのローテーション

OpenClaw は独自の API キーをクライアントに発行することをサポートしています —— リクエストを上流に転送する前にこれらのキーを検証します。上流プロバイダーのキーとは異なる扱いをしてください。

十分なエントロピーでクライアントキーを生成します：

```bash
openssl rand -hex 32
# Output: a64f3b8c9d2e1f7a5b4c8d3e9f2a7b6c4d8e3f9a2b7c6d5e4f3a2b1c9d8e7f6
```

クライアントキーは次のようにすべきです：

- **ユーザーごとではなくクライアントごと**：OpenClaw を呼び出す各アプリケーションやサービスが独自のキーを持ち、各人が持つのではない。これにより、単一の侵害された統合を他のすべてに影響を与えることなく取り消せます。
- **スケジュールに従ってローテーション**：私は 90 日ごとにローテーションしています。カレンダーに入れてください。新しいキーを発行するときは、クライアントがダウンタイムなく移行できるよう、古いキーを 48 時間有効に保ちます。
- **疑いがあればすぐにローテーション**：キーが漏洩したり、異常な使用パターンが見られた場合は、直ちに取り消してください。48 時間の猶予期間は計画的なローテーション専用です。

```yaml
# openclaw.config.yaml — client key configuration
auth:
  mode: "api-key"
  keys:
    - id: "mobile-app-prod"
      key: "${CLIENT_KEY_MOBILE_APP}"
      scopes: ["chat", "completion"]
      rateLimit:
        requestsPerMinute: 60
        tokensPerDay: 500000
    - id: "internal-tooling"
      key: "${CLIENT_KEY_INTERNAL}"
      scopes: ["chat", "completion", "admin:read"]
      rateLimit:
        requestsPerMinute: 120
        tokensPerDay: 2000000
```

スコープシステムにより、異なるクライアントに異なる権限を付与できます。モバイルアプリは `admin:read` を必要としません。最小権限の原則はデータベースユーザーと全く同様にここでも適用されます。

## nginx リバースプロキシの設定

OpenClaw をポート 80 や 443 に直接公開すべきではありません。高いポート番号（3000、8080 など）で実行し、前に nginx を置いてください。これにより TLS 終端、レート制限、リクエストフィルタリング、アクセスロギングが得られます —— OpenClaw のコードに触れることなく。

### 基本的な nginx 設定

```nginx
# /etc/nginx/sites-available/openclaw
upstream openclaw_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # TLS configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Hide nginx version
    server_tokens off;

    # Request size limit — 10MB is generous for most AI API use
    client_max_body_size 10m;

    # Proxy to OpenClaw
    location / {
        proxy_pass http://openclaw_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — AI responses can be slow
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Block the admin interface from external access
    location /admin {
        deny all;
        return 403;
    }

    # Block common probe paths
    location ~* \.(php|asp|aspx|jsp)$ {
        deny all;
        return 404;
    }
}
```

Certbot で無料の TLS 証明書を取得します：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot は自動更新します。`sudo certbot renew --dry-run` で確認してください。

### nginx でのレート制限

nginx の `limit_req` モジュールはブルートフォースや乱用の試みを防ぐ最も効果的な手段の一つです。2 つのレベルで制限を設定します：IP ごとの生の接続レートと、グローバルな総スループット。

```nginx
# /etc/nginx/nginx.conf — add to http block
http {
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=openclaw_ip:10m rate=10r/s;
    limit_req_zone $http_x_client_id zone=openclaw_client:10m rate=30r/s;
    limit_conn_zone $binary_remote_addr zone=openclaw_conn:10m;

    # Log format that includes rate limiting hits
    log_format security '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'limit_req=$limit_req_status '
                        'rt=$request_time';
}
```

```nginx
# In your server block location /
location / {
    # IP-based rate limit: burst of 20, no delay
    limit_req zone=openclaw_ip burst=20 nodelay;
    # Client-ID based limit if the header is present
    limit_req zone=openclaw_client burst=50 nodelay;
    # Max 5 concurrent connections per IP
    limit_conn openclaw_conn 5;

    limit_req_status 429;
    limit_conn_status 429;

    # ... rest of proxy config
}
```

`burst` パラメータはレートを一時的に超えても即座に拒否されないようにします。バッチでリクエストを送信する正当なクライアントにとって重要です。`nodelay` はバーストリクエストがキューに入れられるのではなく即座に通過することを意味します —— API ゲートウェイにとって、キューイングは望まないレイテンシを追加します。

## ネットワーク分離

[Raspberry Pi](/blog/openclaw-raspberry-pi-5) や他のサービスと同居する VPS で OpenClaw を実行している場合、デフォルトではマシン上のすべてのサービスが互いに自由にアクセスできます。単一目的のサーバーならそれでも問題ありません。より複雑な環境では、Docker ネットワークか Linux 名前空間を使って OpenClaw を分離してください。

### Docker ネットワーク分離

```yaml
# docker-compose.yml
version: "3.8"

services:
  openclaw:
    image: openclaw/gateway:latest
    restart: unless-stopped
    env_file:
      - /etc/openclaw/secrets.env
    volumes:
      - ./config:/etc/openclaw/config:ro
      - openclaw-logs:/var/log/openclaw
    networks:
      - internal
    # Do NOT expose port to host — nginx handles that
    expose:
      - "3000"
    # Read-only root filesystem
    read_only: true
    tmpfs:
      - /tmp

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - nginx-cache:/var/cache/nginx
    networks:
      - internal
    depends_on:
      - openclaw

networks:
  internal:
    driver: bridge
    internal: false  # Can still reach external APIs

volumes:
  openclaw-logs:
  nginx-cache:
```

この設定では、OpenClaw のポート 3000 はホストネットワークにバインドされていません。内部 Docker ネットワーク上の nginx コンテナからのみアクセスできます。攻撃者がポート 3000 に到達したとしても（ホスト上にいない限り不可能ですが）、OpenClaw に直接アクセスすることはできません。

### ファイアウォールルール

Docker を使用するかどうかにかかわらず、ファイアウォールを設定してください。Ubuntu/Debian での ufw の使用：

```bash
# Reset to defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (do this first or you'll lock yourself out)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS for nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If you manage it remotely via a jump host, restrict SSH to that IP
# sudo ufw allow from 203.0.113.0/24 to any port 22

# Enable
sudo ufw enable

# Verify
sudo ufw status verbose
```

OpenClaw のポート（3000 または選択したポート）はこのリストに表示されるべきではありません。Docker を使わない場合は明示的に拒否してください：

```bash
sudo ufw deny 3000/tcp
```

### アウトバウンド接続の制限

これは見過ごされがちな点です。デフォルトでは、OpenClaw プロセスが侵害された場合、どこにでもアウトバウンド接続できます —— API キーを外部に漏洩させたり、攻撃者のインフラに接続したりといったことが可能です。

実際に使用するプロバイダー API のみにアウトバウンドを制限します：

```bash
# Using iptables owner module to restrict by system user
# Allow established connections (responses to our requests)
sudo iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow HTTPS to specific provider endpoints only
sudo iptables -A OUTPUT -p tcp --dport 443 -d api.anthropic.com -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 443 -d api.openai.com -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 443 -d api.deepseek.com -j ACCEPT

# Block all other outbound from the openclaw user
sudo iptables -A OUTPUT -m owner --uid-owner openclaw -j DROP
```

これには OpenClaw が専用の `openclaw` システムユーザーとして実行されることが必要です（そもそもそうすべきです）：

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin openclaw
```

## OpenClaw API エンドポイントの保護

### チーム環境での IP 許可リスト

OpenClaw が固定または半固定 IP を持つ既知のユーザー群 —— オフィス、VPN 上のチーム —— に提供される場合、最初の防衛層として許可リストを使用してください。nginx での設定：

```nginx
# Create a geo-based allow map
geo $allowed_client {
    default         0;
    203.0.113.0/24  1;  # Office IP range
    198.51.100.5    1;  # Remote worker
    # Add more as needed
}

server {
    # ...
    location / {
        if ($allowed_client = 0) {
            return 403 "Access denied";
        }
        # ... rest of config
    }
}
```

これは認証の代替ではありません —— OpenClaw に到達する前に探索トラフィックの 99% を排除する補完的な層です。

### チームデプロイメントでの JWT 認証

共有 API キーではなく適切なユーザーごとの身元が必要なチーム環境では、OpenClaw は JWT 検証ミドルウェアをサポートしています。Keycloak、Auth0、Google Workspace など任意の OIDC プロバイダーと組み合わせてください：

```yaml
# openclaw.config.yaml
auth:
  mode: "jwt"
  jwt:
    issuer: "https://your-auth-provider.com"
    audience: "openclaw-gateway"
    jwksUri: "https://your-auth-provider.com/.well-known/jwks.json"
    # Cache JWKS for 1 hour
    jwksCacheTtl: 3600
  # Fall back to API key if JWT not present
  fallback: "api-key"
```

JWT 認証を使用すると、ログに実際のユーザー ID が記録されます —— 「クライアントキー X が 50 件のリクエストを送信した」だけでなく、「alice@yourcompany.com が 50 件のリクエストを送信し、そのうち 20 件が失敗した」というように。これは監査証跡と侵害された個人アカウントを検出するために重要です。

異なるユーザーの代わりに OpenClaw にコールバックする[カスタム MCP サーバー](/blog/building-custom-mcp-servers-openclaw)を構築している場合に特に重要です。共有 API キーでは個人への行動の帰属が失われますが、JWT を使用すれば保持できます。

## 監査ログ

ログはあなたの証拠の連鎖です。何か問題が発生したとき —— ある規模になれば必ず何か起きます —— 何が起きたかを再構築できるほど詳細なログが必要です。

### OpenClaw アクセスログの設定

```yaml
# openclaw.config.yaml
logging:
  level: "info"
  format: "json"
  outputs:
    - type: "file"
      path: "/var/log/openclaw/access.log"
      rotation:
        maxSize: "100m"
        maxFiles: 30
        compress: true
  # What to include in each log entry
  fields:
    - timestamp
    - requestId
    - clientId
    - userId       # from JWT claims if using JWT auth
    - method
    - path
    - statusCode
    - latencyMs
    - inputTokens
    - outputTokens
    - model
    - provider
    - sourceIp
  # Never log these
  redact:
    - "requestBody.messages[*].content"  # Don't log user message content
    - "responseBody"                      # Don't log model responses
```

マスキング設定は意図的なものです。メッセージコンテンツをログに記録するとプライバシーの問題が生じます —— そのログファイルにはユーザーが AI に送信したもの、つまり機密ビジネス情報や個人データが含まれる可能性があります。コンテンツではなくメタデータをログに記録してください。

### ログをサーバー外に転送する

チームデプロイメントでは、サーバー上だけにログを保存するのは不十分です。サーバーが侵害された場合、ログが削除される可能性があります。どこか別の場所に送信してください。

```yaml
# /etc/vector/vector.yaml — using Vector for log forwarding
sources:
  openclaw_logs:
    type: file
    include:
      - "/var/log/openclaw/*.log"

transforms:
  parse_json:
    type: remap
    inputs: ["openclaw_logs"]
    source: |
      . = parse_json!(.message)

sinks:
  elasticsearch:
    type: elasticsearch
    inputs: ["parse_json"]
    endpoint: "https://your-elasticsearch:9200"
    index: "openclaw-logs-%Y.%m.%d"
    auth:
      strategy: "basic"
      user: "${ES_USER}"
      password: "${ES_PASSWORD}"
```

Vector のインストール：

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash
```

独自の ELK スタックを運用していない場合の代替手段：Datadog、Grafana Cloud（無料枠は低ボリュームのログに対応）、または後で分析するための S3 バケットへの構造化ログ。重要な要件はログが生成されたマシンから離れることです。

### 異常に対するアラート

アラートのないログは事後検証ツールであり、セキュリティツールではありません。基本的な異常アラートを設定してください：

```yaml
# Example Grafana alerting rules
alerts:
  - name: "High Error Rate"
    condition: "sum(rate(openclaw_requests_total{status=~'5..'}[5m])) / sum(rate(openclaw_requests_total[5m])) > 0.05"
    message: "OpenClaw error rate exceeded 5% for 5 minutes"

  - name: "Authentication Failures Spike"
    condition: "sum(rate(openclaw_requests_total{status='401'}[5m])) > 10"
    message: "More than 10 auth failures per second — possible credential stuffing"

  - name: "Unusual Token Usage"
    condition: "sum(rate(openclaw_tokens_used_total[1h])) > 1.5 * avg_over_time(sum(rate(openclaw_tokens_used_total[1h]))[7d:1h])"
    message: "Token usage 50% above 7-day baseline — possible key compromise"
```

トークン使用量のアラートは特に価値があります。誰かがクライアントキーを持っていれば、使用します。トークン消費の急激な増加は、多くの場合、侵害の最初の検出可能なシグナルです。

## セットアップチェックリスト

新しいデプロイメントを設定する場合、本番環境として安全な状態に達するための順序です：

```bash
# 1. Create dedicated system user
sudo useradd --system --no-create-home --shell /sbin/nologin openclaw

# 2. Set up secrets file
sudo mkdir -p /etc/openclaw
sudo touch /etc/openclaw/secrets.env
sudo chmod 600 /etc/openclaw/secrets.env
sudo chown root:root /etc/openclaw/secrets.env
# Edit with your actual keys
sudo nano /etc/openclaw/secrets.env

# 3. Install and configure nginx
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com

# 4. Configure firewall
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 5. Install OpenClaw and set ownership
sudo mkdir -p /opt/openclaw
sudo chown openclaw:openclaw /opt/openclaw
# Install per your preferred method

# 6. Copy and enable the systemd service
sudo cp openclaw.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw

# 7. Verify nginx is proxying correctly
curl -I https://api.yourdomain.com/health

# 8. Check logs are writing
sudo tail -f /var/log/openclaw/access.log
```

## 適切さについての注記

セキュリティはコストと利益の計算であり、二項対立ではありません。Tailscale や WireGuard 経由でのみアクセスできる自宅の個人 OpenClaw インスタンスは、公共のインターネットに公開されたチームゲートウェイとは脅威モデルが大きく異なります。

この記事の設定は、複数のクライアントを持つ公開向けゲートウェイで私が実際に運用しているものです。VPN 背後の個人環境では、これらの層の多くは冗長です —— そして複雑さ自体がリスクです。なぜなら、誤った設定の機会を増やすからです。正しいアプローチは各制御を理解し、何から保護するのかを知り、脅威が実際に存在する場所に適用することです。

どんな規模でも省略できないもの：環境変数によるシークレット管理（キーを直書きしない）、TLS（通信を平文にしない）、そして何が起きたかを再構築できるだけの詳細なログ保存。それ以外のすべては実際の露出度に比例します。

nginx のログで見つけた予期しないトラフィックは結局何でもありませんでした —— 自動化されたスキャナーが定期巡回をしていただけです。しかし、自分のセットアップがロックダウンされていることを確認するのに費やした 1 時間は価値がありました。実際のインシデントに対応しているときに防御が不十分だと気づきたくはありません。
