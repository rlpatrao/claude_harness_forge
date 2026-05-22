#!/usr/bin/env node

'use strict';

// PostToolUse hook — BRD §4.5 tree-sessions auto-append.
//
// After every tool use, append a turn snapshot to the active
// session-tree file at sessions/<project>/<session_id>.json. If no
// session file exists for the current session_id, this hook
// initializes one.
//
// "Turn" granularity here is per-tool-use, not per-assistant-response.
// That's slightly more granular than Pi's model but keeps the
// implementation hook-driven (no need for an "after every response"
// event that Claude Code does not currently expose).
//
// Defensive: never blocks, never errors out the tool call. Exit 0
// always.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function uuid() { return crypto.randomBytes(8).toString('hex'); }

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id || 'unknown';
const cwd = input.cwd || process.cwd();
const tool = input.tool_name || 'unknown';

function findProjectDir(startDir) {
  let cur = path.resolve(startDir);
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, '.claude')) ||
        fs.existsSync(path.join(cur, 'feature_list.json')) ||
        fs.existsSync(path.join(cur, '.git'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return null;
}

const projectDir = findProjectDir(cwd);
if (!projectDir) process.exit(0);

const sessionsDir = path.join(projectDir, 'sessions', path.basename(projectDir));
try { fs.mkdirSync(sessionsDir, { recursive: true }); } catch (_) {}

const sessionFile = path.join(sessionsDir, `${sessionId}.json`);

let session;
try {
  if (fs.existsSync(sessionFile)) {
    session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  }
} catch (_) {}

if (!session) {
  const rootTurnId = uuid();
  session = {
    session_id: sessionId,
    root_turn_id: rootTurnId,
    turns: [{
      turn_id: rootTurnId,
      parent_turn_id: null,
      branch: 'main',
      role: 'system',
      content_summary: 'session start (auto-initialized by post-turn hook)',
      ts: new Date().toISOString(),
    }],
    active_path: [rootTurnId],
    branches: { main: rootTurnId },
  };
}

// Compose a turn summary
const ti = input.tool_input || {};
let summary = `${tool}`;
if (ti.file_path) summary += ` ${path.basename(ti.file_path)}`;
else if (ti.command) summary += ` ${ti.command.slice(0, 60).replace(/\s+/g, ' ')}`;
else if (ti.pattern) summary += ` /${ti.pattern.slice(0, 40)}/`;

const parent = session.active_path[session.active_path.length - 1];
const turnId = uuid();
session.turns.push({
  turn_id: turnId,
  parent_turn_id: parent,
  branch: null,
  role: 'tool',
  tool_name: tool,
  content_summary: summary,
  ts: new Date().toISOString(),
});
session.active_path.push(turnId);

// Trim runaway sessions (keep last 1000 turns; older are still in git history)
if (session.turns.length > 1000) {
  // Don't actually trim the array — that breaks parent references. Just skip
  // the write to avoid huge files.
  process.exit(0);
}

try {
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
} catch (_) {}

process.exit(0);
