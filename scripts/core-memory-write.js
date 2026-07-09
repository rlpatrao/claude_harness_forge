#!/usr/bin/env node

'use strict';

// core-memory-write (BRD v3.1 §4, v3.1.11). Write or append to
// state/memory/core-blocks/<block-name>.md.
//
// Usage:
//   node scripts/core-memory-write.js <block-name> < input.md
//   node scripts/core-memory-write.js --append <block-name> < input.md
//
// Block-name: matches /^[a-z][a-z0-9-]*$/
// Size cap: 4KB per block. Larger writes fail with exit 2.
// Append mode: prepends a `---\n<ISO timestamp>\n---\n` separator.

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CORE_DIR = path.join(ROOT, 'state', 'memory', 'core-blocks');
const SIZE_CAP = 4096;

const argv = process.argv.slice(2);
let append = false;
let blockName = null;
for (const a of argv) {
  if (a === '--append') append = true;
  else if (!blockName) blockName = a;
}
if (!blockName) {
  process.stderr.write('usage: core-memory-write.js [--append] <block-name> < input.md\n');
  process.exit(1);
}
blockName = blockName.replace(/\.md$/, '');
if (!/^[a-z][a-z0-9-]*$/.test(blockName)) {
  process.stderr.write(`invalid block name: ${blockName} (must match /^[a-z][a-z0-9-]*$/)\n`);
  process.exit(1);
}

let content = '';
try { content = fs.readFileSync(0, 'utf8'); } catch (_) {}
if (!content.trim()) {
  process.stderr.write('empty input (pipe content on stdin)\n');
  process.exit(1);
}

try { fs.mkdirSync(CORE_DIR, { recursive: true }); } catch (_) {}
const p = path.join(CORE_DIR, blockName + '.md');
const now = new Date().toISOString().replace(/\.\d+Z/, 'Z');

let finalContent = content;
if (append && fs.existsSync(p)) {
  const prev = fs.readFileSync(p, 'utf8');
  finalContent = prev.trimEnd() + `\n\n---\n_appended at ${now}_\n---\n\n` + content;
}

if (Buffer.byteLength(finalContent, 'utf8') > SIZE_CAP) {
  process.stderr.write(`BLOCKED: content would exceed ${SIZE_CAP} bytes (${Buffer.byteLength(finalContent, 'utf8')}). Split into multiple blocks or move to archival.\n`);
  process.exit(2);
}

fs.writeFileSync(p, finalContent);
process.stdout.write(`wrote ${p} (${Buffer.byteLength(finalContent, 'utf8')} bytes, mode: ${append ? 'append' : 'replace'})\n`);
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
