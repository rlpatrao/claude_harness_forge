#!/usr/bin/env node

'use strict';

// archival-search (BRD v3.1 §4, v3.1.11). Grep + BM25-ish rank over
// state/memory/archival/*.md.
//
// Usage:
//   node scripts/archival-search.js "<query>" [--limit 5]
//   node scripts/archival-search.js --list
//   node scripts/archival-search.js --tag <tag>

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const ARCH_DIR = path.join(ROOT, 'state', 'memory', 'archival');

const argv = process.argv.slice(2);
let limit = 5;
let listMode = false;
let tagFilter = null;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--limit') limit = parseInt(argv[++i], 10) || limit;
  else if (argv[i] === '--list') listMode = true;
  else if (argv[i] === '--tag') tagFilter = argv[++i];
  else positional.push(argv[i]);
}

if (!fs.existsSync(ARCH_DIR)) {
  process.stdout.write('(no archival notes yet)\n');
  process.exit(0);
}
const files = fs.readdirSync(ARCH_DIR).filter(f => f.endsWith('.md') && f !== '.gitkeep');
if (files.length === 0) { process.stdout.write('(no archival notes yet)\n'); process.exit(0); }

const notes = files.map(f => {
  const content = fs.readFileSync(path.join(ARCH_DIR, f), 'utf8');
  const front = parseFrontmatter(content);
  return { file: f, content, title: front.title || f, created_at: front.created_at || '', tags: front.tags || [] };
});

if (listMode || tagFilter) {
  const filtered = tagFilter ? notes.filter(n => n.tags.includes(tagFilter)) : notes;
  filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  process.stdout.write(`# Archival — ${filtered.length} notes${tagFilter ? ` with tag "${tagFilter}"` : ''}\n\n`);
  for (const n of filtered) {
    process.stdout.write(`- \`state/memory/archival/${n.file}\` · ${n.created_at} · ${n.title}\n`);
    if (n.tags.length) process.stdout.write(`  tags: ${n.tags.join(', ')}\n`);
  }
  process.exit(0);
}

const query = positional.join(' ').trim();
if (!query) { process.stderr.write('usage: archival-search.js "<query>" [--limit N] | --list | --tag <t>\n'); process.exit(1); }

const qTerms = tokenize(query);
if (qTerms.length === 0) { process.stderr.write('empty query\n'); process.exit(1); }

// BM25-ish: TF * IDF with length normalization
const df = new Map();
const avgLen = notes.reduce((n, x) => n + tokenize(x.content).length, 0) / notes.length;
for (const n of notes) {
  const terms = new Set(tokenize(n.content));
  for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
}
const N = notes.length;
const K1 = 1.5, B = 0.75;

notes.forEach(n => {
  const bag = tokenize(n.content);
  const tf = {};
  for (const t of bag) tf[t] = (tf[t] || 0) + 1;
  const dl = bag.length || 1;
  let s = 0;
  for (const q of qTerms) {
    const f = tf[q] || 0;
    if (!f) continue;
    const idf = Math.log(1 + (N - (df.get(q) || 0) + 0.5) / ((df.get(q) || 0) + 0.5));
    s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (dl / avgLen))));
  }
  // Title match bonus
  const titleBag = tokenize(n.title);
  for (const q of qTerms) if (titleBag.includes(q)) s += 2;
  // Tag match bonus
  for (const q of qTerms) if (n.tags.some(t => t.toLowerCase().includes(q))) s += 1;
  n._score = s;
});

const top = notes.filter(n => n._score > 0).sort((a, b) => b._score - a._score).slice(0, limit);
process.stdout.write(`# Archival — top ${top.length} hits for "${query}"\n\n`);
if (top.length === 0) { process.stdout.write('(no matches)\n'); process.exit(0); }

for (const n of top) {
  // Find best matching line for snippet
  const lines = n.content.split('\n').map((l, i) => ({ line: l, num: i + 1 }));
  const scored = lines.map(l => ({ ...l, score: qTerms.reduce((a, q) => a + (l.line.toLowerCase().includes(q) ? 1 : 0), 0) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || { line: '', num: 1 };
  process.stdout.write(`- \`state/memory/archival/${n.file}#L${best.num}\` · score ${n._score.toFixed(2)} · ${n.title}\n`);
  if (best.line) process.stdout.write(`  L${best.num}: ${truncate(best.line.trim(), 160)}\n`);
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith('[')) {
      try { out[key] = JSON.parse(val); } catch (_) { out[key] = []; }
    } else {
      out[key] = val.replace(/^"|"$/g, '');
    }
  }
  return out;
}
function tokenize(s) { return (s || '').toString().toLowerCase().split(/[^a-z0-9_]+/).filter(t => t && t.length >= 3); }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : s; }

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
