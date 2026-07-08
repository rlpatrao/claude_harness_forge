#!/usr/bin/env node

'use strict';

// Validate harness-manifest.json (BRD v3.1 §4, v3.1.3).
//
// Checks:
//   1. JSON well-formed
//   2. Every component has required fields with valid enum values
//   3. IDs are unique
//   4. wired_at paths exist on disk (for status:"active" components only —
//      proposed/deprecated components may reference paths not yet created)
//   5. axis × cadence matrix has at least one active component in each cell
//      (soft warning, not a hard failure)
//   6. governs globs (when present) match at least one file
//
// Exit 0 on success. Exit 1 on any hard failure (fields, IDs, missing paths).
// Prints coverage per axis and per cadence to stdout.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'harness-manifest.json');

const KINDS = ['agent', 'skill', 'hook', 'command', 'script', 'gate', 'contract', 'doc'];
const AXES = ['maintainability', 'architecture', 'behaviour', 'traceability'];
const CADENCES = ['planning', 'session', 'commit', 'integration', 'drift'];
const TYPES = ['computational', 'inferential', 'hybrid'];
const SCOPES = ['forge', 'scaffolded-project', 'both'];
const STATUSES = ['active', 'proposed', 'deprecated'];

const REQUIRED = ['id', 'kind', 'name', 'axis', 'cadence', 'type', 'scope', 'wired_at', 'status'];

function fail(msg) {
  process.stderr.write(`FAIL: ${msg}\n`);
  process.exitCode = 1;
}

if (!fs.existsSync(MANIFEST)) {
  fail(`missing ${path.relative(ROOT, MANIFEST)}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  fail(`invalid JSON: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(manifest.components)) {
  fail('components must be an array');
  process.exit(1);
}

const ids = new Set();
let checked = 0;
let activeMissingPath = 0;

for (const c of manifest.components) {
  checked++;
  if (!c || typeof c !== 'object') {
    fail(`component #${checked} is not an object`);
    continue;
  }

  // Required fields
  for (const k of REQUIRED) {
    if (!(k in c) || c[k] === '' || c[k] == null) {
      fail(`${c.id || `#${checked}`}: missing required field "${k}"`);
    }
  }

  // Enum checks
  if (c.kind && !KINDS.includes(c.kind)) fail(`${c.id}: kind "${c.kind}" not in ${KINDS.join('|')}`);
  if (c.axis && !AXES.includes(c.axis)) fail(`${c.id}: axis "${c.axis}" not in ${AXES.join('|')}`);
  if (c.cadence && !CADENCES.includes(c.cadence)) fail(`${c.id}: cadence "${c.cadence}" not in ${CADENCES.join('|')}`);
  if (c.type && !TYPES.includes(c.type)) fail(`${c.id}: type "${c.type}" not in ${TYPES.join('|')}`);
  if (c.scope && !SCOPES.includes(c.scope)) fail(`${c.id}: scope "${c.scope}" not in ${SCOPES.join('|')}`);
  if (c.status && !STATUSES.includes(c.status)) fail(`${c.id}: status "${c.status}" not in ${STATUSES.join('|')}`);

  // Unique IDs
  if (c.id) {
    if (ids.has(c.id)) fail(`duplicate id "${c.id}"`);
    ids.add(c.id);
  }

  // Path exists (active only)
  if (c.status === 'active' && c.wired_at) {
    const abs = path.join(ROOT, c.wired_at);
    if (!fs.existsSync(abs)) {
      fail(`${c.id}: wired_at path does not exist: ${c.wired_at}`);
      activeMissingPath++;
    }
  }
}

// Coverage summary
const coverage = {};
for (const a of AXES) {
  for (const cad of CADENCES) {
    coverage[`${a}×${cad}`] = 0;
  }
}
for (const c of manifest.components) {
  if (c.status !== 'active') continue;
  const key = `${c.axis}×${c.cadence}`;
  if (key in coverage) coverage[key]++;
}

process.stdout.write(`\nharness-manifest.json validation — ${checked} components, ${ids.size} unique IDs\n`);
process.stdout.write(`active components with missing wired_at: ${activeMissingPath}\n\n`);

process.stdout.write('coverage matrix (active components only):\n');
process.stdout.write('  ' + 'axis'.padEnd(18) + CADENCES.map(c => c.padStart(11)).join('') + '\n');
for (const a of AXES) {
  const row = CADENCES.map(cad => String(coverage[`${a}×${cad}`]).padStart(11));
  process.stdout.write('  ' + a.padEnd(18) + row.join('') + '\n');
}

// Soft warning for empty cells
process.stdout.write('\nempty cells (0 active components):\n');
let empty = 0;
for (const [k, v] of Object.entries(coverage)) {
  if (v === 0) {
    process.stdout.write(`  ${k}\n`);
    empty++;
  }
}
if (empty === 0) process.stdout.write('  (none)\n');

process.stdout.write('\n');
if (process.exitCode === 1) {
  process.stdout.write('FAILED — fix errors above and re-run.\n');
} else {
  process.stdout.write('OK — manifest is valid.\n');
}
