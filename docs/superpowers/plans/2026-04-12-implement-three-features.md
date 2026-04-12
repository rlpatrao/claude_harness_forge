# Implement Three Features: Findings Reporter, Change Management, Research

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all three design specs (findings reporter, change management, internet research), update validation scripts, and prove everything works by running validation.

**Architecture:** All changes are markdown skill files, JSON config, JS hooks, and state templates. No application code. Testing = validation script + reference integrity checks.

**Tech Stack:** Markdown, JSON, Node.js (hooks), Bash (validation)

---

### Task 1: Update Validation Script for New Skill Names + New Files

The validation script `scripts/validate-scaffold.sh` is the test harness. Update it to expect the new skill names and new files FIRST, so we can run it and see it fail, then make it pass.

**Files:**
- Modify: `scripts/validate-scaffold.sh:96-108` (forge mode skill list)
- Modify: `scripts/validate-scaffold.sh:221-227` (scaffolded project skill list)

- [ ] **Step 1: Update forge-mode skill list (lines 96-108)**

Replace the skill check loop with updated names. Remove `cost`, `spec-writing`, `architecture`, `testing`, `evaluation`, `compliance`. Add `spec-patterns`, `architect-patterns`, `test-patterns`, `evaluate-patterns`, `comply-patterns`, `report-findings`, `change`.

```bash
  for skill in auto brd spec design implement evaluate build review test \
               deploy fix-issue refactor improve lint-drift code-gen \
               spec-patterns architect-patterns ui-mockup test-patterns evaluate-patterns stack-learnings architect \
               observe comply rag workflow resilience model-card context-budget tenant \
               resilience-patterns rag-patterns agentic-ux comply-patterns context-engineering \
               report-findings change dogfood; do
    check_file "skills/$skill/SKILL.md"
  done
```

- [ ] **Step 2: Update scaffolded-project skill list (lines 221-227)**

Same rename in the scaffolded project section:

```bash
  for skill in auto brd spec design implement evaluate build review test \
               deploy fix-issue refactor improve lint-drift code-gen \
               spec-patterns architect-patterns ui-mockup test-patterns evaluate-patterns stack-learnings architect \
               observe comply rag workflow resilience model-card context-budget tenant \
               resilience-patterns rag-patterns agentic-ux comply-patterns context-engineering \
               report-findings change dogfood; do
    check_file ".claude/skills/$skill/SKILL.md"
  done
```

- [ ] **Step 3: Update expected skill count**

Lines 96-100 (forge mode): Change `>= 36` to `>= 38` (added report-findings + change, removed cost).
Lines 214-219 (scaffolded mode): Same change.

- [ ] **Step 4: Add state file checks for new files**

After line 158, add:
```bash
  check_file "state/harness-findings-log.json"
  check_file "state/changelog-template.md"
```

After line 299, add:
```bash
  check_file ".claude/state/harness-findings-log.json"
  check_file ".claude/state/changelog-template.md"
```

- [ ] **Step 5: Add hook check for findings-collector**

In the hook list (lines 114-118 and 233-237), add `findings-collector` to the list. Update hook count from 18 to 19 on lines 112 and 230.

- [ ] **Step 6: Add template check**

After line 129, add:
```bash
    check_file "templates/harness-findings.template.md"
```

- [ ] **Step 7: Run validation to see expected failures**

```bash
cd /Users/rlpatrao/workspace/claude_harness_forge && bash scripts/validate-scaffold.sh
```

Expected: FAIL for `skills/report-findings/SKILL.md`, `skills/change/SKILL.md`, `state/harness-findings-log.json`, `state/changelog-template.md`, `hooks/findings-collector.js`, `templates/harness-findings.template.md`.

- [ ] **Step 8: Commit**

```bash
git add scripts/validate-scaffold.sh
git commit -m "test: update validation script for renamed skills + 3 new features"
```

---

### Task 2: Create `/report-findings` Skill

**Files:**
- Create: `skills/report-findings/SKILL.md`

- [ ] **Step 1: Create the skill file**

See design spec at `docs/superpowers/specs/2026-04-12-self-improving-findings-reporter-design.md` for full content. The SKILL.md must include:

- Frontmatter: name `report-findings`, description about anonymized findings, argument-hint for flags
- Usage section with `--enable`, `--disable`, `--dry-run` flags
- 8 steps: check consent, read log, filter unreported, sanitize, generate report, show to user, submit via `gh issue create`, cleanup
- "What Gets Collected vs Excluded" table (safe categories vs never-collected list)
- Gotchas: never auto-submit, sanitize before display, graceful gh failure, idempotent

- [ ] **Step 2: Commit**

```bash
git add skills/report-findings/SKILL.md
git commit -m "feat: add /report-findings skill for self-improving feedback loop"
```

---

### Task 3: Create `findings-collector.js` Hook

**Files:**
- Create: `hooks/findings-collector.js`

- [ ] **Step 1: Create the hook file**

Node.js script that:
1. Reads `project-manifest.json` — exits 0 if `findings_reporting.enabled` is not true
2. Reads stdin for hook context JSON
3. Extracts a finding: timestamp, category, gate, outcome, error_type, pattern, iterations, stack_type, forge_version, reported=false
4. Only logs failures/warnings (passes are noise, except learned-rules)
5. Sanitizes patterns: strips API keys (`sk-*`, `ghp_*`, long base64), emails, IPs
6. Appends to `.claude/state/harness-findings-log.json`
7. Always exits 0 — never blocks the pipeline

Use `execFileSync` (not `exec`) for any subprocess calls to avoid shell injection.

- [ ] **Step 2: Commit**

```bash
git add hooks/findings-collector.js
git commit -m "feat: add findings-collector hook for passive finding capture"
```

---

### Task 4: Create State Templates + Report Template

**Files:**
- Create: `state/harness-findings-log.json`
- Create: `state/changelog-template.md`
- Create: `templates/harness-findings.template.md`

- [ ] **Step 1: Create `state/harness-findings-log.json`** — empty JSON array `[]`

- [ ] **Step 2: Create `state/changelog-template.md`** — BRD Changelog header with v1 initial entry placeholder

- [ ] **Step 3: Create `templates/harness-findings.template.md`** — Report template with sections: header (forge version, stack, mode, date), gate outcomes table, recurring patterns, hook violations table, learned rules, suggestions, footer with no-PII disclaimer

- [ ] **Step 4: Commit**

```bash
git add state/harness-findings-log.json state/changelog-template.md templates/harness-findings.template.md
git commit -m "feat: add state templates and report template for findings + changelog"
```

---

### Task 5: Create `/change` Skill

**Files:**
- Create: `skills/change/SKILL.md`

- [ ] **Step 1: Create the skill file**

See design spec at `docs/superpowers/specs/2026-04-12-change-management-and-research-design.md` for full content. The SKILL.md must include:

- Frontmatter: name `change`, description about BRD changelog and cascade, argument-hint
- Usage section (with description arg or interactive mode)
- 7 steps: capture change, identify affected BRD section, log to changelog, update BRD, impact analysis, execute cascade, staleness detection convention
- Cascade scope rules table (change type vs affected phases)
- Changelog format example
- Gotchas: log before cascade, partial cascades are normal, targeted re-runs, global version numbers

- [ ] **Step 2: Commit**

```bash
git add skills/change/SKILL.md
git commit -m "feat: add /change skill for BRD change management with cascade"
```

---

### Task 6: Add WebSearch/WebFetch to BRD Creator + Architect Agents

**Files:**
- Modify: `agents/brd-creator.md:4` (tools line)
- Modify: `agents/brd-creator.md` (add research section before Feasibility Gate)
- Modify: `agents/architect.md:5` (tools line)
- Modify: `agents/architect.md` (add research offering before Round 1)

- [ ] **Step 1: Add tools to brd-creator (line 4)**

Change `tools: [Read, Write, Glob, Grep, Bash]` to `tools: [Read, Write, Glob, Grep, Bash, WebSearch, WebFetch]`

- [ ] **Step 2: Add research detection section to brd-creator**

After UI Context interview dimension, before Feasibility Gate (A2), add a "Research Offering" section with:
- Triggers: domain mentions without specifics, vague quality attributes, emerging tech areas
- Offer prompt template
- If agreed: WebSearch 3-5 sources, WebFetch top 2-3, save to `specs/brd/research/{topic-slug}.md`, present summary
- Rules: max 3 rounds, user sees results first, additive not authoritative, never blocks

- [ ] **Step 3: Add tools to architect (line 5)**

Change `tools: [Read, Write, Glob, Grep, Bash]` to `tools: [Read, Write, Glob, Grep, Bash, WebSearch, WebFetch]`

- [ ] **Step 4: Add research offering to architect**

After Phase 2 header, before Round 1, add a "Research Offering" section with:
- Triggers: specialized DB workloads, ML frameworks, LLM providers, deployment platforms, emerging patterns
- Offer prompt template
- Same flow: search, fetch, save to `specs/brd/research/`, present comparison table
- Rules: max 2 rounds per interrogation round, never silently incorporate

- [ ] **Step 5: Commit**

```bash
git add agents/brd-creator.md agents/architect.md
git commit -m "feat: add WebSearch/WebFetch + proactive research to BRD and architect agents"
```

---

### Task 7: Update Build, Auto, Spec Skills + Spec-Writer Agent

**Files:**
- Modify: `skills/build/SKILL.md` (Phase 5 additions + Phase 12 addition)
- Modify: `skills/auto/SKILL.md` (SECTION 8 expansion + new SECTION 14)
- Modify: `skills/spec/SKILL.md` (BRD version reference)
- Modify: `agents/spec-writer.md` (BRD version in story template + staleness check)

- [ ] **Step 1: Add Phase 5b/5c/5d to /build** — changelog init, findings consent, unreported findings check

- [ ] **Step 2: Add Phase 12b to /build** — report findings call if enabled

- [ ] **Step 3: Add changelog integration to /auto SECTION 8** — when amendments detected, also log to changelog

- [ ] **Step 4: Add SECTION 14 to /auto** — post-build actions: report findings prompt + changelog summary

- [ ] **Step 5: Add BRD version passing to /spec** — pass current version to spec-writer agent

- [ ] **Step 6: Add BRD version to spec-writer story template** — new `BRD Version` field + staleness check rule

- [ ] **Step 7: Commit**

```bash
git add skills/build/SKILL.md skills/auto/SKILL.md skills/spec/SKILL.md agents/spec-writer.md
git commit -m "feat: integrate change tracking + findings reporting into build pipeline"
```

---

### Task 8: Update Settings, Scaffold, and CLAUDE.md

**Files:**
- Modify: `settings.json` (add findings-collector hook to TaskCompleted)
- Modify: `commands/scaffold.md` (add new files to manifest + reference table)
- Modify: `CLAUDE.md` (update counts + document new features)

- [ ] **Step 1: Add findings-collector to settings.json TaskCompleted hooks**

- [ ] **Step 2: Update scaffold manifest** — add `mkdir -p specs/brd/research`, add reference table entries for changelog, research, findings log

- [ ] **Step 3: Update CLAUDE.md** — skill count to 38 (27 task + 11 reference), hook count to 19, add key design decisions 8-10 (change management, internet research, self-improving feedback)

- [ ] **Step 4: Commit**

```bash
git add settings.json commands/scaffold.md CLAUDE.md
git commit -m "feat: update settings, scaffold manifest, and docs for three new features"
```

---

### Task 9: Run Validation and Prove

- [ ] **Step 1: Run forge self-validation**

```bash
cd /Users/rlpatrao/workspace/claude_harness_forge && bash scripts/validate-scaffold.sh
```

Expected: ALL PASS. Zero failures.

- [ ] **Step 2: Verify no broken references (old skill names gone)**

```bash
grep -rn "skills/architecture/\|skills/spec-writing/\|skills/testing/\|skills/evaluation/\|skills/compliance/\|skills/cost/" --include="*.md" --include="*.json" --include="*.js" .
```

Expected: Zero matches.

- [ ] **Step 3: Verify new skill frontmatter**

```bash
for skill in report-findings change; do
  echo "--- $skill ---"
  head -5 skills/$skill/SKILL.md
done
```

Expected: Valid frontmatter with name and description.

- [ ] **Step 4: Verify agent tool additions**

```bash
grep "tools:" agents/brd-creator.md agents/architect.md
```

Expected: Both include `WebSearch, WebFetch`.

- [ ] **Step 5: Verify hook registration**

```bash
grep "findings-collector" settings.json
```

Expected: One match in TaskCompleted section.

- [ ] **Step 6: Verify state templates and report template exist**

```bash
ls -la state/harness-findings-log.json state/changelog-template.md templates/harness-findings.template.md
```

Expected: All three files exist.
