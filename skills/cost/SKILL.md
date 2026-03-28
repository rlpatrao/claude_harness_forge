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
Model routing: {strategy} ({local_model_name if applicable})
Agent spawns: {count}
Estimated total: ${amount} ({pct}% of budget ceiling)
Breakdown: Opus {n} spawns (${amount}), Sonnet {n} spawns (${amount}), Local {n} spawns ($0.00)
Top consumers: {agent1} (${amount}), {agent2} (${amount}), {agent3} (${amount})
```

Also read `execution.model_routing` from `project-manifest.json` and display the routing strategy. When `strategy` is `local-only`, show:
```
Model routing: local-only (Qwen3-Coder-480B-A35B-Instruct via vLLM)
Estimated API cost: $0.00 (all local)
Note: Local inference has compute cost (GPU time) not tracked here.
```

## Estimation Method

| Model | Input $/1M tokens | Output $/1M tokens | Avg input | Avg output |
|-------|-------------------|--------------------|-----------|-----------  |
| Opus | $15 | $75 | 15K tokens | 5K tokens |
| Sonnet | $3 | $15 | 10K tokens | 3K tokens |
| Local | $0 | $0 | N/A | N/A |

**Caveat:** These are rough directional estimates, not actual billing. Token counts are approximated. Actual costs depend on prompt caching, system prompt sharing, and output length variation. Local model costs are $0 for API tokens but have GPU compute costs not tracked here.

## Budget Ranges by Mode

| Mode | Low | High |
|------|-----|------|
| Full | $100 | $300 |
| Lean | $30 | $80 |
| Solo | $5 | $15 |
| Turbo | $30 | $50 |
