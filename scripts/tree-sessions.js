#!/usr/bin/env node

'use strict';

// BRD §4.5 — tree-structured sessions.
//
// On-disk format (per session):
//   sessions/<project>/<session_id>.json
//   {
//     "session_id": "<uuid>",
//     "root_turn_id": "<uuid>",
//     "turns": [{turn_id, parent_turn_id|null, branch|null, role, content_summary, ts}, ...],
//     "active_path": ["<turn_id>", ...],
//     "branches": { "<label>": "<turn_id>" }
//   }
//
// Commands:
//   node scripts/tree-sessions.js init <session_id>
//   node scripts/tree-sessions.js append <session_id> <role> <content_summary>
//   node scripts/tree-sessions.js fork <session_id> [<turn_id>]
//   node scripts/tree-sessions.js branch <session_id> <label>
//   node scripts/tree-sessions.js tree <session_id>           -- render the tree
//   node scripts/tree-sessions.js switch <session_id> <label>
//   node scripts/tree-sessions.js export <session_id> [html|md]
//
// Defensive: file is created on first append; concurrent writes are
// not coordinated (single-writer assumption — the orchestrator).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function uuid() {
  return crypto.randomBytes(8).toString('hex');
}

function findProjectDir() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'feature_list.json')) ||
        fs.existsSync(path.join(cur, '.git'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return process.cwd();
}

const root = findProjectDir();
const sessionsDir = path.join(root, 'sessions', path.basename(root));

function sessionFile(sid) {
  return path.join(sessionsDir, `${sid}.json`);
}

function readSession(sid) {
  const f = sessionFile(sid);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeSession(s) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(sessionFile(s.session_id), JSON.stringify(s, null, 2));
}

function init(sid) {
  if (readSession(sid)) {
    process.stderr.write(`session ${sid} already exists\n`);
    process.exit(1);
  }
  const rootTurnId = uuid();
  const s = {
    session_id: sid,
    root_turn_id: rootTurnId,
    turns: [{
      turn_id: rootTurnId,
      parent_turn_id: null,
      branch: 'main',
      role: 'system',
      content_summary: 'session start',
      ts: new Date().toISOString(),
    }],
    active_path: [rootTurnId],
    branches: { main: rootTurnId },
  };
  writeSession(s);
  console.log(JSON.stringify({ session_id: sid, root_turn_id: rootTurnId }));
}

function append(sid, role, contentSummary) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  const parent = s.active_path[s.active_path.length - 1];
  const turnId = uuid();
  s.turns.push({
    turn_id: turnId,
    parent_turn_id: parent,
    branch: null,
    role,
    content_summary: contentSummary,
    ts: new Date().toISOString(),
  });
  s.active_path.push(turnId);
  writeSession(s);
  console.log(JSON.stringify({ turn_id: turnId, parent_turn_id: parent }));
}

function fork(sid, atTurnId) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  const at = atTurnId || s.active_path[s.active_path.length - 1];
  if (!s.turns.find(t => t.turn_id === at)) {
    process.stderr.write(`turn ${at} not in session\n`);
    process.exit(1);
  }
  // Truncate active_path to the fork point; subsequent appends go to the new branch.
  const idx = s.active_path.indexOf(at);
  s.active_path = idx >= 0 ? s.active_path.slice(0, idx + 1) : [at];
  writeSession(s);
  console.log(JSON.stringify({ forked_at: at, active_path_length: s.active_path.length }));
}

function branch(sid, label) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  if (!label) { process.stderr.write('label required\n'); process.exit(1); }
  const head = s.active_path[s.active_path.length - 1];
  s.branches[label] = head;
  // Stamp the turn with the branch label
  const t = s.turns.find(x => x.turn_id === head);
  if (t) t.branch = label;
  writeSession(s);
  console.log(JSON.stringify({ label, head_turn_id: head }));
}

function switchTo(sid, label) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  const head = s.branches[label];
  if (!head) { process.stderr.write(`branch "${label}" not found\n`); process.exit(1); }
  // Walk back from head to root, accumulating the path.
  const path_ = [];
  const turnById = new Map(s.turns.map(t => [t.turn_id, t]));
  let cur = head;
  while (cur) {
    path_.unshift(cur);
    cur = turnById.get(cur)?.parent_turn_id || null;
  }
  s.active_path = path_;
  writeSession(s);
  console.log(JSON.stringify({ switched_to: label, active_path_length: s.active_path.length }));
}

function tree(sid) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  const activeSet = new Set(s.active_path);
  const childrenOf = new Map();
  for (const t of s.turns) {
    if (!childrenOf.has(t.parent_turn_id)) childrenOf.set(t.parent_turn_id, []);
    childrenOf.get(t.parent_turn_id).push(t);
  }
  function render(turnId, depth) {
    const t = s.turns.find(x => x.turn_id === turnId);
    if (!t) return;
    const marker = activeSet.has(turnId) ? '●' : '○';
    const branchLabel = t.branch ? `  [branch: "${t.branch}"]` : '';
    const active = activeSet.has(turnId) && turnId === s.active_path[s.active_path.length - 1] ? '  ← active' : '';
    console.log(`${'  '.repeat(depth)}${marker} ${turnId.slice(0, 6)}  (${t.role})  ${t.content_summary}${branchLabel}${active}`);
    const children = childrenOf.get(turnId) || [];
    for (const c of children) render(c.turn_id, depth + 1);
  }
  console.log(`session: ${sid}`);
  console.log(`branches: ${Object.keys(s.branches).join(', ') || '(none)'}`);
  console.log('');
  render(s.root_turn_id, 0);
}

function exportSession(sid, fmt) {
  const s = readSession(sid);
  if (!s) { process.stderr.write(`session ${sid} not found\n`); process.exit(1); }
  fmt = fmt || 'html';
  const outPath = path.join(sessionsDir, `${sid}.export.${fmt}`);
  if (fmt === 'md') {
    const lines = [`# Session ${sid}`, '', `Root: ${s.root_turn_id}`, `Branches: ${Object.keys(s.branches).join(', ')}`, ''];
    for (const t of s.turns) {
      lines.push(`## ${t.turn_id.slice(0, 6)} (${t.role})`);
      if (t.branch) lines.push(`branch: ${t.branch}`);
      lines.push(t.content_summary);
      lines.push('');
    }
    fs.writeFileSync(outPath, lines.join('\n'));
  } else {
    const turnsJson = JSON.stringify(s.turns, null, 2)
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!doctype html><meta charset="utf-8"><title>Session ${sid}</title>
<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:900px;margin:2em auto;padding:1em}
pre{background:#f6f8fa;padding:1em;border-radius:6px;overflow:auto}</style>
<h1>Session ${sid}</h1>
<p>Root: <code>${s.root_turn_id}</code></p>
<p>Branches: ${Object.keys(s.branches).map(b => `<code>${b}</code>`).join(', ') || '(none)'}</p>
<h2>Turns</h2>
<pre>${turnsJson}</pre>`;
    fs.writeFileSync(outPath, html);
  }
  console.log(outPath);
}

const cmd = process.argv[2];
const sid = process.argv[3];

switch (cmd) {
  case 'init':   init(sid); break;
  case 'append': append(sid, process.argv[4] || 'asst', process.argv.slice(5).join(' ')); break;
  case 'fork':   fork(sid, process.argv[4]); break;
  case 'branch': branch(sid, process.argv[4]); break;
  case 'switch': switchTo(sid, process.argv[4]); break;
  case 'tree':   tree(sid); break;
  case 'export': exportSession(sid, process.argv[4]); break;
  default:
    process.stderr.write('Usage: tree-sessions.js {init|append|fork|branch|switch|tree|export} <session_id> [args]\n');
    process.exit(1);
}
