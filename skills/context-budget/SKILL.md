---
name: context-budget
description: Analyze and optimize token usage — cost per agent, per story, per gate, cache hit rates, and recommendations for context reduction.
---

# Context Budget Skill

Analyze token consumption across the build and recommend optimizations to reduce cost and improve efficiency.

## Usage

```
/context-budget
```

Run anytime during or after a build.

---

## Prerequisites

- `cost-log.json` exists with token usage entries from the build.

---

## Step 1 — Read Cost Log

Read `cost-log.json`. Parse entries for:
- Token counts (input, output, cache_read, cache_write) per interaction
- Agent type (architect, generator, evaluator, reviewer, etc.)
- Story/task identifier
- Gate stage (test, lint, coverage, architecture, evaluator, reviewer, ui-standards, security)
- Timestamp and duration

---

## Step 2 — Calculate Usage by Agent Type

Aggregate tokens per agent:
- Total input tokens, output tokens, cache tokens
- Average tokens per invocation
- Number of invocations
- Most expensive single invocation

---

## Step 3 — Calculate Usage by Story

Aggregate tokens per story/task:
- Total cost per story
- Breakdown by gate stage
- Number of GAN iterations (generator-evaluator cycles)
- Identify stories with unusually high token consumption

---

## Step 4 — Calculate Usage by Gate

Aggregate tokens per gate stage:
- Total cost per gate across all stories
- Average cost per gate invocation
- Pass/fail rate per gate (failed gates cost extra due to rework)

---

## Step 5 — Check Prompt Caching Opportunities

Analyze cache performance:
- Cache hit rate (cache_read / total_input)
- Identify large uncached prompts that repeat across invocations
- Estimate savings from improved caching

---

## Step 6 — Recommend Context Reduction Strategies

Based on analysis, recommend:
- Reducing file loading scope (e.g., "load only owned files instead of full component map")
- Splitting large stories to reduce per-invocation context
- Improving cache hit rate via prompt structure changes
- Reducing GAN iterations via better generator prompts
- Skipping unnecessary gate stages for trivial changes

---

## Step 7 — Generate Cost Projection

For remaining work:
- Estimate tokens needed based on remaining stories
- Project total build cost
- Compare against budget if configured in manifest

---

## Output Format

Print report to console (not saved to file):

```
=== Context Budget Report ===

## Current Usage
- Total tokens: X (input: X, output: X, cached: X)
- Cache hit rate: X%
- Total cost estimate: $X.XX

## By Agent
| Agent       | Tokens   | Invocations | Avg/Call |
|-------------|----------|-------------|----------|
| generator   | X        | X           | X        |
| evaluator   | X        | X           | X        |
| ...         | ...      | ...         | ...      |

## By Story (top 5 most expensive)
| Story       | Tokens   | GAN Cycles  | Gate Fails |
|-------------|----------|-------------|------------|
| ...         | ...      | ...         | ...        |

## Recommendations
- [specific, actionable recommendations]

## Projection
- Remaining stories: X
- Estimated remaining tokens: X
- Projected total cost: $X.XX
```

---

## Gotchas

- **Report only, no file output.** This skill prints to console for immediate review. Recommendations are for manifest tuning, not automated changes.
- **Cache hit rate depends on prompt structure.** Small changes to system prompts can invalidate the entire cache.
- **GAN iterations are the biggest cost driver.** Focus optimization on reducing evaluator failures, not on trimming individual prompts.
