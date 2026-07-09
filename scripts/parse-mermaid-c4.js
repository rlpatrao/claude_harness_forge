#!/usr/bin/env node

'use strict';

// Mermaid C4 parser (BRD v3.1 §4, v3.1.10). Extracts Mermaid C4
// syntax into the AAC common IR.
//
// Supports: C4Context, C4Container, C4Component diagram markers,
// Person, System, System_Ext, Container, ContainerDb, Component,
// Rel, System_Boundary { ... }, Container_Boundary { ... }.
//
// Not supported: styles, %%{init}%% config, sub-diagrams, title-only files.

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write('usage: parse-mermaid-c4.js <file.mmd>\n');
  process.exit(1);
}
const src = argv[0];
if (!fs.existsSync(src)) {
  process.stderr.write(`file not found: ${src}\n`);
  process.exit(1);
}
const content = fs.readFileSync(src, 'utf8');

const ir = {
  source_format: 'mermaid-c4',
  source_file: path.resolve(src),
  system_name: null,
  containers: [],
  components: [],
  relationships: [],
  external_systems: [],
  notes: [],
};

const scopeStack = [];

// Strip mermaid init config blocks
const stripped = content.replace(/%%{[\s\S]*?}%%/g, '').replace(/%%[^\n]*/g, '');

const lines = stripped.split('\n');
let diagramKind = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Diagram type markers
  let m;
  if ((m = line.match(/^C4(Context|Container|Component|Deployment|Dynamic)\b/))) {
    diagramKind = m[1].toLowerCase(); continue;
  }
  if (line.startsWith('title ')) { ir.system_name = ir.system_name || line.slice(6).replace(/^"|"$/g, ''); continue; }

  if (/^\}\s*$/.test(line)) { scopeStack.pop(); continue; }

  // System_Boundary(id, "Label") { ...
  m = line.match(/^(System_Boundary|Container_Boundary|Enterprise_Boundary)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"?([^"),]+)"?\s*\)\s*\{?/);
  if (m) {
    const kind = m[1] === 'System_Boundary' ? 'system_boundary' : m[1] === 'Container_Boundary' ? 'container_boundary' : 'enterprise_boundary';
    scopeStack.push({ kind, id: m[2], name: m[3] });
    if (!ir.system_name && kind === 'system_boundary') ir.system_name = m[3];
    continue;
  }

  // Rel(from, to, "Label"[, "Tech"])   or   BiRel / Rel_D / etc.
  m = line.match(/^(?:Bi)?Rel(?:_\w+)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    ir.relationships.push({ from: m[1], to: m[2], description: m[3], technology: m[4] || '' });
    continue;
  }

  // Person(id, "Label", "Desc")
  m = line.match(/^Person(?:_Ext)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    ir.external_systems.push({ id: m[1], name: m[2], description: m[3] || '', kind: 'person' });
    continue;
  }

  // System / System_Ext / SystemDb / SystemQueue (id, "Label", "Desc")
  m = line.match(/^(System(?:_Ext|Db|Queue)?)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    const [, kindTok, id, name, desc] = m;
    if (kindTok === 'System_Ext') ir.external_systems.push({ id, name, description: desc || '' });
    else {
      if (!ir.system_name) ir.system_name = name;
      if (kindTok !== 'System') ir.containers.push({ id, name, description: desc || '', technology: kindTok.replace('System', '') });
    }
    continue;
  }

  // Container / ContainerDb / ContainerQueue (id, "Label", "Tech", "Desc")
  m = line.match(/^(Container(?:Db|Queue)?)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    const [, kindTok, id, name, tech, desc] = m;
    ir.containers.push({ id, name, technology: tech, description: desc || '', kind: kindTok.replace('Container', '').toLowerCase() || 'container' });
    continue;
  }

  // Component
  m = line.match(/^Component\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    const [, id, name, tech, desc] = m;
    const parentContainer = [...scopeStack].reverse().find(s => s.kind === 'container_boundary');
    ir.components.push({ id, name, technology: tech, description: desc || '', container_id: parentContainer ? parentContainer.id : null });
    continue;
  }

  if (/^(UpdateElementStyle|UpdateRelStyle|UpdateBoundaryStyle|AddRelTag|AddElementTag|LAYOUT_)/.test(line)) {
    ir.notes.push(`L${i+1}: unsupported: ${line}`);
  }
}

if (!ir.system_name) ir.system_name = path.basename(src, path.extname(src));
if (diagramKind) ir.diagram_kind = diagramKind;

process.stdout.write(JSON.stringify(ir, null, 2) + '\n');
process.exit(0);
