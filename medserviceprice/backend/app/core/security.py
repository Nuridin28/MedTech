"""Admin auth (TZ §7.2, §11) — API-key guard for the admin endpoints."""
from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def require_admin(x_api_key: str | None = Header(default=None)) -> None:
    """Dependency: rejects requests without the correct admin API key."""
    if not x_api_key or x_api_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin API key",
        )
