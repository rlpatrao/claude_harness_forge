'use strict';

// Cleanup-plan Phase 2 (2026-07-21).
// Every hook call appends one line to state/fire-log.jsonl so we can
// see empirically which hooks actually fire during a real end-to-end
// run (i.e. Phase 1 dogfood on test-projects/salary-dashboard).
//
// After Phase 1 completes, hooks whose fire count is 0 are delete
// candidates — Phase 3.
//
// Defensive: never throws. Never blocks. Silent on I/O error so a
// broken fire-log can't itself brick a hook.

const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let current = path.resolve(startDir || process.cwd());
  while (true) {
    if (
      fs.existsSync(path.join(current, 'feature_list.json')) ||
      fs.existsSync(path.join(current, '.claude')) ||
      fs.existsSync(path.join(current, '.git'))
    ) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function fireLog(hookName, extra) {
  if (process.env.FIRE_LOG === '0') return;   // opt-out
  try {
    const root = process.env.CLAUDE_PROJECT_DIR || findProjectRoot(process.cwd()) || process.cwd();
    const stateDir = path.join(root, 'state');
    try { fs.mkdirSync(stateDir, { recursive: true }); } catch (_) {}
    const rec = { ts: Date.now(), hook: hookName };
    if (extra && typeof extra === 'object') Object.assign(rec, extra);
    fs.appendFileSync(path.join(stateDir, 'fire-log.jsonl'), JSON.stringify(rec) + '\n');
  } catch (_) { /* silent */ }
}

module.exports = fireLog;
module.exports.fireLog = fireLog;
