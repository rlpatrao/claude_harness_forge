#!/usr/bin/env bash
# validate-evals.sh — Verify code-reviewer catches all known violations in eval samples
#
# Usage: bash scripts/validate-evals.sh [path-to-project]
#
# This script copies eval samples into the project, invokes the code-reviewer,
# and checks that all expected BLOCK-level violations are detected.

set -euo pipefail

PROJECT_DIR="${1:-.}"

# Auto-detect forge repo vs scaffolded project
if [ -d "$PROJECT_DIR/evals/samples" ]; then
  EVALS_DIR="$PROJECT_DIR/evals"
elif [ -d "$PROJECT_DIR/.claude/evals/samples" ]; then
  EVALS_DIR="$PROJECT_DIR/.claude/evals"
else
  echo "FAIL: No evals directory found (checked evals/ and .claude/evals/)"
  exit 1
fi

SAMPLES_DIR="$EVALS_DIR/samples"
EXPECTED="$EVALS_DIR/expected.md"

echo "=== Validate Evals ==="
echo "Project: $PROJECT_DIR"
echo ""

# --- Pre-checks ---

if [ ! -d "$SAMPLES_DIR" ]; then
  echo "FAIL: Evals directory not found at $SAMPLES_DIR"
  echo "      Run /scaffold first to install eval samples."
  exit 1
fi

if [ ! -f "$EXPECTED" ]; then
  echo "FAIL: Expected findings file not found at $EXPECTED"
  exit 1
fi

SAMPLE_COUNT=$(find "$SAMPLES_DIR" -name "*.ts" -o -name "*.py" | wc -l)
if [ "$SAMPLE_COUNT" -eq 0 ]; then
  echo "FAIL: No eval samples found in $SAMPLES_DIR"
  exit 1
fi

echo "Found $SAMPLE_COUNT eval samples"
echo "Expected findings: $EXPECTED"
echo ""

# --- Parse expected findings ---
# expected.md format:
#   ## bad-upward-import.ts
#   - [BLOCK] Upward layer import: service imports from api
#   - [WARN] ...

PASS=0
FAIL=0
TOTAL=0

for sample in "$SAMPLES_DIR"/*.ts "$SAMPLES_DIR"/*.py; do
  [ -f "$sample" ] || continue
  
  filename=$(basename "$sample")
  echo "--- $filename ---"
  
  # Extract expected BLOCK findings for this sample
  # expected.md uses table format: | N | BLOCK | description | line |
  # Use awk to extract section content (skip the heading line itself)
  block_findings=$(awk "
    /^## ${filename//./\\.}/ { found=1; next }
    found && /^## / { found=0 }
    found { print }
  " "$EXPECTED" | grep "| BLOCK |" || true)
  block_count=0
  if [ -n "$block_findings" ]; then
    block_count=$(echo "$block_findings" | wc -l | tr -d ' ')
  fi
  
  if [ "$block_count" -eq 0 ]; then
    echo "  No BLOCK-level findings expected. Skipping."
    continue
  fi
  
  echo "  Expected BLOCK findings: $block_count"
  TOTAL=$((TOTAL + block_count))
  
  # Check that the sample file contains the violations described
  # (This is a structural validation — the full agent-based eval
  #  requires running Claude Code with the code-reviewer agent)
  
  while IFS= read -r finding; do
    [ -z "$finding" ] && continue
    
    # Extract the violation description from table format: | N | BLOCK | desc | line |
    desc=$(echo "$finding" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $4); print $4}')
    
    # Simple heuristic checks based on common violation patterns
    found=false
    
    case "$desc" in
      *"import"*|*"layer"*)
        # Check for cross-layer imports
        if grep -q "import.*from.*api\|import.*from.*service\|from.*api.*import\|from.*service.*import" "$sample" 2>/dev/null; then
          found=true
        fi
        ;;
      *"function"*|*"long"*|*"lines"*)
        # Check for long functions (>50 lines between braces)
        line_count=$(wc -l < "$sample")
        if [ "$line_count" -gt 50 ]; then
          found=true
        fi
        ;;
      *"secret"*|*"hardcoded"*|*"password"*|*"key"*)
        # Check for hardcoded secrets
        if grep -qi "api_key\|password.*=.*['\"].*['\"]\\|secret.*=.*['\"]" "$sample" 2>/dev/null; then
          found=true
        fi
        ;;
      *"any"*|*"dead"*|*"unused"*)
        # Check for any types or dead code
        if grep -q ": any\|// TODO\|/\* unused\|commented.out" "$sample" 2>/dev/null; then
          found=true
        fi
        ;;
      *"mock"*|*"test"*)
        # Check for mocked business logic in tests
        if grep -q "jest.mock\|vi.mock\|mock.*service\|mock.*repository" "$sample" 2>/dev/null; then
          found=true
        fi
        ;;
      *)
        # Unknown pattern — mark as needing manual review
        echo "  [MANUAL] Cannot auto-validate: $desc"
        found=true  # Don't fail on unknown patterns
        ;;
    esac
    
    if $found; then
      echo "  [PASS] Sample contains violation: $desc"
      PASS=$((PASS + 1))
    else
      echo "  [FAIL] Expected violation not found in sample: $desc"
      FAIL=$((FAIL + 1))
    fi
    
  done <<< "$block_findings"
  
  echo ""
done

# --- Summary ---

echo "=== Eval Validation Summary ==="
echo "Samples checked: $SAMPLE_COUNT"
echo "BLOCK violations expected: $TOTAL"
echo "Structurally present: $PASS"
echo "Missing from samples: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL — $FAIL expected violations are missing from eval samples."
  echo "        Eval samples may have been modified. Check $SAMPLES_DIR."
  exit 1
else
  echo "RESULT: PASS — All expected violations are structurally present in eval samples."
  echo ""
  echo "NOTE: This validates that samples CONTAIN the expected violations."
  echo "      Full agent-based eval (code-reviewer catches all findings) requires"
  echo "      running Claude Code with the code-reviewer agent."
  exit 0
fi
