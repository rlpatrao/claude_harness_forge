from __future__ import annotations

from typing import Any

import pandas as pd

EXP_ORDER  = ["EN", "MI", "SE", "EX"]
EXP_LABELS = {"EN": "Entry-level", "MI": "Mid-level", "SE": "Senior", "EX": "Executive"}


class SalaryDataset:
    SKEW_THRESHOLD = 0.80
    MIN_ROWS_WARN  = 100
    MIN_ROWS_HARD  = 30

    def __init__(self, df: pd.DataFrame) -> None:
        self.df = df
        self._categorical = [
            "experience_level", "employment_type", "company_size",
            "company_location", "employee_residence", "industry",
            "education_required", "job_category", "hiring_status",
        ]
        self.options: dict[str, list] = self._build_options()

    def _build_options(self) -> dict[str, list]:
        out: dict[str, list] = {}
        for col in self._categorical:
            if col in self.df.columns:
                out[col] = sorted(self.df[col].dropna().unique().tolist())
        for col in ("job_title", "remote_ratio", "work_year"):
            if col in self.df.columns:
                out[col] = sorted(self.df[col].dropna().unique().tolist())
        return out

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def query(self, filters: dict) -> dict[str, Any]:
        df = self.df.copy()

        _list_cols = [
            "experience_level", "employment_type", "company_size",
            "company_location", "industry", "education_required",
            "job_category", "hiring_status", "remote_ratio", "work_year",
        ]
        for col in _list_cols:
            vals = filters.get(col)
            if vals and col in df.columns:
                df = df[df[col].isin(vals)]

        if filters.get("job_title_contains") and "job_title" in df.columns:
            df = df[df["job_title"].str.contains(
                filters["job_title_contains"], case=False, na=False
            )]
        if filters.get("salary_min") is not None:
            df = df[df["salary_usd"] >= filters["salary_min"]]
        if filters.get("salary_max") is not None:
            df = df[df["salary_usd"] <= filters["salary_max"]]

        balance = self._balance(df)
        stats   = self._stats(df)
        return {"stats": stats, "balance": balance, "row_count": len(df)}

    def suggest_alternatives(
        self, current_filters: dict, n: int = 3
    ) -> list[dict]:
        candidates = self._build_candidates(current_filters)
        valid: list[dict] = []
        for cand in candidates:
            r   = self.query(cand["filters"])
            bal = r["balance"]
            if bal["n"] < self.MIN_ROWS_HARD:
                continue
            cand["preview_count"]      = bal["n"]
            cand["preview_median_usd"] = (
                r["stats"].get("salary_usd", {}).get("median") if "error" not in r["stats"] else None
            )
            cand["balanced"] = bal["balanced"]
            if not bal["balanced"]:
                cand["balance_warnings"] = bal["warnings"]
            valid.append(cand)
            if len(valid) >= n:
                break
        return valid

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _balance(self, df: pd.DataFrame) -> dict:
        n = len(df)
        warnings: list[str] = []

        if n < self.MIN_ROWS_HARD:
            warnings.append(
                f"Only {n} rows — too few for reliable statistics (minimum {self.MIN_ROWS_HARD})."
            )
        elif n < self.MIN_ROWS_WARN:
            warnings.append(f"Only {n} rows — interpret with caution.")

        for col, label in {
            "company_location": "geographic location",
            "experience_level": "experience level",
            "industry":         "industry",
            "employment_type":  "employment type",
        }.items():
            if col not in df.columns or n == 0:
                continue
            vc = df[col].value_counts(normalize=True)
            if len(vc) == 1:
                warnings.append(
                    f"Single-source: all results share one {label} ('{vc.index[0]}')."
                )
            elif vc.iloc[0] > self.SKEW_THRESHOLD:
                warnings.append(
                    f"{vc.iloc[0]*100:.0f}% of results are {label} '{vc.index[0]}' "
                    f"— data is skewed; consider broadening this filter."
                )

        return {"warnings": warnings, "balanced": len(warnings) == 0, "n": n}

    def _stats(self, df: pd.DataFrame) -> dict:
        if len(df) == 0:
            return {"error": "No rows match the given filters."}

        s = df["salary_usd"]
        out: dict[str, Any] = {
            "count": len(df),
            "salary_usd": {
                "min":    int(s.min()),
                "p25":    int(s.quantile(0.25)),
                "median": int(s.median()),
                "mean":   int(s.mean()),
                "p75":    int(s.quantile(0.75)),
                "max":    int(s.max()),
            },
        }

        if "benefits_score" in df.columns:
            out["avg_benefits_score"] = round(float(df["benefits_score"].mean()), 2)

        for col in [
            "experience_level", "company_location", "employment_type",
            "industry", "company_size", "remote_ratio",
        ]:
            if col not in df.columns:
                continue
            grp = (
                df.groupby(col)["salary_usd"]
                  .agg(count="count", median="median")
                  .round(0)
                  .sort_values("median", ascending=False)
                  .head(10)
                  .to_dict(orient="index")
            )
            out[f"by_{col}"] = grp

        return out

    def _build_candidates(self, cf: dict) -> list[dict]:
        cands: list[dict] = []

        # 1. Broaden geography if narrow
        locs = cf.get("company_location", [])
        if 1 <= len(locs) <= 2:
            top5 = self.df["company_location"].value_counts().head(5).index.tolist()
            merged = sorted(set(locs) | set(top5))
            cands.append({
                "label":     "Broaden to top-5 countries",
                "filters":   {**cf, "company_location": merged},
                "rationale": f"Expand geography to {', '.join(merged)} for a diverse, balanced sample.",
            })

        # 2. Adjacent experience level
        exps = cf.get("experience_level", [])
        if len(exps) == 1 and exps[0] in EXP_ORDER:
            idx = EXP_ORDER.index(exps[0])
            if idx < len(EXP_ORDER) - 1:
                nxt = EXP_ORDER[idx + 1]
                cands.append({
                    "label":     f"Add {EXP_LABELS[nxt]} to see salary progression",
                    "filters":   {**cf, "experience_level": [exps[0], nxt]},
                    "rationale": (
                        f"Comparing {EXP_LABELS[exps[0]]} vs {EXP_LABELS[nxt]} "
                        f"shows compensation growth between tiers."
                    ),
                })
            if idx > 0:
                prev = EXP_ORDER[idx - 1]
                cands.append({
                    "label":     f"Include {EXP_LABELS[prev]} for downward comparison",
                    "filters":   {**cf, "experience_level": [prev, exps[0]]},
                    "rationale": f"Shows where {EXP_LABELS[exps[0]]} sits relative to {EXP_LABELS[prev]}.",
                })

        # 3. Remote vs on-site comparison (always multi-value)
        if not cf.get("remote_ratio"):
            cands.append({
                "label":     "Remote vs On-site salary gap",
                "filters":   {**cf, "remote_ratio": [0, 100]},
                "rationale": "Compares fully on-site (0) vs fully remote (100) — reveals remote premium/discount.",
            })

        # 4. Large companies vs small
        if not cf.get("company_size"):
            cands.append({
                "label":     "Compare large vs small companies",
                "filters":   {**cf, "company_size": ["S", "L"]},
                "rationale": "Large enterprises typically pay 15-30% more — direct comparison across size.",
            })

        # 5. Cross-industry (always multiple industries)
        if not cf.get("industry"):
            top4 = self.df["industry"].value_counts().head(4).index.tolist()
            cands.append({
                "label":     f"Top-4 industries: {', '.join(top4)}",
                "filters":   {**cf, "industry": top4},
                "rationale": "Largest industry pools for statistically robust cross-sector comparison.",
            })
        elif len(cf.get("industry", [])) == 1:
            top4 = self.df["industry"].value_counts().head(4).index.tolist()
            cands.append({
                "label":     "Expand to top-4 industries",
                "filters":   {**cf, "industry": top4},
                "rationale": "Adds context by comparing your industry against the top alternatives.",
            })

        # 6. Full-time vs contract
        if not cf.get("employment_type"):
            cands.append({
                "label":     "Full-time vs Contract comparison",
                "filters":   {**cf, "employment_type": ["FT", "CT"]},
                "rationale": "Contractors often earn higher gross salaries — side-by-side shows the gap.",
            })

        # 7. Recent years only
        if not cf.get("work_year"):
            cands.append({
                "label":     "2024–2025 data only",
                "filters":   {**cf, "work_year": [2024, 2025]},
                "rationale": "Focus on the most recent market conditions, filtering out older entries.",
            })

        return cands
