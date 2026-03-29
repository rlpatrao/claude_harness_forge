# Claude Harness Forge v2.0 — Session Summary

**Date:** 2026-03-27 to 2026-03-29
**Starting point:** v1.0.0 (10 agents, 23 skills, 14 hooks, 8-gate ratchet)
**Ending point:** v2.0.0 (11 agents, 37 skills, 18 hooks, 11-gate ratchet, 4 agentic patterns, 8 framework options)

---

## What Happened in This Session

### Phase 1: Read the Merger Plan and Audit the v1 Codebase

- Read the full `claude-harness-forge-merger-plan.md` (948 lines) documenting the merger of the Forge and Harness philosophies
- Audited all 10 agents, 23 skills, 14 hooks, evals, templates, state files, scripts, and docs
- Found: 6 agents complete, 2 partial, 2 stubs. All skills and hooks complete. 5 template files and 1 state file missing. Plugin.json at wrong location.
- Fixed: expanded 4 agent definitions, added `model_preference` to 7 agents, created 5 missing templates, fixed plugin.json location

### Phase 2: Validation Scripts Fixed

- All 3 validation scripts had a `((PASS++))` arithmetic bug causing silent exit with `set -euo pipefail`
- `validate-scaffold.sh` rewritten with forge-mode vs scaffolded-project detection
- `validate-evals.sh` fixed: awk pattern bug, table format parsing for expected.md
- `validate-gan-loop.sh` fixed: arithmetic + forge-mode skip
- Result: 102 passed, 0 failed, 0 warnings

### Phase 3: First Dogfooding (v1 — fraud-detection)

Scaffolded and ran the pipeline against a fraud detection SaaS test project.

**9 forge issues found and fixed:**

| # | Issue | Category |
|---|-------|----------|
| 1 | Scaffold doesn't copy design.md | BUG |
| 2 | Validator expects init.sh before architect | BUG |
| 3 | Scaffold assumes .claude/ exists | BUG |
| 4 | 14 skills use unsupported frontmatter (context, agent) | BUG |
| 5 | No AI/LLM model selection in architect | ENHANCEMENT |
| 6 | claude-progress.txt missing model_routing | MINOR |
| 7 | model_routing config was dead — nothing read it | BUG |
| 8 | Re-scaffold overwrites user state files | BUG |
| 9 | Spec phase doesn't generate features.json | BUG |

**Key discovery:** Config-to-execution gaps — manifest fields existed but the execution pipeline never read them. Invisible to code review, immediately obvious when running the pipeline.

### Phase 4: Local LLM Support

- Added Round 4 (AI/LLM Model Selection) to architect with 3 strategies: cloud-only, hybrid, local-only
- Supports Qwen3-Coder-480B-A35B-Instruct, DeepSeek-Coder-V3, CodeLlama-70B, any OpenAI-compatible endpoint
- Wired model routing through auto/SKILL.md, implement/SKILL.md, and hooks/cost-tracker.js
- cost-tracker.js now logs $0 for local model spawns

### Phase 5: Playwright MCP + Chrome Extension Integration

- Updated evaluator agent with 3-tier browser verification priority:
  1. Playwright MCP plugin (richest — DOM snapshots, screenshots, console, network)
  2. Chrome extension MCP (real browser, full stack traces)
  3. Playwright listener injection (fallback, headless)
- Auto-detection at evaluation start

### Phase 6: Research — Latest AI Agent Papers (2025-2026)

Researched and cataloged recent papers:
- METR: frontier models actively reward-hack in coding scaffolds (June 2025)
- Meta: LLM-powered mutation testing at scale, 73% acceptance rate (FSE 2025)
- OWASP Top 10 for Agentic Applications (December 2025)
- Memory in the Age of AI Agents survey (ICLR 2026 workshop)
- AIDev dataset: 456K agent PRs, Claude Code 83.8% merge rate
- Planner-Coder Gap: MAS fail 7.9-83.3% on semantically equivalent inputs
- Anthropic: harness simplification as models improve

### Phase 7: 15 Pillars Plan

Designed a comprehensive plan covering all aspects of enterprise AI-native development:

| # | Pillar | Coverage |
|---|--------|----------|
| 1 | LLM Agnosticism | Plug-and-play models via LiteLLM |
| 2 | Protocol Compliance | MCP servers + A2A agent cards |
| 3 | Security | OWASP Web + Agentic Top 10 |
| 4 | Observability | OTel, structured logs, Grafana, alerts |
| 5 | Evaluation & Quality | Mutation testing, spec gaming, LLM-as-judge |
| 6 | Architect Enhancements | Rounds 7-11 for AI/agentic/governance |
| 7 | Cross-Project Learning | Three-tier memory, provenance |
| 8 | CI/CD Integration | GitHub Actions, PR integration |
| 9 | Context Engineering | Token budgets, prompt caching |
| 10 | Resilience | Retry, circuit breaker, fallback, checkpoint |
| 11 | RAG Patterns | Chunking, embeddings, vector DB, agentic RAG |
| 12 | Agentic UX | Intent preview, autonomy dial, explainability |
| 13 | Workflow Orchestration | Temporal, HITL gates, sagas |
| 14 | Ethics & Bias | Fairness metrics, model cards, data privacy |
| 15 | Multi-Tenancy | RLS, rate limiting, feature flags |

### Phase 8: Implementation of All 15 Pillars

Built in 4 parallel batches:

**Batch 1 — Core infrastructure:**
- New agent: `compliance-reviewer` (bias, fairness, PII, regulatory)
- 5 reference skills: resilience-patterns, rag-patterns, agentic-ux, compliance, context-engineering
- 4 hooks: token-budget, prompt-injection-detect, network-egress, pii-scan
- settings.json wired with all new hooks

**Batch 2 — Architect + evaluator extensions:**
- Architect: 6 → 11 rounds (agentic architecture, ML pipeline, governance, cost budget)
- Auto ratchet: 8 → 11 gates (mutation testing, compliance, spec gaming detection)
- Security reviewer: added OWASP Agentic Top 10 (ASI01-ASI10)
- Build pipeline: 9 → 12 phases

**Batch 3 — Task skills + templates:**
- 8 task skills: /observe, /comply, /rag, /workflow, /resilience, /model-card, /context-budget, /tenant
- 6 templates: OTel (Python + TS), Grafana dashboard, model card, RAG pipeline, Temporal workflow

**Batch 4 — Documentation:**
- README rewritten with 15 pillars, AI-native detection, all new components
- CLAUDE.md updated with v2 inventory
- validate-compliance.sh created
- mutation-baseline.txt added to state files

**Total new code:** 5,941 lines across 34 new files

### Phase 9: Agent Framework Selection

Expanded architect Round 7 with comprehensive framework guidance:
- 8 frameworks: Claude Agent SDK, LangGraph, CrewAI, OpenAI Agents SDK, Google ADK, Semantic Kernel, Smolagents, Custom
- Decision matrix with strengths, weaknesses, MCP/A2A support, checkpointing
- Per-framework scaffolding specifications (what files get generated)
- LiteLLM model-agnostic default for application agents
- Recommendation rules mapping BRD signals to frameworks

### Phase 10: Agentic Architecture Patterns

Added to architecture.md:
- 4 patterns with ASCII diagrams: Planner-Executor, Router-Specialists, Evaluator Loop, Pipeline
- 7-layer architecture (added agents layer between Service and API)
- Agent layer dependency rules
- Folder structures per pattern
- LiteLLM abstraction for model-agnostic agents
- Manifest override for custom layers

### Phase 11: v2 Dogfooding (fraud-detection-v2)

Scaffolded an ML fraud detection project to test v2 features:
- Compliance validation correctly detected: missing model card, no fairness metrics, GDPR requirements
- All 4 new hooks tested (token-budget, pii-scan, prompt-injection, network-egress)
- AI-native detection worked: `ai_native.type: ml` activated compliance gates

**7 more issues found and fixed (#10-16):**

| # | Issue | Category |
|---|-------|----------|
| 10 | Compliance crashes on missing directories | pipefail + grep |
| 11 | Scaffold missing mutation-baseline.txt | State file gap |
| 12 | Skills don't reference template paths | Minor |
| 13 | Validation has stale v1 counts | Count mismatch |
| 14 | Credit card regex uses unsupported \s | Regex compatibility |
| 15 | check-architecture.js missing agents layer | Hardcoded 5-layer |
| 16 | features.json generated as dict not array | Format mismatch |

### Phase 12: Agentic Dogfooding (fraud-agentic)

Full end-to-end agentic project — 3 autonomous agents (triage, investigation, decision) with LangGraph orchestrator, 12 MCP-compatible tools, ML pipeline, GDPR compliance.

**All 6 groups implemented (A-F), 30/30 stories:**

| Group | What Was Built |
|-------|---------------|
| A | Types, config, SQLAlchemy models, LangGraph state, LiteLLM client, MCP tool base class |
| B | Feature extraction (10 features), RandomForest+XGBoost ensemble, scoring service |
| C | Triage agent (auto-dismiss/route), Investigation agent (6 tools), Decision agent (disposition/escalation), LangGraph orchestrator |
| D | FastAPI app, JWT auth, 7 API routers (HITL, investigations, agents, audit, GDPR, health) |
| E | React app, 7 pages (dashboard, investigations, HITL queue, agents, decisions, compliance, login) |
| F | Immutable audit trail, GDPR erasure with pseudonymization, PII encryption, compliance UI |

### Phase 13: /dogfood Skill Created

Built a first-class `/dogfood` command for autonomous self-testing:
- Two nested loops: outer (forge-level fixes) + inner (project self-heal)
- Mandatory runtime environment setup (venv, pip install, npm install)
- Mandatory actual test execution (pytest, vitest — not just static checks)
- Self-healing protocol: read error, targeted fix, re-run specific test, regression check
- Failure classification: forge issue vs project issue
- Dogfood report generation

### Phase 14: Actual Test Execution and Self-Healing

Ran `pytest` for real on the agentic project. **4 self-healing cycles:**

| # | Problem | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | pyproject.toml at wrong path | Generator placed at project root | Moved to backend/ |
| 2 | 55 files with wrong import path | `from backend.app.` instead of `from app.` | Bulk sed fix |
| 3 | DB engine created at import time | Module-level `create_engine()` | Made lazy with `get_engine()` |
| 4 | 5 missing pip dependencies | Not all deps in pyproject.toml | Installed sequentially |

**Final result: 123 tests pass, 0 fail, 68% coverage on 2,063 lines of code.**

4 learned rules extracted and logged to the test project's `learned-rules.md`.

---

## Achievements

### Quantitative

| Metric | v1.0.0 | v2.0.0 | Growth |
|--------|--------|--------|--------|
| Agents | 10 | 11 | +1 |
| Task skills | 16 | 25 | +9 |
| Reference skills | 7 | 12 | +5 |
| Hooks | 14 | 18 | +4 |
| Templates | 9 | 15 | +6 |
| Ratchet gates | 8 | 11 | +3 |
| Architect rounds | 6 | 11 | +5 |
| Build phases | 9 | 12 | +3 |
| Validation scripts | 3 | 4 | +1 |
| State files | 6 | 7 | +1 |
| Agent frameworks supported | 0 | 8 | +8 |
| Agentic architecture patterns | 0 | 4 | +4 |
| Architecture layers | 6 | 7 | +1 |
| Forge issues found & fixed | 0 | 16 | +16 |
| Test project stories implemented | 0 | 30 | +30 |
| Test project tests passing | 0 | 123 | +123 |
| Test project code coverage | 0% | 68% | +68% |

### Qualitative

1. **The forge can now scaffold agentic applications.** Not just CRUD apps — it generates LangGraph orchestrators, MCP-compatible tools, LiteLLM clients, agent state schemas, and 7-layer architecture with agent layer enforcement.

2. **Self-testing is a first-class capability.** The `/dogfood` command runs the full pipeline autonomously, installs dependencies, executes actual tests, self-heals failures, classifies forge vs project issues, and produces a report.

3. **The forge tests itself and improves.** 16 issues were found and fixed during dogfooding — issues that were invisible to static analysis and code review. Each fix was committed, pushed, and the pipeline re-run to verify.

4. **Enterprise-ready pillars.** OWASP Agentic Top 10, GDPR compliance, model cards, fairness metrics, OTel observability, prompt injection detection, PII scanning, network egress control, and token budget enforcement.

5. **Model-agnostic at every level.** The forge's build agents can use Claude, Qwen3-Coder, or any local model. The generated apps default to LiteLLM so they work with any LLM provider.

6. **8 agent frameworks supported with guided selection.** The architect recommends the right framework (Claude Agent SDK, LangGraph, CrewAI, OpenAI, Google ADK, Semantic Kernel, Smolagents, Custom) based on BRD analysis with challenge patterns for mismatches.

7. **Spec gaming detection cannot be disabled.** Gate 11 runs in all modes, catching test deletion, tautological assertions, and mock-target mismatches. Based on METR's 2025 research showing frontier models actively reward-hack in coding scaffolds.

8. **Learned rules persist and accumulate.** The dogfooding process extracted 4 concrete rules (import paths, lazy DB init, dependency completeness, file placement) that will inform future code generation.

### Commits in This Session

| # | Commit | Description |
|---|--------|-------------|
| 1 | fe66209 | Initial commit (103 files, 11,201 lines) |
| 2 | 264de12 | Local LLM routing + frontmatter fix |
| 3 | 1b66955 | Wire model routing through auto/implement/cost-tracker |
| 4 | 274c4e7 | Fix scaffold: design.md, init.sh, state preservation |
| 5 | d5ec4d3 | Fix spec: add features.json generation |
| 6 | 8537c0d | Rewrite README with detailed comparison + dogfooding |
| 7 | eddf2bb | Expand dogfooding section with mechanism + root causes |
| 8 | a9a10c1 | Align README philosophy sections with merger plan |
| 9 | 26800e3 | Reframe merger plan as philosophy unification |
| 10 | c038a82 | Restructure README: philosophies first, repo links to references |
| 11 | b4fc2e8 | Add Playwright MCP + Chrome extension to evaluator |
| 12 | 1aba991 | Rename design.md to forge-reference.md |
| 13 | f42e516 | **Implement all 15 pillars** (33 files, 5,860 lines) |
| 14 | 39b067c | Update README for v2.0 |
| 15 | 60cd294 | Fix compliance validation: guard grep on missing dirs |
| 16 | 0cf20e7 | Fix scaffold + validation for v2 counts |
| 17 | 0b19ccf | Fix compliance: regex, pipefail, directory guards |
| 18 | dc491d1 | Expand architect Round 7 with 8 frameworks |
| 19 | 0e46181 | Add 4 agentic architecture patterns to architecture.md |
| 20 | f5ebd25 | Rewrite check-architecture hook for 7-layer + agents |
| 21 | 3efc1c0 | Strengthen features.json format requirements |
| 22 | f7d98b3 | Update README with agentic dogfooding results |
| 23 | a5c5418 | Add /dogfood command for autonomous self-testing |
| 24 | 5a8305a | Add mandatory runtime testing to /dogfood skill |

### Release

**v2.0.0** — https://github.com/rlpatrao/claude_harness_forge/releases/tag/v2.0.0
