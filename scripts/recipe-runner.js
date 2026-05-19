#!/usr/bin/env node

'use strict';

// BRD §6.5 — recipe runner.
//
// Reads a YAML recipe under recipes/<name>.yaml, resolves inputs from
// CLI flags, and emits an execution plan for the orchestrator to
// dispatch.
//
// Why not execute directly: each step invokes a skill, and skill
// dispatch goes through the harness's Skill tool (which is the model's
// affordance, not a shell command). This script's job is to validate,
// interpolate, and serialize — the orchestrator handles step dispatch.
//
// Usage:
//   node scripts/recipe-runner.js <recipe.yaml> [key=value ...]
//     → emits JSON execution plan on stdout

const fs = require('fs');
const path = require('path');
const { parse: parseYAML } = require('./yaml-mini.js');

const recipePath = process.argv[2];
if (!recipePath) {
  process.stderr.write('Usage: recipe-runner.js <recipe.yaml> [key=value ...]\n');
  process.exit(1);
}

if (!fs.existsSync(recipePath)) {
  process.stderr.write(`recipe not found: ${recipePath}\n`);
  process.exit(1);
}

const recipe = parseYAML(fs.readFileSync(recipePath, 'utf8'));

if (!recipe.name) { process.stderr.write('recipe missing name\n'); process.exit(1); }
if (!recipe.steps || !Array.isArray(recipe.steps)) { process.stderr.write('recipe missing steps[]\n'); process.exit(1); }

// Parse key=value CLI args
const cliInputs = {};
for (const arg of process.argv.slice(3)) {
  const m = arg.match(/^([^=]+)=(.*)$/);
  if (m) cliInputs[m[1]] = m[2];
}

// Resolve inputs: required must be present; defaults fill missing.
const inputs = {};
const inputDecls = recipe.inputs || {};
for (const [k, v] of Object.entries(inputDecls)) {
  const decl = (v && typeof v === 'object') ? v : { type: v };
  if (k in cliInputs) {
    inputs[k] = cliInputs[k];
  } else if ('default' in decl) {
    inputs[k] = decl.default;
  } else if (decl.required !== false) {
    process.stderr.write(`missing required input: ${k} (type ${decl.type || 'string'})\n`);
    process.exit(1);
  }
}

// Interpolate {{ inputs.x }} in step params
function interp(val) {
  if (typeof val === 'string') {
    return val.replace(/\{\{\s*inputs\.([\w-]+)\s*\}\}/g, (_, k) => inputs[k] ?? '');
  }
  if (Array.isArray(val)) return val.map(interp);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = interp(v);
    return out;
  }
  return val;
}

const plan = {
  recipe: recipe.name,
  description: recipe.description || '',
  inputs,
  steps: recipe.steps.map((s, i) => ({
    index: i,
    skill: s.skill,
    params: interp(s.params || {}),
    pipe: s.pipe === true,
    on_error: s.on_error || 'abort',
  })),
};

// Sanity check: every step.skill must exist as a skills/<name> directory
const root = (() => {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'skills'))) return cur;
    cur = path.dirname(cur);
  }
  return process.cwd();
})();

const missingSkills = [];
for (const s of plan.steps) {
  if (!s.skill) { missingSkills.push('<unnamed>'); continue; }
  if (!fs.existsSync(path.join(root, 'skills', s.skill))) {
    missingSkills.push(s.skill);
  }
}

plan.missing_skills = missingSkills;

process.stdout.write(JSON.stringify(plan, null, 2));
process.exit(missingSkills.length > 0 ? 2 : 0);
