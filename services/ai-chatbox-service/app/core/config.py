from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "postgresql+asyncpg://toeic:toeic@localhost:5432/ai_db"
    REDIS_URL: str = "redis://localhost:7379/0"
    LLM_API_BASE_URL: str = "http://localhost:5000/api"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "default"
    AI_DAILY_MESSAGE_LIMIT: int = 20
    AI_LLM_TIMEOUT_MS: int = 10000
    PORT: int = 8000


settings = Settings()
