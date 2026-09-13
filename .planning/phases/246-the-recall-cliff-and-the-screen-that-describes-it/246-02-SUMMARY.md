---
phase: 246-the-recall-cliff-and-the-screen-that-describes-it
plan: 02
subsystem: frontend / settings
tags: [settings, search_breadth, prefetch_loading, null_state, changed_fields, recall-02]
requires:
  - "Phase 246 Plan 01 (backend settings model & probe)"
  - "Phase 242 (changedFields diffing & save semantics)"
provides:
  - "Honest pre-fetch loading state in SettingsPage.tsx (`useState<number | null>(null)`)"
  - "Removal of dead compiled-in fallback (`?? 40`)"
  - "Calibrated guidance copy on Retrieval card"
  - "Unit test coverage in SettingsPage.changedFields.test.tsx (22/22 passed)"
affects:
  - "frontend/src/pages/SettingsPage.tsx"
  - "frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx"
tech-stack:
  added: []
  patterns:
    - "Pre-fetch neutral loading placeholder (`animate-pulse` skeleton) preventing false first-paint assertion"
    - "Strict server-driven state hydration without client-side fallback drift"
    - "Changed-fields payload diffing asserting that clean loads produce empty mutation payloads"
key-files:
  created: []
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/__tests__/SettingsPage.changedFields.test.tsx
decisions:
  - "D-246-06 & Finding 1: `hnswEfSearch` is initialized to `null`. The UI renders a neutral skeleton while data loads rather than painting a compiled-in guess, eliminating client-side drift."
  - "Finding 1 dead code: Deleted `?? 40` fallback in `setHnswEfSearch(data.hnsw_ef_search)` because the backend API response types `hnsw_ef_search` as a non-optional integer."
  - "D-246-08: G-2 sketch formally waived in writing — the change is limited to pre-fetch null rendering and lead phrase copy calibration."
  - "521f4a025: Copy and test updated to reflect active default of 40 following the sequential scan discovery."
metrics:
  duration: "~30m"
  completed: 2026-09-13
  tasks: 2
  commits: 2
  files_changed: 2
verification_mode: reviewed
reviewer: claude
reviewed_at: 2026-09-13
---

# Phase 246 Plan 02: Settings UI Pre-fetch Loading Honesty & Copy Calibration — Summary

## 1 · Core Deliverables

1. **Pre-fetch Neutral Loading State (`SettingsPage.tsx`):**
   - Replaced `useState(40)` with `useState<number | null>(null)`.
   - On initial render before `GET /settings` returns, the Search breadth field displays a neutral loading placeholder (`<div className="h-8 w-full rounded-md bg-muted/40 animate-pulse" aria-label="Loading search breadth" />`) rather than asserting a fabricated number (40 or 200).
   - Once server data arrives, `setHnswEfSearch(data.hnsw_ef_search)` hydrates the state directly from the server.

2. **Dead Fallback Elimination:**
   - Removed `?? 40` in `setHnswEfSearch(data.hnsw_ef_search ?? 40)`. The API response schema defines `hnsw_ef_search: int`, so null is never returned over the wire; retaining a client-side `??` was unreachable dead code and a source of silent default drift.

3. **Help Text Calibration & Pinning:**
   - Retrieval card help text copy was calibrated to honestly describe the active server default ("Default is 40 — on our 100,000-passage test library...") and preserves the empirical warning that higher is not better (1000 measured worse than 400).
   - Tested in `SettingsPage.changedFields.test.tsx` via `test_displays_honest_server_default_copy`, ensuring copy does not drift silently.

4. **Testing & Typecheck Verification:**
   - `SettingsPage.changedFields.test.tsx`: All **22/22 tests passed**, verifying neutral loading state when null, clean hydration upon server response, and changed-fields payload serialization ensuring untouched search breadth is never included in save requests.
   - `npx tsc -p tsconfig.app.json --noEmit`: Exact 67 baseline errors (0 new errors added).
