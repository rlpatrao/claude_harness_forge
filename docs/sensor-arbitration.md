# Sensor arbitration (BRD v3.2.3)

Every enforcement in the forge — hook, gate, agent finding — sits at one of four **arbitration levels**. The level determines whether the enforcement blocks, self-corrects, informs a reviewer, or is purely informational. This document is authoritative; when a hook says "advisory" here, its exit-code and JSON output must match.

Adapted from `cwijayasundara/claude_harness_eng_v5/docs/sensor-arbitration.md` per BRD v3.2 §3.3.

## The four levels

| Level | Signal | Bypass | When it fires |
|---|---|---|---|
| **hard-block** | Exit 2 with `BLOCKED: <reason>` on stderr | Waiver only ([`sensor-waivers.schema.json`](../templates/sensor-waivers.schema.json)) | Uncorrectable safety boundary (secret leak, dangerous path, E2E-artifact missing, feature_list structural violation, security axis vote BLOCK) |
| **self-correct** | Exit 2 with a specific error the model can read and fix on retry | Fix the underlying issue | Lint failure, type-check failure, function/file too long, layer import violation, staged-file check failure |
| **review-focus** | Exit 0 but appends findings to `specs/reviews/pending-<sensor>.jsonl` for the next reviewer session | Reviewer acknowledges (accept or reject) | Instinct-extractor drops, findings-collector items, spec-audit hints — non-blocking observations that should surface at merge boundary |
| **advisory** | Exit 0 with a `hookSpecificOutput.additionalContext` note visible to the model | Model may or may not act | Token advisor, reminder injector, budget footer, teammate idle check |

## Rationale

Prior to v3.2.3 our 27 hooks used an implicit taxonomy — some blocked (exit 2), some advised (exit 0 with context), some wrote files. Without a canonical taxonomy:

- Adding a waiver required editing hook source.
- Reasoning about "what happens when hook X fires" required reading each hook.
- Downstream tools couldn't tell "this is a hard-block" from "this is a suggestion" without out-of-band knowledge.

The four-level ladder makes the intent legible and gives us a single waiver mechanism.

## Hook classification

Every hook in `hooks/` is classified below. When adding a new hook, add its row here AND set the `arbitration_level` field in its output JSON when it produces one.

### hard-block

| Hook | Fires on | What it blocks |
|---|---|---|
| `dangerous-patterns.js` | Bash/Edit/Write | `rm -rf`, `chmod 777`, `--force-with-lease` on main, kill 1, other destructive commands |
| `feature-edit-guard.js` | Edit/Write on `feature_list.json` | Any non-single-passes-flip edit; add/remove entry; description change |
| `e2e-gate.js` | Edit/Write on `feature_list.json` (passes flip only) | Missing verification artifact; artifact not in git; artifact empty. Optional (v3.2.2, `E2E_GATE_ENFORCE_VOTES=1`): missing/BLOCKED critic vote |
| `pre-bash-gate.js` | Bash | Bash writes to `.env` / credentials / `.ssh/` / `.claude/settings.json` / paths outside project root |
| `detect-secrets.js` | Edit/Write | Content contains AWS keys, GitHub tokens, private keys, common API-key regex hits |
| `protect-env.js` | Edit/Write | Writes to `.env*` files |
| `protect-pdfs.js` | Write | Edits to binary PDFs |
| `scope-directory.js` | Edit/Write | Writes to paths outside project directory (except allow-listed) |
| `network-egress.js` | Bash | Curl/wget to non-allow-listed domains |
| `pre-commit-gate.js` | Bash `git commit` | Aggregate: lint / typecheck / coverage baseline / architecture fails |
| `prompt-injection-detect.js` | Edit/Write on prompt files | Detected injection signature |
| `pii-scan.js` | Edit/Write on data files | PII pattern hits (SSN, credit card, email in code path) |

### self-correct

| Hook | Fires on | What the model should do |
|---|---|---|
| `lint-on-save.js` | PostToolUse Edit/Write | Fix lint output printed in error message |
| `typecheck.js` | PostToolUse Edit/Write | Fix TypeScript / mypy errors printed |
| `check-architecture.js` | PostToolUse Edit/Write | Fix import direction violation (upward layer imports) |
| `check-function-length.js` | PostToolUse Edit/Write | Split function > 100 lines |
| `check-file-length.js` | PostToolUse Edit/Write | Split file > 500 lines |
| `sprint-contract-gate.js` | PostToolUse Bash | Reconcile diff with sprint contract before continuing |
| `concurrency-gate.js` | PreToolUse Task/Agent | Wait for outstanding spawn to complete, or reduce fan-out |
| `verify-on-save.js` | PostToolUse Edit/Write | (Silent; append to dirty-files ledger. Only self-correct if hook itself fails) |

### review-focus

| Hook | Fires on | Where findings land |
|---|---|---|
| `instinct-extractor.js` | Stop | `instincts/pending/*.md` (`/evolve` reviews) |
| `findings-collector.js` | TaskCompleted | `.claude/state/harness-findings-log.json` (opt-in submission) |
| `experiment-logger.js` | PostToolUse Bash (validate-evals.sh) | `experiments/log.jsonl` |
| `task-completed.js` | TaskCompleted | Task ledger; consumed by `/status` |
| `graph-refresh.js` | Stop | `state/code-graph.json` + `state/symbol-map.md` (refresh only; failures don't block) |

### advisory

| Hook | Fires on | What the model sees |
|---|---|---|
| `token-advisor.js` | PreToolUse Read/Bash/Glob/Grep | `additionalContext` warning; rate-limited to 3/session |
| `reminder-injector.js` | PreToolUse Edit/Write/Bash/Agent | `additionalContext` reminders from `prompts/reminders/*.md` |
| `budget-footer.js` | PostToolUse (all) | `budget:` regime footer appended to tool result |
| `teammate-idle-check.js` | PostToolUse Bash | Warns if a teammate has been idle too long |
| `cost-tracker.js` | PostToolUse Agent | Silent ledger update; surfaced via `/cost` |
| `token-budget.js` | PostToolUse Agent | Silent budget update; surfaced via budget-footer regime |
| `session-start.js` | SessionStart | Reminder with progress log, next feature, learned-rules, core-memory |
| `compaction-stage.js` | PreCompact | Stage-based summarizer dispatch; never blocks |
| `ralph-loop.js` | Stop | Blocks Stop when features are still passes:false. Note: exits with `decision: block` not exit 2. Not a hard-block per this taxonomy — it's a *loop control* that the model always overcomes eventually by completing the work. Classified advisory-plus-loop-control. |

**Total:** 12 hard-block + 8 self-correct + 5 review-focus + 9 advisory = 34 rows. (Some hooks show up in more than one row above because they fire on multiple events.)

## Waiver mechanism

An override to a `hard-block` fires when:

1. A waiver exists in `specs/reviews/sensor-waivers.json` matching `{ sensor, subject, granted_by }`
2. `expires_at` is in the future
3. The hook consults `scripts/check-waiver.js` before blocking

**Schema:** [`templates/sensor-waivers.schema.json`](../templates/sensor-waivers.schema.json).

**Helper:** [`scripts/check-waiver.js`](../scripts/check-waiver.js). Called by any hard-block hook that wants waiver support.

**Reference wiring:** [`hooks/pre-bash-gate.js`](../hooks/pre-bash-gate.js) consults `check-waiver.js` before blocking. The other 11 hard-block hooks in the table above are NOT yet wired to check waivers — that's mechanical work deferred to future increments. When they're wired, the pattern is the same: call `checkWaiver(hookName, subject, cwd)`, honor `waived:true`, append an audit line.

**Waiver granularity:** `subject` is a hook-specific string. For `pre-bash-gate`, it's the target file path. For `detect-secrets`, it might be a file:line. Each hook documents its subject format in its head comment.

**Audit trail:** every honored waiver emits a stderr line `WAIVED (<sensor>): <subject> — <reason> [granted by <granter> until <expiry>]` for the human to notice.

## Guidance for new hooks

Before adding a hook:

1. Decide the level up front. If you can't, that's a smell — the hook probably has two responsibilities.
2. Document the classification here in the same commit as the hook.
3. `hard-block` hooks MUST support waivers via `check-waiver.js`.
4. `advisory` hooks MUST emit `hookSpecificOutput.additionalContext`, not `decision: block`.
5. `review-focus` hooks MUST write to a durable path under `specs/reviews/` or `.claude/state/`, not to `additionalContext`.

## Not covered in v3.2.3

- Waiver wiring for the 11 other hard-block hooks — deferred. `pre-bash-gate` is the reference implementation; the rest is mechanical.
- Automated expiry pruning (`scripts/check-waiver.js` currently just returns `waived:false` for expired entries; a maintenance job to remove expired entries from `sensor-waivers.json` is a future item).
- Cross-project waiver propagation (waivers are per-project; sharing them via `learnings/` is deferred).
