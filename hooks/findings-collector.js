#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// IMPORTANT: This hook must ALWAYS exit 0 — never block the pipeline.

try {
  // Step 1 — Read project manifest and check if findings reporting is enabled
  const manifestPath = path.resolve('project-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_) {
    // No manifest or unreadable — reporting not configured
    process.exit(0);
  }

  if (
    !manifest.findings_reporting ||
    manifest.findings_reporting.enabled !== true
  ) {
    process.exit(0);
  }

  // Step 2 — Read stdin for hook context JSON
  let input;
  try {
    input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  } catch (_) {
    // No valid JSON on stdin — nothing to collect
    process.exit(0);
  }

  // Step 3 — Extract finding fields
  const toolName = (input.tool_name || '').toLowerCase();
  const hookName = (input.hook_name || '').toLowerCase();
  const exitCode = input.exit_code;
  const stderr = input.stderr || '';
  const stdout = input.stdout || '';
  const output = stderr || stdout;

  // Step 4 — Categorize by tool/gate name
  let category = 'unknown';
  if (/security|owasp|cve/.test(hookName) || /security/.test(toolName)) {
    category = 'security';
  } else if (/code-review/.test(hookName) || /code-review/.test(toolName)) {
    category = 'code-review';
  } else if (/evaluat/.test(hookName) || /evaluat/.test(toolName)) {
    category = 'evaluator';
  } else if (/learned-rule/.test(hookName) || /learned/.test(toolName)) {
    category = 'learned-rules';
  } else if (/hook|lint|secret|pii|architecture|file-length|function-length|pre-commit/.test(hookName)) {
    category = 'hooks';
  } else if (/test|mutation|coverage/.test(hookName) || /test/.test(toolName)) {
    category = 'testing';
  } else if (/compliance|bias|fairness/.test(hookName)) {
    category = 'compliance';
  } else if (/ui-standard/.test(hookName) || /ui/.test(toolName)) {
    category = 'ui-standards';
  }

  // Step 6 — Only log failures/warnings (not passes), except learned-rules which are always logged
  const isFailure = exitCode !== 0 && exitCode !== undefined;
  const isWarning = /warn/i.test(output);
  const isLearnedRule = category === 'learned-rules';

  if (!isFailure && !isWarning && !isLearnedRule) {
    process.exit(0);
  }

  // Determine gate name from hook or tool
  const gate = hookName || toolName || 'unknown';

  // Determine outcome
  let outcome = 'pass';
  if (isFailure) {
    outcome = 'fail';
  } else if (isWarning) {
    outcome = 'warning';
  }

  // Extract error type from output
  let errorType = 'unknown';
  if (/type[- ]?error/i.test(output)) {
    errorType = 'type-error';
  } else if (/syntax[- ]?error/i.test(output)) {
    errorType = 'syntax-error';
  } else if (/console[- ]?error/i.test(output)) {
    errorType = 'console-error';
  } else if (/secret/i.test(output)) {
    errorType = 'secret-detected';
  } else if (/pii/i.test(output)) {
    errorType = 'pii-detected';
  } else if (/timeout/i.test(output)) {
    errorType = 'timeout';
  } else if (/permission/i.test(output)) {
    errorType = 'permission-error';
  } else if (/coverage/i.test(output)) {
    errorType = 'coverage-gap';
  } else if (isFailure) {
    errorType = 'gate-failure';
  } else if (isWarning) {
    errorType = 'warning';
  }

  // Extract a pattern string from the output (first meaningful line)
  let pattern = output.split('\n').find((line) => line.trim().length > 10) || '';

  // Step 5 — Sanitize patterns
  // Strip API keys (OpenAI)
  pattern = pattern.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_KEY]');
  // Strip GitHub PATs
  pattern = pattern.replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED_PAT]');
  // Strip long base64 blobs
  pattern = pattern.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[REDACTED_B64]');
  // Strip emails
  pattern = pattern.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED_EMAIL]'
  );
  // Strip IPs
  pattern = pattern.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '[REDACTED_IP]'
  );
  // Strip file paths
  pattern = pattern.replace(
    /\/[^\s:]+\.(ts|js|py|go|rs|java|json|yaml|yml|toml)/g,
    '[REDACTED_PATH]'
  );
  // Truncate to 200 chars
  if (pattern.length > 200) {
    pattern = pattern.substring(0, 197) + '...';
  }

  // Read forge version from manifest
  const forgeVersion = manifest.forge_version || 'unknown';
  const stackType = manifest.stack_type || 'unknown';

  // Compute iterations_to_fix from input if available
  const iterationsToFix = input.iterations || input.iterations_to_fix || null;

  // Build finding entry
  const finding = {
    timestamp: new Date().toISOString(),
    category: category,
    gate: gate,
    outcome: outcome,
    error_type: errorType,
    pattern: pattern,
    iterations_to_fix: iterationsToFix,
    stack_type: stackType,
    forge_version: forgeVersion,
    reported: false,
  };

  // Step 7 — Append to harness-findings-log.json
  const logDir = path.resolve('.claude', 'state');
  const logPath = path.join(logDir, 'harness-findings-log.json');

  let log = [];
  try {
    log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    if (!Array.isArray(log)) {
      log = [];
    }
  } catch (_) {
    // File doesn't exist or isn't valid JSON — start fresh
    log = [];
  }

  log.push(finding);

  // Ensure directory exists
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_) {
    // Directory already exists
  }

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n', 'utf8');
} catch (_) {
  // Step 8 — ALWAYS exit 0, never block the pipeline
}

process.exit(0);
