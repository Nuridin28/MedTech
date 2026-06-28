FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# System deps: psycopg2 (libpq), lxml (libxml2/xslt), pdfplumber (poppler optional).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libxml2-dev libxslt1-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Semantic search (TZ §6.3) — sentence-transformers + torch (~2GB). OFF by default
# to keep the image light. Enable with `--build-arg INSTALL_SEMANTIC=true` and set
# ENABLE_SEMANTIC=true at runtime. Lexical (pg_trgm) search works without it, and
# hybrid mode degrades gracefully to lexical.
ARG INSTALL_SEMANTIC=false
COPY requirements-semantic.txt .
RUN if [ "$INSTALL_SEMANTIC" = "true" ]; then pip install -r requirements-semantic.txt; fi

COPY . .

RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000

CMD ["./entrypoint.sh"]
