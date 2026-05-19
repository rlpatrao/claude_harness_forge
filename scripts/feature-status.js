#!/usr/bin/env node

'use strict';

// /feature-status implementation. Renders feature_list.json status with
// pass/fail counts, the next failing-deps-satisfied feature, recent
// flips (from git log on feature_list.json), and stalled entries
// (failing for >7 days without progress).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'feature_list.json'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

const root = findRoot();
if (!root) {
  process.stderr.write('No feature_list.json found in cwd or ancestors.\n');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(path.join(root, 'feature_list.json'), 'utf8'));
if (!Array.isArray(entries)) { process.stderr.write('feature_list.json is not an array\n'); process.exit(1); }

const total = entries.length;
const passing = entries.filter(e => e && e.passes === true).length;
const failing = total - passing;
const pct = total > 0 ? Math.round((passing / total) * 100) : 0;

const passingIds = new Set(entries.filter(e => e && e.passes === true).map(e => e.id));
const next = entries.find(e =>
  e && e.passes === false &&
  (!Array.isArray(e.depends_on) || e.depends_on.every(d => passingIds.has(d)))
);

// Recent flips: scan git log for changes to feature_list.json
let flips = [];
try {
  const out = execSync('git log --since=30.days --pretty=format:%H|%ai|%s -- feature_list.json', {
    cwd: root, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  }).trim();
  for (const line of out.split('\n').filter(Boolean).slice(0, 5)) {
    const [, ai, subject] = line.split('|');
    flips.push({ date: ai.split(' ')[0], subject: (subject || '').slice(0, 80) });
  }
} catch (_) {}

// Stalled: use git blame to find passes:false entries unchanged in >7 days
const stalled = [];
try {
  const blame = execSync('git blame --line-porcelain feature_list.json', {
    cwd: root, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10000,
  });
  // Quick heuristic: count days since blame author-time for each entry by scanning
  // the file as text and matching id lines to blame lines.
  const cutoff = Date.now() / 1000 - 7 * 86400;
  const idRegex = /"id":\s*"([^"]+)"/;
  const fileLines = fs.readFileSync(path.join(root, 'feature_list.json'), 'utf8').split('\n');
  const blameLines = blame.split('\n');
  // Walk blame in pairs: <sha> ... committer-time <epoch> ... \t<source-line>
  const lineTime = {};
  let curEpoch = 0;
  let lineNo = 0;
  for (const bl of blameLines) {
    if (/^committer-time /.test(bl)) curEpoch = parseInt(bl.split(' ')[1], 10);
    if (bl.startsWith('\t')) { lineNo += 1; lineTime[lineNo] = curEpoch; }
  }
  for (let i = 0; i < fileLines.length; i++) {
    const m = fileLines[i].match(idRegex);
    if (m) {
      const entry = entries.find(e => e && e.id === m[1]);
      if (entry && entry.passes === false) {
        const ts = lineTime[i + 1] || 0;
        if (ts && ts < cutoff) {
          stalled.push({ id: m[1], days: Math.floor((Date.now() / 1000 - ts) / 86400) });
        }
      }
    }
  }
} catch (_) {}

const lines = [
  `feature_list.json — ${path.basename(root)}`,
  `  passing: ${passing} / ${total}  (${pct}%)`,
  `  failing: ${failing}`,
];
if (next) {
  lines.push(`  next:    ${next.id} — ${next.description || ''}`);
} else if (failing > 0) {
  lines.push(`  next:    (no failing entry has all deps satisfied)`);
} else {
  lines.push(`  next:    none — all passing`);
}

if (stalled.length > 0) {
  lines.push(`  stalled: ${stalled.length} (oldest: ${stalled[0].id} — ${stalled[0].days} days)`);
}

if (flips.length > 0) {
  lines.push(`  recent commits touching feature_list.json:`);
  for (const f of flips) lines.push(`    ${f.date}  ${f.subject}`);
}

console.log(lines.join('\n'));
