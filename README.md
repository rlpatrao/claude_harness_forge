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
- **11-gate ratchet** — monotonic progress. Coverage never drops, tests never break, architecture never drifts. Gates 9-11 add mutation testing, compliance review, and spec gaming detection. Quality only moves forward.
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
- **Self-tested** — this harness was dogfooded by building a fraud detection SaaS through its own pipeline, finding and fixing 9 issues in the process.

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

## 9-Phase Pipeline

```
Phase 1: /brd        -> Socratic interview -> BRD              [HUMAN APPROVAL]
Phase 2: /architect   -> Stack interrogation -> Design artifacts [HUMAN APPROVAL]
Phase 3: /spec        -> Stories + dependency graph             [HUMAN APPROVAL]
Phase 4: /design      -> UI mockups                            [HUMAN APPROVAL]
Phase 5: Initialize state
Phases 6-9: /auto     -> Autonomous ratcheting build loop
Phase 10: Post-build  -> Learnings + README generation
```

`/build` runs all phases. Phases 1-4 pause for human approval. Phases 5+ run autonomously.

## Commands (24)

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
| `/lint-drift` | Entropy scanner for pattern drift |
| `/cost` | Estimated API cost summary |
| `/observe` | OpenTelemetry instrumentation + dashboards |
| `/comply` | Compliance review (bias, fairness, PII, model cards) |
| `/rag` | RAG pipeline scaffolding (chunking, embedding, retrieval) |
| `/workflow` | Workflow orchestration scaffolding (Temporal/Inngest) |
| `/resilience` | Circuit breaker, retry, and dead-letter patterns |
| `/model-card` | Generate model card from training artifacts |
| `/context-budget` | Analyze token usage and recommend compression |
| `/tenant` | Multi-tenancy scaffolding (schema/row/DB isolation) |

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

## 11-Gate Ratchet

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

This process is intentionally adversarial — the test project is a real application (not a toy), configured with non-default settings (local-only LLM routing instead of the default cloud-only) to exercise edge paths the happy path wouldn't touch.

### Test Project: Fraud Detection SaaS

**Starting prompt:** _"Detecting fraud from set of credit card transactions; use public HF or Kaggle data"_

**Configuration:** Local-only model routing (Qwen3-Coder-480B-A35B-Instruct via vLLM) — deliberately chosen to stress-test the model routing path that cloud-only wouldn't exercise.

The pipeline was run phase by phase, fixing the harness at each step:

| Phase | What It Produced | Harness Issues Found |
|-------|------------------|---------------------|
| **Scaffold** | 84 validations passed. 10 agents, 23 skills, 14 hooks, 9 templates copied to `.claude/` | #1: Missing `design.md` copy. #2: Validator expects `init.sh` before architect. #3: No `mkdir -p .claude/` |
| **BRD** | 864-line app spec + 8 feature specs (2,956 lines total). Covers ingestion, ML scoring, dashboard, alerts, user management, model monitoring, audit logging | None — BRD templates worked cleanly |
| **Architect** | 6 design artifacts: architecture (Mermaid), API contracts (35+ endpoints), data models (Pydantic + TS + DDL for 8 tables), component map, folder structure, deployment config | #4: 14 skill files used unsupported frontmatter. #5: No LLM model selection round. #6: Progress file missing model routing |
| **Spec** | 33 stories across 8 epics, organized into 6 parallel dependency groups (A-F). Dependency graph with critical path analysis | #9: Spec didn't generate `features.json` — auto loop would read an empty file |
| **Design** | 6 interactive HTML mockups (152KB): dashboard with charts, transaction list with filters, SHAP waterfall detail view, CSV upload with progress, alert management, login | None — mockup templates worked cleanly |
| **Auto Group A** | 62 production files: backend types/config/SQLAlchemy models/Alembic migrations + frontend TypeScript types/Vite config. 0 architecture violations, all gates passed | #7: `model_routing` config was dead — auto/implement/cost-tracker never read it. #8: Re-scaffold would overwrite state files |

### The 9 Issues: What Broke and Why

Each issue was found during dogfooding, fixed in the harness source, and verified by re-running the relevant validation:

| # | Issue | Root Cause | How Dogfooding Found It | Fix |
|---|-------|------------|-------------------------|-----|
| 1 | Scaffold doesn't copy `design.md` | Scaffold Step 4 listed `architecture.md` and `program.md` but forgot `design.md` | `validate-scaffold.sh` reported `FAIL: design.md missing` on first run | Added `cp $PLUGIN_SOURCE/design.md design.md` to Step 4 |
| 2 | Validator expects `init.sh` before architect creates it | Validator was written for post-architect state, but scaffold runs before architect | Scaffold validation failed immediately on a fresh project | Added placeholder `init.sh` in Step 8; architect replaces it later |
| 3 | Scaffold assumes `.claude/` exists | Step 4 runs `cp -r` into `.claude/agents/` without creating the parent | Would fail on a truly empty target directory | Added `mkdir -p .claude` before copy operations |
| 4 | 14 skill files use unsupported frontmatter | Skills had `context: fork` and `agent: generator` — valid YAML but not recognized by Claude Code's skill parser | IDE diagnostics showed warnings during architect skill edit | Removed unsupported attributes from all 14 SKILL.md files |
| 5 | No LLM model selection in architect flow | Original design had 5 rounds; local/hybrid model routing was added later but never wired into the interrogation | Configuring the test project as "local-only" required manually editing the manifest — no interactive path existed | Added Round 4 (AI/LLM Model Selection) with cloud/hybrid/local-only strategies and challenge patterns |
| 6 | `claude-progress.txt` missing model routing | Progress template was written before model routing existed | Session block didn't record which model ran it — impossible to audit | Added `model_routing:` field to the progress template |
| 7 | **`model_routing` was dead config** | `project-manifest.json` had `execution.model_routing` with strategy, base_url, model name — but `auto/SKILL.md`, `implement/SKILL.md`, and `hooks/cost-tracker.js` never read it | The local-only test project had the config set correctly, but when simulating the auto loop, nothing would have routed agents to the local endpoint | Wired all three to read manifest: auto verifies local endpoint before first iteration, implement checks before spawning teams, cost-tracker logs $0 for local agents |
| 8 | Re-scaffold overwrites user state | `cp -r state/` unconditionally copies initial state templates, destroying `learned-rules.md`, `failures.md`, `iteration-log.md` with accumulated project data | Noticed during second scaffold run that state files would be reset | Changed to conditional copy: only copy `state/` if the directory doesn't already exist |
| 9 | **Spec doesn't generate `features.json`** | `build/SKILL.md` says "/spec outputs features.json" but `spec/SKILL.md` had no step for it. The file was initialized as `[]` by scaffold and never populated | After spec phase, `features.json` was still empty. The auto loop reads this file to track pass/fail — it would see 0 features and have nothing to work on | Added Step 4 to spec skill: generate one entry per story with the features-template schema |

### What This Revealed

**Config-to-execution gaps** were the dominant bug class. The harness documentation said the right things, the manifest had the right fields, the skills referenced them — but the actual execution code never read the config. Issues #7 and #9 would have caused **silent failures** in production: the model routing would default to cloud even when configured for local, and the auto loop would see an empty feature list and declare "nothing to do."

These bugs are **invisible to code review** (the code is syntactically valid, the tests would pass, the architecture is clean) but **immediately obvious when you run the pipeline against a real project**. This is why dogfooding is not optional — it's the evaluator for the harness itself.

### Running the Dogfood Test

The test project lives in `test-projects/` (gitignored — not shipped with the harness):

```bash
# From the forge repo root:
ls test-projects/fraud-detection-local/

# Re-run validation at any time:
bash scripts/validate-scaffold.sh    # 102 passed, 0 failed
bash scripts/validate-evals.sh       # 10/10 BLOCK violations detected
bash scripts/validate-gan-loop.sh    # Skipped (needs scaffolded project)
```

To run a fresh dogfood cycle on a new test project:
```bash
mkdir test-projects/my-test && cd test-projects/my-test
# Follow scaffold steps from commands/scaffold.md
# Run each phase, document issues in forge-issues.md
# Fix issues in the forge source, re-validate
```

### Plugin Ecosystem

The scaffold offers 25+ Claude Code plugins organized by compatibility:

**Safe to install** (no forge conflict): firebase, stripe, supabase, terraform, linear, asana, github, gitlab, slack, discord, all LSP plugins (pyright, gopls, rust-analyzer, etc.), playground, context7, greptile, commit-commands

**Do NOT install** (conflict with forge): feature-dev, frontend-design, hookify, code-review, pr-review-toolkit

## Repo Structure

```
claude_harness_forge/
  agents/           11 agent definitions (.md)
  skills/           36 skills (24 task + 12 reference)
  hooks/            18 Node.js enforcement hooks
  evals/            Code reviewer regression tests (4 samples)
  templates/        15 templates (Docker, Playwright, OTel, RAG, Temporal, model card, env)
  learnings/        Cross-project knowledge base
  state/            7 initial state files
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

## License

MIT
