#!/usr/bin/env node

'use strict';

// Structurizr DSL parser (BRD v3.1 §4, v3.1.10). Extracts containers,
// components, relationships from the common Structurizr DSL subset.
// Emits the AAC common IR (see skills/scaffold-import/parsers/README.md).
//
// Unsupported: !include, !plugin, !script, macros, deployment views,
// styles, themes, dynamic views. Silently skipped and recorded in notes.

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write('usage: parse-structurizr.js <file.dsl>\n');
  process.exit(1);
}
const src = argv[0];
if (!fs.existsSync(src)) {
  process.stderr.write(`file not found: ${src}\n`);
  process.exit(1);
}
const content = fs.readFileSync(src, 'utf8');

const ir = {
  source_format: 'structurizr',
  source_file: path.resolve(src),
  system_name: null,
  containers: [],
  components: [],
  relationships: [],
  external_systems: [],
  notes: [],
};

// Tokenize by line; keep block-scope stack for nested containers/components
const lines = content.split('\n');
const scopeStack = [];   // { kind, id } — the enclosing softwareSystem/container

// Regex fragments. Structurizr strings can be double-quoted; identifiers alphanumeric/_.
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;
const STR = /"((?:[^"\\]|\\.)*)"/;

// Line patterns (order matters — most specific first)
const RE_SS = new RegExp(`^\\s*(${IDENT.source})\\s*=\\s*softwareSystem\\s+${STR.source}(?:\\s+${STR.source})?\\s*\\{?\\s*$`);
const RE_PERSON = new RegExp(`^\\s*(${IDENT.source})\\s*=\\s*person\\s+${STR.source}(?:\\s+${STR.source})?`);
const RE_CONTAINER = new RegExp(`^\\s*(${IDENT.source})\\s*=\\s*container\\s+${STR.source}(?:\\s+${STR.source})?(?:\\s+${STR.source})?\\s*\\{?\\s*$`);
const RE_COMPONENT = new RegExp(`^\\s*(${IDENT.source})\\s*=\\s*component\\s+${STR.source}(?:\\s+${STR.source})?(?:\\s+${STR.source})?\\s*\\{?\\s*$`);
const RE_REL = new RegExp(`^\\s*(${IDENT.source})\\s*->\\s*(${IDENT.source})\\s+${STR.source}(?:\\s+${STR.source})?`);
const RE_WORKSPACE = new RegExp(`^\\s*workspace\\s+${STR.source}`);
const RE_BLOCK_CLOSE = /^\s*\}\s*$/;
const RE_BLOCK_OPEN_KIND = /^\s*(model|views|properties|configuration|group)\s*\{?\s*$/;

let inWorkspace = false;
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.replace(/\/\/.*$/, '').trim();
  if (!line) continue;
  if (line.startsWith('#')) continue;
  if (line.startsWith('!')) { ir.notes.push(`L${i+1}: unsupported directive: ${line}`); continue; }

  let m;
  if ((m = raw.match(RE_WORKSPACE))) {
    ir.system_name = m[1];
    inWorkspace = true;
    continue;
  }

  if (RE_BLOCK_CLOSE.test(line)) {
    scopeStack.pop();
    continue;
  }
  if (RE_BLOCK_OPEN_KIND.test(line)) { scopeStack.push({ kind: line, id: null }); continue; }

  if ((m = raw.match(RE_SS))) {
    const [, id, name, desc] = m;
    if (!ir.system_name) ir.system_name = name;
    scopeStack.push({ kind: 'softwareSystem', id, name, description: desc || '' });
    continue;
  }

  if ((m = raw.match(RE_PERSON))) {
    const [, id, name, desc] = m;
    ir.external_systems.push({ id, name, description: desc || '' });
    continue;
  }

  if ((m = raw.match(RE_CONTAINER))) {
    const [, id, name, desc, tech] = m;
    ir.containers.push({ id, name, description: desc || '', technology: tech || '' });
    scopeStack.push({ kind: 'container', id });
    continue;
  }

  if ((m = raw.match(RE_COMPONENT))) {
    const [, id, name, desc, tech] = m;
    const parentContainer = [...scopeStack].reverse().find(s => s.kind === 'container');
    ir.components.push({
      id, name, description: desc || '', technology: tech || '',
      container_id: parentContainer ? parentContainer.id : null,
    });
    scopeStack.push({ kind: 'component', id });
    continue;
  }

  if ((m = raw.match(RE_REL))) {
    const [, from, to, description, technology] = m;
    ir.relationships.push({ from, to, description: description || '', technology: technology || '' });
    continue;
  }

  // Unclassified but potentially interesting — record as note when in workspace
  if (inWorkspace && line.length > 0 && !line.startsWith('include ')) {
    if (ir.notes.length < 40) ir.notes.push(`L${i+1}: unclassified: ${line}`);
  }
}

if (!ir.system_name) ir.system_name = path.basename(src, path.extname(src));

process.stdout.write(JSON.stringify(ir, null, 2) + '\n');
process.exit(0);
