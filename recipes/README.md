# recipes/

YAML-defined repeatable workflows. BRD §6.5.

A recipe is **deterministic** (same inputs → same step sequence), **parameterized** (typed inputs), and **version-controllable** (lives in git, reviewable in PR).

## Schema

```yaml
name: <recipe-name>             # kebab-case, unique
description: <one-line>         # surfaced by /recipe-run --list

inputs:                         # typed input declarations
  <name>: <type>                # type: string | number | bool | date
  <name>:                       # or detailed form:
    type: <type>
    description: <one-line>
    default: <value>            # optional
    required: true              # default true

steps:                          # ordered, executed top-to-bottom
  - skill: <skill-name>         # name from skills/ tree
    params:                     # kwargs to the skill
      <key>: <value>            # values may interpolate {{ inputs.x }}
    pipe: true                  # optional; pass output to next step
    on_error: abort | skip      # default abort
```

## Hard rules

- **Skills referenced must exist** at recipe-load time. Missing skill → recipe rejected.
- **No nested recipes.** A recipe may not invoke `/recipe-run` from inside a step. Compose at the skill layer instead.
- **No raw shell.** If a step needs a shell command, wrap it in a skill that uses `Bash` internally.
- **No write to feature_list.json from a recipe.** Feature mutations are coding-agent decisions, not recipe outputs.

## Example

See `recipes/example-weekly-consulting.yaml`.

## Source

YAML schema read-and-reimplemented from `block-open-source/goose` `crates/goose/src/recipe/` (Apache-2.0). The runtime is forge-native; only the schema is borrowed. See BRD §10.4 §6.5.
