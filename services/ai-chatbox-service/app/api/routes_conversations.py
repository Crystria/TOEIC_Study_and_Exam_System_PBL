from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import RedisClient, get_redis_client
from app.db.models import Conversation, Message, MessageRole
from app.db.session import get_session
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationWithMessages,
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)
from app.services.chat_service import get_or_create_conversation, process_message

router = APIRouter(prefix="/ai")


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    """List all conversations for a user."""
    # TODO: Add pagination
    stmt = select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc())
    result = await session.execute(stmt)
    conversations = result.scalars().all()
    return [
        ConversationResponse(
            id=c.id,
            user_id=c.user_id,
            title=c.title,
            context_question_id=c.context_question_id,
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        )
        for c in conversations
    ]


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conversation_data: ConversationCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new conversation."""
    conv = await get_or_create_conversation(
        session,
        user_id=conversation_data.user_id,
        title=conversation_data.title,
        context_question_id=conversation_data.context_question_id,
    )
    await session.commit()
    await session.refresh(conv)
    return ConversationResponse(
        id=conv.id,
        user_id=conv.user_id,
        title=conv.title,
        context_question_id=conv.context_question_id,
        created_at=conv.created_at.isoformat() if conv.created_at else "",
        updated_at=conv.updated_at.isoformat() if conv.updated_at else "",
    )


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get all messages in a conversation."""
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    result = await session.execute(stmt)
    messages = result.scalars().all()
    return MessageListResponse(
        messages=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role.value if hasattr(m.role, "value") else str(m.role),
                content=m.content,
                token_count=m.token_count,
                created_at=m.created_at.isoformat() if m.created_at else "",
            )
            for m in messages
        ]
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def post_message(
    conversation_id: uuid.UUID,
    message_data: MessageCreate,
    session: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(lambda: None),  # TODO: Wire up Redis dependency properly
):
    """Post a message to a conversation and get AI response."""
    # TODO: Wire up Redis properly with dependency injection
    from app.core.redis import get_redis_client
    from app.core.config import settings

    redis_cli = await get_redis_client(settings.REDIS_URL)
    redis_instance = redis_cli.client

    try:
        assistant_msg, is_fallback, status = await process_message(
            session, redis_instance, message_data, str(conversation_id)
        )
        return assistant_msg
    except ValueError as e:
        await redis_cli.close()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except Exception as e:
        await redis_cli.close()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        await redis_cli.close()


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Delete a conversation."""
    conv = await session.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await session.execute(delete(Conversation).where(Conversation.id == conversation_id))
    await session.commit()
    return {"message": "Conversation deleted successfully"}