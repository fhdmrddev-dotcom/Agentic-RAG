---
phase: 157-deployment-presets-runbook-stretch
plan: 03
subsystem: infra
tags: [docker-compose, deployment, all-in-one, nginx, backend, redis, self-host, vite, supabase-external]

# Dependency graph
requires:
  - phase: 157-01
    provides: "deploy/onebox.env.example — the env surface the operator copies to root ./.env, which this compose reads for BOTH build-arg interpolation (VITE_*) and the backend env_file (runtime)"
  - phase: 157-02
    provides: "frontend/Dockerfile + nginx.conf (the net-new image the frontend service builds) + the carry-forward that all services MUST share a user-defined network (nginx resolver 127.0.0.11 + variable upstream backend:8000)"
provides:
  - "docker-compose.prod.yml — the 3-service ALL-IN-ONE prod reference stack: frontend (nginx) + backend (uvicorn via backend/Dockerfile) + bundled ephemeral redis, Supabase ALWAYS external (D-02)"
  - "The single-source-of-truth stack (D-01) that the one-box canonical path is + the managed variant layers on"
  - "The end-to-end target the Plan 05 D-09 smoke runs `docker compose -f docker-compose.prod.yml up` against"
affects: [157-04-operator-runbook, 157-05-d09-smoke, 158-install-wizard]

# Tech tracking
tech-stack:
  added: []  # no net-new npm/pip/cargo packages or images — redis:7-alpine (dev compose), python:3.12-slim (backend/Dockerfile), node:22-alpine + nginx:1.27-alpine (frontend/Dockerfile, Plan 02) are ALL already referenced
  patterns:
    - "Build-time-vs-runtime env split: ONE root ./.env feeds frontend VITE_* build.args (parse-time interpolation) AND the backend env_file (runtime) — the two mechanisms kept distinct"
    - "Shared user-defined bridge network so nginx's embedded-DNS variable upstream resolves the backend service name (default bridge would 502 — Plan 02 carry-forward)"
    - "Bundled ephemeral redis mirrored verbatim from docker-compose.dev.yml with the host-port publish + container_name DROPPED for prod"

key-files:
  created:
    - docker-compose.prod.yml
  modified: []

key-decisions:
  - "Explicit named top-level network `agentic-rag` attached to all three services (not the implicit compose default) — makes the Plan-02 shared-user-defined-network contract self-documenting and unambiguous; documented as a Rule 2 auto-add (the reverse proxy 502s without it)"
  - "backend publishes 8000:8000 with an inline 'nginx :8080 is the only REQUIRED ingress; drop this on a locked-down box' note (RESEARCH Q3 belt-and-suspenders — lets the smoke curl /health directly AND through nginx)"
  - "redis: dropped `container_name` (avoid collision with a running dev redis) and dropped the host-port publish (backend reaches it at redis://redis:6379 over the compose network — T-157-RED)"
  - "Docker daemon denied this session (same as Plan 02) → substituted a Python interpolate+parse validator that mirrors `docker compose config` (load ./.env → interpolate ${VAR}/${VAR:-default} → YAML parse → assert resolved structure); the LIVE `docker compose config` + up-build run in the Plan 05 D-09 smoke (by design per the phase note)"

patterns-established:
  - "All-in-one prod compose = frontend(nginx) + backend(reused Dockerfile) + bundled redis on a shared user-defined network; Supabase NEVER a service"

requirements-completed: []  # DEPLOY-01 is phase-spanning (preset + frontend image + compose + OPERATOR.md + D-09 smoke). This plan authors ONLY the compose artifact; DEPLOY-01 stays OPEN until the runbook + smoke land and the phase is verified (project false-green-avoidance convention, matching 157-01/157-02)

# Metrics
duration: ~15min
completed: 2026-07-17
---

# Phase 157 Plan 03: All-In-One Production Compose Stack Summary

**`docker-compose.prod.yml` — the ALL-IN-ONE reference stack (D-02): `frontend` (nginx builds ./frontend with the 3 VITE_* as build.args) + `backend` (inline build of the reused backend/Dockerfile, env_file ./.env, extra_hosts host-gateway, docker.sock mount, 8000:8000) + bundled ephemeral `redis` (mirrored from docker-compose.dev.yml, no host port), all on a shared user-defined bridge network, with Supabase ALWAYS external — never a service.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-17
- **Tasks:** 2
- **Files created:** 1 (`docker-compose.prod.yml`)
- **Files modified:** 0 (no app code, no STATE/ROADMAP)

## Accomplishments
- Authored the single-source-of-truth prod stack (D-01/D-02): one `docker compose -f docker-compose.prod.yml up -d --build` yields a browsable working app (minus the external managed DB) — the "run-these-commands" home-B install engine.
- Wired the build-time-vs-runtime env split correctly (the phase's #1 landmine): the 3 `VITE_*` pass as `frontend.build.args` (`${VITE_SUPABASE_URL}` / `${VITE_SUPABASE_ANON_KEY}` / `${VITE_API_BASE_URL:-/api}` — interpolated from the root `./.env` at parse time), while the backend reads the SAME `./.env` via `env_file` at runtime. No `VITE_*` leaks into the backend runtime env.
- Reused `backend/Dockerfile` AS-IS via inline `build: { context: ./backend }` (no app-code change); mirrored the `docker-compose.dev.yml` redis block verbatim (256mb allkeys-lru, save/appendonly off, redis-cli ping healthcheck), dropping the host port + `container_name` for prod.
- Carried the RESEARCH landmines onto the backend service: `extra_hosts: ["host.docker.internal:host-gateway"]` (Pitfall 2 — reach LOCAL Supabase in the D-09 smoke on Linux) and the `/var/run/docker.sock` mount (Pitfall 7 — the `execute_code` sandbox), each with a loud inline caveat.
- Honored every cross-plan contract: redis service named `redis`, nginx/frontend publishes `8080:80`, all three services on the shared user-defined `agentic-rag` bridge, redis with no public port, backend with host-gateway + `depends_on redis (service_healthy)`.
- Statically proved the compose interpolates + parses (3 services, no bundled DB, VITE_* resolve non-empty from `./.env`) via a Python substitute for `docker compose config` (Docker daemon denied this session — the live check is the Plan 05 D-09 smoke, by design).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the frontend + bundled redis services** - `e6aa92ef` (feat)
2. **Task 2: Author the backend service and validate the whole compose parses** - `e86e43ee` (feat)

_Plan metadata (this SUMMARY) committed separately after this file._

## Files Created/Modified
- `docker-compose.prod.yml` (created) — 3-service all-in-one prod stack. `frontend`: build `./frontend` with the 3 `VITE_*` build.args + `8080:80` ingress + `depends_on backend`. `backend`: inline build `./backend`, `env_file ./.env`, `depends_on redis (service_healthy)`, `extra_hosts host.docker.internal:host-gateway`, `/var/run/docker.sock` mount, `8000:8000`. `redis`: `redis:7-alpine` ephemeral (256mb LRU, no persistence, ping healthcheck), no host port. Top-level `networks: agentic-rag` (user-defined bridge) attached to all three. No `supabase`/`postgres`/`db` service.

## Decisions Made
- **Explicit `agentic-rag` network (not the implicit default):** the compose default network is already a user-defined bridge, but naming it and attaching all three services explicitly makes the Plan-02 carry-forward contract ("nginx `resolver 127.0.0.11` + variable upstream only resolves on a user-defined network") self-documenting and impossible to break by accident. Logged as a Rule 2 auto-add below.
- **backend `8000:8000` published (RESEARCH Q3):** belt-and-suspenders — the D-09 smoke can curl `http://localhost:8000/health` directly AND `http://localhost:8080/api/health` through nginx (proving the Plan-02 rewrite strip). Inline comment states nginx `:8080` is the only REQUIRED ingress and this port can be dropped on a locked-down box.
- **redis `container_name` + host port dropped:** per RESEARCH — avoids a collision with a running dev redis (`agentic-rag-redis`) and keeps 6379 off the host (T-157-RED; never expose publicly without `--requirepass`).
- **`docker compose config` substitute:** Docker was denied this session, so I mirrored what `config` does in Python (load `./.env` → interpolate `${VAR}`/`${VAR:-default}` → YAML parse → assert the resolved structure). PASS. The authoritative live `docker compose config` + `up --build` are the Plan 05 D-09 smoke — the phase note explicitly sanctions deferring the live checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added an explicit shared user-defined network**
- **Found during:** Task 1 (authoring the services)
- **Issue:** The plan's Task 1/2 `<action>` blocks specify the three services + their keys but do not mention a top-level `networks:` block. However, the cross-plan contract (from 157-02) requires all three services to share a **user-defined bridge network** — `frontend/nginx.conf` uses `resolver 127.0.0.11` (Docker's embedded DNS) + a variable upstream `backend:8000`, which resolves ONLY on a user-defined network. Without an explicit shared network the reverse proxy would 502 in the D-09 smoke.
- **Fix:** Declared a top-level `networks: { agentic-rag: { driver: bridge } }` and attached `frontend`, `backend`, and `redis` to it. (Functionally the compose default network is also a user-defined bridge, so this is defensive + self-documenting rather than behavior-changing, but it makes the contract explicit and un-break-able.)
- **Files modified:** `docker-compose.prod.yml`
- **Commit:** `e6aa92ef` (Task 1)

---

**Total deviations:** 1 auto-fixed (1 missing-critical-functionality). Everything else executed exactly as written — every `<acceptance_criteria>` item for both tasks verified statically.

## Known Stubs
None — this is a declarative reference-config artifact (compose YAML). No data-flow stubs, placeholder values that reach a UI, or unwired components. The `${VITE_*}` tokens are the correct build-arg interpolation form (resolved from `./.env`), not stubs.

## Threat Surface
No new surface beyond the plan's `<threat_model>` register — all four dispositions satisfied:
- **T-157-EOP** (mitigate) — the `/var/run/docker.sock` mount (= host root) carries a loud inline SINGLE-TENANT-ONLY caveat in the compose; the operational constraint is documented further in OPERATOR.md (Plan 04, D-08/B2). Required for `execute_code`; modeled as mitigated via the constraint.
- **T-157-RED** (mitigate) — bundled redis has NO host port publish; reachable only inside the compose network. Inline comment notes optional `--requirepass` if ever exposed.
- **T-157-CFG** (mitigate) — the root `./.env` is gitignored (`.gitignore` line 2 `.env`); the throwaway config-check copy was created for validation and **removed** (confirmed clean tree); secrets are injected at runtime via `env_file`, never baked into an image.
- **T-157-SC** (mitigate) — only official images referenced (`redis:7-alpine` pinned; backend/frontend inline-build from repo Dockerfiles). No npm/pip/cargo package added — slopcheck N/A.

No `threat_flag:` entries — the compose introduces no network endpoint, auth path, or schema surface not already in the register.

## Issues Encountered
- **Docker daemon denied this executor session** (identical to the Plan 02 session). The plan's Task 2 acceptance runs `cp deploy/onebox.env.example ./.env` then `docker compose -f docker-compose.prod.yml config` (exit 0). The daemon/CLI was unavailable, so per the phase note ("If the Docker daemon is unavailable... do the static string/structure assertions... and flag the live `docker compose config` + up-build for the Plan 05 D-09 smoke — that is by design") I substituted a Python validator that performs the same load→interpolate→parse→assert flow against a throwaway `./.env` (then removed it). Result: **PASS** — 3 services, no bundled DB, `VITE_*` interpolate to non-empty from `./.env`, all backend/redis/network keys present. The authoritative live `docker compose config` + `up -d --build` are the Plan 05 D-09 smoke.
- Harmless Git `LF will be replaced by CRLF` notice on Windows (line-ending normalization only) on both task commits.

## User Setup Required
None for this plan — it authors a committable reference-config file. The operator-facing flow (`cp deploy/onebox.env.example ./.env` → fill secrets + the local-smoke URL split → `docker compose -f docker-compose.prod.yml up -d --build`) is documented in the preset header (Plan 01), will be walked end-to-end by `docs/OPERATOR.md` (Plan 04), and is exercised by the D-09 smoke (Plan 05).

## Next Phase Readiness
- The compose stack is complete and statically validated — Plan 04 (`docs/OPERATOR.md`) can document it and Plan 05 (D-09 smoke) can run `docker compose -f docker-compose.prod.yml up` against it.
- **Carry-forward for Plan 05 (D-09 smoke), from the compose + RESEARCH Pitfalls 2/3/7:**
  1. `cp deploy/onebox.env.example ./.env` and fill the **local-smoke URL split** — browser build arg `VITE_SUPABASE_URL=http://127.0.0.1:54321` vs backend runtime `SUPABASE_URL=http://host.docker.internal:54321` + `POSTGRES_DSN=...@host.docker.internal:54322/...` (two vantage points onto the same local Supabase).
  2. `docker compose -f docker-compose.prod.yml up -d --build` (VITE_* bake at build → `--build` is required when a value changes).
  3. Verify **both** `curl http://localhost:8000/health` (direct) AND `curl http://localhost:8080/api/health` (through nginx — proves the Plan-02 `/api/` rewrite strip) → `200 {"status":"ok"}`.
  4. Make the **one chat turn a non-code (retrieval/chat) prompt** so the smoke passes even before the operator host-builds `agentic-rag-sandbox:101.1` (Pitfall 7 / RESEARCH A4).
- No blockers. All cross-plan contracts honored (redis name, 8080 publish, shared network, host-gateway, no bundled DB) — `deploy/onebox.env.example` did not need a lockstep change.

## Self-Check: PASSED
- `docker-compose.prod.yml` — FOUND
- Commit `e6aa92ef` (Task 1) — FOUND
- Commit `e86e43ee` (Task 2) — FOUND
- No `STATE.md` / `ROADMAP.md` / app-code modified (scope boundary held — only `docker-compose.prod.yml` created + this SUMMARY)

---
*Phase: 157-deployment-presets-runbook-stretch*
*Completed: 2026-07-17*
