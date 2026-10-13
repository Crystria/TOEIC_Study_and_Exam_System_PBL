from __future__ import annotations

from fastapi import APIRouter

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
