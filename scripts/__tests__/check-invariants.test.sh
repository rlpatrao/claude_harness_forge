#!/usr/bin/env bash
# Test harness for scripts/check-invariants.js. Run from forge root.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
SCRIPT="scripts/check-invariants.js"
FIX="scripts/__fixtures__/invariants"
fail=0

run() { node "$SCRIPT" --file "$1" >/dev/null 2>&1; echo $?; }

got=$(run "$FIX/pass.yaml")
[ "$got" = "0" ] || { echo "FAIL pass.yaml: expected 0, got $got"; fail=1; }

got=$(run "$FIX/fail-required.yaml")
[ "$got" = "1" ] || { echo "FAIL fail-required.yaml: expected 1, got $got"; fail=1; }

got=$(run "$FIX/fail-advisory.yaml")
[ "$got" = "0" ] || { echo "FAIL fail-advisory.yaml (advisory must not fail build): expected 0, got $got"; fail=1; }

[ "$fail" = "0" ] && echo "check-invariants: ALL PASS" || echo "check-invariants: FAILURES"
exit $fail
