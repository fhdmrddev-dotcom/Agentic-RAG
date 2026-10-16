---
phase: 285-watch-and-re-upload-close-out
plan: 02
subsystem: connectors, storage, retention
tags: [purge, watch, storage, destructive-path, tdd, security, asyncpg]

requires:
  - phase: 285-01
    provides: migration 209's connector_watch_items.minted marker, written at every point the minter answers (M-1..M-4)
  - phase: 280-in-once-out-clean
    provides: document_purge.purge_documents (one purge body, order hold -> rows -> bytes), the live per-path purge harness
provides:
  - db.watches.watch_purge_scope(pool, watch_id, *, user_id, states) -> WatchPurgeScope (item_ids, purge_doc_ids, kept_doc_ids)
  - both watch purge doors delete only minted, unshared documents (FIX-13)
  - WatchPurgeResponse.kept_count (additive) and purged_count = rows actually deleted (D-09)
  - remove_document_bytes reports only paths Storage confirmed deleted (BUG-261014-05, D-10)
affects: [285-03 close-out (SC#2 evidence for 285-LIVE-EVIDENCE.md, ledger rows, BUG-261014-03/05 closure), retention disposition receipts]

tech-stack:
  added: []
  patterns:
    - "Purge scope = minted AND NOT referenced by any item outside the scope; fail safe (anything else is kept)"
    - "Receipts count what the store confirmed (DELETE return rows; storage3 remove() return names), never what was requested"

key-files:
  created:
    - backend/tests/integration/test_285_purge_scope_live.py
    - backend/tests/unit/test_285_purge_scope.py
  modified:
    - backend/app/db/watches.py
    - backend/app/api/sources.py
    - backend/app/models/source.py
    - backend/app/services/document_purge.py
    - backend/tests/unit/test_275_delete_paths.py
    - backend/tests/unit/test_280_purge_bytes.py
    - backend/tests/unit/api/test_sources_watches_api.py
    - backend/tests/integration/test_280_purge_bytes_live.py
    - backend/tests/integration/test_275_disposition.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json

key-decisions:
  - "285-02: the purge scope's shared check spans every user's and every watch's items (D-08) — it can only KEEP more, and only a boolean per document leaves the helper"
  - "285-02: door 1 (DELETE watch) stays 204 and logs its kept count; door 2 returns kept_count and a plain-words message"
  - "285-02: a held LINKED document no longer makes a watch purge 409 — it is not in the delete set (stated behaviour change)"
  - "285-02: retention disposition may now over-report bytes_not_removed for a path already absent from storage — accepted, fails safe (orchestrator ruling 7)"

patterns-established:
  - "Door-level unit fakes patch the scope helper by module attribute (app.api.sources.watch_purge_scope); the helper's own partition is driven through an SQL-aware fake (Pitfall 2)"

requirements-completed: [FIX-13]

duration: 28min
completed: 2026-10-16
---

# Phase 285 Plan 02: Purge scope + honest receipts Summary

**Both watch purge doors now delete only the documents the watch minted and nothing else still uses. A hand upload the watch only dedup-linked keeps its row and its stored file at both doors (proven live, per path, RED first). Door 2's receipt counts the rows really deleted plus the ones kept, and the shared bytes helper reports only the paths Storage confirmed deleted.**

## Performance

- **Started:** 2026-10-16T16:03Z
- **Completed:** 2026-10-16T16:31Z
- **Tasks:** 3/3, plus one Rule 3 follow-up commit (OpenAPI snapshot)
- **Files:** 13 (2 created, 11 modified)
- **PHASE_BASE:** `c8c764e90` (from 285-01)

## Accomplishments

- **`watch_purge_scope`** (`backend/app/db/watches.py`). One acquire, two statements in the `get_watch_items` shape:
  - a CTE `scope` over `watch_id = $1 AND user_id = $2 AND ($3::text[] IS NULL OR state = ANY($3))`;
  - per document, `bool_or(minted)` and an anti-join `o.id NOT IN (SELECT id FROM scope)`.
  - `purge_doc_ids` = minted AND NOT shared. Everything else is kept, so the default fails safe. The helper never reads the connection provenance column.
- **Door 1** (`DELETE /sources/watches/{id}?purge_documents=true`):
  - calls `watch_purge_scope(..., states=None)`;
  - calls `document_purge.purge_documents` only when the purge set is non-empty;
  - logs the kept count. It stays 204.
- **Door 2** (`POST /sources/watches/{id}/purge`):
  - calls it with `['missing', 'unauthorized']`;
  - `purged_count = len(deleted)`, plus `kept_count`;
  - still deletes every in-scope item row;
  - message: *"Purged 1 missing or disconnected file(s). Kept 1 that is also in your Library from another source or a hand upload."*
- **`WatchPurgeResponse.kept_count: int = 0`** is additive. The frontend type does not carry it; no UI change was intended (D-09).
- **D-10:** `remove_document_bytes` splits `paths` by the names `remove()` returned. It still has exactly one `try`, and `purge_documents` is byte-identical.

## Task Commits

1. **Task 1: RED tests.** `3da27d1aa` `test(285-02): purge-scope live + unit pins (RED, D-11)`
2. **Task 2: scope + doors + kept_count + amends.** `4bcce53a1` `fix(285-02): purge only what the watch minted and nobody else uses (FIX-13)`
3. **Task 3: D-10.** `14a70e94f` `fix(285-02): remove_document_bytes reports only what Storage deleted (BUG-261014-05, D-10)`
4. **Rule 3 follow-up.** `c01426ca6` `docs(285-02): regenerate OpenAPI snapshot for WatchPurgeResponse.kept_count`

## Evidence

### Link method (SC#2)

**Driven by `sync_watch`, not seeded.** The live test calls the real `WatchService.sync_watch` with a stub adapter (`SourceRegistry.get_adapter` patched). The adapter lists one file carrying the hand upload's exact bytes.
- The real minter dedups to the hand upload, and the real watch arm writes the linked item.
- The test then asserts that the item's `document_id` is the hand upload and that `minted is False`.
- The linked item row is never INSERTed by the test, so the `minted` column is never named for it.
- Only the watch's OWN documents are seeded with an explicit `minted = true`. Items in the D-08 cases that only reference a doc are inserted without naming `minted`.

### RED (D-11), against today's doors (HEAD `83563ffa0`, migration 209 applied locally), under the lock

`16 failed, 3 passed, 37 warnings in 13.88s`, with **0 skipped**. The 3 passes are pins on behaviour that already held: full confirmation, raising `remove()`, and the one-`try` count.

The live failures were on the hand upload's row and object, per door:
```
E       AssertionError: door 1 deleted the documents row of a hand upload the watch only linked (FIX-13)
EVIDENCE door 1 (DELETE watch, purge_documents=true) | hand upload, dedup-linked | 2b026313-…/694284f1-…/285-ps-d1-hand-219daf.txt | storage.objects 1 -> 0 | documents row after: gone
E       AssertionError: door 2 deleted the documents row of a hand upload the watch only linked (FIX-13)
EVIDENCE door 2 (POST watch purge, state=missing) | hand upload, dedup-linked | a448cc6a-…/4fe4d5a3-…/285-ps-d2-hand-d42f58.txt | storage.objects 1 -> 0 | documents row after: gone
EVIDENCE door 2 (POST watch purge, state=missing) | receipt | purged_count=2 kept_count=<absent> | message='Successfully purged 2 missing or disconnected files.'
E       AssertionError: door 2 deleted a minted document another watch still references (D-08)
EVIDENCE door 2 on W1 (D-08: also referenced by W2) | … | storage.objects 1 -> 0 | documents row after: gone
E       AssertionError: door 2 deleted a document a present sibling item of the same watch still uses (D-08)
EVIDENCE door 2 (D-08: a PRESENT sibling item of the same watch) | … | storage.objects 1 -> 0 | documents row after: gone
```

The unit failures were all for the right reasons:
```
E       ImportError: cannot import name 'WatchPurgeScope' from 'app.db.watches'          (x6 door cases)
E       AttributeError: module 'app.db.watches' has no attribute 'watch_purge_scope'     (x2 helper cases)
E       assert 0 == 2   <- 'watch_purge_scope(' count in sources.py
E       AssertionError: assert ['u/d1/a.txt', 'u/d2/never-existed.txt'] == ['u/d1/a.txt']   (BUG-05 subset)
E       AssertionError: assert ['u/d1/a.txt', 'u/d2/b.txt'] == []                        (BUG-05 None and [])
```

### GREEN

**After Task 2** (targeted run under the lock):
- `94 passed, 3 failed`.
- The 3 failures were the BUG-05 cases, which were RED by design until Task 3.
- `test_285_purge_scope_live.py` passed 4/4, and `test_280_purge_bytes_live.py` passed 6/6. Its purged_count pins of 2 and 1 are unchanged.

**After Task 3:**
- The `test_285_purge_scope`, `test_280_purge_bytes`, `test_275_delete_paths`, `test_275_disposition` and `test_sources_watches_api` suites ran `70 passed`.

**Live EVIDENCE lines** (wave-gate run, for 285-LIVE-EVIDENCE.md):
```
EVIDENCE door 1 (DELETE watch, purge_documents=true) | hand upload, dedup-linked | c7cf3298-058a-4320-953d-c575a861df2f/82ab3092-f742-477b-9ce4-40f6e7435fa8/285-ps-d1-hand-8b2a2d.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 1 (DELETE watch, purge_documents=true) | watch-minted, unshared | c7cf3298-058a-4320-953d-c575a861df2f/c768a9d9-db6e-4427-9c03-d34f50c30b68/285-ps-d1-minted-d7505c.txt | storage.objects 1 -> 0 | documents row after: gone
EVIDENCE door 2 (POST watch purge, state=missing) | hand upload, dedup-linked | f8767f95-9523-4e62-b105-27c4e09e446d/620f0cb0-f5cf-4ae0-bfb2-374e14952003/285-ps-d2-hand-96605f.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 2 (POST watch purge, state=missing) | watch-minted, unshared | f8767f95-9523-4e62-b105-27c4e09e446d/07197ecf-a560-4a72-a7f6-f00591d4dbce/285-ps-d2-minted-4a995c.txt | storage.objects 1 -> 0 | documents row after: gone
EVIDENCE door 2 (POST watch purge, state=missing) | receipt | purged_count=1 kept_count=1 | message='Purged 1 missing or disconnected file(s). Kept 1 that is also in your Library from another source or a hand upload.'
EVIDENCE door 2 on W1 (D-08: also referenced by W2) | W1-minted, W2 still references it | 451c180a-dccd-49f0-970d-3044b9979da6/22b56303-7c93-49af-8e73-441dd0c8329c/285-ps-shared-408629.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 2 (D-08: a PRESENT sibling item of the same watch) | minted by item A (missing), linked by item B (present) | 25ed983e-8f4b-4375-bb41-5354e93d95cf/9a5a7bbc-f13f-42fb-8b63-fb6ace7f43d0/285-ps-sibling-169c0a.txt | storage.objects 1 -> 1 | documents row after: present
```
- The watch-minted rows are the positive control. A minted, unshared document is still purged with its bytes, so DEBT-10 holds and SC#4's purge half holds.
- Each case's cleanup is proven by one SQL count of 0 across documents, jobs, watches, items, runs, connections, auth users and `storage.objects` under the user's prefix.

### Wave gate (D-22), under the lock

**Backend unit run 1:** `72 failed, 7732 passed, 1 skipped, 2 xfailed, 2 xpassed`.
- After normalisation, the one new failure was `tests/unit/test_276_openapi_snapshot_fresh.py::test_committed_openapi_snapshot_matches_the_code`.
- It was caused by this plan: the additive `kept_count` changed the schema.
- Fixed under Rule 3. Commit `c01426ca6` regenerated both files with `scripts/export-openapi.py` and `scripts/build-public-openapi.cjs`; each diff is exactly the one new field.

**Backend unit run 2 (re-run after the fix):** `71 failed, 7733 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 409.52s (0:06:49)`.
- Normalisation splits each `FAILED` line at the glued `C:` warning path.
- After normalisation the failing set is **set-identical** to `base_failed.norm.txt`: 71 == 71, NEW = [], GONE = [].
- The ceiling of ≤ 71 holds.
- Passed went from 7718 (after 01) to 7733. The +15 is this plan's 15 new unit cases.

**Live suites:** `test_285_purge_scope_live`, `test_285_watch_retry_live`, `test_280_purge_bytes_live`, `test_280_same_bytes_live`, `test_280_cr01_two_org_live` and `test_275_disposition` ran **`46 passed`, with 0 skipped**.

**Vitest:** not run. This plan changed no frontend file.

### Acceptance greps

These hold:
- The `source_connection_id` count on added lines of `db/watches.py` since PHASE_BASE is **0**.
- `purged_count = len(deleted)` appears **1** time in `sources.py`.
- `purged_count = len(doc_ids)` appears **0** times.
- `watch_purge_scope(` appears **2** times in `sources.py`.
- By-name imports of `document_purge`, `purge_documents` or `assert_none_held` in `sources.py`: **0**.
- `kept_count: int = 0` appears **1** time.
- `ingest_splice.py` is untouched since PHASE_BASE.
- `confirmed` appears 4 times in `document_purge.py`.
- `document_purge.py`'s only diff hunk sits inside `remove_document_bytes`.

**One grep does not hold as written:** `grep -c "removed.extend(paths)" document_purge.py` prints **1**, not 0.
- The match is the substring inside the UNCHANGED except arm `not_removed.extend(paths)` (base line 92). A raising `remove()` must still report every path not removed, and the plan's own behaviour list requires that.
- `grep -cE "(^|[^_])removed\.extend\(paths\)"` prints 0, so no success-path `removed.extend(paths)` remains.
- I did not alter the code just to satisfy a substring grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The OpenAPI snapshot was stale after the additive field**
- **Found during:** Task 3 wave gate.
- **Issue:** `test_276_openapi_snapshot_fresh` failed (72 > 71) because `WatchPurgeResponse` gained `kept_count`.
- **Fix:** I regenerated `docs/public/api/openapi.snapshot.json` and `openapi.public.json` with the commands the test names. The diff is +5 lines each, the one field.
- **Files modified:** `docs/public/api/openapi.snapshot.json`, `docs/public/api/openapi.public.json`.
- **Commit:** `c01426ca6`.

**2. [Rule 3 - Deliberate amend] `test_delete_folder_watch_and_purge` in `test_sources_watches_api.py`**
- **Found during:** Task 2.
- **Issue:** The plan named only `test_purge_missing_watch_documents` in this file. The door-1 case also patched `get_watch_items`, which door 1 no longer reads.
- **Fix:** It now patches `app.api.sources.watch_purge_scope`, with a FIX-13 comment.
- **Files modified:** the same file the plan lists.
- **Commit:** `4bcce53a1`.

**3. `get_watch_items` stays imported in `sources.py`**
- **Why:** `GET /watches/{id}/items` (`:274`) still uses it. Only the two doors stopped calling it.

## Accepted (recorded, not fixed)

- **Orchestrator ruling 7 (retention over-report).** After D-10, `retention/disposition.py` (service-role client) reports a path that was already absent from storage under `bytes_not_removed`. An example is a BUG-260905-08 row whose bytes never landed. `DeleteBatchCard.tsx:183` then counts one more "not removed" file than truly remains. This fails safe: Storage did not confirm a deletion, so none is claimed. The `test_275_disposition.py` storage fake now returns the realistic `[{"name": p}]` shape.
- **T-285-16 race.** Between the scope read and the DELETE, another watch could link a purge document. The outcome is that item's `document_id` going NULL (ON DELETE SET NULL), not the loss of a hand upload. This is recorded in the helper docstring.
- **Behaviour change.** A held LINKED document no longer makes a watch purge return 409, because it is not in the delete set. The held MINTED case still refuses 409 and keeps its row and bytes: `test_280_purge_bytes_live` held cases, with items now seeded `minted = true`.

## G-5 (D-20)

Re-derived triples:

| File | Triple | Status |
|---|---|---|
| `api/sources.py` | **11 / 5 / 713** | FIRES; its "extraction FIRST" was discharged by 280 |
| `db/watches.py` | **6 / 4 / 828** | FIRES |
| `services/document_purge.py` | **4 / 2 / 105** | young |
| `models/source.py` | **6 / 2 / 201** | does not fire |

All four are honoured by construction:
- **`api/sources.py`:** the set logic went to `db/watches.py`. The doors only call the helper and shape the receipt; there is no inline SQL left in door 2.
- **`db/watches.py`:** one new read function plus a frozen dataclass, asyncpg only.
- **`document_purge.py`:** only `remove_document_bytes`' success path changed.

`check-hot-file-ledger.cjs` reports `ledger gate OK`. The CLAUDE.md / ledger row refresh for these triples is left to the phase close (plan 03), as in 285-01.

## Threat model

- **T-285-09:** the live RED-first test at both doors.
- **T-285-10:** the scope never reads the provenance column. This is pinned by a source assertion and by the acceptance grep.
- **T-285-11:** `purge_documents` is untouched, and the order fences are green.
- **T-285-12:** the held minted case is still 409 and keeps its bytes.
- **T-285-13:** `get_watch(user_id)` runs first, and `user_id = $2` is in both statements.
- **T-285-14:** accepted. Only a boolean leaves the shared check.
- **T-285-15:** receipts come from the DELETE rows and the storage return.
- **T-285-16:** accepted, and documented.

No new surface beyond the register.

## Known Stubs

None.

## Next Phase Readiness

- Plan 03 can copy the EVIDENCE lines above into `285-LIVE-EVIDENCE.md` for SC#2.
- BUG-261014-03 and BUG-261014-05 can be flipped closed at the phase close. Both are reproduced RED and green here.
- No migration in this plan. Production deploy order is unchanged from 285-01: paste 209 first.

## Self-Check: PASSED

- The created files are present: `backend/tests/integration/test_285_purge_scope_live.py` and `backend/tests/unit/test_285_purge_scope.py`.
- The commits are in history: `3da27d1aa`, `4bcce53a1`, `14a70e94f`, `c01426ca6`.
- The local-DB lock is released.
