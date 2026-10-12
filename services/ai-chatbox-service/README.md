# AI Chatbox/Tutor Service

AI Tutor service built with Python FastAPI for the TOEIC Study and Exam System. Provides contextual Q&A about questions, vocabulary, and grammar lessons with conversation persistence, rate limiting, and circuit breaker protection for external LLM calls.

## Requirements

- Python >= 3.11
- PostgreSQL (ai_db)
- Redis

## Development

1. Install dependencies:

```bash
uv sync
```

2. Configure environment variables:

```bash
cp .env.example .env
```

3. Run the service:

```bash
uv run uvicorn app.main:app --reload
```

## API Documentation

Once running, API docs are available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Health Endpoints

- `GET /health` - Basic health check
- `GET /status` - Service status

## Endpoints

- Conversations: `GET/POST/DELETE /api/v1/ai/conversations`
- Messages: `GET/POST /api/v1/ai/conversations/{id}/messages`

## Testing

```bash
uv run pytest
```

## Linting & Type Checking

```bash
uv run ruff check .
uv run ruff format .
uv run mypy app/
```