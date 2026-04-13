# Common Failure Patterns

Recurring failure patterns extracted across projects. Used by the architect to proactively warn about known pitfalls, and by the generator to avoid repeating mistakes.

Updated by the architect post-build when the same failure category appears in 3+ projects.

## F1: Tests Pass on Synthetic Data, App Crashes on Real Data

**Pattern:** All unit and E2E tests pass using small synthetic test fixtures, but the application crashes on launch because real production data has different characteristics (unequal row lengths, larger dimensions, unexpected characters, encoding differences).

**First seen:** Pac-Man CLI dogfood (2026-04-12). 68 tests passed using 5x5 test mazes. The real 28x31 classic maze had rows of unequal length in the ghost house area, causing `IndexError: list index out of range` on first render.

**Root cause:** E2E tests exercised game logic but never loaded the actual `classic.txt` map file. The render path was untested with real data.

**Prevention:**
1. E2E tests MUST include at least one test that loads real production data (maps, configs, datasets).
2. Dogfood Gate 13 (Smoke Launch) verifies the app starts without crashing.
3. Data loading code must normalize inputs (pad rows, handle encoding, validate dimensions).

**Applied in:** test-engineer agent, dogfood skill (Gate 13).
