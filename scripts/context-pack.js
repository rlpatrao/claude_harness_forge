#!/usr/bin/env node

'use strict';

// context-pack — bounded citations for a natural-language question
// (BRD v3.1 §4, v3.1.6). Emits a compact digest instead of dumping raw
// file contents into context.
//
// Usage:
//   node scripts/context-pack.js "<question>"
//   node scripts/context-pack.js --fresh "<question>"    # bypass cache
//   node scripts/context-pack.js --max 30 "<question>"   # up to 30 citations
//
// State: state/context-cache/<hash>/{raw.txt,digest.md,manifest.json}
// Cache TTL: 30 minutes soft.
//
// Adapted from cwijayasundara/claude_harness_eng_v5 CCR pipeline pattern
// per BRD v3.1 §4 (v3.1.6).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CACHE_DIR = path.join(ROOT, 'state', 'context-cache');
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_CITATIONS = 15;
const DEFAULT_CONTEXT_LINES = 1;

// Parse args
const argv = process.argv.slice(2);
let fresh = false;
let maxCitations = DEFAULT_MAX_CITATIONS;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--fresh') { fresh = true; }
  else if (argv[i] === '--max') { maxCitations = parseInt(argv[++i], 10) || DEFAULT_MAX_CITATIONS; }
  else { positional.push(argv[i]); }
}
const question = positional.join(' ').trim();
if (!question) {
  process.stderr.write('usage: context-pack.js [--fresh] [--max N] "<question>"\n');
  process.exit(1);
}

let headSha = 'no-git';
try {
  headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch (_) {}

const hash = crypto.createHash('sha256').update(question + '@' + headSha).digest('hex').slice(0, 12);
const cacheEntry = path.join(CACHE_DIR, hash);
const digestPath = path.join(cacheEntry, 'digest.md');
const rawPath = path.join(cacheEntry, 'raw.txt');
const manifestPath = path.join(cacheEntry, 'manifest.json');

// Cache check
if (!fresh && fs.existsSync(digestPath)) {
  try {
    const mtimeMs = fs.statSync(digestPath).mtimeMs;
    if (Date.now() - mtimeMs < CACHE_TTL_MS) {
      process.stdout.write(fs.readFileSync(digestPath, 'utf8'));
      process.stdout.write(`\n\n<!-- cached: ${cacheEntry} (age: ${Math.round((Date.now() - mtimeMs) / 1000)}s) -->\n`);
      process.exit(0);
    }
  } catch (_) {}
}

// Extract search terms from the question (strip stopwords + question words)
const STOP = new Set(['a','the','an','of','in','on','to','for','and','or','is','are','was','were','be','been','how','what','where','why','when','which','does','do','did','can','could','should','would','will','shall','may','might','use','used','uses','file','files','function','functions','method','methods','decide','handle','handles','handled','work','works','worked','defined','define','get','gets','set','sets','contain','contains','contained']);
const rawTerms = question.toLowerCase().split(/[^a-z0-9_]+/).filter(t => t && t.length >= 3 && !STOP.has(t));
// Keep camelCase original tokens too
const camelTerms = (question.match(/[A-Za-z][A-Za-z0-9_]{2,}/g) || []).filter(t => !STOP.has(t.toLowerCase()));
const searchTerms = Array.from(new Set([...rawTerms, ...camelTerms]));

if (searchTerms.length === 0) {
  process.stderr.write('no searchable terms extracted from question; refine and retry\n');
  process.exit(1);
}

// Pick primary term(s): the longest ones (heuristic — proper nouns / camelCase / snake_case matter)
searchTerms.sort((a, b) => b.length - a.length);
const primary = searchTerms.slice(0, 3);
const secondary = searchTerms.slice(3, 6);

// Run rg (or grep -r fallback) for each primary term
const hits = [];
const hitByFile = new Map();

function runSearch(term) {
  // Terms are pre-filtered to /[A-Za-z0-9_]+/ by the caller. Even so, use
  // execFileSync with an argument array so no shell parses the term.
  const rgArgs = [
    '--line-number', '--column', '--with-filename',
    '--max-count', '20',
    '--glob', '!node_modules',
    '--glob', '!.git',
    '--glob', '!state/context-cache',
    '--glob', '!.venv', '--glob', '!venv', '--glob', '!__pycache__',
    '--glob', '!dist', '--glob', '!build',
    '--glob', '!*.min.*',
    '--glob', '!*.lock',
    '--glob', '!*.png', '--glob', '!*.jpg', '--glob', '!*.gif',
    '--glob', '!*.txt',                       // dedup: model-name lists etc.
    '--context', String(DEFAULT_CONTEXT_LINES),
    '--', term
  ];
  try {
    return execFileSync('rg', rgArgs, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 4 * 1024 * 1024
    });
  } catch (_) {
    // rg missing or no matches — try grep
    const grepArgs = [
      '-rn',
      '--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=state',
      '--exclude=*.min.*',
      '--', term, '.'
    ];
    try {
      return execFileSync('grep', grepArgs, {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 4 * 1024 * 1024
      });
    } catch (_) { return ''; }
  }
}

const rawParts = [];
for (const term of primary) {
  const out = runSearch(term);
  if (!out) continue;
  rawParts.push(`### primary term: ${term}\n${out}`);
  parseHits(out, term, hits, hitByFile);
}
// Only search secondary if we have room
if (hits.length < maxCitations && secondary.length > 0) {
  for (const term of secondary) {
    const out = runSearch(term);
    if (!out) continue;
    rawParts.push(`### secondary term: ${term}\n${out}`);
    parseHits(out, term, hits, hitByFile);
    if (hits.length >= maxCitations * 2) break;
  }
}

// Rank: definition sites > function/class matches > other
function score(hit) {
  const line = hit.snippet || '';
  let s = 0;
  if (/^\s*(function|class|def|const|let|var|export|type|interface)\b/.test(line)) s += 10;
  if (/^\s*(#{1,4})\s/.test(line)) s += 8;               // markdown heading
  if (/module\.exports|export default/.test(line)) s += 6;
  if (line.length < 40) s += 3;                          // shorter = probably declaration
  if (/\/\/|\/\*|#[^!]/.test(line)) s -= 2;              // comment only
  return s;
}
hits.forEach(h => { h._score = score(h); });
hits.sort((a, b) => b._score - a._score);

const topHits = hits.slice(0, maxCitations);

// Rank files by hit count
const fileRank = [...hitByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

// Build digest
const digestLines = [];
digestLines.push(`# Context digest for: ${question}`);
digestLines.push('');
digestLines.push(`Question hash: \`${hash}\` · HEAD: \`${headSha.slice(0, 12)}\` · terms: ${primary.join(', ')}${secondary.length ? ' + ' + secondary.join(', ') : ''}`);
digestLines.push('');
if (topHits.length === 0) {
  digestLines.push('**No hits found.** Search terms may have been too specific. Try rephrasing with different keywords.');
} else {
  digestLines.push('## Citations (ranked)');
  digestLines.push('');
  topHits.forEach((h, i) => {
    const relFile = path.relative(ROOT, path.join(ROOT, h.file));
    digestLines.push(`${i + 1}. \`${relFile}:${h.line}\` — ${truncate(h.snippet, 100)}`);
  });
  digestLines.push('');
  if (fileRank.length > 0) {
    digestLines.push('## If you need to read one whole file, start with');
    digestLines.push('');
    for (const [file, count] of fileRank) {
      digestLines.push(`- \`${file}\` (${count} citations)`);
    }
    digestLines.push('');
  }
}
digestLines.push('---');
digestLines.push('_Reduce cost: prefer citations over full-file Reads. Bypass cache with `--fresh`. Cache TTL 30 min._');

const digest = digestLines.join('\n');

// Write cache
try {
  fs.mkdirSync(cacheEntry, { recursive: true });
  fs.writeFileSync(digestPath, digest);
  fs.writeFileSync(rawPath, rawParts.join('\n\n'));
  fs.writeFileSync(manifestPath, JSON.stringify({
    question, hash, head_sha: headSha,
    generated_at: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
    citations: topHits.length,
    files_touched: hitByFile.size,
    primary_terms: primary,
    secondary_terms: secondary
  }, null, 2));
  evictIfNeeded();
} catch (e) {
  process.stderr.write(`warning: cache write failed: ${e.message}\n`);
}

process.stdout.write(digest + '\n');
process.exit(0);

// -- helpers --

function parseHits(rgOut, term, hits, hitByFile) {
  for (const line of rgOut.split('\n')) {
    // rg format: file:line:col:content OR file-line-content (context)
    let m = line.match(/^([^:\n]+):(\d+):\d+:(.*)$/);
    if (!m) m = line.match(/^([^:\n]+):(\d+):(.*)$/);
    if (!m) continue;
    const [, file, ln, snippet] = m;
    if (!file || !snippet) continue;
    const key = `${file}:${ln}`;
    if (hits.some(h => h.file === file && h.line === parseInt(ln, 10))) continue;
    hits.push({ file, line: parseInt(ln, 10), snippet: snippet.trim(), term });
    hitByFile.set(file, (hitByFile.get(file) || 0) + 1);
  }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
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

function evictIfNeeded() {
  if (!fs.existsSync(CACHE_DIR)) return;
  let entries = [];
  for (const name of fs.readdirSync(CACHE_DIR)) {
    const p = path.join(CACHE_DIR, name);
    try {
      const st = fs.statSync(p);
      if (!st.isDirectory()) continue;
      let size = 0;
      for (const f of fs.readdirSync(p)) {
        try { size += fs.statSync(path.join(p, f)).size; } catch (_) {}
      }
      entries.push({ p, mtime: st.mtimeMs, size });
    } catch (_) {}
  }
  const total = entries.reduce((a, b) => a + b.size, 0);
  if (total <= MAX_CACHE_BYTES) return;
  entries.sort((a, b) => a.mtime - b.mtime);
  let freed = 0;
  const target = total - MAX_CACHE_BYTES * 0.8;
  for (const e of entries) {
    if (freed >= target) break;
    try { fs.rmSync(e.p, { recursive: true, force: true }); freed += e.size; } catch (_) {}
  }
}
