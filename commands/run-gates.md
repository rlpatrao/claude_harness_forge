---
description: Run the 12-gate ratchet (BRD §7 / CLAUDE.md). Appends a snapshot to state/eval-scores.json and triggers the monotonic-improvement guard.
argument-hint: [--gate N] | [--dry-run]
---

# /run-gates

## Runtime

```bash
bash scripts/run-gates.sh $ARGUMENTS
```

Runs all 12 gates (or a single gate via `--gate N`, or lists with `--dry-run`). Each gate is scored 1 or 0; the run appends a snapshot to `state/eval-scores.json` with the current git SHA and `feature_list.json` hash.

After the run, `hooks/experiment-logger.js` compares the new snapshot to the prior one and recommends keep|revert per `state/monotonic-policy.json` (default: `revert-on-any-regression`).

## Hard rules per CLAUDE.md

- Gate 11 (spec-gaming detection) and Gate 12 (smoke launch) cannot be disabled.
- Gates 7/8/10 are conditional on project type (UI / always / ML).
- A revert recommendation is **advisory** — the agent decides whether to follow it. Log the decision in `harness-progress.txt`.

## When to use

- End of phase 9 (Merge) per BRD §7 — `scripts/orchestrate.js` calls this at phase 9.
- Manually after any commit that touches code paths covered by the ratchet.
- In CI (the `.github/workflows/ci.yml` workflow can run this against PRs).
