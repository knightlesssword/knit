"""Application configuration. Environment overrides with KNIT_ prefix."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _db_path_default() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    # backend/app/config.py -> backend/data/knit.db
    return os.path.normpath(os.path.join(here, "..", "data", "knit.db"))


@dataclass
class Settings:
    database_path: str = os.environ.get("KNIT_DATABASE_PATH", _db_path_default())
    secret_key: str = os.environ.get("KNIT_SECRET_KEY", "dev-only-secret-change-me-knit-local-01")
    token_expiry_days: int = int(os.environ.get("KNIT_TOKEN_DAYS", "7"))
    app_version: str = "0.1.0"


settings = Settings()
