import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Any

class Settings(BaseSettings):
    APP_NAME: str = "AI KYC Service"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = 8000
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PADDLE_OCR_LANG: str = os.getenv("PADDLE_OCR_LANG", "en")
    CONFIDENCE_THRESHOLD: float = 0.5

    @field_validator("PORT", mode="before")
    def parse_port(cls, v: Any) -> int:
        if isinstance(v, str):
            v = v.strip()
            if v.isdigit():
                return int(v)
            return 8000
        if isinstance(v, int):
            return v
        return 8000

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
