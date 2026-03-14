---
title: "Hardening OpenClaw: API Key Management, Auth, and Network Security"
description: "A practical security guide for OpenClaw deployments. Covers API key rotation, nginx reverse proxy, rate limiting, network isolation, and audit logging for both personal and team setups."
publishedAt: 2026-03-16
status: published
visibility: public
---

# Hardening OpenClaw: API Key Management, Auth, and Network Security

OpenClaw is designed to be exposed to the internet. That's the whole point of running it as a gateway — you want your phone, your laptop from a coffee shop, your teammates' machines, all hitting a single managed endpoint. The moment you expose anything to the internet, someone will probe it. Usually within minutes.

I spent a weekend tightening up my production OpenClaw setup after noticing some unexpected traffic in my nginx logs. What looked like normal bot noise was actually a pattern of requests probing well-known API paths. My instance was locked down enough that nothing got through, but it was a useful reminder: the defaults are not enough.

This article documents what I actually run. Not theoretical hardening advice — the concrete configs and commands that secure a real OpenClaw deployment, whether you're running solo or on a team.

## Understanding the Attack Surface

Before you configure anything, it's worth mapping what you're actually exposing.

A typical OpenClaw deployment has four distinct surfaces:

1. **The HTTP gateway endpoint** — where clients send requests. If this is public, it's what attackers will hit first.
2. **The OpenClaw admin interface** — if enabled, this manages plugins, routes, and API keys. It must never be public.
3. **The environment containing your upstream API keys** — your Anthropic key, OpenAI key, DeepSeek key. If these leak, you're paying for someone else's usage.
4. **The OpenClaw process itself** — the Node.js runtime, its dependencies, the filesystem it can access.

Most tutorials show you how to expose surface #1, say nothing about protecting #2, and completely ignore #3 and #4. Let's fix that.

## API Key Management

This is where people make the most expensive mistakes. I've seen people put their Anthropic API key directly in `openclaw.config.yaml`, commit that file to a public GitHub repo, and wonder why they had a $400 bill a week later.

### Never Store Keys in Config Files

OpenClaw reads environment variables for upstream provider credentials. Use them.

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

Your `openclaw.config.yaml` can then live in source control safely — it contains no secrets.

### Using a .env File with Systemd

If you're running OpenClaw as a systemd service (which you should be on any Linux server), the right way to inject secrets is via `EnvironmentFile`:

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

The `ProtectSystem=strict` and related systemd options limit what the process can write to. Even if the Node.js process is compromised, it can't write to arbitrary filesystem locations.

### Client API Key Rotation

OpenClaw supports issuing its own API keys to clients — keys that it validates before forwarding requests upstream. Treat these differently from your upstream provider keys.

Generate client keys with sufficient entropy:

```bash
openssl rand -hex 32
# Output: a64f3b8c9d2e1f7a5b4c8d3e9f2a7b6c4d8e3f9a2b7c6d5e4f3a2b1c9d8e7f6
```

Client keys should be:

- **Per-client, not per-user**: Each application or service that calls OpenClaw gets its own key, not each person. This way you can revoke a single compromised integration without affecting everything else.
- **Rotated on a schedule**: I rotate mine every 90 days. Put it in your calendar. When a new key is issued, keep the old one valid for a 48-hour overlap to allow clients to transition without downtime.
- **Rotated immediately on suspicion**: If a key leaks or you see unexpected usage patterns, revoke it immediately. The 48-hour grace period is for planned rotations only.

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

The scope system lets you give different clients different permissions. Your mobile app doesn't need `admin:read`. Principle of least privilege applies here exactly as it does with database users.

## Nginx Reverse Proxy Setup

OpenClaw should never be directly exposed on port 80 or 443. Run it on a high port (3000, 8080, etc.) and put nginx in front. This gives you TLS termination, rate limiting, request filtering, and access logging — all without touching OpenClaw's code.

### Basic nginx Configuration

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

Get a free TLS certificate with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot will auto-renew. Verify with `sudo certbot renew --dry-run`.

### Rate Limiting in nginx

nginx's `limit_req` module is one of the most effective ways to blunt brute-force and abuse attempts. Set limits at two levels: per-IP for raw connection rate, and globally for total throughput.

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

The `burst` parameter allows short spikes above the rate without immediate rejection, which matters for legitimate clients that batch requests. `nodelay` means burst requests go through immediately rather than being queued — for an API gateway, queuing adds latency you don't want.

## Network Isolation

If you're running OpenClaw on a [Raspberry Pi](/blog/openclaw-raspberry-pi-5) or a VPS alongside other services, the default is for all services on the machine to be able to reach each other freely. That's fine for a single-purpose server. For anything more complex, use Docker networking or Linux namespaces to isolate OpenClaw.

### Docker Network Isolation

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

With this setup, OpenClaw's port 3000 is not bound to the host network. It's only reachable from the nginx container on the internal Docker network. An attacker who somehow reaches port 3000 — they can't, unless they're already on your host — still can't reach OpenClaw directly.

### Firewall Rules

Regardless of whether you use Docker, set up a firewall. On Ubuntu/Debian with ufw:

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

OpenClaw's port (3000 or whatever you chose) should NOT appear in this list. If you didn't docker-ify it, explicitly deny it:

```bash
sudo ufw deny 3000/tcp
```

### Restricting Outbound Connections

This one is underappreciated. By default, if your OpenClaw process is compromised, it can make outbound connections anywhere — exfiltrating your API keys, connecting to attacker infrastructure, and so on.

Restrict outbound to only the provider APIs you actually use:

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

This requires OpenClaw to run as a dedicated `openclaw` system user (which you should be doing anyway):

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin openclaw
```

## Securing the OpenClaw API Endpoint

### IP Allowlisting for Team Setups

If OpenClaw serves a known set of users with static or semi-static IPs — an office, a team on a VPN — use allowlisting as a first layer of defense. In nginx:

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

This doesn't replace authentication — it's a supplementary layer that eliminates 99% of probe traffic before it even touches OpenClaw.

### JWT Authentication for Team Deployments

For team setups where you want proper per-user identity rather than shared API keys, OpenClaw supports JWT validation middleware. Pair it with any OIDC provider — Keycloak, Auth0, Google Workspace:

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

With JWT auth, you get real user identity in your logs — not just "client key X made 50 requests" but "user alice@yourcompany.com made 50 requests, 20 of which failed." That matters for audit trails and for catching individual accounts that have been compromised.

This is especially relevant if you're building [custom MCP servers](/blog/building-custom-mcp-servers-openclaw) that call back into OpenClaw on behalf of different users. With shared API keys, you lose the ability to attribute actions to individuals; with JWT you retain it.

## Audit Logging

Logs are your evidence trail. When something goes wrong — and at some scale, something will — you want logs detailed enough to reconstruct what happened.

### Configuring OpenClaw Access Logs

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

The redaction configuration is deliberate. Logging message content creates a privacy problem — that log file now contains whatever users sent to your AI, potentially including sensitive business information or personal data. Log the metadata, not the content.

### Shipping Logs Off the Machine

For a team deployment, logs on the server itself are insufficient. If the server is compromised, logs can be deleted. Ship them somewhere else.

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

Install Vector:

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash
```

Alternatives if you don't run your own ELK stack: Datadog, Grafana Cloud (free tier covers low-volume logging), or structured logs to an S3 bucket for later analysis. The key requirement is that logs leave the machine they were generated on.

### Alerting on Anomalies

Logs without alerting are a post-mortem tool, not a security tool. Set up basic anomaly alerts:

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

The token usage alert is particularly valuable. If someone has your client key, they'll use it. A sudden spike in token consumption is often the first detectable signal of a compromise.

## Putting It Together: Setup Checklist

If you're setting up a new deployment, here's the sequence that gets you to a production-safe state:

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

## A Note on Proportionality

Security is a cost-benefit calculation, not a binary. A single-developer instance of OpenClaw running at home, only accessible over Tailscale or WireGuard, has a very different threat model than a team gateway exposed to the public internet.

The configurations in this article represent what I run on a public-facing gateway with multiple clients. For a personal setup behind a VPN, many of these layers are redundant — and complexity is itself a risk because it creates more things to misconfigure. The right approach is to understand each control, know what it protects against, and apply it where the threat is real.

What's not optional at any scale: environment variable secrets management (never hardcode keys), TLS (never plaintext over the wire), and log retention with enough detail to reconstruct what happened. Everything else scales to your actual exposure.

The unexpected traffic in my nginx logs turned out to be nothing — automated scanners doing their routine rounds. But the hour I spent verifying my setup was locked down was well spent. You don't want to discover your defenses are inadequate while dealing with an actual incident.
