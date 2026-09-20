import os
from datetime import timedelta


class Config:
    """Base Flask configuration for FarmSphere AI."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # SQLite by default for local development; point DATABASE_URL at Postgres in production.
    # e.g. postgresql://user:password@localhost:5432/farmsphere
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(os.path.dirname(os.path.dirname(__file__)), "farmsphere.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Optional: enables real LLM-backed responses for the assistant and
    # disease-detection endpoints. Without it, both fall back to a
    # deterministic rule-based / heuristic engine so the product works
    # fully offline out of the box.
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
