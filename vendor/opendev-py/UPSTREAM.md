# vendor/opendev-py/

Anchor reference for BRD §10.1, §10.2 (§3.4-§3.6), §10.3 (§4.1-§4.3, §4.6).

## Source

- **URL:** https://github.com/opendev-to/opendev-py
- **License:** MIT
- **Status upstream:** "no longer actively maintained" (per BRD §10.1). The Rust version is at `opendev-to/opendev`; we use the Python reference because it is the cleanest reference for the paper's architecture.

## Files we will vendor on first sync

- `opendev/agents/factory.py` — workflow-slot factory (BRD §3.4)
- `opendev/agents/planner.py` — read-only tool-schema filtering pattern (BRD §3.5)
- `opendev/config/workflows.toml` — workflow→model binding schema
- `opendev/safety/` — five-layer defense-in-depth (BRD §4.1, layers 1-4)
- `opendev/context/reminders.py` — event-driven reminder dispatcher (BRD §4.2)
- `opendev/context/compaction.py` — staged compaction algorithm (BRD §4.3)
- `opendev/skills/loader.py` — three-tier skills loader (BRD §4.6)
- `opendev/runtime/react_loop.py` — Extended ReAct loop reference (read-only; we reimplement)

## Mode: vendor + adapt

Layer-1 through layer-4 of `opendev/safety/` are vendored verbatim. Layer-5 wires into our existing 19 hooks. The `factory.py` schema is adapted to our YAML form at `config/workflows.yaml`. The compaction algorithm is vendored as `vendor/opendev-py/opendev/context/compaction.py` and called from `hooks/compaction-stage.js`. The skills loader is read-and-reimplement (our `scripts/skills-loader.js` follows the priority order but is in Node).

## Local changes from upstream

- `workflows.toml` → `workflows.yaml` for consistency with existing forge YAML templates.
- Five-layer safety layer 3 maps to our existing permission classifier rather than opendev-py's runtime approval module.
- ReAct loop reimplemented in our Durable Functions topology (`scripts/extended-react-runtime.js` TBD).

## Metadata

| Field | Value |
|---|---|
| status | not-yet-synced |
| last_commit_sha | (set on first sync) |
| last_sync | (set on first sync) |
| last_reviewed | (set on first sync) |
| vendored_by | (set on first sync) |
