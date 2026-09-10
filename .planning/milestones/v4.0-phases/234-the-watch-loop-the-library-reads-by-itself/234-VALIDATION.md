---
phase: 234
slug: the-watch-loop-the-library-reads-by-itself
status: ready_for_execution
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-06
updated: 2026-09-06
---

# Phase 234 — Validation Strategy & Matrix

> Validation contract and verification requirements for The Watch Loop — The Library Reads By Itself (`LIB-08`, `SRC-06`, `QUEUE-03`, `VIS-03..06`, `TRUST-03`, `SURF-01`).

---

## 1. Requirement Validation Matrix

| Requirement / Criterion | Behavior / Truth to Prove | Validation Method | Automated Test Suite |
|---|---|---|---|
| **LIB-08 / SC#1** | A mapped folder is read on a schedule using the shipped scheduler (`db/schedules.py` / `claim_due_schedules` pattern) | Unit & Integration Tests | `pytest backend/tests/unit/services/test_watch_service.py` & `pytest backend/tests/unit/db/test_watches_db.py` |
| **SRC-06 / SC#2 / H-5** | `SourceListing.complete=True` structural assertion; an incomplete listing (truncated pagination, rate limit) NEVER marks missing | Unit Test | `pytest backend/tests/unit/services/test_watch_diff_completeness.py -k test_incomplete_listing_forbids_missing` |
| **VIS-03 / SC#2** | A file deleted at the source is retained in the Library, marked `missing_at_source`, and remains answerable | Unit Test | `pytest backend/tests/unit/services/test_watch_diff_completeness.py -k test_deleted_file_retained` |
| **VIS-04 / SC#4** | Renamed, moved, or re-shared files update item metadata and document filename without duplicate rows and without re-ingesting | Unit Test | `pytest backend/tests/unit/services/test_watch_diff_completeness.py -k test_rename_and_move_no_duplicates` |
| **VIS-05 / SC#3 / D-4** | Disconnecting a connection freezes its documents, immediately stops them appearing in search RPCs, and offers Reconnect (by name) + Purge | Unit & Integration Tests | `pytest backend/tests/unit/api/test_disconnect_freeze.py` & `pytest backend/tests/unit/api/test_sources_watches_api.py -k test_purge` |
| **VIS-06 / SC#4 / H-4** | `accept_classification` (`documents.py:1847`) blocks automatic moves that would widen visibility from private connection to org-shared folder | Unit Test | `pytest backend/tests/unit/api/test_classification_visibility_fence.py` |
| **TRUST-03 / SC#5** | Trifecta defense: write-capable connector tools require explicit human approval naming the source when connection chunks are in context | Unit Test | `pytest backend/tests/unit/services/test_tool_dispatcher_trifecta_fence.py` |
| **QUEUE-03 / SC#1** | Two runs of the same watched source never overlap; second tick records `skipped_still_running` when lease is active | Unit Test | `pytest backend/tests/unit/db/test_watches_db.py -k test_lease_collision` |
| **SURF-01 / SC#1** | UI displays exact copy *"checked every N minutes"*; forbidden words *"instantly"* and *"on change"* are absent | Vitest Component Test | `npx vitest run src/components/sources/WatchedFoldersSection.test.tsx` |
| **SEED-239** | Per-watch error isolation: a malformed config on one watch degrades only that watch, not the organization | Unit Test | `pytest backend/tests/unit/services/test_watch_service.py -k test_error_isolation` |
| **SEED-142** | `CLAUDE.md` line 34 manual-upload-only rule is retired in the same commit as the watch loop | Git Diff & Audit | Verification at closeout |
| **G-5 Ledger Rows** | Hot-file ledger rows added for `scheduler_service.py` (5/2/399) and `db/schedules.py` (1/1/359) | Size & Ledger Gate | `node scripts/check-claude-md-size.cjs` |

---

## 2. Mechanical Gate Baselines

| Gate | Command | Baseline / Passing Threshold |
|---|---|---|
| **Frontend Typecheck** | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` | **66 errors** (with pre-existing unused import cleanup in `SourceFolderPicker.test.tsx`; 68 errors on untouched base `8cdc235b4`) — **zero regressions** |
| **Backend Unit Gate** | `pytest tests/unit -q --continue-on-collection-errors` | **`failed <= 71`** (zero headroom against baseline), **`0 collection errors`** |
| **Vitest Count Gate** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | Zero new failures on touched files; `WorkflowBuilderPage.canvas.test.tsx` isolated as pre-existing base failure |
| **Phase 234 Unit Suites** | `pytest backend/tests/unit/db/test_watches_db.py backend/tests/unit/services/test_watch_service.py backend/tests/unit/services/test_watch_diff_completeness.py backend/tests/unit/api/test_classification_visibility_fence.py backend/tests/unit/services/test_tool_dispatcher_trifecta_fence.py backend/tests/unit/api/test_disconnect_freeze.py backend/tests/unit/api/test_sources_watches_api.py -v` | **100% pass** |
| **Deploy Drift Gate** | `bash scripts/check-deploy-drift.sh` | **PASS — 0 drift** |
| **CLAUDE.md Budget Gate** | `node scripts/check-claude-md-size.cjs` | `< 150,000 characters` (verified at 145,152 chars / 96.8%) |

---

## 3. G-4 Behavioural & Lived-Experience Verification Procedures

Reference: `.planning/sketches/232-the-watch-loop-and-its-sentence/` (G-2 Sketch).

### G-4 Procedure 1: Cadence Display and Creation Flow (`SURF-01` / `SC#1`)
1. **Navigate to Library -> Ingestion & Watches tab**.
2. Verify existing watches render with exact copy: `"checked every {N} minutes"` (e.g. `"checked every 30 minutes"`).
3. Verify DOM text search confirms `"instantly"` and `"on change"` return 0 hits.
4. Click **"+ Add Watched Folder"**:
   - Verify modal opens matching Sketch 232 (`index.html`).
   - Select connected Google Drive account and pick a folder via `SourceFolderPicker`.
   - Select destination Library folder.
   - Cycle through cadence presets (`15m`, `30m`, `1h`, `6h`, `24h`): verify summary sentence updates reactively to `"This folder will be checked every N minutes."`
   - Submit: verify watch card appears in list with `Active` status.

### G-4 Procedure 2: Background Polling & Ingestion Lifecycle (`LIB-08` / `SRC-06` / `SC#2`)
1. Place a new file `report-2026-q3.pdf` in the mapped remote folder.
2. Trigger poll tick (`POST /api/sources/watches/{id}/sync` or wait for scheduled tick).
3. Observe:
   - Document row is minted via `async_mint_document_row`.
   - `connector_watch_items` row created with `state='present'`.
   - Ingestion job enqueued into `ingestion_jobs` and processed by queue worker.
   - Document becomes searchable in Library.
4. Delete `report-2026-q3.pdf` at the source folder.
5. Trigger next poll tick:
   - Verify listing completes (`listing.complete is True`).
   - Item transitions to `state='missing'`.
   - Document remains in Library with `source_state='missing_at_source'` (`VIS-03`).
   - Document is NOT deleted.

### G-4 Procedure 3: Disconnect Freeze, Reconnect By Name, and Purge (`VIS-05` / `SC#3`)
1. Disconnect the source connection (or revoke OAuth token).
2. Verify:
   - All watches for the connection are marked `is_active=false`.
   - All associated documents have `source_state='source_disconnected'`.
   - Vector search RPC `match_document_chunks` excludes these documents from search results immediately.
3. Open Library -> Ingestion tab:
   - Card shows `Disconnected` warning badge.
   - Warning banner displays: `"Source connection disconnected: Connection '{connection_name}' token revoked or expired. Sync is frozen."`
   - Action button is offered BY NAME: `"Reconnect {connection_name}"`.
   - Click `"Purge missing files"`: confirm prompt appears and deletes documents marked `missing_at_source` or `source_disconnected`.

### G-4 Procedure 4: File Rename / Move / Re-share (`VIS-04` / `SC#4`)
1. Rename a file in Google Drive from `Draft.docx` to `Final.docx` without changing content.
2. Trigger poll tick:
   - Watch loop identifies existing item by `external_id`.
   - `connector_watch_items.name` and `documents.filename` are updated to `Final.docx`.
   - No duplicate document row is created.
   - No re-ingestion job is enqueued.

### G-4 Procedure 5: Anti-Injection Trifecta Defense (`TRUST-03` / `SC#5`)
1. In a chat thread, ask a question that retrieves a chunk from a connected document (`source_connection_id IS NOT NULL`).
2. Prompt the agent to call an external write tool (e.g. `send_email` or `create_file`).
3. Verify:
   - `tool_dispatcher.py` detects write tool call with connected content in retrieval context.
   - Auto-execution is blocked; `posture` is forced to `"ask"`.
   - Chat UI presents interactive approval card naming the connected source.

---

## 4. SC#10 Cross-Provider Evaluation

**Determination:** Does NOT fire for Phase 234.
Phase 234 implements the watch loop background engine, lifecycle diff, RLS filtering, and tool-dispatch approval fences. `agent_loop.py` is left 100% untouched (preserving the shared streaming path byte-identically). Phase 236 ("The Corpus Under Attack") explicitly carries the full 8-row native roster evaluation against the anti-injection discipline.

---

## 5. Owed Drives Register

| Item ID | Target Feature | Description | Status | Re-open Trigger |
|---|---|---|---|---|
| **OD-234-01** | Live Periodic Polling | Real background poll tick against an authenticated Google Workspace folder observing autonomous ingestion of a newly placed file | **OWED DRIVE** | Drive before v4.0 closeout when live Google Workspace credentials with write permissions are available |
