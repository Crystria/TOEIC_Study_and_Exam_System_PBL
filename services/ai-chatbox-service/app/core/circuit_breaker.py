from __future__ import annotations

import asyncio
import enum
from collections.abc import Awaitable, Callable
from typing import Any


class CircuitState(str, enum.Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreakerError(Exception):
    pass


class CircuitBreakerTimeoutError(Exception):
    pass


class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        timeout_ms: int = 10000,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.timeout_ms = timeout_ms
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float | None = None

    @property
    def state(self) -> CircuitState:
        return self._state

    async def call(self, func: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any) -> Any:
        if self._state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self._state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerError("Circuit breaker is OPEN")

        try:
            result = await asyncio.wait_for(func(*args, **kwargs), timeout=self.timeout_ms / 1000)
            self._on_success()
            return result
        except asyncio.TimeoutError:
            self._on_failure()
            raise CircuitBreakerTimeoutError("Request timed out after 10 seconds")
        except Exception:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        self._failure_count = 0
        self._state = CircuitState.CLOSED
        self._last_failure_time = None

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = asyncio.get_event_loop().time() if hasattr(asyncio, "get_event_loop") else 0
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN

    def _should_attempt_reset(self) -> bool:
        if self._last_failure_time is None:
            return True
        # Fallback time check
        try:
            current_time = asyncio.get_event_loop().time()
        except Exception:
            return True
        return (current_time - self._last_failure_time) >= self.recovery_timeout


# Simple global circuit breaker instance
# TODO: Make configurable per service
circuit_breaker = CircuitBreaker()