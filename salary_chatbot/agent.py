from __future__ import annotations

import json

import anthropic

from dataset import SalaryDataset

_SYSTEM = """You are an AI job market salary analyst with access to the \
Global AI Job Market & Salary Trends 2025 dataset (15,001 rows × 20 columns) \
covering AI/ML roles across 15 countries and 14 industries.

Dataset columns: job_id, work_year, job_title, job_category, experience_level \
(EN/MI/SE/EX), employment_type (FT/PT/CT/FL), company_size (S/M/L), \
company_location, employee_residence, remote_ratio (0/50/100), \
education_required, skills_required, industry, salary_currency, salary_local, \
salary_usd, years_experience, benefits_score (1–10), posting_date, hiring_status.

Your workflow for every user question:
1. Call query_salary_data with appropriate filters. If unsure what values exist, \
   call get_filter_options first.
2. LEAD with balance warnings if the result has any. Never suppress them.
3. Present: sample size, median salary, 25th–75th percentile range, and top \
   breakdowns (by experience, location, or whatever is relevant).
4. ALWAYS follow up with suggest_alternative_filters so the user has 2–3 \
   well-balanced next steps to explore.

Hard rules:
- Never draw conclusions from < 30 rows. Say so explicitly instead.
- Flag any result where one country/industry/experience dominates > 80%.
- Alternative suggestions must never be single-source or highly skewed \
  (the tool enforces this, but reinforce it in your language).
- Format salary figures as $X,XXX (USD). Use markdown tables/bullets.
"""

_TOOLS = [
    {
        "name": "query_salary_data",
        "description": (
            "Filter the salary dataset and return statistics plus a balance report. "
            "Omit a key to leave that dimension unfiltered."
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
                    "description": "S=Small (<50), M=Medium (50–250), L=Large (>250)",
                },
                "company_location": {
                    "type": "array", "items": {"type": "string"},
                    "description": "ISO-2 codes: US, GB, DE, CA, AU, IN, FR, NL, SG, CH, BR, JP, ES, PL, SW",
                },
                "industry": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Industry sector names as listed in get_filter_options",
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
                    "description": "Case-insensitive substring to match in job_title",
                },
                "remote_ratio": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "0=On-site, 50=Hybrid, 100=Fully Remote",
                },
                "work_year": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "e.g. [2024, 2025]",
                },
                "salary_min": {"type": "number", "description": "Minimum salary in USD"},
                "salary_max": {"type": "number", "description": "Maximum salary in USD"},
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
            "Generate 2–3 alternative filter sets the user could explore next. "
            "Each suggestion is pre-validated to have ≥30 rows and no single-source skew."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "current_filters": {
                    "type": "object",
                    "description": "The filters used in the most recent query",
                },
                "num_suggestions": {
                    "type": "integer",
                    "description": "Number of alternatives (default 3)",
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

    # ------------------------------------------------------------------ #

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

    # ------------------------------------------------------------------ #

    def _dispatch(self, name: str, inp: dict) -> str:
        if name == "query_salary_data":
            return json.dumps(self._ds.query(inp), default=str)
        if name == "get_filter_options":
            return json.dumps(self._ds.options)
        if name == "suggest_alternative_filters":
            suggestions = self._ds.suggest_alternatives(
                inp.get("current_filters", {}),
                inp.get("num_suggestions", 3),
            )
            return json.dumps(suggestions, default=str)
        return json.dumps({"error": f"Unknown tool: {name}"})
