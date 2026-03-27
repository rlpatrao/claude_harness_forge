# Claude Harness Forge

GAN-inspired autonomous SDLC scaffold with browser-based verification, Karpathy ratcheting, and cross-project learning.

**This is the forge repo itself.** Loaded as a plugin via `--plugin-dir` and scaffolded into target projects.

## Repo Structure

- `agents/` — 10 agents
- `skills/` — 23 skills (16 task + 7 reference)
- `hooks/` — 14 Node.js enforcement hooks
- `evals/` — Code reviewer regression tests
- `templates/` — Docker, Playwright, init.sh, sprint contract, env templates
- `learnings/` — Cross-project knowledge base
- `state/` — Initial state files
- `scripts/` — Validation scripts
- `commands/scaffold.md` — The `/scaffold` command

## Key Design Decisions

1. **GAN architecture:** Generator writes code, evaluator verifies by running the app.
2. **Browser console capture:** Evaluator monitors `console.error` and network failures during Playwright checks.
3. **Interactive architect:** Asks stack questions after BRD. Challenges weak decisions. Persists learnings.
4. **UI standards review:** Single-pass conformance check. No originality scoring, no GAN iteration.
5. **8-gate ratchet:** Tests → Lint → Coverage → Architecture → Evaluator → Code reviewer → UI standards → Security.
