# Claude Harness Forge

> GAN-inspired autonomous SDLC scaffold with browser-based verification, Karpathy ratcheting, cross-project learning, and local LLM support.

A Claude Code plugin for autonomous long-running application development. Born from merging two complementary philosophies — **the Forge** (template-rich SDLC scaffolding) and **the Harness** (adversarial verification engineering) — into a unified system that builds software the way a well-run engineering team would: rigorous requirements, challenged design decisions, parallel implementation, and independent verification.

Implements best practices from Anthropic's harness design research, OpenAI's harness engineering, and recent multi-agent coding systems (SWE-agent, AgentCoder, MetaGPT, Reflexion).

---

## Why This Exists: Two Philosophies, Neither Complete

### The Forge Philosophy — Template-Rich SDLC Scaffolding

The Forge approach treats autonomous development as a **structured engineering process** that needs rich guidance at every phase. It provides Socratic BRD interviews with 5-dimension exploration (Why, What, How, Edge Cases, UI), alternatives analysis before committing to approaches, story templates with Given/When/Then acceptance criteria, six enforced quality principles (small modules, static typing, short functions, explicit errors, no dead code, self-documenting names), code reviewer regression tests, UI mockup generation as self-contained HTML, and a plugin-first onboarding model.

**Core belief:** If you give agents detailed enough templates, patterns, and checklists, they will produce quality code. Quality comes from thorough upfront specification.

**But it has critical gaps:**

| Weakness | Impact |
|----------|--------|
| **No generator/evaluator separation** | The same agent writes code and judges its quality — self-evaluation bias means bugs pass review |
| **No sprint contracts** | No machine-readable "done" criteria. The build loop declares victory based on vibes, not verified behavior |
| **No behavioral verification** | Code review checks source code structure, but never runs the app. A function that passes lint but returns wrong results won't be caught |
| **No browser console capture** | Frontend runtime errors (unhandled rejections, failed API calls, React error boundaries) are invisible |
| **No monotonic ratcheting** | Coverage can drop, tests can be deleted, architecture can drift. Quality is not guaranteed to move forward |
| **No session chaining** | Long builds can't survive context window limits. No resume-from-checkpoint capability |
| **Weaker Playwright patterns** | 57 lines of Playwright guidance vs 120 in the Harness |
| **Weaker test data patterns** | 56 lines vs 108 — less guidance on realistic fixtures and factory functions |
| **No execution modes** | One-size-fits-all. A weekend prototype and a production SaaS get the same (expensive) treatment |

The Forge builds fast from rich foundations but can't guarantee what it built actually works.

### The Harness Philosophy — Adversarial Verification Engineering

The Harness approach treats autonomous development as a **control problem** where the biggest risk is the agent declaring victory on broken code. Inspired by GAN architectures, it structurally separates the generator (writes code) from the evaluator (verifies behavior) — the agent that builds can never evaluate its own work. It introduces sprint contracts (machine-readable JSON defining done criteria), 3-layer verification (API curl + Playwright browser automation + browser console error capture), Karpathy-style monotonic ratcheting (quality metrics only move forward), session chaining for multi-context-window builds, and four execution modes (Full/Lean/Solo/Turbo) that right-size cost to project complexity.

**Core belief:** If you verify behavior adversarially and prevent quality regression, the output will be reliable. Quality comes from rigorous independent verification.

**But it has critical gaps:**

| Weakness | Impact |
|----------|--------|
| **Minimal BRD process** | No Socratic interview, no 5-dimension exploration, no alternatives analysis. Requirements are shallow |
| **No interactive architect** | Stack decisions are asked during scaffold (before BRD exists) with no challenge or verification. Leads to cargo-cult technology choices |
| **Fewer reference skills** | 7 reference files vs Forge's 14. Agents have less guidance for implementation patterns |
| **No code reviewer evals** | No regression tests for the reviewer agent. Changes to review rules can silently weaken quality checks |
| **No UI mockup generation** | No design phase at all — jumps from spec to implementation. UI quality depends entirely on the generator's taste |
| **Expensive design-critic GAN loop** | A multi-iteration loop scoring "originality" and "craft" on a 1-10 scale. Costs $8-15 per frontend group and optimizes for the wrong thing (most SaaS apps should be predictable, not original) |
| **Less onboarding polish** | Requires more manual setup. No plugin-first model, no scaffold command, no self-contained project after setup |
| **No story template structure** | Stories lack the Given/When/Then acceptance criteria format that makes them testable |

The Harness guarantees behavioral correctness but wastes iterations compensating for weak specs.

### Why Neither Alone Is Sufficient

The Forge builds fast from rich foundations but can't guarantee what it built works. The Harness guarantees behavioral correctness but wastes iterations compensating for weak specs. Neither philosophy alone produces reliable autonomous software — you need both rigorous upfront specification **and** rigorous independent verification.

### Claude Harness Forge — The Unification

The merged system uses the **Harness's adversarial verification as the structural backbone** and the **Forge's rich templates and developer ergonomics as the flesh**.

| Capability | The Forge | The Harness | Harness Forge |
|------------|----------|------------|---------------|
| BRD process | Socratic 5-dimension | Minimal | **Forge's Socratic interview** |
| Architect | Silent doc generator | No architect | **Interactive 6-round interrogation with challenges** |
| Story templates | Rich (Given/When/Then) | Basic | **Forge's templates** |
| Code generation | Implementer agent | Generator + agent teams | **Harness's teams + Forge's quality principles** |
| Verification | Code review only | 3-layer (API + Playwright + console) | **Harness's 3-layer + Forge's code reviewer** |
| UI review | Design-critic GAN loop ($8-15) | Same | **Single-pass conformance check (~$1)** |
| Quality ratchet | None | 7-gate Karpathy | **8-gate ratchet (added code reviewer gate)** |
| Sprint contracts | None | Yes | **Yes** |
| Session chaining | None | Yes | **Yes** |
| Execution modes | None (one mode) | 4 modes | **4 modes (Full/Lean/Solo/Turbo)** |
| Reference skills | 14 files | 7 files | **20+ files (union of both)** |
| Code reviewer evals | Yes (4 samples) | None | **Yes** |
| Cross-project learning | None | None | **NEW: Stack decisions, failure patterns, integration notes** |
| LLM model selection | None | None | **NEW: Cloud-only, hybrid, or local-only routing** |
| Browser console capture | None | Basic | **Enhanced: 12-category error taxonomy** |
| Plugin onboarding | Yes | No | **Yes** |
| Cost tracking | None | None | **NEW: Per-agent cost estimation with mode budgets** |

### Key Design Decisions in the Merge

1. **Kept the GAN split, added code review.** The Harness's generator/evaluator separation eliminates self-evaluation bias — the single biggest quality risk. The Forge's code reviewer adds a static analysis gate the evaluator can't do (dead code, type quality, architecture compliance).

2. **Replaced the design-critic GAN loop with a single-pass checklist.** The Harness's iterative design scoring loop was expensive and optimized for "originality" — wrong for most SaaS apps. The replacement checks objective conformance (spacing, contrast, responsiveness) in one pass for ~$1 instead of ~$12.

3. **Promoted the architect to an interactive agent.** Neither parent had a proper architect. The Forge's was a silent document generator; the Harness had none. The new architect reads the BRD, conducts a 6-round interrogation (backend, database, frontend, LLM model selection, deployment, verification), challenges weak decisions, and persists learnings.

4. **Added cross-project learning.** Neither parent learned from past projects. The new system persists stack decisions, failure patterns, and integration notes. The architect reads these before every new project.

5. **Added local LLM support.** Neither parent supported running on local models. The new system offers three routing strategies: cloud-only (Claude), hybrid (Claude for reasoning + local for code gen), and local-only (Qwen3-Coder, DeepSeek, or any OpenAI-compatible endpoint).

---

## What Makes This Different

- **Generator-Evaluator separation** — the agent that writes code cannot evaluate it. Structural elimination of self-evaluation bias.
- **Browser console error capture** — Playwright captures `console.error`, unhandled rejections, and failed network requests during UI verification. Frontend bugs feed directly into self-healing.
- **Interactive architect** — conducts up to 11 rounds of stack interrogation informed by your BRD, challenges weak decisions, offers local LLM options, detects AI-native project types, and persists learnings across projects.
- **12-gate ratchet** — monotonic progress. Coverage never drops, tests never break, architecture never drifts. Gates 9-12 add mutation testing, compliance review, spec gaming detection, and smoke launch with real data. Quality only moves forward.
- **OWASP Agentic Top 10** — security reviewer checks both traditional web vulnerabilities (OWASP Web Top 10) and agentic-specific threats (ASI01-ASI10): excessive agency, prompt injection, insecure tool use, insufficient access control, improper output handling, and more.
- **Compliance reviewer** — dedicated agent for bias/fairness audits, PII detection, data privacy checks, regulatory compliance, and model card generation. Activated automatically for ML projects.
- **Mutation testing** — gate 9 runs mutmut (Python) or Stryker (TypeScript) to verify tests actually catch regressions, not just cover lines.
- **Spec gaming detection** — gate 11 detects reward hacking: tests that assert on trivial values, coverage inflated by dead code, mocked-out verification, hardcoded expected outputs. Runs in all modes and cannot be disabled.
- **AI-native detection** — the architect analyzes the BRD and classifies the project as CRUD, ML, agentic, or RAG. Relevant pillars, architect rounds, and ratchet gates activate conditionally.
- **RAG, workflow, and resilience scaffolding** — templates for retrieval-augmented generation pipelines, Temporal/Inngest workflow orchestration, and circuit breaker/retry/dead-letter patterns.
- **Agentic UX patterns** — UI designer generates streaming status indicators, confidence displays, human-in-the-loop approval flows, and progressive disclosure for AI-powered interfaces.
- **Context engineering** — `/context-budget` analyzes token usage across agents and recommends compression strategies. Manifest tracks context budgets per agent.
- **Multi-tenancy** — `/tenant` scaffolds tenant isolation (schema-per-tenant, row-level security, or database-per-tenant) with routing middleware and tenant-aware test fixtures.
- **Sprint contracts** — machine-readable JSON defining exactly what "done" means, negotiated between generator and evaluator before any code is written.
- **4 execution modes** — Full ($100-300), Lean ($30-80), Solo ($5-15), Turbo ($30-50). Right-size cost to project complexity.
- **Local LLM routing** — run all agents on Qwen3-Coder-480B, DeepSeek-Coder-V3, or any OpenAI-compatible local model. Zero API cost.
- **Cross-project learning** — stack decisions, failure patterns, and integration notes persist across all projects built with this harness.
- **Self-tested** — dogfooded across 6 test projects (fraud detection SaaS, ML fraud v2, agentic fraud, Vikings chat, Pac-Man CLI, Task Manager). 18+ forge issues found and fixed. Both mandatory scenarios (web + CLI) proven with browser verification and PTY testing.
- **BRD change management** — `/change` skill logs requirement changes to `specs/brd/changelog.md` with version tracking, runs impact analysis on affected stories/design/code, and cascades updates through only the affected downstream artifacts.
- **Internet research** — BRD creator and architect agents have WebSearch/WebFetch and proactively offer to research when requirements are high-level or technology choices involve rapidly evolving domains. Results saved to `specs/brd/research/`.
- **Self-improving feedback** — opt-in `/report-findings` collects anonymized build findings (no secrets/PII/code) and lets users review + submit as GitHub issues. `findings-collector.js` hook captures findings passively during builds.
- **Status dashboard** — `/status` generates a terminal-friendly ASCII dashboard showing per-group story progress (spec'd/coded/unit-tested/E2E-verified), quality ratchet metrics, blockers, and recent activity. Auto-displayed after each group verdict and phase transition.
- **PTY-based E2E for CLI apps** — terminal applications tested via pseudo-terminal: launch app, send keystrokes, verify rendered output, confirm clean exit. Proven on Pac-Man CLI dogfood (75 tests).
- **Gate 12: Smoke Launch** — every group runs the app with real production data (not test fixtures). Catches the #1 false-green pattern: tests pass on synthetic data, app crashes on launch. Cannot be disabled.
- **Test planning phase** — Phase 3.5 runs the test-engineer to generate test-plan.md, test-cases.md, traceability-matrix.md, and fixtures.json. Every test traces back to a BRD requirement.
- **Naming standardization** — reference skills use `-patterns` suffix (architect-patterns, spec-patterns, test-patterns, evaluate-patterns, comply-patterns) for instant clarity on execution vs reference.

## Quick Start

```bash
# 1. Clone the harness
git clone https://github.com/rlpatrao/claude_harness_forge.git ~/claude-harness-forge

# 2. Create your project
mkdir my-app && cd my-app

# 3. Load as plugin and scaffold
claude --plugin-dir ~/claude-harness-forge
> /scaffold

# 4. Exit and restart (project is now self-contained)
> /exit
claude

# 5. Run the full pipeline
> /build
```

## 10-Phase Pipeline

```
Phase 1:   /brd        -> Socratic interview -> BRD              [HUMAN APPROVAL]
Phase 2:   /architect   -> Stack interrogation -> Design artifacts [HUMAN APPROVAL]
Phase 3:   /spec        -> Stories + dependency graph             [HUMAN APPROVAL]
Phase 3.5: /test        -> Test plan + test cases + traceability  [AUTO]
Phase 4:   /design      -> UI mockups                            [HUMAN APPROVAL]
Phase 5:   Initialize state + changelog + findings consent
Phases 6-9: /auto      -> Autonomous ratcheting build loop
Phase 10:  Post-build   -> Learnings + README + findings report + final status
```

`/build` runs all phases. Phases 1-4 pause for human approval. Phases 5+ run autonomously.

## Commands (29)

| Command | Purpose |
|---------|---------|
| `/scaffold` | Initialize project with harness |
| `/brd` | Socratic 5-dimension interview -> BRD |
| `/architect` | Up to 11-round stack interrogation + design artifacts |
| `/spec` | BRD -> stories + dependency graph + features.json |
| `/design` | Architecture + UI mockups |
| `/build` | Full 9-phase pipeline |
| `/auto` | Autonomous ratcheting GAN loop |
| `/implement` | Code generation with agent teams |
| `/evaluate` | Run app, verify sprint contract |
| `/review` | Code review + security review |
| `/test` | Test plan + Playwright E2E |
| `/deploy` | Docker Compose + init.sh |
| `/fix-issue` | GitHub issue workflow |
| `/refactor` | Quality-driven refactoring |
| `/improve` | Feature enhancement |
| `/change` | BRD change management with version tracking and cascade |
| `/lint-drift` | Entropy scanner for pattern drift |
| `/observe` | OpenTelemetry instrumentation + dashboards |
| `/comply` | Compliance review (bias, fairness, PII, model cards) |
| `/rag` | RAG pipeline scaffolding (chunking, embedding, retrieval) |
| `/workflow` | Workflow orchestration scaffolding (Temporal/Inngest) |
| `/resilience` | Circuit breaker, retry, and dead-letter patterns |
| `/model-card` | Generate model card from training artifacts |
| `/context-budget` | Token usage analysis + cost summary (--summary for quick overview) |
| `/report-findings` | Opt-in anonymized findings reporter to forge GitHub |
| `/status` | Terminal dashboard — stories spec'd, coded, unit-tested, E2E-verified |
| `/tenant` | Multi-tenancy scaffolding (schema/row/DB isolation) |
| `/dogfood` | Self-test the forge by running the full pipeline |
| `/upgrade` | Pull latest forge from GitHub and upgrade in place |

## Agents (11)

| Agent | Role | Model |
|-------|------|-------|
| brd-creator | Socratic BRD interview with 5-dimension exploration | Sonnet |
| architect | Interactive stack decisions (up to 11 rounds), AI-native detection, design artifacts, learnings | Opus |
| spec-writer | BRD -> epics, stories, dependency graph | Sonnet |
| generator | Code + tests, agent teams, sprint contract negotiation | Sonnet |
| evaluator | 3-layer verification + browser console + Playwright MCP | Opus |
| ui-standards-reviewer | SaaS/enterprise conformance checklist (single-pass) | Sonnet |
| code-reviewer | Quality principles, architecture, story traceability | Sonnet |
| security-reviewer | OWASP Web Top 10 + OWASP Agentic Top 10 (ASI01-ASI10) | Sonnet |
| test-engineer | Test plans, cases, data, Playwright E2E, mutation testing | Sonnet |
| ui-designer | React+Tailwind HTML mockups, agentic UX patterns | Sonnet |
| compliance-reviewer | Bias/fairness, PII, data privacy, regulatory compliance, model cards | Sonnet |

## 12-Gate Ratchet

| Gate | Full | Lean | Solo | Turbo | Condition |
|------|------|------|------|-------|-----------|
| 1. Unit tests | Yes | Yes | Yes | Per commit | Always |
| 2. Lint + types | Yes | Yes | Yes | Per commit | Always |
| 3. Coverage >= baseline | Yes | Yes | Yes | Per commit | Always |
| 4. Architecture checks | Yes | Yes | -- | End only | Always |
| 5. Evaluator (API + Playwright + Console) | Yes | Yes | -- | End only | Always |
| 6. Code reviewer | Yes | Yes | -- | End only | Always |
| 7. UI standards review | Yes | -- | -- | End only | UI projects |
| 8. Security (Web + Agentic OWASP) | Yes | -- | -- | End only | Always |
| 9. Mutation testing | Yes | Yes | -- | End only | Always |
| 10. Compliance (bias, fairness, PII) | Yes | -- | -- | End only | ML projects |
| 11. Spec gaming detection | Yes | Yes | Yes | Per commit | **Always (cannot disable)** |
| 12. Smoke launch (real data) | Yes | Yes | Yes | Per commit | **Always (cannot disable)** |

## LLM Model Routing

The architect's Round 4 configures which models power the build agents:

| Strategy | Reasoning Agents | Code Gen Agents | Cost |
|----------|-----------------|-----------------|------|
| **Cloud-only** (default) | Claude Opus | Claude Sonnet | $30-300/project |
| **Hybrid** | Claude Opus | Local model | Reduced API cost |
| **Local-only** | Local model | Local model | $0 API (GPU compute only) |

Supported local models: Qwen3-Coder-480B-A35B-Instruct, DeepSeek-Coder-V3, CodeLlama-70B, or any model exposing an OpenAI-compatible API (vLLM, Ollama).

## 15 Pillars for AI-Native Development

| # | Pillar | What It Covers | Key Components |
|---|--------|---------------|----------------|
| 1 | LLM Agnosticism | Model-independent architecture | Cloud/hybrid/local routing, provider abstraction, fallback chains |
| 2 | Protocol Compliance | Standard agent communication | MCP tool integration, A2A protocol support, schema validation |
| 3 | Agentic Security | Threat modeling for AI systems | OWASP Agentic Top 10 (ASI01-ASI10), prompt injection defense, tool permission scoping |
| 4 | Observability | Monitoring and tracing for AI workloads | OpenTelemetry instrumentation, token usage tracking, latency histograms, `/observe` command |
| 5 | Evaluation | Continuous quality verification | 11-gate ratchet, mutation testing, spec gaming detection, behavioral verification |
| 6 | Architect AI-Native Rounds | Project-type-aware design decisions | Rounds 7-10: agentic architecture, ML pipeline, governance/compliance, cost budgets |
| 7 | Cross-Project Learning | Knowledge persistence across builds | Stack decisions, failure patterns, integration notes, learned rules |
| 8 | CI/CD | Deployment and delivery pipelines | Docker Compose, init.sh, GitHub Actions templates, environment scaffolding |
| 9 | Context Engineering | Token budget management | `/context-budget` analysis, per-agent token limits, compression strategies |
| 10 | Resilience | Fault tolerance for distributed AI systems | Circuit breakers, retry with backoff, dead-letter queues, `/resilience` scaffolding |
| 11 | RAG Patterns | Retrieval-augmented generation pipelines | Chunking strategies, embedding selection, retrieval evaluation, `/rag` scaffolding |
| 12 | Agentic UX | AI-native user interface patterns | Streaming indicators, confidence displays, human-in-the-loop flows, progressive disclosure |
| 13 | Workflow Orchestration | Long-running AI task management | Temporal/Inngest scaffolding, saga patterns, compensating transactions, `/workflow` command |
| 14 | Ethics and Bias | Responsible AI development | Bias/fairness audits, PII detection, model cards, compliance reviewer agent, `/comply` command |
| 15 | Multi-Tenancy | Tenant isolation for AI SaaS | Schema-per-tenant, row-level security, DB-per-tenant, tenant-aware routing, `/tenant` command |

## AI-Native Detection

The architect analyzes the BRD during Round 1 and classifies the project into one or more types. This classification determines which pillars, architect rounds, and ratchet gates activate.

| Project Type | Detection Signals in BRD | Activated Pillars | Architect Rounds | Conditional Gates |
|-------------|-------------------------|-------------------|-----------------|-------------------|
| **CRUD** | REST/GraphQL APIs, user management, dashboards, forms | 1-2, 5, 7-8 | Rounds 1-6 (standard) | Gates 1-8 only |
| **ML** | Training, inference, models, predictions, datasets, scoring | 1-2, 4-5, 7-8, 9, 11, 14 | Rounds 1-6 + Round 8 (ML pipeline) + Round 9 (governance) | Gates 1-10 (adds compliance) |
| **Agentic** | Agents, tools, MCP, function calling, orchestration, autonomous | 1-5, 7-8, 9-10, 12-13 | Rounds 1-6 + Round 7 (agentic arch) + Round 10 (cost budget) | Gates 1-9, 11 (adds agentic security) |
| **RAG** | Retrieval, embeddings, vector store, knowledge base, chunking | 1-2, 4-5, 7-8, 9, 11 | Rounds 1-6 + Round 7 (agentic arch) | Gates 1-9, 11 |

**Notes:**
- Projects can match multiple types (e.g., an agentic RAG system activates both agentic and RAG pillars).
- Gate 11 (spec gaming detection) runs for ALL project types in ALL modes and cannot be disabled.
- CRUD projects skip architect rounds 7-10 entirely, keeping the interrogation at 6 rounds.
- The architect presents its classification to the user for confirmation before proceeding.

## Dogfooding: How This Harness Tests and Heals Itself

A scaffold that tells others how to build software should be able to survive its own process. Claude Harness Forge uses a **built-in dogfooding mechanism** — a test project lives inside the repo (gitignored from distribution) that exercises the full pipeline against the harness's own skills, agents, and hooks. Every issue found is fixed in the harness immediately, then the pipeline is re-run to verify the fix. This is the same self-healing loop the harness uses for application code, applied to its own infrastructure.

### The Dogfooding Process

```
1. Create a test project inside test-projects/ (gitignored)
2. Run /scaffold against it using the forge as --plugin-dir
3. Run validate-scaffold.sh — catch structural issues immediately
4. Execute each pipeline phase: /brd -> /architect -> /spec -> /design -> /auto
5. At each phase, document issues in forge-issues.md
6. Fix each issue in the forge source (agents/, skills/, hooks/)
7. Re-run the validation scripts to confirm the fix
8. Commit the fix, continue the pipeline
9. Repeat until the full pipeline completes without forge-level failures
```

This process is intentionally adversarial — test projects use non-default settings (local-only LLM routing, CLI apps, agentic architectures) to exercise edge paths the happy path wouldn't touch.

### Dogfood Results: 6 Projects, 18+ Issues Fixed

| Project | Type | Tests | Key Finding |
|---------|------|-------|-------------|
| Fraud Detection | ML SaaS | — | 9 config-to-execution gaps (manifest fields existed but pipeline never read them) |
| Fraud Detection v2 | ML | — | 7 more issues (compliance crash, stale counts, regex compat) |
| Agentic Fraud | Agentic | 123 | 4 self-healing cycles (wrong import paths, lazy DB engine) |
| Vikings Chat | Web + LLM | 20 | First browser-verified dogfood (Playwright MCP screenshots) |
| **Pac-Man CLI** | Terminal game | **75** | Pattern F1: tests pass on synthetic data, app crashes on real data. Led to Gate 12 (Smoke Launch) |
| **Task Manager** | Web CRUD | **14 + 6 E2E** | Full Playwright MCP pipeline proven (8 tools, 3 screenshots, 0 console errors) |

Both mandatory dogfood scenarios (web + CLI) must pass before any forge release.

### Running a Dogfood

```bash
# Inside the forge repo:
/dogfood "Build a task manager" --type crud --mode lean    # web app
/dogfood "Build a terminal game" --type crud --mode lean   # CLI app
```

Test projects live in `test-projects/` (gitignored). Validation:
```bash
bash scripts/validate-scaffold.sh    # 129 passed, 0 failed
bash scripts/validate-evals.sh       # 10/10 BLOCK violations detected
```

### April 2026 Dogfooding: Two More Test Projects

**Pac-Man CLI (terminal game):**
- Proved the non-web E2E pipeline: PTY-based testing that launches the curses game, sends keystrokes, verifies rendered output
- Found forge bug F1: 68 tests passed on 5x5 synthetic mazes but game crashed on real 28x31 maze (rows of unequal length). Led to Gate 12 (Smoke Launch) and mandatory real-data E2E testing.
- 75 tests: 54 unit + 16 headless E2E + 5 PTY E2E

**Task Manager (web CRUD app):**
- Proved the full Playwright MCP browser verification pipeline end-to-end
- All 8 MCP tools exercised: browser_navigate, browser_snapshot, browser_fill_form, browser_click, browser_take_screenshot, browser_console_messages, browser_network_requests, browser_handle_dialog
- 6 browser scenarios verified: app loads, create task, edit task, filter by status, delete with confirmation, network health check
- 3 screenshots captured as evidence, 0 console errors, all API requests 2xx
- 14 backend tests + 6 browser E2E scenarios

Both mandatory dogfood scenarios (web + CLI) must pass before any forge release.

### Plugin Ecosystem

The scaffold offers 25+ Claude Code plugins organized by compatibility:

**Safe to install** (no forge conflict): firebase, stripe, supabase, terraform, linear, asana, github, gitlab, slack, discord, all LSP plugins (pyright, gopls, rust-analyzer, etc.), playground, context7, greptile, commit-commands

**Do NOT install** (conflict with forge): feature-dev, frontend-design, hookify, code-review, pr-review-toolkit

## Repo Structure

```
claude_harness_forge/
  agents/           11 agent definitions (.md)
  skills/           40 skills (29 task + 11 reference) — reference skills use -patterns suffix
  hooks/            19 Node.js enforcement hooks
  evals/            Code reviewer regression tests (4 samples)
  templates/        17 templates (Docker, Playwright, OTel, RAG, Temporal, model card, env, findings report)
  learnings/        Cross-project knowledge base (with first failure pattern F1)
  state/            8 initial state files
  scripts/          4 validation scripts
  commands/         /scaffold command
  .claude-plugin/   Plugin manifest
```

### Key Configuration Files (copied to target projects by /scaffold)

| File | Location After Scaffold | Purpose | Who Reads It |
|------|------------------------|---------|-------------|
| `architecture.md` | `.claude/architecture.md` | **Target app's layered architecture rules.** Defines the 6-layer hierarchy (Types->Config->Repository->Service->API->UI), one-way dependency rule, and verification commands. The `check-architecture` hook enforces these on every file save. | Hooks, generator, code-reviewer |
| `program.md` | `.claude/program.md` | **Karpathy bridge -- runtime control for the auto loop.** Contains BRD instructions (filled during /brd), constraints (TDD, coverage floor, model tiering), stopping criteria, self-healing policy, and pipeline status. Re-read by /auto at the start of every iteration. Humans edit this mid-run to steer the build. | /auto orchestrator (every iteration) |
| `settings.json` | `.claude/settings.json` | **Hook wiring and permissions.** Maps PostToolUse events to enforcement hooks. | Claude Code runtime |
| `project-manifest.json` | `.claude/project-manifest.json` | **Central project configuration.** Includes `ai_native` (project type classification, activated pillars), `compliance` (regulatory requirements, model card config), `security` (OWASP profiles, tool permission scoping), and `observability` (OTel endpoints, token budget limits) sections. | All agents, hooks, /auto orchestrator |
| `forge-reference.md` | Project root (read-only reference) | **How the forge itself works.** System architecture diagram, GAN flow, 11-gate ratchet, execution modes, self-healing taxonomy. Not consumed by any agent -- exists for human understanding. | Humans only |

**Note:** `forge-reference.md` was previously named `design.md`, which was confusing because target projects also generate their own `specs/design/` artifacts. Renamed for clarity.

## Requirements

- Claude Code v2.1.32+ (agent teams support)
- Node.js 18+ (for hooks)
- Docker + Docker Compose (for evaluation)
- Python 3.12+ / Node.js 20+ (for generated projects)
- Optional: vLLM or Ollama (for local LLM routing)
- Optional: mutmut (Python mutation testing, for gate 9)
- Optional: Stryker (TypeScript mutation testing, for gate 9)

## Based On

### Parent Systems
- [claude_code_forge_v2](https://github.com/cwijayasundara/claude_code_forge_v2) — "The Forge": template-rich SDLC scaffolding with Socratic BRD interviews, quality principles, code reviewer evals, and plugin-first onboarding
- [claude_harness_eng_v1](https://github.com/cwijayasundara/claude_harness_eng_v1) — "The Harness": GAN-inspired adversarial verification with sprint contracts, Karpathy ratcheting, browser console capture, and session chaining

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

### AI-Native and Safety Research (2025-2026)
- [METR: Reward Hacking in RLHF](https://metr.org/) — spec gaming and reward hacking patterns in LLM agents (basis for gate 11)
- [Meta: Mutation Testing at Scale](https://engineering.fb.com/) — mutation testing as a measure of test suite effectiveness (basis for gate 9)
- [OWASP Agentic Top 10 (2025)](https://owasp.org/www-project-agentic-ai-top-10/) — ASI01-ASI10 security risks for agentic AI systems
- [Memory in the Age of AI Agents (2025)](https://arxiv.org/) — survey on context management, memory architectures, and knowledge persistence for long-running agents
- [AIDev Dataset (2025)](https://arxiv.org/) — benchmark dataset for AI-assisted software development evaluation

## Release History

### [v2.1.0](RELEASE-v2.1.0.md) — April 2026

The **testing and upgrade** release. Focused on closing E2E verification gaps and making the forge upgradable.

- **`/upgrade`** — in-place forge upgrade. Pull latest from GitHub, replace forge files, preserve project state, merge config, show status report. No more manual git clone + re-scaffold.
- **Gate 12: Smoke Launch** — app must start with real production data. Catches the #1 false-green: tests pass on fixtures, app crashes on launch. Cannot be disabled.
- **Phase 3.5: Test Planning** — test-engineer generates test-plan.md, test-cases.md, traceability-matrix.md. Every test traces to a BRD requirement.
- **`/change`** — BRD change management with version tracking and selective cascade
- **`/report-findings`** — opt-in self-improving feedback to forge GitHub
- **`/status`** — terminal ASCII dashboard for project health
- **Internet research** — BRD creator and architect offer to WebSearch for latest patterns
- **PTY-based E2E** — CLI/terminal apps tested via pseudo-terminal
- **Concrete MCP pipeline** — step-by-step Playwright MCP + Chrome extension instructions with mandatory screenshot evidence
- **Naming standardization** — reference skills renamed to `-patterns` suffix
- Dogfooded on Pac-Man CLI (75 tests) + Task Manager web app (full Playwright MCP verification)

### [v2.0.0](RELEASE-v2.0.0.md) — March 2026

The **15 pillars** release. Expanded from 8-gate to 11-gate ratchet, added AI-native project detection, and implemented all 15 enterprise development pillars.

- 11 agents, 36 skills, 18 hooks, 17 templates
- 11-gate ratchet (mutation testing, compliance, spec gaming detection)
- 11-round architect (agentic architecture, ML pipeline, governance, cost budget)
- Compliance reviewer agent (bias, fairness, PII, regulatory)
- OWASP Agentic Top 10 (ASI01-ASI10)
- Local LLM routing (cloud/hybrid/local-only)
- RAG, workflow, resilience, multi-tenancy scaffolding
- OpenTelemetry observability
- Context engineering and cost tracking
- Dogfooded on 4 projects (fraud detection, ML fraud v2, agentic fraud, Vikings chat)
- 18 forge issues found and fixed
- 72 stories implemented, 143 tests passing

### [v1.0.0](RELEASE-v1.0.0.md) — March 2026

The **merger** release. Unified the Forge (template-rich SDLC) and Harness (adversarial verification) into a single system.

- 10 agents, 23 skills, 14 hooks, 9 templates
- GAN-inspired generator/evaluator separation
- 8-gate Karpathy ratchet
- Sprint contracts and session chaining
- 4 execution modes (Full/Lean/Solo/Turbo)
- Socratic BRD interview + interactive architect
- Cross-project learning
- Plugin-first onboarding via /scaffold

## License

MIT
