#!/usr/bin/env node

'use strict';

// check-waiver — helper for hard-block hooks. Consult
// specs/reviews/sensor-waivers.json for an active override before
// blocking. Returns:
//   { waived: true, reason, granted_by, expires_at, audit_line }
//   { waived: false }
//
// Usage from a hook (Node-callable, not a subprocess):
//   const { checkWaiver } = require('../scripts/check-waiver.js');
//   const result = checkWaiver('pre-bash-gate', '.env', cwd);
//   if (result.waived) {
//     process.stderr.write(result.audit_line + '\n');
//     process.exit(0);
//   }
//   // ... block ...
//
// Also invokable as CLI for smoke testing:
//   node scripts/check-waiver.js <sensor> <subject> [--cwd <dir>]

const fs = require('fs');
const path = require('path');

function checkWaiver(sensor, subject, cwd) {
  cwd = cwd || process.cwd();
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) return { waived: false };

  const waiversPath = path.join(projectRoot, 'specs', 'reviews', 'sensor-waivers.json');
  if (!fs.existsSync(waiversPath)) return { waived: false };

  let doc;
  try { doc = JSON.parse(fs.readFileSync(waiversPath, 'utf8')); }
  catch (_) { return { waived: false }; }

  if (!doc || !Array.isArray(doc.waivers)) return { waived: false };

  const now = new Date();
  for (const w of doc.waivers) {
    if (!w || w.sensor !== sensor) continue;
    if (w.subject !== subject) continue;
    // expiry check
    const exp = w.expires_at ? new Date(w.expires_at) : null;
    if (!exp || isNaN(exp.getTime())) continue;
    if (exp <= now) continue;
    // active waiver
    return {
      waived: true,
      reason: w.reason,
      granted_by: w.granted_by,
      granted_at: w.granted_at,
      expires_at: w.expires_at,
      audit_ref: w.audit_ref || null,
      audit_line: `WAIVED (${sensor}): ${subject} — ${w.reason} [granted by ${w.granted_by} until ${w.expires_at}${w.audit_ref ? ' · ref: ' + w.audit_ref : ''}]`,
    };
  }
  return { waived: false };
}

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

// CLI mode
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    process.stderr.write('usage: check-waiver.js <sensor> <subject> [--cwd <dir>]\n');
    process.exit(1);
  }
  const sensor = argv[0];
  const subject = argv[1];
  const cwdIdx = argv.indexOf('--cwd');
  const cwd = cwdIdx >= 0 ? argv[cwdIdx + 1] : process.cwd();
  const result = checkWaiver(sensor, subject, cwd);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.waived ? 0 : 1);
}

module.exports = { checkWaiver };
