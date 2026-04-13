# Claude Harness Forge v2.1.0 — Release Notes

**Release Date:** 2026-04-13
**Previous:** [v2.0.0](RELEASE-v2.0.0.md) (11 agents, 36 skills, 18 hooks, 11-gate ratchet)

## What Changed from v2.0.0 to v2.1.0

### New Skills (+3)
- `/change` — BRD change management with version tracking, impact analysis, and selective cascade through spec/design/implementation
- `/report-findings` — opt-in self-improving feedback loop. Collects anonymized harness findings, user reviews + confirms, submits as GitHub issues. `findings-collector.js` hook captures findings passively.
- `/status` — terminal ASCII dashboard showing per-group story progress (spec'd/coded/unit-tested/E2E-verified), quality ratchet, blockers, recent activity. Auto-displayed at every checkpoint.

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

### First Failure Pattern Documented
- `learnings/failure-patterns/common-failures.md` now has pattern F1: synthetic-only testing false green

---

## Quantitative Summary

| Metric | v2.0.0 | v2.1.0 | Delta |
|--------|--------|--------|-------|
| Skills (total) | 36 | 39 | +3 (net: +3 new, -1 removed) |
| Task skills | 25 | 28 | +3 |
| Reference skills | 11 | 11 | 0 (renamed, not added) |
| Hooks | 18 | 19 | +1 |
| Ratchet gates | 11 | 12 | +1 |
| Build phases | 9 | 10 | +1 (Phase 3.5) |
| Templates | 17 | 17 | 0 (harness-findings added, count was already 17) |
| State files | 7 | 9 | +2 |
| Dogfood projects | 4 | 6 | +2 |
| Failure patterns documented | 0 | 1 | +1 |
| Mandatory dogfood scenarios | 0 | 2 | +2 (web + CLI) |
