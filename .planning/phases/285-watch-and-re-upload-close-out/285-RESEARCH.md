# Phase 285: Watch and Re-upload Close Out - Research

**Researched:** 2026-10-16 (develop at `e0d4f0589`)
**Domain:** connector watch loop retry, watch purge scope, upload enqueue failure, one data migration (209)
**Confidence:** HIGH (every claim below was read at HEAD or measured on the live local DB / storage)

## Summary

All three bugs reproduce in code exactly as CONTEXT M-1..M-4 describe. Line drift against HEAD is small (+3 lines in places, listed below). No new packages are needed. Migration 209 is the next free number (`ls supabase/migrations | tail -1` = `208_library_page_index.sql`).

Research turned up five things CONTEXT did not have:

1. **D-07's backfill as written would mark 8 real legacy rows "minted" that the watch did not mint.** On the local DB, 120 items match D-07's two conditions. For 8 of them the document was created **before the watch existed**: 7 on the `CV` watch were created 6 days earlier, and `245-UAT-finance-invoice.txt` was created 3 minutes before the `Finance` watch. Those documents came in through the manual import door, which stamps the same `source_connection_id` and `metadata.source.external_id`, and the watch only dedup-linked them. A purge would delete them, which is exactly the data-loss class FIX-13 exists to close. Adding `d.created_at >= w.created_at` plus a mint-to-item time window gives 112 minted rows. The longest gap between mint and item on a genuine watch mint is **1.58 s**. This is stricter than D-07 and keeps its "only when" wording.
2. **D-06's rule needs one more case.** As written, `is_duplicate=True → linked` would downgrade a watch's OWN document to "linked" whenever the minter returns that same document. That happens on a version bump with unchanged bytes (the modify arm), and on a retry where the doc is live. Rule: if the returned id equals the item's current `document_id`, keep the existing marker.
3. **D-03 must write the summary to the run row only, not to `connector_watches.last_error`.** `release_watch` writes its single `error` argument to BOTH places today (`db/watches.py:303-315` and `:332-377`). `WatchRowCard.tsx:240` classifies `watch.last_error` **unconditionally**, whatever the status, and the connection pill (`:341`, rendered on every row at `:391`) shows **"Authorisation withdrawn"** whenever that string matches `/permission|403|forbidden|unauthoriz|401|…/i`. A healthy watch with a file named `permissions-matrix.xlsx`, or a `PermissionError`, would flip its pill. M-5 checked only `RunHistoryList`.
4. **The watch error arm marks the WRONG document failed in two cases.**
   - When `read_file` fails in the modify arm, `doc_id` is still `None`, so `target_doc_id` falls back to `existing["document_id"]` (`watch_service.py:493`). That is the previous **completed, is_latest** copy, which gets `status='failed'`.
   - When `upsert_watch_item` raises in the dedup arm, the error arm marks a **dedup-linked hand upload** failed.

   A transient download error on an edited file therefore takes the old good copy out of service. This is FIX-12's own path, so it belongs in plan 1.
5. **The caller-inventory fence pins `watch_service.py` at exactly 2 minter call sites** (`test_280_minter_sequence.py:595-627`). The D-01 retry must route through the EXISTING new-file branch. A third `async_mint_document_row(` call fails that fence.

**Primary recommendation:**
- **Plan 1:** migration 209 (columns, the tightened backfill and the heal) plus the FIX-12 retry. Route failed items into the existing new-file branch, compute attempts in Python, and send the D-03 summary to the run row only.
- **Plan 2:** FIX-13. One `db/watches.py` SQL helper computes the purge set and the kept set. `purge_documents` is unchanged apart from callers using its returned rows. Then D-10.
- **Plan 3:** the D-12 `/upload` arm, then the live re-drive.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Retry a failed watch item, count attempts | API/Backend (`watch_service.sync_watch`) | Database (`connector_watch_items.failed_attempts`) | The decision is made per tick in the loop; the counter is state |
| Run-row failure summary | Backend (`watch_service`), written via `db/watches.release_watch` | Database (`connector_sync_runs.last_error`) | The run row is the history's source of truth (Realtime is a hint) |
| Minted-vs-linked marker | Backend (written where the minter answers) | Database (column + backfill) | Only the caller knows `is_duplicate`; the column persists it |
| Purge scope (minted, not shared) | Database (one SQL in `db/watches.py`) | Backend (`api/sources.py` doors) | Set logic over items belongs in SQL; doors stay thin (G-5) |
| Purge order (hold → rows → bytes) | Backend (`document_purge.purge_documents`) | Storage RLS (mig 206) | Unchanged; binding 275 D-38 / T-275-12 |
| Bytes receipt (BUG-05) | Backend (`document_purge.remove_document_bytes`) | Storage API return value | Storage returns only what it deleted (measured) |
| Enqueue-failure refusal | API (`api/documents.py` upload) | — | Only /upload lacks a never-strand fallback (see D-15 audit) |
| Heal stuck pending rows | Database (migration 209 DO block) | — | One-shot data repair; runs as table owner |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Verbatim from `285-CONTEXT.md` `<decisions>`: Implementation Decisions.)

#### Measured at discuss (2026-10-16, develop at `2856a8a17`): the starting point
- **M-1 FIX-12 confirmed in code.**
  - In `backend/app/services/watch_service.py` `sync_watch`, the EXISTING FILE branch (`:403-484`) acts only on three cases: `state in ('missing','unauthorized')`, a changed version, or a changed name. A `failed` item with an unchanged version and name matches none of them, so it is never read again.
  - The error arm (`:486-525`) writes `last_error=str(item_err)`. For an empty-message `httpx.ConnectError` that string is `''`, so the exception type is lost.
  - The happy-path `release_watch(..., status="success", error=None, ...)` (`:576-587`) never names a failed file.
  - `connector_watch_items` (`supabase/migrations/169_connector_watch_items.sql`) has **no attempts column**. Its `state` CHECK allows `present | missing | unauthorized | skipped_type | skipped_size | failed`.
- **M-2 FIX-13 confirmed in code.**
  - The new-file dedup arm (`watch_service.py:359-372`) links the watch item to the EXISTING document.
  - Both doors collect every linked `document_id` and pass it to `document_purge.purge_documents`:
    - `DELETE /sources/watches/{id}?purge_documents=true`: `backend/app/api/sources.py:331-341`
    - `POST /sources/watches/{id}/purge`: `:461-481`
  - The minter sets `source_connection_id` only on INSERT (`ingest_splice.py:389-390`). A dedup link does not copy it onto the existing row.
  - `purged_count = len(doc_ids)` (`sources.py:481`) counts the requested set, not the rows actually deleted.
- **M-3 FIX-14 confirmed in code.**
  - `/documents/upload` (`backend/app/api/documents.py:686-713`): if the asyncpg enqueue fails and then the service-role insert fails, the code only logs `log.error("Failed to insert ingestion_job via supabase: …")` and returns 201. The row stays `pending` with no job.
  - The duplicate arm (`:625-628`) returns `already_in_library: true` and enqueues nothing.
  - `ingestion_jobs` (`supabase/migrations/153_ingestion_jobs.sql`) has **no unique constraint on `document_id`**.
- **M-4 BUG-261014-05 confirmed in code.** `document_purge.remove_document_bytes` (`document_purge.py:79-92`) extends `removed` with every path whenever `remove()` does not raise. It discards the returned list of objects that were actually deleted.
- **M-5 The frontend needs no change.** `RunHistoryList.tsx` renders `last_error` only when `status !== "success"` (`:259-266`). A `success` row with `count_errors > 0` already renders as the partial register (`:166-175`).
  - ⚠ The comment at `:169-173` says *"`run.last_error` is null on such a row"*. That stops being true after D-03, so update the comment in the same plan, and check any test that pins it.
- **M-6** The latest migration is `208_library_page_index.sql`. This phase takes **209**. Run `ls supabase/migrations` again before writing it.

#### Watch download retry (FIX-12)
- **D-01: Retry a failed item, capped at 3 failed attempts.**
  - Migration 209 adds an attempts counter to `connector_watch_items`. The planner names it, e.g. `failed_attempts int NOT NULL DEFAULT 0`.
  - On each sync, an existing item with `state='failed'` and attempts below 3 is read again through the same path a new file takes (read → mint → bytes → enqueue).
  - A success sets the item to `present` and resets the counter. Another failure increments it.
  - At 3 the item is no longer read, but it stays `failed` (see D-02).
  - A **version change at the source resets the counter**, so an edited file is always tried again. The modify branch already reads it.
  - Legacy `failed` rows start at 0, so the real stuck `team-note-058.txt` is retried on the next sync.
- **D-02: Every run counts it.** While any item of the watch is still `failed`, whether it was retried this run or is past the cap, the run row's `count_errors` includes it and `last_error` names it. A later sync can never report a clean success over a skipped file (the FIX-12 wording; the roadmap failure mode is *"retries forever with no cap and no visible state"*).
- **D-03: Run row shape.**
  - The status stays `success` when the listing succeeded.
  - `last_error` names the failed files with their exception type: the **first 3 names plus a count**, e.g. `5 files failed: a.pdf (ConnectError), b.txt (ReadTimeout), c.docx (HTTPStatusError) and 2 more`, bounded in length.
  - No new status value.
- **D-04: Item `last_error` keeps the type.** Store `ExcType: message`, or just `ExcType` when the message is empty, never `''`. Claude's discretion on exact formatting.
  - ⚠ The raw string must still never reach JSX (`RunHistoryList.tsx` T-235-12). D-03 relies on M-5: success rows do not render `last_error`.
- **D-05: The retry path must not double-mint.** A failed item can carry a `document_id`, for example when the mint succeeded and a later step failed, and that doc is marked `failed` by the error arm. The retry must not leave two live docs for one item. The researcher decides between re-minting (the dedup legs exclude `failed`, so a fresh row mints) and re-driving the existing doc. The item ends up pointing at exactly one non-failed doc.

#### Purge scope (FIX-13)
- **D-06: A minted-vs-linked marker on the watch item, in migration 209.**
  - The planner names it, e.g. `minted boolean NOT NULL DEFAULT false` or a CHECK'd `link_kind`.
  - It is written at the moment the minter answers: `is_duplicate=False` → minted, `True` → linked. This happens in both the new-file and modify arms (`watch_service.py:359-397`, `:422-470`).
  - Both purge doors filter their delete set to **minted** items only.
  - ⛔ This deliberately does **not** use `source_connection_id`. The roadmap's failure mode is a "minted" test fooled by a copied provenance field, and two watches on one connection share that id.
- **D-07: The backfill fails safe.**
  - Migration 209 marks a legacy item minted **only** when its document's `source_connection_id` equals the watch's `connection_id` **and** `metadata->'source'->>'external_id'` equals the item's `external_id`.
  - Every other row is marked linked and is **kept** by a purge.
  - The worst case is an orphan doc left in the Library, which the person can delete by hand. Data loss is the bug class being fixed.
- **D-08: A doc still referenced elsewhere is kept.** If another watch item, from any watch, still points at a document, the purge skips that document even when this watch minted it. This way, watch B's item is never left pointing at a deleted row.
- **D-09: An honest receipt.**
  - `purged_count` = the rows the DELETE actually returned, not `len(doc_ids)`.
  - Add an **additive** `kept_count` for docs left in place because they were linked or shared.
  - Response fields only. No UI change.
- **D-10: BUG-261014-05 folded.**
  - `remove_document_bytes` compares `remove()`'s returned object names against `paths`, and any missing path goes to `not_removed`.
  - The pin is a stub whose `remove` returns a subset.
  - This keeps the shared helper's contract for its other caller, `retention/disposition.py`.
- **D-11: RED first.** A hand upload that a watch dedup-linked survives both purge doors, with its row **and** its stored bytes. This is driven RED against today's code before the fix (SC#2). Use a live local storage listing, not only a mock.
  - The 275 D-38 / T-275-12 order (hold → rows → bytes) and the D-31 module-attribute hold-guard call stay binding (`document_purge.py` docstring).

#### Stuck pending (FIX-14)
- **D-12: Enqueue failure → mark the doc failed.**
  - When both enqueue paths fail on `/upload`, the doc is set `status='failed'`, `ingestion_step='failed'` and given a plain `error_message`, e.g. *"This file could not be queued for reading. Please try uploading it again."*
  - The dedup legs already exclude `failed`, so the next same-bytes upload mints and ingests.
  - ⛔ **The minter's in-flight leg is NOT changed.** FIX-02's same-bytes guarantee (280 D-01 / D-24) depends on it, and loosening it is a listed failure mode.
- **D-13: The response mirrors the storage-fail arm.** Return `201` with `{**doc, "status": "failed"}`, the same shape as the BUG-260905-08 arm at `documents.py:643-670`. No frontend change.
- **D-14: Heal existing stuck rows in migration 209.** A stuck row is `documents.status='pending'`, with no `ingestion_jobs` row, and older than **1 hour** (the bug's own trigger query).
  - If `storage.objects` holds the row's `file_path` in bucket `documents`, insert a `pending` ingestion job for it.
  - Otherwise mark it `failed` with a *"never started, upload again"* message.
  - The 1-hour bound makes this race-free against live uploads.
  - The migration is idempotent and records its counts with `RAISE NOTICE` or similar.
  - The production apply goes through the normal operator paste, and the count is read beforehand with a read-only query.
  - ⛔ The heal must never enqueue a row with no bytes (BUG-260905-08: an empty doc would "complete").
- **D-15: Audit all 7 minter callers** (the list is in 280 D-04): upload, watch ×2, `import_service`, `workspace_promote`, `expert_install_service`, `email_attachments`. Every caller whose enqueue failure is logged-and-continued gets the D-12 rule.
  - The watch paths already mark the doc failed through their except arm, so the researcher confirms them rather than assuming.
- **D-16: RED first.** Both enqueue paths are forced to fail, then a later same-bytes upload in a **different** folder must get ingested. This is driven RED against today's code (SC#3).
  - SC#4 is pinned alongside it: a genuinely in-flight same-bytes upload still yields exactly one copy and no 409 (FIX-02), and the 280 suites stay green.

#### Live re-drive (SC#5)
- **D-17: Real item plus one forced failure.**
  - **Step 1:** re-sync the existing watch A (`0aa5c6ac-062a-4ff6-9a63-4acfed09a5d6`, `/Team Docs`) as it is. The real legacy failure `team-note-058.txt` must be re-read and land. Watch A plus watch B (`05d93b24-…`, 10 files) then reach **105/105**.
  - **Step 2:** a driver script outside the product wraps `adapter.read_file` to raise an empty-message `httpx.ConnectError` **once** for one named file.
    - Sync 1 shows the item `failed` with a typed `last_error`, and the run row has `count_errors ≥ 1` with `last_error` naming the file.
    - Sync 2 lands it.
  - **No product test knob** (280 D-14).
- **D-18: Claude drives after the operator's explicit OK** (as 280 D-15). Claude states the exact drive, waits for a yes, runs it, and reads the DB.
  - If the Microsoft token cannot be refreshed, SC#5 is recorded ⛔ with the reason and is never omitted.
  - On a pass: close `BUG-261014-02` with `verified_closed_by`, and update `280-LIVE-EVIDENCE.md` SC#2's owed line.

#### Gates, security and guardrails
- **D-19: security_enforcement** is on, because purge is a destructive path. The threat model covers these risks:
  - the purge deleting a doc it did not mint (D-06..D-08);
  - T-275-12 ordering;
  - the hold refusal keeping bytes;
  - the heal enqueueing bytes-less rows (D-14);
  - D-12 racing a live worker. D-12 only fires when no job was ever inserted, so no worker can hold it.

  Migration 209's RLS/grants are unchanged or proven as `authenticated`. Any new SQL function is `SECURITY INVOKER` and revoked from `PUBLIC`. Run `get_advisors(security)` at deploy parity.
- **D-20: G-5 at plan time.**
  - `ingest_splice.py`, `api/documents.py` and `api/sources.py` FIRE. Read their sections in `docs/HOT-FILE-LEDGER.md` before planning.
  - `sources.py`'s "extraction FIRST" was discharged by 280's `document_purge` move. The FIX-13 logic belongs in `document_purge.py` or `db/watches.py`, not inline in the doors.
  - `documents.py`: D-12 is confined to the existing enqueue-failure arm. Honoured by construction.
  - `ingest_splice.py`: expected untouched (D-12 leaves the in-flight leg alone).
  - `watch_service.py` (7 commits) and `db/watches.py` have ledger sections but no CLAUDE.md FIRING row. Re-derive their triples.
  - `db/ingestion_jobs.py` has **no ledger row at all**. Add one if it is modified.
  - Run `node scripts/check-hot-file-ledger.cjs` once plans exist.
- **D-21: The closed core** is recounted against base: 7 phase types / 1 emitter / 30 tools. No phase adds any.
- **D-22: Baseline gates.**
  - Backend ≤ 71 failed, with the failing SET equal to base. Note: the 280 base read 72 with a flaky `test_230`, so establish the base by re-running, not from a written number.
  - Vitest count gate OK, if the frontend is touched at all.
  - `check-claude-md-size.cjs` reports no warning.
- **D-23: Deploy parity.**
  - Migration 209 goes to production by the operator's paste, then `bash scripts/regenerate-full-schema.sh`, and `scripts/full-schema-supplement.sql` if grants change.
  - No env vars change. `WATCH_PROCESS_ENABLED` and `RETENTION_SWEEP_ENABLED` stay as they are.
- **D-24: Plans target 3** (G-8):
  1. migration 209 + FIX-12 retry/visibility;
  2. FIX-13 purge scope + BUG-05;
  3. FIX-14 enqueue rule + heal, then the live re-drive and close.

  Plans touching the local DB serialize (worktree rule 4).

### Claude's Discretion
- Exact column names and types in migration 209, the `last_error` string formatting, and the length bound.
- Whether the attempts increment lives in `upsert_watch_item` or a dedicated `db/watches.py` helper.
- D-05: re-mint vs re-drive of a failed item that already carries a `document_id`.

### Folded
- **BUG-261014-05** → D-10. Update its frontmatter to `status: folded`, `folded_into: 285`.
- BUG-261014-02 / -03 / -04 → `status: folded`, `folded_into: 285`.

### Deferred Ideas (OUT OF SCOPE)
#### Reviewed seeds (not folded). Each seed file is updated with `status: deferred` and a `status_note`
- **SEED-261** (an attachment failure is invisible to the watch surface): a new reporting writer for email attachments, not a repair of FIX-12's path.
- **SEED-341** (background sync and schedules ship switched off): a capability/operator-control decision.
- **SEED-077** (durable ingestion queue at scale): FIX-14 is a narrow enqueue-failure repair. The queue's admission control and throughput stay a scale milestone.
- **SEED-315** (Expert install retry bypasses the ingest queue): `import_service` / `expert_install` retry semantics. D-15 audits only their enqueue-failure arm.

#### Out of scope by the roadmap
- Any retry-policy UI, or a per-file failure list in the Sources surface.
- A unique constraint on `ingestion_jobs.document_id`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| FIX-12 | A failed watch download is fetched again on a later sync and stays visible with its cause until it lands. A later sync never reports a clean success over a skipped file. | §1 drift table; §2 D-05 re-mint; §6 retry routing and the error-arm correction; §7 run-row-only summary; §5 migration columns; Validation SC#1/SC#5 |
| FIX-13 | A purge deletes only documents the watch minted. A dedup-linked hand upload keeps its row and its bytes. | §4 tightened backfill (measured); §8 scope SQL and D-06 rule refinement; §9 D-10 (measured storage return); fixture amendments; Validation SC#2 |
| FIX-14 | A document whose ingest never started does not absorb later same-bytes uploads; a re-upload gets ingested. | §3 D-15 audit (only /upload needs D-12); §10 D-12 shape and the `ingest_worker_enabled` gate; §5 D-14 heal SQL; Validation SC#3/SC#4 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- The Python backend uses `backend/venv` (`backend/venv/Scripts/python` on this box).
- Blocking supabase-py calls inside async code go through `run_in_threadpool` (D-v2.5-01). This matters for the D-12 refusal write: wrap it, unlike the legacy sync call at `documents.py:660`.
- **Migrations:**
  - Use a numbered file `supabase/migrations/209_<name>.sql`.
  - Apply it to the local DB by paste, or with a loopback-only `scripts/apply_migration_209.py` (see §11). NEVER `supabase db push` or `db reset`.
  - Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`).
  - Never hand-edit `full-schema.sql`.
- Any production write (migration paste, data change) needs explicit approval from the operator for that action. Production READS through the Supabase MCP are free, so read the D-14 pre-count there.
- **Backend unit baseline gate:**
  - Run `node scripts/check-backend-unit-baseline.cjs`, or `pytest tests/unit -q --continue-on-collection-errors` from `backend/`.
  - The ceiling is 71 failed and must not be weakened. D-22: establish the base by re-running.
- All tables keep RLS. Migration 209 adds columns to an RLS'd table and creates no new table.
- No LangChain or LangGraph (not applicable).
- Worktrees:
  - Bootstrap first with `bash scripts/bootstrap-worktree.sh "$(pwd)"`.
  - Use `GSD_VITEST_MAX_WORKERS=2`.
  - Tear down only with `scripts/teardown-worktree.sh`.
  - Plans that mutate the local DB serialize. All three plans here do, through migration apply or live integration tests.
- Local-DB lock: noclobber lock at `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` before a baseline run or a migration apply. It is free at research time.
- G-5: read the ledger sections. Run `node scripts/check-hot-file-ledger.cjs <phase-dir>` after plans exist.
- G-8: 3 plans. Run targeted suites per task and full gates once per wave.
- CLAUDE.md size gate: `node scripts/check-claude-md-size.cjs`. Ledger cells are capped at 200 chars in the docs scan list and 80 in the CLAUDE.md FIRING table.
- Reported-bugs: the four bugs flip to `folded` (`folded_into: "285"`). Verify that a plan task addresses each one.
- Provider-docs-first does not apply: no LLM provider surface is touched.

## §1 Line-range drift (CONTEXT M-1..M-6 vs HEAD `e0d4f0589`)

| CONTEXT cite | HEAD | Drift |
|---|---|---|
| `watch_service.py` new-file `:326-401` | `:325-400` (`if existing is None` at 325) | none (−1) |
| existing-file `:403-484` | `:402-484` | none |
| error arm `:486-525` | `:486-523` (`continue` at 523) | −2 |
| happy-path `release_watch` `:576-587` | **`:579-590`** (comment block from 568) | **+3** |
| dedup arm `:359-372` | `:359-372` | none |
| modify arm `:422-470` | mint `:422-433`, upsert `:449-460`, rename `:464-484` | none |
| `watch_service.py` length | 643 lines | — |
| `db/watches.py` `release_watch :263` | **def at `:259`** (`status` param at 263) | cosmetic |
| `get_watch_items :556`, `upsert_watch_item :593` | `:556`, `:593` | none |
| `sources.py` door 1 `:331-341`, door 2 `:461-481`, `purged_count :481` | `:331-341`; door 2 query `:457-467`, purge `:473-481`, items delete `:483-488`, response `:490-494` | none |
| `documents.py` duplicate arm `:625-628` | `:625-628` | none |
| storage-fail arm `:643-670` | **`:638-671`** | −5/+1 |
| enqueue block `:672-713` / `:686-713` | `:673-713` (asyncpg try `:684-695`, fallback `:696-713`) | none |
| `ingest_splice.py` `mint_document_row :127`, provenance `:389-390`, in-flight leg `~:300-330` | `:127`, `:389-391`, in-flight `:297-332` | none |
| `document_purge.remove_document_bytes :79-92` | `:79-92` | none |
| `db/ingestion_jobs.insert_ingestion_job :31` | `:31` | none |
| `RunHistoryList.tsx` partial `:166-175`, comment `:169-173`, render `:259-266` | partial `:166-174`, comment `:167-174` (the sentence is at `:171`), render `:259-267` | none |
| M-6 latest migration 208 | `208_library_page_index.sql` | none; **209 is free** |

## §2 D-05 decision: RE-MINT through the existing new-file branch (recommended)

**Recommendation: re-mint.** Do not re-drive the existing row.

Reasons:
- **D-01 already says "through the same path a new file takes".** The re-drive alternative is `expert_install_service._redrive_failed` (`:457-500`): delete children, reset to `pending`, then `_enqueue_or_splice`. Copying it would be a second copy of minter logic in the watch, which is a hand-roll. It also cannot work when the bytes changed, because `content_hash` would no longer match the row.
- Resetting `failed → pending` can hit `documents_dedup_idx` (`WHERE status <> 'failed'`) with a 23505 if another live same-bytes row exists in the folder. The minter already resolves that case, and a re-drive would have to rebuild it.

What re-minting does, case by case (read at `ingest_splice.py:277-558`):

| Retry case | What the minter does | End state |
|---|---|---|
| Item `document_id IS NULL` (the real `team-note-058.txt`: measured `document_id=None`, `last_error=''`) | Plain new mint | One new pending doc plus a job. Item → `present`, attempts 0, `minted=true` |
| Item → doc with `status='failed'` that this watch minted (mint OK, then bytes or enqueue failed) | Completed leg (`:277-295`) and in-flight leg (`:314-332`) both skip `failed`. `versions_query` (`:335-357`) has **no status filter**, so the failed row counts as a prior version: `next_version = v+1`. The retire (`:518-521`) sets the failed row `is_latest=false` **after** the insert. The 23505 path cannot fire, because the index excludes `failed`. | Item repointed to the new doc. `upsert_watch_item` uses `COALESCE(EXCLUDED.document_id, …)` (`db/watches.py:626`), so a non-null new id wins. The old failed row stays as a **retired, failed earlier version**. It is not live (not latest, not completed) and keeps its error text. **Exactly one non-failed doc.** |
| Item → doc that is live (`pending`/`processing`/`completed`, e.g. an earlier error-arm doc write failed, or after the §6 correction) | The completed or in-flight leg returns **that same doc** (`is_duplicate=True`) | Item stays pointed at it. ⚠ The minted marker must NOT be downgraded (see §8, rule M-2) |
| Same bytes now exist as another live doc (a hand upload since) | Returns that doc as the duplicate | Item → that doc with `minted=false`. The old failed watch-minted row stays retired and failed |

- ⛔ The FIX-02 in-flight leg is untouched. Re-minting only *uses* it.
- **Do not purge the retired failed row from inside the loop.** `purge_documents` needs `request` / `current_user` for the hold guard, and the loop has neither. It is an honest failed history version, not an orphan, because its row still owns its path.
- Recorded residual (out of scope): a later purge removes only the doc the item points at, so retired earlier versions this watch minted stay behind. The modify arm already behaves this way, and this phase does not change it.

## §3 D-15 audit: all 7 minter callers' enqueue-failure arms

Caller inventory is pinned by `tests/unit/test_280_minter_sequence.py:595-627` (`_EXPECTED_CALLERS`). This was re-read at HEAD.

| # | Caller | Mint site | What happens when enqueue fails | Needs D-12? |
|---|---|---|---|---|
| 1 | `/documents/upload` | `api/documents.py:615` | asyncpg `insert_ingestion_job` fails (`:684-695`), then the service-role insert fails (`:702-713`). It only does `log.error`, then returns 201 with a pending row and no job. ⚠ With `ingest_worker_enabled=False`, the BackgroundTask at `:716-728` still ingests, so the row is NOT stuck in that mode. | **YES, and only when `ingest_worker_enabled` is true** (see §10) |
| 2 | watch new-file | `watch_service.py:344` | Bytes upload (`:375`), item upsert (`:382`) or `insert_ingestion_job` (`:394`) raises. The except arm (`:486-523`) marks the item `failed` and the doc (`doc_id` was set at `:357`) `failed` (`:507-517`). | Confirmed OK. ⚠ But see §6: in the dedup arm (`:359-372`) a raising upsert marks the **linked** doc failed |
| 3 | watch modify | `watch_service.py:422` | Bytes (`:436`) or enqueue (`:443`) raises → except arm marks the new doc failed. Confirmed OK. ⚠ But if **`read_file` (`:421`) raises**, `doc_id is None`, so `target_doc_id` falls back to `existing["document_id"]` (`:493`), which is the previous completed copy, and that copy is marked failed. | Already marks failed; **the target is wrong** (§6) |
| 4 | `import_service.import_single_file` | `sources/import_service.py:237` | `_enqueue_or_splice` (`:64-166`): a failed storage upload or a failed enqueue sets `enqueued=False`, then **BackgroundTask `splice_document` with the bytes in memory** (`:154-166`). It never strands the row. | No |
| 5 | `workspace_promote` | `api/workspace_promote.py:215` (`mint_or_link`) | Calls the same `_enqueue_or_splice` (`:462-472`, imported by name at `:85`) | No |
| 6 | `expert_install_service` | `:603` | Same `_enqueue_or_splice` (`:616-625`). The re-drive arm `_redrive_failed` (`:457-500`) also uses it. | No |
| 7 | `email_attachments` | `:357` (sync `mint_document_row`) | No queue at all: uploads (`:404-420`), then inline `ingest_document` (`:442-452`). The except arm marks the doc failed (`:467-474`). | No |

Residual for #4-#6: a BackgroundTask fallback is lost if the process restarts, which leaves `pending` with no job. D-14's heal covers that population too, because it finds stuck rows by state, not by door.

## §4 D-07 backfill: measured, and why it must be tightened

Live local DB, read-only, 2026-10-16:
- 122 items: 120 `present`, 1 `missing`, 1 `failed`. 121 have a doc.
- 5 watches: Team Docs (95 items), Q3 Plans (10), CV (9), INBOX (6), Finance (2).

| Predicate | Rows |
|---|---|
| D-07 as written (`d.source_connection_id = w.connection_id AND d.metadata->'source'->>'external_id' = i.external_id`) | **120** |
| …of which `d.created_at < w.created_at` (doc older than its watch, so the watch did not mint it) | **8**: 7 on `CV` (created 2026-09-05/06, watch created 2026-09-12), plus `245-UAT-finance-invoice.txt` (created 06:07:38, `Finance` watch created 06:10:36) |
| D-07 + `d.created_at >= w.created_at` | **112** |
| Gap `i.first_seen_at − d.created_at` over those 112 | max **1.58 s**, p99 1.13 s |
| Doc with no `source_connection_id` (the 280 WR-03 repro, `product-manager-business-card.jpg` on CV) | 1, linked under every variant |

**Why the 8 match D-07:** the manual import door (`import_service.import_single_file:213-248`) stamps the same `source_connection_id` and `metadata.source.external_id` as a watch mint. The watch then dedup-linked to those docs. D-07 cannot tell the two apart, so a purge of `CV` would delete 7 documents the person imported by hand.

**Recommended backfill predicate.** It is stricter than D-07 and still satisfies its "only when":
```sql
d.source_connection_id = w.connection_id
AND d.metadata->'source'->>'external_id' = i.external_id
AND d.created_at >= w.created_at                                   -- born after its watch
AND d.created_at BETWEEN i.first_seen_at - interval '10 minutes'   -- minted right before the item
                     AND i.first_seen_at                            --   row was first written
```
`first_seen_at` is set on INSERT only, and the upsert never rewrites it (`db/watches.py:620-630`), so it is the time of the first sighting. The 10-minute window covers a slow bytes upload between the mint and the item write.
- Residual: a manual import of the same file in the 10 minutes before the watch first saw it.
- Measured: 0 locally.
- Production count: owed (§12).

⚠ **Modify-arm docs carry no `metadata`**: `watch_service.py:422-433` passes no `metadata=`. A legacy item whose current doc came from a modify is therefore backfilled as linked, and kept. That is fail-safe.
- Optional, one line: pass the same `metadata` dict in the modify arm. This is SEED-253's "two writers" lesson again; the change is only needed for future provenance.
- The planner decides. It is not required for FIX-13, because runtime writes the marker directly.

## §5 Migration 209: concrete shape

Grants and RLS:
- `connector_watch_items` grants are **table-level** (`169:107-109`, mirrored at `full-schema-supplement.sql:432-434`). The live DB has **no column-level ACL** on that table: `pg_attribute.attacl` is null for every column (measured).
- A table-level GRANT covers columns added later, so the `connector_connections` column-grant trap (mig 150) does not apply. [CITED: postgresql.org/docs/current/sql-grant.html, where table privileges apply to all columns]
- RLS policies are row-level and unaffected. No function is created (use `DO` blocks), so D-19's SECURITY INVOKER / `PUBLIC` rule has nothing to apply to. `full-schema-supplement.sql` needs no change.

`ingestion_jobs` insert requirements (`153:13-30`, matching `full-schema.sql:2711-2730`):
- Only `document_id` and `user_id` are NOT NULL without a default. `org_id` is nullable.
- `status`, `stage`, `progress`, `retry_count`, `max_retries` and `next_run_at` have defaults.
- `documents.user_id` is NOT NULL.
- `ingestion_jobs` has no triggers.
- The table owner bypasses RLS (no FORCE), so the SQL-editor paste as `postgres` can insert. [ASSUMED for cloud: same as every prior data-bearing migration]

```sql
-- 209_watch_item_retry_and_purge_scope.sql  (name: planner's choice)
BEGIN;

-- §1 columns + ONE-SHOT backfill (re-run never overwrites runtime-written markers)
DO $$
DECLARE
  v_fresh  boolean := NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'connector_watch_items'
               AND column_name = 'minted');
  v_minted int := 0;
  v_linked int := 0;
BEGIN
  ALTER TABLE public.connector_watch_items
    ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS minted boolean NOT NULL DEFAULT false;

  IF v_fresh THEN
    UPDATE public.connector_watch_items i
       SET minted = true
      FROM public.connector_watches w, public.documents d
     WHERE w.id = i.watch_id AND d.id = i.document_id
       AND d.source_connection_id = w.connection_id
       AND d.metadata->'source'->>'external_id' = i.external_id
       AND d.created_at >= w.created_at
       AND d.created_at BETWEEN i.first_seen_at - interval '10 minutes' AND i.first_seen_at;
    GET DIAGNOSTICS v_minted = ROW_COUNT;
    SELECT count(*) INTO v_linked FROM public.connector_watch_items
     WHERE document_id IS NOT NULL AND NOT minted;
    RAISE NOTICE '209 backfill: % item(s) marked minted, % linked item(s) will be kept by a purge',
      v_minted, v_linked;
  ELSE
    RAISE NOTICE '209 backfill: skipped, columns already present (one-shot)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'connector_watch_items_failed_attempts_nonneg') THEN
    ALTER TABLE public.connector_watch_items
      ADD CONSTRAINT connector_watch_items_failed_attempts_nonneg CHECK (failed_attempts >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.connector_watch_items.failed_attempts IS
  'Phase 285 (FIX-12): consecutive failed reads of this item. Reset to 0 on success or a source version change; reads stop at 3 while state stays failed.';
COMMENT ON COLUMN public.connector_watch_items.minted IS
  'Phase 285 (FIX-13): true only when THIS watch minted document_id (minter is_duplicate=false). Purge deletes minted, unshared documents only. Default false = kept.';

-- §2 heal stuck pending rows (D-14). Enqueue FIRST, then fail what is left, in one txn.
DO $$
DECLARE v_enqueued int := 0; v_failed int := 0;
BEGIN
  INSERT INTO public.ingestion_jobs (document_id, user_id, org_id)
  SELECT d.id, d.user_id, d.org_id
    FROM public.documents d
   WHERE d.status = 'pending'
     AND d.created_at < now() - interval '1 hour'
     AND NOT EXISTS (SELECT 1 FROM public.ingestion_jobs j WHERE j.document_id = d.id)
     AND EXISTS (SELECT 1 FROM storage.objects o
                  WHERE o.bucket_id = 'documents' AND o.name = d.file_path);
  GET DIAGNOSTICS v_enqueued = ROW_COUNT;

  UPDATE public.documents d
     SET status = 'failed', ingestion_step = 'failed',
         error_message = 'This file was never read, because its upload did not finish. Please upload it again.'
   WHERE d.status = 'pending'
     AND d.created_at < now() - interval '1 hour'
     AND NOT EXISTS (SELECT 1 FROM public.ingestion_jobs j WHERE j.document_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM storage.objects o
                      WHERE o.bucket_id = 'documents' AND o.name = d.file_path);
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  RAISE NOTICE '209 heal: % stuck row(s) enqueued (bytes present), % marked failed (no bytes)',
    v_enqueued, v_failed;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- VERIFY — run after applying. Every row must read PASS.   (the 207/208 `with checks` convention)
--   with checks(what, ok) as (values
--     ('failed_attempts int NOT NULL DEFAULT 0', exists(select 1 from information_schema.columns where table_schema='public' and table_name='connector_watch_items' and column_name='failed_attempts' and data_type='integer' and is_nullable='NO' and column_default='0')),
--     ('minted boolean NOT NULL DEFAULT false',  exists(select 1 from information_schema.columns where table_schema='public' and table_name='connector_watch_items' and column_name='minted' and data_type='boolean' and is_nullable='NO' and column_default='false')),
--     ('nonneg CHECK present', exists(select 1 from pg_constraint where conname='connector_watch_items_failed_attempts_nonneg')),
--     ('no minted item points at a doc older than its watch', not exists(select 1 from connector_watch_items i join connector_watches w on w.id=i.watch_id join documents d on d.id=i.document_id where i.minted and d.created_at < w.created_at)),
--     ('no column-level ACL appeared', not exists(select 1 from pg_attribute where attrelid='public.connector_watch_items'::regclass and attacl is not null)),
--     ('authenticated keeps table UPDATE', has_table_privilege('authenticated','public.connector_watch_items','UPDATE')),
--     ('anon has no SELECT', not has_table_privilege('anon','public.connector_watch_items','SELECT')),
--     ('no stuck pending row older than 1h without a job', not exists(select 1 from documents d where d.status='pending' and d.created_at < now()-interval '1 hour' and not exists(select 1 from ingestion_jobs j where j.document_id=d.id)))
--   ) select case when ok then 'PASS' else 'FAIL' end as status, what from checks;
```

Idempotency:
- The second run adds nothing and skips the backfill.
- The heal finds 0 rows, because healed rows now have a job or are `failed`.
- `now()` is the transaction start, so the INSERT-then-UPDATE pair is consistent.

Local measurement:
- Stuck rows, pending with no job (any age or over 1 h): **0**. The heal is a no-op locally.
- The backfill would mark 112 items minted.

## §6 FIX-12 implementation shape (`watch_service.sync_watch`)

1. **Routing:** `existing is None` OR (`existing.state == 'failed'` and eligible) → the **existing new-file body**, so it stays 2 minter call sites.
   - Eligible means `failed_attempts < 3` OR `str(item.modified_at or "") != existing.source_version` (D-01 reset).
   - A `failed` item past the cap with an unchanged version is **not read**. It is added to `still_failed` and `counts["errors"] += 1`.
   - ⚠ A `failed` item must never fall through to the modify or rename branches. Today the rename branch (`:464-477`) would flip a failed item to `present` with no doc, and the modify branch mints without `metadata`.
2. **Counts:** a landed retry counts as `new`.
   - ⛔ Do not add a key. `set(counts)` is pinned to the six keys (`test_watch_service.py:395`, `test_watch_sync_runs.py:203`), and `release_watch` binds exactly six counters (`db/watches.py:370-375`).
3. **Attempts are computed in Python, written in the same upsert:**
   - `prior = 0 if version_changed else existing.failed_attempts`.
   - The error arm passes `failed_attempts=prior+1`.
   - Success upserts pass `failed_attempts=0`.
   - New params on `upsert_watch_item`: `failed_attempts: int | None = None`, `minted: bool | None = None`.
   - SQL: INSERT values `COALESCE($13::int, 0)` / `COALESCE($14::boolean, false)`; DO UPDATE `failed_attempts = COALESCE($13::int, connector_watch_items.failed_attempts)`, `minted = COALESCE($14::boolean, connector_watch_items.minted)`. Reference the parameter, not `EXCLUDED`: Postgres checks NOT NULL on the proposed row before conflict resolution, so a NULL in VALUES would fail even on the update path. [ASSUMED: standard ON CONFLICT behaviour; the COALESCE form sidesteps it either way.]
   - One write per item keeps `test_watch_service.py:369`'s `mock_upsert.await_count == 2` true.
   - Add `failed_attempts, minted` to `_WATCH_ITEM_COLUMNS` (`db/watches.py:45-49`). `WatchItemResponse` (`models/source.py:24-41`) ignores extra keys, so there is no API change.
4. **D-04 typed error:** `f"{type(e).__name__}: {e}" if str(e) else type(e).__name__`, capped at about 500 characters. An empty-message `httpx.ConnectError` gives `"ConnectError"`. `IOError` gives `"OSError: Corrupt header…"`, which still satisfies `"Corrupt header" in last_error` at `test_watch_service.py:375`. Use the same string in the doc's `error_message` (`:513`).
5. **⚠ Error-arm correction (found in research):** mark a document `failed` **only if this iteration minted it** (`mint_res is not None and not mint_res.is_duplicate`). Never mark the fallback `existing["document_id"]` (`:493`), and never mark a dedup-linked doc.
   - Still record that `document_id` on the item, so the item keeps its link.
   - Why: today a transient `read_file` error in the modify arm marks the previous completed, is_latest copy failed (`:493` + `:507-517`). That hides a good document from retrieval over a network blip.
   - This sits inside FIX-12's path.
6. **D-02 / D-03 summary:** collect `(name, exc_type)` for this run's failures, plus past-cap `failed` items **seen in this listing**. For past-cap items the type is parsed from the stored `last_error` prefix (`split(":", 1)[0]`, falling back to `"unknown error"` for legacy `''`).
   - Format: `"{n} file(s) failed: a (T), b (T), c (T) and {n-3} more"`. Truncate each name to about 80 characters and the whole string to about 500.
   - `count_errors = len(that list)`.
   - Open question (§13): `failed` items absent from the listing.
7. **D-03 goes to the RUN ROW ONLY** (finding 3 in the Summary).
   - Add `run_error: str | None = None` to `release_watch`. Bind `$7` as `run_error if run_error is not None else error`, so `test_watches_db.py`'s positional pins (`args[5]` status, `args[8]`, `args[9:15]`) are unchanged.
   - The happy path calls `release_watch(..., error=None, run_error=summary)`. `connector_watches.last_error` stays NULL on success, so `WatchRowCard`'s pill (`:240/:341`) cannot misread a filename.
   - This is within D-03, which specifies the *run row*.
8. **`RunHistoryList.tsx`:** edit the comment at `:167-174` only. Its test twin is the comment at `RunHistoryList.test.tsx:362`.
   - Recommended: add one case. A `success` row whose `last_error` is `"1 file failed: x.txt (ConnectError)"` and `count_errors: 1` renders `sources-run-partial`, renders no `sources-fail-reason`, and does not show the raw string in `textContent`.
   - Adding a vitest case means running the count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`). A per-file pin may need raising.

## §7 Where existing assertions will move (plan these as deliberate amends)

| Suite | What breaks after the fix | Amend |
|---|---|---|
| `tests/integration/test_280_purge_bytes_live.py` `Subject.watch_with` (`:102-117`) | Its items are inserted with no `minted`. After 209 they default to false, so both doors keep everything and `purged_count == 2` (`:213`) fails | Seed `minted=true` for the watch's own docs (a `minted` kwarg defaulting true), with a comment naming FIX-13 |
| `tests/unit/test_275_delete_paths.py` `_patch_watch` (`:470-481`), `_missing_items` (`:561-562`), `_Con.fetch` (`:438-439` returns `self.items` for ANY SQL) | Items lack `minted`. A new scope query issued through `_Con.fetch` would get the items back as "other references" | Patch the new scope helper by name (`monkeypatch.setattr(sources, "watch_purge_scope", …)`), or make the fake SQL-aware. Re-exported helpers are used by `test_280_purge_bytes.py:27-45` |
| `tests/unit/test_280_purge_bytes.py:174` | Still passes (the stub DELETE returns 2 rows), but its comment *"purged_count stays len(doc_ids)"* becomes false | Update the comment to D-09 |
| `tests/integration/test_275_disposition.py` `_Storage._Bucket.remove` (`:56-57`) returns **None** | After D-10, `None` means nothing was confirmed, so every path goes to `bytes_not_removed`. No current assertion reads those keys (grep), but the fake becomes unrealistic | Return `[{"name": p} for p in paths]` |
| `tests/unit/test_280_minter_sequence.py:595-627` | Fires if the retry adds a 3rd minter call in `watch_service.py` | Route through the existing branch (§6.1); do not edit the pin |
| `RunHistoryList.test.tsx:362` | Comment only | Update the comment |

## §8 FIX-13: purge scope (D-06/D-08/D-09)

**Marker write rules.** These refine D-06 and are recorded as M-rules for the planner.
- M-1: the minter answers `is_duplicate=False` → `minted=True`.
- M-2: `is_duplicate=True` **and** the returned id equals the item's current `document_id` → pass `minted=None`, which keeps the existing value. This happens on a modify with unchanged bytes and on a retry against a live doc.
- M-3: `is_duplicate=True` with a different id → `minted=False`.
- M-4: the rename arm, the error arm and `update_item_state` pass nothing, so the marker is preserved.

**One SQL helper in `db/watches.py`** (D-20: not inline in the doors; `document_purge.purge_documents` stays watch-agnostic and keeps its signature):
```sql
-- watch_purge_scope(pool, watch_id, states: list[str] | None) -> (item_ids, purge_doc_ids, kept_doc_ids)
WITH scope AS (
  SELECT id, document_id, minted FROM connector_watch_items
   WHERE watch_id = $1 AND ($2::text[] IS NULL OR state = ANY($2::text[]))
)
SELECT s.document_id,
       bool_or(s.minted) AS minted,
       EXISTS (SELECT 1 FROM connector_watch_items o
                WHERE o.document_id = s.document_id
                  AND o.id NOT IN (SELECT id FROM scope)) AS shared
  FROM scope s WHERE s.document_id IS NOT NULL
 GROUP BY s.document_id;
-- plus SELECT id FROM scope for the item ids
```
- Purge set: `minted AND NOT shared`. Kept: everything else.
- "Referenced by another item" means **any item outside the purge scope**: other watches, plus the PRESENT items of the same watch for door 2. Two identical files in one watched folder mint once and link once, so a missing minter item must not delete the doc a present sibling still uses.
- D-08 also protects the overlapping-watch case, where two watches on one connection see the same external id and both backfill as minted.

**Doors (`api/sources.py`):**
- Door 1 (`:331-341`) calls `watch_purge_scope(pool, watch_id, None)`.
- Door 2 (`:457-488`) calls it with `['missing','unauthorized']` and still deletes **all** scope item rows, linked ones included (unlinking is not deleting).
- `deleted = await document_purge.purge_documents(... purge_ids ...)` and `purged_count = len(deleted)` (D-09). Call it as `document_purge.purge_documents`: the `purge_documents` query parameter shadows a by-name import (ledger, 280 close).
- `WatchPurgeResponse` (`models/source.py:110-113`) gains `kept_count: int = 0`.
- The `message` is the only text the person sees (`WatchedFoldersSection.tsx:350` renders `res.message`), so make it honest. Example: *"Purged 2 missing files. Kept 1 that is also in your Library from another source or a hand upload."* No frontend change.
- ⚠ Door 1 returns **204 No Content** (`:309-312`), so D-09's receipt fields apply to door 2 only. Door 1 logs the kept count. Changing door 1's status code would be a client-visible change; recommend against it.
- ⚠ Behaviour change, stated: the hold guard now receives only the purge set. A held **linked** doc no longer makes the purge 409, because it is not being deleted. The live held-refusal case keeps passing because its held doc is seeded `minted=true`.
- Accepted residual: between the scope read and the DELETE, another watch could link the doc. The window is milliseconds and the outcome is watch B's item `document_id → NULL` (`ON DELETE SET NULL`, `169:32`), not data loss of a hand upload.

## §9 D-10: `remove()` return shape (MEASURED)

`storage3` 2.29.0 `remove()` returns `response.json()` (`venv/Lib/site-packages/storage3/_sync/file_api.py:360-374`). The same version is pinned for supabase, postgrest and storage3.

Measured against local storage (service role) on 2026-10-16: `remove(["zz-285-research-probe/a.txt", "zz-285-research-probe/never-existed.txt"])` returned ONE dict, `{'name': 'zz-285-research-probe/a.txt', 'bucket_id': 'documents', …}`. The nonexistent path was **silently omitted**, with no error.

So:
```python
res = await run_in_threadpool(lambda: storage.storage.from_(STORAGE_BUCKET).remove(paths))
confirmed = {o.get("name") for o in (res or []) if isinstance(o, dict)}
removed.extend(p for p in paths if p in confirmed)
not_removed.extend(p for p in paths if p not in confirmed)
```
Keep exactly ONE `try` in `remove_document_bytes`. `test_280_purge_bytes.py:239-242` pins `len(tries) == 1`, and purge_documents has zero.

⚠ **Effect on `retention/disposition.py`** (imports it at `:42`, uses it at `:466-505`, with a **service-role** client from `api/retention.py:645`):
- A path that was **already absent** from storage, such as a doc whose bytes never landed (BUG-260905-08 rows), now lands in `bytes_not_removed`.
- `DeleteBatchCard.tsx:183` counts it, so the operator sees one more "not removed" file than truly remains.
- This is over-reporting in the safe direction (Storage did not confirm). It is recorded in §13 as an open question, not a blocker.

## §10 FIX-14: D-12 shape in `/upload`

- Track `enqueued = False`. Set it True after the asyncpg insert (`:688-693`) or the service-role insert (`:703-711`) succeeds.
- After both fail, **and only if `getattr(settings, "ingest_worker_enabled", True)`**, mirror `:659-671`:
  - `run_in_threadpool(lambda: service_supabase.table("documents").update({...failed...}).eq("id", doc["id"]).eq("status", "pending").execute())`. The `.eq("status","pending")` guard keeps the write from clobbering anything that already moved.
  - The refusal write has its own `try/except log.exception` (no double fault).
  - Then `response.status_code = 201` and `return {**doc, "status": "failed"}`.
  - Skip the audit task exactly as the storage-fail arm does.
- With the worker disabled, the BackgroundTask at `:716-728` ingests the row anyway, so D-12 must not fire there.
- Race note (D-19), assessed:
  - The asyncpg insert could commit and then raise on the way back, for example a dropped connection. The fallback would then insert a second job (there is no unique index), and if both of those raise, the doc is marked failed while a job exists.
  - The worker does not check doc status (`ingestion_queue_service._process_job:223-240` calls `splice_document` directly), so it would ingest the row and overwrite the status. That is a self-healing outcome, not data loss.
  - Probability is very low, and recording it is enough.
- Residual race (stated): a same-bytes upload in the milliseconds between mint and the D-12 write gets the in-flight copy as `already_in_library`, and that copy then turns `failed`. The person sees a failed document and re-uploads. Accept and record.

## §11 How migrations reach the LOCAL DB here (the real method)

- Phases 178, 275, 207 and 208 used a **loopback-only asyncpg apply script**: `scripts/apply_migration_208.py`. It is a hard-coded DSN `postgresql://postgres:postgres@127.0.0.1:54322/postgres` with a `_refuse_non_local()` guard.
  - Modes: `--apply` (applies the file unmodified, with its own `BEGIN/COMMIT/NOTIFY`, runs VERIFY, applies a second time and asserts the result is identical), `--dry-run` (outer transaction with the file's BEGIN/COMMIT stripped, then ROLLBACK) and `--verify-only`.
  - Run with `backend/venv/Scripts/python scripts/apply_migration_209.py --dry-run`, then `--apply`, under the local-DB lock.
  - Worktree executors have no browser, so this script is the method. The file stays pasteable for production.
- Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit `supabase/full-schema.sql` with the migration.
- `scripts/` is EXEMPT from the hot-file ledger gate (`check-hot-file-ledger.cjs:51-65`), and so are migrations.

## §12 Production reads owed before the paste (Supabase MCP `execute_sql`, read-only, free)

```sql
-- D-14 pre-count
select count(*) filter (where exists (select 1 from storage.objects o where o.bucket_id='documents' and o.name=d.file_path)) as would_enqueue,
       count(*) filter (where not exists (select 1 from storage.objects o where o.bucket_id='documents' and o.name=d.file_path)) as would_fail
  from documents d
 where d.status='pending' and d.created_at < now()-interval '1 hour'
   and not exists (select 1 from ingestion_jobs j where j.document_id=d.id);
-- D-07 backfill pre-count (as written vs tightened)
select count(*) filter (where true) as d07, count(*) filter (where d.created_at >= w.created_at
         and d.created_at between i.first_seen_at - interval '10 minutes' and i.first_seen_at) as tightened
  from connector_watch_items i join connector_watches w on w.id=i.watch_id join documents d on d.id=i.document_id
 where d.source_connection_id = w.connection_id and d.metadata->'source'->>'external_id' = i.external_id;
```

## Standard Stack

No new packages. Everything uses what is installed: FastAPI, asyncpg, supabase-py / storage3 / postgrest **2.29.0** (measured in `backend/venv/Lib/site-packages`), pytest, and for the frontend vitest only if the optional RunHistoryList case is added.

## Package Legitimacy Audit

Not applicable. This phase installs no external packages. slopcheck was not run because there is nothing to check.

## Architecture Patterns

### Data flow (FIX-12 / FIX-13 / FIX-14)
```
claim_due_watches ─▶ sync_watch(watch)
   listing (paged, H-5 complete flag)
   for each listed file:
     existing? ──no──────────────┐
     state=failed & eligible? ───┤──▶ NEW-FILE BODY: read_file ─▶ mint (dedup legs: completed, in-flight, 23505)
     state=failed & past cap ─▶ still_failed (no read)          │      is_duplicate? ─▶ upsert(minted per M-1..M-3)
     missing/unauthorized ─▶ restore                             │      else upload bytes ─▶ upsert(minted=true, attempts=0) ─▶ enqueue job
     version changed ─▶ modify body                              └─ except ─▶ upsert(state=failed, attempts=prior+1, typed last_error)
     name changed ─▶ rename                                                 └─ mark doc failed ONLY if minted this iteration
   deleted arm (H-5 / WR-03 guards, unchanged)
   release_watch(status=success, error=None, run_error=summary(failures + still_failed), counts.errors=len)

Door 1 / Door 2 ─▶ watch_purge_scope (SQL: minted AND NOT referenced outside scope)
   ─▶ document_purge.purge_documents(purge_ids): hold_guard ─▶ DELETE rows (user JWT) ─▶ remove bytes (confirmed names only)
   ─▶ purged_count = len(deleted), kept_count = len(kept)

/upload ─▶ mint ─dup─▶ 200 already_in_library
              └─new─▶ store bytes ─fail─▶ mark failed, 201 {status: failed}
                         └─ok─▶ enqueue (asyncpg ▶ service-role) ─both fail & worker on─▶ mark failed (eq status pending), 201 {status: failed}
```

### Anti-Patterns to Avoid
- A third `async_mint_document_row(` call in `watch_service.py`. It trips the caller-inventory fence and duplicates the new-file body.
- Writing the D-03 summary through `release_watch(error=…)`. That also writes `connector_watches.last_error`, which feeds the pill.
- Using `EXCLUDED.minted` / `EXCLUDED.failed_attempts` in the upsert. That overwrites preserved values with NULL or defaults.
- Reading `source_connection_id` as the "minted" test. That is the roadmap's named failure mode.
- Adding a counts key or a new run status. Both are pinned, and status is free text by design.
- A by-name import of `assert_none_held` / `purge_documents` in `sources.py`. D-31 forbids the first, and the query param shadows the second.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Retrying a failed item | A re-drive that resets a failed row in place | The minter via the existing new-file branch | Dedup, versioning, the 23505 winner and FIX-02 already live there |
| "What did storage delete" | A pre-list / post-list of `storage.objects` | `remove()`'s return list (measured) | No TOCTOU, no extra round trip |
| Purge-set logic | Python set arithmetic across N queries | One SQL statement in `db/watches.py` | Atomic read; a patchable seam for the unit fakes |
| Applying 209 locally | `supabase db push`, or ad-hoc psql | `scripts/apply_migration_209.py` modelled on 208 | Project precedent; loopback-only; idempotency proven |

## Runtime State Inventory

| Category | Items Found | Action |
|---|---|---|
| Stored data | Local: 122 watch items (1 `failed` = `team-note-058.txt`, `document_id NULL`, `last_error ''`); 112 / 120 backfill candidates; 0 stuck pending. Production: unmeasured (§12) | Data migration (209 backfill + heal), plus code writes for new rows |
| Live service config | None. Watch rows hold no new config; no env var changes (D-23) | None |
| OS-registered state | None | None |
| Secrets/env vars | None changed. SC#5 needs the existing OneDrive token (connection `34e44621…`) to refresh | None, or ⛔ SC#5 if refresh fails |
| Build artifacts | `supabase/full-schema.sql` must be regenerated after 209 | `bash scripts/regenerate-full-schema.sh` |

## Common Pitfalls

1. **Pitfall: the backfill misclassifies manual imports.** D-07 as written matches 8 real local rows the watch only linked. Use the §4 predicate and read the production count first.
2. **Pitfall: a vacuous scope fake.** `_Con.fetch` in `test_275_delete_paths.py` returns the items for every SQL, so a scope query through it reports every doc as shared. A green "kept" assertion would then prove nothing. Patch the helper, or make the fake SQL-aware, and add one case where the purge DOES delete a minted, unshared doc.
3. **Pitfall: RED that is not RED.** D-11 / D-16 cases must run at base (`git stash` or a base worktree) and fail for the bug's reason. Seed the "linked" item in D-11 **without** naming the `minted` column, so the test is valid before and after 209.
4. **Pitfall: the pill flip.** Write the summary to the run row only (§6.7). Add a backend pin that the happy-path `release_watch` gets `error=None`.
5. **Pitfall: `ingest_worker_enabled=False`.** D-12 must not fire, because the BackgroundTask ingests the row.
6. **Pitfall: the cap never resets.** The error arm writes `source_version = item.modified_at` (`:502`), so after a failed modify the stored version already equals the listing. The reset rule compares the listing with the stored version **before** this run's write. That is correct, but test it explicitly: a past-cap item with a changed version is read again.
7. **Pitfall: lock collisions.** Live integration suites and the migration apply share :54322. Take the noclobber lock and keep one vitest gate per session (memory: local-DB lock).

## Code Examples

The existing patterns to reuse are cited above with file:line. The key ones:
- The storage-fail refusal arm: `api/documents.py:638-671`.
- The never-strand fallback, for contrast: `sources/import_service.py:108-166`.
- The live purge harness (`Subject`, `_door1`, `_door2`, `_object_count`, positive control): `tests/integration/test_280_purge_bytes_live.py:61-187, 265-284`.
- Calling a route coroutine directly with live clients: `test_280_purge_bytes_live.py:180-191`.
- The unit upload TestClient pattern: `tests/unit/test_280_minter_sequence.py:546-579`.
- The watch-service unit harness (patches by module path): `tests/unit/services/test_watch_service.py:13-110, 318-396`.
- The SC#5 driver precedent, which patches `MicrosoftGraphSourceAdapter.read_file` at class level and calls `WatchService(pool, supabase=get_supabase()).sync_watch(w)`: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/resync_a.py:14-40` (outside the repo).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Cloud SQL-editor paste runs as the table owner, so the heal's INSERT into `ingestion_jobs` bypasses RLS | §5 | Heal insert refused in prod; the transaction rolls back (fail-closed). Prior data migrations ran the same way |
| A2 | Postgres validates NOT NULL on the proposed INSERT row before ON CONFLICT resolution | §6.3 | None: the recommended `COALESCE($n, default)` works either way |
| A3 | Production has a similar manual-import-then-watch population | §4 | Only changes the count; the tightened predicate is safe either way. §12 reads it |
| A4 | The OneDrive token for connection `34e44621…` can still be refreshed | SC#5 | SC#5 recorded ⛔ with the reason (D-18) |

## Open Questions

1. **`failed` items absent from the listing.**
   - Known: D-02 says "any item of the watch still failed". A failed item deleted at source stays `failed` forever, because the deletion arm only considers `state == 'present'` (`:526-529`).
   - Unclear: should it be counted on every run, forever?
   - Recommendation: count only failed items **seen in this listing** and leave unlisted ones untouched (H-5 unchanged). The planner confirms.
2. **D-10's semantics for retention.**
   - Known: an already-absent path now reports as `bytes_not_removed` in the disposition receipt.
   - Unclear: is that over-report acceptable?
   - Recommendation: accept it (it fails safe) and note it in the 285 threat model and the ledger.
3. **Optional modify-arm `metadata`.**
   - Known: modify-arm docs carry no `metadata` (§4).
   - Unclear: should the one-line change ship here?
   - Recommendation: include it in plan 1 only if the planner is willing to amend `test_watch_service` pins. Otherwise defer it as a seed note.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Local Postgres :54322 | migration apply, live suites, probes | ✓ (probed) | PostgreSQL 17.6 | — |
| Local Storage/PostgREST :54321 | D-11 / D-16 live tests | ✓ (upload and remove probed) | storage3 2.29.0 client | — |
| `backend/venv` | all backend tests | ✓ | — | — |
| Local-DB lock file | serialisation | free at research time | — | — |
| OneDrive token (conn `34e44621…`) | SC#5 | unverified | — | ⛔ record (D-18) |
| Supabase MCP (prod reads) | §12 counts, `get_advisors` | not in this agent's toolset | — | orchestrator or operator runs it |

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is included because the orchestrator asked for it explicitly. `tdd_mode: true`.

### Test Framework
| Property | Value |
|---|---|
| Framework | pytest (backend), vitest (frontend, only if the optional case is added) |
| Config | `backend/pytest.ini` / `tests/conftest.py`; integration skip-guards `tests/integration/_rls_harness.requires_pg` + `_271_gotrue_users.require_gotrue` |
| Quick run | `cd backend && venv/Scripts/python -m pytest <files> -q` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed, failing SET equal to a re-run base) |
| Live suites | `cd backend && venv/Scripts/python -m pytest tests/integration/test_280_purge_bytes_live.py tests/integration/test_280_same_bytes_live.py tests/integration/test_280_cr01_two_org_live.py tests/integration/test_285_*.py -q -rs` (under the lock; a skip is NOT a pass) |

### Phase Requirements → Test Map
| SC / Req | Behaviour | Type | Command | Exists? |
|---|---|---|---|---|
| SC#1 FIX-12 | failed item, attempts < 3 → `read_file` called and lands `present`, attempts reset | unit, **RED first** | `pytest tests/unit/services/test_285_watch_retry.py -q` | ❌ new |
| SC#1 | attempts = 3, same version → not read; `count_errors` includes it; run_error names it with its type | unit | same file | ❌ |
| SC#1 | version change resets the cap | unit | same file | ❌ |
| SC#1 | empty-message `httpx.ConnectError` → item `last_error == "ConnectError"` | unit | same file | ❌ |
| SC#1 | happy path calls `release_watch(error=None, run_error=…)` (pill-safe) | unit | same file + `tests/unit/db/test_watches_db.py` (new case: `$7` binding) | ❌ |
| SC#1 | modify-arm `read_file` failure does NOT mark the existing doc failed (§6.5) | unit, RED first | same file | ❌ |
| SC#1 | still exactly 2 minter call sites | fence | `pytest tests/unit/test_280_minter_sequence.py -q` | ✅ |
| SC#2 FIX-13 | dedup-linked hand upload survives door 1 AND door 2: row + `storage.objects` per path | live integration, **RED first** | `pytest tests/integration/test_285_purge_scope_live.py -q -rs` | ❌ new |
| SC#2 | minted, unshared doc is still purged with bytes; shared doc kept; `purged_count == len(deleted)`; `kept_count` | live + unit | same + `tests/unit/test_285_purge_scope.py` | ❌ |
| SC#2 | M-2: duplicate returning the same id keeps `minted` | unit | `test_285_watch_retry.py` | ❌ |
| BUG-05 | stub `remove` returns a subset → the missing path is in `not_removed` | unit | `pytest tests/unit/test_280_purge_bytes.py tests/unit/test_285_purge_scope.py -q` | ❌ (new case) |
| SC#3 FIX-14 | both enqueue paths fail → doc `failed`, response 201 `status: failed`; then same bytes in folder B → minted, job exists | live integration, **RED first** (plus a unit twin) | `pytest tests/integration/test_285_stuck_pending_live.py -q -rs`; `pytest tests/unit/test_285_upload_enqueue_failure.py -q` | ❌ |
| SC#3 | `ingest_worker_enabled=False` → D-12 does not fire | unit | `test_285_upload_enqueue_failure.py` | ❌ |
| SC#4 | in-flight same bytes → one copy, no 409 (FIX-02); purge still removes bytes (DEBT-10) | live (existing) | `pytest tests/integration/test_280_same_bytes_live.py tests/integration/test_280_purge_bytes_live.py -q -rs` | ✅ (fixture amend §7) |
| 209 | file shape: columns, one-shot backfill guard, heal ordering, no `CREATE FUNCTION`, VERIFY block | unit, text shape | `pytest tests/unit/test_285_migration_209_shape.py -q` (pattern: `test_275_migration_204_shape.py`) | ❌ |
| 209 | applies twice identically; VERIFY all PASS | script | `backend/venv/Scripts/python scripts/apply_migration_209.py --dry-run` then `--apply` | ❌ |
| SC#5 | live: watch A re-sync lands `team-note-058.txt` (105/105 with B); forced one-shot ConnectError → typed failure, then lands | manual live drive (operator OK, D-18) | out-of-repo driver extending `agentic-rag-280/resync_a.py` | ❌ |

### Sampling Rate
- Per task: the targeted files above.
- Per wave: `node scripts/check-backend-unit-baseline.cjs` plus the live suites under the lock.
- Phase gate: full baseline (failing SET equal to base), the live suites green, `check-hot-file-ledger.cjs`, `check-claude-md-size.cjs`, and the vitest count gate only if the frontend test was added.

### Wave 0 Gaps
- [ ] `tests/unit/services/test_285_watch_retry.py`
- [ ] `tests/unit/test_285_purge_scope.py`
- [ ] `tests/unit/test_285_upload_enqueue_failure.py`
- [ ] `tests/unit/test_285_migration_209_shape.py`
- [ ] `tests/integration/test_285_purge_scope_live.py` (reuse the `Subject` pattern; for the strongest evidence, drive the dedup link through `WatchService.sync_watch` with a stub adapter rather than seeding the item)
- [ ] `tests/integration/test_285_stuck_pending_live.py`
- [ ] `scripts/apply_migration_209.py`

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V4 Access Control | yes | Purge scope: minted AND unshared (SQL). User-JWT DELETE under RLS. The hold guard goes first, called via the module attribute (D-31) |
| V5 Validation | yes, light | Typed error strings capped. Raw `last_error` never reaches JSX (T-235-12): success rows do not render it, and the watch row stays NULL on success |
| V8 Data Protection | yes | No data loss: the fail-safe backfill (§4), kept-on-shared (D-08), and bytes removed only for rows deleted |
| V2/V3/V6 | no | — |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Purge deletes a doc the watch did not mint | Tampering / data loss | `minted` marker plus the tightened backfill plus the D-08 shared check; RED live test (SC#2) |
| A copied provenance field fools the test | Spoofing | The marker is never derived from `source_connection_id` at runtime (D-06) |
| T-275-12 ordering broken | Tampering | `purge_documents` body unchanged; the order fence is `test_280_purge_bytes.py:225-232` |
| Hold refusal costs bytes | Data loss | Unchanged; live held case at `test_280_purge_bytes_live.py:227-249` |
| Heal enqueues a bytes-less row | Integrity | `EXISTS storage.objects` gate; VERIFY row |
| D-12 races a worker | Integrity | Fires only after both inserts raised; `.eq("status","pending")`; worker-disabled mode excluded |
| Filename / exception text alters connection health | Spoofing (UI) | Summary written to the run row only (§6.7) |
| Grants drift with new columns | Elevation | Table-level grants cover the columns; VERIFY asserts no column ACL, anon none, authenticated UPDATE. Run `get_advisors(security)` at deploy |

## Hot-file ledger (re-derived 2026-10-16 with the CLAUDE.md recipe)

| File | Triple | Scan-list row | G-5 |
|---|---|---|---|
| `backend/app/services/watch_service.py` | **7 / 5 / 643** (234, 235, 238, 240, 247) | ✅ (`HOT-FILE-LEDGER.md:11300`, matches) | FIRES. No CLAUDE.md FIRING row; add one if the planner follows the 280 precedent |
| `backend/app/db/watches.py` | **4 / 3 / 709** (234, 235, 247) | ✅ (`:11301`, matches) | FIRES. No CLAUDE.md row |
| `backend/app/services/document_purge.py` | **3 / 1 / 92** (row reads `2 / 1 / 87`, STALE) | ✅ (`:11534`) | young |
| `backend/app/db/ingestion_jobs.py` | 5 / 1 / 483 | ❌ **no row** | Not modified under this plan design (D-12 lives in `documents.py`); add a row only if touched |
| `backend/app/api/sources.py` | 10 / 4 / 698 | ✅ | FIRES; extraction discharged (280) |
| `backend/app/api/documents.py` | 98 / 38 / 2656 | ✅ | FIRES; D-12 inside the existing arm |
| `backend/app/services/ingest_splice.py` | 27 / 8 / 1138 | ✅ | FIRES; expected untouched |
| `backend/app/models/source.py` | 5 / 1 / 196 | ✅ (`:11313`) | no |
| `frontend/src/components/sources/RunHistoryList.tsx` | 4 / 2 / 273 (row reads `2 / 1 / 235`, STALE) | ✅ (`:11322`) | no |
| `backend/app/services/retention/disposition.py` | 5 / 2 / 836 | ✅ | not modified (D-10 is in `document_purge.py`) |
| `scripts/apply_migration_209.py`, `supabase/migrations/209_*.sql` | — | EXEMPT (`check-hot-file-ledger.cjs:51-65`) | — |

## Sources

### Primary (HIGH)
- Code at HEAD `e0d4f0589`, read directly: `watch_service.py`, `db/watches.py`, `document_purge.py`, `api/sources.py`, `api/documents.py`, `ingest_splice.py`, `sources/import_service.py`, `workspace_promote.py`, `expert_install_service.py`, `email_attachments.py`, `retention/disposition.py`, `db/ingestion_jobs.py`, `models/source.py`, `RunHistoryList.tsx`, `WatchRowCard.tsx`, `sourceHealthVocabulary.ts`, `WatchedFoldersSection.tsx`, `DeleteBatchCard.tsx`
- Migrations `153`, `169`, `208`; `full-schema.sql`; `scripts/apply_migration_208.py`; `scripts/check-hot-file-ledger.cjs`
- Live local DB probes (read-only, asyncpg :54322) and a local storage `remove()` probe (one temp object, removed)
- `storage3` 2.29.0 source in `backend/venv`

### Secondary
- PostgreSQL GRANT semantics (table privileges cover all columns) [CITED: postgresql.org/docs/current/sql-grant.html]

## Metadata
- Standard stack: HIGH. No new dependencies.
- Architecture: HIGH. Read and measured.
- Pitfalls: HIGH for the measured ones (§4, §6.5, §6.7, §7, §9); MEDIUM for A1/A2.
- Valid until about 2026-11-15, or the next commit touching the files listed in the ledger table.
