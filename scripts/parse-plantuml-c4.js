#!/usr/bin/env node

'use strict';

// PlantUML C4 parser (BRD v3.1 §4, v3.1.10). Extracts C4-PlantUML
// macro calls into the AAC common IR.
//
// Supports: Person, Person_Ext, System, System_Ext, SystemDb,
// SystemQueue, Container, ContainerDb, ContainerQueue, Component,
// Rel, Rel_Back, Rel_D/U/L/R, System_Boundary { ... },
// Container_Boundary { ... }.
//
// Not supported: dynamic diagrams, sequence, deployment nodes,
// !includeurl / !theme (silently skipped, recorded in notes).

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.length < 1) {
  process.stderr.write('usage: parse-plantuml-c4.js <file.puml>\n');
  process.exit(1);
}
const src = argv[0];
if (!fs.existsSync(src)) {
  process.stderr.write(`file not found: ${src}\n`);
  process.exit(1);
}
const content = fs.readFileSync(src, 'utf8');

const ir = {
  source_format: 'plantuml-c4',
  source_file: path.resolve(src),
  system_name: null,
  containers: [],
  components: [],
  relationships: [],
  external_systems: [],
  notes: [],
};

// Match macro calls. C4-PlantUML macros use fairly consistent shapes:
//   Macro(id, "Label", "Tech", "Desc") or (id, "Label", "Desc")
// Rel macros: Rel[_variant](from, to, "Label"[, "Tech"])
const scopeStack = [];  // { kind, id } — for System_Boundary/Container_Boundary

// Strip block comments /' … '/
const stripped = content.replace(/\/'[\s\S]*?'\//g, '');

const lines = stripped.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/'.*$/, '').trim();
  if (!line) continue;
  if (line.startsWith('@startuml') || line.startsWith('@enduml')) continue;
  if (line.startsWith('!include') || line.startsWith('!theme') || line.startsWith('!define') || line.startsWith('!$')) {
    ir.notes.push(`L${i+1}: skipped: ${line}`); continue;
  }
  if (line === '{' || line === '}') {
    if (line === '}' && scopeStack.length > 0) scopeStack.pop();
    continue;
  }
  if (line.startsWith('title ')) { ir.system_name = ir.system_name || line.slice(6).replace(/^"|"$/g, ''); continue; }

  // Boundary blocks: System_Boundary(id, "Label") { ...
  let m;
  m = line.match(/^(System_Boundary|Container_Boundary)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"\s*\)\s*\{?/);
  if (m) {
    const kind = m[1] === 'System_Boundary' ? 'system_boundary' : 'container_boundary';
    scopeStack.push({ kind, id: m[2], name: m[3] });
    if (!ir.system_name && kind === 'system_boundary') ir.system_name = m[3];
    continue;
  }

  // Rel(from, to, "Label"[, "Tech"])
  m = line.match(/^Rel(?:_\w+)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    ir.relationships.push({ from: m[1], to: m[2], description: m[3], technology: m[4] || '' });
    continue;
  }

  // Person / Person_Ext (id, "Label", "Desc")
  m = line.match(/^Person(?:_Ext)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    ir.external_systems.push({ id: m[1], name: m[2], description: m[3] || '', kind: 'person' });
    continue;
  }

  // System_Ext / System / SystemDb / SystemQueue (id, "Label", "Desc")
  m = line.match(/^(System(?:_Ext|Db|Queue)?)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    const [, kindTok, id, name, desc] = m;
    if (kindTok === 'System_Ext') {
      ir.external_systems.push({ id, name, description: desc || '' });
    } else {
      // Top-level System — becomes the system_name if not yet set
      if (!ir.system_name) ir.system_name = name;
      // Optionally also record as a container-of-container (rare in Container-view files)
      if (kindTok !== 'System') {
        ir.containers.push({ id, name, description: desc || '', technology: kindTok.replace('System', '') });
      }
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

  // Component (id, "Label", "Tech", "Desc")
  m = line.match(/^Component\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)/);
  if (m) {
    const [, id, name, tech, desc] = m;
    const parentContainer = [...scopeStack].reverse().find(s => s.kind === 'container_boundary');
    ir.components.push({
      id, name, technology: tech, description: desc || '',
      container_id: parentContainer ? parentContainer.id : null,
    });
    continue;
  }

  // If it starts with a known unsupported keyword, note; else skip
  if (/^(SHOW_|LAYOUT_|Boundary|Enterprise_Boundary|AddElement|AddRel)/.test(line)) {
    ir.notes.push(`L${i+1}: unsupported: ${line}`);
  }
}

if (!ir.system_name) ir.system_name = path.basename(src, path.extname(src));

process.stdout.write(JSON.stringify(ir, null, 2) + '\n');
process.exit(0);
