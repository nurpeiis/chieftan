# Chieftan — Development Guide

## Project Overview

Chieftan is an open-source AI Chief of Staff — a personal agent that aggregates
data from multiple sources (email, calendar, GitHub, CSV), generates daily
briefings, detects analytics trends, and proposes actions with human-in-the-loop
approval gates. It runs locally for privacy.

## Architecture

Three layers on top of a NanoClaw-inspired core:

1. **Core** (`src/core/`) — SQLite message store, persistent memory, cron scheduler, container sandbox
2. **Skill Layer** (`src/skills/`) — Skill registry, OpenClaw/NanoClaw adapter, installer with permission review
3. **Chief Layer** (`src/chief/`) — Briefing engine, analytics (trend/anomaly detection), approval gates

Interfaces: Telegram bot (`src/channels/telegram.ts`), REST API (`src/dashboard/api.ts`), React dashboard (`ui/`)

## Key Design Decisions

- **TDD**: Every module has tests written first. Tests are in `*.test.ts` files next to the source.
- **SQLite for everything**: Messages, memory, analytics, approvals — all in one SQLite file with WAL mode.
- **Connector interface**: All data sources implement `Connector` with a `fetch(): Promise<ConnectorResult[]>` method. Standardized output format means analyzers are source-agnostic.
- **SKILL.md format**: Compatible with OpenClaw and NanoClaw. YAML frontmatter + markdown instructions.
- **Container isolation**: Skills declare permissions. Containers are generated with minimal grants.

## Commands

```bash
npm run dev          # Start server (Telegram + dashboard)
npm test             # Run all tests (vitest)
npm run test:watch   # Watch mode
npm run lint         # Type check
npm run build        # Build TypeScript
```

## Testing

164 tests across 17 test files. All modules use TDD (tests first).

- In-memory SQLite (`:memory:`) for database tests
- `vi.fn()` mocks for external APIs (GitHub, Gmail, GCal)
- Temp directories for filesystem tests (skills, CSV)

## Adding a New Connector

1. Create `src/connectors/myconnector.ts` implementing the `Connector` interface
2. Write tests in `src/connectors/myconnector.test.ts`
3. Register in `src/index.ts` with environment variable check
4. Add env var to `.env.example`

## Adding a New Skill

Create a directory in `skills/` with a `SKILL.md`:

```yaml
---
name: "skill-name"
description: "What it does"
version: "1.0.0"
permissions: []
---
Agent instructions here
```

## File Layout

```
src/core/messages.ts        # SQLite message store
src/core/memory.ts          # Per-user persistent memory
src/core/scheduler.ts       # Cron-based task scheduler
src/core/container.ts       # Container sandbox config
src/skills/registry.ts      # Skill discovery and loading
src/skills/adapter-openclaw.ts  # OpenClaw SKILL.md adapter
src/skills/installer.ts     # Skill install/uninstall
src/chief/briefing.ts       # Daily briefing aggregation
src/chief/analytics.ts      # Trend/anomaly detection
src/chief/approval.ts       # Human-in-the-loop approval gates
src/connectors/types.ts     # ConnectorResult interface
src/connectors/gmail.ts     # Gmail connector
src/connectors/gcal.ts      # Google Calendar connector
src/connectors/github.ts    # GitHub notifications connector
src/connectors/csv.ts       # Local CSV file connector
src/channels/telegram.ts    # Telegram command parser & formatters
src/dashboard/api.ts        # Fastify REST API
src/index.ts                # Main entry point & CLI
```
