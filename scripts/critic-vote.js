#!/usr/bin/env node

'use strict';

// critic-vote — orchestrate a 3-instance majority-vote re-verification
// at the E2E merge boundary (BRD v3.2.2).
//
// Usage:
//   node scripts/critic-vote.js <feature-id>
//   node scripts/critic-vote.js <feature-id> --dry-run   # skip actual spawning
//
// The three Critic spawns are performed by the Claude Code runtime via
// the SDK Agent tool — this script prepares the vote input, invokes
// three subagent runs, collects their structured returns, computes
// per-axis 2-of-3 majority, and writes verification/<id>.votes.json.
//
// This script is invokable in two shapes:
//   1. As a coding-agent hand-off tool — the agent calls it via Bash.
//   2. As a synchronous CLI — for CI or manual verification runs.
//
// In shape 1 the actual Critic spawns happen via the SDK Agent tool
// (from the coding-agent's context) with 3 separate Task invocations.
// This script emits the vote scaffold and reads the returned verdicts
// from state/critic-votes/<feature-id>-vote-<n>.json — the coding-agent
// writes these files as each Critic spawn returns.
//
// In shape 2 (--sync) the script does not spawn — it reads the same
// state files as they're populated by an out-of-band process. If they
// don't materialize within a timeout, all missing voters count as
// BLOCK on every axis (fail-safe).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write('usage: critic-vote.js <feature-id> [--dry-run] [--timeout-seconds N]\n');
  process.exit(1);
}
const featureId = argv[0];
const dryRun = argv.includes('--dry-run');
const timeoutIdx = argv.indexOf('--timeout-seconds');
const timeoutS = timeoutIdx >= 0 ? parseInt(argv[timeoutIdx + 1], 10) || 300 : 300;

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const FEATURE_LIST = path.join(ROOT, 'feature_list.json');
const VOTE_DIR = path.join(ROOT, 'state', 'critic-votes');
const VERIFY_DIR = path.join(ROOT, 'verification');
try { fs.mkdirSync(VOTE_DIR, { recursive: true }); } catch (_) {}
try { fs.mkdirSync(VERIFY_DIR, { recursive: true }); } catch (_) {}

// Load feature entry
if (!fs.existsSync(FEATURE_LIST)) { process.stderr.write(`no feature_list.json at ${ROOT}\n`); process.exit(1); }
let features;
try { features = JSON.parse(fs.readFileSync(FEATURE_LIST, 'utf8')); }
catch (e) { process.stderr.write(`invalid feature_list.json: ${e.message}\n`); process.exit(1); }
const entry = features.find(e => e && e.id === featureId);
if (!entry) { process.stderr.write(`no feature entry: ${featureId}\n`); process.exit(1); }

// Determine axes
const axes = ['correctness', 'spec-scope', 'e2e-artifact'];
if (touchesSecuritySurface(entry)) axes.push('security');

// Prepare vote input
const gitSha = safeGitSha();
const votePrepPath = path.join(VOTE_DIR, `${featureId}-input.json`);
const voteInput = {
  feature_id: featureId,
  git_sha: gitSha,
  entry,
  axes,
  brd_refs: entry.source_section ? [entry.source_section] : [],
  prepared_at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
};
fs.writeFileSync(votePrepPath, JSON.stringify(voteInput, null, 2));

if (dryRun) {
  process.stdout.write(`vote input prepared: ${path.relative(ROOT, votePrepPath)}\n`);
  process.stdout.write(`axes: ${axes.join(', ')}\n`);
  process.stdout.write('(dry-run — no spawns; no votes.json written)\n');
  process.exit(0);
}

// Wait for 3 vote files to appear
const voteFiles = [1, 2, 3].map(n => path.join(VOTE_DIR, `${featureId}-vote-${n}.json`));
process.stdout.write(`critic-vote: waiting for 3 spawns to write votes to ${path.relative(ROOT, VOTE_DIR)}/...\n`);
process.stdout.write('The coding-agent is expected to spawn 3 Task/Agent subagents (fresh context, no shared conversation) with the input.json and the entry\'s diff, and each writes its return here.\n');

const deadline = Date.now() + timeoutS * 1000;
const votes = [null, null, null];
const failures = [];

// Poll (up to timeoutS seconds)
while (Date.now() < deadline && votes.some(v => v === null)) {
  for (let i = 0; i < 3; i++) {
    if (votes[i] !== null) continue;
    if (!fs.existsSync(voteFiles[i])) continue;
    try {
      const v = JSON.parse(fs.readFileSync(voteFiles[i], 'utf8'));
      votes[i] = v;
    } catch (e) {
      failures.push({ voter: i + 1, error: 'invalid JSON: ' + e.message });
      votes[i] = { verdict: 'ERROR', axes: {} };
    }
  }
  if (votes.every(v => v !== null)) break;
  sleepSync(500);
}

// Fill in missing voters as fail-safe BLOCK
for (let i = 0; i < 3; i++) {
  if (votes[i] === null) {
    failures.push({ voter: i + 1, error: 'timeout — no vote file written within ' + timeoutS + 's' });
    votes[i] = { verdict: 'TIMEOUT', axes: {} };
  }
}

// Compute per-axis majority (fail-safe: missing/error voter counts as BLOCK)
const axisTally = {};
for (const axis of axes) {
  const perAxis = votes.map(v => (v.axes && v.axes[axis]) || 'BLOCK');
  const passCount = perAxis.filter(x => x === 'PASS').length;
  const majority = passCount >= 2 ? 'PASS' : 'BLOCK';
  axisTally[axis] = { majority, votes: perAxis };
}

const allPass = axes.every(a => axisTally[a].majority === 'PASS');
const verdict = allPass ? 'APPROVED' : 'BLOCKED';

const output = {
  feature_id: featureId,
  verdict,
  voted_at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
  git_sha: gitSha,
  axes: axisTally,
  voter_failures: failures,
  elapsed_ms: 0,   // set below
};

const outPath = path.join(VERIFY_DIR, `${featureId}.votes.json`);
output.elapsed_ms = Date.now() - Date.parse(voteInput.prepared_at);
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

// Cleanup vote scratch (retain input.json for audit; clear vote-N.json)
for (const vf of voteFiles) {
  try { if (fs.existsSync(vf)) fs.unlinkSync(vf); } catch (_) {}
}

process.stdout.write(`critic-vote: ${verdict}\n`);
process.stdout.write(`  wrote ${path.relative(ROOT, outPath)}\n`);
for (const a of axes) {
  process.stdout.write(`  ${a}: majority=${axisTally[a].majority} votes=[${axisTally[a].votes.join(', ')}]\n`);
}
if (failures.length > 0) {
  process.stdout.write(`  voter failures: ${failures.length}\n`);
  for (const f of failures) process.stdout.write(`    voter ${f.voter}: ${f.error}\n`);
}

process.exit(verdict === 'APPROVED' ? 0 : 2);

// -- helpers --

function touchesSecuritySurface(entry) {
  // Deterministic trigger, matching hooks/pre-bash-gate.js sensitive paths + security keywords
  const text = [(entry.description || ''), (entry.category || ''), ...(entry.steps || [])].join(' ').toLowerCase();
  const patterns = [
    /\bauth(entication|orization)?\b/,
    /\btoken\b/,
    /\bsecret/,
    /\bpassword/,
    /\boauth/,
    /\bjwt\b/,
    /\bapi[_ -]?key/,
    /\bupload/,
    /\bmigrat(e|ion)/,
    /\bpayment/,
    /\bwebhook/,
  ];
  return patterns.some(re => re.test(text));
}

function safeGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'no-git';
  } catch (_) { return 'no-git'; }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy wait */ }
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
