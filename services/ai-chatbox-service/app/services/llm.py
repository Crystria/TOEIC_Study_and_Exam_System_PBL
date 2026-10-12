from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from app.core.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerError,
    CircuitBreakerTimeoutError,
    circuit_breaker,
)
from app.core.config import settings


class LLMError(Exception):
    pass


class LLMTimeoutError(Exception):
    pass


async def _call_llm_internal(
    messages: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """Internal LLM call implementation."""
    headers = {"Content-Type": "application/json"}
    if settings.LLM_API_KEY:
        headers["Authorization"] = f"Bearer {settings.LLM_API_KEY}"

    payload: dict[str, Any] = {
        "model": settings.LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=settings.AI_LLM_TIMEOUT_MS / 1000) as client:
        response = await client.post(
            f"{settings.LLM_API_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    # Extract content from common LLM API response formats
    # TODO: Handle different API response formats (OpenAI-compatible)
    if "choices" in data and len(data["choices"]) > 0:
        choice = data["choices"][0]
        if "message" in choice and "content" in choice["message"]:
            return str(choice["message"]["content"])
    if "content" in data:
        return str(data["content"])
    if "text" in data:
        return str(data["text"])

    raise LLMError("Invalid LLM response format")


async def call_llm(
    messages: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
    use_circuit_breaker: bool = True,
) -> str:
    """
    Call external LLM with timeout and circuit breaker.
    Returns Markdown content.
    Raises LLMError on failures.
    """
    try:
        if use_circuit_breaker:
            result = await circuit_breaker.call(
                _call_llm_internal, messages, temperature, max_tokens
            )
        else:
            result = await asyncio.wait_for(
                _call_llm_internal(messages, temperature, max_tokens),
                timeout=settings.AI_LLM_TIMEOUT_MS / 1000,
            )
        return str(result)
    except CircuitBreakerTimeoutError:
        raise LLMTimeoutError("LLM request timed out")
    except CircuitBreakerError:
        raise LLMError("Circuit breaker is open")
    except asyncio.TimeoutError:
        raise LLMTimeoutError("LLM request timed out")
    except httpx.HTTPError as e:
        raise LLMError(f"HTTP error calling LLM: {e}")
    except Exception as e:
        raise LLMError(f"LLM call failed: {e}")


def get_fallback_response(context: str | None = None) -> str:
    """Return fallback response when circuit breaker opens or timeout occurs."""
    base_msg = "I'm sorry, but I'm experiencing temporary issues. Please try again later."
    if context:
        return f"{base_msg}\n\nContext: {context[:100]}"  # Truncate for safety
    return base_msg


# TODO: Add retry logic with tenacity if needed