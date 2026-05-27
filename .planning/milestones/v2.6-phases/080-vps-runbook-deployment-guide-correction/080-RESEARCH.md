# Phase 080: VPS Runbook + Deployment Guide Correction - Research

**Researched:** 2026-05-27
**Domain:** Documentation update (deployment guides, multi-worker config, Redis deployment, pgbouncer tuning)
**Confidence:** HIGH

## Summary

Phase 080 is a documentation-only phase updating two recovered deployment guides to reflect post-v2.6 reality. The work touches zero code files -- it modifies `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` and `.planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` plus a grep audit across `.planning/` for stale single-worker references.

The edits are well-scoped by 19 locked decisions from CONTEXT.md. The three substantive content blocks are: (1) Redis container deployment (Docker + Upstash paths), (2) pgbouncer transaction-mode pool sizing tuning section, and (3) worker count configuration with `EnvironmentFile` systemd pattern. One step (VPS Step 7 manual postgrest-py patch) is struck and replaced with an auto-patch note.

**Primary recommendation:** Plan this as a single plan with sequential tasks: VPS guide edits first (primary target, more changes), Hostinger guide edits second (consistency pass), then the grep audit for stale references.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Both Docker container AND hosted Redis (Upstash) paths documented in full.
- **D-02:** Docker path covers both `docker run` one-liner AND `docker-compose.yml` file.
- **D-03:** Upstash path is a full walkthrough matching Supabase Cloud setup detail level.
- **D-04:** Redis memory limit documented as configurable: default 256MB, scale to 512MB-1GB for 50+ concurrent streaming sessions.
- **D-05:** Optional Redis auth noted: default no auth (localhost-only), brief note on `--requirepass` + `REDIS_URL` update.
- **D-06:** VPS guide placement: new Redis section inserted after backend setup (Step 6), before systemd service step.
- **D-07:** Hostinger guide placement: inside Stage 3, between backend setup (3.4) and env file creation (3.5).
- **D-08:** VPS guide Step 7 (manual postgrest-py patch) struck, replaced with auto-patch note referencing `_patch_postgrest_maybe_single()` in `backend/app/main.py:31`.
- **D-09:** Common errors table row ("postgrest APIError code 204") updated: keep row, change Fix to "Auto-patched at startup."
- **D-10:** Full pgbouncer tuning section with explanation (not just table or one-liner).
- **D-11:** Placement: after systemd/service step in both guides.
- **D-12:** Mention Supabase Cloud's default pgbouncer pool size with dashboard link (Dashboard > Database > Connection Pooling).
- **D-13:** Same tuning content and depth in both guides.
- **D-14:** Worker count guidance uses CPU-based formula: `N = min(CPU_cores, 4)`. 2 workers is validated default.
- **D-15:** Systemd uses `EnvironmentFile=/var/www/agentic-rag/backend/.env` with `--workers ${WORKER_COUNT:-2}` in ExecStart.
- **D-16:** Hostinger guide also gets `--workers N` in its systemd unit (same `EnvironmentFile` pattern).
- **D-17:** VPS deploy script gets Redis health check: `docker exec redis redis-cli ping`.
- **D-18:** Both guides' `.env` example sections show `REDIS_URL=redis://localhost:6379` and `WORKER_COUNT=2`.
- **D-19:** Grep audit across `.planning/` for stale single-worker references.

### Claude's Discretion
- Exact wording of the auto-patch note replacing Step 7
- Formatting of the tuning section (tables, bullet points, or prose)
- Redis `docker-compose.yml` file naming and placement (inline vs separate file)
- Deploy script health check error message wording
- Step renumbering after Step 7 removal (or keeping original numbering with gap)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORKER-LIFT-01 (doc support) | Multi-worker enablement documented in prod deployment guides | VPS guide systemd unit update (D-15), Hostinger guide systemd unit update (D-16), worker count guidance (D-14), `.env` example sections (D-18) |
| WORKER-LIFT-03 (doc support) | D-PRD-12 supersession reflected in deployment docs | Stale single-worker reference audit (D-19), Step 7 strike (D-08), Common errors table update (D-09) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deployment guide authoring | Documentation | -- | Pure documentation changes to `.planning/research/recovered/` |
| Redis deployment instructions | Infrastructure docs | -- | Describes Docker container + cloud Redis setup for operators |
| pgbouncer pool sizing section | Infrastructure docs | -- | Describes database connection tuning for multi-worker |
| Worker count systemd config | Infrastructure docs | -- | Describes systemd EnvironmentFile pattern for WORKER_COUNT |
| Stale reference audit | Documentation audit | -- | grep-based scan of `.planning/` for outdated single-worker language |

## Standard Stack

Not applicable -- this is a documentation-only phase. No libraries, no code changes, no dependencies.

## Architecture Patterns

### Document Structure

Both target documents follow established patterns that must be preserved:

**VPS Guide (`RECOVERED_VPS_Deployment_Guide.md`):**
- 13 numbered steps with `## Step N` headings
- Code blocks with language tags (bash, ini, nginx, powershell)
- Common errors table at the end (3-column: Error | Cause | Fix)
- Notes use `> **Note:**` blockquote format
- File editing uses `nano` commands

**Hostinger Guide (`RECOVERED_Deploy_Hostinger_Supabase_Cloud.md`):**
- 7 numbered stages with `## STAGE N` headings
- Sub-steps use `### Step N.N` format
- "Who does it" headers per stage
- More beginner-friendly tone
- Final checklist at end

### Current State of Target Documents

**VPS Guide key observations:**
1. Step 7 contains the manual postgrest-py patch that is now obsolete (auto-patched at startup since Phase 058). [VERIFIED: `backend/app/main.py:31-54` -- `_patch_postgrest_maybe_single()` is called at module level line 54]
2. Step 8 systemd unit already has `--workers 2` hardcoded: `ExecStart=.../uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2`. No `EnvironmentFile` directive exists. [VERIFIED: reading the guide file]
3. No Redis section exists anywhere in the guide. [VERIFIED: reading the guide file]
4. No `REDIS_URL` or `WORKER_COUNT` in the `.env` example at Step 6. [VERIFIED: reading the guide file]
5. No pgbouncer or connection pool tuning content. [VERIFIED: reading the guide file]
6. No `POSTGRES_DSN` in the `.env` example. [VERIFIED: reading the guide file]
7. Common errors table has a `postgrest APIError code 204` row pointing to Step 7. [VERIFIED: reading the guide file]

**Hostinger Guide key observations:**
1. Stage 4 systemd unit has NO `--workers` flag at all: `ExecStart=.../uvicorn app.main:app --host 127.0.0.1 --port 8000`. [VERIFIED: reading the guide file]
2. No Redis section exists. [VERIFIED: reading the guide file]
3. No `REDIS_URL` or `WORKER_COUNT` in the `.env` example at Step 3.5. [VERIFIED: reading the guide file]
4. No `POSTGRES_DSN` in the `.env` example. [VERIFIED: reading the guide file]
5. No pgbouncer or pool tuning content. [VERIFIED: reading the guide file]
6. No postgrest-py patch step (only the VPS guide has this). [VERIFIED: reading the guide file]

### Content Blocks to Author

#### Block 1: Redis Container Deployment Section

Source material for the Docker path exists in `docker-compose.dev.yml` and `REDIS-SETUP.md`. [VERIFIED: files read in this session]

The production Redis config differs from dev:
- Dev: `--save "" --appendonly no` (no persistence) -- this is CORRECT for production too because Redis is used only for ephemeral run-streaming buffers (TTL ~10 min). [VERIFIED: `REDIS-SETUP.md` architecture overview + `docker-compose.dev.yml` comments]
- Prod addition: binding to localhost only (security), optional `--requirepass` for defense-in-depth per D-05
- Memory: 256MB default, guidance to scale per D-04

For the Docker path, two approaches per D-02:
1. `docker run` one-liner: `docker run -d --name redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine redis-server --save "" --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru`
2. `docker-compose.yml` file (adapted from dev compose, production-scoped)

For the Upstash path (D-03), the walkthrough exists in `REDIS-SETUP.md` Section "Option A -- Upstash". [VERIFIED: `REDIS-SETUP.md` lines 103-116]

Key detail: Upstash uses `rediss://` (double s for TLS), not `redis://`. [VERIFIED: `REDIS-SETUP.md` line 116 + `backend/.env.example` line 67]

#### Block 2: pgbouncer Transaction-Mode Pool Sizing Tuning Section

Source material:
- PRD v2.6 Section 7 identifies pgbouncer pool as the new bottleneck wall after multi-worker lift. [VERIFIED: v2.6.md line 221]
- PRD v2.6 Section 13 lists "pgbouncer transaction-mode pool sizing" and "asyncpg connection pool docs" as external references. [VERIFIED: v2.6.md lines 558-559]
- `backend/.env.example` documents `POSTGRES_POOL_MIN=2` / `POSTGRES_POOL_MAX=10` with D-073-01 note about direct connection on :5432 vs pooler on :6543. [VERIFIED: `.env.example` lines 73-82]
- `backend/app/dependencies.py` documents pool sizing at lines 84-85: "POSTGRES_POOL_MIN / POSTGRES_POOL_MAX (D-073-03, default 2/10 -- leaves headroom for Phase 079 `--workers 2` at effective ceiling 20 connections)." [VERIFIED: `dependencies.py` lines 74-99]

Key facts for the tuning section:
- Supabase Cloud uses Supavisor (replaced pgbouncer) in transaction mode on port 6543. [CITED: supabase.com/docs/guides/database/connecting-to-postgres]
- Direct connection on port 5432 (NOT the pooler) is what asyncpg should connect to per D-073-01. [VERIFIED: `backend/.env.example` line 77-78]
- The app uses `POSTGRES_DSN` pointing to direct Postgres (`:5432` for cloud, `:54322` for local Supabase CLI). [VERIFIED: `backend/.env.example` lines 76-80]
- With 2 workers, each worker has its own asyncpg pool (min=2, max=10), so effective max connections = 2 workers x 10 = 20 connections. [VERIFIED: `dependencies.py` + D-PRD-12 singleton audit table]
- Supabase Cloud pool size is configurable in Dashboard > Database > Connection Pooling. The default pool size depends on compute tier. [CITED: supabase.com/docs/guides/database/connection-management]
- For asyncpg connecting directly (bypassing Supavisor), the connection limit is the Postgres `max_connections` value, not the pooler size. Supabase free tier allows ~60 direct connections. [ASSUMED]
- Rule of thumb from D-073-01: use direct connection (:5432), NOT the pooler (:6543), because asyncpg has its own client-side pooling and stacking two poolers causes prepared-statement issues in transaction mode. [VERIFIED: `backend/.env.example` line 78 comment]

#### Block 3: Worker Count + EnvironmentFile Systemd Pattern

The systemd `EnvironmentFile` directive reads all `KEY=VALUE` lines from a file and exposes them as environment variables to the service. This allows operators to change `WORKER_COUNT` by editing `.env` without touching the systemd unit file. [ASSUMED -- standard systemd behavior]

Current VPS guide Step 8 has a hardcoded `--workers 2`. The update changes this to:
```ini
EnvironmentFile=/var/www/agentic-rag/backend/.env
ExecStart=/var/www/agentic-rag/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT:-2}
```

The `${WORKER_COUNT:-2}` syntax uses bash default substitution: if `WORKER_COUNT` is unset or empty, default to 2. [ASSUMED -- standard shell expansion in systemd ExecStart]

**Important caveat:** systemd's `ExecStart` does NOT support full bash variable expansion by default. The `${VAR:-default}` syntax IS supported by systemd natively (systemd supports `${FOO}` and `${FOO:-default}` as of systemd 254+). However, older Ubuntu versions may not support the `:-default` syntax. For Ubuntu 22.04 (Hostinger guide) and Ubuntu 25.04 (VPS guide), systemd versions are:
- Ubuntu 22.04: systemd 249 (does NOT support `:-default` syntax) [ASSUMED]
- Ubuntu 25.04: systemd 257 (supports `:-default` syntax) [ASSUMED]

**Alternative approach:** Since `WORKER_COUNT=2` is already in the `.env` file loaded via `EnvironmentFile`, the systemd unit can simply use `${WORKER_COUNT}` without the default. The `.env.example` already ships with `WORKER_COUNT=2`, so any operator following the guide will have it set. This sidesteps the systemd version compatibility question.

**Recommended pattern:**
```ini
EnvironmentFile=/var/www/agentic-rag/backend/.env
ExecStart=/var/www/agentic-rag/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT}
```

With a note that `WORKER_COUNT` must be defined in the `.env` file (it ships as `WORKER_COUNT=2` in `.env.example`).

#### Block 4: Step 7 Strike + Auto-Patch Note

The auto-patch function lives at `backend/app/main.py:31-54`. It is called unconditionally at module level (line 54), before the FastAPI app is constructed. [VERIFIED: `main.py` lines 31-54]

The function wraps `SyncSingleRequestBuilder.execute` to catch `APIError` with code `"204"` and return an empty result object instead of raising. [VERIFIED: `main.py` lines 38-46]

This was shipped in Phase 058 and has been in production since. No manual intervention is needed. [VERIFIED: `main.py` comment at line 32]

### Anti-Patterns to Avoid
- **Inconsistent content between guides:** Both guides must have matching Redis, pgbouncer, and worker-count sections per D-13/D-16/D-18. Avoid writing different content.
- **Breaking existing step numbering without tracking:** If Step 7 is struck, downstream step references in the common errors table and elsewhere must be updated.
- **Hardcoding cloud-specific values:** Use placeholders like `<your-project>.supabase.co` consistently with existing guide patterns.

## Don't Hand-Roll

Not applicable -- documentation-only phase. No code to hand-roll vs. use a library.

## Common Pitfalls

### Pitfall 1: Systemd EnvironmentFile Path Mismatch
**What goes wrong:** The systemd unit references `EnvironmentFile=/var/www/agentic-rag/backend/.env` but the actual `.env` file is at a different path (e.g., the Hostinger guide uses `/var/www/app/backend/.env`).
**Why it happens:** The VPS guide uses `/var/www/agentic-rag/` as the app root while the Hostinger guide uses `/var/www/app/`.
**How to avoid:** Match the `EnvironmentFile` path to the working directory already established in each guide. VPS = `/var/www/agentic-rag/backend/.env`. Hostinger = `/var/www/app/backend/.env`.
**Warning signs:** Systemd journal shows "EnvironmentFile ... not found" on service start.

### Pitfall 2: Redis Port Binding Security
**What goes wrong:** Docker's `-p 6379:6379` binds to 0.0.0.0 by default, exposing Redis to the internet on a VPS without authentication.
**Why it happens:** The shorthand port mapping doesn't specify a bind address.
**How to avoid:** Use `-p 127.0.0.1:6379:6379` to bind only to localhost. The firewall (ufw) is a secondary defense but explicit binding is the primary control.
**Warning signs:** `nmap` from an external host shows port 6379 open.

### Pitfall 3: POSTGRES_DSN vs Supabase Pooler Port
**What goes wrong:** Operator connects asyncpg to the Supabase Cloud pooler port (:6543) instead of the direct connection port (:5432). asyncpg's prepared statements fail under transaction-mode pooling.
**Why it happens:** Supabase dashboard shows the pooler connection string prominently. Operators copy it without reading the "Direct connection" alternative.
**How to avoid:** The tuning section must clearly state: "Use the Direct connection string from Dashboard > Database > Connection Info, NOT the pooler connection string." Match the `backend/.env.example` comment pattern.
**Warning signs:** `asyncpg.InterfaceError: cannot use prepared statement` errors in logs.

### Pitfall 4: UTF-8 Encoding in Recovered Guide Files
**What goes wrong:** The recovered guide files contain mojibake characters (e.g., `ÔÇö` instead of `--`, `Ô£à` instead of checkmarks).
**Why it happens:** The files were recovered from a different encoding context.
**How to avoid:** When editing, preserve the existing encoding patterns. If correcting, do it consistently across the entire document.
**Warning signs:** Mixed encoding artifacts after partial edits.

### Pitfall 5: Step Renumbering Cascade
**What goes wrong:** Striking Step 7 and renumbering Steps 8-13 to 7-12 breaks cross-references within the document (e.g., "see Step 11" in the common errors table).
**Why it happens:** Internal references use step numbers rather than anchors.
**How to avoid:** Either (a) renumber carefully and update all internal references, or (b) keep original numbering with a gap note at the struck step. Option (a) is cleaner for new readers; option (b) avoids errors. The decision is Claude's discretion per CONTEXT.md.
**Warning signs:** References to non-existent step numbers.

## Code Examples

### Systemd Unit with EnvironmentFile (VPS Guide)
```ini
# Source: Phase 079 D-15 pattern + backend/.env.example
[Unit]
Description=Agentic RAG FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/agentic-rag/backend
Environment="PATH=/var/www/agentic-rag/backend/venv/bin"
EnvironmentFile=/var/www/agentic-rag/backend/.env
ExecStart=/var/www/agentic-rag/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Systemd Unit with EnvironmentFile (Hostinger Guide)
```ini
# Source: Phase 079 D-16 pattern (matching VPS guide)
[Unit]
Description=Agentic RAG Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/app/backend
EnvironmentFile=/var/www/app/backend/.env
ExecStart=/var/www/app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers ${WORKER_COUNT}
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker Run One-Liner for Redis (Production)
```bash
# Source: docker-compose.dev.yml config adapted for production
docker run -d \
  --name redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine \
  redis-server \
    --save "" \
    --appendonly no \
    --maxmemory 256mb \
    --maxmemory-policy allkeys-lru
```

### Docker Compose for Redis (Production)
```yaml
# Source: docker-compose.dev.yml adapted for production
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
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

### Deploy Script Redis Health Check (VPS Guide)
```bash
# Source: D-17 decision
echo "=== Checking Redis ==="
if docker exec redis redis-cli ping | grep -q PONG; then
  echo "Redis: OK"
else
  echo "WARNING: Redis is not responding. Backend may fail to start."
  echo "Check: docker ps | grep redis"
fi
```

### Auto-Patch Note (Replacing Step 7)
```markdown
> **Note:** Earlier versions of this guide included a manual patch for
> `postgrest-py`'s `maybe_single()` bug. This is now auto-patched at startup
> by `_patch_postgrest_maybe_single()` in `backend/app/main.py:31`. No manual
> intervention is needed.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual postgrest-py patch (Step 7) | Auto-patch at startup (`main.py:31`) | Phase 058 (2026-05-02) | Step 7 can be struck entirely |
| Hardcoded `--workers 2` | `EnvironmentFile` + `${WORKER_COUNT}` | Phase 079 (2026-05-27) | Operators configure workers via `.env` |
| No Redis in deployment | Redis required for run-backed streaming | Phase 061 (2026-05-04) | New section needed in both guides |
| No asyncpg / pool tuning | asyncpg pool with configurable sizing | Phase 073 (2026-05-17) | New tuning section needed |
| Single-worker default | Multi-worker default (WORKER_COUNT=2) | Phase 079 / D-PRD-12 | All deployment docs must reflect |
| Supabase pgbouncer | Supabase Supavisor | ~2024 | Pool sizing guidance references Supavisor, not pgbouncer |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | systemd `${WORKER_COUNT}` variable expansion works when loaded via `EnvironmentFile` | Architecture Patterns (Block 3) | Systemd unit fails to start; workers default undefined. LOW risk -- this is standard systemd behavior per freedesktop.org docs |
| A2 | Ubuntu 22.04 ships systemd 249 (no `:-default` syntax); Ubuntu 25.04 ships systemd 257 (supports it) | Architecture Patterns (Block 3) | If wrong, the `:-default` fallback approach would work everywhere or nowhere. Mitigated: we recommend plain `${WORKER_COUNT}` without default, relying on `.env` always having it set |
| A3 | Supabase Cloud free tier allows ~60 direct connections | Architecture Patterns (Block 2) | Operators may hit connection limits sooner or later than expected. LOW risk -- the tuning section provides guidance to check Dashboard, not a hardcoded number |

## Open Questions

1. **Supabase Cloud default pool size per compute tier**
   - What we know: The pool size is configurable via Dashboard > Database > Connection Pooling. It depends on compute tier.
   - What's unclear: The exact default values per tier (free, pro, team, enterprise) are not published in docs.
   - Recommendation: Document as "check your project's Dashboard > Database > Connection Pooling for the current pool size" rather than citing a specific default number. This is more durable.

2. **Step renumbering vs. gap approach**
   - What we know: Claude has discretion per CONTEXT.md.
   - What's unclear: User preference between clean renumbering vs. historical gap.
   - Recommendation: Renumber. The guides are living documents for new operators, not historical records. New readers should not encounter a confusing gap.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual documentation review |
| Config file | none |
| Quick run command | Visual diff review of changed sections |
| Full suite command | grep audit: `grep -rn "single.worker\|--workers 1\|one worker\|single-worker" .planning/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC#1 | VPS guide updated with all 6 content blocks | manual-only | Visual review of diff | N/A |
| SC#2 | Hostinger guide updated with Redis + pool sizing + workers | manual-only | Visual review of diff | N/A |
| SC#3 | pgbouncer pool sizing curve in both docs | manual-only | `grep -c "pgbouncer\|pool sizing\|POSTGRES_POOL" .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` | N/A |
| SC#4 | No stale single-worker references in planning tree | automated | `grep -rn "single.worker\|--workers 1\|one worker\|single-worker" .planning/ --include="*.md"` | N/A |

### Sampling Rate
- **Per task commit:** Visual diff review
- **Per wave merge:** grep audit for SC#4
- **Phase gate:** All 4 SCs verified

### Wave 0 Gaps
None -- documentation phase requires no test infrastructure.

## Security Domain

Not applicable. This phase modifies documentation files only. No code changes, no API surface changes, no authentication or data-handling changes.

The Redis deployment section does document security-relevant configuration (localhost binding, optional auth), but these are operator guidance in the deployment docs, not application security controls.

## Sources

### Primary (HIGH confidence)
- `backend/app/main.py:31-54` -- auto-patch function verified in codebase
- `backend/.env.example` -- WORKER_COUNT, REDIS_URL, POSTGRES_DSN entries verified
- `docker-compose.dev.yml` -- Redis container config verified
- `REDIS-SETUP.md` -- Redis setup guide (local + cloud + Upstash walkthrough) verified
- `backend/app/dependencies.py:74-99` -- asyncpg pool config verified
- `.planning/prd-reset/DECISIONS.md` D-PRD-12 -- singleton audit table + scaling triggers verified
- `.planning/phases/079-d-v2-5-02-supersession-multi-worker-enable/079-CONTEXT.md` -- Phase 079 decisions verified
- `.planning/PRDs/v2.6.md` Section 7 + Section 13 -- pgbouncer wall + external refs verified
- Target documents fully read: `RECOVERED_VPS_Deployment_Guide.md`, `RECOVERED_Deploy_Hostinger_Supabase_Cloud.md`

### Secondary (MEDIUM confidence)
- [Supabase connection docs](https://supabase.com/docs/guides/database/connecting-to-postgres) -- Supavisor vs pgbouncer, port 6543 vs 5432
- [Supabase connection management](https://supabase.com/docs/guides/database/connection-management) -- pool size configurable in Dashboard
- [asyncpg pgbouncer compatibility issue #339](https://github.com/MagicStack/asyncpg/issues/339) -- prepared statements incompatible with transaction mode pooling
- [PgBouncer config reference](https://www.pgbouncer.org/config.html) -- transaction mode pool sizing parameters

### Tertiary (LOW confidence)
- Specific systemd version numbers for Ubuntu 22.04 / 25.04 -- from training knowledge, not verified this session

## Metadata

**Confidence breakdown:**
- Content blocks (Redis, pgbouncer, workers): HIGH -- all source material verified in codebase
- Target document structure: HIGH -- both files fully read
- Systemd EnvironmentFile pattern: HIGH -- standard systemd, but `:-default` syntax version-gated
- Supabase Cloud pool defaults: MEDIUM -- dashboard configurable, exact defaults not published

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (documentation references are stable; underlying infrastructure decisions are locked by D-PRD-12)
