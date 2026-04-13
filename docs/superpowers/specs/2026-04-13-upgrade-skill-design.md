# /upgrade — In-Place Forge Upgrade

Pull the latest forge from GitHub and upgrade a scaffolded project's forge files in place, preserving all project state and user config.

## Problem

Upgrading a scaffolded project requires: git clone the forge, restart Claude with --plugin-dir, run /scaffold (which re-asks all questions), manually diff what changed. This is error-prone, tedious, and risks overwriting project state.

## Solution

A `/upgrade` skill that runs inside the scaffolded project, pulls the latest forge, replaces forge-owned files, preserves state, merges config, and reports what changed.

---

## Usage

```
/upgrade                # pull latest, upgrade, show report
/upgrade --check        # show what would change without doing it
/upgrade --version 2.0.0  # upgrade to specific version (tag)
```

---

## File Categories

| Category | Path | Action | Rationale |
|----------|------|--------|-----------|
| **A: Replace** | `.claude/agents/` | Overwrite | Forge-owned, no user modifications expected |
| **A: Replace** | `.claude/skills/` | Overwrite | Forge-owned, no user modifications expected |
| **A: Replace** | `.claude/hooks/` | Overwrite | Forge-owned, no user modifications expected |
| **A: Replace** | `.claude/evals/` | Overwrite | Forge-owned, no user modifications expected |
| **A: Replace** | `.claude/templates/` | Overwrite | Forge-owned, no user modifications expected |
| **A: Replace** | `.claude/settings.json` | Overwrite | Hook wiring — forge-owned |
| **A: Replace** | `.claude/architecture.md` | Overwrite | Layer rules — forge-owned |
| **A: Replace** | `forge-reference.md` | Overwrite | Reference doc — forge-owned |
| **B: Preserve** | `.claude/state/*` | Never touch | Accumulated project state (learned rules, coverage, cost, failures) |
| **C: Merge** | `project-manifest.json` | Deep merge | Add new forge fields, preserve user config |
| **C: Merge** | `.claude/program.md` | Section merge | Replace boilerplate, preserve BRD instructions |
| **D: Never touch** | `src/`, `backend/`, `frontend/` | Skip | Generated project code |
| **D: Never touch** | `specs/`, `tests/`, `e2e/` | Skip | Specs, tests, reviews |
| **D: Never touch** | `features.json`, `claude-progress.txt` | Skip | Project tracking |
| **D: Never touch** | `CLAUDE.md`, `Makefile`, `init.sh` | Skip | Project-specific config |
| **D: Never touch** | `.claude/learnings/` | Skip | Cross-project learnings (user may have added entries) |

---

## Steps

### Step 1 — Detect Current Version

Read `project-manifest.json` for `forge_version.version` and `forge_version.sha`.

If `forge_version` doesn't exist (pre-v2.1.0 project): treat as "unknown" version. The upgrade will work — it just can't show a diff summary.

### Step 2 — Pull Latest Forge

```bash
# Clone to temp directory (don't modify user's plugin-dir)
TEMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/rlpatrao/claude-harness-forge.git "$TEMP_DIR"
```

If `--version` flag is set:
```bash
git clone --depth 1 --branch v{version} https://github.com/rlpatrao/claude-harness-forge.git "$TEMP_DIR"
```

If clone fails (no network, repo not found): print error and exit. Don't proceed with stale files.

Read the new version from `$TEMP_DIR/.claude-plugin/plugin.json` → `version` field.

### Step 3 — Compare Versions

If current version == new version AND current SHA == new SHA: print "Already up to date." and exit.

### Step 4 — Diff Analysis (for report)

Before replacing, compute what changed:

```bash
# Count new/modified/removed files per category
diff -rq .claude/agents/ "$TEMP_DIR/agents/" 2>/dev/null
diff -rq .claude/skills/ "$TEMP_DIR/skills/" 2>/dev/null
diff -rq .claude/hooks/ "$TEMP_DIR/hooks/" 2>/dev/null
```

Build a change list:
- **New files**: exist in new forge but not in `.claude/`
- **Modified files**: exist in both but content differs
- **Removed files**: exist in `.claude/` but not in new forge (e.g., `/cost` skill was removed)

For removed files: delete them from `.claude/` (they're forge-owned, and the forge decided to remove them).

### Step 5 — Check Mode (--check)

If `--check` flag: print the diff analysis and exit without making changes.

### Step 6 — Replace Category A Files

```bash
# Remove old forge files (to handle removals like /cost)
rm -rf .claude/agents/ .claude/skills/ .claude/hooks/ .claude/evals/ .claude/templates/

# Copy new files
cp -r "$TEMP_DIR/agents/" .claude/agents/
cp -r "$TEMP_DIR/skills/" .claude/skills/
cp -r "$TEMP_DIR/hooks/" .claude/hooks/
cp -r "$TEMP_DIR/evals/" .claude/evals/
cp -r "$TEMP_DIR/templates/" .claude/templates/
cp "$TEMP_DIR/settings.json" .claude/settings.json
cp "$TEMP_DIR/architecture.md" .claude/architecture.md
cp "$TEMP_DIR/forge-reference.md" forge-reference.md
```

### Step 7 — Add New State Templates

For each file in the new forge's `state/` directory:
- If the file already exists in `.claude/state/` → **skip** (preserve accumulated data)
- If the file does NOT exist → **copy** (new state template)

```bash
for file in "$TEMP_DIR/state/"*; do
  basename=$(basename "$file")
  if [ ! -f ".claude/state/$basename" ]; then
    cp "$file" ".claude/state/$basename"
  fi
done
```

### Step 8 — Merge project-manifest.json

Read both the current and new manifests. Deep merge:

1. For each key in the new manifest that doesn't exist in the current: **add it**
2. For each key in the current manifest: **preserve it** (user config takes priority)
3. Special handling for `forge_version`: always overwrite with new version

```python
import json

current = json.load(open('project-manifest.json'))
new_defaults = json.load(open(f'{temp_dir}/templates/manifest-defaults.json'))  # if exists

# Add new sections that don't exist yet
for key in new_defaults:
    if key not in current:
        current[key] = new_defaults[key]

# Always update forge version
current['forge_version'] = {
    'version': new_version,
    'sha': new_sha,
    'upgraded_at': datetime.utcnow().isoformat() + 'Z'
}

json.dump(current, open('project-manifest.json', 'w'), indent=2)
```

### Step 9 — Merge program.md

The program.md has two parts:
1. **Boilerplate** (constraints, stopping criteria, pipeline status) — replace with new forge version
2. **Instructions block** (populated by /brd with project-specific content) — preserve

Strategy: if the current program.md has a `## Instructions` section, extract it, replace the rest with the new forge template, re-insert the instructions block.

### Step 10 — Update forge_version in Manifest

Write the new version info to `project-manifest.json`:
```json
{
  "forge_version": {
    "version": "2.1.0",
    "sha": "b6fc48c",
    "upgraded_at": "2026-04-13T10:00:00Z"
  }
}
```

### Step 11 — Clean Up

```bash
rm -rf "$TEMP_DIR"
```

### Step 12 — Generate Status Report

Print the upgrade report showing:
- Version change (old → new)
- Category A: files replaced (count per type, highlight new/modified/removed)
- Category B: state files preserved (with counts of entries)
- Category C: merged config (what was added, what was preserved)
- New state templates added
- Category D: untouched project files
- "What's New" summary from the release notes

### Step 13 — Run Validation

Run `validate-scaffold.sh` after upgrade to confirm everything is valid:
```bash
bash .claude/scripts/validate-scaffold.sh 2>&1
```

If validation fails: print the failures and suggest manual fixes. Don't auto-revert — the user may want to inspect.

---

## Version Tracking

During `/scaffold`, set `forge_version` in `project-manifest.json`:
```json
{
  "forge_version": {
    "version": "2.1.0",
    "sha": "b6fc48c",
    "scaffolded_at": "2026-04-13T10:00:00Z",
    "upgraded_at": null
  }
}
```

During `/upgrade`, update `upgraded_at` and version/sha.

This enables:
- `/upgrade --check` to compare versions without pulling
- Status dashboard to show forge version
- Dogfood to track which forge version built each project

---

## Handling Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `forge_version` in manifest (pre-v2.1 project) | Treat as v0.0.0, upgrade everything |
| User modified an agent file | Overwritten — agents are forge-owned. Log: "Note: custom agent modifications will be replaced" |
| User added a custom skill in `.claude/skills/` | Preserved — we rm the known forge skills but custom dirs remain |
| Network unreachable | Fail with clear message: "Cannot reach GitHub. Check network or use --plugin-dir fallback." |
| Specific tag doesn't exist | Fail: "Version v{x} not found. Available tags: ..." |
| Validation fails after upgrade | Print failures, suggest fixes, don't auto-revert |

---

## New Files

| File | Type | Description |
|------|------|-------------|
| `skills/upgrade/SKILL.md` | Execution skill | In-place forge upgrade |

## Modified Files

| File | Change |
|------|--------|
| `commands/scaffold.md` | Add forge_version to manifest during scaffold |
| `CLAUDE.md` | Update skill count |
| `README.md` | Add /upgrade to commands table |
| `scripts/validate-scaffold.sh` | Add upgrade skill to check list |

---

## Gotchas

- **Never touch .claude/state/.** These are monotonic ratchet baselines and append-only logs. Overwriting them breaks the quality guarantee.
- **User custom skills survive.** We rm + cp the forge skill dirs, but any directory not in the forge (e.g., a user-added custom skill) will survive because we only rm known forge dirs.
- **Removed skills are cleaned up.** If the forge removed `/cost`, the upgrade deletes it from `.claude/skills/cost/`. This is intentional — stale skills with wrong references are worse than missing skills.
- **program.md is the trickiest merge.** If the user heavily customized it beyond the instructions block, the merge may lose those customizations. Log a warning: "program.md was updated. Review to ensure your custom constraints were preserved."
- **Always clone to temp.** Never modify the user's plugin-dir or any shared forge clone. The upgrade source is always a fresh disposable clone.
