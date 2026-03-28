---
name: architect
description: Interactive stack interrogation, design artifact generation, decision verification, and learnings persistence. Runs after BRD approval, before spec decomposition.
argument-hint: "[--post-build]"
---

# Architect Skill

Interactive technical design phase. The architect reads the BRD, interviews the human about stack and deployment decisions, generates machine-readable design artifacts, verifies completeness, and persists decisions for cross-project reuse.

---

## Usage

```
/architect              # Full interactive flow (Phases 1-4 + learnings)
/architect --post-build  # Post-build learnings update only (Phase 5)
```

---

## Prerequisites

- `specs/brd/` must contain an approved BRD (app spec and/or feature specs)
- `.claude/learnings/` should exist (created by `/scaffold`)

---

## Interactive Flow (default)

### Step 1 — Read Context

Read in order:
1. `specs/brd/` — all approved specs
2. `.claude/learnings/stack-decisions/` — all prior project records
3. `.claude/learnings/integration-notes/` — any relevant API notes
4. `.claude/learnings/failure-patterns/common-failures.md`

Summarize relevant learnings to the human before starting questions.

### Step 2 — Stack Interrogation (6 rounds)

Conduct one round at a time. Wait for human response before proceeding.

**Round 1 — Backend:** Present 2-3 options informed by BRD requirements. Challenge mismatches.
**Round 2 — Database:** Analyze data patterns from BRD. Challenge schema-stack mismatches.
**Round 3 — Frontend:** Framework, styling, state management.
**Round 4 — AI/LLM Model Selection:** Which models power the forge agents? Options: cloud-only (Claude), hybrid (Claude for reasoning + local for code gen), or local-only. Supports Qwen3-Coder-480B, DeepSeek-Coder-V3, or custom. Records routing config in `project-manifest.json` under `execution.model_routing`.
**Round 5 — Deployment:** Dev environment, target deployment, CI/CD, external services.
**Round 6 — Verify & Challenge:** Summarize all decisions including model routing. List specific concerns based on BRD gaps.

See `agents/architect.md` for detailed question templates and challenge examples.

### Step 3 — Generate Design Artifacts

After human confirms stack, generate all artifacts to `specs/design/`:
- `architecture.md` — component diagram, tech choices with rationale
- `api-contracts.md` + `api-contracts.schema.json` — typed endpoints
- `data-models.md` + `data-models.schema.json` — Pydantic + TS + DB
- `component-map.md` — story → file mapping with Produces/Consumes
- `folder-structure.md` — complete file tree
- `deployment.md` — Docker Compose, env vars, migrations

Also generate/update:
- `project-manifest.json` — complete stack config (fills skeleton from scaffold)
- `calibration-profile.json` — UI standards config based on project type

### Step 4 — Decision Verification Gate

Run self-check before presenting to human. Flag any gaps:
- Every BRD feature → API endpoint
- Every data entity → model
- No upward layer imports in folder structure
- External APIs → typed wrappers in component map
- All env vars documented

### Step 5 — Write Learnings

Write stack decision record to `.claude/learnings/stack-decisions/{project-name}-stack.md`.
Update `_index.md`.

---

## Post-Build Mode (`--post-build`)

Invoked by `/auto` after build completes. Reads `learned-rules.md` and `failures.md`, fills in:
- "Verdict after build" per decision
- "Patterns That Worked"
- "Patterns to Avoid Next Time"
- "Recommendations for Similar Projects"

Also writes/updates integration notes for any external APIs used during the build.

---

## Gotchas

- **Not reading learnings first:** Always read existing stack-decisions before interviewing. Past project experience prevents repeating mistakes.
- **Accepting weak reasoning:** "I'm familiar with it" is not sufficient for a production choice. Challenge with BRD-specific trade-offs.
- **Incomplete component map:** The generator needs unambiguous file ownership. If two stories might touch the same file, designate an integrator.
- **Missing env vars:** Every external service needs env vars in `.env.example`. Missing vars cause deploy failures.
- **Skipping verification gate:** Gaps found at implementation time cost 10x more. Run the self-check.
