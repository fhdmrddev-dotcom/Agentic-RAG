---
id: BUG-261014-05
title: remove_document_bytes reports every path as removed without reading what Storage actually deleted
reported: 2026-10-14
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/retention, backend/connectors, backend/storage]
folded_into: "285"
verified_closed_by: null
related_seeds: []
re_open_trigger: "The next phase whose files_modified names backend/app/services/document_purge.py or backend/app/services/retention/disposition.py, OR any report/test that relies on removed_paths / not_removed being accurate (e.g. a retention disposal receipt shown to an operator)."
reproduces_on:
  branch: develop
  commit: 0b077d7fb
  date: 2026-10-14
---

# BUG-261014-05: remove_document_bytes reports every path as removed without reading what Storage actually deleted

Source: Phase 280 code review, `280-REVIEW.md` **IN-05** (deferred by the operator's fix brief, not
fixed in 280). Verified against the code and the installed library on 2026-10-14 before filing.

## What we observed

- `document_purge.remove_document_bytes` calls `storage.from_("documents").remove(paths)` and, if it
  does not raise, appends EVERY path to `removed`.
- Installed `storage3` (`SyncBucketActionsMixin.remove`) returns `response.json()`: the list of objects
  Storage actually deleted. The helper discards it.
- Storage answers 2xx and simply omits an object it did not delete, for example one that RLS filters
  (a legacy `file_path` whose first segment is not the caller's uid, under migration 206's owner-path
  DELETE policy).

**Expected:** a path Storage did not delete lands in `not_removed`.
**Actual:** it lands in `removed`, so retention disposition's `removed_paths` report and both watch
purge doors can claim bytes are gone when they are not.

## Why it matters

A false "bytes removed" claim on a data-removal path. Not reachable for canonically minted paths
(`{user_id}/{document_id}/{filename}` under the owner's JWT), which is why it is `minor`; but the
result is never compared, so a non-canonical path would be silently mis-reported.

## Hypothesized cause

The bytes step was written against "raises on failure" semantics; Storage's partial success is a 2xx.

## Surface classification

`Agentic-RAG` — the app's shared delete-bytes helper.

## Suggested routing

- **Fold into in-flight phase:** n/a (deferred by decision in the 280 review fix).
- **Defer to future phase / milestone:** the next phase touching `document_purge.py` or `disposition.py`.
- **Fix shape:** compare the names in `remove()`'s return value against `paths`; move any missing path
  to `not_removed`. Pin with a stub whose `remove` returns a subset.
- **External — note only:** no.

## Workarounds

None needed for canonically minted documents. For an audit, list `storage.objects` by the document's
`file_path` after a purge rather than trusting `removed_paths`.

## Reference / evidence links

- `.planning/phases/280-in-once-out-clean/280-REVIEW.md` → IN-05 and its Fix log entry
- `backend/app/services/document_purge.py` (`remove_document_bytes`)
- `backend/venv/Lib/site-packages/storage3/_sync/file_api.py` (`remove` returns `response.json()`)
