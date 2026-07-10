#!/usr/bin/env node

'use strict';

// PreToolUse(Bash) hook (BRD v3.1 §4, v3.1.5). Extracts *write targets*
// from a bash command line — file redirections (>, >>), tee, sed -i,
// dd of=, cp/mv destinations — and re-applies the same scope + secret
// protections that Write/Edit hooks apply. Closes the "agent runs
// `echo secret > .env`" bypass that Write-tool hooks alone cannot see.
//
// Adapted from cwijayasundara/claude_harness_eng_v5/.claude/hooks/pre-bash-gate.js
// per BRD v3.1 §4 (v3.1.5).
//
// Output: exit 0 to allow. Exit 2 to block with an explanation on stderr.
//
// Defensive: on parse ambiguity or unknown syntax, allow (don't block
// legitimate work). The gate is a backstop, not the only defense.

const fs = require('fs');
const path = require('path');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

if (input.tool_name !== 'Bash') process.exit(0);

const cmd = (input.tool_input && input.tool_input.command) || '';
if (!cmd || typeof cmd !== 'string') process.exit(0);

// Extract candidate write targets from the command.
// This is intentionally permissive — we err on the side of catching
// suspicious writes, not on exhaustive shell parsing.
const targets = new Set();

function pushTarget(raw) {
  if (!raw) return;
  // Strip quotes and leading options
  let t = raw.replace(/^['"]|['"]$/g, '').trim();
  if (!t) return;
  // Skip obvious non-file targets
  if (t.startsWith('-')) return;
  if (t === '/dev/null' || t === '/dev/stdout' || t === '/dev/stderr') return;
  if (t.startsWith('$(')  || t.startsWith('`')) return;
  targets.add(t);
}

// 1. Redirections: > file, >> file, &> file, 2> file, etc.
//    Skip heredocs (<<EOF ...).
const REDIR = /(?:^|[^<>&])(?:&?>|>>|\d*>|\d*>>|&?>>)\s*(['"]?[^\s'"|;&()`]+['"]?)/g;
let m;
while ((m = REDIR.exec(cmd)) !== null) {
  pushTarget(m[1]);
}

// 2. tee [-a] file
const TEE = /(?:^|\|)\s*tee\s+(?:-[ai]\s+)*(['"]?[^\s'"|;&()`]+['"]?)/g;
while ((m = TEE.exec(cmd)) !== null) {
  pushTarget(m[1]);
}

// 3. sed -i [ext] file
const SEDI = /\bsed\s+(?:-[a-zA-Z]+\s+)*-i(?:\s|\.\S*\s|\.\S*$)\s*(?:(?:'[^']*'|"[^"]*"|-e\s+\S+)\s+)*(['"]?[^\s'"|;&()`]+['"]?)/g;
while ((m = SEDI.exec(cmd)) !== null) {
  pushTarget(m[1]);
}

// 4. dd of=file
const DDOF = /\bdd\s+[^|;&]*\bof=(['"]?[^\s'"|;&()`]+['"]?)/g;
while ((m = DDOF.exec(cmd)) !== null) {
  pushTarget(m[1]);
}

// 5. cp / mv — last non-flag argument is destination
//    We only flag when destination is a *file* path likely to be sensitive.
//    Cheap heuristic: destination string matches SENSITIVE_PATTERNS.
const CPMV = /\b(cp|mv|install)\s+((?:-\S+\s+)*)([^|;&]+?)(?=\s*(?:\||;|&&|\|\||$))/g;
while ((m = CPMV.exec(cmd)) !== null) {
  const tail = m[3].trim();
  const parts = tail.split(/\s+/).filter(x => !x.startsWith('-'));
  if (parts.length >= 2) {
    pushTarget(parts[parts.length - 1]);
  }
}

if (targets.size === 0) process.exit(0);

// Sensitive path patterns (files or dirs we protect).
// Rationale mirrors hooks/protect-env.js + hooks/detect-secrets.js.
const SENSITIVE_PATTERNS = [
  /(^|\/)\.env(\.|$)/,             // .env, .env.local, .env.production
  /(^|\/)\.env-/,
  /(^|\/)id_rsa(\.pub)?$/,
  /(^|\/)id_ed25519(\.pub)?$/,
  /(^|\/)\.aws\/credentials$/,
  /(^|\/)\.ssh\//,
  /(^|\/)\.claude\/settings\.json$/,
  /(^|\/)credentials?\.json$/,
  /(^|\/)service-account.*\.json$/,
  /(^|\/)\.git\/config$/,
  /(^|\/)\.gitconfig$/,
];

// Also refuse writes *outside* the project directory (except /tmp, /var/tmp).
const cwd = input.cwd || process.cwd();
const projectRoot = findProjectRoot(cwd) || cwd;

function isSensitive(target) {
  for (const re of SENSITIVE_PATTERNS) {
    if (re.test(target)) return true;
  }
  return false;
}

function isOutOfScope(target) {
  let abs;
  try {
    abs = path.isAbsolute(target) ? target : path.resolve(projectRoot, target);
  } catch (_) {
    return false;
  }
  if (abs.startsWith(projectRoot + path.sep) || abs === projectRoot) return false;
  if (abs.startsWith('/tmp/') || abs.startsWith('/var/tmp/') || abs.startsWith('/private/tmp/')) return false;
  // Allow home-dot-claude for cross-project state
  if (abs.startsWith(process.env.HOME + '/.claude/')) return false;
  return true;
}

const violations = [];
for (const t of targets) {
  if (isSensitive(t)) {
    violations.push({ target: t, reason: 'sensitive path (.env / credentials / .ssh / .claude/settings)' });
  } else if (isOutOfScope(t)) {
    violations.push({ target: t, reason: 'out-of-scope path (outside project root and /tmp)' });
  }
}

if (violations.length === 0) process.exit(0);

// BRD v3.2.3: consult sensor-waivers before blocking. Waived
// violations emit an audit line but do not block. Subject format for
// pre-bash-gate: the target file path (violation.target).
let checkWaiver = () => ({ waived: false });
const checkWaiverCandidates = [
  path.join(projectRoot, 'scripts', 'check-waiver.js'),
  path.join(projectRoot, '.claude', 'scripts', 'check-waiver.js'),
  path.resolve(__dirname, '..', 'scripts', 'check-waiver.js'),  // hooks/../scripts
  path.resolve(__dirname, '..', '.claude', 'scripts', 'check-waiver.js'),
];
for (const cand of checkWaiverCandidates) {
  try {
    if (fs.existsSync(cand)) {
      ({ checkWaiver } = require(cand));
      break;
    }
  } catch (_) { /* try next candidate */ }
}

const stillBlocking = [];
for (const v of violations) {
  const result = checkWaiver('pre-bash-gate', v.target, projectRoot);
  if (result && result.waived) {
    process.stderr.write(result.audit_line + '\n');
  } else {
    stillBlocking.push(v);
  }
}

if (stillBlocking.length === 0) process.exit(0);

process.stderr.write('BLOCKED (pre-bash-gate, BRD v3.1 §4 v3.1.5): bash command writes to protected paths.\n\n');
process.stderr.write(`Command: ${cmd.length > 200 ? cmd.slice(0, 200) + '…' : cmd}\n\n`);
process.stderr.write('Violations:\n');
for (const v of stillBlocking) {
  process.stderr.write(`  - ${v.target}: ${v.reason}\n`);
}
process.stderr.write('\nWrite-tool hooks only see Write/Edit tool_use. Bash redirections bypass them.\n');
process.stderr.write('If this write is intentional, use the Write tool instead (which has documented scope rules) or add a waiver to specs/reviews/sensor-waivers.json (BRD v3.2.3 — see docs/sensor-arbitration.md and templates/sensor-waivers.schema.json).\n');
process.exit(2);

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
