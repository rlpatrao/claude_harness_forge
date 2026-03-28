#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// Default layer order from lowest to highest
// For agentic projects, 'agents' sits between 'service' and 'api'
const DEFAULT_LAYERS = ['types', 'config', 'repository', 'service', 'api'];
const AGENTIC_LAYERS = ['types', 'config', 'repository', 'service', 'agents', 'api', 'ui'];

// Also match common aliases
const LAYER_ALIASES = {
  'models': 'repository',  // SQLAlchemy models are repository-level
  'schemas': 'types',      // Pydantic schemas are types-level
  'tools': 'agents',       // Agent tools are in the agents layer
  'middleware': 'api',      // Middleware is API-level
};

// Try to read layers from project-manifest.json
function loadLayers(projectDir) {
  // Check if project has custom layers in manifest
  const manifestPath = path.join(projectDir, 'project-manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Custom layer override
    if (manifest.layers && Array.isArray(manifest.layers)) {
      return manifest.layers.sort((a, b) => a.rank - b.rank).map(l => l.name);
    }

    // Auto-detect agentic project
    if (manifest.ai_native && (manifest.ai_native.type === 'agentic' || manifest.ai_native.agents_in_app)) {
      return AGENTIC_LAYERS;
    }
  } catch (_) {}

  return DEFAULT_LAYERS;
}

// Find project root (walk up to find .claude/ or project-manifest.json)
function findProjectDir(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.claude')) || fs.existsSync(path.join(current, 'project-manifest.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

// Determine layer from file path
function getLayer(filePath, layers) {
  const normalized = filePath.replace(/\\/g, '/');

  // Check direct layer name matches in common path patterns
  // Supports: /src/<layer>/, /app/<layer>/, /backend/app/<layer>/, /backend/src/<layer>/
  for (const layer of layers) {
    if (
      normalized.includes(`/src/${layer}/`) ||
      normalized.includes(`/app/${layer}/`) ||
      normalized.includes(`/${layer}/`) && normalized.includes('/backend/')
    ) {
      return layer;
    }
  }

  // Check aliases
  for (const [alias, layer] of Object.entries(LAYER_ALIASES)) {
    if (layers.includes(layer)) {
      if (
        normalized.includes(`/src/${alias}/`) ||
        normalized.includes(`/app/${alias}/`) ||
        normalized.includes(`/${alias}/`) && normalized.includes('/backend/')
      ) {
        return layer;
      }
    }
  }

  return null;
}

// Return layers that are strictly higher than the given layer
function getHigherLayers(layer, layers) {
  const idx = layers.indexOf(layer);
  if (idx === -1) return [];
  return layers.slice(idx + 1);
}

try {
  const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  const filePath = (input.tool_input && input.tool_input.file_path) || '';

  if (!filePath) {
    process.exit(0);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.py' && ext !== '.ts' && ext !== '.tsx') {
    process.exit(0);
  }

  // Find project root and load layer config
  const projectDir = findProjectDir(path.dirname(path.resolve(filePath)));
  const layers = projectDir ? loadLayers(projectDir) : DEFAULT_LAYERS;

  const currentLayer = getLayer(filePath, layers);
  if (!currentLayer) {
    process.exit(0);
  }

  const higherLayers = getHigherLayers(currentLayer, layers);
  if (higherLayers.length === 0) {
    process.exit(0);
  }

  // Read file content
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    process.exit(0);
  }

  const lines = content.split('\n');
  let violated = false;

  // Build all layer names + aliases for matching
  const allLayerNames = [...layers, ...Object.keys(LAYER_ALIASES)];
  const higherWithAliases = [...higherLayers];
  for (const [alias, target] of Object.entries(LAYER_ALIASES)) {
    if (higherLayers.includes(target)) {
      higherWithAliases.push(alias);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Python: from app.<layer> or from src.<layer> or import app.<layer>
    const pyFromMatch = trimmed.match(/^from\s+(?:app|src)\.(\w+)/);
    const pyImportMatch = trimmed.match(/^import\s+(?:app|src)\.(\w+)/);

    // TypeScript: from '../<layer>/' or from '@/<layer>/'
    const tsMatch = trimmed.match(/from\s+['"](?:\.\.\/)+(\w+)\//);
    const tsAliasMatch = trimmed.match(/from\s+['"]@\/(\w+)\//);

    const importedSegment = (pyFromMatch && pyFromMatch[1])
      || (pyImportMatch && pyImportMatch[1])
      || (tsMatch && tsMatch[1])
      || (tsAliasMatch && tsAliasMatch[1]);

    if (!importedSegment) continue;

    // Resolve alias to canonical layer name
    const resolvedSegment = LAYER_ALIASES[importedSegment] || importedSegment;

    if (higherLayers.includes(resolvedSegment)) {
      const lineNum = i + 1;
      process.stderr.write(
        `BLOCKED: Architecture violation in ${filePath}:${lineNum}\n` +
        `  ${currentLayer} layer cannot import from ${resolvedSegment} layer\n` +
        `  Line: ${trimmed}\n` +
        `  Fix: Move the import to the correct layer, or extract the shared type to types/.\n`
      );
      violated = true;
    }
  }

  if (violated) {
    process.exit(2);
  }
} catch (err) {
  // Don't block on hook errors — just warn
  if (err.message && !err.message.includes('Unexpected end of JSON input')) {
    process.stderr.write(`check-architecture.js warning: ${err.message}\n`);
  }
}

process.exit(0);
