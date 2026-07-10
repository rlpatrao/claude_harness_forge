# Balanced Coupling rubric (BRD v3.2.5)

Formal 3-axis coupling analysis, adapted from Vlad Khononov's *Balancing Coupling in Software Design*. Replaces prose-level "this looks tightly coupled" judgment with a rule you can check on a diff.

Adopted by `cwijayasundara/claude_harness_eng_v5` via commit `313ad533` (G27) per BRD v3.2 §3.5.

## The 3 axes

For any two components A and B that interact:

**1. STRENGTH — how tightly coupled?**
- `intimate` — A depends on B's internals: private fields, non-public functions, monkey-patched behavior, exception-string parsing
- `weak` — A depends only on B's published interface / documented API

**2. DISTANCE — how far apart in the system?**
- `same-module` — same file or immediate sibling files in one module
- `same-service` — same process / codebase / deployable unit
- `cross-service` — network boundary between A and B (HTTP, gRPC, queue)

**3. VOLATILITY — how often does B change?**
- `high` — B changes multiple times per week (active feature area, active refactor target, third-party dependency you don't control)
- `low` — B is stable (frozen contract, mature library, well-tested infrastructure)

## The formal rule

```
BALANCE = (STRENGTH XOR DISTANCE) OR (NOT VOLATILITY)
```

Read: **balanced** if either **exactly one** of {intimate strength, close distance} is present, OR the counterparty is **stable**.

Equivalently, coupling is **unbalanced** when:
- Two components are **both** intimately-coupled AND far apart, AND B is volatile.
- OR two components are **weakly-coupled** AND close AND stable — technically "over-costly": you paid coordination cost for no benefit.

The most dangerous unbalance is (intimate strength × cross-service distance × high volatility) — every deploy of B breaks A, at a distance, through internals.

## Truth table

| STRENGTH | DISTANCE | VOLATILITY | STRENGTH XOR DISTANCE | NOT VOLATILITY | BALANCE |
|---|---|---|---|---|---|
| intimate (1) | same-module (0) | high (1) | 1 | 0 | ✓ |
| intimate (1) | cross-service (1) | high (1) | 0 | 0 | ✗ WORST |
| intimate (1) | cross-service (1) | low (0) | 0 | 1 | ✓ |
| weak (0) | same-module (0) | high (1) | 0 | 0 | ✗ (over-costly? or too-close?) |
| weak (0) | cross-service (1) | high (1) | 1 | 0 | ✓ |
| weak (0) | same-module (0) | low (0) | 0 | 1 | ✓ |

Encoding: STRENGTH `intimate=1 weak=0`; DISTANCE `far=1 close=0`; VOLATILITY `high=1 low=0`.

## How to apply in a diff review

For each edit that introduces or modifies coupling between two components:

1. **Identify A and B.** What's the caller (or observer), what's the callee (or subject)?
2. **Score STRENGTH.** Does A touch B's internals? Read private fields? Rely on undocumented behavior? Import a "private-looking" symbol (leading underscore, non-exported)?
3. **Score DISTANCE.** Are A and B in the same file? Same module? Same service? Or across a network boundary?
4. **Score VOLATILITY of B.** Look at `state/code-graph.json` (v3.1.9) for edit frequency; check git log; check if B is a third-party dependency; ask "how often does this change?"
5. **Apply the rule.** If BALANCE = ✓, the coupling is fine. If ✗, flag it as a finding.

## Worked example 1 — balanced (intimate + close + high volatility)

```py
# src/orders/pricing.py — same module as calculator below
class OrderPricingCalculator:
    def _apply_discount(self, order, rate):  # private
        order._subtotal *= (1 - rate)        # touches _subtotal directly
    def total(self, order):
        self._apply_discount(order, 0.1)
        return order._subtotal + order._tax
```

STRENGTH = intimate (`_subtotal`, `_apply_discount`). DISTANCE = same-module. VOLATILITY = high (pricing changes often).

`(intimate XOR same-module) = (1 XOR 0) = 1` → **BALANCE = ✓**.

Intimate coupling is fine when close: refactoring is cheap.

## Worked example 2 — unbalanced (intimate + cross-service + high volatility)

```py
# src/orders/pricing.py
async def total(order_id):
    # Reach into inventory service's internal Redis key format
    key = f"inventory:v3:_internal:{order_id}:_reserved"
    reserved = await redis.get(key)  # not a documented API of inventory service
    ...
```

STRENGTH = intimate (reaching into inventory-service's internal Redis key format, undocumented). DISTANCE = cross-service (they run as separate deployables). VOLATILITY = high (inventory-service changes weekly).

`(intimate XOR cross-service) = (1 XOR 1) = 0`. `NOT high = 0`. → **BALANCE = ✗ WORST**.

This is the failure mode Khononov calls out most: every deploy of the inventory service breaks pricing, silently, without either team knowing. Findings should recommend adding an API to inventory-service and consuming that instead.

## Worked example 3 — balanced by low volatility (intimate + cross-service + low volatility)

```py
# Talking to an ancient legacy service that never changes
def query_ssn(person_id):
    raw = socket_call("legacy://ssn?id=" + person_id)
    # Parse the (undocumented, but frozen since 2001) fixed-width format
    return raw[10:19]
```

STRENGTH = intimate. DISTANCE = cross-service. VOLATILITY = low (frozen legacy).

`(1 XOR 1) = 0`. `NOT low = 1`. → **BALANCE = ✓**.

Ugly, but not risky. Refactoring cost isn't worth it while the underlying service is frozen.

## Report shape (when critic or code-reviewer uses this rubric)

```markdown
### Balanced Coupling review

For each questionable coupling found in the diff:

| # | A → B | STRENGTH | DISTANCE | VOLATILITY | BALANCE | Recommendation |
|---|---|---|---|---|---|---|
| 1 | pricing.total → inventory._reserved key | intimate | cross-service | high | ✗ WORST | Add a documented API on inventory-service; consume via HTTP |
| 2 | OrderService → OrderRepo._session | intimate | same-service | high | ✓ | Fine as-is (intimate close-coupling is cheap to refactor) |
```

## Not covered

- **Coupling to third-party APIs.** VOLATILITY is often unknown for third parties; default to `high` unless the vendor has an explicit stability commitment.
- **Coupling within a monorepo across "logical service" boundaries** where there's no deploy boundary. Judgment call — use "same-service" if they deploy together.
- **Temporal coupling** (order-of-operations dependencies without direct code coupling). This rubric focuses on lexical coupling; temporal coupling is a separate axis.

## References

- Vlad Khononov, *Balancing Coupling in Software Design* (Addison-Wesley, 2024).
- Adoption source: `cwijayasundara/claude_harness_eng_v5/.claude/agents/modularity-reviewer.md` (via G27 in that repo's HARNESS_ENGINEERING_GAP_ANALYSIS.md).
