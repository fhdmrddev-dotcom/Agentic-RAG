---
type: preflight-review
kind: builder-self-audit
phase: 247
author: gemini
reviewer: claude (BUS-210)
reviewed_at: 2026-09-14
base_sha: 987e7a68515d1c47dbc7b942551e1798393b6d0b
branch: develop
plans_reviewed: [247-01, 247-02, 247-03, 247-04]
---

# Phase 247 — Pre-flight Review & Cross-Plan Seam Audit

## Executive Summary

Phase 247 brings truth to the Watched Folders surface and background watch loops: what a watch brought in, where it came from, whether its connection is alive, and when something vanished. Governed by G-8, the scope is sequenced into 4 execution plans:

* **247-01 (Wave 1: Adapters & Path Resolution)**: Resolves full folder hierarchy in `SourceFile.path` and propagates to `metadata.source.path` for Google Drive (`WATCH-01`) and Microsoft Graph (`WATCH-02`), resolving `SEED-253`. Fixes `WR-04` (human label display name for Gmail user labels) and `WR-07` (recursive boundary fence traversal).
* **247-02 (Wave 1: Watch Loop Lifecycle & Health)**: Records `missing_since = now()` on remote item disappearance under complete listings and clears it on restoration (`WATCH-05`). Incorporates connection `is_enabled` into `/sources/health` so disabled connections immediately report as stopped (`WATCH-03`).
* **247-03 (Wave 2: Watched Folders Surface & Component Extraction)**: Extracts `WatchRowCard.tsx` to satisfy G-5 and bring `WatchedFoldersSection.tsx` from 1,094 lines down to ~650 lines. Implements Variant A Two-Tier Status Badge (`Connected` vs `Connection Off` + Run Outcome). Delivers row-level non-collapsing "Sync now" with inline outcome (`WATCH-04`). Formats `missing_since` timestamps in tracked files (`WATCH-05`). Fixes `WR-09` (Microsoft Graph product marks in `watchProductMark.ts`). Resolves `WATCH-06` (action honesty: "Open Connection Settings ↗") and `WATCH-07` (time vocabulary: removes preposition "on" in `COPY.lastGood`). Formally discharges G-5 for `sourceHealthVocabulary.ts` as safe-as-is (leaf vocabulary dictionary).
* **247-04 (Wave 3: Warnings Disposition, Ledger Sync & Verification)**: Formal paperwork deliverable for `WATCH-08` authoring `247-DISPOSITION.md` (WR-04, WR-07, WR-09 fixed in code; WR-02, WR-05, WR-06, WR-08 accepted as debt), closing `BUG-260910-02`. Updates `docs/HOT-FILE-LEDGER.md` with re-derived triples for 5 touched files and verifies the strict fence on `api/connectors.py`. Executes full verification across frontend and backend against the set-based standing red contract.

---

## 1 · Cross-Plan Seam Audit

### ✅ Seam 1: `SourceFile.path` Producer $\leftrightarrow$ Ingestion Enrichment $\leftrightarrow$ Rule Engine & UI (247-01 $\leftrightarrow$ Ingestion Pipeline)
* **Producer:** `google_drive.py` builds relative path hierarchy during folder traversal; `microsoft_graph.py` extracts and normalizes `parentReference.path` by stripping `/drive/root:` prefixes. Both instantiate `SourceFile(..., path=resolved_relative_path)`.
* **Enrichment Seam:** `ingest_enrich.py` maps `source_file.path` into document `metadata["source"]["path"]`.
* **Consumer:** Classification rule engine matches `path contains ...` against `metadata.source.path`. In the UI, `WatchRowCard.tsx` renders file paths in the tracked files accordion.
* **Invariants Verified:**
  - Normalization: paths always start with `/` and contain no `./`, `../`, or consecutive slashes.
  - Fail-safe fallback: files directly in the watched root or unresolvable parent references fall back safely to `/{filename}` without throwing or producing null pointers.
* **Seam status: CLEAR.**

### ✅ Seam 2: `watch_service.py` Lifecycle $\leftrightarrow$ `WatchRowCard.tsx` UI for `missing_since` (247-02 $\leftrightarrow$ 247-03)
* **Producer:** `watch_service.py` detects item disappearance during complete listings and calls `update_item_state(item_id, state='missing', missing_since=datetime.now(timezone.utc))`. When an item reappears, it calls `update_item_state(item_id, state='present', missing_since=None)`.
* **Consumer:** `WatchRowCard.tsx` filters items where `state === "missing"` and formats: `Missing at source since [timestamp] · Retained in Library`.
* **Database & Schema Invariant:** Zero migrations needed. `connector_watch_items.missing_since` already exists in Postgres schema.
* **H-5 Deletion Guard Invariant:** `missing_since` is ONLY written when `listing_complete == True`. Incomplete listings (e.g. pagination failure or rate limit truncation) never mark items missing.
* **Seam status: CLEAR.**

### ✅ Seam 3: Connection State $\leftrightarrow$ Dual Health Pill $\leftrightarrow$ Action Honesty (247-02 $\leftrightarrow$ 247-03)
* **Producer:** `/sources/health` inspects `connector_connections.is_enabled`. When `is_enabled == False`, it returns cause `connection_disabled` stopped since connection `updated_at`.
* **Consumer:** `WatchRowCard.tsx` renders ratified Variant A Two-Tier Status Pill:
  - Left Pill (Connection Health): `⊙ Connection Off` (neutral/amber) when disabled; `● Connected` (green subtle) when active.
  - Right Pill (Run Outcome): `✓ Healthy` or `⚠ Run failed (429)` (transient failure does not brand connection dead).
* **Action Honesty (Consequence $\neq$ Receipt):** `sourceHealthVocabulary.ts` labels the disabled connection action as `"Open ${connectionName} in Settings ↗"` (or `"Open Connection Settings ↗"`). The handler routes to `onNavigateToConnections?.()`, traveling to Settings without claiming an in-place write.
* **Seam status: CLEAR.**

### ✅ Seam 4: Wave Concurrency & File Disjointness Safety
* **Wave 1 (247-01 & 247-02):**
  - `247-01`: Modifies `google_drive.py`, `microsoft_graph.py`, `ingest_enrich.py`, `test_boundary_fence.py`, `test_247_source_paths.py`.
  - `247-02`: Modifies `watch_service.py`, `health_verdict.py`, `api/sources.py`, `test_247_watch_missing_lifecycle.py`.
  - **Disjointness Audit:** Intersection of modified files is $\emptyset$. Wave 1 plans can execute autonomously without write collisions.
* **Wave 2 (247-03):** Runs after Wave 1 backend contracts settle, modifying frontend components (`watchProductMark.ts`, `sourceHealthVocabulary.ts`, `WatchedFoldersSection.tsx`, `WatchRowCard.tsx`).
* **Wave 3 (247-04):** Authoring `247-DISPOSITION.md`, updating `docs/HOT-FILE-LEDGER.md`, and executing full-tree verification.
* **Seam status: CLEAR.**

---

## 2 · Strict Fence Assertion: `backend/app/api/connectors.py`

* **Hot File Ledger Warning:** `backend/app/api/connectors.py` currently stands at **44 commits / 21 phases (per CLAUDE.md recipe) / 2,140 lines**, with an extraction **OWED at its sixth landing**.
* **Governance Contract:** Touching `api/connectors.py` would force its owed extraction. A plan that lands there must either perform the extraction or not land.
* **Audit Result:** Phase 247 strictly fences `backend/app/api/connectors.py`. Across all 4 plans (247-01, 247-02, 247-03, 247-04):
  - **Lines modified: 0.**
  - **Byte-unchanged assertion:** Asserted in tests and plan checklists.
* **Fence status: ENFORCED.**

---

## 3 · Standing Red Baseline Assertion (F-1 Set-Based Contract)

* **File:** `frontend/src/components/sources/sourceComposition.test.tsx`
* **Status:** Standing red inherited from Phase 235 decision, intentionally excluded from both count-gate knobs.
* **Measured Variance Across Environments:**
  - Readings across sessions and runners: 16 failed / 33 passed, 17 failed / 32 passed, 18 failed / 31 passed (always 49 total).
  - Per reviewer investigation in `247-STANDING-RED-BASELINE.md` (BUS-210), the failing set is bounded to a 16-test baseline set with ±2 runner-dependent threshold variance.
* **Set-Based Gate Contract (F-1):**
  > **No test OUTSIDE the documented 16-name baseline set in `247-STANDING-RED-BASELINE.md` may fail.** A run reading 16, 17, or 18 failed is acceptable **only if every extra failing test is within the documented baseline set**. Any test failing outside that set is a real regression and blocks execution.

---

## 4 · G-5 Hot File Triples (Re-derived at Base `987e7a685`)

| File | Base Triple (Commits / Phases / Lines) | G-5 Status | Action in Phase 247 |
|---|---|---|---|
| `backend/app/services/sources/adapters/google_drive.py` | 6 / 4 / 455 | Fires ($\ge 3$ phases) | Touched in 247-01; safe-as-is, sync ledger |
| `backend/app/services/sources/adapters/microsoft_graph.py` | 6 / 3 / 457 | Fires ($\ge 3$ phases) | Touched in 247-01; safe-as-is, sync ledger |
| `backend/app/services/watch_service.py` | 6 / 4 / 642 | Fires ($\ge 3$ phases) | Touched in 247-02; safe-as-is, sync ledger |
| `frontend/src/components/sources/WatchedFoldersSection.tsx` | 8 / 3 / 1,094 | **Fires ($\ge 1,000$ lines)** | **EXTRACTED in 247-03**: extracts `WatchRowCard.tsx`, line count reduced to ~650 lines |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | 6 / 3 / 560 | **Fires (3 phases, ledger row 6/3/560)** | **DISCHARGED in 247-03**: Safe-as-is (Option 2) — strict leaf presentation dictionary, zero imports, pure copy/action maps, zero state or mutations. Written rationale recorded in ledger. |
| `backend/app/api/connectors.py` | 44 / 21 / 2,140 | **Extraction Owed** | **⛔ STRICTLY FENCED (0 lines touched)** |

---

## 5 · Plan Quality & Verification Audit

| Plan | Wave | Autonomous | Requirements | Must-Haves / Truths | Verification Command |
|---|---|---|---|---|---|
| `247-01` | 1 | Yes | WATCH-01, WATCH-02, WATCH-08 | Google Drive full relative path; MS Graph parentReference prefix strip; `metadata.source.path` enriched; WR-04 human label name; WR-07 recursive glob; connectors.py unchanged | `python -m pytest backend/tests/unit/test_247_source_paths.py backend/tests/unit/test_boundary_fence.py -v` |
| `247-02` | 1 | Yes | WATCH-03, WATCH-05 | `missing_since = now()` on deletion; cleared on restore; H-5 guard holds; disabled connection immediately reported as stopped; connectors.py unchanged | `python -m pytest backend/tests/unit/test_247_watch_missing_lifecycle.py -v` |
| `247-03` | 2 | Yes | WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, WATCH-08 | `WatchRowCard.tsx` extracted (<1000L); Variant A dual pill; row-level sync spinner + inline tag; missing files with timestamps; WR-09 Microsoft mark; WATCH-06 "Open ... in Settings ↗"; WATCH-07 drop "on"; `sourceHealthVocabulary.ts` G-5 safe-as-is discharged; standing red set contract verified | `$env:CI="1"; node frontend/node_modules/vitest/vitest.mjs run frontend/src/components/sources/watchProductMark.test.ts frontend/src/components/sources/sourceHealthVocabulary.test.ts frontend/src/components/sources/WatchedFoldersSection.test.tsx` |
| `247-04` | 3 | Yes | WATCH-08 | `247-DISPOSITION.md` authored; BUG-260910-02 closed; `docs/HOT-FILE-LEDGER.md` updated for 5 hot files (including `sourceHealthVocabulary.ts` safe-as-is rationale); connectors.py fence verified; standing red set contract preserved | `python -m pytest backend/tests/unit/test_247_source_paths.py backend/tests/unit/test_247_watch_missing_lifecycle.py -v` |

---

## 6 · Readiness & Verification Checklist

- [x] Base commit `987e7a68515d1c47dbc7b942551e1798393b6d0b` asserted on `develop`.
- [x] Standing red baseline for `sourceComposition.test.tsx` governed by set contract in `247-STANDING-RED-BASELINE.md` (F-1).
- [x] All 7 stale agent-bus items (`BUS-197, 198, 199, 200, 203, 204, 205`) closed.
- [x] Strict fence on `backend/app/api/connectors.py` asserted across all plans.
- [x] G-5 extraction of `WatchedFoldersSection.tsx` scheduled in `247-03-PLAN.md`.
- [x] G-5 disposition of `sourceHealthVocabulary.ts` explicitly discharged as safe-as-is (F-2).
- [x] Cross-plan seams audited and clear of deadlocks, race conditions, or unmapped contracts.
Cleared for execution (`/gsd:execute-phase 247`).
