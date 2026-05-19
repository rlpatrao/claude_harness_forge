# NOTICE

`claude_harness_forge` includes vendored and/or depended-upon material from the following projects, per the BRD v3.0 §10 reuse mandate. See [`vendor/README.md`](./vendor/README.md) for the live sync ledger, integration modes, and pinned references.

## Attributions

_Attribution lines are appended here as each row in `vendor/README.md` transitions to `vendored` or `depended` status. Until the first row is synced, this file lists planned attributions only._

### Planned (not yet activated)

- **`anthropics/claude-quickstarts`** (MIT) — initializer / coding-agent prompt patterns and `feature_list.json` schema, per BRD §10.1, §10.2 §3.1–§3.2.
- **`anthropics/claude-agent-sdk-python` / `anthropics/claude-agent-sdk-typescript`** (MIT) — hooks, subagents, MCP, compaction primitives, worktree isolation, per BRD §10.1.
- **`opendev-to/opendev-py`** (MIT) — per-workflow model routing, planner schema-filtering, five-layer safety, event-driven reminders, staged compaction, three-tier skills loader, per BRD §10.1, §10.2 §3.4–§3.6, §10.3 §4.1–§4.3, §4.6.
- **`earendil-works/pi`** (MIT) — unified provider abstraction (`pi-ai`), per-provider pricing table, cross-provider failover, session-tree pattern, per BRD §10.1, §10.3 §4.5, §10.4 §6.1–§6.2.
- **`executeautomation/mcp-playwright`** (MIT) — Playwright MCP server for the §3.8 E2E gate.
- **`modelcontextprotocol/servers`** (MIT) — Puppeteer MCP server, per BRD §10.2 §3.8.
- **`affaan-m/everything-claude-code`** (MIT) — continuous-learning v2 instinct extraction pattern and general hook patterns, per BRD §10.3 §4.4, §10.4.
- **`affaan-m/agentshield`** (MIT) — pre-release security scan of harness config, per BRD §10.4.
- **`kingofevil/forge`** (MIT) — spec-gap backpropagation subagent pattern, per BRD §10.3 §4.7.
- **"The Factory"** (MIT, awesome-cli-coding-agents) — monotonic-improvement guard pattern and auto-discovered eval dimensions, per BRD §10.3 §4.8.
- **`block-open-source/goose`** (Apache-2.0) — YAML recipe schema reference (read-only), per BRD §10.4 §6.5.
- **`multica-ai/andrej-karpathy-skills`** (MIT) — goal-driven framing prose, per BRD §10.4 §1 principle 4.
- **`anthropics/skills`** (MIT) — `SKILL.md` frontmatter convention reference, per BRD §10.3 §4.6.

### Upstream-stub (UPSTREAM.md recorded; not yet vendored verbatim)

The forge currently *adapts* material from these projects without yet vendoring the originals. Adaptation locations are noted; full vendoring per BRD §10.6 is owed.

- **`anthropics/claude-quickstarts`** (MIT) — adapted at `agents/initializer.md` and `agents/coding-agent.md`. Stub: `vendor/claude-quickstarts/UPSTREAM.md`.
- **`opendev-to/opendev-py`** (MIT) — reimplemented at `agents/planner.md`, `agents/spec-auditor.md`, `hooks/compaction-stage.js`, `scripts/skills-loader.js`. Stub: `vendor/opendev-py/UPSTREAM.md`.
- **`earendil-works/pi`** (MIT) — declared in `config/workflows.yaml` failover lists; tree-session pattern reimplemented at `scripts/tree-sessions.js`. Stub: `vendor/pi-ai/UPSTREAM.md`.
- **`affaan-m/everything-claude-code`** (MIT) — instinct-extraction pattern reimplemented at `hooks/instinct-extractor.js` and `scripts/instinct-evolve.js`. Stub: `vendor/everything-claude-code/UPSTREAM.md`.
- **`kingofevil/forge`** (MIT) — spec-gap backprop pattern reimplemented at `agents/spec-auditor.md` + `scripts/spec-backprop.js`. Stub: `vendor/forge/UPSTREAM.md`.

### Activated (fully vendored)

_None yet. Will be populated as rows in `vendor/README.md` flip to `vendored` status._
