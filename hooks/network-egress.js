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

// Only activate on Bash tool invocations
const toolName = input.tool_name || '';
if (toolName !== 'Bash') {
  process.exit(0);
}

const command = (input.tool_input && input.tool_input.command) || '';
if (!command) {
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

// Read manifest for sandbox settings
let sandboxMode = false;
let allowedDomains = [];
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.security) {
    sandboxMode = manifest.security.sandbox_mode === true;
    allowedDomains = manifest.security.allowed_domains || [];
  }
} catch (_) {}

// If sandbox mode is not enabled, allow everything
if (!sandboxMode) {
  process.exit(0);
}

// Always-allowed domains
const alwaysAllowed = ['localhost', '127.0.0.1', 'host.docker.internal'];

// Non-blocking for package manager operations
const packageManagerPatterns = [
  /^npm\s+install/,
  /^npm\s+i\b/,
  /^npm\s+ci\b/,
  /^yarn\s+(?:install|add)/,
  /^pnpm\s+(?:install|add)/,
  /^pip\s+install/,
  /^pip3\s+install/,
  /^uv\s+pip\s+install/,
  /^poetry\s+(?:install|add)/,
  /^cargo\s+(?:install|add)/,
  /^go\s+(?:get|install)/,
];

for (const pattern of packageManagerPatterns) {
  if (pattern.test(command.trim())) {
    process.exit(0);
  }
}

// Network call detection patterns
const networkPatterns = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bfetch\b/,
  /\bhttp:\/\//,
  /\bhttps:\/\//,
  /\baxios\.get\b/,
  /\brequests\.get\b/,
];

const hasNetworkCall = networkPatterns.some(pattern => pattern.test(command));
if (!hasNetworkCall) {
  process.exit(0);
}

// Extract domains from URLs in the command
const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+)(?:[:/]|$)/g;
const domainMatches = [...command.matchAll(urlPattern)];

if (domainMatches.length === 0) {
  // Network tool detected but no parseable URL — allow with caution
  process.exit(0);
}

const allAllowed = [...alwaysAllowed, ...allowedDomains];
const blockedDomains = [];

for (const match of domainMatches) {
  const domain = match[1].toLowerCase();
  const isAllowed = allAllowed.some(allowed => {
    // Exact match or subdomain match
    return domain === allowed.toLowerCase() || domain.endsWith('.' + allowed.toLowerCase());
  });
  if (!isAllowed) {
    blockedDomains.push(domain);
  }
}

if (blockedDomains.length > 0) {
  const unique = [...new Set(blockedDomains)];
  process.stderr.write(
    `BLOCKED: Sandbox mode is enabled. Outbound network to non-allowlisted domain(s): ${unique.join(', ')}.\n` +
    `Allowed domains: ${allAllowed.join(', ')}.\n` +
    `To allow, add to security.allowed_domains in project-manifest.json.\n`
  );
  process.exit(2);
}

process.exit(0);
