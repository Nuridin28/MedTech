# MedServicePrice.kz

**Aggregator of medical service prices in Kazakhstan — "Aviasales for medicine".**
Collects prices from public clinic price lists, normalizes heterogeneous service
names to a single catalog, and lets users search and compare prices across clinics.

> Built from the Stitch "Clinical Utility System" designs (9 screens) + a real
> FastAPI/PostgreSQL/Celery backend with a **real** parser. No mock data — every
> price shown is scraped from a real public price list.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + React Router + TanStack Query + framer-motion |
| Backend | FastAPI (async) + SQLAlchemy 2.0 + Pydantic v2 |
| DB | PostgreSQL 16 + `pg_trgm` + `pgvector` |
| Queue/cache | Celery 5 + Redis 7 |
| Parsing | httpx + BeautifulSoup4 (lxml) |
| Normalization | rapidfuzz (lexical+fuzzy) + optional sentence-transformers (semantic) |
| Proxy | Nginx (serves SPA, proxies `/api`, gzip, security headers) |

## Quick start

```bash
cd medserviceprice
cp .env.example .env          # adjust ADMIN_API_KEY etc.
docker compose up --build
```

Then:
- **App**: http://localhost  (Nginx → SPA + `/api` proxy)
- **API docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

On boot the backend runs `alembic upgrade head` and seeds the catalog (60+
normalized service positions). The DB starts **empty of prices** — run the parser:

```bash
# Kick off a real parse of all registered sources (KDL Olymp, per city)
curl -X POST http://localhost:8000/api/admin/parse/run \
  -H "X-API-Key: <ADMIN_API_KEY from .env>"

# Watch parse logs
curl http://localhost:8000/api/admin/parse/logs -H "X-API-Key: <ADMIN_API_KEY>"
```

Celery Beat also schedules a daily parse per source automatically (TZ §12).

### Local dev (without Docker)

```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export POSTGRES_HOST=localhost REDIS_HOST=localhost
alembic upgrade head && python -m scripts.seed_catalog
uvicorn app.main:app --reload
celery -A app.celery_app.celery_app worker --loglevel=info   # separate shell

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api → :8000)
```

## How it works

1. **Parse** (`app/parsers/`, Celery `parse_source`): each source is an isolated
   adapter (`BaseParser`). KDL Olymp serves a server-rendered `/pricelist/{city}`
   page; the parser fetches it (robots-aware, rate-limited, retried) and extracts
   real `(service name, price, duration, source URL)` lines.
2. **Raw layer**: scraped lines are deduped (`content_hash`) and stored in
   `raw_records` for ≥90-day audit / re-parsing (TZ §4.1).
3. **Normalize** (`app/services/normalization.py`): each raw name is matched to the
   catalog — exact → fuzzy (rapidfuzz token_sort_ratio ≥ 88) → else queued in
   `unmatched_queue` for manual review.
4. **Offers**: deduped per `(clinic, offer_hash)`; price changes append to
   `price_history`. Caches are invalidated after each parse.
5. **Search** (`app/services/search.py`): lexical (pg_trgm) always on; semantic
   (pgvector HNSW) + hybrid (RRF) when `ENABLE_SEMANTIC=true`.

## API (TZ §7)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/services/search?q=&mode=` | autocomplete (lexical/semantic/hybrid) |
| GET | `/api/offers` | filtered/sorted/paginated price comparison |
| GET | `/api/clinics/{id}` | clinic profile + all its prices |
| GET | `/api/services/{id}/price-history?clinic_id=` | price timeline |
| GET | `/api/clinics-map?city=` | geolocated clinics for the map |
| POST | `/api/subscriptions` | track a price (price-drop email alerts) |
| POST | `/api/admin/parse/run` | trigger a parse *(admin)* |
| GET | `/api/admin/parse/logs` | parse log *(admin)* |
| GET | `/api/admin/unmatched` | normalization review queue *(admin)* |
| POST | `/api/admin/unmatched/{id}/resolve` | attach raw name to catalog *(admin)* |
| POST | `/api/admin/import/upload` | upload a price-list file (xlsx/csv/pdf/docx) *(admin)* |
| POST | `/api/admin/geocode/run` | fill clinic lat/lng for the map *(admin)* |

### Sources (TZ §2 — ≥3 sources)

1. **KDL Olymp** (`kdlolymp.kz`) — 5 cities, server-rendered HTML.
2. **Invitro** (`invitro.kz`) — server-rendered HTML.
3. **File upload** — any clinic's published **Excel/CSV/PDF/DOCX** price list, ingested
   through the same pipeline via the admin **Import** card (no parser code needed).

### UI features

- **Search** with autocomplete · filters: city, **category**, price range · sort by
  price / rating / freshness.
- **Map view** (`/map`, Leaflet/OSM) and a map toggle in search results.
- **Compare** mode — tick clinics in the results and compare them in a table.
- **Admin** (`/admin`) — run parse, geocode, review the unmatched queue, **upload a
  price file**, watch parse logs. Enter the `ADMIN_API_KEY` to authenticate.
- **Price-drop alerts** — subscribe to a service/clinic; a twice-daily Celery beat
  emails subscribers when the tracked price falls (logs the message if SMTP is unset).

## Screens (from Stitch)

Home (smart search) · Search results (price comparison) · Service detail + price
history · Clinic profile · Dashboard · Appointments · Saved clinics · Medical
records. All wired with React Router + smooth framer-motion page transitions.
Account screens (dashboard/appointments/favorites/records) are backed by the
user's **own real actions** (localStorage) over real backend clinic/service data —
no fabricated patient data.

## Adding a source

Implement a `BaseParser` subclass in `app/parsers/`, register it in
`app/parsers/registry.py`. No core changes needed (TZ §2.2 adapter pattern).

## Security (TZ §11)

Pydantic validation, ORM-only (no SQL string building), `page_size` capped at 100,
admin endpoints behind an API key, CORS pinned to the frontend origin, Redis rate
limiting, security headers (Nginx + app). Only public price data is collected; no
patient PII. robots.txt and inter-request delays are respected.
