# Phase 234 Plan 05 Summary: Watched Folders Frontend Surface

**Execution Wave:** 5  
**Status:** Complete  
**Requirements Addressed:** LIB-08, SURF-01, VIS-05  

---

## 1. Key Accomplishments

1. **Create Watch Modal (`frontend/src/components/sources/CreateWatchModal.tsx`)**:
   - Connection picker filtering to source-capable Google accounts.
   - Source folder picker integrating `<SourceFolderPicker />`.
   - Destination Library folder selector.
   - Cadence presets: 15m, 30m (default), 1h, 6h, 24h.
   - Invariant copy: *"This folder will be checked every {N} minutes."* and retention note: *"Files deleted at source are retained in your Library until you purge them."*
   - Submits to `createWatch` from `@/lib/api/sources`.

2. **Watched Folders Section (`frontend/src/components/sources/WatchedFoldersSection.tsx`)**:
   - Displays list of watched folders with status pills and library folder mapping.
   - **SURF-01 Invariant**: Exact cadence copy *"checked every {interval_minutes} minutes"*, strictly forbidding misleading real-time words (*"instantly"* or *"on change"*).
   - **VIS-05 / SC#3 Lifecycle Controls**:
     - Disconnected warning banner naming the connection: *"Reconnect {connection_name}"* (e.g. *"Reconnect Google Drive (Procurement)"*).
     - *"Purge missing files"* action invoking `/sources/watches/{id}/purge` to clean up missing or disconnected files.
     - Interactive *"Sync now"*, Pause/Resume toggle, and Delete watch actions.
     - *"Add Watched Folder"* header action opening `CreateWatchModal`.

3. **Ingestion Tab Mount (`frontend/src/components/library/IngestionTab.tsx`)**:
   - Mounted `<WatchedFoldersSection />` under `add-files` beside `ConnectedSourceSection`.
   - Maintained strict G-1 pre-emption: `ConnectionFormPanel.tsx` and `ConnectionsTab.tsx` were kept 100% untouched.

4. **Testing & Count Gate Pinning**:
   - Authored `frontend/src/components/sources/WatchedFoldersSection.test.tsx` (6 tests passing):
     - Verifies exact cadence copy `"checked every 30 minutes"`.
     - Verifies absence of forbidden real-time vocabulary (`instantly`, `on change`).
     - Verifies disconnected warning banner naming the connection by name.
     - Verifies `"Purge missing files"`, `"Sync now"`, Pause/Resume, and Delete actions.
   - Combined sources vitest suites: 64/64 passing in 10.76s.
   - Pinned `WatchedFoldersSection.test.tsx: 6` in both `BASELINE` and `TARGETS` in `scripts/vitest-count-gate.cjs`.
