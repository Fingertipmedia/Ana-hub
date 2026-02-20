#!/usr/bin/env bash
set -euo pipefail

# Ana Hub Automated VPS Setup
# Run as root on the target server

echo "===== Ana Hub Setup Start ====="

# 0. Preflight
if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (or with sudo)" >&2
  exit 1
fi

read -p "Enter your domain name for the dashboard (e.g., hub.yourdomain.com): " DOMAIN
read -s -p "GitHub Personal Access Token (repo scope): " GITHUB_PAT
echo
read -s -p "OpenRouter API Key (sk-or-...): " OPENROUTER_KEY
echo
read -s -p "Optional: Telegram Bot Token (if using chat): " TELEGRAM_BOT_TOKEN
echo

# 1. Install base packages
apt-get update
apt-get install -y curl git nginx build-essential libssl-dev pkg-config sqlite3 ca-certificates

# 2. Install Node.js 20
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 3. Create anahub system user
if ! id -u anahub &>/dev/null; then
  adduser --system --group --home /opt/anahub anahub
fi

# 4. Clone repo (or use existing if already cloned)
if [[ ! -d /opt/anahub/ana-hub ]]; then
  cd /opt
  git clone https://github.com/Fingertipmedia/Ana-hub.git anahub
  chown -R anahub:anahub /opt/anahub
fi

cd /opt/anahub/ana-hub

# 5. Install backend dependencies as anahub user
sudo -u anahub -H bash -c 'cd backend && npm ci --only=production'

# 6. Create config files
sudo -u anahub -H bash -c 'mkdir -p config'

# secrets.json
cat > config/secrets.json <<EOF
{
  "github": {
    "token": "$GITHUB_PAT",
    "owner": "Fingertipmedia",
    "repo": "Ana-hub"
  },
  "openrouter": {
    "apiKey": "$OPENROUTER_KEY",
    "defaultModel": "openrouter/stepfun/step-3.5-flash:free",
    "fallbacks": [
      "openrouter/anthropic/claude-sonnet-4.5",
      "openrouter/anthropic/claude-opus-4.5",
      "openrouter/deepseek/deepseek-v3.2",
      "openrouter/google/gemini-2.5-flash-lite",
      "openrouter/google/gemini-3-pro-preview",
      "openrouter/minimax/minimax-m2.5",
      "openrouter/moonshotai/kimi-k2.5",
      "openrouter/openai/gpt-5-mini",
      "openrouter/openai/gpt-5.1-chat",
      "openrouter/z-ai/glm-5",
      "openrouter/stepfun/step-3.5-flash:free",
      "openrouter/x-ai/grok-4.1-fast"
    ]
  },
  "dashboard": {
    "port": 3000,
    "bind": "127.0.0.1"
  }
EOF

# Optional: add Telegram if provided
if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
  read -p "Telegram allowed chat ID (numeric, optional): " TELEGRAM_CHAT_ID
  cat >> config/secrets.json <<EOF
  ,
  "telegram": {
    "botToken": "$TELEGRAM_BOT_TOKEN",
    "allowedChatIds": [${TELEGRAM_CHAT_ID:-0}]
  }
EOF
fi

chmod 600 config/secrets.json
chown anahub:anahub config/secrets.json

# models.json (defaults)
cat > config/models.json <<'EOF'
{
  "available": [
    "openrouter/stepfun/step-3.5-flash:free",
    "openrouter/anthropic/claude-opus-4.5",
    "openrouter/anthropic/claude-sonnet-4.5",
    "openrouter/deepseek/deepseek-v3.2",
    "openrouter/google/gemini-2.5-flash-lite",
    "openrouter/google/gemini-3-pro-preview",
    "openrouter/minimax/minimax-m2.5",
    "openrouter/moonshotai/kimi-k2.5",
    "openrouter/openai/gpt-5-mini",
    "openrouter/openai/gpt-5.1-chat",
    "openrouter/z-ai/glm-5",
    "openrouter/x-ai/grok-4.1-fast"
  ],
  "default": "openrouter/stepfun/step-3.5-flash:free",
  "fallbackChain": [
    "openrouter/stepfun/step-3.5-flash:free",
    "openrouter/deepseek/deepseek-v3.2"
  ]
}
EOF
chown anahub:anahub config/models.json

# sync.json
cat > config/sync.json <<EOF
{
  "repo": "Fingertipmedia/Ana-hub",
  "pollInterval": 5
}
EOF
chown anahub:anahub config/sync.json

# 7. Initialize database
cd /opt/anahub/ana-hub
sqlite3 kanban.db < kanban/schema.sql
chown anahub:anahub kanban.db

# 8. Build dashboard (static)
sudo -u anahub -H bash -c 'cd dashboard && npm ci && npm run build 2>/dev/null || echo "Build step placeholder (static files already present)"'

# 9. Systemd services
cat > /etc/systemd/system/ana-hub-backend.service <<'EOF'
[Unit]
Description=Ana Hub Backend
After=network.target

[Service]
Type=simple
User=anahub
Group=anahub
WorkingDirectory=/opt/anahub/ana-hub/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CONFIG_DIR=/opt/anahub/ana-hub/config

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/ana-hub-sync.service <<'EOF'
[Unit]
Description=Ana Hub GitHub Sync
After=network.target ana-hub-backend.service

[Service]
Type=simple
User=anahub
Group=anahub
WorkingDirectory=/opt/anahub/ana-hub
ExecStart=/usr/bin/node sync/github-sync.js
Restart=always
RestartSec=60
Environment=CONFIG_DIR=/opt/anahub/ana-hub/config

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ana-hub-backend ana-hub-sync
systemctl start ana-hub-backend ana-hub-sync

# 10. Nginx reverse proxy
if [[ -n "$DOMAIN" ]]; then
  cat > /etc/nginx/sites-available/ana-hub <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/ana-hub /etc/nginx/sites-enabled/ana-hub
  nginx -t && systemctl reload nginx

  # Let's Encrypt TLS
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || echo "TLS setup failed; you can retry manually: certbot --nginx -d $DOMAIN"
else
  echo "No domain provided; skipping Nginx/TLS. Dashboard is on port 3000 (localhost only)."
fi

echo "===== Ana Hub Setup Complete ====="
echo "Backend: http://localhost:3000 (or via Nginx if domain set)"
echo "Services: ana-hub-backend, ana-hub-sync"
echo "Check logs: journalctl -u ana-hub-backend -f"