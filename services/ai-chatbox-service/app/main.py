from fastapi import FastAPI

from app.api import routes_health, routes_conversations

app = FastAPI(
    title="AI Chatbox/Tutor Service",
    description="AI Tutor service for contextual Q&A about TOEIC content",
    version="0.1.0",
)

app.include_router(routes_health.router, prefix="", tags=["health"])
app.include_router(routes_conversations.router, prefix="/api/v1", tags=["ai"])


@app.get("/")
async def root():
    return {"message": "AI Chatbox/Tutor Service is running"}