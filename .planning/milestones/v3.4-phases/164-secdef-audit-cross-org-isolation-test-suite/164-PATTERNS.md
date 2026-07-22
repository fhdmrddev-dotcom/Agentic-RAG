# Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 12 (2 new SQL/test, 1 new unit test, 9 modified backend)
**Analogs found:** 12 / 12 (every file has a live in-repo analog — this phase is composition, not new plumbing)

> **THE load-bearing pattern (read this first):** Phase 164 is a *two-halves-that-must-land-together* security phase. The SQL half (migration 110) org-scopes four `SECURITY DEFINER` bodies; the Python half moves the **producer's** retrieval + text-to-SQL DB calls off the service-role `ctx.supabase` (where `auth.uid()` is NULL → the org predicate returns 0 rows for *everyone*) onto the **Phase-163 asyncpg user-context** (`get_user_pg_connection` / `open_user_conn` — uid-synthesized `request.jwt.claims`, no token, no mid-run expiry). Neither half works alone. The single analog every retrieval/tool edit copies is **`app/dependencies.py:125-175`** (`_apply_rls_user_context` + `get_user_pg_connection`). See **Shared Pattern A** — it is referenced by 4 of the modified files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/110_secdef_org_scope_audit.sql` | migration | transform (DEFINER re-CREATE + RLS) | `108_rls_membership_rewrite.sql` (documents SELECT policy shape) + `109_platform_universal_rls_fix.sql` (is_system-outside-gate) + the 4 live DEFINER bodies (073/025/091/019) | exact (mirrors shipped policy shape) |
| `backend/tests/integration/test_v3_4_org_isolation.py` | test | request-response (2-org adversarial matrix) | `test_163_leak_asyncpg.py` + `test_163_leak_supabase.py` + `test_163_rls_platform_universal.py` + `_rls_harness.py` | exact |
| `backend/tests/test_seed091_owner_nulling.py` | test | transform (serialize unit) | `test_115_tool_global_leak.py` (two-user global-leak shape) + the serialize snippet at `skills.py:215-218` | role-match (unit vs live) |
| `backend/app/services/retrieval_service.py` | service | streaming/request-response (retrieval RPC) | `app/dependencies.py:125-175` (asyncpg user-context) + own `supabase.rpc` sites `:65,:87` | exact |
| `backend/app/services/sql_service.py` | service | transform (text-to-SQL) | `app/dependencies.py:156-175` + the INVOKER `query_user_documents` RPC caller `:113` | role-match |
| `backend/app/api/kb.py` | route | request-response (grep tool) | `sql_service.query_documents` (sibling delete) + `dependencies.get_user_pg_connection` | role-match |
| `backend/app/services/agent_loop.py` | service | event-driven (match_skills in agent loop) | `retrieval_service` asyncpg swap + own `supabase.rpc("match_skills")` site `:1307` | role-match |
| `backend/app/services/tool_dispatcher.py` | service | dispatch (ctx wiring) | `ToolContext` build `agent_loop.py:2484` (already carries `pool=await get_pg_pool()`) | exact |
| `backend/app/services/document_view_service.py` | service | CRUD/serialize (list_views) | `skills.py:215-218` list-serialize null pattern | exact |
| `backend/app/utils/folder_utils.py` (+ `api/folders.py`, `api/kb.py:_serialize_tree`) | utility | serialize (folder list/tree) | `skills.py:215-218` + `fetch_visible_folders:37-45` | exact |
| `backend/app/api/skills.py` | route | serialize (list_skills) | the null snippet itself lives here `:215-218` (self-analog) | exact |
| `backend/app/models/{folder,skill}.py` | model | — | `document_view.py:87` (`user_id: str \| None` already loosened) | exact |

---

## Pattern Assignments

### `supabase/migrations/110_secdef_org_scope_audit.sql` (migration, transform)

**Analogs:** `108_rls_membership_rewrite.sql` (policy shape), `109_platform_universal_rls_fix.sql` (is_system-outside-gate), the four live DEFINER bodies below.

**Header/apply-discipline pattern to copy** — clone the `108`/`109` header block verbatim in intent: `BEGIN;…COMMIT;` atomic, `CREATE OR REPLACE` (no DROP — signatures unchanged, see Pitfall 6), the CLAUDE.md apply-discipline note (SQL editor / psycopg2, NEVER `db push`/`db reset`, then `bash scripts/regenerate-full-schema.sh` no-reset, commit both same-commit), and the cloud-parity note (110 joins pending set 099→110). Source: `108_rls_membership_rewrite.sql:79-91`, `109_platform_universal_rls_fix.sql:46-57`.

**The four CURRENT DEFINER bodies to re-CREATE (exact live text):**

`match_document_chunks` — `073_embedding_provider_and_chunk_tags.sql:34-60` (DEFINER, **no `search_path`**, user-only scope):
```sql
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[], p_embedding_model text DEFAULT NULL
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER          -- ← ADD: SET search_path = '' (Pattern 3)
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity     -- ← qualify OPERATOR(public.<=>)
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id          -- ← REPLACE with the org-gate + within-org visibility branch
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
```

`keyword_search_chunks` — `025_document_versioning.sql:50-76` (DEFINER, **no `search_path`**, returns `(id, document_id, content, chunk_index, rank)` — **preserve this signature byte-for-byte**, Pitfall 6). Same `WHERE dc.user_id = match_user_id` → org-gate replacement; the `@@` / `plainto_tsquery` / `ts_rank_cd` operators resolve fine under `search_path=''` (pg_catalog).

`match_skills` — `091_skill_embeddings.sql:87-108` (DEFINER, `SET search_path = public, pg_temp` — **drop `pg_temp`**):
```sql
) RETURNS TABLE(id uuid, name text, description text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp       -- ← REPLACE with '' (or pg_catalog, public); drop pg_temp
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description, ...
  FROM public.skills s
  LEFT JOIN public.skill_embeddings se ON se.skill_id = s.id AND (...)
  WHERE (s.user_id = match_user_id OR s.is_global = true)   -- ← REPLACE per §is_system rule below
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;
END; $$;
```

`folder_is_globally_visible` — `019_global_folder_subtree_visibility.sql:12-31` (DEFINER, `SET search_path = public`, `LANGUAGE sql STABLE`). This one gets **NO org predicate** (pure ancestor-walk; the org gate lives in the *calling* body). Audit = pin `search_path` + schema-qualify (already qualifies `public.folders`) + record justification.

**Org-gate transform to APPLY (mirror the `documents` SELECT policy at `108:114-117` and the FIX-A `is_system` hoist at `109:70-73`):**

- `match_document_chunks` / `keyword_search_chunks` — replace `WHERE dc.user_id = match_user_id` with:
```sql
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())            -- D-164-01 org gate (indexed, mig 107)
    AND ( dc.user_id = auth.uid()                                         -- owner (session-derived, NOT match_user_id)
          OR (d.folder_id IS NOT NULL AND public.folder_is_globally_visible(d.folder_id)) )  -- PRAG-01 folder branch
```
  (Note: the base policy uses `org_id IN (SELECT …)`; in the DEFINER body the CONTEXT/RESEARCH examples use `= ANY(SELECT …)` — both are equivalent; match the RESEARCH Pattern-1 form.)

- `match_skills` — mirror `109:70-73` so `is_system` stays **OUTSIDE** the org gate (Pitfall 5 / mig-109 FIX-A — else the built-in skill-creator vanishes cross-org, the Test-7 regression):
```sql
  WHERE ( (s.is_system = true)
          OR (s.org_id = ANY(SELECT public.current_user_org_ids())
              AND (s.user_id = auth.uid() OR s.is_global = true)) )
    AND s.is_enabled = true
```

**`document_chunks` RLS widening (PRAG-01, D-164-07)** — the current owner-only SELECT is `108:168-170`:
```sql
DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));
```
Widen to mirror the `documents` folder-visibility branch (`108:114-117`) via an `EXISTS` on the parent doc (point-lookup on the `documents.id` PK — direct-read path only, retrieval is DEFINER so it never evaluates this policy):
```sql
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id)
              OR EXISTS (SELECT 1 FROM public.documents d
                          WHERE d.id = document_chunks.document_id
                            AND d.folder_id IS NOT NULL
                            AND public.folder_is_globally_visible(d.folder_id))));
```

**`current_user_org_ids()` (the composed primitive)** — live defn `SELECT org_id FROM public.org_members WHERE user_id = auth.uid()`, `SECURITY DEFINER STABLE SET search_path TO 'public'`. No new helper needed (used by all 97 mig-108 policies).

---

### `backend/app/services/retrieval_service.py` (service, retrieval RPC)

**Analog:** `app/dependencies.py:156-175` (`get_user_pg_connection`) — see **Shared Pattern A**.

**Current call sites to swap** — `_vector_search:65` and `_keyword_search:87` both do `await aexec(supabase.rpc("match_document_chunks"/"keyword_search_chunks", params))` on a **passed-in `supabase` client** (service-role in the producer). Replace the `supabase.rpc` call with an asyncpg call over the user-context, formatting the embedding as a pgvector literal (Pitfall 3 — asyncpg has no vector codec):
```python
# Source pattern: dependencies.py:156-175 + RESEARCH Pattern 2. The pool init at
# conftest/dependencies.py:74 registers ONLY a jsonb codec — cast the vector literal.
vec_literal = "[" + ",".join(repr(float(x)) for x in query_embedding) + "]"
async with get_user_pg_connection(None, {"id": user_id}) as conn:   # uid-synthesized claims, no token
    rows = await conn.fetch(
        """SELECT id, document_id, content, chunk_index, similarity
           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)""",
        vec_literal, user_id, top_n, match_threshold, metadata_filter_json, folder_ids, current_model,
    )
    return [dict(r) for r in rows]
```
**Seam choice (D-164-02 discretion):** one shared `_call_as_user(uid, fn_sql, *args)` helper in this module, reused by both RPCs (and optionally the `match_skills` swap). The `run_in_threadpool(embed_texts, …)` at `:42-44` stays (embedding is a blocking HTTP call, orthogonal to the DB path). The direct `.table("document_chunks")` fallback read at `fetch_full_document:240-246` is RLS-gated by the Pattern-4 policy widening — no code change if that call runs on a user-context client, but it currently takes the passed-in `supabase`; confirm at plan-time.

---

### `backend/app/services/sql_service.py` (service, text-to-SQL) + `backend/app/api/kb.py` (route, grep)

**Analog:** `dependencies.py:156-175` + the INVOKER `query_user_documents` RPC (runs the arbitrary SELECT as the caller's role).

**DELETE `_inject_user_id`** (`sql_service.py:31-68`) and its call at `:106`. **KEEP `_inject_folder_scope`** (`:71-87`) — it is feature-narrowing (folder subtree relevance), not a cross-user gate (RESEARCH Open Q1 / A4). `query_documents:90-128` currently does:
```python
global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)   # ← DELETE (only feeds _inject_user_id)
scoped = _inject_user_id(clean, user_id, global_folder_ids)                     # ← DELETE
if folder_ids:
    scoped = _inject_folder_scope(scoped, folder_ids)                          # ← KEEP
result = await aexec(supabase.rpc("query_user_documents", {"sql_query": scoped}))  # ← route on user-context
```
The `query_user_documents` RPC is INVOKER → once the call runs on the asyncpg user-context, RLS auto-scopes the arbitrary query (Pitfall 4 — deleting the regex is **only** safe under this condition). Keep the SELECT-only + `no ";"` guards at `:99-102`.

**DELETE `_inject_user_id_for_grep`** (`kb.py:233-238`) and its call at `:263`. `grep_path:241-269` builds the SQL then wraps `_inject_user_id_for_grep(sql, user_id)`; remove the wrap and route the `query_user_documents` RPC through the user-context (same seam as `query_documents`). The producer's `ctx.supabase` is service-role — Pitfall 4 is exactly this path.

---

### `backend/app/services/agent_loop.py` (service, match_skills in agent loop) + `tool_dispatcher.py` (ctx wiring)

**Analog:** the `retrieval_service` asyncpg swap above + the `ToolContext` build that **already carries the pool**.

`agent_loop.py:1306-1318` calls `supabase.rpc("match_skills", {...})` where `supabase = ctx.supabase` (`:1166`, service-role in producer). Swap to the same asyncpg user-context seam (the `match_skills` return signature is `(id, name, description, similarity)`). The `ToolContext` build at `agent_loop.py:2484-2490` already resolves `pool=await get_pg_pool()` and `current_user=current_user` — so the user-context is one `get_user_pg_connection(None, {"id": current_user["id"]})` away; no new field needed on `ToolContext`. `tool_dispatcher.py` passes `ctx.supabase` into `search_documents` (`:682`), `query_documents` (`:756`), `grep_path` (`:235`) — those handlers/services are where the user-context swap lands; the dispatcher itself may only need to stop passing service-role where the service now self-acquires the user-context.

---

### `backend/app/services/document_view_service.py` (service, list_views serialize — SEED-091)

**Analog:** `skills.py:215-218` (the canonical null-on-non-owner loop) — see **Shared Pattern C**.

`list_views:92-110` dedups but does **not** null the owner. Add the SEED-091 null inside the loop, **also nulling `folder_scope`** (views-only, D-164-05):
```python
for row in result.data or []:
    if row["id"] not in seen:
        seen.add(row["id"])
        if row.get("is_global") and str(row.get("user_id")) != str(user_id):
            row["user_id"] = None
            row["folder_scope"] = None          # views only (+ scope UUID)
        out.append(row)
```
`ViewResponse.user_id` (`document_view.py:87`) is **already `str | None`** and `folder_scope: UUID | None` — no model change here (it's the reference the two other models copy).

---

### `backend/app/utils/folder_utils.py` + `api/folders.py` + `api/kb.py:_serialize_tree` (folder serialize — SEED-091)

**Analog:** `skills.py:215-218` + `fetch_visible_folders:37-45`.

The folder list serialize path is `api/folders.py:list_folders:11-19` → `fetch_visible_folders(supabase, user_id)` (`folder_utils.py:37-45`) returned **raw** as `list[FolderResponse]`. Apply the null after fetch (folders have `is_global` + `user_id` fields), covering both `list_folders` and `list_children` (`folders.py:22-32`), and the tree serialize at `kb.py:_serialize_tree:196-215`. Pattern (mirror Shared Pattern C):
```python
for f in folders:
    if f.get("is_global") and str(f.get("user_id")) != str(user_id):
        f["user_id"] = None
```
Cleanest seam: a small helper in `folder_utils.py` (`_null_foreign_global_owner(rows, caller)`) reused by all three call sites so the serialization contract can't diverge (D-164-05 "uniform across surfaces").

---

### `backend/app/api/skills.py` (route, list_skills serialize — SEED-091)

**Self-analog:** the exact null snippet is authored here. `list_skills:196-219` dedups but does not null. Add:
```python
for row in result.data:
    if row["id"] not in seen:
        seen.add(row["id"])
        # SEED-091 / D-164-05: hide the seeding owner's identity from non-owner readers.
        if (row.get("is_global") or row.get("is_system")) and str(row.get("user_id")) != str(current_user["id"]):
            row["user_id"] = None
        skills.append(row)
```
Note the `is_system` OR-branch (the platform skill-creator is the practically-cross-org-visible surface today — CONTEXT scope note). Confirm at plan-time whether the skill-**files** list serializer surfaces a foreign `user_id` (A3 — `SkillFileResponse.user_id` at `skill.py:44`).

---

### `backend/app/models/folder.py` + `models/skill.py` (models)

**Analog:** `document_view.py:87` — `user_id: str | None = None` (already loosened; the target shape).

- `folder.py:23` — `user_id: UUID` → `user_id: UUID | None`.
- `skill.py:22` — `user_id: UUID` → `user_id: UUID | None`. `skill.py:44` (`SkillFileResponse.user_id`) — loosen only if the skill-files serializer exposes a foreign owner (A3).
- **UI-contract check (A5, flag for plan):** verify the frontend TS type tolerates `user_id: null` on global folders/skills (owner-gated affordances already branch on ownership, so a null non-owned owner is inert). A hard-required `user_id` in a TS interface would throw.

---

### `backend/tests/integration/test_v3_4_org_isolation.py` (test, exit-gate matrix)

**Analogs:** `test_163_leak_asyncpg.py`, `test_163_leak_supabase.py`, `test_163_rls_platform_universal.py`, `_rls_harness.py` — see **Shared Pattern B**.

**Reuse verbatim (import, do not re-derive):**
- Fixtures `two_orgs_two_users` + `pg_pool` + `auth_uid_variant` from `conftest.py:74-207` (two disjoint orgs, one owned row per table, FK-safe teardown).
- Harness helpers from `_rls_harness.py`: `open_user_conn` (`:78-89`), `as_user_supabase_txn` (`:108-120`), `assert_auth_uid` (`:125-141` — the **fail-loud preflight, MUST be the first assertion** on every conn), `requires_pg`, `_apply_rls_user_context` (imported by the harness from `dependencies.py`).
- The `_table_exists` information_schema probe (`test_163_leak_asyncpg.py:82-87`) to drive the **every-user-facing-table** matrix (~38 tables).

**Matrix structure to clone** — the `_assert_isolated` shape (`test_163_leak_asyncpg.py:90-119`): (2) fail-loud preflight → (3) positive control (viewer sees its OWN row == 1) → (4) isolation (0 of the OTHER user's row). Extend to: all user-facing tables × both paths (asyncpg `open_user_conn` + supabase-py `as_user_supabase_txn`, mirroring the two leak files) × all four DEFINER functions × `X-Org-Id` header-spoof rejection × PRAG-01 live retrieval isolation.

**The red-then-green anchor (D-164-06)** — the killer assertion, over the asyncpg path (RESEARCH Code Example):
```python
@requires_pg
async def test_definer_ignores_spoofed_match_user_id(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:      # auth.uid() = B
        await assert_auth_uid(conn, b["uid"])                  # fail-loud FIRST
        rows = await conn.fetch(
            "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 50, 0.0)",
            _zero_vec_literal(), a["uid"],                     # spoofed match_user_id = A
        )
        assert len(rows) == 0, "cross-org leak: DEFINER trusted the spoofed match_user_id"
```
Pre-164 the body filters `dc.user_id = match_user_id` → leaks A's chunks (RED). Post-164 the in-body org gate keys on `auth.uid()=B` → 0 (GREEN).

**Platform-universal + over-widening guards** — clone `test_163_rls_platform_universal.py`: `is_system` platform content stays universal (`:104-121`), user `is_global` folders/skills stay org-scoped (`:148-217`), badge-spoof blocked (`:222-267`). These re-run against the 4 DEFINER functions now.

**A `pg_proc`-introspection helper** for the audit assertions (Wave-0 gap) — assert `prosecdef=true` AND `proconfig` contains `search_path` for each of the 4 functions:
```python
row = await pool.fetchrow(
    "SELECT prosecdef, proconfig FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace", fn)
assert row["prosecdef"] is True
assert any(c.startswith("search_path=") for c in (row["proconfig"] or []))
```

---

### `backend/tests/test_seed091_owner_nulling.py` (test, serialize unit)

**Analog:** `test_115_tool_global_leak.py` (two-user global-leak shape) — but this is a **unit** test (no live DB), so it constructs rows/dicts and asserts the serialize output nulls the foreign owner. Assert per surface (folders/skills/views): a non-owner reader of an `is_global`/`is_system` row gets `user_id=None` (+ `folder_scope=None` for views); the **owner** still sees their own `user_id`; a non-global row is untouched. Mirror the disjoint-set assertion style of `test_115:258-274`.

---

## Shared Patterns

### Shared Pattern A — asyncpg producer user-context (THE realization of D-164-02/04)
**Source:** `app/dependencies.py:125-175` (`_apply_rls_user_context` + `get_user_pg_connection`).
**Apply to:** `retrieval_service.py`, `sql_service.py`, `kb.py` (grep), `agent_loop.py` (match_skills).
```python
# dependencies.py:156-175 — reuse the SINGLETON pool; claims come from uid ALONE (no token → no mid-run expiry).
@asynccontextmanager
async def get_user_pg_connection(request, current_user) -> AsyncIterator[asyncpg.Connection]:
    uid = current_user["id"]
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_user_context(conn, uid)   # SET LOCAL ROLE authenticated + BOTH GUC forms (is_local=true)
            yield conn
```
The role swap at `_apply_rls_user_context:146` (`SET LOCAL ROLE authenticated`) is the single line that turns RLS on; without it the pool DSN role stays `postgres` (BYPASSRLS) and every predicate is a silent no-op (Pitfall 1). **Anti-pattern (163 red line):** never carry the request's user-JWT supabase client into the producer — it expires mid-run (`threads.py:747-749`).

### Shared Pattern B — the RLS test harness (fail-loud, both-path)
**Source:** `tests/integration/_rls_harness.py` + `conftest.py:74-207`.
**Apply to:** `test_v3_4_org_isolation.py`.
```python
# _rls_harness.py:125-141 — the fail-loud preflight: MUST be the first assertion on every user conn.
async def assert_auth_uid(conn, expected_uid):
    got = await conn.fetchval("SELECT auth.uid()")
    assert got is not None, "auth.uid() NULL — role swap / GUC didn't take; NULL false-passes isolation at 0 rows"
    assert str(got) == str(expected_uid)
    return got
```
A NULL `auth.uid()` false-passes every isolation check at "0 rows" — the preflight + a positive control (viewer sees its OWN row) are the two guards against a 0-for-everyone false-green.

### Shared Pattern C — SEED-091 owner-identity nulling (uniform serialize)
**Source:** `api/skills.py:215-218` (the canonical loop) — adapted per RESEARCH Code Example.
**Apply to:** `skills.py` (list_skills), `document_view_service.py` (list_views, + `folder_scope`), `folder_utils.py`/`folders.py`/`kb.py:_serialize_tree` (folders).
```python
# hide the seeding owner's identity from non-owner readers of a global/system row.
if (row.get("is_global") or row.get("is_system")) and str(row.get("user_id")) != str(caller_id):
    row["user_id"] = None
    # views only: row["folder_scope"] = None
```
RLS gates *rows*, not *columns* — this is a projection/serialize concern, never a DB view/mask (Don't Hand-Roll).

---

## No Analog Found

None. Every file has a live in-repo analog. The `X-Org-Id` header-spoof rejection test has no direct prior test, but its scaffolding is the same `two_orgs_two_users` + API-client shape; grep for `X-Org-Id`/`x_org_id` at plan-time (RESEARCH Open Q3 — expected unread in 164, so the test asserts "header present ≠ access change").

---

## Metadata

**Analog search scope:** `supabase/migrations/` (019/025/073/091/107/108/109), `backend/app/{services,api,utils,models,dependencies}`, `backend/tests/integration/` (`_rls_harness`, `test_163_*`, `test_115_tool_global_leak`, `conftest`).
**Files scanned:** ~24 (6 migrations, 10 backend modules, 6 tests, 2 conftest/model refs).
**Pattern extraction date:** 2026-07-20
