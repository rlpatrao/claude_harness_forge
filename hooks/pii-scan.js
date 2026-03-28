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

const filePath = input.tool_input && input.tool_input.file_path;
if (!filePath) {
  process.exit(0);
}

const resolvedFilePath = path.resolve(filePath);
const normalised = resolvedFilePath.replace(/\\/g, '/');
const basename = path.basename(filePath).toLowerCase();

// Skip test files, fixture files, and evals
if (
  normalised.includes('/test/') ||
  normalised.includes('/tests/') ||
  normalised.includes('/__tests__/') ||
  normalised.includes('/fixtures/') ||
  normalised.includes('/evals/') ||
  basename.includes('.test.') ||
  basename.includes('.spec.')
) {
  process.exit(0);
}

// Skip markdown and config files
const ext = path.extname(filePath).toLowerCase();
if (ext === '.md' || ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
  process.exit(0);
}

// Read file content
let content;
try {
  content = fs.readFileSync(resolvedFilePath, 'utf8');
} catch (_) {
  process.exit(0);
}

const lines = content.split('\n');
const findings = [];

// Detect if this is a seed script or migration
const isSeedOrMigration =
  normalised.includes('/seed') ||
  normalised.includes('/migration') ||
  normalised.includes('/seeds/') ||
  normalised.includes('/migrations/') ||
  basename.includes('seed') ||
  basename.includes('migrate');

// PII patterns
const piiPatterns = [
  {
    label: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    label: 'Credit Card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  },
  {
    label: 'Hardcoded Email',
    // Emails in string literals, but not config-style constants like DEFAULT_FROM_EMAIL
    pattern: /["'][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}["']/g,
    filter: (line) => {
      // Skip if it looks like a config constant assignment
      return !/^[A-Z_]+\s*=/.test(line.trim()) && !/DEFAULT_.*EMAIL/.test(line);
    }
  },
  {
    label: 'Phone Number',
    // Phone numbers inside string literals
    pattern: /["']\d{3}[-.]?\d{3}[-.]?\d{4}["']/g,
  },
  {
    label: 'IP Address',
    // IP addresses in string literals, excluding 127.0.0.1 and 0.0.0.0
    pattern: /["']\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}["']/g,
    filter: (line, match) => {
      const ip = match.slice(1, -1); // strip quotes
      return ip !== '127.0.0.1' && ip !== '0.0.0.0' && ip !== '255.255.255.255';
    }
  },
];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  // Skip comment lines
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    continue;
  }

  for (const { label, pattern, filter } of piiPatterns) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const matchStr = match[0];
      if (filter && !filter(line, matchStr)) {
        continue;
      }
      findings.push({
        line: lineNum,
        label,
        value: matchStr.length > 20 ? matchStr.substring(0, 20) + '...' : matchStr,
      });
    }
  }
}

if (findings.length === 0) {
  process.exit(0);
}

// Build output
const output = [];

if (isSeedOrMigration) {
  output.push('BLOCKED: PII patterns detected in seed/migration file ' + filePath + ':');
} else {
  output.push('WARNING: Potential PII patterns detected in ' + filePath + ':');
}

for (const { line, label, value } of findings) {
  output.push('  Line ' + line + ' [' + label + ']: ' + value);
}

if (isSeedOrMigration) {
  output.push('Fix: Use faker/factory libraries to generate test data instead of hardcoded PII patterns.');
  process.stderr.write(output.join('\n') + '\n');
  process.exit(2);
} else {
  output.push('Review: Ensure these are not real PII values. Use environment variables or faker for test data.');
  console.log(output.join('\n'));
  process.exit(0);
}
