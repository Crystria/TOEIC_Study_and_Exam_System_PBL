from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import RedisClient, get_redis_client
from app.db.session import get_session
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}


@router.get("/status", tags=["health"])
async def status_check():
    return {
        "status": "ok",
        "service": "ai-chatbox-service",
        "version": "0.1.0",
    }