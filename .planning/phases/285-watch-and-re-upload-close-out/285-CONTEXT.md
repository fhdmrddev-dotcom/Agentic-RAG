# Phase 285: Watch and Re-upload Close Out - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Repair only. This phase closes the three major bugs found during Phase 280, plus one minor fold:

- **FIX-12** (`BUG-261014-02`): a watched file whose download fails once is fetched again on a later
  sync. Until it lands, the failure stays visible with its cause.
- **FIX-13** (`BUG-261014-03`): purging a watch's documents deletes only what that watch minted.
- **FIX-14** (`BUG-261014-04`): a document whose ingest never started does not absorb later uploads of
  the same bytes.
- **Folded:** `BUG-261014-05` (minor). `remove_document_bytes` reports only the paths Storage actually
  deleted.

There is **no new user capability**, **no retry-policy UI**, and **no frontend change** (UI hint: no).
One migration (**209**) carries all of this phase's schema and data changes.

</domain>

<decisions>
## Implementation Decisions

### Measured at discuss (2026-10-16, develop at `2856a8a17`): the starting point
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

### Watch download retry (FIX-12)
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

### Purge scope (FIX-13)
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

### Stuck pending (FIX-14)
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

### Live re-drive (SC#5)
- **D-17: Real item plus one forced failure.**
  - **Step 1:** re-sync the existing watch A (`0aa5c6ac-062a-4ff6-9a63-4acfed09a5d6`, `/Team Docs`) as it is. The real legacy failure `team-note-058.txt` must be re-read and land. Watch A plus watch B (`05d93b24-…`, 10 files) then reach **105/105**.
  - **Step 2:** a driver script outside the product wraps `adapter.read_file` to raise an empty-message `httpx.ConnectError` **once** for one named file.
    - Sync 1 shows the item `failed` with a typed `last_error`, and the run row has `count_errors ≥ 1` with `last_error` naming the file.
    - Sync 2 lands it.
  - **No product test knob** (280 D-14).
- **D-18: Claude drives after the operator's explicit OK** (as 280 D-15). Claude states the exact drive, waits for a yes, runs it, and reads the DB.
  - If the Microsoft token cannot be refreshed, SC#5 is recorded ⛔ with the reason and is never omitted.
  - On a pass: close `BUG-261014-02` with `verified_closed_by`, and update `280-LIVE-EVIDENCE.md` SC#2's owed line.

### Gates, security and guardrails
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The bugs being closed
- `.planning/reported-bugs/BUG-261014-02-watch-item-that-fails-once-is-never-retried.md`: FIX-12 observation, live evidence ids
- `.planning/reported-bugs/BUG-261014-03-watch-purge-deletes-a-manual-upload-it-only-dedup-linked.md`: FIX-13
- `.planning/reported-bugs/BUG-261014-04-stuck-pending-row-absorbs-every-same-bytes-reupload.md`: FIX-14, the stuck-row trigger query
- `.planning/reported-bugs/BUG-261014-05-remove-document-bytes-counts-paths-storage-did-not-delete.md`: folded minor
- `.planning/ROADMAP.md` § Phase 285: the success criteria and the "How we'd know this failed" list
- `.planning/REQUIREMENTS.md`: FIX-12, FIX-13, FIX-14

### Phase 280 decisions this phase must not break
- `.planning/phases/280-in-once-out-clean/280-CONTEXT.md`: D-01..D-04 (same-bytes → 200 + `already_in_library`), D-11/D-12 (one purge helper, order binding), D-14/D-15 (live drive rules, no test knob), D-24 (folder-agnostic in-flight leg)
- `.planning/phases/280-in-once-out-clean/280-REVIEW.md`: WR-03, WR-04, IN-04, IN-05 and their fix-log entries
- `.planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md` § SC#2: watch A / B ids, the 104/105 measurement, the `/Team Docs` folder layout

### Code
- `backend/app/services/watch_service.py`: `sync_watch` (new-file `:326-401`, existing-file `:403-484`, error arm `:486-525`, `release_watch` `:576-587`)
- `backend/app/db/watches.py`: `release_watch` (`:263`), `get_watch_items` (`:556`), `upsert_watch_item` (`:593`)
- `backend/app/services/document_purge.py`: `purge_documents`, `remove_document_bytes`; the docstring's binding order rules
- `backend/app/api/sources.py`: both purge doors (`:316-349`, `:437-494`)
- `backend/app/api/documents.py`: `upload_document`, the duplicate arm (`:625`), the storage-fail arm (`:643-670`), the enqueue block (`:672-713`)
- `backend/app/services/ingest_splice.py`: `mint_document_row` (`:127`); the in-flight leg (`~:300-330`) stays untouched
- `backend/app/db/ingestion_jobs.py`: `insert_ingestion_job` (`:31`)
- `backend/app/services/retention/disposition.py`: the other caller of `remove_document_bytes`
- `frontend/src/components/sources/RunHistoryList.tsx`: `:166-175` (partial register), `:259-266` (`last_error` rendered only on failed rows)

### Schema
- `supabase/migrations/169_connector_watch_items.sql`: item table, state CHECK
- `supabase/migrations/172_connector_sync_runs.sql`: run row columns; status is free text by design
- `supabase/migrations/153_ingestion_jobs.sql`: job table, no unique on `document_id`
- `supabase/SETUP.md`: migration apply and regen rules

### Guardrails
- `docs/HOT-FILE-LEDGER.md`: sections for `ingest_splice.py`, `api/documents.py`, `api/sources.py`, `watch_service.py`, `db/watches.py`, `document_purge.py`
- `docs/DEPLOYMENT-WORKFLOW.md`: the parity checklist (migration 209 is seed/data-bearing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `document_purge.purge_documents`: the one purge body. FIX-13 narrows its input set and D-09 its receipt; the order logic is not rewritten.
- `classify_failure_cause` (`watch_service.py`) plus the run-row `failure_cause` column: they exist for failed ticks. D-03 does not need a new cause value, because the status stays success.
- The BUG-260905-08 storage-fail arm in `documents.py:643-670` is the exact template for D-12/D-13.
- 280's live-drive scripts (outside the repo, under `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/`) drove `WatchService.sync_watch` directly. That is the pattern D-17 step 2 extends with a one-shot `read_file` wrapper.

### Established Patterns
- Realtime is a hint only, so the item and run rows are the source of truth.
- `connector_sync_runs.status` and `connector_watches.last_status` are free text with no CHECK by design. Do not add one.
- Blocking supabase-py calls are wrapped in `run_in_threadpool` (D-v2.5-01). The watch loop already does this.
- The H-5 / `listing.complete` guard on missing-state transitions is unchanged by this phase.

### Integration Points
- Migration 209 touches `connector_watch_items` (two new columns plus a backfill) and does a data heal on `documents` / `ingestion_jobs` (D-14).
- `upsert_watch_item` callers in `watch_service.py` all need to pass the minted marker (D-06).

</code_context>

<specifics>
## Specific Ideas

- The real stuck item to heal live is `team-note-058.txt` on watch A. Reaching 105/105 on the real folder is the headline evidence.
- Example `last_error` shape: `1 file failed: team-note-058.txt (ConnectError)`.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed seeds (not folded). Each seed file is updated with `status: deferred` and a `status_note`
- **SEED-261** (an attachment failure is invisible to the watch surface): a new reporting writer for email attachments, not a repair of FIX-12's path.
- **SEED-341** (background sync and schedules ship switched off): a capability/operator-control decision.
- **SEED-077** (durable ingestion queue at scale): FIX-14 is a narrow enqueue-failure repair. The queue's admission control and throughput stay a scale milestone.
- **SEED-315** (Expert install retry bypasses the ingest queue): `import_service` / `expert_install` retry semantics. D-15 audits only their enqueue-failure arm.

### Out of scope by the roadmap
- Any retry-policy UI, or a per-file failure list in the Sources surface.
- A unique constraint on `ingestion_jobs.document_id`.

</deferred>

---

*Phase: 285-watch-and-re-upload-close-out*
*Context gathered: 2026-10-16*
