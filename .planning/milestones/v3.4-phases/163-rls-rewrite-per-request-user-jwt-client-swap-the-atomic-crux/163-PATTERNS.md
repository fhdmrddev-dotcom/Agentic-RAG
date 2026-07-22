# Phase 163: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** ~20 surfaces (2 new dep seams, 4 Wave-0 extraction modules, 2 migration bundles, 8 test files, 4 async-writer widens + threads.py + cross-cutting router swap)
**Analogs found:** 18 / 20 (2 partial — the per-request supabase-py client shape + optional local-JWKS verify have no live analog; RESEARCH Patterns 2 & 4 supply them)

> **Read-me for the planner:** 163 is *assembly of proven parts*, not invention. Almost every new surface has a live, working analog in this exact codebase. The genuinely-new work is (a) the two request-seam factories in `dependencies.py`, (b) the mechanical predicate rewrite (copy the 8-org-table template), and (c) the byte-identical `threads.py` extraction. This map points each at its analog with `file:line` refs.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/dependencies.py` → `get_user_pg_connection(request)` | dependency seam (async CM) | request-response | `tests/integration/test_110_dm_schema.py:302-314` (`_select_count_as_user`) + `dependencies.py:79-105` (`get_pg_pool`) | **exact** (prototype passes live) |
| `backend/app/dependencies.py` → `get_user_supabase(request)` | dependency seam (factory) | request-response | `dependencies.py:21-25` (`get_supabase` singleton — invert to per-request) | partial (RESEARCH Pattern 2 supplies the non-mutating shape) |
| `backend/app/dependencies.py` → `get_service_role_supabase(org_id)` | dependency seam (hardened factory) | request-response | `dependencies.py:21-25` (`get_supabase`) + `:247-264` (`require_operator` refuse-without-scope posture) | role-match |
| `backend/app/services/run_producer.py` (NEW) | service | streaming / event-driven | `backend/app/services/run_lifecycle.py` (Phase 145 extraction) + `agent_loop.py::run_agent_loop` (Phase 089) | **exact** (established extract-from-threads.py pattern) |
| `backend/app/services/workflow_kickoff.py` (NEW) | service | request-response | `run_lifecycle.py` (extraction precedent); source = `threads.py:956-1016` + kickoff block `:1036-1017` | role-match |
| `backend/app/services/thread_title.py` (NEW) | service (utility) | request-response (LLM call) | `run_lifecycle.py` (extraction precedent); source = `threads.py:754-896` (already-cohesive title subsystem) | **exact** (lowest-risk, self-contained) |
| `backend/app/services/run_model_resolution.py` (NEW) | service (transform) | transform | `run_lifecycle.py` (extraction precedent); source = `threads.py:196-341` (`_resolve_enabled_model` / `_reresolve_fallback_provider` / `_apply_fallback_to_request`) | **exact** |
| `supabase/migrations/107_*.sql` — RLS bundles (~6 clusters) | migration (DDL) | batch | org-table policies `full-schema.sql:4976-5235` (`departments_*` template) + `104_org_dept_role_schema.sql` idioms | **exact** (same predicate shape, already live) |
| `supabase/migrations/108_*.sql` — TEN-04 `org_id`+backfill+index | migration (data-migration) | batch / transform | `104_...:448-450` (col+index idiom) + `105_...:330-351` (parent-FK batched backfill) + `105_...:398-403` (self-guarded NOT-NULL flip) | **exact** |
| `backend/tests/integration/test_163_leak_asyncpg.py` (NEW) | test | request-response | `test_119_leak.py` (two-user live harness) + `test_110_dm_schema.py:302-314` (SET-LOCAL-as-user) | **exact** (fusion of two live analogs) |
| `backend/tests/integration/test_163_leak_supabase.py` (NEW) | test | request-response | `test_119_leak.py` + `tests/integration/_reembed_adapter.py::SupabaseTxnAdapter` (supabase-py-over-asyncpg-txn) | **exact** |
| `backend/tests/integration/test_163_role_swap.py` (NEW) | test | request-response | `test_110_dm_schema.py:302-314` (run same SELECT with/without `SET LOCAL ROLE`) | role-match |
| `backend/tests/integration/test_163_rls_<cluster>.py` (NEW ×6) | test | request-response | `test_110_dm_schema.py` (per-table RLS harness) + `test_111_1_reembed_rls.py` | **exact** |
| `backend/tests/integration/test_163_ten04_backfill.py` (NEW) | test | batch | `test_110_dm_schema.py::_table_exists` (:294-299) + SQL count asserts | role-match |
| `backend/tests/integration/conftest.py` (MOD — two-user/two-org fixtures) | test fixture | — | `test_119_leak.py` seed/teardown + `conftest.py` pool-reset autouse | role-match |
| `backend/tests/integration/test_058_concurrency.py` (perf gate — reuse, not rewrite) | test | streaming | itself — `:270` `assert elapsed < 1.0` is the CONCUR-01 gate | **exact** (already exists) |
| `backend/app/api/threads.py` (MOD — Wave-0 source + org_id threading) | controller / router | streaming | `run_lifecycle.py` (what was already extracted) | self (extraction source) |
| `backend/app/db/runs.py` (MOD — org-aware reads) | model / db | CRUD | `db/runs.py:52-66` `insert_run` (omits `org_id` — trigger fills) | self |
| `backend/app/services/eval_runner_service.py` (MOD — widen `.eq`) | service | batch | `eval_runner_service.py:261,697` (`.eq("user_id", user_id)`) | self |
| `backend/app/services/harness_engine.py` (MOD — widen `.eq`) | service | event-driven | `harness_engine.py:1481` (`_service_supabase = get_supabase()`) | self |
| `backend/app/services/reembed_service.py` (MOD — widen `.eq`) | service | batch | `reembed_service.py:17,123,154,201,211` (RLS-scoped `.eq("user_id")` read+write) | self |
| Routers swapping `Depends(get_supabase)` → `Depends(get_user_supabase)` (cross-cutting, ~98 files) | controller | request-response | any router currently `Depends(get_supabase)`; central seam swap | shared pattern |

---

## Pattern Assignments

### `backend/app/dependencies.py` → `get_user_pg_connection(request)` (dependency seam, request-response)

**Analog:** `backend/tests/integration/test_110_dm_schema.py:302-314` — THE live SET-LOCAL prototype that already passes on the local DB. Productionize it verbatim (add the JSON GUC form).

**The prototype to productionize** (`test_110_dm_schema.py:302-314`):
```python
async def _select_count_as_user(pool, user_id, sql: str, *args) -> int:
    """Run a SELECT under RLS as the given user (authenticated role + JWT sub).
    A superuser pool bypasses RLS; SET LOCAL ROLE authenticated + the JWT-sub
    config make auth.uid() resolve to user_id for the duration of the tx."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute(
                "SELECT set_config('request.jwt.claim.sub', $1, true)", str(user_id)
            )
            return await conn.fetchval(sql, *args)
```

**Productionized shape** (RESEARCH Pattern 1 — set BOTH GUC forms; `is_local=true` on the 3rd arg is mandatory on the shared pool):
```python
# claims come from current_user["id"] (already validated by get_current_user) — decoupled from D-04 JWKS
uid = current_user["id"]
async with pool.acquire() as conn:
    async with conn.transaction():                                       # scopes every SET LOCAL to this txn
        await conn.execute("SET LOCAL ROLE authenticated")               # ⚠️ THE load-bearing line (turns RLS on)
        await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid))   # legacy (local-safe)
        await conn.execute("SELECT set_config('request.jwt.claims', $1, true)",
                           json.dumps({"sub": uid, "role": "authenticated"}))                  # JSON (cloud)
        yield conn
```

**Pool source** (`dependencies.py:79-105`, `get_pg_pool` — REUSE, no new pool): singleton asyncpg pool, `min 2 / max 10` per worker, JSONB codec registered per-connection via `_init_pg_connection` (`:58-76`). Note `command_timeout=30`.

**Claims source** (`dependencies.py:130-151`, `get_current_user`): returns `{"id": ..., "email": ...}` — the `id` is the claims `sub`. D-04's local-JWKS verify is an *optional* swap for the `supabase.auth.get_user(token)` round-trip at `:136`; it does NOT gate the SET LOCAL.

**Load-bearing invariants (do not drop):**
- `SET LOCAL ROLE authenticated` FIRST, inside the txn — omitting it is a silent BYPASSRLS no-op (Pitfall 1). The pool DSN role is `postgres`/BYPASSRLS.
- `is_local=true` (3rd `set_config` arg) — auto-reverts at COMMIT; `false` leaks claims to the next pool borrower (Pitfall 3).
- Parameterize claims via `$1` — never string-interpolate (SQLi, Security Domain V5).

---

### `backend/app/dependencies.py` → `get_user_supabase(request)` (dependency seam, request-response)

**Analog (partial):** `dependencies.py:21-25` (`get_supabase` singleton) — invert from a cached singleton to a per-request factory. **Do NOT mutate the singleton** (`postgrest.auth()` races under concurrency — Pitfall 2). RESEARCH Pattern 2 supplies the non-mutating shape.

**Current singleton** (`dependencies.py:21-25`):
```python
_supabase: Client | None = None
def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)  # ← service_role = BYPASSRLS
    return _supabase
```

**Target shape** (RESEARCH Pattern 2 — ANON key + Bearer header, shared httpx transport):
```python
from supabase import create_client, ClientOptions
def get_user_supabase(request, current_user, token: str):
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,                          # ANON key — NOT service_role
        options=ClientOptions(
            headers={"Authorization": f"Bearer {token}"},    # PostgREST → role=authenticated
            httpx_client=_shared_httpx,                       # reuse transport (avoid connection fanout)
        ),
    )
```
- `settings.supabase_anon_key` exists (default `""`, populated for `/public-config`) — **verify set in `backend/.env` before the swap** (RESEARCH Environment Availability).
- All supabase-py calls still block → keep `run_in_threadpool` (D-v2.5-01) — the app already wraps these; do not remove.

---

### `backend/app/dependencies.py` → `get_service_role_supabase(org_id)` (hardened factory, request-response)

**Analog:** `dependencies.py:21-25` (`get_supabase`) for the client construction + the **refuse-without-scope posture** of `require_operator` (`dependencies.py:247-264`) and `require_visible` (`:306-332`) — these gate/raise rather than silently returning a broad client.

**Hardening contract (D-05):** refuses to construct without an explicit non-null `org_id` (raise, don't default). Retained ONLY for the 4 async writers + legitimate cross-tenant ops. Their `.eq("user_id")` filters widen to add an `org_id` predicate. Mirror the SEC-01 "refuse without explicit scope" posture noted in CONTEXT `<code_context>`.

---

### `backend/app/services/run_producer.py` (NEW service, streaming / event-driven) — the byte-identical crux

**Analog:** `backend/app/services/run_lifecycle.py` — the established "extract a cohesive unit out of `threads.py` into a service module" pattern (Phase 145). It shows: module docstring stating the invariant + "dead code until wired" additive discipline, late-imports to dodge the `threads.py` ↔ service cycle (`run_lifecycle.py:202,232,278`), and thin best-effort framing.

**Also:** `agent_loop.py::run_agent_loop` (Phase 089) — the Deep byte-identical red line ALREADY lives here, called as a single line in `send_message` at `threads.py:1697`. Wave-0 does **not** threaten it.

**Extraction sources in `threads.py`:**
- `agent_runner` producer shell + `_shielded_finalize` — **lines 1410–2003** (`agent_runner` def at `:1410`, `_shielded_finalize` at `:1770`, `await asyncio.shield(_shielded_finalize())` at `:1988`).
- `spawn_continuation_run` — **lines 2279–2444** (`_finalize()` at `:2433`). The comment at `threads.py:2274` states it "Mirrors agent_runner's `_shielded_finalize` ordering (persist → finalize_run → …)" — **this near-duplication is exactly what the unification into `run_producer.py` reconciles** (else the two finalize orderings keep drifting).

**Finalize-ordering invariants that MUST survive byte-identical** (`threads.py:1770-1994`, extracted from `_shielded_finalize`; each step already reuses `run_lifecycle.finalize_run_terminal`):
1. **Shielded persist** — `_persist()` under `asyncio.shield`, exceptions logged not raised (`:1792-1798`).
2. **Persist system_warnings** — best-effort (`:1800-1809`).
3. **RUN-01b todo reconcile** — gated on `_terminal_status == "completed" AND cap_disposition != "cap_paused"` (the LOCK-2/S6 two-clause gate — `:1826`). **Load-bearing: gating on status alone mis-marks a cap-paused run.**
4. **`finalize_run_terminal`** (status UPDATE + both ZREMs, ONE atomic co-write) — `:1882-1893`. Status lands FIRST.
5. **Terminal sentinel XADD** — AFTER finalize_run (075.4-03 race fix), BEFORE EXPIRE (Pitfall 2) — `:1897-1910`. `catch BaseException` (incl. `CancelledError`).
6. **EXPIRE** — 600s completed / 60s else — `:1912-1917`.
7. **Harness F2 terminalize** — gated on `_active_workflow_run_id is not None AND != "completed" AND not is_app_shutting_down()` (096-09 resume-safety) — `:1947-1985`.
8. Whole block under `asyncio.shield`; `RUN_TASKS.pop(run_id, None)` in `finally` (`:1993`).

**Extraction discipline (copy from `run_lifecycle.py`):** additive/dead-until-wired; late-import `RUN_TASKS` / `_emit_terminal` to avoid the import cycle; thin best-effort; **D-01 hard gate — prove Deep byte-identical + full suite green BEFORE any `org_id` touches this path.**

---

### `backend/app/services/thread_title.py` / `workflow_kickoff.py` / `run_model_resolution.py` (NEW services)

**Analog:** `run_lifecycle.py` extraction precedent (docstring + additive discipline + late imports). Each has a clean, already-cohesive source region in `threads.py`:

| New module | Source in `threads.py` | Notes |
|---|---|---|
| `thread_title.py` | `:754-896` (`_strip_think_blocks` `:754`, `_derive_title_from_message` `:774`, `_clean_llm_title` `:786`, `generate_thread_title` `:803`) | **Lowest-risk** — self-contained, no producer coupling. Extract first. |
| `run_model_resolution.py` | `:196-341` (`_resolve_enabled_model` `:196`, `_reresolve_fallback_provider` `:244`, `_apply_fallback_to_request` `:278`) | Model/provider seam; pure transform. |
| `workflow_kickoff.py` | `:956-1016` (`_ensure_skill_snapshots` `:956`) + the kickoff preflight block inside `send_message` `:1036-1017` | Harness ctx/scope; already delegates to `skill_snapshot.py`. |

---

### `supabase/migrations/107_*.sql` — RLS predicate rewrite (~6 per-cluster bundles) (migration, batch)

**Analog:** the **8 org-table policies already live** in `full-schema.sql:4976-5235`. This is the proven template — copy it, do not invent.

**Template (SELECT)** — `departments_select`, `full-schema.sql:4990`:
```sql
CREATE POLICY departments_select ON public.departments FOR SELECT TO authenticated
  USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));
```
**Template (write-gated)** — `departments_insert`, `full-schema.sql:4983` (uses the permission helper):
```sql
CREATE POLICY departments_insert ON public.departments FOR INSERT TO authenticated
  WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text)
               AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));
```

**The helpers the predicates call** (already live, SECDEF/STABLE/pinned — no new helper needed):
- `current_user_org_ids()` — `full-schema.sql:212-217`: `RETURNS SETOF uuid ... SELECT org_id FROM public.org_members WHERE user_id = auth.uid()`. **Returns SETOF → use `org_id IN (SELECT …)`, NOT `= ANY(array)`** (RESEARCH Anti-Pattern).
- `current_user_has_permission(p_org_id, p_permission_key)` — `full-schema.sql:193-205`.
- `folder_is_globally_visible(p_folder_id)` — `full-schema.sql:224-240` (recursive ancestor walk; preserve on documents/folders).

**Rewrite targets — the two live shapes:**

*Shape A — plain `auth.uid() = user_id` (add membership prefix):*
```sql
-- LIVE: full-schema.sql:4922
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING ((auth.uid() = user_id));
-- also: threads :4936, document_chunks :4915, skill_embeddings :4866, user_memory :4619, message_feedback :4612,
--       eval_* :4782/4796/4810, code_executions :4824, harness_audit :4831, sandbox_files :4859, skill_* :4880/4894/4901
```
→ becomes `org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid())`.

*Shape B — `auth.uid() = user_id OR <global-branch>` (PRESERVE the OR-branch):*
```sql
-- LIVE: full-schema.sql:4761 / 4740 / 4733 / 4754 / 4768
CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT
  USING (((auth.uid() = user_id) OR (is_global = true)));                          -- is_global LIVE name (165 renames)
-- folders :4747 + documents :4838 use folder_is_globally_visible(...) instead of is_global
```
→ becomes `org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid() OR is_global OR is_system OR <dept>)`.

**Re-paste-safe idiom** (no `CREATE OR REPLACE POLICY` in Postgres — RESEARCH Anti-Pattern): `DROP POLICY IF EXISTS "<exact quoted name>" ON public.<t>;` then `CREATE POLICY`. **Enumerate the exact quoted names at plan time** (Shape A/B above have the human-quoted names; the 8 org tables + `todos`/`workflow_*`/`workspace_*` at `:5394-5599` already use terse `TO authenticated` names — leave those, they're 161-correct).

**Atomic flip order (D-06):** author ALL bundles FIRST — inert under BYPASSRLS — THEN flip the client swap LAST, gated on the D-08 leak test. Apply via SQL editor → `bash scripts/regenerate-full-schema.sh` (no `--reset`) → commit migration + `full-schema.sql` same-commit.

**NULL `org_id` handling (D-10):** operator/system rows stay nullable (mig 104 excluded `operator_users`/`profiles`/`app_settings`); their policies handle `org_id IS NULL` explicitly (reached via operator path, not membership).

---

### `supabase/migrations/108_*.sql` — TEN-04 `org_id` on `document_chunks` + `skill_embeddings` (migration, data-migration)

**Live tables (NO `org_id` today):**
- `document_chunks` — `full-schema.sql:759-770`: has `user_id uuid NOT NULL`, `document_id uuid NOT NULL`, HNSW on `embedding` (`:2572`), GIN on `search_vector` (`:2579`). No `org_id`, no `user_id`/`org_id` btree.
- `skill_embeddings` — `full-schema.sql:1458-1466`: PK `skill_id`, `user_id uuid NOT NULL`, btree `idx_skill_embeddings_user_id` (`:3013`). No `org_id`, no ANN index (~empty).
- **Explicitly deferred to 163** — `104_org_dept_role_schema.sql:442-443`: *"2 Phase-163-deferred (document_chunks, skill_embeddings) — EXCLUDED (their org_id denormalize + composite index is TEN-04, the perf-gated crux)"*.

**Analog 1 — column + index idiom** (`104_...:448-450`):
```sql
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log USING btree (org_id);
COMMENT ON COLUMN public.audit_log.org_id IS 'Forward-compat ...';
```
→ For TEN-04: add `org_id uuid` + btree `(org_id)` (or composite `(org_id, user_id)` — **benchmark-driven**, D-07). **Leave the HNSW index untouched.** No per-tenant partial vector index.

**Analog 2 — parent-FK batched backfill** (`105_personal_org_backfill.sql:330-351`, the Wave-2/3 child-resolves-from-parent shape — EXACTLY what chunks need):
```sql
CALL public._mig105_backfill($SQL$
  UPDATE public.workflow_runs c SET org_id = p.org_id FROM public.threads p
  WHERE p.id = c.thread_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.id IN (SELECT id FROM public.workflow_runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
```
→ `document_chunks.org_id ← documents.org_id` (via `document_id` FK); `skill_embeddings.org_id ← skills.org_id` (via `skill_id` FK). The `_mig105_backfill(p_sql, p_batch DEFAULT 10000)` procedure (`105_...:127-141`) with per-batch `COMMIT` is reusable (or re-declare `_mig163_backfill`). **`document_chunks` is the large table → batch it** (~10k windows).

**Analog 3 — self-guarded NOT-NULL flip** (`105_...:398-403`) — the DB, not a human, enforces zero-NULL:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.document_chunks WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'MIG163 document_chunks: % rows still NULL, NOT-NULL flip aborted',
      (SELECT count(*) FROM public.document_chunks WHERE org_id IS NULL);
  END IF; END $$;
ALTER TABLE public.document_chunks ALTER COLUMN org_id SET NOT NULL;
```

**Analog 4 — add both tables to the mig-106 autofill net** (`autofill_org_id_from_parent`, `full-schema.sql:91-120`): attach a `BEFORE INSERT` trigger resolving from the parent FK, e.g. `... EXECUTE FUNCTION public.autofill_org_id_from_parent('document_id', 'documents', 'id')`. Pattern: `full-schema.sql:3559` (`todos` via `threads`). The forward-compat `IF NEW.org_id IS NOT NULL THEN RETURN NEW` guard (`:102-104`) means the app need not thread `org_id` on chunk INSERTs.

**Perf gate (D-07 — highest-risk item):** benchmark against `test_058_concurrency.py:270` (`assert elapsed < 1.0`), **GREEN before merge**. Note the RESEARCH de-risking (Pitfall 5): the retrieval RPCs `match_document_chunks`/`keyword_search_chunks` are `SECURITY DEFINER` (`full-schema.sql:310`/`:283`) → BYPASS RLS → this RLS is *inert on the hot retrieval path*. The real risk is the **SET-LOCAL round-trip overhead** on the asyncpg path, not a pgvector recall cliff. 163 lays the column as **164 substrate**; do NOT claim "retrieval is org-isolated" in 163.

---

### Wave-0 test files (`test_163_*.py`) — the live two-user leak proof (test, request-response)

**Analog 1 — the two-user LIVE leak harness:** `backend/tests/integration/test_119_leak.py` (and its stated parent `test_117_route_leak.py`). Provides the reusable scaffold:
- `_POSTGRES_TEST_DSN` env override + `_pg_reachable()` skip-guard + `PG_AVAILABLE`/`pytestmark = pytest.mark.skipif(...)` (`test_119_leak.py:43-75`) — copy verbatim.
- Two-user seed with **non-vacuity** (each user seeded ≥1 true positive so "all clear" can't false-green — `:11-19`), FK-safe seed/teardown, cross-user assertion (A never sees B, and vice-versa).
- **KEY DIFFERENCE for 163:** today's leak tests use the service-role client + app-code `.eq("user_id")` (RLS bypassed — `test_119_leak.py:3-5`). 163's leak tests must instead prove **RLS itself** via the SET-LOCAL-as-user execution below.

**Analog 2 — SET-LOCAL-as-user execution (asyncpg path):** `test_110_dm_schema.py:302-314` (`_select_count_as_user`, above). `test_163_leak_asyncpg.py` = Analog-1 seed/teardown + Analog-2 execution as user B against user A's rows → expect 0.

**Analog 3 — supabase-py path leak:** `tests/integration/_reembed_adapter.py::SupabaseTxnAdapter` (referenced by `test_111_1_reembed_rls.py:25-30`) — routes supabase-py surface through an asyncpg transaction so the real RLS WHERE clause hits real two-user rows (not a MagicMock). `test_163_leak_supabase.py` reuses this bridge with the ANON-key + Bearer client.

**Analog 4 — role-swap-noop detector** (`test_163_role_swap.py`): run one SELECT WITHOUT `SET LOCAL ROLE` (stays `postgres` → returns ALL rows, proves BYPASSRLS) vs WITH it (own rows only). The diff proves the swap is load-bearing (RESEARCH Pitfall 1 detector).

**Fail-loud preflight (RESEARCH D-08 design, step 2):** after role+claims, assert `SELECT auth.uid()` == expected UUID BEFORE isolation asserts (a NULL uid false-passes at "0 rows"). Parameterize over (legacy-only / JSON-only / both) GUC variants to arbitrate D-02.

**Analog 5 — TEN-04 backfill asserts** (`test_163_ten04_backfill.py`): `test_110_dm_schema.py::_table_exists` (`:294-299`) style + SQL count asserts (zero-NULL, NOT-NULL present, index present).

**conftest fixtures:** extend `backend/tests/integration/conftest.py` (currently just the autouse pool-reset, `:22`). Seed two users in two orgs — reuse the mig-105 personal orgs OR insert Org X/Y + one `org_members` row each (mig-106 autofill fills row `org_id` automatically). Add a `pg_get_functiondef('auth.uid()'::regprocedure)` probe fixture (records the live variant).

**Perf gate:** `test_058_concurrency.py` already exists — REUSE, do not rewrite. Its `:270` `assert elapsed < 1.0` is the CONCUR-01 bar; re-run on the rewrite branch.

---

### The 4 async service-role writers to widen (`.eq("user_id")` → org-aware)

All four **keep** service-role (no `auth.uid()` on these paths) and add an `org_id` predicate via `get_service_role_supabase(org_id)`. The 262 `.eq("user_id")` filters stay everywhere as belt-and-suspenders (D-14).

| Writer | Current scoping (widen these) | Notes |
|---|---|---|
| **agent loop** via `db/runs.py` | `insert_run` `db/runs.py:52-66` — `INSERT INTO runs (run_id, thread_id, user_id, status, model, provider, ...)` **omits `org_id`** (mig-106 `runs_autofill_org_id` trigger fills it). Reads/finalize by `run_id`. | Uses `get_pg_pool` (raw asyncpg). `run_lifecycle.finalize_run_terminal` is the shared terminal writer. Widen any status/ownership READS to org-aware. |
| **eval runner** | `eval_runner_service.py:261,697` — `.eq("user_id", user_id)` | Injected `supabase` (service-role). |
| **harness engine** | `harness_engine.py:1481` — `_service_supabase = get_supabase()`; used at `:1539/1551/1557/1658`; raw `pool.fetch/execute` at `:199/225` | The `# create_client(SUPABASE_URL, SERVICE_ROLE_KEY)` comment at `:1474` documents intent. |
| **re-embed** | `reembed_service.py:123,154,201,211` — `.eq("user_id", user_id)` on **read AND write** (`:17` "RLS-SCOPED: every read AND write") | Also `skill_embedding_service.skill_reembed_job`. Cleanest existing model of scope-every-query. |

---

## Shared Patterns

### The load-bearing role swap + both GUC forms (asyncpg path)
**Source:** `test_110_dm_schema.py:302-314` (prototype) + RESEARCH Pattern 1.
**Apply to:** `get_user_pg_connection`, all `test_163_leak_*` / `test_163_role_swap`, and every request-scoped raw-SQL path (the 100 connectionless `pool.*()` calls across 21 files → explicit `acquire()`+`transaction()`).
```python
await conn.execute("SET LOCAL ROLE authenticated")                                        # turns RLS ON
await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid))      # legacy (local)
await conn.execute("SELECT set_config('request.jwt.claims', $1, true)",
                   json.dumps({"sub": uid, "role": "authenticated"}))                      # JSON (cloud)
```

### The org-table RLS template (predicate rewrite)
**Source:** `full-schema.sql:4990` (`departments_select`) + helpers `:193-217`.
**Apply to:** all ~38 user-facing table policies in the 6 bundles.
```sql
... FOR SELECT TO authenticated USING (org_id IN ( SELECT public.current_user_org_ids() ) AND (<owner OR global OR system>))
```

### Re-paste-safe migration idiom
**Source:** mig 104/105/106 (`DROP … IF EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, self-guarded flips).
**Apply to:** every 163 migration. No `CREATE OR REPLACE POLICY`. Apply via SQL editor → `scripts/regenerate-full-schema.sh` (no `--reset`) → commit migration + `full-schema.sql` same-commit (CLAUDE.md).

### Extract-cohesive-unit-from-`threads.py` service module
**Source:** `run_lifecycle.py` (Phase 145) — docstring stating invariant + "dead code until wired" additive discipline + late-imports to break the `threads.py` ↔ service cycle (`:202,232,278`).
**Apply to:** all 4 Wave-0 modules.

### Two-user LIVE leak proof
**Source:** `test_119_leak.py` (skip-guard + non-vacuity + two-user seed) fused with `test_110_dm_schema.py:302-314` (SET-LOCAL-as-user) and `_reembed_adapter.py::SupabaseTxnAdapter` (supabase-py-over-asyncpg).
**Apply to:** all `test_163_leak_*` + `test_163_rls_<cluster>` + `test_163_role_swap`.

### `run_in_threadpool` for blocking supabase-py
**Source:** D-v2.5-01 (existing discipline throughout the API layer).
**Apply to:** every `get_user_supabase` call site — the user-JWT client still blocks; preserve the wrapper.

---

## No Analog Found

| Surface | Role | Data Flow | Reason / Substitute |
|---------|------|-----------|---------------------|
| `get_user_supabase` per-request **non-mutating** client (ANON key + Bearer, shared httpx) | dependency seam | request-response | The only supabase-py construction in-repo is the service-role singleton (`dependencies.py:24`). The per-request/no-singleton-mutation shape has no live analog → use **RESEARCH Pattern 2** (verified against installed supabase-py 2.27.2 `postgrest.auth` signature). |
| Local JWKS/ES256 verify via PyJWT `PyJWKClient` (D-04, OPTIONAL) | auth utility | request-response | No live analog — today `get_current_user:136` does a GoTrue round-trip. Use **RESEARCH §Standard Stack + Pitfall 4**. Local dev likely HS256 → keep the GoTrue fallback; **do not let D-04 block the swap** (claims come from `current_user["id"]`). |

---

## Metadata

**Analog search scope:** `backend/app/dependencies.py`, `backend/app/api/threads.py`, `backend/app/services/{run_lifecycle,agent_loop,harness_engine,eval_runner_service,reembed_service}.py`, `backend/app/db/runs.py`, `supabase/full-schema.sql`, `supabase/migrations/{104,105,106}_*.sql`, `backend/tests/integration/{test_110_dm_schema,test_111_1_reembed_rls,test_058_concurrency,test_119_leak}.py`, `backend/tests/integration/conftest.py`.
**Files scanned:** ~18 (main tree; `.claude/worktrees/` copies deliberately ignored — worktrees are gitignored-deps-incompatible per project memory).
**Migration slot verified:** 104/105/106 consumed → next free = **107** (RLS bundles) + **108** (TEN-04) — confirm at plan time.
**Pattern extraction date:** 2026-07-19
