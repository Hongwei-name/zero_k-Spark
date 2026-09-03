"""Typed application settings loaded from the environment."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///data/spark.db"
    log_level: str = "INFO"
    max_daily_recipients: int = 20
    default_dry_run: bool = True


settings = Settings()
