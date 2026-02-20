# Ana Hub – Redundant OpenClaw Backup System

## Purpose
Self-hosted, Apple-esque dashboard that syncs with your primary OpenClaw instance via GitHub. Provides full continuity if the primary goes down or is discontinued.

## Core Principles
- **Simplicity**: Avoid Docker complexity; use native binaries or simple containers
- **GitOps**: All configuration, skills, and settings stored in Git (with PAT for private repos)
- **Sync**: Bidirectional event replication via GitHub issues/PRs or a lightweight API
- **Resilience**: Local LLM access (via API) and OpenRouter fallbacks; no vendor lock-in

## Current VPS Specs
- 2 vCPU cores
- 8 GB RAM
- 100 GB NVMe
- 8 TB bandwidth

## Target Bigger Server (Future)
- More RAM/CPU for larger Llama models
- Increased storage for documents and history

## Repository Structure
```
ana-hub/
├── README.md
├── architecture.md
├── setup-guide.md
├── config/
│   ├── models.json
│   ├── sync.json
│   └── secrets.json (gitignored)
├── dashboard/
│   ├── package.json
│   ├── src/
│   └── public/
├── backend/
│   ├── server.js
│   ├── routes/
│   └── lib/
├── sync/
│   ├── github-sync.js
│   └── webhook-handler.js
├── kanban/
│   └── schema.sql
├── docker-compose.yml (optional simplified)
└── deploy/
    └── init.sh
```

## Next Steps
1. Draft architecture.md
2. Create setup-guide.md tailored to VPS (Debian/Ubuntu)
3. Scaffold dashboard (SvelteKit or vanilla HTML/JS)
4. Build backend (Node.js + SQLite)
5. Implement GitHub sync
6. Add kanban board with Slack/Teams connectors
7. Test failover