"""AI assistant endpoint (domain-scoped chatbot behind a safety gateway).

The route only orchestrates limits + shapes the response. ALL prompt/response
validation and the OpenAI calls live in app/services/assistant.py.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import hit_limit, over_daily_budget
from app.schemas import ChatRequest, ChatResponse
from app.services import assistant

logger = logging.getLogger("assistant")

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/status")
async def assistant_status() -> dict:
    """Lets the frontend hide the chat widget when the assistant is off."""
    return {"enabled": assistant.is_enabled()}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> ChatResponse:
    if not assistant.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant is not configured.",
        )

    ip = get_remote_address(request)
    # Per-IP burst + daily guards (fail-open) then the global cost ceiling (fail-closed).
    if await hit_limit(f"ai:rl:m:{ip}", settings.assistant_rate_per_minute, 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много запросов. Подождите минуту.")
    if await hit_limit(f"ai:rl:d:{ip}", settings.assistant_rate_per_day, 86400):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Дневной лимит запросов исчерпан.")
    if await over_daily_budget("ai:budget:day", settings.assistant_daily_budget_calls):
        logger.warning("assistant: global daily budget reached")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ассистент временно недоступен.")

    history = [t.model_dump() for t in payload.history]
    try:
        result = await assistant.answer(payload.message, history, db=db)
    except assistant.AssistantDisabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI assistant is not configured.")
    except Exception:
        logger.exception("assistant: unexpected failure")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Не удалось получить ответ ассистента.")

    return ChatResponse(reply=result.reply, decision=result.decision)
