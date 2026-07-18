# Deployment Lessons Learned

**Purpose:** a running log of real issues hit deploying + running this app on cloud, so we
don't re-learn them. Each entry: **Symptom → Root cause → Fix → Prevention.**
**Companion docs:** [`DEPLOYMENT-WORKFLOW.md`](./DEPLOYMENT-WORKFLOW.md) (process),
[`DEPLOYMENT-PIPELINE.md`](./DEPLOYMENT-PIPELINE.md) (architecture).
**Cross-cutting takeaway:** *code deploying is only half — the cloud's config (env vars,
DB seed rows, provider keys/models, infra mounts) is a separate surface that silently drifts
from local. Most of these bugs were config/data, not code.*

---

## Part A — Initial deploy gotchas (first deploy, 2026-06-28)

### A1. Clean Docker image crashed on undeclared deps
- **Symptom:** backend image built but crashed at import (`ModuleNotFoundError`).
- **Root cause:** `jsonschema`, `docxtpl`, `jinja2`, `PyYAML` were installed *transitively* in
  the local venv but never declared in `requirements.txt`. A clean image has only what's declared.
- **Fix:** added all four to `requirements.txt`.
- **Prevention:** every module the app imports must be a *direct* dependency in
  `requirements.txt`. Build the clean Docker image (not just the local venv) before deploying —
  it's the only honest test of the dependency list.

### A2. No backend Dockerfile
- **Symptom:** nothing to build on Coolify.
- **Fix:** wrote `backend/Dockerfile` (py3.12-slim + native libs for camelot; drops
  torch/sentence-transformers ~2 GB since rerank is off-by-default) + `.dockerignore` (keeps
  `.env`/venv out).
- **Prevention:** keep the Dockerfile lean; gate heavy optional deps behind feature flags.

### A3. Coolify path/port/protocol traps
- **Symptom:** "no available server" / 503 on https.
- **Root cause:** Base Dir + Dockerfile location doubled (`backend/backend`); default port 3000
  vs app's 8000; Domain set as `http://` → only an HTTP router existed.
- **Fix:** Base Dir `/backend`, Dockerfile `/Dockerfile`, **Ports Exposes 8000**, Domain `https://`.

### A4. Postgres DSN — wrong pooler
- **Symptom:** backend couldn't reach the DB.
- **Root cause:** used the Direct connection (`db.<ref>`, IPv6-only — container can't reach) or
  the 6543 Transaction pooler (breaks asyncpg).
- **Fix:** use the **Session pooler** (`postgres.<ref>@...pooler.supabase.com:5432`, IPv4).
  Note: Supavisor trips an `ECIRCUITBREAKER` after repeated bad-auth — wait ~3 min between tries.

### A5. Redis URL must be TLS
- **Symptom:** chat 503 "Streaming infrastructure unavailable."
- **Root cause:** `REDIS_URL` left at localhost; Upstash requires TLS.
- **Fix:** `rediss://` (two s's).

### A6. Schema bootstrap skips seed data (HIGH-VALUE — recurring)
- **Symptom:** Settings showed a fake "Saved" but nothing persisted; downstream features
  silently used defaults.
- **Root cause:** `full-schema.sql` is `pg_dump --schema-only` → it captures tables but **not
  seed rows**. The `app_settings 'global'` row was missing, and `save_app_settings` does
  `UPDATE ... WHERE id='global'` (not upsert) → matched 0 rows → silent success.
- **Fix:** `INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING`.
- **Prevention:** a fresh cloud DB needs the **9 seed migrations** that the schema-only dump
  misses (010 app_settings, 018 skill_creator_seed, 053, 056 workflow_definitions, 061
  harness_seed_templates, 066 eval_coverage_seed, 087 skill_creator_reborn (supersedes 018's
  seed), 088 skill_creator_eval_step_sequencing, 089 skill_creator_file_attach_honesty (088 and
  089 both UPDATE 087's row — apply 087, 088, 089 in that order)). Long-term: extend the schema generator with
  a seed-data supplement. Also: `save_app_settings` should upsert / stop swallowing write errors.

### A7. Vercel build + author gotchas
- **Symptom:** Vercel build failed; pushed commits didn't deploy.
- **Root cause:** (1) `tsc -b` in `npm run build` fails on pre-existing test-file type rot;
  (2) commits authored as `dev@example.com` are blocked by Vercel.
- **Fix:** `frontend/vercel.json` (`buildCommand: "vite build"` + SPA rewrite); set repo-local
  git identity to a real GitHub-linked email (`fhdmrd.dev@gmail.com`).

---

## Part B — Post-deploy bugs (this session, 2026-06-29)

### B1. CORS allowed only one origin
- **Symptom:** every `OPTIONS` preflight returned `400`; even the *old* frontend URL broke.
- **Root cause:** `allow_origins=[settings.frontend_url]` — a single value. When `FRONTEND_URL`
  was set to a comma-joined list, the *old* code treated the whole string as ONE origin →
  matched nothing → all preflights `400` (Starlette "Disallowed CORS origin").
- **Fix:** split `FRONTEND_URL` on commas into a list (`main.py`). Set
  `FRONTEND_URL=https://superrag.cloud,https://agentic-rag-rho.vercel.app`.
- **Prevention:** support multi-origin from day one for anything with >1 frontend URL.

### B2. Sandbox couldn't start (Docker-in-container)
- **Symptom:** "sandbox failed to start / connection issue," then
  `Failed to pull image agentic-rag-sandbox:101.1: 404 pull access denied`.
- **Root cause:** the sandbox spawns sibling Docker containers, but (a) the backend container
  couldn't reach the Docker daemon, and (b) the pinned image was never built on the host.
  `SANDBOX_ENABLED` was already true and the env var already set — the infra was missing.
- **Fix:** Coolify → Persistent Storage → **Directories** tab → mount `/var/run/docker.sock`
  → `/var/run/docker.sock` (the **File Mount** type is wrong — it managed-prefixes the source
  and would shadow the socket with an empty file). Then build the image **on the VPS host**
  (`docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:<tag> .`) so it's in the
  host's image store. No redeploy needed after build; just start a new thread (sessions cache).
- **Prevention:** error ladder to diagnose — "code execution disabled" = `SANDBOX_ENABLED` off;
  "connection issue" = socket not mounted; `404 pull access denied` = image not on host.
  Security: a mounted `docker.sock` = host root; acceptable for a single-tenant box only.
- **RECURRED 2026-07-12 — Coolify's Docker cleanup prunes the image.** Sandbox worked for
  ~2 weeks, then broke with the same `404 pull access denied` right after a routine
  `production` push. Nothing in the push touched the sandbox; the host image store showed
  **no** `agentic-rag-sandbox` and only the newest app image left — Coolify's automatic
  Docker cleanup (`docker image prune`-style, runs around deploys/on schedule) swept the
  host-built image because sandbox containers are ephemeral, so nothing referenced it at
  cleanup time. **Fix:** rebuild on the host (the Dockerfile is self-contained — heredoc it,
  no repo clone needed), then **pin it**:
  `docker create --name sandbox-image-keeper agentic-rag-sandbox:<tag>` — a never-started
  container that references the image, so image-prune spares it (Coolify's container prune
  only targets coolify-managed labels, so the keeper survives too). **Rule:** the keeper is
  part of the sandbox install; every `SANDBOX_IMAGE` tag bump = rebuild on host + recreate
  the keeper against the new tag (remove the old one: `docker rm sandbox-image-keeper`).
  If this bites a third time, move the image to a private registry (GHCR) so the host can
  re-pull instead of host-building.

### B3. Metadata extraction silently produced NULL (HIGH-VALUE)
- **Symptom:** docs `status=completed` but `metadata=null`; chat worked fine.
- **Root cause:** `app_settings.extraction_model` was null → `resolve_extraction_model("")`
  falls back to the **env default `gpt-4o`** (`config.py`), which the cloud OpenAI key can't
  serve (account uses gpt-5.4 models). Forced-emit returned `emitted=None` → null metadata,
  by design (D-111-8 "metadata failure never breaks ingestion"). Chat worked because it uses
  the DB active model `gpt-5.4-mini`.
- **Fix:** `UPDATE app_settings SET extraction_model='gpt-5.4-mini', extraction_provider='openai'`
  + **restart backend** (the sync ingest path reads an in-memory settings cache, not the DB live).
- **Prevention:** local and cloud provider keys differ — a model that works locally can 404 on
  cloud. Pin known-good models per environment. **Note:** API keys *do* fall back to env when the
  DB column is null, so the empty global-row insert (A6) did **not** lose keys — keys were never
  the issue here. **Diagnostics:** the failure had a `log.warning`, but it was buried by the
  frontend's ~1/sec `/settings/reembed-progress` poll flooding Coolify's log UI — grep the
  container directly (`docker logs <name> | grep -i metadata`) instead of the dashboard.

### B4. Image chunks got NULL embedding_model (HIGH-VALUE)
- **Symptom:** "Search is catching up" banner stuck forever; UI showed 410 of 433 chunks.
- **Root cause:** `multimodal_service.extract_and_store_images` inserted image-description
  chunks into `document_chunks` **without** `embedding_model`/`embedding_dimensions` (unlike the
  text path). NULL-model chunks (a) stay "remaining" in the re-embed counter forever, and (b) are
  **excluded** from `match_document_chunks` (filters on `p_embedding_model`) — so image
  descriptions were invisible to search.
- **Fix:** stamp `embedding_model`/`embedding_dimensions` on image chunk rows (code, deployed) +
  one-time SQL backfill of existing NULL chunks to their doc's model.
- **Prevention:** *every* code path that writes to `document_chunks` must stamp the embedding
  model+dims, not just the primary text path. Watch for "parallel insert paths" that skip a
  column the main path sets.

### B5. chunk_count showed text-only (looked like data loss)
- **Symptom:** UI showed 410 while `document_chunks` had 433.
- **Root cause:** `documents.chunk_count` was `len(text_chunks)` by an old design choice
  (text "density"), excluding image chunks. Combined with B4 it looked like 23 missing chunks.
- **Fix:** take an authoritative `count(*)` after the multimodal insert so `chunk_count` = real
  total, with a `len(chunks)` fallback that never blocks completion + a backfill.
- **Prevention:** user-facing counts should reflect reality (total searchable rows), not an
  internal subset — "honest numbers" reduce false alarms.

---

## Recurring themes (the meta-lessons)

1. **Cloud config drift is the #1 source of bugs.** Keys, models, env vars, seed rows, infra
   mounts — all live outside the code and must be set per environment. Use the parity checklist
   in `DEPLOYMENT-WORKFLOW.md` for every cloud-touching change.
2. **Silent degrades hide failures.** "Never break ingestion/chat" patterns (D-111-8) are good
   for resilience but mask root causes. Ensure every degrade path logs *why* — and that the log
   is actually visible (not buried by polling noise; grep the container, not the dashboard).
3. **Clean-image builds catch what local venvs hide** (undeclared deps).
4. **Schema-only dumps miss seed data.** A fresh DB needs the seed migrations + the `global`
   settings row, or features silently run on defaults.
5. **Parallel write paths drift.** When two code paths write the same table, they must set the
   same columns — multimodal vs text chunks diverged on `embedding_model`.
6. **Local works ≠ cloud works.** Different keys/models/infra. Verify on the real domain.

---

## Changelog
- **2026-07-12** — B2 recurrence logged: Coolify Docker cleanup pruned the host-built sandbox
  image after a deploy; rebuilt + added the `sandbox-image-keeper` pin container.
- **2026-06-29** — Created. Logged Part A (initial-deploy gotchas) + Part B (post-deploy bugs:
  CORS, sandbox, metadata, image-chunk embedding_model, chunk_count) + recurring themes.
