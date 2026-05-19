#!/usr/bin/env node

'use strict';

// BRD §4.6 — three-tier skills loader.
//
// Resolution priority (highest wins):
//   1. project-local:  <project>/.harness/skills/<name>/SKILL.md
//   2. user-global:    $HOME/.harness/skills/<name>/SKILL.md
//   3. built-in:       <forge>/skills/<name>/SKILL.md
//
// Usage:
//   node scripts/skills-loader.js list             -- all skill names (deduped)
//   node scripts/skills-loader.js resolve <name>   -- path to the winning SKILL.md
//   node scripts/skills-loader.js trace <name>     -- all tiers + which wins
//   node scripts/skills-loader.js read <name>      -- SKILL.md content
//
// Defensive: missing tier directories are skipped silently. If no tier
// has the skill, exit 1 with a helpful message.

const fs = require('fs');
const path = require('path');
const os = require('os');

function findProjectDir(startDir) {
  let cur = path.resolve(startDir);
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'feature_list.json')) ||
        fs.existsSync(path.join(cur, '.git'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return null;
}

function findForgeDir() {
  // The forge repo itself has skills/. Walk up from this script's dir.
  let cur = path.resolve(__dirname);
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'skills')) &&
        fs.existsSync(path.join(cur, '.claude-plugin'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return null;
}

const projectDir = findProjectDir(process.cwd());
const forgeDir = findForgeDir();
const userDir = path.join(os.homedir(), '.harness', 'skills');

const tiers = [
  { name: 'project', dir: projectDir ? path.join(projectDir, '.harness', 'skills') : null },
  { name: 'user', dir: userDir },
  { name: 'built-in', dir: forgeDir ? path.join(forgeDir, 'skills') : null },
];

function listInTier(tier) {
  if (!tier.dir || !fs.existsSync(tier.dir)) return [];
  try {
    return fs.readdirSync(tier.dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (_) { return []; }
}

function skillPath(tier, name) {
  if (!tier.dir) return null;
  const p = path.join(tier.dir, name, 'SKILL.md');
  return fs.existsSync(p) ? p : null;
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'list') {
  const all = new Set();
  for (const t of tiers) for (const n of listInTier(t)) all.add(n);
  console.log([...all].sort().join('\n'));
  process.exit(0);
}

if (cmd === 'resolve') {
  if (!arg) { process.stderr.write('Usage: skills-loader.js resolve <name>\n'); process.exit(1); }
  for (const t of tiers) {
    const p = skillPath(t, arg);
    if (p) { console.log(p); process.exit(0); }
  }
  process.stderr.write(`ERROR: skill "${arg}" not found in any tier\n`);
  process.exit(1);
}

if (cmd === 'trace') {
  if (!arg) { process.stderr.write('Usage: skills-loader.js trace <name>\n'); process.exit(1); }
  const result = { skill: arg, tiers: [], resolved: null };
  for (const t of tiers) {
    const p = skillPath(t, arg);
    result.tiers.push({ tier: t.name, dir: t.dir, present: !!p, path: p });
    if (p && !result.resolved) result.resolved = { tier: t.name, path: p };
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.resolved ? 0 : 1);
}

if (cmd === 'read') {
  if (!arg) { process.stderr.write('Usage: skills-loader.js read <name>\n'); process.exit(1); }
  for (const t of tiers) {
    const p = skillPath(t, arg);
    if (p) { process.stdout.write(fs.readFileSync(p, 'utf8')); process.exit(0); }
  }
  process.stderr.write(`ERROR: skill "${arg}" not found\n`);
  process.exit(1);
}

process.stderr.write('Usage: skills-loader.js {list | resolve <name> | trace <name> | read <name>}\n');
process.exit(1);
