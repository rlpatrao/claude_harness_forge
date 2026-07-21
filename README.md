# Claude Harness Forge

> A Claude Code plugin that builds software the way a well-run engineering team would — from requirements to production, with independent verification at every step and rules that acquire themselves from what the system rejects.

> **v3.4** (July 2026) is the current line. Full spec chain: [`brd/v3.0.md`](brd/v3.0.md) → [`brd/v3.1-implementation-plan.md`](brd/v3.1-implementation-plan.md) → [`brd/v3.2-implementation-plan.md`](brd/v3.2-implementation-plan.md) → [`brd/v3.3-trace-compiled-rules-plan.md`](brd/v3.3-trace-compiled-rules-plan.md) → [`brd/v3.4-headless-dogfood.md`](brd/v3.4-headless-dogfood.md). Machine-readable inventory: [`HARNESS.md`](HARNESS.md) + [`harness-manifest.json`](harness-manifest.json) (91 components). Live punch list: [`feature_list.json`](feature_list.json) (81 entries).

> **Counts as of v3.4:** 20 agents · 36 hooks · 53 skills · 27 commands · 35 scripts · 91 harness-manifest rows · 81 feature_list entries.

You describe what you want to build. The forge runs specialized agents through the pipeline: gathering requirements through Socratic interview (or importing your existing BRD + architecture doc), challenging your architecture decisions, decomposing work into stories, generating code with parallel agent teams, and verifying everything by actually running the application. Not by reading the code and saying "looks good."

One command starts it. Human approval gates the creative decisions (BRD, architecture, design). Everything after that — implementation, testing, verification, self-healing, rule acquisition — runs autonomously, bounded by the [`feature_list.json`](feature_list.json) contract.

```bash
# Interactive — traditional path
claude --plugin-dir ~/claude-harness-forge
> /scaffold

# OR headless (BRD v3.4) — bring your own BRD + architecture
./scripts/dogfood-setup.sh --target ./my-app --fixture salary-dashboard
cd ./my-app
AUTO_ADVANCE_ON_ARCHITECTURE_APPROVED=1 claude
```

---

## What the Forge Does

### Builds and Verifies Autonomously

The forge doesn't just generate code — it runs your app, hits your API endpoints, drives a browser through Playwright, and checks for console errors. A 200 response with `"Failed to connect"` in the body is a failure. An empty list when data should exist is a failure. If something breaks, it diagnoses the issue, fixes it, and re-verifies — up to 3 attempts per gate before escalating.

Every `passes:false → true` flip on a feature requires a real verification artifact under `verification/<id>.{png,json}` that's committed to git — enforced by [`hooks/e2e-gate.js`](hooks/e2e-gate.js). Since v3.2.2, that flip can additionally require a **3-instance majority vote** from independent Critic spawns ([`scripts/critic-vote.js`](scripts/critic-vote.js)); each vote runs in fresh context so single-verifier variance can't rubber-stamp a broken feature.

### Catches What Tests Miss

Tests pass. The app crashes. This is the most common failure mode in AI-generated code, and the forge addresses it structurally:

- **Three-level verification** — liveness (does it respond?), behavior (does it work correctly?), integration (do features work together?)
- **Smoke launch with real data** — every build group starts the app with actual production data, not test fixtures. This gate cannot be disabled.
- **Spec gaming detection** — catches agents deleting tests to make suites pass, writing tautological assertions, inflating coverage with dead code. Cannot be disabled.
- **Mutation testing** — injects small bugs and verifies your tests actually catch them. Monotonic ratchet: once mutation score reaches 72%, it never drops below 72%.
- **Cross-feature regression** (v3.2.4) — re-runs prior features' E2E steps under a diff-scoped impact selection ([`scripts/regression-gate.js`](scripts/regression-gate.js) + [`scripts/impact-scope.js`](scripts/impact-scope.js)). Catches "this new feature broke a previously-passing one" silently.
- **Structural sensors** — pre-bash-gate blocks bash writes to sensitive paths (`.env`, `.ssh/`, credentials) that Write/Edit hooks would miss. Concurrency-gate caps subagent fan-out at 18. Real git hooks (installed by scaffold) fire on `git commit --amend` too.

### Learns and Rules Acquire Themselves (v3.3 TRACE)

The forge closes the loop between "what the system rejected" and "what it stops permitting":

- **Correction stream** — every Critic BLOCK, security-review finding, e2e-gate rejection, and feature-edit-guard block appends to `state/rejections.jsonl` via [`hooks/lib/log-rejection.js`](hooks/lib/log-rejection.js).
- **Rule mining** — [`hooks/correction-detector.js`](hooks/correction-detector.js) (Stop event) groups repeated rejections and emits candidates to `state/rule-candidates/`. A library of known patterns (AWS/GitHub/Slack tokens, `.only()`, `debugger`, TODO) synthesizes regex checks; unknown patterns get a semantic (Critic-enforced) check.
- **Curation** — `/rules` (backed by [`scripts/rule-compile.js`](scripts/rule-compile.js)) promotes `candidate → tentative(warn) → confirmed(block)` with a Critic-pass gate and an FP-override guard. False positives from `RULE_GATE_OVERRIDE=<rule_id>` block auto-promotion until re-reviewed.
- **Enforcement** — [`hooks/rule-gate.js`](hooks/rule-gate.js) evaluates pattern rules PreToolUse and hard-blocks the offending Edit/Write/Bash *before* the tool call lands. TRACE (arXiv 2606.13174): 70.1% preference compliance for compiled rules vs 55% for context-only injection.

Two rule stores by design:
- **`state/learned-rules.md`** (v3.2.1) — human-edited fast lane, advisory, injected verbatim into every SessionStart reminder.
- **`state/compiled-rules.json`** (v3.3) — machine-executable with `check` spec (pattern → rule-gate hard-blocks; semantic → Critic hard-filters).

### Adapts to Your Project

The architect analyzes your requirements and activates only what's relevant:

| Project Type | What Activates |
|---|---|
| **CRUD** | Standard architecture review, gates 1-8 |
| **ML** | + ML pipeline design, compliance gate, model cards, bias/fairness audits |
| **Agentic** | + Agentic architecture round, OWASP Agentic Top 10, agentic UX patterns |
| **RAG** | + RAG scaffolding, vector DB selection, chunking/embedding guidance |

The architect can also run in **synthesis mode** (v3.1.2) — if you provide BRD.md + architecture.dsl/puml/mmd/md, it skips the 11-round interview and derives design artifacts directly. A single review-loop artifact (`specs/design/architecture-review-v1.md`) then goes through approve/amend/restart with a 3-cycle amend budget.

### Scales with Agent Teams

For large story groups, the generator spawns parallel sub-agents via the Task/Agent tool. Each spawn runs in fresh context with its own LLM (per `config/workflows.yaml`) and its own tool grants (per agent frontmatter). Concurrency is capped at 18 by [`hooks/concurrency-gate.js`](hooks/concurrency-gate.js) with TTL-pruning for leaked spawns.

---

## The Pipeline

```
Phase 1:   Requirements    -> /brd Socratic interview       [HUMAN]
                              OR /scaffold --branch B         [HEADLESS via v3.4 flags]
Phase 2:   Architecture    -> /architect (up to 11 rounds)  [HUMAN]
                              OR /architect --from-import    [SYNTHESIS from imported DSL]
                              OR /architect --auto-approve   [HEADLESS after synthesis]
Phase 3:   Stories         -> Epics + dependency graph      [HUMAN]
Phase 3.5: Test Planning   -> Test plan + traceability      [AUTO]
Phase 4:   Design          -> UI mockups                    [HUMAN]
Phase 5:   Initialize      -> State + changelog + consent
Phases 6-9: Build          -> Autonomous ratcheting loop
Phase 10:  Post-build      -> Learnings + rule mining + findings report
```

**Interactive path:** phases 1-4 pause for approval; 5+ runs autonomously.

**Headless path (v3.4):** provide BRD + architecture as artifacts + set `AUTO_ADVANCE_ON_ARCHITECTURE_APPROVED=1`, and every prompt is answered upfront. The coding-agent's SessionStart step 3a sees the imperative banner and invokes `/auto` as its first action.

---

## 12-Gate Quality Ratchet

Quality is monotonic — it only moves forward. Each gate produces PASS, FAIL, or NOT_RUN. A skipped gate is never treated as a pass.

| Gate | What It Enforces |
|---|---|
| 1. Unit tests | All tests pass |
| 2. Lint + types | Clean static analysis |
| 3. Coverage | >= baseline (ratcheted, never drops) |
| 4. Architecture | Import rules, layer boundaries |
| 5. Evaluator | API + browser + console verification against real running app |
| 6. Code review | Quality principles, story traceability, Balanced Coupling rubric (v3.2.5) |
| 7. UI standards | SaaS/enterprise conformance (UI projects only) |
| 8. Security | OWASP Web Top 10 + OWASP Agentic Top 10 |
| 9. Mutation testing | Tests must catch injected bugs (score ratchets) |
| 10. Compliance | Bias, fairness, PII, data privacy (ML projects only) |
| 11. Spec gaming | Detects agents gaming metrics (always on, cannot disable) |
| 12. Smoke launch | App starts with real data (always on, cannot disable) |

36 enforcement hooks run at 7 distinct lifecycle events (SessionStart, PreToolUse, PostToolUse, PreCompact, Stop, SubagentStop, TaskCompleted). Classified into 4 arbitration levels (v3.2.3: `hard-block` / `self-correct` / `review-focus` / `advisory`), documented in [`docs/sensor-arbitration.md`](docs/sensor-arbitration.md). Hard-blocks support waivers via [`scripts/check-waiver.js`](scripts/check-waiver.js) with mandatory expiry — recorded in `specs/reviews/sensor-waivers.json`.

---

## 20 Agents

| Agent | Role |
|---|---|
| **initializer** (v3.0) | One-shot project genesis — writes `feature_list.json`, `init.sh`, `harness-progress.txt`, first commit |
| **coding-agent** (v3.0) | Per-session feature worker following the 8-step SessionStart sequence |
| **brd-creator** | Socratic requirements interview across 5 dimensions |
| **architect** | Interactive stack decisions (or synthesis mode from imported DSL); challenges weak choices; persists learnings |
| **spec-writer** | Decomposes BRD into epics, stories with acceptance criteria, dependency graph |
| **planner** (v3.0) | Read-only Plan Mode subagent — schema literally lacks Write/Edit |
| **generator** | Code + tests via agent teams, TDD red-green-refactor |
| **critic** (v3.0) | Independent GAN judge — stronger model than generator, sees only the diff |
| **evaluator** | Runs the app, verifies behavior, manages infrastructure lifecycle autonomously |
| **e2e-runner** (v3.0) | Executes feature `steps[]` via Playwright/Puppeteer MCP; captures verification artifact |
| **test-engineer** | Test plans, traceability matrices, Playwright E2E, mutation testing |
| **code-reviewer** | Quality principles, architecture compliance, Balanced Coupling rubric, learned rules |
| **security-reviewer** | OWASP Web Top 10 + OWASP Agentic Top 10 |
| **ui-designer** | React+Tailwind mockups, agentic UX patterns |
| **ui-standards-reviewer** | SaaS/enterprise conformance checklist |
| **compliance-reviewer** | Bias/fairness audits, PII detection, regulatory compliance, model cards |
| **spec-auditor** (v3.0) | Walks back from phase-N failure to the earliest upstream spec gap |
| **compactor** (v3.0) | Stage 3-5 transcript summarizer (Haiku for cost) |
| **doc-updater** (v3.0) | Syncs `docs/` to code changes — Write scope restricted to `docs/` |
| **codebase-explorer** (v3.1.9) | Read-only exploration agent with LSP grant — grounds every claim in `file:line` citations |

The evaluator manages infrastructure autonomously — database migrations, Docker Compose, health checks with exponential backoff, teardown. No "open 3 terminals and start services."

---

## 53 Skills

Executable skills + reference pattern libraries. Notable additions since v3.0:

| Category | Skills |
|---|---|
| **Pipeline** | `brd`, `architect`, `spec`, `test`, `design`, `build`, `auto`, `implement`, `evaluate`, `review` |
| **Operations** | `deploy`, `fix-issue`, `refactor`, `improve`, `change`, `upgrade`, `status`, `dogfood` |
| **AI-Native** | `observe`, `comply`, `rag`, `workflow`, `resilience`, `model-card`, `context-budget`, `tenant`, `lint-drift` |
| **v3.0** | `extended-react`, `spec-backprop`, `instinct-extraction`, `iterative-retrieval`, `tree-sessions`, `cross-provider-handoff` |
| **v3.1** | `scaffold-import` (Branch B artifact import), `code-map` (living code-graph), `triage` (pre-work inbox), `memory-os` (3-tier filesystem: core / recall / archival) |
| **v3.2** | `critic-vote` (3-instance majority vote at merge boundary) |
| **v3.3** | `compiled-rules` (TRACE model doc) |
| **Feedback** | `report-findings` |

---

## 27 Commands

| Category | Commands |
|---|---|
| **Pipeline** | `/brd` `/architect` `/spec` `/design` `/build` `/auto` `/dogfood` `/scaffold` |
| **Planning** | `/plan` `/spec-audit` |
| **Work management** | `/feature-add` `/feature-status` |
| **Session** | `/tree` `/fork` `/branch` `/export` |
| **Instincts** | `/evolve` `/instinct-status` `/instinct-export` `/instinct-import` |
| **v3.1+** | `/context` (Token Governor bounded citations) `/triage` (v3.1.7 inbox) |
| **v3.2+** | `/critic-vote <feature-id>` (3-instance vote at merge) |
| **v3.3** | `/rules` (curate compiled rules through lifecycle) |
| **Operations** | `/model` `/cost` `/recipe-run` |

---

## Execution Modes

| Mode | Gates | When to Use |
|---|---|---|
| **Full** | All 12 | Production SaaS, regulated domains |
| **Lean** | 1-6, 9 | Internal tools, MVPs with quality needs |
| **Solo** | 1-3, 11-12 | Prototypes, weekend projects |
| **Turbo** | All 12 (batched) | Well-specified projects, Opus 4.6+ |

---

## LLM Routing

The forge is **LLM-swappable** at every workflow. Provider choice is thin:

### Where to configure

| Layer | File | Scope |
|---|---|---|
| Per-workflow | [`config/workflows.yaml`](config/workflows.yaml) | Every agent binds via `{{model:<workflow>}}` — 13 workflows × `primary` + `failover[]` + `thinking_level` + `max_iterations` + `tools_filter` |
| Per-project | `project-manifest.json` `execution.model_routing` | Overrides workflows.yaml at the target-repo level |
| Session default | `~/.claude/settings.json` `model` | Main-loop model driving the interactive session |
| Provider proxy | LiteLLM / Bifrost / Vercel AI Gateway | Translation layer for non-Anthropic models |

### Supported strategies

| Strategy | Description |
|---|---|
| **Cloud-only** (default) | Claude Opus for reasoning, Sonnet for code gen |
| **Hybrid** | Claude Opus for reasoning, local model for code gen |
| **Local-only** | All local (Qwen3-Coder, DeepSeek, any OpenAI-compatible API) |

### Third-party LLM support

**Kimi K3** (Moonshot) drops in via Anthropic-native endpoint — zero forge changes:
```bash
export ANTHROPIC_BASE_URL="https://api.moonshot.ai/anthropic"
export ANTHROPIC_AUTH_TOKEN="<moonshot-key>"
export ANTHROPIC_MODEL="kimi-k3"
claude   # /status confirms Kimi K3 is driving
```

**GPT-5 / Codex model** routes via LiteLLM proxy:
```yaml
# config/workflows.yaml
coding-agent:
  primary: openai/gpt-5-codex
  # LiteLLM translates OpenAI tool-call ↔ Anthropic tool_use
```

**Codex CLI as runtime replacement**: not supported without porting (~2-4 weeks — different hook event model, different subagent tool). Skills, MCP servers, feature_list.json, and fixtures all port cleanly.

---

## Dogfooding

The forge tests itself. The v3.4 headless flow eliminates all human touchpoints:

```bash
# Seed a target from a fixture (v3.4)
./scripts/dogfood-setup.sh --target ./test-projects/salary-dashboard --fixture salary-dashboard
cd ./test-projects/salary-dashboard

# Drive it autonomously
AUTO_ADVANCE_ON_ARCHITECTURE_APPROVED=1 claude
```

Fixtures under [`templates/dogfood-fixtures/`](templates/dogfood-fixtures/) — currently the `salary-dashboard` fixture (public H1B/OFLC salary explorer with a chatbot) with a full 5-dimension BRD + Structurizr DSL architecture. Add new fixtures by dropping a directory with `BRD.md` + `architecture.{md,dsl,puml,mmd}`.

Historical dogfood targets ([`test-projects/`](test-projects/), gitignored):

| Project | Type | What It Proved |
|---|---|---|
| Fraud Detection | ML SaaS | Found 9 config-to-execution gaps invisible to code review |
| Agentic Fraud | Agentic | 4 self-healing cycles completed autonomously |
| Vikings Chat | Web + LLM | First browser-verified dogfood |
| Pac-Man CLI | Terminal game | Tests pass on synthetic data, app crashes on real data (led to Gate 12) |
| Task Manager | Web CRUD | Full Playwright MCP pipeline proven end-to-end |
| Salary Dashboard (v3.4) | SaaS + chatbot | Headless artifact-driven scaffold path proven end-to-end |

```bash
# Validate the forge itself
bash scripts/test-hooks.sh                        # 17-test functional smoke suite
node scripts/validate-harness-manifest.js         # 91/91 rows valid, 3 empty cells documented
```

---

## The Three Core Ideas

### 1. The Code That Writes Must Not Evaluate

Inspired by Generative Adversarial Networks, the forge structurally separates generation from verification. Generator writes; evaluator runs the app and checks behavior. They never share context about what "should" happen — the evaluator only knows the contract and what the running application actually does. Eliminates the most common failure mode in single-agent coding: reading your own code, deciding it looks correct, and moving on.

### 2. The Karpathy Ratchet

Quality metrics must be monotonic. Coverage at 80% can never drop to 79%. Mutation score at 72% can never drop to 71%. Test count can never decrease. The ratchet means the system either fixes forward (diagnose, fix, re-verify) or escalates with full context. It never silently skips a broken gate. Never regresses.

### 3. Rules Acquire Themselves (v3.3 TRACE)

The harness's own rejections are its best rule source. Every Critic BLOCK, e2e-gate rejection, and security-review finding flows into `state/rejections.jsonl` via a shared helper. Repeated patterns become candidate rules via `hooks/correction-detector.js`, get validated through a Critic pass, land as tentative rules (warn), and after 2 sessions with no false-positive overrides become confirmed rules (hard-block). `hooks/rule-gate.js` evaluates them PreToolUse and stops the offending Edit/Write/Bash before it lands.

Two rule stores, split by *how* they enforce rather than by *who* wrote them:
- **Pattern rules** run inline in the PreToolUse hook and hard-block a specific tool call
- **Semantic rules** flow to the Critic as an extra hard-filter

Both are mined from what the system already rejected. Both go through the same lifecycle. Both retire when they misfire.

---

## Quick Start

### Interactive path (traditional)

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

### Headless path (v3.4)

```bash
# 1. Author or reuse a fixture at templates/dogfood-fixtures/<name>/
#    (need: BRD.md + architecture.{md,dsl,puml,mmd})

# 2. Seed the target
./scripts/dogfood-setup.sh --target ./my-app --fixture <name>

# 3. Drive it — the coding-agent sees the auto-advance banner
cd ./my-app
AUTO_ADVANCE_ON_ARCHITECTURE_APPROVED=1 claude
```

Or headless via scaffold flags without a fixture:

```bash
claude --plugin-dir ~/claude-harness-forge
> /scaffold --branch B --brd /path/to/BRD.md --arch /path/to/architecture.dsl \
            --name my-app --type saas --plugins minimal --yes
> /architect --from-import --auto-approve
> /auto
```

### Upgrading

Already scaffolded a project? One command pulls the latest forge and upgrades in place — no re-scaffolding, no re-answering setup questions, no manual file copying:

```bash
> /upgrade          # pulls latest, replaces forge files, preserves your project state
> /upgrade --check  # dry-run to see what would change
```

---

## Plugin Ecosystem

The scaffold offers 25+ Claude Code plugins organized by compatibility:

**Safe to install:** firebase, stripe, supabase, terraform, linear, asana, github, gitlab, slack, discord, all LSP plugins, playground, context7, greptile, commit-commands

**Do NOT install** (conflict with forge): feature-dev, frontend-design, hookify, code-review, pr-review-toolkit

---

## Requirements

- **Claude Code** v2.1.32+ (agent teams support) — or Codex CLI with adaptation
- **Node.js 18+** (for 36 hooks and orchestration scripts)
- **Docker + Docker Compose** (for evaluation, optional if using local verification)
- **Python 3.12+** and/or **Node.js 20+** (for generated projects)
- **Playwright MCP** OR **Puppeteer MCP** (declared in `.claude-plugin/plugin.json` — required for E2E gate)
- **Optional:** vLLM or Ollama (for local LLM routing)
- **Optional:** mutmut / Stryker (for mutation testing)
- **Optional:** LiteLLM / Bifrost (for non-Anthropic model routing)

---

## Repo Structure

```
claude_harness_forge/
  agents/                     20 agent definitions
  skills/                     53 skills (executable + reference libraries)
  hooks/                      36 enforcement hooks
    lib/                        shared helpers (log-rejection.js, etc.)
  commands/                   27 slash commands
  scripts/                    35 orchestration scripts (validate, compile, generate)
  evals/                      code reviewer regression tests
  templates/                  17 project templates
    dogfood-fixtures/           v3.4 fixtures (salary-dashboard, etc.)
    git-hooks/                  real git hooks installed by scaffold
    github-workflows/           CI templates (scheduled-triage etc.)
  brd/                        BRD v3.0-v3.4 specs and plans
  docs/                       operational docs (sensor-arbitration, token-governor, etc.)
  learnings/                  cross-project knowledge base
  state/                      initial state files
    compiled-rules.json         v3.3 TRACE machine rules
    learned-rules.md            v3.2.1 human fast-lane rules
    memory/                     v3.1.11 three-tier filesystem memory
    context-cache/              v3.1.6 CCR pipeline outputs (gitignored)
  config/
    workflows.yaml              per-workflow LLM routing
  recipes/                    YAML deterministic workflows
  instincts/                  v3.0 3-tier promotion (pending/tentative/confirmed)
  verification/               E2E gate artifacts + attestations
  HARNESS.md                  human-readable component registry
  harness-manifest.json       machine-readable component registry (91 components)
  feature_list.json           81-entry append-only project contract
  harness-progress.txt        cross-session bridge (all v3.0-v3.4 milestones logged)
```

---

## Based On

- [Anthropic: Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (Nov 2025 — the v3.0 origin)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- SWE-agent, AgentCoder, MetaGPT, Reflexion, AlphaCode 2
- [OWASP Agentic Top 10 (2025)](https://owasp.org/www-project-agentic-ai-top-10/)
- METR: Reward Hacking in RLHF (basis for Gate 11)
- **OPENDEV** (arXiv 2603.05344, Mar 2026) — compound AI system, per-workflow LLM routing, dual-agent Plan/Normal modes, five-layer defense-in-depth
- **Pi-mono** (Mario Zechner) — tree-structured sessions, cross-provider handoffs, per-session cost tracking
- **TRACE** (arXiv 2606.13174, v3.3) — Test-time Rule Acquisition + Compiled Enforcement. 70.1% preference compliance vs 55% context-only.
- **Vlad Khononov** — *Balancing Coupling in Software Design* (Addison-Wesley, 2024). v3.2.5 Balanced Coupling rubric.
- **Addy Osmani** — [Loop Engineering](https://addyosmani.com/blog/loop-engineering/). Five primitives that shaped v3.1 loop hardening.
- Selective borrows from [`cwijayasundara/claude_harness_eng_v5`](https://github.com/cwijayasundara/claude_harness_eng_v5) — sensor arbitration, harness registry, defensive triad, Token Governor patterns.

---

## Release History

- **v3.4** (July 2026) — Headless scaffold + dogfood setup. `--branch`/`--brd`/`--arch`/`--name`/`--type`/`--plugins`/`--yes` scaffold flags; `--auto-approve` on architect (synthesis mode only); `AUTO_ADVANCE_ON_ARCHITECTURE_APPROVED` env var upgrades SessionStart to imperative; `scripts/dogfood-setup.sh` + `templates/dogfood-fixtures/salary-dashboard/` (5-dim BRD + Structurizr DSL). 5 feature entries. 36/36 smoke checks passed. Spec: [`brd/v3.4-headless-dogfood.md`](brd/v3.4-headless-dogfood.md).
- **v3.3** (July 2026) — TRACE compiled-rule enforcement. `hooks/rule-gate.js` PreToolUse pattern-block; `hooks/correction-detector.js` Stop-event candidate miner; `hooks/lib/log-rejection.js` shared producer wired into e2e-gate, feature-edit-guard, critic, security-reviewer, code-reviewer; `scripts/rule-compile.js` + `/rules` curation with candidate→tentative(warn)→confirmed(block) lifecycle; semantic-path via `agents/critic.md`; `skills/compiled-rules/SKILL.md`. 6 feature entries. 26/26 dogfood checks passed. Spec: [`brd/v3.3-trace-compiled-rules-plan.md`](brd/v3.3-trace-compiled-rules-plan.md).
- **v3.2** (June-July 2026) — Five external-harness borrows: learned-rules propagation (v3.2.1 with security hardening — symlink guard + prompt-injection framing); 3-instance majority vote at merge boundary (v3.2.2); sensor arbitration taxonomy + waiver schema (v3.2.3); cross-feature regression sensor (v3.2.4); Khononov Balanced Coupling rubric (v3.2.5). 5 feature entries. Spec: [`brd/v3.2-implementation-plan.md`](brd/v3.2-implementation-plan.md).
- **v3.1** (June 2026) — Scaffold Q0 split (Q&A vs artifact-import vs hybrid); architect synthesis mode + single-doc review loop; harness registry (`HARNESS.md` + `harness-manifest.json`); defensive triad (pre-bash-gate + concurrency-gate + real git hooks); Token Governor MVP (`/context` + CCR pipeline + token-advisor); triage inbox; scheduled automations; living code-graph (`skills/code-map/` + `hooks/graph-refresh.js` + `codebase-explorer` agent); AAC parsers (Structurizr/PlantUML/Mermaid C4); memory-OS filesystem tier (core/recall/archival). 14 feature entries. Spec: [`brd/v3.1-implementation-plan.md`](brd/v3.1-implementation-plan.md).
- **v3.0** (May 2026) — Retrofit driven by Anthropic Nov-2025 effective-harness paper, OPENDEV, Pi-mono. Initializer/coding-agent split, `feature_list.json` contract, Ralph Loop, per-workflow LLM routing, Plan Mode subagent, Extended ReAct, budget footer, mandatory browser-automation E2E gate, five-layer defense-in-depth, event-driven system reminders, 5-stage adaptive compaction, instinct extraction, tree-structured sessions, three-tier skills hierarchy, spec-gap backpropagation, monotonic-improvement guards, YAML recipes. Spec: [`brd/v3.0.md`](brd/v3.0.md).
- **v2.1** (April 2026) — Gate 12, Phase 3.5, `/upgrade`, `/change`, `/status`, internet research, PTY-based E2E, Playwright MCP pipeline.
- **v2.0** (March 2026) — 15 pillars, mutation testing, compliance reviewer, OWASP Agentic, local LLM routing, RAG/workflow/resilience scaffolding.
- **v1.0** (March 2026) — GAN-inspired architecture, 8-gate ratchet, 4 execution modes, Socratic BRD, interactive architect.

---

## License

MIT
