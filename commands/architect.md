---
name: architect
description: Stack interrogation (interview) OR synthesis from imported architecture. Single-doc review loop with approve/amend/restart. Handoff to /auto on approval. Runs after BRD approval, before spec decomposition.
argument-hint: "[--from-import | --restart | --post-build]"
---

# /architect — Stack & Design Architect

When the user runs this command, read and follow `.claude/skills/architect/SKILL.md` exactly.

Pass through any arguments:

- `--from-import` — force synthesis mode (requires `specs/design/.imported`). Skips 11-round interview; derives design artifacts from the imported architecture. See `.claude/skills/architect/synthesis-mode.md`.
- `--restart` — force interview mode even if `specs/design/.imported` exists. Archives any prior review docs. Used when the human explicitly wants to abandon a synthesized or previously-approved architecture.
- `--post-build` — legacy: post-build learnings update only.

**Auto mode detection** (when no flag is passed): the skill's Step 0 checks for `specs/design/.imported` and prompts once. Default is synthesis when the sentinel exists.

**After Step 6 approval:** `state/architecture-approved.flag` is written and picked up by `hooks/session-start.js` on the next session, which surfaces a `/auto` suggestion.
