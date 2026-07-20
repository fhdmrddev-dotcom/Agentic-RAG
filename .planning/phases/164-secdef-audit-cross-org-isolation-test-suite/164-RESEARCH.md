# Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite - Research

**Researched:** 2026-07-20
**Domain:** Database security — Postgres RLS, `SECURITY DEFINER` functions, pgvector under an org predicate, cross-tenant isolation testing (Supabase local stack @ :54322)
**Confidence:** HIGH (all four functions, both DB paths, the client-context seam, and the pgvector version verified against live code + live DB; external perf/search_path claims cited to pgvector 0.8.0 + Supabase docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-164-01 … D-164-08 — do NOT re-litigate)

- **D-164-01 — Derive the org predicate IN-BODY via `current_user_org_ids()`; NO `match_org_id` parameter.** `current_user_org_ids()` is itself `SECURITY DEFINER STABLE` and resolves membership off `auth.uid()` (which reads the `request.jwt.claims` GUC, not the executing role). So a DEFINER body may filter `dc.org_id = ANY (SELECT public.current_user_org_ids())` and it reflects the **caller's** memberships. Correct ONLY if the RPC is invoked on a connection where `auth.uid()` resolves the caller (→ D-164-02). Rejected explicit `match_org_id`: redundant, spoofable by an app-layer bug, inconsistent with the mig-108 RLS model. The existing `match_user_id` param stays for signature stability but org is **never** caller-supplied. Predicate keys on LIVE names (`is_global`/`is_system`, not the 165 renames).
- **D-164-02 — Route the three retrieval RPCs through the per-request user-JWT context (163-07 deferred these to 164).** `match_document_chunks`, `keyword_search_chunks`, `match_skills` currently receive a passed-in `supabase` client + explicit `match_user_id`. 164 threads the user context so `auth.uid()`/`current_user_org_ids()` resolve inside the DEFINER bodies. **Fail-closed:** on a service-role/owner connection `auth.uid()` is NULL → `current_user_org_ids()` empty → **0 rows** (over-restrict, never over-share).
- **D-164-03 — Keep all four functions `SECURITY DEFINER`; the "audit" is a recorded per-function justification, not a flip to INVOKER.** Each gets an in-body org predicate + a pinned `search_path`; the migration records WHY DEFINER is retained (pgvector index access / avoids per-row RLS re-check under the CONCUR-01 <1s gate / stable planning) and that the in-body predicate is now the isolation guard + the pinned `search_path` closes the search-path-hijack CVE class. Exact pin form is research/plan-time (see Architecture Pattern 3).
- **D-164-04 — DELETE `_inject_user_id` (`sql_service.py`) + `_inject_user_id_for_grep` (`kb.py`); rely on RLS via the user context.** `query_user_documents(sql_query text)` is `plpgsql` with **no SECURITY clause → INVOKER**; it `EXECUTE`s the arbitrary text-to-SQL under the caller's role. Deleting the regex is safe ONLY once its callers run on an RLS-enforced (user) connection. Do NOT make it DEFINER.
- **D-164-05 — Null `user_id` (+ scope UUIDs) for non-owner readers on global rows, uniformly across folders + skills + views, in every list/serialize path.** `if row.is_global and str(row.user_id) != caller: row.user_id = None` (+ `folder_scope = None` for views). Model change: `FolderResponse.user_id` → `UUID | None`; `SkillResponse.user_id` → `UUID | None`; `ViewResponse.user_id` already `str | None`. Verify frontend tolerates a null owner. Nulling on `is_global AND not-owner` (and `is_system`) covers the system-global leak now and org-shared later — no org-awareness branch needed.
- **D-164-06 — `test_v3_4_org_isolation.py` is an exhaustive, data-driven matrix extending the Phase-163 fixtures.** Every user-facing table (drive from `information_schema`) × both DB paths × all four DEFINER functions × `X-Org-Id` header-spoof rejection × PRAG-01 live retrieval isolation. **Must red-then-green:** at least one assertion must FAIL against the pre-164 DB.
- **D-164-07 — `document_chunks` RLS extends (does not replace) the 163/mig-108 baseline for PRAG-01.** Mig 108 shipped `document_chunks` SELECT owner-only; PRAG-01 needs it to mirror the full folder-visibility predicate. Author as an additive predicate widening in migration 110, keyed on live `is_global`/folder-subtree visibility, re-benchmark CONCUR-01 <1s (163 baseline 0.41s).
- **D-164-08 — One new migration, slot 110, applied via the Supabase SQL editor OR psycopg2-direct — never `db push`/`db reset`.** `110_secdef_org_scope_audit.sql`: re-CREATE the 4 DEFINER functions + the `document_chunks` PRAG-01 predicate widening. Apply live, then `bash scripts/regenerate-full-schema.sh` (no reset), commit both same-commit. Deletions + serialize fixes + client-swap + tests are code (separate from SQL). **Cloud parity owed (do NOT apply now):** migrations 099–110 + `SECRETS_ENCRYPTION_KEY`, in order.

### Claude's Discretion
- Exact `search_path` pin form (`pg_catalog, public` vs `''`+fully-qualified) — constrained by D-164-03. (Research recommends a form below — Architecture Pattern 3.)
- Test-file organization (one parametrized module vs a small cluster mirroring `test_163_rls_*`) — must remain a single named exit gate `test_v3_4_org_isolation.py` the milestone re-runs after 166/167/168.
- Whether the `match_skills` client-swap rides the same helper as the document RPCs or its own seam.

### Deferred Ideas (OUT OF SCOPE — do NOT touch)
- `is_global`→`is_org_shared` / `is_system`→`is_system_global` **RENAME** → Phase 165 (MIG-02). **164 writes against LIVE names** `is_global`/`is_system`/`folder_is_globally_visible`.
- `<OrgContext>` provider + org switcher + single-active-org `X-Org-Id` narrowing UI → Phase 166. 164 only *asserts* a spoofed `X-Org-Id` cannot widen access.
- Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters → later hardening pass (163-D-14).
- Permission-aware *citations* → STRETCH Phase 171 (PRAG-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TEN-03** | All four `SECURITY DEFINER` retrieval/sharing functions carry an explicit in-body org predicate + pinned `search_path`; `_inject_user_id` deleted; `query_user_documents` called through the user context. | Architecture Patterns 1–4; live function bodies located (migs 073/025/091/019); the audit gap table; the asyncpg user-context realization (Pattern 2). |
| **TEN-05** | Cross-org isolation suite `test_v3_4_org_isolation.py` — 2 orgs × every user-facing table × all four DEFINER fns (0 cross-org rows) × both DB paths × `X-Org-Id` spoof rejection — passes; milestone exit gate. | Architecture Pattern 5 + Validation Architecture; the existing `_rls_harness` + `two_orgs_two_users` fixtures + the red-then-green anchor (spoofed `match_user_id`). |
| **TEN-06** | SEED-091 closed — global/org-shared resources null the seeding owner's `user_id` (+ scope UUIDs) for non-owner readers in every list/serialize path. | Pattern found at `skills.py:215-218` (`list_skills`), `document_view_service.list_views:106-110`, `folder_utils`/`kb._serialize_tree`; the exact null snippet + the 3 model loosens. |
| **PRAG-01** | Retrieval is org- AND folder-ACL-isolated — `document_chunks` RLS + the retrieval DEFINER bodies mirror the full folder-visibility predicate. | Pattern 1 (the in-body folder-visibility branch mirroring the mig-108/109 `documents` SELECT policy) + Pattern 4 (widening `document_chunks` RLS for direct reads). |
</phase_requirements>

## Summary

Phase 164 is a **two-halves-that-must-land-together** security phase (a smaller echo of the 163 atomic crux): the SQL half org-scopes four `SECURITY DEFINER` functions, and the Python half makes the connection that invokes them carry the caller's identity. Neither half works alone — org-scoping the SQL is inert if the RPC still runs on the service-role producer connection, and switching the connection is a no-op if the function bodies still trust the `match_user_id` param. The exit-gate test suite is what proves both halves landed.

The single highest-value finding of this research, verified against live code: **the retrieval RPCs and the text-to-SQL/grep tools run inside the detached background producer, which `threads.py:747-749` deliberately keeps on the service-role client "because the request's user-JWT would expire mid-run."** So D-164-02 / D-164-04 cannot be satisfied by "pass the user-JWT supabase client into the producer" — that client is the exact thing 163 refused to carry there. The correct, expiry-safe realization is the Phase-163 **asyncpg `get_user_pg_connection` path**, which synthesizes `request.jwt.claims = {sub: uid, role: authenticated}` from the *uid alone* (no token, no expiry) and turns RLS on with `SET LOCAL ROLE authenticated`. Called over that connection, the DEFINER bodies' nested `current_user_org_ids()`/`auth.uid()` resolve the real caller's org — and a spoofed `match_user_id` cannot cross orgs. This moves the three `supabase.rpc(...)` retrieval calls (and the text-to-SQL/grep tool DB path) onto asyncpg for the producer, with one wrinkle: asyncpg needs the embedding formatted as `'[...]'::vector` (PostgREST did that for free).

pgvector is **0.8.0** live (`m=16, ef_construction=64` HNSW cosine + a btree on the mig-107 `org_id`). The org predicate keys on the denormalized, indexed `org_id` and is **no more selective than the `dc.user_id = match_user_id` filter the function already applies today** — so it introduces no new "filtered-search recall cliff" beyond the 0.41s baseline. 0.8.0's iterative-scan (`hnsw.iterative_scan = relaxed_order`) is the in-pocket mitigation if the PRAG-01 folder widening ever makes the filter more selective, but it is off by default and likely unnecessary. Re-benchmark against `test_058_concurrency.py`.

**Primary recommendation:** Land migration 110 (four DEFINER re-CREATEs with an org-predicate + a `''`+`OPERATOR(public.<=>)` pinned search_path, plus the `document_chunks` PRAG-01 RLS widening) **and** move the producer's retrieval + text-to-SQL DB access onto the asyncpg `get_user_pg_connection` user-context in the same phase; delete the two regex helpers only after that; prove it with a red-then-green `test_v3_4_org_isolation.py` whose red anchor is a spoofed `match_user_id` leaking user A's chunks pre-164.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org-scope enforcement on retrieval/sharing fns | Database (SECDEF body + `current_user_org_ids()`) | — | Server-derived from the authenticated session; never trust an app-supplied arg (D-164-01). |
| Turning RLS/auth.uid() ON for the producer's DB calls | API/Backend (asyncpg `get_user_pg_connection`, uid-synthesized claims) | Database (`SET LOCAL ROLE authenticated`) | The producer is detached + long-lived; a real JWT expires mid-run (`threads.py:748`). The uid-derived asyncpg context is expiry-safe. |
| Text-to-SQL / grep isolation | Database (RLS under `authenticated`) | API/Backend (delete regex; keep SELECT-only + single-statement guards) | `query_user_documents` is INVOKER → RLS auto-scopes once the connection is user-context. |
| Owner-identity nulling on global rows | API/Backend (Python list/serialize) | — | A projection/serialization concern; RLS cannot null a column, only gate the row (SEED-091). |
| Permission-aware retrieval set (folder-ACL) | Database (DEFINER body folder-visibility branch mirroring the `documents` SELECT policy) | Database (`document_chunks` RLS widening for direct reads) | Retrieval bypasses RLS (DEFINER); the in-body predicate is the gate. Direct `.table("document_chunks")` reads need the RLS widening. |
| Isolation proof | Test suite (asyncpg + supabase-py both-path, 2 orgs) | — | Wire-format + single-tenant tests cannot see cross-org leakage; the two-org adversarial matrix is the arbiter. |

## Standard Stack

This phase installs **no new external packages.** It composes primitives already shipped in the repo. The "stack" here is the set of live DB objects + Python factories the plan must use, not a dependency list.

### Core (existing primitives — use these, do not re-invent)
| Primitive | Location | Purpose | Why standard |
|-----------|----------|---------|--------------|
| `current_user_org_ids()` | mig 104 / full-schema `SECURITY DEFINER STABLE SET search_path TO 'public'` reading `SELECT org_id FROM public.org_members WHERE user_id = auth.uid()` | The single org-membership resolver every DEFINER body composes with | Already the workhorse of all 135 org-gated RLS policies; recursion-safe (42P17). |
| `get_user_pg_connection(request, current_user)` | `dependencies.py:156-175` | Acquire an RLS-enforced asyncpg conn from **uid alone** (no token) | Expiry-safe; the producer-path realization of D-164-02. |
| `_apply_rls_user_context(conn, uid)` | `dependencies.py:125-153` | `SET LOCAL ROLE authenticated` + BOTH GUC forms, parameterized, `is_local=true` | The load-bearing RLS-on sequence; imported verbatim by the test harness. |
| `get_user_supabase(request, current_user, token)` | `dependencies.py:194-214` | Per-request user-JWT supabase-py client (ANON key + Bearer) | Already used by the **request-path** kb.py endpoints — fine there; NOT for the producer. |
| `_rls_harness` (`open_user_conn`, `as_user_asyncpg`, `as_user_supabase_txn`, `assert_auth_uid`) | `tests/integration/_rls_harness.py` | Both-path RLS test substrate + fail-loud preflight | The exit-gate suite extends this; do not re-derive. |
| `two_orgs_two_users` fixture | Phase-163 conftest (used by `test_163_leak_*`) | Two seeded users in disjoint orgs, one owned row per table | The suite's non-vacuity + isolation precondition. |

### Supporting (existing)
| Primitive | Purpose | When to use |
|-----------|---------|-------------|
| `idx_document_chunks_org_id` btree (mig 107) | Indexes the denormalized `org_id` | Serves RLS direct-reads + the org equality filter; HNSW/GIN stay untouched. |
| `SupabaseTxnAdapter` (`_reembed_adapter`) via `as_user_supabase_txn` | Runs supabase-py fluent surface inside a `uid` RLS txn | The supabase-py-path leg of the two-path leak matrix. |
| `hnsw.iterative_scan = relaxed_order` / `hnsw.max_scan_tuples` (pgvector 0.8.0) | Prevents overfiltering under a selective WHERE | Only if the CONCUR-01 benchmark shows under-filling after the PRAG-01 widening. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncpg uid-context for producer retrieval | Build a user-JWT supabase client in the producer | Rejected by 163 — the JWT expires mid-run (`threads.py:748`); a long turn would silently drop to 0 rows. |
| In-body `current_user_org_ids()` (session-derived) | A DEFINER helper taking uid as an explicit arg | Rejected by D-164-01 — an app bug passing the wrong uid would cross orgs; session-derived removes the trust. |
| `SET search_path = ''` + `OPERATOR(public.<=>)` | `SET search_path = pg_catalog, public` | Both pin the path; `''` is the Supabase-advisor-clean form but requires qualifying the pgvector operator. See Pattern 3. |

**Installation:** none — no `pip install`. (Verified: `psycopg2`, `asyncpg`, `supabase` already present in `backend/venv`; the DB probe below ran through `venv/Scripts/python.exe`.)

## Package Legitimacy Audit

**This phase installs no external packages.** No `npm`/`pip`/`cargo` additions — it is pure SQL (migration 110) + Python edits to existing modules + a new test file using already-installed test deps (`pytest`, `asyncpg`, `psycopg2`). The Package Legitimacy Gate is therefore **N/A** (nothing to slopcheck). If the planner discovers a genuinely new dependency is needed (not expected), gate it behind a `checkpoint:human-verify` per the standard protocol.

## Runtime State Inventory

> Included because 164 mutates live DB objects (function bodies + policies), deletes code paths, and loosens serialize contracts — an audit of what still carries the old behavior after files change.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Live DB function bodies** | Four SECDEF functions live in the DB with the OLD (user-only, some un-pinned) bodies — verified via `pg_proc`: `match_document_chunks` (DEFINER, **no search_path**), `keyword_search_chunks` (DEFINER, **no search_path**), `match_skills` (DEFINER, `search_path=public, pg_temp`), `folder_is_globally_visible` (DEFINER, `search_path=public`). `document_chunks` SELECT policy is owner-only (mig 108). | **DB migration 110** (`CREATE OR REPLACE` — no signature change → no DROP needed) applied via SQL editor / psycopg2; NOT a code edit. Then regenerate `full-schema.sql` (no reset), commit both same-commit. |
| **Regenerated deploy artifact** | `supabase/full-schema.sql` will drift from the live DB the instant 110 applies. | `bash scripts/regenerate-full-schema.sh` (no `--reset`) after apply; never hand-edit. |
| **Cloud DB (production)** | Migrations 099–110 + `SECRETS_ENCRYPTION_KEY` are pending on cloud, in order. | **Do NOT apply now** — operator-gated at next production push (D-164-08). 110 joins the pending set. |
| **Deleted code paths (stale imports/tests)** | `_inject_user_id` (`sql_service.py:31`), `_inject_folder_scope` (feature-narrowing, NOT security — see Open Question 1), `_inject_user_id_for_grep` (`kb.py:233`), and their callers/tests. `get_globally_visible_folder_ids` is only used to build the OR-global branch inside `_inject_user_id`. | Delete the two SECURITY-injection helpers + their tests; audit whether `get_globally_visible_folder_ids` has other callers before removing. |
| **Serialize contracts (model loosen)** | `FolderResponse.user_id: UUID` (folder.py:23), `SkillResponse.user_id: UUID` (skill.py:22), `SkillFileResponse.user_id: UUID` (skill.py:44 — confirm if it needs it). `ViewResponse.user_id` already `str | None`. | Loosen to `UUID | None`; frontend UI-contract check (owner-gated affordances already branch on ownership — flag for the plan). |
| **Deployment-artifact same-commit rule** | 110 seeds no reference data, touches no env var / bundled service / sandbox tag. | NOT seed-bearing → owes no `docs/OPERATOR.md` Step-3 or `check-deploy-drift.sh` change (D-16 satisfied by exclusion, as migs 107/108/109). |

**Nothing found in category (OS-registered state / secrets-env):** None — this phase registers no OS state and reads no new secret/env var (verified: no new `settings.*` reads; the org predicate derives from `auth.uid()`, not config).

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────── REQUEST PATH (short-lived, has JWT) ───────────────────────────┐
  HTTP request → get_current_user → get_user_supabase_client (ANON+Bearer) ──→ kb.py /grep,/tree,/query ──→ query_user_documents (INVOKER)
                 │                                                              │                              │
                 │  auth.uid()=caller via PostgREST SET ROLE authenticated      │  RLS ENFORCED               │  EXECUTEs text-SQL as `authenticated` → RLS scopes it
                 └──────────────────────────────────────────────────────────────┘                              (DELETE _inject_user_id_for_grep — safe HERE already)

                 ┌────────────────────── PRODUCER PATH (detached, LONG-lived, NO safe JWT) ──────────────────┐
send_message ──→ run_producer(service_supabase)  ── agent_loop.run_agent_loop(ctx.supabase = SERVICE-ROLE) ──┐
                 │                                                                                            │
                 │   ctx.supabase = service-role (BYPASSRLS) → auth.uid()=NULL  ← TODAY                       │
                 │                                                                                            ▼
                 │                              ┌─────── 164 CHANGE (D-164-02/04) ───────────────────────────────────┐
                 │                              │  retrieval + text-to-SQL DB calls move onto:                        │
                 │                              │  get_user_pg_connection(current_user)  → asyncpg, uid-synthesized   │
                 │                              │  claims {sub:uid, role:authenticated} + SET LOCAL ROLE authenticated│
                 │                              │  (NO token → no mid-run expiry)                                     │
                 │                              └────────────────────────────────────────────────────────────────────┘
                 │                                        │
                 │   match_document_chunks / keyword_search_chunks / match_skills (SECURITY DEFINER)          │
                 │   ── body: WHERE dc.org_id = ANY(SELECT current_user_org_ids())   ← auth.uid()=caller ─────┤
                 │            AND (dc.user_id = auth.uid() OR folder_is_globally_visible(d.folder_id)) ...     │
                 │   ── nested current_user_org_ids() reads request.jwt.claims GUC (unaffected by DEFINER) ────┘
                 └── spoofed match_user_id ⇒ 0 cross-org rows (red-then-green anchor)
```

### Recommended Migration / File Structure
```
supabase/migrations/
└── 110_secdef_org_scope_audit.sql   # 4× CREATE OR REPLACE DEFINER fns (org predicate + pinned search_path)
                                      #  + document_chunks SELECT RLS widening (PRAG-01)
backend/app/
├── services/retrieval_service.py    # match_document_chunks/keyword_search_chunks → asyncpg user-context (uid+pool)
├── services/agent_loop.py           # match_skills RPC → asyncpg user-context (uid+pool)
├── services/tool_dispatcher.py      # ctx for query_documents/grep tools → user-context DB path
├── services/sql_service.py          # DELETE _inject_user_id; query_documents runs on user-context
├── api/kb.py                        # DELETE _inject_user_id_for_grep; grep runs on user-context
├── services/document_view_service.py# list_views: null user_id+folder_scope on non-owned global rows
├── api/skills.py                    # list_skills (:215-218): null user_id on non-owned is_global/is_system rows
├── utils/folder_utils.py            # folder list/serialize: null user_id on non-owned global rows
└── models/{folder,skill}.py         # user_id: UUID → UUID | None
backend/tests/integration/
└── test_v3_4_org_isolation.py       # THE exit gate (extends _rls_harness + two_orgs_two_users)
```

### Pattern 1: The org-predicate DEFINER body (mirror the live `documents` SELECT policy)
**What:** Each retrieval function's `WHERE` gains the org gate + the within-org owner/folder-visibility branch — byte-for-byte the shape mig 108/109 already ships for the `documents` SELECT policy. The `match_user_id` param is retained for signature stability but is **no longer the scoping key** (owner branch keys on `auth.uid()`).
**When to use:** `match_document_chunks` (has the `d` join → `d.folder_id` available), `keyword_search_chunks` (same join).
**Example (`match_document_chunks`, mirrors `full-schema` documents policy):**
```sql
-- Source: mig 073 (current body) + mig 108:114-117 + mig 109 (documents SELECT policy shape)
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL,
  p_folder_ids uuid[] DEFAULT NULL, p_embedding_model text DEFAULT NULL
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''                                   -- Pattern 3
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity   -- Pattern 3: qualify the operator
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())                    -- D-164-01 org gate (indexed, mig 107)
    AND (                                                                          -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                                      --  owner branch (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_globally_visible(d.folder_id))
    )
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding                        -- HNSW index still matches this operator
  LIMIT match_count;
END; $$;
```
- `match_skills` (mig 091) already joins nothing but reads `s.org_id` (mig-107 gave `skill_embeddings` org_id; `skills` got org_id in mig 105/108) — gate `WHERE s.org_id = ANY(SELECT public.current_user_org_ids()) AND (s.user_id = auth.uid() OR s.is_global = true OR s.is_system = true) AND s.is_enabled = true`. **Keep the `is_system` universal branch OUTSIDE the org gate** to mirror mig 109 FIX-A (the built-in skill-creator must stay universal): `WHERE (s.is_system = true) OR (s.org_id = ANY(...) AND (s.user_id = auth.uid() OR s.is_global = true))) AND s.is_enabled = true`.
- `folder_is_globally_visible` (mig 019) — a pure ancestor-walk on `is_global`; it does NOT get an org predicate (the org gate lives in the *calling* policy/body that wraps it). Its audit = pin `search_path` + schema-qualify + record justification.
**Fail-closed proof:** on any connection where `auth.uid()` is NULL, `current_user_org_ids()` returns empty → `org_id = ANY(empty)` is false → 0 rows.

### Pattern 2: Producer retrieval over the asyncpg user-context (THE realization of D-164-02/04)
**What:** The producer (agent loop) invokes the DEFINER functions and `query_user_documents` **over `get_user_pg_connection` built from `current_user["id"]`**, NOT over `ctx.supabase` (service-role) and NOT over a captured JWT.
**Why:** `threads.py:747-749` — the producer is detached and long-lived; a real user-JWT "would expire mid-run." The asyncpg context synthesizes claims from the uid (no token) so `auth.uid()` resolves for the whole run.
**Example (retrieval RPC over asyncpg — note the vector wrinkle):**
```python
# Source: dependencies.py:156-175 (get_user_pg_connection) + retrieval_service.py:65
# asyncpg has NO vector codec registered (only jsonb, dependencies.py:74) — format the
# embedding as a pgvector literal and cast, which PostgREST/supabase.rpc did implicitly.
vec_literal = "[" + ",".join(repr(float(x)) for x in query_embedding) + "]"
async with get_user_pg_connection(request=None, current_user={"id": user_id}) as conn:
    rows = await conn.fetch(
        """SELECT id, document_id, content, chunk_index, similarity
           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)""",
        vec_literal, user_id, top_n, match_threshold, metadata_filter_json, folder_ids, current_model,
    )
```
- The same connection carries `query_user_documents(sql_query)` for the text-to-SQL/grep tools — as INVOKER it runs the dynamic `EXECUTE` as `authenticated`, so RLS scopes it (D-164-04). This is what makes deleting `_inject_user_id`/`_inject_user_id_for_grep` **safe**.
- **Seam choice (Claude's discretion, D-164-02):** either add a `retrieval_service` helper `_call_as_user(pool, uid, fn_sql, *args)` shared by document + skill RPCs, or thread a per-call connection. Keep `run_in_threadpool` off the equation — asyncpg is already async (no supabase-py blocking).
**Anti-pattern:** passing the request's user-JWT supabase client into the producer closure (163 red line — expiry) OR leaving `ctx.supabase` service-role and adding the org predicate anyway (breaks retrieval → 0 rows for everyone).

### Pattern 3: `search_path` pin form for the DEFINER audit
**What:** Recommended primary form: **`SET search_path = ''`** with every relation schema-qualified (`public.document_chunks`, `public.documents`, `public.folders`, `public.org_members`) — this is the Supabase security-advisor-clean form (lint `0011_function_search_path_mutable` explicitly wants `''`). **The one gotcha:** pgvector is installed `WITH SCHEMA public` (verified: `full-schema.sql:40`), so the distance operator `<=>` will **not resolve** under `search_path=''` — write it as `OPERATOR(public.<=>)` (still matches the HNSW `vector_cosine_ops` index, so no perf regression). Built-in operators/functions (`@@`, `plainto_tsquery`, `ts_rank_cd`, `bool_or`, `ANY`) live in `pg_catalog`, which is always implicitly searched first — they resolve fine under `''`.
**Alternative (lower friction):** `SET search_path = pg_catalog, public` — pins the path, lets `<=>` resolve without `OPERATOR(...)` wrapping, and still closes the CVE-2018-1058 hijack class (an attacker cannot prepend a schema). It does NOT literally pass lint 0011's `''` check but is not "mutable." Given the repo's existing convention is a pinned non-empty path (`current_user_org_ids` uses `'public'`), this is defensible.
**CVE class closed:** an attacker-controlled `search_path` shadowing a called object (function/operator/table) inside a DEFINER function running as `postgres`. Pinning removes the caller's influence.
**Audit also HARDENS the two already-pinned fns:** `match_skills` (`public, pg_temp` → drop `pg_temp`; it lets a caller shadow via temp objects) and `folder_is_globally_visible` (`public` → `''`+qualified or `pg_catalog, public`).

### Pattern 4: `document_chunks` RLS widening for PRAG-01 (direct reads)
**What:** Retrieval bypasses `document_chunks` RLS (DEFINER), so the in-body predicate (Pattern 1) is the retrieval gate. But **direct** `.table("document_chunks")` reads (e.g. `retrieval_service.fetch_full_document`'s chunk-reassembly fallback, `:240-246`) are RLS-gated — and mig 108 made that owner-only, so a user reading a *shared/global-folder* document could read the document but get **empty chunks**. Widen the `document_chunks` SELECT policy to mirror the `documents` folder-visibility branch.
**Example:**
```sql
-- Source: mig 108:168-170 (current owner-only) widened to mirror mig 108:114-117 documents policy.
-- document_chunks has no folder_id column → reference the parent via an EXISTS (point-lookup on
-- documents.id PK, NOT the HNSW seq-scan → CONCUR-01-safe: only fires on DIRECT reads, not retrieval).
DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id)
              OR EXISTS (SELECT 1 FROM public.documents d
                          WHERE d.id = document_chunks.document_id
                            AND d.folder_id IS NOT NULL
                            AND public.folder_is_globally_visible(d.folder_id))));
```
**Perf note:** this EXISTS is on the **direct-read** path only (retrieval never evaluates `document_chunks` RLS because the RPC is DEFINER). Re-benchmark CONCUR-01 anyway (D-164-07) — the *retrieval* cost change is the Pattern-1 in-body predicate, not this policy.

### Pattern 5: The two-org exit-gate suite (extend `_rls_harness`)
**What:** `test_v3_4_org_isolation.py` = a data-driven matrix over the existing `two_orgs_two_users` fixture + `_rls_harness`.
- **Every user-facing table** — drive from `information_schema.tables` (there is already a `_table_exists` helper in `test_163_leak_asyncpg.py`); for each, assert user B reads 0 of user A's rows (owner-scoped `WHERE user_id = A.uid` count == 0), fail-loud-preflighted (`assert_auth_uid`) + positive-controlled (B sees B's own).
- **Both DB paths** — asyncpg via `open_user_conn`; supabase-py via `as_user_supabase_txn` (the `SupabaseTxnAdapter` bridge). Mirror `test_163_leak_asyncpg.py` / `test_163_leak_supabase.py`.
- **All four DEFINER functions** — call each over `open_user_conn(pool, B.uid)` (and the supabase-path adapter) with parameters that would return user A's rows, assert 0.
- **`X-Org-Id` header-spoof rejection** — an API-level test: B sends `X-Org-Id: <A's org>`; assert 0 A-rows (org derives from membership via `current_user_org_ids()`, the header is not consulted in 164 — full narrowing is 166).
- **PRAG-01 live retrieval isolation** — seed A with a private doc + a shared-folder doc; B runs `search_documents`/`match_document_chunks`; assert B never gets A's private chunks and gets shared ones only per folder-ACL.
**The red-then-green anchor (D-164-06):** the killer assertion is **a spoofed `match_user_id`** — as user B (`auth.uid()=B`), call `match_document_chunks(match_user_id => A.uid, ...)`. **Pre-164** the body filters `dc.user_id = match_user_id` → returns user A's chunks → **RED (leak)**. **Post-164** the in-body org predicate keys on `auth.uid()=B`'s memberships → 0 of A's cross-org chunks → **GREEN**. This proves the gate tests the *new* behavior, not a property the param already gave.

### Anti-Patterns to Avoid
- **Adding the org predicate but leaving `ctx.supabase` service-role in the producer** → `auth.uid()` NULL → retrieval returns 0 rows for everyone (fail-closed, but a broken app). Both halves must land together.
- **Deleting the regex before the tool DB path is user-context** → `query_user_documents` (INVOKER) runs the arbitrary SELECT as `postgres`/BYPASSRLS → full cross-user leak.
- **`SET search_path = ''` without `OPERATOR(public.<=>)`** → `operator does not exist: vector <=> vector` at first retrieval.
- **Deriving org from `match_user_id`** → re-introduces the exact spoof D-164-01 forbids.
- **A per-tenant partial vector index** → org count is unbounded (mig 107 already rejected this); keep HNSW/GIN untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Making `auth.uid()` resolve in the producer | A JWT-refresh loop / capturing+renewing the request token | `get_user_pg_connection` (uid-synthesized claims) | No token, no expiry, already shipped + tested in 163. |
| Org derivation in a DEFINER body | A new `org_ids_for_user(uid)` helper | `current_user_org_ids()` | Session-derived (anti-spoof), recursion-safe, already the RLS workhorse. |
| Two-user leak scaffolding | New fixtures + a SET-LOCAL helper | `two_orgs_two_users` + `_rls_harness` (`open_user_conn`, `assert_auth_uid`, `as_user_supabase_txn`) | Identical RLS shape to the request factory; can't drift. |
| Cross-user SQL scoping on text-to-SQL | The `_inject_user_id` regex (being deleted) | RLS under `authenticated` (INVOKER `query_user_documents`) | The regex is fragile (alias detection, WHERE splicing); RLS is total + subsumes it. |
| Nulling owner identity on a shared row | A DB view / RLS column mask | A Python serialize-time `if is_global and user_id != caller: user_id = None` | RLS gates rows, not columns; column-nulling is a projection concern (SEED-091). |
| pgvector overfiltering | Manual candidate over-fetch + re-filter loops | `hnsw.iterative_scan = relaxed_order` (0.8.0) — only if needed | Built into the version already installed. |

**Key insight:** every "new" capability this phase needs was already built by Phase 163 (the asyncpg user-context, the harness, the org helper, the RLS baseline). 164 is composition + a migration, not new plumbing.

## Common Pitfalls

### Pitfall 1: The producer's service-role connection silently defeats the org predicate
**What goes wrong:** The org predicate lands, but retrieval still runs on `ctx.supabase` (service-role) → `auth.uid()` NULL → 0 rows. Single-tenant manual testing "works" only if you forget the org gate returns empty for a NULL identity.
**Why it happens:** `threads.py` hands the producer a service-role client on purpose; the retrieval tools inherit it via `ToolContext.supabase`.
**How to avoid:** Move the producer's retrieval + text-to-SQL DB calls onto `get_user_pg_connection` (Pattern 2). The suite's fail-closed assertion (RPC on a no-`auth.uid()` conn → 0 rows) catches a regression.
**Warning signs:** "search returns nothing" after the migration; `auth.uid()` NULL inside the function.

### Pitfall 2: `SET search_path = ''` breaks the pgvector operator
**What goes wrong:** `operator does not exist: public.vector <=> public.vector` at first vector search.
**Why it happens:** pgvector is in `public` (`WITH SCHEMA public`); `''` removes `public` from the path so `<=>` won't resolve.
**How to avoid:** Write `OPERATOR(public.<=>)` (Pattern 3), or use `SET search_path = pg_catalog, public`. `@@`/`plainto_tsquery`/`ts_rank_cd` are fine (pg_catalog).
**Warning signs:** migration 110 applies but every `match_document_chunks` call errors.

### Pitfall 3: asyncpg has no vector codec
**What goes wrong:** Passing a Python `list[float]` to a `vector` param over asyncpg fails or mis-serializes; the pool only registers a jsonb codec (`dependencies.py:74`).
**Why it happens:** supabase.rpc → PostgREST accepted a JSON array and cast it; asyncpg does not.
**How to avoid:** Format as `'[' + ','.join(...) + ']'` and cast `$1::public.vector` (Pattern 2).
**Warning signs:** `invalid input for query argument`, or wrong-dimension errors.

### Pitfall 4: Deleting the regex before the connection is user-context = full leak
**What goes wrong:** `query_user_documents` (INVOKER) runs the arbitrary SELECT as `postgres`/BYPASSRLS → any user's rows. Deleting `_inject_user_id` removes the only scope.
**Why it happens:** The tool path (`tool_dispatcher` → `query_documents`/`grep_path` on `ctx.supabase`) is service-role in the producer.
**How to avoid:** Land Pattern 2 for the tool DB path in the SAME change; the suite's text-to-SQL cross-org probe is the arbiter.
**Warning signs:** a text-to-SQL query returns another user's documents.

### Pitfall 5: `is_system` must stay OUTSIDE the org gate (mig 109 FIX-A)
**What goes wrong:** Adding a naive `org_id = ANY(current_user_org_ids())` to `match_skills` traps the built-in skill-creator (`is_system=true`, seed-owned) inside the org gate — it vanishes for everyone but the seed org (the exact 163-UAT Test-7 regression).
**Why it happens:** Platform/system content is universal by design; user-shared content is org-scoped.
**How to avoid:** Mirror mig 109 — `(s.is_system = true) OR (s.org_id = ANY(...) AND (s.user_id = auth.uid() OR s.is_global = true))`.
**Warning signs:** the skill-creator disappears from the catalog for a second user.

### Pitfall 6: CREATE OR REPLACE vs signature
**What goes wrong:** If you accidentally change a return column or arg type, `CREATE OR REPLACE` errors ("cannot change return type") and needs a `DROP FUNCTION` (which can cascade to dependent policies).
**Why it happens:** The current `keyword_search_chunks` live body (mig 025) returns `(id, document_id, content, chunk_index, rank)` — preserve it exactly.
**How to avoid:** Only change the body + add `SET search_path`; keep signatures byte-identical → plain `CREATE OR REPLACE`, no DROP. (Adding a `SET` clause is allowed by REPLACE.)
**Warning signs:** "cannot change name of input parameter" / "cannot change return type of existing function".

## Code Examples

### SEED-091 owner-identity nulling (uniform across the three serialize paths)
```python
# Source: skills.py:215-218 (list_skills loop) — apply the identical shape in
# document_view_service.list_views (:106-110, also null folder_scope) and the folder serialize path.
for row in result.data:
    if row["id"] in seen:
        continue
    seen.add(row["id"])
    # SEED-091 / D-164-05: hide the seeding owner's identity from non-owner readers.
    if (row.get("is_global") or row.get("is_system")) and str(row.get("user_id")) != str(current_user["id"]):
        row["user_id"] = None                 # + row["folder_scope"] = None  (views only)
    skills.append(row)
```

### The red-then-green anchor (pytest, over the asyncpg path)
```python
# Source: extends tests/integration/_rls_harness.open_user_conn + two_orgs_two_users.
@requires_pg
async def test_definer_ignores_spoofed_match_user_id(pg_pool, two_orgs_two_users):
    """RED pre-164 (body filters dc.user_id = match_user_id → leaks A's chunks);
    GREEN post-164 (in-body org predicate keys on auth.uid()=B → 0 of A's rows)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:      # auth.uid() = B
        await assert_auth_uid(conn, b["uid"])                  # fail-loud preflight
        rows = await conn.fetch(
            "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 50, 0.0)",
            _zero_vec_literal(), a["uid"],                     # spoofed match_user_id = A
        )
        assert len(rows) == 0, "cross-org leak: DEFINER trusted the spoofed match_user_id"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex `_inject_user_id` to scope text-to-SQL under a BYPASSRLS client | INVOKER `query_user_documents` under an RLS-enforced connection | 163 (client swap) → 164 (delete regex) | Total scoping via RLS; deletes a fragile alias/WHERE-splicing regex. |
| DEFINER fns scoped only by a caller-supplied `match_user_id` param | Session-derived org gate (`current_user_org_ids()`/`auth.uid()`) in-body | 164 (TEN-03) | An app-layer bug can no longer cross orgs. |
| pgvector HNSW post-filter overfiltering ("recall cliff") | pgvector 0.8.0 iterative index scans (`hnsw.iterative_scan`) | pgvector 0.8.0 (live) | In-pocket mitigation; likely unneeded (org filter ≤ existing user filter selectivity). |
| Supabase advisor tolerated unset `search_path` | Advisor now flags mutable search_path (lint 0011); recommends `SET search_path = ''` | Supabase advisors | Two of the four fns are currently un-pinned; 164 closes the CVE class. |

**Deprecated/outdated:**
- `_inject_user_id` / `_inject_user_id_for_grep` — replaced by RLS (delete).
- Trusting `match_user_id` for scoping — replaced by session-derived org (keep the param, ignore it for scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GUC (`request.jwt.claims`) set by `SET LOCAL` propagates unchanged into a nested `SECURITY DEFINER` call, so `current_user_org_ids()` inside `match_document_chunks` resolves the caller's org. Strongly supported by Postgres semantics (GUCs are session/txn state, not role state) AND by the 163 leak tests passing (mig-108 policies already call `current_user_org_ids()` as SECDEF under this exact asyncpg context). | Pattern 1/2 | LOW risk — but the D-164-06 suite is the live arbiter (163-D-08 precedent): author a two-user DEFINER-call assertion, do not ship on this reasoning alone. |
| A2 | The org predicate is no more selective than the existing `dc.user_id = match_user_id` filter, so no new recall cliff / CONCUR-01 stays <1s. | Pattern 1, pgvector Q | MEDIUM — the PRAG-01 folder-visibility branch could widen the candidate set; re-benchmark `test_058_concurrency.py` before merge (D-164-07). |
| A3 | `SkillFileResponse.user_id` (skill.py:44) may not need nulling if skill_files are never surfaced with a foreign owner; CONTEXT lists skill.py:22,44 for the loosen. | Runtime State Inventory | LOW — confirm at plan-time whether the skill-files list serializer exposes a non-owner `user_id`. |
| A4 | `_inject_folder_scope` (sql_service) is a feature-narrowing (scope to a chosen folder subtree), NOT a security control, so it survives the D-164-04 deletion. | Open Question 1 | LOW — but confirm: it must not be the only thing keeping a query inside a folder the user chose; RLS handles cross-user, folder-scope handles relevance. |
| A5 | The frontend tolerates a null owner `user_id` on global folders/skills/views (owner-gated affordances already branch on ownership). | D-164-05 | MEDIUM — a UI-contract check flagged for the plan; a hard-required `user_id` in a TS type would throw. |

**If a claim above needs confirmation before it becomes a locked decision, surface it in plan-phase / discuss-phase.**

## Open Questions (RESOLVED)

1. **Does `_inject_folder_scope` (sql_service.py:71) survive the D-164-04 deletion?**
   - What we know: D-164-04 names only the two SECURITY-injection helpers (`_inject_user_id`, `_inject_user_id_for_grep`). `_inject_folder_scope` narrows a query to a user-chosen folder subtree — a relevance feature, not a cross-user gate.
   - What's unclear: whether keeping it is desired, or whether folder-scoping should also move to a param/RLS-friendly form.
   - Recommendation: KEEP `_inject_folder_scope` (feature), delete only the two security injections; note in the plan that RLS now owns cross-user isolation and folder-scope owns relevance.
   - **RESOLVED:** KEEP `_inject_folder_scope`; delete only the two security injectors. Implemented in Plan 164-04 (explicit "KEEP `_inject_folder_scope`"). Also captured under CONTEXT.md §Claude's Discretion.

2. **Seam for the producer retrieval client-swap (D-164-02 discretion).**
   - What we know: three RPC sites (`retrieval_service._vector_search`, `._keyword_search`, `agent_loop` match_skills) + the tool DB path all need the asyncpg user-context.
   - What's unclear: one shared `_call_as_user(pool, uid, ...)` helper vs. per-site.
   - Recommendation: one shared helper in `retrieval_service` (or a small `db/user_rpc.py`); `match_skills` can ride it or its own seam — planner's call.
   - **RESOLVED:** one shared `_call_as_user` seam. Implemented in Plan 164-04 (single shared helper routes all producer RPCs onto the asyncpg user-context). CONTEXT.md §Claude's Discretion pre-authorized the planner's call.

3. **`X-Org-Id` spoof test scope.**
   - What we know: 164 only *asserts* a spoofed header cannot widen (org derives from membership; the header is not consulted until 166).
   - What's unclear: whether any code path already reads `X-Org-Id`.
   - Recommendation: grep for `X-Org-Id`/`x_org_id` at plan-time; if unread, the test asserts "header present ≠ access change" (the header is inert in 164).
   - **RESOLVED:** grep-at-author-time then assert "header present ≠ access change." Implemented in Plan 164-01 Task 2 (X-Org-Id spoof leg greps for readers, then proves the header is inert in 164; validated narrowing lands in 166).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) @ :54322 | migration 110 apply, live leak tests | ✓ (probed via venv psycopg2) | Postgres (Supabase local) | — |
| pgvector | retrieval fns, perf gate | ✓ | **0.8.0** (verified `pg_extension`) | — |
| HNSW index on `document_chunks.embedding` | vector search | ✓ | `hnsw (embedding vector_cosine_ops) m=16, ef_construction=64` | — |
| `idx_document_chunks_org_id` btree | org filter / RLS | ✓ | mig 107 | — |
| `asyncpg` / `psycopg2` / `supabase` (backend venv) | tests, migration apply, retrieval swap | ✓ | present in `backend/venv` | — |
| Backend uvicorn running | live end-to-end retrieval UAT | ✗ (operator starts it) | — | Operator starts backend for live UAT (per `feedback_user_starts_backend`). |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** live end-to-end retrieval UAT needs the operator to start uvicorn (never auto-started); the two-org DB-level suite runs against :54322 directly.

## Validation Architecture

> `workflow.nyquist_validation: true` — this section is turned into VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (+ pytest-asyncio) |
| Config file | `backend/pytest.ini` / `pyproject.toml` (existing; confirm at plan-time) |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_v3_4_org_isolation.py -x` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration -k "163 or v3_4_org" -q` |
| Live-DB guard | `@requires_pg` (skip-guarded on :54322 via `_rls_harness`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEN-03 | DEFINER body ignores spoofed `match_user_id` (org from `auth.uid()`) | integration (asyncpg) | `pytest tests/integration/test_v3_4_org_isolation.py::test_definer_ignores_spoofed_match_user_id -x` | ❌ Wave 0 |
| TEN-03 | All 4 fns return 0 cross-org rows, both paths | integration | `pytest tests/integration/test_v3_4_org_isolation.py -k definer -x` | ❌ Wave 0 |
| TEN-03 | 4 fns are DEFINER + have a pinned `search_path` (pg_proc assert) | integration (DB introspection) | `pytest tests/integration/test_v3_4_org_isolation.py -k search_path -x` | ❌ Wave 0 |
| TEN-03 | text-to-SQL/grep cannot cross orgs (regex deleted) | integration | `pytest tests/integration/test_v3_4_org_isolation.py -k text_to_sql -x` | ❌ Wave 0 |
| TEN-05 | Every user-facing table: B reads 0 of A's rows, both paths | integration (data-driven) | `pytest tests/integration/test_v3_4_org_isolation.py -k table_matrix -x` | ❌ Wave 0 |
| TEN-05 | `X-Org-Id` spoof does not widen access | integration/API | `pytest tests/integration/test_v3_4_org_isolation.py -k org_header_spoof -x` | ❌ Wave 0 |
| TEN-06 | Non-owner reader sees `user_id=None` on global folders/skills/views | unit (serialize) | `pytest tests/test_seed091_owner_nulling.py -x` | ❌ Wave 0 |
| PRAG-01 | B's hybrid search never returns A's private chunks; shared per folder-ACL | integration (live retrieval) | `pytest tests/integration/test_v3_4_org_isolation.py -k prag01_retrieval -x` | ❌ Wave 0 |
| PRAG-01 | CONCUR-01 <1s holds after the widening | integration (perf) | `pytest tests/integration/test_058_concurrency.py -x` | ✅ exists (re-run) |

### Sampling Rate
- **Per task commit:** the quick run above + `pytest tests/integration -k "163" -q` (must not regress the crux).
- **Per wave merge:** full suite + `test_058_concurrency.py` (CONCUR-01 gate).
- **Phase gate:** `test_v3_4_org_isolation.py` fully green AND the red-anchor proven RED against a pre-164 checkout; SC#10 4-axis live UAT (operator-run) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/integration/test_v3_4_org_isolation.py` — the exit-gate matrix (covers TEN-03/05, PRAG-01).
- [ ] `tests/test_seed091_owner_nulling.py` — TEN-06 serialize unit tests (folders/skills/views).
- [ ] Confirm `two_orgs_two_users` fixture is importable from the Phase-163 conftest scope (it powers `test_163_leak_*`); extend its seed to include a **shared-folder** doc for the PRAG-01 leg.
- [ ] A `pg_proc`-introspection helper (assert `prosecdef=true` + `proconfig` contains `search_path`) for the audit assertions.

*(Existing infra covered: `_rls_harness`, `assert_auth_uid`, `open_user_conn`, `as_user_supabase_txn`, `test_058_concurrency.py`.)*

## Security Domain

> `security_enforcement` enabled (this is a "security core" phase per ROADMAP). ASVS categories mapped to the phase tech stack.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Two-halves-together (SQL predicate + user-context connection); the isolation suite is the architectural proof. |
| V4 Access Control | **yes (core)** | Membership RLS + in-body org predicate (`current_user_org_ids()`); fail-closed on NULL identity; `is_system` universal branch preserved (mig 109). |
| V5 Input Validation / Injection | yes | Text-to-SQL: keep SELECT-only + single-statement (no `;`) client guards; RLS as the primary boundary; parameterized asyncpg (never string-interpolate the uid — `dependencies.py` already does this). |
| V6 Cryptography | no | No crypto surface in 164 (secrets = SEC-01/Phase 150, unchanged). |
| V7 Error Handling / Logging | yes | Fail-closed = 0 rows, not an exception; the suite's positive-control prevents false-green at "0-for-everyone." |
| V10 Malicious Code / SSTI | yes | `search_path` pin closes the DEFINER search-path-hijack class (CVE-2018-1058); no new SSTI surface. |

### Known Threat Patterns for {Postgres RLS + SECDEF + pgvector}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DEFINER trusts a caller-supplied `match_user_id`/`match_org_id` (cross-org read via app bug) | Elevation of Privilege | Session-derived org via `current_user_org_ids()`/`auth.uid()`; ignore the param for scope (D-164-01). Red-anchor test. |
| search_path hijack inside a `postgres`-owned DEFINER fn | Elevation of Privilege / Tampering | `SET search_path = ''` + schema-qualified refs (+ `OPERATOR(public.<=>)`) — closes CVE-2018-1058. |
| INVOKER `query_user_documents` run on a BYPASSRLS connection after the regex is deleted | Information Disclosure | Run the text-to-SQL DB path under the asyncpg user-context (RLS enforced); prove with the text-to-SQL cross-org probe. |
| Token expiry mid-run silently degrading retrieval | Denial of Service (self-inflicted) | uid-synthesized asyncpg claims (no token) — never carry the request JWT into the producer. |
| Owner-identity disclosure on shared/global rows (SEED-091) | Information Disclosure | Serialize-time null of `user_id`+scope UUIDs for non-owner readers. |
| `is_system` platform content trapped in the org gate (availability regression) | (availability) | Keep `is_system`/`is_global`-platform branches OUTSIDE the org gate (mig 109 FIX-A shape). |
| `X-Org-Id` header spoof to widen access | Spoofing / Elevation | Org derives from membership, never the header (164 asserts inert; 166 adds validated narrowing). |

## Sources

### Primary (HIGH confidence — live code + live DB)
- Live DB probe (venv psycopg2 @ :54322): pgvector `0.8.0`; `document_chunks` indexes (HNSW `m=16, ef_construction=64` cosine, GIN, btree org_id); `pg_proc` security flags for all four fns + `query_user_documents` (INVOKER, no search_path) + `current_user_org_ids`.
- `supabase/migrations/073` (`match_document_chunks` live body), `025` (`keyword_search_chunks` live body), `091` (`match_skills`), `019` (`folder_is_globally_visible`), `107` (org_id substrate), `108` (RLS membership rewrite — documents/folders/document_chunks policies), `109` (FIX-A platform-universal).
- `backend/app/dependencies.py` (`get_user_pg_connection`, `_apply_rls_user_context`, `get_user_supabase`, `get_service_role_supabase`), `services/retrieval_service.py`, `services/sql_service.py`, `api/kb.py`, `services/agent_loop.py` (match_skills @ :1307; ToolContext @ :2484), `services/tool_dispatcher.py`, `api/threads.py:736-855` (producer service-role handoff), `api/skills.py:196-219`, `services/document_view_service.py:70-110`, `utils/folder_utils.py`, `models/{folder,skill}.py`.
- `tests/integration/_rls_harness.py`, `test_163_factories.py`, `test_163_leak_asyncpg.py` (the two-org / both-GUC / red-then-green patterns to extend).
- `full-schema.sql:40` — `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public` (the search_path/operator finding).

### Secondary (MEDIUM confidence — verified against official sources)
- pgvector 0.8.0 iterative index scans (`hnsw.iterative_scan`, `relaxed_order`, `hnsw.max_scan_tuples`): [PostgreSQL news — pgvector 0.8.0](https://www.postgresql.org/about/news/pgvector-080-released-2952/), [pgEdge — Iterative Index Scans](https://docs.pgedge.com/pgvector/v0-8-0/iterative-index-scans/), [Supabase HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes), [AWS — pgvector 0.8.0 filtering](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/).
- Supabase `SET search_path = ''` recommendation + lint 0011: [Supabase — Function Search Path Mutable (splinter 0011)](https://supabase.github.io/splinter/0011_function_search_path_mutable/), [Supabase Database Functions docs](https://supabase.com/docs/guides/database/functions), [Supabase Database Advisors](https://supabase.com/docs/guides/database/database-advisors?lint=0011_function_search_path_mutable).

### Tertiary (context)
- Postgres GUC/`current_setting` unaffected by `SECURITY DEFINER` role switch — established Postgres semantics, corroborated by the 163 leak tests passing under this exact nested-SECDEF context (treated as A1 assumption, arbiter = live two-user DEFINER-call test).

## Metadata

**Confidence breakdown:**
- Standard stack / primitives: HIGH — every factory + DB object located in live code; no new packages.
- Architecture (the producer user-context realization): HIGH — `threads.py:747-749` + `dependencies.py` + `tool_dispatcher` confirm the service-role producer path directly; the asyncpg-uid-context is the shipped 163 mechanism.
- Function transforms: HIGH — live bodies read; the org-predicate shape mirrors the shipped mig-108/109 documents policy verbatim.
- pgvector perf: MEDIUM — version + indexes verified; the "no new recall cliff" claim rests on selectivity reasoning (A2) + must be benchmarked (`test_058_concurrency.py`).
- GUC-in-nested-SECDEF (A1): HIGH-reasoning / arbiter = live test — do not ship on docs alone (163-D-08 precedent).
- Pitfalls: HIGH — each traced to a concrete live-code or live-DB fact.

**Research date:** 2026-07-20
**Valid until:** ~2026-08-19 (30 days; stable DB stack — re-verify pgvector version + `pg_proc` flags if migrations land between now and planning).
