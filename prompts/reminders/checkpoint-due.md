**Reminder (BRD §4.2)** — it has been ≥25 turns since the last git commit.

Checkpoint now:
- Stage what you have. Even partial work is recoverable from a commit; in-memory state is not.
- Append a one-line progress note to `harness-progress.txt`.
- If the work isn't ready to commit, at least write your current state to a scratch file under `scratch/` so the next session can resume.

The Ralph Loop Stop hook will force this anyway at session end if features remain failing — checkpointing now means the next session starts from your current state, not the state from 25+ turns ago.
