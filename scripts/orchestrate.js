#!/usr/bin/env node

'use strict';

// BRD §7 — phase orchestrator. Given a feature_id from
// feature_list.json, emits a phase-by-phase execution plan that the
// main coding-agent reads as instructions.
//
// This script does NOT itself spawn subagents — that's the SDK's
// prerogative via the Task tool. We emit a plan; the agent reads it
// and invokes Task with the named subagent + prompt.
//
// Phases 1-3 (Intake, Architecture, Plan) require human approval
// per BRD §7 and are skipped here. Phases 4-9 are autonomous.
//
// Usage:
//   node scripts/orchestrate.js <feature_id>           -- emit plan
//   node scripts/orchestrate.js <feature_id> --phase N -- single phase
//   node scripts/orchestrate.js --resume               -- pick next failing feature with deps satisfied
//
// Output: JSON plan on stdout.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'feature_list.json'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

const root = findRoot();
if (!root) {
  process.stderr.write('No feature_list.json in cwd or ancestors\n');
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const entries = readJson(path.join(root, 'feature_list.json'));

// Resolve target feature
let featureId = process.argv[2];
let onlyPhase = null;
const phaseArgIdx = process.argv.indexOf('--phase');
if (phaseArgIdx >= 0) onlyPhase = parseInt(process.argv[phaseArgIdx + 1], 10);

if (featureId === '--resume') {
  const passingIds = new Set(entries.filter(e => e.passes === true).map(e => e.id));
  const next = entries.find(e =>
    e && e.passes === false &&
    (!Array.isArray(e.depends_on) || e.depends_on.every(d => passingIds.has(d)))
  );
  if (!next) {
    process.stderr.write('No failing feature has all deps satisfied. Resolve cycle or escalate to HITL.\n');
    process.exit(2);
  }
  featureId = next.id;
}

if (!featureId) {
  process.stderr.write('Usage: orchestrate.js <feature_id> [--phase N] | --resume\n');
  process.exit(1);
}

const entry = entries.find(e => e && e.id === featureId);
if (!entry) {
  process.stderr.write(`feature "${featureId}" not found in feature_list.json\n`);
  process.exit(1);
}

if (entry.passes === true) {
  process.stderr.write(`feature "${featureId}" is already passing; nothing to orchestrate.\n`);
  process.exit(0);
}

// Resolve workflow → model bindings for each phase
function resolveModel(workflow) {
  try {
    return execSync(
      `node ${JSON.stringify(path.join(root, 'scripts/workflows-resolver.js'))} ${JSON.stringify(workflow)} --field primary`,
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    ).trim();
  } catch (_) { return '(unknown)'; }
}

// Phase 4-9 definitions per BRD §7
const PHASES = [
  {
    n: 4, name: 'Generate', subagent: 'coding-agent', task_prompt:
      `Implement feature "${featureId}" per its description and steps[] in feature_list.json. ` +
      `Make the minimum change required. Do not modify other features' code paths. ` +
      `Use the budget footer from PostToolUse to pace yourself; if regime hits HIGH/CRITICAL, ` +
      `commit current state and exit.`,
    gates: ['budget-footer active', 'compaction-stage active'],
  },
  {
    n: 5, name: 'Self-critique', subagent: 'critic', task_prompt:
      `Read the diff just produced for feature "${featureId}". Independently judge: ` +
      `(a) does the diff implement the entry's steps[]? (b) is there spec-gap surface area ` +
      `(code outside the entry's scope)? (c) are tests E2E or mock-only? ` +
      `Return VERDICT: pass | block | needs-revision with rationale ≤200 words.`,
    gates: ['spec-gap detected → trigger /spec-audit'],
  },
  {
    n: 6, name: 'Test', cmd: 'npm test || pytest || make test',
    gates: ['unit tests + integration tests'],
    notes: 'Run via Bash — no subagent. Capture exit code and any failing test IDs.',
  },
  {
    n: 7, name: 'E2E verify', subagent: 'e2e-runner', task_prompt:
      `Execute feature "${featureId}" steps[] via Playwright/Puppeteer MCP against the running app. ` +
      `Capture a screenshot, DOM assertion, or JSON proof-of-state to ` +
      `${entry.verification_artifact_path}. ` +
      `On failure, save a *.failure.* artifact and return the error.`,
    gates: ['verification artifact must exist + be git-staged before the passes flip is allowed'],
    notes: 'e2e-gate hook will reject the flip if the artifact is missing or empty.',
  },
  {
    n: 8, name: 'Code review', parallel: [
      { subagent: 'code-reviewer', task_prompt:
        `PR-style review of the diff for "${featureId}". Quality, architecture, story traceability.`
      },
      { subagent: 'security-reviewer', task_prompt:
        `OWASP Web + Agentic Top 10 review of the diff for "${featureId}".`
      },
    ],
    gates: ['both reviewers must approve'],
  },
  {
    n: 9, name: 'Merge', cmd: 'bash scripts/run-gates.sh && bash scripts/validate-evals.sh',
    gates: [
      'monotonic-improvement: experiment-logger compares to prior snapshot',
      'on regression: revert per state/monotonic-policy.json',
      'on keep: edit feature_list.json (single passes flip) and commit',
    ],
    notes: 'After this gate the coding-agent appends a progress note to harness-progress.txt.',
  },
];

const targetPhases = onlyPhase ? PHASES.filter(p => p.n === onlyPhase) : PHASES;

const plan = {
  brd_ref: '§7',
  feature_id: featureId,
  description: entry.description,
  source_section: entry.source_section,
  steps: entry.steps,
  verification_artifact_path: entry.verification_artifact_path,
  bypassed_phases: '1-3 require human approval per BRD §7; not orchestrated here',
  phases: targetPhases.map(p => {
    const out = { phase: p.n, name: p.name, gates: p.gates };
    if (p.notes) out.notes = p.notes;
    if (p.subagent) {
      out.subagent = p.subagent;
      out.model = resolveModel(p.subagent);
      out.task_prompt = p.task_prompt;
      out.spawn_instruction = `Invoke the Task tool with subagent_type="${p.subagent}" and the task_prompt above.`;
    }
    if (p.parallel) {
      out.parallel = p.parallel.map(s => ({
        subagent: s.subagent,
        model: resolveModel(s.subagent),
        task_prompt: s.task_prompt,
        spawn_instruction: `Invoke Task in parallel for subagent_type="${s.subagent}".`,
      }));
    }
    if (p.cmd) {
      out.cmd = p.cmd;
      out.run_instruction = `Run via Bash: ${p.cmd}`;
    }
    return out;
  }),
  instructions_to_main_agent: [
    'Iterate the phases array in order.',
    'For each phase, if "subagent" is set: invoke the Task tool with the named subagent_type.',
    'For each phase, if "parallel" is set: invoke Task in parallel for each subagent.',
    'For each phase, if "cmd" is set: run it via Bash.',
    'On any phase failure: trigger /spec-audit (BRD §4.7) before retry.',
    'After 3 retries on the same phase: escalate to HITL via AskUserQuestion.',
    'After phase 9 lands: append a progress note to harness-progress.txt.',
  ],
};

process.stdout.write(JSON.stringify(plan, null, 2));
