#!/usr/bin/env node

'use strict';

// BRD §3.4 — workflow → model resolver.
//
// Reads config/workflows.yaml. Given a workflow name, returns the
// resolved binding: { primary, failover[], thinking_level, max_iterations,
// tools_filter, rationale }.
//
// Usage:
//   node scripts/workflows-resolver.js <workflow-name>          -- JSON to stdout
//   node scripts/workflows-resolver.js <workflow-name> --field primary
//   node scripts/workflows-resolver.js --list                   -- all workflow names
//   node scripts/workflows-resolver.js --resolve-placeholder "{{model:critic}}"
//
// Minimal YAML parser inline (no pyyaml dependency). Handles only the
// flat key:value + nested key + list-of-strings shapes used in our file.

const fs = require('fs');
const path = require('path');
const { parse: parseYAML } = require('./yaml-mini.js');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'config', 'workflows.yaml'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

// === main ===
const root = findRoot();
if (!root) {
  process.stderr.write('ERROR: could not find config/workflows.yaml (searched upward from cwd)\n');
  process.exit(1);
}

let parsed;
try {
  const yamlText = fs.readFileSync(path.join(root, 'config', 'workflows.yaml'), 'utf8');
  parsed = parseYAML(yamlText);
} catch (e) {
  process.stderr.write(`ERROR: failed to parse workflows.yaml: ${e.message}\n`);
  process.exit(1);
}

const workflows = parsed.workflows || {};
const defaults = parsed.defaults || {};

function resolve(name) {
  const w = workflows[name];
  if (!w) return null;
  return {
    primary: w.primary || defaults.primary || null,
    failover: w.failover || [],
    thinking_level: w.thinking_level || defaults.thinking_level || 'low',
    max_iterations: w.max_iterations || defaults.max_iterations || 40,
    tools_filter: w.tools_filter || 'full',
    rationale: w.rationale || '',
  };
}

const args = process.argv.slice(2);

if (args[0] === '--list') {
  console.log(Object.keys(workflows).join('\n'));
  process.exit(0);
}

if (args[0] === '--resolve-placeholder') {
  const placeholder = args[1] || '';
  const m = placeholder.match(/\{\{model:([\w-]+)\}\}/);
  if (!m) {
    process.stderr.write('ERROR: placeholder must match {{model:<workflow>}}\n');
    process.exit(1);
  }
  const resolved = resolve(m[1]);
  if (!resolved) {
    process.stderr.write(`ERROR: unknown workflow ${m[1]}\n`);
    process.exit(1);
  }
  console.log(resolved.primary);
  process.exit(0);
}

const name = args[0];
if (!name) {
  process.stderr.write('Usage: workflows-resolver.js <workflow-name> [--field <field>] | --list | --resolve-placeholder "{{model:foo}}"\n');
  process.exit(1);
}

const resolved = resolve(name);
if (!resolved) {
  process.stderr.write(`ERROR: workflow "${name}" not found in workflows.yaml\n`);
  process.exit(1);
}

const fieldIdx = args.indexOf('--field');
if (fieldIdx >= 0 && args[fieldIdx + 1]) {
  const f = args[fieldIdx + 1];
  if (!(f in resolved)) {
    process.stderr.write(`ERROR: unknown field "${f}"\n`);
    process.exit(1);
  }
  const v = resolved[f];
  console.log(typeof v === 'object' ? JSON.stringify(v) : v);
} else {
  console.log(JSON.stringify(resolved, null, 2));
}
