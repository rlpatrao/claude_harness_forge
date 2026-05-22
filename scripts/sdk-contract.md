# Claude Code SDK contract — hook output shapes the forge depends on

This is the contract the forge's hooks emit against. If the SDK
schema changes, update both this file and the affected hook.

Source of truth: Claude Code / Claude Agent SDK documentation as of
late 2025 / early 2026. Verified empirically only where noted.

-----

## Common conventions

All hooks read JSON from stdin and either:
- exit 0 (allow / no-op), OR
- exit 2 with a message on stderr (block), OR
- write a JSON object to stdout with a `hookSpecificOutput` field.

## Event: `SessionStart`

**Input (stdin):**
```json
{
  "session_id": "<uuid>",
  "hook_event_name": "SessionStart",
  "source": "startup" | "resume" | "compact",
  "cwd": "<absolute path>"
}
```

**Output (stdout):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<markdown that becomes a system reminder>"
  }
}
```

Used by: `hooks/session-start.js`.

## Event: `PreToolUse`

**Input (stdin):**
```json
{
  "session_id": "<uuid>",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit" | "Write" | "Bash" | "Agent" | "Task" | ...,
  "tool_input": { /* tool-specific */ },
  "cwd": "<absolute path>"
}
```

**Output (stdout) — option A (advisory):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "<reminder>"
  }
}
```

**Output (stdout) — option B (permission decision):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow" | "deny" | "ask",
    "permissionDecisionReason": "<one-sentence>"
  }
}
```

**Exit 2 + stderr** is treated as a hard block independent of any
output object (the legacy contract). The forge uses exit-2 for hard
deny on `e2e-gate.js`, `feature-edit-guard.js`, `dangerous-patterns.js`.

Used by: `e2e-gate.js`, `feature-edit-guard.js`, `dangerous-patterns.js`,
`reminder-injector.js`.

## Event: `PostToolUse`

**Input (stdin):**
```json
{
  "session_id": "<uuid>",
  "hook_event_name": "PostToolUse",
  "tool_name": "...",
  "tool_input": { ... },
  "tool_response": { ... },
  "cwd": "<absolute path>"
}
```

**Output (stdout):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "<text>",
    "appendToToolResult": "<text appended after the tool result body>"
  }
}
```

`appendToToolResult` may not be a documented field in every SDK
version. If the runtime ignores it, `additionalContext` is the
universal fallback. Both are written by `budget-footer.js`.

Used by: `budget-footer.js`, `experiment-logger.js`, `post-turn.js`.

## Event: `PreCompact`

**TBD — schema unverified.** The SDK supports `auto_compact`; the
`PreCompact` event name is the documented shape but the input schema
(specifically `total_tokens` and `message_count`) is best-effort.

**Input (assumed):**
```json
{
  "session_id": "<uuid>",
  "hook_event_name": "PreCompact",
  "total_tokens": <int>,
  "max_tokens": <int>,
  "message_count": <int>,
  "cwd": "<absolute path>"
}
```

**Output (assumed):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "stage": 1-5,
    "action": "<action key>",
    "spawn_subagent": "compactor",
    "subagent_input": { ... }
  }
}
```

**Risk:** `spawn_subagent` is *not* a standard SDK field. The
orchestrator must translate this into a Task-tool invocation, or the
directive goes nowhere. Until verified, treat compaction-stage's
output as advisory.

Used by: `compaction-stage.js`.

## Event: `Stop`

**Input (stdin):**
```json
{
  "session_id": "<uuid>",
  "hook_event_name": "Stop",
  "stop_hook_active": <bool>,
  "cwd": "<absolute path>"
}
```

**Output (stdout):**
```json
{
  "decision": "block",
  "reason": "<text shown as a system reminder; agent continues>"
}
```

Returning `{ "decision": "block" }` prevents the agent from
terminating. The forge uses this for Ralph Loop (`ralph-loop.js`)
and instinct extraction (`instinct-extractor.js`, exit 0 only — does
not block).

Used by: `ralph-loop.js`, `instinct-extractor.js`.

## Event: `TaskCompleted`

The forge's existing `task-completed.js` and `findings-collector.js`
hooks consume this. v3.0 does not add new TaskCompleted handlers.

-----

## How to verify a schema mismatch

1. Add an `echo` to the hook that writes its stdin to
   `/tmp/forge-hook-debug.json`.
2. Run the harness against a real task.
3. Inspect `/tmp/forge-hook-debug.json` to see the actual input shape.
4. Compare to the table above; update both this doc and the hook
   when divergence is found.

## Known unknowns

- Whether `spawn_subagent` in PreCompact output triggers a Task tool
  call.
- Whether `appendToToolResult` is honored in PostToolUse output.
- Whether `permissionDecision` in PreToolUse is honored alongside
  `additionalContext`.
- Whether the SDK passes `stop_hook_active` (it should per docs).

These resolve on the first end-to-end dogfood run.
