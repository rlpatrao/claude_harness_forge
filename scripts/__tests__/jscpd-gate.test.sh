#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo 0 > /tmp/jscpd-zero-baseline.txt
node scripts/jscpd-gate.js --paths scripts/__fixtures__/jscpd/dup --baseline /tmp/jscpd-zero-baseline.txt >/tmp/jscpd-out.txt 2>&1
code=$?
cat /tmp/jscpd-out.txt
if grep -q "NOT_RUN" /tmp/jscpd-out.txt; then
  echo "jscpd-gate: NOT_RUN (jscpd unavailable) — treated as pass"; exit 0
fi
# With jscpd present and a 0% baseline, the duplicated fixture must regress -> exit 2
[ "$code" = "2" ] && echo "jscpd-gate: ALL PASS (regression detected)" || { echo "FAIL: expected 2 on duplicated fixture vs 0 baseline, got $code"; exit 1; }
