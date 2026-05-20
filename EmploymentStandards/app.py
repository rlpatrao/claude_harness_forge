from __future__ import annotations

import json
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

st.markdown(
    """
    <style>
    .stChatMessage { margin-bottom: 4px; }
    .sug-label { font-weight: 600; font-size: 0.92rem; margin-bottom: 2px; }
    .sug-preview { font-size: 0.78rem; color: #888; margin-bottom: 4px; }
    .sug-rationale { font-size: 0.76rem; color: #aaa; }
    .filter-strip { font-size: 0.75rem; color: #666; margin-top: 4px; }
    .filter-badge {
        display: inline-block;
        background: #1a3a5c;
        color: #90caf9;
        border-radius: 10px;
        padding: 1px 8px;
        margin: 1px 3px 1px 0;
        font-size: 0.72rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
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


# ── Dataset (cached across reruns) ────────────────────────────────────────
@st.cache_resource(show_spinner="Loading dataset — first run generates 15,001 rows…")
def _load_ds() -> SalaryDataset:
    return SalaryDataset(load_or_create_dataset())


ds = _load_ds()

# ── Per-session state ──────────────────────────────────────────────────────
if "agent" not in st.session_state:
    st.session_state.agent = SalaryAgent(ds)
if "messages" not in st.session_state:
    st.session_state.messages: list[dict] = []
if "pending" not in st.session_state:
    st.session_state.pending: str | None = None

agent: SalaryAgent = st.session_state.agent


# ── Helpers ────────────────────────────────────────────────────────────────

def _filter_badges_html(filters: dict) -> str:
    active = {
        k: v for k, v in filters.items()
        if v is not None and v != [] and v != ""
    }
    if not active:
        return ""
    badges = ""
    for k, v in active.items():
        label = ", ".join(str(x) for x in v) if isinstance(v, list) else str(v)
        badges += f'<span class="filter-badge">{k}: {label}</span>'
    return f'<div class="filter-strip">Filters applied: {badges}</div>'


def _render_suggestion_cards(suggestions: list[dict], key_prefix: str) -> None:
    if not suggestions:
        return
    st.markdown("**Explore these cuts of the data:**")
    cols = st.columns(len(suggestions))
    for j, (col, sug) in enumerate(zip(cols, suggestions)):
        with col:
            with st.container(border=True):
                st.markdown(
                    f'<div class="sug-label">{sug["label"]}</div>',
                    unsafe_allow_html=True,
                )
                preview_parts = []
                if sug.get("preview_count") is not None:
                    preview_parts.append(f'{sug["preview_count"]:,} rows')
                if sug.get("preview_median_usd") is not None:
                    preview_parts.append(f'median ${sug["preview_median_usd"]:,}')
                if preview_parts:
                    st.markdown(
                        f'<div class="sug-preview">{" · ".join(preview_parts)}</div>',
                        unsafe_allow_html=True,
                    )
                if sug.get("rationale"):
                    st.markdown(
                        f'<div class="sug-rationale">{sug["rationale"]}</div>',
                        unsafe_allow_html=True,
                    )
                if st.button(
                    "Apply →",
                    key=f"{key_prefix}_{j}",
                    use_container_width=True,
                ):
                    st.session_state.pending = (
                        f"Apply these filters and show me the salary analysis. "
                        f"filters={json.dumps(sug['filters'])}  "
                        f"Context: {sug.get('rationale', sug['label'])}"
                    )
                    st.rerun()


# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Dataset")
    c1, c2 = st.columns(2)
    c1.metric("Records", f"{len(ds.df):,}")
    c2.metric("Columns", len(ds.df.columns))

    with st.expander("All columns"):
        st.caption(", ".join(ds.df.columns.tolist()))

    with st.expander("Available filter values"):
        for col, vals in list(ds.options.items())[:7]:
            short = [str(v) for v in vals[:6]]
            st.markdown(
                f"**{col}:** {', '.join(short)}" + (" …" if len(vals) > 6 else "")
            )

    st.markdown("---")
    st.subheader("Sample questions")
    SAMPLES = [
        "Median salary for Senior ML engineers in the US?",
        "How does remote work affect AI salaries?",
        "Finance vs Technology industry pay — compare them",
        "Entry-level Data Scientists in Europe",
        "Which job category pays most at large companies?",
        "PhD vs Master's education premium in AI roles?",
        "Top-paying industries for contract workers?",
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


# ── Main chat area ─────────────────────────────────────────────────────────
st.title("AI Job Salary Explorer 💼")
st.caption(
    "Claude agent · Global AI Job Market & Salary Trends 2025 dataset · "
    "Suggestions derived from actual data distribution · Guardrail: ≥ 3 rows"
)
st.divider()

for i, msg in enumerate(st.session_state.messages):
    is_last = i == len(st.session_state.messages) - 1

    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

        if msg["role"] == "assistant":
            if msg.get("filters"):
                badges_html = _filter_badges_html(msg["filters"])
                if badges_html:
                    st.markdown(badges_html, unsafe_allow_html=True)

            if is_last and msg.get("suggestions"):
                st.markdown("")
                _render_suggestion_cards(msg["suggestions"], key_prefix=f"hist_{i}")


# ── Input handling ─────────────────────────────────────────────────────────
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

        turn_filters     = agent.last_filters.copy()
        turn_suggestions = agent.last_suggestions.copy()

        if turn_filters:
            badges_html = _filter_badges_html(turn_filters)
            if badges_html:
                st.markdown(badges_html, unsafe_allow_html=True)

        if turn_suggestions:
            st.markdown("")
            _render_suggestion_cards(
                turn_suggestions,
                key_prefix=f"new_{len(st.session_state.messages)}",
            )

    st.session_state.messages.append({
        "role":        "assistant",
        "content":     reply,
        "filters":     turn_filters,
        "suggestions": turn_suggestions,
    })
    st.rerun()
