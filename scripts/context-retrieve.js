#!/usr/bin/env node

'use strict';

// context-retrieve — pull a prior digest by question hash or by
// substring match on the question text (BRD v3.1 §4, v3.1.6).
//
// Usage:
//   node scripts/context-retrieve.js <hash>
//   node scripts/context-retrieve.js --like "<substring>"
//   node scripts/context-retrieve.js --list [--limit N]
//
// When no arg or no match, prints "not found" and exits 1.

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CACHE_DIR = path.join(ROOT, 'state', 'context-cache');

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stderr.write('usage: context-retrieve.js <hash> | --like "<text>" | --list [--limit N]\n');
  process.exit(1);
}

if (!fs.existsSync(CACHE_DIR)) {
  process.stderr.write('no cache entries yet — run /context first\n');
  process.exit(1);
}

if (argv[0] === '--list') {
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) || 20 : 20;
  const entries = readAll();
  entries.sort((a, b) => b.mtime - a.mtime);
  process.stdout.write(`# context-cache — ${entries.length} entries (showing ${Math.min(limit, entries.length)})\n\n`);
  for (const e of entries.slice(0, limit)) {
    process.stdout.write(`- \`${e.hash}\` · ${new Date(e.mtime).toISOString().replace(/\.\d+Z/, 'Z')} · ${e.manifest.question || '(question missing)'}\n`);
  }
  process.exit(0);
}

if (argv[0] === '--like') {
  const needle = (argv[1] || '').toLowerCase();
  if (!needle) { process.stderr.write('--like requires a substring\n'); process.exit(1); }
  const entries = readAll();
  entries.sort((a, b) => b.mtime - a.mtime);
  const match = entries.find(e => (e.manifest.question || '').toLowerCase().includes(needle));
  if (!match) { process.stderr.write(`no cached question contains: ${needle}\n`); process.exit(1); }
  const digestPath = path.join(CACHE_DIR, match.hash, 'digest.md');
  process.stdout.write(fs.readFileSync(digestPath, 'utf8'));
  process.stdout.write(`\n\n<!-- from cache: ${match.hash} -->\n`);
  process.exit(0);
}

// Positional hash
const hash = argv[0];
const digestPath = path.join(CACHE_DIR, hash, 'digest.md');
if (!fs.existsSync(digestPath)) {
  process.stderr.write(`no cache entry: ${hash}\n`);
  process.exit(1);
}
process.stdout.write(fs.readFileSync(digestPath, 'utf8'));
process.exit(0);

function readAll() {
  const out = [];
  for (const name of fs.readdirSync(CACHE_DIR)) {
    const p = path.join(CACHE_DIR, name);
    const digestP = path.join(p, 'digest.md');
    const manifestP = path.join(p, 'manifest.json');
    if (!fs.existsSync(digestP)) continue;
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(manifestP, 'utf8')); } catch (_) {}
    try {
      const st = fs.statSync(digestP);
      out.push({ hash: name, mtime: st.mtimeMs, manifest });
    } catch (_) {}
  }
  return out;
}

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
