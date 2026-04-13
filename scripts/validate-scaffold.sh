#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# validate-scaffold.sh — Level 1: Verify /scaffold produced all expected files
#
# Usage:
#   cd /path/to/scaffolded-project
#   bash /path/to/claude_harness_eng_v1/scripts/validate-scaffold.sh
# =============================================================================

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN  $1"; WARN=$((WARN + 1)); }

check_file() {
  if [ -f "$1" ]; then pass "$1"; else fail "$1 missing"; fi
}

check_dir() {
  if [ -d "$1" ]; then pass "$1/"; else fail "$1/ missing"; fi
}

check_file_count() {
  local dir="$1" pattern="$2" expected="$3" label="$4"
  local count
  count=$(find "$dir" -name "$pattern" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -ge "$expected" ]; then
    pass "$label: $count files (>= $expected)"
  else
    fail "$label: $count files (expected >= $expected)"
  fi
}

check_json_field() {
  local file="$1" field="$2" label="$3"
  if [ ! -f "$file" ]; then fail "$label: $file missing"; return; fi
  local value
  value=$(jq -r "$field" "$file" 2>/dev/null)
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    pass "$label: $field = $value"
  else
    fail "$label: $field not set in $file"
  fi
}

echo "============================================"
echo " Scaffold Validation"
echo " Project: $(pwd)"
echo " Date: $(date -Iseconds)"
echo "============================================"
echo ""

# --- Detect mode: forge repo (self-validation) vs scaffolded project ---
FORGE_MODE=false
if [ -d "agents" ] && [ -d "skills" ] && [ -d "hooks" ] && [ ! -d ".claude/agents" ]; then
  FORGE_MODE=true
  echo "MODE: Forge repo self-validation"
  echo ""
fi

if [ "$FORGE_MODE" = true ]; then
  # ===== FORGE REPO SELF-VALIDATION =====

  # --- 1. Core structure ---
  echo "--- Core Structure ---"
  check_dir "agents"
  check_dir "skills"
  check_dir "hooks"
  check_dir "state"
  check_dir "templates"
  check_dir "evals"
  check_dir "learnings"
  check_dir "scripts"
  check_dir "commands"
  check_dir ".claude-plugin"

  # --- 2. Agent definitions ---
  echo ""
  echo "--- Agents (expect 11) ---"
  check_file_count "agents" "*.md" 11 "Agent definitions"
  for agent in brd-creator architect spec-writer generator evaluator \
               ui-standards-reviewer code-reviewer security-reviewer \
               test-engineer ui-designer compliance-reviewer; do
    check_file "agents/$agent.md"
  done

  # --- 3. Skills ---
  echo ""
  echo "--- Skills (expect >= 40 SKILL.md) ---"
  skill_count=$(find skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$skill_count" -ge 40 ]; then
    pass "Skill definitions: $skill_count (>= 40)"
  else
    fail "Skill definitions: $skill_count (expected >= 40)"
  fi

  for skill in auto brd spec design implement evaluate build review test \
               deploy fix-issue refactor improve lint-drift code-gen \
               spec-patterns architect-patterns ui-mockup test-patterns evaluate-patterns stack-learnings architect \
               observe comply rag workflow resilience model-card context-budget tenant \
               resilience-patterns rag-patterns agentic-ux comply-patterns context-engineering \
               report-findings change dogfood status upgrade; do
    check_file "skills/$skill/SKILL.md"
  done

  # --- 4. Hooks ---
  echo ""
  echo "--- Hooks (expect 19) ---"
  check_file_count "hooks" "*.js" 19 "Hook scripts"
  for hook in scope-directory protect-env detect-secrets lint-on-save typecheck \
             check-architecture check-function-length check-file-length \
             protect-pdfs pre-commit-gate sprint-contract-gate \
             teammate-idle-check task-completed cost-tracker \
             token-budget prompt-injection-detect network-egress pii-scan findings-collector; do
    check_file "hooks/$hook.js"
  done

  # --- 5. Templates ---
  echo ""
  echo "--- Templates ---"
  for tpl in docker-compose.template.yml Dockerfile.backend.dev Dockerfile.frontend.dev \
             .env.example features-template.json features-template.example.json \
             sprint-contract.json playwright.config.template.ts init-sh.template; do
    check_file "templates/$tpl"
  done
    check_file "templates/harness-findings.template.md"

  # --- 6. Configuration ---
  echo ""
  echo "--- Configuration ---"
  check_file "settings.json"
  check_file "program.md"
  check_file "architecture.md"
  check_file "forge-reference.md"
  check_file "CLAUDE.md"
  check_file "README.md"
  check_file "commands/scaffold.md"
  check_file ".claude-plugin/plugin.json"

  # --- 7. Evals ---
  echo ""
  echo "--- Evals ---"
  check_file "evals/README.md"
  check_file "evals/expected.md"
  check_file_count "evals/samples" "*.ts" 4 "Eval samples"

  # --- 8. State files ---
  echo ""
  echo "--- State Files ---"
  check_file "state/learned-rules.md"
  check_file "state/failures.md"
  check_file "state/iteration-log.md"
  check_file "state/coverage-baseline.txt"
  check_file "state/cost-log.json"
  check_file "state/eval-scores.json"
  check_file "state/harness-findings-log.json"
  check_file "state/changelog-template.md"

  # --- 9. Learnings ---
  echo ""
  echo "--- Learnings ---"
  check_file "learnings/stack-decisions/_index.md"
  check_file "learnings/failure-patterns/common-failures.md"
  check_file "learnings/integration-notes/_template.md"

  # --- 10. Agent model_preference ---
  echo ""
  echo "--- Agent Model Preferences ---"
  for agent in agents/*.md; do
    name=$(basename "$agent")
    if grep -q "model_preference:" "$agent" 2>/dev/null; then
      tier=$(grep "model_preference:" "$agent" | head -1 | awk '{print $2}')
      pass "$name: model_preference=$tier"
    else
      fail "$name: missing model_preference"
    fi
  done

  # --- 11. Validation scripts ---
  echo ""
  echo "--- Validation Scripts ---"
  check_file "scripts/validate-scaffold.sh"
  check_file "scripts/validate-gan-loop.sh"
  check_file "scripts/validate-evals.sh"

else
  # ===== SCAFFOLDED PROJECT VALIDATION =====

  # --- 1. Core structure ---
  echo "--- Core Structure ---"
  check_dir ".claude"
  check_dir ".claude/agents"
  check_dir ".claude/skills"
  check_dir ".claude/hooks"
  check_dir ".claude/state"
  check_dir ".claude/templates"
  check_dir "specs"
  check_dir "sprint-contracts"

  # --- 2. Agent definitions ---
  echo ""
  echo "--- Agents (expect 11) ---"
  check_file_count ".claude/agents" "*.md" 11 "Agent definitions"
  for agent in brd-creator architect spec-writer generator evaluator \
               ui-standards-reviewer code-reviewer security-reviewer \
               test-engineer ui-designer compliance-reviewer; do
    check_file ".claude/agents/$agent.md"
  done

  # --- 3. Skills ---
  echo ""
  echo "--- Skills (expect >= 40 directories) ---"
  skill_count=$(find .claude/skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$skill_count" -ge 40 ]; then
    pass "Skill definitions: $skill_count (>= 40)"
  else
    fail "Skill definitions: $skill_count (expected >= 40)"
  fi

  for skill in auto brd spec design implement evaluate build review test \
               deploy fix-issue refactor improve lint-drift code-gen \
               spec-patterns architect-patterns ui-mockup test-patterns evaluate-patterns stack-learnings architect \
               observe comply rag workflow resilience model-card context-budget tenant \
               resilience-patterns rag-patterns agentic-ux comply-patterns context-engineering \
               report-findings change dogfood status upgrade; do
    check_file ".claude/skills/$skill/SKILL.md"
  done

  # --- 4. Hooks ---
  echo ""
  echo "--- Hooks (expect 19) ---"
  check_file_count ".claude/hooks" "*.js" 19 "Hook scripts"
  for hook in scope-directory protect-env detect-secrets lint-on-save typecheck \
             check-architecture check-function-length check-file-length \
             protect-pdfs pre-commit-gate sprint-contract-gate \
             teammate-idle-check task-completed cost-tracker \
             token-budget prompt-injection-detect network-egress pii-scan findings-collector; do
    check_file ".claude/hooks/$hook.js"
  done

  # --- 5. Configuration ---
  echo ""
  echo "--- Configuration ---"
  check_file ".claude/settings.json"
  check_file ".claude/program.md"
  check_file ".claude/architecture.md"
  check_file "project-manifest.json"
  check_file "CLAUDE.md"
  check_file "forge-reference.md"
  check_file "features.json"
  check_file "claude-progress.txt"
  check_file "init.sh"

  # --- 6. Settings.json structure ---
  echo ""
  echo "--- Settings Validation ---"
  if [ -f ".claude/settings.json" ]; then
    check_json_field ".claude/settings.json" '.hooks.PostToolUse[0].hooks | length' "PostToolUse hooks count"
  fi

  if jq -e '.enabledPlugins' .claude/settings.json >/dev/null 2>&1; then
    plugin_count=$(jq '.enabledPlugins | length' .claude/settings.json 2>/dev/null || echo 0)
    pass "Plugins configured: $plugin_count"

    # Check for conflicting plugins that should NOT be installed
    for bad_plugin in feature-dev hookify code-review pr-review-toolkit frontend-design; do
      if jq -e ".enabledPlugins[\"$bad_plugin@claude-plugins-official\"]" .claude/settings.json >/dev/null 2>&1; then
        fail "Conflicting plugin installed: $bad_plugin (conflicts with forge)"
      fi
    done
  else
    warn "No enabledPlugins block (plugins are optional)"
  fi

  # --- 7. Manifest structure ---
  echo ""
  echo "--- Manifest Validation ---"
  if [ -f "project-manifest.json" ]; then
    check_json_field "project-manifest.json" '.execution.default_mode' "Default mode"
  fi

  # --- 8. Calibration profile ---
  echo ""
  echo "--- Calibration Profile ---"
  if [ -f "calibration-profile.json" ]; then
    check_json_field "calibration-profile.json" '.project_type' "Project type"
  else
    warn "No calibration-profile.json (API-only projects don't need one)"
  fi

  # --- 9. State files ---
  echo ""
  echo "--- State Files ---"
  check_file ".claude/state/learned-rules.md"
  check_file ".claude/state/failures.md"
  check_file ".claude/state/iteration-log.md"
  check_file ".claude/state/coverage-baseline.txt"
  check_file ".claude/state/cost-log.json"
  check_file ".claude/state/eval-scores.json"
  check_file ".claude/state/harness-findings-log.json"
  check_file ".claude/state/changelog-template.md"

  # --- 10. Learnings ---
  echo ""
  echo "--- Learnings ---"
  check_dir ".claude/learnings/stack-decisions"
  check_dir ".claude/learnings/failure-patterns"
  check_dir ".claude/learnings/integration-notes"

  # --- 11. Output directories ---
  echo ""
  echo "--- Output Directories ---"
  for dir in specs/brd specs/stories specs/design specs/reviews sprint-contracts; do
    check_dir "$dir"
  done
fi

# --- Summary ---
echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo " Scaffold is INCOMPLETE. Fix the failures above."
  exit 1
else
  echo ""
  echo " Scaffold is VALID."
  exit 0
fi
