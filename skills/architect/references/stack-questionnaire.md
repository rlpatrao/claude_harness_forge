# Stack Questionnaire Reference

Structured question bank for the architect's 5-round stack interrogation. Questions are adapted based on BRD context and project type.

## Round 1 — Backend

### Questions
1. "Based on the BRD, the key backend requirements are: {list from BRD}. What language/framework do you prefer?"
2. "Why this choice over the alternatives?"

### Options by Requirement Pattern

| BRD Pattern | Recommended | Alternatives | Challenge If |
|-------------|-------------|-------------|-------------|
| AI/ML integrations | Python / FastAPI | Python / Django | User picks Node — limited ML ecosystem |
| Admin-heavy, forms-heavy | Python / Django | Python / FastAPI | User picks FastAPI — no built-in admin |
| Real-time, WebSocket-heavy | Node / Express | Python / FastAPI | User picks Django — weaker async support |
| Type-safe API, enterprise | Node / Express+TS | Python / FastAPI | |
| Simple CRUD | Any | | Don't over-engineer the choice |

## Round 2 — Database

### Questions
1. "The BRD's data characteristics are: {analysis}. What primary database?"
2. "Do you need a secondary store? (cache, search index, queue)"
3. "Expected data scale?"

### Options by Data Pattern

| BRD Pattern | Recommended | Challenge If |
|-------------|-------------|-------------|
| Relational with joins | PostgreSQL | User picks MongoDB |
| Document/flexible schema | MongoDB | User picks PostgreSQL for simple key-value |
| Time-series data | TimescaleDB (on PostgreSQL) | |
| Full-text search needed | PostgreSQL (pg_trgm) or Elasticsearch | |
| High-read, low-write | Add Redis cache layer | No cache chosen for read-heavy workload |
| Async processing | Add message queue (Redis/RabbitMQ) | Blocking API calls for async work |

## Round 3 — Frontend

### Questions
1. "Frontend framework? (with BRD-informed rationale)"
2. "Styling approach?"
3. "State management needs?"

### Options

| BRD Pattern | Recommended | Notes |
|-------------|-------------|-------|
| Complex SPA with routing | React + React Router | Most ecosystem support |
| SEO-important pages | Next.js | SSR/SSG built-in |
| Simple interactivity | HTMX or Alpine.js | Lighter than full SPA |
| No frontend | Skip | API-only projects |
| Enterprise dashboard | React + shadcn/ui or MUI | Pre-built enterprise components |
| Consumer app | React + Tailwind | Maximum design flexibility |

## Round 4 — Deployment

### Questions
1. "Development environment?" (Docker Compose / local / stub)
2. "Target deployment?" (Container / serverless / PaaS / undecided)
3. "CI/CD requirements?"
4. "External services/APIs?"

### Verification Mode Selection

| Choice | When | Config |
|--------|------|--------|
| Docker Compose | Multi-service apps (backend + frontend + DB) | `verification.mode: "docker"` |
| Local dev servers | Single-service or rapid iteration | `verification.mode: "local"` |
| Stub/mock | Serverless, external-only, no runnable backend | `verification.mode: "stub"` |

## Round 5 — Verify & Challenge

### Concern Patterns to Check

- BRD mentions real-time features → WebSocket/SSE infrastructure chosen?
- BRD mentions search → full-text index or search service configured?
- BRD mentions file processing → async queue for heavy processing?
- BRD mentions email/notifications → queue + service for async sending?
- BRD expects sub-200ms response → caching layer configured?
- BRD mentions multiple user roles → auth + RBAC system planned?
- BRD mentions external APIs → typed wrappers in component map?
- BRD mentions >100K records → pagination + indexing strategy?
