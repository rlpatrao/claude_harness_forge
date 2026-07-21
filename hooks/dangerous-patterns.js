#!/usr/bin/env node

'use strict';


// Cleanup-plan Phase 2 (2026-07-21): fire-log instrumentation.
try { require('./lib/fire-log.js')('dangerous-patterns'); } catch (_) {}

// PreToolUse hook — BRD §4.1 Layer 4 (tool-level validation). Blocks
// known-dangerous patterns at the tool layer regardless of permission
// classifier (Layer 3). Layer 5 (existing 19 hooks) handles the rest.
//
// What we block (exit 2):
//   - Bash: rm -rf /, rm -rf $HOME, rm -rf ~, > /dev/sda, mkfs.*, dd if=*/of=/dev/*
//   - Bash: curl|wget piped to sh/bash (supply-chain injection vector)
//   - Bash: chmod 777 /, chown -R /
//   - Bash: git push --force on protected branches (main/master/release/*)
//   - Bash: --no-verify on git commit/push (skips hooks)
//   - Bash: --no-gpg-sign on git (bypasses signing)
//   - Edit/Write: writing to .env*, *.pem, *.key, id_rsa* — secret files
//
// Defensive: exit 0 on any infra failure. We only ever block on
// strong evidence; ambiguous cases get a warning to stderr (still exit 0).

const fs = require('fs');
const path = require('path');

function block(reason, fix) {
  process.stderr.write(`BLOCKED by Layer-4 dangerous-patterns hook (BRD §4.1): ${reason}\n`);
  if (fix) process.stderr.write(`Fix: ${fix}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = input.tool_name || '';
const ti = input.tool_input || {};

// -------- Bash patterns --------
if (tool === 'Bash') {
  const cmd = (ti.command || '').toString();
  // rm -rf at filesystem root or $HOME
  if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[^\n]*?\s+(\/|\$HOME|~|\/\*)(\s|$)/.test(cmd)) {
    block('rm -rf targeting root/$HOME/~/glob — refused.', 'Use an explicit subpath.');
  }
  // dd to a raw block device
  if (/\bdd\b[^\n]*\bof=\s*\/dev\//.test(cmd)) {
    block('dd writing to a raw /dev/ device — refused.', 'Use a regular-file target.');
  }
  // mkfs on any device
  if (/\bmkfs(\.[a-zA-Z0-9]+)?\s+/.test(cmd)) {
    block('mkfs (filesystem creation) — refused.', 'No filesystem-format operations from this harness.');
  }
  // curl|wget piped to sh/bash
  if (/(curl|wget)[^\n]*\|\s*(sudo\s+)?(sh|bash|zsh|fish)\b/.test(cmd)) {
    block('curl/wget piped to a shell — refused (supply-chain injection vector).',
          'Download to a file, inspect it, then run it explicitly.');
  }
  // chmod 777 on /
  if (/\bchmod\s+777\s+\/(\s|$)/.test(cmd)) {
    block('chmod 777 / — refused.', 'Be specific about the path.');
  }
  // chown -R on /
  if (/\bchown\s+-R\s+[^\s]+\s+\/(\s|$)/.test(cmd)) {
    block('chown -R targeting / — refused.', 'Use an explicit subpath.');
  }
  // git push --force on protected branches
  if (/\bgit\s+push\b[^\n]*--force(-with-lease)?\b/.test(cmd) &&
      /\b(main|master|release\/|production|prod)\b/.test(cmd)) {
    block('git push --force to a protected branch — refused.',
          'Branch protections exist for a reason. If this is genuinely needed, take it through review explicitly.');
  }
  // --no-verify on git commit/push
  if (/\bgit\s+(commit|push)\b[^\n]*--no-verify\b/.test(cmd)) {
    block('git --no-verify (skips hooks) — refused.',
          'If a hook fails, fix the underlying issue rather than bypass it.');
  }
  // --no-gpg-sign on git
  if (/\bgit\b[^\n]*--no-gpg-sign\b/.test(cmd) ||
      /\bgit\b[^\n]*-c\s+commit\.gpgsign=false\b/.test(cmd)) {
    block('git --no-gpg-sign / commit.gpgsign=false — refused.',
          'Signing is policy. If it is misconfigured, fix the configuration upstream.');
  }
}

// -------- Edit/Write to secret-shaped paths --------
if (tool === 'Edit' || tool === 'Write') {
  const fp = (ti.file_path || '').toString();
  const base = path.basename(fp);
  const secretRe = /^(\.env(\..*)?|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa(\..*)?|id_ed25519(\..*)?|.*\.kdbx)$/i;
  if (base && secretRe.test(base)) {
    block(`writing to a secret-shaped path: ${fp}`,
          'Secrets live outside the repo. Use a secrets manager or .env.local on disk only.');
  }
}

process.exit(0);
