---
phase: 247-sources-and-watches
phase_name: "Sources & Watches — Truth in Health, Sync & Time"
verified: 2026-09-14
status: complete
verification_mode: peer-reviewed
builder: gemini
reviewer: claude
score: "8 / 8 success criteria passed"
---

# Phase 247 — Verification: Sources & Watches (Truth in Health, Sync & Time)

Phase 247 makes watched sources tell the ground truth about remote path hierarchy, connection health status vs run outcomes, non-collapsing sync execution, file disappearance timestamps, action honesty, and time grammar.

## 1. Success Criteria Table

| SC / Requirement | Status | Evidence & Test Verification |
|---|---|---|
| **WATCH-01** — Google Drive Remote Path Hierarchy | ✅ **PASSED** | `_resolve_folder_path` in `google_drive.py` resolves parent breadcrumb hierarchy upward to root. `SourceFile.path` is populated as `/Finance/2026/...` relative to watched folder. Tests: `test_google_drive_folder_path_hierarchy_resolution` and `test_google_drive_list_files_populates_source_file_path` in `test_247_source_paths.py` pass. |
| **WATCH-02** — Microsoft Graph / OneDrive Path Parsing | ✅ **PASSED** | `_PATH_PREFIX` and `_folder_path` in `microsoft_graph.py` cleanly parse `parentReference.path` across personal OneDrive (`/drive/root:`), business drives, and SharePoint sites without prefix corruption. Tests: `test_microsoft_graph_parent_reference_path_parsing` and `test_microsoft_graph_list_files_combines_path_cleanly` pass. |
| **WATCH-03** — Two-Tier Status Badge (Variant A) & Connection Health | ✅ **PASSED** | `GET /sources/health` in `api/sources.py` queries connection `is_enabled` and immediately classifies disabled connections as `connection_disabled`. In `WatchRowCard.tsx`, Variant A renders distinct pills for connection state (`● Connected` vs `⊙ Connection Off`) and run state (`Active`, `Syncing`, `Paused`, `Error`). Tests: `test_disabled_connection_immediately_reported_stopped` and `WatchedFoldersSection.test.tsx: renders Variant A two-tier status badges` pass. |
| **WATCH-04** — Non-Collapsing Sync Now & Inline Feedback | ✅ **PASSED** | `loadWatches(initial = false)` in `WatchedFoldersSection.tsx` only activates `loading = true` on initial mount. Sync action triggers row-level spinner and resolves to inline badge `✓ Synced just now (0 changes)` in `WatchRowCard.tsx` without unmounting or collapsing the folder card. Tests: `WatchedFoldersSection.test.tsx: triggers row-level sync without collapsing section` passes. |
| **WATCH-05** — `missing_since` Timestamp Lifecycle & UI Feedback | ✅ **PASSED** | `backend/app/db/watches.py` and `watch_service.py` record UTC timestamp on file disappearance and clear `missing_since` on reappear (H-5 incomplete listing guard preserved). `WatchRowCard.tsx` renders `Missing at source since [time] · Retained in Library`. Tests: `test_missing_since_recorded_on_disappearance`, `test_missing_since_cleared_on_reappearance`, and `WatchedFoldersSection.test.tsx: renders missing items with missing_since timestamp` pass. |
| **WATCH-06** — Honest Action Labels for Disabled Connections | ✅ **PASSED** | `sourceHealthVocabulary.ts` action label for `connection_disabled` reads `"Open ${connectionName} in Settings ↗"`, truthfully reflecting navigation behavior rather than claiming in-place fix. Tests: `sourceHealthVocabulary.test.ts` (69/69 passed). |
| **WATCH-07** — Time Vocabulary Grammar & Preposition Fix | ✅ **PASSED** | In `sourceHealthVocabulary.ts`, `COPY.lastGood` uses `"Last read successfully ${when}"` without "on", eliminating preposition collision with relative time phrases ("Last read successfully 4m ago"). Tests: `sourceHealthVocabulary.test.ts` passes. |
| **WATCH-08** — Phase 240 Warnings & Review Findings Disposition | ✅ **PASSED** | Documented in `247-DISPOSITION.md`. WR-04, WR-07, and WR-09 fixed in code; WR-02, WR-05, WR-06, WR-08 accepted as debt. Wave 1 review findings F-1 (multi-tenant label cache isolation) and F-2 (fence exemption meta-test guard) resolved in code; F-3 and F-4 dispositioned and recorded. |

---

## 2. Invariants & Fences Verified

1. **`connectors.py` Fence:**
   `backend/app/api/connectors.py` is byte-identical across all Phase 247 commits (0 lines modified), keeping the sixth-landing extraction cleanly un-triggered.
2. **`sourceHealthVocabulary.ts` Blast Radius & Contract:**
   18 importing modules respected. Keys were added additively without re-keying. `connection_disabled` appears exactly 3 times in source.
3. **Standing Red Baseline:**
   `frontend/src/components/sources/sourceComposition.test.tsx` verified against `247-STANDING-RED-BASELINE.md`: strictly 16 failures, 0 outside the baseline set (33 passed / 16 failed).
4. **G-5 Line Cap:**
   `frontend/src/components/sources/WatchedFoldersSection.tsx` reduced from 1,095 lines down to 470 lines (< 1000 lines). `WatchRowCard.tsx` extracted cleanly at 649 lines.

---

## 3. Automated Suite Results Summary

- Backend `test_247_source_paths.py`: 9/9 passed (includes F-1 cross-tenant isolation)
- Backend `test_boundary_fence.py`: 21/21 passed (includes F-2 meta-test guard)
- Backend `test_238_04_stored_path_is_never_fabricated.py`: 7/7 passed
- Backend `test_247_watch_missing_lifecycle.py`: 6/6 passed
- Total backend Phase 247 test pass: **43/43 passed**
- Frontend `watchProductMark.test.ts`: 10/10 passed (includes WR-09 Microsoft Graph mark)
- Frontend `sourceHealthVocabulary.test.ts`: 69/69 passed (includes WATCH-06 & WATCH-07)
- Frontend `WatchedFoldersSection.test.tsx`: 48/48 passed (includes Variant A two-tier badges, missing_since, non-collapsing sync)
- Frontend `WatchedFoldersSection.history.test.tsx`: 17/17 passed (cadence and non-vacuity fences)
- Total frontend Phase 247 test pass: **144/144 passed**
