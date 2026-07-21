#!/usr/bin/env node
'use strict';
// Duplication gate. Runs jscpd via npx, ratchets against a baseline.
// Folded into the lint-drift gate (not a numbered ratchet gate).
// Exit 2 on regression; 0 on pass; 0 + NOT_RUN when jscpd unavailable.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function notRun(msg) { process.stderr.write(`NOT_RUN: jscpd gate skipped — ${msg}\n`); process.exit(0); }

function parseArgs(argv) {
  const args = { paths: [], baseline: path.join(process.cwd(), 'state', 'duplication-baseline.txt') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--paths') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.paths.push(argv[++i]); }
    else if (argv[i] === '--baseline') args.baseline = argv[++i];
  }
  if (args.paths.length === 0) args.paths = ['backend', 'frontend', 'src'].filter((d) => fs.existsSync(path.join(process.cwd(), d)));
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.paths.length === 0) notRun('no source paths to scan');

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-'));
  try {
    execFileSync('npx', ['--yes', 'jscpd', '--silent', '--reporters', 'json', '--output', outDir, ...args.paths],
      { cwd: process.cwd(), stdio: 'ignore' });
  } catch (e) {
    // jscpd exits non-zero when threshold exceeded; we still want its report.
    if (!fs.existsSync(path.join(outDir, 'jscpd-report.json'))) notRun(`jscpd/npx unavailable or failed: ${e.message}`);
  }

  const reportPath = path.join(outDir, 'jscpd-report.json');
  if (!fs.existsSync(reportPath)) notRun('jscpd produced no report');
  let pct;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    pct = report.statistics.total.percentage; // % duplicated lines
  } catch (e) { notRun(`unparseable jscpd report: ${e.message}`); }

  // persist a copy of the report for reviewers
  const reviewsDir = path.join(process.cwd(), 'specs', 'reviews');
  fs.mkdirSync(reviewsDir, { recursive: true });
  fs.copyFileSync(reportPath, path.join(reviewsDir, 'jscpd-report.json'));

  const ABS_CAP = 10;
  let baseline = 100;
  if (fs.existsSync(args.baseline)) {
    const raw = parseFloat(fs.readFileSync(args.baseline, 'utf8').trim());
    if (!Number.isNaN(raw)) baseline = raw;
  }

  process.stdout.write(`jscpd: ${pct.toFixed(2)}% duplicated (baseline ${baseline}%, cap ${ABS_CAP}%)\n`);

  if (pct > ABS_CAP) { process.stderr.write(`FAIL: duplication ${pct.toFixed(2)}% exceeds absolute cap ${ABS_CAP}%\n`); process.exit(2); }
  if (pct > baseline + 1e-9) { process.stderr.write(`FAIL: duplication ${pct.toFixed(2)}% regressed past baseline ${baseline}%\n`); process.exit(2); }

  // ratchet down (or seed from sentinel 100)
  if (pct < baseline) {
    fs.mkdirSync(path.dirname(args.baseline), { recursive: true });
    fs.writeFileSync(args.baseline, pct.toFixed(2) + '\n');
    process.stdout.write(`baseline ratcheted to ${pct.toFixed(2)}%\n`);
  }
  process.exit(0);
}

main(process.argv);
