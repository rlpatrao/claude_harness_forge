# brd/

Business / engineering requirements documents for `claude_harness_forge`.

## Current

- **[v3.0.md](./v3.0.md)** — Retrofit + re-architecture spec (2026-05-19). Closes 8 gaps from v2.0 (initializer/coding-agent split, `feature_list.json` contract, Ralph Loop, per-workflow LLM routing, Plan Mode subagent, Extended ReAct, budget footer, E2E gate). Adds 8 new components (5-layer safety, system reminders, 5-stage compaction, instinct extraction, tree sessions, 3-tier skills, spec-gap backprop, monotonic-improvement guards). Vendor-first reuse mandate per §10.
- **[v3.0-implementation-plan.md](./v3.0-implementation-plan.md)** — Operational plan for the 3-increment migration. Owns the file-level mapping, dependency order, and verification recipes that the BRD itself does not. Read this when picking up retrofit work in a fresh session.

## Historical (v2.0 era)

These predate the `brd/` folder and remain at repo root:

- `../architecture.md` — v2.0 architecture (9-phase pipeline, GAN, eval ratchet).
- `../forge-reference.md` — original forge specification.
- `../program.md` — program-level intent doc.

These are kept for context but are **superseded by v3.0** where they conflict. The `Supersedes` block in `v3.0.md` is authoritative.

## How v3.0 work is tracked

The retrofit is dogfooded against the BRD's own concepts:

- **`../feature_list.json`** at the repo root is the v3.0 retrofit contract (BRD §3.2). Entries flip `passes: false → true` only when the corresponding code lands and a verification artifact is committed under `../verification/`.
- **`../harness-progress.txt`** is the append-only cross-session bridge (BRD §3.1). Every retrofit session ends with a progress note here.

## Provenance

Source attribution is in [`v3.0.md`](./v3.0.md) §10 and Appendix A. Each adapted file (under `agents/`, `skills/`, `hooks/`) also carries an inline `source:` frontmatter line pointing at its upstream. The forge does not maintain a `vendor/` directory or a separate `NOTICE.md`.

## How to propose a v3.1

1. Branch from the latest v3.x.
2. Copy `v3.0.md` to `v3.1-draft.md`.
3. Edit, keep the `Supersedes` chain intact.
4. Run a PR with the diff and notes in the body.
