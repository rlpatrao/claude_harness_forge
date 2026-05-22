---
description: Walk BRD §7 phases 4-9 autonomously for a feature_list.json entry. Emits a per-phase plan the main agent executes.
argument-hint: <feature_id> | --resume
---

# /orchestrate

The autonomous half of the BRD §7 pipeline. Phases 1-3 (Intake, Architecture, Plan) require human approval; phases 4-9 (Generate, Self-critique, Test, E2E verify, Code review, Merge) run under this command.

## Runtime

```bash
node scripts/orchestrate.js $ARGUMENTS
```

The script emits a JSON plan on stdout. For each entry in `plan.phases[]`:

- If `subagent` is set → invoke the Task tool with that `subagent_type` and the `task_prompt`.
- If `parallel` is set → invoke Task in parallel for each entry.
- If `cmd` is set → run via Bash.

On any phase failure: trigger `/spec-audit <phase_n> <feature_id>` before retry. After 3 retries on the same phase, escalate to the user via `AskUserQuestion`.

## When to use

- After human approval of phases 1-3 for a feature.
- After a Ralph Loop intercept identifies the next failing feature with deps satisfied.
- Manually, to drive a specific feature to completion.

## Hard rules

- One feature per `/orchestrate` invocation.
- Phase 9 (Merge) is where the `passes` flip happens. The `e2e-gate` and `feature-edit-guard` hooks enforce the gate; do not bypass.
- If the plan emits a phase your environment can't run (e.g., no Playwright MCP for phase 7), surface that to the user — do not silently skip.
