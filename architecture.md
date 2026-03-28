# Architecture

## Layer Hierarchy

The project follows a strict layered architecture. Dependencies flow **downward only** — a layer may import from layers below it but never from layers above it.

```
┌─────────────┐
│     UI      │  ← Layer 6 (highest)
├─────────────┤
│     API     │  ← Layer 5
├─────────────┤
│   Service   │  ← Layer 4
├─────────────┤
│ Repository  │  ← Layer 3
├─────────────┤
│   Config    │  ← Layer 2
├─────────────┤
│    Types    │  ← Layer 1 (lowest)
└─────────────┘
```

### Layer Definitions

| Layer | Responsibility | May Import From |
|-------|---------------|-----------------|
| Types | Domain models, interfaces, enums, shared type definitions | (none) |
| Config | Environment variables, feature flags, constants, app configuration | Types |
| Repository | Data access, persistence, external data sources | Types, Config |
| Service | Business logic, domain rules, orchestration | Types, Config, Repository |
| API | Route handlers, request/response mapping, middleware, validation | Types, Config, Repository, Service |
| UI | Components, pages, client-side state, rendering | Types, Config, Service, API |

## One-Way Dependency Rule

**Never import from a higher layer.**

Violations:
- A `Service` importing from `API` — FORBIDDEN
- A `Repository` importing from `Service` — FORBIDDEN
- A `Config` importing from `Repository` — FORBIDDEN
- A `Types` importing from any other layer — FORBIDDEN

The `check-architecture` hook enforces this rule on every file save.

## Verification Commands

### Types layer
```bash
# No imports from Config, Repository, Service, API, or UI
grep -rn "from.*config\|from.*repository\|from.*service\|from.*api\|from.*ui" src/types/
```

### Config layer
```bash
# No imports from Repository, Service, API, or UI
grep -rn "from.*repository\|from.*service\|from.*api\|from.*ui" src/config/
```

### Repository layer
```bash
# No imports from Service, API, or UI
grep -rn "from.*service\|from.*api\|from.*ui" src/repository/
```

### Service layer
```bash
# No imports from API or UI
grep -rn "from.*api\|from.*ui" src/service/
```

### API layer
```bash
# No imports from UI
grep -rn "from.*ui" src/api/
```

### Full architecture audit
```bash
# Run the architecture check hook directly
.claude/hooks/check-architecture.sh
```

## Cross-Cutting Concerns

The following concerns span all layers and are handled via shared utilities, not inline in each layer:

| Concern | Implementation |
|---------|---------------|
| **Logging** | Centralized logger (e.g., `src/lib/logger`) — all layers import from `lib`, not from each other |
| **Authentication** | Auth context passed via dependency injection or middleware; never hardcoded per-layer |
| **Telemetry** | Instrumentation via a shared `src/lib/telemetry` module with span/trace helpers |
| **Error Handling** | Typed error classes in `Types`; caught and mapped at `API` boundary; never swallowed silently |

---

## Agentic Architecture Patterns

When `project-manifest.json` → `ai_native.type` is `agentic`, the project includes an agent layer. The architect selects one of these patterns during Round 7.

### Pattern 1: Planner-Executor (recommended default)

The simplest and most testable agentic pattern. One planner decomposes tasks, one or more executors carry them out.

```
                    ┌─────────────┐
                    │    User     │
                    └──────┬──────┘
                           │ request
                           v
                    ┌─────────────┐
                    │   Planner   │  ← Reads request, decomposes into steps
                    │   (LLM)     │    Decides which tools/executors to call
                    └──────┬──────┘
                           │ plan (ordered steps)
                           v
                    ┌─────────────┐
                    │  Executor   │  ← Executes each step via tools
                    │   (LLM)     │    Reports results back to planner
                    └──────┬──────┘
                           │ tool calls
              ┌────────────┼────────────┐
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Tool A   │ │ Tool B   │ │ Tool C   │
        │ (MCP)    │ │ (MCP)    │ │ (MCP)    │
        └──────────┘ └──────────┘ └──────────┘
```

**When to use:** Most agentic apps. Chatbots with tools, copilots, task automation.
**Folder structure:**
```
src/
├── agents/
│   ├── planner.py          # Decomposes user request into steps
│   └── executor.py         # Executes steps via tools
├── tools/
│   ├── __init__.py         # Tool registry
│   ├── database_tool.py    # Query/write database
│   ├── search_tool.py      # Search knowledge base
│   └── api_tool.py         # Call external APIs
├── schemas/
│   ├── plan.py             # Plan schema (steps, dependencies)
│   └── tool_result.py      # Tool call result schema
├── orchestrator.py         # Main loop: plan → execute → evaluate → respond
└── llm_client.py           # LLM provider abstraction (LiteLLM)
```
**Dependency rule:** `tools/` and `schemas/` are at the bottom. `agents/` imports from both. `orchestrator.py` imports from `agents/`. Same one-way rule as the service layer architecture.

### Pattern 2: Router-Specialists (hub-and-spoke)

A router agent classifies the request and delegates to the right specialist. Each specialist has its own tools and prompt.

```
                    ┌─────────────┐
                    │    User     │
                    └──────┬──────┘
                           │
                           v
                    ┌─────────────┐
                    │   Router    │  ← Classifies intent, picks specialist
                    │   (LLM)     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Research │ │ Analysis │ │  Action  │
        │ Agent    │ │ Agent    │ │  Agent   │
        │ (search, │ │ (query,  │ │ (write,  │
        │  browse) │ │  compute)│ │  execute)│
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              v            v            v
           [tools]      [tools]      [tools]
```

**When to use:** Customer support bots, multi-domain assistants, apps where request types are clearly distinct.
**Folder structure:**
```
src/
├── agents/
│   ├── router.py           # Classifies intent, selects specialist
│   ├── research_agent.py   # Specialist: search and summarize
│   ├── analysis_agent.py   # Specialist: data analysis
│   └── action_agent.py     # Specialist: take actions
├── tools/                  # Shared tool registry
├── schemas/                # Shared type definitions
├── orchestrator.py         # Router → specialist → response
└── llm_client.py
```

### Pattern 3: Evaluator Loop (self-correcting)

An agent generates output, an evaluator checks it, and the agent refines based on feedback. Same GAN pattern the forge uses internally.

```
        ┌──────────┐     generate     ┌──────────┐
        │Generator │ ───────────────> │Evaluator │
        │  (LLM)   │ <─────────────── │  (LLM)   │
        └──────────┘    feedback       └──────────┘
              │                              │
              │ (if PASS)                    │ (runs tools to verify)
              v                              v
        ┌──────────┐                   ┌──────────┐
        │  Output  │                   │  Tools   │
        └──────────┘                   └──────────┘
```

**When to use:** Code generation, content creation, data extraction — anywhere output quality matters and can be verified.

### Pattern 4: Pipeline (sequential chain)

Agents run in a fixed sequence, each transforming the output of the previous one. No dynamic routing.

```
  Input → [Agent A] → [Agent B] → [Agent C] → Output
           extract      transform    validate
```

**When to use:** ETL pipelines, document processing, content workflows with fixed steps.

### Choosing a Pattern

| BRD Signal | Pattern | Reason |
|------------|---------|--------|
| "Chatbot with tools" | Planner-Executor | Single agent, multiple tools |
| "Different types of requests" | Router-Specialists | Clean separation by intent |
| "Generate and verify" | Evaluator Loop | Quality-critical output |
| "Fixed processing steps" | Pipeline | Predictable, easy to test |
| "Complex multi-step with decisions" | Planner-Executor + Evaluator | Plan steps, verify results |

### Agent Layer Rules

When agents are present, they sit between the Service layer and the API layer:

```
┌─────────────┐
│     UI      │  ← Layer 7
├─────────────┤
│     API     │  ← Layer 6
├─────────────┤
│   Agents    │  ← Layer 5 (NEW — orchestrator, planner, executor, tools)
├─────────────┤
│   Service   │  ← Layer 4
├─────────────┤
│ Repository  │  ← Layer 3
├─────────────┤
│   Config    │  ← Layer 2
├─────────────┤
│    Types    │  ← Layer 1
└─────────────┘
```

**Rules for the Agent layer:**
- Agents may import from: Types, Config, Repository, Service
- Agents must NOT import from: API, UI
- API calls agents (not the reverse — agents don't know about HTTP)
- Tools are in the Agent layer. They wrap Service/Repository calls with LLM-friendly schemas.
- The `orchestrator.py` is the agent layer's entry point — the API layer calls it.

### LLM Client Abstraction

All agentic projects should use a provider-agnostic LLM client. The architect recommends LiteLLM by default:

```python
# src/llm_client.py — provider-agnostic LLM calls
from litellm import completion

def call_llm(messages: list, model: str = None) -> str:
    """Route to any provider via LiteLLM.
    Model set via LITELLM_MODEL env var or parameter.
    Supports: claude-3, gpt-4, gemini-pro, ollama/*, together_ai/*, etc.
    """
    model = model or os.environ.get("LITELLM_MODEL", "claude-sonnet-4-20250514")
    response = completion(model=model, messages=messages)
    return response.choices[0].message.content
```

This means the generated app works with Claude, GPT, Gemini, or local models without code changes — only the `LITELLM_MODEL` env var changes.

---

## Customization

Layer names, paths, and verification commands can be overridden for non-standard stacks (e.g., monorepos, microservices, full-stack frameworks) via `project-manifest.json` in the project root.

Example override for traditional layers:
```json
{
  "layers": [
    { "name": "domain", "path": "src/domain", "rank": 1 },
    { "name": "application", "path": "src/application", "rank": 2 },
    { "name": "infrastructure", "path": "src/infrastructure", "rank": 3 },
    { "name": "presentation", "path": "src/presentation", "rank": 4 }
  ]
}
```

Example override adding the agent layer:
```json
{
  "layers": [
    { "name": "types", "path": "src/types", "rank": 1 },
    { "name": "config", "path": "src/config", "rank": 2 },
    { "name": "repository", "path": "src/repository", "rank": 3 },
    { "name": "service", "path": "src/service", "rank": 4 },
    { "name": "agents", "path": "src/agents", "rank": 5 },
    { "name": "api", "path": "src/api", "rank": 6 },
    { "name": "ui", "path": "src/ui", "rank": 7 }
  ]
}
```

When `project-manifest.json` is present, the `check-architecture` hook reads layer definitions from it instead of using the defaults above.
