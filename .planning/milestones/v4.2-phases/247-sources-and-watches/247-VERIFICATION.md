---
phase: 247-sources-and-watches
phase_name: "Sources & Watches — Truth in Health, Sync & Time"
verified: 2026-09-14
status: complete
verification_mode: peer-reviewed
builder: gemini
reviewer: claude
score: "5 / 5 success criteria passed"
---

# Phase 247 — Verification: Sources & Watches (Truth in Health, Sync & Time)

Phase 247 makes watched sources tell the ground truth about remote path hierarchy, connection health status vs run outcomes, non-collapsing sync execution, file disappearance timestamps, action honesty, and time grammar.

## 1. Success Criteria Table (ROADMAP SC#1..SC#5)

| Success Criterion | Status | Evidence & Test Verification |
|---|---|---|
| **SC#1: Remote Path Hierarchy & Provenance**<br>*(WATCH-01, WATCH-02)* | ✅ **PASSED** | Documents ingested carry true remote folder hierarchy in `metadata.source.path` without prefix corruption or truncation.<br>• Google Drive (`google_drive.py`): `_resolve_folder_path` resolves parent breadcrumbs relative to watched folder root (`/Finance/2026/...`).<br>• Microsoft Graph / OneDrive (`microsoft_graph.py`): `_PATH_PREFIX` and `_folder_path` cleanly strip `/drive/root:`, `/drives/{id}/root:`, and SharePoint site roots.<br>• **Tests:** `test_google_drive_folder_path_hierarchy_resolution`, `test_google_drive_list_files_populates_source_file_path`, `test_microsoft_graph_parent_reference_path_parsing`, and `test_microsoft_graph_list_files_combines_path_cleanly` in `backend/tests/unit/test_247_source_paths.py` all pass. |
| **SC#2: Connection Health Decoupled from Run Outcome**<br>*(WATCH-03)* | ✅ **PASSED** | A watch card reports the health of the connection it rides: a healthy connection whose last run failed reads healthy, and a broken connection whose last run happened to succeed reads broken.<br>• Backend: `GET /sources/health` in `api/sources.py` queries connection `is_enabled` and immediately marks disabled connections as `connection_disabled`.<br>• Frontend: In `WatchRowCard.tsx`, Variant A two-tier status badge cleanly separates connection health (`● Connected` vs `⊙ Connection Off`) from sync run outcome (`● Reading`, `○ Run failed (429)`, `○ Stopped`).<br>• **Tests:** `WatchedFoldersSection.test.tsx` contains dedicated discriminator test `discriminates connection health from run outcome in both directions (ROADMAP SC#2 / WATCH-03)` verifying Case A (healthy connection with 429 run failure renders `Connected` + `Run failed (429)`) and Case B (disabled connection with successful run renders `Connection Off` + not run failed). Backend pair `test_disabled_connection_immediately_reported_stopped` and `test_enabled_connection_does_not_falsely_report_disabled` in `backend/tests/unit/test_247_watch_missing_lifecycle.py` pass. |
| **SC#3: Non-Collapsing Sync & Immediate Feedback**<br>*(WATCH-04)* | ✅ **PASSED** | Pressing "Sync now" delivers an answer where pressed without collapsing the section into a loading screen.<br>• `WatchedFoldersSection.tsx`: `loadWatches(initial = false)` confines `loading = true` to initial mount.<br>• `WatchRowCard.tsx`: Row enters focused in-flight state (`Syncing...`) and presents outcome inline (`✓ Synced just now (0 changes)`) without unmounting or collapsing the folder card.<br>• **Tests:** `WatchedFoldersSection.test.tsx: does NOT unmount or collapse the card when Sync now is clicked (WATCH-04)` passes. |
| **SC#4: Disappearance Timestamps, Honest Action Labels & Time Grammar**<br>*(WATCH-05, WATCH-06, WATCH-07)* | ✅ **PASSED** | Disappearance timestamps, honest navigation labels, and clean time grammar.<br>• `missing_since` lifecycle (`WATCH-05`): `backend/app/db/watches.py` and `watch_service.py` set UTC timestamp on file disappearance and clear on reappear (H-5 guard preserved). `WatchRowCard.tsx` renders `Missing at source since [time] · Retained in Library`.<br>• Action honesty (`WATCH-06`): `sourceHealthVocabulary.ts` action label for `connection_disabled` reads `"Open ${connectionName} in Settings ↗"`, truthfully reflecting navigation behavior rather than claiming an in-place fix.<br>• Time grammar (`WATCH-07`): `sourceHealthVocabulary.ts: COPY.lastGood` uses `"Last read successfully ${when}"` without "on", eliminating preposition collision with relative time phrases ("Last read successfully 4m ago").<br>• **Tests:** `test_missing_since_recorded_on_disappearance`, `test_missing_since_cleared_on_reappearance`, `sourceHealthVocabulary.test.ts` (69/69 passed), and `WatchedFoldersSection.test.tsx: renders missing items with missing_since timestamp` pass. |
| **SC#5: Review Warnings & Findings Dispositions**<br>*(WATCH-08)* | ✅ **PASSED** | Every open warning and review finding is formally resolved in code or dispositioned with rationale recorded in `247-DISPOSITION.md`.<br>• Phase 240 Warnings: WR-04, WR-07, WR-09 resolved in code; WR-02, WR-05, WR-06, WR-08 accepted as debt (WR-01 and WR-03 closed at Phase 240 by `9e83203a2`).<br>• Wave 1 Review Findings (BUS-214: F-1..F-4): F-1 (multi-tenant Gmail label cache isolation) and F-2 (fence exemption meta-test guard) resolved in code; F-3 and F-4 dispositioned.<br>• Wave 2 / Consolidation Review Findings (BUS-218/BUS-219/BUS-220: V-1..V-5): V-3 (SC#2 discriminator test), V-5 (required `connection_id: str` on Gmail label resolution to eliminate fail-open default), V-4 (CLAUDE.md webhook citation, line count 1094, WR-01/03 note in `247-DISPOSITION.md`), V-2 (relabelled to 5 ROADMAP criteria), V-1 (`peer-reviewed` confirmation). |

---

## 2. Invariants & Fences Verified

1. **`connectors.py` Fence:**
   `backend/app/api/connectors.py` is byte-identical across all Phase 247 commits (0 lines modified), keeping the sixth-landing extraction cleanly un-triggered.
2. **`sourceHealthVocabulary.ts` Blast Radius & Contract:**
   18 importing modules respected. Keys were added additively without re-keying. `connection_disabled` appears exactly 3 times in source.
3. **Standing Red Baseline:**
   `frontend/src/components/sources/sourceComposition.test.tsx` verified against `247-STANDING-RED-BASELINE.md`: strictly 16 failures, 0 outside the baseline set (33 passed / 16 failed).
4. **G-5 Line Cap:**
   `frontend/src/components/sources/WatchedFoldersSection.tsx` reduced from 1094 lines down to 470 lines (< 1000 lines). `WatchRowCard.tsx` extracted cleanly at 649 lines.

---

## 3. Automated Suite Results Summary

- Backend `test_247_source_paths.py`: 10/10 passed (includes F-1 cross-tenant isolation and V-5 required `connection_id`)
- Backend `test_boundary_fence.py`: 21/21 passed (includes F-2 meta-test guard)
- Backend `test_238_04_stored_path_is_never_fabricated.py`: 7/7 passed
- Backend `test_247_watch_missing_lifecycle.py`: 6/6 passed
- Total backend Phase 247 test pass: **44/44 passed**
- Frontend `watchProductMark.test.ts`: 10/10 passed (includes WR-09 Microsoft Graph mark)
- Frontend `sourceHealthVocabulary.test.ts`: 69/69 passed (includes WATCH-06 & WATCH-07)
- Frontend `WatchedFoldersSection.test.tsx`: 49/49 passed (includes Variant A two-tier badges, SC#2 discriminator test, missing_since, non-collapsing sync)
- Frontend `WatchedFoldersSection.history.test.tsx`: 17/17 passed (cadence and non-vacuity fences)
- Total frontend Phase 247 test pass: **145/145 passed**
- Standing red baseline: **16 failed / 33 passed** (zero deviation from baseline)
