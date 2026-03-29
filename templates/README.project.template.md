# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | {{BACKEND_FRAMEWORK}} ({{BACKEND_LANGUAGE}} {{BACKEND_VERSION}}) |
| Frontend | {{FRONTEND_FRAMEWORK}} + {{FRONTEND_STYLING}} |
| Database | {{DATABASE_ENGINE}} {{DATABASE_VERSION}} |
| Auth | {{AUTH_METHOD}} |
| Deployment | {{DEPLOYMENT_METHOD}} |
{{#IF_AGENTIC}}
| Agent Framework | {{AGENT_FRAMEWORK}} |
| Agent LLM | {{AGENT_LLM}} |
{{/IF_AGENTIC}}
{{#IF_ML}}
| ML | {{ML_FRAMEWORK}} |
| Explainability | {{ML_EXPLAINABILITY}} |
{{/IF_ML}}

## Quick Start

```bash
# Install everything
make install

# Start development servers
make dev

# Run tests
make test

# Run linting
make lint
```

## Development Setup

### Prerequisites

- Python {{BACKEND_VERSION}}+
- Node.js 20+
- Docker + Docker Compose
- Make

### First Time Setup

```bash
# Clone and enter project
git clone {{REPO_URL}}
cd {{PROJECT_SLUG}}

# Install all dependencies (backend + frontend)
make install

# Start database
make docker-up

# Run migrations
make migrate

# Seed initial data (admin user, sample data)
make seed

# Start development servers (backend + frontend)
make dev
```

### Running Tests

```bash
make test           # Run all tests
make test-backend   # Backend only (pytest)
make test-frontend  # Frontend only (vitest)
make test-coverage  # With coverage report
make test-watch     # Watch mode
```

### Linting & Type Checking

```bash
make lint           # Run all linters
make lint-fix       # Auto-fix where possible
make typecheck      # mypy + tsc
```

## API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/api/v1/health

## Architecture

{{ARCHITECTURE_SUMMARY}}

```
{{LAYER_DIAGRAM}}
```

See `specs/design/architecture.md` for full architecture documentation.

## Project Structure

```
{{FOLDER_STRUCTURE_SUMMARY}}
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Key variables:
{{ENV_VARS_TABLE}}

{{#IF_AGENTIC}}
## Agents

{{AGENT_DESCRIPTIONS}}

{{/IF_AGENTIC}}
## Contributing

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes following the architecture rules in `.claude/architecture.md`
3. Run tests: `make test`
4. Run linting: `make lint`
5. Commit: `git commit -m "feat: description"`
6. Push and create PR

## License

{{LICENSE}}
