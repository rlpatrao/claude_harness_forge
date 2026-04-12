# Self-Improving Findings Reporter

Automated, opt-in system that collects anonymized harness findings during builds and lets users review + submit them as GitHub issues to the forge repo.

## Problem

The forge improves through manual feedback — someone notices a pattern, opens an issue, a maintainer fixes it. This misses the vast majority of findings: gate failures, recurring patterns, hook violations, and learned rules that could inform forge improvements. Users don't report most of what they encounter.

## Solution

A passive collection hook + an active reporting skill that together create a structured feedback loop from every build back to the forge.

---

## Data Flow

```
Build Pipeline
  |
  +-- Gates produce findings --> specs/reviews/*.md, eval-failures-*.json
  +-- Hooks fire on violations --+
  |                              v
  |                  findings-collector.js (hook)
  |                      |
  |                      v
  |          .claude/state/harness-findings-log.json
  |               (rolling structured log)
  |
  +-- At init: /build checks for unreported findings
  +-- At end:  /build calls /report-findings
  |                      |
  |                      v
  |          harness-findings.md (staging artifact)
  |               |
  |               v
  |          User reviews & confirms
  |               |
  |               v
  |          gh issue create --> forge repo
  |
  +-- Cleanup: mark findings as reported, delete staging file
```

---

## Consent & Configuration

### Opt-in at init

During `/build` Phase 5 (Initialize State) or `/scaffold`, the user is asked:

> "Would you like to help improve the forge? When enabled, the harness collects anonymized findings (no secrets, PII, or project code) and lets you review + submit them as GitHub issues. You always review everything before it's sent. Enable findings reporting?"

### Manifest config

Added to `project-manifest.json`:

```json
{
  "findings_reporting": {
    "enabled": false,
    "target_repo": "rlpatrao/claude-harness-forge",
    "categories": ["evaluator", "code-review", "security", "hooks", "learned-rules"],
    "last_reported": null
  }
}
```

- `enabled` — flipped to `true` on opt-in
- `target_repo` — defaults to the forge repo; configurable for forks
- `categories` — which finding types to collect; all by default
- `last_reported` — ISO timestamp of last successful report

---

## What Gets Collected vs. Excluded

### Collected (safe, anonymized)

| Category | What's captured | Example |
|----------|----------------|---------|
| Gate outcomes | Pass/fail per gate, failure category | "Gate 5 (evaluator): FAIL, api-layer, validation_error" |
| Error patterns | Error type + generic description | "type_error in API layer" (NOT the actual code) |
| Hook violations | Violation category + frequency | "check-architecture: 3 violations" |
| Learned rules | The rule text itself | "Always seed DB before API tests" |
| GAN iterations | Retry count per group | "Group B: 4 iterations to pass" |
| Stack metadata | Tech stack from manifest | "Python/FastAPI + React/TypeScript" |
| Build mode | Which mode was used | "Full mode" |
| Forge version | Git SHA of the forge plugin | "f2812ae" |

### Never collected

| Exclusion | Why |
|-----------|-----|
| Source code, diffs, file contents | Project IP |
| Environment variables, secrets, API keys | Security |
| PII (names, emails, IPs) | Privacy |
| File paths within user's project | Could reveal project structure |
| Business logic, domain data | Project IP |
| Git history, commit messages | Could contain sensitive context |
| Project name or repo URL | Privacy |

### Sanitization

Before generating the report, all content is passed through the same detection patterns used by `detect-secrets.js` and `pii-scan.js`. Any match is redacted with `[REDACTED]`.

---

## `/report-findings` Skill

### Steps

1. **Check consent** — read `project-manifest.json`. If `findings_reporting.enabled` is `false`, print "Findings reporting is disabled. Enable with `/report-findings --enable`" and exit.
2. **Read findings log** — load `.claude/state/harness-findings-log.json`.
3. **Filter unreported** — select entries where `reported: false` (or after `last_reported` timestamp).
4. **Sanitize** — strip PII/secrets using `detect-secrets` and `pii-scan` patterns.
5. **Generate report** — write `harness-findings.md` with sections per category.
6. **Show to user** — display the full content. Ask: "This will be submitted as a GitHub issue to {target_repo}. Confirm, edit, or cancel?"
7. **On confirm** — run `gh issue create --repo {target_repo} --title "Harness Findings: {stack_type} {date}" --body-file harness-findings.md --label "harness-finding"`.
8. **Update state** — set `last_reported` in manifest, mark entries as `reported: true`.
9. **Cleanup** — delete `harness-findings.md` (staging artifact).

### Flags

- `/report-findings` — normal flow (collect, review, submit)
- `/report-findings --enable` — enable findings reporting
- `/report-findings --disable` — disable findings reporting
- `/report-findings --dry-run` — generate report but don't submit

### Report format (`harness-findings.md`)

```markdown
## Harness Findings Report

**Forge version:** {git_sha}
**Stack:** {stack_type}
**Mode:** {build_mode}
**Date:** {ISO date}

### Gate Outcomes
| Gate | Result | Failure Type | Iterations |
|------|--------|-------------|------------|
| ...  | ...    | ...         | ...        |

### Recurring Patterns
- {pattern description} (occurred {n} times)

### Hook Violations
| Hook | Category | Count |
|------|----------|-------|
| ...  | ...      | ...   |

### Learned Rules Created
- {rule text}

### Suggestions
- {any auto-detected improvement suggestions}
```

---

## `findings-collector.js` Hook

### Trigger

- `TaskCompleted` — after each task completes, check for new review artifacts
- `PostToolUse[Bash]` — when `git commit` succeeds, capture gate pass/fail state

### Behavior

1. Check if `findings_reporting.enabled` in manifest. If not, exit 0 immediately.
2. Read context (task result or hook violation details).
3. Append structured entry to `.claude/state/harness-findings-log.json`:

```json
{
  "timestamp": "2026-04-12T10:30:00Z",
  "category": "evaluator",
  "gate": "api-layer",
  "outcome": "fail",
  "error_type": "validation_error",
  "pattern": "Response schema mismatch on health endpoint",
  "iterations_to_fix": 2,
  "stack_type": "python-fastapi",
  "forge_version": "f2812ae",
  "reported": false
}
```

4. Exit 0 (never blocks the pipeline).

### Entry schema

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO) | When the finding occurred |
| `category` | enum | `evaluator`, `code-review`, `security`, `hooks`, `learned-rules` |
| `gate` | string | Which gate or hook produced it |
| `outcome` | enum | `pass`, `fail`, `warn` |
| `error_type` | string | Generic error classification |
| `pattern` | string | Human-readable pattern description (sanitized) |
| `iterations_to_fix` | number | How many GAN cycles to resolve (0 if first pass) |
| `stack_type` | string | From manifest |
| `forge_version` | string | Git SHA of forge |
| `reported` | boolean | Whether this has been submitted |

---

## Integration Points

| Where | When | What happens |
|-------|------|-------------|
| `/scaffold` | During scaffolding | Ask consent question, set initial config in manifest |
| `/build` Phase 5 | Init | Ask consent if not yet set. Check for unreported findings from prior session, offer to report. |
| `/build` Phase 12 | Post-build | Call `/report-findings` |
| `/auto` | End of autonomous loop | Prompt: "Build complete. Report findings to forge?" |
| `settings.json` | Always | Register `findings-collector.js` hook |

---

## User Communication

The forge CLAUDE.md and scaffold output should clearly explain:

1. What findings reporting is
2. That it's opt-in
3. Exactly what is and isn't collected
4. That they review everything before submission
5. How to disable it

This should be visible in the scaffolded project's CLAUDE.md under a "Findings Reporting" section.

---

## New Files

| File | Type | Description |
|------|------|-------------|
| `skills/report-findings/SKILL.md` | Execution skill | Review + submit findings |
| `hooks/findings-collector.js` | Hook | Passive findings collection |
| `state/harness-findings-log.json` | State template | Empty array `[]` |
| `templates/harness-findings.template.md` | Template | Report format |

## Modified Files

| File | Change |
|------|--------|
| `settings.json` | Add findings-collector hook registration |
| `commands/scaffold.md` | Add findings reporting to scaffold manifest |
| `skills/build/SKILL.md` | Add consent question at Phase 5, report call at Phase 12 |
| `skills/auto/SKILL.md` | Add report prompt at end of loop |
| `CLAUDE.md` | Update skill count, add findings reporting section |

---

## Security Considerations

- **No secrets in transit** — sanitization runs before report generation, not just before submission
- **No auto-submission** — user MUST confirm every report
- **gh auth required** — if `gh` is not authenticated, skill prints instructions and exits gracefully
- **Fork-friendly** — `target_repo` is configurable; forks can point to their own repo
- **Idempotent** — duplicate submissions are prevented by `last_reported` timestamp
