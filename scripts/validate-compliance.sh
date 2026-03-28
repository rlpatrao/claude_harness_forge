#!/usr/bin/env bash
set -uo pipefail
# Note: NOT using set -e because grep returns exit 1 on "no match"
# which would abort the script. We handle errors explicitly.

# =============================================================================
# validate-compliance.sh — Verify compliance artifacts exist for AI/ML projects
#
# Usage:
#   cd /path/to/scaffolded-project
#   bash /path/to/claude_harness_forge/scripts/validate-compliance.sh
# =============================================================================

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN  $1"; WARN=$((WARN + 1)); }

echo "============================================"
echo " Compliance Validation"
echo " Project: $(pwd)"
echo " Date: $(date -Iseconds)"
echo "============================================"
echo ""

# Detect forge repo vs scaffolded project
if [ -d "agents" ] && [ -d "skills" ] && [ ! -d ".claude/agents" ]; then
  echo "INFO: Forge repo — compliance validation is for scaffolded projects."
  echo "      Skipping."
  exit 0
fi

# Read project type from manifest
PROJECT_TYPE="crud"
if [ -f "project-manifest.json" ]; then
  AI_TYPE=$(jq -r '.ai_native.type // "crud"' project-manifest.json 2>/dev/null)
  if [ "$AI_TYPE" != "null" ] && [ -n "$AI_TYPE" ]; then
    PROJECT_TYPE="$AI_TYPE"
  fi
fi

echo "Project type: $PROJECT_TYPE"
echo ""

# --- 1. PII Checks (all projects) ---
echo "--- PII Checks ---"

# Check for hardcoded PII patterns in source code (not tests)
pii_count=0
for dir in backend/src frontend/src src/; do
  if [ -d "$dir" ]; then
    # SSN pattern (NNN-NN-NNNN)
    ssn=$(grep -rn '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]' "$dir" 2>/dev/null | grep -v __pycache__ | grep -v '\.pyc' | wc -l | tr -d ' ')
    pii_count=$((pii_count + ssn))
    # Credit card pattern (NNNN-NNNN-NNNN-NNNN or NNNN NNNN NNNN NNNN)
    cc=$(grep -rn '[0-9][0-9][0-9][0-9][-\ ][0-9][0-9][0-9][0-9][-\ ][0-9][0-9][0-9][0-9][-\ ][0-9][0-9][0-9][0-9]' "$dir" 2>/dev/null | grep -v __pycache__ | grep -v '\.pyc' | wc -l | tr -d ' ')
    pii_count=$((pii_count + cc))
  fi
done

if [ "$pii_count" -eq 0 ]; then
  pass "No hardcoded PII patterns in source code"
else
  fail "Found $pii_count potential PII patterns in source code"
fi

# Check for secrets (reuse detect-secrets logic)
secrets=0
for sdir in backend/src backend/app src/; do
  if [ -d "$sdir" ]; then
    count=$(grep -rn 'api_key.*=.*sk-\|password.*=.*['\''"]' "$sdir" 2>/dev/null | grep -v __pycache__ | grep -v '\.pyc' | grep -v 'test' | wc -l | tr -d ' ')
    secrets=$((secrets + count))
  fi
done
if [ -d "backend/src" ] || [ -d "backend/app" ] || [ -d "src/" ]; then
  if [ "$secrets" -eq 0 ]; then
    pass "No hardcoded secrets in source code"
  else
    fail "Found $secrets potential hardcoded secrets"
  fi
fi

# --- 2. ML-specific checks ---
if [ "$PROJECT_TYPE" = "ml" ] || [ "$PROJECT_TYPE" = "agentic" ]; then
  echo ""
  echo "--- ML/AI Compliance Checks ---"

  # Model card
  if [ -f "docs/model-card.md" ]; then
    # Check if model card has actual content (not just template placeholders)
    placeholders=$(grep -c '{{' docs/model-card.md 2>/dev/null || echo "0")
    placeholders=$(echo "$placeholders" | tr -d '[:space:]')
    if [ "$placeholders" -eq 0 ]; then
      pass "Model card exists and is filled in"
    else
      warn "Model card exists but has $placeholders unfilled placeholders"
    fi
  else
    fail "No model card found at docs/model-card.md (required for ML projects)"
  fi

  # Fairness metrics (guard for missing dirs — code may not be generated yet)
  fairness_refs=0
  for sdir in backend/ src/ frontend/src/; do
    if [ -d "$sdir" ]; then
      count=$(grep -rn 'demographic_parity\|equal_opportunity\|equalized_odds\|disparate_impact\|fairlearn\|aif360' "$sdir" 2>/dev/null | grep -v __pycache__ | wc -l | tr -d ' ')
      fairness_refs=$((fairness_refs + count))
    fi
  done
  if [ "$fairness_refs" -gt 0 ]; then
    pass "Fairness metrics referenced: $fairness_refs occurrences"
  else
    fail "No fairness metrics found in codebase (required for ML projects making decisions about people)"
  fi

  # Explainability (guard for missing dirs)
  explain_refs=0
  for sdir in backend/ src/; do
    if [ -d "$sdir" ]; then
      count=$(grep -rn 'shap\|lime\|feature_importance\|explain' "$sdir" 2>/dev/null | grep -v __pycache__ | grep -v node_modules | wc -l | tr -d ' ')
      explain_refs=$((explain_refs + count))
    fi
  done
  if [ "$explain_refs" -gt 0 ]; then
    pass "Explainability references: $explain_refs occurrences"
  else
    warn "No explainability (SHAP/LIME) found — recommended for consequential AI decisions"
  fi
fi

# --- 3. Agentic-specific checks ---
if [ "$PROJECT_TYPE" = "agentic" ]; then
  echo ""
  echo "--- Agentic Security Checks ---"

  # Check for input sanitization before LLM calls (guard for missing dirs)
  sanitize_refs=0
  for sdir in backend/ src/; do
    if [ -d "$sdir" ]; then
      count=$(grep -rn 'sanitize\|escape\|validate.*input\|clean.*prompt' "$sdir" 2>/dev/null | grep -v __pycache__ | wc -l | tr -d ' ')
      sanitize_refs=$((sanitize_refs + count))
    fi
  done
  if [ "$sanitize_refs" -gt 0 ]; then
    pass "Input sanitization found: $sanitize_refs occurrences"
  else
    warn "No input sanitization found before LLM calls — risk of prompt injection (ASI01)"
  fi

  # Check for tool allowlists (guard for missing dirs)
  allowlist_refs=0
  for sdir in backend/ src/; do
    if [ -d "$sdir" ]; then
      count=$(grep -rn 'allowed_tools\|tool_allowlist\|permitted_actions' "$sdir" 2>/dev/null | grep -v __pycache__ | wc -l | tr -d ' ')
      allowlist_refs=$((allowlist_refs + count))
    fi
  done
  if [ "$allowlist_refs" -gt 0 ]; then
    pass "Tool allowlists found: $allowlist_refs occurrences"
  else
    warn "No tool allowlists found — risk of tool misuse (ASI02)"
  fi
fi

# --- 4. Audit trail (all projects with user data) ---
echo ""
echo "--- Audit Trail ---"

audit_refs=0
for sdir in backend/ src/ frontend/src/; do
  if [ -d "$sdir" ]; then
    count=$(grep -rn 'audit_log\|AuditLog\|audit_trail\|action_log' "$sdir" 2>/dev/null | grep -v __pycache__ | wc -l | tr -d ' ')
    audit_refs=$((audit_refs + count))
  fi
done
if [ "$audit_refs" -gt 0 ]; then
  pass "Audit trail references: $audit_refs occurrences"
else
  if [ "$PROJECT_TYPE" = "ml" ] || [ "$PROJECT_TYPE" = "agentic" ]; then
    fail "No audit trail found (required for AI projects making decisions)"
  else
    warn "No audit trail found (recommended for apps with user data)"
  fi
fi

# --- 5. Data retention ---
echo ""
echo "--- Data Retention ---"

retention_refs=0
for sdir in backend/ src/; do
  if [ -d "$sdir" ]; then
    count=$(grep -rn 'retention\|delete_after\|cleanup_old\|purge\|gdpr\|right_to_be_forgotten' "$sdir" 2>/dev/null | grep -v __pycache__ | wc -l | tr -d ' ')
    retention_refs=$((retention_refs + count))
  fi
done
if [ "$retention_refs" -gt 0 ]; then
  pass "Data retention logic found: $retention_refs occurrences"
else
  regulations=$(jq -r '.compliance.regulations // [] | join(", ")' project-manifest.json 2>/dev/null)
  if echo "$regulations" | grep -qi "gdpr"; then
    fail "GDPR specified but no data retention logic found"
  else
    warn "No data retention logic found (recommended if storing user data)"
  fi
fi

# --- Summary ---
echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo " Compliance validation: ISSUES FOUND"
  exit 1
else
  echo ""
  echo " Compliance validation: PASSED"
  exit 0
fi
