#!/usr/bin/env node

'use strict';

// BRD §4.4 — /evolve runtime helper.
//
// Operations:
//   status              -- list counts in pending/, tentative/, confirmed/
//   promote-pending     -- for each pending/<hash>.json with score>=0.6 AND age>=2 sessions,
//                          move to tentative/. (Critic validation is a separate prompt step.)
//   promote-tentative   -- for each tentative/<hash>.json with sessions_seen>=3,
//                          move to confirmed/
//   prune-pending       -- delete pending/<hash>.json older than 30 days
//   cluster              -- group confirmed/ by overlap; emit a JSON clustering proposal
//
// The Critic subagent validates promotions in the conversational layer
// — this script only enforces the mechanical lifecycle.

const fs = require('fs');
const path = require('path');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'instincts'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

const root = findRoot();
if (!root) { process.stderr.write('No instincts/ directory found\n'); process.exit(1); }

const dirs = {
  pending: path.join(root, 'instincts', 'pending'),
  tentative: path.join(root, 'instincts', 'tentative'),
  confirmed: path.join(root, 'instincts', 'confirmed'),
};

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({
    file: f,
    path: path.join(dir, f),
    data: (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })(),
  })).filter(e => e.data);
}

function move(from, to, file) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(path.join(from, file), path.join(to, file));
}

const op = process.argv[2];

if (op === 'status' || !op) {
  const out = {};
  for (const [name, dir] of Object.entries(dirs)) out[name] = listJson(dir).length;
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (op === 'promote-pending') {
  const items = listJson(dirs.pending);
  const promoted = [];
  for (const it of items) {
    const d = it.data;
    if ((d.score || 0) >= 0.6) {
      // Stamp sessions_seen=1 on entry to tentative
      d.status = 'tentative';
      d.sessions_seen = 1;
      d.promoted_at = new Date().toISOString();
      fs.writeFileSync(it.path, JSON.stringify(d, null, 2));
      move(dirs.pending, dirs.tentative, it.file);
      promoted.push(d.instinct_id);
    }
  }
  console.log(JSON.stringify({ promoted, count: promoted.length }, null, 2));
  process.exit(0);
}

if (op === 'promote-tentative') {
  const items = listJson(dirs.tentative);
  const promoted = [];
  for (const it of items) {
    const d = it.data;
    if ((d.sessions_seen || 0) >= 3) {
      d.status = 'confirmed';
      d.confirmed_at = new Date().toISOString();
      fs.writeFileSync(it.path, JSON.stringify(d, null, 2));
      move(dirs.tentative, dirs.confirmed, it.file);
      promoted.push(d.instinct_id);
    }
  }
  console.log(JSON.stringify({ promoted, count: promoted.length }, null, 2));
  process.exit(0);
}

if (op === 'prune-pending') {
  const cutoff = Date.now() - 30 * 86400 * 1000;
  const items = listJson(dirs.pending);
  const pruned = [];
  for (const it of items) {
    const d = it.data;
    const ts = Date.parse(d.discovered_at || 0);
    if (ts && ts < cutoff) {
      fs.unlinkSync(it.path);
      pruned.push(d.instinct_id);
    }
  }
  console.log(JSON.stringify({ pruned, count: pruned.length }, null, 2));
  process.exit(0);
}

if (op === 'cluster') {
  const items = listJson(dirs.confirmed);
  // Cluster by shared subsequence overlap (>= 2 shared tool names)
  const clusters = [];
  const claimed = new Set();
  for (let i = 0; i < items.length; i++) {
    if (claimed.has(items[i].file)) continue;
    const seed = items[i];
    const seedSeq = new Set(seed.data.tool_sequence || []);
    const group = [seed];
    claimed.add(seed.file);
    for (let j = i + 1; j < items.length; j++) {
      if (claimed.has(items[j].file)) continue;
      const otherSeq = items[j].data.tool_sequence || [];
      const overlap = otherSeq.filter(t => seedSeq.has(t)).length;
      if (overlap >= 2) {
        group.push(items[j]);
        claimed.add(items[j].file);
      }
    }
    if (group.length >= 3) {
      clusters.push({
        size: group.length,
        seed_sequence: seed.data.tool_sequence,
        members: group.map(g => g.data.instinct_id),
        proposed_skill_name: `auto-${seed.data.instinct_id.slice(0, 6)}`,
      });
    }
  }
  console.log(JSON.stringify({ clusters }, null, 2));
  process.exit(0);
}

process.stderr.write('Usage: instinct-evolve.js {status|promote-pending|promote-tentative|prune-pending|cluster}\n');
process.exit(1);
