# Phase 163: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX - Research

**Researched:** 2026-07-19
**Domain:** Membership-based Postgres RLS enforcement + per-request user-JWT DB context (supabase-py PostgREST + raw asyncpg) on Supabase/pgvector, under FastAPI + `WORKER_COUNT=2`
**Confidence:** HIGH (the two MEDIUM-confidence gates flagged by the research base — the `SET LOCAL`/GUC-variant semantics and the pgvector+RLS perf interaction — are both RESOLVED here against authoritative sources + live code; residual uncertainty is now concentrated in the operator-run live leak test, exactly where D-08 places it)

<user_constraints>
## User Constraints (from CONTEXT.md)

These are LOCKED (163-CONTEXT.md, `--auto` discussion, operator-reviewed). Research fills the gaps they name; it does not re-litigate them.

### Locked Decisions

- **D-01 — `threads.py` Wave-0 extraction FIRST, hard-gated.** The extraction lands + proves Deep-Mode **byte-identical** + full suite green **BEFORE the first `org_id` predicate or client-swap touches the producer path.** Scope: `agent_runner` producer shell + `_shielded_finalize` (1410–2003) unified with `spawn_continuation_run` (2279–2444) into a shared `run_producer.py`, plus `workflow_kickoff.py` / `thread_title.py` / `run_model_resolution.py` (≈1,100–1,400 LOC / 4 modules). **De-risked:** the Deep byte-identical red line already lives in `agent_loop.py::run_agent_loop` (Phase 089), a single call in `send_message`. **Provisional: PROMOTE to a dedicated refactor phase; final promote-vs-wave commit at `/gsd:plan-phase 163`.**
- **D-02 — asyncpg per-request RLS context on the EXISTING pool (no new pool):** `async with pool.acquire() as con: async with con.transaction(): SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = <claims-json>`. **`SET LOCAL ROLE authenticated` is the load-bearing piece** (pool DSN role is `postgres`/BYPASSRLS). GUC-variant is a named research-spike deliverable, arbitrated by the D-08 live test; both-forms is an acceptable default. The **100 connectionless `pool.*()` calls across 21 files** must become explicit `acquire()`+`transaction()`. Single seam: `get_user_pg_connection(request)`.
- **D-03 — `get_user_supabase(request)` factory** bound to the caller's JWT (header override / `postgrest.auth(jwt)`), replacing the service-role singleton on request-scoped hot paths. Central swap at the router `Depends` seam. Keep `run_in_threadpool` (D-v2.5-01). Per-request construction cost benchmarked with D-07.
- **D-04 — Local JWKS/ES256 verification via PyJWT (`PyJWKClient`), promoted to an explicit pin.** Drops the per-request `supabase.auth.get_user()` GoTrue round-trip AND yields the claims dict the asyncpg `SET LOCAL` needs. Keep GoTrue as fallback if JWKS fetch fails.
- **D-05 — `get_service_role_supabase(org_id)` refuses to construct without an explicit org.** Retained ONLY for the four fully-async writers (agent loop, eval runner, harness engine, re-embed) + legitimate cross-tenant ops; their `.eq("user_id")` filters widen to org-aware. The 262 `.eq("user_id")` filters are KEPT everywhere (D-14 belt-and-suspenders).
- **D-06 — Transform + bundle + flip-last.** Shape: `auth.uid() = user_id` → `org_id = ANY(current_user_org_ids()) AND (user_id = auth.uid() OR is_global OR is_system OR <dept-scope>)`, preserving today's global OR-branches. **Live column names `is_global`/`is_system`** (162-D-05). Quoted policy names enumerated at plan time. ~6 per-cluster bundles. **Atomic flip order:** author ALL RLS bundles FIRST (inert under BYPASSRLS) THEN flip the client swap LAST, with D-08 as go/no-go. No window where the client is swapped but predicates are incomplete.
- **D-07 — Denormalize `org_id` onto `document_chunks` + `skill_embeddings`, backfill, index, benchmark before merge.** RLS on `document_chunks` filters the denormalized `org_id` directly, never a per-row join. Index shape benchmark-driven. **Perf gate: CONCUR-01 <1s, GREEN before merge.**
- **D-08 — Mandatory live two-user leak test** (`--research-phase`). Two users in two different orgs, live local DB, both DB paths, claims/role spoofing rejected. Arbiter of the D-02 GUC-variant question. **Operator runs the live test.**
- **D-09 — Org context rides the REQUEST seam only**, never the provider/gateway path (Deep byte-identical on native-7). SC#10 4-axis UAT + D-08 leak test, both operator-run.
- **D-10 — RLS predicates handle NULL `org_id` explicitly** (operator/system rows reached via operator path). `runs.org_id` set at creation; Redis `run:{run_id}` inherits org-scoping via the `runs` row (DB row is the gate; no RLS on Redis).
- **D-11 — Nothing 163 ships makes any deployment tier harder** (ADR D-v3.4-01 SC#4). The user-JWT swap works identically in isolated single-org and co-tenant deploys — pure env-var, no hardcoded URLs/keys/roles, local setup never breaks. No new runtime (D-14).
- **D-12 — 163 enforces via `auth.uid()` → `current_user_org_ids()` (reads `org_members` live).** It does NOT require the custom-access-token JWT-membership hook or `X-Org-Id` header (both → 166). Every existing user has exactly one personal org, so membership-set isolation == today's per-user behavior. **Escape valve:** if the per-query `org_members` join threatens CONCUR-01, the JWT-membership optimization can be pulled forward — decided by the D-07 benchmark.

### Claude's Discretion

- Exact new module names/boundaries for the Wave-0 extraction (scout's `run_producer.py` / `workflow_kickoff.py` / `thread_title.py` / `run_model_resolution.py` are natural seams — executor may refine).
- Exact index names/shapes for TEN-04 (benchmark-driven); precise per-cluster bundle membership; procedure/constraint names.
- **The final GUC-variant choice** (`request.jwt.claims` vs also-`request.jwt.claim.sub`) — pending the D-08 live test; both-forms is an acceptable belt-and-suspenders default. **(Research recommendation below: set BOTH — this is now evidence-backed, not just a hedge.)**
- Migration slot(s): next free numbered slot — **verified below: 107+** (161 used 104; 162 used 105 + 106). Apply via Supabase SQL editor, regenerate `full-schema.sql`, same-commit; deployment-artifact parity (D-16) only if a bundle becomes seed-bearing.

### Deferred Ideas (OUT OF SCOPE)

- **4 SECDEF functions org-scoping + `_inject_user_id` deletion + `test_v3_4_org_isolation.py` two-org exit suite + SEED-091** → **Phase 164**. 163 only ships the `document_chunks` `org_id`/RLS substrate + pins `search_path` on the two chunk-search fns **if it touches them**.
- **`is_global`→`is_org_shared` / `is_system`→`is_system_global` RENAME** → **Phase 165**. 163 uses the live names.
- **`<OrgContext>` + org switcher + `X-Org-Id` header + custom-access-token JWT-membership hook** → **Phase 166**. 163 enforces membership-set isolation only.
- **Deleting the 262 `.eq("user_id")` filters** → later hardening pass (NOT this milestone).
- **Permission-aware citations (pgvector+RLS latency/recall benchmark)** → STRETCH 171.
- **The promote-vs-wave structural commit for Wave-0** → `/gsd:plan-phase 163`.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TEN-01** | Rewrite every RLS predicate on the ~38 user-facing tables from `auth.uid() = user_id` to membership-based, shipped atomically across reviewable per-cluster bundles. | The proven live template (`org_id IN (SELECT public.current_user_org_ids())` + `current_user_has_permission(org_id, key)`) is documented below with the EXACT live form (SETOF `IN (SELECT …)`, not `= ANY(array)`), the re-paste-safe `DROP POLICY IF EXISTS "quoted name"` + `CREATE POLICY` idiom, `TO authenticated` role-targeting, and the inert-under-BYPASSRLS property that makes flip-last safe (§Architecture Patterns, §Rollout Safety). |
| **TEN-02** | Per-request user-JWT DB context on BOTH paths: supabase-py JWT-header swap + asyncpg `SET LOCAL request.jwt.claims` + mandatory `SET LOCAL ROLE authenticated`; hardened `get_service_role_supabase(org_id)`. | The exact asyncpg pattern, the RESOLVED GUC-variant answer, the pooled-connection reset hygiene, the supabase-py `postgrest.auth()` idiom + its singleton-mutation race, and the local-JWKS-vs-GoTrue reality are all resolved below with live-version evidence (§Standard Stack, §asyncpg RLS Context, §Common Pitfalls). |
| **TEN-04** | Denormalize + index `org_id` on `document_chunks`/`skill_embeddings`, benchmarked against the CONCUR-01 <1s gate. | Live pgvector structure mapped; the counterintuitive de-risking finding (retrieval RPCs are SECURITY DEFINER → BYPASS RLS → 163's chunk RLS is inert on the hot path; the real CONCUR-01 risk is SET-LOCAL RTT overhead) documented with the sharp index recommendation (§pgvector + RLS Performance). |

</phase_requirements>

## Summary

Phase 163 is a **two-front atomic transition**: rewrite the RLS predicates (Front A) AND swap the service-role/`postgres`-owner DB context for a per-request user-JWT context (Front B) — because today RLS is decorative (`get_supabase()` is a `service_role`/BYPASSRLS singleton; the asyncpg pool connects as `postgres`/BYPASSRLS per the live `POSTGRES_DSN`). Front A without Front B changes nothing. The single most-cited trap — **the `SET LOCAL ROLE authenticated` is what actually turns RLS on, not the claims** — is confirmed against the live env: `POSTGRES_DSN=postgresql://postgres:postgres@127.0.0.1:54322/postgres` [VERIFIED: backend/.env.example]. The rewritten policies are declared `TO authenticated` [VERIFIED: full-schema.sql org-table policies], so a connection that stays `postgres` is doubly exempt (table-owner RLS bypass + role-target miss).

The milestone's flagged MEDIUM-confidence gate — the exact `SET LOCAL`/GUC-variant semantics — is now **RESOLVED against authoritative sources**. Supabase's canonical `auth.uid()` is `nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid` [VERIFIED: supabase/auth migration `20211202183645_update_auth_uid.up.sql`] — it reads BOTH the legacy per-claim GUC (first) and the JSON blob (fallback). But **local/self-hosted dev DBs can ship an OLDER `auth.uid()` that reads ONLY the legacy `request.jwt.claim.sub`** [VERIFIED: supabase/supabase issue #29332]. The existing prototype (`test_110_dm_schema.py:302-314`) sets the legacy form and passes locally — empirically proving THIS local DB reads it. **The deployment-portable answer (honoring D-11) is to set BOTH GUCs**: legacy `request.jwt.claim.sub` (makes `auth.uid()` resolve on old local/self-hosted stacks) + JSON `request.jwt.claims` (cloud + `auth.jwt()`/`auth.role()`/future custom claims). This is not a hedge; it is the only form correct across all four deployment tiers.

The second de-risking finding rewrites the perf story. TEN-04 was framed as "pgvector+RLS is the top perf risk," but the live retrieval functions `match_document_chunks` and `keyword_search_chunks` are **`SECURITY DEFINER`** [VERIFIED: full-schema.sql:310, :283] — they run as owner and **BYPASS RLS entirely**. So 163's new `document_chunks` RLS is *inert on the hot retrieval RPC path*; org isolation of retrieval lands in Phase 164's in-body predicate rewrite. 163's `org_id` column + index is **substrate for 164**, not a live retrieval filter. The actual CONCUR-01 threat is the **per-request `acquire → transaction → SET LOCAL ×2 → query` round-trip overhead** the client swap adds to the asyncpg hot path — that is what the benchmark must measure, not a pgvector recall cliff.

**Primary recommendation:** Productionize the `test_110` prototype into `get_user_pg_connection(request)` — transaction-scoped `SET LOCAL ROLE authenticated` + **both** GUC forms of the claims (`request.jwt.claim.sub` = uid AND `request.jwt.claims` = `{"sub": uid, "role": "authenticated"}`, `is_local=true`) — built from the already-validated `current_user["id"]` (no dependency on D-04's JWKS optimization). Author all RLS bundles inert-first against the proven `org_id IN (SELECT current_user_org_ids())` template, flip the client last, and gate on a fail-loud two-user leak test whose FIRST assertion is `SELECT auth.uid()` returning the expected UUID.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant isolation predicate (who-can-see-which-row) | Database (RLS policies on 38 tables) | — | RLS is the primary gate after 163; `.eq("user_id")` filters demote to belt-and-suspenders (D-14) |
| Making RLS *enforced* (role + claims context) | API/Backend (`dependencies.py` request seam) | Database (role must be non-owner `authenticated`) | The `SET LOCAL ROLE` + claims lives at the request seam; the DB provides the `authenticated` role RLS binds to |
| Identity → claims resolution | API/Backend (`get_current_user`, JWT verify) | Supabase Auth/GoTrue (token issuance) | Claims dict is built from the validated identity; local JWKS verify is an optional latency optimization |
| Retrieval org-isolation (RPC path) | Database (SECDEF fn in-body predicate — **Phase 164**) | Database (`document_chunks.org_id` column — 163 substrate) | SECDEF fns bypass RLS; only an in-body predicate isolates them. 163 lays the column; 164 writes the predicate |
| `org_id` population on INSERT | Database (mig-106 BEFORE-INSERT autofill triggers, already live) | API/Backend (explicit `org_id` optional, trigger no-ops) | Triggers fill `org_id` before RLS `WITH CHECK` evaluates [VERIFIED], so the app need not thread `org_id` for writes to pass |
| Cross-tenant/async writes (agent loop, eval, harness, re-embed) | API/Backend (`get_service_role_supabase(org_id)` — explicit org) | Database (org-aware `.eq` filters) | These paths have no `auth.uid()`; RLS can't bind — org-scoping is app-enforced behind an org-requiring wrapper |

## Standard Stack

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **asyncpg** | `>=0.29` (installed; import verified) | Per-request RLS context via `SET LOCAL` on the existing pool | Native-async (no `run_in_threadpool`), no extra PostgREST hop, reuses the JSONB-codec pool. **No new pool, no new dep** [VERIFIED: requirements.txt:30, dependencies.py:5] |
| **supabase-py** | **2.27.2** (installed) | Per-request user-JWT client via `postgrest.auth(jwt)` / anon-key header | The router-dominant path (517 `get_supabase` hits). `postgrest.auth(token, *, username, password)` signature confirmed on the installed build [VERIFIED: `inspect.signature`] |
| **PyJWT** | **2.10.1** (installed, transitive via `supabase_auth`) | Local JWKS/ES256 verify (`PyJWKClient`) + claims extraction (D-04, optional) | Already present; `PyJWKClient` available. Promote to an explicit pin. **Not required for the SET LOCAL to work** (claims come from `current_user["id"]`) [VERIFIED: `importlib.metadata`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **supabase_auth** (renamed `gotrue`) | 2.27.2 (installed) | GoTrue round-trip fallback for token validation | Keep as the D-04 fallback if local JWKS is unavailable (see the HS256-vs-ES256 caveat, Pitfall 4) |
| **httpx** | 0.28.1 (installed) | Shared HTTP transport for the per-request supabase-py client | Pass a shared `httpx_client` via `ClientOptions` to avoid connection fanout (Pitfall 2) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncpg `SET LOCAL` (native async) | supabase-py per-request client on the raw-SQL paths | supabase-py is sync → `run_in_threadpool` + a PostgREST hop; only acceptable as a bridge where an asyncpg rewrite is too costly this milestone |
| Local JWKS verify (drop GoTrue round-trip) | Keep `supabase.auth.get_user()` per request | JWKS needs asymmetric signing keys enabled; local dev likely runs legacy HS256 (Pitfall 4). GoTrue fallback is correct short-term |
| Both GUC forms | JSON `request.jwt.claims` only | JSON-only silently breaks `auth.uid()` on an old local/self-hosted `auth.uid()` (issue #29332) → RLS fails closed → local app breaks (violates D-11) |
| Reuse `get_pg_pool` (no new pool) | A second pool / pgbouncer for tenancy | Multiplies connection pressure under `WORKER_COUNT=2` (ceiling ~20); splits the codec/config story. Rejected by STACK.md |

**Installation:** No new hard runtime dependency. Optionally promote the already-present PyJWT to an explicit pin (D-04):
```bash
# requirements.txt — promote the transitive JWT lib to an explicit pin (already installed 2.10.1):
pyjwt>=2.10.1
```

**Version verification (2026-07-19, this repo's venv):**
```
supabase        2.27.2   (requirements floor is >=2.29.0 — venv is slightly BEHIND; see Environment Availability)
postgrest       2.27.2
supabase_auth   2.27.2   (the renamed gotrue package)
pyjwt           2.10.1   (has PyJWKClient)
httpx           0.28.1
asyncpg         >=0.29   (imported at dependencies.py:5)
```

## Package Legitimacy Audit

163 installs **no new external packages**. Every library the phase relies on is already in the venv. No slopcheck / registry audit is required because there is nothing new to install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| asyncpg | PyPI | mature | very high | github.com/MagicStack/asyncpg | n/a (already installed) | Already a direct dep |
| supabase (supabase-py) | PyPI | mature | very high | github.com/supabase/supabase-py | n/a (already installed) | Already a direct dep |
| PyJWT | PyPI | mature | very high | github.com/jpadilla/pyjwt | n/a (already installed, transitive) | Promote to explicit pin (optional) |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new installs).
**Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────── FastAPI request ────────────────────────┐
   Authorization: Bearer  │                                                                  │
   <user JWT>  ───────────▶  get_current_user()                                              │
                          │    ├─ validate token (GoTrue round-trip today; local JWKS = D-04 opt) │
                          │    └─ identity = {"id": <uuid>, "email": …}   ◀── claims source  │
                          │                         │                                        │
                          │        ┌────────────────┴────────────────┐                       │
                          │        ▼                                 ▼                        │
                          │  Front B path 1:                   Front B path 2:               │
                          │  get_user_supabase(request)        get_user_pg_connection(req)   │
                          │  (supabase-py / PostgREST)         (raw asyncpg, existing pool)  │
                          │   client(anon_key,                  acquire() ▶ transaction():   │
                          │     Authorization=Bearer JWT)         SET LOCAL ROLE authenticated│  ◀── turns RLS ON
                          │   .postgrest.auth(jwt)                SET LOCAL request.jwt.claim.sub = uid │
                          │   run_in_threadpool(...)              SET LOCAL request.jwt.claims = {sub,role} │  ◀── BOTH forms
                          │        │                                 │                        │
                          └────────┼─────────────────────────────────┼────────────────────────┘
                                   ▼                                 ▼
                         PostgREST (role=authenticated)     Postgres (role=authenticated, non-owner)
                                   │                                 │
                                   └──────────────┬──────────────────┘
                                                  ▼
                                   RLS policies (TO authenticated) evaluate:
                                     org_id IN (SELECT current_user_org_ids())  ── reads auth.uid() → org_members
                                     AND (user_id = auth.uid() OR is_global OR is_system OR dept)
                                                  │
                        ┌─────────────────────────┴──────────────────────────┐
                        ▼                                                      ▼
         Retrieval RPCs (match_document_chunks,                  Direct-table SELECT/INSERT/UPDATE
         keyword_search_chunks) — SECURITY DEFINER               (documents, threads, skills, …)
         ▶ BYPASS RLS ◀ — org filter is Phase 164's              ▶ RLS ENFORCED ◀ (needs org_id index
         in-body predicate; 163 only lays document_chunks.org_id   on document_chunks for direct scans)

   SERVICE-ROLE (retained, hardened): get_service_role_supabase(org_id) — agent loop / eval / harness /
   re-embed writers (no auth.uid()); org-aware .eq filters. REFUSES to construct without an explicit org.
```

### Recommended Project Structure
```
backend/app/
├── dependencies.py          # Front B seam: + get_user_supabase(request)
│                            #                + get_user_pg_connection(request) (async CM)
│                            #                + get_service_role_supabase(org_id) (hardened wrapper)
│                            #   get_supabase()/get_pg_pool()/get_current_user() stay (service-role + validation)
├── api/                     # routers swap Depends(get_supabase) → Depends(get_user_supabase) on hot paths
│   ├── threads.py           # Wave-0 extraction target FIRST (D-01); then org_id threading
│   └── …                    # the 100 connectionless pool.*() calls → explicit acquire()+transaction()
├── services/
│   ├── agent_loop.py        # D-05 service-role writer — KEEP service-role, widen .eq to org-aware
│   ├── eval_runner_service.py, harness_engine.py, reembed_service.py  # D-05 writers
│   └── run_producer.py      # NEW (Wave-0) — extracted producer shell (Claude's discretion on name)
└── db/runs.py               # D-05 async-writer raw SQL (service-role path)

supabase/migrations/
├── 107_*.sql …              # RLS bundles (inert-first) + document_chunks/skill_embeddings org_id+index
                             # (next free slot = 107; verify at plan time)
```

### Pattern 1: asyncpg per-request RLS context (the load-bearing fix)
**What:** Productionize the `test_110` prototype into `get_user_pg_connection(request)`.
**When to use:** Every request-scoped raw-SQL path (NOT the four D-05 async writers).
**Example:**
```python
# Source: productionized from test_110_dm_schema.py:302-314 [VERIFIED prototype passes on live local DB]
# GUC-variant RESOLVED: set BOTH forms (see §asyncpg RLS Context for the evidence).
from contextlib import asynccontextmanager
import json

@asynccontextmanager
async def get_user_pg_connection(request, current_user: dict):
    uid = current_user["id"]                      # already validated by get_current_user — no re-decode needed
    claims_json = json.dumps({"sub": uid, "role": "authenticated"})
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():            # REQUIRED — scopes every SET LOCAL to this txn
            await conn.execute("SET LOCAL ROLE authenticated")               # ⚠️ turns RLS ON (Pitfall 1)
            # Legacy per-claim GUC — makes auth.uid() resolve on OLD local/self-hosted auth.uid() (#29332)
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid))
            # JSON blob — cloud auth.uid() fallback + auth.jwt()/auth.role()/future custom claims
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", claims_json)
            yield conn
    # transaction COMMIT → every SET LOCAL auto-reverts → connection safe to return to pool
```
- `is_local := true` (the 3rd arg) is **correct** and mandatory on a pooled connection — it auto-reverts at COMMIT, exactly how PostgREST behaves. Never `false` on the shared pool (that leaks claims to the next borrower). [CITED: PostgREST auth docs; asyncpg pool `reset()` runs `RESET ALL` on release as a backstop — Pattern below]
- Claims are built from the already-resolved `current_user["id"]` — **the SET LOCAL is decoupled from D-04's JWKS optimization**. Even if local JWKS is unavailable (HS256 stack), this works.

### Pattern 2: supabase-py per-request user-JWT client (no singleton mutation)
**What:** `get_user_supabase(request)` bound to the caller's JWT WITHOUT mutating the shared singleton.
**When to use:** The router-dominant supabase-py hot paths (517 `get_supabase` hits, mostly `Depends`-injected).
**Example:**
```python
# Source: postgrest.auth signature VERIFIED on installed supabase-py 2.27.2
# .postgrest.auth(jwt) MUTATES the client — calling it on the shared singleton RACES across
# concurrent requests + threadpool workers (Pitfall 2). Build a per-request client with the
# ANON key + the user JWT, reusing a shared httpx transport to avoid connection fanout.
from supabase import create_client, ClientOptions

def get_user_supabase(request, current_user, token: str):
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,                      # ANON key — NOT service_role (which bypasses RLS)
        options=ClientOptions(
            headers={"Authorization": f"Bearer {token}"},# PostgREST switches to role=authenticated
            httpx_client=_shared_httpx,                  # reuse transport — no per-request connection pool
        ),
    )
# All calls still block → keep run_in_threadpool (D-v2.5-01).
```
- **`supabase_anon_key` exists in settings** (default `""`, populated for `/public-config`) [VERIFIED: config.py:755]. The RLS-enforcing supabase-py path REQUIRES the anon key, not the service_role key.
- The bearer token is what makes PostgREST run as `authenticated`; the `apikey` must not be `service_role` or RLS is bypassed.

### Pattern 3: The RLS predicate rewrite — use the LIVE org-table template verbatim
**What:** Copy the pattern already live on the 8 org tables. Note the EXACT live form.
**Example:**
```sql
-- Source: full-schema.sql:212-217 + org-table policies (departments_select :4990, etc.) [VERIFIED live]
-- current_user_org_ids() RETURNS SETOF uuid  (NOT uuid[]) — so the live template is IN (SELECT …),
-- NOT "= ANY(array)". The research base / roadmap wrote "= ANY(current_user_org_ids())" as shorthand;
-- the LIVE, working form on all 8 org tables is:
--     org_id IN ( SELECT public.current_user_org_ids() )
-- Both are valid SQL, but IN (SELECT …) matches SETOF and is the proven-live idiom — use it.

DROP POLICY IF EXISTS "Users can view own and global folders" ON public.folders;   -- exact quoted name
CREATE POLICY "folders_select" ON public.folders FOR SELECT TO authenticated
USING (
  org_id IN ( SELECT public.current_user_org_ids() )
  AND ( user_id = auth.uid() OR public.folder_is_globally_visible(id) )   -- preserve today's global branch
);
```
- `current_user_org_ids()` is `SECURITY DEFINER STABLE SET search_path TO 'public'` reading `org_members WHERE user_id = auth.uid()` [VERIFIED: full-schema.sql:212-217] — it breaks the `42P17` recursion and is index-backed by `idx_org_members_user_id` [VERIFIED: full-schema.sql:2947].
- `current_user_has_permission(org_id, key)` for write-gates where a permission applies [VERIFIED: full-schema.sql:193-205].
- Policies declared `TO authenticated` — matches the live org template; reinforces the role-swap requirement.

### Anti-Patterns to Avoid
- **Claims without the role swap.** Setting `request.jwt.claims` while the connection stays `postgres` is a silent no-op (owner bypasses RLS). The role swap is the fix.
- **`postgrest.auth(jwt)` on the shared singleton.** Mutates shared state → cross-request identity bleed under concurrency. Build per-request.
- **`= ANY(current_user_org_ids())` where the fn returns SETOF.** Use `IN (SELECT …)` — the live, proven form.
- **`CREATE OR REPLACE POLICY`.** Postgres has no such statement. Use `DROP POLICY IF EXISTS "…" ON t;` then `CREATE POLICY`.
- **Adding an `org_id` per-row JOIN to `documents` in `match_document_chunks`.** Denormalize onto `document_chunks` instead (D-07) — but note this is Phase 164's in-body concern; 163 only lays the column.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resolve caller's org set inside RLS | An inline subquery against `org_members` in every policy | `current_user_org_ids()` SD helper (already live) | Inlining on `org_members`'s own policy = `42P17` infinite recursion; the helper breaks it and is index-backed |
| `org_id` on INSERT | App-thread `org_id` through every writer | mig-106 BEFORE-INSERT autofill triggers (already live) | Triggers fill `org_id` from owner/parent BEFORE RLS `WITH CHECK` evaluates [VERIFIED]; the app need not set it (forward-compat no-op guard) |
| Reset pooled connection after `SET LOCAL` | Manual `RESET ROLE`/`DISCARD` after each request | Transaction-scoped `SET LOCAL` + asyncpg's built-in `reset()` on release | `SET LOCAL` auto-reverts at COMMIT; asyncpg runs `RESET ALL` on pool release as a backstop |
| Verify Supabase JWT | Hand-roll HS256/ES256 verification | PyJWT `PyJWKClient` (D-04) OR keep GoTrue round-trip | Signing-key handling + rotation is a solved problem; don't reinvent (and the claims come from the validated identity anyway) |
| Per-request RLS client | A second Postgres pool / pgbouncer for tenancy | The existing `get_pg_pool` + `SET LOCAL` wrapper | A parallel pool multiplies connection pressure under `WORKER_COUNT=2` |

**Key insight:** The mig-106 autofill triggers + the live `current_user_org_ids()`/`current_user_has_permission()` helpers mean 163 is mostly *assembly of proven parts*, not invention. The genuinely new work is the two request-seam factories and the mechanical predicate rewrite.

## Runtime State Inventory

163 is not a rename phase, but TEN-04 performs a **data migration** (`org_id` backfill on two tables), and there is one environment-state hazard (the local `auth.uid()` variant). Both are runtime state a grep cannot find.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `document_chunks` (has NO `org_id`; potentially large — the pgvector hot table) + `skill_embeddings` (NO `org_id`; ~empty, tens–hundreds of rows) need `org_id` denormalized + backfilled from the parent `documents`/`skills` FK, then `NOT NULL` after verified zero-NULL. | **Data migration** (batched ~10k-row windows for `document_chunks`, mirroring mig-105's self-guarded pattern) + **code**: add both tables to the mig-106 autofill-trigger net (parent-FK resolver) so future INSERTs auto-fill |
| Live service config | None. No external service (n8n, Datadog, Task Scheduler) embeds 163's identifiers. Redis `run:{run_id}` carries no org in the key — org-scoping is inherited via the `runs` row's RLS (D-10). | None — verified: Redis keys are `run_id`-only by design (CLAUDE.md run-buffer conventions) |
| OS-registered state | None — verified: no OS-level registration touches RLS/org context. | None |
| Secrets/env vars | `POSTGRES_DSN` role is `postgres` (BYPASSRLS) — the reason the role swap is load-bearing. `SUPABASE_ANON_KEY` must be populated for the supabase-py user-JWT path (defaults `""`). No secret rename. | **Verify** `SUPABASE_ANON_KEY` is set in `backend/.env` before the client swap (it is used by `/public-config` today, so likely present) |
| Build artifacts / installed packages | The venv's `supabase`/`postgrest` are **2.27.2**, BELOW the `requirements.txt` floor of `>=2.29.0`. The `postgrest.auth()` idiom is confirmed on 2.27.2, so the swap works as-is — but a `pip install -r requirements.txt` would bump it. **The local `auth.uid()` may be an OLD variant** (reads only `request.jwt.claim.sub`) vs cloud (reads both). | **Wave-0 probe:** run `SELECT pg_get_functiondef('auth.uid()'::regprocedure)` on the live local DB to record which variant is installed; set BOTH GUC forms regardless so the code is variant-independent |

**The canonical question answered:** After the RLS bundles ship, the only runtime systems still carrying "old" behavior are (a) any connection that forgets the role swap (caught by the leak test's role-swap-noop detector) and (b) the local `auth.uid()` if it differs from cloud (neutralized by setting both GUC forms).

## Common Pitfalls

### Pitfall 1: The role swap is a silent no-op if omitted — RLS looks on but is bypassed
**What goes wrong:** You set `request.jwt.claims` but the connection stays `postgres`. `postgres` owns the tables (RLS-exempt) and the policies are `TO authenticated` (role miss) — RLS never evaluates. Single-tenant tests stay green because there's no second org to leak into.
**Why it happens:** "Set the claims" reads as the whole fix; the role switch is the invisible load-bearing half.
**How to avoid:** `SET LOCAL ROLE authenticated` FIRST, inside the transaction. The prototype already does this and passes [VERIFIED: test_110].
**Warning signs:** A query through `get_pg_pool()` returns another user's rows even with claims set; `SELECT current_user` returns `postgres` mid-request.
**Leak-test detector (D-08):** Run the same SELECT WITHOUT the role swap (stays `postgres`) → expect ALL rows (proves BYPASSRLS). WITH the swap → expect own rows only. The diff proves the swap is taking effect.

### Pitfall 2: `postgrest.auth(jwt)` mutates the shared singleton — cross-request identity bleed
**What goes wrong:** Calling `.postgrest.auth(jwt)` on the `get_supabase()` singleton mutates its Authorization header; a concurrent request (or a threadpool worker under `WORKER_COUNT=2`) sees another user's token.
**Why it happens:** `auth()` is a stateful setter on a shared client; the mutation is process-global.
**How to avoid:** Build a per-request client (anon key + user JWT header) with a **shared `httpx_client`** to avoid connection fanout (Pattern 2).
**Warning signs:** Intermittent wrong-user reads under load; CONCUR-01 flakes with cross-thread data.

### Pitfall 3: `is_local=false` (session SET) on a pooled connection leaks across users
**What goes wrong:** `set_config(..., false)` or a bare `SET` persists on the connection after the request; the next pool borrower inherits the prior user's claims/role.
**Why it happens:** The Supabase "direct connection" discussion #30124 shows `is_local=false` [CITED] — correct for a *dedicated* connection, WRONG for our shared pool.
**How to avoid:** Always `is_local=true` inside an explicit transaction. asyncpg's pool `reset()` runs `RESET ALL` + rolls back on release as a backstop [CITED: asyncpg pool docs], but transaction-scoping is the primary discipline — it is also the only form safe under **asyncio task cancellation** (SSE client disconnect cancels the task; a leaked session-level SET could survive, but a `SET LOCAL` inside a txn rolls back) [CITED: sqlalchemy discussion #12460 — asyncpg leaks open transactions on task cancel].
**Warning signs:** A user occasionally sees another user's data after a burst; `SELECT auth.uid()` returns a stale UUID at the start of a fresh request.

### Pitfall 4: Local JWKS (D-04) assumes asymmetric signing keys — local dev is likely HS256
**What goes wrong:** `PyJWKClient` fetches `/.well-known/jwks.json` expecting ES256 keys, but the local Supabase stack signs tokens with the legacy shared HS256 secret → no asymmetric keys → verification fails.
**Why it happens:** Supabase asymmetric JWT signing keys (ES256/JWKS) are GA but **opt-in**; local CLI stacks default to the legacy HS256 symmetric secret unless signing keys are enabled.
**How to avoid:** D-04's local JWKS is a *latency optimization* on `get_current_user`, decoupled from the SET LOCAL (which uses `current_user["id"]`). Keep the GoTrue round-trip as the fallback (D-04 says this). Probe the environment: if JWKS returns no keys, verify with the HS256 secret or keep the round-trip. **Do not let D-04 block the client swap** — the swap works with today's GoTrue-validated identity.
**Warning signs:** `PyJWKClient` raises `PyJWKClientError`/`no matching kid` locally; tokens decode with HS256 but not ES256.

### Pitfall 5: The `document_chunks` RLS is inert on the retrieval hot path — a false perf worry AND a real 164 dependency
**What goes wrong (two ways):** (a) Planning a CONCUR-01 regression from "pgvector + membership RLS" when the retrieval RPCs are `SECURITY DEFINER` and bypass RLS — the predicted cliff doesn't exist on that path. (b) Assuming 163's `document_chunks` RLS *isolates retrieval* — it does not; a cross-org retrieval leak stays open until Phase 164 adds the in-body org predicate. 163 only lays the substrate.
**Why it happens:** RLS "feels" like it covers all reads; SECDEF functions are the exception (owner privilege, in-body WHERE is the only gate) [VERIFIED: full-schema.sql:283, :310].
**How to avoid:** Scope 163's TEN-04 to (a) the `org_id` column + backfill + index as *164 substrate*, and (b) benchmarking the **real** CONCUR-01 risk: the SET-LOCAL round-trip overhead on the asyncpg hot path. State explicitly that retrieval org-isolation is Phase 164.
**Warning signs:** A plan task claims "retrieval is now org-isolated" in 163; a benchmark measures RPC latency change from RLS (there is none) instead of SET-LOCAL overhead.

### Pitfall 6: The 100 connectionless `pool.*()` calls silently keep BYPASSRLS behavior
**What goes wrong:** `pool.fetch(...)` / `pool.execute(...)` acquire+release a connection implicitly and CANNOT carry a `SET LOCAL` — they run as `postgres`, bypassing RLS. If the swap only wraps `acquire()` sites, these 100 calls stay bypassed.
**Why it happens:** The connectionless form is terser and pervasive (100 calls / 21 files [VERIFIED: grep]).
**How to avoid:** Convert request-scoped connectionless calls to explicit `async with get_user_pg_connection(...) as conn:`. The four D-05 async-writer files (`db/runs.py`, `harness_engine.py`, etc.) legitimately stay service-role (with org-aware filters) — don't convert those.
**Warning signs:** A `pool.fetchval(...)` on a request path returns cross-org rows; grep shows `pool.execute` on a router after the swap.

## Code Examples

### The RESOLVED GUC-variant — set BOTH forms (the phase's central open question)
```python
# Source: auth.uid() canonical body VERIFIED — supabase/auth migration 20211202183645_update_auth_uid.up.sql:
#   select nullif( coalesce(
#     current_setting('request.jwt.claim.sub', true),                       -- legacy per-claim (tried FIRST)
#     (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')        -- JSON blob (FALLBACK)
#   ), '' )::uuid
# Local/self-hosted may ship the OLD variant reading ONLY request.jwt.claim.sub (issue #29332).
# The prototype sets the legacy form and PASSES locally → this local DB reads it.
# ⇒ Set BOTH: legacy = local-safe; JSON = cloud + auth.jwt()/auth.role()/custom claims. D-11-portable.
async with conn.transaction():
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid))
    await conn.execute("SELECT set_config('request.jwt.claims', $1, true)",
                       json.dumps({"sub": uid, "role": "authenticated"}))
    assert await conn.fetchval("SELECT auth.uid()") is not None   # fail-loud in the leak-test harness
```

### The mig-106 autofill trigger already handles `org_id` on INSERT (no app threading needed)
```sql
-- Source: migrations/106_org_id_autofill_trigger.sql [VERIFIED live] + Postgres CREATE POLICY docs [CITED]:
-- "WITH CHECK expressions are enforced AFTER BEFORE triggers are fired ... A BEFORE ROW trigger may
--  modify the data to be inserted, affecting the result of the security policy check."
-- ⇒ The autofill trigger sets NEW.org_id from the owner's membership, THEN the new INSERT policy's
--   WITH CHECK ( org_id IN (SELECT current_user_org_ids()) AND user_id = auth.uid() ) sees the filled
--   org_id and passes. The app does NOT need to thread org_id for INSERTs to succeed under RLS.
-- NOTE: document_chunks + skill_embeddings are NOT in the mig-106 net (they have no org_id yet) — 163
--   adds them to the parent-FK resolver as part of TEN-04.
```

### Re-paste-safe RLS bundle idiom (SQL editor apply)
```sql
-- Source: mig-104/105/106 idempotent idioms [VERIFIED]. No CREATE OR REPLACE POLICY exists in Postgres.
BEGIN;
DROP POLICY IF EXISTS "Users can view own and global skills" ON public.skills;   -- exact quoted live name
DROP POLICY IF EXISTS "Users can insert own skills"          ON public.skills;
CREATE POLICY "skills_select" ON public.skills FOR SELECT TO authenticated
  USING ( org_id IN (SELECT public.current_user_org_ids())
          AND (user_id = auth.uid() OR is_global OR is_system) );   -- LIVE names is_global/is_system (165 renames)
CREATE POLICY "skills_insert" ON public.skills FOR INSERT TO authenticated
  WITH CHECK ( org_id IN (SELECT public.current_user_org_ids()) AND user_id = auth.uid() );
COMMIT;
-- Apply via the Supabase SQL editor (NEVER db push/db reset); then scripts/regenerate-full-schema.sh; same-commit.
```

## pgvector + RLS Performance (TEN-04 — the sharpened perf story)

**Live structure** [VERIFIED: full-schema.sql]:
- `document_chunks`: HNSW `(m=16, ef_construction=64)` on `embedding` (:2572), GIN on `search_vector` (:2579), PK on `id`, FKs to `documents` + `auth.users`. **NO `org_id`, NO `user_id` btree.**
- `skill_embeddings`: PK on `skill_id`, btree `idx_skill_embeddings_user_id` (:3013). **NO `org_id`, NO ANN index** (~empty, tens–hundreds of rows).
- `match_document_chunks` (:310) + `keyword_search_chunks` (:283): **`SECURITY DEFINER`, in-body `WHERE dc.user_id = match_user_id` + JOIN `documents`. Both LACK a pinned `search_path`.**
- `match_skills` (:335): `SECURITY DEFINER`, HAS `SET search_path TO 'public', 'pg_temp'`.

**The counterintuitive finding (headline):** Because the retrieval RPCs are `SECURITY DEFINER`, they **bypass RLS**. 163's new `document_chunks` RLS is therefore *inert on the hot retrieval path*. Adding a membership RLS predicate does NOT change RPC latency or ANN recall — the RPC keeps its `WHERE dc.user_id = match_user_id` post-HNSW filter unchanged. **The predicted "per-row membership join over the pgvector scan" cliff does not occur on the retrieval path in 163.**

**Where the `org_id` column + index actually matter:**
1. **164 substrate:** 164 adds `AND dc.org_id = …` (or a membership check) *in the SECDEF body*. Since `org_id` is functionally determined by `user_id` for a chunk (same owner, same org), this equality is co-selective with the existing `user_id` filter — negligible added cost, and the index supports it.
2. **Direct-table RLS access:** any non-RPC SELECT on `document_chunks` via the user-JWT path (counts, admin reads) now hits RLS and needs an `org_id` index to avoid a seq scan.

**Index recommendation (benchmark-confirmed shape):**
- `document_chunks`: add `org_id uuid` (backfill from `documents.org_id`, NOT NULL after zero-NULL) + a **btree on `(org_id)`** (or composite `(org_id, user_id)` since RLS + the belt-and-suspenders `.eq("user_id")` both filter these). **Leave the HNSW index untouched.** Do NOT attempt per-tenant partial vector indexes (unbounded org count).
- `skill_embeddings`: add `org_id uuid` (backfill from `skills.org_id`) + a **btree on `(org_id)`** (cheap insurance on a tiny table). No ANN index needed.

**What the CONCUR-01 benchmark must actually measure:** not a pgvector recall cliff, but the **per-request `acquire → transaction → SET LOCAL ROLE → set_config ×2 → query` round-trip overhead** the client swap adds to the hot cross-tab-GET-during-streaming path. Two mitigations if it regresses: (a) batch multiple reads within one transaction rather than one txn per query; (b) the D-12 escape valve — bake the membership set into the JWT to drop the `org_members` join (though the join is already a single indexed lookup returning ~1 row, so this is unlikely to be needed). Re-run `test_058_concurrency.py` on the rewrite branch before merge.

**Connection-pool math** [VERIFIED: dependencies.py:88-90]: pool is min 2 / max 10 **per worker** → ceiling ~20 under `WORKER_COUNT=2`. The `SET LOCAL` pattern adds one transaction per request but **no new connections**. Long-lived SSE streams must acquire per DB-operation, not hold a pooled connection for the whole stream.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid()` reads only `request.jwt.claim.sub` | `coalesce(request.jwt.claim.sub, request.jwt.claims::jsonb->>'sub')` | supabase/auth mig `20211202183645` | Local/self-hosted stacks may lag → set BOTH GUC forms |
| Symmetric HS256 shared JWT secret | Asymmetric ES256 + JWKS (opt-in, GA) | Supabase signing-keys GA | D-04 local JWKS only works if signing keys are enabled; else HS256/GoTrue fallback |
| `gotrue` package | `supabase_auth` package | supabase-py 2.x rename | `pip show gotrue` fails; the package is `supabase_auth` (2.27.2 installed) |

**Deprecated/outdated:**
- `= ANY(current_user_org_ids())` array shorthand (roadmap/research): the live fn returns SETOF → use `IN (SELECT …)`.
- Treating "pgvector+RLS" as the TEN-04 perf risk: the retrieval RPCs bypass RLS; the risk is SET-LOCAL RTT.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The local dev `auth.uid()` reads the legacy `request.jwt.claim.sub` (inferred from the passing prototype + issue #29332) | GUC-variant | LOW — mitigated by setting BOTH forms; the Wave-0 `pg_get_functiondef('auth.uid())` probe confirms the exact variant, and D-08 is the final arbiter |
| A2 | Local dev signs JWTs with HS256 (legacy secret), so D-04 local JWKS may not work out of the box | Pitfall 4 | LOW — D-04 is a latency optimization decoupled from the SET LOCAL; GoTrue fallback is retained. Confirm by probing `/.well-known/jwks.json` locally |
| A3 | `postgres` (the `POSTGRES_DSN` role) can `SET ROLE authenticated` | asyncpg RLS | VERY LOW — the prototype does exactly this and passes; `postgres` is superuser-equivalent locally |
| A4 | The venv's supabase-py 2.27.2 `postgrest.auth()` behaves identically to the `>=2.29.0` floor the app will run | Standard Stack | LOW — signature confirmed on 2.27.2; a `pip install -r requirements.txt` bump should be re-smoke-tested (test_supabase_* per requirements.txt:5-6) |

**If this table is short:** the load-bearing claims (auth.uid() body, the SECDEF bypass, the BEFORE-trigger/WITH-CHECK ordering, the 100 connectionless calls, the installed idioms) are all VERIFIED against authoritative sources or live code — only the environment-variant items above remain ASSUMED, and each is neutralized by a Wave-0 probe or the D-08 gate.

## Open Questions

1. **Exact GUC variant the LIVE local `auth.uid()` reads.**
   - What we know: canonical cloud reads both; the prototype's legacy form passes locally; issue #29332 says some local stacks read only legacy.
   - What's unclear: whether THIS local DB's `auth.uid()` also reads the JSON blob.
   - Recommendation: Wave-0 probe `SELECT pg_get_functiondef('auth.uid()'::regprocedure)`; set BOTH forms regardless (variant-independent); D-08 is the arbiter.

2. **Whether D-04's local JWKS works on the local stack (HS256 vs ES256).**
   - What we know: PyJWT 2.10.1 has `PyJWKClient`; asymmetric keys are opt-in.
   - What's unclear: whether the local project has signing keys enabled.
   - Recommendation: probe `/.well-known/jwks.json`; keep GoTrue fallback; do not block the client swap on D-04.

3. **Does any request-scoped path SELECT `document_chunks` directly (non-RPC)?**
   - What we know: retrieval is via SECDEF RPCs (RLS-bypassing); ingest INSERTs chunks.
   - What's unclear: whether counts/admin reads hit the table directly under the user-JWT path.
   - Recommendation: the `org_id` btree covers both cases; benchmark direct-access if any are found at plan time.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres) @ :54322 | Both DB paths, D-08 leak test | ✓ | Postgres 15 | — |
| asyncpg | Front B path 2 | ✓ | >=0.29 (imported) | — |
| supabase-py | Front B path 1 | ✓ | 2.27.2 (< req floor 2.29.0) | `pip install -r requirements.txt` to bump |
| PyJWT (`PyJWKClient`) | D-04 (optional) | ✓ | 2.10.1 | GoTrue round-trip |
| `SUPABASE_ANON_KEY` | supabase-py user-JWT path | ? | env-set (default `""`) | Confirm set in `backend/.env` before the swap |
| Asymmetric JWT signing keys (ES256/JWKS) | D-04 local JWKS | ? (likely NOT locally) | — | HS256 secret verify OR GoTrue round-trip |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local JWKS (fallback: GoTrue round-trip); supabase-py version bump (fallback: 2.27.2 works as-is).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio [VERIFIED: requirements.txt:31-33] |
| Config file | `backend/pytest.ini` / conftest (existing integration suite) |
| Quick run command | `cd backend && python -m pytest tests/integration/test_163_*.py -x` |
| Full suite command | `cd backend && python -m pytest tests/integration -x` |
| Live-DB tooling | psycopg2 @ 127.0.0.1:54322 + the asyncpg pool (both proven in `test_110`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEN-02 | asyncpg `SET LOCAL ROLE` + claims makes `auth.uid()` resolve; user B reads 0 of user A's rows | integration (two-user) | `pytest tests/integration/test_163_leak_asyncpg.py -x` | ❌ Wave 0 |
| TEN-02 | supabase-py user-JWT client (anon key + Bearer) reads 0 of user A's rows | integration (two-user) | `pytest tests/integration/test_163_leak_supabase.py -x` | ❌ Wave 0 |
| TEN-02 | role-swap-noop detector: without `SET LOCAL ROLE`, query returns ALL rows (proves BYPASSRLS); with it, own only | integration | `pytest tests/integration/test_163_role_swap.py -x` | ❌ Wave 0 |
| TEN-01 | each rewritten cluster's SELECT/INSERT/UPDATE/DELETE policy enforces membership + preserves global/system branches | integration (per bundle) | `pytest tests/integration/test_163_rls_<cluster>.py -x` | ❌ Wave 0 |
| TEN-04 | CONCUR-01 <1s cross-tab-GET-during-streaming stays green with the client swap live | integration (perf gate) | `pytest tests/integration/test_058_concurrency.py -x` | ✅ exists |
| TEN-04 | `document_chunks`/`skill_embeddings` `org_id` backfill zero-NULL + NOT NULL + index present | integration/SQL | `pytest tests/integration/test_163_ten04_backfill.py -x` | ❌ Wave 0 |
| D-01 | Deep-Mode byte-identical after Wave-0 extraction; full suite green | integration + UAT | existing Deep byte-identical harness + full suite | ✅ pattern exists (Phase 089) |
| D-09 | SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) | manual UAT (VALIDATION.md) | operator-run | ❌ authored in VALIDATION.md |

### Sampling Rate
- **Per task commit:** `pytest tests/integration/test_163_*.py -x` (the phase's new tests, < 30s target)
- **Per wave merge:** full integration suite + `test_058_concurrency.py`
- **Phase gate:** full suite green + the operator-run D-08 live two-user leak test + SC#10 4-axis UAT before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/test_163_leak_asyncpg.py` — TEN-02 asyncpg two-user leak (the D-08 core)
- [ ] `tests/integration/test_163_leak_supabase.py` — TEN-02 supabase-py two-user leak
- [ ] `tests/integration/test_163_role_swap.py` — the role-swap-noop / claims-spoof detector
- [ ] `tests/integration/test_163_rls_<cluster>.py` — one per RLS bundle (documents/chat/skills/DM/workflow-eval/identity-audit)
- [ ] `tests/integration/test_163_ten04_backfill.py` — org_id backfill + index assertions
- [ ] `tests/integration/conftest.py` fixtures — two seeded users in two orgs (reuse the mig-105 personal orgs OR create two explicit orgs + memberships), plus a `pg_get_functiondef('auth.uid())` probe fixture
- [ ] VALIDATION.md — the SC#10 4-axis UAT rows (operator-run) + the D-08 live-leak-test runbook

### The Live Two-User Leak Test Design (D-08 — the acceptance gate)

**Harness (pytest against live local Supabase :54322):**

1. **Seed** two users in two orgs. Cheapest: reuse the two existing dev users' personal orgs from the mig-105 backfill; else create Org X + Org Y with one `org_members` row each. Seed user A rows in a representative table set (`documents`, `folders`, `threads`, `messages`, `skills`, `user_memory`) in Org X; user B rows in Org Y. (The mig-106 autofill trigger populates `org_id` automatically.)

2. **Fail-loud preflight (catches the Pitfall-1 silent no-op):** for each user, after `SET LOCAL ROLE authenticated` + claims, assert `SELECT auth.uid()` equals that user's UUID. If it returns NULL, the GUC variant is wrong for this DB → the test STOPS (do not proceed to isolation asserts that would false-pass at "0 rows").

3. **Positive control (catches a broken harness that returns 0 for everything):** assert user B CAN read user B's own rows (> 0). A harness where the role swap over-restricts would fail this.

4. **Isolation assertions across BOTH paths, for the representative table set:**
   - asyncpg path: as user B (role + both GUC forms) → `SELECT count(*) … WHERE <A's row ids>` = **0**; `UPDATE`/`DELETE` of A's rows affects **0**.
   - supabase-py path: per-request client (anon key + user B's Bearer) → same table reads return **0** of A's rows.

5. **Role-swap-noop detector:** run one representative SELECT WITHOUT the role swap (stays `postgres`) → assert it returns A's rows (proves BYPASSRLS is the default). Then WITH the swap → **0**. The diff proves the swap is the thing turning RLS on.

6. **Spoof / fail-closed cases:**
   - No claims set (fresh transaction, role `authenticated`, `auth.uid()` NULL) → **0 rows** (fail-closed).
   - Claims with user B's `sub` but assert B cannot reach Org X rows (membership, not just ownership, is the gate).
   - A random/non-member `sub` → **0 rows**.

7. **GUC-variant arbitration (the D-02 deliverable):** the test is parameterized to run with (a) legacy-only, (b) JSON-only, (c) both. Record which variants make `auth.uid()` resolve on THIS DB. The phase ships whichever set passes; **both** is the recommended default and the only D-11-portable choice.

**Per `feedback_user_starts_backend` + `browser-uat-user-driven`: the operator runs the live test; the harness is authored so the operator runs one command and reads a pass/fail scoreboard.**

## Security Domain

163 is the milestone's security core (ROADMAP threat-model flag). The whole phase IS a security control.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | **yes** | Postgres RLS membership predicates (`org_id IN (SELECT current_user_org_ids())`) as the primary gate; `.eq("user_id")` belt-and-suspenders (D-14) |
| V2 Authentication / Session | partial | Existing GoTrue token validation; D-04 local JWKS optional; the SET-LOCAL claims are derived from the validated identity |
| V5 Input Validation | yes | Parameterized `set_config` (never string-interpolate claims — SQL-injection vector per discussion #30124) |
| V6 Cryptography | no (this phase) | JWT signature verification is GoTrue/PyJWT's concern; no hand-rolled crypto |
| V1 Architecture | yes | Two-front atomicity; org context at the request seam only (D-09), no shared-path fork |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role / `postgres`-owner connection bypasses RLS | Elevation of Privilege | `SET LOCAL ROLE authenticated`; hardened `get_service_role_supabase(org_id)`; CI grep guard on hot-path `get_supabase` imports |
| Claims leak across pooled connections (`is_local=false`) | Information Disclosure | Transaction-scoped `SET LOCAL` (`is_local=true`); asyncpg `RESET ALL` on release |
| `postgrest.auth()` singleton mutation → cross-request identity | Information Disclosure / Spoofing | Per-request client construction, no singleton mutation |
| Retrieval RPC (SECDEF) returns cross-org chunks | Information Disclosure | **Phase 164** in-body org predicate (163 lays `document_chunks.org_id` substrate only) |
| `auth.uid()` NULL due to wrong GUC variant → RLS fails OPEN? | Elevation of Privilege | It fails **CLOSED** (NULL uid → 0 rows), never open — but a wrong variant BREAKS the app locally; set both forms + fail-loud preflight |
| SQL injection via interpolated claims | Tampering | Parameterized `set_config(..., $1, true)` |

## Sources

### Primary (HIGH confidence)
- Live code: `backend/app/dependencies.py` (service-role singleton :21-25, asyncpg pool :79-105, `get_current_user` :130-151), `backend/app/config.py:745-757` (anon key), `backend/.env.example` (`POSTGRES_DSN` = `postgres` role), `backend/requirements.txt`, installed-version probe via `importlib.metadata` + `inspect.signature(postgrest.auth)`.
- Live schema `supabase/full-schema.sql`: `current_user_org_ids()` :212-217, `current_user_has_permission()` :193-205, `match_document_chunks` :310 (SECDEF, unpinned), `keyword_search_chunks` :283 (SECDEF, unpinned), `match_skills` :335 (SECDEF, pinned), `document_chunks` :759-770 + HNSW :2572 + GIN :2579, `skill_embeddings` :1458-1466 + btree :3013, `org_members` indexes :2943/:2950, org-table policy template (departments/org_members/etc. `TO authenticated` + `IN (SELECT current_user_org_ids())`).
- Live migrations: `106_org_id_autofill_trigger.sql` (BEFORE-INSERT autofill net, forward-compat no-op guard, `document_chunks`/`skill_embeddings` ABSENT). Next free slot = 107.
- Prototype: `tests/integration/test_110_dm_schema.py:302-314` (`SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', …, true)`, passes on live local DB).
- Supabase/auth canonical `auth.uid()`: https://github.com/supabase/auth/blob/master/migrations/20211202183645_update_auth_uid.up.sql
- PostgreSQL CREATE POLICY (WITH CHECK enforced after BEFORE triggers): https://www.postgresql.org/docs/current/sql-createpolicy.html
- asyncpg pool `reset()`/`RESET ALL` on release: https://magicstack.github.io/asyncpg/current/_modules/asyncpg/pool.html

### Secondary (MEDIUM confidence)
- Supabase issue #29332 (local `auth.uid()` reads only `request.jwt.claim.sub` vs cloud coalesce): https://github.com/supabase/supabase/issues/29332
- Supabase discussion #30124 (direct-connection `set_config('request.jwt.claims', …)` + role; uses `is_local=false` — correct for dedicated conns, not our pool): https://github.com/orgs/supabase/discussions/30124
- sqlalchemy discussion #12460 (asyncpg leaks open transactions on asyncio task cancel → reinforces transaction-scoped SET LOCAL): https://github.com/sqlalchemy/sqlalchemy/discussions/12460
- Supabase RLS troubleshooting / performance: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- v3.4 research base: `.planning/research/{SUMMARY,STACK,PITFALLS,ARCHITECTURE}.md`.

### Tertiary (LOW confidence)
- None. The two candidate-LOW items (the `is_local` flag semantics; the exact local `auth.uid()` variant) were promoted to explicit VERIFIED-with-caveat findings + a Wave-0 probe + the D-08 gate, not silently trusted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version + idiom probed against this repo's venv (`postgrest.auth` signature, PyJWT `PyJWKClient`, supabase_auth rename).
- asyncpg RLS pattern + GUC variant: HIGH — canonical `auth.uid()` body verified against supabase/auth source; local-variant hazard verified against issue #29332; empirically corroborated by the passing prototype; both-forms recommendation is D-11-portable.
- pgvector + RLS perf: HIGH — the SECDEF-bypass finding is verified against the live function definitions; the perf risk is re-attributed to SET-LOCAL RTT (measurable, mitigable), not an unmeasured recall cliff.
- Rollout safety + trigger/WITH-CHECK ordering: HIGH — verified against Postgres docs + the live mig-106.
- Residual: the local `auth.uid()` variant + local JWKS availability remain environment-ASSUMED (A1/A2), each neutralized by a Wave-0 probe and the operator-run D-08 gate.

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (stable — Postgres/RLS/asyncpg semantics are slow-moving; re-verify the installed supabase-py version if `pip install -r requirements.txt` runs)
