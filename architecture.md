# Ana Hub – Architecture

## Design Goals
- **Simplicity over cleverness**: Prefer native binaries, systemd services, and minimal dependencies
- **Git-native sync**: Use GitHub Issues/PRs or a lightweight API to replicate events between primary and backup
- **User-friendly dashboard**: Apple-esque design, SvelteKit or plain HTML/CSS/JS served by Nginx
- **Resilient chat**: Telegram/WhatsApp integration, OpenRouter fallbacks, local LLM via API
- **Easy deploy**: A single `setup.sh` that installs Node.js, sets up services, and configures everything

## Components

### 1. GitHub Sync Engine
- **Source of truth**: All config, skills, documents, kanban state stored in Git
- **Two-way replication**: Primary OpenClaw pushes events (messages, card updates, file changes) as GitHub Issues with labels; backup pulls them and applies locally
- **Conflict resolution**: Last-write-wins with `updated_at` timestamps; manual conflict cards if needed
- **Secrets**: Never stored in Git; managed via local `config/secrets.json` (gitignored)

### 2. Dashboard (Frontend)
- **Tech**: SvelteKit (small bundle, great DX) or vanilla static site for maximum simplicity
- **Pages**:
  - Dashboard: Token usage, sync status, health of LLMs, list of apps
  - Settings: Model selection, fallback chain, backup/restore, rollback
  - Chat: Multi-session views, Telegram/WhatsApp connected
  - Skills: Browse/edit/create skills
  - Documents: Folder tree, upload, research ingestion
  - Kanban: Three boards, drag-and-drop cards, sharing UI
- **Design**: Minimalist, Apple-inspired, responsive

### 3. Backend (Node.js)
- **Server**: Express or Fastify; single entry point `backend/server.js`
- **Database**: SQLite (`kanban.db`) for kanban cards, document metadata, settings
- **Routes**:
  - `GET /api/health` – health check
  - `GET /api/tokens` – usage stats
  - `POST /api/sync/pull` – fetch pending GitHub events
  - `POST /api/sync/push` – create GitHub event
  - `GET/POST /api/kanban/*` – board/card CRUD
  - `GET/POST /api/documents/*` – folder doc management
  - `GET/POST /api/chat/*` – list sessions, send messages
  - `GET/POST /api/skills/*` – skill CRUD
- **Integrations**:
  - Telegram Bot API (for chat sessions)
  - WhatsApp Cloud API (or Twilio)
  - Slack/Teams incoming webhooks for board activity
  - OpenRouter API with fallback chain
  - Local LLM API (Ollama or LM Studio) if installed

### 4. Kanban Engine
- **Tables**: `boards`, `cards`, `comments`, `attachments`, `activity_log`
- **Columns**: `ideas`, `todo`, `inprogress`, `completed`
- **Card fields**: `title`, `description`, `agent`, `tokens`, `start_at`, `end_at` (Europe/Madrid), `docs`, `tags` (e.g., company:wealth)
- **Connectors**:
  - Poll Slack/Teams channels; detect project/issue mentions; auto-create cards
  - Link card comments to channel messages; post card updates back to channel
- **Sharing**: Simple token-based read-only access per board; generate shareable link

### 5. Sync via GitHub
- **Mechanism**:
  - Primary creates GitHub Issues in `ana-hub-sync` repo with labels: `type:message`, `type:card`, `type:doc`, `scope:wealth`, `scope:fingertip`, etc.
  - Body contains JSON payload; attachments as base64 or links to GitHub blobs
  - Backup runs a poller (every minute) to fetch new issues, apply changes, close them
  - Backup can also push its own events (if active/active), but simpler read-only standby recommended
- **Auth**: Personal Access Token (PAT) stored locally; GitHub App optional for finer permissions
- **Rollback**: Each issue corresponds to an event; reverting means applying inverse event or restoring from previous Git commit

## Data Flow Example

1. You send a Telegram message to a session
2. Primary OpenClaw processes it; creates a `type:message` GitHub issue with payload `{session, text, model, tokens}`
3. Backup polls, fetches issue, stores in local DB, updates kanban if needed, closes issue
4. Dashboard shows latest data; chat model can be switched to backup’s local LLM or OpenRouter

## Failure Mode Handling
- Primary down → Backup continues operating; you chat via web dashboard or Telegram (backup bot)
- Network partition → Events queue on both sides; reconcile when back online via issue timestamps
- Bad deploy → Roll back to previous Git commit; backup still functional

## Security
- All communications over HTTPS
- PAT scoped to single repo
- Secrets never in Git
- Optional SSH tunnel for VPS access instead of public dashboard

## Deployment on VPS (2 vCPU / 8 GB)
- Node.js 20+ (from NodeSource)
- SQLite (lightweight)
- Nginx (reverse proxy + TLS via Let’s Encrypt)
- Systemd services for `backend` and `poller`
- PM2 optional but systemd simpler
- Git clone with deploy key

## Future Scale
- Move to PostgreSQL if data grows
- Redis for queue if event rate high
- Bigger server for llama3.3:70b requires ~40 GB RAM; plan migration path