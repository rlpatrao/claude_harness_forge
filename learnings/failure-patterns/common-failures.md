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

## F2: URL Comparison Without Normalization

**Pattern:** Comparing URLs with `==` or `.includes()` without normalizing ports, schemes, trailing slashes, or subdomains. URLs like `http://localhost:8000/api` and `http://localhost:8000/api/` are different strings but the same endpoint.

**First seen:** User report (issue #1, 2026-04-14). Caused incomplete crawls and broken link detection in a web scraping project.

**Prevention:** Always parse URLs with `new URL()` (JS) or `urllib.parse.urlparse()` (Python) before comparison. Code reviewer Step 7 flags raw URL comparisons.

## F3: Metadata Key Mismatch Between Producer and Consumer

**Pattern:** Code that produces metadata uses different keys than code that consumes it. E.g., producer writes `meta["source_url"]`, consumer reads `meta.get("url")`. Passes tests because tests mock both sides independently.

**First seen:** User report (issue #1, 2026-04-14). Caused silent data loss in a RAG pipeline.

**Prevention:** Code reviewer Step 7 checks that producer keys match consumer keys. Integration tests should use real objects, not mocks that hide mismatches.

## F4: Retry Without Clearing Error State

**Pattern:** Error/retry handlers that retry the operation without clearing the error flag, dismissing the error UI, or resetting the state variable. The retry succeeds but the UI still shows the old error, or the state machine is stuck in an error branch.

**First seen:** User report (issue #1, 2026-04-14). Caused "phantom errors" where the UI showed stale error messages after successful retries.

**Prevention:** Code reviewer Step 7 flags retry handlers that don't clear state. Every retry handler must: (1) clear error state, (2) show loading state, (3) execute retry, (4) update state based on result.

## F5: Dual Code Paths with Divergent Logic

**Pattern:** Streaming and non-streaming variants of the same function have different variable names, different error handling, or different response formats. A fix applied to one path doesn't get applied to the other.

**First seen:** User report (issue #1, 2026-04-14). Caused bugs that only appeared in streaming mode or only in non-streaming mode.

**Prevention:** Code reviewer Step 7 flags duplicate code paths. Prefer a single code path with a `stream: boolean` parameter over two separate functions. If separation is necessary, both must share the same types, variable names, and error handling.
