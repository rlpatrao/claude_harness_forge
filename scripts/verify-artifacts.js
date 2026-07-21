#!/usr/bin/env node
'use strict';
// Verify every verification sidecar in the repo. Exit 1 on any mismatch.
const fs = require('fs');
const path = require('path');
const ai = require('../hooks/lib/artifact-integrity.js');

const projectDir = process.cwd();
const vdir = path.join(projectDir, 'verification');
if (!fs.existsSync(vdir)) { console.log('no verification/ dir — nothing to verify'); process.exit(0); }
const sidecars = fs.readdirSync(vdir).filter((f) => f.endsWith('.sha256.json'));
let bad = 0;
for (const sc of sidecars) {
  const featureId = sc.replace(/\.sha256\.json$/, '');
  const r = ai.verifySidecar(projectDir, featureId);
  if (r.ok) { console.log(`PASS  ${featureId}`); }
  else { console.log(`FAIL  ${featureId} — missing:[${r.missing}] mismatch:[${r.mismatches}]`); bad++; }
}
console.log(`\n${sidecars.length} sidecars: ${sidecars.length - bad} ok, ${bad} bad`);
process.exit(bad > 0 ? 1 : 0);
