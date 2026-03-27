# Integration Notes: {API/Service Name}

Last updated: {date}
Projects using this: {list}

## API Overview

- **Purpose:** {what it does}
- **Auth method:** {API key / OAuth / Bearer token}
- **Base URL:** {production URL}
- **Rate limits:** {requests per minute/hour}
- **Docs:** {link to official docs}

## SDK / Client

- **Library:** {package name and version}
- **Install:** {pip install / npm install command}
- **Wrapper location:** {where the wrapper lives in the project, e.g., backend/src/integrations/stripe_client.py}

## Gotchas

1. {What went wrong and how it was fixed}
2. {Another gotcha}

## Patterns That Worked

1. {What approach worked well}
2. {Another pattern}

## Test Fixtures

- **Mock strategy:** {how to stub for unit tests}
- **Record-replay:** {if applicable, how to capture/replay API responses}
- **Sandbox/test mode:** {if the API has a test environment}

## Error Handling

- **Retryable errors:** {which HTTP status codes to retry}
- **Non-retryable:** {which errors to fail fast on}
- **Rate limit handling:** {backoff strategy}
