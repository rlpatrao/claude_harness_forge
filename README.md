# Claude Harness Forge

> GAN-inspired autonomous SDLC scaffold with browser-based verification, Karpathy ratcheting, and cross-project learning.

A Claude Code plugin scaffold that merges the best of [claude_code_forge_v2](https://github.com/cwijayasundara/claude_code_forge_v2) and [claude_harness_eng_v1](https://github.com/cwijayasundara/claude_harness_eng_v1). Implements Anthropic and OpenAI harness engineering best practices for autonomous long-running application development.

## What Makes This Different

- **Generator-Evaluator separation** — the agent that writes code cannot evaluate it. Structural elimination of self-evaluation bias.
- **Browser console error capture** — Playwright captures `console.error`, unhandled rejections, and failed network requests during UI verification. Frontend bugs feed directly into self-healing.
- **Interactive architect** — conducts a 5-round stack interrogation informed by your BRD, challenges weak decisions, and persists learnings across projects.
- **8-gate ratchet** — monotonic progress. Coverage never drops, tests never break, architecture never drifts. Quality only moves forward.
- **Sprint contracts** — machine-readable JSON defining exactly what "done" means, negotiated between generator and evaluator before any code is written.
- **4 execution modes** — Full ($100-300), Lean ($30-80), Solo ($5-15), Turbo ($30-50). Right-size cost to project complexity.
- **Cross-project learning** — stack decisions, failure patterns, and integration notes persist across all projects built with this harness.

## Quick Start

```bash
# 1. Clone the harness
git clone <repo-url> ~/claude-harness-forge

# 2. Create your project
mkdir my-app && cd my-app

# 3. Load as plugin and scaffold
claude --plugin-dir ~/claude-harness-forge/.claude
> /claude-harness-forge:scaffold

# 4. Exit and restart (project is now self-contained)
> /exit
claude

# 5. Run the full pipeline
> /build
```

## 9-Phase Pipeline

```
Phase 1: /brd        → Socratic interview → BRD              [HUMAN APPROVAL]
Phase 2: /architect   → Stack interrogation → Design artifacts [HUMAN APPROVAL]
Phase 3: /spec        → Stories + dependency graph             [HUMAN APPROVAL]
Phase 4: /design      → UI mockups                            [HUMAN APPROVAL]
Phase 5: Initialize state
Phases 6-9: /auto     → Autonomous ratcheting build loop
Phase 10: Post-build  → Learnings + README generation
```

`/build` runs all phases. Phases 1-4 pause for human approval. Phases 5+ run autonomously.

## Commands

| Command | Purpose |
|---------|---------|
| `/scaffold` | Initialize project with harness |
| `/brd` | Socratic interview → BRD |
| `/architect` | Stack interrogation + design artifacts |
| `/spec` | BRD → stories + dependency graph |
| `/design` | Architecture + UI mockups |
| `/build` | Full 9-phase pipeline |
| `/auto` | Autonomous ratcheting loop |
| `/implement` | Code generation with agent teams |
| `/evaluate` | Run app, verify sprint contract |
| `/review` | Code review + security review |
| `/test` | Test plan + Playwright E2E |
| `/deploy` | Docker Compose + init.sh |
| `/fix-issue` | GitHub issue workflow |
| `/refactor` | Quality-driven refactoring |
| `/improve` | Feature enhancement |
| `/lint-drift` | Entropy scanner for pattern drift |
| `/cost` | Estimated API cost summary |

## Agents (10)

| Agent | Role | Model |
|-------|------|-------|
| brd-creator | Socratic BRD interview with 5-dimension exploration | Sonnet |
| architect | Interactive stack decisions, design artifacts, learnings | Opus |
| spec-writer | BRD → epics, stories, dependency graph | Sonnet |
| generator | Code + tests, agent teams, sprint contract negotiation | Sonnet |
| evaluator | 3-layer verification + browser console capture | Opus |
| ui-standards-reviewer | SaaS/enterprise conformance checklist (single-pass) | Sonnet |
| code-reviewer | Quality principles, architecture, story traceability | Sonnet |
| security-reviewer | OWASP top 10, injection, auth, secrets | Sonnet |
| test-engineer | Test plans, cases, data, Playwright E2E | Sonnet |
| ui-designer | React+Tailwind HTML mockups | Sonnet |

## 8-Gate Ratchet

| Gate | Full | Lean | Solo | Turbo |
|------|------|------|------|-------|
| 1. Unit tests | ✓ | ✓ | ✓ | Per commit |
| 2. Lint + types | ✓ | ✓ | ✓ | Per commit |
| 3. Coverage ≥ baseline | ✓ | ✓ | ✓ | Per commit |
| 4. Architecture checks | ✓ | ✓ | — | End only |
| 5. Evaluator (API + Playwright + Console) | ✓ | ✓ | — | End only |
| 6. Code reviewer | ✓ | ✓ | — | End only |
| 7. UI standards review | ✓ | — | — | End only |
| 8. Security reviewer | ✓ | — | — | End only |

## Requirements

- Claude Code v2.1.32+ (agent teams support)
- Node.js 18+ (for hooks)
- Docker + Docker Compose (for evaluation)
- Python 3.12+ / Node.js 20+ (for generated projects)

## Based On

- [Anthropic: Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Steve Krenzel: AI is Forcing Us to Write Good Code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code)

## License

MIT
