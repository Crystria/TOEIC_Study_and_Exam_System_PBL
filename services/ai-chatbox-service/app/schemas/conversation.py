from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    context_question_id: str | None = Field(default=None, max_length=255)


class ConversationResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    title: str | None
    context_question_id: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1, max_length=1000)
    context: dict[str, Any] | None = Field(default=None)


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    token_count: int | None
    created_at: str


class ConversationWithMessages(BaseModel):
    conversation: ConversationResponse
    messages: list[MessageResponse]


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
