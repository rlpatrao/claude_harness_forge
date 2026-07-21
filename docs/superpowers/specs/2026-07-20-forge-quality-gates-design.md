# Forge Quality Gates: jscpd Duplication · sha256-Integrity Artifacts · Invariants Parser

**Date:** 2026-07-20
**Status:** Approved design — pending implementation plan
**Scope:** Claude Harness Forge repo (`/Users/rlpatrao/workspace/claude_harness_forge`). No changes to scaffolded test-projects except where noted as explicit follow-ups.

## Goal

Add three quality-infrastructure features to the forge:

1. **jscpd duplication gate** — copy-paste detection as a ratcheted check, folded into the existing entropy-control (`lint-drift`) gate.
2. **sha256-integrity artifacts** — tamper-evident verification artifacts; the E2E gate verifies hashes before a `passes:false→true` flip.
3. **invariants parser** — a declarative, machine-checkable replacement for the ad-hoc "invariant" bash currently hand-written in CI and described as prose in verification artifacts.

## Non-goals

- No new runtime dependency for the forge itself (hooks/scripts are stdlib-only per `package.json`).
- Not tamper-*proof* artifacts (no commit signing); tamper-*evident* is the bar.
- Not scaffolding per-project invariants into new projects yet (follow-up).
- Not hashing critic-vote or other artifacts yet (verification `.json`/`.png` only).

## Cross-cutting principles

- **Stdlib-only Node.** `crypto` for sha256; hand-parsed constrained YAML for invariants, mirroring `scripts/workflows-resolver.js` (which already parses `config/workflows.yaml` with no dependency).
- **Graceful `NOT_RUN`.** A check that cannot execute (no `npx`, tool absent) exits 0 with a `NOT_RUN` warning — never a false pass. Same contract the mutation gate uses.
- **Baseline ratchet.** Follows the existing `state/coverage-baseline.txt` / `state/mutation-baseline.txt` pattern: a plaintext baseline that auto-seeds on first run and may only improve.

---

## Feature 1 — jscpd duplication gate (folded under lint-drift)

**Decision:** run jscpd inside the existing entropy-control / `lint-drift` gate. The "12-gate" branding is unchanged; duplication is an additional ratchet inside that gate, not a new numbered gate.

### Contract

Run [jscpd](https://github.com/kucherenko/jscpd) over configured source dirs, compute duplication percentage, and ratchet against `state/duplication-baseline.txt`:

- New `%dup` must be `<= baseline` (never regress) **and** `<= absolute_cap` (default 10%).
- Baseline auto-seeds to the first measured value when the file is absent **or** holds the sentinel `100` (shipped default = "unset"); thereafter it may only ratchet down (like mutation-baseline).
- On regression → exit 2 (gate fails, feeds self-heal). On tool-absent → exit 0 + `NOT_RUN`.

### Components

| File | Kind | Responsibility |
|---|---|---|
| `scripts/jscpd-gate.js` | new | Runs `npx --yes jscpd --reporters json --mode strict --silent <paths>`, reads jscpd's `jscpd-report.json`, extracts `statistics.total.percentage`, compares to baseline + cap, writes `specs/reviews/jscpd-report.json`, updates baseline on improvement. Exit 2 on regress, 0 otherwise, `NOT_RUN` on tool-absent. |
| `templates/.jscpd.json.template` | new | jscpd config: `minTokens`, `ignore` globs (tests, generated, `node_modules`, `.next`, `mutants`), `absoluteThreshold`. |
| `state/duplication-baseline.txt` | new | Seed baseline (`100` sentinel meaning "unset → first run sets it"). |
| `skills/lint-drift/SKILL.md` | modify | Add a "Duplication (jscpd)" subsection: how the gate runs, the ratchet, and the self-heal (extract shared helper / dedupe). |
| `skills/auto/SKILL.md` | modify | In SECTION 5 (Gate 4 / entropy area) and the self-heal category table, note the jscpd sub-check + `duplication` failure category. |
| `templates/Makefile.template` | modify | `make dup` target → `node .claude/scripts/jscpd-gate.js`. |
| `.github/workflows/ci.yml` | modify | Add a duplication step (runs jscpd-gate on the forge's own `scripts/`+`hooks/` as a dogfood, non-blocking initially). |

### Error handling / degradation

- `npx` missing or jscpd fetch fails → `NOT_RUN`, logged, exit 0.
- jscpd report unparseable → `NOT_RUN`, exit 0 (never block on our own bug — matches hook defensiveness).

### Testing

- Fixture `scripts/__fixtures__/jscpd/duplicated/` with two near-identical files (known >threshold) → gate exits 2.
- Fixture `.../clean/` (no dup) → exit 0, baseline written.
- Baseline-regression case: set baseline to 0, run on duplicated fixture → exit 2.

---

## Feature 2 — sha256-integrity artifacts (verification artifacts only)

### Contract

When a verification artifact set is captured, write a **git-tracked sidecar** of sha256 hashes. Before accepting a `passes:false→true` flip, `hooks/e2e-gate.js` recomputes the hashes and compares them to the committed sidecar. Mismatch or missing sidecar → **BLOCK**.

This closes the hole where an agent hand-edits `verification/<id>.json` after the fact to fake verification.

### Sidecar format

`verification/<id>.sha256.json`:

```json
{
  "algo": "sha256",
  "feature_id": "<id>",
  "created_at": "<ISO8601>",
  "files": {
    "verification/<id>.json": "<hex sha256>",
    "verification/<id>.png": "<hex sha256>"
  }
}
```

Sidecar (not embedded hash): hashing a file that contains its own hash is self-referential. The sidecar is the source of truth and must itself be git-tracked.

### Components

| File | Kind | Responsibility |
|---|---|---|
| `hooks/lib/artifact-integrity.js` | new | `computeSha256(absPath)`, `writeSidecar(projectDir, featureId, relFiles)`, `verifySidecar(projectDir, featureId) → {ok, mismatches[], missing[]}`. Stdlib `crypto` + `fs`. Defensive: never throws to the caller. |
| `hooks/e2e-gate.js` | modify | After the existing exists + git-tracked checks (~line 157), for each flipped feature: require `verification/<id>.sha256.json` exists **and** is git-tracked, then `verifySidecar`; BLOCK on missing/mismatch with a specific message + `logRejection({source:'artifact-integrity'})`. |
| `scripts/verify-artifacts.js` | new | CI/manual: verify all sidecars in `verification/` for the repo; exit non-zero on any mismatch. |
| `skills/auto/SKILL.md`, `agents/e2e-runner.md` | modify | Document: after capturing the artifact, call `writeSidecar` and `git add` both artifact + sidecar **before** flipping `passes`. |

### Threat model (explicit)

Tamper-*evident*, not tamper-proof. Editing the artifact alone → hash mismatch → blocked. Editing artifact + sidecar together is possible but visible in git history/diff. Commit signing (out of scope) would close the residual gap.

### Testing

- Good path: write artifact + sidecar → `verifySidecar.ok === true`; simulated e2e-gate input allows the flip.
- Tamper path: mutate the artifact byte → `verifySidecar.ok === false`, `mismatches` names the file; e2e-gate input → exit 2.
- Missing-sidecar path: delete sidecar → e2e-gate BLOCK with "missing integrity sidecar".

---

## Feature 3 — invariants parser (forge self-invariants first)

### Contract

A declarative `config/invariants.yaml` + `scripts/check-invariants.js` that evaluates each invariant and exits non-zero if any `required` invariant fails. Replaces the ad-hoc bash in `.github/workflows/ci.yml` ("BRD docs invariants", "settings.json hook registration invariants") and formalizes the prose "13 on-disk invariants" pattern.

### `config/invariants.yaml` schema

A list of invariants; each:

```yaml
- id: brd-v30-present
  description: Canonical BRD v3.0 spec exists
  type: file_exists
  path: brd/v3.0.md
  severity: required

- id: e2e-gate-registered
  description: e2e-gate hook is registered on PreToolUse
  type: hook_registered
  event: PreToolUse
  hook: e2e-gate.js
  severity: required

- id: feature-list-array
  description: feature_list.json top-level is an array
  type: json_path_equals
  file: feature_list.json
  path: $.__isArray
  equals: true
  severity: advisory
```

### Check types (v1)

| type | params | passes when |
|---|---|---|
| `file_exists` | `path` | file exists |
| `glob_min_count` | `glob`, `min` | ≥ `min` files match |
| `grep_match` | `file`, `pattern` | regex matches file contents |
| `json_path_equals` | `file`, `path`, `equals` | resolved value deep-equals `equals` (minimal JSONPath: dotted keys, `[n]`, `__isArray`, `__length`) |
| `hook_registered` | `event`, `hook` | `settings.json` lists `<hook>` under `hooks.<event>` |
| `command_exit_zero` | `cmd` (allowlisted argv array, `execFileSync` — no shell) | command exits 0 |
| `artifact_integrity` | `feature_id` | `verifySidecar` (Feature 2) returns ok — ties the two features together |

### Components

| File | Kind | Responsibility |
|---|---|---|
| `config/invariants.yaml` | new | Seeded from the CI bash blocks + the dogfood "13 on-disk invariants" (BRD docs present, hook registrations, sentinels, IR, approved flag). |
| `scripts/check-invariants.js` | new | Stdlib-only. Hand-parses the constrained YAML (reuse the approach in `scripts/workflows-resolver.js`). Evaluates each invariant, prints a `PASS/FAIL  id  description` table, exits 1 if any `required` fails (advisory failures warn only). `--json` for machine output. |
| `commands/invariants.md` | new | `/invariants` slash command → runs the checker, renders the table. |
| `.github/workflows/ci.yml` | modify | Replace the "BRD invariants" + "hook registration" bash steps with `node scripts/check-invariants.js`. |

`command_exit_zero` uses `execFileSync` with an argv array (no shell string) to avoid injection — matches the plan-repo guidance ("use execFileSync not exec").

### Testing

- `scripts/__fixtures__/invariants/pass.yaml` (all satisfiable against the repo) → exit 0.
- `.../fail-required.yaml` (a `file_exists` on a missing path, `required`) → exit 1, names the failing id.
- `.../fail-advisory.yaml` (advisory failure only) → exit 0 with a warning.
- YAML-parse edge cases: comments, quoted values, nested list items.

---

## Testing & validation strategy (all three)

- **Per-script fixtures** as above, runnable via a new `scripts/test-quality-gates.sh` that drives each script against its fixtures and asserts exit codes.
- **Scaffold validation:** extend `scripts/validate-scaffold.sh` to `check_file` the new files (`scripts/jscpd-gate.js`, `scripts/check-invariants.js`, `scripts/verify-artifacts.js`, `hooks/lib/artifact-integrity.js`, `config/invariants.yaml`, `templates/.jscpd.json.template`) and assert `e2e-gate.js` contains the integrity check + `check-invariants` is wired in CI.
- **CI:** add steps for `check-invariants.js`, `verify-artifacts.js`, and the jscpd dogfood; run `test-quality-gates.sh`.
- **Self-check invariant:** add an invariant asserting the three new scripts exist — the invariants parser guards its own siblings.

## File manifest

**New (10):** `scripts/jscpd-gate.js`, `scripts/check-invariants.js`, `scripts/verify-artifacts.js`, `scripts/test-quality-gates.sh`, `hooks/lib/artifact-integrity.js`, `config/invariants.yaml`, `commands/invariants.md`, `templates/.jscpd.json.template`, `state/duplication-baseline.txt`, `scripts/__fixtures__/**`.

**Modified (7):** `hooks/e2e-gate.js`, `skills/lint-drift/SKILL.md`, `skills/auto/SKILL.md`, `agents/e2e-runner.md`, `templates/Makefile.template`, `.github/workflows/ci.yml`, `scripts/validate-scaffold.sh`. Plus `CLAUDE.md` (document the three features; counts).

## Rollout (commit sequence)

1. Fixtures + `test-quality-gates.sh` (red).
2. Feature 3 invariants parser (parser + YAML + CI swap + `/invariants`).
3. Feature 2 integrity lib + e2e-gate wiring + verify-artifacts + `artifact_integrity` invariant type.
4. Feature 1 jscpd-gate + lint-drift/auto wiring + Makefile + `.jscpd.json` template.
5. `validate-scaffold.sh` + CLAUDE.md + CI; run all validation green.

## Open questions

None outstanding — the three design decisions (fold jscpd under lint-drift; verification artifacts only; forge self-invariants first) are settled.
