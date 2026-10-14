---
phase: 280-in-once-out-clean
reviewed: 2026-10-14T00:00:00Z
depth: standard
diff_base: 2dd80abbe
files_reviewed: 26
files_reviewed_list:
  - backend/app/services/ingest_splice.py
  - backend/app/services/document_purge.py
  - backend/app/api/sources.py
  - backend/app/api/documents.py
  - backend/app/api/folders.py
  - backend/app/api/skills.py
  - backend/app/api/takeoff.py
  - backend/app/main.py
  - backend/app/models/document.py
  - backend/app/services/retention/disposition.py
  - backend/app/services/sources/adapters/microsoft_graph.py
  - backend/app/utils/db.py
  - backend/tests/integration/test_280_cr01_two_org_live.py
  - backend/tests/integration/test_280_purge_bytes_live.py
  - backend/tests/integration/test_280_same_bytes_live.py
  - backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py
  - backend/tests/unit/test_266_mint_org_scope.py
  - backend/tests/unit/test_274_promote_preview_parity.py
  - backend/tests/unit/test_275_delete_paths.py
  - backend/tests/unit/test_280_delete_404.py
  - backend/tests/unit/test_280_maybe_row_fence.py
  - backend/tests/unit/test_280_minter_sequence.py
  - backend/tests/unit/test_280_purge_bytes.py
  - backend/tests/unit/test_document_versioning.py
  - backend/tests/unit/test_ingest_splice.py
  - frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 280: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** standard (changes since `2dd80abbe` only)
**Files Reviewed:** 26
**Status:** issues_found

## Summary

I reviewed the phase diff for the minter (`mint_document_row`: in-flight leg, insert-then-retire,
23505 → winner, the CR-01 folder/org check), the shared purge helper (`document_purge.py`), the
`maybe_row` sweep, the dead-patch removal, and the Graph `_item_segment` encoding.

**What I checked and found to hold.** I verified each of these against the code and installed
libraries, not against comments:

- **D-30.** The `main.py` patch really was dead. In postgrest 2.29.0,
  `SyncMaybeSingleRequestBuilder` is not a subclass of `SyncSingleRequestBuilder`. On 0 rows it
  returns `None`, and `generate_default_error_message` sets `code` to the **int** status, so
  `== "204"` could never match.
- **The `maybe_row` fence.** I wrote my own AST pass over `backend/app`. No `maybe_single()` site
  sits in a statement shape the fence skips (tuple targets, attribute targets, `with`, walrus):
  every site is an `Assign` to a Name, an `AnnAssign`, or a `Return`. All 142 phase-touched unit
  tests pass locally.
- **Purge helper ordering.** The order is guard → rows → bytes. The paths come from the DELETE's
  own returned rows. The guard is reached through the module attribute.
- **The storage remove runs under the user's JWT.** supabase-py 2.29 keeps the caller's
  `Authorization` header (`_get_auth_headers` reads `options.headers` first), so mig 206's
  owner-path DELETE policy applies.
- **The CR-01 user-JWT path is not an existence oracle.** `folders` SELECT RLS already hides a
  folder in a non-member org, so it is the same 0-row miss → 404.
- **`_item_segment`.** `quote(id, safe="!")` encodes `/ ? # % &`. `None` and `""` never reach it
  from `_children_url` because they are in `VIRTUAL_ROOT_IDS`.

**What does not hold, or holds only partly.**

- The in-flight leg is narrower than the index it races (`is_latest`). That reintroduces the
  "check narrower than constraint" pattern this file's own BUG-260905-02 note warns against.
- "Brief window of two latest rows" is actually permanent when two new versions race.
- The purge doors now also delete the bytes of documents that a watch item only *linked to* via
  dedup, and D-24 widens which documents get linked that way.
- A stuck `pending` row now absorbs every re-upload.
- The CR-01 "identical 404" claim does not cover the service-role watch path.
- The live race tests cannot show which branch resolved the race.

No BLOCKER is proven. I did not run the live integration tests, to avoid mutating the shared local
DB.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The in-flight leg is narrower than `documents_dedup_idx`, so a 23505 still resolves to a RETIRED row

**File:** `backend/app/services/ingest_splice.py:302-320` and `:394-415`

**Issue:** The in-flight leg filters `.eq("is_latest", True)`, but the index it races
(`documents_dedup_idx … WHERE status <> 'failed'`) has no `is_latest` predicate. Traced sequence,
all in one folder:

1. Upload bytes A as `x.pdf`. v1 is still `pending`.
2. Upload bytes B as `x.pdf`. v2 inserts, and v1 is retired after the insert (`is_latest=false`,
   still `pending`).
3. Upload bytes A again:
   - The completed leg misses, because v1 is not completed.
   - The in-flight leg misses, because v1 is not latest.
   - The versioning step computes v3, and the INSERT hits 23505 on v1.
   - The re-query (no `is_latest` filter) returns retired v1, and `/upload` answers 200
     `already_in_library: true`.

The person's intent ("make A current again") is silently dropped, and the returned document is not
retrievable (retrieval requires `is_latest`). D-02 says a 23505 resolves to the winner and is
"never a retired row".

This is the BUG-260905-02 shape the file documents at `:238` ("A CHECK THAT IS NARROWER THAN ITS
CONSTRAINT DOES NOT PREVENT THE ERROR, IT ONLY DELAYS IT"). The completed leg has the same issue for
retired completed copies; that part pre-dates 280.

**Fix:** Pick one behaviour on purpose. One option is to drop `is_latest` from the in-flight leg so
it matches the index predicate. The other is, when the winner is `is_latest = false`, to re-promote
it (or return a distinct outcome) rather than reporting it as the live copy. Pin either choice with
a fake-DB case that runs steps 1-3 above.

### WR-02: Two concurrent new versions leave TWO `is_latest` rows permanently, not for "a brief window"

**File:** `backend/app/services/ingest_splice.py:424-447`

**Issue:** When two different-bytes uploads of the same filename race, both read `max=1`, both
insert `version_number=2`, and both retire `lt("version_number", 2)` (only v1). Neither ever
retires the other. Nothing reconciles this until a v3 arrives, so two `is_latest` rows with the
same version number stay **indefinitely**. Retrieval then serves both, and the version list shows
two v2 rows.

The comment at `:428-430` and D-03 call this "a brief window ... accepted". The live test
`test_two_concurrent_new_versions_never_leave_zero_latest` asserts only `latest` is non-empty, so
it passes in this state. The pre-280 code had the same end state, so this is not a regression. The
problem is that the recorded contract is false.

**Fix:** Correct the comment and the decision text to "persistent until the next version". Then
either add a tie-break (for example, after the retire, if another row with the same
`version_number` and a later `created_at` is latest, retire self), or explicitly record the
residual as owed, the way D-24's residual is recorded.

### WR-03: The purge doors now delete rows AND bytes of a document a watch item only linked to through dedup, and D-24 widens that set

**File:** `backend/app/services/document_purge.py:55-75`, `backend/app/api/sources.py:330-341`, `:470-481`

**Issue:** `watch_service` records `mint_res.document["id"]` into `connector_watch_items` even when
`is_duplicate` is true (`watch_service.py` new-file arm: "Duplicate in folder: link into watch
items").

With the new folder-agnostic in-flight leg, consider a watch syncing a file whose bytes match the
person's own `/upload` that is still in flight in another folder. The watch item now links to
**that manual upload**. Both purge doors pass every linked `document_id` to `purge_documents`,
which deletes the row and, as of this phase, its stored file.

Before 280, the in-flight-in-another-folder case minted the watch's own copy. Completed duplicates
already had this problem, so the class is pre-existing, but D-24 widens it and DEBT-10 makes it
remove bytes as well. "Purge this watch's documents" can therefore delete a document the person
uploaded by hand.

**Fix:** Restrict the purge set to documents the watch actually minted. For example, filter
`doc_ids` to rows whose `source_connection_id` equals the watch's connection, or that no other
watch item or manual provenance references. Add a unit case: a manual upload linked as a duplicate
must survive the purge, with its bytes.

### WR-04: A permanently stuck `pending` row now absorbs every re-upload of the same bytes, in every folder

**File:** `backend/app/services/ingest_splice.py:302-320` with `backend/app/api/documents.py:622-627`, `:675-700`

**Issue:** `/upload` can leave a row `pending` forever. If both enqueue paths fail
(`insert_ingestion_job` and the supabase fallback, `:676-700`), the code only logs, and there is no
document reaper. Before 280, the person could recover by uploading the same file into another
folder (a separate copy that then completed). Now the folder-agnostic in-flight leg returns the dead
`pending` row as `already_in_library: true` for every re-upload, anywhere, and nothing is enqueued
on the duplicate arm.

The same applies to watch syncs, which link the dead row and never enqueue. Recovery now needs a
manual reingest that nothing points the person to.

**Fix:** In the in-flight leg, either ignore `pending` rows that have no live `ingestion_jobs` row
(or that are older than a staleness bound), or have the `/upload` duplicate arm re-enqueue when the
returned document is `pending` with no job. At minimum, mark the document `failed` when both
enqueue paths fail. That error branch already exists at `:698-699` and only logs.

### WR-05: The CR-01 "identical 404" holds only under user-JWT RLS; the owner check still answers 403 first for service-role callers

**File:** `backend/app/services/ingest_splice.py:180-205`

**Issue:** The comment at `:193-194` states "Every refusal below is the IDENTICAL 404 a nonexistent
folder gets". The ownership check at `:182-186` runs **before** the org check and answers
`403 "Cannot upload to a folder you do not own"`.

Under the service-role client, RLS does not hide the folder. That client is used by the watch sync
(`watch_new` / `watch_modified`), and `library_folder_id` is not validated at all in
`create_folder_watch` (`sources.py:211-222`). So a foreign-org folder owned by someone else answers
403, while a nonexistent folder answers 404.

UUIDv4 makes blind probing impractical, so the severity is low. But D-05/D-18 list the
existence-oracle rule as a security requirement, and the guarantee is stated more broadly than it
holds.

**Fix:** Do the org/membership comparison before the owner comparison, so a folder outside the
minting org always reaches the 404 before any 403. Separately, validate `library_folder_id` at
watch create/update under the user-JWT client, so the watch can only target a folder the person can
see.

### WR-06: The live race tests cannot show that the 23505 → winner branch ever ran

**File:** `backend/tests/integration/test_280_same_bytes_live.py:168-189`, `:278-300`

**Issue:** `test_two_concurrent_same_bytes_mints_leave_exactly_one_copy` gathers two
`run_in_threadpool` mints. Whenever one thread's INSERT commits before the other's in-flight SELECT,
the race is resolved by the **in-flight leg**, and the test passes without the 23505 branch
running. Nothing records which branch answered: there is no log capture and no counter.

The SC#1 claim ("hits the real DB unique index") is therefore unproven by this test. Five green
rounds are equally consistent with zero real collisions. The branch is covered only by the fake in
`test_280_minter_sequence.py::test_a_concurrent_insert_resolves_to_the_winner`.

**Fix:** Force the collision deterministically. One way is to monkeypatch the in-flight query (or
insert the winner row with asyncpg between the pre-checks and the INSERT, via a wrapper client) so
that one mint must take the 23505 path. Then assert the branch fired, for example with a `caplog`
marker or a spy on the re-query.

## Info

### IN-01: The retire's `except Exception` also swallows programming errors

**File:** `backend/app/services/ingest_splice.py:448-456`

**Issue:** D-25 chose "log a retire failure, keep the row". The catch-all also hides
`AttributeError`/`TypeError`. `test_274_promote_preview_parity.py:79-85` records exactly that
happening: a fake without `.lt` kept the suite green while the retire never ran. In production, a
silent retire failure leaves two latest rows (see WR-02) with only a WARNING log.

**Fix:** Narrow the catch to `APIError` / transport errors, or at least log at ERROR with
`exc_info=True`.

### IN-02: `on_conflict` is now a dead parameter

**File:** `backend/app/services/ingest_splice.py:137`, `:390-393`

**Issue:** Both modes now take the same path. The parameter is kept "so no caller changes", but
seven callers still pass meaningful-looking values, and docstring step 7 still lists distinct
behaviours above its correction note.

**Fix:** Deprecate it in the docstring as a no-op, or remove it in a follow-up with a caller sweep.

### IN-03: `disposition.STORAGE_BUCKET` is now unused, and the bucket name has two homes

**File:** `backend/app/services/retention/disposition.py:66`, `backend/app/services/document_purge.py:37`

**Issue:** After the lift, `disposition.py` no longer reads `STORAGE_BUCKET`. `document_purge.py`
defines its own copy.

**Fix:** Delete the disposition constant, or import the one from `document_purge`.

### IN-04: The shared bytes helper logs with a `retention:` prefix for watch-purge failures

**File:** `backend/app/services/document_purge.py:85`

**Issue:** The message "retention: removing %d file(s) after a confirmed delete failed" now also
fires for both watch purge doors, which misattributes the failure when someone reads the logs.
`purge_documents` then logs a second warning for the same failure.

**Fix:** Pass a caller label into `remove_document_bytes`, or use a neutral message.

### IN-05: `remove_document_bytes` counts every path as removed without reading storage's answer

**File:** `backend/app/services/document_purge.py:79-87`

**Issue:** Supabase Storage `remove` returns the objects it actually deleted. An object that RLS
filters (for example a legacy `file_path` whose first segment is not the caller's uid) is skipped
with a 2xx response. The helper still appends it to `removed`, so `disposition`'s `removed_paths`
report and the purge doors can claim bytes are gone when they are not. This is not reachable for
canonically minted paths, but the result is never compared.

**Fix:** Compare the returned names against `paths`, and move any missing ones to `not_removed`.

### IN-06: The DEBT-08 component test cannot tell a disposed source from a live one

**File:** `frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx:189-218`

**Issue:** The "disposed" fixture is byte-for-byte an ordinary artifact, so the test pins "the
caption is plain text with no anchor" for every artifact, and the comment admits as much. The
asserted string `"table 1Data: query_tables · contract.pdf · 16 rows"` also depends on the adjacent
text-node concatenation, which makes it brittle against markup changes that are irrelevant to D-06.

**Fix:** Keep the anchor-absence assertion, and assert the caption pieces separately (for example
with `toHaveTextContent(/query_tables · contract\.pdf · 16 rows/)`).

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
