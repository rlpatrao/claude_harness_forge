# Claude Harness Forge v1.0.0 — Release Notes

**Release Date:** 2026-03-27
**Tag:** [v1.0.0](https://github.com/rlpatrao/claude_harness_forge/releases/tag/v1.0.0)

---

## What Is This

The first release of Claude Harness Forge — a Claude Code plugin that unifies two complementary philosophies for autonomous software development:

- **The Forge Philosophy** (template-rich SDLC scaffolding) — believes quality comes from thorough upfront specification. Provides Socratic BRD interviews, story templates, quality principles, code reviewer evals, and plugin-first onboarding.

- **The Harness Philosophy** (adversarial verification engineering) — believes quality comes from rigorous independent verification. Provides GAN-style generator/evaluator separation, sprint contracts, 3-layer browser verification, Karpathy ratcheting, and session chaining.

Neither philosophy alone produces reliable autonomous software. v1.0.0 merges them into a single scaffold where the Harness's adversarial verification is the structural backbone and the Forge's rich templates are the flesh.

---

## What Was Built

### Starting From

Two separate repositories with complementary strengths and complementary weaknesses:
- `claude_code_forge_v2` — rich templates, weak verification
- `claude_harness_eng_v1` — strong verification, bare templates

### Arriving At

A unified scaffold with 103 files and 11,201 lines of content.

### Inventory

| Component | Count | Details |
|-----------|-------|---------|
| **Agents** | 10 | brd-creator, architect, spec-writer, generator, evaluator, ui-standards-reviewer, code-reviewer, security-reviewer, test-engineer, ui-designer |
| **Task Skills** | 15 | /brd, /architect, /spec, /design, /implement, /evaluate, /review, /test, /deploy, /build, /auto, /fix-issue, /refactor, /improve, /lint-drift |
| **Reference Skills** | 7 | code-gen, spec-patterns, architect-patterns, ui-mockup, test-patterns, evaluate-patterns, stack-learnings |
| **Hooks** | 14 | scope-directory, protect-env, detect-secrets, lint-on-save, typecheck, check-architecture, check-function-length, check-file-length, protect-pdfs, pre-commit-gate, sprint-contract-gate, teammate-idle-check, task-completed, cost-tracker |
| **Templates** | 9 | Docker Compose, Dockerfiles (backend + frontend), .env.example, init.sh, features-template, sprint-contract, Playwright config |
| **Evals** | 4 samples | bad-dead-code, bad-long-function, bad-test-quality, bad-upward-import |
| **Validation Scripts** | 3 | validate-scaffold.sh, validate-gan-loop.sh, validate-evals.sh |
| **State Files** | 6 | coverage-baseline, cost-log, eval-scores, failures, iteration-log, learned-rules |

---

## Key Design Decisions

### 1. GAN Generator/Evaluator Separation
The agent that writes code (generator) cannot evaluate it. The evaluator runs the app, curls API endpoints, drives Playwright browser flows, and captures console errors. This structurally eliminates self-evaluation bias — the single biggest quality risk in autonomous code generation.

### 2. Sprint Contracts Before Coding
Machine-readable JSON defining exactly what "done" means. The generator and evaluator negotiate the contract before any code is written. No more "declare victory" failures where the build loop stops because it thinks it's done.

### 3. 8-Gate Karpathy Ratchet
Quality metrics only move forward — coverage never drops, tests never break, architecture never drifts. Eight gates run after every sprint:

| Gate | What It Catches |
|------|----------------|
| 1. Unit tests | Logic errors |
| 2. Lint + types | Style drift, type errors |
| 3. Coverage ≥ baseline | Missing tests |
| 4. Architecture | Structure drift, upward imports |
| 5. Evaluator (API + Playwright + Console) | Runtime bugs, frontend errors |
| 6. Code reviewer | Dead code, quality violations |
| 7. UI standards | Accessibility, responsiveness |
| 8. Security | OWASP vulnerabilities |

### 4. Browser Console Capture (Layer 2.5)
During Playwright checks, the evaluator captures `console.error`, unhandled promise rejections, and failed network requests. These produce structured failure JSON with exact file:line locations that feed directly into the self-healing loop. Frontend runtime bugs that don't break the visible UI — swallowed errors, CORS failures, React error boundaries — are caught.

### 5. Interactive Architect (6 Rounds)
The architect reads the BRD, conducts a structured interrogation (backend, database, frontend, LLM model selection, deployment, verification), challenges weak decisions, generates machine-readable design artifacts, and persists learnings for cross-project reuse.

### 6. Single-Pass UI Standards Review
Replaced the Harness's expensive GAN design-critic loop ($8-15 per group) with a single-pass conformance checklist (~$1). Checks objective standards (WCAG AA contrast, responsive breakpoints, spacing grid) not subjective "originality." Most SaaS apps should be predictable, not original.

### 7. Cross-Project Learning
Stack decisions, failure patterns, and integration notes persist in `learnings/` across all projects. The architect reads past learnings before every new stack interrogation, enabling recommendations like: "In a similar project, async SQLAlchemy caused Alembic migration issues."

### 8. Local LLM Support
Three model routing strategies:
- **Cloud-only** (default) — Claude Opus for reasoning, Sonnet for code gen
- **Hybrid** — Claude for reasoning, local model (Qwen3-Coder, DeepSeek) for code gen
- **Local-only** — all agents on local model, zero API cost

### 9. 4 Execution Modes
Right-size cost to project complexity:

| Mode | Cost | Gates | Best For |
|------|------|-------|----------|
| Full | $100-300 | All 8 | Production SaaS |
| Lean | $30-80 | 1-6 | Backend/internal tools |
| Solo | $5-15 | 1-3 | Bug fixes, prototypes |
| Turbo | $30-50 | 1-3 per commit, 4-8 at end | Well-specified projects |

### 10. Plugin-First Onboarding
Clone once, scaffold into any project with `/scaffold`, project becomes self-contained. No ongoing plugin dependency after scaffold.

---

## The 9-Phase Pipeline

```
Phase 1:  /brd        → Socratic interview → BRD               [HUMAN APPROVAL]
Phase 2:  /architect   → Stack interrogation → Design artifacts  [HUMAN APPROVAL]
Phase 3:  /spec        → Stories + dependency graph              [HUMAN APPROVAL]
Phase 4:  /design      → UI mockups                             [HUMAN APPROVAL]
Phase 5:  Initialize state
Phases 6-9: /auto      → Autonomous ratcheting build loop
Phase 10: Post-build   → Learnings + README generation
```

---

## Self-Tested: 9 Issues Found and Fixed

v1.0.0 was dogfooded by running its own pipeline against a fraud detection SaaS test project. This found 9 issues invisible to code review:

| # | Issue | Root Cause | Impact If Unfixed |
|---|-------|------------|-------------------|
| 1 | Scaffold doesn't copy design.md | Missing from Step 4 copy list | Validation fails on every scaffold |
| 2 | Validator expects init.sh before architect | Validator written for post-architect state | Fresh scaffolds always fail validation |
| 3 | Scaffold assumes .claude/ exists | No mkdir before cp -r | Fails on truly empty target |
| 4 | 14 skills use unsupported frontmatter | `context:` and `agent:` not in Claude Code spec | IDE warnings, potential skill loading issues |
| 5 | No AI/LLM model selection | Architect had 5 rounds, no model question | Couldn't configure local LLM routing |
| 6 | Progress file missing model_routing | Template predated model routing feature | Can't audit which model ran a session |
| 7 | **model_routing config was dead** | Manifest had the field, nothing read it | Local-only strategy silently ignored |
| 8 | Re-scaffold overwrites state files | Unconditional cp -r on state/ | Destroys learned-rules, failures, iteration-log |
| 9 | **Spec doesn't generate features.json** | build/SKILL.md says it does, spec/SKILL.md doesn't | Auto loop sees 0 features, nothing to build |

**Key discovery:** Config-to-execution gaps were the dominant bug class. The documentation said the right things, the manifest had the right fields, the skills referenced them — but the actual execution code never read the config. Issues #7 and #9 would have caused **silent failures** in production.

---

## Dogfooding Results

| Phase | Result |
|-------|--------|
| Scaffold | 102 validations passed, 0 failed |
| BRD | 864-line app spec + 8 feature specs (2,956 lines total) |
| Architect | 6 design artifacts + stack learnings |
| Spec | 33 stories, 8 epics, 6 parallel groups |
| Design | 6 interactive HTML mockups |
| Auto Group A | 62 production files, 0 architecture violations |

---

## How to Use

```bash
# Clone v1.0.0 specifically
git clone --branch v1.0.0 https://github.com/rlpatrao/claude_harness_forge.git ~/claude-harness-forge

# Or for latest (currently v2.0.0):
# git clone https://github.com/rlpatrao/claude_harness_forge.git ~/claude-harness-forge

# Create project and scaffold
mkdir my-app && cd my-app
claude --plugin-dir ~/claude-harness-forge
> /scaffold

# Run the full pipeline
> /build
```

---

## Based On

### Parent Systems
- [claude_code_forge_v2](https://github.com/cwijayasundara/claude_code_forge_v2) — "The Forge"
- [claude_harness_eng_v1](https://github.com/cwijayasundara/claude_harness_eng_v1) — "The Harness"

### Research
- [Anthropic: Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Steve Krenzel: AI is Forcing Us to Write Good Code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code)
