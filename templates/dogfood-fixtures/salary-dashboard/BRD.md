# Salary Dashboard — BRD

**Owner:** Raj Patrao (rlpatrao)
**Status:** Approved (fixture for headless dogfood — BRD v3.4)
**Sourced from:** partial 5-dimension interview conducted 2026-05-20, condensed into a self-contained BRD for `scaffold-import` Branch B.

---

## D1 — Why

**Problem.** Job seekers and mid-career professionals have poor visibility into what salaries actually pay for a given role in a given US location. Salary data lives in fragmented, hard-to-search sources (Glassdoor, levels.fyi, employer disclosures). The most authoritative source — the US Department of Labor's OFLC/H1B LCA disclosure dataset — is a series of quarterly CSVs no ordinary user opens.

**Target user.** An individual job seeker (recent grad, mid-career switcher, relocation candidate) who wants to answer "for role X in location Y, what's the wage distribution?" in under 30 seconds.

**Success criterion.** In a single 5-minute session, a user can answer at least 5 concrete salary questions correctly, backed by real disclosure data. "Correctly" = numbers derived from the dataset, not hallucinated.

**Non-goals.**
- Not a Glassdoor replacement (no employer reviews, culture, interview experiences).
- Not a job board.
- Not for HR / compensation-benchmarking use cases (though the data supports it, the UI is aimed at seekers).

## D2 — What

**MVP scope (in scope for v1):**

1. **Browse** — filter by role (SOC code or free-text), employer, location (city, state, or metro).
2. **Wage distribution view** — for any (role, location) cross-section, show percentile chart (10th / 25th / 50th / 75th / 90th) with sample size.
3. **Compare** — pick two locations for the same role; show side-by-side distributions with a "location premium" delta.
4. **Chatbot** — free-form natural-language questions like "average SWE base in NYC vs SF for FY2024" or "what's the 90th percentile for data engineer in Austin?" — the bot returns numeric answers + backing chart.

**Explicitly out of scope for v1:**
- Cost-of-living adjustments (surfaces in v1.1).
- Trend-over-time charts (deferred).
- Custom user accounts / saved queries (deferred).
- Non-US data.

## D2.5 — Approach

Three approaches were considered:

- **A — Serverless + BigQuery.** Every query hits BigQuery. Excellent scale, but per-query cost adds up and latency is high (>1s cold) — bad for the chatbot.
- **B — Postgres + materialized views + LLM.** Traditional stack. Works but the LCA dataset is columnar and doesn't need transactional guarantees.
- **C — DuckDB + materialized views + LLM proxy (chosen).** Ship the LCA dataset as compressed Parquet inside a DuckDB file. Materialized views for common (role, location, year) cross-sections. LLM proxy holds a small set of tool functions the chatbot calls (`query_wage_distribution`, `compare_locations`). DuckDB gives <100ms queries in-process; no DB server to run; the chatbot's tool calls are the LLM's only knob.

Approach C is chosen for the MVP.

## D3 — How

**Tech stack** (proposed; architect refines in synthesis mode):
- Backend: FastAPI (Python 3.12).
- Data engine: DuckDB (in-process; loads a compressed `.duckdb` file at boot).
- Frontend: Next.js 14 (App Router) + Tailwind. Charts via Recharts.
- LLM proxy: LiteLLM (routes to Anthropic Claude by default; failover to OpenAI).
- Chatbot tool functions: exposed via FastAPI, called from the LLM proxy.
- Data pipeline: quarterly cron re-fetches OFLC H1B LCA CSV, ETLs into DuckDB Parquet.
- Deploy: single Docker container (backend serves the built Next.js static bundle); Fly.io as the target.

**Integrations:**
- US DOL OFLC H1B LCA disclosure data (quarterly CSV: https://www.dol.gov/agencies/eta/foreign-labor/performance).
- LiteLLM as the LLM proxy (allows swapping providers).
- Anthropic Claude for the chatbot (default primary).

**Data model (top-level):**
- `disclosures` — one row per LCA disclosure record. Fields: `case_number`, `employer_name`, `job_title`, `soc_code`, `soc_title`, `wage_min`, `wage_max`, `wage_unit`, `work_city`, `work_state`, `work_metro`, `fiscal_year`, `visa_class`.
- `roles_normalized` — materialized view mapping raw `job_title` to normalized role cluster (via SOC code + fuzzy matching).
- `wage_percentiles_by_role_location_year` — materialized view of the (role, location, year) × percentiles cross-tab.

## D4 — Edge cases

- **Sparse cells.** For (role, location, year) combos with <10 samples, mark the distribution "insufficient data" rather than show unreliable percentiles.
- **Salary vs hourly wage.** LCA data mixes `wage_unit` in {Year, Month, Hour, Week}. All wages are normalized to annual before display.
- **Employer name variants.** "Amazon.com Inc." vs "Amazon.com Services LLC" — v1 does NOT collapse these; users can search either.
- **Chatbot hallucinations.** The bot MUST only answer using tool-call results. A follow-up like "cool, is that fair?" that has no tool result must return "I don't have data on that in the LCA disclosures."
- **Currency.** All wages are USD. No conversion.

## D5 — UI context

- **Layout.** Split-view: filters on left (role, location, year), chart in center, table (top employers, top job titles) on right. Chatbot lives in a persistent right-side drawer that can be collapsed.
- **Responsive.** Desktop-first (1280 breakpoint); mobile (375 breakpoint) collapses filter drawer to a bottom sheet.
- **Empty states.** "Try 'Software Engineer' in 'San Francisco' to see 45,231 disclosures" seeded prompt on first load.
- **Chart type.** Distribution = box-and-whisker; comparison = side-by-side box plots.
- **Accessibility.** WCAG AA. Keyboard-navigable filters + chart data table as fallback.

---

## Acceptance criteria (Given/When/Then)

**AC1.** *Given* the app has loaded with the disclosure dataset, *when* I search for role "Software Engineer" in location "San Francisco, CA", *then* I see a wage distribution chart with p10/p25/p50/p75/p90 and a sample count.

**AC2.** *Given* I've queried a (role, location), *when* I ask the chatbot "how does this compare to NYC?", *then* the bot returns numeric percentiles for NYC alongside the current view.

**AC3.** *Given* a (role, location, year) combo has <10 disclosures, *when* I select it, *then* the chart shows "insufficient data" instead of unreliable percentiles.

**AC4.** *Given* the chatbot has no matching data for a question, *when* I ask it, *then* it says "I don't have data on that in the LCA disclosures" — it never invents numbers.

**AC5.** *Given* a fresh page load, *when* I navigate via keyboard only, *then* I can complete AC1 without a mouse.

## Assumptions register

- LCA data is the authoritative wage source for v1 (not levels.fyi). Confirmed.
- Roles are keyed by SOC code, with fuzzy title→SOC as a fallback. Confirmed.
- Chatbot is Claude Sonnet by default via LiteLLM. Confirmed. Failover chain deferred to architect.
- Docker deploy on Fly.io. Confirmed for MVP; horizontal scale deferred.
