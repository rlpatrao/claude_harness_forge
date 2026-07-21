'use strict';

// sha256 integrity sidecars for verification artifacts. Stdlib-only.
// Sidecar path: verification/<featureId>.sha256.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeSha256(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sidecarRel(featureId) {
  return path.join('verification', `${featureId}.sha256.json`);
}

function writeSidecar(projectDir, featureId, relFiles) {
  const files = {};
  for (const rel of relFiles) {
    const abs = path.join(projectDir, rel);
    if (fs.existsSync(abs)) files[rel] = computeSha256(abs);
  }
  const sidecar = {
    algo: 'sha256',
    feature_id: featureId,
    created_at: new Date().toISOString(),
    files,
  };
  const rel = sidecarRel(featureId);
  fs.writeFileSync(path.join(projectDir, rel), JSON.stringify(sidecar, null, 2) + '\n');
  return rel;
}

function verifySidecar(projectDir, featureId) {
  const rel = sidecarRel(featureId);
  const abs = path.join(projectDir, rel);
  const result = { ok: false, missing: [], mismatches: [], sidecar: rel };
  if (!fs.existsSync(abs)) { result.missing.push(rel); return result; }
  let data;
  try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (e) { result.mismatches.push(`${rel} (unparseable)`); return result; }
  const files = (data && data.files) || {};
  const keys = Object.keys(files);
  if (keys.length === 0) { result.mismatches.push(`${rel} (no files recorded)`); return result; }
  for (const rf of keys) {
    const fabs = path.join(projectDir, rf);
    if (!fs.existsSync(fabs)) { result.missing.push(rf); continue; }
    if (computeSha256(fabs) !== files[rf]) result.mismatches.push(rf);
  }
  result.ok = result.missing.length === 0 && result.mismatches.length === 0;
  return result;
}

module.exports = { computeSha256, sidecarRel, writeSidecar, verifySidecar };
