from __future__ import annotations

import json

import anthropic

from dataset import SalaryDataset

_SYSTEM = """You are an AI job market salary analyst backed by the \
Global AI Job Market & Salary Trends 2025 dataset (15,001 rows × 20 columns) \
covering AI/ML roles across 15 countries and 14 industries.

Dataset columns:
  job_id, work_year, job_title, job_category,
  experience_level (EN=Entry / MI=Mid / SE=Senior / EX=Executive),
  employment_type  (FT=Full-time / PT=Part-time / CT=Contract / FL=Freelance),
  company_size     (S / M / L),
  company_location (ISO-2: US GB DE CA AU IN FR NL SG CH BR JP ES PL SW),
  employee_residence, remote_ratio (0=On-site / 50=Hybrid / 100=Remote),
  education_required, skills_required, industry, salary_currency,
  salary_local, salary_usd, years_experience,
  benefits_score (1–10), posting_date, hiring_status.

Workflow — follow this for EVERY user question:
1. If the user's message contains a JSON filters dict (prefixed "filters="),
   extract it and pass those exact values to query_salary_data.
   Otherwise infer the right filters from the question.
2. Call query_salary_data. If unsure what values exist for a dimension,
   call get_filter_options first.
3. If the balance report contains warnings, LEAD with them before the stats.
4. Present: sample size, median, p25–p75 range, and the most relevant breakdown.
5. ALWAYS end by calling suggest_alternative_filters, then tell the user
   what the 2–3 suggestions are and why each is interesting.

Hard guardrails:
- The dataset enforces a minimum of 3 rows. If a query returns fewer,
  say so and suggest broadening filters — do not guess or fabricate numbers.
- Flag results where one value dominates > 85% on any key dimension.
- Format salaries as $X,XXX (USD). Use markdown tables or bullets.
- Suggestions come from the data itself; never invent filter combinations
  that don't reflect what's actually in the filtered subset.
"""

_TOOLS = [
    {
        "name": "query_salary_data",
        "description": (
            "Filter the salary dataset and return salary statistics plus a balance report. "
            "Omit a key entirely to leave that dimension unfiltered."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "experience_level": {
                    "type": "array", "items": {"type": "string"},
                    "description": "EN=Entry, MI=Mid, SE=Senior, EX=Executive",
                },
                "employment_type": {
                    "type": "array", "items": {"type": "string"},
                    "description": "FT=Full-time, PT=Part-time, CT=Contract, FL=Freelance",
                },
                "company_size": {
                    "type": "array", "items": {"type": "string"},
                    "description": "S=Small, M=Medium, L=Large",
                },
                "company_location": {
                    "type": "array", "items": {"type": "string"},
                    "description": "ISO-2 codes, e.g. ['US', 'GB', 'DE']",
                },
                "industry": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Sector name(s) — use get_filter_options to see all values",
                },
                "education_required": {
                    "type": "array", "items": {"type": "string"},
                    "description": "High School | Bachelor's | Master's | PhD",
                },
                "job_category": {
                    "type": "array", "items": {"type": "string"},
                    "description": (
                        "ML Engineering | Data Science | AI Research | MLOps | "
                        "Data Engineering | Product Management | Robotics"
                    ),
                },
                "job_title_contains": {
                    "type": "string",
                    "description": "Case-insensitive substring match on job_title",
                },
                "remote_ratio": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "0=On-site, 50=Hybrid, 100=Fully Remote",
                },
                "work_year": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "e.g. [2024, 2025]",
                },
                "salary_min": {"type": "number", "description": "Min salary in USD"},
                "salary_max": {"type": "number", "description": "Max salary in USD"},
            },
        },
    },
    {
        "name": "get_filter_options",
        "description": "Return all unique values for every filterable column.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "suggest_alternative_filters",
        "description": (
            "Generate 2–3 alternative filter sets derived from the actual distribution "
            "of the current filtered subset — not hardcoded rules. Each suggestion is "
            "pre-validated to return ≥ 3 rows (the hard guardrail)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "current_filters": {
                    "type": "object",
                    "description": "The exact filters passed to the most recent query_salary_data call",
                },
                "num_suggestions": {
                    "type": "integer",
                    "description": "How many alternatives to return (default 3, max 4)",
                },
            },
            "required": ["current_filters"],
        },
    },
]


class SalaryAgent:
    def __init__(self, dataset: SalaryDataset) -> None:
        self._ds      = dataset
        self._client  = anthropic.Anthropic()
        self._history: list[dict] = []
        self.last_filters:     dict       = {}
        self.last_suggestions: list[dict] = []

    def chat(self, user_msg: str) -> str:
        self._history.append({"role": "user", "content": user_msg})
        while True:
            resp = self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=_SYSTEM,
                tools=_TOOLS,
                messages=self._history,
            )
            self._history.append({"role": "assistant", "content": resp.content})

            if resp.stop_reason == "end_turn":
                return next(
                    (b.text for b in resp.content if hasattr(b, "text")), ""
                )

            if resp.stop_reason == "tool_use":
                results = [
                    {
                        "type": "tool_result",
                        "tool_use_id": b.id,
                        "content": self._dispatch(b.name, b.input),
                    }
                    for b in resp.content
                    if b.type == "tool_use"
                ]
                self._history.append({"role": "user", "content": results})
            else:
                break

        return "Something went wrong — please try again."

    def reset(self) -> None:
        self._history.clear()
        self.last_filters     = {}
        self.last_suggestions = []

    def _dispatch(self, name: str, inp: dict) -> str:
        if name == "query_salary_data":
            self.last_filters = inp
            return json.dumps(self._ds.query(inp), default=str)
        if name == "get_filter_options":
            return json.dumps(self._ds.options)
        if name == "suggest_alternative_filters":
            suggestions = self._ds.suggest_alternatives(
                inp.get("current_filters", {}),
                inp.get("num_suggestions", 3),
            )
            self.last_suggestions = suggestions
            return json.dumps(suggestions, default=str)
        return json.dumps({"error": f"Unknown tool: {name}"})
