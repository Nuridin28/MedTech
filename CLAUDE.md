# MedServicePrice.kz — Aggregator of medical service prices in Kazakhstan

"Aviasales for medicine." Collects prices from **public** clinic price lists, normalizes
heterogeneous service names to a single catalog, and lets users search and compare prices
across clinics. The actual app lives in [medserviceprice/](medserviceprice/).

See [medserviceprice/ARCHITECTURE.md](medserviceprice/ARCHITECTURE.md) and
[medserviceprice/docs/architecture.html](medserviceprice/docs/architecture.html) for the design.

**Stack:** React 18 + Vite + TS + Tailwind + TanStack Query (frontend) · FastAPI async +
SQLAlchemy 2.0 + Pydantic v2 (backend) · PostgreSQL 16 (pg_trgm + pgvector) · Celery 5 +
Redis 7 · httpx + BeautifulSoup4 (parsing) · Nginx (edge). Deployed via docker-compose.

## MANDATORY: skill routing

Before implementing **any** task, identify the matching skill from the tables below
and invoke it via the Skill tool **first**. Do not hand-roll work that a skill covers.
Route by relevance — load only the skills that fit the task at hand, not the whole list.
When several apply, the most specific wins; chain them (e.g. design → build → review).

### Frontend & UI
| Work type | Skill |
|-----------|-------|
| React / Vite / TypeScript / Tailwind, TanStack Query, page/component work | `senior-frontend` |
| Distinctive, production-grade UI components from an aesthetic philosophy | `frontend-design` |
| Design tokens / CSS variables / Tailwind theme, light+dark palettes | `design-tokens` |
| Immersive / cinematic / scroll-storytelling / parallax landing pages | `epic-design` |
| Accessibility audit, WCAG 2.2 A/AA, color contrast | `a11y-audit` |
| Transactional / marketing email templates (price-alert emails) | `email-template-builder` |
| Full design-to-build workflow (grill → tokens → build → review) | `design-flow` |
| Design critique / QA / polish pass on built UI | `design-review` |

### Backend, Data, ML & AI
| Work type | Skill |
|-----------|-------|
| FastAPI / Postgres / REST / auth / API hardening | `senior-backend` |
| Parser/ingestion pipeline, Celery, ETL/ELT, orchestration | `senior-data-engineer` |
| Price statistics, A/B tests, predictive models | `senior-data-scientist` |
| pgvector embeddings, semantic/hybrid search, RAG, model serving | `senior-ml-engineer` |
| LLM prompts / agent design / evals (if AI features are added) | `senior-prompt-engineer` |
| Snowflake SQL, Cortex, Dynamic Tables (only if a Snowflake path is used) | `snowflake-development` |

### Architecture & tech decisions
| Work type | Skill |
|-----------|-------|
| Architecture decisions, ADRs, diagrams, microservices vs monolith | `senior-architect` |
| Scaffolding a new project, code-quality / stack-selection analysis | `senior-fullstack` |
| Compare frameworks / stacks, TCO, migration paths, ecosystem health | `tech-stack-evaluator` |

### QA, testing & review
| Work type | Skill |
|-----------|-------|
| Unit / integration / E2E tests for React/Vite, coverage gaps, MSW | `senior-qa` |
| TDD red-green-refactor, fixtures, mocks (Pytest/Vitest) | `tdd-guide` |
| Playwright E2E, flaky-test fixes, CI | `playwright-pro` |
| PR review for complexity/risk, SOLID, code smells | `code-reviewer` |
| Hostile / adversarial review before merge | `adversarial-reviewer` |
| Review the working diff for bugs + cleanups | `/code-review` |

### DevOps & Cloud
| Work type | Skill |
|-----------|-------|
| CI/CD, IaC, containers, monitoring, deployment automation | `senior-devops` |
| AWS / Azure / GCP infra & cost optimization | `aws-solution-architect` · `azure-cloud-architect` · `gcp-cloud-architect` |

### Integrations & meta
| Work type | Skill |
|-----------|-------|
| Stripe / payments / billing (if monetization is added) | `stripe-integration-expert` |
| Design ↔ code via Figma | `figma:*` family |
| Curate memory → promote learnings to CLAUDE.md / rules / skills | `self-improving-agent` |
| Deep multi-source, fact-checked research report | `deep-research` |

## Security gate

This is a **public** price aggregator — it stores only public price data, no patient PII.
Still, before any merge/release, and after any change touching the admin API, parsers,
data storage, or rate-limiting, run **`senior-security`** (threat model / STRIDE) and
**`senior-secops`** (SAST, secrets, OWASP). Route deeper work:

| Security task | Skill |
|---------------|-------|
| Threat modeling, STRIDE, attack surface, CVE remediation | `senior-security` |
| SAST/DAST, dependency scan, GDPR-style data-handling review | `senior-secops` |
| Pen test, OWASP Top 10, secret detection, API security testing | `security-pen-testing` |
| Cloud misconfig, IAM, IaC gaps | `cloud-security` |
| Security review of the pending branch diff | `/security-review` |

## Non-negotiable invariants

- **No mock data.** Every price shown is scraped from a real public price list. Never
  fabricate clinics, prices, or history. (See memory: `no-mock-data-medserviceprice`.)
- **Two-layer storage**: scraped lines land in `raw_records` (audit, ≥90-day retention,
  dedup on `content_hash`) → working layer `service_offers` (dedup on `offer_hash`).
  Keep the layers separate.
- **Normalization is explainable, with a human in the loop**: a raw name auto-attaches to
  the catalog only on `token_set_ratio ≥ 88 AND token_sort_ratio ≥ 60` (dual threshold
  prevents collapsing multi-test panels into a single test). Everything below goes to
  `unmatched_queue` for an analyst to resolve. `service_id = NULL` is valid (price visible,
  not yet catalog-linked). (`app/services/normalization.py`)
- **Parser etiquette**: respect `robots.txt`, send the project User-Agent, keep the
  inter-request delay and retries. Only public price data — never PII. (`app/parsers/base.py`)
- **Frontend report shape is the contract** in `frontend/src/api/client.ts` +
  `frontend/src/api/types.ts` — keep the backend `/api/*` responses aligned to it.
- **Dual DB engines**: async (asyncpg) for the API, sync (psycopg2) for Celery/Alembic —
  two distinct URLs in `app/core/config.py`. Don't mix them.

## Conventions

- User communicates in Russian; reply in Russian.
- Adding a source = implement a `BaseParser` subclass in `app/parsers/`, register it in
  `app/parsers/registry.py`. No core changes (adapter pattern).
- Semantic search is **off by default** (`ENABLE_SEMANTIC=false`) to keep the API container
  light; lexical (pg_trgm) always works and `hybrid` degrades gracefully to lexical.
- Backend tests run via plain function execution locally (pytest not installed); they
  must also pass under pytest in CI.
- Cache keys `ac:*` / `offers:*` / `clinic:*` are invalidated after each parse — keep that
  contract if you add cached endpoints.
