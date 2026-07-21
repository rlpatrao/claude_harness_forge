#!/usr/bin/env node
'use strict';

// Declarative invariant checker (BRD invariants). Stdlib-only.
// Parses a constrained YAML subset (list of flat maps) and evaluates
// each invariant. Exit 0 if all `required` pass; 1 if any required
// fails; 2 on config parse error. See config/invariants.yaml.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- constrained YAML parser (list of single-level maps) ----
function coerce(v) {
  const t = v.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => coerce(s));
  }
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseInvariantsYaml(text) {
  const items = [];
  let cur = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    const noComment = line.replace(/\s+#.*$/, '');
    if (noComment.trim() === '') continue;
    const itemMatch = noComment.match(/^(\s*)-\s+(\w[\w-]*):\s*(.*)$/);
    if (itemMatch) {
      if (cur) items.push(cur);
      cur = {};
      cur[itemMatch[2]] = coerce(itemMatch[3]);
      continue;
    }
    const kvMatch = noComment.match(/^\s+(\w[\w-]*):\s*(.*)$/);
    if (kvMatch && cur) {
      cur[kvMatch[1]] = coerce(kvMatch[2]);
    }
  }
  if (cur) items.push(cur);
  return items;
}

// ---- minimal JSONPath: dotted keys, [n], __isArray, __length ----
function resolveJsonPath(obj, pathStr) {
  let node = obj;
  const parts = pathStr.replace(/^\$\.?/, '').split('.').filter(Boolean);
  for (const part of parts) {
    if (part === '__isArray') return Array.isArray(node);
    if (part === '__length') return node == null ? undefined : node.length;
    const idx = part.match(/^(\w+)\[(\d+)\]$/);
    if (idx) {
      node = node && node[idx[1]];
      node = node && node[parseInt(idx[2], 10)];
    } else {
      node = node && node[part];
    }
    if (node === undefined) return undefined;
  }
  return node;
}

// ---- evaluators ----
function evaluateInvariant(inv, rootDir) {
  const sev = inv.severity === 'advisory' ? 'advisory' : 'required';
  const fail = (detail) => ({ id: inv.id, ok: false, severity: sev, detail });
  const pass = () => ({ id: inv.id, ok: true, severity: sev, detail: '' });
  try {
    switch (inv.type) {
      case 'file_exists':
        return fs.existsSync(path.join(rootDir, inv.path)) ? pass() : fail(`missing ${inv.path}`);
      case 'glob_min_count': {
        const count = globCount(rootDir, inv.glob);
        return count >= inv.min ? pass() : fail(`found ${count} < min ${inv.min} for ${inv.glob}`);
      }
      case 'grep_match': {
        const fp = path.join(rootDir, inv.file);
        if (!fs.existsSync(fp)) return fail(`file missing ${inv.file}`);
        const re = new RegExp(inv.pattern);
        return re.test(fs.readFileSync(fp, 'utf8')) ? pass() : fail(`pattern /${inv.pattern}/ not found in ${inv.file}`);
      }
      case 'json_path_equals': {
        const fp = path.join(rootDir, inv.file);
        if (!fs.existsSync(fp)) return fail(`file missing ${inv.file}`);
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const val = resolveJsonPath(data, inv.path);
        return JSON.stringify(val) === JSON.stringify(inv.equals)
          ? pass() : fail(`${inv.path} = ${JSON.stringify(val)}, expected ${JSON.stringify(inv.equals)}`);
      }
      case 'hook_registered': {
        const sp = path.join(rootDir, 'settings.json');
        if (!fs.existsSync(sp)) return fail('settings.json missing');
        const settings = JSON.parse(fs.readFileSync(sp, 'utf8'));
        const events = (settings.hooks && settings.hooks[inv.event]) || [];
        const found = JSON.stringify(events).includes(inv.hook);
        return found ? pass() : fail(`${inv.hook} not registered under ${inv.event}`);
      }
      case 'command_exit_zero': {
        if (!Array.isArray(inv.cmd) || inv.cmd.length === 0) return fail('cmd must be a non-empty argv array');
        try {
          execFileSync(inv.cmd[0], inv.cmd.slice(1), { cwd: rootDir, stdio: 'ignore' });
          return pass();
        } catch (e) { return fail(`command failed: ${inv.cmd.join(' ')}`); }
      }
      case 'artifact_integrity': {
        let ai;
        try { ai = require(path.join(rootDir, 'hooks', 'lib', 'artifact-integrity.js')); }
        catch (e) { return fail('artifact-integrity lib not found'); }
        const r = ai.verifySidecar(rootDir, inv.feature_id);
        return r.ok ? pass() : fail(`integrity fail for ${inv.feature_id}: missing[${r.missing}] mismatch[${r.mismatches}]`);
      }
      default:
        return fail(`unknown invariant type: ${inv.type}`);
    }
  } catch (e) {
    return fail(`evaluator error: ${e.message}`);
  }
}

function globCount(rootDir, glob) {
  // Support only "<dir>/<pattern>" with a single * in the basename.
  const dir = path.join(rootDir, path.dirname(glob));
  const pat = path.basename(glob);
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => re.test(f)).length;
}

function findRoot(start) {
  let cur = start;
  while (true) {
    if (fs.existsSync(path.join(cur, 'config', 'invariants.yaml')) ||
        fs.existsSync(path.join(cur, '.git'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return start;
    cur = parent;
  }
}

function main(argv) {
  const args = argv.slice(2);
  const jsonOut = args.includes('--json');
  const fileIdx = args.indexOf('--file');
  const rootDir = findRoot(process.cwd());
  const configPath = fileIdx !== -1 ? path.resolve(args[fileIdx + 1]) : path.join(rootDir, 'config', 'invariants.yaml');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`ERROR: invariants config not found: ${configPath}\n`);
    process.exit(2);
  }
  let invs;
  try { invs = parseInvariantsYaml(fs.readFileSync(configPath, 'utf8')); }
  catch (e) { process.stderr.write(`ERROR: failed to parse ${configPath}: ${e.message}\n`); process.exit(2); }

  const results = invs.map((inv) => evaluateInvariant(inv, rootDir));
  const requiredFails = results.filter((r) => !r.ok && r.severity === 'required');
  const advisoryFails = results.filter((r) => !r.ok && r.severity === 'advisory');

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ results, requiredFails: requiredFails.length }, null, 2) + '\n');
  } else {
    for (const r of results) {
      const tag = r.ok ? 'PASS' : (r.severity === 'required' ? 'FAIL' : 'WARN');
      process.stdout.write(`${tag}  ${r.id}${r.ok ? '' : '  — ' + r.detail}\n`);
    }
    process.stdout.write(`\n${results.length} invariants: ${results.filter((r) => r.ok).length} pass, ${requiredFails.length} required-fail, ${advisoryFails.length} advisory-fail\n`);
  }
  process.exit(requiredFails.length > 0 ? 1 : 0);
}

if (require.main === module) main(process.argv);
module.exports = { parseInvariantsYaml, evaluateInvariant, resolveJsonPath, globCount };
