# HARNESS — Registry

**Purpose:** enumerate every guide (feedforward) and sensor (feedback) in the forge, cross-cut by axis and cadence, so gaps are visible rather than hidden. Machine-readable twin: [`harness-manifest.json`](harness-manifest.json). Validator: [`scripts/validate-harness-manifest.js`](scripts/validate-harness-manifest.js) (runs in CI).

Adapted from [`cwijayasundara/claude_harness_eng_v5/HARNESS.md`](https://github.com/cwijayasundara/claude_harness_eng_v5/blob/main/HARNESS.md) per BRD v3.1 §4.

## Model

Every component is a row with:

| Field | Meaning |
|---|---|
| `id` | Slug-cased unique identifier |
| `kind` | `agent` \| `skill` \| `hook` \| `command` \| `script` \| `gate` \| `contract` \| `doc` |
| `name` | Short human name |
| `axis` | `maintainability` \| `architecture` \| `behaviour` \| `traceability` |
| `cadence` | `planning` \| `session` \| `commit` \| `integration` \| `drift` |
| `type` | `computational` \| `inferential` \| `hybrid` |
| `scope` | `forge` \| `scaffolded-project` \| `both` |
| `wired_at` | Repo-relative path where the component lives |
| `governs` | Optional glob list of paths whose behaviour this component enforces or observes |
| `status` | `active` \| `proposed` \| `deprecated` |
| `brd_ref` | BRD section that motivates this component |

## Axes (what quality dimension this touches)

- **Maintainability** — code that stays readable, testable, refactorable.
- **Architecture** — layer discipline, dependency direction, boundary integrity.
- **Behaviour** — the app does what the BRD says it does (functional correctness, E2E gates, spec-gaming).
- **Traceability** — you can walk backward from any commit / PR to its BRD requirement, spec gap, or instinct source.

## Cadences (when this component fires)

- **Planning** — before code (BRD, architect, spec, plan).
- **Session** — during an agent session (SessionStart, budget-footer, extended-react, compaction).
- **Commit** — at edit/write/commit time (pre-write, pre-bash, layer checks, secrets, git hooks).
- **Integration** — end of story/group/PR (evaluator, code-reviewer, security-reviewer, mutation).
- **Drift** — long-running or scheduled (upstream-watch, code-graph refresh, spec-backprop, findings-collector).

## Snapshot — v3.1 milestone (2026-06-11)

Full row-per-component listing lives in [`harness-manifest.json`](harness-manifest.json). Human-readable summary here.

### Planning cadence

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| brd-creator | agent | traceability | `agents/brd-creator.md` |
| architect | agent | architecture | `agents/architect.md` |
| planner | agent | architecture | `agents/planner.md` |
| spec-writer | agent | traceability | `agents/spec-writer.md` |
| scaffold-import | skill | traceability | `skills/scaffold-import/SKILL.md` |
| brd | skill | traceability | `skills/brd/SKILL.md` |
| architect | skill | architecture | `skills/architect/SKILL.md` |
| plan | command | traceability | `commands/plan.md` |

### Session cadence

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| session-start | hook | traceability | `hooks/session-start.js` |
| coding-agent | agent | behaviour | `agents/coding-agent.md` |
| budget-footer | hook | maintainability | `hooks/budget-footer.js` |
| extended-react | skill | behaviour | `skills/extended-react/SKILL.md` |
| compaction-stage | hook | maintainability | `hooks/compaction-stage.js` |
| reminder-injector | hook | behaviour | `hooks/reminder-injector.js` |
| ralph-loop | hook | behaviour | `hooks/ralph-loop.js` |
| token-budget | hook | maintainability | `hooks/token-budget.js` |
| cost-tracker | hook | maintainability | `hooks/cost-tracker.js` |

### Commit cadence

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| dangerous-patterns | hook | behaviour | `hooks/dangerous-patterns.js` |
| detect-secrets | hook | behaviour | `hooks/detect-secrets.js` |
| protect-env | hook | behaviour | `hooks/protect-env.js` |
| protect-pdfs | hook | behaviour | `hooks/protect-pdfs.js` |
| scope-directory | hook | architecture | `hooks/scope-directory.js` |
| lint-on-save | hook | maintainability | `hooks/lint-on-save.js` |
| typecheck | hook | maintainability | `hooks/typecheck.js` |
| check-architecture | hook | architecture | `hooks/check-architecture.js` |
| check-file-length | hook | maintainability | `hooks/check-file-length.js` |
| check-function-length | hook | maintainability | `hooks/check-function-length.js` |
| pre-commit-gate | hook | maintainability | `hooks/pre-commit-gate.js` |
| feature-edit-guard | hook | traceability | `hooks/feature-edit-guard.js` |
| e2e-gate | hook | behaviour | `hooks/e2e-gate.js` |
| prompt-injection-detect | hook | behaviour | `hooks/prompt-injection-detect.js` |
| pii-scan | hook | behaviour | `hooks/pii-scan.js` |
| pre-bash-gate | hook | behaviour | `hooks/pre-bash-gate.js` |
| concurrency-gate | hook | maintainability | `hooks/concurrency-gate.js` |

### Integration cadence

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| evaluator | agent | behaviour | `agents/evaluator.md` |
| e2e-runner | agent | behaviour | `agents/e2e-runner.md` |
| critic | agent | behaviour | `agents/critic.md` |
| code-reviewer | agent | maintainability | `agents/code-reviewer.md` |
| security-reviewer | agent | behaviour | `agents/security-reviewer.md` |
| ui-standards-reviewer | agent | maintainability | `agents/ui-standards-reviewer.md` |
| compliance-reviewer | agent | behaviour | `agents/compliance-reviewer.md` |
| test-engineer | agent | behaviour | `agents/test-engineer.md` |
| network-egress | hook | behaviour | `hooks/network-egress.js` |
| sprint-contract-gate | hook | traceability | `hooks/sprint-contract-gate.js` |

### Drift cadence

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| spec-auditor | agent | traceability | `agents/spec-auditor.md` |
| compactor | agent | maintainability | `agents/compactor.md` |
| doc-updater | agent | maintainability | `agents/doc-updater.md` |
| instinct-extractor | hook | maintainability | `hooks/instinct-extractor.js` |
| experiment-logger | hook | traceability | `hooks/experiment-logger.js` |
| task-completed | hook | traceability | `hooks/task-completed.js` |
| findings-collector | hook | maintainability | `hooks/findings-collector.js` |
| teammate-idle-check | hook | maintainability | `hooks/teammate-idle-check.js` |

### Contract & bridge

| Component | Kind | Axis | wired_at |
|---|---|---|---|
| feature_list.json | contract | traceability | `feature_list.json` |
| harness-progress.txt | contract | traceability | `harness-progress.txt` |
| config/workflows.yaml | contract | architecture | `config/workflows.yaml` |

## How to add a new component

1. Add a row to `harness-manifest.json` — fill every required field.
2. Add a summary row to the correct section above.
3. Run `node scripts/validate-harness-manifest.js` locally; CI runs it too.
4. If the component has a `governs` glob, `scripts/harness-coverage.js` (v3.1.9) will count files it covers.

## What's not yet covered

Gaps visible at v3.1 milestone:

- **Traceability × drift** — spec-backprop landed but living-canvas drift monitor didn't. See BRD v3.1 §3 v3.2 deferrals.
- **Architecture × drift** — no cycle-gate or bounded-contexts equivalent yet (external harness has both).
- **Behaviour × drift** — no `slo-check` (runtime SLO sensor). Deferred.
- **Maintainability × drift** — no `flake-detector`. Deferred to v3.2.

These are enumerable now; that's the point of the registry.
