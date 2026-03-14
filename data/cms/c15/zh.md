---
title: "强化 OpenClaw 安全性：API 密钥管理、身份验证与网络安全"
description: "OpenClaw 部署的实用安全指南，涵盖 API 密钥轮换、nginx 反向代理、速率限制、网络隔离以及个人和团队场景下的审计日志配置。"
publishedAt: 2026-03-16
status: published
visibility: public
---

# 强化 OpenClaw 安全性：API 密钥管理、身份验证与网络安全

OpenClaw 天生就是要暴露在互联网上的。这正是将它作为网关运行的全部意义——你希望手机、咖啡店里的笔记本、团队成员的机器，都能访问同一个统一管理的端点。一旦你把任何东西暴露到互联网上，就会有人来探测它。通常几分钟内就会发生。

我花了一个周末时间加固我的生产 OpenClaw 部署，起因是我在 nginx 日志中发现了一些异常流量。那些看起来像普通机器人噪音的东西，实际上是在探测常见 API 路径的规律性请求。我的实例防护得足够好，什么都没有进来，但这是一个有益的提醒：默认配置是不够的。

本文记录的是我实际运行的内容，而非纸上谈兵的安全加固建议——是保护真实 OpenClaw 部署的具体配置和命令，无论你是独立运行还是团队使用。

## 理解攻击面

在进行任何配置之前，有必要梳理清楚你实际暴露的内容。

一个典型的 OpenClaw 部署有四个不同的攻击面：

1. **HTTP 网关端点** — 客户端发送请求的地方。如果这是公开的，攻击者首先就会打它。
2. **OpenClaw 管理界面** — 如果启用的话，它管理插件、路由和 API 密钥。绝对不能公开暴露。
3. **存储上游 API 密钥的环境** — 你的 Anthropic 密钥、OpenAI 密钥、DeepSeek 密钥。一旦泄露，你就要为别人的使用买单。
4. **OpenClaw 进程本身** — Node.js 运行时、其依赖项、它可以访问的文件系统。

大多数教程只告诉你如何暴露第 1 个面，对保护第 2 个面只字不提，完全无视第 3 和第 4 个面。让我们来逐一解决这些问题。

## API 密钥管理

这是人们犯最昂贵错误的地方。我见过有人把 Anthropic API 密钥直接写进 `openclaw.config.yaml`，把那个文件提交到公开的 GitHub 仓库，然后不明白为什么一周后收到了 400 美元的账单。

### 永远不要在配置文件中存储密钥

OpenClaw 通过读取环境变量来获取上游服务商的凭证。请充分利用这一机制。

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

这样，你的 `openclaw.config.yaml` 就可以安全地纳入版本控制——它不包含任何机密信息。

### 搭配 systemd 使用 .env 文件

如果你将 OpenClaw 作为 systemd 服务运行（在任何 Linux 服务器上都应该这样做），注入机密信息的正确方式是通过 `EnvironmentFile`：

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

`ProtectSystem=strict` 以及相关的 systemd 选项限制了进程可以写入的位置。即使 Node.js 进程被攻破，它也无法向任意文件系统位置写入内容。

### 客户端 API 密钥轮换

OpenClaw 支持向客户端签发自己的 API 密钥——它在将请求转发给上游之前会先验证这些密钥。请将这些密钥与你的上游服务商密钥区别对待。

使用足够的熵来生成客户端密钥：

```bash
openssl rand -hex 32
# Output: a64f3b8c9d2e1f7a5b4c8d3e9f2a7b6c4d8e3f9a2b7c6d5e4f3a2b1c9d8e7f6
```

客户端密钥应该：

- **按客户端而非按用户分配**：每个调用 OpenClaw 的应用程序或服务都有自己的密钥，而不是每个人一个密钥。这样，你就可以撤销单个被攻击的集成，而不影响其他一切。
- **按计划定期轮换**：我每 90 天轮换一次。把它加入你的日历。发行新密钥时，保留旧密钥 48 小时的重叠期，让客户端无缝过渡，不影响服务。
- **在可疑情况下立即轮换**：如果密钥泄露或发现异常使用模式，立即撤销。48 小时宽限期仅适用于计划内的轮换。

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

权限范围系统允许你给不同的客户端分配不同的权限。你的移动应用不需要 `admin:read`。最小权限原则在这里的适用方式与数据库用户完全相同。

## Nginx 反向代理配置

OpenClaw 绝不应该直接暴露在 80 或 443 端口上。让它运行在高端口（3000、8080 等），然后在前面放置 nginx。这样你就能获得 TLS 终止、速率限制、请求过滤和访问日志——所有这些都无需修改 OpenClaw 的代码。

### 基本 nginx 配置

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

使用 Certbot 获取免费的 TLS 证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot 会自动续期。使用 `sudo certbot renew --dry-run` 验证。

### nginx 速率限制

nginx 的 `limit_req` 模块是抵御暴力破解和滥用攻击的最有效手段之一。在两个层面设置限制：基于 IP 的原始连接速率，以及全局总吞吐量。

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

`burst` 参数允许在不立即拒绝的情况下短暂超过速率限制，这对于批量发送请求的合法客户端很重要。`nodelay` 表示突发请求会立即通过，而不是进入队列——对于 API 网关来说，排队会增加你不希望有的延迟。

## 网络隔离

如果你在 [Raspberry Pi](/blog/openclaw-raspberry-pi-5) 或与其他服务共享的 VPS 上运行 OpenClaw，默认情况下机器上的所有服务都可以互相自由访问。对于单一用途的服务器来说这没问题，但对于更复杂的场景，请使用 Docker 网络或 Linux 命名空间来隔离 OpenClaw。

### Docker 网络隔离

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

通过这种配置，OpenClaw 的 3000 端口不会绑定到宿主机网络。它只能从内部 Docker 网络上的 nginx 容器访问。即使攻击者以某种方式到达了 3000 端口——除非他们已经在你的宿主机上，否则根本不可能——也无法直接访问 OpenClaw。

### 防火墙规则

无论是否使用 Docker，都要配置防火墙。在 Ubuntu/Debian 上使用 ufw：

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

OpenClaw 的端口（3000 或你选择的其他端口）不应该出现在这个列表里。如果没有使用 Docker，要明确拒绝它：

```bash
sudo ufw deny 3000/tcp
```

### 限制出站连接

这一点常常被低估。默认情况下，如果你的 OpenClaw 进程被攻破，它可以向任何地方发起出站连接——泄露你的 API 密钥、连接到攻击者的基础设施等等。

将出站连接限制为仅能访问你实际使用的服务商 API：

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

这需要 OpenClaw 以专用的 `openclaw` 系统用户运行（无论如何你都应该这样做）：

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin openclaw
```

## 保护 OpenClaw API 端点

### 团队场景下的 IP 白名单

如果 OpenClaw 为一组已知的、拥有固定或半固定 IP 的用户提供服务——比如一个办公室或使用 VPN 的团队——可以将白名单作为第一道防线。在 nginx 中：

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

这并不能取代身份验证——它是一个补充层，在请求甚至到达 OpenClaw 之前就消除了 99% 的探测流量。

### 团队部署的 JWT 身份验证

对于需要真正的每用户身份标识而非共享 API 密钥的团队场景，OpenClaw 支持 JWT 验证中间件。与任何 OIDC 提供商配合使用——Keycloak、Auth0、Google Workspace：

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

使用 JWT 身份验证，你的日志中会有真实的用户身份——不只是"客户端密钥 X 发出了 50 个请求"，而是"用户 alice@yourcompany.com 发出了 50 个请求，其中 20 个失败了"。这对于审计追踪以及发现被攻破的个人账号非常重要。

如果你正在构建[自定义 MCP 服务器](/blog/building-custom-mcp-servers-openclaw)，代表不同用户回调 OpenClaw，这一点尤为重要。使用共享 API 密钥，你无法将操作归因到个人；而使用 JWT，你可以保留这种追溯能力。

## 审计日志

日志是你的证据链。当出现问题时——在一定规模下，问题总会出现——你需要足够详细的日志来还原事件经过。

### 配置 OpenClaw 访问日志

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

脱敏配置是经过深思熟虑的。记录消息内容会带来隐私问题——那个日志文件现在包含了用户发给 AI 的所有内容，可能包括敏感的商业信息或个人数据。记录元数据，而不是内容。

### 将日志推送到其他机器

对于团队部署，仅将日志存储在服务器本身是不够的。如果服务器被攻破，日志可能被删除。将日志推送到其他地方。

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

安装 Vector：

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash
```

如果你不自行运行 ELK 堆栈，替代方案包括：Datadog、Grafana Cloud（免费套餐可覆盖低流量日志），或将结构化日志推送到 S3 桶以供后续分析。核心要求是日志必须离开其生成的机器。

### 异常告警

没有告警的日志只是事后分析工具，而不是安全工具。设置基本的异常告警：

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

Token 使用量告警尤其有价值。如果有人拿到了你的客户端密钥，他们会使用它。Token 消耗量的突然飙升往往是检测到密钥被攻破的第一个信号。

## 整合所有内容：安装检查清单

如果你正在设置新的部署，以下步骤可以让你达到生产安全状态：

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

## 关于适度原则的说明

安全是一种成本收益计算，而非非此即彼的选择。一个在家里运行的、只能通过 Tailscale 或 WireGuard 访问的单开发者 OpenClaw 实例，与一个暴露在公网上的团队网关，面临的威胁模型截然不同。

本文中的配置代表了我在一个面向公网、有多个客户端的网关上实际运行的内容。对于 VPN 后面的个人部署，其中许多层是冗余的——而且复杂性本身就是一种风险，因为它会产生更多可能被错误配置的地方。正确的做法是理解每个控制措施的作用，了解它防范的是什么，并在威胁真实存在的地方加以应用。

在任何规模下都不可省略的内容：环境变量机密管理（永远不要硬编码密钥）、TLS（永远不要明文传输）、以及保留足够详细信息以还原事件的日志。其他所有内容都应根据你实际的暴露程度来选择。

我 nginx 日志中的那些异常流量最终证明什么都不是——只是自动扫描器在例行扫描。但我花在验证自己的设置是否安全上的那一小时是值得的。你不会希望在处理真实事件时才发现自己的防线不够牢固。
