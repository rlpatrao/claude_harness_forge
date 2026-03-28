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

const costLogPath = path.join(projectDir, '.claude', 'state', 'cost-log.json');
const manifestPath = path.join(projectDir, 'project-manifest.json');

// Extract agent name from tool input
const agentName = (input.tool_input && input.tool_input.agent) || 'unknown';

// Read model routing from manifest
let modelRouting = { strategy: 'cloud-only' };
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  modelRouting = (manifest.execution && manifest.execution.model_routing) || modelRouting;
} catch (_) {}

// Determine model tier from agent name and routing strategy
const opusAgents = ['evaluator', 'architect'];
const isReasoningAgent = opusAgents.includes(agentName);
const modelTier = isReasoningAgent ? 'opus' : 'sonnet';

// Determine if this agent uses a local model (cost = $0)
let usesLocalModel = false;
if (modelRouting.strategy === 'local-only') {
  usesLocalModel = true;
} else if (modelRouting.strategy === 'hybrid') {
  // Hybrid: reasoning agents use cloud, code gen uses local
  const localAgents = (modelRouting.code_gen_agents && modelRouting.code_gen_agents.agents) || [];
  usesLocalModel = localAgents.includes(agentName);
}

// Cost estimation (rough — see plan Section 8)
const rates = {
  opus: { input_per_1m: 15, output_per_1m: 75, avg_input: 15000, avg_output: 5000 },
  sonnet: { input_per_1m: 3, output_per_1m: 15, avg_input: 10000, avg_output: 3000 },
  local: { input_per_1m: 0, output_per_1m: 0, avg_input: 15000, avg_output: 5000 }
};

const r = usesLocalModel ? rates.local : rates[modelTier];
const estimatedCost = (r.avg_input / 1e6 * r.input_per_1m) + (r.avg_output / 1e6 * r.output_per_1m);

// Read existing log
let costLog = [];
try {
  costLog = JSON.parse(fs.readFileSync(costLogPath, 'utf8'));
} catch (_) {
  costLog = [];
}

// Calculate cumulative
const cumulative = costLog.reduce((sum, entry) => sum + (entry.estimated_cost_usd || 0), 0) + estimatedCost;

// Read mode from manifest
let mode = 'full';
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mode = (manifest.execution && manifest.execution.default_mode) || 'full';
} catch (_) {}

// Budget ranges by mode
const budgets = {
  full: [100, 300],
  lean: [30, 80],
  solo: [5, 15],
  turbo: [30, 50]
};
const budget = budgets[mode] || budgets.full;

// Append entry
costLog.push({
  timestamp: new Date().toISOString(),
  agent: agentName,
  model_tier: usesLocalModel ? 'local' : modelTier,
  model_name: usesLocalModel ? (modelRouting.local_model && modelRouting.local_model.name || 'local') : `claude-${modelTier}`,
  routing_strategy: modelRouting.strategy,
  estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
  cumulative_cost_usd: Math.round(cumulative * 100) / 100,
  mode: mode,
  mode_budget_range: budget,
  budget_pct: Math.round((cumulative / budget[1]) * 1000) / 10
});

// Write log
try {
  fs.writeFileSync(costLogPath, JSON.stringify(costLog, null, 2));
} catch (_) {}

// Warn thresholds
const midpoint = (budget[0] + budget[1]) / 2;
const warnAt = midpoint * 0.6;
const hardWarnAt = budget[1];

if (cumulative >= hardWarnAt) {
  console.log(`⚠️  COST WARNING: Estimated spend $${cumulative.toFixed(2)} has reached the ${mode} mode ceiling ($${hardWarnAt}). Consider stopping or switching to a cheaper mode.`);
} else if (cumulative >= warnAt) {
  console.log(`💰 Cost advisory: Estimated spend $${cumulative.toFixed(2)} (${Math.round(cumulative/budget[1]*100)}% of ${mode} ceiling).`);
}

process.exit(0);
