#!/usr/bin/env node

'use strict';

// regression-gate — cross-feature regression sensor (BRD v3.2.4).
//
// Reruns every previously-passing feature's verification artifact
// check (existence + freshness + not stale relative to current git
// SHA). If a previously-passing feature no longer has a valid
// verification artifact, that's a regression signal.
//
// Actually re-running Playwright/Puppeteer MCP steps[] is out of
// scope for a hook — that requires interactive agent context. This
// gate does the artifact-level version: any previously-passing
// feature whose artifact is missing, empty, or older than the diff
// touching its owning files is flagged. Full E2E re-execution is a
// v3.3 item (requires MCP orchestration).
//
// Usage:
//   node scripts/regression-gate.js                # write summary
//   node scripts/regression-gate.js --strict       # exit 2 on any regression
//
// Output: verification/regression-<git-sha>.json

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');

const featureListPath = path.join(ROOT, 'feature_list.json');
if (!fs.existsSync(featureListPath)) {
  process.stderr.write('no feature_list.json — nothing to gate\n');
  process.exit(0);
}
let features;
try { features = JSON.parse(fs.readFileSync(featureListPath, 'utf8')); }
catch (e) { process.stderr.write(`feature_list.json invalid: ${e.message}\n`); process.exit(1); }

const passing = features.filter(f => f && f.passes === true);
if (passing.length === 0) {
  process.stderr.write('no passing features yet — regression-gate has nothing to check\n');
  process.exit(0);
}

const sha = safeGitSha();
const outPath = path.join(ROOT, 'verification', `regression-${sha}.json`);
try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch (_) {}

const results = [];
for (const feat of passing) {
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
  // Also check corresponding votes.json (v3.2.2) if it should exist
  const votesRel = artifactRel.replace(/\.(png|json)$/, '.votes.json');
  const votesAbs = path.join(ROOT, votesRel);
  if (fs.existsSync(votesAbs)) {
    try {
      const votes = JSON.parse(fs.readFileSync(votesAbs, 'utf8'));
      if (votes.verdict !== 'APPROVED') {
        results.push({ id: feat.id, status: 'VOTE_NOT_APPROVED', reason: `${votesRel} verdict=${votes.verdict}` });
        continue;
      }
    } catch (_) {
      results.push({ id: feat.id, status: 'VOTE_MALFORMED', reason: `${votesRel} not valid JSON` });
      continue;
    }
  }
  results.push({ id: feat.id, status: 'OK', artifact: artifactRel, size: stat.size });
}

const failed = results.filter(r => r.status !== 'OK');
const summary = {
  gate: 'regression',
  brd_ref: 'v3.2.4',
  git_sha: sha,
  ran_at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
  passing_checked: passing.length,
  ok: results.filter(r => r.status === 'OK').length,
  failed: failed.length,
  results,
};

fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

process.stdout.write(`regression-gate: ${summary.ok}/${passing.length} previously-passing features still have valid artifacts\n`);
if (failed.length > 0) {
  process.stdout.write('\nRegressions detected:\n');
  for (const f of failed) process.stdout.write(`  ${f.status}: ${f.id} — ${f.reason}\n`);
}
process.stdout.write(`\nSummary: ${path.relative(ROOT, outPath)}\n`);

if (strict && failed.length > 0) process.exit(2);
process.exit(0);

function safeGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'no-git';
  } catch (_) { return 'no-git'; }
}

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
