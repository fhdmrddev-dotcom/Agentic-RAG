# Phase 234 Plan 04 Summary: Sources API & TypeScript Client Layer

**Execution Wave:** 4  
**Status:** Complete  
**Requirements Addressed:** LIB-08, SURF-01, VIS-05  

---

## 1. Key Accomplishments

1. **Pydantic Wire Models (`backend/app/models/source.py`)**:
   - `WatchCreateRequest`: schema for creating a folder watch with `connection_id`, `source_folder_id`, `source_folder_name`, optional `source_drive_id`, `library_folder_id`, and `interval_minutes` (ge=5, le=1440, default=30).
   - `WatchUpdateRequest`: supports modifying cadence, toggling active state, and setting/clearing library destination folder.
   - `WatchResponse` & `WatchDetailResponse`: serializes watch records enriched with `item_count`, `connection_name`, `service_id`, and mirror `items: list[WatchItemResponse]`.
   - `WatchItemResponse`: serializes tracked external files and their sync lifecycle state.
   - `WatchSyncResponse` & `WatchPurgeResponse`: responses for immediate on-demand trigger and missing document purging.

2. **FastAPI Router & Lifecycle Endpoints (`backend/app/api/sources.py`)**:
   - `POST /watches`: validates connection ownership via caller org, creates watch record with default 30m interval.
   - `GET /watches`: lists all watches owned by caller, enriched with item counts and connection name/service.
   - `GET /watches/{watch_id}`: owner-scoped watch details including tracked mirror items.
   - `PATCH /watches/{watch_id}`: owner-scoped cadence and toggle updates.
   - `DELETE /watches/{watch_id}`: owner-scoped removal with optional `purge_documents=true` deletion.
   - `POST /watches/{watch_id}/sync`: resets `next_run_at = now()` and clears active lease for immediate sync.
   - `POST /watches/{watch_id}/purge`: explicitly purges documents in `missing` or `unauthorized` states (`VIS-05` / `SC#3`).

3. **Router Mounting (`backend/app/main.py`)**:
   - Mounted `sources.router` under `/sources` and aliased under `/api/sources`.

4. **TypeScript Client Library (`frontend/src/lib/api/sources.ts`)**:
   - Exported types: `ConnectorWatch`, `ConnectorWatchItem`, `ConnectorWatchDetail`, `CreateWatchPayload`, `UpdateWatchPayload`, `WatchSyncResponse`, `WatchPurgeResponse`.
   - Client functions: `listWatches`, `getWatch`, `createWatch`, `updateWatch`, `deleteWatch`, `triggerWatchSync`, `purgeWatchFiles`.
   - Validated cleanly with zero TypeScript errors.

5. **Unit Testing & Verification**:
   - `backend/tests/unit/api/test_sources_watches_api.py`: 10/10 tests passing in 1.41s.
   - Full Phase 234 Unit Suite (Waves 1-4): 38/38 tests passing in 1.59s.
