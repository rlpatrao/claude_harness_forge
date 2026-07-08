#!/usr/bin/env node

'use strict';

// run-compact — take verbose command output on stdin and produce a
// failure-first digest:
//   1. First: any lines matching FAIL / ERROR / Exception / Traceback
//      (with 2 lines of trailing context)
//   2. Then: a summary of last N non-empty lines
//   3. Skip: repetitive log-noise lines (identical after first 3
//      occurrences)
//
// Usage:
//   npm test 2>&1 | node scripts/run-compact.js
//   pytest -v 2>&1 | node scripts/run-compact.js --max-failures 10
//
// Also caches the raw output by content hash under
// state/context-cache/run-<hash>/raw.txt so it can be retrieved.
//
// Adapted from cwijayasundara/claude_harness_eng_v5 CCR pattern per
// BRD v3.1 §4 (v3.1.6).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
let maxFailures = 15;
let tailLines = 30;
let noCache = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--max-failures') maxFailures = parseInt(argv[++i], 10) || 15;
  else if (argv[i] === '--tail') tailLines = parseInt(argv[++i], 10) || 30;
  else if (argv[i] === '--no-cache') noCache = true;
}

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CACHE_DIR = path.join(ROOT, 'state', 'context-cache');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (_) {
  process.stderr.write('run-compact expects piped input on stdin\n');
  process.exit(1);
}
if (!raw.trim()) {
  process.stderr.write('empty input\n');
  process.exit(1);
}

// Failure detection patterns
const FAIL_PATTERNS = [
  /\bFAIL(ED)?\b/i,
  /\bERROR\b/,
  /\bException\b/,
  /^Traceback \(most recent call last\):/,
  /^\s+File "[^"]+", line \d+/,
  /\bAssertionError\b/,
  /\bSyntaxError\b/,
  /\bTypeError\b/,
  /\bReferenceError\b/,
  /^\s*expected /i,
  /^\s*got /i,
  /^E\s+/,               // pytest E-prefix
  /^\s*at .+\(.+\.(js|ts):\d+/,   // JS stack frames
  /\bnon-zero exit/i,
];

const lines = raw.split('\n');
const failures = [];
const seen = new Map();       // dedup identical lines >3

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed) continue;
  const count = (seen.get(trimmed) || 0) + 1;
  seen.set(trimmed, count);
  if (count > 3) continue;

  const matched = FAIL_PATTERNS.some(re => re.test(trimmed));
  if (matched) {
    const context = [line];
    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      const nxt = lines[i + j].trim();
      if (nxt) context.push(lines[i + j]);
    }
    failures.push({ lineNum: i + 1, block: context.join('\n') });
    if (failures.length >= maxFailures * 2) break;
  }
}

// Deduplicate failure blocks
const failuresUnique = [];
const failSeen = new Set();
for (const f of failures) {
  const k = f.block.slice(0, 200);
  if (failSeen.has(k)) continue;
  failSeen.add(k);
  failuresUnique.push(f);
  if (failuresUnique.length >= maxFailures) break;
}

// Tail
const nonEmpty = lines.filter(l => l.trim());
const tail = nonEmpty.slice(-tailLines);

// Digest
const digest = [];
digest.push(`# Run output — ${lines.length} lines total, ${failuresUnique.length} unique failure blocks`);
digest.push('');
if (failuresUnique.length > 0) {
  digest.push('## Failures (top ' + failuresUnique.length + ')');
  digest.push('');
  for (const f of failuresUnique) {
    digest.push(`### line ${f.lineNum}`);
    digest.push('```');
    digest.push(f.block);
    digest.push('```');
    digest.push('');
  }
} else {
  digest.push('## No FAIL / ERROR / Exception / Traceback markers detected.');
  digest.push('');
}
digest.push('## Tail (last ' + tail.length + ' non-empty lines)');
digest.push('```');
digest.push(tail.join('\n'));
digest.push('```');

process.stdout.write(digest.join('\n') + '\n');

// Cache raw for later --fresh retrieval
if (!noCache) {
  try {
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
    const entry = path.join(CACHE_DIR, 'run-' + hash);
    fs.mkdirSync(entry, { recursive: true });
    fs.writeFileSync(path.join(entry, 'raw.txt'), raw);
    fs.writeFileSync(path.join(entry, 'digest.md'), digest.join('\n'));
    process.stdout.write(`\n<!-- raw cached at state/context-cache/run-${hash}/raw.txt -->\n`);
  } catch (_) {}
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
