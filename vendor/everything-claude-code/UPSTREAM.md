# vendor/everything-claude-code/

Anchor reference for BRD §10.3 §4.4 (continuous-learning v2 instinct extraction) and §10.4 (hook patterns).

## Source

- **URL:** https://github.com/affaan-m/everything-claude-code
- **License:** MIT

## Files we will vendor on first sync

- `skills/continuous-learning-v2/SKILL.md` — referenced by our `skills/instinct-extraction/SKILL.md`.
- `hooks/hooks.json` — schema reference for our settings.json hook block.
- `scripts/hooks/{beforeSubmitPrompt,afterFileEdit,beforeTabFileRead}.sh` — secret detection, auto-format/typecheck, secret-file deny.

## Mode: vendor (selectively)

Cherry-pick the 4-5 files listed above. Do NOT vendor the full 182-skill catalog (BRD §10.5).

## Metadata

| Field | Value |
|---|---|
| status | not-yet-synced |
| last_commit_sha | (set on first sync) |
| last_sync | (set on first sync) |
