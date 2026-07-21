# Forge Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three quality-infrastructure features to the forge — a jscpd duplication check (folded into the lint-drift gate), sha256-integrity verification artifacts, and a declarative invariants parser — replacing ad-hoc CI bash and closing the artifact-tampering hole.

**Architecture:** All three are stdlib-only Node.js scripts/hooks + one hand-parsed YAML config, following existing forge idioms (baseline-file ratchets, `settings.json` hook registration, graceful `NOT_RUN`). No new forge runtime dependency; jscpd runs via `npx --yes jscpd`.

**Tech Stack:** Node.js (stdlib: `crypto`, `fs`, `path`, `child_process`), Bash (test harness), YAML (invariants config, hand-parsed).

## Global Constraints

- Forge hooks/scripts are **stdlib-only** — no `require` of any npm package (`package.json` declares deps but the forge does not `npm install`). Verbatim from spec.
- Any subprocess call uses `execFileSync`/`execFile` with an argv array — **never** a shell string (injection safety). Verbatim from spec.
- Every gate/check that cannot execute exits `0` with a `NOT_RUN` warning to stderr — never a false pass.
- Baseline ratchet files are plaintext under `state/`, auto-seed on absent/sentinel, and may only improve.
- Reference spec: `docs/superpowers/specs/2026-07-20-forge-quality-gates-design.md`.
- All work on branch `feat/quality-gates-jscpd-integrity-invariants`.
- Paths are relative to the forge root `/Users/rlpatrao/workspace/claude_harness_forge`.

---

### Task 1: Invariants parser core (`scripts/check-invariants.js`)

Build the parser + evaluator with the six non-integrity check types (`artifact_integrity` is added in Task 4, after the integrity lib exists).

**Files:**
- Create: `scripts/check-invariants.js`
- Create: `scripts/__fixtures__/invariants/pass.yaml`
- Create: `scripts/__fixtures__/invariants/fail-required.yaml`
- Create: `scripts/__fixtures__/invariants/fail-advisory.yaml`
- Create: `scripts/__fixtures__/invariants/present.txt` (fixture target file)
- Test: `scripts/__tests__/check-invariants.test.sh`

**Interfaces:**
- Produces: CLI `node scripts/check-invariants.js [--file <path>] [--json]`. Exit `0` if all `required` invariants pass (advisory failures warn only); exit `1` if any `required` fails; exit `2` on config parse error. Default config path `config/invariants.yaml`.
- Produces (internal, reused by Task 4): `evaluateInvariant(inv, rootDir) -> {id, ok, severity, detail}` and `parseInvariantsYaml(text) -> Array<inv>`.

- [ ] **Step 1: Write the fixture configs**

Create `scripts/__fixtures__/invariants/present.txt`:
```
fixture target
```

Create `scripts/__fixtures__/invariants/pass.yaml`:
```yaml
# All satisfiable relative to the forge root.
- id: fixture-file-present
  description: fixture target file exists
  type: file_exists
  path: scripts/__fixtures__/invariants/present.txt
  severity: required

- id: readme-has-forge
  description: README mentions the forge
  type: grep_match
  file: scripts/__fixtures__/invariants/present.txt
  pattern: fixture target
  severity: required

- id: scripts-present
  description: at least 3 scripts exist
  type: glob_min_count
  glob: scripts/*.js
  min: 3
  severity: advisory
```

Create `scripts/__fixtures__/invariants/fail-required.yaml`:
```yaml
- id: missing-required-file
  description: a required file that does not exist
  type: file_exists
  path: scripts/__fixtures__/invariants/DOES_NOT_EXIST.txt
  severity: required
```

Create `scripts/__fixtures__/invariants/fail-advisory.yaml`:
```yaml
- id: missing-advisory-file
  description: an advisory file that does not exist
  type: file_exists
  path: scripts/__fixtures__/invariants/DOES_NOT_EXIST.txt
  severity: advisory
```

- [ ] **Step 2: Write the failing test**

Create `scripts/__tests__/check-invariants.test.sh`:
```bash
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bash scripts/__tests__/check-invariants.test.sh`
Expected: FAIL (node cannot find `scripts/check-invariants.js`), exit non-zero.

- [ ] **Step 4: Implement `scripts/check-invariants.js`**

Create `scripts/check-invariants.js`:
```javascript
#!/usr/bin/env node
'use strict';

// Declarative invariant checker (BRD invariants). Stdlib-only.
// Parses a constrained YAML subset (list of flat maps) and evaluates
// each invariant. Exit 0 if all `required` pass; 1 if any required
// fails; 2 on config parse error. See config/invariants.yaml.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- constrained YAML parser (list of single-level maps) ----
function coerce(v) {
  const t = v.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => coerce(s));
  }
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseInvariantsYaml(text) {
  const items = [];
  let cur = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    const noComment = line.replace(/\s+#.*$/, '');
    if (noComment.trim() === '') continue;
    const itemMatch = noComment.match(/^(\s*)-\s+(\w[\w-]*):\s*(.*)$/);
    if (itemMatch) {
      if (cur) items.push(cur);
      cur = {};
      cur[itemMatch[2]] = coerce(itemMatch[3]);
      continue;
    }
    const kvMatch = noComment.match(/^\s+(\w[\w-]*):\s*(.*)$/);
    if (kvMatch && cur) {
      cur[kvMatch[1]] = coerce(kvMatch[2]);
    }
  }
  if (cur) items.push(cur);
  return items;
}

// ---- minimal JSONPath: dotted keys, [n], __isArray, __length ----
function resolveJsonPath(obj, pathStr) {
  let node = obj;
  const parts = pathStr.replace(/^\$\.?/, '').split('.').filter(Boolean);
  for (const part of parts) {
    if (part === '__isArray') return Array.isArray(node);
    if (part === '__length') return node == null ? undefined : node.length;
    const idx = part.match(/^(\w+)\[(\d+)\]$/);
    if (idx) {
      node = node && node[idx[1]];
      node = node && node[parseInt(idx[2], 10)];
    } else {
      node = node && node[part];
    }
    if (node === undefined) return undefined;
  }
  return node;
}

// ---- evaluators ----
function evaluateInvariant(inv, rootDir) {
  const sev = inv.severity === 'advisory' ? 'advisory' : 'required';
  const fail = (detail) => ({ id: inv.id, ok: false, severity: sev, detail });
  const pass = () => ({ id: inv.id, ok: true, severity: sev, detail: '' });
  try {
    switch (inv.type) {
      case 'file_exists':
        return fs.existsSync(path.join(rootDir, inv.path)) ? pass() : fail(`missing ${inv.path}`);
      case 'glob_min_count': {
        const count = globCount(rootDir, inv.glob);
        return count >= inv.min ? pass() : fail(`found ${count} < min ${inv.min} for ${inv.glob}`);
      }
      case 'grep_match': {
        const fp = path.join(rootDir, inv.file);
        if (!fs.existsSync(fp)) return fail(`file missing ${inv.file}`);
        const re = new RegExp(inv.pattern);
        return re.test(fs.readFileSync(fp, 'utf8')) ? pass() : fail(`pattern /${inv.pattern}/ not found in ${inv.file}`);
      }
      case 'json_path_equals': {
        const fp = path.join(rootDir, inv.file);
        if (!fs.existsSync(fp)) return fail(`file missing ${inv.file}`);
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const val = resolveJsonPath(data, inv.path);
        return JSON.stringify(val) === JSON.stringify(inv.equals)
          ? pass() : fail(`${inv.path} = ${JSON.stringify(val)}, expected ${JSON.stringify(inv.equals)}`);
      }
      case 'hook_registered': {
        const sp = path.join(rootDir, 'settings.json');
        if (!fs.existsSync(sp)) return fail('settings.json missing');
        const settings = JSON.parse(fs.readFileSync(sp, 'utf8'));
        const events = (settings.hooks && settings.hooks[inv.event]) || [];
        const found = JSON.stringify(events).includes(inv.hook);
        return found ? pass() : fail(`${inv.hook} not registered under ${inv.event}`);
      }
      case 'command_exit_zero': {
        if (!Array.isArray(inv.cmd) || inv.cmd.length === 0) return fail('cmd must be a non-empty argv array');
        try {
          execFileSync(inv.cmd[0], inv.cmd.slice(1), { cwd: rootDir, stdio: 'ignore' });
          return pass();
        } catch (e) { return fail(`command failed: ${inv.cmd.join(' ')}`); }
      }
      default:
        return fail(`unknown invariant type: ${inv.type}`);
    }
  } catch (e) {
    return fail(`evaluator error: ${e.message}`);
  }
}

function globCount(rootDir, glob) {
  // Support only "<dir>/<pattern>" with a single * in the basename.
  const dir = path.join(rootDir, path.dirname(glob));
  const pat = path.basename(glob);
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => re.test(f)).length;
}

function findRoot(start) {
  let cur = start;
  while (true) {
    if (fs.existsSync(path.join(cur, 'config', 'invariants.yaml')) ||
        fs.existsSync(path.join(cur, '.git'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return start;
    cur = parent;
  }
}

function main(argv) {
  const args = argv.slice(2);
  const jsonOut = args.includes('--json');
  const fileIdx = args.indexOf('--file');
  const rootDir = findRoot(process.cwd());
  const configPath = fileIdx !== -1 ? path.resolve(args[fileIdx + 1]) : path.join(rootDir, 'config', 'invariants.yaml');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`ERROR: invariants config not found: ${configPath}\n`);
    process.exit(2);
  }
  let invs;
  try { invs = parseInvariantsYaml(fs.readFileSync(configPath, 'utf8')); }
  catch (e) { process.stderr.write(`ERROR: failed to parse ${configPath}: ${e.message}\n`); process.exit(2); }

  const results = invs.map((inv) => evaluateInvariant(inv, rootDir));
  const requiredFails = results.filter((r) => !r.ok && r.severity === 'required');
  const advisoryFails = results.filter((r) => !r.ok && r.severity === 'advisory');

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ results, requiredFails: requiredFails.length }, null, 2) + '\n');
  } else {
    for (const r of results) {
      const tag = r.ok ? 'PASS' : (r.severity === 'required' ? 'FAIL' : 'WARN');
      process.stdout.write(`${tag}  ${r.id}${r.ok ? '' : '  — ' + r.detail}\n`);
    }
    process.stdout.write(`\n${results.length} invariants: ${results.filter((r) => r.ok).length} pass, ${requiredFails.length} required-fail, ${advisoryFails.length} advisory-fail\n`);
  }
  process.exit(requiredFails.length > 0 ? 1 : 0);
}

if (require.main === module) main(process.argv);
module.exports = { parseInvariantsYaml, evaluateInvariant, resolveJsonPath, globCount };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bash scripts/__tests__/check-invariants.test.sh`
Expected: `check-invariants: ALL PASS`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-invariants.js scripts/__fixtures__/invariants scripts/__tests__/check-invariants.test.sh
git commit -m "feat: invariants parser core with 6 check types + fixtures"
```

---

### Task 2: Seed real forge invariants + wire CI + `/invariants` command

**Files:**
- Create: `config/invariants.yaml`
- Create: `commands/invariants.md`
- Modify: `.github/workflows/ci.yml` (replace the "BRD invariants" + "hook registration" bash steps)

**Interfaces:**
- Consumes: `scripts/check-invariants.js` from Task 1.
- Produces: `config/invariants.yaml` as the canonical forge invariant set; CI step `node scripts/check-invariants.js`.

- [ ] **Step 1: Read the CI bash blocks being replaced**

Run: `sed -n '60,110p' .github/workflows/ci.yml`
Expected: see the "BRD docs invariants" and "settings.json hook registration" steps. Note the exact files/hooks they assert.

- [ ] **Step 2: Create `config/invariants.yaml`**

Seed from the CI bash + the dogfood "on-disk invariants". Adjust `path`/`hook` values to match what Step 1 revealed:
```yaml
# Forge self-invariants. Checked in CI and via /invariants.
- id: brd-v30-present
  description: Canonical BRD v3.0 spec exists
  type: file_exists
  path: brd/v3.0.md
  severity: required

- id: brd-v34-present
  description: BRD v3.4 headless-dogfood spec exists
  type: file_exists
  path: brd/v3.4-headless-dogfood.md
  severity: required

- id: workflows-config-present
  description: per-workflow LLM routing config exists
  type: file_exists
  path: config/workflows.yaml
  severity: required

- id: e2e-gate-registered
  description: e2e-gate hook registered on PreToolUse
  type: hook_registered
  event: PreToolUse
  hook: e2e-gate.js
  severity: required

- id: feature-edit-guard-registered
  description: feature-edit-guard hook registered on PreToolUse
  type: hook_registered
  event: PreToolUse
  hook: feature-edit-guard.js
  severity: required

- id: check-invariants-self
  description: the invariants checker itself exists (self-guard)
  type: file_exists
  path: scripts/check-invariants.js
  severity: required
```

- [ ] **Step 3: Verify against the real repo**

Run: `node scripts/check-invariants.js`
Expected: all `PASS`, exit 0. If any FAIL, correct the `path`/`hook` value in `config/invariants.yaml` to match reality (do not weaken to advisory to hide a real gap).

- [ ] **Step 4: Create `commands/invariants.md`**

```markdown
---
description: Check forge invariants (config/invariants.yaml) and print a PASS/FAIL table.
---

# /invariants

Run the declarative invariant checker and render the result.

Steps:
1. Run `node scripts/check-invariants.js` from the repo root.
2. Render the PASS/FAIL/WARN table verbatim.
3. If exit code is 1, summarize the failing `required` invariants and stop — do not proceed with other work until they are resolved or explicitly waived by the user.
4. `--json` is available for machine-readable output.
```

- [ ] **Step 5: Replace the CI bash steps**

In `.github/workflows/ci.yml`, replace the "BRD docs invariants" and "settings.json hook registration invariants" steps (identified in Step 1) with a single step:
```yaml
      - name: Invariants
        run: node scripts/check-invariants.js
```

- [ ] **Step 6: Verify CI YAML is valid + checker still green**

Run: `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && node scripts/check-invariants.js`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add config/invariants.yaml commands/invariants.md .github/workflows/ci.yml
git commit -m "feat: seed forge invariants, wire CI + /invariants command"
```

---

### Task 3: Artifact integrity library (`hooks/lib/artifact-integrity.js`)

**Files:**
- Create: `hooks/lib/artifact-integrity.js`
- Test: `scripts/__tests__/artifact-integrity.test.js`

**Interfaces:**
- Produces: `computeSha256(absPath) -> hex string`; `writeSidecar(projectDir, featureId, relFiles) -> sidecarRelPath`; `verifySidecar(projectDir, featureId) -> {ok, missing: string[], mismatches: string[], sidecar: string}`.
- Sidecar path convention: `verification/<featureId>.sha256.json`.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/artifact-integrity.test.js`:
```javascript
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ai = require('../../hooks/lib/artifact-integrity.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-test-'));
fs.mkdirSync(path.join(tmp, 'verification'), { recursive: true });
const jsonRel = 'verification/feat-x.json';
const pngRel = 'verification/feat-x.png';
fs.writeFileSync(path.join(tmp, jsonRel), '{"verdict":"pass"}');
fs.writeFileSync(path.join(tmp, pngRel), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

// write sidecar
const sidecar = ai.writeSidecar(tmp, 'feat-x', [jsonRel, pngRel]);
assert.ok(fs.existsSync(path.join(tmp, sidecar)), 'sidecar written');

// good path
let r = ai.verifySidecar(tmp, 'feat-x');
assert.strictEqual(r.ok, true, 'good verify ok');

// tamper path
fs.writeFileSync(path.join(tmp, jsonRel), '{"verdict":"FAKE"}');
r = ai.verifySidecar(tmp, 'feat-x');
assert.strictEqual(r.ok, false, 'tamper detected');
assert.ok(r.mismatches.includes(jsonRel), 'names the tampered file');

// missing sidecar path
r = ai.verifySidecar(tmp, 'nonexistent');
assert.strictEqual(r.ok, false, 'missing sidecar fails');

console.log('artifact-integrity: ALL PASS');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/__tests__/artifact-integrity.test.js`
Expected: FAIL — `Cannot find module '../../hooks/lib/artifact-integrity.js'`.

- [ ] **Step 3: Implement `hooks/lib/artifact-integrity.js`**

```javascript
'use strict';

// sha256 integrity sidecars for verification artifacts. Stdlib-only.
// Sidecar path: verification/<featureId>.sha256.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeSha256(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sidecarRel(featureId) {
  return path.join('verification', `${featureId}.sha256.json`);
}

function writeSidecar(projectDir, featureId, relFiles) {
  const files = {};
  for (const rel of relFiles) {
    const abs = path.join(projectDir, rel);
    if (fs.existsSync(abs)) files[rel] = computeSha256(abs);
  }
  const sidecar = {
    algo: 'sha256',
    feature_id: featureId,
    created_at: new Date().toISOString(),
    files,
  };
  const rel = sidecarRel(featureId);
  fs.writeFileSync(path.join(projectDir, rel), JSON.stringify(sidecar, null, 2) + '\n');
  return rel;
}

function verifySidecar(projectDir, featureId) {
  const rel = sidecarRel(featureId);
  const abs = path.join(projectDir, rel);
  const result = { ok: false, missing: [], mismatches: [], sidecar: rel };
  if (!fs.existsSync(abs)) { result.missing.push(rel); return result; }
  let data;
  try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (e) { result.mismatches.push(`${rel} (unparseable)`); return result; }
  const files = (data && data.files) || {};
  const keys = Object.keys(files);
  if (keys.length === 0) { result.mismatches.push(`${rel} (no files recorded)`); return result; }
  for (const rf of keys) {
    const fabs = path.join(projectDir, rf);
    if (!fs.existsSync(fabs)) { result.missing.push(rf); continue; }
    if (computeSha256(fabs) !== files[rf]) result.mismatches.push(rf);
  }
  result.ok = result.missing.length === 0 && result.mismatches.length === 0;
  return result;
}

module.exports = { computeSha256, sidecarRel, writeSidecar, verifySidecar };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/__tests__/artifact-integrity.test.js`
Expected: `artifact-integrity: ALL PASS`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add hooks/lib/artifact-integrity.js scripts/__tests__/artifact-integrity.test.js
git commit -m "feat: sha256 artifact-integrity sidecar lib (compute/write/verify)"
```

---

### Task 4: Wire integrity into e2e-gate + `verify-artifacts.js` + `artifact_integrity` invariant type

**Files:**
- Modify: `hooks/e2e-gate.js` (after the existing exists + git-tracked check, ~line 157)
- Create: `scripts/verify-artifacts.js`
- Modify: `scripts/check-invariants.js` (add the `artifact_integrity` case)
- Modify: `agents/e2e-runner.md`, `skills/auto/SKILL.md` (document `writeSidecar` before flip)
- Test: `scripts/__tests__/e2e-gate-integrity.test.sh`

**Interfaces:**
- Consumes: `hooks/lib/artifact-integrity.js` (`verifySidecar`) from Task 3.
- Produces: e2e-gate BLOCK on missing/mismatched sidecar; `scripts/verify-artifacts.js` CLI; new invariant type `artifact_integrity` with param `feature_id`.

- [ ] **Step 1: Read the e2e-gate insertion point**

Run: `sed -n '140,175p' hooks/e2e-gate.js`
Expected: see the block that resolves `entry.verification_artifact_path`, checks `fs.existsSync(artifactAbs)`, and `isTrackedInGit/isStagedInGit`. Note the exact variable names (`artifactRel`, `artifactAbs`, `entry`, and the `block(...)` helper).

- [ ] **Step 2: Write the failing integrity test**

Create `scripts/__tests__/e2e-gate-integrity.test.sh`:
```bash
#!/usr/bin/env bash
# Drives hooks/e2e-gate.js with a synthetic passes-flip against good,
# tampered, and missing-sidecar artifacts. Run from forge root.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
git init -q
mkdir -p verification
cp "$ROOT/hooks/e2e-gate.js" .            # not needed; we call the real one with cwd=WORK
# feature_list.json: one entry passes:false
cat > feature_list.json <<'JSON'
[ { "id": "feat-x", "passes": false, "verification_artifact_path": "verification/feat-x.json", "steps": [], "depends_on": [] } ]
JSON
echo '{"verdict":"pass"}' > verification/feat-x.json
node -e "const ai=require('$ROOT/hooks/lib/artifact-integrity.js'); ai.writeSidecar('$WORK','feat-x',['verification/feat-x.json']);"
git add -A && git commit -qm seed

# Build the PreToolUse payload that flips passes:false->true via Edit.
payload() {
cat <<JSON
{ "tool_name": "Edit", "tool_input": { "file_path": "$WORK/feature_list.json", "old_string": "\"passes\": false", "new_string": "\"passes\": true" } }
JSON
}

# GOOD: expect exit 0 (allowed) — assuming votes gate not required in this synthetic case.
echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); good=$?

# TAMPER: modify artifact after sidecar -> expect BLOCK (exit 2)
echo '{"verdict":"FAKE"}' > verification/feat-x.json
echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); tamper=$?

# MISSING sidecar -> expect BLOCK (exit 2)
git checkout -- verification/feat-x.json 2>/dev/null
rm -f verification/feat-x.sha256.json
echo "$(payload)" | (cd "$WORK" && node "$ROOT/hooks/e2e-gate.js"); missing=$?

fail=0
[ "$tamper" = "2" ] || { echo "FAIL tamper: expected BLOCK(2), got $tamper"; fail=1; }
[ "$missing" = "2" ] || { echo "FAIL missing: expected BLOCK(2), got $missing"; fail=1; }
[ "$fail" = "0" ] && echo "e2e-gate-integrity: ALL PASS" || echo "e2e-gate-integrity: FAILURES"
exit $fail
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bash scripts/__tests__/e2e-gate-integrity.test.sh`
Expected: FAIL — tamper/missing currently return the pre-integrity behavior (not 2), because e2e-gate does not yet check the sidecar.

- [ ] **Step 4: Add the integrity check to `hooks/e2e-gate.js`**

Near the top with the other defensive requires (mirroring the existing `logRejection` require pattern), add:
```javascript
let artifactIntegrity = null;
try { artifactIntegrity = require('./lib/artifact-integrity.js'); }
catch (_) {
  try { artifactIntegrity = require(path.join(__dirname, 'lib', 'artifact-integrity.js')); }
  catch (_) { artifactIntegrity = null; }
}
```

Then, immediately AFTER the existing `isTrackedInGit(artifactRel) || isStagedInGit(artifactRel)` check passes (i.e., after line ~160, before the votes check), insert:
```javascript
  // sha256 integrity: the artifact must match its committed sidecar.
  if (artifactIntegrity && artifactIntegrity.verifySidecar) {
    const integ = artifactIntegrity.verifySidecar(projectDir, entry.id);
    if (!integ.ok) {
      const why = integ.missing.length
        ? `missing integrity sidecar/file: ${integ.missing.join(', ')}`
        : `artifact hash mismatch (modified after verification): ${integ.mismatches.join(', ')}`;
      block(entry.id, artifactRel, why);
    }
    // sidecar itself must be tracked/staged, else it can be forged locally
    const scRel = artifactIntegrity.sidecarRel(entry.id);
    if (!(isTrackedInGit(scRel) || isStagedInGit(scRel))) {
      block(entry.id, scRel, 'integrity sidecar is not committed/staged in git');
    }
  }
```
(Use the actual variable names found in Step 1 — `projectDir`/`entry`/`artifactRel`/`block`. If `projectDir` is not already defined in that scope, derive it: `const projectDir = path.dirname(absPath);`.)

- [ ] **Step 5: Run integrity test to verify it passes**

Run: `bash scripts/__tests__/e2e-gate-integrity.test.sh`
Expected: `e2e-gate-integrity: ALL PASS`.

- [ ] **Step 6: Verify no regression on the existing e2e-gate behavior**

Run: `node -e "require('./hooks/e2e-gate.js')" < /dev/null; echo "loaded exit $?"`
Expected: exit 0 (empty stdin → early exit, hook must not crash).

- [ ] **Step 7: Create `scripts/verify-artifacts.js`**

```javascript
#!/usr/bin/env node
'use strict';
// Verify every verification sidecar in the repo. Exit 1 on any mismatch.
const fs = require('fs');
const path = require('path');
const ai = require('../hooks/lib/artifact-integrity.js');

const projectDir = process.cwd();
const vdir = path.join(projectDir, 'verification');
if (!fs.existsSync(vdir)) { console.log('no verification/ dir — nothing to verify'); process.exit(0); }
const sidecars = fs.readdirSync(vdir).filter((f) => f.endsWith('.sha256.json'));
let bad = 0;
for (const sc of sidecars) {
  const featureId = sc.replace(/\.sha256\.json$/, '');
  const r = ai.verifySidecar(projectDir, featureId);
  if (r.ok) { console.log(`PASS  ${featureId}`); }
  else { console.log(`FAIL  ${featureId} — missing:[${r.missing}] mismatch:[${r.mismatches}]`); bad++; }
}
console.log(`\n${sidecars.length} sidecars: ${sidecars.length - bad} ok, ${bad} bad`);
process.exit(bad > 0 ? 1 : 0);
```

- [ ] **Step 8: Add the `artifact_integrity` invariant type**

In `scripts/check-invariants.js`, inside `evaluateInvariant`'s `switch`, before `default:`, add:
```javascript
      case 'artifact_integrity': {
        let ai;
        try { ai = require(path.join(rootDir, 'hooks', 'lib', 'artifact-integrity.js')); }
        catch (e) { return fail('artifact-integrity lib not found'); }
        const r = ai.verifySidecar(rootDir, inv.feature_id);
        return r.ok ? pass() : fail(`integrity fail for ${inv.feature_id}: missing[${r.missing}] mismatch[${r.mismatches}]`);
      }
```

- [ ] **Step 9: Document the writer contract**

In `agents/e2e-runner.md` and `skills/auto/SKILL.md` (SECTION 6 "On PASS" / artifact capture), add a sentence: after capturing `verification/<id>.{json,png}`, call `node -e "require('.claude/hooks/lib/artifact-integrity.js').writeSidecar(process.cwd(),'<id>',['verification/<id>.json','verification/<id>.png'])"`, then `git add` the artifact **and** its `.sha256.json` sidecar **before** editing `feature_list.json`.

- [ ] **Step 10: Commit**

```bash
git add hooks/e2e-gate.js scripts/verify-artifacts.js scripts/check-invariants.js agents/e2e-runner.md skills/auto/SKILL.md scripts/__tests__/e2e-gate-integrity.test.sh
git commit -m "feat: enforce sha256 artifact integrity in e2e-gate + verify-artifacts + invariant type"
```

---

### Task 5: jscpd duplication gate (`scripts/jscpd-gate.js`)

**Files:**
- Create: `scripts/jscpd-gate.js`
- Create: `templates/.jscpd.json.template`
- Create: `state/duplication-baseline.txt` (content: `100`)
- Create: `scripts/__fixtures__/jscpd/dup/a.js`, `scripts/__fixtures__/jscpd/dup/b.js`
- Test: `scripts/__tests__/jscpd-gate.test.sh`

**Interfaces:**
- Produces: CLI `node scripts/jscpd-gate.js [--paths <dir>...] [--baseline <file>]`. Exit `2` on ratchet regression; `0` on pass; `0` + `NOT_RUN` when jscpd/npx unavailable. Writes `specs/reviews/jscpd-report.json`.

- [ ] **Step 1: Create duplicated fixtures**

`scripts/__fixtures__/jscpd/dup/a.js`:
```javascript
function computeTotals(rows) {
  let sum = 0; let count = 0;
  for (const r of rows) { sum += r.value; count += 1; }
  return { sum, count, avg: count ? sum / count : 0 };
}
module.exports = { computeTotals };
```

`scripts/__fixtures__/jscpd/dup/b.js` (intentional near-duplicate):
```javascript
function computeTotals(rows) {
  let sum = 0; let count = 0;
  for (const r of rows) { sum += r.value; count += 1; }
  return { sum, count, avg: count ? sum / count : 0 };
}
module.exports = { computeTotals };
```

- [ ] **Step 2: Write the failing test**

Create `scripts/__tests__/jscpd-gate.test.sh`:
```bash
#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# If npx/jscpd unavailable, the gate must NOT_RUN (exit 0) — assert that path too.
node scripts/jscpd-gate.js --paths scripts/__fixtures__/jscpd/dup --baseline /tmp/jscpd-zero-baseline.txt >/tmp/jscpd-out.txt 2>&1
code=$?
if grep -q "NOT_RUN" /tmp/jscpd-out.txt; then
  echo "jscpd-gate: NOT_RUN (jscpd unavailable) — treated as pass"; exit 0
fi
# With jscpd present and a 0% baseline, the duplicated fixture must regress -> exit 2
[ "$code" = "2" ] && echo "jscpd-gate: ALL PASS (regression detected)" || { echo "FAIL: expected 2 on duplicated fixture vs 0 baseline, got $code"; exit 1; }
```

Before running, seed a zero baseline: `echo 0 > /tmp/jscpd-zero-baseline.txt`

- [ ] **Step 3: Run test to verify it fails**

Run: `echo 0 > /tmp/jscpd-zero-baseline.txt && bash scripts/__tests__/jscpd-gate.test.sh`
Expected: FAIL — `scripts/jscpd-gate.js` does not exist.

- [ ] **Step 4: Implement `scripts/jscpd-gate.js`**

```javascript
#!/usr/bin/env node
'use strict';
// Duplication gate. Runs jscpd via npx, ratchets against a baseline.
// Folded into the lint-drift gate (not a numbered ratchet gate).
// Exit 2 on regression; 0 on pass; 0 + NOT_RUN when jscpd unavailable.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function notRun(msg) { process.stderr.write(`NOT_RUN: jscpd gate skipped — ${msg}\n`); process.exit(0); }

function parseArgs(argv) {
  const args = { paths: [], baseline: path.join(process.cwd(), 'state', 'duplication-baseline.txt') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--paths') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.paths.push(argv[++i]); }
    else if (argv[i] === '--baseline') args.baseline = argv[++i];
  }
  if (args.paths.length === 0) args.paths = ['backend', 'frontend', 'src'].filter((d) => fs.existsSync(path.join(process.cwd(), d)));
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.paths.length === 0) notRun('no source paths to scan');

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-'));
  try {
    execFileSync('npx', ['--yes', 'jscpd', '--silent', '--reporters', 'json', '--output', outDir, ...args.paths],
      { cwd: process.cwd(), stdio: 'ignore' });
  } catch (e) {
    // jscpd exits non-zero when threshold exceeded; we still want its report.
    if (!fs.existsSync(path.join(outDir, 'jscpd-report.json'))) notRun(`jscpd/npx unavailable or failed: ${e.message}`);
  }

  const reportPath = path.join(outDir, 'jscpd-report.json');
  if (!fs.existsSync(reportPath)) notRun('jscpd produced no report');
  let pct;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    pct = report.statistics.total.percentage; // % duplicated lines
  } catch (e) { notRun(`unparseable jscpd report: ${e.message}`); }

  // persist a copy of the report for reviewers
  const reviewsDir = path.join(process.cwd(), 'specs', 'reviews');
  fs.mkdirSync(reviewsDir, { recursive: true });
  fs.copyFileSync(reportPath, path.join(reviewsDir, 'jscpd-report.json'));

  const ABS_CAP = 10;
  let baseline = 100;
  if (fs.existsSync(args.baseline)) {
    const raw = parseFloat(fs.readFileSync(args.baseline, 'utf8').trim());
    if (!Number.isNaN(raw)) baseline = raw;
  }

  process.stdout.write(`jscpd: ${pct.toFixed(2)}% duplicated (baseline ${baseline}%, cap ${ABS_CAP}%)\n`);

  if (pct > ABS_CAP) { process.stderr.write(`FAIL: duplication ${pct.toFixed(2)}% exceeds absolute cap ${ABS_CAP}%\n`); process.exit(2); }
  if (pct > baseline + 1e-9) { process.stderr.write(`FAIL: duplication ${pct.toFixed(2)}% regressed past baseline ${baseline}%\n`); process.exit(2); }

  // ratchet down (or seed from sentinel 100)
  if (pct < baseline) {
    fs.mkdirSync(path.dirname(args.baseline), { recursive: true });
    fs.writeFileSync(args.baseline, pct.toFixed(2) + '\n');
    process.stdout.write(`baseline ratcheted to ${pct.toFixed(2)}%\n`);
  }
  process.exit(0);
}

main(process.argv);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `echo 0 > /tmp/jscpd-zero-baseline.txt && bash scripts/__tests__/jscpd-gate.test.sh`
Expected: either `jscpd-gate: ALL PASS (regression detected)` (jscpd present) OR `jscpd-gate: NOT_RUN` (jscpd absent). Both are exit 0 from the test.

- [ ] **Step 6: Create `templates/.jscpd.json.template` and baseline**

`templates/.jscpd.json.template`:
```json
{
  "minTokens": 50,
  "absoluteThreshold": 10,
  "reporters": ["json"],
  "ignore": ["**/node_modules/**", "**/.next/**", "**/mutants/**", "**/__pycache__/**", "**/*.test.*", "**/tests/**", "**/__fixtures__/**"]
}
```

Create `state/duplication-baseline.txt`:
```
100
```

- [ ] **Step 7: Commit**

```bash
git add scripts/jscpd-gate.js templates/.jscpd.json.template state/duplication-baseline.txt scripts/__fixtures__/jscpd scripts/__tests__/jscpd-gate.test.sh
git commit -m "feat: jscpd duplication gate with baseline ratchet + graceful NOT_RUN"
```

---

### Task 6: Wire jscpd into lint-drift + auto + Makefile + CI

**Files:**
- Modify: `skills/lint-drift/SKILL.md`
- Modify: `skills/auto/SKILL.md`
- Modify: `templates/Makefile.template`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/jscpd-gate.js` from Task 5.

- [ ] **Step 1: Add a Duplication section to `skills/lint-drift/SKILL.md`**

Append a section:
```markdown
## Duplication check (jscpd)

Entropy control includes a copy-paste ratchet. Run:

    node .claude/scripts/jscpd-gate.js

It runs jscpd over the project's source dirs, compares the duplicated-line
percentage against `state/duplication-baseline.txt` (never regress; absolute
cap 10%), and ratchets the baseline down on improvement. If jscpd/npx is
unavailable it exits 0 with NOT_RUN (never a false pass). On regression
(exit 2), extract the duplicated block into a shared helper — do not
suppress the finding.
```

- [ ] **Step 2: Reference it in `skills/auto/SKILL.md`**

In SECTION 5 near Gate 4 (architecture/entropy) and the self-heal category table, add a row: `Duplication | jscpd % over baseline | extract shared helper / dedupe (node .claude/scripts/jscpd-gate.js)`. Note it runs inside the lint-drift/entropy gate, not as a new numbered gate.

- [ ] **Step 3: Add a `dup` target to `templates/Makefile.template`**

```makefile
.PHONY: dup
dup: ## Run the jscpd duplication gate
	node .claude/scripts/jscpd-gate.js
```

- [ ] **Step 4: Add a non-blocking CI step to `.github/workflows/ci.yml`**

```yaml
      - name: Duplication (jscpd, dogfood self-scan)
        continue-on-error: true
        run: node scripts/jscpd-gate.js --paths scripts hooks
```

- [ ] **Step 5: Verify the skills still read as valid markdown + CI valid**

Run: `head -5 skills/lint-drift/SKILL.md && node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add skills/lint-drift/SKILL.md skills/auto/SKILL.md templates/Makefile.template .github/workflows/ci.yml
git commit -m "feat: wire jscpd duplication gate into lint-drift, auto, Makefile, CI"
```

---

### Task 7: Validation + docs + full green

**Files:**
- Modify: `scripts/validate-scaffold.sh`
- Modify: `CLAUDE.md`
- Create: `scripts/test-quality-gates.sh`

- [ ] **Step 1: Create the aggregate test runner `scripts/test-quality-gates.sh`**

```bash
#!/usr/bin/env bash
# Runs all three quality-gate test suites. Run from forge root.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
rc=0
echo "== check-invariants =="; bash scripts/__tests__/check-invariants.test.sh || rc=1
echo "== artifact-integrity =="; node scripts/__tests__/artifact-integrity.test.js || rc=1
echo "== e2e-gate integrity =="; bash scripts/__tests__/e2e-gate-integrity.test.sh || rc=1
echo "== jscpd gate =="; echo 0 > /tmp/jscpd-zero-baseline.txt; bash scripts/__tests__/jscpd-gate.test.sh || rc=1
[ "$rc" = "0" ] && echo "ALL QUALITY-GATE TESTS PASS" || echo "QUALITY-GATE TEST FAILURES"
exit $rc
```

- [ ] **Step 2: Run the aggregate suite**

Run: `bash scripts/test-quality-gates.sh`
Expected: `ALL QUALITY-GATE TESTS PASS`, exit 0.

- [ ] **Step 3: Extend `scripts/validate-scaffold.sh`**

Add `check_file` lines (in the forge-mode file-check region) for: `scripts/check-invariants.js`, `scripts/jscpd-gate.js`, `scripts/verify-artifacts.js`, `hooks/lib/artifact-integrity.js`, `config/invariants.yaml`, `commands/invariants.md`, `templates/.jscpd.json.template`, `state/duplication-baseline.txt`. Add a grep assertion that `hooks/e2e-gate.js` contains `verifySidecar` and `.github/workflows/ci.yml` contains `check-invariants.js`.

- [ ] **Step 4: Update `CLAUDE.md`**

Add a row to the "BRD v3.0 additions" table documenting the three features (jscpd duplication ratchet under lint-drift; sha256 artifact integrity in e2e-gate; invariants parser + `/invariants`). Update the commands count (+1 for `/invariants`) and note `config/invariants.yaml`.

- [ ] **Step 5: Run the full forge validation**

Run: `bash scripts/validate-scaffold.sh && node scripts/check-invariants.js && bash scripts/test-quality-gates.sh`
Expected: all exit 0, zero failures.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-scaffold.sh CLAUDE.md scripts/test-quality-gates.sh
git commit -m "test: validate three quality-gate features + document in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:** jscpd gate → Tasks 5-6; sha256-integrity → Tasks 3-4; invariants parser → Tasks 1-2; `artifact_integrity` cohesion type → Task 4 Step 8; CI swap → Task 2; validation/docs → Task 7. All spec sections covered.

**Placeholder scan:** every code/test step contains full source. Task 2/4 Steps that say "identified in Step 1" pair a read-step with concrete follow-up code; no bare TODOs.

**Type consistency:** `writeSidecar`/`verifySidecar`/`sidecarRel`/`computeSha256` names match across Tasks 3, 4, 7. `evaluateInvariant`/`parseInvariantsYaml` match across Tasks 1, 4. Baseline sentinel `100` consistent between `state/duplication-baseline.txt` and `jscpd-gate.js`.
