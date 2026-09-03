"""Minimal management API entry point."""

from fastapi import FastAPI

from packages.core.settings import settings

app = FastAPI(title="zero_k-Spark", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "default_dry_run": settings.default_dry_run,
    }
