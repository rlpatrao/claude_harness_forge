# vendor/claude-quickstarts/

Anchor reference for BRD §10.1, §10.2 §3.1, §3.2.

## Source

- **URL:** https://github.com/anthropics/claude-quickstarts
- **License:** MIT (see `LICENSE` once synced)
- **Subdirectory we use:** `autonomous-coding/`
- **Files we will vendor on first sync:**
  - `autonomous-coding/agent.py`
  - `autonomous-coding/client.py`
  - `autonomous-coding/progress.py`
  - `autonomous-coding/prompts/initializer_prompt.md`
  - `autonomous-coding/prompts/coding_prompt.md`
  - `autonomous-coding/prompts/app_spec.txt`

## Mode: vendor

Per BRD §10.2 §3.1, we adapt this material in `agents/initializer.md` and `agents/coding-agent.md`. The current files are *adaptations* — not vendored verbatim. First sync action:

1. `git clone https://github.com/anthropics/claude-quickstarts /tmp/cqs`
2. Pin commit: `git -C /tmp/cqs rev-parse HEAD` → record here as `last_commit_sha`.
3. `cp -r /tmp/cqs/autonomous-coding/{agent.py,client.py,progress.py,prompts} vendor/claude-quickstarts/`
4. `cp /tmp/cqs/LICENSE vendor/claude-quickstarts/LICENSE`
5. Diff our `agents/initializer.md` and `agents/coding-agent.md` against the vendored `prompts/*.md`; persist the diff at `patches/claude-quickstarts.patch`.
6. Add an attribution line to `../../NOTICE.md` (already pre-populated; flip it from "Planned" to "Activated").

## Local changes from upstream

- `claude-progress.txt` → `harness-progress.txt` (forge naming).
- `feature_list.json` schema extended with `id`, `source_section`, `depends_on`, `verification_artifact_path` for the v3.0 §3.2 / §3.8 hook integration.
- References our `templates/init-sh.template` instead of generating `init.sh` fresh.

## Metadata

| Field | Value |
|---|---|
| status | not-yet-synced |
| last_commit_sha | (set on first sync) |
| last_sync | (set on first sync) |
| last_reviewed | (set on first sync; CI flags >90 days old) |
| vendored_by | (set on first sync) |
