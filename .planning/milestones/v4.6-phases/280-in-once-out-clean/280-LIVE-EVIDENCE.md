# Phase 280 — live evidence

Every row below was measured against the **real local stack**: Postgres on :54322, GoTrue, PostgREST
and Storage on :54321. The drives used real signed-in GoTrue users and their user-JWT clients, and
each test file was run under the local-DB lock. A skip counts as a failure of the row, never as a
pass. HEAD at measurement: `b794a40c5` (plans 01-03 merged), 2026-10-14.

| SC arm | Status | Evidence |
|---|---|---|
| SC#1 same-bytes minter + CR-01 | ✅ PASS | live re-run at `b794a40c5` |
| SC#2 OneDrive re-drive | ⛔ **PARTIAL — OWED** (104 of 105) | paging, decoded paths, rule, success + complete all PASS; one file lost to a transient TLS error that is never retried (BUG-261014-02) |
| ↳ ⚠ CORRECTED 2026-10-16 (Phase 285, D-18) | ✅ **105 / 105** | the row above is kept verbatim. 285 fixed BUG-261014-02 and re-synced watch A: `team-note-058.txt` landed, `completed`. See `285-LIVE-EVIDENCE.md` § SC#5 |
| SC#3 door 1 | ✅ PASS | 2/2 paths `1 -> 0`, rows gone |
| SC#3 door 2 | ✅ PASS | 2/2 paths `1 -> 0`, rows gone, `purged_count == 2` |
| SC#3 held (both doors) | ✅ PASS | 409 `legal_hold`; rows present; paths `1 -> 1` |
| SC#3 positive control | ✅ the check CAN fail | no-op bytes step → path `1 -> 1`, orphan seen |
| SC#4 live DELETE 404 | ✅ PASS | foreign id and random id → identical `404 'Document not found'` |

## SC#1 — same-bytes minter (FIX-02 / BUG-261005-01) and CR-01 (BUG-261014-01)

Plan 03's live suites were re-run unchanged at `b794a40c5`, under the lock:

```
venv/Scripts/python -m pytest tests/integration/test_280_same_bytes_live.py tests/integration/test_280_cr01_two_org_live.py -q -rs
24 passed, 127 warnings in 46.90s          (0 skipped)
```

- **`test_280_same_bytes_live.py` (18 cases):**
  - in-flight same bytes return the in-flight copy (same folder and another folder);
  - 5 rounds of two concurrent `asyncio.gather` same-bytes mints leave exactly one copy;
  - 3 rounds of concurrent v2 mints;
  - all 7 minter caller shapes get the in-flight copy.
  - Fix commit `89d41fd79`. RED at `a3d9406bc` was recorded in `280-03-SUMMARY.md` (`c07829457`).
- **`test_280_cr01_two_org_live.py` (6 cases):**
  - a two-org user's `/upload` into a folder of the non-default org lands in **that folder's** org;
  - a non-member org's folder (user JWT and service role) gets the byte-identical
    `404 "Folder not found"`;
  - an explicit org that differs from the folder's org gets the same 404.
  - Fix commit `8f83c307e`. Filed as BUG-261014-01 (`86ab344e8`) before the fix.

## SC#3 — both watch purge doors remove the bytes, PER PATH (DEBT-10 / BUG-261012-01; D-13, D-31)

`backend/tests/integration/test_280_purge_bytes_live.py`, run with `-q -rs -s` under the lock:
**6 passed, 0 skipped in 48.63s**.

How the assertion works:

- It is per path: `SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = $path`.
  A global orphan count would prove nothing here, because the local DB already holds pre-existing
  orphans.
- The bytes were uploaded by the user-JWT client to each minted document's `file_path`.
- The doors are the route coroutines, called with the live user client, a service-role client for the
  hold predicates, and a real asyncpg pool.

Rows copied from the `EVIDENCE` lines the run printed:

| Arm | Path | storage.objects before → after | documents row after |
|---|---|---|---|
| door 1 (DELETE watch, `purge_documents=true`) | `bb77ef79-…/0eb53ee9-28b9-4332-8f6d-0e848bcdc235/280-pb-d1-0-329613.txt` | 1 → **0** | gone |
| door 1 | `bb77ef79-…/650dbc96-ca8d-4043-9114-36fb2eb8bcd7/280-pb-d1-1-15d1e2.txt` | 1 → **0** | gone |
| door 2 (POST purge, state `missing`) | `649273cc-…/0858ba73-9669-4dd9-9be3-497b14e17636/280-pb-d2-0-618947.txt` | 1 → **0** | gone |
| door 2 | `649273cc-…/fd2dc6e4-a68f-414b-bfc1-486b3fddf0f8/280-pb-d2-1-945734.txt` | 1 → **0** | gone |
| held, door 1 → **409** (held doc) | `6992b1f4-…/af015c61-45c8-44c4-8d03-58624856c264/280-pb-held-door1-a71bf0.txt` | 1 → **1** | present |
| held, door 1 → 409 (unheld sibling) | `6992b1f4-…/a21690fa-0bd6-439e-a333-4458e860f524/280-pb-held-sibling-door1-8e5a32.txt` | 1 → **1** | present |
| held, door 2 → **409** (held doc) | `874c6aa3-…/3448eae8-4596-469a-b067-d636549fd9e9/280-pb-held-door2-b79403.txt` | 1 → **1** | present |
| held, door 2 → 409 (unheld sibling) | `874c6aa3-…/c77223c9-1d17-4e53-8080-815b89f80555/280-pb-held-sibling-door2-e34f42.txt` | 1 → **1** | present |
| **CONTROL**: `remove_document_bytes` planted as a no-op, door 2 | `7a251f3a-…/57f723fb-8c42-408b-bc44-c0778b3a85f0/280-pb-control-da6d7b.txt` | 1 → **1** (orphan SEEN) | gone |

Each path's first segment is the throwaway user's id; it is shortened above. Every user was
different.

What the rows show:

- **Door 1** also deleted the watch.
- **Door 2** left a `present` item's document and object untouched.
- **Held, both doors:**
  - the 409 carried `detail.code == "legal_hold"`;
  - the hold was a real `legal_holds` + `legal_hold_documents` row in the user's org, matched by
    `retention_held_documents` through the service role;
  - the watch survived;
  - the unheld sibling was not purged either, because the whole purge refuses.
- **The control** is the T-280-20 mitigation. It shows the per-path check is able to see the exact
  orphan DEBT-10 used to leave. The row is gone and the object remains.

**Cleanup**, verified by SQL after the run (`residue_280_04.py`, outside the repo), all zero:

- `auth.users` `phase-271-p280pb%`;
- organizations `phase-271-280-pb%`;
- documents `280-pb-%`;
- connections `service_id = 'p280-test'`;
- holds `280 purge-bytes matter%`;
- storage objects `%/280-pb-%`.

Each fixture also asserts its own per-user residue (rows and `storage.objects` under `<uid>/`) is 0.

## SC#4 — live `DELETE /documents/{id}` 404 (DEBT-11 / BUG-261012-02; D-09)

The same run called `documents.delete_document` with a live signed-in user's client (real postgrest
2.29):

```
SC#4 delete_document foreign id -> 404 'Document not found'
SC#4 delete_document random id -> 404 'Document not found'
```

- The "foreign id" is a real document owned by a second GoTrue user in a second org.
- `(status_code, detail, headers)` are equal for both ids, so there is no existence oracle.
- The foreign document still exists afterwards.
- Before `51a9e7962` this path answered a 500, because `maybe_single()` returned `None` for a 0-row
  miss.

## SC#2 — OneDrive re-drive (FIX-03/04/05; D-14, D-15, D-27)

**Status: ⛔ PARTIAL — OWED.** 104 of 105 files were imported. D-15's pass requires all 105 "by
count, not some", so this row is not a pass. Every other D-15 / D-27 criterion passed on the real
folder. The one missing file was lost to a transient network error that the watch never retries.
That is a separate defect, filed as **BUG-261014-02**. It is not a return of BUG-260910-04's paging
or path defects.

> ⚠ **CORRECTED 2026-10-16 (Phase 285, D-18).** The status above is kept verbatim as the 2026-10-14
> measurement. The owed re-drive has now run. Phase 285 fixed BUG-261014-02 (`9e9af4a1e`: failed watch
> items are retried). With the operator's explicit OK ("option-a"), it re-synced **this same watch A**
> as it was, on 2026-10-16 at 17:03Z. `team-note-058.txt` was read again and landed (`state='present'`,
> document `310aeac5-…`, `completed`). The run row read `success`, `count_new 1`, `count_errors 0`,
> `last_error NULL`. Result: **A 95 + B 10 = 105 / 105, all `completed`.** This is the first arm of
> "What closes this row" below. Evidence: `.planning/phases/285-watch-and-re-upload-close-out/285-LIVE-EVIDENCE.md`
> § SC#5. Flipping BUG-260910-04 and 238-VERIFICATION M-9 against this pass is left to their own
> routing; 285 did not touch them.

### Operator approval (Task 3), verbatim

> "approved + delete the 95"

This approved (a) the drive and (b) deleting 95 Library copies of the top-level files (below).

### How the folder reached OneDrive

The operator's first upload put only `Q3 Plans` at the drive root. The orchestrator then copied the
generated `Team Docs` folder into the local OneDrive sync folder, so the operator did not drag
`Team Docs` in by hand. Recorded because D-14 assigned the upload to the operator.

- The stray root `/Q3 Plans` was not watched. When this drive browsed the root at 2026-10-14
  15:47Z, the root folders were `Apps, Attachments, Desktop, Dokument, Pictures, Team Docs, Videos`.
  `Q3 Plans` was not among them.
- Before the drive, `verify_onedrive_listing.py` (read-only, outside the repo) listed the real
  folder through the shipped adapter and compared it with `manifest.json`. Result: **MATCH**.
  - `/Team Docs` held 95 files over 4 pages at page_size 30, with one subfolder, `Q3 Plans`.
  - `/Team Docs/Q3 Plans` held 10 files.
  - No file was missing, extra or of a different size.

### Pre-drive cleanup: the 95 Library copies (operator-approved)

95 top-level `Team Docs` files had already been uploaded to the dev account's Library root
(`folder_id NULL`, `source_connection_id NULL`, created 2026-10-14 15:37:59-15:38:05Z). If kept,
the watch's `on_conflict="link"` dedup could have linked to them instead of importing.

- **Checks before deleting** (`delete_library_copies.py`, outside the repo):
  - exactly 95 rows;
  - the filename set equals the manifest's top-level set;
  - every `content_hash` equals a manifest sha256;
  - no OTHER document of the user, or of any user, carried a manifest hash: `0` and `0`.
- **Deleted in this order:** rows first, in one transaction (`DELETE 95`), then the 95 storage
  objects through the Storage API.
- **After:** scoped rows `0`, rows by id `0`, `storage.objects` for those paths `0`, chunks `0`.

### Backend under test

The backend on :8000 was restarted by the operator at **2026-10-14 15:44:17Z**. That is after plans
01-03 merged (`b794a40c5`) and before this drive started (15:47:37Z).

- `Get-NetTCPConnection -LocalPort 8000` returned PID 568, started `7:44:17 PM` local time (UTC+4).
  Its parent 71556 and child 81048 have the same start time.
- `settings.watch_process_enabled = True`, so the restarted scheduler was live.
  - To prevent a double sync, the driver leased each watch the moment it was created, as
    `claim_due_watches` does (`leased_until` and `next_run_at` +30 min).
  - It set each watch to `is_active = false` straight after its sync.
  - `connector_sync_runs` holds **only** the driver's runs: 2 for A and 1 for B. No run was started
    by the scheduler.

### The drive (`drive_onedrive.py`, outside the repo, `venv/Scripts/python -I`, local-DB lock held)

The shipped config was not changed: page_size 30, `recursive=False`, `max_pages` 200. The only
addition was an in-memory counter wrapped around `list_files` inside the driver.

1. **Credential:** a fresh token came from the app's own `get_fresh_access_token`. It was not
   printed.
2. **Folders:** the adapter's own `browse` found `Team Docs` (`8838C0504A8F177B!s2ef296056cd04d118bc8c3e4fb7f53d2`)
   and `Q3 Plans` (`8838C0504A8F177B!sc7d2957290014f5cac747adee803458e`).
3. **Rule, created BEFORE any sync.** Validated by the route's own `RuleCreate` and
   `_validate_match_expr(rule_scope='watch')`, then written by `classification_rule_service.create_rule`:
   - id `ca3d0c66-1521-4aa9-8588-1efa0baea1f4`, named `280 M-9 Team Docs path rule`;
   - `{"op":"and","conditions":[{"field":"path","op":"contains","value":"/Team Docs/"}]}`;
   - created 15:47:40.457Z, org `22f9c615-…`.
4. **Watches.** Both were created with the app's `create_watch` for user `d8a54002-…`, org
   `22f9c615-…`, connection `34e44621-…`, with no library folder and interval 30 (the route's
   defaults).
   - **Watch A**, `/Team Docs`: `0aa5c6ac-062a-4ff6-9a63-4acfed09a5d6`.
   - **Watch B**, `/Team Docs/Q3 Plans`: `05d93b24-8bd4-421a-8265-fbc9447c7a3b`.
5. **One `WatchService.sync_watch(watch_row)` each:**
   - **Watch A:** `list_files` was called **4** times, returning pages of `29 + 30 + 30 + 6` = 95
     files. The first page held 29 files plus the `Q3 Plans` folder. The sync took 139.0 s and
     returned `success`, `new 94`, `errors 1`.
   - **Watch B:** `list_files` was called **1** time, returning 10 files. The sync took 17.0 s and
     returned `success`, `new 10`, `errors 0`.

### Evidence by SQL (`evidence_onedrive.py`, read-only)

The figures below are for documents with `source_connection_id = 34e44621-…` and
`created_at > 15:47:37Z`.

| D-15 / D-27 criterion | Measured | Verdict |
|---|---|---|
| all 105 imported, by count | **104** (A 94 present + B 10 present); A has 1 item `state='failed'`, `document_id NULL`: `team-note-058.txt` | ⛔ **104 / 105** |
| A imports over ≥ 4 pages | 4 `list_files` calls (29/30/30/6) | ✅ |
| stored paths `/Team Docs/…`, decoded | `bool_and(path LIKE '/Team Docs/%') = true`; 0 NULL; 0 matching `%[0-9A-Fa-f]{2}`; path parents `/Team Docs` 94, `/Team Docs/Q3 Plans` 10; `/Team Docs/Q3 report draft.txt` present (1) | ✅ |
| depth-2 path with a space (watch B) | 10 rows under `/Team Docs/Q3 Plans/` (e.g. `/Team Docs/Q3 Plans/q3-plan-01.txt`) | ✅ |
| the `path contains '/Team Docs/'` rule matches | `metadata ? '_classification'` = **104 / 104**. All 104 have `rule_id` = `ca3d0c66-…`, named `280 M-9 Team Docs path rule`. They were written by the restarted backend's ingest worker: `ingestion_jobs` completed **104**, documents `status = completed` **104**. | ✅ (every imported doc) |
| run success + listing complete | A: `success`, `listing_complete = true`, `count_new 94`, `count_errors 1`. B: `success`, `true`, `10`, `0`. Both have `failure_cause` and `last_error` NULL. | ✅ success + complete; ⛔ A `count_errors 1` |
| scope | all 104 have org `22f9c615-…`, `folder_id NULL`, `ingest_visibility = private` | — |

### The missing file, and why it is a new defect rather than a pass on doubles

- The download of `team-note-058.txt` raised an empty-message `httpx.ConnectError` from
  `start_tls`, a transient TLS connect failure, inside `adapter.read_file`
  (`microsoft_graph.py:463`). Paging, listing and paths were not involved: the file WAS listed.
- `resync_a.py` then ran a deliberate **second sync of watch A**. The watch was already inactive, so
  the scheduler could not race it. It was run to **measure** whether the failed item recovers:
  - `list_files` was called 4 times and `read_file` **0** times;
  - the run row reads `success`, `listing_complete = true`, `new 0`, `errors 0`;
  - the file is still absent.
- A watched file whose download fails once is never retried, and later runs record clean successes.
  Filed as **BUG-261014-02** (open). It was not fixed here: it is a retry-policy decision in
  `watch_service.py`, outside 280's scope.
- The drive was **not** repeated to reach 105. Re-running until green is not evidence, and a fresh
  watch would dedup-link 94 of the files.

### Afterwards

- Both watches read `is_active = false`, `leased_until = NULL`, `last_status = success`.
- The 104 imported documents and the rule stay in the dev account for the operator to keep or
  delete.

### What closes this row

Either one of these closes it:

- a re-drive that imports all 105, which needs BUG-261014-02 fixed or a clean network run, starting
  from removing watch A's 94 documents;
- an operator ruling that the 104/105 shortfall belongs to BUG-261014-02 and not to SC#2's subject.

Until then, BUG-260910-04 stays `folded` (D-16 flips it only after a pass), and 238-VERIFICATION M-9
keeps its ⛔ verdict with a dated 280 note.
