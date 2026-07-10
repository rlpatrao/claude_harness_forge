'use strict';

// Shared helper for the v3.3 TRACE correction pipeline.
// Producers (Critic, e2e-gate, feature-edit-guard, ratchet gates)
// call appendRejection() to add a line to state/rejections.jsonl.
// correction-detector.js reads that stream on Stop and mines
// candidates into state/rule-candidates/.
//
// Defensive: never throws. Fails silently on any I/O error so a
// producer's rejection path is never itself blocked by logging.

const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let current = path.resolve(startDir || process.cwd());
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

/**
 * Append a rejection record to state/rejections.jsonl.
 * @param {object} obj — must include at least { source, verdict, reason }.
 *   Optional: session_id, file, tool, excerpt, path_glob, extra.
 *   Adds ts (ISO) automatically. Missing fields are set to null.
 * @param {string} [cwd] — project cwd; defaults to process.cwd().
 * @returns {boolean} true if written, false if any error suppressed.
 */
function appendRejection(obj, cwd) {
  try {
    if (!obj || typeof obj !== 'object') return false;
    const root = findProjectRoot(cwd);
    if (!root) return false;

    const stateDir = path.join(root, 'state');
    try { fs.mkdirSync(stateDir, { recursive: true }); } catch (_) {}

    const record = {
      ts: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      session_id: obj.session_id || null,
      source: obj.source || 'unknown',
      verdict: obj.verdict || 'block',
      reason: obj.reason || '(no reason given)',
      file: obj.file || null,
      tool: obj.tool || null,
      excerpt: obj.excerpt ? String(obj.excerpt).slice(0, 500) : null,
      path_glob: obj.path_glob || null,
      extra: obj.extra || null,
    };

    fs.appendFileSync(path.join(stateDir, 'rejections.jsonl'), JSON.stringify(record) + '\n');
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { appendRejection, findProjectRoot };
