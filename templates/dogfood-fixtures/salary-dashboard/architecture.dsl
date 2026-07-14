workspace "SalaryDashboard" {

    model {
        seeker = person "Job Seeker" "Individual exploring salary data before applying, negotiating, or relocating."

        dol = softwareSystem "US DOL OFLC" "Quarterly H1B/LCA disclosure CSV — the authoritative public wage dataset."

        anthropic = softwareSystem "Anthropic API" "Claude LLM used by the chatbot for natural-language query understanding + tool-call orchestration."

        openai = softwareSystem "OpenAI API" "Failover LLM provider via LiteLLM when Anthropic is rate-limited."

        dash = softwareSystem "SalaryDashboard" "Public salary explorer + natural-language Q&A chatbot backed by real LCA disclosures." {

            web = container "Web" "Next.js 14 app — filter drawer, distribution charts, comparison view, chatbot drawer." "Next.js 14 / Tailwind / Recharts"

            api = container "API" "FastAPI backend serving the Next.js static bundle + JSON endpoints for filters, distributions, and chatbot tool calls." "FastAPI / Python 3.12"

            db = container "Salary DB" "DuckDB file with disclosures + materialized percentile views. Loaded in-process by the API on boot." "DuckDB (in-process)"

            llm_proxy = container "LLM Proxy" "LiteLLM router with tool-call schema for query_wage_distribution / compare_locations / search_employers. Routes to Anthropic by default; OpenAI failover." "LiteLLM"

            etl = container "ETL Cron" "Quarterly job: fetches DOL LCA CSV, cleans, normalizes wages to annual, computes materialized views, writes new DuckDB file." "Python cron"
        }

        seeker -> web "browses / asks questions" "HTTPS"
        web -> api "REST + SSE streaming" "HTTPS/JSON"
        api -> db "SQL over in-process DuckDB" "duckdb-python"
        api -> llm_proxy "chat completions with tool schemas" "HTTP JSON"
        llm_proxy -> anthropic "primary LLM call" "HTTPS"
        llm_proxy -> openai "failover on rate-limit / outage" "HTTPS"
        llm_proxy -> api "tool-call responses (query_wage_distribution / compare_locations)" "HTTP JSON"
        etl -> dol "quarterly CSV fetch" "HTTPS"
        etl -> db "publishes new .duckdb file" "filesystem"
    }

    views {
        systemContext dash {
            include *
            autoLayout
        }
        container dash {
            include *
            autoLayout
        }
    }
}
