# prompts/reminders/

System reminders injected at decision points by `hooks/reminder-injector.js` (BRD §4.2).

The forge does NOT inject all of these into the system prompt — that bloats context and the model tunes them out after 50+ turns. Instead the PreToolUse hook decides which (if any) snippet applies based on the tool + arguments, and emits it as a `hookSpecificOutput.additionalContext` reminder for that one call.

## Files

| Snippet | Trigger |
|---|---|
| `edit-production-code.md` | Any Edit on a file outside `tests/`, `docs/`, `scratch/`. |
| `destructive-bash.md` | Bash with `rm`, `dd`, `mkfs`, or `> /dev/`. |
| `feature-passes-flip.md` | Edit or Write on `feature_list.json` that flips a `passes` field. |
| `subagent-spawn.md` | The `Agent` tool is invoked (subagent spawn). |
| `checkpoint-due.md` | ≥25 turns since last git commit. (Hook tracks turn count.) |

## Adding a new reminder

1. Add the Markdown file here.
2. Add a trigger rule in `hooks/reminder-injector.js`.
3. Test with a synthetic tool input: `echo '{"tool_name":"...","tool_input":{...}}' | node hooks/reminder-injector.js`.
