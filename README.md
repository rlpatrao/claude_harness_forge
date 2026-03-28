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
- **Interactive architect** — conducts a 6-round stack interrogation informed by your BRD, challenges weak decisions, offers local LLM options, and persists learnings across projects.
- **8-gate ratchet** — monotonic progress. Coverage never drops, tests never break, architecture never drifts. Quality only moves forward.
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

## Commands (16)

| Command | Purpose |
|---------|---------|
| `/scaffold` | Initialize project with harness |
| `/brd` | Socratic 5-dimension interview -> BRD |
| `/architect` | 6-round stack interrogation + design artifacts |
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

## Agents (10)

| Agent | Role | Model |
|-------|------|-------|
| brd-creator | Socratic BRD interview with 5-dimension exploration | Sonnet |
| architect | Interactive stack decisions, LLM selection, design artifacts, learnings | Opus |
| spec-writer | BRD -> epics, stories, dependency graph | Sonnet |
| generator | Code + tests, agent teams, sprint contract negotiation | Sonnet |
| evaluator | 3-layer verification + browser console capture | Opus |
| ui-standards-reviewer | SaaS/enterprise conformance checklist (single-pass) | Sonnet |
| code-reviewer | Quality principles, architecture, story traceability | Sonnet |
| security-reviewer | OWASP top 10, injection, auth, secrets | Sonnet |
| test-engineer | Test plans, cases, data, Playwright E2E | Sonnet |
| ui-designer | React+Tailwind HTML mockups | Sonnet |

## 8-Gate Ratchet

| Gate | Full | Lean | Solo | Turbo |
|------|------|------|------|-------|
| 1. Unit tests | Yes | Yes | Yes | Per commit |
| 2. Lint + types | Yes | Yes | Yes | Per commit |
| 3. Coverage >= baseline | Yes | Yes | Yes | Per commit |
| 4. Architecture checks | Yes | Yes | -- | End only |
| 5. Evaluator (API + Playwright + Console) | Yes | Yes | -- | End only |
| 6. Code reviewer | Yes | Yes | -- | End only |
| 7. UI standards review | Yes | -- | -- | End only |
| 8. Security reviewer | Yes | -- | -- | End only |

## LLM Model Routing

The architect's Round 4 configures which models power the build agents:

| Strategy | Reasoning Agents | Code Gen Agents | Cost |
|----------|-----------------|-----------------|------|
| **Cloud-only** (default) | Claude Opus | Claude Sonnet | $30-300/project |
| **Hybrid** | Claude Opus | Local model | Reduced API cost |
| **Local-only** | Local model | Local model | $0 API (GPU compute only) |

Supported local models: Qwen3-Coder-480B-A35B-Instruct, DeepSeek-Coder-V3, CodeLlama-70B, or any model exposing an OpenAI-compatible API (vLLM, Ollama).

## Dogfooding: Self-Tested Pipeline

This harness was validated by running its own pipeline against a real test project: **a fraud detection SaaS** that scores credit card transactions for fraud using ML models and public datasets.

### Test Project: Fraud Detection SaaS

**Prompt:** _"Detecting fraud from set of credit card transactions; use public HF or Kaggle data"_

The pipeline was run end-to-end with local-only model routing (Qwen3-Coder-480B-A35B-Instruct):

| Phase | Result |
|-------|--------|
| **Scaffold** | 84 validations passed, 0 failed |
| **BRD** | 864-line app spec + 8 feature specs (2,956 lines) covering ingestion, ML scoring, dashboard, alerts, user management, model monitoring, audit logging |
| **Architect** | 6 design artifacts: architecture (Mermaid diagrams), API contracts (35+ endpoints), data models (Pydantic + TypeScript + SQL DDL for 8 tables), component map, folder structure, deployment config |
| **Spec** | 33 stories across 8 epics, organized into 6 parallel dependency groups (A-F) |
| **Design** | 6 interactive HTML mockups (dashboard, transactions, detail with SHAP charts, upload, alerts, login) |
| **Auto Group A** | 62 production files generated (backend types, config, SQLAlchemy models, Alembic migrations, frontend TypeScript types, Vite/Tailwind config). 0 architecture violations. |

### Self-Improvement: 9 Issues Found and Fixed

Running the pipeline against a real project exposed issues invisible in code review:

| # | Issue | Category | Fix |
|---|-------|----------|-----|
| 1 | Scaffold doesn't copy `design.md` to project root | BUG | Added to Step 4 |
| 2 | Validator expects `init.sh` before architect creates it | BUG | Added placeholder in Step 8 |
| 3 | Scaffold assumes `.claude/` directory exists | BUG | Added `mkdir -p` |
| 4 | 14 skill files use unsupported frontmatter attributes | BUG | Removed `context:` and `agent:` |
| 5 | No AI/LLM model selection in architect flow | ENHANCEMENT | Added Round 4 (6 rounds total) |
| 6 | `claude-progress.txt` missing model routing field | MINOR | Added to template |
| 7 | **`model_routing` config was dead — nothing read it** | BUG | Wired auto, implement, cost-tracker to read manifest |
| 8 | Re-scaffold overwrites user state files | BUG | Conditional copy (preserve existing) |
| 9 | **Spec phase doesn't generate `features.json`** | BUG | Added Step 4 to spec skill |

**Key discovery:** The biggest class of bug was **config-to-execution gaps** — manifest fields existed and were documented, but nothing in the execution pipeline actually read them. Issue #7 (model routing was dead config) and Issue #9 (features.json never generated) would have caused silent failures in production. These are invisible in structural code review but immediately obvious when running the pipeline.

### Plugin Ecosystem

The scaffold offers 25+ Claude Code plugins organized by compatibility:

**Safe to install** (no forge conflict): firebase, stripe, supabase, terraform, linear, asana, github, gitlab, slack, discord, all LSP plugins (pyright, gopls, rust-analyzer, etc.), playground, context7, greptile, commit-commands

**Do NOT install** (conflict with forge): feature-dev, frontend-design, hookify, code-review, pr-review-toolkit

## Repo Structure

```
claude_harness_forge/
  agents/           10 agent definitions (.md)
  skills/           23 skills (16 task + 7 reference)
  hooks/            14 Node.js enforcement hooks
  evals/            Code reviewer regression tests (4 samples)
  templates/        Docker, Playwright, env, init.sh templates
  learnings/        Cross-project knowledge base
  state/            Initial state file templates
  scripts/          3 validation scripts
  commands/         /scaffold command
  .claude-plugin/   Plugin manifest
```

## Requirements

- Claude Code v2.1.32+ (agent teams support)
- Node.js 18+ (for hooks)
- Docker + Docker Compose (for evaluation)
- Python 3.12+ / Node.js 20+ (for generated projects)
- Optional: vLLM or Ollama (for local LLM routing)

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

## License

MIT
