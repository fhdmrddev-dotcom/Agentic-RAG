---
phase: 157-deployment-presets-runbook-stretch
plan: 02
subsystem: infra
tags: [docker, nginx, vite, reverse-proxy, sse, dockerfile, deployment]

# Dependency graph
requires:
  - phase: 157-01
    provides: the onebox.env preset surface that supplies the VITE_* build args this Dockerfile consumes
provides:
  - "frontend/nginx.conf — SPA static serve + /api/ SSE reverse-proxy to backend:8000 (trailing-slash strip via rewrite)"
  - "frontend/Dockerfile — 2-stage node:22-alpine build (npx vite build, VITE_* as build args) -> nginx:1.27-alpine serve"
  - "frontend/.dockerignore — excludes .env* + node_modules + dist + .git from the build context (T-157-SEC)"
affects: [157-03 docker-compose.prod.yml frontend service, 157-05 D-09 smoke, 158 install-wizard]

# Tech tracking
tech-stack:
  added: [nginx:1.27-alpine base image, node:22-alpine build stage]
  patterns:
    - "Build-time VITE_* injection via Docker ARG->ENV before npx vite build (Vite inlines import.meta.env.VITE_* at build)"
    - "Variable-upstream nginx reverse proxy with deferred DNS (resolver 127.0.0.11) + rewrite-based prefix strip"

key-files:
  created:
    - frontend/nginx.conf
    - frontend/Dockerfile
    - frontend/.dockerignore
  modified: []

key-decisions:
  - "Strip /api/ via `rewrite ^/api/(.*)$ /$1 break; proxy_pass $backend_upstream;` (NOT a trailing slash) because a trailing-slash strip does not work with a VARIABLE upstream — the variable form is required for the plan-mandated deferred-DNS resolver (Pitfall 6)."
  - "npx vite build (never the tsc-b build script) — matches vercel.json; avoids DEPLOYMENT-LESSONS A7 test-file type rot."
  - "Only browser-safe public VITE_* values baked (Supabase URL + anon key + /api); no secret keys as build args (T-157-VITE)."

patterns-established:
  - "Pattern: nginx variable-upstream reverse proxy strips a location prefix with a rewrite, not a proxy_pass trailing slash."
  - "Pattern: 2-stage SPA image — node build stage produces dist, nginx runtime stage serves it + proxies /api/."

requirements-completed: []  # DEPLOY-01 is phase-spanning (plans 01/02/03/04/05 + the D-09 smoke); NOT marked complete by this plan — 148-155 false-green-avoidance convention.

# Metrics
duration: ~18min
completed: 2026-07-17
---

# Phase 157 Plan 02: Frontend Build Trio (Dockerfile + nginx.conf + .dockerignore) Summary

**Net-new 2-stage frontend image (node:22-alpine `npx vite build` -> nginx:1.27-alpine serve) that static-serves the Vite `dist` and reverse-proxies `/api/` to the compose `backend:8000` with SSE passthrough and a secret-excluding build context.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-17
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 0

## Accomplishments
- `frontend/nginx.conf`: ported the recovered VPS guide's Step-10 server block, retargeted `127.0.0.1:8000` -> `backend:8000`; SPA `try_files` fallback, `client_max_body_size 100m`, SSE directives (`proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 300s`, `chunked_transfer_encoding on`), forwarding headers, and Pitfall-6 deferred DNS (`resolver 127.0.0.11` + `set $backend_upstream`).
- `frontend/Dockerfile`: 2-stage build — `node:22-alpine` declares the three `VITE_*` as `ARG` promoted to `ENV` before `npm ci` + `npx vite build`; `nginx:1.27-alpine` copies `dist` -> `/usr/share/nginx/html` and `nginx.conf` -> `/etc/nginx/conf.d/default.conf`, `EXPOSE 80`.
- `frontend/.dockerignore`: mirrors `backend/.dockerignore` — excludes `.env*` (T-157-SEC secret exclusion), `node_modules`, `dist`, `.git`, editor cruft, and test/coverage dirs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the nginx SPA + SSE reverse-proxy config, retargeted to backend:8000** - `1b107878` (feat)
2. **Task 2: 2-stage frontend Dockerfile + secret-excluding .dockerignore** - `dd9b06b6` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified
- `frontend/nginx.conf` - SPA static serve + `/api/` SSE reverse proxy to `backend:8000` (prefix strip via rewrite; deferred DNS)
- `frontend/Dockerfile` - 2-stage node-build -> nginx-serve image; `VITE_*` baked as build args; `npx vite build`
- `frontend/.dockerignore` - keeps the build context small and secret-free (excludes `.env*`)

## Decisions Made
- **nginx `/api/` strip via `rewrite`, not a trailing-slash `proxy_pass`** — see Deviations (Rule 1). The plan's task action mandated BOTH the deferred-DNS variable upstream (`resolver` + `set $backend_upstream`) AND a trailing-slash `proxy_pass $backend_upstream/;` to strip `/api/`. These two are mutually incompatible in nginx: with a variable upstream the directive URI is "passed literally," so the trailing slash does not strip the prefix. Kept the plan-mandated deferred-DNS variable form and implemented the strip the nginx-sanctioned way (`rewrite ^/api/(.*)$ /$1 break; proxy_pass $backend_upstream;`).
- **`npx vite build`** (not the `tsc -b`-chained package.json build script) — matches `frontend/vercel.json` `buildCommand: "vite build"` and avoids the DEPLOYMENT-LESSONS A7 test-file type-rot failure.
- **Base image tags pinned** `node:22-alpine` / `nginx:1.27-alpine` per 157-RESEARCH (T-157-SC).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] nginx `/api/` prefix strip: replaced the trailing-slash `proxy_pass` with a `rewrite`**
- **Found during:** Task 1 (nginx.conf)
- **Issue:** The plan's task action + acceptance criterion specified `proxy_pass $backend_upstream/;` (trailing slash) to strip `/api/`, on the SAME variable upstream (`set $backend_upstream http://backend:8000;`) required for the plan-mandated Pitfall-6 deferred-DNS `resolver`. Per nginx's documented `proxy_pass` semantics, when the upstream host is specified with a **variable** and a URI is present in the directive, "the URI is passed literally" — nginx cannot perform the location-prefix replacement. A variable `proxy_pass $backend_upstream/;` therefore forwards `/` for **every** `/api/*` request instead of stripping the prefix (e.g. `/api/threads` would reach the backend as `/` rather than `/threads`), breaking all API/SSE routing. The trailing-slash strip only works with a **literal** upstream, which is incompatible with the deferred-DNS variable form the plan required.
- **Fix:** Kept the deferred-DNS variable upstream (honoring the plan's explicit Pitfall-6 instruction) and stripped the prefix the nginx-sanctioned way: `rewrite ^/api/(.*)$ /$1 break;` followed by `proxy_pass $backend_upstream;` (no directive URI, so the rewritten `$uri` is forwarded). Verified mapping: `/api/health -> /health`, `/api/threads/abc?x=1 -> /threads/abc?x=1`.
- **Files modified:** `frontend/nginx.conf`
- **Verification:** Static: all required directives present (`try_files`, `client_max_body_size 100m`, `proxy_buffering off`, `proxy_read_timeout 300s`, `resolver 127.0.0.11`, `backend:8000`, `rewrite ^/api/`), braces balanced 3/3. Functional strip is proven end-to-end in the Plan 05 D-09 `docker compose up` smoke (the plan's designated end-to-end proof — "per-artifact proof here is static"). An in-tree Docker empirical test (mock backend echoing the received path) was prepared but could not run — see Issues Encountered.
- **Committed in:** `1b107878` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix is required for correctness — without it the reverse proxy would forward every `/api/*` request to `/`, breaking login and every chat turn. It preserves all other plan requirements (deferred DNS, SSE directives, 100m body, `backend:8000` target, trailing-slash *intent* of stripping `/api/`). No scope creep; no new infra.

## Known Stubs
None — these are static build-config artifacts with no data-flow stubs, placeholder values, or unwired components.

## Threat Surface
No new threat flags. The artifacts honor the plan's `<threat_model>` register exactly:
- **T-157-SEC** (mitigate) — `frontend/.dockerignore` excludes `.env*` (+ `node_modules`, `.git`, `dist`) so `frontend/.env.local` never enters an image layer.
- **T-157-VITE** (accept) — only browser-safe public values are baked as build args (Supabase URL + public anon key + relative `/api`); no service-role/secret keys.
- **T-157-SC** (mitigate) — official Docker Hub base tags pinned (`node:22-alpine`, `nginx:1.27-alpine`); no new npm/pip packages (`npm ci` installs the existing verified lockfile only).
The one trust boundary the nginx proxy introduces (browser -> nginx -> backend) is already in the plan's register; forwarding headers and unbuffered SSE passthrough are standard and add no new surface.

## Issues Encountered
- **Docker unavailable in this executor session.** The plan's per-artifact `nginx -t` acceptance check (`docker run --rm -v ... nginx:1.27-alpine nginx -t`) and a prepared empirical strip test (mock backend echoing `$request_uri` through each candidate config) both require the Docker daemon, which was denied in this session (both under and with the sandbox disabled). Mitigation: validated nginx.conf statically (directive greps + brace balance) and resolved the variable-`proxy_pass` strip semantics from nginx's official `proxy_pass` documentation. The docker-based syntax check and the live functional proof are covered by the Plan 05 D-09 smoke, which is the plan's designated end-to-end verification ("Build itself is exercised end-to-end only in the Plan 05 D-09 smoke; per-artifact proof here is static").

## User Setup Required
None - no external service configuration required by this plan. (The `VITE_*` build-arg values are supplied by the operator's one-box preset in Plan 01/03.)

## Next Phase Readiness
- The `frontend` service can now be wired into `docker-compose.prod.yml` (Plan 03) with `build: { context: ./frontend, args: { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL } }`.
- **Carry-forward for Plan 03/05:** because the strip now relies on a variable upstream + `resolver 127.0.0.11` (Docker embedded DNS), the compose MUST run the `frontend` service on a **user-defined network** (compose default) for `resolver 127.0.0.11` to resolve `backend`. Set `depends_on: [backend]` for start ordering (readiness is handled by the deferred DNS + nginx retry).
- **Carry-forward for Plan 05 (D-09 smoke):** confirm `/api/health` returns 200 through nginx (proves the rewrite strip: `/api/health -> /health`) in addition to the direct `:8000/health` curl.

---
*Phase: 157-deployment-presets-runbook-stretch*
*Completed: 2026-07-17*
