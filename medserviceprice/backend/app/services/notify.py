"""Notification sender (TZ §3.4 — price-drop subscriptions).

Sends via SMTP when configured (SMTP_HOST set), otherwise logs the message so the
feature works end-to-end in the MVP without external dependencies. No PII beyond
the subscriber's own email is handled.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """Returns True if delivered/queued. Falls back to a log line when SMTP is off."""
    if not settings.smtp_host:
        logger.info("[notify:log] to=%s | %s | %s", to, subject, body.replace("\n", " ⏎ "))
        return True
    try:
        msg = EmailMessage()
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            if settings.smtp_tls:
                s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        logger.info("[notify:smtp] sent to %s: %s", to, subject)
        return True
    except Exception as exc:  # delivery failure must not crash the task
        logger.warning("[notify:smtp] failed for %s: %s", to, exc)
        return False
