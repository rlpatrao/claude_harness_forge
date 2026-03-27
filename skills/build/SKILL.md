---
name: build
description: Full 9-phase SDLC pipeline. BRD → Architect → Spec → Design → Initialize → Auto → Post-build learnings. Human gates on phases 1-4.
argument-hint: "[path-to-BRD] [--mode full|lean|solo|turbo]"
context: fork
---

# Build Skill

Full software development lifecycle pipeline. Orchestrates BRD creation, stack interrogation, story specification, UI mockups, state initialization, and autonomous build execution across 9 sequential phases plus a post-build learnings phase.

---

## Usage

```
/build path/to/requirements.md
/build path/to/requirements.md --mode lean
/build                              # Start from /brd interview
```

The `--mode` flag controls which ratchet gates `/auto` enforces. Default: `full`.

---

## 9-Phase Pipeline

### Phase 1 — Business Requirements [HUMAN APPROVAL]

Run `/brd` with the provided requirements document (or start the Socratic interview if no document provided). Outputs are written to `specs/brd/`.

**Stop and wait for explicit human approval.** Present a summary of the BRD and ask: "Approve BRD to proceed to Phase 2 (Architecture)?"

Do NOT proceed without a clear "yes" or "approved" from the user.

### Phase 2 — Architecture & Stack [HUMAN APPROVAL]

Run `/architect`. The architect agent reads the approved BRD, conducts an interactive 5-round stack interrogation with the human, generates design artifacts, and verifies completeness.

Outputs: `specs/design/architecture.md`, `api-contracts.md`, `api-contracts.schema.json`, `data-models.md`, `data-models.schema.json`, `component-map.md`, `folder-structure.md`, `deployment.md`, `project-manifest.json`, `calibration-profile.json`.

**Stop and wait for explicit human approval.** Present the architect's verification summary and any concerns. Ask: "Approve architecture to proceed to Phase 3 (Stories)?"

### Phase 3 — Story Specification [HUMAN APPROVAL]

Run `/spec` using the approved BRD and architecture. Outputs are written to `specs/stories/` and `features.json`.

**Stop and wait for explicit human approval.** Present story count, dependency groups, and feature list. Ask: "Approve stories to proceed to Phase 4 (UI Design)?"

### Phase 4 — UI Mockups [HUMAN APPROVAL]

Spawn `ui-designer` agent to create interactive React+Tailwind HTML mockups in `specs/design/mockups/`. Architecture artifacts from Phase 2 are already complete — this phase only adds visual mockups.

Skip this phase entirely for API-only projects (project_type = "api-only" in calibration-profile.json).

**Stop and wait for explicit human approval.** Present mockup file list. Ask: "Approve mockups to proceed to autonomous build?"

### Phase 5 — Initialize State

Create state files before entering the autonomous loop:

1. `.claude/state/coverage-baseline.txt` — Write `0`
2. `.claude/state/iteration-log.md` — Write header
3. `.claude/state/cost-log.json` — Write `[]`
4. `claude-progress.txt` — Write session 0 block:
   ```
   === Session 0 ===
   date: {ISO 8601}
   mode: {mode}
   groups_completed: []
   groups_remaining: [all group IDs from dependency-graph.md]
   current_group: none
   features_passing: 0 / {total features}
   coverage: 0%
   learned_rules: 0
   next_action: Begin autonomous build with /auto
   ```

### Phases 6-9 — Autonomous Execution

Run `/auto --mode {mode}` to enter the autonomous build loop. The `/auto` skill handles: sprint contracts, agent teams, 8-gate ratchet (including browser console capture and UI standards review), self-healing, and session chaining.

### Phase 10 — Post-Build

After `/auto` completes (all groups done or stopping criteria met):

1. Run `/architect --post-build` to fill in learnings (verdict, patterns, recommendations)
2. Generate `README.md` for the built application (describes the app, not the harness)
3. Commit: `git add README.md && git commit -m "docs: add README"`

---

## Mode Reference

| Mode | Gates | Cost Estimate | When to Use |
|------|-------|---------------|-------------|
| `full` | All 8 gates per group | $100-300 | Production apps, complex requirements |
| `lean` | Gates 1-6 (skip UI standards + security) | $30-80 | Backend-heavy, internal tools |
| `solo` | Gates 1-3 only (no evaluator) | $5-15 | Bug fixes, small features, prototyping |
| `turbo` | Gates 1-3 per commit, 4-8 once at end | $30-50 | Well-specified + capable model |

---

## Gotchas

- **Proceeding without approval:** Phases 1-4 each require explicit human approval. Silence is not consent.
- **Skipping the architect phase:** Phase 2 produces `project-manifest.json` and `component-map.md` which are required by `/auto`. Skipping architecture breaks the downstream pipeline.
- **Not initializing state files:** Phase 5 must create all state files before `/auto` runs.
- **Wrong mode passthrough:** Read the `--mode` flag and pass it to `/auto` exactly.
