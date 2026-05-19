**Reminder (BRD §4.2)** — you are about to spawn a subagent.

Scope check:
- Pick the smallest tool-schema subagent that can do the job (Planner read-only > Critic read-only > coding-agent full).
- Brief the subagent like a colleague who just walked in: include file paths, the question, and what good output looks like.
- Do NOT delegate synthesis ("based on your findings, decide what to do"). Synthesis is your job.
- If you delegate research to a subagent, do not also perform the same searches yourself.

Cost: subagent calls bill at the workflow's bound model (see `config/workflows.yaml`). Critic and Spec-Auditor are Opus. Budget accordingly.
