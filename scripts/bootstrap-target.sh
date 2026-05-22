#!/usr/bin/env bash

# scripts/bootstrap-target.sh — creates a throwaway target project so
# the v3.0 retrofit chain can be dogfooded without a real workload.
#
# Produces:
#   $TARGET/feature_list.json     3 seed entries
#   $TARGET/init.sh                no-op smoke (writes "ok" + exits 0)
#   $TARGET/harness-progress.txt   seeded with project context
#   $TARGET/CLAUDE.md              minimal conventions
#   $TARGET/.git/                  initialized
#   $TARGET/verification/          empty dir
#
# Default target: /tmp/forge-target-<short-ts>
#
# Usage:
#   bash scripts/bootstrap-target.sh                  -- default target dir
#   bash scripts/bootstrap-target.sh /path/to/target  -- explicit dir
#   bash scripts/bootstrap-target.sh --self-test      -- also runs orchestrate + run-gates against it

set -uo pipefail

cd "$(dirname "$0")/.."
FORGE_ROOT="$PWD"

SELF_TEST=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --self-test) SELF_TEST=1 ;;
    *) TARGET="$arg" ;;
  esac
done

[ -z "$TARGET" ] && TARGET="/tmp/forge-target-$(date +%s)"
echo "target: $TARGET"

if [ -d "$TARGET" ]; then
  echo "target exists; refusing to clobber. Pass --self-test if reusing."
  [ "$SELF_TEST" -eq 0 ] && exit 1
else
  mkdir -p "$TARGET"
fi

cd "$TARGET"

# feature_list.json with 3 seed entries
cat > feature_list.json <<'JSON'
[
  {
    "id": "hello-world",
    "category": "smoke",
    "description": "init.sh runs and exits 0.",
    "steps": ["bash init.sh", "Assert exit code 0", "Assert stdout contains 'ok'"],
    "passes": false,
    "source_section": "bootstrap",
    "depends_on": [],
    "verification_artifact_path": "verification/hello-world.json"
  },
  {
    "id": "json-roundtrip",
    "category": "data",
    "description": "echo a JSON object via a tiny script and confirm it parses.",
    "steps": ["echo '{\"k\":1}' > out.json", "jq -e '.k == 1' out.json"],
    "passes": false,
    "source_section": "bootstrap",
    "depends_on": ["hello-world"],
    "verification_artifact_path": "verification/json-roundtrip.json"
  },
  {
    "id": "feature-list-mutation-rejected",
    "category": "harness-self-test",
    "description": "Confirm hooks/feature-edit-guard.js rejects an id rename.",
    "steps": ["Run feature-edit-guard.js with synthetic Edit input renaming an id", "Assert exit code 2"],
    "passes": false,
    "source_section": "BRD §3.2",
    "depends_on": [],
    "verification_artifact_path": "verification/feature-list-mutation-rejected.json"
  }
]
JSON

# init.sh — no-op smoke
cat > init.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "ok"
exit 0
SH
chmod +x init.sh

# harness-progress.txt
cat > harness-progress.txt <<EOF
================================================================
bootstrap target project — created by scripts/bootstrap-target.sh
================================================================
Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Forge: $FORGE_ROOT
Purpose: dogfood the BRD v3.0 retrofit chain

ARCHITECTURE DECISIONS:
D1. Smallest possible target — 3 feature entries.
D2. init.sh is intentionally trivial (echo + exit 0) so smoke is fast.
D3. The third entry exercises the harness itself (feature-edit-guard).

PROGRESS LOG:
EOF

# CLAUDE.md — minimal
cat > CLAUDE.md <<'MD'
# bootstrap target

Throwaway project for dogfooding claude_harness_forge BRD v3.0.

## Conventions
- No external deps.
- All "code" is bash.
- All tests are jq + exit-code assertions.

## Commands
- bash init.sh    -- smoke
- jq -e '...' <file>   -- assertions
MD

# git init
git init --quiet
git add -A
git -c user.email=bootstrap@forge -c user.name=bootstrap commit -qm "bootstrap: forge target genesis"

mkdir -p verification

echo ""
echo "=== target created ==="
echo "  $TARGET"
echo "  $(jq length feature_list.json) features (all passes:false)"
echo "  init.sh smoke: $(bash init.sh)"
echo "  git: $(git log --oneline | head -1)"

if [ "$SELF_TEST" -eq 1 ]; then
  echo ""
  echo "=== self-test: orchestrate plan for hello-world ==="
  cd "$TARGET"
  if [ -f "$FORGE_ROOT/scripts/orchestrate.js" ]; then
    # Copy needed scripts into target so orchestrate's local-root walk works
    cp -r "$FORGE_ROOT/scripts" .
    cp -r "$FORGE_ROOT/config" .
    cp -r "$FORGE_ROOT/hooks" .
    node scripts/orchestrate.js hello-world | jq -r '.phases | length' | xargs -I{} echo "phases in plan: {}"
  fi

  echo ""
  echo "=== self-test: run-gates against target ==="
  if [ -f "scripts/run-gates.sh" ]; then
    bash scripts/run-gates.sh --dry-run
  fi

  echo ""
  echo "=== self-test: simulate the gold-path flip via the harness chain ==="
  # 1. Create the verification artifact for hello-world
  bash init.sh > verification/hello-world.json
  git add verification/hello-world.json
  # 2. Synthesize the passes-flip Edit and pass through e2e-gate + feature-edit-guard
  python3 -c "
import json
print(json.dumps({
  'tool_name': 'Edit',
  'tool_input': {
    'file_path': 'feature_list.json',
    'old_string': '\"passes\": false,\n    \"source_section\": \"bootstrap\",\n    \"depends_on\": [],\n    \"verification_artifact_path\": \"verification/hello-world.json\"',
    'new_string': '\"passes\": true,\n    \"source_section\": \"bootstrap\",\n    \"depends_on\": [],\n    \"verification_artifact_path\": \"verification/hello-world.json\"',
  }
}))" | node hooks/e2e-gate.js
  rc=$?
  echo "  e2e-gate rc=$rc (expect 0: artifact exists, staged, non-empty)"

  echo ""
  echo "self-test complete. Inspect $TARGET"
fi
