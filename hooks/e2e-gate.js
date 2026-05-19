#!/usr/bin/env node

'use strict';

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

function block(featureId, artifactPath, reason) {
  process.stderr.write(`BLOCKED: passes flip on "${featureId}" rejected — ${reason}\n`);
  process.stderr.write(`Per BRD §3.8: a Playwright or Puppeteer MCP session must execute the feature's steps[] and commit the verification artifact to ${artifactPath} before the flip.\n`);
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
}

process.exit(0);
