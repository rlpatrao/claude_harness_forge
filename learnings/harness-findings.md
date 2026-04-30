# Harness Findings

Issues discovered during the Aiden build that reflect gaps in the claude-harness-forge pipeline itself. Each finding includes the problem, evidence, impact, and recommended fix for the forge.

---

## HF-001: BRD content not fully decomposed into stories by /spec

**Severity:** High
**Phase:** Spec Decomposition (`/spec`)
**Discovered:** 2026-04-11, during Group H+I implementation

### Problem

The spec-writer agent decomposes feature specs (`specs/brd/features/e1-e9`) into stories but silently drops requirements from other BRD sections. These were present in the approved BRD but generated zero stories:

1. Microsoft Agent Governance Kit (Content Safety, Purview, agent identity, PyRIT red-teaming)
2. OpenTelemetry observability scaffolding (OTel traces, structured logging, Azure Monitor, Grafana)
3. Content Safety integration (Prompt Shields, Groundedness Detection, Protected Material Detection)
4. OWASP LLM06:2025 Excessive Agency checklist
5. Cross-session learnings corpus

### Root Cause

The spec-writer reads feature specs but does not cross-reference against the app_spec NFRs, governance sections, assumptions register, or roadmap phases. Non-functional requirements and cross-cutting concerns are systematically dropped.

### Impact

An operator who trusts `/spec` output as complete will ship without governance, observability, and security hardening — the requirements hardest to retrofit.

### Recommended Fix

1. Spec-writer produces a BRD-to-story traceability matrix after decomposition and flags any BRD section with zero story coverage.
2. Add an NFR extraction pass that scans app_spec for governance, security, observability, and compliance sections.
3. `/build` Phases 6-7 (observability, compliance) should generate stories into `features.json` even if conditional — let `/auto` decide to skip, not the spec-writer.

---

## HF-002: /auto does not generate runnable entry points

**Severity:** High
**Phase:** Autonomous Build (`/auto`)
**Discovered:** 2026-04-12, after all groups completed

### Problem

After `/auto` completed Groups A-I (47 stories, 659 tests), the project had zero runnable entry points. No CLI binary, no server start script, no TUI launcher, no way to execute any of the code outside of `vitest run`. The user was told "47/56 features passing" but could not actually use any of them.

### Evidence

- No `packages/cli/` existed despite being in `specs/design/folder-structure.md`
- No `bin/aiden` script
- No `serve.ts` for the dashboard API
- No bootstrap wiring the 13 packages together
- No built-in tool implementations (file-read, shell-exec, etc.)
- No model provider implementations beyond types

### Root Cause

The spec-writer decomposed features into library-level stories (interfaces, adapters, components) but never generated stories for:
- CLI entry point and arg parsing
- Bootstrap/dependency injection wiring
- Built-in tool implementations
- Provider implementations (even a mock/echo provider)
- Server start scripts

The `/auto` loop faithfully implemented what was specified — pure library code. The gap is that "implementable" was confused with "usable."

### Impact

A project that passes all its tests but cannot be executed is not shippable. The user discovered this only after asking "which flows can I test?" — the answer was "none."

### Recommended Fix

1. **Spec-writer must generate "runnable" stories**: For any project with a CLI, TUI, API server, or dashboard, automatically generate stories for: entry point, bootstrap, built-in tools, at least one provider (mock/echo), and server start.
2. **`/auto` post-build gate**: After all groups pass, verify the project is actually runnable. Run the binary, hit the health endpoint, render the TUI. If nothing is executable, fail the build.
3. **`/build` Phase 12 (post-build)** should include a "smoke test" step that attempts to run the built application and verifies basic functionality before declaring success.

---

## HF-003: Generator produces code that passes vitest but fails tsc --strict

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, ratchet gate)
**Discovered:** 2026-04-11, every group from C onward

### Problem

The generator consistently produces code where all unit tests pass (`vitest run`) but TypeScript strict compilation fails (`tsc --noEmit --strict`). This happened in Groups C, D, E, F, G, H, and I — every group after the initial types package. Self-healing fixed them every time, but it was always the same categories of error.

### Evidence

Recurring error categories across 7 groups:
1. **`exactOptionalPropertyTypes` violations** (Groups C, D, E, F, H): Assigning `{ prop: undefined }` instead of omitting the property. Occurred 15+ times.
2. **Node.js module import style** (Group E): `import fs from "node:fs/promises"` instead of `import * as fs from "node:fs/promises"` under `moduleResolution: "NodeNext"`.
3. **Mock type mismatches** (Groups E, F): `vi.fn()` return type not matching generic interface signatures like `StorageAdapter['read']`.
4. **`string | ContentBlock[]` without narrowing** (Group D): Calling `.map()` on a union type without `Array.isArray()` guard.

### Root Cause

The generator writes tests that Vitest runs successfully (runtime doesn't care about `exactOptionalPropertyTypes`) but doesn't run `tsc --noEmit --strict` as a pre-commit check. The ratchet Gate 2 (lint + types) catches it, but only after the generator declares completion.

### Impact

Every group required at least one self-healing iteration for type errors. This is predictable overhead (~2-5 minutes per group) that could be eliminated.

### Recommended Fix

1. **Generator teammates must run `tsc --noEmit --strict` before declaring completion** — not just `vitest run`. Add this to the teammate spawn prompt as a mandatory step.
2. **Add `exactOptionalPropertyTypes` to the learned-rules** as a first-class rule injected into every generator prompt. The pattern is: "never assign `undefined` to optional properties; omit the property or use conditional spread."
3. **Pre-seed learned-rules.md** with known TypeScript strict patterns for the project's tsconfig (NodeNext imports, exactOptionalPropertyTypes, no implicit any in callbacks).

---

## HF-004: Evaluator and code reviewer run sequentially, not concurrently with implementation

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, ratchet gate)
**Discovered:** 2026-04-11, throughout the build

### Problem

The `/auto` pipeline runs: generate → evaluator → code reviewer → self-heal → next group. The evaluator and code reviewer are independent (they both read the same code, neither modifies it) but the skill doesn't direct them to run in parallel. The orchestrator (me) ran them in parallel when I realized this, but the `/auto` skill doesn't prescribe it.

### Evidence

Groups A-C: evaluator and code reviewer ran sequentially (each taking 2-4 minutes). From Group D onward I spawned them in parallel, halving the gate time.

### Root Cause

The `/auto` skill describes gates sequentially (Gate 4, then Gate 5, then Gate 6) without noting which are parallelizable.

### Recommended Fix

1. Add a "parallel gates" annotation to the `/auto` skill: Gates 4+5+6 (architecture + evaluator + code reviewer) can run concurrently. Gate 7 (UI standards) can run concurrently with Gate 8 (security).
2. The orchestrator should automatically spawn independent gates in parallel.

---

## HF-005: Sprint contract negotiation is overhead for types-only and adapter groups

**Severity:** Low
**Phase:** Autonomous Build (`/auto`, sprint contracts)
**Discovered:** 2026-04-11, Groups A, H, I

### Problem

The generator proposes a contract, then the evaluator reviews and finalizes it. For simple groups (types-only, cloud adapters with known interfaces), this adds 3-5 minutes of negotiation for contracts that are nearly identical to the story acceptance criteria verbatim.

### Evidence

- Group A (types): Contract was essentially "does tsc compile and are exports present" — trivially derivable from ACs.
- Group I (Azure infra): Contract was "do Bicep files exist with correct resource types" — trivially derivable.
- The evaluator approved Group E's contract unchanged — "no modifications needed."

### Root Cause

The `/auto` skill mandates contract negotiation for every group regardless of complexity. There's no "fast-track" for groups where the ACs are already concrete and testable.

### Recommended Fix

1. Add a **contract complexity heuristic**: If all ACs in a group are already in Given/When/Then format with concrete assertions, skip the evaluator review and use the generator's contract directly.
2. In `/auto` Solo mode, contracts are already skipped. Consider a "lean contract" mode where the generator produces the contract but the evaluator only reviews if the group has cross-cutting concerns or ambiguous ACs.

---

## HF-006: Code reviewer findings arrive too late to prevent rework

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, code review gate)
**Discovered:** 2026-04-11, Group B code review

### Problem

The code reviewer for Group B found 7 BLOCK findings including a SQL injection vulnerability, but these were discovered only after Group C was already implemented. The fixes had to be applied retroactively, and any code in Group C that depended on Group B's flawed code could have been affected.

### Evidence

Group B code review completed during Group C implementation. BLOCKs included:
- B5: SQL injection via unvalidated field names in SQLite adapter
- B3/B4: Functions exceeding 50-line limit
- B1: Missing `initialMessages` in AgentLoopOptions
- B7: Tautological test assertion

### Root Cause

The `/auto` skill runs the code reviewer as a background task and proceeds to the next group immediately after the evaluator passes. The code reviewer's BLOCK findings are discovered asynchronously.

### Recommended Fix

1. **Code reviewer must complete before the next group starts** — at least for BLOCK-level findings. The evaluator (Gate 5) can run in background, but code reviewer (Gate 6) BLOCKs must gate progression.
2. Alternatively, run the code reviewer in parallel with implementation but pause before the next group's generator spawn to check for BLOCKs.

---

## HF-007: /test skill assumes Docker Compose web app structure

**Severity:** Medium
**Phase:** Testing (`/test`)
**Discovered:** 2026-04-12, during test phase

### Problem

The `/test` skill's steps assume a Docker Compose web application: "Docker stack must be deployable", "verify Docker stack is healthy", "curl health endpoint", Playwright E2E tests. This doesn't fit a TypeScript monorepo library/CLI project.

### Evidence

From the `/test` skill:
- Step 5: `cp .claude/skills/testing/templates/playwright.config.ts`
- Step 6: `npx playwright install --with-deps chromium`
- Step 7: `docker compose up -d --build` + health check
- Step 8: `npx playwright test`

None of these apply to Aiden. The test-engineer agent correctly ignored them and produced integration tests instead, but it had to deviate from the skill's prescribed steps.

### Root Cause

The `/test` skill has a single project archetype (Docker + web frontend + API backend) and no detection or adaptation for other project types (library, CLI, monorepo, desktop app).

### Recommended Fix

1. **Project type detection**: Read `project-manifest.json` or `calibration-profile.json` to determine project type (web-app, library, CLI, monorepo) and select the appropriate test strategy.
2. **Test strategy templates**: Provide different step sequences for different project types:
   - Web app: Docker + Playwright + API tests (current behavior)
   - Library/monorepo: Unit tests + integration tests + contract tests
   - CLI: Unit tests + integration tests + subprocess smoke tests
3. **Make Playwright optional**: Only prescribe Playwright when the project has a browser-rendered frontend.

---

## HF-008: No smoke test or executable verification in the pipeline

**Severity:** High
**Phase:** Autonomous Build (`/auto`, `/build`)
**Discovered:** 2026-04-12, when user asked "which flows can I test?"

### Problem

The entire `/build` pipeline — BRD through `/auto` through `/test` — never verifies that the built project actually runs. Tests pass, types compile, coverage meets thresholds, but nobody checks if `./bin/aiden --version` works.

### Evidence

After 47/56 features passed, the project had:
- 659 unit tests passing
- 64 integration tests passing
- 91% coverage
- Zero runnable commands
- Storage adapter not initialized in the dashboard bootstrap
- `ink` dependency missing from CLI package
- No echo/mock provider for testing without API keys

All of these were discovered only when manually attempting to run the application.

### Root Cause

The ratchet gates verify code quality (tests, types, coverage, architecture, security) but not code utility. There is no gate that says "start the application and verify it responds."

### Recommended Fix

1. **Add Gate 0 to the ratchet: Smoke Test**. After all other gates pass for a group, attempt to execute the project's entry point. For a CLI: run `--version` and `--help`. For an API: start the server and hit `/health`. For a TUI: render and capture the first frame.
2. **`/build` Phase 12 (post-build)** must include runnable verification before declaring success.
3. **`/test` must include a "can it run?" check** before generating test plans for advanced scenarios.

---

## HF-009: Coverage reporting includes non-source directories

**Severity:** Low
**Phase:** Autonomous Build (`/auto`, Gate 3)
**Discovered:** 2026-04-11, Group D

### Problem

Vitest coverage reported 68.96% overall when the actual source packages were at 91%+. The drop was caused by `*/coverage/` output directories being included in the coverage scan.

### Evidence

```
core/coverage     |       0 |        0 |       0 |       0 |
prompt/coverage   |       0 |        0 |       0 |       0 |
tui/coverage      |       0 |        0 |       0 |       0 |
```

These are Vitest's own coverage output directories, not source code.

### Root Cause

The vitest workspace config didn't exclude coverage output directories. The generator created per-package `vitest.config.ts` files but didn't add `coverage.exclude` patterns.

### Recommended Fix

1. **Generator should add coverage exclusions** to `vitest.config.ts` templates: `exclude: ['**/coverage/**', '**/dist/**', '**/node_modules/**']`.
2. **`/auto` Gate 3 should validate coverage source**: If coverage drops significantly after adding a new package, check whether non-source directories are being scanned before failing.

---

## HF-010: Evaluator marks features as passing without verifying previous groups still pass

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, evaluator)
**Discovered:** 2026-04-12, reviewing build log

### Problem

When the evaluator passes a group and updates `features.json`, it marks the current group's features as passing. It does not re-verify that all previously passing features still pass. If Group C's implementation broke a Group B feature, the evaluator wouldn't catch it.

### Evidence

The evaluator report for each group only verifies the current group's sprint contract checks. It runs `npx vitest run` (all tests) but only inspects the results for the current group's test files. A regression in a different package's tests could pass unnoticed if the test still technically passes but behavior changed.

### Root Cause

The evaluator is scoped to the current sprint contract. There is no regression verification step that re-evaluates all previously passing features.

### Recommended Fix

1. **Add a regression check to the evaluator**: After passing the current group, re-run a subset of previous groups' critical checks (at minimum, verify `features.json` counts don't decrease).
2. **Gate 11 (spec gaming detection) should include a regression rule**: If any previously-passing feature's tests are deleted or weakened, FAIL.

---

## HF-011: No learned rules extracted despite recurring patterns

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, learning)
**Discovered:** 2026-04-12, reviewing build log

### Problem

The `/auto` skill specifies that learned rules should be extracted when the same error type appears 2+ times. The `exactOptionalPropertyTypes` error occurred in 7 consecutive groups, yet `learned-rules.md` remained empty throughout the entire build.

### Evidence

`claude-progress.txt` shows `learned_rules: 0` in every session block. `.claude/state/learned-rules.md` contains only the header — no rules were ever extracted.

### Root Cause

The orchestrator (me) fixed type errors via self-healing but didn't follow through on the `/auto` skill's Section 12 (Failure-Driven Learning) to extract rules. The skill says "check after every failure entry" but the orchestrator prioritized speed over learning.

### Recommended Fix

1. **Make rule extraction automatic**: After the 2nd occurrence of the same error category in `failures.md`, the `/auto` orchestrator should automatically extract a rule — not leave it to the orchestrator's judgment.
2. **Pre-seed `learned-rules.md`** at `/build` Phase 5 with common patterns from the project's tsconfig (this project uses `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `NodeNext` — all known footguns).
3. **Stack learnings integration**: The `/auto` skill references cross-project learnings but doesn't automatically read them. If a previous project using the same tsconfig had the same issue, that learning should transfer.

---

## HF-012: Parallel group implementation can cause file conflicts

**Severity:** Medium
**Phase:** Autonomous Build (`/auto`, agent teams)
**Discovered:** 2026-04-11, Groups H+I

### Problem

Groups H and I were implemented in parallel (both writing to `adapters/azure/`). Group I's agent found bugs in Group H's `azure-openai-provider.ts` and fixed them. If the agents had conflicting changes to the same file, one would overwrite the other.

### Evidence

Group I's summary noted: "Two bugs fixed in `azure-openai-provider.ts`" — a file owned by Group H (E6A-S1). The fix worked because Group H completed first and Group I ran in the same worktree, but this was lucky timing.

### Root Cause

The `/auto` skill's component map assigns file ownership per-story, but when groups are run in parallel by the orchestrator, there's no file-level locking. Two agents writing to the same package can conflict.

### Recommended Fix

1. **File-level conflict detection**: Before spawning parallel groups, check the component map for shared files. If two groups write to the same file, sequence them instead of parallelizing.
2. **Use git worktrees for parallel groups**: Each parallel group works in its own worktree and changes are merged afterward. The `/auto` skill mentions `--worktree` but doesn't mandate it for parallel groups.
3. **Post-merge verification**: After parallel groups complete, run all gates on the merged result, not just on each group individually.
