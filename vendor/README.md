# vendor/

Vendor sync ledger for `claude_harness_forge`. Implements BRD §10 vendor-first reuse mandate.

Discipline (BRD §10.6): every entry in this ledger that has reached `vendored` status must have:

- `vendor/<repo>/UPSTREAM.md` — source URL, commit SHA at vendor time, license text, list of files vendored, list of patches applied, last-sync and last-reviewed dates.
- `vendor/<repo>/LICENSE` — verbatim from upstream.
- Patches isolated in `patches/<repo>.patch` at repo root.
- Attribution line in [`../NOTICE.md`](../NOTICE.md).
- CI flag if `last-reviewed` is >90 days old.

## Status legend

- `upstream-stub` — listed in BRD §10 but not yet pulled in.
- `upstream-stub` — `UPSTREAM.md` exists with sync instructions, but no upstream files vendored yet. Adaptations of this upstream's content may already exist elsewhere in the repo (e.g., `agents/initializer.md` adapts `prompts/initializer_prompt.md`).
- `vendored` — files copied, UPSTREAM.md + LICENSE present, NOTICE.md updated to "Activated".
- `depended` — installed via npm/pip; no local copy in `vendor/`. Pinned version recorded here.
- `forked` — full fork lives under our org; this row points at the fork.
- `read-only-reference` — no copy; the repo was read as a spec only. Section in `brd/v3.0.md` notes the read date.
- `do-not-vendor` — explicitly rejected per BRD §10.5.

## Ledger

| # | Repo | Path (upstream) | License | Mode | Status | Pinned ref | Last sync | Last reviewed | BRD ref |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `anthropics/claude-quickstarts` | `autonomous-coding/` | MIT | Vendor | upstream-stub | — | — | — | §10.1, §10.2 (§3.1, §3.2) |
| 2 | `anthropics/claude-agent-sdk-python` | root | MIT | Depend | not-yet-synced | — | — | — | §10.1 |
| 3 | `anthropics/claude-agent-sdk-typescript` | root | MIT | Depend | not-yet-synced | — | — | — | §10.1 |
| 4 | `opendev-to/opendev-py` | `opendev/{agents,config,safety,context,skills,runtime}/` | MIT | Vendor + adapt | upstream-stub | — | — | — | §10.1, §10.2 (§3.4–§3.6), §10.3 (§4.1–§4.3, §4.6) |
| 5 | `earendil-works/pi` | `packages/pi-ai/` | MIT | Depend | upstream-stub | — | — | — | §10.1, §6.1, §6.2 |
| 6 | `earendil-works/pi` | `packages/pi-coding-agent/src/session/` | MIT | Read-and-reimplement | upstream-stub | — | — | — | §10.3 (§4.5) |
| 7 | `executeautomation/mcp-playwright` | root | MIT | Depend | not-yet-synced | — | — | — | §10.2 (§3.8) |
| 8 | `modelcontextprotocol/servers` (Puppeteer) | `src/puppeteer/` | MIT | Depend | not-yet-synced | — | — | — | §10.2 (§3.8) |
| 9 | `affaan-m/everything-claude-code` | `skills/continuous-learning-v2/` + `hooks/` | MIT | Vendor | upstream-stub | — | — | — | §10.3 (§4.4), §10.4 (hook patterns) |
| 10 | `affaan-m/agentshield` | root | MIT | Depend | not-yet-synced | — | — | — | §10.4 |
| 11 | `kingofevil/forge` | spec-backprop subagent | MIT | Vendor | upstream-stub | — | — | — | §10.3 (§4.7) |
| 12 | "The Factory" (awesome-cli-coding-agents) | — | MIT | Read-and-reimplement | not-yet-synced | — | — | — | §10.3 (§4.8) |
| 13 | `block-open-source/goose` | `crates/goose/src/recipe/` | Apache-2.0 | Read-and-reimplement | not-yet-synced | — | — | — | §10.4 (§6.5) |
| 14 | `multica-ai/andrej-karpathy-skills` | `CLAUDE.md` | MIT | Vendor | not-yet-synced | — | — | — | §10.4 (§1 principle 4) |
| 15 | `anthropics/skills` | catalog conventions | MIT | Read-and-reimplement | not-yet-synced | — | — | — | §10.3 (§4.6) |

## Explicitly NOT vendored (BRD §10.5)

- Claude Code source (closed-source).
- `opendev-to/opendev` Rust core (wrong language for our stack).
- `@mariozechner/pi-tui` (we use the v2.0 monitoring dashboard).
- ECC's full 182-skill catalog (cherry-pick only).
- OpenCastle / OpenClaw / Hermes / Goose main runtime (read-only).

## Workflow when vendoring a row

1. Pick a row with status `upstream-stub`.
2. Create `vendor/<repo>/` and copy the upstream files listed in the path column.
3. Add `vendor/<repo>/UPSTREAM.md` and `vendor/<repo>/LICENSE`.
4. If you patched anything, place the diff at `patches/<repo>.patch`. Never inline patches into vendored files.
5. Append an attribution line to [`../NOTICE.md`](../NOTICE.md).
6. Flip the status in the ledger above. Fill in pinned ref, last-sync, last-reviewed.
7. Commit with message: `vendor: add <repo>@<short-sha> per BRD §<n>`.
