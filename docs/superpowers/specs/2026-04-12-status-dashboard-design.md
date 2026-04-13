# Status Dashboard — Terminal-Based Project Tracker

A `/status` skill that generates a dashboard-style `specs/status.md` from existing data sources and prints it to terminal at every significant checkpoint. Emphasizes E2E verification status per story.

## Problem

During builds, there's no single view of project health. Progress is scattered across `features.json`, `iteration-log.md`, `coverage-baseline.txt`, `eval-failures-*.json`, and `claude-progress.txt`. You have to read 5+ files to answer "how far along are we and what's broken?"

## Solution

A `/status` skill that reads all existing data sources, generates a concise ASCII dashboard to `specs/status.md`, and prints it to terminal. Auto-triggered at every significant checkpoint in the build pipeline.

---

## Display Checkpoints

The status dashboard is automatically displayed at:

| Trigger | Where | When |
|---------|-------|------|
| Group completion | `/auto` | After each group passes or exhausts retries |
| Phase transition | `/build` | After each phase completes (BRD, Architect, Spec, Design, Auto) |
| Gate pass/fail | `/auto` | After ratchet gate verdict per group |
| On demand | `/status` | Anytime user invokes manually |
| Session start | `/auto` | When resuming from `claude-progress.txt` |

---

## Dashboard Layout

```
═══════════════════════════════════════════════════════════
 PROJECT STATUS — {project_name}       v{brd_version} | {mode} Mode
 Updated: {timestamp}                  Session: {n}
═══════════════════════════════════════════════════════════

 PIPELINE PROGRESS
 ─────────────────
 BRD {s} → Architect {s} → Spec {s} → Design {s} → Build [{current}]

 STORY STATUS
 ────────────
 Group │ Stories │ Spec'd │ Coded │ Unit ✓ │ E2E ✓ │ Status
 ──────┼─────────┼────────┼───────┼────────┼───────┼────────
   A   │    5    │  5/5   │  5/5  │  5/5   │  5/5  │ ✓ DONE
   B   │    4    │  4/4   │  4/4  │  4/4   │  3/4  │ ⚡ 1 FAIL
   C   │    6    │  6/6   │  3/6  │  2/6   │  0/6  │ ▸ ACTIVE
   D   │    3    │  3/3   │  0/3  │  0/3   │  0/3  │ ○ PENDING
 ──────┼─────────┼────────┼───────┼────────┼───────┼────────
 Total │   18    │ 18/18  │ 12/18 │ 11/18  │  8/18 │ 44% E2E ✓

 E2E VERIFICATION DETAIL
 ───────────────────────
 ✓ E1-S1  API health + login flow          (api+playwright)
 ✓ E1-S2  User CRUD endpoints              (api)
 ✗ E2-S3  Fraud alert dashboard            (playwright: button not clickable)
 ○ E3-S1  Transaction ingestion            (pending)

 QUALITY RATCHET
 ───────────────
 Coverage:    82% (baseline: 80%) ▲
 Mutations:   71% (baseline: 68%) ▲
 Arch violations: 0
 Learned rules:   4

 RECENT ACTIVITY (last 5)
 ────────────────────────
 #12  E2-S3  self-heal:playwright  FAIL  (attempt 2/3)
 #11  E2-S2  implement             PASS  1m30s
 #10  E2-S1  implement             PASS  2m12s
 #9   E1-S5  e2e                   PASS  0m45s
 #8   E1-S4  e2e                   PASS  0m38s

 BLOCKERS
 ────────
 ⚡ E2-S3: Playwright — submit button not clickable (2/3 attempts)
 ⏳ Group D: blocked by Group C

 BRD: v3 (2 changes since v1) | Cost: ~$45 (15% of budget)
═══════════════════════════════════════════════════════════
```

Status symbols: `✓` passed, `✗` failed, `▸` in progress, `○` pending, `⚡` failing, `⏳` blocked, `▲` improving, `▼` regressing

---

## Data Sources

All existing — no new data infrastructure required.

| Dashboard Section | Data Source | What's Read |
|-------------------|-----------|-------------|
| Header | `project-manifest.json` | Project name, mode |
| Header | `specs/brd/changelog.md` | BRD version |
| Header | `claude-progress.txt` | Session number |
| Pipeline progress | `claude-progress.txt` | Current phase/group |
| Story status — Spec'd | `specs/stories/E*-S*.md` | File existence = spec'd |
| Story status — Coded | `features.json` | `passes` is not null OR story files exist in `src/` |
| Story status — Unit ✓ | `iteration-log.md` | Action=implement with Result=PASS |
| Story status — E2E ✓ | `features.json` | `passes: true` |
| E2E detail | `features.json` | `failure_reason`, `failure_layer` |
| E2E detail | `specs/reviews/eval-failures-*.json` | Specific error details |
| Quality ratchet | `coverage-baseline.txt` | Current coverage |
| Quality ratchet | `mutation-baseline.txt` | Mutation score |
| Quality ratchet | `learned-rules.md` | Rule count |
| Recent activity | `iteration-log.md` | Last 5 entries |
| Blockers | `features.json` | Stories with `passes: false` |
| Blockers | `specs/stories/dependency-graph.md` | Blocked groups |
| Cost | `cost-log.json` | Estimated spend |

---

## Per-Story E2E Status Logic

A story's E2E verification status is derived from `features.json`:

| `passes` | `failure_layer` | E2E Status | Symbol |
|-----------|----------------|-----------|--------|
| `null` | — | Not yet verified | ○ |
| `true` | — | E2E passed | ✓ |
| `false` | `api` | API check failed | ✗ (api: {reason}) |
| `false` | `playwright` | Browser E2E failed | ✗ (playwright: {reason}) |
| `false` | `browser_console` | Console errors | ✗ (console: {reason}) |
| `false` | `network` | Network check failed | ✗ (network: {reason}) |
| `false` | `docker` | Container failed | ✗ (docker: {reason}) |
| `false` | `design` | Design check failed | ✗ (design: {reason}) |

E2E failures are the most visible item in the dashboard — they appear in both the story table summary AND the dedicated E2E detail section with the specific failure reason from `failure_reason`.

---

## `/status` Skill

### Usage

```
/status              # generate + display dashboard
/status --refresh    # regenerate from latest data (same as no flag)
/status --brief      # one-line summary only
```

### Steps

1. **Read data sources** — `features.json`, `claude-progress.txt`, `iteration-log.md`, `coverage-baseline.txt`, `mutation-baseline.txt`, `learned-rules.md`, `cost-log.json`, `specs/brd/changelog.md`, `project-manifest.json`, `specs/stories/dependency-graph.md`, `specs/reviews/eval-failures-*.json`
2. **Compute aggregates** — per-group counts (spec'd, coded, unit-tested, E2E-verified), overall percentages, blocker list
3. **Determine pipeline phase** — parse `claude-progress.txt` for current session's phase/group
4. **Generate `specs/status.md`** — write the dashboard using the ASCII layout
5. **Print to terminal** — display the full dashboard content

For `--brief`, output only:
```
Status: 8/18 E2E ✓ (44%) | Coverage: 82% | Group C in progress | 1 blocker
```

### Handling Missing Data

If data sources don't exist yet (early in the pipeline):
- No `features.json` → show "No stories yet — run /spec first"
- No `iteration-log.md` → skip Recent Activity section
- No `coverage-baseline.txt` → show "Coverage: —"
- No `cost-log.json` → show "Cost: —"
- No `changelog.md` → show "BRD: v1"

---

## Integration into Pipeline

### In `/auto` (after each group)

After the ratchet gate verdict for a group, before moving to the next group:
```
Run /status to update and display specs/status.md.
```

### In `/build` (after each phase)

After each human-approved phase (BRD, Architect, Spec, Design), and after /auto completes:
```
Run /status to update and display specs/status.md.
```

### In `/auto` (session resume)

When `/auto` resumes from `claude-progress.txt`, display status first so the user sees where things stand before the loop continues.

---

## New Files

| File | Type | Description |
|------|------|-------------|
| `skills/status/SKILL.md` | Execution skill | Generate and display dashboard |

## Modified Files

| File | Change |
|------|--------|
| `skills/auto/SKILL.md` | Add `/status` call after each group verdict and at session resume |
| `skills/build/SKILL.md` | Add `/status` call after each phase |
| `CLAUDE.md` | Update skill count |
| `commands/scaffold.md` | Add /status to skill list and scaffold summary |
| `scripts/validate-scaffold.sh` | Add status to skill check list |

---

## Gotchas

- **Don't block the pipeline on status generation.** If any data source is missing or unparseable, show what you can and skip what you can't. Never fail.
- **Keep the file short.** `specs/status.md` should be under 80 lines. Truncate recent activity and E2E detail if there are too many entries.
- **Print, don't ask.** Status display is informational — never prompt for input after showing status. Just show it and continue.
- **E2E is the headline metric.** The overall E2E pass percentage should be the most prominent number. This is the metric that proves the app actually works end-to-end, not just that tests pass in isolation.
