# Chieftan

**Your open-source AI Chief of Staff** — a private, safe, extensible personal agent built on Claude Agent SDK.

Chieftan aggregates your email, calendar, GitHub, and local data into daily briefings, detects trends and anomalies, and proposes actions with human-in-the-loop approval gates. Interact via Telegram or a web dashboard.

## Features

- **Daily Briefings** — Aggregates Gmail, Google Calendar, GitHub notifications, and CSV data into prioritized morning summaries
- **Analytics Engine** — Tracks metrics over time, detects trends (up/down/stable), and flags anomalies (>2 standard deviations)
- **Approval Gates** — Agents propose actions; you approve or reject. Full audit trail
- **Skill System** — Extensible via SKILL.md files. Compatible with OpenClaw and NanoClaw skills
- **Telegram Bot** — Interact with your chief of staff from your phone
- **Web Dashboard** — Card-based UI inspired by [agentation.dev](https://agentation.dev) with briefing feed, analytics, approvals, skill marketplace, and audit log
- **Container Sandbox** — Skills run in isolated containers with explicit permission grants
- **Privacy First** — Everything runs locally. Your data stays on your machine

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 WEB DASHBOARD (React)               │
│  Briefing │ Analytics │ Approvals │ Skills │ Audit  │
├─────────────────────────────────────────────────────┤
│              CHIEF OF STAFF LAYER                   │
│  Briefing Engine │ Analytics │ Approval Gates       │
├─────────────────────────────────────────────────────┤
│           SKILL COMPATIBILITY LAYER                 │
│  Chieftan Skills │ OpenClaw Adapter │ NanoClaw      │
├─────────────────────────────────────────────────────┤
│                    CORE                             │
│  SQLite Store │ Scheduler │ Memory │ Containers     │
│  Telegram (grammY) │ Fastify API                    │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 20
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Install & Run

```bash
git clone https://github.com/nurpeiis/chieftan.git
cd chieftan
npm install
cp .env.example .env
# Edit .env with your tokens
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for Claude-powered features |
| `GITHUB_TOKEN` | No | GitHub personal access token for notifications |
| `GMAIL_ACCESS_TOKEN` | No | Gmail OAuth access token |
| `GCAL_ACCESS_TOKEN` | No | Google Calendar OAuth access token |
| `DASHBOARD_PORT` | No | Dashboard port (default: 3141) |
| `CHIEFTAN_DATA_DIR` | No | Data directory (default: ~/.chieftan) |

### Dashboard

Open `http://localhost:3141` after starting the server.

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/briefing` | Get your daily briefing |
| `/analytics` | View insights and trends |
| `/approve` | Review pending action proposals |
| `/approve <id>` | Approve a specific proposal |
| `/approve all` | Batch approve all pending |
| `/reject <id> [reason]` | Reject a proposal |
| `/skills` | List installed skills |
| `/dashboard` | Get dashboard URL |
| `/help` | Show help |

## Skills

Chieftan uses a skill system compatible with OpenClaw and NanoClaw.

### Bundled Skills

- `daily-briefing` — Morning briefing from all connected sources
- `email-digest` — Categorize and prioritize unread emails
- `github-summary` — Summarize GitHub activity
- `csv-analyzer` — Analyze CSV data files

### Install a Skill

```bash
# From local directory
npm run dev -- skill install ./path/to/skill

# List installed
npm run dev -- skill list

# Adapt OpenClaw skills
npm run dev -- skill adapt-openclaw ./openclaw-skills-dir
```

### Create a Skill

Create a directory with a `SKILL.md` file:

```yaml
---
name: "my-skill"
description: "What this skill does"
version: "1.0.0"
permissions: ["file-read", "network"]
schedule: "0 9 * * *"
sources: ["gmail"]
---
Instructions for the AI agent go here.
```

### Permission Model

Skills declare permissions that are reviewed before installation:

| Permission | Risk | Description |
|------------|------|-------------|
| `file-read` | Low | Read files from specified paths |
| `file-write` | Medium | Write files to specified paths |
| `network` | Medium | Make outbound network requests |
| `shell` | High | Execute shell commands |

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Type check
npm run lint

# Build
npm run build
```

### Project Structure

```
src/
├── core/           # Message store, memory, scheduler, container sandbox
├── channels/       # Telegram bot integration
├── skills/         # Skill registry, OpenClaw adapter, installer
├── chief/          # Briefing engine, analytics, approval gates
├── connectors/     # Gmail, GCal, GitHub, CSV data connectors
└── dashboard/      # Fastify REST API

ui/                 # React dashboard (Vite + TypeScript)
skills/             # Bundled skill definitions
```

## Tech Stack

All components are fully open source:

| Component | Technology | License |
|-----------|-----------|---------|
| Runtime | Node.js 20+ | MIT |
| Language | TypeScript | Apache-2.0 |
| Database | better-sqlite3 | MIT |
| Telegram | grammY | MIT |
| Scheduler | croner | MIT |
| API Server | Fastify | MIT |
| Dashboard | React + Vite | MIT |
| Testing | Vitest | MIT |
| AI | Claude Agent SDK | MIT |

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Write tests first (TDD)
4. Submit a PR with a clear description

## Inspiration

- [OpenClaw](https://github.com/openclaw/openclaw) — The open-source personal AI assistant
- [NanoClaw](https://github.com/qwibitai/nanoclaw) — Lightweight AI assistant framework
- [agentation.dev](https://agentation.dev/) — Visual feedback tool for AI agents
