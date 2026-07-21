'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ai = require('../../hooks/lib/artifact-integrity.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-test-'));
fs.mkdirSync(path.join(tmp, 'verification'), { recursive: true });
const jsonRel = 'verification/feat-x.json';
const pngRel = 'verification/feat-x.png';
fs.writeFileSync(path.join(tmp, jsonRel), '{"verdict":"pass"}');
fs.writeFileSync(path.join(tmp, pngRel), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

// write sidecar
const sidecar = ai.writeSidecar(tmp, 'feat-x', [jsonRel, pngRel]);
assert.ok(fs.existsSync(path.join(tmp, sidecar)), 'sidecar written');

// good path
let r = ai.verifySidecar(tmp, 'feat-x');
assert.strictEqual(r.ok, true, 'good verify ok');

// tamper path
fs.writeFileSync(path.join(tmp, jsonRel), '{"verdict":"FAKE"}');
r = ai.verifySidecar(tmp, 'feat-x');
assert.strictEqual(r.ok, false, 'tamper detected');
assert.ok(r.mismatches.includes(jsonRel), 'names the tampered file');

// missing sidecar path
r = ai.verifySidecar(tmp, 'nonexistent');
assert.strictEqual(r.ok, false, 'missing sidecar fails');

console.log('artifact-integrity: ALL PASS');
