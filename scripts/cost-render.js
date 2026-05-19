#!/usr/bin/env node

'use strict';

// /cost implementation. Reads state/cost-log.json and renders a
// breakdown by workflow and provider. Pricing per BRD §6.1 is sourced
// from the Pi-AI pricing table; maintained as a local fallback table
// below.

const fs = require('fs');
const path = require('path');

function findRoot() {
  let cur = process.cwd();
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'state'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

const root = findRoot();
if (!root) { process.stderr.write('No project root found\n'); process.exit(1); }

const costPath = path.join(root, 'state', 'cost-log.json');

// Pricing table (USD per 1M tokens, prompt / completion).
// Sourced from Pi-AI per BRD §6.1; update when Pi-AI's table updates.
const fallbackPricing = {
  'anthropic/claude-opus-4-7':   { in: 15.00, out: 75.00 },
  'anthropic/claude-sonnet-4-6': { in: 3.00,  out: 15.00 },
  'anthropic/claude-haiku-4-5':  { in: 0.80,  out: 4.00 },
  'openai/gpt-5':                { in: 5.00,  out: 20.00 },
  'openai/gpt-5-mini':           { in: 0.50,  out: 2.00 },
  'google/gemini-2.5-pro':       { in: 3.50,  out: 14.00 },
  'google/gemini-2.5-flash':     { in: 0.40,  out: 1.60 },
};

const pricing = fallbackPricing;

if (!fs.existsSync(costPath)) {
  console.log('state/cost-log.json is empty — nothing to render.');
  process.exit(0);
}

let entries;
try {
  const raw = fs.readFileSync(costPath, 'utf8');
  try {
    const j = JSON.parse(raw);
    entries = Array.isArray(j) ? j : (j.entries || []);
  } catch (_) {
    // JSONL fallback
    entries = raw.split('\n').filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }
} catch (_) { entries = []; }

const byWorkflow = new Map();
const byProvider = new Map();
let totalIn = 0, totalOut = 0, totalUsd = 0;

function priceUsd(provider, tokIn, tokOut) {
  const p = pricing[provider];
  if (!p) return 0;
  return (tokIn / 1e6) * (p.in || 0) + (tokOut / 1e6) * (p.out || 0);
}

for (const e of entries) {
  if (!e || typeof e !== 'object') continue;
  const wf = e.workflow || e.agent || 'unknown';
  const pv = e.provider || e.model || 'unknown';
  const tin = e.input_tokens || e.prompt_tokens || 0;
  const tout = e.output_tokens || e.completion_tokens || 0;
  const usd = priceUsd(pv, tin, tout);

  if (!byWorkflow.has(wf)) byWorkflow.set(wf, { tokens: 0, usd: 0, n: 0 });
  if (!byProvider.has(pv)) byProvider.set(pv, { tokens: 0, usd: 0, n: 0 });
  const w = byWorkflow.get(wf); w.tokens += tin + tout; w.usd += usd; w.n += 1;
  const p = byProvider.get(pv); p.tokens += tin + tout; p.usd += usd; p.n += 1;
  totalIn += tin; totalOut += tout; totalUsd += usd;
}

function fmt(n) { return n.toLocaleString('en-US'); }
function dollar(n) { return `$${n.toFixed(4)}`; }

const lines = [
  `cost ledger — ${path.basename(root)}`,
  `entries: ${entries.length}`,
  ``,
  `by workflow:`,
];
for (const [wf, v] of [...byWorkflow.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
  lines.push(`  ${wf.padEnd(20)} ${fmt(v.tokens).padStart(12)} tok  ${dollar(v.usd).padStart(10)}  (n=${v.n})`);
}
lines.push('', `by provider:`);
for (const [pv, v] of [...byProvider.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
  lines.push(`  ${pv.padEnd(40)} ${fmt(v.tokens).padStart(12)} tok  ${dollar(v.usd).padStart(10)}`);
}
lines.push('', `total: ${fmt(totalIn + totalOut)} tokens  ${dollar(totalUsd)}`);

console.log(lines.join('\n'));
