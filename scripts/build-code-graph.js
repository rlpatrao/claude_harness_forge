#!/usr/bin/env node

'use strict';

// build-code-graph — scan the project tree (full or incremental) and
// produce state/code-graph.json + state/symbol-map.md.
//
// Usage:
//   node scripts/build-code-graph.js                 # full scan
//   node scripts/build-code-graph.js --files a.js b.js  # incremental
//
// Adapted from cwijayasundara/claude_harness_eng_v5/.claude/skills/code-map/
// per BRD v3.1 §4 (v3.1.9). Minimal viable regex parsers for JS/TS/PY/MD;
// unknown languages get size-only entries.
//
// Uses execFileSync only for `git ls-files` (safe: no user input).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const STATE = path.join(ROOT, 'state');
try { fs.mkdirSync(STATE, { recursive: true }); } catch (_) {}
const GRAPH_PATH = path.join(STATE, 'code-graph.json');
const SYMBOL_MAP_PATH = path.join(STATE, 'symbol-map.md');

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const argv = process.argv.slice(2);
let filesArg = null;
if (argv[0] === '--files') filesArg = argv.slice(1);

let paths;
if (filesArg) {
  paths = filesArg.map(p => path.relative(ROOT, path.resolve(p)));
} else {
  paths = listTrackedFiles();
}

// Load existing graph so incremental writes preserve unrelated entries
let graph = { generated_at: '', root: ROOT, files: {} };
if (fs.existsSync(GRAPH_PATH)) {
  try { graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch (_) {}
  if (!graph.files) graph.files = {};
}

let indexed = 0;
let skipped = 0;
for (const rel of paths) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { delete graph.files[rel]; skipped++; continue; }
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) { skipped++; continue; }
    if (st.size > MAX_FILE_BYTES) {
      graph.files[rel] = { path: rel, language: 'unknown', size_bytes: st.size, oversize: true, indexed_at: nowIso() };
      indexed++;
      continue;
    }
    const content = fs.readFileSync(abs, 'utf8');
    const record = indexFile(rel, content, st.size);
    record.indexed_at = nowIso();
    graph.files[rel] = record;
    indexed++;
  } catch (e) {
    graph.files[rel] = { path: rel, language: 'unknown', error: e.message, indexed_at: nowIso() };
    skipped++;
  }
}

graph.generated_at = nowIso();
graph.total_files = Object.keys(graph.files).length;

fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
fs.writeFileSync(SYMBOL_MAP_PATH, renderSymbolMap(graph));

process.stdout.write(`code-graph: ${indexed} indexed, ${skipped} skipped, total ${graph.total_files} files\n`);
process.stdout.write(`  ${path.relative(ROOT, GRAPH_PATH)}\n`);
process.stdout.write(`  ${path.relative(ROOT, SYMBOL_MAP_PATH)}\n`);
process.exit(0);

// -- indexers --

function indexFile(relPath, content, size) {
  const ext = path.extname(relPath).toLowerCase();
  const lineCount = content.split('\n').length;
  const sha = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  const base = { path: relPath, size_bytes: size, line_count: lineCount, sha };

  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    return { ...base, language: 'javascript', ...indexJs(content) };
  }
  if (ext === '.py') {
    return { ...base, language: 'python', ...indexPython(content) };
  }
  if (ext === '.md' || ext === '.markdown') {
    return { ...base, language: 'markdown', ...indexMarkdown(content) };
  }
  if (ext === '.json') {
    return { ...base, language: 'json', defines: [], imports: [], exports: [] };
  }
  return { ...base, language: 'unknown', defines: [], imports: [], exports: [] };
}

function indexJs(content) {
  const lines = content.split('\n');
  const defines = [];
  const imports = [];
  const exports = [];

  const RE_IMPORT = /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/;
  const RE_REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/;
  const RE_EXPORT_DEFAULT = /^\s*export\s+default\s+/;
  const RE_MODULE_EXPORTS = /^\s*module\.exports\s*=/;
  const RE_FN = /^\s*(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const RE_CLASS = /^\s*(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const RE_VAR = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/;
  const RE_ARROW = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/;
  const RE_NAMED_EXPORT = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const RE_INTERFACE = /^\s*(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const RE_TYPE = /^\s*(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(RE_IMPORT))) imports.push({ from: m[1], line: i + 1 });
    else if ((m = line.match(RE_REQUIRE))) imports.push({ from: m[1], line: i + 1 });

    if (RE_EXPORT_DEFAULT.test(line)) exports.push({ name: 'default', line: i + 1 });
    if (RE_MODULE_EXPORTS.test(line)) exports.push({ name: 'module.exports', line: i + 1 });

    if ((m = line.match(RE_NAMED_EXPORT))) exports.push({ name: m[1], line: i + 1 });
    if ((m = line.match(RE_FN))) defines.push({ kind: 'function', name: m[1], line: i + 1 });
    else if ((m = line.match(RE_CLASS))) defines.push({ kind: 'class', name: m[1], line: i + 1 });
    else if ((m = line.match(RE_INTERFACE))) defines.push({ kind: 'interface', name: m[1], line: i + 1 });
    else if ((m = line.match(RE_TYPE))) defines.push({ kind: 'type', name: m[1], line: i + 1 });
    else if ((m = line.match(RE_ARROW))) defines.push({ kind: 'arrow', name: m[1], line: i + 1 });
    else if ((m = line.match(RE_VAR))) defines.push({ kind: 'var', name: m[1], line: i + 1 });
  }
  return { defines, imports, exports };
}

function indexPython(content) {
  const lines = content.split('\n');
  const defines = [];
  const imports = [];
  const exports = [];   // Python doesn't have exports; use __all__ heuristic

  const RE_IMPORT = /^\s*import\s+([A-Za-z_][A-Za-z0-9_.]*)/;
  const RE_FROM = /^\s*from\s+([A-Za-z_.][A-Za-z0-9_.]*)\s+import/;
  const RE_DEF = /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const RE_CLASS = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const RE_TOP_ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*/;   // top-level (no leading ws)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(RE_IMPORT))) imports.push({ from: m[1], line: i + 1 });
    if ((m = line.match(RE_FROM))) imports.push({ from: m[1], line: i + 1 });
    if ((m = line.match(RE_DEF))) defines.push({ kind: 'function', name: m[1], line: i + 1 });
    if ((m = line.match(RE_CLASS))) defines.push({ kind: 'class', name: m[1], line: i + 1 });
    if (!line.startsWith(' ') && !line.startsWith('\t') && (m = line.match(RE_TOP_ASSIGN))) {
      if (m[1] === '__all__') exports.push({ name: '__all__', line: i + 1 });
      else defines.push({ kind: 'assign', name: m[1], line: i + 1 });
    }
  }
  return { defines, imports, exports };
}

function indexMarkdown(content) {
  const lines = content.split('\n');
  const headings = [];
  const RE_HEADING = /^(#{1,6})\s+(.+)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(RE_HEADING);
    if (m) headings.push({ kind: 'heading', level: m[1].length, name: m[2].trim(), line: i + 1 });
  }
  return { defines: headings, imports: [], exports: [] };
}

// -- symbol map renderer --

function renderSymbolMap(graph) {
  const byDir = new Map();
  for (const [rel, rec] of Object.entries(graph.files || {})) {
    const dir = path.dirname(rel);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(rec);
  }
  const dirs = [...byDir.keys()].sort();
  const out = [];
  out.push('# Symbol Map — living code index (BRD v3.1 §4 v3.1.9)');
  out.push('');
  out.push(`Generated: \`${graph.generated_at}\` · ${graph.total_files} files`);
  out.push('');
  out.push('_Auto-regenerated by `scripts/build-code-graph.js` on Stop event._');
  out.push('_Machine-readable twin: `state/code-graph.json`._');
  out.push('');

  for (const dir of dirs) {
    const files = byDir.get(dir).sort((a, b) => a.path.localeCompare(b.path));
    const totalDefines = files.reduce((n, f) => n + ((f.defines && f.defines.length) || 0), 0);
    if (totalDefines === 0 && files.every(f => f.language === 'unknown' || f.language === 'json')) continue;
    out.push(`## ${dir === '.' ? '(root)' : dir}`);
    for (const f of files) {
      const def = (f.defines || []).filter(d => d.name && d.name !== 'default');
      if (def.length === 0 && f.language !== 'markdown') continue;
      out.push('');
      out.push(`### \`${f.path}\` (${f.language}, ${f.line_count || 0} lines)`);
      if (f.imports && f.imports.length) {
        const uniq = [...new Set(f.imports.map(i => i.from))].slice(0, 8);
        out.push(`- imports: ${uniq.map(x => '`' + x + '`').join(', ')}${f.imports.length > 8 ? ` (+${f.imports.length - 8})` : ''}`);
      }
      if (def.length > 0) {
        const top = def.slice(0, 20);
        out.push(`- defines:`);
        for (const d of top) {
          out.push(`  - \`${d.name}\` (${d.kind || 'symbol'}, [L${d.line}](../${f.path}#L${d.line}))`);
        }
        if (def.length > 20) out.push(`  - _(+${def.length - 20} more)_`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

// -- utils --

function listTrackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024
    });
    return out.split('\n').filter(Boolean).filter(p => {
      // Skip known non-source paths
      if (p.includes('node_modules/')) return false;
      if (p.includes('.git/')) return false;
      if (p.includes('state/context-cache/')) return false;
      if (p.includes('__pycache__/')) return false;
      if (p.startsWith('.venv/') || p.includes('/.venv/')) return false;
      return true;
    });
  } catch (_) {
    return [];
  }
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z/, 'Z');
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
