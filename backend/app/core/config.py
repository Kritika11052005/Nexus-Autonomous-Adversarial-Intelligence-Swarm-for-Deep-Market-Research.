import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Base Configuration
    ENVIRONMENT: str = "development"
    
    # CORS Configuration
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["http://localhost:3000"]

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # API Credentials
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT_NAME: str = ""
    AZURE_OPENAI_API_VERSION: str = ""
    TAVILY_API_KEY: str = ""

    # Database and Redis URLs
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/nexus"
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Settings
    JWT_SECRET_KEY: str = "placeholder_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Stripe Settings
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
