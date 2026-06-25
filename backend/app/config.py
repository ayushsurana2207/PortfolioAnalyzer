import functools
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, loaded from environment variables and an optional .env file.

    All settings are designed with sensible defaults to prevent startup crashes.
    """
    LLM_PROVIDER: str = Field(default="gemini", description="Active LLM provider: 'gemini', 'openai', or 'anthropic'")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="API key for Google Gemini API")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="API key for OpenAI API")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="API key for Anthropic Claude API")
    
    # NewsAPI
    NEWS_API_KEY: Optional[str] = Field(default=None, description="API key for NewsAPI")
    
    # Email SMTP Settings
    SMTP_HOST: Optional[str] = Field(default=None, description="SMTP server host (e.g., smtp.gmail.com)")
    SMTP_PORT: int = Field(default=587, description="SMTP server port (usually 587 for TLS)")
    SMTP_USERNAME: Optional[str] = Field(default=None, description="SMTP login username")
    SMTP_PASSWORD: Optional[str] = Field(default=None, description="SMTP login password")
    SMTP_SENDER: Optional[str] = Field(default=None, description="Sender email address for alerts")
    ALERT_RECIPIENT_EMAIL: Optional[str] = Field(default=None, description="Email address to receive alerts")
    
    # Application Configs
    DATABASE_URL: str = Field(default="sqlite:///./portfolio.db", description="Database connection URL")
    FRONTEND_URL: str = Field(default="http://localhost:3000", description="URL of the frontend application for CORS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@functools.lru_cache
def get_settings() -> Settings:
    """Returns a cached instance of the Settings class.

    This ensures environment variables are loaded and validated only once.
    """
    return Settings()
