#!/usr/bin/env node

'use strict';


// Cleanup-plan Phase 2 (2026-07-21): fire-log instrumentation.
try { require('./lib/fire-log.js')('ralph-loop'); } catch (_) {}

// Stop-event hook (BRD §3.3). Intercepts agent exit when
// feature_list.json has any passes:false entries. Emits a system
// reminder asking the agent to continue; with low context budget,
// requests compaction + reinjection of harness-progress.txt summary +
// original goal.
//
// Output uses the Claude Agent SDK Stop hook shape:
//   { decision: "block", reason: "..." }
// to prevent termination, OR
//   { hookSpecificOutput: { hookEventName: "Stop", additionalContext: "..." } }
// to inject a reminder while allowing termination.
//
// We prefer the additionalContext path on the first Stop event of a
// session and the decision:block path if the agent has already been
// reminded (tracked via a session marker file). This avoids infinite
// loops where the hook keeps blocking with no progress.
//
// Defensive: exit 0 if anything fails. Never block legitimate exit when
// feature_list.json is missing or unparseable.

const fs = require('fs');
const path = require('path');
const os = require('os');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id || 'unknown';
const cwd = input.cwd || process.cwd();
const stopHookActive = input.stop_hook_active === true;

function findProjectDir(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'feature_list.json')) ||
        fs.existsSync(path.join(current, '.claude'))) {
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

const failing = entries.filter(e => e && e.passes === false);

if (failing.length === 0) {
  // All features pass. Allow the Stop to proceed.
  process.exit(0);
}

// Compute context-budget regime estimate from input if provided
const totalTokens = input.total_tokens || 0;
const maxTokens = input.max_tokens || 200000;
const pctUsed = maxTokens > 0 ? totalTokens / maxTokens : 0;
const budgetCritical = pctUsed >= 0.7;

// Per-session marker so we don't infinite-loop with decision:block
const markerDir = path.join(os.tmpdir(), 'claude-harness-ralph');
try { fs.mkdirSync(markerDir, { recursive: true }); } catch (_) {}
const markerPath = path.join(markerDir, `${sessionId}.count`);
let interceptCount = 0;
try {
  if (fs.existsSync(markerPath)) {
    interceptCount = parseInt(fs.readFileSync(markerPath, 'utf8'), 10) || 0;
  }
} catch (_) {}
interceptCount += 1;
try { fs.writeFileSync(markerPath, String(interceptCount)); } catch (_) {}

// If we've already intercepted 3 times this session OR Claude is telling
// us a Stop hook is already active (preventing it from terminating),
// allow termination and let the next session resume per the Coding-Agent
// 8-step startup. Avoids tight loops.
if (interceptCount > 3 || stopHookActive) {
  process.exit(0);
}

const passingIds = new Set(entries.filter(e => e && e.passes === true).map(e => e.id));
const nextFeature = failing.find(e =>
  !Array.isArray(e.depends_on) || e.depends_on.every(d => passingIds.has(d))
);

const passing = entries.length - failing.length;
const lines = [
  '## Ralph Loop intercept (BRD §3.3)',
  '',
  `feature_list.json: ${passing}/${entries.length} passing, ${failing.length} failing — exit blocked.`,
  '',
];

if (budgetCritical) {
  lines.push(`Context budget at ${Math.round(pctUsed * 100)}% (>= 70% threshold).`);
  lines.push('Recommendation: compact + reinject harness-progress.txt summary + the original goal, then continue on the next failing feature with a fresh context window.');
} else {
  lines.push('Incomplete features remain. Continue on the next failing feature whose dependencies are satisfied:');
  if (nextFeature) {
    lines.push(`→ ${nextFeature.id} (${nextFeature.source_section || 'no source'}) — ${nextFeature.description || ''}`);
  } else {
    lines.push('(No failing feature has all deps satisfied. Investigate the dependency graph or escalate to HITL.)');
  }
}

lines.push('');
lines.push('If you genuinely cannot make progress on this feature, append an honest blocker note to harness-progress.txt and end the session — the next session will pick a different feature whose deps are satisfied.');
lines.push('');
lines.push(`(Intercept ${interceptCount}/3 for this session. After 3 intercepts, the loop yields and termination is allowed.)`);

const reason = lines.join('\n');

// Block this Stop event with a reason. The agent's transcript receives
// `reason` as a system reminder and the loop continues.
const output = {
  decision: 'block',
  reason,
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
