#!/usr/bin/env node

'use strict';

// SessionStart hook. Emits a system reminder containing the BRD §3.1
// 8-step coding-agent startup sequence, the current feature_list.json
// pass/fail counts, the next failing feature with deps satisfied, the
// recent git log, and the tail of harness-progress.txt.
//
// Output format follows the Claude Agent SDK SessionStart hook contract:
//   { "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }
//
// Defensive: if anything fails or feature_list.json is missing, exit 0
// silently so a hook bug never blocks session startup.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const cwd = input.cwd || process.cwd();

function findProjectDir(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, '.claude')) ||
        fs.existsSync(path.join(current, 'feature_list.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

const projectDir = findProjectDir(cwd);
if (!projectDir) process.exit(0);

const featureListPath = path.join(projectDir, 'feature_list.json');
if (!fs.existsSync(featureListPath)) process.exit(0);

let entries;
try {
  entries = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
} catch (_) {
  process.exit(0);
}
if (!Array.isArray(entries)) process.exit(0);

const total = entries.length;
const passing = entries.filter(e => e && e.passes === true).length;
const failing = total - passing;

const passingIds = new Set(entries.filter(e => e && e.passes === true).map(e => e.id));
const nextFeature = entries.find(e =>
  e && e.passes === false &&
  (!Array.isArray(e.depends_on) || e.depends_on.every(d => passingIds.has(d)))
);

const progressPath = path.join(projectDir, 'harness-progress.txt');
let progressTail = '(none)';
if (fs.existsSync(progressPath)) {
  try {
    const content = fs.readFileSync(progressPath, 'utf8');
    progressTail = content.split('\n').slice(-30).join('\n');
  } catch (_) {}
}

let gitLog = '(git unavailable)';
try {
  gitLog = execSync('git log --oneline -20', {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  }).trim() || '(no commits)';
} catch (_) {}

const nextLine = nextFeature
  ? `→ ${nextFeature.id} (${nextFeature.source_section || 'no source'}) — ${nextFeature.description || ''}`
  : (failing === 0
      ? '→ All features passing. Run init.sh smoke for final confirmation, then exit.'
      : '→ No failing feature has all deps satisfied. Resolve a dependency cycle or escalate to HITL.');

const lines = [
  '## BRD v3.0 SessionStart — coding-agent startup (BRD §3.1)',
  '',
  `Project root: ${projectDir}`,
  `feature_list.json: ${passing}/${total} passing, ${failing} failing`,
  '',
  '### Next feature to work',
  nextLine,
  '',
  '### Recent commits',
  gitLog,
  '',
  '### harness-progress.txt (tail)',
  progressTail,
  '',
  '### 8-step startup',
  '1. pwd  2. read harness-progress.txt  3. read feature_list.json  4. git log -20  5. run init.sh smoke',
  '6. select highest-priority failing feature  7. work one feature  8. flip passes + commit + append progress',
  '',
  'Hard rule (BRD §3.8): do NOT flip a feature_list.json passes field without a verification artifact under verification/<id>.{png,json}. The e2e-gate hook (once 1b lands) and feature-edit-guard hook will reject otherwise.',
];

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: lines.join('\n'),
  },
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
