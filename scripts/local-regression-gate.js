#!/usr/bin/env node

'use strict';

// local-regression-gate — impact-scoped regression sensor (BRD v3.2.4).
//
// The fast-path counterpart to regression-gate.js: only checks
// features whose owning files intersect the current impact scope
// (as computed by scripts/impact-scope.js). Safe to run per-feature
// during /change or /vibe lanes.
//
// Usage:
//   node scripts/local-regression-gate.js              # diff HEAD~1..HEAD
//   node scripts/local-regression-gate.js --staged      # diff --cached
//   node scripts/local-regression-gate.js --strict       # exit 2 on regression
//   node scripts/local-regression-gate.js --for <feature-id>  # scope to one feature's paths

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const staged = argv.includes('--staged');
const forIdx = argv.indexOf('--for');
const forFeatureId = forIdx >= 0 ? argv[forIdx + 1] : null;

// 1. Compute impact scope by invoking impact-scope.js
const impactArgs = ['--format', 'json'];
if (staged) impactArgs.unshift('--staged');

// Resolve impact-scope.js — try project's scripts/, .claude/scripts/,
// then this script's own directory (works in both forge repo and
// scaffolded target).
const impactScopeCandidates = [
  path.join(ROOT, 'scripts', 'impact-scope.js'),
  path.join(ROOT, '.claude', 'scripts', 'impact-scope.js'),
  path.resolve(__dirname, 'impact-scope.js'),
];
const impactScopePath = impactScopeCandidates.find(p => fs.existsSync(p));
if (!impactScopePath) {
  process.stderr.write('impact-scope.js not found in scripts/, .claude/scripts/, or __dirname\n');
  process.exit(1);
}

let impact;
try {
  const out = execFileSync('node', [impactScopePath, ...impactArgs], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  impact = JSON.parse(out);
} catch (e) {
  process.stderr.write(`impact-scope.js failed: ${e.message}\n`);
  process.exit(1);
}

// 2. Load feature list, filter to impacted passing features
const featureListPath = path.join(ROOT, 'feature_list.json');
if (!fs.existsSync(featureListPath)) {
  process.stderr.write('no feature_list.json — nothing to gate\n');
  process.exit(0);
}
let features;
try { features = JSON.parse(fs.readFileSync(featureListPath, 'utf8')); }
catch (e) { process.stderr.write(`feature_list.json invalid: ${e.message}\n`); process.exit(1); }

let checkSet;
if (forFeatureId) {
  const f = features.find(x => x && x.id === forFeatureId);
  checkSet = f ? [f] : [];
} else {
  const impactedIds = new Set((impact.impacted_features || []).map(x => x.id));
  checkSet = features.filter(f => f && f.passes === true && impactedIds.has(f.id));
}

if (checkSet.length === 0) {
  process.stdout.write(`local-regression-gate: no previously-passing features impacted by current diff (blast radius: ${(impact.blast_radius || []).length} files, impacted features: ${(impact.impacted_features || []).length})\n`);
  process.exit(0);
}

// 3. Check each — same artifact-level checks as regression-gate.js
const results = [];
for (const feat of checkSet) {
  const artifactRel = feat.verification_artifact_path;
  if (!artifactRel) {
    results.push({ id: feat.id, status: 'MISSING_PATH', reason: 'entry has no verification_artifact_path' });
    continue;
  }
  const abs = path.join(ROOT, artifactRel);
  if (!fs.existsSync(abs)) {
    results.push({ id: feat.id, status: 'MISSING', reason: `${artifactRel} does not exist` });
    continue;
  }
  const stat = fs.statSync(abs);
  if (stat.size === 0) {
    results.push({ id: feat.id, status: 'EMPTY', reason: `${artifactRel} is empty` });
    continue;
  }
  results.push({ id: feat.id, status: 'OK', artifact: artifactRel });
}

const failed = results.filter(r => r.status !== 'OK');
const summary = {
  gate: 'local-regression',
  brd_ref: 'v3.2.4',
  ran_at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
  impact_scope_files: (impact.blast_radius || []).length,
  impacted_features_total: (impact.impacted_features || []).length,
  checked: checkSet.length,
  ok: results.filter(r => r.status === 'OK').length,
  failed: failed.length,
  for_feature: forFeatureId || null,
  results,
};

// Write per-feature artifact when --for is set (consumed by e2e-gate)
if (forFeatureId) {
  const outRel = `verification/${forFeatureId}.local-regression.json`;
  const outAbs = path.join(ROOT, outRel);
  try { fs.mkdirSync(path.dirname(outAbs), { recursive: true }); } catch (_) {}
  fs.writeFileSync(outAbs, JSON.stringify(summary, null, 2));
  process.stdout.write(`local-regression-gate: wrote ${outRel}\n`);
}

process.stdout.write(`local-regression-gate: ${summary.ok}/${summary.checked} impacted features OK\n`);
if (failed.length > 0) {
  process.stdout.write('\nRegressions in impact scope:\n');
  for (const f of failed) process.stdout.write(`  ${f.status}: ${f.id} — ${f.reason}\n`);
}

if (strict && failed.length > 0) process.exit(2);
process.exit(0);

function findProjectRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'feature_list.json')) ||
      fs.existsSync(path.join(current, '.claude')) ||
      fs.existsSync(path.join(current, '.git'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
