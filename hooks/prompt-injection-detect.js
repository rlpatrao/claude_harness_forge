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

// Skip test files and fixture files
if (
  normalised.includes('/test/') ||
  normalised.includes('/tests/') ||
  normalised.includes('/__tests__/') ||
  normalised.includes('/fixtures/') ||
  normalised.includes('/evals/') ||
  normalised.includes('.test.') ||
  normalised.includes('.spec.')
) {
  process.exit(0);
}

// Only scan files in src/ or frontend/src/
if (!normalised.includes('/src/') && !normalised.includes('/frontend/src/')) {
  process.exit(0);
}

// Read the file content
let content;
try {
  content = fs.readFileSync(resolvedFilePath, 'utf8');
} catch (_) {
  process.exit(0);
}

const lines = content.split('\n');
const findings = [];

// Pattern group 1: Unsanitized user input passed to LLM calls
const llmCallPatterns = [
  // Python f-string with user input in LLM call context
  /f["'].*\{user_input\}.*["'].*(?:completion|chat|generate|prompt)/,
  /(?:completion|chat|generate|prompt).*f["'].*\{user_input\}/,
  // Template literals with user input in prompt strings
  /`.*\$\{.*(?:user[_.]?input|userMessage|user[_.]?query|req\.body|req\.query|request\.).*\}.*`/,
  // .format() with user input in prompt construction
  /\.format\(.*(?:user_input|user_message|user_query).*\)/,
  // Direct concatenation of user input into prompts
  /(?:prompt|system_message|instruction)\s*[+=].*(?:user_input|user_message|req\.body)/,
];

// Pattern group 2: Known injection patterns in string literals
const injectionPatterns = [
  { pattern: /["'].*ignore\s+(?:all\s+)?previous\s+instructions.*["']/i, label: 'ignore previous instructions' },
  { pattern: /["'].*(?:reveal|show|print|output)\s+(?:your\s+)?system\s+prompt.*["']/i, label: 'system prompt extraction' },
  { pattern: /["'].*you\s+are\s+now\s+(?:a|an)?\s*\w+.*["']/i, label: 'role override (you are now)' },
  { pattern: /["'].*(?:disregard|forget)\s+(?:all\s+)?(?:previous|above|prior).*["']/i, label: 'instruction override' },
  { pattern: /["'].*\bsystem\s*:\s*you\s+are\b.*["']/i, label: 'role injection via system: prefix' },
];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  for (const pattern of llmCallPatterns) {
    if (pattern.test(line)) {
      findings.push({
        line: lineNum,
        type: 'unsanitized-input',
        snippet: line.trim().substring(0, 100)
      });
      break;
    }
  }

  for (const { pattern, label } of injectionPatterns) {
    if (pattern.test(line)) {
      findings.push({
        line: lineNum,
        type: label,
        snippet: line.trim().substring(0, 100)
      });
    }
  }
}

if (findings.length > 0) {
  const output = [`WARNING: Potential prompt injection patterns in ${filePath}:`];
  for (const { line, type, snippet } of findings) {
    output.push(`  Line ${line} [${type}]: ${snippet}`);
  }
  output.push('Review: Ensure user input is sanitized before inclusion in LLM prompts.');
  console.log(output.join('\n'));
}

// Always exit 0 — this hook warns only, never blocks
process.exit(0);
