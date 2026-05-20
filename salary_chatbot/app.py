from __future__ import annotations

import os

import streamlit as st

from agent import SalaryAgent
from data_loader import load_or_create_dataset
from dataset import SalaryDataset

st.set_page_config(
    page_title="AI Salary Explorer",
    page_icon="💼",
    layout="wide",
)

# ── API key ────────────────────────────────────────────────────────────────
_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
if not _api_key:
    with st.sidebar:
        _api_key = st.text_input("Anthropic API key", type="password", key="apikey_input")
    if not _api_key:
        st.info("Enter your Anthropic API key in the sidebar to get started.")
        st.stop()
os.environ["ANTHROPIC_API_KEY"] = _api_key


# ── Dataset (cached once per process) ─────────────────────────────────────
@st.cache_resource(show_spinner="Loading dataset — first run generates 15 001 rows…")
def _load_dataset() -> SalaryDataset:
    return SalaryDataset(load_or_create_dataset())


ds = _load_dataset()

# ── Agent (one per browser session) ───────────────────────────────────────
if "agent" not in st.session_state:
    st.session_state.agent: SalaryAgent = SalaryAgent(ds)
if "messages" not in st.session_state:
    st.session_state.messages: list[dict] = []
if "pending" not in st.session_state:
    st.session_state.pending: str | None = None

agent: SalaryAgent = st.session_state.agent

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Dataset snapshot")
    c1, c2 = st.columns(2)
    c1.metric("Records", f"{len(ds.df):,}")
    c2.metric("Columns", len(ds.df.columns))

    with st.expander("Columns"):
        st.write(", ".join(ds.df.columns.tolist()))

    with st.expander("Filter options (summary)"):
        for col, vals in list(ds.options.items())[:6]:
            st.markdown(f"**{col}:** {', '.join(str(v) for v in vals[:8])}"
                        + (" …" if len(vals) > 8 else ""))

    st.markdown("---")
    st.subheader("Sample questions")
    SAMPLES = [
        "What's the median salary for Senior ML engineers in the US?",
        "How does remote work affect AI salaries globally?",
        "Compare Finance vs Technology industry compensation",
        "Entry-level Data Scientists in Europe — salary range?",
        "Which job category pays most at large companies?",
        "PhD vs Master's — does education premium exist in AI?",
    ]
    for q in SAMPLES:
        if st.button(q, use_container_width=True):
            st.session_state.pending = q
            st.rerun()

    st.markdown("---")
    if st.button("Clear conversation", use_container_width=True):
        st.session_state.messages = []
        agent.reset()
        st.rerun()

# ── Main ───────────────────────────────────────────────────────────────────
st.title("AI Job Salary Explorer 💼")
st.caption(
    "Backed by a Claude agent that dynamically filters the *Global AI Job Market & "
    "Salary Trends 2025* dataset, checks balance, and suggests alternative lenses."
)

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

prompt: str | None = st.chat_input("Ask about AI/ML job salaries…")

if st.session_state.pending:
    prompt = st.session_state.pending
    st.session_state.pending = None

if prompt:
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Querying dataset…"):
            reply = agent.chat(prompt)
        st.markdown(reply)

    st.session_state.messages.append({"role": "assistant", "content": reply})
    st.rerun()
