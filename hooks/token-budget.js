#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch (_) {
  process.exit(0);
}

// Only activate on Agent tool invocations
const toolName = input.tool_name || '';
if (toolName !== 'Agent') {
  process.exit(0);
}

// Find project root
function findProjectDir(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

const projectDir = findProjectDir(process.cwd());
if (!projectDir) process.exit(0);

const manifestPath = path.join(projectDir, 'project-manifest.json');
const costLogPath = path.join(projectDir, '.claude', 'state', 'cost-log.json');

// Extract agent name from tool input
const agentName = (input.tool_input && input.tool_input.agent) || 'unknown';

// Default per-agent token budgets
const defaultBudgets = {
  architect: 50000,
  generator: 80000,
  evaluator: 30000,
  reviewer: 20000
};

// Read manifest for context_budgets and enforce flag
let contextBudgets = {};
let enforceTokenBudgets = false;
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.execution) {
    contextBudgets = manifest.execution.context_budgets || {};
    enforceTokenBudgets = manifest.execution.enforce_token_budgets === true;
  }
} catch (_) {}

// Determine budget for this agent type
const budget = contextBudgets[agentName] || defaultBudgets[agentName] || defaultBudgets.generator;

// Read cost-log.json and calculate cumulative tokens per agent type
let costLog = [];
try {
  costLog = JSON.parse(fs.readFileSync(costLogPath, 'utf8'));
} catch (_) {
  costLog = [];
}

// Sum tokens for this agent type from cost log entries
// Each entry has estimated token counts; we approximate from cost data
const cumulativeTokens = costLog
  .filter(entry => entry.agent === agentName)
  .reduce((sum, entry) => {
    // Use estimated_tokens if available, otherwise approximate from cost
    if (entry.estimated_tokens) return sum + entry.estimated_tokens;
    // Rough approximation: avg ~10k tokens per agent invocation
    return sum + 10000;
  }, 0);

const usagePct = (cumulativeTokens / budget) * 100;

if (usagePct >= 100) {
  const message = `TOKEN BUDGET: Agent "${agentName}" has used ~${cumulativeTokens.toLocaleString()} tokens (${Math.round(usagePct)}% of ${budget.toLocaleString()} budget).`;
  if (enforceTokenBudgets) {
    process.stderr.write(`BLOCKED: ${message} Set execution.enforce_token_budgets: false in manifest to allow.\n`);
    process.exit(2);
  } else {
    console.log(`WARNING: ${message} Budget exceeded but enforcement is off.`);
    process.exit(0);
  }
} else if (usagePct >= 80) {
  console.log(`TOKEN ADVISORY: Agent "${agentName}" at ~${cumulativeTokens.toLocaleString()} tokens (${Math.round(usagePct)}% of ${budget.toLocaleString()} budget). Approaching limit.`);
  process.exit(0);
}

process.exit(0);
