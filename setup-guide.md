# Ana Hub – VPS Setup Guide (No Docker)

**Target**: Fresh Ubuntu 22.04/24.04 VPS with 2 vCPU / 8 GB RAM

## Phase 0 – Preflight
1. SSH into VPS as root or sudo user
2. Ensure DNS A record points to VPS IP (e.g., `hub.yourdomain.com`)
3. Create a GitHub personal access token (PAT) with `repo` scope
4. Reserve a Telegram bot token and WhatsApp Business token if using

---

## Phase 1 – System Prep
```bash
# Update
apt update && apt upgrade -y

# Install basics
apt install -y curl git nginx build-essential libssl-dev pkg-config

# Install Node.js 20 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verify
node -v
npm -v

# Install SQLite
apt install -y sqlite3

# Create app user
adduser --system --group --home /opt/anahub anahub
```

---

## Phase 2 – Code Deploy
```bash
# Switch to app user
sudo -u anahub -i

# Clone the repo (replace with your actual repo)
cd /opt
git clone https://github.com/yourorg/ana-hub.git
cd ana-hub
# If using deploy key: git clone git@github.com:yourorg/ana-hub.git
```

---

## Phase 3 – Install Dependencies
```bash
cd /opt/ana-hub/backend
npm ci --only=production

cd ../dashboard
npm ci && npm run build  # produces static files in .svelte-kit/output
```

---

## Phase 4 – Configuration
1. On VPS, create `config/secrets.json` (gitignored):
```json
{
  "github": {
    "token": "ghp_yourPAT",
    "repo": "yourorg/ana-hub-sync",
    "webhookSecret": "random32byte"
  },
  "openrouter": {
    "apiKey": "sk-or-...",
    "defaultModel": "openrouter/stepfun/step-3.5-flash:free",
    "fallbacks": [
      "openrouter/anthropic/claude-opus-4.5",
      "openrouter/google/gemini-3-pro-preview"
    ]
  },
  "telegram": {
    "botToken": "123:ABC",
    "allowedChatIds": [12345678]
  },
  "whatsapp": {
    "accessToken": "...",
    "phoneNumberId": "...",
    "businessId": "..."
  },
  "slack": {
    "botToken": "xoxb-..."
  },
  "teams": {
    "appId": "...",
    "password": "..."
  },
  "localLLM": {
    "enabled": false,
    "baseUrl": "http://localhost:11434"
  },
  "dashboard": {
    "port": 3000,
    "bind": "127.0.0.1"
  }
```

2. Also create `config/models.json` (editable via UI but defaults here):
```json
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
    "openrouter/x-ai/grok-4.1-fast",
    "openrouter/z-ai/glm-5"
  ],
  "default": "openrouter/stepfun/step-3.5-flash:free",
  "fallbackChain": [
    "openrouter/stepfun/step-3.5-flash:free",
    "openrouter/deepseek/deepseek-v3.2"
  ]
}
```

3. Set permissions:
```bash
chmod 600 config/secrets.json
chown -R anahub:anahub /opt/ana-hub
```

---

## Phase 5 – Database Init
```bash
cd /opt/ana-hub
sqlite3 kanban.db < kanban/schema.sql
chown anahub:anahub kanban.db
```

---

## Phase 6 – Systemd Services
Create `/etc/systemd/system/ana-hub-backend.service`:
```ini
[Unit]
Description=Ana Hub Backend
After=network.target

[Service]
Type=simple
User=anahub
Group=anahub
WorkingDirectory=/opt/ana-hub/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
# Optionally load config from /opt/ana-hub/config
Environment=CONFIG_DIR=/opt/ana-hub/config

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/ana-hub-sync.service`:
```ini
[Unit]
Description=Ana Hub GitHub Sync
After=network.target ana-hub-backend.service

[Service]
Type=simple
User=anahub
Group=anahub
WorkingDirectory=/opt/ana-hub
ExecStart=/usr/bin/node sync/github-sync.js
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl daemon-reload
systemctl enable ana-hub-backend ana-hub-sync
systemctl start ana-hub-backend ana-hub-sync
journalctl -u ana-hub-backend -f
```

---

## Phase 7 – Nginx Reverse Proxy
Create `/etc/nginx/sites-available/ana-hub`:
```nginx
server {
    listen 80;
    server_name hub.yourdomain.com;

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
```
Enable:
```bash
ln -s /etc/nginx/sites-available/ana-hub /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Get TLS (Let’s Encrypt):
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d hub.yourdomain.com
```

---

## Phase 8 – Webhook Listener (Optional)
If you want GitHub to push events to Ana Hub (instead of polling), open port 6000 on firewall and configure GitHub webhook to `https://hub.yourdomain.com/webhook/github` with secret from `secrets.json`. The `sync/webhook-handler.js` endpoint must be mounted in backend (`app.use('/webhook', githubWebhookRouter)`).

---

## Phase 9 – Verify
- Visit `https://hub.yourdomain.com` → Dashboard loads
- Check `/api/health` → `{status: "ok"}`
- Confirm `ana-hub-backend` and `ana-hub-sync` are running
- In GitHub, confirm webhook delivery or poller fetching issues (logs in `journalctl`)

---

## Phase 10 – Connect to Primary
1. On primary OpenClaw, add a job (cron) or webhook that creates GitHub issues for events:
   - New chat messages
   - Card moves
   - File uploads
   - Skill changes
2. Adjust `config/sync.json` on both sides to match event types
3. Test round-trip: create a card on primary → appears on backup dashboard within 1 minute

---

## Rollback Plan
- If update breaks: `git revert <commit>` and restart services
- Keep previous releases tagged (v1.0, v1.1); you can switch branches instantly
- Database (`kanban.db`) is independent; ensure it’s backed up before risky changes

---

## Troubleshooting
- Check `journalctl -u ana-hub-backend -f` for errors
- Nginx logs: `/var/log/nginx/error.log`
- GitHub sync: `journalctl -u ana-hub-sync -f`
- Ensure port 3000 is bound to 127.0.0.1 only (firewalled)
- Verify PAT has `repo` scope and repo exists

---

## Next: Bigger Server Migration
1. Snapshot current VPS
2. Spin up bigger server (e.g., 8 vCPU / 32 GB RAM)
3. Install same software (use this guide)
4. Git pull latest; copy over `kanban.db` and `config/secrets.json`
5. Update DNS if IP changes; swap over gradually