#!/usr/bin/env node

'use strict';

// BRD §4.7 — spec-gap backpropagation orchestrator.
//
// This script does the mechanical part of the walk-back: gathers the
// failing phase's expected output, walks back through phase artifacts
// (specs, plans, prior phase outputs), and emits a structured packet
// for the Spec-Auditor subagent to reason over.
//
// The Spec-Auditor subagent (agents/spec-auditor.md) then identifies
// the earliest phase whose spec, if tightened, would have prevented
// the failure, and drafts a unified-diff amendment. The Critic
// validates. The orchestrator applies.
//
// Usage:
//   node scripts/spec-backprop.js packet <failing-phase-N> [<failing-feature-id>]
//     → emits JSON packet on stdout for the subagent
//
//   node scripts/spec-backprop.js phases
//     → lists the canonical phase order

const fs = require('fs');
const path = require('path');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'brd'))) return cur;
    cur = path.dirname(cur);
  }
  return process.cwd();
}

// Canonical BRD §7 phase order
const PHASES = [
  { n: 1, name: 'Intake',        spec_glob: 'brd/v*.md',                gate: 'Initializer runs, feature_list.json written' },
  { n: 2, name: 'Architecture',  spec_glob: 'architecture.md',          gate: 'Critic validates before phase 3' },
  { n: 3, name: 'Plan',          spec_glob: 'scratch/plans/*.md',       gate: 'Planner read-only; user approves' },
  { n: 4, name: 'Generate',      spec_glob: 'src/**',                   gate: 'Generator + budget footer + compaction' },
  { n: 5, name: 'Self-critique', spec_glob: 'scratch/plans/*.md',       gate: 'Opus self-critique pass' },
  { n: 6, name: 'Test',          spec_glob: 'tests/**',                 gate: 'Unit + integration' },
  { n: 7, name: 'E2E verify',    spec_glob: 'verification/**',          gate: 'Browser automation mandatory before passes flip' },
  { n: 8, name: 'Code review',   spec_glob: 'evals/**',                 gate: 'Code + Security reviewer subagents' },
  { n: 9, name: 'Merge',         spec_glob: 'state/eval-scores.json',   gate: 'Monotonic-improvement guard' },
];

const root = findRoot();

if (process.argv[2] === 'phases') {
  for (const p of PHASES) console.log(`${p.n}. ${p.name}  -- ${p.gate}`);
  process.exit(0);
}

if (process.argv[2] !== 'packet') {
  process.stderr.write('Usage: spec-backprop.js {packet <N> [<feature_id>] | phases}\n');
  process.exit(1);
}

const failingPhase = parseInt(process.argv[3], 10);
const featureId = process.argv[4] || null;

if (!failingPhase || failingPhase < 2 || failingPhase > 9) {
  process.stderr.write('failing phase must be 2-9 (phase 1 spec gaps are architecture decisions, not backprop-able)\n');
  process.exit(1);
}

function readIfExists(p) {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) return null;
  try { return fs.readFileSync(full, 'utf8'); } catch (_) { return null; }
}

function glob(pattern) {
  // tiny glob: handle exact files and directory wildcards only
  const out = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.join(prefix, e.name);
      if (e.isDirectory()) walk(full, rel);
      else out.push(rel);
    }
  }
  if (pattern.includes('**')) {
    const base = pattern.split('/**')[0];
    walk(path.join(root, base), base);
    return out;
  }
  const direct = path.join(root, pattern);
  if (fs.existsSync(direct)) return [pattern];
  // single-star: enumerate parent dir
  if (pattern.includes('*')) {
    const dir = path.dirname(pattern);
    const prefix = path.basename(pattern).replace(/\*/g, '');
    const parent = path.join(root, dir);
    if (fs.existsSync(parent)) {
      for (const f of fs.readdirSync(parent)) {
        if (f.includes(prefix.replace(/^\.|\.$/g, '')) || prefix === '') {
          out.push(path.join(dir, f));
        }
      }
    }
  }
  return out;
}

const phasesToWalk = PHASES.filter(p => p.n <= failingPhase).reverse();

const packet = {
  brd_ref: '§4.7',
  failing_phase: failingPhase,
  failing_feature_id: featureId,
  feature_entry: null,
  phases: [],
  instructions: [
    'You are the Spec-Auditor (agents/spec-auditor.md).',
    'Walk back from the failing phase to the earliest phase whose spec, if tightened, would have prevented the failure.',
    'Return a unified-diff amendment at the earliest such phase. One amendment only.',
    'If the gap can only be prevented at phase 1 (BRD itself), escalate to HITL instead of proposing a BRD amendment.',
  ],
};

if (featureId) {
  try {
    const fl = JSON.parse(readIfExists('feature_list.json') || '[]');
    packet.feature_entry = fl.find(e => e && e.id === featureId) || null;
  } catch (_) {}
}

for (const p of phasesToWalk) {
  const files = glob(p.spec_glob).slice(0, 10);
  packet.phases.push({
    n: p.n,
    name: p.name,
    gate: p.gate,
    spec_glob: p.spec_glob,
    artifacts: files,
    sample: files.length ? readIfExists(files[0])?.slice(0, 2000) || null : null,
  });
}

process.stdout.write(JSON.stringify(packet, null, 2));
