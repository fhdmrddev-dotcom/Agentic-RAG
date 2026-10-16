---
phase: 285-watch-and-re-upload-close-out
reviewed: 2026-10-16T00:00:00Z
depth: standard
diff_base: c8c764e90
files_reviewed: 23
files_reviewed_list:
  - backend/app/services/watch_service.py
  - backend/app/db/watches.py
  - backend/app/services/document_purge.py
  - backend/app/api/sources.py
  - backend/app/models/source.py
  - backend/app/api/documents.py
  - supabase/migrations/209_watch_item_retry_and_purge_scope.sql
  - scripts/apply_migration_209.py
  - frontend/src/components/sources/RunHistoryList.tsx
  - backend/tests/unit/services/test_285_watch_retry.py
  - backend/tests/unit/test_285_purge_scope.py
  - backend/tests/unit/test_285_upload_enqueue_failure.py
  - backend/tests/unit/test_285_migration_209_shape.py
  - backend/tests/integration/test_285_purge_scope_live.py
  - backend/tests/integration/test_285_stuck_pending_live.py
  - backend/tests/integration/test_285_watch_retry_live.py
  - backend/tests/unit/db/test_watches_db.py
  - backend/tests/unit/test_275_delete_paths.py
  - backend/tests/unit/test_280_purge_bytes.py
  - backend/tests/unit/api/test_sources_watches_api.py
  - backend/tests/integration/test_280_purge_bytes_live.py
  - backend/tests/integration/test_275_disposition.py
  - frontend/src/components/sources/RunHistoryList.test.tsx
findings:
  critical: 2
  warning: 3
  info: 6
  total: 11
status: issues_found
---

# Phase 285: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard (diff against `c8c764e90`)
**Files Reviewed:** 23
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the FIX-12 retry loop, the FIX-13 purge scope, the D-12 upload refusal, migration 209 and the tests that pin them. I traced each finding below through the code rather than inferring it.

The purge doors themselves are sound. `watch_purge_scope` fails safe: it keeps a document unless the document is minted **and** unshared. The hold → rows → bytes order is unchanged. `remove_document_bytes` now reads Storage's answer, and the live tests drive real storage. The heal never enqueues a row unless `storage.objects` holds its `file_path`.

The two blockers are in how `watch_service.sync_watch` maintains the item state the purge and the retry depend on:

- **CR-01:** the error arm can re-point an item at a dedup-linked hand upload while keeping a stale `minted = true`. M-2 then keeps that marker on every later sync, and a purge deletes the hand upload. This is the exact bug FIX-13 closes.
- **CR-02:** a `failed` item that passes through `_handle_unauthorized_watch` is silently restored to `present` with no live document. It is then never retried and never counted. A 401 or 403 on the listing (for example an expired token) is enough to trigger it, and it defeats FIX-12's "until it lands, the failure stays visible".

## Critical Issues

### CR-01: The error arm re-links an item without updating `minted`, so a hand upload can be marked minted and purged

**File:** `backend/app/services/watch_service.py:606-622` (with `_minted_marker`, `:111-126`)

**Issue:** The error arm writes `document_id=link_doc_id`, where `link_doc_id = doc_id or existing.document_id`. `doc_id` is set as soon as the minter answers (`:452`, `:544`), even when the answer is a **duplicate of another document**. The error-arm upsert passes no `minted` (`None` = keep the stored value). So if the dedup-arm upsert at `:456` (or the modify-arm upsert at `:559`) raises and the error-arm upsert then succeeds, the item ends up like this:

- `document_id` = the hand upload H (a dedup link)
- `minted` = whatever the item stored for its **previous** document, which is `true` for any item whose earlier document the watch minted
- `state = 'failed'`

The next sync retries the item (`retry_failed`). The minter returns H again as a duplicate, and `_minted_marker` takes M-2: the returned id equals the item's current `document_id`, so it returns `None` and keeps the stale `true`. The wrong marker is now permanent. `watch_purge_scope` reads `minted = true`, unshared, and both doors delete H's row **and bytes**.

Concrete path:
1. An item minted X. X failed after the job insert raised, so the item is `failed` with `minted = true`.
2. The person hand-uploads the same file (H, completed).
3. On retry, the minter dedups to H. The dedup-arm upsert hits a transient DB error. The error-arm upsert succeeds and links H with `minted = true`.

The same path exists from the modify arm (a present minted item whose edited bytes match H).

`test_failed_item_again_failing_increments_attempts` pins `up.get("minted") is None` for the error arm. `test_dedup_linked_doc_is_never_marked_failed` uses a brand-new item (`items=[]`), where the insert defaults to `false`. So the suite agrees with the bug.

**Fix:** have the error arm write the marker for the document it links, from the same rule:
```python
await upsert_watch_item(
    ...,
    document_id=link_doc_id,
    state="failed",
    last_error=err_text,
    failed_attempts=prior_attempts + 1,
    # The marker must describe the document the item now points at.
    minted=_minted_marker(mint_res, existing) if mint_res is not None else None,
)
```
A non-duplicate mint gives `True`, a duplicate of another document gives `False`, and the item's own document gives `None`. Add a unit pin with `items=[_item(document_id=X, minted=True)]`, `mint=_mint(H, dup=True)` and `upsert_side_effect=[RuntimeError, {...}]`, asserting that the second upsert carries `minted=False`.

### CR-02: An auth blip silently turns a `failed` item into `present` with no document, so it is never retried or counted

**File:** `backend/app/services/watch_service.py:741-743` and `:394`, `:506-516`

**Issue:** `_handle_unauthorized_watch` flips **every** item whose state is not `unauthorized` to `unauthorized`, including `failed` ones. It is reached whenever the listing error text contains `403`, `permission` or `unauthorized`, which includes an httpx `401 Unauthorized`. `update_item_state` also overwrites `last_error` and leaves `failed_attempts` as it was.

When access returns, `retry_failed` (`:394`) is `False`, because the state is now `unauthorized`, not `failed`. The item therefore goes to the `else:` branch. The restore arm (`:507-509`) sets it to `present` and clears `last_error`. The stored `source_version` is the version from the failed attempt, so the modify check does not fire and nothing reads the file.

Result: the item reads `present` with `document_id` NULL (or pointing at a `failed` document). It drops out of WatchRowCard's failing-items list and `count_errors` stays 0, so every later run reports a clean success over a file that never arrived. This is the outcome the comment at `:413-416` says the routing exists to prevent ("would flip it to `present` with no document"). It is also the FIX-12 / D-02 failure mode, and the trigger (an expired or revoked token) is common.

**Fix:** treat "never landed" as a property of the row, not only of `state`. `failed_attempts > 0` already means that, because every success resets it to 0:
```python
retry_failed = existing is not None and (
    existing.get("state") == "failed"
    or (existing.get("state") in ("missing", "unauthorized")
        and int(existing.get("failed_attempts") or 0) > 0)
)
```
Alternatively, skip `failed` items in `_handle_unauthorized_watch` (`if it["state"] not in ("unauthorized", "failed")`). Either way, add a pin: a failed item becomes unauthorized, a later successful listing arrives, and the item must be read again or still counted.

## Warnings

### WR-01: Every failed retry can leave an orphan `failed` document (and sometimes its bytes) that no purge can reach

**File:** `backend/app/services/watch_service.py:420-498`, `:606-622`

**Issue:** D-05's re-mint means a retry mints a fresh row Y and re-points the item at it. The earlier failed row X stays behind: it is retired by the mint's versioning and referenced by no item. Neither purge door can find it, because `watch_purge_scope` only sees documents an item points at. X keeps its bytes when the failure came after the storage upload (for example, the `insert_ingestion_job` failure). With the cap at 3, one flaky file can leave up to three failed rows, plus objects in storage.

Separately, when a **new** item's storage upload fails, the error arm *inserts* the item with `minted` at its default `false`. X is then classed as "linked", so a purge before the retry keeps a failed document the watch minted.

**Fix:** in the retry branch, when `existing.document_id` names a `failed` document this watch minted (`existing.minted`), delete that row and its bytes after the new mint lands, through `document_purge`. At minimum, have CR-01's fix pass `minted=True` for a non-duplicate mint, so the storage-fail case is purgeable.

### WR-02: The D-12 refusal can fire while a job actually exists (an ambiguous commit), and `.eq("status","pending")` does not stop it

**File:** `backend/app/api/documents.py:684-755`

**Issue:** `enqueued` is set only when the insert call *returns*. Both inserts can commit on the server and still raise on the client: an asyncpg connection reset after the commit, or an httpx `ReadTimeout` on the PostgREST insert. In that case a pending job exists. The route still marks the document `failed`, and the `status = 'pending'` guard passes, because the worker has not claimed the job yet.

The worker then claims it and `splice_document` drives the row to `processing` and then `completed`, after the person was told it failed. If they re-upload in between, the minter skips the failed row and mints a second copy, and one of the two later fails on `documents_completed_hash_unique_idx`. D-19's premise ("D-12 only fires when no job was ever inserted") is not established by the code.

**Fix:** confirm that no job exists before refusing. Either do a final `ingestion_jobs` lookup by `document_id` through the service client, or make the UPDATE itself conditional through the pool:
```sql
UPDATE documents SET status='failed', ingestion_step='failed', error_message=$2
 WHERE id=$1 AND status='pending'
   AND NOT EXISTS (SELECT 1 FROM ingestion_jobs WHERE document_id=$1)
```

### WR-03: The legacy `minted` backfill can still mark a dedup-linked copy minted inside the 10-minute window

**File:** `supabase/migrations/209_watch_item_retry_and_purge_scope.sql:62-69`

**Issue:** The tightened predicate still relies on the copied provenance fields that D-06 rules out: `source_connection_id = w.connection_id` plus a matching `external_id`. A time window is the only extra guard. Two cases defeat it:

- A document the person imported through the **manual import door** after creating the watch, within 10 minutes before the watch's first sync. The import door stamps the same provenance a watch mint does, and the watch only dedup-linked the document.
- A second watch on the same connection that first saw a file within 10 minutes of the first watch minting it.

Either case is backfilled `minted = true`. In the second case, D-08 protects the document only while the other watch's item exists. In the import case, a purge deletes a document the person imported deliberately. The window is narrow, but the result is permanent, because the runtime M-2 rule never corrects a stored `true`.

**Fix:** also require that the document is referenced by **exactly one** item across all watches, and that no other item's `first_seen_at` precedes it. The cheaper option is to accept the residual in writing in `285-SECURITY.md` / CONTEXT, since D-07 says the backfill "fails safe" and this case does not.

## Info

### IN-01: Door 2 deletes the items of documents the DELETE did not remove, and the receipt does not say so

**File:** `backend/app/api/sources.py:476-508`

**Issue:** When `purge_documents` returns fewer rows than `scope.purge_doc_ids` (RLS-filtered, or deleted concurrently), every `scope.item_ids` row is still deleted. The documents left behind lose their last item link. The message then reads `Purged 0` with no kept count, while N files were in fact unlinked and left in the Library.

**Fix:** count `len(purge_doc_ids) - len(deleted)` into `kept_count`, or only delete items whose document is in `deleted` or `kept_doc_ids`.

### IN-02: `watch_purge_scope` reads the scope with two statements and no shared snapshot

**File:** `backend/app/db/watches.py:631-666`

**Issue:** `item_rows` and `doc_rows` are separate `fetch` calls at READ COMMITTED. A concurrent sync that changes an item's state between them can put an item in `item_ids` (to be deleted) that the document partition already treated as outside the scope, or the reverse. The docstring records the read-to-DELETE race, but not this one.

**Fix:** run both reads in `async with con.transaction(isolation="repeatable_read")`, or derive both lists from one query.

### IN-03: Door 2's message misdescribes kept documents

**File:** `backend/app/api/sources.py:497-502`

**Issue:** The message says "Kept N that is also in your Library from another source or a hand upload". Kept documents also include minted documents still shared with a present sibling item or another watch, and legacy rows the backfill classed as linked.

**Fix:** use neutral copy, e.g. "Kept N still used elsewhere in your Library."

### IN-04: A successful retry is counted as `new`, even when the original failure was a modification

**File:** `backend/app/services/watch_service.py:499`

**Issue:** A failed modify (`present` → `failed`) retried through the new-file body increments `counts["new"]`. Run history then reports a new file for what was an edit.

**Fix:** use `counts["modified" if existing is not None and existing.get("document_id") else "new"] += 1`.

### IN-05: Code that reads the new columns must not deploy before migration 209

**File:** `backend/app/db/watches.py:46-50`

**Issue:** `_WATCH_ITEM_COLUMNS` now selects `failed_attempts, minted`. A backend deployed before 209 is pasted will fail every `get_watch_items` / `upsert_watch_item` call, so every watch sync and the items API break.

**Fix:** state "migration 209 BEFORE the backend push" explicitly in the deploy-parity checklist for this phase.

### IN-06: The migration shape suite is text-presence only

**File:** `backend/tests/unit/test_285_migration_209_shape.py`

**Issue:** Every assertion is a substring or ordering check on the SQL text, so it cannot detect a wrong predicate that keeps the same tokens. The real behaviour is covered only by `test_285_stuck_pending_live.py` (the heal) and `apply_migration_209.py` (idempotency). Nothing drives the **backfill** predicate against seeded rows.

**Fix:** add a rolled-back live case that seeds the backfill's positive and negative rows (a dedup-linked import, a modified-version document, a document created before the watch) and runs section 1-3 inside a transaction.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
