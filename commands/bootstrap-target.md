---
description: Create a throwaway target project to dogfood the BRD v3.0 retrofit chain end-to-end.
argument-hint: [<target-dir>] [--self-test]
---

# /bootstrap-target

## Runtime

```bash
bash scripts/bootstrap-target.sh $ARGUMENTS
```

Produces a minimal target under the named directory (default: `/tmp/forge-target-<ts>`) with:

- `feature_list.json` with 3 seed entries
- `init.sh` (trivial smoke)
- `harness-progress.txt` (project context)
- `CLAUDE.md` (minimal conventions)
- Initialized git repo with one commit

With `--self-test`, also runs `orchestrate.js`, `run-gates.sh`, and walks the gold-path passes flip through `e2e-gate` + `feature-edit-guard` to validate the chain.

## When to use

- Before the first real dogfood, to flush out integration surprises in a controlled env.
- When testing a new hook or script change against a real-shaped feature_list.json.
- As a CI integration test target.

## Hard rules

- Default target is under `/tmp/`; never write outside the user-named directory.
- The target's `.git/` is separate from the forge's; no risk of cross-pollution.
- After the dogfood, the user is responsible for `rm -rf` of the target dir if not wanted.
