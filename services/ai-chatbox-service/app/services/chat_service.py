from __future__ import annotations

import datetime
import time
from typing import Any

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import check_rate_limit, refund_rate_limit
from app.db.models import (
    AiRequest,
    AiRequestStatus,
    ChatUsage,
    Conversation,
    Message,
    MessageRole,
)
from app.schemas.conversation import MessageCreate, MessageResponse
from app.services.llm import LLMError, LLMTimeoutError, call_llm, get_fallback_response


async def get_or_create_conversation(
    session: AsyncSession,
    user_id: str,
    conversation_id: str | None = None,
    title: str | None = None,
    context_question_id: str | None = None,
) -> Conversation:
    """Get existing conversation or create new one."""
    if conversation_id:
        result = await session.get(Conversation, conversation_id)
        if result and result.user_id == user_id:
            return result
    conv = Conversation(user_id=user_id, title=title, context_question_id=context_question_id)
    session.add(conv)
    await session.flush()
    await session.refresh(conv)
    return conv


async def get_chat_usage(session: AsyncSession, user_id: str) -> ChatUsage | None:
    """Get today's usage for user."""
    today = datetime.date.today()
    stmt = select(ChatUsage).where(ChatUsage.user_id == user_id, ChatUsage.usage_date == today)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def increment_chat_usage(session: AsyncSession, user_id: str) -> ChatUsage:
    """Increment usage count for today."""
    today = datetime.date.today()
    usage = await get_chat_usage(session, user_id)
    if usage is None:
        usage = ChatUsage(user_id=user_id, usage_date=today, used_count=1)
        session.add(usage)
    else:
        usage.used_count += 1
    await session.flush()
    await session.refresh(usage)
    return usage


async def process_message(
    session: AsyncSession,
    redis_client: redis.Redis,
    message_data: MessageCreate,
    conversation_id: str | None = None,
) -> tuple[MessageResponse, bool, str]:
    """
    Orchestrate message processing.
    Returns (assistant_message, is_fallback, ai_request_status).
    """
    user_id = message_data.user_id

    # Check rate limit
    allowed, limit, count = await check_rate_limit(
        redis_client, user_id, settings.AI_DAILY_MESSAGE_LIMIT
    )
    if not allowed:
        raise ValueError("Daily message limit exceeded")

    # Get or create conversation
    conv = await get_or_create_conversation(
        session,
        user_id,
        conversation_id=conversation_id,
        title=message_data.context.get("title") if message_data.context else None,
        context_question_id=str(message_data.context.get("question_id")) if message_data.context and message_data.context.get("question_id") else None,
    )

    # Save user message
    user_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=message_data.content,
        token_count=None,
    )
    session.add(user_msg)

    # Build context messages
    # TODO: Fetch conversation history for better context
    messages = [
        {"role": "system", "content": build_system_prompt(message_data.context)},
        {"role": "user", "content": message_data.content},
    ]

    start_time = time.time()
    is_fallback = False
    ai_request_status = AiRequestStatus.SUCCESS
    assistant_content = ""

    try:
        assistant_content = await call_llm(messages)
    except LLMTimeoutError:
        ai_request_status = AiRequestStatus.TIMEOUT
        is_fallback = True
        assistant_content = get_fallback_response(str(message_data.context) if message_data.context else None)
        # Refund quota when using fallback (per ADR)
        await refund_rate_limit(redis_client, user_id)
    except LLMError:
        ai_request_status = AiRequestStatus.FALLBACK
        is_fallback = True
        assistant_content = get_fallback_response(str(message_data.context) if message_data.context else None)
        # Refund quota when using fallback (per ADR)
        await refund_rate_limit(redis_client, user_id)

    latency_ms = int((time.time() - start_time) * 1000)

    # Save assistant message
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=assistant_content,
        token_count=None,  # TODO: Calculate token count if needed
    )
    session.add(assistant_msg)

    # Update usage
    await increment_chat_usage(session, user_id)

    # Save AI request log
    ai_request = AiRequest(
        conversation_id=conv.id,
        status=ai_request_status,
        latency_ms=latency_ms,
        model_name=settings.LLM_MODEL,
        error_code=None,
    )
    session.add(ai_request)

    await session.commit()
    await session.refresh(assistant_msg)

    return (
        MessageResponse(
            id=assistant_msg.id,
            conversation_id=assistant_msg.conversation_id,
            role=assistant_msg.role.value if hasattr(assistant_msg.role, "value") else str(assistant_msg.role),
            content=assistant_msg.content,
            token_count=assistant_msg.token_count,
            created_at=assistant_msg.created_at.isoformat() if assistant_msg.created_at else "",
        ),
        is_fallback,
        ai_request_status.value,
    )


def build_system_prompt(context: dict[str, Any] | None) -> str:
    """Build system prompt for LLM based on context."""
    base_prompt = "You are an AI Tutor for TOEIC preparation. Provide helpful, accurate, and contextual answers."
    if context:
        if context.get("question_id"):
            base_prompt += f" Context: Question ID {context['question_id']}. Focus on explaining this specific question."
        if context.get("vocabulary"):
            base_prompt += f" Context: Vocabulary topic - {context['vocabulary']}."
        if context.get("grammar"):
            base_prompt += f" Context: Grammar topic - {context['grammar']}."
    return base_prompt

# TODO: Add conversation history retrieval
# TODO: Handle quota refund more precisely in all failure cases per ADR