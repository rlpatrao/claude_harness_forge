---
description: Switch the active model mid-session. Preserves thinking blocks across providers (BRD §6.2).
argument-hint: <provider/model-id>
---

# /model

Switches the active LLM mid-session. Uses the `skills/cross-provider-handoff` skill to preserve thinking blocks across the conversion.

## Examples

- `/model anthropic/claude-opus-4-7` — switch to Opus
- `/model openai/gpt-5` — switch to GPT-5 (Anthropic thinking blocks → reasoning_content)
- `/model google/gemini-2.5-pro` — switch to Gemini
- `/model bedrock/anthropic.claude-sonnet-4-6` — same Claude family, different provider (no thinking-block conversion needed)

## When to use

- A workflow declared in `config/workflows.yaml` is rate-limited on its primary; you want to fail over manually.
- You started in Sonnet to save cost; the task got harder and you want to escalate to Opus.
- A specific provider has a capability the current one lacks (e.g., longer context, specific tool).

## Hard rules

- **At most one switch per turn.** If the new model also fails, surface the error rather than chain.
- **Cost is logged at the new provider's rate.** `hooks/cost-tracker.js` picks up the active provider from session metadata.
- **Anthropic prompt-cache is invalidated on switch.** Be deliberate.

See `skills/cross-provider-handoff/SKILL.md` for conversion semantics and BRD §6.2 for failover policy.

## Runtime

There is no script for `/model` — this is a meta-command interpreted by the harness/SDK runtime. The agent's job on receiving `/model $ARGUMENTS` is:

1. Validate `$ARGUMENTS` matches a known provider/model id (cross-reference `config/workflows.yaml` failover entries).
2. Acknowledge the switch in the next message.
3. Subsequent assistant turns use the new model. The SDK handles thinking-block conversion via pi-ai if available.

Cost tracking via `hooks/cost-tracker.js` picks up the new provider from session metadata automatically.
