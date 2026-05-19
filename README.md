# Claude Harness Forge

> A Claude Code plugin that builds software the way a well-run engineering team would -- from requirements to production, with independent verification at every step.

> **v3.0** (May 2026) is the current spec. It retrofits the v2.0 pipeline with: initializer/coding-agent split, `feature_list.json` as the project-completion contract, mandatory browser-automation E2E gate, Ralph Loop exit interception, per-workflow LLM routing, Plan Mode subagent, Extended ReAct, 5-stage adaptive compaction, spec-gap backpropagation, monotonic-improvement guards, instinct extraction, tree-structured sessions, and YAML recipes. Full spec: [`brd/v3.0.md`](brd/v3.0.md). Operational plan: [`brd/v3.0-implementation-plan.md`](brd/v3.0-implementation-plan.md). Live punch list: [`feature_list.json`](feature_list.json). 19 agents · 27 hooks · 47 skills · 23 commands.

You describe what you want to build. The forge runs **19 specialized agents** through a 9-phase pipeline (v3.0 §7): gathering requirements through Socratic interview, challenging your architecture decisions, decomposing work into stories, generating code with parallel agent teams, and verifying everything by actually running the application. Not by reading the code and saying "looks good."

One command starts it. Human approval gates the creative decisions (BRD, architecture, design). Everything after that -- implementation, testing, verification, self-healing -- runs autonomously, bounded by the [`feature_list.json`](feature_list.json) contract.

```bash
# Load as plugin and scaffold
claude --plugin-dir ~/claude-harness-forge
> /scaffold

# Run the full pipeline
> /build
```

---

## What the Forge Does

### Builds and Verifies Autonomously

The forge doesn't just generate code -- it runs your app, hits your API endpoints, drives a browser through Playwright, and checks for console errors. A 200 response with `"Failed to connect"` in the body is a failure. An empty list when data should exist is a failure. If something breaks, it diagnoses the issue, fixes it, and re-verifies -- up to 3 attempts per gate before escalating.

### Catches What Tests Miss

Tests pass. The app crashes. This is the most common failure mode in AI-generated code, and the forge addresses it structurally:

- **Three-level verification** -- liveness (does it respond?), behavior (does it work correctly?), integration (do features work together?)
- **Smoke launch with real data** -- every build group must start the app with actual production data, not test fixtures. This gate cannot be disabled.
- **Spec gaming detection** -- catches agents deleting tests to make suites pass, writing tautological assertions (`expect(true).toBe(true)`), inflating coverage with dead code. Also cannot be disabled.
- **Mutation testing** -- injects small bugs and verifies your tests actually catch them. The mutation score ratchets: once it reaches 72%, it can never drop below 72%.

### Learns and Improves

The forge has multiple feedback loops that compound over time:

- **Self-healing loop** -- when a gate fails, the system diagnoses the failure (14 categories), spawns a targeted fix with the structured failure context and prior attempt history (so it doesn't retry the same fix), re-runs only the failed gate, and extracts a learned rule on success.
- **Cross-project learning** -- agents read prior stack decisions, failure patterns, and integration notes before making recommendations. Mistakes from project A inform project B.
- **Findings reporter** -- opt-in, anonymized feedback to the forge itself. A passive hook collects build findings; you review everything before submitting. The forge improves from real-world usage.
- **Change management** -- mid-build requirement changes don't get lost. `/change` logs them with version tracking, runs impact analysis, and cascades updates through only the affected stories, design, and code.

### Adapts to Your Project

The architect analyzes your requirements and activates only what's relevant:

| Project Type | What Activates |
|-------------|----------------|
| **CRUD** | Standard architecture review, gates 1-8 |
| **ML** | + ML pipeline design, compliance gate, model cards, bias/fairness audits |
| **Agentic** | + Agentic architecture round, OWASP Agentic Top 10, agentic UX patterns |
| **RAG** | + RAG scaffolding, vector DB selection, chunking/embedding guidance |

Projects can match multiple types. The forge also supports 4 execution modes -- from **Full** (all 12 gates, production-grade) to **Solo** (3 gates, weekend projects) -- so you control cost and rigor.

### Scales with Agent Teams

For large story groups, the generator spawns parallel sub-agents that each own a slice of work. A dependency handshake identifies shared files before work begins, preventing merge conflicts. Each teammate gets the full context: learned rules, architecture constraints, and test requirements.

---

## The Pipeline

```
Phase 1:   Requirements    -> Socratic interview -> BRD              [HUMAN APPROVAL]
Phase 2:   Architecture    -> Stack interrogation (up to 11 rounds)  [HUMAN APPROVAL]
Phase 3:   Stories         -> Epics + dependency graph               [HUMAN APPROVAL]
Phase 3.5: Test Planning   -> Test plan + traceability matrix        [AUTO]
Phase 4:   Design          -> UI mockups                             [HUMAN APPROVAL]
Phase 5:   Initialize      -> State + changelog + findings consent
Phases 6-9: Build          -> Autonomous ratcheting loop
Phase 10:  Post-build      -> Learnings + README + findings report
```

Phases 1-4 pause for your approval. Phases 5+ run autonomously.

The architect's interrogation is interactive -- up to 11 rounds covering backend, database, frontend, LLM routing, deployment, verification strategy, and (for AI-native apps) agentic architecture, ML pipelines, governance, and cost budgets. It challenges weak decisions and researches current technologies via web search when needed.

---

## 12-Gate Quality Ratchet

Quality is monotonic -- it only moves forward. Each gate produces PASS, FAIL, or NOT_RUN. A skipped gate is never treated as a pass. NOT_RUN halts progression with an actionable error explaining what's missing.

| Gate | What It Enforces |
|------|-----------------|
| 1. Unit tests | All tests pass |
| 2. Lint + types | Clean static analysis |
| 3. Coverage | >= baseline (ratcheted, never drops) |
| 4. Architecture | Import rules, layer boundaries |
| 5. Evaluator | API + browser + console verification against real running app |
| 6. Code review | Quality principles, story traceability |
| 7. UI standards | SaaS/enterprise conformance (UI projects only) |
| 8. Security | OWASP Web Top 10 + OWASP Agentic Top 10 |
| 9. Mutation testing | Tests must catch injected bugs (score ratchets) |
| 10. Compliance | Bias, fairness, PII, data privacy (ML projects only) |
| 11. Spec gaming | Detects agents gaming metrics (always on, cannot disable) |
| 12. Smoke launch | App starts with real data (always on, cannot disable) |

19 enforcement hooks run automatically on every tool call, enforcing constraints like architecture rules, coverage floors, and test count monotonicity -- without relying on agent cooperation.

---

## 11 Agents

| Agent | Role |
|-------|------|
| **brd-creator** | Socratic requirements interview across 5 dimensions |
| **architect** | Interactive stack decisions, challenges weak choices, persists learnings |
| **spec-writer** | Decomposes BRD into epics, stories with acceptance criteria, dependency graph |
| **generator** | Code + tests via agent teams, TDD red-green-refactor |
| **evaluator** | Runs the app, verifies behavior, manages infrastructure lifecycle autonomously |
| **test-engineer** | Test plans, traceability matrices, Playwright E2E, mutation testing |
| **code-reviewer** | Quality principles, architecture compliance, learned rules |
| **security-reviewer** | OWASP Web Top 10 + OWASP Agentic Top 10 |
| **ui-designer** | React+Tailwind mockups, agentic UX patterns |
| **ui-standards-reviewer** | SaaS/enterprise conformance checklist |
| **compliance-reviewer** | Bias/fairness audits, PII detection, regulatory compliance, model cards |

The evaluator manages infrastructure autonomously -- database migrations, Docker Compose, health checks with exponential backoff, teardown. No "open 3 terminals and start services."

---

## 41 Skills

29 executable skills and 12 reference pattern libraries. Key skills:

| Category | Skills |
|----------|--------|
| **Pipeline** | `/brd`, `/architect`, `/spec`, `/test`, `/design`, `/build`, `/auto`, `/implement`, `/evaluate`, `/review` |
| **Operations** | `/deploy`, `/fix-issue`, `/refactor`, `/improve`, `/change`, `/upgrade`, `/status`, `/dogfood` |
| **AI-Native** | `/observe`, `/comply`, `/rag`, `/workflow`, `/resilience`, `/model-card`, `/context-budget`, `/tenant`, `/lint-drift` |
| **Feedback** | `/report-findings` |

---

## Execution Modes

| Mode | Gates | When to Use |
|------|-------|-------------|
| **Full** | All 12 | Production SaaS, regulated domains |
| **Lean** | 1-6, 9 | Internal tools, MVPs with quality needs |
| **Solo** | 1-3, 11-12 | Prototypes, weekend projects |
| **Turbo** | All 12 (batched) | Well-specified projects, Opus 4.6+ |

## LLM Routing

The architect configures model strategy per project:

| Strategy | Description |
|----------|-------------|
| **Cloud-only** (default) | Claude Opus for reasoning, Sonnet for code gen |
| **Hybrid** | Claude Opus for reasoning, local model for code gen |
| **Local-only** | All local (Qwen3-Coder, DeepSeek, any OpenAI-compatible API) |

---

## Dogfooding

The forge tests itself. 6 projects exercise the full pipeline:

| Project | Type | What It Proved |
|---------|------|---------------|
| Fraud Detection | ML SaaS | Found 9 config-to-execution gaps invisible to code review |
| Agentic Fraud | Agentic | 4 self-healing cycles completed autonomously |
| Vikings Chat | Web + LLM | First browser-verified dogfood |
| Pac-Man CLI | Terminal game | Tests pass on synthetic data, app crashes on real data (led to Gate 12) |
| Task Manager | Web CRUD | Full Playwright MCP pipeline proven end-to-end |

Both web and CLI scenarios must pass before any forge release.

```bash
# Run a dogfood
/dogfood "Build a task manager" --type crud --mode lean

# Validate the forge
bash scripts/validate-scaffold.sh    # 130 passed, 0 failed
bash scripts/validate-evals.sh       # 10/10 BLOCK violations detected
```

---

## The Two Core Ideas

### 1. The Code That Writes Must Not Evaluate

Inspired by Generative Adversarial Networks, the forge structurally separates generation from verification. The generator writes code. The evaluator runs the app and checks if it works. They never share context about what "should" happen -- the evaluator only knows the contract and what the running application actually does.

This eliminates self-evaluation bias: the most common failure mode in single-agent coding, where the agent reads its own code, decides it looks correct, and moves on.

### 2. The Karpathy Ratchet

Named after Andrej Karpathy's principle: quality metrics must be monotonic. Coverage at 80% can never drop to 79%. Mutation score at 72% can never drop to 71%. Test count can never decrease.

The ratchet means the system either fixes forward (diagnose, fix, re-verify) or escalates with full context. It never silently skips a broken gate. It never regresses.

---

## Quick Start

```bash
# 1. Clone the forge
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

### Upgrading

Already scaffolded a project? One command pulls the latest forge and upgrades in place -- no re-scaffolding, no re-answering setup questions, no manual file copying:

```bash
> /upgrade          # pulls latest, replaces forge files, preserves your project state
> /upgrade --check  # dry-run to see what would change
```

## Plugin Ecosystem

The scaffold offers 25+ Claude Code plugins organized by compatibility:

**Safe to install:** firebase, stripe, supabase, terraform, linear, asana, github, gitlab, slack, discord, all LSP plugins, playground, context7, greptile, commit-commands

**Do NOT install** (conflict with forge): feature-dev, frontend-design, hookify, code-review, pr-review-toolkit

## Requirements

- Claude Code v2.1.32+ (agent teams support)
- Node.js 18+ (for hooks)
- Docker + Docker Compose (for evaluation)
- Python 3.12+ / Node.js 20+ (for generated projects)
- Optional: vLLM or Ollama (for local LLM routing)
- Optional: mutmut / Stryker (for mutation testing)

## Repo Structure

```
claude_harness_forge/
  agents/           11 agent definitions
  skills/           41 skills (29 task + 12 reference)
  hooks/            19 enforcement hooks
  evals/            Code reviewer regression tests
  templates/        17 templates (Docker, Playwright, OTel, RAG, etc.)
  learnings/        Cross-project knowledge base
  state/            Initial state files
  scripts/          Validation scripts
  commands/         /scaffold command
```

## Based On

- [Anthropic: Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- SWE-agent, AgentCoder, MetaGPT, Reflexion, AlphaCode 2
- [OWASP Agentic Top 10 (2025)](https://owasp.org/www-project-agentic-ai-top-10/)
- METR: Reward Hacking in RLHF (basis for Gate 11)

## Release History

- **v3.0.0-alpha** (May 2026) -- Retrofit driven by Anthropic Nov-2025 effective-harness paper, OPENDEV (arXiv 2603.05344), Pi-mono. Initializer/coding-agent split (BRD §3.1), `feature_list.json` contract (§3.2), Ralph Loop (§3.3), per-workflow LLM routing (§3.4), Plan Mode subagent (§3.5), Extended ReAct (§3.6), tool-result budget footer (§3.7), mandatory browser-automation E2E gate (§3.8), five-layer defense-in-depth safety (§4.1), event-driven system reminders (§4.2), 5-stage adaptive compaction (§4.3), instinct extraction (§4.4), tree-structured sessions (§4.5), three-tier skills hierarchy (§4.6), spec-gap backpropagation (§4.7), monotonic-improvement guards (§4.8), YAML recipes (§6.5). 19 agents, 27 hooks, 47 skills, 23 commands. Spec: `brd/v3.0.md`.
- **v2.1.0** (April 2026) -- Gate 12, Phase 3.5, `/upgrade`, `/change`, `/status`, internet research, PTY-based E2E, Playwright MCP pipeline
- **v2.0.0** (March 2026) -- 15 pillars, mutation testing, compliance reviewer, OWASP Agentic, local LLM routing, RAG/workflow/resilience scaffolding
- **v1.0.0** (March 2026) -- GAN-inspired architecture, 8-gate ratchet, 4 execution modes, Socratic BRD, interactive architect

## License

MIT
