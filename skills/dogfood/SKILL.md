---
name: dogfood
description: Autonomous self-testing of the forge. Creates a test project, runs the full 12-phase pipeline, self-heals on failures, fixes forge bugs when found, and produces a dogfooding report.
argument-hint: "[prompt] [--type crud|ml|agentic] [--mode full|lean|solo]"
---

# /dogfood — Autonomous Self-Testing

Run the forge's own pipeline against a real test project to find and fix bugs in the forge itself. This is not a test of the generated app — it's a test of the forge's skills, agents, hooks, and gates.

## Usage

```
/dogfood "Build a fraud detection SaaS" --type agentic --mode full
/dogfood "Build a task manager" --type crud --mode lean
/dogfood  # Uses default: agentic fraud detection, full mode
```

## How It Works

The dogfood skill operates in two nested loops:

```
OUTER LOOP (forge-level):
  1. Scaffold test project
  2. Run full /build pipeline (inner loop)
  3. On forge-level failure → fix the forge → re-scaffold → retry
  4. On success → run all validation scripts
  5. Produce dogfooding report

INNER LOOP (project-level — the normal /auto loop):
  For each group A through F:
    1. Negotiate sprint contract
    2. Spawn agent team to implement stories
    3. Run 11-gate ratchet
    4. On gate failure → self-heal (fix project code, retry up to 3x)
    5. On pass → mark features, advance to next group
```

The key difference from a normal `/build`: when a failure is caused by the **forge itself** (bad skill instruction, broken hook, missing template, wrong gate logic), the dogfood skill fixes the forge source code, re-copies the fix into the test project's `.claude/`, and retries.

## Failure Classification

Every failure is classified as **forge-level** or **project-level**:

| Signal | Classification | Action |
|--------|---------------|--------|
| Validation script fails (validate-scaffold.sh) | **Forge** | Fix validation script or scaffold command |
| Hook crashes with JS error | **Forge** | Fix the hook |
| Skill references non-existent file or template | **Forge** | Fix the skill or create the missing file |
| Gate checks wrong path (e.g., /src/ vs /app/) | **Forge** | Fix the gate logic |
| features.json has wrong format | **Forge** | Fix spec skill's format instructions |
| Agent produces invalid output format | **Forge** | Fix agent definition or skill prompt |
| Generated code has syntax errors | **Project** | Self-heal via generator (normal auto loop) |
| Generated code fails tests | **Project** | Self-heal via generator |
| Architecture violation in generated code | **Project** | Self-heal via generator |
| Compliance check fails (missing fairness metrics) | **Project** | Self-heal via generator |

## Steps

### Step 1 — Create Test Project

```bash
mkdir -p test-projects/{project-name}
```

The test project lives inside the forge repo (gitignored via `test-projects/` in `.gitignore`).

### Step 2 — Scaffold

Follow `/scaffold` steps exactly against the test project. Run `validate-scaffold.sh` immediately after.

If validation fails: **this is a forge bug**. Read the failure, fix the forge source, re-scaffold, re-validate. Log the issue.

### Step 3 — Write project-manifest.json

Based on the `--type` flag:
- `crud`: Standard manifest, no ai_native section
- `ml`: Add `ai_native.type: "ml"`, `compliance.model_card_required: true`, `compliance.fairness_metrics: true`
- `agentic`: Add `ai_native.type: "agentic"`, `ai_native.framework: "langgraph"`, full compliance + security sections

### Step 4 — Run Full /build Pipeline

Execute all 12 phases sequentially. At each phase:

1. Run the phase
2. Verify the expected outputs exist
3. If outputs are missing or malformed: classify as forge or project issue
4. If forge issue: fix, re-run phase
5. If project issue: normal self-healing (auto loop handles this)

**Phase-specific verification:**

| Phase | Expected Outputs | Forge Issue If |
|-------|-----------------|----------------|
| 1. BRD | `specs/brd/app_spec.md` + feature specs | Template missing or malformed |
| 2. Architect | `specs/design/*.md` + manifest updated | Architect skill missing round, design artifact template broken |
| 3. Spec | `specs/stories/E*.md` or `{G}-*.md` + `features.json` (array) | features.json is dict, stories missing acceptance criteria |
| 4. Design | `specs/design/mockups/*.html` | Mockup template broken |
| 5. State init | All state files exist | Scaffold missing state file |
| 6. Observe | `backend/*/telemetry.py`, `monitoring/*` | OTel template broken |
| 7. Comply | `docs/model-card.md`, compliance docs | Compliance skill or template broken |
| 8-11. Auto | Code generated, gates pass | Hook crashes, gate logic wrong, skill instructions ambiguous |
| 12. Post-build | Learnings written, model card complete | Learnings skill broken |

### Step 5 — Run All Groups (The Auto Loop)

For each group A through F:

1. Read stories for the group from `features.json`
2. Read design artifacts (component-map, folder-structure, api-contracts)
3. **Implement all stories in the group** — write actual production code following:
   - Layered architecture (7-layer if agentic, 6-layer if traditional)
   - Quality principles from code-gen/SKILL.md
   - Learned rules from state/learned-rules.md
4. **Run all 11 gates** (adjusted by mode):
   - Gate 1: Syntax check (ast.parse for Python, tsc for TypeScript)
   - Gate 2: Lint (ruff, eslint)
   - Gate 3: Coverage >= baseline
   - Gate 4: Architecture (layered imports, file existence)
   - Gate 5: Evaluator (API + Playwright + browser console) — skip if no running app
   - Gate 6: Code reviewer
   - Gate 7: UI standards
   - Gate 8: Security (OWASP Web + Agentic)
   - Gate 9: Mutation testing (if mutmut/Stryker available)
   - Gate 10: Compliance (ML/agentic projects only)
   - Gate 11: Spec gaming detection (always)
5. **On gate failure:**
   - Classify as forge or project issue
   - If forge: fix forge source, re-copy to `.claude/`, log issue, retry gate
   - If project: self-heal (modify generated code, retry up to 3x)
   - After 3 project failures: mark group BLOCKED, log learned rule, move to next group
6. **On gate pass:** Update features.json, update claude-progress.txt, commit, move to next group

### Step 6 — Final Validation

After all groups complete (or are blocked):

```bash
bash scripts/validate-scaffold.sh     # Forge structure
bash scripts/validate-evals.sh        # Code reviewer regression
bash scripts/validate-compliance.sh   # ML/agentic compliance
```

### Step 7 — Produce Dogfooding Report

Write `test-projects/{project-name}/dogfood-report.md`:

```markdown
# Dogfooding Report

## Project: {name}
Type: {type} | Mode: {mode} | Date: {ISO 8601}

## Pipeline Results
| Phase | Status | Output | Issues Found |
|-------|--------|--------|-------------|
| 1. BRD | PASS/FAIL | {line count, feature count} | {forge issues} |
| ... | | | |

## Gate Results (per group)
| Group | Stories | Gate 1 | ... | Gate 11 | Status |
|-------|---------|--------|-----|---------|--------|

## Forge Issues Found and Fixed
| # | Issue | Category | Root Cause | Fix |
|---|-------|----------|------------|-----|

## Project Issues (self-healed)
| # | Issue | Gate | Self-Heal Attempts | Resolution |

## Compliance Summary
| Check | Result |

## Metrics
- Total files generated: {N}
- Total tests: {N}
- Coverage: {N}%
- Forge issues found: {N}
- Project self-heal cycles: {N}
- Groups completed: {N}/{total}
- Groups blocked: {N}
```

### Step 8 — Commit Forge Fixes

If any forge issues were found and fixed during the run:

```bash
cd {forge-root}
git add {fixed-files}
git commit -m "fix: {summary} (found during /dogfood)"
git push
```

## Gotchas

- **Don't stop to ask the human.** The whole point of dogfooding is autonomous execution. If something is ambiguous, make a decision, log it, and continue.
- **Fix the forge, not just the test project.** If a hook crashes, don't work around it — fix the hook.
- **Re-scaffold after forge fixes.** The test project has copies of forge files in `.claude/`. After fixing the forge source, copy the fix into the test project too.
- **Don't skip groups.** Even if a group fails, attempt all groups to find as many forge issues as possible.
- **Log everything.** The dogfood report is the primary output — it's the forge's test results.
- **Classify correctly.** A forge issue vs project issue distinction is critical. Forge issues get committed to the forge repo. Project issues are just self-healing data.
