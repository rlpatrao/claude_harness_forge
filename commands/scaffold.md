---
name: scaffold
description: Initialize a new project with the Claude Harness Forge scaffold.
---

# /scaffold — Project Initialization

When the user runs this command, follow these steps exactly:

## Step 1: Gather Project Info

Ask the user these questions (one at a time):

1. "What are you building?" (brief description for CLAUDE.md)
2. "What type of project is this?" (for UI standards and calibration):
   - A) Consumer-facing SaaS app (high UI standards bar)
   - B) Enterprise / internal tool (functional focus, desktop-only)
   - C) API-only / backend service (no UI review)
3. "Install complementary Claude Code plugins?" (recommended: Yes)

   **Recommended (safe, no forge conflict):**

   *Utilities:*
   - `commit-commands` — `/commit`, `/commit-push-pr` git workflows
   - `playground` — Interactive HTML playgrounds with live preview
   - `context7` — Documentation lookup
   - `greptile` — Codebase semantic search

   *Language servers (install for your stack):*
   - `pyright-lsp` — Python type checking
   - `gopls-lsp` — Go
   - `rust-analyzer-lsp` — Rust
   - `jdtls-lsp` — Java
   - `kotlin-lsp` — Kotlin
   - `clangd-lsp` — C/C++
   - `ruby-lsp` — Ruby
   - `php-lsp` — PHP
   - `lua-lsp` — Lua
   - `csharp-lsp` — C#

   *Service integrations (install if you use them):*
   - `firebase` — Firestore, Auth, Cloud Functions, Hosting, Storage, Crashlytics
   - `stripe` — Payment processing, /explain-error, /test-cards, best practices
   - `supabase` — Backend-as-a-service (auth, DB, storage, edge functions)
   - `terraform` — Infrastructure-as-code

   *Project management / messaging (install if you use them):*
   - `linear` — Issue tracking
   - `asana` — Project management
   - `github` — Enhanced GitHub integration (issues, PRs, repos)
   - `gitlab` — GitLab integration
   - `slack` — Slack messaging
   - `discord` — Discord messaging

   *Other:*
   - `agent-sdk-dev` — Agent SDK project scaffolding
   - `plugin-dev` — Plugin authoring toolkit
   - `laravel-boost` — Laravel PHP framework helpers

   Options:
   - A) Install recommended utilities + pick service integrations
   - B) Let me pick from the full list
   - C) No, skip plugins

**NOTE:** Stack, deployment, and verification mode questions are NOT asked here. They are deferred to the `/architect` phase (Phase 2 of the pipeline), where the architect agent has BRD context and can make informed challenges about technology choices.

## Step 2: Generate skeleton project-manifest.json

Write `project-manifest.json` to the project root with populated project info and null stack fields:

```json
{
  "name": "{from description}",
  "description": "{from description}",
  "project_type": "{saas | enterprise | api-only}",
  "stack": {
    "backend": null,
    "frontend": null,
    "database": null,
    "deployment": null
  },
  "evaluation": {
    "api_base_url": null,
    "ui_base_url": null,
    "health_check": null
  },
  "execution": {
    "default_mode": "full",
    "max_self_heal_attempts": 3,
    "max_auto_iterations": 50,
    "coverage_threshold": 80,
    "session_chaining": true,
    "agent_team_size": "auto",
    "teammate_model": "sonnet"
  },
  "verification": {
    "mode": null
  }
}
```

The `stack`, `evaluation`, and `verification` sections are filled in by the architect agent after the BRD is approved.

## Step 3: Generate calibration-profile.json

Based on project type (question 2):

**If Consumer-facing SaaS (A):**
```json
{
  "project_type": "saas",
  "ui_standards": {
    "responsive_required": true,
    "mobile_breakpoint": 375,
    "desktop_breakpoint": 1280,
    "wcag_level": "AA",
    "min_touch_target": 44,
    "spacing_grid": 8,
    "empty_states_required": true,
    "error_pages_required": true
  }
}
```

**If Enterprise / internal tool (B):**
```json
{
  "project_type": "enterprise",
  "ui_standards": {
    "responsive_required": false,
    "mobile_breakpoint": null,
    "desktop_breakpoint": 1280,
    "wcag_level": "AA",
    "min_touch_target": null,
    "spacing_grid": 8,
    "empty_states_required": false,
    "error_pages_required": true
  }
}
```

**If API-only (C):**
```json
{
  "project_type": "api-only",
  "ui_standards": null
}
```

## Step 4: Copy Scaffold Files

Copy from plugin source (`$CLAUDE_PLUGIN_DIR` or detect from this file's location):

```bash
cp -r $PLUGIN_SOURCE/agents/ .claude/agents/
cp -r $PLUGIN_SOURCE/skills/ .claude/skills/
cp -r $PLUGIN_SOURCE/hooks/ .claude/hooks/
cp -r $PLUGIN_SOURCE/state/ .claude/state/
cp -r $PLUGIN_SOURCE/templates/ .claude/templates/
cp -r $PLUGIN_SOURCE/evals/ .claude/evals/
cp $PLUGIN_SOURCE/architecture.md .claude/architecture.md
cp $PLUGIN_SOURCE/program.md .claude/program.md
cp $PLUGIN_SOURCE/settings.json .claude/settings.json
```

## Step 5: Install Plugins (based on question 3)

**If option A (recommended utilities + selected integrations):**

Always install these utilities:
```json
"enabledPlugins": {
  "commit-commands@claude-plugins-official": true,
  "playground@claude-plugins-official": true,
  "context7@claude-plugins-official": true,
  "greptile@claude-plugins-official": true
}
```

Then ask: "Which service integrations do you need?" and add the selected ones:
```json
  "firebase@claude-plugins-official": true,
  "stripe@claude-plugins-official": true,
  "supabase@claude-plugins-official": true,
  "terraform@claude-plugins-official": true,
  "linear@claude-plugins-official": true,
  "asana@claude-plugins-official": true,
  "github@claude-plugins-official": true,
  "gitlab@claude-plugins-official": true,
  "slack@claude-plugins-official": true,
  "discord@claude-plugins-official": true
```

Then ask: "Which language server do you want?" (auto-detect from stack if architect has run):
```json
  "pyright-lsp@claude-plugins-official": true,
  "gopls-lsp@claude-plugins-official": true,
  "rust-analyzer-lsp@claude-plugins-official": true,
  "jdtls-lsp@claude-plugins-official": true,
  "kotlin-lsp@claude-plugins-official": true,
  "clangd-lsp@claude-plugins-official": true,
  "ruby-lsp@claude-plugins-official": true,
  "php-lsp@claude-plugins-official": true,
  "lua-lsp@claude-plugins-official": true,
  "csharp-lsp@claude-plugins-official": true
```

**If option B:** Show the full list above and let user pick any combination.

**If option C:** Skip plugin installation entirely.

**Do NOT install** these (conflict with forge):
- `feature-dev` — competes with forge's BRD → architect → spec → design pipeline
- `frontend-design` — competes with forge's ui-designer + ui-standards-reviewer agents
- `hookify` — dynamically generated hooks could collide with forge's 14 hooks
- `code-review` — duplicates forge's code-reviewer agent (produces competing review feedback)
- `pr-review-toolkit` — same overlap as code-review

**Install with caution** (partial overlap — warn user):
- `security-guidance` — overlaps with forge's security-reviewer agent + detect-secrets hook. Install only if you want real-time edit-time security checks in addition to gate-level review.
- `code-simplifier` — overlaps with forge's /refactor skill. Install only if you want automatic simplification suggestions outside the refactor workflow.
- `playwright` (external) — could interfere with forge's evaluator browser checks. Only install if you need standalone Playwright outside the forge's evaluation system.

## Step 6: Generate CLAUDE.md

Write a slim table of contents tailored to the project. See the CLAUDE.md Template section below.

## Step 7: Create Output Directories

```bash
mkdir -p specs/brd/features specs/stories specs/design/mockups specs/design/amendments
mkdir -p specs/reviews specs/test_artefacts sprint-contracts e2e
```

## Step 8: Initialize State Files

```bash
echo '0' > .claude/state/coverage-baseline.txt
echo '[]' > .claude/state/cost-log.json
echo '{}' > .claude/state/eval-scores.json
```

Write `claude-progress.txt`:
```
=== Session 0 ===
date: {ISO 8601 now}
mode: full
groups_completed: []
groups_remaining: []
current_group: none
current_stories: []
sprint_contract: none
last_commit: none
features_passing: 0 / 0
coverage: 0%
learned_rules: 0
blocked_stories: none
next_action: Run /brd to start
```

Write `.claude/state/iteration-log.md`:
```markdown
# Iteration Log

Tracking all autonomous build iterations.
```

Write `.claude/state/learned-rules.md`:
```markdown
# Learned Rules

Rules extracted from failure patterns during autonomous build.
```

Write `.claude/state/failures.md`:
```markdown
# Failures

Raw failure data for pattern extraction.
```

## Step 9: Initialize Learnings Folder

```bash
mkdir -p .claude/learnings/stack-decisions
mkdir -p .claude/learnings/failure-patterns
mkdir -p .claude/learnings/integration-notes
```

If the forge repo has existing learnings (from prior projects), copy them:
```bash
if [ -d "$PLUGIN_SOURCE/../learnings/stack-decisions" ] && [ "$(ls -A $PLUGIN_SOURCE/../learnings/stack-decisions)" ]; then
  cp -r $PLUGIN_SOURCE/../learnings/ .claude/learnings/
fi
```

Otherwise, create empty index files:
```bash
# Only if not copied from forge
[ ! -f .claude/learnings/stack-decisions/_index.md ] && echo "# Stack Decisions Index\n\n| Project | Type | Stack | Date | Key Learning |\n|---------|------|-------|------|-------------|" > .claude/learnings/stack-decisions/_index.md
[ ! -f .claude/learnings/failure-patterns/common-failures.md ] && echo "# Common Failure Patterns\n\n*(No patterns yet)*" > .claude/learnings/failure-patterns/common-failures.md
```

## Step 10: Initialize Git

```bash
git init
```

Write `.gitignore`:
```
.env
.env.local
.env.production
node_modules/
__pycache__/
*.pyc
.coverage
htmlcov/
dist/
build/
.venv/
*.egg-info/
.mypy_cache/
.ruff_cache/
playwright-report/
test-results/
```

## Step 11: Report

Print:
```
✓ Claude Harness Forge scaffolded successfully.

Installed:
  10 agents     → .claude/agents/
  23 skills     → .claude/skills/
  14 hooks      → .claude/hooks/
  9 templates   → .claude/templates/
  4 evals       → .claude/evals/
  6 state files → .claude/state/

Project type: {type}
Stack decisions: Deferred to /architect (run after /brd)

Next steps:
  1. Run /brd to create your Business Requirements Document
  2. Run /architect to make stack decisions (informed by your BRD)
  3. Or run /build to execute the full 9-phase pipeline
```

---

## CLAUDE.md Template

```markdown
# {project-name}

{description from user input}

## Quick Reference

**Pipeline:** `/brd` → `/architect` → `/spec` → `/design` → `/build` → autonomous loop
**Status:** `claude-progress.txt` | **Steer:** `.claude/program.md`

## Architecture

Strict layered architecture: Types → Config → Repository → Service → API → UI.
One-way dependencies only. See `.claude/architecture.md` for full rules.

## Where to Find Things

| What | Where |
|------|-------|
| Architecture rules | `.claude/architecture.md` |
| Quality principles | `.claude/skills/code-gen/SKILL.md` |
| Testing patterns | `.claude/skills/testing/SKILL.md` |
| Sprint contract format | `.claude/skills/evaluation/references/contract-schema.json` |
| UI standards checklist | `.claude/skills/evaluation/references/ui-standards-checklist.md` |
| Human control knobs | `.claude/program.md` |
| Session recovery | `claude-progress.txt` |
| Feature tracking | `features.json` |
| Learned rules | `.claude/state/learned-rules.md` |
| Cost estimates | `.claude/state/cost-log.json` (or run `/cost`) |
| Stack learnings | `.claude/learnings/stack-decisions/` |

## Agents (10)

| Agent | Role | Model |
|-------|------|-------|
| brd-creator | Socratic BRD interview | Sonnet |
| architect | Stack interrogation + design artifacts | Opus |
| spec-writer | BRD → stories + dependency graph | Sonnet |
| generator | Code + tests, agent teams, sprint contracts | Sonnet |
| evaluator | 3-layer verification + browser console capture | Opus |
| ui-standards-reviewer | SaaS/enterprise conformance checklist | Sonnet |
| code-reviewer | Quality, architecture, story traceability | Sonnet |
| security-reviewer | OWASP top 10, injection, auth, secrets | Sonnet |
| test-engineer | Test plans, cases, Playwright E2E | Sonnet |
| ui-designer | React+Tailwind mockups | Sonnet |

## Ratchet Gates (8)

| Gate | Full | Lean | Solo | Turbo |
|------|------|------|------|-------|
| 1. Unit tests | ✓ | ✓ | ✓ | Per commit |
| 2. Lint + types | ✓ | ✓ | ✓ | Per commit |
| 3. Coverage ≥ baseline | ✓ | ✓ | ✓ | Per commit |
| 4. Architecture checks | ✓ | ✓ | — | End only |
| 5. Evaluator (API + Playwright + Console) | ✓ | ✓ | — | End only |
| 6. Code reviewer | ✓ | ✓ | — | End only |
| 7. UI standards review | ✓ | — | — | End only |
| 8. Security reviewer | ✓ | — | — | End only |

## Git Workflow

Branch: `<type>/<short-description>` (feat/, fix/, refactor/, test/, docs/)
Commits: conventional commits
```
