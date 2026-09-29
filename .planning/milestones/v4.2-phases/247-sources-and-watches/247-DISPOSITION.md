# Phase 247 Disposition: Review Warnings & Findings

**Documented by:** Gemini (builder)
**Date:** 2026-09-14
**Phase:** 247 — Sources & Watches: Truth in Health, Sync & Time

---

## 1. Phase 240 Review Warnings (WR-01 through WR-09)

*Note: WR-01 and WR-03 were closed at Phase 240 by commit `9e83203a2`. The seven remaining warnings are dispositioned below.*

| Warning | Status | Resolution / Disposition |
|---|---|---|
| **WR-04** | **FIXED** (247-01) | User label human name resolution implemented in `backend/app/services/sources/mail/gmail.py` via `get_label_name` and consumed by `GoogleDriveSourceAdapter.list_files`. Resolves e.g. `Label_9` to `Receipts` so `SourceFile.path` is `/Receipts` rather than `/Label_9`. |
| **WR-07** | **FIXED** (247-01, 247-03) | Recursive boundary fence check implemented in `backend/tests/unit/services/sources/test_boundary_fence.py` using `package.rglob("*.py")` to ensure subpackages like `sources/mail/` cannot escape the fence. Hardened with meta-test `test_provider_half_and_leaf_modules_are_guarded`. |
| **WR-09** | **FIXED** (247-03) | In `frontend/src/components/sources/watchProductMark.ts`, mapped `microsoft_graph` to `onedrive` in `SERVICE_ID_TO_MARK`. Verified by 10/10 tests in `watchProductMark.test.ts`. |
| **WR-02** | **ACCEPTED DEBT** | URL-prefix stripping in `microsoft_graph.py` strips `/drive/root:`, `/drives/{id}/root:`, and `/sites/{site}/drives/{drive}/root:`. Items without root markers return `None`, safely preserving WR-03 without fabricating paths. Full multi-tenant SharePoint cross-site alias traversal deferred. |
| **WR-05** | **ACCEPTED DEBT** | Missing files display in `WatchRowCard.tsx` caps rendered items to `FILE_FAILURES_SHOWN` (5) with `+N more` counter to prevent DOM overflow during massive remote deletions. Bulk reconciliation actions remain per-watch. |
| **WR-06** | **ACCEPTED DEBT** | Background sync runs on polled schedule (`interval_minutes`); push notification subscriptions (webhooks) are intentionally absent per CLAUDE.md's "no delta cursor and no webhook" architectural invariant (polled schedule preserved). |
| **WR-08** | **FIXED** (247-04) | Formal dispositioning document delivered (`247-DISPOSITION.md`) and hot-file ledger synced with exact git-derived triples. |

---

## 2. Reviewer Findings on Wave 1 (BUS-214: F-1 through F-4)

| Finding | Severity | Resolution / Disposition |
|---|---|---|
| **F-1** | **BLOCKING — FIXED** (247-03) | **Multi-tenant Gmail label cache isolation:** Process-global `_LABEL_NAME_CACHE` in `mail/gmail.py` previously keyed on bare `label_id`. Because Gmail user label IDs (`Label_9`, etc.) are per-mailbox and not globally unique, this created cross-tenant label leaking and corrupted `metadata.source.path`. Fixed by keying on `(connection_id, label_id)` tuple, passing connection id from adapter callers (`GoogleDriveSourceAdapter`), and adding isolation unit test `test_f1_gmail_label_cache_cross_tenant_isolation`. Google Drive's `_FOLDER_PATH_CACHE` was explicitly documented in code as safe across tenants because Drive IDs are globally unique opaque strings within Google's namespace. |
| **F-2** | **WARNING — FIXED** (247-03) | **Boundary fence exemption meta-test:** In `test_boundary_fence.py`, added `LEAF_SHARED_MODULES` (`failure_cause.py`, `health_verdict.py`) and implemented `test_provider_half_and_leaf_modules_are_guarded` asserting that all exempted modules exist on disk, provider-half modules reside strictly within provider subdirectories (e.g. `mail/`), and leaf modules define pure data types with no adapter imports. |
| **F-3** | **WARNING — FIXED** (247-03) | **Orphan commit reference in summary:** Corrected commit id in `.planning/phases/247-sources-and-watches/247-01-SUMMARY.md` from orphan commit `fc5c7fe01` to the commit on develop (`e5ded885a`). |
| **F-4** | **MINOR — ACCEPTED DISPOSITION** | **Bounded cache lifetime:** `_LABEL_NAME_CACHE` and `_FOLDER_PATH_CACHE` operate in-process with bounded memory policy (cleared when exceeding threshold) and clear on worker restart. Remote folder renaming and user label renaming occur infrequently; in-process memory caching avoids repetitive network roundtrips during watch sync cycles while bounding memory footprint. |

---

## 3. Invariants & Fences Preserved

1. **`backend/app/api/connectors.py` Fence:**
   - Byte-identical throughout the entire phase (0 lines modified, diff returns empty). Preserves the sixth-landing extraction invariant.
2. **`sourceHealthVocabulary.ts` Contract:**
   - 18 importing modules respected: `connection_disabled` added additively and occurs exactly 3 times in source (type union, sentence map, control map). No existing keys renamed.
3. **`failure_cause.py` Plain-Text Union:**
   - `Cause` union remains on a single plain-text line, readable by `?raw` fences without AST parsing.
4. **Standing Red Baseline:**
   - `frontend/src/components/sources/sourceComposition.test.tsx` strictly reproduces the 16 baseline failures documented in `247-STANDING-RED-BASELINE.md` (33 passed / 16 failed). Zero failures outside baseline.
5. **G-5 Line Cap:**
   - `WatchedFoldersSection.tsx` reduced from 1094 lines down to 470 lines via extraction of `WatchRowCard.tsx` (649 lines). Both files well under 1,000 lines.
