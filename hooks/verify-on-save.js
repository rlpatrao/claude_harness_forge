#!/usr/bin/env node

'use strict';


// Cleanup-plan Phase 2 (2026-07-21): fire-log instrumentation.
try { require('./lib/fire-log.js')('verify-on-save'); } catch (_) {}

// PostToolUse(Edit|Write) hook (BRD v3.1 §4, v3.1.9). Appends the
// edited file path to state/dirty-files.jsonl so that the Stop-event
// graph-refresh hook can re-index only what changed.
//
// Never blocks. Just records. Silent on errors.

const fs = require('fs');
const path = require('path');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = input.tool_name || '';
if (tool !== 'Edit' && tool !== 'Write') process.exit(0);

const ti = input.tool_input || {};
const filePath = ti.file_path;
if (!filePath) process.exit(0);

const cwd = input.cwd || process.cwd();
const root = findProjectRoot(cwd);
if (!root) process.exit(0);

// Compute path relative to project root
let rel;
try {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  if (!abs.startsWith(root + path.sep) && abs !== root) process.exit(0);
  rel = path.relative(root, abs);
} catch (_) { process.exit(0); }

// Skip files that we don't index
if (
  rel.includes('node_modules' + path.sep) ||
  rel.includes('.git' + path.sep) ||
  rel.includes('state' + path.sep + 'context-cache') ||
  rel.includes('__pycache__' + path.sep) ||
  rel.startsWith('.venv' + path.sep) ||
  rel.includes(path.sep + '.venv' + path.sep)
) process.exit(0);

const stateDir = path.join(root, 'state');
try { fs.mkdirSync(stateDir, { recursive: true }); } catch (_) {}
const ledger = path.join(stateDir, 'dirty-files.jsonl');

const record = {
  path: rel,
  tool,
  session_id: input.session_id || 'unknown',
  at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
};

try {
  fs.appendFileSync(ledger, JSON.stringify(record) + '\n');
} catch (_) {}

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
