# Phase 234: The Watch Loop — The Library Reads By Itself — Context

**Gathered:** 2026-09-06  
**Status:** Locked & Pre-flight Revised  
**Role:** Builder: Gemini · Reviewer: Claude  

<canonical_refs>
- `.planning/REQUIREMENTS.md` (LIB-08, SRC-06, QUEUE-03, VIS-03..06, TRUST-03, SURF-01)
- `.planning/ROADMAP.md` (Phase 234 details & checklist)
- `.planning/sketches/232-the-watch-loop-and-its-sentence/README.md` (G-2 Sketch 232)
- `.planning/research/ARCHITECTURE.md` (§5 Lifecycle Propagation, §4 Schema, §6 New vs Modified)
- `.planning/research/PITFALLS.md` (Pitfall 4 Untrusted Content / Trifecta, Pitfall 5 Silent Polling Failures, Pitfall 10 Watched Door Guarantees, Pitfall 13 SEED-239 Blast Radius)
- `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-MEASUREMENTS.md` (Baseline SHA 8cdc235b4)
- `CLAUDE.md` (Line 34 manual upload rule retirement; hot-file ledger; migration rules)
- `docs/HOT-FILE-LEDGER.md` (scheduler_service.py & schedules.py rows)
</canonical_refs>

<domain>
## Phase Boundary

Phase 234 delivers **The Watch Loop — The Library Reads By Itself**.
A connected folder is watched on a schedule using the shipped scheduler, automatically polling for updates and ingesting new or modified files via the durable queue (`ingestion_jobs`) without anyone remembering to upload. Every source lifecycle event (deletion, unsharing, move, modification, disconnection) has an honest and observable outcome, and untrusted external content is strictly fenced against prompt-injection write abuse.

### Core Deliverables:
1. **Migrations 168–171 (Ratified via BUS-143)**:
   - `168_connector_watches.sql`: `connector_watches` table (id, org_id, user_id, connection_id, source_folder_id, source_folder_name, library_folder_id, interval_minutes, next_run_at, leased_until, is_active, last_run_at, last_status, last_error).
   - `169_connector_watch_items.sql`: `connector_watch_items` mirror table (watch_id, external_id, name, path_hint, source_version, content_hash, document_id, state: 'present'|'missing'|'unauthorized'|'skipped_type'|'skipped_size'|'failed').
   - `170_documents_source_state.sql`: `documents.source_state` column ('live'|'missing_at_source'|'unauthorized_at_source'|'source_disconnected') and audit action types.
   - `171_reserved.sql`: reserved block alignment.
2. **Watch Loop & DB Operations (`backend/app/db/watches.py` & `services/watch_service.py`)**:
   - `claim_due_watches`: Atomic claim using `FOR UPDATE SKIP LOCKED`, advancing `next_run_at` and setting `leased_until`.
   - `WatchService.tick()`: Diffing adapter listing against `connector_watch_items`. Fan-out: mints document rows via `async_mint_document_row`, updates `connector_watch_items`, and enqueues file ingest jobs into `ingestion_jobs`.
   - Concurrency guard (`QUEUE-03`): Checks `leased_until`. If a run is still in flight, logs and records `skipped_still_running` without concurrent double-polling.
   - Per-watch failure isolation (`SEED-239`): A failure in one watch updates `last_error` and does not abort other watches in the organization.
3. **Completeness Enforcement on Deletions (`H-5` / `SRC-06`)**:
   - `SourceListing.complete: bool = False` fail-closed default: A `missing` verdict can ONLY be written if the listing was asserted complete (`complete is True`). If pagination aborted (e.g. 429 rate limit or network drop) or finished with non-null `next_page_token`, zero files are marked missing.
   - Files deleted at the source are retained in the Library (`VIS-03`), marked `missing_at_source`.
4. **Classification Access Fence (`H-4` / `VIS-06`)**:
   - In `backend/app/api/documents.py:1847` (`accept_classification`): Query `documents.ingest_visibility` and `folders.is_org_shared`. If moving a document with `source_connection_id` and `ingest_visibility == 'private'` to an org-shared folder, the automatic move is blocked unless `force=True`.
5. **Anti-Injection Trifecta Defense (`TRUST-03`)**:
   - In `backend/app/services/tool_dispatcher.py` (`dispatch_connector_tool`): If the retrieved citation context contains connection-sourced content (`source_connection_id IS NOT NULL`), write-capable connector tools are disarmed and force `posture = 'ask'`, triggering the shipped approval checkpoint naming the source connection. `agent_loop.py` is untouched, eliminating SC#10 invocation.
6. **Connection Disconnect / Freeze (`VIS-05` / `D-4`)**:
   - Disconnecting a connection marks `documents.source_state = 'source_disconnected'` and sets `connector_watches.is_active = false`.
   - Disconnected documents remain in Library but are excluded from agent search/retrieval RPCs.
   - Library UI displays "Purge missing files" and "Reconnect {connection_name}" offered BY NAME.
7. **Frontend Watch Management Surface (`SURF-01`)**:
   - Located inside `Library > Ingestion` tab (avoiding `ConnectionsTab` / `ConnectionFormPanel` per G-1).
   - "Watched Folders" list showing mapped sources, target Library folders, last run status, and exact copy: *"checked every N minutes"*.
   - Add Watch modal integrating `SourceFolderPicker` from Phase 232/233 and cadence selection (15m, 30m, 1h, 6h, 24h).
   - G-2 Sketch 232 (`.planning/sketches/232-the-watch-loop-and-its-sentence/`).
8. **Rule Retirement & Ledger Sync**:
   - Retire `CLAUDE.md` line 34 manual-upload-only rule in the same commit (`SEED-142`).
   - G-5 hot-file ledger rows added for `backend/app/services/scheduler_service.py` and `backend/app/db/schedules.py`.
</domain>

<decisions>
## Implementation Decisions

### D-234-01: Migration Allocation 168–171 (Operator Ratified BUS-143)
- Migration numbering starts at 168, following 166 and 167:
  - `168_connector_watches.sql`
  - `169_connector_watch_items.sql`
  - `170_documents_source_state.sql`
  - `171_reserved.sql`
- ROADMAP.md milestone reservations updated to reflect the new range.

### D-234-02: Watch Management UI in Library Ingestion (Pre-empting G-1)
- Watch management is placed inside the Library's Ingestion tab (`frontend/src/components/sources/WatchedFoldersSection.tsx`), beside the batch lane and folder picker.
- Strictly leaves `ConnectionFormPanel.tsx` (22/9/2418) and `ConnectionsTab.tsx` (24/8/1578) untouched, pre-empting G-1 chain violations.

### D-234-03: Cadence Presets & Exact Copy (LIB-08, SURF-01)
- Cadence picker offers: 15 minutes, 30 minutes (default), 1 hour, 6 hours, 24 hours.
- Copy renders: *"checked every {N} minutes"* (never "instantly" or "on change").

### D-234-04: Trifecta Anti-Injection Guard in tool_dispatcher.py (TRUST-03)
- Enforced in `tool_dispatcher.py` (`dispatch_connector_tool`):
  - If write tool is called (`_is_write is True`) and retrieved chunks in context have `source_connection_id IS NOT NULL`:
    - Overrides posture to `posture = "ask"`.
    - Triggers shipped Redis pubsub approval request naming the source connection.
  - Leaves `backend/app/services/agent_loop.py` byte-identical, avoiding cross-provider streaming loops and keeping SC#10 scheduled for Phase 236.

### D-234-05: Fail-Closed Structural Completeness on Listings (H-5, SRC-06)
- `SourceListing(complete: bool = False)` in `services/sources/base.py` fails closed by default.
- Set to `complete = True` ONLY when pagination exhausts with `next_page_token is None` and 0 errors.
- The diff logic in `WatchService` will ONLY transition items to `state='missing'` if `complete is True`. If pagination was truncated or incomplete, existing items remain untouched.

### D-234-06: Classification Acceptance Fence (H-4, VIS-06)
- In `documents.py:1847` (`accept_classification`):
  - Read `documents.ingest_visibility` and query `folders.is_org_shared`.
  - If document has `ingest_visibility == 'private'` and target folder has `is_org_shared == True`, refuse move unless `force=True`. No non-existent functions.

### D-234-07: Disconnect Freeze & Recovery (VIS-05, D-4)
- On connection disconnect:
  - `documents.source_state` set to `'source_disconnected'`.
  - Excluded from `match_document_chunks` and `keyword_search_chunks` queries (`WHERE source_state IS NULL OR source_state != 'source_disconnected'`).
  - UI offers "Reconnect {connection_name}" (offered BY NAME) and "Purge missing files".

### D-234-08: Concurrency Lease (QUEUE-03, Pitfall 5)
- `connector_watches.leased_until` stores the lease timestamp.
- If a tick claims a watch while another worker is still processing, the claim skips it and logs `skipped_still_running`.

### D-234-09: SEED-239 Blast Radius Isolation
- `WatchService` processes each watch in its own try/except block.
- Corrupted configuration on one watch records `last_error` and does not prevent other watches from executing.

### D-234-10: Config Key & Deploy Drift Sync
- `backend/app/config.py`: `watch_process_enabled: bool = False` (lowercase, default False, matching `scheduler_process_enabled`).
- Synced across `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, and `docs/OPERATOR.md`.
- `bash scripts/check-deploy-drift.sh` passes with 0 drift.

### D-234-11: SC#4 File Rename / Move / Re-share Handling
- In `WatchService`, when an item matches existing `connector_watch_items` by `external_id`:
  - If `name` or `path_hint` changed but content unchanged:
  - Update `connector_watch_items.name`, `path_hint` and `documents.filename`.
  - Do NOT mint duplicate document rows and do NOT enqueue re-ingest jobs.
</decisions>
