# BRD Change Management + Internet Research

Two enhancements to the harness: (1) formal change tracking with cascading updates through spec/design/implementation, and (2) proactive internet research when requirements are high-level.

## Problem

**Change management:** Users suggest changes at any phase — "actually, add WebSocket support", "switch to TimescaleDB", "add a new user role". Currently there's no formal tracking. The BRD is treated as immutable after approval, and amendments only exist during the autonomous build phase. Changes get lost, downstream artifacts go stale, and there's no audit trail of why decisions changed.

**Research:** When users describe requirements at a high level ("build fraud detection", "add RAG"), the BRD creator and architect make decisions based on their training data. They can't look up the latest patterns, compare current technologies, or validate assumptions against real-world benchmarks. This leads to stale recommendations.

---

## Feature 1: BRD Change Management

### The `/change` Skill

A new execution skill invoked whenever a user wants to modify requirements after initial BRD approval.

#### Usage

```
/change "Add real-time fraud alerting via WebSocket"
/change                    # interactive mode — asks what to change
```

#### Steps

1. **Log the change** — append entry to `specs/brd/changelog.md` with version bump.
2. **Update the BRD** — modify the relevant feature file in `specs/brd/features/` or `app_spec.md`. Bump the `Version` field.
3. **Impact analysis** — trace which downstream artifacts are affected:
   - Stories in `specs/stories/` that reference the changed BRD section
   - Design artifacts in `specs/design/` (architecture, API contracts, data models, component map)
   - UI mockups in `specs/design/mockups/`
   - Test artifacts in `specs/test_artefacts/`
   - Already-built code (if build has started)
4. **Show impact to user** — display: "This change affects {n} stories, {n} design artifacts, {n} mockups. Cascade now?"
5. **Execute cascade** — only re-run the affected phases, not a full rebuild:
   - Stories affected? Re-run `/spec` scoped to affected epics
   - Architecture affected? Re-run `/architect --amendment`
   - Mockups affected? Re-run `/ui-mockup` for affected pages
   - Tests affected? Re-run `/test` for affected stories
   - Code affected? Queue story IDs for next `/auto` iteration
6. **Update cascade status** — mark each phase as done in the changelog entry.

#### Cascade Scope Rules

Not every change cascades to every phase:

| Change Type | BRD | Stories | Design | Mockups | Tests | Code |
|-------------|-----|---------|--------|---------|-------|------|
| New feature | Yes | Yes | Maybe | Maybe | Yes | Yes |
| Modified acceptance criteria | Yes | Yes | No | No | Yes | Yes |
| Tech stack change | Yes | No | Yes | No | Maybe | Yes |
| UI change | Yes | Maybe | No | Yes | Yes | Yes |
| Removed feature | Yes | Yes | Maybe | Maybe | Yes | Yes |

"Maybe" = skill checks if the specific artifact references the changed element.

### Changelog Format

File: `specs/brd/changelog.md`

```markdown
# BRD Changelog

## v3 — 2026-04-12
- **Change:** Add real-time fraud alerting via WebSocket
- **Reason:** Stakeholder feedback — batch alerts too slow for high-value transactions
- **Impact:** New story E2-S5, architecture amendment (WebSocket layer), new API endpoint
- **Cascade:** spec done | design done | implement pending

## v2 — 2026-04-10
- **Change:** Switch from PostgreSQL to TimescaleDB for transaction history
- **Reason:** Research showed 10x query perf for time-series fraud patterns
- **Impact:** Updated data-models.md, deployment.md, 3 stories affected (E1-S2, E1-S3, E3-S1)
- **Cascade:** spec done | design done | implement done

## v1 — 2026-04-09
- **Initial BRD approved**
```

### Version Tracking

**BRD files** get a `Version: v{n}` field in frontmatter:

```markdown
---
Status: approved
Version: v3
Last Modified: 2026-04-12
---
```

**Stories** reference their source BRD version:

```markdown
---
BRD Version: v2
---
```

**Staleness detection** — every agent checks at start:
- Read `specs/brd/changelog.md`
- If any change has a cascade phase still `pending`, warn: "BRD v{n} has pending cascades: {list}. These artifacts may be stale."
- If a story references BRD v2 but BRD is now v3, flag: "Story E1-S2 is based on BRD v2 (current: v3). Check if changelog v3 affects this story."

### Integration with Existing Amendment System

The existing `specs/design/amendments/` mechanism (used during `/auto`) becomes a **subset** of the change management system:

- During autonomous build: if the evaluator or generator discovers a design issue, it creates an amendment file AND logs it to the changelog as an "auto-detected" change
- The `/change` skill is the formal entry point; amendments are the auto-detected variant
- Both use the same changelog format

---

## Feature 2: Internet Research

### Tool Additions

| Agent | Current Tools | Added Tools |
|-------|--------------|-------------|
| `brd-creator` | Read, Write, Glob, Grep, Bash | **WebSearch, WebFetch** |
| `architect` | Read, Write, Glob, Grep, Bash | **WebSearch, WebFetch** |

No other agents get these tools — research happens during requirements and design, not during implementation or review.

### Proactive Detection

**In `brd-creator.md`** — added to the interview process:

> During the interview, if the user describes requirements at a high level without specifying techniques, patterns, or technologies, offer to research. Triggers:
>
> - Domain mentions without specifics: "fraud detection", "recommendation engine", "real-time analytics", "RAG pipeline", "workflow orchestration"
> - Vague quality attributes: "should be fast", "needs to scale", "must be secure"
> - Emerging technology areas: ML pipelines, LLM patterns, vector databases, streaming architectures, agentic systems
>
> Offer: "I can search the internet for current best practices, patterns, and technologies for {topic}. This helps ensure we're using the latest approaches rather than relying on my training data. Want me to research this before we proceed?"
>
> If the user declines, continue with your existing knowledge. Never block on research.

**In `architect.md`** — added to stack interrogation rounds:

> During stack interrogation, if you encounter a technology choice where the landscape changes rapidly, offer to research before committing. Triggers:
>
> - Database selection for specialized workloads (time-series, graph, vector)
> - ML framework and serving infrastructure choices
> - LLM provider and model selection
> - Deployment and orchestration platform choices
> - Emerging patterns (agentic architectures, MCP servers, A2A protocols)
>
> Offer: "The {topic} landscape has been evolving quickly. Want me to look up the latest options and benchmarks before we commit to {current_choice}?"

### Research Artifacts

When research is performed, results are saved to `specs/brd/research/{topic-slug}.md`:

```markdown
# Research: {Topic} ({date})

## Query
{what was searched and why}

## Sources
- [{title}]({url}) — {one-line summary}
- [{title}]({url}) — {one-line summary}

## Key Findings
- Finding 1: ...
- Finding 2: ...
- Finding 3: ...

## Comparison (if applicable)
| Option | Pros | Cons | Fit for this project |
|--------|------|------|---------------------|
| ...    | ...  | ...  | ...                 |

## Recommendation
Based on the BRD requirements ({specific reference}), {recommendation} because {reasoning}.

## Referenced in
- BRD v{n}, Feature: {feature-name}
- Architecture decision: {which round}
```

### Research Rules

1. **User always sees results before they influence decisions.** Research is presented, never silently incorporated.
2. **Research is additive, not authoritative.** It informs decisions; the user + architect make the call.
3. **Results are persisted.** Future conversations can reference `specs/brd/research/` instead of re-searching.
4. **No research during build phase.** Only during BRD interview and architect interrogation. Implementation uses the decisions already made.
5. **Rate limiting.** Max 3 research rounds per interview dimension to prevent rabbit holes. If more is needed, the user can explicitly request more.

---

## New Files

| File | Type | Description |
|------|------|-------------|
| `skills/change/SKILL.md` | Execution skill | Log changes, run impact analysis, execute cascade |
| `state/changelog-template.md` | State template | Initial changelog with v1 entry |

## Modified Files

| File | Change |
|------|--------|
| `agents/brd-creator.md` | Add WebSearch, WebFetch to tools. Add research detection prompts. |
| `agents/architect.md` | Add WebSearch, WebFetch to tools. Add research detection prompts. |
| `skills/build/SKILL.md` | After each human gate, check for pending changes. At Phase 5, init changelog. |
| `skills/auto/SKILL.md` | Log auto-detected amendments to changelog. Check for pending cascades at iteration start. |
| `skills/spec/SKILL.md` | Add BRD version reference to story frontmatter. |
| `agents/spec-writer.md` | Add BRD version tracking to story template. |
| `commands/scaffold.md` | Add changelog template, research directory, /change skill to manifest. |
| `CLAUDE.md` | Update skill count, document new capabilities. |

---

## User-Facing Documentation

The scaffolded project's CLAUDE.md should explain:

### Change Management
> When requirements change, use `/change "description"` to formally log the change. The harness will:
> 1. Log it to `specs/brd/changelog.md` with a version bump
> 2. Show you what downstream artifacts are affected
> 3. Re-run only the affected phases (not a full rebuild)
>
> Every change is tracked with a reason and impact assessment. Stories and design artifacts reference which BRD version they're based on, so stale artifacts are automatically detected.

### Internet Research
> During BRD interviews and architecture decisions, Claude may offer to research current best practices when requirements are high-level. Research results are saved to `specs/brd/research/` and presented for your review before influencing any decisions. You can also request research at any time during these phases.

---

## Security Considerations

- **Research content is local only** — saved to `specs/brd/research/`, never auto-shared
- **No auto-incorporation** — research results are presented, user decides what to use
- **Changelog is append-only** — entries are never modified after creation (new versions are added)
- **WebSearch/WebFetch only on interview agents** — generator, evaluator, reviewers don't get internet access
