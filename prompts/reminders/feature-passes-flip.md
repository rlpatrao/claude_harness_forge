**Reminder (BRD §3.8)** — you are about to flip a `feature_list.json` `passes` field.

Required before the flip:
1. A Playwright or Puppeteer MCP session executed the entry's `steps[]` against the running app.
2. The session produced a screenshot, DOM assertion, or JSON proof-of-state.
3. The artifact is saved at the entry's `verification_artifact_path` (`verification/<feature_id>.{png,json}`).
4. The artifact is `git add`-staged or already committed.
5. The artifact is non-empty.

The `hooks/e2e-gate.js` PreToolUse hook will reject the flip if any of 1-5 are false. Save yourself the rejection cycle — confirm now.
