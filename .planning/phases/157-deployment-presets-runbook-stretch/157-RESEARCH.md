# Phase 157: Deployment Presets & Runbook (STRETCH) - Research

**Researched:** 2026-07-17
**Domain:** Docker Compose packaging, nginx SPA reverse-proxy, env-var preset curation, operator runbook authoring
**Confidence:** HIGH (every artifact detail below is extracted verbatim from real repo files read this session)

## Summary

This is a **docs + reference-config only** phase (DEPLOY-01, STRETCH) — no app code, no migration, no UI. It ships three net-new artifacts: `docker-compose.prod.yml` (all-in-one: net-new nginx `frontend` + existing `backend/Dockerfile` + bundled ephemeral `redis`, Supabase always external), one or more curated `.env` presets layered on `backend/.env.example`, and a `docs/OPERATOR.md` day-0 runbook that supersedes the recovered VPS guide and bakes in the real `DEPLOYMENT-LESSONS.md` fixes. The single end-to-end proof (SC#3 / D-09) is a **local `docker compose -f docker-compose.prod.yml up`** of the one-box preset pointed at local Supabase + bundled Redis, verified via `/health` 200 + nginx frontend load + login + one chat turn.

The good news: every reusable input already exists and was read this session. The nginx block (SPA fallback + SSE proxy directives + trailing-slash strip), the exact Redis service block, the backend Dockerfile CMD (`${WORKER_COUNT:-2}`), the full env-var surface, and the 9 seed migrations are all verbatim-available below. The backend image reuses `backend/Dockerfile` unchanged. The only genuinely net-new build artifact is the `frontend/Dockerfile` + `nginx.conf` + `.dockerignore`.

The single biggest technical landmine — and the thing most likely to make SC#3 fail on the first try — is that the **frontend's `VITE_*` env vars are baked at BUILD time**, not runtime (confirmed: `import.meta.env.VITE_API_BASE_URL / VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY` in `frontend/src/lib/`). In an all-in-one compose that builds the frontend in a Docker stage, these MUST pass as `build.args` (Docker Compose interpolates them at parse time from a **root-level `.env` beside the compose file or the shell**, which is a *different* mechanism from the `env_file:` that feeds the backend at runtime). Getting this wrong produces a frontend that builds cleanly but can't reach Supabase or the API. Second landmine: `host.docker.internal` (needed only for the local-Supabase smoke test) requires `extra_hosts: ["host.docker.internal:host-gateway"]` on Linux.

**Primary recommendation:** Ship a two-stage `frontend/Dockerfile` (node build → nginx serve) that takes `VITE_*` as build args and runs `npx vite build` (never `npm run build`); mirror `docker-compose.dev.yml`'s redis block verbatim; reuse `backend/Dockerfile` via inline `build: { context: ./backend }`; make the one-box preset a single root-level `.env` that serves BOTH compose build-arg interpolation and the backend `env_file:`; and structure OPERATOR.md as one canonical home-B happy path (with the LESSONS fixes inlined) + short home-A/C/D variant sections that cross-link (never duplicate) the three existing `docs/DEPLOYMENT-*.md`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-09 — verbatim)

**Topology & artifact shape**
- **D-01:** OPERATOR.md + `docker-compose.prod.yml` target **BOTH** paths. The **portable one-box `docker compose up`** path (home B) is the **canonical/primary happy path**; the **managed Coolify+Vercel** path (home A) is documented as a **variant** that cross-links `docs/DEPLOYMENT-PIPELINE.md`. The compose file is the single source of truth; managed is a variant layered on top.
- **D-02:** `docker-compose.prod.yml` is **ALL-IN-ONE**: `frontend` (nginx serving the Vite `dist` + `/api/` reverse-proxy) + `backend` (uvicorn via existing `backend/Dockerfile`) + bundled `redis` (redis:7-alpine, ephemeral — mirror `docker-compose.dev.yml`'s `--save "" --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru` + healthcheck). **Supabase is ALWAYS external cloud — never bundled.** One `docker compose up` = a browsable working app (minus the managed DB). Makes SC#3 real.
- **D-03:** A **net-new `frontend/Dockerfile`** (+ `nginx.conf` + `frontend/.dockerignore`) is required — static-serve the Vite build + `/api/` → `backend:8000` reverse proxy. **Port the recovered guide's nginx block** (SPA `try_files` fallback, `client_max_body_size 100m` for uploads, `proxy_buffering off` + `proxy_read_timeout 300s` for SSE streaming, **trailing-slash strip** on `proxy_pass http://backend:8000/`). Build with **`vite build`, NOT `npm run build`** (tsc test-rot — DEPLOYMENT-LESSONS A7).

**Preset framing & scope (LEAN)**
- **D-04:** Presets use the **4-homes model**, not "3 VPS sizes." **Enterprise = homes C/D (on-prem / BYO-infra / local-GPU), explicitly NOT "a bigger VPS."** Scale (WORKER_COUNT, DB size, Redis memory) is a **dial turned inside a home** — documented as tuning guidance, not a separate product. The app already supports local models (`OLLAMA_BASE_URL` / `LMSTUDIO_BASE_URL` / `LLM_PROVIDER=ollama`) + multi-provider embeddings (Phase 111.1), so the on-prem/local-GPU story needs **no new app code**.
- **D-05 (LEAN — operator-chosen):** In 157, **fully build + smoke-test the two REAL-today homes**: (B) one-box self-host (the compose engine + a preset) and (A) the managed SaaS map (document-only, cross-linking the live pipeline). Homes **(C) BYO-cloud and (D) on-prem/air-gapped ship as SHORT "variant" sections** in OPERATOR.md — the key env-var deltas + the local-GPU pointer — **NOT** full step-by-step runbooks. The full sealed air-gapped runbook is **deferred**. Nothing is thrown away.
- **D-06:** Preset artifacts = curated `.env` example files (e.g. `deploy/onebox.env.example`) layered on `backend/.env.example`, each a filled-in settings file with matching defaults. **One-box preset baseline:** `WORKER_COUNT=2` (note "drop to 1 on a 1-vCPU box"), `SANDBOX_ENABLED=true`, `RERANK_ENABLED=false` (no torch on a 4 GB box — the cloud image already drops sentence-transformers), bundled Redis 256 MB, `POSTGRES_POOL_MAX=10`, Supabase cloud. On-prem variant deltas: `LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL` + `EMBEDDING_BASE_URL` (local) + self-hosted Supabase URL.

**OPERATOR.md scope & doc relationship**
- **D-07:** `docs/OPERATOR.md` is the **day-0 front-door "stand up from zero" runbook.** It **SUPERSEDES** the recovered bare-VPS guide (`.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — left in place as history, with a "superseded by docs/OPERATOR.md" header note; do NOT delete). It **CROSS-LINKS (never duplicates)** the three existing `docs/DEPLOYMENT-*.md`: PIPELINE (accounts/architecture map), WORKFLOW (day-2 branch promotion + parity checklist), LESSONS (failure modes).
- **D-08:** OPERATOR.md's happy path **BAKES IN** the real `DEPLOYMENT-LESSONS.md` fixes so an operator never re-hits them:
  - **(A6)** fresh-DB bootstrap: apply `supabase/full-schema.sql` **then** the seed migrations the schema-only dump misses (010, 018→087/088/089, 053, 056, 061, 066 — apply 087→088→089 in order) + the `INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING` row.
  - **(A4)** Postgres **SESSION pooler on :5432 (IPv4)** — not direct `db.<ref>` (IPv6-only), not `:6543` transaction pooler (breaks asyncpg).
  - **(A5)** `rediss://` **TLS** for managed Redis (Upstash).
  - **(B1)** multi-origin `FRONTEND_URL` (comma-split).
  - **(B2)** sandbox `docker.sock` mount (Directories mount, not File Mount) + **host-built image** + the `sandbox-image-keeper` pin container; note **GHCR/private-registry** as the durable fix (Coolify's image-prune wiped the host-built image twice).
  - **(B3)** pin known-good models per env (a model that works locally can 404 on cloud keys).
  - **(A3)** Coolify base-dir `/backend` + Ports Exposes **8000** + Domain `https://` (managed variant only).
  - **(SEC-01 / Phase 150)** generate + set `SECRETS_ENCRYPTION_KEY` (fail-open blank / malformed refuses boot); per-env in Coolify for managed.

**Smoke verification (SC#3)**
- **D-09:** Smoke proof = a **LOCAL `docker compose -f docker-compose.prod.yml up`** of the one-box preset, pointed at the operator's **local** Supabase (`SUPABASE_URL` / `POSTGRES_DSN` via `host.docker.internal`) + the bundled Redis → verify **/health 200**, the nginx **frontend loads**, **login** (test creds), **one chat turn** completes. This is the only thing that exercises the NEW compose file end-to-end (the live box uses `backend/Dockerfile` via Coolify, not compose). **Operator runs `docker compose up`; Claude guides + verifies /health via curl; operator confirms the chat turn.** OPERATOR.md also carries a "verification checklist" the operator runs against a real box.

### Claude's Discretion
- File layout for presets (`deploy/` dir vs `docs/presets/`), exact `nginx.conf` contents (port from the recovered guide), and OPERATOR.md section ordering — planner/executor decide, honoring D-01..D-09.
- Whether the compose `backend` service builds from `backend/Dockerfile` inline or references a pre-built tag — planner decides (inline build is simpler for a self-hoster).

### Deferred Ideas (OUT OF SCOPE)
- **Full sealed on-prem / air-gapped runbook** (self-hosted Supabase Docker stack + local-GPU Ollama/LM Studio end-to-end + no-internet install). 157 ships only the **variant-delta section**. Re-open: a real enterprise/on-prem buyer OR an explicit air-gapped requirement.
- **Full bring-your-own-cloud reference manifests** (AWS/Azure/GCP/Kubernetes). 157 ships only the **env-delta note**. Re-open: a customer commits to their own cloud.
- **Malware scanning (ClamAV) on uploads** as an Enterprise-preset add-on — parked in REQUIREMENTS "Future" ("once DEPLOY-02 exists").
- **First-run install wizard / `/setup` browser flow** = **Phase 158 (DEPLOY-02)** — 157 feeds it the presets. Not in 157.
- **Licensing / payment model + free-tier line** — a later separate business decision. Out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 (STRETCH) | An operator can stand up a production deployment from documented preset bundles — Solo/Team/Enterprise env-var + `docker-compose.prod.yml` reference configurations plus an `OPERATOR.md` runbook that supersedes the recovered VPS guides | This entire research: verbatim nginx block (§Code Examples), full env-var surface grouped secrets/infra/settings (§Env-Var Surface), exact redis service block, backend Dockerfile facts, verified 9-migration bootstrap sequence, and the build-time-VITE / host.docker.internal / compose-.env-interpolation landmines that make the smoke test pass first try |

**SC → artifact mapping** (ROADMAP wording is "Solo/Team/Enterprise"; CONTEXT D-04/D-05 reframes to 4 homes — reconcile as below):

| ROADMAP SC | 4-homes reconciliation |
|------------|------------------------|
| SC#1 "Solo/Team/Enterprise env-var + `docker-compose.prod.yml` reference configs exist + documented" | Solo/Team ≈ **home B one-box** (the fully-built compose + `deploy/onebox.env.example`, WORKER_COUNT dialed 1→2→N); Enterprise ≈ **homes C/D** (short variant-delta sections). Scale = a dial inside a home, not a separate product. |
| SC#2 "`OPERATOR.md` supersedes recovered VPS guides + walks a stand-up" | `docs/OPERATOR.md` = canonical home-B happy path + cross-links; recovered guide gets a "superseded" header note (kept as history). |
| SC#3 "Following the runbook with a preset → working deployment (smoke-verified)" | D-09 local one-box compose smoke test: `/health` 200 + frontend loads + login + 1 chat turn. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static SPA serving (Vite `dist`) | `frontend` container (nginx) | — | nginx serves `/usr/share/nginx/html`; SPA `try_files … /index.html` fallback |
| API reverse-proxy + SSE passthrough | `frontend` container (nginx) | `backend` container | nginx `/api/` → `http://backend:8000/` (trailing-slash strip); SSE needs `proxy_buffering off` + `proxy_read_timeout 300s` |
| Chat / agent loop / retrieval / tools | `backend` container (uvicorn) | — | Reuses `backend/Dockerfile` as-is; `${WORKER_COUNT:-2}` |
| Run-backed streaming buffer | `redis` container (bundled) | — | Ephemeral, 256 MB LRU, no persistence; backend reaches it at `redis://redis:6379` |
| Persistence (Postgres + pgvector + Auth + Storage + Realtime) | **External Supabase (cloud/local)** | — | **Never bundled** (D-02). Browser talks to Supabase directly (supabase-js auth); backend talks to it via `SUPABASE_URL` + `POSTGRES_DSN` |
| Code-execution sandbox | Host Docker daemon (via `/var/run/docker.sock`) | `backend` container | Backend spawns sibling containers; needs socket mount + host-built `agentic-rag-sandbox:101.1` image + keeper (LESSONS B2) |
| Provider LLMs / embeddings | External APIs OR local (Ollama/LM Studio) | — | Home D uses `OLLAMA_BASE_URL` / `EMBEDDING_BASE_URL` — zero new app code |
| Secrets at rest | env vars → optional Fernet (`SECRETS_ENCRYPTION_KEY`) | `app_settings` (encrypted col) | Phase 150; blank = plaintext fail-open, malformed = refuse boot |

## Standard Stack

### Core (all already in the repo or official base images — nothing net-new to select)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Docker Compose (v2 `docker compose`) | v2 syntax | Orchestrate frontend+backend+redis | Already the project's local-infra tool (`docker-compose.dev.yml`) `[VERIFIED: docker-compose.dev.yml]` |
| `redis:7-alpine` | 7-alpine | Bundled ephemeral stream buffer | **Already used** in `docker-compose.dev.yml` — mirror verbatim `[VERIFIED: docker-compose.dev.yml:17]` |
| `python:3.12-slim` (via `backend/Dockerfile`) | 3.12-slim | Backend image, reused as-is | **Already the production image** `[VERIFIED: backend/Dockerfile:9]` |
| nginx (alpine) | `nginx:1.27-alpine` (recommend) | Static SPA serve + `/api/` reverse proxy | Standard SPA-serving base; recovered guide uses host nginx `[ASSUMED tag — pin + verify]` |
| Node (alpine) build stage | `node:22-alpine` (recommend) | Runs `vite build` for the frontend | Recovered guide requires Node 22; Vite 8 needs Node ≥20.19 `[VERIFIED: RECOVERED guide Step 4 + frontend/package.json vite ^8.0.0]` |

### Supporting
| Artifact | Purpose | When to Use |
|----------|---------|-------------|
| `deploy/onebox.env.example` (path is Claude's discretion) | Curated one-box preset over `backend/.env.example` | Home B — the fully-built + smoke-tested preset |
| Root-level `.env` (beside `docker-compose.prod.yml`, gitignored) | Feeds BOTH compose `${...}` build-arg interpolation AND the backend `env_file:` | The operator's real filled-in copy of the preset |
| `frontend/.dockerignore` (net-new) | Keep `node_modules`, `dist`, `.env*`, `tests` out of the build context | Prevents leaking `frontend/.env.local` secrets into the image |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Building `dist` inside `frontend/Dockerfile` (build stage) | Pre-building `dist` on the host + `COPY` into an nginx-only image | Build-stage is self-contained (`docker compose up` just works — matches D-02's "one command"); pre-built dist needs an extra host step. **Recommend build-stage.** |
| Compose `backend` inline `build:` from `backend/Dockerfile` | Reference a pre-built/pushed tag | Inline build is simpler for a self-hoster (D-06 note; Claude's discretion in D-01-adjacent). **Recommend inline `build: { context: ./backend }`.** |
| `npm ci` in the frontend build | `npm install` | `npm ci` is reproducible and `frontend/package-lock.json` **exists** `[VERIFIED: Glob]`. **Recommend `npm ci`.** |

**Installation:** This phase installs **no new npm/pip/cargo packages.** It authors YAML/nginx/Dockerfile/Markdown text and references existing official Docker images. The frontend build uses the **existing** `frontend/package.json` (no new deps).

## Package Legitimacy Audit

> The Package Legitimacy Gate targets external **language** packages (npm/PyPI/crates). **This phase adds none** — no `package.json`, `requirements.txt`, or `Cargo.toml` change. slopcheck is therefore **N/A** (no packages to check). The only external artifacts are official Docker base images:

| Image | Registry | Disposition | Provenance |
|-------|----------|-------------|------------|
| `redis:7-alpine` | Docker Hub (official) | Approved — already in use | `[VERIFIED: docker-compose.dev.yml:17]` |
| `python:3.12-slim` | Docker Hub (official) | Approved — already the prod backend base | `[VERIFIED: backend/Dockerfile:9]` |
| `node:22-alpine` | Docker Hub (official) | Approved for build stage | `[ASSUMED]` tag — pin a digest at plan time; Node 22 required by recovered guide |
| `nginx:1.27-alpine` | Docker Hub (official) | Approved for runtime stage | `[ASSUMED]` tag — pin at plan time |

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages).
**Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram (all-in-one one-box compose, home B)

```
   Browser (operator's machine)
      │
      │  (1) HTTP GET / , /assets/*        (2) supabase-js: auth + realtime + storage
      │        │                                    │  (DIRECT to Supabase, not via backend)
      ▼        ▼                                     ▼
  ┌─────────────────────────────┐            ┌──────────────────────────────┐
  │  frontend container (nginx)  │            │  EXTERNAL Supabase            │
  │  :80  (published e.g. 8080)  │            │  (cloud https://<ref> OR      │
  │                              │            │   local host.docker.internal  │
  │  location /      → dist SPA  │            │   :54321 / :54322)            │
  │  location /api/  ────────────┼───(3)──┐   │  Postgres+pgvector+Auth+      │
  │    proxy_pass backend:8000/  │        │   │  Storage+Realtime             │
  │    (SSE: buffering off,      │        │   └──────────────┬───────────────┘
  │     read_timeout 300s)       │        │                  │ (5) SUPABASE_URL
  └─────────────────────────────┘        │                  │     POSTGRES_DSN
                                          ▼                  ▼
                             ┌──────────────────────────────────────┐
                             │  backend container (uvicorn)          │
                             │  :8000  WORKER_COUNT=2                 │
                             │  reads env_file (the preset .env)     │
                             │   ├─(4) REDIS_URL=redis://redis:6379 ─┼──► redis container
                             │   ├─(6) execute_code ─► /var/run/     │    (bundled, 256MB LRU,
                             │   │        docker.sock (host daemon) ─┼──►  ephemeral)
                             │   └─ providers: OpenAI/Anthropic/…    │──► external LLM APIs
                             │        OR Ollama/LM Studio (home D)   │    (or local GPU box)
                             └──────────────────────────────────────┘
```

Data-flow trace for the SC#3 smoke path: (1) browser loads SPA from nginx → (2) supabase-js logs in directly against Supabase → nginx proxies (3) `/api/threads` → backend → backend writes stream to (4) redis and reads run buffer back → SSE streams back through nginx (buffering off) → one chat turn completes. (5)/(6) are the backend's DB + sandbox dependencies.

### Component Responsibilities

| File (net-new unless noted) | Responsibility |
|------|----------------|
| `docker-compose.prod.yml` | Wires the 3 services + the bundled network; `backend` inline-builds `backend/Dockerfile`, `frontend` builds the net-new Dockerfile with `VITE_*` build args, `redis` mirrors the dev block |
| `frontend/Dockerfile` | 2-stage: `node:22-alpine` runs `npx vite build` (build args → `VITE_*`) → `nginx:1.27-alpine` serves `dist` + proxies `/api/` |
| `frontend/nginx.conf` | Ported recovered-guide server block (SPA fallback, 100m body, SSE proxy directives, trailing-slash strip) — retargeted `proxy_pass` to `http://backend:8000/` |
| `frontend/.dockerignore` | Excludes `node_modules`, `dist`, `.env*`, `tests` from build context |
| `deploy/onebox.env.example` | Curated one-box preset (the filled-in `.env` template) |
| `docs/OPERATOR.md` | Canonical home-B runbook + variant sections + cross-links + baked-in LESSONS fixes |
| `backend/Dockerfile` (**reuse, no edit**) | Already the prod backend image `[VERIFIED]` |
| `RECOVERED_VPS_Deployment_Guide.md` (**edit: header note only**) | Add "superseded by docs/OPERATOR.md" note; do NOT delete |

### Pattern 1: Build-time `VITE_*` injection via Docker build args (THE critical pattern)
**What:** Vite inlines `import.meta.env.VITE_*` into the JS bundle at build time. In a Docker build stage, they must be `ARG` → `ENV` **before** `vite build` runs.
**When to use:** Always, for the `frontend` service in the all-in-one compose.
**Example:**
```dockerfile
# frontend/Dockerfile — Source: pattern derived from Vite env semantics [CITED: vitejs.dev/guide/env-and-mode]
#                       + frontend/src/lib/api.ts:13, supabase.ts:3-4 [VERIFIED]
# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
# VITE_* are BUILD-TIME (baked into the bundle). Pass as build args, NOT runtime env.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL=/api
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# vite build, NOT `npm run build` (npm run build = `tsc -b && vite build`; tsc -b fails on test rot — LESSONS A7)
RUN npx vite build
# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```
And in compose:
```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}      # from the root-level .env (compose interpolation)
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/api}
```

### Pattern 2: One root-level `.env` serving both mechanisms
**What:** Docker Compose reads `${VAR}` interpolation from a `.env` beside the compose file (or the shell) — this feeds `build.args`. The **same file** can be named in `env_file:` on the backend service to inject runtime vars. Using ONE root `.env` (the operator's filled-in preset) avoids drift between build-time and runtime values.
**When to use:** The one-box preset. `deploy/onebox.env.example` → operator copies to `./.env` (repo root, gitignored) → compose interpolates build args AND the backend `env_file:` reads it.
**Anti-pattern:** Putting `VITE_*` under the backend's `environment:`/`env_file:` and expecting the frontend to pick them up — it won't; the frontend was already built.

### Pattern 3: SPA + SSE reverse proxy in-container (ported nginx)
Retarget the recovered guide's `proxy_pass http://127.0.0.1:8000/` to the compose service name `http://backend:8000/`. Keep the trailing slash (strips `/api/`). Keep `proxy_buffering off` + `proxy_read_timeout 300s` (SSE) and `client_max_body_size 100m` (uploads). See §Code Examples for the full block.

### Anti-Patterns to Avoid
- **`npm run build` in the Dockerfile** — runs `tsc -b` which fails on pre-existing test-file type rot (LESSONS A7; `frontend/package.json` build script = `tsc -b && vite build` `[VERIFIED]`). Use `npx vite build`.
- **Bundling Supabase/Postgres into the compose** — explicitly rejected (D-02). Supabase is always external.
- **Hardcoding the API URL absolute** — build with `VITE_API_BASE_URL=/api` (relative, same-origin through nginx) so the artifact is domain-agnostic. `frontend/src/lib/api.ts` reads this value directly; `OutputFileCard.tsx` falls back to `""` `[VERIFIED]`.
- **nginx resolving `backend` at startup** — if nginx starts before the backend DNS name resolves, it can fail. Prefer a `resolver 127.0.0.11` + variable upstream, OR `depends_on` + accept nginx's retry. See Pitfall 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backend prod image | A new Dockerfile | **Reuse `backend/Dockerfile` as-is** | Already py3.12-slim, drops sentence-transformers (~2 GB), `${WORKER_COUNT:-2}`, EXPOSE 8000 `[VERIFIED]` |
| Bundled Redis config | Custom redis tuning | **Copy the `docker-compose.dev.yml` redis block verbatim** | Already correct: ephemeral, 256 MB, LRU, healthcheck `[VERIFIED]` |
| nginx SPA+SSE config | Fresh nginx config | **Port the recovered guide's server block** | Battle-tested directives (trailing-slash strip, SSE timeouts, 100m body) `[VERIFIED]` |
| Fresh-DB schema | Replaying 100 migrations | **`supabase/full-schema.sql` single paste** + the 9 seed migrations | full-schema is the generated single-paste bootstrap; seed migrations are the documented gap `[VERIFIED]` |
| "Which migrations does cloud need" | Eyeballing | **`bash scripts/pending-cloud-migrations.sh`** | Diffs deploy ref vs `origin/production` `[VERIFIED]` |
| CORS multi-origin split | New parsing | Already done — `FRONTEND_URL` comma-split in `main.py:565` `[VERIFIED]` | Just set `FRONTEND_URL` correctly (B1) |

**Key insight:** Almost nothing here is net-new logic — it's *curation and assembly* of artifacts that already exist and are already correct. The failure mode is not "wrong code," it's "wrong wiring between build-time and runtime config" and "missed seed data on a fresh DB." Spend the effort there.

## Env-Var Surface (the presets curate this)

Full surface from `backend/.env.example` `[VERIFIED]`, grouped. **Two vars the app reads but `.env.example` OMITS** (gaps the preset MUST add): `FRONTEND_URL` (default `http://localhost:5173`, config.py:1168) and `ENVIRONMENT` (default `""`, config.py:933).

### Secrets (env only — never in DB/git)
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `POSTGRES_DSN` (embeds DB password), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `MINIMAX_API_KEY`, `ZHIPU_API_KEY`, `EMBEDDING_API_KEY`, `RERANK_API_KEY`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`, **`SECRETS_ENCRYPTION_KEY`** (the meta-secret — Fernet key; blank = plaintext fail-open + loud warning, malformed = refuse boot; generate via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).

### Infra / topology (env only — differs per home)
`SUPABASE_URL` (+ `SUPABASE_PROJECT_URL`, `SUPABASE_REST_URL`, `SUPABASE_GRAPHQL_URL`, `SUPABASE_FUNCTIONS_URL`), `DATABASE_URL`/`POSTGRES_*` (migrations/admin only, not runtime), `POSTGRES_DSN`, `POSTGRES_POOL_MIN` (2), `POSTGRES_POOL_MAX` (10), `REDIS_URL`, `WORKER_COUNT` (2), `SANDBOX_ENABLED` (true), `SANDBOX_IMAGE` (`agentic-rag-sandbox:101.1`), `OLLAMA_BASE_URL`, `LMSTUDIO_BASE_URL`, `EMBEDDING_BASE_URL`, `FRONTEND_URL` **(gap)**, `ENVIRONMENT` **(gap)**, `OPERATOR_EMAILS` (bootstrap — the operator's own email so they become operator on first boot).

### Settings (env defaults; many also DB-driven)
`LLM_PROVIDER` (openai), `*_MODELS` lists, `EMBEDDING_MODEL` (text-embedding-3-small), `EMBEDDING_DIMENSIONS` (1536), `RETRIEVAL_TOP_K` (5), `RETRIEVAL_MATCH_THRESHOLD` (0.3), `CHUNK_SIZE` (1000), `CHUNK_OVERLAP` (200), `HYBRID_SEARCH_ENABLED` (true), `HYBRID_CANDIDATE_COUNT` (20), `VECTOR_SEARCH_WEIGHT`/`KEYWORD_SEARCH_WEIGHT` (1.0), `RRF_K` (60), `RERANK_ENABLED` (**false** — keep for one-box), `RERANK_PROVIDER`/`RERANK_MODEL`/`RERANK_TOP_N`, `TAVILY_API_KEY`/`WEB_SEARCH_MAX_RESULTS`, `LANGSMITH_PROJECT`/`LANGSMITH_TRACING`/`LANGSMITH_TRACING_SAMPLING_RATE`, `PYMUPDF_TIMEOUT_S` (60), `LOG_FILE_PATH` (opt-in).

### Frontend BUILD-time (`VITE_*` — build args, NOT runtime) `[VERIFIED: frontend/src/lib/*]`
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (recommend `/api`).

### Local-model / on-prem confirmation (home D — D-04 claim verification)
**Confirmed present in `backend/.env.example`** `[VERIFIED]`: `LLM_PROVIDER=ollama` is a documented value (line 97-98), `OLLAMA_BASE_URL=http://localhost:11434` (132), `LMSTUDIO_BASE_URL=http://localhost:1234/v1` (135), `EMBEDDING_BASE_URL` (157), `EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS` support non-OpenAI (768=nomic, 384=MiniLM). **The on-prem/local-GPU story needs zero new app code — D-04's premise holds.**

## Fresh-DB Bootstrap Sequence (LESSONS A6 — VERIFIED against real filenames)

`supabase/full-schema.sql` is `pg_dump --schema=public` + a supplement (buckets/auth-trigger/realtime/vector) — it is **schema-only and MISSES seed rows** `[VERIFIED: full-schema.sql header + SETUP.md Path 2 + LESSONS A6]`. A fresh cloud DB needs, IN ORDER:

1. Paste **`supabase/full-schema.sql`** into the Supabase SQL editor (choose "Run without RLS" — the file enables RLS itself). One shot: tables + RLS + 4 storage buckets + `on_auth_user_created` trigger + realtime + pgvector.
2. Apply the **9 seed migrations** the schema-only dump misses. **All 9 filenames confirmed to exist** via `Glob supabase/migrations/*.sql` `[VERIFIED]`:

| # | Exact filename | Carries |
|---|----------------|---------|
| 010 | `010_app_settings.sql` | app_settings substrate |
| 018 | `018_skill_creator_seed.sql` | (superseded by 087) |
| 053 | `053_settings_unification.sql` | settings unification seed |
| 056 | `056_workflow_definitions.sql` | workflow defs seed |
| 061 | `061_harness_seed_templates.sql` | harness templates |
| 066 | `066_eval_coverage_seed.sql` | eval coverage seed |
| 087 | `087_skill_creator_reborn.sql` | skill-creator seed row (apply FIRST of the trio) |
| 088 | `088_skill_creator_eval_step_sequencing.sql` | UPDATEs 087's row (apply SECOND) |
| 089 | `089_skill_creator_file_attach_honesty.sql` | UPDATEs 087's row (apply THIRD) |

   **Order matters only within the trio: 087 → 088 → 089** (088/089 UPDATE the row 087 creates). All are idempotent — safe to re-run.
3. Insert the global settings row (the exact A6 fix):
   ```sql
   INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
   ```
   Without it, `save_app_settings` does `UPDATE … WHERE id='global'` → 0 rows → silent fake "Saved."
4. Verify skill-creator seeded: `SELECT count(*) FROM public.skills WHERE id='00000000-0000-0000-0000-000000000010' AND is_system=true` should return 1 (WORKFLOW.md §5). If 0, apply 087→088→089.
5. Set `OPERATOR_EMAILS` (the operator's email) so they're bootstrapped as operator on startup.

> Migrations currently run to **101** (`101_skill_files_unique_index.sql`) `[VERIFIED: Glob]`. `full-schema.sql` should already include ≤101 (it's regenerated per migration commit per CLAUDE.md); the seed-migration gap is orthogonal to schema currency.

## Common Pitfalls

### Pitfall 1: `VITE_*` set as runtime env → frontend can't reach Supabase/API
**What goes wrong:** Operator sets `VITE_SUPABASE_URL` under the frontend service's `environment:` and the built bundle still has empty/placeholder values → login fails, API calls 404.
**Why:** Vite inlines `import.meta.env.VITE_*` at **build** time; runtime env has no effect on an already-built bundle.
**How to avoid:** Pass them as `build.args` (Pattern 1). Rebuild (`docker compose build frontend` or `up --build`) whenever a `VITE_*` value changes — a plain `up` won't rebuild.
**Warning signs:** Blank Supabase URL error in browser console; `Failed to fetch`; login spinner hangs.

### Pitfall 2: `host.docker.internal` unresolved on Linux (breaks the D-09 smoke test)
**What goes wrong:** Backend container can't reach the operator's LOCAL Supabase at `host.docker.internal:54321/54322`.
**Why:** `host.docker.internal` resolves automatically on **Docker Desktop (Mac/Windows)** but NOT on native **Linux** without help.
**How to avoid:** Add to the `backend` service (harmless when pointed at cloud Supabase):
```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```
**Warning signs:** Backend logs "connection refused"/timeout to Supabase on a Linux host; works on the operator's Windows/Mac Docker Desktop but not a Linux VPS smoke test. `[CITED: docs.docker.com — host-gateway]`

### Pitfall 3: Browser vs backend see Supabase at DIFFERENT URLs (local smoke only)
**What goes wrong:** In the D-09 local-Supabase smoke test, the browser (on the host) reaches Supabase at `http://127.0.0.1:54321`, but the backend **container** must use `http://host.docker.internal:54321`.
**Why:** Two different network vantage points hitting the same local Supabase.
**How to avoid:** Set `VITE_SUPABASE_URL=http://127.0.0.1:54321` (browser-facing build arg) while `SUPABASE_URL=http://host.docker.internal:54321` and `POSTGRES_DSN=postgresql://postgres:postgres@host.docker.internal:54322/postgres` (backend runtime). For a real cloud deploy both are the same `https://<ref>.supabase.co`, so this split is a **local-smoke-only** wrinkle — document it clearly in OPERATOR.md's smoke section.

### Pitfall 4: `npm run build` fails the image build (LESSONS A7)
**What goes wrong:** `npm run build` = `tsc -b && vite build`; `tsc -b` errors on ~30 pre-existing test-file type-rot errors (SEED-056/049 baseline) → image build fails.
**How to avoid:** `RUN npx vite build` in the Dockerfile. Matches `frontend/vercel.json` (`"buildCommand": "vite build"`) `[VERIFIED]`.

### Pitfall 5: Compose `.env` interpolation ≠ `env_file:` (build args vs runtime)
**What goes wrong:** Operator puts `VITE_*` only in the file named by `env_file:` and build args interpolate to empty.
**Why:** `env_file:` injects **runtime** container env; `${VAR}` in the compose file interpolates from a `.env` beside the compose file (or the shell) at **parse** time. Different mechanisms.
**How to avoid:** Use ONE root-level `.env` (Pattern 2) that both mechanisms read; or duplicate the `VITE_*` into the shell before `docker compose build`. Document the exact copy step in OPERATOR.md.

### Pitfall 6: nginx fails to start resolving `backend` upstream
**What goes wrong:** nginx in the frontend container evaluates `proxy_pass http://backend:8000/` at config load; if it insists on resolving at startup and backend isn't up, it can error.
**How to avoid:** Simplest robust pattern — use Docker's embedded DNS with a variable so nginx defers resolution:
```nginx
    resolver 127.0.0.11 valid=10s;
    set $backend_upstream http://backend:8000;
    location /api/ {
        proxy_pass $backend_upstream/;   # variable form defers DNS to request time
        ...
    }
```
Alternatively add `depends_on: [backend]` (starts ordering only, not readiness) — but the resolver+variable form is the reliable fix. `[CITED: nginx variable proxy_pass DNS behavior]`

### Pitfall 7: Sandbox not wired → `execute_code` fails (LESSONS B2)
**What goes wrong:** `SANDBOX_ENABLED=true` but the backend container has no `/var/run/docker.sock` mount and no host-built image → "connection issue" or `404 pull access denied`.
**How to avoid:** For the compose, mount the socket on the `backend` service:
```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```
…and build the sandbox image on the host (`docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/`) + the keeper (`docker create --name sandbox-image-keeper agentic-rag-sandbox:101.1`). **For the D-09 smoke test, make the "one chat turn" a plain retrieval/chat prompt (no code execution)** so the smoke passes even before the operator builds the sandbox image. Note the security caveat: a mounted docker.sock = host root — single-tenant only.

### Pitfall 8: Session pooler `:5432` vs transaction pooler `:6543` (LESSONS A4)
**What goes wrong:** Using the direct `db.<ref>` (IPv6-only, container can't reach) or the `:6543` transaction pooler (breaks asyncpg prepared statements).
**How to avoid:** `POSTGRES_DSN` → the **Session pooler** `postgres.<ref>@...pooler.supabase.com:5432` (IPv4). Note Supavisor's `ECIRCUITBREAKER` after repeated bad-auth (wait ~3 min).

## Code Examples

### nginx.conf — ported from the recovered guide, retargeted for the container
```nginx
# frontend/nginx.conf — Source: RECOVERED_VPS_Deployment_Guide.md Step 10 [VERIFIED],
#                       retargeted proxy_pass 127.0.0.1:8000 → backend:8000 (compose service name)
server {
    listen 80;
    server_name _;
    client_max_body_size 100m;                 # document uploads (default 1MB → 413)

    root /usr/share/nginx/html;                 # nginx:alpine default web root (Vite dist copied here)
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;       # SPA client-side routing fallback
    }

    # Deferred DNS so nginx starts even if backend isn't up yet (Pitfall 6)
    resolver 127.0.0.11 valid=10s;
    set $backend_upstream http://backend:8000;

    location /api/ {
        proxy_pass $backend_upstream/;          # TRAILING SLASH strips /api/ → backend routes are /threads not /api/threads
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                    # SSE: don't buffer the stream
        proxy_cache off;
        proxy_read_timeout 300s;                # SSE: long-lived streaming connections
        chunked_transfer_encoding on;
    }
}
```
> The trailing slash on `proxy_pass …:8000/` is critical (strips `/api/`). `client_max_body_size 100m` is required for uploads. `proxy_buffering off` + `proxy_read_timeout 300s` keep SSE streaming working. `[VERIFIED: recovered guide notes lines 357-359]`

### redis service block — mirror verbatim from docker-compose.dev.yml
```yaml
# Source: docker-compose.dev.yml:16-35 [VERIFIED] — mirror for the bundled prod Redis.
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    # No host port publish needed in prod all-in-one: backend reaches it at redis://redis:6379
    # over the compose network. (Dev publishes 6379; the recovered VPS guide binds 127.0.0.1:6379.)
    command: >
      redis-server
      --save ""
      --appendonly no
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```
Backend connects with `REDIS_URL=redis://redis:6379` (service name). Drop `container_name` in prod (let compose namespace it) to avoid collisions with a running dev Redis.

### backend service — inline build from the existing Dockerfile
```yaml
# backend/Dockerfile is reused AS-IS [VERIFIED: EXPOSE 8000, CMD uvicorn …--workers ${WORKER_COUNT:-2}]
  backend:
    build:
      context: ./backend            # Dockerfile at backend/Dockerfile
    restart: unless-stopped
    env_file:
      - ./.env                      # the operator's filled-in one-box preset (root-level, gitignored)
    depends_on:
      redis:
        condition: service_healthy
    extra_hosts:
      - "host.docker.internal:host-gateway"   # Linux: reach local Supabase in the D-09 smoke (harmless for cloud)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock   # sandbox (single-tenant only — host root)
    # No host port needed if only nginx talks to it; publish 8000 only if you want direct /health curl.
    ports:
      - "8000:8000"                 # optional — lets Claude curl http://localhost:8000/health directly (D-09)
```

### `/health` endpoint contract (what the smoke test curls)
```python
# Source: backend/app/main.py:577-590 [VERIFIED]
@app.get("/health")   # no auth required
# returns HTTP 200 {"status": "ok", "redis": "ok"|"unreachable", "maintenance": <bool>}
```
D-09 proof: `curl http://localhost:8000/health` (or through nginx `curl http://localhost:8080/api/health`) → `200` with `"status":"ok"`. `redis` should read `"ok"` once the bundled redis is healthy.

### Fresh-DB bootstrap SQL (the A6 fix, verbatim)
```sql
-- After pasting full-schema.sql + the 9 seed migrations (010,018,053,056,061,066,087→088→089):
INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
-- verify skill-creator seed:
SELECT count(*) FROM public.skills
 WHERE id='00000000-0000-0000-0000-000000000010' AND is_system=true;   -- expect 1
```

## State of the Art

| Old Approach (recovered VPS guide) | Current Approach (this phase) | Impact |
|--------------------------------------|-------------------------------|--------|
| Host nginx + systemd + venv + WinSCP zip upload | `docker compose -f docker-compose.prod.yml up` (containerized) | One command; reproducible; supersedes the manual guide |
| Frontend built on the host into `/var/www/.../dist` | Frontend built in a Docker stage, served by nginx container | Self-contained image; `VITE_*` become build args |
| `proxy_pass http://127.0.0.1:8000/` | `proxy_pass http://backend:8000/` (compose DNS) | Same directives, container-networked |
| Redis via `docker run` one-liner on the host | Bundled `redis` compose service | Part of the stack; healthchecked |
| Managed-only (Coolify+Vercel) as the only story | Portable one-box canonical + managed as a variant | D-01: compose is the source of truth |

**Deprecated/outdated in the recovered guide (do NOT carry forward into OPERATOR.md):**
- Ubuntu 25.04 / Python 3.13 / manual venv — replaced by the container (`python:3.12-slim`).
- WinSCP zip-upload staging — replaced by `git clone` + `docker compose`.
- Manual `postgrest-py maybe_single()` patch — already auto-patched at startup (`main.py`), noted as historical in the guide itself.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node:22-alpine` for the build stage, `nginx:1.27-alpine` for runtime | Standard Stack | LOW — any Node ≥20.19 + any recent nginx alpine works; planner should pin a digest and can bump. Verify tags at plan time. |
| A2 | Recommend inline `build:` for both frontend and backend services (vs pre-built tags) | Alternatives | LOW — D-01/D-06 leave this to planner's discretion; inline is simpler for a self-hoster. |
| A3 | `VITE_API_BASE_URL=/api` (relative) is the right build value for the all-in-one | Env-Var Surface | LOW — `api.ts` reads the value directly; `/api` is same-origin through nginx. If wrong, absolute URL also works but couples the build to a domain. |
| A4 | The D-09 smoke "one chat turn" should be a non-code prompt so it doesn't require the host-built sandbox image | Pitfall 7 | LOW — avoids a false-fail; planner should state this explicitly in the smoke steps. |
| A5 | `full-schema.sql` already includes schema through migration 101 | Bootstrap | LOW — regenerated per migration commit (CLAUDE.md); orthogonal to the seed-row gap. Planner may add a "regen if stale" note. |
| A6 | Preset lives at `deploy/onebox.env.example` and the operator's real file at repo-root `./.env` | Pattern 2 | LOW — file layout is explicit Claude's-discretion (D-06). The root-`.env` placement is what makes compose interpolation work; if planner chooses `deploy/.env`, the compose must be invoked with `--env-file deploy/.env`. |

**Note:** No `[ASSUMED]` claims touch compliance/retention/security-standard requirements. The security-relevant items (docker.sock=host-root, `SECRETS_ENCRYPTION_KEY` boot behavior, operator gate) are all `[VERIFIED]` from source.

## Open Questions

1. **Preset file location + compose `--env-file` wiring**
   - What we know: D-06 says presets are curated `.env` files; file layout is Claude's discretion. Compose build-arg interpolation reads a `.env` beside the compose file (or via `--env-file`).
   - What's unclear: `deploy/onebox.env.example` → does the operator copy to repo-root `./.env` (auto-interpolated) or keep it at `deploy/onebox.env` and run `docker compose --env-file deploy/onebox.env …`?
   - Recommendation: Pick ONE and document the exact `cp` + `docker compose` invocation in OPERATOR.md. Root-`./.env` is the zero-flag path; `--env-file` is more explicit. Planner decides.

2. **How many preset files ship**
   - What we know: D-05 fully builds home B; homes C/D are short variant sections. D-06 names `deploy/onebox.env.example` and "on-prem variant deltas."
   - What's unclear: Is home D a second full `deploy/onprem.env.example` file, or just a delta table inside OPERATOR.md?
   - Recommendation: One full `deploy/onebox.env.example` (home B, smoke-tested) + a delta **table** in OPERATOR.md for C/D (not a second maintained file, per LEAN D-05). Avoids shipping an unvalidated air-gapped preset.

3. **Does the D-09 smoke publish the backend port, or curl through nginx?**
   - What we know: `/health` is unauthenticated; nginx proxies `/api/` → backend (so `/api/health` works through nginx too).
   - Recommendation: Publish `8000:8000` on backend during smoke so Claude can `curl localhost:8000/health` directly AND verify `localhost:<nginx>/api/health` — belt and suspenders. Optionally comment the direct port out in the shipped compose (nginx is the only needed ingress).

4. **`ENVIRONMENT=production` — set it, but it's no longer security-critical.**
   - What we know: config.py:930-933 `[VERIFIED]` — `environment` "no longer gates /admin; Phase 146 replaced the dev fail-open with the require_operator gate." It's now just a deploy marker + test guard.
   - Recommendation: Set `ENVIRONMENT=production` in presets for cleanliness, but do NOT document it as the operator-security control. The real operator-access control is `OPERATOR_EMAILS` + the `operator_users` table. (This corrects a plausible-but-stale assumption.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine + Compose v2 | Building/running the compose; the D-09 smoke | Assumed on operator machine | — | None — hard requirement for home B (this is the product) |
| Local Supabase (CLI) | D-09 smoke test target | Per CLAUDE.md, project runs it locally | :54321 API / :54322 PG | Point smoke at a throwaway cloud Supabase instead |
| `agentic-rag-sandbox:101.1` host image | `execute_code` if the smoke turn uses it | Only if operator built it | 101.1 | Make the smoke turn a non-code prompt (A4) |
| Node 22 / nginx (base images) | frontend Dockerfile stages | Pulled from Docker Hub at build | 22-alpine / 1.27-alpine | Any Node ≥20.19 + recent nginx alpine |

**Missing dependencies with no fallback:** Docker itself (but it IS the deployment target — not a blocker, it's the premise).
**Missing dependencies with fallback:** Local Supabase (→ cloud), sandbox image (→ non-code smoke turn).

> Note: this phase authors **files**; it does not execute app code. The only runtime exercise is the D-09 operator-run smoke test. No test framework is invoked by the artifacts.

## Validation Architecture

> nyquist_validation is enabled (`.planning/config.json` → `workflow.nyquist_validation: true`) `[VERIFIED]`. This is a docs/config phase with **no automated app-test surface** — validation is (a) static existence/lint/parse checks and (b) the D-09 operator-run smoke test. There is no pytest/vitest target for these artifacts; do NOT manufacture unit tests.

### Test "framework" (static checks only)
| Property | Value |
|----------|-------|
| Compose validity | `docker compose -f docker-compose.prod.yml config` (parses + interpolates — exit 0) |
| nginx syntax | `docker run --rm -v $PWD/frontend/nginx.conf:/etc/nginx/conf.d/default.conf nginx:1.27-alpine nginx -t` |
| Preset key sanity | every key in `deploy/*.env.example` exists in `backend/.env.example` OR is a documented gap (`FRONTEND_URL`, `ENVIRONMENT`, `VITE_*`) |
| Doc cross-links | OPERATOR.md links to the 3 `docs/DEPLOYMENT-*.md` resolve; no dead reference to the superseded guide except the explicit "supersedes" note |

### Phase Requirements → Proof Map
| SC | Behavior | Proof type | Concrete check |
|----|----------|-----------|----------------|
| SC#1 | Preset + compose reference configs exist + documented | static existence | `docker-compose.prod.yml`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `deploy/onebox.env.example` all exist; `docker compose config` exits 0; every preset key traces to `.env.example` or a documented gap |
| SC#2 | OPERATOR.md supersedes recovered guide + walks a stand-up | static + review | `docs/OPERATOR.md` exists with home-B happy path + baked-in A4/A5/A6/B1/B2/B3/SEC-01 fixes + cross-links; recovered guide has the "superseded" header note (not deleted) |
| SC#3 | Runbook + preset → working deployment | **live D-09 smoke** | operator runs `docker compose -f docker-compose.prod.yml up --build` (one-box preset → local Supabase via host.docker.internal + bundled redis); Claude curls `/health`→200 `"status":"ok"`; operator confirms nginx frontend loads, login works, one (non-code) chat turn completes |

### Sampling
- **Per artifact commit:** the relevant static check (`docker compose config` after compose edits; `nginx -t` after nginx edits).
- **Phase gate:** the full D-09 smoke — the ONLY end-to-end exercise of the new compose file — green before `/gsd:verify-work`.

### Wave 0 gaps
- [ ] None in the test-infrastructure sense (no framework to install). The "Wave 0" equivalent is authoring `deploy/onebox.env.example` first, since both the compose build args and the backend runtime read it — everything else depends on it.

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` → treated as enabled. This is a config/docs phase; the security surface is the deployment posture the artifacts encode, not app code.

### Applicable controls

| Area | Applies | Standard control in these artifacts |
|------|---------|-------------------------------------|
| Secrets management | yes | `.env`/preset files are gitignored (`.gitignore` line 2 `.env` `[VERIFIED]`); `frontend/.dockerignore` MUST exclude `.env*` so `frontend/.env.local` never enters the image; `SECRETS_ENCRYPTION_KEY` (Fernet) encrypts provider keys at rest (Phase 150) — blank=plaintext+warning, malformed=refuse boot |
| Transport | yes | Managed Redis MUST be `rediss://` TLS (A5); cloud Supabase is `https://`; managed variant Coolify domain `https://` (A3) |
| Access control (operator) | yes | `/admin` is default-deny `require_operator` (404 to non-operators) — `ENVIRONMENT` no longer affects this (Phase 146). Operator bootstrap via `OPERATOR_EMAILS`. |
| CORS | yes | `FRONTEND_URL` comma-split multi-origin (B1); must list every live frontend origin |
| Sandbox isolation | yes (caveat) | `/var/run/docker.sock` mount = **host root** → single-tenant boxes ONLY. OPERATOR.md must state this loudly. GHCR/private-registry is the durable image-availability fix (B2). |
| Redis exposure | yes | Bundled redis needs NO host port in prod (backend reaches it over the compose network); never publish 6379 publicly without `--requirepass` |

### Threat patterns for this stack

| Pattern | STRIDE | Mitigation encoded in the artifacts |
|---------|--------|-------------------------------------|
| Secret leakage via image layers | Information disclosure | `.dockerignore` excludes `.env*`; env injected at runtime, never baked (backend/.dockerignore precedent `[VERIFIED]`) |
| docker.sock → host takeover | Elevation of privilege | Documented single-tenant-only constraint; not for multi-tenant |
| Plaintext provider keys at rest | Information disclosure | `SECRETS_ENCRYPTION_KEY` set → Fernet encryption; runbook instructs generating it |
| Open CORS / preflight 400 | Spoofing / DoS | Exact multi-origin `FRONTEND_URL` guidance (B1) |
| Public Redis with no auth | Tampering | No host publish in prod compose; localhost-only + optional `--requirepass` note (recovered guide) |

## Sources

### Primary (HIGH confidence — read verbatim this session)
- `backend/.env.example` — full env-var surface, defaults, local-model vars, SECRETS_ENCRYPTION_KEY behavior
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — the nginx server block (Step 10), redis one-liner, `npx vite build` note, verification checklist
- `docs/DEPLOYMENT-LESSONS.md` — A1–A7, B1–B5 (the fixes to bake in)
- `docs/DEPLOYMENT-WORKFLOW.md` — branch promotion + parity checklist + the 087/088/089 seed-verify SQL
- `docs/DEPLOYMENT-PIPELINE.md` — home-A accounts/architecture map (Vercel + Coolify + Supabase + Upstash; superrag.cloud)
- `docker-compose.dev.yml` — the exact redis service block to mirror
- `backend/Dockerfile` — py3.12-slim, EXPOSE 8000, `CMD … --workers ${WORKER_COUNT:-2}`, drops sentence-transformers
- `backend/Dockerfile.sandbox` — host-built sandbox image + tag 101.1
- `backend/.dockerignore` — the exclude pattern to mirror for frontend
- `frontend/package.json` (build script `tsc -b && vite build`; vite ^8), `frontend/vite.config.ts` (dist default, no outDir override), `frontend/vercel.json` (`buildCommand: vite build`)
- `frontend/src/lib/api.ts:13`, `supabase.ts:3-4`, `components/chat/OutputFileCard.tsx:13` — `import.meta.env.VITE_*` (build-time)
- `backend/app/main.py:565,577-590` — `FRONTEND_URL` comma-split + `/health` body
- `backend/app/config.py:773,933,1168` — `llm_model` default, `environment` semantics (no longer gates /admin), `frontend_url` default
- `supabase/full-schema.sql` (header — schema-only single-paste), `supabase/SETUP.md` (Path 2), `REDIS-SETUP.md` (rediss:// TLS)
- `scripts/pending-cloud-migrations.sh` — migration parity diff
- `Glob supabase/migrations/*.sql` — verified all 9 seed migration filenames + current max = 101
- `.planning/config.json` (nyquist on, commit_docs on), `.planning/ROADMAP.md` (SCs), `.planning/REQUIREMENTS.md` (DEPLOY-01)

### Secondary (MEDIUM confidence)
- Docker `host-gateway` / `extra_hosts` behavior on Linux — widely documented Docker feature `[CITED: docs.docker.com]`
- nginx variable `proxy_pass` + `resolver` deferred DNS — standard nginx-in-containers pattern `[CITED]`
- Vite build-time env inlining — corroborated by the code grep + `vercel.json` `[CITED: vitejs.dev]`

### Tertiary (LOW confidence)
- Specific base-image tags (`node:22-alpine`, `nginx:1.27-alpine`) — recommendation only; planner should pin/verify at plan time.

## Metadata

**Confidence breakdown:**
- Standard stack / artifacts: HIGH — every reusable block read verbatim; nothing net-new to select except two base-image tags.
- Architecture / wiring: HIGH — the build-time-VITE, host.docker.internal, and compose-.env-interpolation landmines are grounded in read source (code grep + Vite semantics + Docker docs).
- Bootstrap sequence: HIGH — all 9 seed migration filenames verified against the real directory; the A6 SQL is verbatim.
- Pitfalls: HIGH — each maps to a documented LESSONS entry or verified source fact.
- Base-image tag choices: MEDIUM — recommendations, not registry-verified this session.

**Research date:** 2026-07-17
**Valid until:** ~2026-08-16 (30 days — stable domain; the only drift risk is base-image tags and migration count moving past 101).
