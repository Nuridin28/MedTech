"""FastAPI application entrypoint (TZ §7, §11)."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.admin import router as admin_router
from app.api.assistant import router as assistant_router
from app.api.doctors import router as doctors_router
from app.api.public import router as public_router
from app.core.config import settings

from app.core.logging_setup import setup_logging

setup_logging()  # structured JSON logs (+ Elasticsearch shipping when enabled)

# Rate limiting on public endpoints (TZ §11) — Redis-backed.
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url, default_limits=["120/minute"])

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Aggregator of medical service prices in Kazakhstan — real prices from public clinic price lists.",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=512)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # specific origin, not "*" (TZ §11)
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(public_router)
app.include_router(admin_router)
app.include_router(assistant_router)
app.include_router(doctors_router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "env": settings.environment}


@app.get("/api/health", tags=["meta"])
async def api_health() -> dict:
    return {"status": "ok"}


# Security headers (defense in depth; Nginx also sets these in prod — TZ §11).
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
