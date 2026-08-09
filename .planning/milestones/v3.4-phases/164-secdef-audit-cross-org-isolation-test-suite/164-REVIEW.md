---
phase: 164-secdef-audit-cross-org-isolation-test-suite
reviewed: 2026-07-20T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/110_secdef_org_scope_audit.sql
  - backend/app/services/retrieval_service.py
  - backend/app/services/sql_service.py
  - backend/app/api/kb.py
  - backend/app/services/agent_loop.py
  - backend/app/api/skills.py
  - backend/app/services/document_view_service.py
  - backend/app/utils/folder_utils.py
  - backend/app/api/folders.py
  - backend/app/models/folder.py
  - backend/app/models/skill.py
  - backend/tests/integration/test_v3_4_org_isolation.py
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 164: Code Review Report

**Reviewed:** 2026-07-20
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 164 is the v3.4 cross-org isolation exit gate. I reviewed migration 110 (the four `SECURITY DEFINER` functions + the widened `document_chunks` SELECT policy), the regex-deletion / client-swap in the retrieval + text-to-SQL + grep paths, the SEED-091 owner-nulling, and the exit-gate test suite, and I traced the retrieval / text-to-SQL / KB-tool call chains from the tool dispatcher down to the DB connection.

**What is correct (verified, not assumed):**

- **Migration 110 is well-formed and closes the classes it targets.** All three retrieval bodies AND the widened `document_chunks` SELECT policy carry the org predicate `org_id = ANY(SELECT public.current_user_org_ids())` **AND-ed** with the owner/folder-visibility branch. The owner branch keys on `auth.uid()`, never the caller-supplied `match_user_id`. `is_system` is the only branch OUTSIDE the org gate in `match_skills` (correct — universal platform escape), and the over-widening guard test proves user `is_global` stays *inside* the gate. `org_id IS NULL` fails closed (`NULL = ANY(...)` → excluded). Every identifier resolves under `search_path=''` (schema-qualified; `OPERATOR(public.<=>)`; text-search + jsonb operators live in pg_catalog which is always implicitly searched). No OR-where-AND, no null-org leak, no unqualified-identifier trap, no WITH-CHECK regression (110 re-CREATEs the *function* `match_skills`, not the skills-table badge-spoof policy from mig 109, which survives).
- **The client-swap is correct on the sensitive read paths.** `retrieval_service._call_as_user`, `sql_service.query_documents`, `kb.grep_path`'s content search, and `agent_loop`'s `match_skills` call all run over `get_user_pg_connection` (role `authenticated` + both GUC forms → `auth.uid()` resolves). On a service-role connection they fail closed (empty org set → 0 rows). `_inject_folder_scope` (relevance narrowing) is kept; the SELECT-only + no-`;` guard on `query_documents` survives; the `::text` casts keep RRF/enrich/dedup key-matching byte-compatible with the old PostgREST JSON.
- **The exit-gate assertions are non-vacuous.** The red-anchor spoofs `match_user_id = A` as user B and checks A's specific chunk ids are absent (not a raw 0-count); positive controls prove B sees its own row/chunk; the leak-conn RED demonstration proves the connection — not the deleted regex — is the gate.

**The blocker:** the org gate that mig 108 (RLS) and mig 110 (DEFINER) both enforce on folder/document visibility was **not** replicated in the Python folder-visibility helpers (`folder_utils.py`) that the agent's `ls` / `tree` / `glob` / `read_document` tools run on the **service-role (BYPASSRLS)** connection. Those tools therefore leak another org's `is_global` folders, document filenames, and full content — the exact property the exit gate claims to have eliminated, and a surface the exit-gate test does not exercise.

## Critical Issues

### CR-01: Cross-org leak via the agent's KB browse/read tools (service-role + org-agnostic Python folder visibility)

**File:** `backend/app/utils/folder_utils.py:18-34` (`is_in_global_subtree`), `:55-74` (`fetch_visible_folders`, `get_globally_visible_folder_ids`); consumed on the service-role client in `backend/app/api/kb.py:54-106` (`ls_path`), `:109-179` (`tree_path`), `:323-379` (`glob_path`), `:392-456` (`read_path`)

**Issue:**
Migration 108 org-scopes folder/document visibility in RLS — `folders` SELECT is `org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id OR public.folder_is_globally_visible(id))`, and `documents` SELECT mirrors it (108:114-117, 132-135). Migration 110 replicates the same org gate in the retrieval DEFINER bodies. But the **Python re-implementation** of folder visibility has no org predicate:

```python
# folder_utils.py
async def fetch_visible_folders(supabase, user_id):
    all_folders = await fetch_all_folders(supabase, fields="*")   # service-role → ALL folders, ALL orgs, no RLS
    ...
    return [f for f in all_folders
            if f["user_id"] == user_id or is_in_global_subtree(f["id"], folder_map, cache)]  # NO org check
```

`is_in_global_subtree` returns True for **any** folder in **any** org whose ancestry contains an `is_global=True` folder. In the agent (producer) tool path, `ctx.supabase` is the **service-role BYPASSRLS** client (`threads.py:750` injects `get_supabase()` into the producer; it flows into `RunContext.supabase` → `ToolContext.supabase`). So `fetch_all_folders` bypasses RLS entirely and the Python filter never re-imposes the org boundary.

Concrete exploit chain (reachable in the current single-member-org deployment — `toggle_global` is a live feature):
1. User A (org X) toggles a folder `is_global` (POST `/folders/{id}/toggle-global`).
2. User B (org Y, disjoint) chats; the agent calls `tree /`. `tree_path` → `fetch_visible_folders` returns A's `is_global` folder (cross-org), and the ls/tree global-doc fetch (`kb.py:92-98`, `:143-152`) does `supabase.table("documents").select(...).eq("folder_id", <A's folder>)` on the **service-role** client with no `user_id`/`org_id` filter → B's agent enumerates A's document ids + filenames.
3. The agent calls `read_document <A's doc id>`. `read_path` (`kb.py:412-421`) does `get_globally_visible_folder_ids(...)` (service-role, cross-org) then `.select("id, filename, full_markdown").eq("id", document_id).in_("folder_id", global_folder_ids)` → returns **A's full document content** cross-org.

This directly contradicts the invariant the phase ships and tests: `test_prag01_retrieval_isolation` asserts B never receives A's shared-folder chunk cross-org via retrieval, and `test_user_is_global_stays_org_scoped` asserts user `is_global` content stays org-scoped. Retrieval + RLS enforce it; the KB browse/read tools do not. **The exit-gate suite has a blind spot** — `test_v3_4_org_isolation.py` covers RLS, the four DEFINER functions, `query_user_documents`, and live retrieval, but never exercises `ls_path`/`tree_path`/`glob_path`/`read_path`, so it false-passes on this surface.

(Note: the HTTP endpoints `/kb/*` and `/folders` use the user-JWT client, so RLS org-scopes those. The leak is specific to the **agent tool path** running on service-role.)

**Fix:** Give the Python folder-visibility helpers the same org gate the RLS/DEFINER paths have, OR run these tools on a user-context connection. Minimal, targeted fix — thread the caller's org set into the visibility computation:

```python
# folder_utils.py — org-scope BOTH helpers so the service-role path matches RLS/DEFINER
async def fetch_visible_folders(supabase, user_id, org_ids: set[str]):
    all_folders = await fetch_all_folders(supabase, fields="*")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f for f in all_folders
        if f.get("org_id") in org_ids                      # org gate FIRST (mirrors mig 108)
        and (f["user_id"] == user_id or is_in_global_subtree(f["id"], folder_map, cache))
    ]

async def get_globally_visible_folder_ids(supabase, user_id, org_ids: set[str]):
    all_folders = await fetch_all_folders(supabase, fields="id, user_id, org_id, parent_id, is_global")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f["id"] for f in all_folders
        if f.get("org_id") in org_ids
        and f["user_id"] != user_id
        and is_in_global_subtree(f["id"], folder_map, cache)
    ]
```

Resolve `org_ids` from the caller's membership (the same `current_user_org_ids()` source), and add exit-gate rows that drive `ls_path`/`tree_path`/`glob_path`/`read_path` as user B against user A's `is_global` folder so this surface is covered. If browse-tool org-scoping is intentionally deferred to Phase 166/167, the exit gate must **explicitly document the exclusion** rather than claim "zero cross-org leakage" — but shipping a live full-content cross-org read via `read_document` should not be deferred.

## Warnings

### WR-01: SEED-091 owner-UUID nulling misses non-global descendants of a global folder (owner-identity leak on an un-nulled path)

**File:** `backend/app/utils/folder_utils.py:37-52` (`_null_foreign_global_owner`); reached via `backend/app/api/folders.py:11-20` (`list_folders`) and `:23-34` (`list_children`)

**Issue:**
`_null_foreign_global_owner` nulls the owner only when the row itself is `is_global`/`is_system`:

```python
if (row.get("is_global") or row.get("is_system")) and str(row.get("user_id")) != cid:
    row["user_id"] = None
```

But folder **visibility** is granted by subtree *ancestry* (`is_in_global_subtree` — a folder is visible if any ancestor is `is_global`). A subfolder created under a shared folder is `is_global=False` yet fully visible to non-owners. `_null_foreign_global_owner` skips it → `list_folders` / `list_children` (both `response_model=list[FolderResponse]`, whose `user_id` is nullable) return the **seeder's real UUID** for every non-global descendant of a shared folder. This defeats the exact SEED-091 / D-164-05 invariant the phase implements ("hide the seeding owner's identity from non-owner readers") on the descendant path. (The owner is not over-nulled — an owned row keeps its id, verified.)

**Fix:** Null the owner based on *visibility-as-non-owner*, not the per-row `is_global` flag. Since these rows already came from `fetch_visible_folders` (owned OR in a global subtree), a foreign `user_id` alone means it was disclosed via the global subtree:

```python
def _null_foreign_global_owner(rows, caller_id):
    cid = str(caller_id)
    for row in rows:
        # any row here that the caller does NOT own was reachable only via a global subtree →
        # its owner is a "seeding owner" and must be nulled (descendants included).
        if str(row.get("user_id")) != cid:
            row["user_id"] = None
    return rows
```

### WR-02: `_inject_folder_scope` produces invalid SQL after `_inject_user_id` deletion (folder-scoped `query_documents` breaks)

**File:** `backend/app/services/sql_service.py:30-46` (`_inject_folder_scope`), applied at `:73-74` in `query_documents`; called with `folder_ids=ctx.folder_subtree_ids` from `tool_dispatcher.py:755-759`

**Issue:**
Pre-164, `_inject_user_id` ran *first* and normalized WHERE placement — it inserted the `WHERE` *before* any trailing `ORDER BY` / `GROUP BY` / `LIMIT` / `HAVING`, so by the time `_inject_folder_scope` ran there was always a well-placed `WHERE` to `AND` onto. Phase 164 deleted `_inject_user_id` but `_inject_folder_scope` still assumes that normalization:

- Raw LLM SQL with a trailing clause and **no WHERE**, e.g. `SELECT filename FROM documents ORDER BY created_at DESC`, hits the `else` branch and returns `... ORDER BY created_at DESC WHERE documents.folder_id IN (...)` → **invalid SQL** (WHERE after ORDER BY) → `query_user_documents` errors → `RuntimeError("Database query failed")`.
- Raw SQL *with* a WHERE and a trailing `ORDER BY`, e.g. `... WHERE mime_type = 'application/pdf' ORDER BY created_at`, does `sql.rstrip() + " AND documents.folder_id IN (...)"` → `... ORDER BY created_at AND documents.folder_id IN (...)` → the folder filter binds to the ORDER BY expression (type error / silently not a filter).

Either way, **folder-scoped `query_documents` is broken** for any LLM query with trailing clauses. This is not a cross-org leak (RLS via the user-context connection still isolates the user's own org), but it breaks the Phase-098 GOV-01 folder-scope containment for the text-to-SQL tool in folder-scoped/workflow runs.

**Fix:** Restore WHERE-placement normalization inside `_inject_folder_scope` (insert `WHERE <cond>` before the first `ORDER BY|GROUP BY|LIMIT|HAVING` when no `WHERE` exists; when a `WHERE` exists, insert the `AND <cond>` before those trailing clauses rather than appending at the end):

```python
def _inject_folder_scope(sql: str, folder_ids: list[str]) -> str:
    if not folder_ids:
        return sql
    ids_list = ", ".join(f"'{fid}'" for fid in folder_ids)
    ... # compute `condition` as today
    tail = re.search(r"\b(order\s+by|group\s+by|limit|having)\b", sql, re.IGNORECASE)
    if re.search(r"\bwhere\b", sql, re.IGNORECASE):
        if tail:
            pos = tail.start()
            return sql[:pos] + f"AND {condition} " + sql[pos:]
        return sql.rstrip() + f" AND {condition}"
    if tail:
        pos = tail.start()
        return sql[:pos] + f"WHERE {condition} " + sql[pos:]
    return sql + f" WHERE {condition}"
```

## Info

### IN-01: `list_skill_files` reads `.data.get()` on a `maybe_single()` result without the list/dict guard used elsewhere

**File:** `backend/app/api/skills.py:704`

**Issue:** `str(skill.data.get("user_id")) != str(current_user["id"])` calls `.get` directly on the `.maybe_single()` result, while every other `maybe_single()` consumer in this file defends against client-version variance with `x.data[0] if isinstance(x.data, list) else x.data` (lines 528, 574, 792, 820). If a client version returns a single-element list here, this raises `AttributeError` → 500. Not a security issue (the nulling logic itself is correct), just an inconsistency.

**Fix:** Normalize first: `sd = skill.data[0] if isinstance(skill.data, list) else skill.data` then key off `sd`.

### IN-02: Badge-spoof audit only covers INSERT, not UPDATE

**File:** `backend/tests/integration/test_v3_4_org_isolation.py:692-717` (`test_badge_spoof_blocked`)

**Issue:** The test asserts an authenticated `INSERT ... is_system=true` is rejected (SQLSTATE 42501), but mig 109 also adds `AND (is_system = false)` to the skills **UPDATE** WITH CHECK (109:134-137). An authenticated `UPDATE ... SET is_system=true` is the equally-important escalation vector (it would make a skill universally readable via `match_skills`), and it is not asserted here. The guard exists in mig 109, so this is a coverage gap in the exit-gate audit rather than a live vuln.

**Fix:** Add an UPDATE leg: as an authenticated owner, `UPDATE public.skills SET is_system=true WHERE id=<own skill>` must raise 42501.

### IN-03: `match_user_id` is now a dead scoping parameter in three DEFINER functions

**File:** `supabase/migrations/110_secdef_org_scope_audit.sql:77` (`match_document_chunks`), `:116` (`keyword_search_chunks`), `:157` (`match_skills`)

**Issue:** `match_user_id` is retained in all three signatures for backward compatibility but is no longer read for scoping (the org gate keys on `auth.uid()` / `current_user_org_ids()`). This is intentional and documented, but a future caller could mistake it for an access-control key. Consider a `-- IGNORED: not a scoping key` comment at each parameter, or planning its removal in the Phase-165 rename migration.

**Fix:** Documentation-only; no behavior change required.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
