---
phase: 285
slug: watch-and-re-upload-close-out
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-16
---

# Phase 285 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audited against the code at `develop` HEAD `a70a2ca8b`, after the review fixes (CR-01 `9bb8faf9e`, CR-02 `1b02e58df`). Phase base: `c8c764e90`.
> The register was authored at plan time (`register_authored_at_plan_time: true`): 23 threats across 285-01, 285-02 and 285-03.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Source adapter → watch loop | File names and exception text come from OneDrive or Drive and become stored strings | untrusted strings: filenames, exception messages |
| Watch loop (asyncpg pool / service role) → DB | Not RLS-gated; writes item, run and document rows | item state, markers, document status |
| Migration paste → production DB | Runs as the table owner; carries data (backfill and heal) | `minted` markers, document status, ingestion jobs |
| Run row → Sources UI | `connector_sync_runs.last_error` reaches the browser | failure summary text (filenames) |
| Client → purge doors | An authenticated user asks for a destructive operation on a watch id | watch id (untrusted), user JWT |
| Doors → asyncpg pool (scope read) | Not RLS-gated; ownership is proven by `get_watch` and the `user_id` predicate | document ids |
| Doors → PostgREST under the user JWT (DELETE) | RLS decides which rows can be deleted | document rows |
| Purge → Storage (user client, mig 206 RLS) | Removes bytes; Storage's answer is the only record of what was deleted | object paths |
| Client → /documents/upload | Untrusted file bytes and folder id; authenticated user | file bytes |
| Upload route → ingestion_jobs (pool, then service role) | The enqueue write whose failure FIX-14 handles | job rows |
| Driver (outside the repo) → Microsoft Graph + local DB | Live OAuth token use, approved by the operator | OAuth access token (secret) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified evidence at HEAD) | Status |
|-----------|----------|-----------|-------------|-----------------------------------------|--------|
| T-285-01 | Spoofing (UI) | release_watch / WatchRowCard pill | mitigate | `db/watches.py:325`: `$3` of the `connector_watches` UPDATE is `error`. `db/watches.py:379`: `$7` of the run-row INSERT is `run_error if run_error is not None else error`. `watch_service.py:748-753`: the happy path passes `error=None, run_error=_failure_summary(failures)`. Pins: `test_watches_db.py::test_release_watch_run_error_goes_to_run_row_only` asserts `$3 is None` and `$7` = the summary. Live: `test_285_watch_retry_live.py:151-153` asserts `connector_watches.last_error IS NULL` after the failing sync. | closed |
| T-285-02 | Info disclosure / injection | RunHistoryList | mitigate | `RunHistoryList.tsx:261-267`: `last_error` renders only under `failed && …`, and only through `sourceFailureSentence`, never raw. Vitest `RunHistoryList.test.tsx:369-381` asserts a success row with the summary renders `sources-run-partial`, has no `sources-fail-reason`, and the row text lacks `x.txt (ConnectError)`. Caps: `watch_service.py:72-108` (`_SUMMARY_MAX = 500`, 80 chars per name) and `_typed_error` `[:500]` at `:84`. Ran: 31 passed. | closed |
| T-285-03 | DoS | sync_watch retry | mitigate | `watch_service.py:70` `WATCH_ITEM_MAX_FAILED_ATTEMPTS = 3`. `:436-444`: past the cap with an unchanged version, the item is counted and named and `continue`s with no read. `:430-433`: only a version change (or a success, which writes `failed_attempts=0`) resets the count. Pins: `test_past_cap_unchanged_version_is_not_read_but_counted`, `test_past_cap_changed_version_is_read_again`, `test_past_cap_changed_version_failing_restarts_the_count`, `test_cr02_past_cap_unauthorized_item_is_counted_and_returned_to_failed`. | closed |
| T-285-04 | Tampering / data loss | watch error arm | mitigate | `watch_service.py:672`: a document is marked failed only `if mint_res is not None and not mint_res.is_duplicate`, using `mint_res.document["id"]`. It never uses the existing fallback id or a dedup-linked id. The item keeps its link (`:643`). Pins: `test_modify_arm_read_failure_keeps_the_previous_good_copy`, `test_dedup_linked_doc_is_never_marked_failed`, `test_doc_this_iteration_minted_is_marked_failed`. | closed |
| T-285-05 | Tampering / data loss | 209 backfill | mitigate | `209_*.sql:51` computes `v_fresh` BEFORE the ALTER, and `:61` runs the backfill only `IF v_fresh`, so it is one-shot. `:66-69`: the predicate needs `d.created_at >= w.created_at` and a 10-minute window before `first_seen_at`. Column default `false` = kept. VERIFY `:133` checks that no minted item points at a document older than its watch. The `--verify-only` run in this audit read 8/8 PASS twice. Shape pins: `test_backfill_is_one_shot_inside_v_fresh`, `test_backfill_predicate_is_the_tightened_d07`. Residual: see AR-285-04 (WR-03). | closed |
| T-285-06 | Integrity | 209 heal | mitigate | `209_*.sql:92-121` (the HEAL markers). The INSERT INTO `ingestion_jobs` (`:98`) needs `EXISTS storage.objects … bucket_id='documents'`. The UPDATE that marks rows failed (`:108`) runs after it and needs `NOT EXISTS`. Both carry the `interval '1 hour'` bound and `NOT EXISTS ingestion_jobs`. Both sit inside `BEGIN` (`:46`) and `COMMIT` (`:123`). VERIFY `:137` checks that no stuck row remains. Pin: `test_heal_enqueues_only_with_bytes_then_fails_the_rest`. | closed |
| T-285-07 | EoP | 209 grants | mitigate | `209_*.sql` has no `CREATE FUNCTION` or `PROCEDURE` (pin `test_no_function_or_procedure_is_created`) and no GRANT or REVOKE. VERIFY `:134-136` checks for no column ACL, that `authenticated` keeps UPDATE, and that `anon` has no SELECT. All PASS locally in this audit. Operator follow-up: `get_advisors(security)` at deploy parity (declared owed in the plan; not a code gap). | closed |
| T-285-08 | Tampering | local apply | mitigate | `scripts/apply_migration_209.py:47` hard-codes the DSN to `127.0.0.1:54322`, and no env var is read. `:54-57` `_refuse_non_local()` exits for any non-loopback host. `main()` calls it at `:211`, before the only `asyncpg.connect` (`:216`). The header warns: never `db push` or `db reset`. | closed |
| T-285-09 | Tampering / data loss | both purge doors | mitigate | `api/sources.py:337-345` (door 1) and `:472-484` (door 2) pass only `scope.purge_doc_ids` to `document_purge.purge_documents`. `db/watches.py:667-675`: a document is purged only when `minted is True and shared is False`; anything else is kept (fail safe). Live: `test_285_purge_scope_live.py` has `test_door1_keeps_linked_hand_upload`, `test_door2_keeps_linked_hand_upload`, `…shared_with_other_watch` and `…present_sibling`. They were RED at `3da27d1aa` and are GREEN with per-path `storage.objects 1 -> 1` (285-LIVE-EVIDENCE §SC#2). | closed |
| T-285-10 | Spoofing | "minted" test | mitigate | `db/watches.py:599-676` reads `minted`, and `source_connection_id` appears nowhere in `db/watches.py` (grep: 0). The marker is written from the minter's answer through `_minted_marker` (`watch_service.py:111-128`, used at `:503`, `:526`, `:606` and `:665`). Pin: `test_watch_purge_scope_sql_reads_the_marker_and_never_the_provenance_field`. | closed |
| T-285-11 | Tampering | purge order (T-275-12) | mitigate | `git diff c8c764e90 HEAD -- document_purge.py` changes only `remove_document_bytes`. The `purge_documents` body (`:39-76`) is unchanged, and the guard is called through the module attribute `hold_guard.assert_none_held` (`:54`). The order fence `test_280_purge_bytes.py::test_purge_documents_orders_guard_then_delete_then_bytes`, its planted can-fire case and the no-`try` pin are unweakened (only a comment changed at `:174`). Doors use `document_purge.purge_documents` with no by-name import (pin `test_doors_call_the_scope_helper_and_never_import_purge_by_name`). | closed |
| T-285-12 | Data loss | hold refusal | mitigate | `test_280_purge_bytes_live.py::test_a_held_document_refuses_and_keeps_its_row_and_its_object` now seeds items with `minted=True` (`watch_with(..., minted: bool = True)`, `:98-115`). A held minted document still reaches `hold_guard` and returns 409 with its row and object kept. A held linked document is not in `purge_doc_ids` (stated behaviour change, `sources.py:335-336`). | closed |
| T-285-13 | EoP | watch_purge_scope (pool path) | mitigate | Both doors call `get_watch(pool, watch_id, user_id=user_id)` and 404 before the scope read (`sources.py:325-330`, `:461-466`). Both scope statements carry `user_id = $2` (`db/watches.py:637`, `:649`). The DELETE runs under the user-JWT `supabase` client (`document_purge.py:58-63`). The door-2 item DELETE (`sources.py:491-495`) is bounded to `scope.item_ids`, which already carry the `user_id` filter. | closed |
| T-285-14 | Info disclosure | shared check spans all users' items | accept | See AR-285-01. Verified: only the `shared` boolean per in-scope document leaves the helper (`db/watches.py:654-658`); the API returns only the `kept_count` integer (`sources.py:487`, `:508`). | closed |
| T-285-15 | Repudiation / integrity | receipt counts | mitigate | `sources.py:486` sets `purged_count = len(deleted)`, where `deleted` is the rows the DELETE returned (`document_purge.py:64`). `document_purge.py` `remove_document_bytes` splits paths by the `name`s that `remove()` returned (`confirmed`). Pins: `test_door2_purged_count_is_rows_deleted_not_ids_requested`, `test_a_path_storage_did_not_confirm_is_not_reported_removed`, `test_no_confirmation_at_all_reports_every_path_not_removed`. The retention over-report fails safe (orchestrator ruling 7). | closed |
| T-285-16 | Race | scope read → DELETE window | accept | See AR-285-02. Verified: the residual is recorded in the helper docstring (`db/watches.py:626-628`). | closed |
| T-285-17 | Integrity (race) | D-12 refusal vs a live worker | mitigate | `documents.py:684-716`: `enqueued` is set True only when an insert returns. `:735` refuses only `if not enqueued and ingest_worker_enabled`. `:750` uses `.eq("status", "pending")` as a guard. Pins: `test_worker_disabled_never_refuses_the_background_task_reads_the_row`, `test_asyncpg_enqueue_succeeds_no_refusal`, `test_service_role_fallback_succeeds_no_refusal`. Residual: an ambiguous commit (REVIEW WR-02) is accepted, see AR-285-05. | closed |
| T-285-18 | Integrity | in-flight leg / FIX-02 | mitigate | `git diff --quiet c8c764e90 HEAD -- backend/app/services/ingest_splice.py` exits 0, and the worktree is clean. The same holds for `db/ingestion_jobs.py`, `test_280_same_bytes_live.py` and `test_280_minter_sequence.py`. `watch_service.py` has exactly 2 `async_mint_document_row(` call sites (`:474`, `:566`). | closed |
| T-285-19 | Integrity | 209 heal (live) | mitigate | `test_285_stuck_pending_live.py::test_209_heal_enqueues_with_bytes_fails_without_and_skips_recent` checks P (bytes present) enqueued, Q (no bytes) failed with no job, and R (under 1 h) untouched. It ran in a rolled-back transaction. Evidence: 285-LIVE-EVIDENCE §D-14. | closed |
| T-285-20 | DoS | refusal write double fault | mitigate | `documents.py:741-753` wraps the refusal write in `try` / `log.exception`, and `:754-755` still returns 201 `{**doc, "status": "failed"}`. Pin: `test_the_refusal_write_raising_does_not_double_fault` asserts 201 with status failed when both the inserts and the update raise. | closed |
| T-285-21 | EoP | refusal write uses the service role | accept | See AR-285-03. Verified: the row id comes from `doc = mint_result.document` (`documents.py` ~:623), not from input. The client is the same `service_supabase` the storage-fail arm uses (`:660`). | closed |
| T-285-22 | Info disclosure | OneDrive token in the driver | mitigate | `git ls-files \| grep -c drive_sc5` = 0, and the driver sits under `%TEMP%/agentic-rag-285/`. In the driver, `tok = await get_fresh_access_token(CONN)`, `ok = bool(tok)` and `del tok` mean the token is never printed. Only `expires_at` is logged. A scan of `drive_sc5.log` and `drive_sc5_state.json` for JWT or token shapes found 0 matches. | closed |
| T-285-23 | Tampering | live drive on dev data | mitigate | The operator decision "option-a (Recommended)" was recorded before the drive (285-03-SUMMARY "Operator decision"; 285-LIVE-EVIDENCE §SC#5). Watch C was deleted with `purge_documents=false`. A read-only SELECT in this audit shows watches A and B `is_active=false`, with C and its items gone (0 rows). B's 10 documents and paths were unchanged (evidence table). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-285-01 | T-285-14 | The D-08 shared check reads every user's and every watch's items. It can only cause a KEEP. The only output is one boolean per in-scope document, turned into a `kept_count` integer. No id or name of another user's item leaves the helper. | plan 285-02 (register) | 2026-10-16 |
| AR-285-02 | T-285-16 | Between the scope read and the DELETE (milliseconds), another watch could link a purge document. The worst case is that item's `document_id` going NULL (`ON DELETE SET NULL`), never the loss of a hand upload. Recorded in the `watch_purge_scope` docstring. Related: REVIEW IN-02 (two reads without a shared snapshot) is accepted on the same grounds. A wrong partition can only keep a document, or unlink the item of a document being purged anyway. | plan 285-02 (register) | 2026-10-16 |
| AR-285-03 | T-285-21 | The D-12 refusal write uses the service-role client. It uses the same client and the same kind of row id as the existing storage-fail arm, and the id comes from the just-minted document, never from request input. | plan 285-03 (register) | 2026-10-16 |
| AR-285-04 | T-285-05 (REVIEW WR-03) | The tightened backfill can still mark a dedup-linked copy `minted=true` inside the 10-minute window: a manual import after watch creation, or a second watch's first sight. Measured at **0 rows** locally. Production has **0 watch items** (orchestrator read, 2026-10-16), and the backfill is one-shot, so it can never classify a production row. **Re-open if migration 209 is applied to an environment that already holds watch items.** | operator / orchestrator (285-REVIEW fix log) | 2026-10-16 |
| AR-285-05 | T-285-17 (REVIEW WR-02) | The D-12 refusal can fire when an insert committed on the server but raised on the client (an asyncpg reset after commit, or a PostgREST `ReadTimeout`), so a job exists. The `.eq("status","pending")` guard does not stop it. Very low probability (285-RESEARCH §10). It heals itself: the worker claims the job and `splice_document` drives the row to `completed`, with no data loss. The worst case is a transient `failed` badge and a possible second copy that `documents_completed_hash_unique_idx` refuses. **Re-open if a document is ever observed `failed` by D-12 that also has an `ingestion_jobs` row.** | operator / orchestrator (285-REVIEW fix log) | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

### Recorded residuals (not registered threats; informational)

- **REVIEW WR-01, orphan half, deferred.** A retry that re-mints Y leaves the earlier failed row X, and possibly its bytes, with no item pointing at it, so neither purge door can reach it. This is data **retained**, not lost, so it does not breach T-285-09. The marker half (a new item whose storage upload failed is now `minted=True`, so it can be purged) **is fixed** and pinned by `test_wr01_new_item_storage_upload_fails_is_marked_minted`. Re-open trigger (REVIEW): a failed-retry count above 0 in production, or the next change to `sync_watch`'s retry branch. Any fix adds a destructive call to the sync loop and needs its own threat-model pass.
- **CR-02 legacy residual.** A pre-209 failed row (`failed_attempts=0`) that has a failed `document_id` and passes through an auth blip is still restored to `present`. Production has 0 watch items, and every row written since 209 carries the counter.
- **REVIEW IN-01.** Door 2's receipt under-reports items unlinked when the DELETE returns fewer rows than requested. This is a count-honesty gap that fails toward under-claiming, not a data-loss path. Deferred.
- **Deploy order (REVIEW IN-05).** Migration 209 must be pasted into production **before** the backend deploys, then `get_advisors(security)` runs at deploy parity (T-285-07 follow-up).

---

## Unregistered Flags

None. All three SUMMARYs report "No new surface beyond the threat register". The REVIEW findings that touched security-relevant state are either fixed (CR-01: a hand upload could be marked minted and purged; CR-02) and covered by T-285-09/T-285-10/T-285-03, or recorded above (WR-01, WR-02, WR-03, IN-01, IN-02).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 23 | 23 (20 mitigate, 3 accept) | 0 | gsd-security-auditor (Claude), HEAD `a70a2ca8b` |

Commands run in this audit (none mutate the DB):
- `pytest test_285_watch_retry test_285_purge_scope test_285_upload_enqueue_failure test_285_migration_209_shape test_watches_db test_280_purge_bytes test_280_minter_sequence test_watch_service test_sources_watches_api`: **145 passed**.
- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/sources/RunHistoryList.test.tsx`: **31 passed**.
- `scripts/apply_migration_209.py --verify-only`: **8/8 PASS, twice**.
- `git diff --quiet c8c764e90 HEAD -- ingest_splice.py / db/ingestion_jobs.py / test_280_same_bytes_live.py / test_280_minter_sequence.py`: all unchanged, worktree clean.
- A read-only SELECT on the local DB: watches A and B `is_active=false`, temporary watch C gone, and the `failed_attempts` and `minted` columns present.
- Live integration suites were **not** re-run here, because they mutate the local DB. Their RED and GREEN outputs are taken from 285-01/02/03-SUMMARY and 285-LIVE-EVIDENCE, and the test bodies were read to confirm they assert the cited properties.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
