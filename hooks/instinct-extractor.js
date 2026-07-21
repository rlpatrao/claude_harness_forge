#!/usr/bin/env node

'use strict';


// Cleanup-plan Phase 2 (2026-07-21): fire-log instrumentation.
try { require('./lib/fire-log.js')('instinct-extractor'); } catch (_) {}

// Stop-event hook (BRD §4.4). After Ralph Loop has decided whether to
// intercept, this hook mines the just-completed session for repeating
// {tool sequence → outcome} tuples and promotes high-scoring ones to
// instincts/pending/.
//
// Scoring (initial weights, tune from telemetry per BRD §9):
//   score = frequency * 0.4 + success_rate * 0.4 + novelty * 0.2
//
// Pattern: ECC continuous-learning v2 — affaan-m/everything-claude-code.
//
// Defensive: exit 0 on any failure. We never block exit. We only ever
// write to instincts/pending/ — never to skills/ or learnings/ (the
// /evolve command does promotion under Critic supervision).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id || 'unknown';
const cwd = input.cwd || process.cwd();
const transcript = input.transcript || input.messages || [];

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

const pendingDir = path.join(projectDir, 'instincts', 'pending');
try { fs.mkdirSync(pendingDir, { recursive: true }); } catch (_) {}

// Walk the transcript and extract tool-call sequences of length 2-4.
// Group identical sequences and count occurrences + outcomes.

if (!Array.isArray(transcript) || transcript.length === 0) {
  // Some hook inputs only carry session_id + paths. Try to load the
  // archived session.
  const archiveCandidate = path.join(projectDir, 'sessions', 'archive', String(sessionId), 'transcript.json');
  if (fs.existsSync(archiveCandidate)) {
    try {
      const data = JSON.parse(fs.readFileSync(archiveCandidate, 'utf8'));
      if (Array.isArray(data)) {
        // mutate transcript reference for the rest of the function
        transcript.push(...data);
      }
    } catch (_) {}
  }
}

if (!Array.isArray(transcript) || transcript.length === 0) {
  // Nothing to mine. Exit cleanly.
  process.exit(0);
}

const toolCalls = [];
for (const msg of transcript) {
  if (!msg || typeof msg !== 'object') continue;
  const content = Array.isArray(msg.content) ? msg.content : [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'tool_use') {
      toolCalls.push({
        name: item.name || 'unknown',
        success: !item.is_error,
      });
    } else if (item.type === 'tool_result') {
      // Mark the last tool call's success based on result error flag.
      if (toolCalls.length > 0) {
        toolCalls[toolCalls.length - 1].success = !item.is_error;
      }
    }
  }
}

if (toolCalls.length < 2) process.exit(0);

const sequences = new Map();
for (let len = 2; len <= 4; len += 1) {
  for (let i = 0; i + len <= toolCalls.length; i += 1) {
    const slice = toolCalls.slice(i, i + len);
    const key = slice.map(c => c.name).join('|');
    if (!sequences.has(key)) {
      sequences.set(key, { occurrences: 0, successes: 0, length: len });
    }
    const s = sequences.get(key);
    s.occurrences += 1;
    if (slice.every(c => c.success)) s.successes += 1;
  }
}

// Score each sequence. Drop sequences seen < 2 times (no repetition = no instinct).
const seenInstinctsPath = path.join(projectDir, 'instincts', '.seen-hashes.txt');
let seen = new Set();
try {
  if (fs.existsSync(seenInstinctsPath)) {
    seen = new Set(fs.readFileSync(seenInstinctsPath, 'utf8').split('\n').filter(Boolean));
  }
} catch (_) {}

const candidates = [];
for (const [key, s] of sequences) {
  if (s.occurrences < 2) continue;
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  const frequency = Math.min(s.occurrences / 10, 1.0);
  const successRate = s.occurrences > 0 ? s.successes / s.occurrences : 0;
  const novelty = seen.has(hash) ? 0.0 : 1.0;
  const score = frequency * 0.4 + successRate * 0.4 + novelty * 0.2;
  candidates.push({ key, hash, occurrences: s.occurrences, successRate, novelty, score, length: s.length });
}

// Promotion threshold: 0.5 (tunable per BRD §9 open question)
const promoted = candidates.filter(c => c.score >= 0.5).sort((a, b) => b.score - a.score);

if (promoted.length === 0) process.exit(0);

const now = new Date().toISOString();
const newSeen = new Set(seen);

for (const c of promoted) {
  const filename = `${c.hash}.json`;
  const fullPath = path.join(pendingDir, filename);
  if (fs.existsSync(fullPath)) continue; // already promoted; skip
  const body = {
    instinct_id: c.hash,
    discovered_at: now,
    session_id: sessionId,
    tool_sequence: c.key.split('|'),
    occurrences_in_session: c.occurrences,
    success_rate: c.successRate,
    novelty: c.novelty,
    score: c.score,
    status: 'pending',
    notes: 'Auto-extracted by hooks/instinct-extractor.js. Promote via /evolve after Critic validation.',
  };
  try {
    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2));
    newSeen.add(c.hash);
  } catch (_) {}
}

try {
  fs.writeFileSync(seenInstinctsPath, [...newSeen].join('\n'));
} catch (_) {}

process.exit(0);
