---
phase: 247-sources-and-watches
plan: 03
status: complete
wave: 2
commits:
  - id: pending
    message: "feat(247-03): WatchRowCard extraction, Variant A status badges, non-collapsing sync"
requirements_met: [WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, WATCH-08]
gates_passed:
  - "frontend/src/components/sources/watchProductMark.test.ts: 10/10 passed"
  - "frontend/src/components/sources/sourceHealthVocabulary.test.ts: 69/69 passed"
  - "frontend/src/components/sources/WatchedFoldersSection.test.tsx: 48/48 passed"
  - "frontend/src/components/sources/WatchedFoldersSection.history.test.tsx: 17/17 passed"
  - "frontend/src/components/sources/sourceComposition.test.tsx: standing red strictly at 16 baseline failures (0 regressions)"
  - "connectors.py fence: byte-identical (0 lines modified)"
  - "sourceHealthVocabulary.ts: connection_disabled appears exactly 3 times"
  - "WatchedFoldersSection.tsx: 470 lines (< 1000 line G-5 limit)"
  - "F-1 blocking resolved: backend 43/43 passed across 4 suites"
---

# Plan 247-03 Summary: Watched Folders UI, Variant A Status Badges & WatchRowCard Extraction

**Delivered:**
1. **`WatchRowCard.tsx` Modular Component Extraction (G-5 Line Cap):**
   - Extracted per-watch row layout, states, history folds, file failures, and action toolbars from `WatchedFoldersSection.tsx` into a focused `WatchRowCard.tsx` (646 lines).
   - Reduced `WatchedFoldersSection.tsx` from 1,095 lines down to 470 lines (well under the 1,000 line G-5 cap).
   - Eliminated collapse-on-sync defect: `loadWatches(initial = false)` sets `loading = true` strictly on initial mount, preventing unmounting/collapsing of expanded folders during sync or refresh.
2. **Variant A Two-Tier Status Badge (WATCH-03):**
   - In `WatchRowCard.tsx`, implemented the ratified Variant A design separating connection state from run outcome.
   - Connection tier displays `Connected` (green dot) or `Connection Off` (amber outline), while run tier displays the last run outcome (`Active`, `Syncing`, `Paused`, `Error`).
3. **`missing_since` Remote Disappearance Feedback (WATCH-05):**
   - Renders `Missing at source since [relative_time / instant] · Retained in Library` for items that disappeared from the remote provider, providing clear provenance and retention status.
4. **WR-09 Microsoft Graph Product Mark Mapping:**
   - In `frontend/src/components/sources/watchProductMark.ts`, mapped `microsoft_graph` to `onedrive` in `SERVICE_ID_TO_MARK` and added tests in `watchProductMark.test.ts` (10/10 passed).
5. **Action Honesty & Timestamp Vocabulary (WATCH-06 & WATCH-07):**
   - In `frontend/src/components/sources/sourceHealthVocabulary.ts`:
     - WATCH-06: For `connection_disabled`, action label reads `"Open ${connectionName} in Settings ↗"` (matching actual navigation behavior) rather than claiming to fix in-place.
     - WATCH-07: In `COPY.lastGood`, changed `"Last read successfully on ${when}"` to `"Last read successfully ${when}"` to eliminate double prepositions with relative phrases like "Last read successfully today".
   - Maintained vocabulary contract: `connection_disabled` appears exactly 3 times in source.
6. **Multi-Tenant Cache Hardening (F-1 Blocking Resolution):**
   - Keyed `_LABEL_NAME_CACHE` in `backend/app/services/sources/mail/gmail.py` on `(connection_id, label_id)` to isolate user label name resolution across tenants.
   - Passed `connection_id` through `GoogleDriveSourceAdapter` to prevent cross-account name leakage or path corruption.
   - Documented multi-tenancy reasoning for `_FOLDER_PATH_CACHE` in `google_drive.py`.
   - Added `test_f1_gmail_label_cache_cross_tenant_isolation` and boundary fence exemption meta-tests in `test_boundary_fence.py` (F-2).
   - Corrected orphan commit in `247-01-SUMMARY.md` (F-3).
