import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"
DATA_FILE = DATA_DIR / "salary_data.csv"


def _try_kaggle() -> bool:
    try:
        r = subprocess.run(
            [
                "kaggle", "datasets", "download",
                "-d", "bismasajjad/global-ai-job-market-and-salary-trends-2025",
                "--path", str(DATA_DIR), "--unzip", "-q",
            ],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0:
            return False
        for csv in DATA_DIR.glob("*.csv"):
            if csv != DATA_FILE:
                csv.rename(DATA_FILE)
        return DATA_FILE.exists()
    except Exception:
        return False


def _generate(n: int = 15001, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    JOB_TITLES = [
        "Machine Learning Engineer", "Data Scientist", "AI Research Scientist",
        "Deep Learning Engineer", "NLP Engineer", "Computer Vision Engineer",
        "MLOps Engineer", "Data Engineer", "AI Product Manager",
        "Research Engineer", "Applied Scientist", "AI Architect",
        "Robotics Engineer", "Autonomous Systems Engineer", "AI Ethics Researcher",
        "Quantitative Analyst", "Data Analyst", "BI Engineer",
        "AI Solutions Architect", "Principal Scientist",
    ]
    JOB_CAT = {
        "Machine Learning Engineer": "ML Engineering", "Data Scientist": "Data Science",
        "AI Research Scientist": "AI Research", "Deep Learning Engineer": "ML Engineering",
        "NLP Engineer": "ML Engineering", "Computer Vision Engineer": "ML Engineering",
        "MLOps Engineer": "MLOps", "Data Engineer": "Data Engineering",
        "AI Product Manager": "Product Management", "Research Engineer": "AI Research",
        "Applied Scientist": "AI Research", "AI Architect": "ML Engineering",
        "Robotics Engineer": "Robotics", "Autonomous Systems Engineer": "Robotics",
        "AI Ethics Researcher": "AI Research", "Quantitative Analyst": "Data Science",
        "Data Analyst": "Data Science", "BI Engineer": "Data Engineering",
        "AI Solutions Architect": "ML Engineering", "Principal Scientist": "AI Research",
    }
    LOCS = [
        ("US", "USD", 1.000, 0.42), ("GB", "GBP", 1.270, 0.10),
        ("DE", "EUR", 1.080, 0.08), ("CA", "CAD", 0.740, 0.07),
        ("AU", "AUD", 0.650, 0.05), ("IN", "INR", 0.012, 0.08),
        ("FR", "EUR", 1.080, 0.04), ("NL", "EUR", 1.080, 0.03),
        ("SG", "SGD", 0.740, 0.03), ("CH", "CHF", 1.130, 0.03),
        ("BR", "BRL", 0.200, 0.02), ("JP", "JPY", 0.007, 0.02),
        ("ES", "EUR", 1.080, 0.015), ("PL", "PLN", 0.250, 0.010),
        ("SW", "SEK", 0.095, 0.010),
    ]
    loc_codes = [r[0] for r in LOCS]
    loc_curr  = {r[0]: r[1] for r in LOCS}
    loc_rate  = {r[0]: r[2] for r in LOCS}
    loc_mult  = {"US":1.00,"GB":0.85,"DE":0.78,"CA":0.80,"AU":0.72,"IN":0.30,
                 "FR":0.75,"NL":0.82,"SG":0.88,"CH":1.15,"BR":0.28,"JP":0.65,
                 "ES":0.60,"PL":0.40,"SW":0.80}
    loc_p = np.array([r[3] for r in LOCS]); loc_p /= loc_p.sum()
    INDUSTRIES = ["Technology","Finance","Healthcare","E-commerce","Automotive",
                  "Media & Entertainment","Education","Government","Consulting",
                  "Telecommunications","Energy","Retail","Manufacturing","Real Estate"]
    SKILLS = ["Python","TensorFlow","PyTorch","Scikit-learn","SQL","Spark",
              "Kubernetes","Docker","MLflow","Airflow","NLP","Computer Vision",
              "Reinforcement Learning","LLMs","AWS","GCP","Azure","R","Scala",
              "C++","Transformers","RAG","Statistics","A/B Testing",
              "Feature Engineering","Data Pipelines","Fine-tuning"]
    EDU = ["High School","Bachelor's","Master's","PhD"]
    edu_p = np.array([0.05,0.40,0.40,0.15])
    exp_levels = ["EN","MI","SE","EX"]
    exp_p = np.array([0.20,0.35,0.30,0.15])
    sal_range = {"EN":(55000,85000),"MI":(85000,135000),"SE":(130000,200000),"EX":(175000,320000)}
    yrs_range = {"EN":(0,3),"MI":(3,6),"SE":(6,11),"EX":(11,21)}
    emp_types = ["FT","PT","CT","FL"]
    emp_p = np.array([0.75,0.05,0.15,0.05])
    sizes = ["S","M","L"]
    size_p = np.array([0.25,0.40,0.35])
    size_ben = {"S":5.0,"M":6.5,"L":8.0}
    remote_opts = [0,50,100]
    remote_p = np.array([0.35,0.25,0.40])
    years = [2022,2023,2024,2025]
    year_p = np.array([0.10,0.25,0.40,0.25])

    exp_arr    = rng.choice(exp_levels,  n, p=exp_p)
    emp_arr    = rng.choice(emp_types,   n, p=emp_p)
    loc_arr    = rng.choice(loc_codes,   n, p=loc_p)
    size_arr   = rng.choice(sizes,       n, p=size_p)
    edu_arr    = rng.choice(EDU,         n, p=edu_p)
    remote_arr = rng.choice(remote_opts, n, p=remote_p)
    ind_arr    = rng.choice(INDUSTRIES,  n)
    job_arr    = rng.choice(JOB_TITLES,  n)
    year_arr   = rng.choice(years,       n, p=year_p)

    sal_usd = np.array([
        int(rng.integers(*sal_range[e]) * loc_mult[l] * rng.uniform(0.9, 1.1))
        for e, l in zip(exp_arr, loc_arr)
    ])
    currency  = [loc_curr[l] for l in loc_arr]
    sal_local = np.array([
        int(sal_usd[i] / loc_rate[loc_arr[i]]) if loc_rate[loc_arr[i]] > 0 else sal_usd[i]
        for i in range(n)
    ])
    benefits = np.array([
        round(min(10.0, max(1.0, size_ben[s] + float(rng.normal(0, 1)))), 1)
        for s in size_arr
    ])
    yrs_exp = np.array([int(rng.integers(yrs_range[e][0], yrs_range[e][1])) for e in exp_arr])
    skills_list = [", ".join(rng.choice(SKILLS, int(rng.integers(3, 7)), replace=False)) for _ in range(n)]
    residence = [rng.choice(loc_codes, p=loc_p) if rng.random() < 0.10 else loc_arr[i] for i in range(n)]
    base_date = pd.Timestamp("2022-01-01")
    dates = [(base_date + pd.to_timedelta(int(d), "D")).strftime("%Y-%m-%d") for d in rng.integers(0, 1200, n)]

    return pd.DataFrame({
        "job_id":             [f"JOB{i+1:05d}" for i in range(n)],
        "work_year":          year_arr, "job_title": job_arr,
        "job_category":       [JOB_CAT[t] for t in job_arr],
        "experience_level":   exp_arr, "employment_type": emp_arr,
        "company_size":       size_arr, "company_location": loc_arr,
        "employee_residence": residence, "remote_ratio": remote_arr,
        "education_required": edu_arr, "skills_required": skills_list,
        "industry":           ind_arr, "salary_currency": currency,
        "salary_local":       sal_local, "salary_usd": sal_usd,
        "years_experience":   yrs_exp, "benefits_score": benefits,
        "posting_date":       dates,
        "hiring_status":      rng.choice(["Active","Filled"], n, p=[0.30,0.70]),
    })


def load_or_create_dataset() -> pd.DataFrame:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_FILE.exists():
        return pd.read_csv(DATA_FILE)
    if _try_kaggle() and DATA_FILE.exists():
        return pd.read_csv(DATA_FILE)
    df = _generate(15001)
    df.to_csv(DATA_FILE, index=False)
    return df
