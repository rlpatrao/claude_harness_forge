# vendor/forge/

Anchor reference for BRD §10.3 §4.7 (spec-gap backpropagation).

## Source

- **URL:** https://github.com/kingofevil/forge
- **License:** MIT
- **Caveat:** small repo (~30 stars per BRD §10.3); pin to a specific commit and audit before relying.

## Files we will vendor on first sync

- The Spec-Audit subagent prompt — currently adapted at `agents/spec-auditor.md`.
- The diff-traversal logic — partially reimplemented at `scripts/spec-backprop.js`; vendor for parity check.

## Mode: vendor

Pin to a specific commit. Diff our `agents/spec-auditor.md` against the vendored prompt; persist diff at `patches/forge.patch`.

## Metadata

| Field | Value |
|---|---|
| status | not-yet-synced |
| last_commit_sha | (set on first sync) |
| last_sync | (set on first sync) |
