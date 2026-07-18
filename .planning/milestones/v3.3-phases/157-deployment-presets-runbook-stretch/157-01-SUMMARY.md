---
phase: 157-deployment-presets-runbook-stretch
plan: 01
subsystem: infra
tags: [docker-compose, env-preset, self-host, deployment, nginx, supabase, redis, fernet, vite]

# Dependency graph
requires:
  - phase: 150-secrets-at-rest
    provides: SECRETS_ENCRYPTION_KEY (Fernet, fail-open blank / refuse-boot malformed) documented in the preset
  - phase: 146-operator-role
    provides: OPERATOR_EMAILS bootstrap (the real /admin access control the preset points at, not ENVIRONMENT)
provides:
  - "deploy/onebox.env.example — the curated home-B one-box env preset (filled-in copy of backend/.env.example with the D-06 baseline)"
  - "A settled env-var surface for the downstream 157 artifacts (compose, OPERATOR.md, D-09 smoke) to read against"
  - "The productized local↔cloud↔on-prem env-var-only switch as a single fill-in template"
affects: [157-02-frontend-dockerfile-nginx, 157-03-docker-compose-prod, 157-04-operator-runbook, 157-05-d09-smoke]

# Tech tracking
tech-stack:
  added: []  # no npm/pip/cargo packages, no Docker images — text .env template only
  patterns:
    - "Curated .env preset layered on backend/.env.example (every key traces to base or a documented gap)"
    - "One root ./.env serves BOTH compose build-arg interpolation (VITE_*) AND the backend env_file (runtime)"
    - "VITE_* flagged as build-time-only build args, distinct from runtime env"

key-files:
  created:
    - deploy/onebox.env.example
  modified: []

key-decisions:
  - "Placeholders use <angle-bracket> tokens (or blank for SECRETS_ENCRYPTION_KEY) — unambiguously not real secrets, committable (root ./.env stays gitignored)"
  - "POSTGRES_DSN placeholder bakes in LESSONS A4 (session pooler :5432 IPv4), FRONTEND_URL bakes in B1 (comma-split multi-origin), SANDBOX comment bakes in B2 (host-built image + docker.sock host-root single-tenant caveat)"
  - "Included OPENAI_MODELS pinned (LESSONS B3 — pin known-good models per env) as the active-provider list; other providers left commented/optional"
  - "LangSmith left commented-out (self-host default off — no account needed); TAVILY blank; PYMUPDF_TIMEOUT_S=60 carried"
  - "ENVIRONMENT=production set for cleanliness only, explicitly documented as NOT the /admin gate (Phase 146 → OPERATOR_EMAILS is)"

patterns-established:
  - "Preset-key-trace static check: every non-comment KEY= must resolve to backend/.env.example or a documented gap (FRONTEND_URL, ENVIRONMENT, VITE_*)"

requirements-completed: []  # DEPLOY-01 is phase-spanning (preset + compose + OPERATOR.md + D-09 smoke) — this plan authors ONLY the preset artifact; DEPLOY-01 stays OPEN until the compose/runbook/smoke land and the phase is verified (project false-green-avoidance convention)

# Metrics
duration: ~10min
completed: 2026-07-16
---

# Phase 157 Plan 01: One-Box Deployment Env Preset Summary

**`deploy/onebox.env.example` — a curated, key-traced fill-in of `backend/.env.example` carrying the D-06 one-box baseline (WORKER_COUNT=2, SANDBOX_ENABLED=true, RERANK_ENABLED=false, POSTGRES_POOL_MAX=10, bundled Redis at redis://redis:6379, Supabase cloud) plus the two documented gap vars and a labelled VITE_* build-time block.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-16T21:56:30Z
- **Completed:** 2026-07-16T22:05:17Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- Authored the DEPENDENCY-ROOT artifact of Phase 157 — the one env surface every downstream plan (compose, OPERATOR.md, smoke) reads against.
- Encoded the D-06 one-box baseline exactly, with secrets as placeholders/blank only (nothing real committed).
- Baked the real DEPLOYMENT-LESSONS fixes into inline comments where the operator meets them: A4 (session pooler :5432), A5 (rediss:// TLS pointer), B1 (comma-split CORS), B2 (host-built sandbox image + docker.sock single-tenant caveat), B3 (pin models), SEC-01 (Fernet key generate + fail-open/refuse-boot behavior).
- Documented the operator flow (`cp deploy/onebox.env.example ./.env` → fill → `docker compose -f docker-compose.prod.yml up -d --build`) and the Pitfall-3 local-smoke URL split (browser `127.0.0.1` vs backend `host.docker.internal`).
- Proved the preset-key-trace static check green: 37 non-comment keys, 0 orphans.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the one-box variable surface with the D-06 baseline** - `32ed1ae3` (feat)
2. **Task 2: Add the operator usage-header, local-smoke URL split, and the scale-dial note** - `9dba30c2` (docs)

_Plan metadata (SUMMARY) committed separately after this file._

## Files Created/Modified
- `deploy/onebox.env.example` - Curated home-B one-box env preset: SECRETS (placeholders) + INFRA/topology (D-06 baseline + FRONTEND_URL/ENVIRONMENT gaps + OPERATOR_EMAILS) + SETTINGS (LLM/embeddings/retrieval/hybrid, RERANK off) + a labelled VITE_* build-time block, fronted by an operator usage-header with the Fernet generate one-liner and the local-smoke URL-split note.

## Decisions Made
- **Placeholder style:** `<angle-bracket>` tokens for secrets, blank for `SECRETS_ENCRYPTION_KEY`. Clearly-not-real and safe to commit; the real values only ever live in the gitignored root `./.env` (`.gitignore` line 2 `.env` verified — `onebox.env.example` is not matched, so it commits).
- **B3 model pinning:** included `OPENAI_MODELS` for the active provider (pin-known-good-per-env); other provider keys/lists left commented as optional to keep the one-box lean.
- **LangSmith commented-out** (self-host default off, no account needed); `TAVILY_API_KEY` blank; `PYMUPDF_TIMEOUT_S=60` carried. These are within the plan's "curated fill-in / carry defaults" discretion.
- **ENVIRONMENT=production** set for cleanliness only and explicitly commented as NOT the operator-access control (Phase 146 replaced that with `OPERATOR_EMAILS` + `operator_users`), per RESEARCH Open-Question Q4.
- **requirements-completed left empty:** DEPLOY-01 spans the whole phase (preset + compose + runbook + D-09 smoke). This plan contributes the preset only; per the project's false-green-avoidance convention, DEPLOY-01 stays open until phase verification.

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed per their `<action>` and every `<acceptance_criteria>` item verified. Curation choices (model list, optional-integrations block) fall within the plan's explicit "curated fill-in of backend/.env.example" discretion and are logged under Decisions Made, not as deviations.

## Issues Encountered
None. (Harmless Git `LF will be replaced by CRLF` notice on Windows — line-ending normalization only.)

## User Setup Required
None for this plan — it authors a committable template. The operator-facing setup (copying to `./.env`, filling secrets, generating the Fernet key, `docker compose up`) is documented IN the preset's usage-header and will be walked end-to-end by `docs/OPERATOR.md` (Plan 157-04) and exercised by the D-09 smoke (Plan 157-05).

## Threat Surface
No new surface beyond the plan's `<threat_model>` register. Mitigations satisfied: T-157-SEC (placeholders/blank only; header directs `cp` to the gitignored root `./.env`), T-157-KEY (`SECRETS_ENCRYPTION_KEY` documented with generate one-liner + fail-open/refuse-boot behavior), T-157-SC (no packages/images added — text template only). No Known Stubs (angle-bracket fill-me tokens are the correct form for an `.env.example`, not code stubs).

## Next Phase Readiness
- The env surface is settled — Plan 157-02 (frontend Dockerfile + nginx.conf + .dockerignore), 157-03 (docker-compose.prod.yml, which reads this file as the root `./.env` for both build-args and `env_file`), 157-04 (OPERATOR.md), and 157-05 (D-09 local smoke) can now build against it.
- No blockers. `REDIS_URL=redis://redis:6379` presumes the compose service is named `redis`; `FRONTEND_URL=http://localhost:8080` presumes the compose publishes nginx on 8080 — Plan 157-03 must honor both names/ports (or update this preset in lockstep).

## Self-Check: PASSED
- `deploy/onebox.env.example` — FOUND (203 lines)
- Commit `32ed1ae3` (Task 1) — FOUND
- Commit `9dba30c2` (Task 2) — FOUND

---
*Phase: 157-deployment-presets-runbook-stretch*
*Completed: 2026-07-16*
