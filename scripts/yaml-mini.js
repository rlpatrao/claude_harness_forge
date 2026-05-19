'use strict';

// Minimal YAML parser for the subset of YAML used in this repo:
//   - nested mappings (indented key: value or key:)
//   - sequences (- value) at the same indent
//   - sequences of mappings (- key: value followed by indented props)
//   - flow scalars: numbers, true/false/null, quoted strings
//
// Does NOT support: anchors/aliases, multi-line scalars, flow collections,
// merge keys, tags, complex keys. If you need those, add a real YAML lib.

function scalar(s) {
  if (s === '') return '';
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function tokenize(text) {
  const toks = [];
  for (const raw of text.split('\n')) {
    let line = raw;
    // Strip comments (naive — does not respect quoted #)
    const ci = line.indexOf('#');
    if (ci >= 0) line = line.slice(0, ci);
    if (line.trim() === '') continue;
    const indent = line.match(/^( *)/)[1].length;
    toks.push({ indent, line: line.trimEnd().slice(indent) });
  }
  return toks;
}

// Recursive descent. `tokens` is the array; returns { value, nextIdx }.
// Parses one block at exactly `baseIndent`. Stops when a line dedents.
function parseBlock(tokens, startIdx, baseIndent) {
  let i = startIdx;
  let result = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.indent < baseIndent) break;
    if (t.indent > baseIndent) { i += 1; continue; } // shouldn't happen unless nested call mishap

    if (t.line.startsWith('- ')) {
      if (!Array.isArray(result)) result = [];
      const rest = t.line.slice(2);
      const m = rest.match(/^([^:]+?):\s*(.*)$/);
      if (m) {
        // Object item
        const obj = {};
        const key = m[1].trim();
        if (m[2] === '' || m[2] === undefined) {
          const { value, nextIdx } = parseBlock(tokens, i + 1, baseIndent + 2);
          obj[key] = value;
          i = nextIdx;
        } else {
          obj[key] = scalar(m[2].trim());
          i += 1;
        }
        // Continue absorbing additional properties at indent baseIndent + 2
        while (i < tokens.length &&
               tokens[i].indent === baseIndent + 2 &&
               !tokens[i].line.startsWith('- ')) {
          const km = tokens[i].line.match(/^([^:]+?):\s*(.*)$/);
          if (!km) { i += 1; continue; }
          const k2 = km[1].trim();
          if (km[2] === '' || km[2] === undefined) {
            const { value, nextIdx } = parseBlock(tokens, i + 1, baseIndent + 4);
            obj[k2] = value;
            i = nextIdx;
          } else {
            obj[k2] = scalar(km[2].trim());
            i += 1;
          }
        }
        result.push(obj);
      } else {
        // Scalar item
        result.push(scalar(rest.trim()));
        i += 1;
      }
    } else {
      const m = t.line.match(/^([^:]+?):\s*(.*)$/);
      if (!m) { i += 1; continue; }
      if (!result || Array.isArray(result)) result = {};
      const key = m[1].trim();
      const val = m[2];
      if (val === '' || val === undefined) {
        const { value, nextIdx } = parseBlock(tokens, i + 1, baseIndent + 2);
        result[key] = value;
        i = nextIdx;
      } else {
        result[key] = scalar(val.trim());
        i += 1;
      }
    }
  }

  return { value: result, nextIdx: i };
}

function parse(text) {
  const tokens = tokenize(text);
  return parseBlock(tokens, 0, 0).value || {};
}

module.exports = { parse, scalar };
