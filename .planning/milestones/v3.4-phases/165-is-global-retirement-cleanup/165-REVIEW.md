---
phase: 165-is-global-retirement-cleanup
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/utils/folder_utils.py
  - backend/app/api/kb.py
  - backend/app/services/tool_dispatcher.py
  - supabase/migrations/111_is_global_retirement_rename.sql
  - scripts/full-schema-supplement.sql
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 165: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This review is scoped (per the workflow's `<scope_note>`) to the logic-bearing parts of Phase
165, not the mechanical `is_global` → `is_org_shared`/`is_system_global` rename itself.

The good news first: the SEED-124 / CR-01 fix in `folder_utils.py` is sound. I traced
`_resolve_caller_org_ids` → `is_in_global_subtree` → `fetch_visible_folders` /
`get_globally_visible_folder_ids` by hand against several folder-tree shapes (owned, shared root,
shared ancestor with private descendants, missing/None `org_id`, empty membership) and every path
fails closed — an unresolvable or empty caller-org set yields zero non-owned visibility, never
over-share. The WR-01 owner-nulling fix in `kb.py` (`_null_foreign_global_owner` fed with
`get_globally_visible_folder_ids`'s full non-owned-visible set, not just the direct
`is_org_shared` row) is also correct on inspection — I walked a 3-level shared-ancestor chain and
every non-owned descendant gets nulled, not just the direct shared row. No off-by-one found in
either. The SEED-102 tie-break in `tool_dispatcher.py`'s `_handle_load_skill`
(`.order("is_system", desc=True).order("is_org_shared", desc=True)`) is verified against the
original fix (SEED-102 resolution notes) — direction unchanged, not inverted.

The bad news: going one level deeper than the scope note asked, I found that the **skill**
side of this phase has the exact same class of cross-org leak that CR-01 fixed for **folders**,
and it was not closed. `tool_dispatcher.py` resolves a skill by name on the BYPASSRLS service-role
producer client (`ctx.supabase = get_supabase()`, confirmed at `threads.py:32`) using
`.or_(user_id.eq.<uid>, is_org_shared.eq.true)` with **no `org_id` predicate**, at six call sites
(`load_skill`, `read_skill_file` ×2, `execute_code`'s skill-file injection ×2, `save_skill`'s
sibling-description lint). Every one of these lets a user in any org read another org's
`is_org_shared` skill by exact/guessed name. This is the identical vulnerability class as CR-01,
on the same producer BYPASSRLS seam, in a file this very phase touched (only the column name
changed under the rename) — Phase 165 had the opportunity and the stated remit to close it and did
not. Separately, the migration 111 storage-policy reconciliation for `skill-files` claims to
mirror the org-gated mig-109 `skill_files` table RLS shape but actually drops the org gate
entirely for the `is_org_shared` branch — a real, if narrower, over-widening gap in the exact area
the scope note asked me to scrutinize.

## Critical Issues

### CR-01: Cross-org skill disclosure via ungated `is_org_shared` reads in `tool_dispatcher.py`

**File:** `backend/app/services/tool_dispatcher.py:1149` (also `:1236`, `:1364`, `:1376`, `:1519`, `:1531`)
**Issue:**

Every skill-name-resolution query in this file scopes visibility with:

```python
.or_(f"user_id.eq.{ctx.current_user['id']},is_org_shared.eq.true")
```

`ctx.supabase` on this code path is the **service-role BYPASSRLS** client — confirmed by
`folder_utils.py`'s own CR-01 docstring ("The KB browse/read tools run in the producer on the
BYPASSRLS service-role client") and by `threads.py:32` ("`get_supabase` (kept) — STILL injected
on the send_message producer seam ONLY"). `ctx.supabase` is a single field on `ToolContext`; every
handler in this file shares the same client instance. Since RLS is bypassed, this `.or_(...)`
Python-level filter is the **entire** access-control gate for these reads — and it has no `org_id`
check at all. Contrast with the DB-level `match_skills` DEFINER function (mig 110/111), which
correctly gates the analogous branch: `s.org_id = ANY(SELECT public.current_user_org_ids()) AND
(s.user_id = auth.uid() OR s.is_org_shared = true)`. The exit-gate suite
(`test_v3_4_org_isolation.py`) exercises `match_skills` for exactly this org-gate — it never
exercises this raw-table path in `tool_dispatcher.py`, so the gap is untested.

Concretely: user A (org X) marks a skill `is_org_shared = true`. User B, in a **completely
unrelated org**, can call the agent's `load_skill("that-skill-name")` tool and receive the skill's
full `description` + `instructions` (and, via `read_skill_file`/`execute_code`'s skill-file
injection, its attached files) — no org relationship required, just the name. This is not a
"someday, once orgs get multiple members" issue (per mig 109's comment about the
personal-org topology) — it is exploitable **today**, cross-tenant, in the current single-user-org
world, because the gap is about *different orgs* seeing each other's shared content, not about
*co-members of one org* seeing it.

This is the same vulnerability class SEED-124/CR-01 closed for folders, on the same BYPASSRLS
producer seam, in a file this phase edited (the `is_global` → `is_org_shared` rename touches every
one of these six lines) — Phase 165's stated remit was exactly this class of bug.

**Fix:** Thread an org-id predicate into every one of these `.or_` queries, mirroring
`match_skills`'/mig-109's shape. Since `ctx.supabase` is BYPASSRLS, the org set must be resolved
Python-side (the same `_resolve_caller_org_ids` pattern CR-01 already established in
`folder_utils.py`) and applied here, e.g.:

```python
caller_org_ids = await _resolve_caller_org_ids(ctx.supabase, ctx.current_user["id"])  # reuse folder_utils helper (or a skills-scoped twin)
_skill_resp = await aexec(
    ctx.supabase.table("skills")
    .select("id, name, description, instructions, user_id, org_id")
    .eq("name", skill_name)
    .eq("is_enabled", True)
    .or_(
        f"user_id.eq.{ctx.current_user['id']},"
        f"is_system.eq.true,"
        f"and(is_org_shared.eq.true,org_id.in.({','.join(caller_org_ids)}))"
    )
    .order("is_system", desc=True).order("is_org_shared", desc=True)
)
```

(Exact PostgREST `.or_`/`.in_` syntax needs verifying against the supabase-py version in use — the
key requirement is that the `is_org_shared` branch is `AND`-gated on `org_id ∈ caller_org_ids`,
while `is_system` stays the universal escape, matching `match_skills`.) Apply the same fix to all
six call sites; consider extracting one shared helper (e.g. `_resolve_visible_skill(...)`) so the
gate can't drift between call sites the way it already has.

### CR-02: Storage policy for `skill-files` drops the org gate it claims to add — over-widening

**File:** `supabase/migrations/111_is_global_retirement_rename.sql:300-312`, `scripts/full-schema-supplement.sql:83-95`
**Issue:**

Migration 111 §3 rewrites the `skill-files` storage read policy and its own comment claims this
"reconcile[s] it to the mig-109 `skill_files` table-RLS shape". It does not. The actual mig-109
table policy for `skill_files` (verified in `109_platform_universal_rls_fix.sql:76-84`) gates the
shared branch by org:

```sql
OR (org_id IN (SELECT public.current_user_org_ids())
    AND ((auth.uid() = user_id) OR (EXISTS (...skills.is_global = true...))))
```

but the storage policy 111 creates has no such gate at all:

```sql
WHERE sf.file_path = name AND (s.is_system = true OR s.is_org_shared = true)
```

The `is_system` branch is correctly universal (matches the table shape — fine). But the
`is_org_shared` branch here is a bare flag check with **no `org_id` predicate**, unlike its
table-RLS counterpart. This is not a regression Phase 165 introduced from scratch (the pre-165
policy was equally org-blind: `git show 41822727` shows the prior body was
`s.is_global = true`, also ungated) — but Phase 165's own migration explicitly claims to have
closed this gap ("reconciled to the mig-109 ... shape") when it has not, and the phase had the
exact scope and precedent (CR-01's folder fix, in this same phase) to do so.

Practical exploitability: this policy only matters for a caller hitting Supabase Storage directly
with their own JWT (any backend route in this codebase either uses the service-role client,
which bypasses this policy anyway, or owner-scopes the read at the application layer, e.g.
`skills.py:802 export_skill`). No first-party UI path in this repo currently drives this branch.
But Supabase Storage's REST API is directly reachable by any authenticated user's bearer token
independent of the FastAPI backend, and this RLS policy is the *only* enforcement on that path —
an attacker who obtains or infers a cross-org skill's storage path (`{owner_uid}/{skill_id}/
{filename}`, e.g., leaked via logs, a future feature, or export-metadata) can download the file
bytes directly regardless of org membership.

**Fix:** Add the same org gate the table policy has:

```sql
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name
          AND (
            s.is_system = true
            OR (s.org_id IN (SELECT public.current_user_org_ids()) AND s.is_org_shared = true)
          )
      )
    )
  );
```

Mirror the same fix into `scripts/full-schema-supplement.sql` (same-commit rule per CLAUDE.md's
bootstrap-parity discipline) so a greenfield paste doesn't regress. This should ship as a new
migration (112), not a hand-edit of 111 (111 has already been applied to the live local DB per
`165-10-SUMMARY.md`).

## Warnings

### WR-01: `is_in_global_subtree` has no cycle guard

**File:** `backend/app/utils/folder_utils.py:60-76`
**Issue:** `is_in_global_subtree` recurses up the `parent_id` chain with a memo cache keyed by
`folder_id`, but the cache only prevents re-computation of an *already-resolved* node — it does
not detect a cycle while a resolution is still in flight (nothing marks a node as "currently being
visited"). If a data-integrity bug elsewhere ever let a folder's `parent_id` chain loop back on
itself (e.g., a future re-parenting feature without a cycle check, or a manual DB edit), this
function recurses infinitely and crashes the request (`RecursionError`, or a hang before Python's
recursion limit is hit relative to CPU). This is a pre-existing shape (not introduced by 165's org
gate), but it is directly in the file with heaviest security weight in this phase, and a defensive
visited-set costs nothing:

**Fix:**
```python
def is_in_global_subtree(folder_id, folder_map, cache=None, caller_org_ids=None, _visiting=None):
    if cache is None:
        cache = {}
    if caller_org_ids is None:
        caller_org_ids = set()
    if _visiting is None:
        _visiting = set()
    if folder_id in cache:
        return cache[folder_id]
    if folder_id in _visiting:          # cycle guard
        cache[folder_id] = False
        return False
    _visiting.add(folder_id)
    f = folder_map.get(folder_id)
    ...
```

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
