#!/usr/bin/env bash
# Drives hooks/e2e-gate.js with a synthetic passes-flip against good,
# tampered, and missing-sidecar artifacts. Run from forge root.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
git init -q
git config user.email t@t.t; git config user.name t
mkdir -p verification
cat > feature_list.json <<'JSON'
[ { "id": "feat-x", "passes": false, "verification_artifact_path": "verification/feat-x.json", "steps": [], "depends_on": [] } ]
JSON
echo '{"verdict":"pass"}' > verification/feat-x.json
node -e "const ai=require('$ROOT/hooks/lib/artifact-integrity.js'); ai.writeSidecar('$WORK','feat-x',['verification/feat-x.json']);"
git add -A && git commit -qm seed

payload() {
cat <<JSON
{ "tool_name": "Edit", "tool_input": { "file_path": "$WORK/feature_list.json", "old_string": "\"passes\": false", "new_string": "\"passes\": true" } }
JSON
}

echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); good=$?

echo '{"verdict":"FAKE"}' > verification/feat-x.json
echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); tamper=$?

git checkout -- verification/feat-x.json 2>/dev/null
rm -f verification/feat-x.sha256.json
echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); missing=$?

fail=0
[ "$good" = "0" ]   || { echo "FAIL good: expected allow(0), got $good"; fail=1; }
[ "$tamper" = "2" ] || { echo "FAIL tamper: expected BLOCK(2), got $tamper"; fail=1; }
[ "$missing" = "2" ]|| { echo "FAIL missing: expected BLOCK(2), got $missing"; fail=1; }
[ "$fail" = "0" ] && echo "e2e-gate-integrity: ALL PASS" || echo "e2e-gate-integrity: FAILURES"
exit $fail
