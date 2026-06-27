"""Structured JSON logging + optional non-blocking Elasticsearch shipping.

Design goals:
  * JSON logs to stdout always (so Filebeat/Fluentd/docker can ship them too).
  * When ELASTIC_ENABLED, also push records straight to Elasticsearch from a
    background thread — bounded queue, batched bulk writes, SILENT on failure.
    Logging must never block a request or crash the app if ES is down.

Both the API (main.py) and the Celery worker/beat (celery_app.py) call
`setup_logging()` so every process ships the same structured logs.
"""
from __future__ import annotations

import atexit
import json
import logging
import queue
import re
import threading
from datetime import datetime, timezone

from app.core.config import settings

_SOURCE_PREFIX = re.compile(r"^\[([a-z0-9_]+)\]")  # "[kdl_astana] ..." -> source tag


def _record_to_doc(record: logging.LogRecord) -> dict:
    msg = record.getMessage()
    doc = {
        "@timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
        "level": record.levelname,
        "logger": record.name,
        "message": msg,
        "process": record.processName,
    }
    # Tag a source_key when the message starts with "[source] ..." (parsers/tasks do this).
    m = _SOURCE_PREFIX.match(msg)
    if m:
        doc["source_key"] = m.group(1)
    for attr in ("source_key", "status", "city", "task"):
        val = getattr(record, attr, None)
        if val is not None:
            doc[attr] = val
    if record.exc_info:
        doc["exception"] = logging.Formatter().formatException(record.exc_info)
    return doc


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        return json.dumps(_record_to_doc(record), ensure_ascii=False)


class ElasticsearchHandler(logging.Handler):
    """Buffers log docs and bulk-indexes them to ES from a daemon thread."""

    def __init__(self, batch_size: int = 50, flush_interval: float = 2.0) -> None:
        super().__init__()
        self._queue: queue.Queue[dict] = queue.Queue(maxsize=10_000)
        self._batch = batch_size
        self._interval = flush_interval
        self._stop = threading.Event()
        self._es = None
        self._worker = threading.Thread(target=self._run, name="es-log-shipper", daemon=True)
        self._worker.start()
        atexit.register(self.close)

    def _client(self):
        if self._es is None:
            from elasticsearch import Elasticsearch

            kwargs: dict = {"request_timeout": 5, "retry_on_timeout": False, "max_retries": 0}
            if settings.elastic_user:
                kwargs["basic_auth"] = (settings.elastic_user, settings.elastic_password)
            self._es = Elasticsearch(settings.elasticsearch_url, **kwargs)
        return self._es

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._queue.put_nowait(_record_to_doc(record))
        except queue.Full:
            pass  # under pressure we drop logs rather than block the app

    def _run(self) -> None:
        buf: list[dict] = []
        while not self._stop.is_set():
            try:
                buf.append(self._queue.get(timeout=self._interval))
            except queue.Empty:
                pass
            if buf and (len(buf) >= self._batch or self._queue.empty()):
                self._flush(buf)
                buf = []
        if buf:
            self._flush(buf)

    def _flush(self, docs: list[dict]) -> None:
        try:
            from elasticsearch import helpers

            es = self._client()
            index = f"{settings.elastic_index}-{datetime.now(timezone.utc):%Y.%m.%d}"
            actions = [{"_index": index, "_source": d} for d in docs]
            helpers.bulk(es, actions, raise_on_error=False, request_timeout=10)
        except Exception:
            pass  # ES unreachable / not installed — never break logging

    def close(self) -> None:
        self._stop.set()
        try:
            self._worker.join(timeout=3)
        except Exception:
            pass
        super().close()


_CONFIGURED = False


def setup_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    _CONFIGURED = True

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for h in list(root.handlers):  # replace default handlers with JSON stdout
        root.removeHandler(h)

    # Silence the ES client's own chatter and, crucially, stop it propagating to the
    # root handlers — otherwise shipping logs to a down ES would log connection errors
    # that get re-queued and shipped again (a feedback loop / log flood).
    for noisy in ("elastic_transport", "elasticsearch", "urllib3"):
        lg = logging.getLogger(noisy)
        lg.setLevel(logging.ERROR)
        lg.propagate = False

    # Drop per-statement SQL echo and access-log noise to WARNING so the logs panel
    # surfaces real signal (parsing, errors, tasks) — warnings/errors still flow.
    for chatty in ("sqlalchemy.engine", "sqlalchemy.engine.Engine", "uvicorn.access"):
        logging.getLogger(chatty).setLevel(logging.WARNING)

    stream = logging.StreamHandler()
    stream.setFormatter(JsonFormatter())
    root.addHandler(stream)

    if settings.elastic_enabled:
        try:
            root.addHandler(ElasticsearchHandler())
            root.info("[elk] Elasticsearch log shipping enabled -> %s", settings.elasticsearch_url)
        except Exception as exc:  # noqa: BLE001
            root.warning("[elk] could not start ES log handler: %s", exc)
