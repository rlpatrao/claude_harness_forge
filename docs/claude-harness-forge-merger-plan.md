# Claude Harness Forge — Design Plan

**Unifying two complementary philosophies for autonomous software development into a single scaffold**

---

## The Two Philosophies

### The Forge Philosophy — Template-Rich SDLC Scaffolding

The Forge approach treats autonomous development as a **structured engineering process** that needs rich guidance at every phase. It provides Socratic BRD interviews with 5-dimension exploration (Why, What, How, Edge Cases, UI), alternatives analysis before committing to approaches, story templates with Given/When/Then acceptance criteria, six enforced quality principles (small modules, static typing, short functions, explicit errors, no dead code, self-documenting names), code reviewer regression tests, UI mockup generation as self-contained HTML, and a plugin-first onboarding model.

**Core belief:** If you give agents detailed enough templates, patterns, and checklists, they will produce quality code. Quality comes from thorough upfront specification.

**Weakness:** The same agent writes code and judges its quality. There is no independent verification that the running application actually works. Code review catches structural issues but never catches behavioral bugs.

### The Harness Philosophy — Adversarial Verification Engineering

The Harness approach treats autonomous development as a **control problem** where the biggest risk is the agent declaring victory on broken code. Inspired by GAN architectures, it structurally separates the generator (writes code) from the evaluator (verifies behavior) — the agent that builds can never evaluate its own work. It introduces sprint contracts (machine-readable JSON defining done criteria), 3-layer verification (API curl + Playwright browser automation + browser console error capture), Karpathy-style monotonic ratcheting (quality metrics only move forward), session chaining for multi-context-window builds, and four execution modes (Full/Lean/Solo/Turbo) that right-size cost to project complexity.

**Core belief:** If you verify behavior adversarially and prevent quality regression, the output will be reliable. Quality comes from rigorous independent verification.

**Weakness:** Weak requirements and design foundations. No Socratic interviews, no interactive architect, no UI mockups, minimal templates. The harness verifies well but starts from shallow specifications, leading to more self-healing iterations to get things right.

### Why Neither Alone Is Sufficient

The Forge builds fast from rich foundations but can't guarantee what it built works. The Harness guarantees behavioral correctness but wastes iterations compensating for weak specs. The merged system uses the **Harness's adversarial verification as the structural backbone** and the **Forge's rich templates and developer ergonomics as the flesh**.

---

## 1. Design Principles

The merged system combines both philosophies, taking the strongest element from each:

| Principle | Source | Rationale |
|-----------|--------|-----------|
| GAN generator/evaluator separation | Harness | Eliminates self-evaluation bias — the single biggest quality risk in autonomous loops |
| Sprint contracts before coding | Harness | Machine-readable done criteria prevent "declare victory" failure mode |
| Three-layer verification (API + Playwright + Browser Console) | Harness + **NEW** | Evaluator checks observable behavior, never source code. Browser console errors feed back into bug fixing. |
| Karpathy ratchet with 7-gate matrix | Harness | Monotonic progress with mode-dependent gate selection |
| 4 execution modes (Full/Lean/Solo/Turbo) | Harness | Right-size cost to project complexity |
| Session chaining (multi-context-window) | Harness | `claude-progress.txt` + `features.json` enable multi-hour builds |
| Rich templates and reference skills | Forge | BRD templates, story templates, folder structure, Docker templates, Playwright configs, API patterns, UI mockup patterns |
| Code reviewer evals | Forge | Regression-test the reviewer agent with known violation samples |
| Plugin-first onboarding | Forge | Clone once, scaffold into any project, self-contained after |
| Batteries-included skill references | Forge | 14 reference files vs Harness's 7 — more guidance for agents |

---

## 2. Agent Roster (10 agents)

Merge the two agent sets. The Forge's role-based agents provide SDLC phase coverage; the Harness's GAN agents provide adversarial verification. Where both have the same agent (security-reviewer, test-engineer, ui-designer), take the richer definition.

| # | Agent | Source | Role | Model Tier |
|---|-------|--------|------|------------|
| 1 | `brd-creator` | Forge | Socratic 5-dimension interview → BRD + feature specs. Never writes code. | Sonnet |
| 2 | `architect` | **Redesigned** | Interactive stack/deployment questioning, decision verification, schema generation, learnings persistence | Opus |
| 3 | `spec-writer` | Forge | BRD decomposition into epics, stories, dependency graph | Sonnet |
| 4 | `generator` | Harness | Code + tests, spawns agent teams, negotiates sprint contracts | Sonnet |
| 5 | `evaluator` | Harness | Runs app, verifies sprint contracts (API + Playwright + browser console + Docker logs) | Opus |
| 6 | `ui-standards-reviewer` | **Redesigned** (was `design-critic`) | Checks UI conformance to SaaS/enterprise standards — not originality. Single-pass, no GAN loop. | Sonnet |
| 7 | `code-reviewer` | Forge | Quality principles, architecture compliance, test coverage, story traceability | Sonnet |
| 8 | `security-reviewer` | Harness (richer) | OWASP top 10, injection, auth bypass, secrets, SSRF, path traversal | Sonnet |
| 9 | `test-engineer` | Forge (richer) | Test plans, test cases, test data, Playwright E2E | Sonnet |
| 10 | `ui-designer` | Forge (richer) | React+Tailwind HTML mockups, design system tokens | Sonnet |

**Key changes from original plan:**

- `brd-creator` stays as its own agent (Forge's 280-line definition with 5-dimension interview, alternatives analysis, engineer self-audit, ASCII wireframe rules). It excels at requirements elicitation — a fundamentally different skill than architecture.
- `architect` is promoted to a first-class interactive agent with Opus tier (see Section 2a). It doesn't just produce artifacts — it questions, challenges, verifies, and persists decisions for cross-project reuse.
- `spec-writer` stays separate (BRD → stories is mechanically distinct from both requirements and architecture).
- `generator` replaces Forge's `implementer` (same role but with sprint contract negotiation and GAN integration).

### 2a. Architect Agent — Redesigned Workflow

The architect is not a silent document generator. It is a **technical design partner** that conducts a structured interview, challenges assumptions, verifies decisions against constraints, and builds an organizational knowledge base.

#### Architect Model Tier: Opus

The architect needs Opus because it makes judgment calls — evaluating trade-offs, challenging weak justifications, and catching design mistakes before they become implementation bugs. This is the same class of reasoning the evaluator needs.

#### Phase 1: Stack Interrogation (Interactive)

After BRD approval but before any design artifacts, the architect conducts a structured interview with the human. This replaces the scaffold command's stack questions — the architect asks more informed questions because it has the BRD context.

**Round 1 — Backend stack:**
```
Based on the BRD, this app needs [X, Y, Z capabilities].

1. Language/framework preference?
   - A) Python / FastAPI (best for: AI integrations, rapid API development)
   - B) Python / Django (best for: admin panels, ORM-heavy, auth built-in)
   - C) Node / Express (best for: real-time, WebSocket-heavy, JS full-stack)
   - D) Other (specify)

2. Why this choice over the alternatives?
   [Architect challenges weak reasoning — e.g., "You said FastAPI for an admin-heavy
    app. Django has a built-in admin panel. Is there a specific reason to avoid Django?"]
```

**Round 2 — Database:**
```
The BRD mentions [data characteristics: relational? document-heavy? time-series?].

1. Primary database?
   - PostgreSQL / MySQL / MongoDB / SQLite (dev only) / Other
2. Do you need a secondary store? (cache, search, queue)
3. Expected data scale? (hundreds of rows, millions, billions)

[Architect validates: "You chose MongoDB but your BRD describes highly relational
 data with joins across 4 entities. PostgreSQL would be more natural here.
 Should we reconsider?"]
```

**Round 3 — Frontend:**
```
1. Framework? (React / Next.js / Vue / Svelte / None)
2. Styling? (Tailwind / CSS Modules / styled-components / MUI)
3. State management needs? (local only / global store / server state)
```

**Round 4 — Deployment & infrastructure:**
```
1. Development environment?
   - A) Docker Compose (recommended for multi-service)
   - B) Local dev servers (simpler, faster iteration)
   - C) Stub/mock (serverless or external-only)
2. Target deployment?
   - A) Containerized (Docker → ECS/GKE/fly.io)
   - B) Serverless (Lambda/Cloud Functions)
   - C) PaaS (Heroku/Railway/Render)
   - D) Haven't decided yet
3. CI/CD requirements? (GitHub Actions / none for now)
4. External services/APIs to integrate?
```

**Round 5 — Verification & challenge:**
```
Here's a summary of the stack decisions:
  Backend:  Python 3.12 + FastAPI
  Database: PostgreSQL 16
  Frontend: React 18 + Vite + Tailwind
  Deploy:   Docker Compose (dev), containerized (prod)
  External: Stripe API, SendGrid

I have the following concerns:
  1. [concern about scale/fit]
  2. [concern about complexity vs requirements]
  3. [concern about missing infrastructure]

Do you want to proceed, or should we adjust?
```

#### Phase 2: Design Artifact Generation

After stack decisions are confirmed, the architect generates the standard design artifacts:

| Artifact | Path | Content |
|----------|------|---------|
| System architecture | `specs/design/architecture.md` | Component diagram (Mermaid), tech choices with justification, data flow |
| API contracts | `specs/design/api-contracts.md` + `.schema.json` | Every endpoint with typed request/response schemas |
| Data models | `specs/design/data-models.md` + `.schema.json` | Pydantic + TypeScript interfaces + DB schema |
| Component map | `specs/design/component-map.md` | Maps each story to implementing files/modules |
| Folder structure | `specs/design/folder-structure.md` | Full file tree for all services |
| Deployment topology | `specs/design/deployment.md` | Docker Compose config, env vars, migrations, health checks |
| `project-manifest.json` | project root | Machine-readable stack config (from Harness) |
| `calibration-profile.json` | project root | UI standards review config — project type (SaaS/enterprise/internal), strictness level |

**Key difference from Forge's architect:** The Forge architect silently generates these artifacts. The merged architect generates them but also **annotates each decision** with the rationale discussed during the interview. These annotations flow into the learnings system.

#### Phase 3: Decision Verification Gate

Before the human approves the design, the architect runs a self-verification pass:

```
ARCHITECT VERIFICATION:

✓ Every BRD feature has a corresponding API endpoint in api-contracts.md
✓ Every data entity in the BRD has a model in data-models.md
✓ Layered architecture: no upward imports in folder-structure.md
✓ All external APIs have typed wrappers planned in component-map.md
✗ CONCERN: BRD mentions "real-time notifications" but no WebSocket
  endpoint is defined. Add /ws/notifications or switch to polling?
✗ CONCERN: No caching layer specified but BRD expects <200ms response
  on search endpoint with 100K+ records. Add Redis?
```

The architect flags gaps and asks the human to resolve them before proceeding. This prevents discovering design holes during implementation when they're 10x more expensive to fix.

#### Phase 4: Learnings Persistence (Cross-Project Knowledge)

After design approval, the architect writes a **stack decision record** to a learnings folder. This builds organizational knowledge across projects.

**Location:** `.claude/learnings/stack-decisions/`

**File format:** One file per project, named `{project-name}-stack.md`

```markdown
# Stack Decisions: {Project Name}

Date: {ISO 8601}
Project type: {consumer app | internal tool | API service}
Complexity: {small | medium | large}

## Decisions

### Backend: Python 3.12 + FastAPI
- **Why chosen:** AI integration requirements (LangChain, Anthropic SDK), async
  support for concurrent API calls, Pydantic for type-safe request validation.
- **Alternatives considered:** Django (rejected: no built-in admin needed, async
  support weaker), Express (rejected: team has stronger Python expertise).
- **Verdict after build:** {filled in post-build — see below}

### Database: PostgreSQL 16
- **Why chosen:** Relational data with complex joins across 4 entities, need
  full-text search (pg_trgm), JSONB for flexible metadata storage.
- **Alternatives considered:** MongoDB (rejected: data is highly relational),
  SQLite (rejected: concurrent writes needed in production).
- **Verdict after build:** {filled in post-build}

### Frontend: React 18 + Vite + Tailwind CSS
- **Why chosen:** Component library availability, team familiarity, Tailwind
  for rapid UI iteration with Tailwind utility classes.
- **Verdict after build:** {filled in post-build}

### Deployment: Docker Compose (dev) → ECS (prod)
- **Why chosen:** Multi-service architecture (backend + frontend + DB + Redis),
  need consistent dev/prod parity.
- **Verdict after build:** {filled in post-build}

## Patterns That Worked
{Filled in by architect at end of build — extracted from learned-rules.md}

## Patterns to Avoid Next Time
{Filled in by architect at end of build — extracted from failures.md}

## Recommendations for Similar Projects
{Filled in by architect at end of build — synthesis of above}
```

**Cross-project reuse:** When the architect starts a new project, it reads all files in `.claude/learnings/stack-decisions/` before the stack interview. This gives it concrete, project-specific evidence for recommendations:

> "In a similar consumer app last month (ProjectX), we used FastAPI + PostgreSQL
> and found that the async SQLAlchemy integration caused issues with Alembic
> migrations. We ended up adding a sync session factory for migrations. Want to
> account for that upfront?"

**Post-build update:** After `/auto` completes (or when the build reaches a stable state), the architect is re-invoked to fill in the "Verdict after build" and "Patterns" sections by reading `learned-rules.md` and `failures.md`. This closes the feedback loop.

#### Learnings Folder Structure

```
.claude/learnings/
├── stack-decisions/                    # Architect-maintained
│   ├── project-alpha-stack.md          # Per-project stack records
│   ├── project-beta-stack.md
│   └── _index.md                       # Summary of all projects + key patterns
├── failure-patterns/                   # Auto-extracted from failures.md
│   └── common-failures.md             # Recurring patterns across projects
└── integration-notes/                  # Per-API/service integration notes
    ├── stripe-integration.md           # What worked, what didn't, gotchas
    ├── sendgrid-integration.md
    └── anthropic-sdk-integration.md
```

The `learnings/` folder lives at the `.claude/` level (not inside a specific project's `specs/`) because it is **cross-project knowledge**. When using the plugin-dir installation model, this folder persists in the forge repo and is available to all future projects.

**Integration notes** are generated when the architect identifies external API integrations during the stack interview. After the build completes, the architect extracts integration-specific learnings from `failures.md` and `learned-rules.md` and writes them to dedicated files. These become available to future architects and generators working with the same APIs.

---

## 3. Skill Inventory (23 skills: 16 task + 7 reference)

### Task Skills (runnable via `/command`)

| # | Skill | Source | Changes |
|---|-------|--------|---------|
| 1 | `brd` | Forge | Keep Forge's Socratic 5-dimension interview + app/feature spec templates. Bound to `brd-creator` agent. |
| 2 | `architect` | **NEW** | Interactive stack interrogation (5 rounds), decision verification gate, design artifact generation, learnings persistence. Bound to `architect` agent. See Section 2a for full workflow. |
| 3 | `spec` | Forge | Keep Forge's story template and dependency graph format. Bound to `spec-writer` agent. |
| 4 | `design` | Merge | Spawns `architect` + `ui-designer` concurrently. Architect handles stack/schemas/deployment; ui-designer handles mockups. Human approval gate before proceeding. |
| 5 | `implement` | Harness | Generator with agent teams, phased execution, dependency handshake, file ownership — **add** Forge's quality principles injection |
| 6 | `evaluate` | Harness (new) | Three-layer verification: API curl, Playwright flows, schema validation against sprint contract |
| 7 | `review` | Merge | Forge's `code-reviewer` agent for quality + Harness's `security-reviewer` run concurrently. Forge brings story traceability and eval-based validation; Harness brings the evaluator's behavioral verification |
| 8 | `test` | Forge | Richer test plan, test case template, test data generation |
| 9 | `deploy` | Merge | Harness's `init.sh` generation + verification mode config + Forge's richer Docker templates (separate Dockerfiles for backend/frontend, `.env.example`) |
| 10 | `build` | Merge | **9-phase pipeline** (added architect phase). Human gates on phases 1-4 (BRD, architect, spec, design). Harness's mode passthrough and state initialization. |
| 11 | `auto` | Harness | The 550-line Harness version — GAN loop, sprint contracts, mode-dependent gate matrix, session chaining, browser console error capture, failure-driven learning. **Augment** with browser-based UI testing, Forge's self-healing error categories and `error-recovery.md` reference. Design-critic GAN sub-loop **removed** — replaced by single-pass UI standards review. |
| 12 | `fix-issue` | Forge | Richer issue workflow |
| 13 | `refactor` | Forge | Six quality principles + ratchet gate enforcement |
| 14 | `improve` | Forge | Feature enhancement with story-driven development |
| 15 | `lint-drift` | Harness (new) | Entropy scanner — unique to Harness, no Forge equivalent |
| 16 | `scaffold` | Merge | See Section 6 below |

**Pipeline change:** The build pipeline grows from 8 to 9 phases because the architect now has its own interactive phase between BRD and spec:

```
Phase 1: /brd          → BRD via Socratic interview       [HUMAN APPROVAL]
Phase 2: /architect     → Stack interrogation + design     [HUMAN APPROVAL]
Phase 3: /spec          → Stories + dependency graph       [HUMAN APPROVAL]
Phase 4: /design        → UI mockups (architect already done) [HUMAN APPROVAL]
Phase 5: Initialize state
Phases 6-9: /auto       → Autonomous build loop
Phase 10: Post-build    → Architect writes learnings
```

Note: Phase 2 (`/architect`) now subsumes the stack questions that were previously in `/scaffold`. The scaffold still asks basic project info (name, description) but defers all technical stack decisions to the architect agent, which has BRD context and can make informed challenges.

### Reference Skills (read by agents, not runnable)

| # | Skill | Source | Content |
|---|-------|--------|---------|
| 1 | `code-gen` | Merge | Forge's quality principles + patterns + testing rules + agent-team-setup example + Harness's API integration patterns (404 lines — external API wrappers, LLM integration, structured logging, exception taxonomy) |
| 2 | `spec-patterns` | Forge | BRD decomposition patterns + story template |
| 3 | `architect-patterns` | Merge | Forge's API patterns + folder structure template + Harness's `project-manifest.json`-driven overrides |
| 4 | `ui-mockup` | Forge | Design system, page template |
| 5 | `test-patterns` | Merge | Forge's test-case template + Harness's richer Playwright patterns (120 lines vs 57) and test-data fixtures (108 lines vs 56) |
| 6 | `evaluate-patterns` | Harness (new) | Sprint contract schema, scoring rubric, scoring examples, Playwright verification patterns |
| 7 | `stack-learnings` | **NEW** | Cross-project stack decision index, common failure patterns, integration notes. Read by architect at start of every new project. |

**Removed:** Forge's `deployment` reference skill is folded into the `deploy` task skill (templates are included directly). Forge's `build/references/error-recovery.md` is merged into `auto` skill's self-healing section.

---

## 4. Hook Inventory (14 hooks)

Take the union of both hook sets. Where both have the same hook, take the richer implementation.

| # | Hook | Source | Trigger | Behavior |
|---|------|--------|---------|----------|
| 1 | `scope-directory.js` | Either (identical) | Edit/Write | BLOCKS writes outside project |
| 2 | `protect-env.js` | Either (identical) | Edit/Write | BLOCKS .env modifications |
| 3 | `detect-secrets.js` | Either (identical) | Edit/Write | BLOCKS hardcoded keys/passwords/PII |
| 4 | `lint-on-save.js` | Harness | Edit/Write .py/.ts | Auto-fix ruff + eslint (reads `project-manifest.json` for stack-specific linting) |
| 5 | `typecheck.js` | Harness | Edit/Write .ts/.py | Runs tsc/mypy (reads manifest for toolchain) |
| 6 | `check-architecture.js` | Harness | Edit/Write | BLOCKS upward layer imports (reads manifest for custom layers) |
| 7 | `check-function-length.js` | Either | Edit/Write | Warns >50 lines |
| 8 | `check-file-length.js` | Either | Edit/Write | Warns 200, BLOCKS 300 |
| 9 | `protect-pdfs.js` | Forge (new to Harness) | Write to docs/ | BLOCKS fixture modification |
| 10 | `pre-commit-gate.js` | Either | git commit | BLOCKS commits with arch violations |
| 11 | `sprint-contract-gate.js` | Harness (new to Forge) | git commit | BLOCKS commits without approved sprint contract (in Full/Lean modes) |
| 12 | `teammate-idle-check.js` | Harness (new to Forge) | PostToolUse | Detects file ownership violations across teammates |
| 13 | `task-completed.js` | Either | TaskCompleted | Arch scan + reminds to run `/review` |
| 14 | `cost-tracker.js` | **NEW** | PostToolUse (Agent spawn) | Logs estimated token cost per agent spawn to `state/cost-log.json`; warns when cumulative estimate exceeds mode budget threshold |

**On hook #14 (cost-tracker):** This addresses the gap you identified. It won't enforce hard limits (Claude Code has no billing API), but it can estimate costs from agent spawn events (model tier × approximate context size) and surface warnings when the run is trending above the mode's documented range. Details in Section 8.

---

## 5. Templates and Reference Files

### From Forge (keep all — richer set)

```
skills/brd/templates/app_spec.md              (243 lines)
skills/brd/templates/feature_spec.md          (322 lines)
skills/architect-patterns/references/api-patterns.md (134 lines)
skills/architect-patterns/templates/folder-structure.md (161 lines)
skills/auto/references/state-schema.md         (103 lines)
skills/code-gen/examples/agent-team-setup.md   (52 lines)
skills/code-gen/references/patterns.md         (79 lines)
skills/code-gen/references/quality-principles.md (78 lines)
skills/code-gen/references/testing-rules.md    (52 lines)
skills/spec-patterns/templates/story-template.md (51 lines)
skills/test-patterns/examples/test-case-template.md  (92 lines)
skills/ui-mockup/templates/page-template.html  (exists in Forge only)
skills/deployment/templates/docker-compose.yml
skills/deployment/templates/Dockerfile.backend.dev
skills/deployment/templates/Dockerfile.frontend.dev
skills/deployment/templates/.env.example
```

### From Harness (keep all — unique to Harness)

```
skills/code-gen/references/api-integration-patterns.md (404 lines)
skills/evaluate-patterns/references/contract-schema.json (157 lines)
skills/evaluate-patterns/references/playwright-patterns.md (120 lines)
skills/evaluate-patterns/references/ui-standards-checklist.md (replaces scoring-examples.md)
skills/evaluate-patterns/references/standards-by-project-type.md (replaces scoring-rubric.md)
templates/features-template.json
templates/features-template.example.json
templates/sprint-contract.json
templates/init-sh.template
templates/docker-compose.template.yml
templates/playwright.config.template.ts
```

### From Forge (keep — unique to Forge)

```
evals/README.md
evals/expected.md
evals/samples/bad-dead-code.ts
evals/samples/bad-long-function.ts
evals/samples/bad-test-quality.ts
evals/samples/bad-upward-import.ts
```

### Resolve conflicts (both have, take richer)

| File | Winner | Why |
|------|--------|-----|
| `test-patterns/references/playwright.md` | Harness (120 vs 57 lines) | More patterns |
| `test-patterns/references/test-data.md` | Harness (108 vs 56 lines) | More fixtures |

---

## 6. Scaffold Command (`/scaffold`)

Merge the best of both onboarding flows.

### From Harness (keep — with modifications)
- Interactive setup questions **(reduced from 5 to 3** — stack/deployment questions deferred to architect agent)
- `project-manifest.json` generation — **partially deferred**: scaffold creates a skeleton manifest with project name and type; architect fills in stack details after BRD phase
- `calibration-profile.json` generation (consumer/internal/API-only presets) — stays in scaffold (no BRD context needed)
- `init.sh` bootstrap script — **deferred to architect** (needs stack decisions first)
- `features.json` and `claude-progress.txt` state initialization

### From Forge (keep)
- Plugin-based installation model (`--plugin-dir` → scaffold → self-contained)
- Team-shareable: clone repo and run `claude` — no plugin needed after scaffold
- Scaffold updates preserve user output files (`specs/`, source code, state)

### Merged scaffold flow

```
Step 1: Gather project info (3 questions — reduced from Harness's 5)
  Q1: "What are you building?" (brief description)
  Q2: "What type of project is this?"
      - A) Consumer-facing app (high design bar)
      - B) Internal tool / dashboard (functional focus)
      - C) API-only / backend service (no UI scoring)
  Q3: "Install complementary official Claude Code plugins?" (Yes/pick/no)

  NOTE: Stack, deployment, and verification mode questions are NO LONGER asked
  here. They are deferred to the /architect phase (Phase 2 of the pipeline),
  where the architect agent has BRD context and can make informed challenges.

Step 2: Generate skeleton project-manifest.json
  - name, description, project_type filled in
  - stack.* fields left as null (architect fills these)
  - evaluation.design_score_threshold set from project type
  - execution.default_mode set to "full" (overridable later)

Step 3: Generate calibration-profile.json (from project type preset)
Step 4: Copy scaffold files (agents, skills, hooks, templates, evals, state, learnings)
Step 5: Install official plugins (optional)
Step 6: Generate CLAUDE.md (slim TOC)
Step 7: Create output directories
Step 8: Initialize state files
Step 9: Initialize learnings folder
  - Create .claude/learnings/stack-decisions/ (empty)
  - Create .claude/learnings/failure-patterns/ (empty)
  - Create .claude/learnings/integration-notes/ (empty)
  - Copy any existing learnings from the forge repo's learnings/ if present
    (cross-project knowledge transfer)
Step 10: Initialize git + .gitignore
Step 11: Report
```

**Why defer stack to architect:** The scaffold runs before any requirements are known. Asking "Python or Node?" without context leads to cargo-cult decisions. The architect asks the same questions but *after reading the BRD*, so it can challenge: "You chose Express but your BRD describes heavy PDF processing and ML inference. Python would be more natural here."

---

## 7. State Files (merged set)

| File | Source | Purpose |
|------|--------|---------|
| `claude-progress.txt` | Harness | Session chaining — append-only, one block per iteration |
| `features.json` | Harness | Granular feature pass/fail with failure_layer and timestamps |
| `iteration-log.md` | Both | Every iteration: story, action, result, coverage, commit |
| `learned-rules.md` | Both | Monotonic knowledge base — never deleted |
| `failures.md` | Both | Raw failure data for pattern extraction |
| `coverage-baseline.txt` | Both | Last committed coverage % |
| `eval-scores.json` | Harness | Design-critic scores per component per iteration |
| `cost-log.json` | **NEW** | Estimated token cost per agent spawn (see Section 8) |

---

## 8. New Feature: Cost Estimation (addressing the gap)

Since Claude Code exposes no billing API, true enforcement is impossible. But estimation + warnings is achievable and useful.

### Approach

A new `cost-tracker.js` hook runs on every Agent tool invocation. It logs:

```json
{
  "timestamp": "2026-03-27T14:30:00Z",
  "agent": "evaluator",
  "model_tier": "opus",
  "estimated_input_tokens": 12000,
  "estimated_output_tokens": 4000,
  "estimated_cost_usd": 0.48,
  "cumulative_cost_usd": 23.50,
  "mode": "full",
  "mode_budget_range": [100, 300],
  "budget_pct": 7.8
}
```

### Estimation method

| Model | Input $/1M tokens | Output $/1M tokens | Assumed avg input | Assumed avg output |
|-------|-------------------|--------------------|--------------------|---------------------|
| Opus | $15 | $75 | 15K tokens | 5K tokens |
| Sonnet | $3 | $15 | 10K tokens | 3K tokens |

These are rough multipliers. The hook estimates per-spawn cost as: `(input_tokens × input_rate) + (output_tokens × output_rate)`.

### Warning thresholds

| Mode | Budget range | Warn at | Hard warn at |
|------|-------------|---------|-------------|
| Full | $100-300 | 60% of midpoint ($120) | 100% of high ($300) |
| Lean | $30-80 | 60% of midpoint ($33) | 100% of high ($80) |
| Solo | $5-15 | 60% of midpoint ($6) | 100% of high ($15) |
| Turbo | $30-50 | 60% of midpoint ($24) | 100% of high ($50) |

At "warn," the hook emits an advisory message. At "hard warn," it logs a prominent warning to `iteration-log.md` and appends a note to `program.md` so the human sees it on next check-in. It does **not** halt execution — that's the human's call.

### Reporting

Add a `/cost` command (simple skill) that reads `cost-log.json` and prints:

```
Mode: Lean (budget: $30-80)
Agent spawns: 47
Estimated total: $52.30 (65% of budget ceiling)
Breakdown: Opus 12 spawns ($38.40), Sonnet 35 spawns ($13.90)
Top consumers: evaluator ($18.20), ui-standards-reviewer ($4.50), generator-team ($9.80)
```

**Important caveats to document:** These are estimates, not actual billing. Token counts are approximated from context size heuristics. Actual costs depend on prompt caching, system prompt sharing, and output length variation. The purpose is directional awareness, not accounting.

---

## 9. Merged `/auto` Loop (the core engine)

The Harness's 550-line `auto/SKILL.md` is the base. Augment with these Forge elements:

### Additions from Forge

1. **Error recovery reference** — Forge's `build/references/error-recovery.md` gets merged into the self-healing section, enriching the 10-category error classifier.

2. **Code reviewer gate** — Insert between Gate 5 (Evaluator) and the UI standards review. After the evaluator passes behavioral checks, the Forge's `code-reviewer` agent runs a static analysis pass (quality principles, architecture compliance, story traceability). This catches issues the evaluator can't see (dead code, `any` types, function length).

3. **Evals validation** — After any modification to the code-reviewer agent's rules or the learned-rules file, auto-run the eval samples to verify the reviewer still catches known violations. This is a Forge-exclusive concept that prevents reviewer regression.

4. **Richer self-healing** — Forge's auto skill has a 10-category error taxonomy (lint, type_error, test_failure, import_error, arch_violation, coverage_drop, runtime_error, docker_error, playwright_error, schema_error). Harness has a simpler classification. Take the Forge taxonomy. **Add** `console_error` and `network_error` as categories 11 and 12 for browser-detected issues.

### NEW: Browser-Based UI Error Testing (Layer 2.5)

The evaluator's Playwright checks (Layer 2) verify *functional behavior* — does the button work, does the text appear. But they miss runtime errors that don't break the visible UI: unhandled promise rejections, failed API calls swallowed by catch blocks, React error boundaries firing, CORS errors, missing resources.

**Layer 2.5 adds browser health verification** that runs during every Playwright check and feeds errors directly back into the self-healing loop.

#### How it works

During Layer 2 (Playwright checks), the evaluator captures browser telemetry alongside functional assertions:

```
For each playwright_check in sprint contract:
  1. Navigate to page
  2. START browser monitoring
     - Capture all console.error and console.warn entries
     - Capture all network requests with status codes
  3. Execute Playwright interaction steps (click, fill, assert)
  4. STOP browser monitoring
  5. Evaluate functional assertions (existing Layer 2)
  6. Evaluate browser health (NEW Layer 2.5):
     a. Any console.error entries? → FAIL (with full error text)
     b. Any network 4xx/5xx not in sprint contract's expected_errors? → FAIL
     c. Any unhandled promise rejections? → FAIL
     d. React error boundary activations? → FAIL
     e. console.warn entries? → WARN (logged but non-blocking)
     f. Slow network requests (>3s)? → WARN
```

#### Browser monitoring implementation

Two approaches, chosen based on what's available:

**Option A — Playwright built-in (default, no Chrome extension needed):**
Playwright natively supports console and network capture:
```javascript
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));
page.on('response', resp => { if (resp.status() >= 400) networkErrors.push({url, status}); });
```
The evaluator instructs the test-engineer to wire these listeners into every Playwright test. This works in headless mode with zero additional dependencies.

**Option B — Chrome extension (when connected):**
If Claude in Chrome MCP tools are available (`read_console_messages`, `read_network_requests`), the evaluator uses these instead for richer capture (full stack traces, request/response bodies, timing data). The evaluator auto-detects which tools are available and uses the richer option.

#### Error feedback loop

Browser errors feed directly into the existing self-healing cycle — no separate bug-fixing pipeline needed:

```
Evaluator Layer 2.5 finds console.error:
  "TypeError: Cannot read property 'map' of undefined at UserList.jsx:42"

→ Evaluator writes structured failure:
  {
    "layer": "browser_console",
    "error_type": "console_error",
    "message": "TypeError: Cannot read property 'map' of undefined",
    "source_file": "UserList.jsx",
    "source_line": 42,
    "page": "/users",
    "interaction": "After clicking 'Load Users' button"
  }

→ Generator receives failure with exact file:line
→ Generator applies targeted fix (null check, loading state, error boundary)
→ Evaluator re-runs the same Playwright check + Layer 2.5
→ Pass? Commit. Fail? Retry (max 3, then revert + learn)
```

The key insight: browser errors are just another failure category in the self-healing loop. They use the same ratchet mechanics as test failures or API errors. No new infrastructure needed — just a new classification (`console_error`, `network_error`) in the 12-category error taxonomy.

#### What gets captured vs. ignored

| Captured (FAIL) | Captured (WARN) | Ignored |
|-----------------|-----------------|---------|
| `console.error(*)` | `console.warn(*)` | `console.log(*)` |
| Unhandled promise rejections | Deprecation warnings | React development mode warnings |
| Network 4xx/5xx (unexpected) | Slow responses (>3s) | Expected 4xx (e.g., 404 for "not found" flow) |
| React error boundary catches | Missing favicon (404) | Hot module reload messages |
| Script load failures | Mixed content warnings | Source map warnings |

The sprint contract's `expected_errors` field lets the generator declare which errors are intentional (e.g., a 404 test, a deliberate error boundary exercise). Anything not in that list is a real bug.

### Redesigned: UI Standards Review (was Design Critic)

The original Harness `design-critic` ran a multi-iteration GAN loop scoring originality, craft, and design quality with plateau detection and forced pivots. This is removed. It's expensive, unpredictable, and optimizes for the wrong thing — most SaaS and enterprise apps should be predictable and standards-conformant, not original.

**Replacement: `ui-standards-reviewer` — a single-pass conformance check.**

The `ui-standards-reviewer` agent runs **once** per frontend group (not in a loop). It checks whether the UI meets industry-standard patterns for the project type (SaaS, enterprise dashboard, internal tool). It does not score originality or push for creative differentiation.

#### What it checks

| Check | SaaS app | Enterprise/internal | API-only |
|-------|----------|-------------------|----------|
| Responsive layout (desktop + mobile breakpoints) | Required | Desktop only | Skip |
| Consistent spacing system (4px/8px grid) | Required | Required | Skip |
| Color contrast (WCAG AA — 4.5:1 for text) | Required | Required | Skip |
| Interactive feedback (hover, focus, loading, error states) | Required | Required | Skip |
| Form validation (inline errors, not just alerts) | Required | Required | Skip |
| Navigation consistency (same nav on every page) | Required | Required | Skip |
| Empty states (not just blank pages) | Required | Recommended | Skip |
| Error pages (404, 500 with recovery actions) | Required | Required | Skip |
| Typography hierarchy (clear H1 > H2 > body) | Required | Required | Skip |
| Touch targets (min 44px for mobile) | Required | Not required | Skip |

#### How it works

```
ui-standards-reviewer receives:
  - Screenshots at 1280px and 375px (taken by evaluator via Playwright)
  - The project type from calibration-profile.json
  - The checklist above filtered by project type

ui-standards-reviewer outputs:
  - PASS/FAIL per check with one-line explanation
  - For FAILs: specific fix instruction ("Add min-height: 44px to .btn-primary")
  - Overall: PASS if all required checks pass, FAIL if any required check fails

No scoring. No iteration. No plateau detection. No originality judgment.
Fix instructions go directly to generator via normal self-healing loop.
```

#### Model tier change: Opus → Sonnet

The original design-critic needed Opus for subjective visual judgment (scoring originality on a 1-10 scale). The ui-standards-reviewer is checking objective conformance against a checklist — Sonnet handles this well and costs ~5x less. This alone saves $8-15 per frontend group compared to the original GAN loop.

#### calibration-profile.json (simplified)

The original had weighted scoring criteria (design_quality: 1.5x, originality: 1.5x, etc.) with plateau detection and iteration limits. The new version is a simple feature flag set:

```json
{
  "project_type": "saas",
  "ui_standards": {
    "responsive_required": true,
    "mobile_breakpoint": 375,
    "desktop_breakpoint": 1280,
    "wcag_level": "AA",
    "min_touch_target": 44,
    "spacing_grid": 8,
    "empty_states_required": true,
    "error_pages_required": true
  }
}
```

No weights. No thresholds. No iteration config. Just a list of what's required for this project type.

### Merged gate sequence (8 gates)

```
Gate 1: Unit tests (pytest, vitest)                      [all modes]
Gate 2: Lint + types (ruff, mypy, tsc)                   [all modes]
Gate 3: Coverage >= baseline                              [all modes]
Gate 4: Architecture checks                               [full/lean]
Gate 5: Evaluator (API + Playwright + Browser Console)    [full/lean]
Gate 6: Code reviewer (static quality)                    [full/lean]
Gate 7: UI standards review (conformance checklist)       [full only]
Gate 8: Security reviewer                                 [full only]
```

Turbo runs gates 1-3 per commit, gates 4-8 once at end.
Solo runs gates 1-3 only.
Lean runs gates 1-6 (skips UI standards and security — they can run manually via `/review`).

**Key difference from original:** Gate 5 now includes browser console error capture (Layer 2.5) as part of the evaluator's standard pass. This means even Lean mode catches frontend runtime errors. Gate 7 is a single pass, not an iterative loop — if it fails, the fix goes through normal self-healing (max 3 attempts), not a separate GAN cycle.

---

## 10. Validation Scripts

Keep both of the Harness's validation scripts and add a new one:

| Script | Source | Purpose |
|--------|--------|---------|
| `validate-scaffold.sh` | Harness (188 lines) | Verifies scaffold output: all files exist, manifest is valid JSON, state files initialized |
| `validate-gan-loop.sh` | Harness (376 lines) | Smoke-tests the autonomous loop: creates a minimal project, runs /auto in solo mode, verifies ratchet gates execute, confirms browser console capture wiring |
| `validate-evals.sh` | **NEW** | Runs Forge's eval samples through the code-reviewer agent, compares findings against expected.md |

---

## 11. Directory Structure (merged)

```
claude_harness_forge/
├── .claude-plugin/
│   └── plugin.json                    # Plugin manifest for --plugin-dir
├── commands/
│   └── scaffold.md                    # Merged scaffold command
├── agents/                            # 10 agents
│   ├── brd-creator.md                 # Forge (Socratic interview, 5 dimensions)
│   ├── architect.md                   # REDESIGNED (interactive stack, verification, learnings)
│   ├── spec-writer.md                 # Forge (BRD → stories)
│   ├── generator.md                   # Harness (code + teams + contracts)
│   ├── evaluator.md                   # Harness (3-layer verification)
│   ├── ui-standards-reviewer.md        # REDESIGNED (SaaS/enterprise conformance check)
│   ├── code-reviewer.md               # Forge (quality + traceability)
│   ├── security-reviewer.md           # Harness (OWASP)
│   ├── test-engineer.md               # Forge (richer)
│   └── ui-designer.md                 # Forge (richer)
├── skills/
│   ├── brd/                           # Forge (Socratic interview + templates)
│   │   ├── SKILL.md
│   │   └── templates/
│   │       ├── app_spec.md
│   │       └── feature_spec.md
│   ├── architect/                     # NEW — interactive stack/deployment skill
│   │   ├── SKILL.md                   # 5-round interview, verification gate, learnings
│   │   └── references/
│   │       └── stack-questionnaire.md # Structured question bank by project type
│   ├── spec/SKILL.md                  # Forge (story decomposition)
│   ├── design/SKILL.md                # Merged (concurrent agents + schemas)
│   ├── implement/SKILL.md             # Harness (generator + teams + handshake)
│   ├── evaluate/SKILL.md              # Harness (sprint contract verification)
│   ├── review/SKILL.md                # Merged (code-reviewer + security concurrent)
│   ├── test/SKILL.md                  # Forge (richer test planning)
│   ├── deploy/SKILL.md                # Merged (init.sh + Docker templates)
│   ├── build/SKILL.md                 # Merged (8-phase + mode passthrough)
│   ├── auto/                          # Harness (augmented — see Section 9)
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── state-schema.md        # Forge
│   ├── fix-issue/SKILL.md             # Forge
│   ├── refactor/SKILL.md              # Forge
│   ├── improve/SKILL.md               # Forge
│   ├── lint-drift/SKILL.md            # Harness
│   ├── cost/SKILL.md                  # NEW — reads cost-log.json, prints summary
│   ├── code-gen/                      # Merged reference skill
│   │   ├── SKILL.md
│   │   ├── examples/
│   │   │   └── agent-team-setup.md    # Forge
│   │   └── references/
│   │       ├── api-integration-patterns.md  # Harness (404 lines)
│   │       ├── patterns.md            # Forge
│   │       ├── quality-principles.md  # Forge
│   │       └── testing-rules.md       # Forge
│   ├── spec-writing/                  # Forge reference skill
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── story-template.md
│   ├── architecture/                  # Merged reference skill
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   └── api-patterns.md        # Forge
│   │   └── templates/
│   │       └── folder-structure.md    # Forge
│   ├── ui-mockup/                     # Forge reference skill
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── page-template.html
│   ├── testing/                       # Merged reference skill
│   │   ├── SKILL.md
│   │   ├── examples/
│   │   │   └── test-case-template.md  # Forge
│   │   └── references/
│   │       ├── playwright.md          # Harness (120 lines — richer)
│   │       └── test-data.md           # Harness (108 lines — richer)
│   └── evaluation/                    # Harness reference skill
│       ├── SKILL.md
│       └── references/
│           ├── contract-schema.json
│           ├── playwright-patterns.md
│           ├── ui-standards-checklist.md
│           └── standards-by-project-type.md
│   └── stack-learnings/               # NEW reference skill
│       └── SKILL.md                   # How to read/write learnings, index format
├── hooks/                             # 14 hooks
│   ├── scope-directory.js
│   ├── protect-env.js
│   ├── detect-secrets.js
│   ├── lint-on-save.js                # Harness (manifest-aware)
│   ├── typecheck.js                   # Harness (manifest-aware)
│   ├── check-architecture.js          # Harness (manifest-aware)
│   ├── check-function-length.js
│   ├── check-file-length.js
│   ├── protect-pdfs.js                # Forge
│   ├── pre-commit-gate.js
│   ├── sprint-contract-gate.js        # Harness
│   ├── teammate-idle-check.js         # Harness
│   ├── task-completed.js
│   └── cost-tracker.js                # NEW
├── evals/                             # Forge
│   ├── README.md
│   ├── expected.md
│   └── samples/
│       ├── bad-dead-code.ts
│       ├── bad-long-function.ts
│       ├── bad-test-quality.ts
│       └── bad-upward-import.ts
├── templates/                         # Merged
│   ├── docker-compose.template.yml    # Harness
│   ├── Dockerfile.backend.dev         # Forge
│   ├── Dockerfile.frontend.dev        # Forge
│   ├── .env.example                   # Forge
│   ├── features-template.json         # Harness
│   ├── features-template.example.json # Harness
│   ├── init-sh.template               # Harness
│   ├── playwright.config.template.ts  # Harness
│   └── sprint-contract.json           # Harness
├── learnings/                         # NEW — cross-project knowledge base
│   ├── stack-decisions/               # Architect-maintained stack records
│   │   └── _index.md                  # Summary + patterns across projects
│   ├── failure-patterns/              # Common failures extracted across projects
│   │   └── common-failures.md
│   └── integration-notes/             # Per-API/service integration learnings
│       └── _template.md               # Template for new integration notes
├── state/                             # Initial state files
│   ├── coverage-baseline.txt
│   ├── eval-scores.json               # Harness
│   ├── failures.md
│   ├── iteration-log.md
│   ├── learned-rules.md
│   └── cost-log.json                  # NEW
├── scripts/                           # Validation
│   ├── validate-scaffold.sh           # Harness
│   ├── validate-gan-loop.sh           # Harness
│   └── validate-evals.sh             # NEW
├── architecture.md                    # Merged
├── program.md                         # Harness (Karpathy bridge)
├── settings.json                      # Merged hook config
├── CLAUDE.md                          # Merged (slim TOC)
├── design.md                          # Merged (full architecture reference)
└── README.md                          # Merged (installation + usage)
```

---

## 12. Implementation Phases

### Phase 1: Structural Setup (Day 1)
- Create new repo with directory structure above
- Copy Harness `auto/SKILL.md` as base `/auto`
- Copy all Forge templates and reference files
- Copy all Harness evaluation references and templates
- Copy Forge evals directory unchanged
- Set up `.claude-plugin/plugin.json`

### Phase 2: Agent Definitions (Day 1-2)
- Copy `brd-creator.md` from Forge (280 lines — keep as-is, it's excellent)
- **Write new `architect.md`** — the redesigned interactive agent (Section 2a): 5-round stack interrogation, decision verification gate, design artifact generation, learnings persistence workflow
- Copy `spec-writer.md` from Forge
- Copy `generator.md` from Harness
- Copy `evaluator.md` from Harness — **augment** with browser console capture instructions (Layer 2.5) and structured failure format for `console_error` / `network_error` categories
- **Write new `ui-standards-reviewer.md`** — single-pass conformance checker replacing the GAN design-critic. Sonnet tier. Checklist-based, no scoring, no iteration.
- Copy `code-reviewer.md` from Forge
- Take richer version of `security-reviewer.md`, `test-engineer.md`, `ui-designer.md`
- Add `model_preference:` frontmatter to each agent (Opus vs Sonnet)

### Phase 3: Skill Merging (Day 2-3)
- **Write new `architect/SKILL.md`** — 5-round interview protocol, verification gate checklist, learnings read/write workflow, manifest completion logic
- Write `architect/references/stack-questionnaire.md` — structured question bank organized by project type (consumer/internal/API-only)
- Merge `design/SKILL.md` — now spawns architect (if not already run) + ui-designer concurrently
- Merge `review/SKILL.md` — Forge's code-reviewer + Harness's evaluator
- Merge `deploy/SKILL.md` — union of templates
- Merge `build/SKILL.md` — **9 phases** (added architect phase between BRD and spec) + Harness's mode passthrough
- Augment `auto/SKILL.md` with Forge additions (Gate 6 code-reviewer, error taxonomy, eval validation)
- Write new `stack-learnings/SKILL.md` — documents the learnings folder format, how architect reads existing learnings, how it writes new records
- Copy all non-conflicting skills directly from their source
- Write new `cost/SKILL.md`

### Phase 4: Hook Integration (Day 3)
- Take Harness versions of `lint-on-save.js`, `typecheck.js`, `check-architecture.js` (manifest-aware)
- Copy Forge's `protect-pdfs.js`
- Copy Harness's `sprint-contract-gate.js` and `teammate-idle-check.js`
- Write new `cost-tracker.js`
- Build merged `settings.json` with all 14 hooks configured

### Phase 5: Scaffold Command (Day 3-4)
- Merge both scaffold commands (reduced to 3 questions — stack deferred to architect)
- Wire up skeleton manifest generation (stack fields left null for architect)
- Wire up calibration profile, state files, git init
- **Add learnings folder initialization** — create empty `learnings/` subdirectories, copy existing learnings from forge repo if present
- Test end-to-end scaffold flow

### Phase 6: Documentation (Day 4)
- Write merged `design.md` — Harness's architecture reference + Forge's quality principles
- Write merged `README.md` — Forge's onboarding ergonomics + Harness's mode reference
- Write merged `CLAUDE.md` template for scaffolded projects

### Phase 7: Validation (Day 5)
- Update `validate-scaffold.sh` for merged structure
- Update `validate-gan-loop.sh` for 8-gate ratchet and browser console capture
- Write `validate-evals.sh`
- Run all three validation scripts against a test scaffold

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Agent count bloat (9 agents consuming context) | Keep agent definitions lean (~25-30 lines each). Reference skills for details. Only spawn agents needed for current phase. |
| Skill file size (auto/SKILL.md at 550+ lines) | Split into sections with clear headers. Agents read only the section relevant to their role. |
| Sprint contract overhead for small projects | Solo mode skips contracts entirely. Lean mode keeps contracts but simplifies them. |
| Cost estimates diverge from reality | Document estimates as directional only. Provide `/cost` command for mid-run awareness. Don't enforce — inform. |
| Harness hooks conflict with Forge hooks | Use Harness manifest-aware hooks as base. They're strictly superior (fall back to defaults when no manifest exists). |
| Onboarding complexity | Plugin-dir approach keeps first-use simple. Scaffold command asks 6 questions, then generates everything. After scaffold, no plugin needed. |

---

## 14. Success Criteria

The merged system passes when:

1. `validate-scaffold.sh` passes — all files generated, manifest valid, state initialized, learnings folder created
2. `validate-gan-loop.sh` passes — autonomous loop executes in solo mode, ratchet gates fire, self-healing triggers on injected failure
3. `validate-evals.sh` passes — code-reviewer catches all known violations in eval samples
4. A real project can be built end-to-end in Full mode: BRD → architect (stack interrogation) → spec → design → auto → deployed app with passing sprint contracts
5. Architect interrogation works interactively: asks stack questions after reading BRD, challenges weak decisions, generates manifest + design artifacts, writes learnings record
6. **Browser console errors detected:** Evaluator captures a deliberately injected `console.error` during Playwright checks, classifies it as `console_error`, and generator self-heals by fixing the source file
7. **UI standards review passes:** `ui-standards-reviewer` checks a frontend group against SaaS standards checklist in a single pass (no iteration loop), and failed checks produce fix instructions that the generator applies
8. Learnings persist across projects: second project's architect reads first project's stack-decisions and references them during interrogation
7. Session chaining works: kill Claude mid-build, restart, and the loop resumes from `claude-progress.txt`
8. `/cost` reports estimates within reasonable range for the chosen mode
9. Post-build learnings: architect re-invoked after build completes to fill in "Verdict after build" and "Patterns" sections in the stack decision record

---

## 15. References

### Source Implementations

The Forge and Harness philosophies described in this document were originally implemented as:

- **The Forge:** [claude_code_forge_v2](https://github.com/cwijayasundara/claude_code_forge_v2) — template-rich SDLC scaffolding with Socratic BRD interviews, 6 quality principles, code reviewer evals, UI mockup generation, and plugin-first onboarding
- **The Harness:** [claude_harness_eng_v1](https://github.com/cwijayasundara/claude_harness_eng_v1) — GAN-inspired adversarial verification with sprint contracts, Karpathy ratcheting, 3-layer browser verification, session chaining, and 4 execution modes

### Harness Engineering Research

- [Anthropic: Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Steve Krenzel: AI is Forcing Us to Write Good Code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code)

### Multi-Agent Coding Research

- SWE-agent (Princeton, 2024) — agent-computer interfaces for automated software engineering
- AgentCoder (2024) — adversarial programmer/test-designer/executor loop
- MetaGPT (2024) — structured artifacts between agents reduce hallucination cascading
- Reflexion (Shinn et al., 2023) — verbal reinforcement learning from failure analysis
- AlphaCode 2 (DeepMind, 2023) — verifier models more valuable than generator improvements
