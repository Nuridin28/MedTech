#!/usr/bin/env bash
set -e

echo "⏳ Waiting for Postgres at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432} ..."
until python -c "import socket,os,sys; s=socket.socket(); s.settimeout(2); \
  sys.exit(0) if not s.connect_ex((os.getenv('POSTGRES_HOST','db'), int(os.getenv('POSTGRES_PORT','5432')))) else sys.exit(1)" 2>/dev/null; do
  sleep 1
done
echo "✅ Postgres reachable."

# 0001 builds the full current schema via Base.metadata.create_all(), so it
# already contains every column/table that the later revisions (0002-0006) try
# to add. Apply 0001, then stamp the rest as applied instead of re-running their
# redundant ALTERs (which would fail with DuplicateColumn). Idempotent on re-runs.
echo "📦 migrations: upgrade 0001_init + stamp head"
alembic upgrade 0001_init
alembic stamp head

echo "🌱 seeding catalog"
python -m scripts.seed_catalog

echo "🚀 starting API (uvicorn)"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-2}"
