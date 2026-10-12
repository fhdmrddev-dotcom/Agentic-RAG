---
phase: 275-retention-legal-hold
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - supabase/migrations/204_retention_and_legal_hold.sql
  - supabase/migrations/205_retrievable_predicate.sql
  - scripts/full-schema-supplement.sql
  - backend/app/services/retention/__init__.py
  - backend/app/services/retention/agent_wall.py
  - backend/app/services/retention/disposition.py
  - backend/app/services/retention/evaluate.py
  - backend/app/services/retention/hold_guard.py
  - backend/app/services/retention/load.py
  - backend/app/services/retention/periods.py
  - backend/app/services/retention/sweep_service.py
  - backend/app/db/retention.py
  - backend/app/api/retention.py
  - backend/app/models/retention.py
  - backend/app/api/documents.py
  - backend/app/api/folders.py
  - backend/app/api/kb.py
  - backend/app/api/sources.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/document_view_resolver.py
  - backend/app/services/document_relationship_service.py
  - backend/app/services/document_search_service.py
  - backend/app/services/retrieval_documents.py
  - backend/app/services/retrieval_scope.py
  - backend/app/services/expert_scope.py
  - backend/app/services/audit_service.py
  - backend/app/models/document.py
  - backend/app/models/document_search.py
  - backend/app/config.py
  - backend/app/main.py
  - scripts/build-public-openapi.cjs
  - backend/app/services/sql_service.py (call-chain context only)
findings:
  critical: 3
  warning: 7
  info: 6
  total: 16
status: issues_found
---

# Phase 275: Code Review Report (backend + migrations)

**Reviewed:** 2026-10-12
**Depth:** standard (phase diff `b41d51d6b..HEAD` for shared files, full read for new modules)
**Files Reviewed:** 32
**Status:** issues_found

## Summary

I reviewed the retention and legal-hold backend: migrations 204/205, the retention service package, the `/retention` router and the six delete doors.

Most of the design holds up when traced through the code:

- No automatic delete exists. The sweep only archives and queues, and `confirm_batch` is the single `DELETE FROM public.documents`.
- The evaluator fails closed on collision, no date and a policy that was not previewed.
- Every write route depends on `require_org_manage`. Every service-pool statement binds `org_id`.
- Matter names reach members through none of the paths I traced (API payloads, refusal sentences, trigger error text, RLS).
- Both RPC arms, `query_user_documents`, `read_document`, `analyze_document`, `query_tables`, the listing tools and Expert scope all carry the `retrievable` predicate.
- All new SECURITY DEFINER functions pin `search_path` to `''`, revoke EXECUTE from `PUBLIC` and have RLS on every new table.

Three blockers remain, all in the hold's reach (D-14 / D-16):

1. **A document owner can take a held document out of the hold** by renaming a version, or by moving its `org_id` to another org they belong to, through plain PostgREST. They can then delete it.
2. **The owner can delete a held document's file bytes directly** through the Supabase Storage API. Nothing in the phase guards `storage.objects`.
3. **Migration 204's coverage trigger makes deleting an auth user fail permanently** for any admin who ever added coverage to a hold that was later released.

The seven warnings cover:

- A member-triggerable failure that stops the whole org's retention: one out-of-range date makes the evaluator raise.
- A new version that escapes archive.
- A folder delete that is not all-or-nothing and can claim "Nothing was deleted" falsely.
- File bytes orphaned after a partly failed confirm.
- A re-keyed family deleted without the full re-check.
- New blocking supabase-py calls inside async handlers.

All findings were derived by tracing the SQL and Python paths named below. None was driven against a live DB: every reproduction needs writes, and the local DB is shared. The RI-fires-row-triggers behaviour that CR-03 depends on is the same behaviour migration 204's own header records as measured for `documents_folder_id_fkey`.

## Critical Issues

### CR-01: An owner can strip a document out of its legal hold with one PostgREST UPDATE, then delete it (D-14 / D-16 bypass)

**File:** `supabase/migrations/204_retention_and_legal_hold.sql:267-295`, `:340-355`; the pre-existing policy `"Users can update their own documents"` (full-schema.sql:8194)

**Issue:** "Held" is computed from mutable columns of the document being deleted:

- **(a), family coverage:** joins `fam.org_id = t.org_id AND fam.user_id = t.user_id AND fam.filename = t.filename`, then requires `h.org_id = t.org_id`.
- **(b), folder coverage:** requires `h.org_id = t.org_id`.
- **The trigger's fast path:** probes `legal_holds WHERE org_id = OLD.org_id`.

The owner's UPDATE policy has no `WITH CHECK` and no column grant restrictions, so the `USING` clause is the check: `org_id IN current_user_org_ids() AND auth.uid() = user_id`. The owner may therefore change both `filename` and `org_id`. No trigger pins either column: only `documents_autofill_org_id` (INSERT) and the archive and folder triggers exist.

**Path 1: rename. Single org, any member who owns the document.**

1. A hold is placed on the latest version v2. v1 is covered only through the family join (D-16: "The hold covers every version").
2. `PATCH /rest/v1/documents?id=eq.<v1>` with body `{"filename":"x"}`. The UPDATE succeeds.
3. `DELETE /documents/<v1>?scope=version`.
4. `assert_none_held([v1])` finds no family match and no folder hold, so the row is deleted. `documents.py:1883` then removes the bytes.

**Path 2: org move. An owner in two orgs; the dev account is in two orgs.**

1. `PATCH /rest/v1/documents?id=eq.<held>` with body `{"org_id":"<orgB>"}`.
2. Delete the document. The fast path finds no active hold in org B, so the trigger returns OLD and the row is deleted. This defeats folder holds too.

The same move also breaks `documents_sticky_hold_on_move`. It inserts coverage under `OLD.org_id`, but the document then lives in another org, and `h.org_id = t.org_id` never matches again.

**Fix:**
1. Make the row (the thing a hold names) the anchor, not the row's current org. In (a)/(b), join holds on `h.org_id = lhd.org_id` / `h.org_id = lhf.org_id` rather than `t.org_id`. In the delete trigger, drop the `OLD.org_id` fast path, or widen it to "any active hold covering this id".
2. Refuse identity changes on held rows, for every role:
```sql
CREATE OR REPLACE FUNCTION public.documents_refuse_held_rekey() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_documents(ARRAY[OLD.id])) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document % is on legal hold', OLD.id USING ERRCODE = 'PT409';
END $$;
CREATE TRIGGER documents_refuse_held_rekey BEFORE UPDATE OF org_id, user_id, filename ON public.documents
  FOR EACH ROW WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id OR OLD.user_id IS DISTINCT FROM NEW.user_id
                     OR OLD.filename IS DISTINCT FROM NEW.filename)
  EXECUTE FUNCTION public.documents_refuse_held_rekey();
```
   Alternatively, materialise every family row into `legal_hold_documents` when the hold is placed, and keep it sticky on rename.
3. Add a test per path: rename-then-delete and org-move-then-delete, each refused.

### CR-02: A held document's file bytes can be deleted by its owner through the Storage API

**File:** pre-existing `storage.objects` policy `"Users can delete own documents"` (full-schema.sql:9754-9756); no phase-275 guard on `storage.objects`

**Issue:** The policy allows `DELETE` for `bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text`. Every document's bytes live at `{user_id}/{document_id}/{filename}` (`ingest_splice.py:275`), so the owner of a held document can call `DELETE /storage/v1/object/documents/<file_path>` with their own JWT. The anon key and JWT are in the browser.

That call never touches `public.documents`, so neither the BEFORE DELETE trigger nor `hold_guard` sees it. The row survives and the evidence (the original file) is gone.

D-38's careful "hold, then rows, then bytes" ordering in every app door is moot while this door stays open. The caller's priority #1 names file bytes explicitly. The same owner can also `DELETE` their `document_chunks` / `document_tables` / `document_images` rows (policies at :7928, :8096, :8103). Those are re-derivable from the bytes, which is why the bytes are the blocker.

**Fix:** Refuse a user-JWT delete of an object that still backs a document row, so bytes can only be removed after the row (which the hold trigger guards):
```sql
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents'
         AND (storage.foldername(name))[1] = (select auth.uid()::text)
         AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.file_path = storage.objects.name));
```
The app doors already delete the row first (D-38), so they keep working. Alternatively, add a BEFORE DELETE trigger on `storage.objects` for `bucket_id = 'documents'` that calls `retention_held_documents` on the row whose `file_path = OLD.name`; that also covers the service role. Then add a test: delete a held document's object through the user-JWT Storage API, expect refusal, and confirm the bytes are intact.

### CR-03: Deleting an auth user fails forever if they ever added coverage to a hold that was later released

**File:** `supabase/migrations/204_retention_and_legal_hold.sql:149`, `:159`, `:554-582`

**Issue:** The `added_by` column on `legal_hold_documents` and on `legal_hold_folders` references `auth.users ON DELETE SET NULL`. A SET NULL referential action is an UPDATE on the referencing table, and it fires that table's row triggers. Migration 204's own header records this behaviour as measured for `documents_folder_id_fkey`.

`legal_hold_coverage_same_org` is `BEFORE INSERT OR UPDATE` with no column list. On that UPDATE it re-checks `h.released_at IS NULL`. For a released hold the check is false, so it falls through to `RAISE … check_violation`, and the whole `DELETE FROM auth.users` rolls back.

Consequences:
- Every admin who ever placed or extended a hold that has since been released can never be deleted.
- This includes GDPR erasure of a departed admin.
- The only remedy is a superuser disabling the trigger.

D-14 accepted that user deletion fails only "until the hold is released". This failure is permanent, and it starts exactly when the hold is released. The same happens if the covered document's `org_id` later changes (CR-01).

**Fix:** Validate only what the trigger exists for, on INSERT or a change of the coverage key:
```sql
CREATE TRIGGER legal_hold_documents_same_org BEFORE INSERT OR UPDATE OF hold_id, document_id, org_id
    ON public.legal_hold_documents FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();
CREATE TRIGGER legal_hold_folders_same_org BEFORE INSERT OR UPDATE OF hold_id, folder_id, org_id
    ON public.legal_hold_folders FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();
```
Add an integration test: place a hold with a real `added_by`, release it, delete that auth user, and expect success with `added_by` NULL.

## Warnings

### WR-01: One out-of-range date makes the evaluator raise, stopping retention for the whole org (member-triggerable)

**File:** `backend/app/services/retention/evaluate.py:373-374`, `backend/app/services/retention/periods.py:31-44`, `backend/app/services/retention/load.py:199-200`

**Issue:** `periods.py`'s docstring says "the evaluator turns the error into an undecidable decision". It does not: `evaluate()` calls `add_period` with no try. `date_typed` comes from `view_iso_to_date(metadata->>'date')`, which accepts `9999-12-31`. Any member can set that metadata on a document they own under a class or folder policy (D-16 allows metadata edits). Then:
- `d + timedelta(days=…)` raises `OverflowError`.
- `_add_months` on year 10000 raises `ValueError`.

Every caller that evaluates every family then fails:
- `run_org_sweep` fails every night, so nothing is archived for anyone.
- `GET /retention/policies` returns 500.
- `GET /retention/queue` returns 500.
- `POST /retention/policies/preview` returns 500, so **no policy in the org can be created or edited** (Save needs a preview).

A second trigger has the same effect: a two-org owner points a document's `folder_id` at a folder in another org. `load.py:199` then raises `IncompleteEvaluation` for the whole org on every read. Nothing is deleted in either case (fail closed), but one member can stop the feature org-wide indefinitely.

**Fix:**
1. Wrap the due-date computation in `evaluate`:
```python
try:
    due1 = add_period(clock, p.stage1.value, p.stage1.unit)
    due2 = add_period(clock, p.stage2.value, p.stage2.unit) if p.stage2 is not None else None
except (ValueError, OverflowError):
    return decide("no_date", rule_text=text, policy_revision=p.revision, why="the date can't be used")
```
2. For a document whose folder sits in another org, mark that family undecidable rather than failing the whole snapshot. Or refuse the cross-org `folder_id` with a trigger.
3. Cap `stage*_value` in years to a sane bound in `PolicyDraft`.

### WR-02: A new version uploaded into an archived family is never archived, and is served to agents while the Library chip says "Archived"

**File:** `backend/app/services/retention/load.py:268-279`, `backend/app/services/retention/evaluate.py:375`, `:394-397`

**Issue:** `FamilyFacts.archived_at` is the latest row's value, falling back to any archived row. Take a stage-1 archive policy where v1 is archived and the user uploads v2 (`archived_at` NULL, `is_latest` true). The family reads as archived, so `evaluate` returns `already_archived`, and the sweep's `UPDATE … archived_at IS NULL` never runs for v2.

Both RPCs filter `d.is_latest = true AND d.retrievable`, so v2 is fully searchable and readable. Meanwhile `_document_state` reports `chip = "archived"`. This breaks D-25 (versions archive together) and D-18 (archived content leaves every agent path), and the UI states the opposite of the truth. Stage-2 policies are unaffected, because the delete re-queues.

**Fix:** Derive `archived` from the latest row only, so the family re-archives on the next sweep:
```python
archived_at=latest.get("archived_at"),
```
Alternatively, add a decision "partially archived" that the sweep turns into an archive of the remaining rows. Add a test: archive v1, splice v2, run the sweep, and expect v2 archived.

### WR-03: Folder delete is not all-or-nothing, and its refusal can say "Nothing was deleted" after documents were deleted

**File:** `backend/app/api/folders.py:186-191`

**Issue:** D-15 requires all-or-nothing. The route issues two separate PostgREST statements: delete documents, then delete the folder. The pre-check uses only folder ids the caller can read through RLS (the BFS). The `folders_refuse_held_delete` trigger fires on every cascaded child, including subfolders the caller cannot see.

So the document DELETE can succeed while the folder DELETE is refused. That happens when a hold is placed between the check and the delete, or when the held item is a subfolder outside the caller's view. `map_hold_refusal(kind="folder")` then returns 409 "This folder is on legal hold. Nothing was deleted." In fact the caller's documents and their chunks are already gone. The file bytes survive only because step 5 is skipped.

**Fix:** Run the document delete and the folder delete in one transaction on the user-context connection (`get_user_pg_connection`) and re-check holds inside it. Either both statements commit or both roll back. Delete bytes only after the commit.

### WR-04: A partly failed confirm leaves the bytes of already-deleted documents in storage with no record

**File:** `backend/app/services/retention/disposition.py:454-482`

**Issue:** Each family deletes in its own transaction, and `paths` are removed only after the loop. Suppose a later family raises a non-PT409 error: an `asyncpg` connection or serialization error, or WR-01's overflow inside `evaluate` at `:491`. Then `confirm_batch` propagates, earlier families are committed with `deleted` receipts, and their bytes are never removed. The route returns 500, so the admin believes nothing happened, and the `retention.disposition.confirm` audit row is not written.

Storage failures are only logged (`:479-480`). The receipt carries no `file_path`, so nothing can retry the cleanup. D-12 says a confirmed delete removes the file bytes. Here customer data that an admin approved for deletion can persist indefinitely.

**Fix:**
1. Wrap the per-family loop in `try/finally` so the byte removal always runs for committed families.
2. Record each family's `file_paths` in the `deleted` receipt's `detail`, so a failed removal can be found and retried.
3. Surface a partial result (HTTP 207, or the `ConfirmOut` with an `errors` list) instead of a bare 500.

### WR-05: The confirm re-check for a family missing from the snapshot can delete rows that were never proposed, and skips the D-34 check

**File:** `backend/app/services/retention/disposition.py:487-549`

**Issue:** When `snap.family(qrow["family_key"])` is `None`, the evaluator re-check (private, collision, not-previewed, decision still pending) is skipped entirely. The in-transaction check then re-derives the family from the head row's current `(user_id, filename, folder_id)`. It compares only the policy revision and a fingerprint, and the fingerprint (`latest|clock|folder|type`) does not include `filename`.

Scenario:
1. The queued document X is renamed (via PostgREST, see CR-01) to a filename that already exists in the same folder.
2. X stays the highest version, so `fp_now` still equals the queued fingerprint.
3. `DELETE … id = ANY(ids)` removes every row of the *other* family as well. None of those rows was evaluated, shown in the batch, or counted in the typed count.

**Fix:** Treat `fam is None` as `did_not_delete` with reason `"changed"`. Alternatively, include the family key (or the filename) in the fingerprint, and refuse when the in-transaction family's ids differ from `fam.row_ids`:
```python
if fam is None:
    await _did_not_delete(pool, org, p, qrow, name, "changed", None, actor_id, actor_name, out)
    return
...
if set(map(str, ids)) != set(fam.row_ids):
    # family membership changed since the snapshot
```

### WR-06: New blocking supabase-py calls inside async handlers (D-v2.5-01)

**File:** `backend/app/api/folders.py:160-167` (new), `:188-191`; `backend/app/api/documents.py:1860-1883` (rewritten by this phase)

**Issue:** CLAUDE.md requires blocking supabase-py calls in async handlers to go through `run_in_threadpool`. Several calls in the phase diff run synchronously on the event loop:
- The new `folder_resp = supabase.table("folders")…maybe_single().execute()` in folders.py.
- The re-ordered `documents` deletes in folders.py and documents.py.
- The storage `.remove()` loops in both files.

A slow PostgREST or Storage call stalls every request on that uvicorn worker. The phase rewrote these lines, so they are in its scope. `sources.py` in the same diff does it correctly.

**Fix:** Wrap each call with `await run_in_threadpool(lambda: …execute())`, or with `aexec(...)`, which `hold_guard` already uses.

### WR-07: `confirm_batch` archives a review row without the revision or fingerprint re-check

**File:** `backend/app/services/retention/disposition.py:606-629`

**Issue:** `_confirm_delete` re-checks the policy revision and the fingerprint. `_confirm_archive` does not: it re-checks only "held", then archives the family. A policy edit does not purge `retention_queue`; only the next nightly sweep withdraws stale rows. Meanwhile an admin's "Archive" on a review row archives a family under a rule that may no longer apply. The case covers a family that is no longer due, has moved or become private, or whose type changed. Archiving is reversible, but SC#3's "exactly" is not met.

**Fix:** Apply the same in-transaction revision, fingerprint and visibility check as `_confirm_delete`. On a mismatch, drop the queue row with a receipt.

## Info

### IN-01: `document_is_retrievable` is an existence oracle across orgs

**File:** `supabase/migrations/205_retrievable_predicate.sql:252-264`

**Issue:** The function is SECURITY DEFINER and granted to `authenticated`, and it checks neither org nor visibility. Any user can learn, for any document UUID, whether it exists and whether it is retrievable. UUIDs are unguessable, so the impact is low.

**Fix:** Add `AND d.org_id IN (SELECT public.current_user_org_ids())`. This is still fail closed.

### IN-02: A direct PostgREST insert can forge hold attribution

**File:** `supabase/migrations/204_retention_and_legal_hold.sql:627`, `:694-701`

**Issue:** An org admin's direct `INSERT` into `legal_holds` can set `created_by` / `created_by_name` to anyone. The admin hold line ("placed by {placed_by}") would then show the forged name.

**Fix:** In `legal_holds_protect_columns`, force `created_by = auth.uid()` for JWT roles, or stop granting INSERT to `authenticated` and write through the service pool.

### IN-03: The race-path refusal always shows admins the member sentence

**File:** `backend/app/api/documents.py:1861`, `:1878`; `backend/app/api/folders.py:189`, `:191`

**Issue:** `map_hold_refusal(kind=…)` is called with the default `can_manage=False`, so an admin who hits the trigger path sees "Ask an org admin". This is not a leak.

**Fix:** None proposed.

### IN-04: `get_related_documents(retrievable_only=True)` still resolves an archived subject

**File:** `backend/app/services/document_relationship_service.py:385-395`

**Issue:** With `retrievable_only=True` an archived *subject* still resolves, so the agent learns the archived document's relationships (the archived endpoints are filtered). This is minor drift from D-18.

**Fix:** Return `None` when `subject.get(RETRIEVABLE_COLUMN) is False` and `retrievable_only` is set.

### IN-05: `extend_hold` returns 500 when it races a release

**File:** `backend/app/api/retention.py:498-507`

**Issue:** If the hold is released between `get_hold` and the coverage insert, the coverage trigger raises `check_violation` and the route returns 500 instead of a 409 sentence.

**Fix:** Catch the `check_violation` and return the 409 sentence.

### IN-06: The `query_user_documents` denylist refuses legitimate grep patterns

**File:** `supabase/migrations/205_retrievable_predicate.sql:226`

**Issue:** The denylist also rejects grep patterns that merely contain those words, because `grep_path` interpolates the pattern into the SQL text. For example, searching documents for "ts_stat" or "set_config" fails with "Query may not read or change session settings". This is cosmetic, and it is the right trade.

**Fix:** Optionally map the error to a readable grep message.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
