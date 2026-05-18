---
seed_id: SEED-026
title: Error handling, surfacing & observability lift — global handler + structured ErrorResponse + log sink + frontend toast + admin error inspector
status: planted
planted: 2026-05-18
phase_origin: 074-seed-009-seed-011-polish-bundle (user-flagged 2026-05-18 between phases — "we need to give real error messages and handle errors more efficiently, user should see customized errors but admin should know exactly what is the error. also error logs should be monitored and recorded")
related_seeds: [SEED-001, SEED-012, SEED-013, SEED-025]
relates_to:
  - `backend/app/main.py` — no global FastAPI exception handler today; unhandled exceptions leak as raw 500s with no error context
  - `backend/app/api/*.py` — HTTPException with plaintext `detail` strings throughout; no structured error model (no `error_code`, `trace_id`, `timestamp`, `user_message` vs `admin_message` split)
  - `backend/app/services/*.py` — 36 modules use stdlib logging via `logger = logging.getLogger(__name__)`; 66 total `logger.error/exception/warning` calls; **no `logging.basicConfig` anywhere** (D-074-01-DEFER-1 already documented this)
  - `frontend/src/lib/api.ts:29-45` — fetch wrapper throws generic `Error("Failed to list X")`; backend error detail not parsed; no error code routing
  - `frontend/src/**/*.tsx` — no toast/notification library; errors render as inline text or `console.error` only; no global ErrorBoundary
  - LangSmith — wired (`backend/app/main.py:57-60`, project: `agentic-rag-module2`) but traces LLM calls only, not application errors
  - SEED-012 (Admin/Operator UI Completeness) — admin error inspector is one of several themes there; this seed is the cross-cutting infrastructure that SEED-012 will reuse

re_open_triggers:
  - Any user-reported error that shows backend SDK internals to the end user (e.g., toast or inline message contains `supabase-py APIError(...)`, asyncpg.exceptions.X, anthropic SDK exception classes) — that's the leak surface this seed exists to close
  - Any production-shape rollout planning (v2.6 close, v2.7 open, or VPS deploy per Phase 080) — error observability is a launch prerequisite, not nice-to-have
  - When SEED-012 (Admin/Operator UI Completeness) opens — its admin error dashboard depends on the structured ErrorResponse model + log sink this seed delivers
  - When a user reports "the chat just stopped and I don't know why" — that's an unhandled exception leaking into the void with no admin trace to recover from
  - When `/gsd:discuss-phase 082.5` runs (Error Handler Foundation — the urgent slice of this seed inserted into v2.6 roadmap)

priority: high
suggested_phase: |
  Two-phase strategy:
  1. **Phase 082.5 (Error Handler Foundation)** — already inserted into v2.6 roadmap 2026-05-18 as the urgent slice. Ships the bottom 3 pillars: global FastAPI exception handler, structured ErrorResponse model with `{code, user_message, admin_message, trace_id, timestamp}`, and `logging.basicConfig` (closes D-074-01-DEFER-1 in the same stroke). One-phase deliverable, no UI work.
  2. **Full lift — v2.7 dedicated phase** — adds the remaining 2 pillars: frontend toast library + error code → user_message mapping in `lib/api.ts`, and admin-only error inspector route (depends on admin auth layer landing first — likely paired with SEED-012).
---

# SEED-026 — Error handling, surfacing & observability lift

## What this seed exists to close

Today's error path is **scattered, leaky, and non-observable**:

- The backend raises HTTPExceptions with plaintext `detail` strings that often
  contain internal SDK error messages (`"Could not retrieve stored file:
  supabase-py APIError(message='...', code='PGRST116')"`). These reach the
  frontend verbatim.
- The frontend has no toast library and no error boundary. Errors render as
  inline text in component-local state, or get swallowed into `console.error`.
- Unhandled exceptions in async handlers leak as raw `500 Internal Server
  Error` with no trace_id, no error code, no admin record.
- 36 service modules call `logger.error/exception` but **the app has no
  `logging.basicConfig`** — so Python's default WARNING level silently drops
  every `logger.info` call (D-074-01-DEFER-1) and `logger.error/exception`
  goes only to container stdout, never to a sink.
- There is no admin role, no admin error endpoints, no way for an operator
  to inspect "what failed for user X in run Y at timestamp Z" without SSH-ing
  into the container and grepping logs.
- LangSmith traces the LLM calls (good — agent loop visibility) but does
  NOT capture application errors (DB failures, ingestion errors, SSE drops,
  sandbox crashes).

The user's framing 2026-05-18:
> "we need to give real error messages and handle errors more efficiently,
> user should see customized errors but admin should know exactly what is
> the error. also error logs should be monitored and recorded"

## Scope — 5 pillars

### Pillar 1 — Global FastAPI exception handler

`backend/app/main.py`: register `@app.exception_handler(Exception)` and
`@app.exception_handler(HTTPException)` to catch ALL exceptions and convert
to a structured `ErrorResponse`. Untrusted exception detail is sanitized
before reaching the wire.

### Pillar 2 — Structured ErrorResponse model

Pydantic model `ErrorResponse(code: str, user_message: str, admin_message:
str | None, trace_id: str, timestamp: datetime, run_id: str | None,
thread_id: str | None)`:

- `user_message` — safe to render verbatim ("That model isn't available
  right now. Try a different model.")
- `admin_message` — only included when caller is admin-authenticated;
  contains the real exception type + message + relevant context
- `code` — stable string code (`PROVIDER_RATE_LIMITED`, `INGEST_TIMEOUT`,
  `RUN_BUFFER_EXPIRED`) the frontend can switch on
- `trace_id` — links to the same id used by LangSmith trace + log sink record

### Pillar 3 — Logging foundation

- Add `logging.basicConfig(level=logging.INFO, format=...)` in
  `backend/app/main.py` startup (closes D-074-01-DEFER-1 in this pillar)
- Configure structured JSON formatter (likely `structlog` or `loguru`) so
  every log line carries `trace_id`, `user_id`, `run_id` automatically
- Optional cloud sink: Sentry / Logtail / direct stdout-to-Loki — make
  configurable via env, default to stdout-only for local dev
- Audit-grade: every `ErrorResponse` issued by the global handler also
  writes one row to a new `app_errors` table (`code, user_id, run_id,
  thread_id, admin_message, trace_id, timestamp, request_path`)

### Pillar 4 — Frontend toast + error-code mapping

- Add a toast library (`sonner` is the lightweight idiomatic shadcn choice;
  match Aether Intelligence design system / Deep Midnight theme)
- Add a global ErrorBoundary at App root
- `lib/api.ts` parses `ErrorResponse` shape; non-OK responses throw a typed
  `ApiError` carrying `code` + `user_message` + `trace_id`
- Toast renders `user_message` (never `admin_message`) with a `trace_id`
  badge for screenshot-style support hand-off
- Component-local error states that need inline rendering use the same
  parsed `ApiError`, NOT raw `Error.message`

### Pillar 5 — Admin error inspector

Depends on admin auth layer (SEED-012 prerequisite or co-shipped):

- New route `/admin/errors` — table of recent `app_errors` rows
- Filters: by user, by run, by code, by date range, by trace_id
- Detail panel shows full `admin_message` + linked LangSmith trace + linked
  Supabase audit log row
- This is the "admin should know exactly what is the error" half of the
  user-vs-admin split

## Why v2.6 needs Pillar 1-3 NOW (Phase 082.5)

Pillars 1-3 are pure backend infrastructure with zero UI dependencies and
zero admin auth dependencies. They:

1. Close D-074-01-DEFER-1 (logging.basicConfig gap) — fixes observability
   for every `logger.info/warning/error` call in the codebase, including
   the SEED-009 clamp breadcrumb
2. Stop SDK error messages from leaking to users via a single
   sanitization point
3. Give us a `trace_id` to correlate user reports with backend state —
   needed before any production-shape rollout (Phase 080 VPS runbook)

Pillars 4-5 ship in v2.7 once SEED-012's admin auth layer is in place.

## What this is NOT

- Not a refactor of every existing `raise HTTPException(...)` call site.
  Keep current call sites; the global handler intercepts and rewraps. The
  per-call-site refactor to use specific `ErrorResponse` codes happens
  opportunistically over time.
- Not LangSmith replacement — LangSmith remains the LLM-call trace tool.
  This seed adds the application-error sink that LangSmith does NOT cover.
- Not a Sentry mandate — Sentry is one option among several for the cloud
  sink. Phase 082.5 ships with stdout-JSON sink only; cloud sink is opt-in
  per Pillar 3.

## Open questions for `/gsd:discuss-phase 082.5`

1. **Sentry vs Logtail vs Loki vs none for the optional cloud sink?**
   Recommend: ship stdout-JSON only in 082.5 and decide the cloud sink at
   Phase 080 (VPS runbook) — the deployment target dictates the choice.
2. **`structlog` vs `loguru` vs stdlib + JSON formatter?** Recommend:
   stdlib + JSON formatter for v2.6 (minimum-dependency approach matching
   "no LangChain, no LangGraph" rule); promote to `structlog` if v2.7
   needs richer context-binding.
3. **`app_errors` table — separate or part of `audit_log`?** Existing
   `audit_service.py` writes user-action audit entries. Errors are a
   distinct concern (no `user_id` in many cases — e.g., startup errors).
   Recommend separate table; share the timestamp + trace_id columns for
   join-ability.
4. **Should the global handler catch `asyncio.CancelledError`?** No —
   that's a normal stream-disconnect signal, not an error. Pillar 1 must
   distinguish.

## Cross-cutting touch — D-074-01-DEFER-1

This seed is the natural home for closing D-074-01-DEFER-1 (the missing
`logging.basicConfig` surfaced during the SEED-009 Live UAT 2026-05-18).
Pillar 3 of Phase 082.5 will add the `basicConfig` call in the same patch
as the JSON formatter and trace_id middleware.
