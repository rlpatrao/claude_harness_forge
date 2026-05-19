# vendor/pi-ai/

Anchor reference for BRD §6.1, §6.2, §10.4 §6.1-§6.2.

## Source

- **URL:** https://github.com/earendil-works/pi (formerly badlogic/pi-mono)
- **Package:** `@mariozechner/pi-ai`
- **License:** MIT
- **Subpackages we depend on:**
  - `packages/pi-ai/` — unified LLM API + per-provider pricing
  - `packages/pi-coding-agent/src/session/` — tree-session pattern (read-only reference; reimplemented at `scripts/tree-sessions.js`)

## Mode

- `pi-ai`: **depend** via npm — `npm install @mariozechner/pi-ai` (deferred until the harness has an actual Node runtime entrypoint that calls it; today `config/workflows.yaml` only declares the bindings).
- `pi-coding-agent/src/session/`: **read-only reference**, not depended upon. Our session implementation lives in `scripts/tree-sessions.js`.

## Files we will vendor on first sync (for the pricing table only)

- `packages/pi-ai/src/cost.ts` → `vendor/pi-ai/pricing.json` (after conversion to JSON; consumed by `scripts/cost-render.js`).
- `LICENSE`.

## Local changes from upstream

- Pricing table converted from TS to JSON for runtime read.
- No code from `packages/pi-ai/src/providers/` is vendored — we either depend on the package or fall back to fetching directly via the providers' APIs.

## Metadata

| Field | Value |
|---|---|
| status | not-yet-synced |
| last_commit_sha | (set on first sync) |
| last_sync | (set on first sync) |
| last_reviewed | (set on first sync) |
| vendored_by | (set on first sync) |
