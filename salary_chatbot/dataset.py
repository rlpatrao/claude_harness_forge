from __future__ import annotations

import json
from typing import Any

import pandas as pd

_KEY_DIMS = [
    "experience_level", "company_location", "industry",
    "employment_type", "company_size", "remote_ratio",
    "education_required", "job_category", "work_year",
]


class SalaryDataset:
    MIN_ROWS_HARD  = 3    # guardrail: never output stats on fewer rows
    MIN_ROWS_WARN  = 15   # soft warning
    SKEW_THRESHOLD = 0.85 # flag when one value dominates this fraction

    def __init__(self, df: pd.DataFrame) -> None:
        self.df = df
        self.options: dict[str, list] = self._build_options()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def query(self, filters: dict) -> dict[str, Any]:
        df      = self._apply_filters(filters)
        balance = self._balance(df)
        stats   = self._stats(df)
        return {"stats": stats, "balance": balance, "row_count": len(df)}

    def suggest_alternatives(self, current_filters: dict, n: int = 3) -> list[dict]:
        """Data-driven suggestions: every candidate is derived from the actual
        distribution of the current filtered subset, not from hardcoded rules."""
        base_df = self._apply_filters(current_filters)

        if len(base_df) < self.MIN_ROWS_HARD:
            return []

        unfiltered = [d for d in _KEY_DIMS if not current_filters.get(d) and d in self.df.columns]
        active     = [d for d in _KEY_DIMS if current_filters.get(d)     and d in self.df.columns]
        candidates: list[dict] = []

        # ── Strategy 1: highest salary-spread dimension ──────────────────
        # Finds the unfiltered dimension that discriminates salary the most
        # within the current result, and suggests top-N groups from that dim.
        spread_rank: list[tuple[float, str, pd.DataFrame]] = []
        for dim in unfiltered:
            grp = (
                base_df.groupby(dim)["salary_usd"]
                .agg(cnt="count", med="median")
                .query(f"cnt >= {self.MIN_ROWS_HARD}")
            )
            if len(grp) < 2:
                continue
            lo = float(grp["med"].min())
            hi = float(grp["med"].max())
            spread = hi / lo if lo > 0 else 1.0
            spread_rank.append((spread, dim, grp))

        spread_rank.sort(reverse=True)

        for spread, dim, grp in spread_rank[:2]:
            top_vals = (
                grp.sort_values("cnt", ascending=False).head(4).index.tolist()
            )
            f2  = {**current_filters, dim: top_vals}
            df2 = self._apply_filters(f2)
            if len(df2) < self.MIN_ROWS_HARD:
                continue
            high_val = grp["med"].idxmax()
            low_val  = grp["med"].idxmin()
            candidates.append({
                "label":              f"Break down by {dim}",
                "filters":            f2,
                "rationale":          (
                    f"'{dim}' spans {spread:.1f}× salary range in your current data "
                    f"('{high_val}' is highest, '{low_val}' is lowest)."
                ),
                "preview_count":      len(df2),
                "preview_median_usd": int(df2["salary_usd"].median()),
            })

        # ── Strategy 2: relax the most restrictive active filter ─────────
        # Only fires when the current result is small (< 50 rows).
        if len(base_df) < 50 and active:
            relax_rank: list[tuple[int, str, dict, pd.DataFrame]] = []
            for dim in active:
                rf  = {k: v for k, v in current_filters.items() if k != dim}
                df2 = self._apply_filters(rf)
                gain = len(df2) - len(base_df)
                if len(df2) >= self.MIN_ROWS_HARD and gain > 0:
                    relax_rank.append((gain, dim, rf, df2))
            relax_rank.sort(reverse=True)
            if relax_rank:
                gain, dim, rf, df2 = relax_rank[0]
                candidates.append({
                    "label":              f"Remove '{dim}' filter  (+{gain} rows)",
                    "filters":            rf,
                    "rationale":          (
                        f"Dropping the {dim} filter expands your result "
                        f"from {len(base_df)} → {len(df2)} rows."
                    ),
                    "preview_count":      len(df2),
                    "preview_median_usd": int(df2["salary_usd"].median()),
                })

        # ── Strategy 3: head-to-head comparison on most populated dim ────
        # Picks the first unfiltered dim where top-2 values each have
        # enough rows, and offers a direct side-by-side.
        for dim in unfiltered:
            vc    = base_df[dim].value_counts()
            valid = [v for v in vc.index if vc[v] >= self.MIN_ROWS_HARD]
            if len(valid) < 2:
                continue
            top2 = valid[:2]
            f2   = {**current_filters, dim: top2}
            df2  = self._apply_filters(f2)
            if len(df2) < self.MIN_ROWS_HARD:
                continue
            is_dup = any(c["filters"] == f2 for c in candidates)
            if not is_dup:
                candidates.append({
                    "label":              f"Compare {dim}: '{top2[0]}' vs '{top2[1]}'",
                    "filters":            f2,
                    "rationale":          (
                        f"Top 2 values in {dim} within your current data: "
                        f"{vc[top2[0]]} vs {vc[top2[1]]} rows."
                    ),
                    "preview_count":      len(df2),
                    "preview_median_usd": int(df2["salary_usd"].median()),
                })
            break

        # ── Strategy 4: temporal zoom ────────────────────────────────────
        # Suggest the two most recent years if year isn't already filtered.
        if not current_filters.get("work_year") and "work_year" in self.df.columns:
            recent = sorted(self.df["work_year"].unique())[-2:]
            f2  = {**current_filters, "work_year": list(recent)}
            df2 = self._apply_filters(f2)
            if len(df2) >= self.MIN_ROWS_HARD:
                is_dup = any(c["filters"] == f2 for c in candidates)
                if not is_dup:
                    candidates.append({
                        "label":              f"Recent data only ({', '.join(str(y) for y in recent)})",
                        "filters":            f2,
                        "rationale":          (
                            f"Narrowing to {recent[0]}–{recent[1]} reflects "
                            f"current market conditions ({len(df2)} rows)."
                        ),
                        "preview_count":      len(df2),
                        "preview_median_usd": int(df2["salary_usd"].median()),
                    })

        # ── Strategy 5: top-paying sub-slice ─────────────────────────────
        # If salary_min not set, suggest a top-quartile cut from the data.
        if not current_filters.get("salary_min") and len(base_df) >= 10:
            p75 = int(base_df["salary_usd"].quantile(0.75))
            f2  = {**current_filters, "salary_min": p75}
            df2 = self._apply_filters(f2)
            if len(df2) >= self.MIN_ROWS_HARD:
                is_dup = any(c["filters"] == f2 for c in candidates)
                if not is_dup:
                    candidates.append({
                        "label":              f"Top-quartile salaries (≥ ${p75:,})",
                        "filters":            f2,
                        "rationale":          (
                            f"Filters to the top 25% earners in your current slice "
                            f"(salary ≥ ${p75:,} USD, {len(df2)} rows)."
                        ),
                        "preview_count":      len(df2),
                        "preview_median_usd": int(df2["salary_usd"].median()),
                    })

        # Deduplicate and return
        seen: set[str] = set()
        out:  list[dict] = []
        for c in candidates:
            key = json.dumps(c["filters"], sort_keys=True, default=str)
            cf_key = json.dumps(current_filters, sort_keys=True, default=str)
            if key != cf_key and key not in seen:
                seen.add(key)
                out.append(c)
            if len(out) >= n:
                break
        return out

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _apply_filters(self, filters: dict) -> pd.DataFrame:
        df = self.df.copy()
        for col in _KEY_DIMS:
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
        return df

    def _balance(self, df: pd.DataFrame) -> dict:
        n        = len(df)
        warnings: list[str] = []

        if n < self.MIN_ROWS_HARD:
            warnings.append(
                f"Guardrail: only {n} row(s) match — "
                f"minimum {self.MIN_ROWS_HARD} required to produce any output."
            )
        elif n < self.MIN_ROWS_WARN:
            warnings.append(f"Only {n} rows — interpret results with caution.")

        check = {
            "company_location": "geographic location",
            "experience_level": "experience level",
            "industry":         "industry",
            "employment_type":  "employment type",
        }
        for col, label in check.items():
            if col not in df.columns or n == 0:
                continue
            vc = df[col].value_counts(normalize=True)
            if len(vc) == 1:
                warnings.append(
                    f"Single-source: all {n} rows share {label} '{vc.index[0]}'."
                )
            elif vc.iloc[0] > self.SKEW_THRESHOLD:
                warnings.append(
                    f"{vc.iloc[0]*100:.0f}% of rows are {label} "
                    f"'{vc.index[0]}' — data is skewed on this dimension."
                )

        return {"warnings": warnings, "balanced": len(warnings) == 0, "n": n}

    def _stats(self, df: pd.DataFrame) -> dict:
        if len(df) < self.MIN_ROWS_HARD:
            return {
                "error": (
                    f"Only {len(df)} row(s) match — guardrail blocks output "
                    f"below {self.MIN_ROWS_HARD} rows."
                )
            }

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

    def _build_options(self) -> dict[str, list]:
        out: dict[str, list] = {}
        categorical = [
            "experience_level", "employment_type", "company_size",
            "company_location", "employee_residence", "industry",
            "education_required", "job_category", "hiring_status",
        ]
        for col in categorical:
            if col in self.df.columns:
                out[col] = sorted(self.df[col].dropna().unique().tolist())
        for col in ("job_title", "remote_ratio", "work_year"):
            if col in self.df.columns:
                out[col] = sorted(self.df[col].dropna().unique().tolist())
        return out
