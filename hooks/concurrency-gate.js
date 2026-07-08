#!/usr/bin/env node

'use strict';

// PreToolUse(Task|Agent) and SubagentStop hook (BRD v3.1 §4, v3.1.5).
// Caps the number of concurrent subagent invocations to prevent
// runaway fan-out on parallel `generator` teammate spawns or
// pipeline() calls.
//
// Adapted from cwijayasundara/claude_harness_eng_v5/.claude/hooks/concurrency-gate.js
// per BRD v3.1 §4 (v3.1.5).
//
// State: JSONL ledger at state/concurrency-ledger.jsonl. One line per
// spawn, one line per stop. TTL prunes leaked spawns (>15 min old with
// no matching stop).
//
// Env override: CONCURRENCY_CAP (default 18).
//
// Exit 0 to allow. Exit 2 to block with a "cap reached, wait or reduce
// fanout" message.

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CAP = 18;
const TTL_MS = 15 * 60 * 1000;

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const eventName = input.hook_event_name || 'PreToolUse';
const toolName = input.tool_name || '';
const cwd = input.cwd || process.cwd();

// Find state dir
const projectRoot = findProjectRoot(cwd);
if (!projectRoot) process.exit(0);
const stateDir = path.join(projectRoot, 'state');
try { fs.mkdirSync(stateDir, { recursive: true }); } catch (_) {}
const ledger = path.join(stateDir, 'concurrency-ledger.jsonl');

const cap = parseInt(process.env.CONCURRENCY_CAP || String(DEFAULT_CAP), 10);
const now = Date.now();

// Read + prune ledger
let entries = [];
if (fs.existsSync(ledger)) {
  try {
    entries = fs.readFileSync(ledger, 'utf8').split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean);
  } catch (_) {}
}
// Compute currently-outstanding spawns (spawn with no matching stop, or old)
const stops = new Set(entries.filter(e => e.event === 'stop').map(e => e.id));
const active = entries.filter(e =>
  e.event === 'spawn' &&
  !stops.has(e.id) &&
  (now - (e.at || 0)) < TTL_MS
);

if (eventName === 'PreToolUse') {
  // Only intercept Task/Agent spawns
  if (toolName !== 'Task' && toolName !== 'Agent') process.exit(0);

  if (active.length >= cap) {
    process.stderr.write(`BLOCKED (concurrency-gate, BRD v3.1 §4 v3.1.5): concurrent subagent cap reached (${active.length}/${cap}).\n\n`);
    process.stderr.write(`Currently active spawns (${active.length}):\n`);
    for (const a of active.slice(0, 5)) {
      const ageMs = now - (a.at || 0);
      process.stderr.write(`  - ${a.id} (${Math.round(ageMs / 1000)}s ago, tool: ${a.tool || '?'})\n`);
    }
    if (active.length > 5) process.stderr.write(`  ... and ${active.length - 5} more\n`);
    process.stderr.write(`\nEither wait for spawns to complete, or reduce fanout in the caller.\n`);
    process.stderr.write(`Override with env CONCURRENCY_CAP=<N> (currently ${cap}).\n`);
    process.exit(2);
  }

  // Record the spawn — use tool_use_id if present, else synthesize
  const id = (input.tool_use_id || '') || `spawn-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const record = { event: 'spawn', id, at: now, tool: toolName, session: input.session_id || 'unknown' };
  try { fs.appendFileSync(ledger, JSON.stringify(record) + '\n'); } catch (_) {}
  process.exit(0);
}

if (eventName === 'SubagentStop') {
  // Best effort: mark the most recent unmatched spawn as stopped
  const oldestActive = active[0];
  if (oldestActive) {
    const record = { event: 'stop', id: oldestActive.id, at: now };
    try { fs.appendFileSync(ledger, JSON.stringify(record) + '\n'); } catch (_) {}
  }

  // Rotate ledger if it's grown large
  try {
    const stat = fs.statSync(ledger);
    if (stat.size > 256 * 1024) {
      // Prune: keep only outstanding + last 200 stops
      const outstanding = entries.filter(e =>
        e.event === 'spawn' && !stops.has(e.id) && (now - (e.at || 0)) < TTL_MS
      );
      const recentStops = entries.filter(e => e.event === 'stop').slice(-200);
      const kept = [...outstanding, ...recentStops];
      fs.writeFileSync(ledger, kept.map(e => JSON.stringify(e)).join('\n') + '\n');
    }
  } catch (_) {}
  process.exit(0);
}

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
