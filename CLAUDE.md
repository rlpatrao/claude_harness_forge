# Claude Harness Forge

GAN-inspired autonomous SDLC scaffold with browser-based verification, Karpathy ratcheting, cross-project learning, local LLM support, and AI-native application scaffolding.

**This is the forge repo itself.** Loaded as a plugin via `--plugin-dir` and scaffolded into target projects.

## Repo Structure

- `agents/` — 11 agents
- `skills/` — 38 skills (27 task + 11 reference) — reference skills use `-patterns` suffix
- `hooks/` — 19 Node.js enforcement hooks
- `evals/` — Code reviewer regression tests
- `templates/` — 15 templates (Docker, Playwright, OTel, RAG, Temporal, model card, env)
- `learnings/` — Cross-project knowledge base
- `state/` — Initial state files
- `scripts/` — Validation scripts
- `commands/scaffold.md` — The `/scaffold` command

## Agents (11)

| Agent | Role | Model |
|-------|------|-------|
| brd-creator | Socratic BRD interview (5 dimensions) | Sonnet |
| architect | Interactive stack decisions (up to 11 rounds), design artifacts, learnings | Opus |
| spec-writer | BRD → epics, stories, dependency graph | Sonnet |
| generator | Code + tests, agent teams, sprint contracts | Sonnet |
| evaluator | 3-layer verification + browser console + Playwright MCP | Opus |
| ui-standards-reviewer | SaaS/enterprise conformance (single-pass) | Sonnet |
| code-reviewer | Quality principles, architecture, story traceability | Sonnet |
| security-reviewer | OWASP Web Top 10 + OWASP Agentic Top 10 (ASI01-ASI10) | Sonnet |
| test-engineer | Test plans, cases, data, Playwright E2E, mutation testing | Sonnet |
| ui-designer | React+Tailwind HTML mockups, agentic UX patterns | Sonnet |
| **compliance-reviewer** | Bias/fairness, PII, data privacy, regulatory compliance, model cards | Sonnet |

## 11-Gate Ratchet

| Gate | Full | Lean | Solo | Turbo | Condition |
|------|------|------|------|-------|-----------|
| 1. Unit tests | Yes | Yes | Yes | Per commit | Always |
| 2. Lint + types | Yes | Yes | Yes | Per commit | Always |
| 3. Coverage >= baseline | Yes | Yes | Yes | Per commit | Always |
| 4. Architecture checks | Yes | Yes | -- | End only | Always |
| 5. Evaluator (API + Playwright + Console) | Yes | Yes | -- | End only | Always |
| 6. Code reviewer | Yes | Yes | -- | End only | Always |
| 7. UI standards review | Yes | -- | -- | End only | UI projects |
| 8. Security (Web + Agentic OWASP) | Yes | -- | -- | End only | Always |
| 9. Mutation testing | Yes | Yes | -- | End only | Always |
| 10. Compliance (bias, fairness, PII) | Yes | -- | -- | End only | ML projects |
| 11. Spec gaming detection | Yes | Yes | Yes | Per commit | **Always (cannot disable)** |

## Key Design Decisions

1. **GAN architecture:** Generator writes code, evaluator verifies by running the app. Structural elimination of self-evaluation bias.
2. **Browser verification:** Playwright MCP > Chrome extension MCP > Playwright listeners (auto-detected).
3. **Interactive architect:** Up to 11 rounds — backend, DB, frontend, LLM routing, deployment, verification, agentic architecture, ML pipeline, governance, cost budget, final challenge.
4. **AI-native detection:** Architect detects if the app is CRUD, ML, agentic, or RAG from the BRD and activates relevant pillars (compliance, observability, RAG scaffolding, workflow orchestration).
5. **11-gate ratchet:** Gates 1-8 (original) + mutation testing + compliance + spec gaming detection. Gate 11 runs in ALL modes.
6. **15 pillars:** LLM agnosticism, protocol compliance (MCP/A2A), security (OWASP Agentic), observability (OTel), evaluation, architect AI-native rounds, cross-project learning, CI/CD, context engineering, resilience, RAG patterns, agentic UX, workflow orchestration, ethics/bias, multi-tenancy.
7. **Local LLM support:** Cloud-only, hybrid, or local-only routing (Qwen3-Coder, DeepSeek, any OpenAI-compatible).
8. **Change management:** `/change` skill logs requirement changes to `specs/brd/changelog.md` with version tracking, runs impact analysis, and cascades updates through only the affected downstream artifacts.
9. **Internet research:** BRD creator and architect agents have WebSearch/WebFetch tools and proactively offer to research when requirements are high-level or technology choices involve rapidly evolving domains.
10. **Self-improving feedback:** Opt-in findings reporter collects anonymized build findings (no secrets/PII/code) and lets users review + submit them as GitHub issues to improve the forge.
