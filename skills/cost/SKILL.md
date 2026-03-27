---
name: cost
description: Display estimated cost summary for the current build based on agent spawn logs.
---

# Cost Skill

Reads `.claude/state/cost-log.json` and prints a summary of estimated API costs.

## Usage

```
/cost
```

## Output Format

```
Mode: {mode} (budget: ${low}-${high})
Agent spawns: {count}
Estimated total: ${amount} ({pct}% of budget ceiling)
Breakdown: Opus {n} spawns (${amount}), Sonnet {n} spawns (${amount})
Top consumers: {agent1} (${amount}), {agent2} (${amount}), {agent3} (${amount})
```

## Estimation Method

| Model | Input $/1M tokens | Output $/1M tokens | Avg input | Avg output |
|-------|-------------------|--------------------|-----------|-----------  |
| Opus | $15 | $75 | 15K tokens | 5K tokens |
| Sonnet | $3 | $15 | 10K tokens | 3K tokens |

**Caveat:** These are rough directional estimates, not actual billing. Token counts are approximated. Actual costs depend on prompt caching, system prompt sharing, and output length variation.

## Budget Ranges by Mode

| Mode | Low | High |
|------|-----|------|
| Full | $100 | $300 |
| Lean | $30 | $80 |
| Solo | $5 | $15 |
| Turbo | $30 | $50 |
