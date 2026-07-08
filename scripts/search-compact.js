#!/usr/bin/env node

'use strict';

// search-compact — take verbose search output (from rg, grep, find,
// ripgrep --json, etc.) piped on stdin and produce a compact digest:
// group by file, count hits per file, keep only the 3 highest-signal
// line snippets per file, cap total lines.
//
// Usage:
//   rg <pattern> | node scripts/search-compact.js
//   find . -type f -name '*.py' | node scripts/search-compact.js --paths
//   node scripts/search-compact.js --max-files 30 --lines-per-file 2 < input
//
// Adapted from cwijayasundara/claude_harness_eng_v5 CCR pattern per
// BRD v3.1 §4 (v3.1.6).

const fs = require('fs');

const argv = process.argv.slice(2);
let maxFiles = 30;
let linesPerFile = 3;
let pathsOnly = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--max-files') maxFiles = parseInt(argv[++i], 10) || 30;
  else if (argv[i] === '--lines-per-file') linesPerFile = parseInt(argv[++i], 10) || 3;
  else if (argv[i] === '--paths') pathsOnly = true;
}

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch (_) {
  process.stderr.write('search-compact expects piped input on stdin\n');
  process.exit(1);
}
if (!raw.trim()) {
  process.stderr.write('empty input\n');
  process.exit(1);
}

if (pathsOnly) {
  // Deduplicate paths, sort, cap
  const paths = new Set();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t) paths.add(t);
  }
  const sorted = [...paths].sort();
  process.stdout.write(`# ${sorted.length} unique paths\n\n`);
  process.stdout.write(sorted.slice(0, maxFiles * 4).map(p => `- ${p}`).join('\n') + '\n');
  if (sorted.length > maxFiles * 4) {
    process.stdout.write(`\n_(truncated: ${sorted.length - maxFiles * 4} more paths)_\n`);
  }
  process.exit(0);
}

// Parse rg/grep-like output: file:line[:col]:content or file-line-content (context lines)
const byFile = new Map();
for (const line of raw.split('\n')) {
  if (!line) continue;
  let m = line.match(/^([^:\n]+?):(\d+):(?:\d+:)?(.*)$/);
  if (!m) m = line.match(/^([^-\n]+?)-(\d+)-(.*)$/);
  if (!m) continue;
  const [, file, ln, snippet] = m;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line: parseInt(ln, 10), snippet: snippet.trim() });
}

const files = [...byFile.entries()]
  .map(([file, hits]) => ({ file, hits, count: hits.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, maxFiles);

process.stdout.write(`# Search results — ${byFile.size} files, ${[...byFile.values()].flat().length} hits\n\n`);
if (byFile.size > maxFiles) {
  process.stdout.write(`_Showing top ${maxFiles} files by hit count._\n\n`);
}
for (const f of files) {
  process.stdout.write(`## ${f.file} (${f.count} hits)\n`);
  // Score: definitions/headings first, then short snippets
  const scored = f.hits.map(h => ({ ...h, score: scoreLine(h.snippet) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, linesPerFile);
  for (const s of scored) {
    process.stdout.write(`- L${s.line}: ${truncate(s.snippet, 120)}\n`);
  }
  process.stdout.write('\n');
}

function scoreLine(s) {
  let x = 0;
  if (/^\s*(function|class|def|const|let|var|export|type|interface|module\.exports|export default)\b/.test(s)) x += 10;
  if (/^\s*#{1,4}\s/.test(s)) x += 8;
  if (s.length < 40) x += 3;
  if (/^\s*(\/\/|\/\*|#[^!])/.test(s)) x -= 2;
  return x;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
