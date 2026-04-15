# Claude Harness Forge v2.1.0 — Release Notes

**Release Date:** 2026-04-13
**Previous:** [v2.0.0](RELEASE-v2.0.0.md) (11 agents, 36 skills, 18 hooks, 11-gate ratchet)

## Summary: Issues Found and Solutions Built

| # | Issue / Challenge | Solution |
|---|---|---|
| 1 | Upgrading a scaffolded project requires manual git clone, restart Claude with --plugin-dir, re-run /scaffold which re-asks all questions | **`/upgrade`** — pulls latest forge from GitHub, replaces forge-owned files, preserves project state, merges config, shows status report. One command, zero questions. |
| 2 | Tests pass on synthetic fixtures but app crashes on launch with real data (false green) | **Gate 12: Smoke Launch** — app must actually start with real production data every group. Cannot be disabled. Found via Pac-Man dogfood where 68 tests passed but game crashed on the real maze. |
| 3 | Test-engineer agent existed but was never called in the pipeline. Tests had zero traceability to BRD requirements | **Phase 3.5: Test Planning** — generates test-plan.md, test-cases.md, traceability-matrix.md, fixtures.json. Every test traces: BRD requirement → story → test case → test file. |
| 4 | No way to track requirement changes mid-build. BRD treated as immutable after approval, changes get lost | **`/change`** — logs changes to `specs/brd/changelog.md` with version bump, runs impact analysis, cascades updates through only the affected stories/design/code. |
| 5 | Forge improves only through manual feedback. Most findings from builds are never reported | **`/report-findings`** — opt-in, anonymized. Hook collects findings passively; user reviews everything before submitting as GitHub issues to the forge repo. |
| 6 | No single view of project health. Progress scattered across 5+ files | **`/status`** — terminal ASCII dashboard showing per-group story progress (spec'd/coded/unit-tested/E2E-verified), quality ratchet, blockers, recent activity. Auto-displayed at every checkpoint. |
| 7 | BRD creator and architect make decisions based on training data only. Can't look up latest patterns or compare current technologies | **Internet research** — WebSearch/WebFetch added to both agents. Proactively offer to research when requirements are high-level or tech choices involve rapidly evolving domains. Results saved to `specs/brd/research/`. |
| 8 | CLI/terminal apps had no E2E verification. Gate 5 assumed web apps only | **PTY-based E2E** — launch app in pseudo-terminal, send keystrokes, read screen output, verify renders, confirm clean exit. Proven on Pac-Man CLI (5 PTY tests). |
| 9 | Evaluator said "use Playwright MCP" but had no concrete steps. Browser verification silently skipped if tools unavailable | **Concrete MCP pipeline** — step-by-step detection sequence (Playwright MCP → Chrome extension → listener fallback). Mandatory screenshots. Silent skip → FAIL. |
| 10 | Reference skills named inconsistently (architecture, spec-writing, testing, evaluation, compliance) — unclear which are executable vs reference | **Naming standardization** — all reference skills renamed to `-patterns` suffix (architect-patterns, spec-patterns, test-patterns, evaluate-patterns, comply-patterns). |
| 11 | Only web apps had been dogfooded. No proof the CLI or full browser MCP pipeline actually worked | **Two new dogfood projects** — Pac-Man CLI (75 tests, PTY E2E) proved the non-web pipeline. Task Manager (14 backend + 6 browser scenarios, 8 MCP tools, 3 screenshots) proved the full Playwright MCP pipeline. Both mandatory before release. |

---

## What Changed from v2.0.0 to v2.1.0

### New Skills (+4)
- `/change` — BRD change management with version tracking, impact analysis, and selective cascade through spec/design/implementation
- `/report-findings` — opt-in self-improving feedback loop. Collects anonymized harness findings, user reviews + confirms, submits as GitHub issues. `findings-collector.js` hook captures findings passively.
- `/status` — terminal ASCII dashboard showing per-group story progress (spec'd/coded/unit-tested/E2E-verified), quality ratchet, blockers, recent activity. Auto-displayed at every checkpoint.
- `/upgrade` — in-place forge upgrade. Pulls latest from GitHub, replaces forge-owned files (agents, skills, hooks, evals, templates), preserves all project state, merges config, shows detailed status report. Supports `--check` (dry-run) and `--version` (specific tag). No more manual git clone + re-scaffold.

### Removed Skills (-1)
- `/cost` — merged into `/context-budget --summary`

### Naming Standardization
5 reference skills renamed to `-patterns` suffix for instant clarity:
- architecture → architect-patterns
- spec-writing → spec-patterns
- testing → test-patterns
- evaluation → evaluate-patterns
- compliance → comply-patterns

### New Gate: Gate 12 — Smoke Launch (Real Data)
Added to the ratchet (now 12 gates). Runs in ALL modes, cannot be disabled.
- Web apps: verify health endpoint + browser loads
- CLI apps: import module, load real production data, run N ticks
- Catches the #1 false-green pattern: tests pass on synthetic fixtures, app crashes on real data

### New Pipeline Phase: Phase 3.5 — Test Planning
The test-engineer agent was never called in the build pipeline. Now:
- Phase 3.5 runs `/test --plan-only` after stories, before design
- Generates: test-plan.md, test-cases.md, traceability-matrix.md, fixtures.json
- Every BRD requirement → story → test case → test file (full traceability)

### Internet Research for BRD + Architect
- `brd-creator` and `architect` agents now have WebSearch/WebFetch tools
- Proactively offer to research when requirements are high-level or tech choices involve rapidly evolving domains
- Research saved to `specs/brd/research/{topic-slug}.md`

### BRD Change Management
- `/change "description"` logs to `specs/brd/changelog.md` with version bump
- Impact analysis traces affected stories, design, mockups, tests, code
- Selective cascade: only re-runs affected phases
- All agents check for pending cascades at start

### E2E Testing Improvements
- **PTY-based testing** for CLI/terminal apps (curses, prompt_toolkit, rich)
- **Concrete MCP tool detection** — step-by-step sequences for Playwright MCP, Chrome extension, and listener fallback
- **Browser verification mandatory** when `ui_base_url` is set — silent skip → FAIL
- **Screenshot evidence** mandatory for all browser interactions
- **Real data mandate** — E2E tests must include at least one test against actual production data files

### Consolidations
- `/cost` merged into `/context-budget` (new `--summary` flag)
- `/comply` delegates to `/model-card` instead of duplicating model card generation

### Dogfooding: 2 New Test Projects

**Pac-Man CLI (terminal game):**
- 75 tests (54 unit + 16 headless E2E + 5 PTY E2E)
- Found pattern F1: tests pass on synthetic data, app crashes on real data
- Led to Gate 12 and mandatory real-data testing

**Task Manager (web CRUD app):**
- Proved full Playwright MCP pipeline: 8 MCP tools exercised, 6 browser scenarios, 3 screenshots
- 14 backend tests + 6 browser E2E scenarios
- 0 console errors, all API requests 2xx

### Documentation Fixes
- All counts corrected across CLAUDE.md, README.md, scaffold.md, forge-reference.md, RELEASE-v1.0.0.md
- Missing compliance-reviewer added to scaffold agent table and gates 9-11
- Stale `/cost` references replaced with `/context-budget --summary`

### New Hook (+1)
- `findings-collector.js` — passive findings collection on TaskCompleted events

### New State Templates (+2)
- `harness-findings-log.json` — rolling findings log
- `changelog-template.md` — BRD changelog starter

### New Template (+1)
- `harness-findings.template.md` — findings report format

### In-Place Upgrade Support
- `/upgrade` skill pulls latest forge from GitHub, upgrades in place
- `forge_version` tracking added to `project-manifest.json` during scaffold
- File categories: replace (forge-owned), preserve (state), merge (config), never-touch (project code)
- `--check` mode for dry-run, `--version` for specific tags
- No more manual git clone + restart + re-scaffold

### First Failure Pattern Documented
- `learnings/failure-patterns/common-failures.md` now has pattern F1: synthetic-only testing false green

---

## Known Optimization: Profile-Based Agent/Gate Loading

Currently all 11 agents and 12 gates are loaded for every project regardless of type. A CLI tool loads the compliance reviewer and UI standards reviewer it will never use — ~40% agent context waste.

**Planned for v2.2.0:** Profile-based loading where `project-manifest.json` gets an `active_agents` list based on project type. Only needed agents are copied during scaffold/upgrade.

| Project Type | Agents Needed | Gates Needed | Current Waste |
|-------------|--------------|-------------|--------------|
| CLI tool | 6 of 11 | 7 of 12 | ~40% |
| Simple CRUD web | 9 of 11 | 10 of 12 | ~15% |
| ML/AI | 10 of 11 | 11 of 12 | ~5% |
| Agentic | 10 of 11 | 11 of 12 | ~5% |

Agents that are **always required**: brd-creator, spec-writer, generator, evaluator, code-reviewer, test-engineer (6 core).
Agents that are **conditional**: architect (skip for trivial CLIs), ui-designer (skip for non-UI), ui-standards-reviewer (skip for non-UI), security-reviewer (skip for internal tools), compliance-reviewer (only ML/regulated).

---

## Backlog: Suggested New Skills (from issue #1)

These were suggested by a user but deferred. They would be new skills if implemented.

| # | Skill | What It Would Do | Status |
|---|-------|-----------------|--------|
| 1 | `loop-termination-check` | Static analysis verifying loops with overlap/offset logic terminate on all inputs | Backlog |
| 2 | `cloud-run-compatibility-check` | Pre-deploy check: no long-running browser processes, ops fit timeout, cold start assessed | Backlog |
| 3 | `local-vs-prod-parity-test` | Run test subset against deployed environment (local success != production success) | Backlog |
| 4 | `timeout-budget-calculator` | Given operation timeout and per-unit time, flag ops that exceed timeout before starting | Backlog |

---

## Quantitative Summary

| Metric | v2.0.0 | v2.1.0 | Delta |
|--------|--------|--------|-------|
| Skills (total) | 36 | 40 | +4 (net: +4 new, -1 removed) |
| Task skills | 25 | 29 | +4 |
| Reference skills | 11 | 11 | 0 (renamed, not added) |
| Hooks | 18 | 19 | +1 |
| Ratchet gates | 11 | 12 | +1 |
| Build phases | 9 | 10 | +1 (Phase 3.5) |
| Templates | 17 | 17 | 0 (harness-findings added, count was already 17) |
| State files | 7 | 9 | +2 |
| Dogfood projects | 4 | 6 | +2 |
| Failure patterns documented | 0 | 1 | +1 |
| Mandatory dogfood scenarios | 0 | 2 | +2 (web + CLI) |
