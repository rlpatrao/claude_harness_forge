#!/usr/bin/env node

'use strict';

// rule-compile — /rules curation entry point (BRD v3.3 §3.4).
// Mirrors scripts/instinct-evolve.js. Subcommands:
//
//   status                 — counts by lifecycle stage
//   promote-candidates     — candidate → tentative
//                            REQUIRES per-candidate Critic verdict
//                            (candidate.critic_verdict === "pass")
//                            unless --force is passed
//   promote-tentative      — tentative → confirmed
//                            REQUIRES sessions_seen >= N (default 2)
//                            AND false_positive_overrides == 0
//   compile                — write validated rules into
//                            state/compiled-rules.json (staged for
//                            human review — commit is a separate step)
//   prune-candidates       — delete candidates older than 30 days
//                            (retains their hash so they don't re-emerge)
//   set-critic-verdict <candidate_id> <pass|block|needs-revision> [reason]
//                          — used by Critic subagent (or a human)
//                            to record its judgment before promote-candidates
//
// Design guarantees (mirror /evolve):
//   - No auto-promotion past `candidate` without Critic.
//   - candidate → tentative only via Critic (pass verdict).
//   - tentative → confirmed only via recurrence.
//   - `compile` stages the diff to compiled-rules.json but does NOT
//     git-commit; human commits after review.

const fs = require('fs');
const path = require('path');

const ROOT = findProjectRoot(process.cwd()) || process.cwd();
const CANDIDATES_DIR = path.join(ROOT, 'state', 'rule-candidates');
const RULES_PATH = path.join(ROOT, 'state', 'compiled-rules.json');
const RETIRED_HASHES = path.join(ROOT, 'state', '.rule-candidate-hashes.txt');

const CONFIRM_THRESHOLD_SESSIONS = parseInt(process.env.RULE_CONFIRM_THRESHOLD || '2', 10);
const PRUNE_AGE_DAYS = 30;

const argv = process.argv.slice(2);
const subcmd = argv[0] || 'status';
const force = argv.includes('--force');

// Ensure compiled-rules.json exists
if (!fs.existsSync(RULES_PATH)) {
  fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
  fs.writeFileSync(RULES_PATH, JSON.stringify({ version: '3.3.0', comment: 'seed', rules: [] }, null, 2) + '\n');
}

try {
  switch (subcmd) {
    case 'status':
      cmdStatus();
      break;
    case 'promote-candidates':
      cmdPromoteCandidates(force);
      break;
    case 'promote-tentative':
      cmdPromoteTentative(force);
      break;
    case 'compile':
      cmdCompile();
      break;
    case 'prune-candidates':
      cmdPrune();
      break;
    case 'set-critic-verdict':
      cmdSetCriticVerdict(argv.slice(1));
      break;
    case '--help':
    case '-h':
    case 'help':
      printHelp();
      break;
    default:
      process.stderr.write(`unknown subcommand: ${subcmd}\n`);
      printHelp();
      process.exit(1);
  }
} catch (e) {
  process.stderr.write(`rule-compile error: ${e.message}\n`);
  process.exit(1);
}

// -- commands --

function cmdStatus() {
  const cs = loadCandidates();
  const rules = loadRules();
  const byStatus = { candidate: 0, 'candidate-blocked': 0, tentative: 0, confirmed: 0, retired: 0 };
  for (const c of cs) {
    const v = c.critic_verdict;
    if (v === 'block' || v === 'needs-revision') byStatus['candidate-blocked']++;
    else byStatus[c.lifecycle_status || 'candidate']++;
  }
  for (const r of rules.rules) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  process.stdout.write('# compiled-rule pipeline status\n\n');
  process.stdout.write(`state/rule-candidates/*: ${cs.length}\n`);
  process.stdout.write(`  candidate (unreviewed):        ${byStatus['candidate']}\n`);
  process.stdout.write(`  candidate (blocked by Critic): ${byStatus['candidate-blocked']}\n`);
  process.stdout.write(`  tentative (in candidates dir): ${byStatus['tentative']}\n\n`);
  process.stdout.write(`state/compiled-rules.json:\n`);
  process.stdout.write(`  tentative (warn):             ${byStatus['tentative'] - (byStatus['tentative'] - rules.rules.filter(r => r.status === 'tentative').length)}\n`);
  process.stdout.write(`  confirmed (block):            ${rules.rules.filter(r => r.status === 'confirmed').length}\n`);
  process.stdout.write(`  retired:                       ${rules.rules.filter(r => r.status === 'retired').length}\n`);
  process.stdout.write(`  total rules:                   ${rules.rules.length}\n\n`);

  if (cs.length > 0) {
    process.stdout.write('recent candidates:\n');
    for (const c of cs.slice(0, 10)) {
      const vTag = c.critic_verdict ? `[critic:${c.critic_verdict}]` : '[unreviewed]';
      process.stdout.write(`  ${c.candidate_id}  ${vTag}  ${truncate(c.normalized_reason, 60)}\n`);
    }
  }
}

function cmdPromoteCandidates(force) {
  const cs = loadCandidates();
  const rules = loadRules();
  let promoted = 0;

  for (const c of cs) {
    if (c.lifecycle_status !== 'candidate') continue;

    const cv = c.critic_verdict;
    if (!force && cv !== 'pass') {
      // Skip — needs Critic pass
      continue;
    }

    // Skip if already a tentative rule for this candidate
    if (rules.rules.some(r => r.origin && r.origin.candidate_id === c.candidate_id)) {
      c.lifecycle_status = 'tentative';
      saveCandidate(c);
      continue;
    }

    // Build a new tentative rule
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const newRule = {
      rule_id: c.candidate_id,
      statement: c.proposed_statement,
      why: `Recurred ${c.occurrences} times across ${c.sessions_seen} session(s); Critic verdict: ${cv || '(forced without Critic)'}.`,
      applies_when: c.proposed_applies_when || {},
      check: c.proposed_check,
      status: 'tentative',
      severity: c.proposed_check.kind === 'semantic' ? 'critic' : 'warn',
      origin: {
        source: c.source,
        sessions_seen: c.sessions_seen,
        occurrences: c.occurrences,
        candidate_id: c.candidate_id,
        forced: force && cv !== 'pass',
      },
      created_at: now,
      false_positive_overrides: 0,
    };
    rules.rules.push(newRule);
    c.lifecycle_status = 'tentative';
    c.promoted_to_tentative_at = now;
    saveCandidate(c);
    promoted++;
  }

  saveRules(rules);
  process.stdout.write(`rule-compile promote-candidates: ${promoted} promoted candidate → tentative (severity=warn)\n`);
  if (promoted === 0) {
    process.stdout.write(`  (Nothing eligible. Candidates need critic_verdict:"pass" — run set-critic-verdict first, or use --force.)\n`);
  }
}

function cmdPromoteTentative(force) {
  const rules = loadRules();
  let promoted = 0;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  for (const r of rules.rules) {
    if (r.status !== 'tentative') continue;
    if (r.check && r.check.kind === 'semantic') continue;   // semantic rules stay Critic-only

    if (!force) {
      const sessions = (r.origin && r.origin.sessions_seen) || 0;
      const fpOvers = r.false_positive_overrides || 0;
      if (sessions < CONFIRM_THRESHOLD_SESSIONS) continue;
      if (fpOvers > 0) continue;   // any override → back to Critic
    }

    r.status = 'confirmed';
    r.severity = 'block';
    r.confirmed_at = now;
    promoted++;
  }

  saveRules(rules);
  process.stdout.write(`rule-compile promote-tentative: ${promoted} promoted tentative → confirmed (severity=block)\n`);
  if (promoted === 0 && !force) {
    process.stdout.write(`  (Nothing eligible. Tentative rules need sessions_seen >= ${CONFIRM_THRESHOLD_SESSIONS} AND false_positive_overrides == 0.)\n`);
  }
}

function cmdCompile() {
  // In our design, compile-time == promote-candidates + save. This
  // command is provided as a distinct entry point so a caller can
  // invoke a single "materialize everything reviewed" step.
  cmdPromoteCandidates(false);
  cmdPromoteTentative(false);
  process.stdout.write(`\nrule-compile compile: state/compiled-rules.json is now staged.\n`);
  process.stdout.write(`Review with:\n`);
  process.stdout.write(`  git diff state/compiled-rules.json\n`);
  process.stdout.write(`Then commit when satisfied. (Auto-merge is deliberately absent per BRD v3.3 §3.4.)\n`);
}

function cmdPrune() {
  const cs = loadCandidates();
  const cutoff = Date.now() - PRUNE_AGE_DAYS * 24 * 3600 * 1000;
  let pruned = 0;
  for (const c of cs) {
    const t = Date.parse(c.proposed_at || '');
    if (!t || isNaN(t)) continue;
    if (t >= cutoff) continue;
    if (c.lifecycle_status === 'tentative') continue;   // already promoted
    const p = path.join(CANDIDATES_DIR, `${c.candidate_id}.json`);
    try { fs.unlinkSync(p); pruned++; } catch (_) {}
  }
  process.stdout.write(`rule-compile prune-candidates: ${pruned} candidate(s) older than ${PRUNE_AGE_DAYS}d removed.\n`);
}

function cmdSetCriticVerdict(args) {
  if (args.length < 2) {
    process.stderr.write('usage: set-critic-verdict <candidate_id> <pass|block|needs-revision> [reason]\n');
    process.exit(1);
  }
  const [id, verdict, ...reasonParts] = args;
  if (!['pass', 'block', 'needs-revision'].includes(verdict)) {
    process.stderr.write(`invalid verdict: ${verdict}. Must be pass|block|needs-revision.\n`);
    process.exit(1);
  }
  const candPath = path.join(CANDIDATES_DIR, `${id}.json`);
  if (!fs.existsSync(candPath)) {
    process.stderr.write(`no candidate: ${id}\n`);
    process.exit(1);
  }
  const c = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  c.critic_verdict = verdict;
  c.critic_reason = reasonParts.join(' ') || null;
  c.critic_reviewed_at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  fs.writeFileSync(candPath, JSON.stringify(c, null, 2));
  process.stdout.write(`set critic_verdict on ${id}: ${verdict}${c.critic_reason ? ' (' + c.critic_reason + ')' : ''}\n`);
}

function printHelp() {
  process.stdout.write(`
rule-compile — /rules curation (BRD v3.3 §3.4)

Subcommands:
  status                                    Counts by lifecycle stage
  promote-candidates [--force]              candidate → tentative (needs Critic pass)
  promote-tentative  [--force]              tentative → confirmed (needs recurrence)
  compile                                   Run promote-candidates + promote-tentative
  prune-candidates                          Remove candidates older than 30 days
  set-critic-verdict <id> <verdict> [reason]  Record Critic's judgment

Env:
  RULE_CONFIRM_THRESHOLD=<N>   sessions_seen required for tentative → confirmed (default 2)
`);
}

// -- io helpers --

function loadCandidates() {
  if (!fs.existsSync(CANDIDATES_DIR)) return [];
  const files = fs.readdirSync(CANDIDATES_DIR).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(CANDIDATES_DIR, f), 'utf8')));
    } catch (_) {}
  }
  return out;
}

function saveCandidate(c) {
  const p = path.join(CANDIDATES_DIR, `${c.candidate_id}.json`);
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
}

function loadRules() {
  try {
    const doc = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    if (!Array.isArray(doc.rules)) doc.rules = [];
    return doc;
  } catch (_) {
    return { version: '3.3.0', rules: [] };
  }
}

function saveRules(doc) {
  fs.writeFileSync(RULES_PATH, JSON.stringify(doc, null, 2) + '\n');
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }

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
