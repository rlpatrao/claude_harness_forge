#!/usr/bin/env node

'use strict';

// impact-scope — compute the feature blast radius of a set of changed
// files (BRD v3.2.4).
//
// Reads state/code-graph.json (from v3.1.9) for import edges, then
// does a reverse-BFS from changed files to find all files that
// (transitively) import them. Then maps files → owning features via
// each feature's declared paths (heuristic: filename-in-description,
// path-in-steps, or verification_artifact_path prefix).
//
// Usage:
//   node scripts/impact-scope.js                        # diff HEAD~1..HEAD
//   node scripts/impact-scope.js --staged                # diff --cached
//   node scripts/impact-scope.js --files a.js b.py       # explicit list
//   node scripts/impact-scope.js --format json           # JSON output
//
// Output (text mode):
//   Changed files: 3
//   Blast radius: 12 files (via 4 hops max)
//   Impacted features: 5
//     - v3.1.9-living-code-graph (matches: scripts/build-code-graph.js)
//     - ...

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();

const argv = process.argv.slice(2);
let mode = 'diff-head';   // 'diff-head' | 'staged' | 'explicit'
let explicitFiles = [];
let format = 'text';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--staged') mode = 'staged';
  else if (argv[i] === '--files') {
    mode = 'explicit';
    explicitFiles = argv.slice(i + 1).filter(a => !a.startsWith('--'));
    i += explicitFiles.length;
  } else if (argv[i] === '--format') format = argv[++i] || 'text';
}

// 1. Gather changed files
let changed = [];
if (mode === 'explicit') {
  changed = explicitFiles;
} else {
  try {
    const args = mode === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
      : ['diff', 'HEAD~1..HEAD', '--name-only', '--diff-filter=ACMR'];
    const out = execFileSync('git', args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    changed = out.split('\n').filter(Boolean);
  } catch (e) {
    process.stderr.write(`git diff failed: ${e.message}\n`);
    process.exit(1);
  }
}

if (changed.length === 0) {
  emit({ changed_files: [], blast_radius: [], impacted_features: [] });
  process.exit(0);
}

// 2. Load code-graph
const graphPath = path.join(ROOT, 'state', 'code-graph.json');
let graph = null;
if (fs.existsSync(graphPath)) {
  try { graph = JSON.parse(fs.readFileSync(graphPath, 'utf8')); } catch (_) {}
}

// 3. Compute reverse-BFS blast radius via import edges
const blast = new Set(changed);
if (graph && graph.files) {
  // Build reverse-dep map: for each file, who imports it?
  // Imports contain arbitrary strings (module names, relative paths).
  // Heuristic: match by basename or last-two-segments.
  const rdep = new Map();
  for (const [rel, rec] of Object.entries(graph.files)) {
    if (!rec.imports) continue;
    for (const imp of rec.imports) {
      const key = normalizeImport(imp.from);
      if (!key) continue;
      if (!rdep.has(key)) rdep.set(key, new Set());
      rdep.get(key).add(rel);
    }
  }
  // BFS up to 4 hops
  const queue = changed.map(f => ({ file: f, hops: 0 }));
  while (queue.length > 0) {
    const { file, hops } = queue.shift();
    if (hops >= 4) continue;
    const bn = normalizePath(file);
    const importers = rdep.get(bn);
    if (!importers) continue;
    for (const imp of importers) {
      if (!blast.has(imp)) {
        blast.add(imp);
        queue.push({ file: imp, hops: hops + 1 });
      }
    }
  }
}

// 4. Map files → impacted features
const featureListPath = path.join(ROOT, 'feature_list.json');
let features = [];
if (fs.existsSync(featureListPath)) {
  try { features = JSON.parse(fs.readFileSync(featureListPath, 'utf8')); } catch (_) {}
}
const impacted = [];
for (const entry of features) {
  if (!entry || !entry.id) continue;
  const declaredPaths = declaredPathsForFeature(entry);
  const matches = [];
  for (const f of blast) {
    if (declaredPaths.some(dp => f === dp || f.startsWith(dp + '/') || f.endsWith('/' + path.basename(dp)))) {
      matches.push(f);
    }
  }
  if (matches.length > 0) {
    impacted.push({ id: entry.id, passes: entry.passes, matches, description: entry.description });
  }
}

emit({
  changed_files: changed,
  blast_radius: [...blast].sort(),
  blast_hops_max: 4,
  impacted_features: impacted,
  graph_present: !!graph,
  graph_stale: graph ? staleGraph(graph) : null,
});

// -- helpers --

function emit(obj) {
  if (format === 'json') {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    return;
  }
  process.stdout.write(`Changed files: ${obj.changed_files.length}\n`);
  for (const f of obj.changed_files) process.stdout.write(`  ${f}\n`);
  process.stdout.write(`\nBlast radius: ${obj.blast_radius.length} files`);
  process.stdout.write(obj.graph_present ? ` (via ${obj.blast_hops_max} hops max, from code-graph.json)\n` : ' (no code-graph.json — using file-set only)\n');
  process.stdout.write(`\nImpacted features: ${obj.impacted_features.length}\n`);
  for (const feat of obj.impacted_features) {
    process.stdout.write(`  - ${feat.id}${feat.passes ? '' : ' [passes:false]'} (matches: ${feat.matches.slice(0, 3).join(', ')}${feat.matches.length > 3 ? `, +${feat.matches.length - 3}` : ''})\n`);
  }
}

function normalizeImport(imp) {
  if (!imp) return null;
  const noExt = imp.replace(/\.(js|jsx|ts|tsx|mjs|cjs|py)$/, '');
  const segs = noExt.split(/[\/.]/).filter(Boolean);
  if (segs.length === 0) return null;
  return segs[segs.length - 1];   // last segment (basename-ish)
}
function normalizePath(p) {
  const b = path.basename(p).replace(/\.(js|jsx|ts|tsx|mjs|cjs|py)$/, '');
  return b;
}
function declaredPathsForFeature(entry) {
  const paths = new Set();
  const collect = (text) => {
    if (!text || typeof text !== 'string') return;
    const matches = text.match(/[\w./-]+\.(js|jsx|ts|tsx|mjs|cjs|py|md|json|yaml|yml|dsl|puml|mmd|sh)/g) || [];
    for (const m of matches) paths.add(m);
  };
  collect(entry.description);
  for (const s of (entry.steps || [])) collect(s);
  if (entry.verification_artifact_path) {
    paths.add(entry.verification_artifact_path);
  }
  return [...paths];
}
function staleGraph(graph) {
  const at = Date.parse(graph.generated_at || '');
  if (!at || isNaN(at)) return null;
  const ageMs = Date.now() - at;
  return ageMs > 24 * 3600 * 1000 ? Math.round(ageMs / 3600000) + 'h' : null;
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
