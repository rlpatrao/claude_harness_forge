#!/usr/bin/env node

'use strict';

// archival-write (BRD v3.1 §4, v3.1.11). Persist a note into
// state/memory/archival/YYYY-MM-DD-<slug>.md.
//
// Usage:
//   node scripts/archival-write.js "<title>" < input.md
//   node scripts/archival-write.js --tags a,b,c "<title>" < input.md
//
// Adds a YAML frontmatter block: title, created_at, tags[]. The rest
// of the file is the piped content.
//
// No size cap (unlike core memory). Slugs collide-safe via a numeric
// suffix if needed.

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const ARCH_DIR = path.join(ROOT, 'state', 'memory', 'archival');

const argv = process.argv.slice(2);
let tags = [];
let title = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tags') tags = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
  else if (!title) title = argv[i];
}
if (!title) { process.stderr.write('usage: archival-write.js [--tags a,b] "<title>" < input.md\n'); process.exit(1); }

let content = '';
try { content = fs.readFileSync(0, 'utf8'); } catch (_) {}
if (!content.trim()) { process.stderr.write('empty input (pipe content on stdin)\n'); process.exit(1); }

try { fs.mkdirSync(ARCH_DIR, { recursive: true }); } catch (_) {}

const today = new Date().toISOString().slice(0, 10);
const slug = title.toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);
let filename = `${today}-${slug}.md`;
let n = 2;
while (fs.existsSync(path.join(ARCH_DIR, filename))) {
  filename = `${today}-${slug}-${n}.md`;
  n++;
}

const nowIso = new Date().toISOString().replace(/\.\d+Z/, 'Z');
const front = [
  '---',
  `title: "${title.replace(/"/g, '\\"')}"`,
  `created_at: ${nowIso}`,
  `tags: [${tags.map(t => JSON.stringify(t)).join(', ')}]`,
  '---',
  '',
].join('\n');

const out = front + content;
const p = path.join(ARCH_DIR, filename);
fs.writeFileSync(p, out);
process.stdout.write(`archival: wrote ${path.relative(ROOT, p)}\n`);
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
