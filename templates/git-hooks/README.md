# Templates — git hooks (BRD v3.1 §4, v3.1.5)

Real git hooks that get installed into `.git/hooks/` in the *target* project during `/scaffold` Step 8.

## Why real git hooks?

Claude Code's Node hooks (`hooks/*.js`) only fire when the agent invokes the Bash tool. They do **not** fire on:

- `git commit --amend` from the shell (no Bash tool call — the agent typed a command that finished before the hook could intercept)
- `git commit` via IDE integration (VS Code, JetBrains git panel)
- `git commit` via GUI clients (SourceTree, GitKraken, tower, etc.)
- Direct git usage by the human during a session pause

Real git hooks close this gap.

## Files

| File | Event | Purpose |
|---|---|---|
| `pre-commit` | git pre-commit | Runs `.claude/hooks/pre-commit-gate.js` + layer scan + tsc noEmit + optional coverage ratchet. Blocks commit on failure. |
| `prepare-commit-msg` | git prepare-commit-msg | Appends `Harness-Lane`, `Harness-Mode`, `Harness-Iteration`, `Harness-Group` trailers to every commit message (unless it's a merge/squash/amend re-use). |

## Installation

`/scaffold` Step 8 does the equivalent of:

```bash
cp .claude/templates/git-hooks/pre-commit             .git/hooks/pre-commit
cp .claude/templates/git-hooks/prepare-commit-msg     .git/hooks/prepare-commit-msg
chmod +x .git/hooks/pre-commit .git/hooks/prepare-commit-msg
```

If the target project already has custom git hooks, scaffold prompts before overwriting.

## Bypass

Both hooks respect `git commit --no-verify` (git's built-in bypass). Use only in genuine emergencies — the point of the hooks is that they fire in all git-tooling paths.

## Adapted from

`cwijayasundara/claude_harness_eng_v5/.claude/git-hooks/` — commit-msg trailers pattern, staged-file layer scan, tsc noEmit + coverage ratchet.
