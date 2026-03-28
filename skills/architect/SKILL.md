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

### Step 2 — Stack Interrogation (up to 11 rounds)

Conduct one round at a time. Wait for human response before proceeding. Rounds 7-9 are **conditional** — only activate if the BRD describes the relevant requirements (agentic system, ML, user data).

**Round 1 — Backend:** Present 2-3 options informed by BRD requirements. Challenge mismatches.
**Round 2 — Database:** Analyze data patterns from BRD. Challenge schema-stack mismatches.
**Round 3 — Frontend:** Framework, styling, state management.
**Round 4 — AI/LLM Model Selection:** Which models power the forge agents? Cloud-only, hybrid, or local-only routing.
**Round 5 — Deployment:** Dev environment, target deployment, CI/CD, external services.
**Round 6 — Verification mode:** Docker/local/stub verification config.
**Round 7 — Agentic Architecture** *(if BRD describes agents):* Agent count, protocols (MCP/A2A), communication pattern, framework, human oversight model.
**Round 8 — AI/ML Pipeline** *(if BRD involves ML):* Models, training/inference, batch/real-time, RAG components, vector DB, monitoring.
**Round 9 — Governance & Compliance** *(if BRD involves user data or AI decisions):* Regulations (GDPR/HIPAA/SOC2/AI Act), PII handling, fairness requirements, audit trail.
**Round 10 — Context & Cost Budget:** Build budget, token strategy, prompt caching.
**Round 11 — Verify & Challenge:** Summarize ALL decisions (including AI/compliance). List concerns.

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
