#!/usr/bin/env node

'use strict';


// Cleanup-plan Phase 2 (2026-07-21): fire-log instrumentation.
try { require('./lib/fire-log.js')('e2e-gate'); } catch (_) {}

// PreToolUse hook (BRD §3.8). When an Edit or Write would flip a
// feature_list.json entry's passes:false → true, require that the
// entry's verification_artifact_path exists in the working tree AND is
// staged or committed in git. Reject otherwise with exit code 2.
//
// This runs BEFORE feature-edit-guard.js so that an edit failing the
// E2E gate is rejected with a more specific message about the missing
// artifact. feature-edit-guard.js then performs the structural check.
//
// Defensive: exit 0 on any infra failure so a hook bug never blocks
// legitimate non-flip work. We only ever block when we have strong
// evidence the user is trying to flip a passes field without a real
// artifact.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// BRD v3.3 §3.7: log rejections into state/rejections.jsonl so
// correction-detector.js (Stop hook) can mine recurring corrections
// into rule candidates. Defensive require — hook never crashes.
let logRejection = null;
try {
  logRejection = require('./lib/log-rejection.js');
} catch (_) {
  try { logRejection = require(path.join(__dirname, 'lib', 'log-rejection.js')); }
  catch (_) { logRejection = null; }
}

// sha256 artifact-integrity: verify the committed artifact matches its
// sidecar of hashes before allowing a passes flip. Defensive require.
let artifactIntegrity = null;
try {
  artifactIntegrity = require('./lib/artifact-integrity.js');
} catch (_) {
  try { artifactIntegrity = require(path.join(__dirname, 'lib', 'artifact-integrity.js')); }
  catch (_) { artifactIntegrity = null; }
}

function block(featureId, artifactPath, reason) {
  process.stderr.write(`BLOCKED: passes flip on "${featureId}" rejected — ${reason}\n`);
  process.stderr.write(`Per BRD §3.8: a Playwright or Puppeteer MCP session must execute the feature's steps[] and commit the verification artifact to ${artifactPath} before the flip.\n`);
  if (logRejection && logRejection.appendRejection) {
    logRejection.appendRejection({
      source: 'e2e-gate',
      verdict: 'block',
      reason,
      file: artifactPath,
      tool: 'Edit',
      session_id: (typeof input !== 'undefined' && input && input.session_id) || null,
    });
  }
  process.exit(2);
}

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const toolName = input.tool_name || '';
if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

const ti = input.tool_input || {};
const filePath = ti.file_path;
if (!filePath || path.basename(filePath) !== 'feature_list.json') process.exit(0);

const absPath = path.resolve(filePath);
const projectDir = path.dirname(absPath);

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

let oldList = null;
let newList = null;

if (toolName === 'Write') {
  if (!fs.existsSync(absPath)) process.exit(0);
  oldList = readJsonSafe(absPath);
  const content = ti.content;
  if (typeof content !== 'string' || !Array.isArray(oldList)) process.exit(0);
  try { newList = JSON.parse(content); } catch (_) { process.exit(0); }
} else {
  if (!fs.existsSync(absPath)) process.exit(0);
  oldList = readJsonSafe(absPath);
  if (!Array.isArray(oldList)) process.exit(0);

  const oldStr = ti.old_string;
  const newStr = ti.new_string;
  const replaceAll = ti.replace_all === true;
  if (typeof oldStr !== 'string' || typeof newStr !== 'string') process.exit(0);
  const currentContent = fs.readFileSync(absPath, 'utf8');
  let newContent;
  if (replaceAll) {
    newContent = currentContent.split(oldStr).join(newStr);
  } else {
    const idx = currentContent.indexOf(oldStr);
    if (idx === -1) process.exit(0);
    newContent = currentContent.slice(0, idx) + newStr + currentContent.slice(idx + oldStr.length);
  }
  try { newList = JSON.parse(newContent); } catch (_) { process.exit(0); }
}

if (!Array.isArray(newList)) process.exit(0);
if (oldList.length !== newList.length) process.exit(0); // structural mismatch is feature-edit-guard's domain

const flipped = [];
for (let i = 0; i < oldList.length; i++) {
  const o = oldList[i];
  const n = newList[i];
  if (!o || !n) continue;
  if (o.passes === false && n.passes === true) {
    flipped.push(n);
  }
}

if (flipped.length === 0) process.exit(0);

function isTrackedInGit(file) {
  try {
    execSync(`git ls-files --error-unmatch -- ${JSON.stringify(file)}`, {
      cwd: projectDir,
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 5000,
    });
    return true;
  } catch (_) {
    return false;
  }
}

function isStagedInGit(file) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      cwd: projectDir, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).split('\n').map(s => s.trim()).filter(Boolean);
    return staged.includes(file);
  } catch (_) {
    return false;
  }
}

for (const entry of flipped) {
  const artifactRel = entry.verification_artifact_path;
  if (!artifactRel || typeof artifactRel !== 'string') {
    block(entry.id || '<unknown>', '<unspecified>',
          'entry has no verification_artifact_path field');
  }
  const artifactAbs = path.resolve(projectDir, artifactRel);
  if (!fs.existsSync(artifactAbs)) {
    block(entry.id, artifactRel,
          `artifact file does not exist on disk at ${artifactRel}`);
  }
  if (!(isTrackedInGit(artifactRel) || isStagedInGit(artifactRel))) {
    block(entry.id, artifactRel,
          `artifact at ${artifactRel} exists on disk but is neither committed nor staged in git (run: git add ${artifactRel})`);
  }
  const stat = fs.statSync(artifactAbs);
  if (stat.size === 0) {
    block(entry.id, artifactRel,
          `artifact at ${artifactRel} is empty — expected a screenshot, DOM assertion, or JSON proof-of-state`);
  }

  // sha256 integrity: the artifact must match its committed sidecar of
  // hashes (verification/<id>.sha256.json). Closes the hole where an
  // artifact is hand-edited after verification to fake a passing flip.
  if (artifactIntegrity && artifactIntegrity.verifySidecar) {
    const integ = artifactIntegrity.verifySidecar(projectDir, entry.id);
    if (!integ.ok) {
      const why = integ.missing.length
        ? `missing integrity sidecar/file: ${integ.missing.join(', ')}`
        : `artifact hash mismatch (modified after verification): ${integ.mismatches.join(', ')}`;
      block(entry.id, artifactRel, why);
    }
    const scRel = artifactIntegrity.sidecarRel(entry.id);
    if (!(isTrackedInGit(scRel) || isStagedInGit(scRel))) {
      block(entry.id, scRel, `integrity sidecar ${scRel} is not committed/staged in git (run: git add ${scRel})`);
    }
  }

  // BRD v3.2.2: check for 3-instance majority vote result.
  // Enforcement is opt-in via E2E_GATE_ENFORCE_VOTES=1 during v3.2
  // rollout — a warn-only default lets the mechanism land without
  // breaking existing scaffolded projects. Promote to enforce in v3.3
  // after ≥1 dogfood confirms the vote flow.
  const votesRel = artifactRel.replace(/\.(png|json)$/, '.votes.json');
  const votesAbs = path.resolve(projectDir, votesRel);
  const enforce = process.env.E2E_GATE_ENFORCE_VOTES === '1';

  if (!fs.existsSync(votesAbs)) {
    if (enforce) {
      block(entry.id, votesRel,
            `3-instance majority vote (BRD v3.2.2) required — no ${votesRel} found. Run: node .claude/scripts/critic-vote.js ${entry.id}`);
    } else {
      process.stderr.write(`WARN (e2e-gate v3.2.2): no ${votesRel} — will be required once E2E_GATE_ENFORCE_VOTES=1 is set (promotion planned for v3.3).\n`);
    }
  } else {
    let votes;
    try { votes = JSON.parse(fs.readFileSync(votesAbs, 'utf8')); }
    catch (e) {
      if (enforce) block(entry.id, votesRel, `votes JSON is malformed: ${e.message}`);
      else { process.stderr.write(`WARN (e2e-gate v3.2.2): ${votesRel} is malformed JSON.\n`); continue; }
    }
    if (votes && votes.verdict !== 'APPROVED') {
      if (enforce) {
        block(entry.id, votesRel,
              `3-instance majority vote returned "${votes.verdict}" (not APPROVED). See per-axis breakdown in ${votesRel}`);
      } else {
        process.stderr.write(`WARN (e2e-gate v3.2.2): vote verdict is "${votes && votes.verdict}" (not APPROVED) — would BLOCK when E2E_GATE_ENFORCE_VOTES=1.\n`);
      }
    }
  }
}

process.exit(0);
