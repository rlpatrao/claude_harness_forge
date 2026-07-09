#!/usr/bin/env node

'use strict';

// recall-search (BRD v3.1 §4, v3.1.11). Search prior-session
// summaries under state/memory/sessions/*.jsonl.
//
// Usage:
//   node scripts/recall-search.js "<query>" [--limit 5]
//   node scripts/recall-search.js --list [--limit 10]
//
// Format expected: each *.jsonl line is
//   { "session_id", "at", "summary", "keywords"?, "role"? }
// (written by agents/compactor.md or hooks/compaction-stage.js — v3.0)
// Missing keys are tolerated.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const SESSIONS_DIR = path.join(ROOT, 'state', 'memory', 'sessions');

const argv = process.argv.slice(2);
let limit = 5;
let listMode = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--limit') limit = parseInt(argv[++i], 10) || limit;
  else if (argv[i] === '--list') listMode = true;
  else positional.push(argv[i]);
}

if (!fs.existsSync(SESSIONS_DIR)) {
  process.stderr.write('no session summaries yet — compactor has not written any\n');
  process.exit(0);
}
const jsonlFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl'));
if (jsonlFiles.length === 0) {
  process.stdout.write('(no session summaries yet)\n');
  process.exit(0);
}

// Load all lines with their file for citation
const items = [];
for (const f of jsonlFiles) {
  const p = path.join(SESSIONS_DIR, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      const rec = JSON.parse(lines[i]);
      items.push({ file: f, line_num: i + 1, ...rec });
    } catch (_) {}
  }
}

if (listMode) {
  items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  process.stdout.write(`# Recall — ${items.length} summaries (showing ${Math.min(limit, items.length)})\n\n`);
  for (const it of items.slice(0, limit)) {
    const at = it.at || '(unknown)';
    const sum = truncate(it.summary || it.text || '(no summary)', 120);
    process.stdout.write(`- \`${it.file}:${it.line_num}\` · ${at} · ${sum}\n`);
  }
  process.exit(0);
}

const query = positional.join(' ').trim();
if (!query) {
  process.stderr.write('usage: recall-search.js "<query>" [--limit N] | --list\n');
  process.exit(1);
}

// TF-IDF-ish scoring
const qTerms = tokenize(query);
if (qTerms.length === 0) { process.stderr.write('empty query after tokenization\n'); process.exit(1); }

const df = new Map();
for (const it of items) {
  const text = ((it.summary || '') + ' ' + (Array.isArray(it.keywords) ? it.keywords.join(' ') : '')).toLowerCase();
  const terms = new Set(tokenize(text));
  for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
}
const N = items.length;

items.forEach(it => {
  const text = ((it.summary || '') + ' ' + (Array.isArray(it.keywords) ? it.keywords.join(' ') : '')).toLowerCase();
  const bag = tokenize(text);
  const tf = {};
  for (const t of bag) tf[t] = (tf[t] || 0) + 1;
  let s = 0;
  for (const q of qTerms) {
    const f = tf[q] || 0;
    if (!f) continue;
    const idf = Math.log(1 + N / (df.get(q) || 1));
    s += f * idf;
  }
  it._score = s;
});
items.sort((a, b) => b._score - a._score);

const top = items.filter(it => it._score > 0).slice(0, limit);
process.stdout.write(`# Recall — top ${top.length} hits for "${query}"\n\n`);
if (top.length === 0) {
  process.stdout.write('(no matches)\n');
  process.exit(0);
}
for (const it of top) {
  const at = it.at || '(unknown)';
  const sum = truncate(it.summary || it.text || '(no summary)', 180);
  process.stdout.write(`- \`${it.file}:${it.line_num}\` · score ${it._score.toFixed(2)} · ${at}\n  ${sum}\n`);
}

function tokenize(s) {
  return (s || '').toString().toLowerCase().split(/[^a-z0-9_]+/).filter(t => t && t.length >= 3);
}
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
