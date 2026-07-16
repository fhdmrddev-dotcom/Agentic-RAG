# Phase 157: Deployment Presets & Runbook (STRETCH) - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Docs + reference-config only (DEPLOY-01, STRETCH). **No app code, no migration, no UI.** Deliver three things so any operator can stand up a production deployment repeatably:

1. A `docker-compose.prod.yml` **all-in-one** reference stack.
2. **Preset** env-var bundles (curated `.env` files) that layer on `backend/.env.example`.
3. A `docs/OPERATOR.md` **day-0 runbook** that supersedes the recovered VPS guide and bakes in the real deployment lessons — smoke-verified once.

**Framing (operator directive):** deployment is modeled as **four "homes"** for one codebase (see the published deployment map: https://claude.ai/code/artifact/00e107fa-ac01-4300-ba2b-daed7c98e3d3). Where each piece runs is **configuration, not a code change**. Homes:
- **(A) You host it / SaaS** — vendor infra; = superrag.cloud today.
- **(B) One-box self-host** — customer's single server, `docker compose up` (the "run-these-commands" install).
- **(C) Bring-your-own-cloud** — customer's AWS/Azure/GCP + ops team.
- **(D) On-prem / air-gapped** — sealed inside the building, **AI models on their own GPUs** (Ollama/LM Studio, already supported), self-hosted Supabase, no internet.

**NOT SC#10-flagged:** this phase touches nothing in streaming / agent-loop / provider-routing / UI-state, so the 4-axis cross-provider UAT mandate does **not** apply. Do not manufacture UAT rows.

</domain>

<decisions>
## Implementation Decisions

### Topology & artifact shape
- **D-01:** OPERATOR.md + `docker-compose.prod.yml` target **BOTH** paths. The **portable one-box `docker compose up`** path (home B) is the **canonical/primary happy path**; the **managed Coolify+Vercel** path (home A) is documented as a **variant** that cross-links `docs/DEPLOYMENT-PIPELINE.md`. The compose file is the single source of truth; managed is a variant layered on top. (Rejected: managed-only — then compose has no reason to exist; portable-only — drops the live-pipeline map.)
- **D-02:** `docker-compose.prod.yml` is **ALL-IN-ONE**: `frontend` (nginx serving the Vite `dist` + `/api/` reverse-proxy) + `backend` (uvicorn via existing `backend/Dockerfile`) + bundled `redis` (redis:7-alpine, ephemeral — mirror `docker-compose.dev.yml`'s `--save "" --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru` + healthcheck). **Supabase is ALWAYS external cloud — never bundled.** One `docker compose up` = a browsable working app (minus the managed DB). Makes SC#3 real.
- **D-03:** A **net-new `frontend/Dockerfile`** (+ `nginx.conf` + `frontend/.dockerignore`) is required — static-serve the Vite build + `/api/` → `backend:8000` reverse proxy. **Port the recovered guide's nginx block** (SPA `try_files` fallback, `client_max_body_size 100m` for uploads, `proxy_buffering off` + `proxy_read_timeout 300s` for SSE streaming, **trailing-slash strip** on `proxy_pass http://backend:8000/`). Build with **`vite build`, NOT `npm run build`** (tsc test-rot — DEPLOYMENT-LESSONS A7).

### Preset framing & scope (LEAN)
- **D-04:** Presets use the **4-homes model**, not "3 VPS sizes." **Enterprise = homes C/D (on-prem / BYO-infra / local-GPU), explicitly NOT "a bigger VPS."** Scale (WORKER_COUNT, DB size, Redis memory) is a **dial turned inside a home** — documented as tuning guidance, not a separate product. The app already supports local models (`OLLAMA_BASE_URL` / `LMSTUDIO_BASE_URL` / `LLM_PROVIDER=ollama`) + multi-provider embeddings (Phase 111.1), so the on-prem/local-GPU story needs **no new app code**.
- **D-05 (LEAN — operator-chosen):** In 157, **fully build + smoke-test the two REAL-today homes**: (B) one-box self-host (the compose engine + a preset) and (A) the managed SaaS map (document-only, cross-linking the live pipeline). Homes **(C) BYO-cloud and (D) on-prem/air-gapped ship as SHORT "variant" sections** in OPERATOR.md — the key env-var deltas + the local-GPU pointer — **NOT** full step-by-step runbooks. The full sealed air-gapped runbook is **deferred** (see Deferred, with a concrete re-open trigger). Nothing is thrown away; the enterprise runbook is written properly when a real buyer exists to validate it.
- **D-06:** Preset artifacts = curated `.env` example files (e.g. `deploy/onebox.env.example`) layered on `backend/.env.example`, each a filled-in settings file with matching defaults. **One-box preset baseline:** `WORKER_COUNT=2` (note "drop to 1 on a 1-vCPU box"), `SANDBOX_ENABLED=true`, `RERANK_ENABLED=false` (no torch on a 4 GB box — the cloud image already drops sentence-transformers), bundled Redis 256 MB, `POSTGRES_POOL_MAX=10`, Supabase cloud. On-prem variant deltas: `LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL` + `EMBEDDING_BASE_URL` (local) + self-hosted Supabase URL.

### OPERATOR.md scope & doc relationship
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

### Smoke verification (SC#3)
- **D-09:** Smoke proof = a **LOCAL `docker compose -f docker-compose.prod.yml up`** of the one-box preset, pointed at the operator's **local** Supabase (`SUPABASE_URL` / `POSTGRES_DSN` via `host.docker.internal`) + the bundled Redis → verify **/health 200**, the nginx **frontend loads**, **login** (test creds), **one chat turn** completes. This is the only thing that exercises the NEW compose file end-to-end (the live box uses `backend/Dockerfile` via Coolify, not compose). **Operator runs `docker compose up`; Claude guides + verifies /health via curl; operator confirms the chat turn.** OPERATOR.md also carries a "verification checklist" the operator runs against a real box.

### Claude's Discretion
- File layout for presets (`deploy/` dir vs `docs/presets/`), exact `nginx.conf` contents (port from the recovered guide), and OPERATOR.md section ordering — planner/executor decide, honoring D-01..D-09.
- Whether the compose `backend` service builds from `backend/Dockerfile` inline or references a pre-built tag — planner decides (inline build is simpler for a self-hoster).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The guide being superseded + existing deployment docs
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — the bare-VPS (nginx/systemd/venv/WinSCP) guide OPERATOR.md supersedes; **source of the nginx block** to port into `frontend/Dockerfile` (SPA fallback, 100m body, SSE proxy timeouts, trailing-slash strip).
- `docs/DEPLOYMENT-PIPELINE.md` — the live architecture + accounts map (Vercel + Coolify + Supabase cloud + Upstash; superrag.cloud); the managed-variant cross-link (home A).
- `docs/DEPLOYMENT-WORKFLOW.md` — day-2 branch promotion (develop→master→production) + the cloud-parity checklist; cross-linked, not duplicated.
- `docs/DEPLOYMENT-LESSONS.md` — **the failure modes OPERATOR.md must bake into the happy path** (A1–A7 initial-deploy gotchas; B1–B5 post-deploy bugs; recurring themes).

### Config surface the presets curate
- `backend/.env.example` — the canonical env-var surface; presets are curated fill-ins of this.
- `backend/Dockerfile` — the existing backend prod image; the compose `backend` service reuses it (py3.12-slim, drops sentence-transformers, `${WORKER_COUNT:-2}`).
- `backend/Dockerfile.sandbox` — the sandbox image (host-built + keeper; GHCR for enterprise); current tag `agentic-rag-sandbox:101.1`.
- `docker-compose.dev.yml` — the Redis service shape to **mirror** in the prod compose (ephemeral, maxmemory-lru, healthcheck).
- `supabase/full-schema.sql` — single-file bootstrap artifact for a fresh cloud DB (schema-only — MISSES seed rows, per LESSONS A6).
- `supabase/SETUP.md` — Supabase local + cloud + migrations story.
- `REDIS-SETUP.md` — Redis local + cloud (Upstash `rediss://`) + run-buffer key conventions.
- `scripts/pending-cloud-migrations.sh` — lists migrations not yet on production (parity aid).

### Requirements / roadmap / rules
- `.planning/ROADMAP.md` → "### Phase 157: Deployment Presets & Runbook (STRETCH)" — goal + the 3 Success Criteria.
- `.planning/REQUIREMENTS.md` → DEPLOY-01 (+ DEPLOY-02 for Phase 158 context).
- `CLAUDE.md` → "## Deployment (cloud) — operator-gated" + "## Local dev infrastructure" — operator-gated deploy rules + the sandbox-image tag/keeper discipline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/Dockerfile` — reuse **as-is** as the compose `backend` service (no changes expected).
- `docker-compose.dev.yml` `redis:` service — mirror verbatim for the prod bundled Redis.
- `backend/.env.example` — the base every preset layers on.
- Recovered guide's nginx block — port into the net-new `frontend/Dockerfile` + `nginx.conf`.
- `supabase/full-schema.sql` + the LESSONS-A6 seed-migration list — the fresh-DB bootstrap sequence for OPERATOR.md.

### Established Patterns
- **Local↔cloud↔on-prem = env-var-only switch (no code changes)** — the presets *productize* this pattern. This is the architectural fact that makes 4 homes possible from one codebase.
- **Local models already supported** — Ollama + LM Studio + multi-provider embeddings (Phase 111.1). The on-prem/local-GPU home needs **zero new app code**.
- **Multi-worker uvicorn default** `WORKER_COUNT=2` (D-PRD-12); `RERANK_ENABLED=false` + the cloud image dropping sentence-transformers keeps the one-box footprint ~4 GB.

### Integration Points
- **No app code changes expected.** Net-new files only: `docker-compose.prod.yml`, `frontend/Dockerfile` (+ `nginx.conf`, `.dockerignore`), `deploy/*.env.example` presets, `docs/OPERATOR.md`. Plus a "superseded" header note on the recovered guide.
- Reported-bugs cross-check: **0 folded** — no open `surface: Agentic-RAG` report touches deployment/ops/docker/env (all are chat/streaming/provider/agent-loop).
- Pending todos: 0 matched Phase 157.

</code_context>

<specifics>
## Specific Ideas

- The **"GitHub-style run-these-commands install"** the operator referenced is the explicit target for home B: `git clone` → `cp deploy/onebox.env.example backend/.env` (fill DB URL/keys + one AI key) → `docker compose -f docker-compose.prod.yml up -d` → open the browser. Phase 158's install wizard turns even this into a browser flow.
- **Vendor-first framing** locked (operator sells this product): presets must map cleanly onto sellable tiers, though pricing/licensing is a later decision. Reference artifact: the deployment map (https://claude.ai/code/artifact/00e107fa-ac01-4300-ba2b-daed7c98e3d3).
- Supabase is **always managed cloud** for all shipped presets in 157; self-hosted Supabase belongs to the deferred on-prem runbook.

</specifics>

<deferred>
## Deferred Ideas

- **Full sealed on-prem / air-gapped runbook** (self-hosted Supabase Docker stack + local-GPU Ollama/LM Studio end-to-end + no-internet install steps). 157 ships only the **variant-delta section**. **Re-open trigger:** a real enterprise/on-prem buyer appears OR an explicit air-gapped requirement lands.
- **Full bring-your-own-cloud reference manifests** (AWS/Azure/GCP/Kubernetes). 157 ships only the **env-delta note**. **Re-open trigger:** a customer commits to running on their own cloud.
- **Malware scanning (ClamAV) on uploads** as an Enterprise-preset add-on — already parked in REQUIREMENTS "Future" ("once DEPLOY-02 exists"). Stays deferred.
- **First-run install wizard / `/setup` browser flow** = **Phase 158 (DEPLOY-02)** — the next phase; 157 feeds it the presets. Not in 157.
- **Licensing / payment model + where the free-tier line sits** — an explicit later, separate **business** decision; 157 only shapes the technical presets so they map onto whatever tiers are chosen. Out of scope here.

</deferred>

---

*Phase: 157-deployment-presets-runbook-stretch*
*Context gathered: 2026-07-17*
