# Phase 080: VPS Runbook + Deployment Guide Correction - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the two recovered deployment guides to reflect post-v2.6 reality: multi-worker config with `WORKER_COUNT` env var, Redis container deployment (Docker + Upstash paths), obsolete manual postgrest-py patch struck, and pgbouncer pool sizing tuning section. Final doc audit confirms no stale "single worker" references remain in the planning tree.

**Not in scope:** Code changes. This is documentation-only. No schema, no API surface, no frontend changes.

</domain>

<decisions>
## Implementation Decisions

### Redis Production Deployment
- **D-01:** Both deployment paths documented in full: Docker container (localhost-only) AND hosted Redis (Upstash). Operators choose based on their infra preference.
- **D-02:** Docker path covers both `docker run` one-liner AND `docker-compose.yml` file. Gives operators flexibility.
- **D-03:** Upstash path is a full walkthrough — create account, create database, copy connection URL, set env var. Matches the Supabase Cloud setup detail level in the guides.
- **D-04:** Memory limit documented as configurable with guidance: default 256MB, scale to 512MB-1GB for 50+ concurrent streaming sessions.
- **D-05:** Optional Redis auth noted: default is no auth (localhost-only binding, not network-reachable). Brief note on adding `--requirepass` and updating `REDIS_URL` for defense-in-depth.
- **D-06:** VPS guide placement: new Redis section inserted after backend setup (Step 6), before the systemd service step. Redis must be running before the backend starts.
- **D-07:** Hostinger guide placement: inside Stage 3, between backend setup (3.4) and env file creation (3.5). Keeps it in the logical flow.

### Postgrest-py Patch Handling
- **D-08:** VPS guide Step 7 (manual postgrest-py patch) is struck and replaced with a brief note: the bug is auto-patched at startup by `_patch_postgrest_maybe_single()` in `backend/app/main.py:31`. No manual intervention needed.
- **D-09:** Common errors table row ("postgrest APIError code 204") is updated — keep the row but change the Fix column to: "Auto-patched at startup. If you see this error, ensure you're running the latest codebase."

### pgbouncer Pool Sizing
- **D-10:** Full tuning section with explanation (not just a table or one-liner). Covers transaction-mode pgbouncer behavior, asyncpg pool interaction, Supabase Cloud defaults, and when to adjust.
- **D-11:** Placement: after the systemd/service step in both guides. Logical position for "now tune your database connections for multi-worker."
- **D-12:** Mention Supabase Cloud's default pgbouncer pool size with a dashboard link (Dashboard → Database → Connection Pooling). Most operators won't need to change it for 1-2 workers.
- **D-13:** Same tuning content and depth in both guides (VPS and Hostinger). Both serve operators deploying to VPS.

### Worker Count Configuration
- **D-14:** Worker count guidance uses CPU-based formula: `N = min(CPU_cores, 4)` for most VPS. 2 workers is the validated default sufficient for most single-org deployments. Beyond 4 workers, reference the Phase 078 backpressure endpoint for data-driven scaling.
- **D-15:** Systemd service uses `EnvironmentFile=/var/www/agentic-rag/backend/.env` with `--workers ${WORKER_COUNT:-2}` in ExecStart. Operators edit `.env` to change workers without touching the systemd unit file.
- **D-16:** Hostinger guide also gets `--workers N` in its systemd unit (same `EnvironmentFile` pattern). Consistency across both guides — a 2-line addition, not scope creep.

### Deploy Script + Env Vars
- **D-17:** VPS guide deploy script (Step 13) gets a Redis health check line: `docker exec redis redis-cli ping`. Warns but doesn't fail if Redis is down (Docker auto-restarts it).
- **D-18:** Both guides' `.env` example sections updated to show `REDIS_URL=redis://localhost:6379` and `WORKER_COUNT=2`. Operators see all required env vars in one place.

### Doc Audit (SC#4)
- **D-19:** Plan includes a grep across `.planning/` for stale single-worker references: `single worker`, `single-worker`, `--workers 1`, `one worker`. Any hits reviewed and either updated or marked as historical context (milestone history, ADR supersession notes). Archived milestones are excluded.

### Claude's Discretion
- Exact wording of the auto-patch note replacing Step 7
- Formatting of the tuning section (tables, bullet points, or prose)
- Redis `docker-compose.yml` file naming and placement (inline vs separate file)
- Deploy script health check error message wording
- Step renumbering after Step 7 removal (or keeping original numbering with gap)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Target Documents
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — Primary target: 13-step VPS deployment guide (Steps 7/8 are main edit points)
- `.planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` — Secondary target: 7-stage Hostinger Cloud deployment guide (Stage 3/4 are main edit points)

### Multi-Worker Context
- `.planning/prd-reset/DECISIONS.md` — D-PRD-12 ADR (multi-worker default, singleton audit, scaling guidance)
- `.planning/phases/079-d-v2-5-02-supersession-multi-worker-enable/079-CONTEXT.md` — Phase 079 decisions (WORKER_COUNT=2 default, env var naming, systemd config)
- `backend/.env.example` — Current env var reference (WORKER_COUNT=2 already present)

### Redis Infrastructure
- `docker-compose.dev.yml` — Dev Redis config: redis:7-alpine, no persistence, 256MB maxmemory, allkeys-lru eviction
- `REDIS-SETUP.md` — Redis setup guide (local + cloud + key conventions)

### Postgrest-py Auto-Patch
- `backend/app/main.py` §31-54 — `_patch_postgrest_maybe_single()` function (auto-applied since Phase 058)

### Pool Sizing
- `.planning/PRDs/v2.6.md` §13 — External references: pgbouncer transaction-mode pool sizing, asyncpg connection pool docs
- `.planning/PRDs/v3.1.md` — Team/Enterprise presets with pool sizing defaults (pgbouncer pool 50 for Team)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker-compose.dev.yml` — Redis container config directly reusable as prod template (adjust maxmemory)
- `backend/.env.example` — Already has `WORKER_COUNT=2` and `REDIS_URL` entries
- `backend/app/main.py:31-54` — Auto-patch function (reference for the struck Step 7 note)

### Established Patterns
- Both deployment guides follow a numbered step/stage format with code blocks
- VPS guide uses `nano` for file editing, systemd for service management
- Hostinger guide is more beginner-friendly with "Who does it" headers per stage
- Common errors table in VPS guide uses 3-column format: Error | Cause | Fix

### Integration Points
- Systemd service file is the connection point for WORKER_COUNT and EnvironmentFile
- `.env` example sections in both guides need REDIS_URL and WORKER_COUNT additions
- Deploy script (VPS only) needs Redis health check addition

</code_context>

<specifics>
## Specific Ideas

- Both Docker `docker run` and `docker-compose.yml` approaches for Redis deployment
- Full Upstash walkthrough matching Supabase Cloud setup detail level
- EnvironmentFile directive in systemd to avoid hardcoding worker count
- Configurable Redis memory with explicit scaling guidance (256MB default → 512MB-1GB for 50+ sessions)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 080-vps-runbook-deployment-guide-correction*
*Context gathered: 2026-05-27*
