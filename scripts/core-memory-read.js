#!/usr/bin/env node

'use strict';

// core-memory-read (BRD v3.1 §4, v3.1.11). Read from
// state/memory/core-blocks/*.md.
//
// Usage:
//   node scripts/core-memory-read.js --list
//   node scripts/core-memory-read.js <block-name>

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CORE_DIR = path.join(ROOT, 'state', 'memory', 'core-blocks');

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stderr.write('usage: core-memory-read.js --list | <block-name>\n');
  process.exit(1);
}

if (!fs.existsSync(CORE_DIR)) {
  process.stderr.write('no core memory yet — write a block with core-memory-write.js\n');
  process.exit(1);
}

if (argv[0] === '--list') {
  const files = fs.readdirSync(CORE_DIR).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  if (files.length === 0) {
    process.stdout.write('(no core blocks)\n');
    process.exit(0);
  }
  process.stdout.write('# Core memory blocks\n\n');
  for (const f of files) {
    const p = path.join(CORE_DIR, f);
    const st = fs.statSync(p);
    process.stdout.write(`- \`${f.replace(/\.md$/, '')}\` — ${st.size} bytes, modified ${new Date(st.mtimeMs).toISOString().replace(/\.\d+Z/, 'Z')}\n`);
  }
  process.exit(0);
}

const blockName = argv[0].replace(/\.md$/, '');
if (!/^[a-z][a-z0-9-]*$/.test(blockName)) {
  process.stderr.write(`invalid block name: ${blockName} (must match /^[a-z][a-z0-9-]*$/)\n`);
  process.exit(1);
}
const p = path.join(CORE_DIR, blockName + '.md');
if (!fs.existsSync(p)) {
  process.stderr.write(`no such block: ${blockName}\n`);
  process.exit(1);
}
process.stdout.write(fs.readFileSync(p, 'utf8'));
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
