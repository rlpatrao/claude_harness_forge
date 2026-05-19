**Reminder (BRD §4.2)** — you are about to run a destructive shell command (`rm`, `dd`, `mkfs`, `> /dev/`, or similar).

Hard checks before proceeding:
- Is the path explicitly named and absolute? No globs that could match more than intended.
- Is there an undo? (`git revert` if it's a tracked file; backup if it's not.)
- If the user did not explicitly authorize this destruction in this session, STOP and ask.

If you cannot answer yes to all three, do not run the command.
