---
name: scaffold-import
description: Import pre-existing BRD, Architecture, and Architecture-as-Code (AAC) files during scaffold instead of running the interactive Q&A interview. Handles markdown (v3.1.1) and later AAC formats (v3.1.10). Writes .imported sentinels that the brd-creator and architect agents check for early-exit.
brd_ref: v3.1 §2
---

# scaffold-import — BRD/Architecture artifact import

Invoked by [`commands/scaffold.md`](../../commands/scaffold.md) when the user chose Q0 branch **B** (all artifacts provided) or **C** (BRD only, architecture to be interviewed).

## When to invoke

- Q0 Branch A (Q&A): **skip this skill entirely**. Standard `/brd` → `/architect` flow.
- Q0 Branch B (all artifacts): invoke; stages BRD + architecture; writes both sentinels.
- Q0 Branch C (hybrid): invoke; stages BRD only; writes only `specs/brd/.imported`.

## Accepted formats (v3.1.1)

| Purpose | Accepted filenames (any of) | Staging target |
|---|---|---|
| BRD / requirements | `BRD.md`, `brd.md`, `requirements.md`, `prd.md`, `PRD.md` | `specs/brd/app_spec.md` |
| Architecture | `architecture.md`, `Architecture.md`, `design.md`, `system-design.md` | `specs/design/architecture.md` |

**Deferred to v3.1.10 (AAC parsers):**
- Structurizr DSL (`*.dsl`)
- PlantUML C4 (`*.puml` with `!include`)
- Mermaid C4 (`*.mmd` with `C4Context` blocks)

If the user provides an AAC file in v3.1.1, tell them clearly it's deferred, and offer to accept a Markdown equivalent instead.

## Step 1 — Collect paths from user

Ask the user to paste absolute paths to each file. Accept relative-to-CWD paths and resolve them. Verify each file exists and is readable before staging.

## Step 2 — Validate content

Before staging, do a shallow validation. The goal is not to grade the doc — it's to catch obviously broken imports (empty file, HTML paste-in that lost formatting, wrong file).

**BRD validation:**
- File is non-empty (≥ 500 chars)
- Contains at least one top-level heading (`# ` at line start)
- Contains at least one of: "user", "problem", "goal", "requirement", "acceptance"

**Architecture validation:**
- File is non-empty (≥ 500 chars)
- Contains at least one top-level heading
- Contains at least one of: "component", "service", "layer", "database", "api", "backend", "frontend"

**On validation failure:** tell the user which check failed. Ask them to fix and retry. Do NOT proceed with staging.

## Step 3 — Stage into `specs/`

```bash
mkdir -p specs/brd specs/design
cp "$SOURCE_BRD" specs/brd/app_spec.md            # branch B or C
cp "$SOURCE_ARCH" specs/design/architecture.md    # branch B only
```

If existing content is present at either target, ask the user to confirm overwrite before proceeding. Never silently overwrite.

## Step 4 — Write sentinel files

The sentinels are what downstream agents (brd-creator, architect) check to decide whether to skip the interactive interview.

```bash
# Branch B:
cat > specs/brd/.imported <<EOF
imported_from: $SOURCE_BRD
imported_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
scaffold_mode: B
EOF

cat > specs/design/.imported <<EOF
imported_from: $SOURCE_ARCH
imported_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
scaffold_mode: B
EOF

# Branch C (BRD only):
cat > specs/brd/.imported <<EOF
imported_from: $SOURCE_BRD
imported_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
scaffold_mode: C
EOF
```

Do NOT write `specs/design/.imported` for Branch C — the architect must still run its interview for architecture decisions.

## Step 5 — Report

Print a summary of what was imported:

```
Imported requirements  → specs/brd/app_spec.md         (2,431 chars from BRD.md)
Imported architecture  → specs/design/architecture.md  (5,102 chars from architecture.md)
Sentinels: specs/brd/.imported, specs/design/.imported

Next: /brd will detect the sentinel and skip the interview.
      /architect will run in synthesis mode (v3.1.2 — no interrogation).
```

For Branch C:
```
Imported requirements  → specs/brd/app_spec.md         (2,431 chars from BRD.md)
Sentinel: specs/brd/.imported

Next: /brd will detect the sentinel and skip the interview.
      /architect will run the standard 11-round interview (no architecture provided).
```

## Downstream impact

After this skill runs, downstream commands behave differently:

| Command | Behavior when `.imported` sentinel exists |
|---|---|
| `/brd` | Early-exit — skips 5-dimension interview. Prints "BRD imported from `<path>` on `<date>`; skipping interview." |
| `/architect` | Runs in `--from-import` synthesis mode (v3.1.2). Reads imported architecture, produces derived design artifacts, skips 11 rounds. |
| `/spec` | Unchanged — reads whatever BRD is at `specs/brd/app_spec.md`. |
| `/design` | Unchanged — reads whatever architecture is at `specs/design/architecture.md`. |

## Overriding an import

To force the interactive flow after importing (e.g., you want to override the imported architecture):

```bash
rm specs/design/.imported
/architect --restart
```

The `--restart` flag on `/architect` (added in v3.1.2) explicitly falls back to the interview even when a sentinel is present.

## Gate

Before returning success:

- [ ] All source files existed and were readable
- [ ] All validation checks passed (or user accepted warnings)
- [ ] Target files copied into `specs/`
- [ ] Sentinel file(s) written
- [ ] User was given a clear summary of what happened and what's next

## Not covered

- Structurizr DSL, PlantUML C4, Mermaid C4 parsing → deferred to v3.1.10
- Merging imports with existing partial specs → deferred; overwrite-or-abort only in v3.1.1
- Re-importing to update an existing spec → for now, delete sentinels + target files, then re-run scaffold
