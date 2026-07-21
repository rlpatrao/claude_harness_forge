#!/usr/bin/env bash
# Runs all three quality-gate test suites. Run from forge root.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
rc=0
echo "== check-invariants =="; bash scripts/__tests__/check-invariants.test.sh || rc=1
echo "== artifact-integrity =="; node scripts/__tests__/artifact-integrity.test.js || rc=1
echo "== e2e-gate integrity =="; bash scripts/__tests__/e2e-gate-integrity.test.sh || rc=1
echo "== jscpd gate =="; bash scripts/__tests__/jscpd-gate.test.sh || rc=1
[ "$rc" = "0" ] && echo "ALL QUALITY-GATE TESTS PASS" || echo "QUALITY-GATE TEST FAILURES"
exit $rc
