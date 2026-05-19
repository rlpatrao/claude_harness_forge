#!/usr/bin/env node

'use strict';

// PreToolUse hook on Edit | Write. Enforces BRD §3.2: feature_list.json
// entries are append-only via /feature-add; only the `passes` field may
// flip false → true, and only one entry per edit. Initial seeding
// (first-time Write) is allowed if every entry has passes:false.
//
// Reject with exit code 2; stdout/stderr text is surfaced to the agent.
// Any unexpected error → exit 0 (be permissive on infra failures so a
// hook bug does not block legitimate work).

const fs = require('fs');
const path = require('path');

function block(reason) {
  process.stderr.write(`BLOCKED: feature_list.json edit rejected — ${reason}\n`);
  process.stderr.write('Per BRD §3.2: entries are append-only via /feature-add; only the passes field may flip false→true after E2E verification.\n');
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
  const newContent = ti.content;
  if (typeof newContent !== 'string') process.exit(0);
  try {
    newList = JSON.parse(newContent);
  } catch (_) {
    block('proposed content is not valid JSON');
  }
  if (!Array.isArray(newList)) block('top-level must be a JSON array');

  if (fs.existsSync(absPath)) {
    oldList = readJsonSafe(absPath);
    if (!Array.isArray(oldList)) process.exit(0);
  } else {
    for (const entry of newList) {
      if (!entry || typeof entry !== 'object') block('every entry must be an object');
      if (entry.passes !== false) {
        block(`new feature_list.json must seed every entry with passes:false (entry "${entry.id || '<no-id>'}" has passes:${entry.passes})`);
      }
    }
    process.exit(0);
  }
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
    if (currentContent.indexOf(oldStr, idx + oldStr.length) !== -1) {
      block('Edit old_string is not unique — refuse to alter feature_list.json with an ambiguous edit');
    }
    newContent = currentContent.slice(0, idx) + newStr + currentContent.slice(idx + oldStr.length);
  }

  try {
    newList = JSON.parse(newContent);
  } catch (_) {
    block('resulting content would not be valid JSON');
  }
  if (!Array.isArray(newList)) block('top-level must be a JSON array');
}

if (oldList.length !== newList.length) {
  block(`entry count changed (${oldList.length} → ${newList.length}); entries are append-only via /feature-add`);
}

const allowedKeys = new Set([
  'id', 'category', 'description', 'steps', 'passes',
  'source_section', 'depends_on', 'verification_artifact_path',
]);

let flippedCount = 0;
for (let i = 0; i < oldList.length; i++) {
  const o = oldList[i];
  const n = newList[i];
  if (!o || !n || typeof o !== 'object' || typeof n !== 'object') {
    block(`entry index ${i} is not an object in one of the versions`);
  }
  if (o.id !== n.id) {
    block(`entry order changed at index ${i}: "${o.id}" → "${n.id}"`);
  }
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  for (const key of keys) {
    if (!allowedKeys.has(key)) continue;
    if (key === 'passes') {
      if (o.passes !== n.passes) {
        if (o.passes === false && n.passes === true) {
          flippedCount += 1;
        } else {
          block(`entry "${o.id}" passes changed in an unexpected direction (${o.passes} → ${n.passes}); only false→true allowed`);
        }
      }
      continue;
    }
    if (JSON.stringify(o[key]) !== JSON.stringify(n[key])) {
      block(`entry "${o.id}" field "${key}" changed; only the passes field may flip`);
    }
  }
}

if (flippedCount > 1) {
  block(`${flippedCount} entries flipped in a single edit; only one passes flip per edit allowed (BRD §3.1 step 7: one feature per session)`);
}

process.exit(0);
