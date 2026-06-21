---
phase: 118-auto-classification
plan: 04
subsystem: frontend
tags: [frontend, types, api-client, classification, interface-seam, CLASS-01, CLASS-03]
requires:
  - "frontend types/index.ts (SavedView, RelationshipRow, DocumentMetadata, ViewFilter)"
  - "frontend api.ts views + relationships client families (clone-targets)"
  - "App.tsx ActiveView union"
  - "Backend contract from Plans 02/03 (/classification-rules CRUD + /documents/{id}/classification/{accept,dismiss})"
provides:
  - "ClassificationRule + ClassificationSuggestion TS types"
  - "_classification?: ClassificationSuggestion on DocumentMetadata"
  - "rule CRUD client fns (listRules/createRule/updateRule/deleteRule)"
  - "accept/dismiss client fns (acceptClassification/dismissClassification)"
  - "ActiveView union extended with 'classification-rules'"
affects:
  - "Plan 05 (on-doc UI: DocumentList row chip + ClassificationSection panel)"
  - "Plan 06 (rules page: AutomationGroup + RuleBuilderPanel + ClassificationRulesPage)"
tech-stack:
  added: []
  patterns:
    - "interface-first seam: types + client + union defined in one wave-1 plan so the two UI plans build against a fixed contract"
    - "createRule body OMITS is_global (server hard-sets it) — mirrors createView (T-118-04-01)"
    - "preview reuses existing resolveAdHoc/resolveFilterCount (no new count fn); Undo reuses existing moveDocument (no new fn)"
    - "404-tolerant DELETE (deleteView pattern)"
key-files:
  created: []
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/lib/api.ts"
    - "frontend/src/App.tsx"
decisions:
  - "ClassificationSuggestion.suggested_folder_name typed string | null (Pitfall 5 — ON DELETE SET NULL folder)"
  - "ClassificationSuggestion.prior_folder_id typed optional (stamped at ACCEPT time only, absent on a fresh suggestion; D-118-6)"
  - "ClassificationRule.match_expr reuses the SAME ViewFilter AST (the matcher evaluates it in-Python at upload) — no new filter type"
  - "createRule's suggest_folder_id param typed string | null (the FK is nullable)"
metrics:
  duration: "~3 min"
  completed: "2026-06-21"
  tasks: 2
  commits: 2
  files_changed: 3
---

# Phase 118 Plan 04: Frontend Interface Seam (Types + API Client + ActiveView) Summary

The leak-safe, convention-matching frontend contract the two Phase-118 UI plans (05 on-doc, 06 rules-page) build against: TypeScript types (`ClassificationRule`, `ClassificationSuggestion`, `_classification?` on `DocumentMetadata`), the classification client family (rule CRUD + accept/dismiss, mirroring the views/relationships conventions), and the `ActiveView` union extension — defined in one wave-1 plan so the UI plans receive the types/client directly with no scavenger hunt.

## What Was Built

### Task 1 — Types (`frontend/src/types/index.ts`, commit `4751480d`)
- **`ClassificationRule`** — a `SavedView` clone: `filter_expr` → `match_expr` (the SAME `ViewFilter` AST), plus `suggest_folder_id: string | null` (nullable FK, `ON DELETE SET NULL`) and `enabled: boolean` (the toggle rides the UPDATE path). `is_global` kept but server-owned (create never supplies it).
- **`ClassificationSuggestion`** — mirrors the D-118-5 `_classification` object EXACTLY: `{ rule_id, rule_name, condition_summary, suggested_folder_id: string | null, suggested_folder_name: string | null, status: "suggested" | "accepted", prior_folder_id?: string | null }`. `suggested_folder_name` is nullable (Pitfall 5 — resolved fresh, null/"(deleted)" when the folder is gone); `prior_folder_id` optional (stamped at ACCEPT time only).
- **`_classification?: ClassificationSuggestion`** added to `DocumentMetadata` the SAME way `_source`/`_confidence` are typed there, so `doc.metadata?._classification` type-checks for the Plan-05 row chip + panel.

### Task 2 — API client + ActiveView (`frontend/src/lib/api.ts` + `frontend/src/App.tsx`, commit `48567973`)
- **Rule CRUD** (clones the views family `getAuthHeaders()` + throw-on-non-ok + 404-tolerant DELETE): `listRules()` → GET; `createRule(name, match_expr, suggest_folder_id)` → POST with body `{ name, match_expr, suggest_folder_id }` (**OMITS `is_global`** — server hard-sets it, mirrors `createView`, T-118-04-01); `updateRule(id, body)` → PATCH (the `enabled` toggle rides this path); `deleteRule(id)` → DELETE (404-tolerant).
- **Accept/dismiss**: `acceptClassification(docId)` → PATCH `/documents/{id}/classification/accept`; `dismissClassification(docId)` → PATCH `/documents/{id}/classification/dismiss`.
- **No new count fn** — the "would match N" preview reuses the EXISTING `resolveAdHoc`/`resolveFilterCount` (count_only:true); a rule's `match_expr` is the SAME `ViewFilter` AST. **Undo** reuses the EXISTING `moveDocument(id, prior_folder_id)`.
- **`ClassificationRule`** added to the api.ts type import (`ViewFilter`/`Document` were already imported).
- **`ActiveView`** union at `App.tsx:9` extended with `"classification-rules"`.

## Verification Results

- `npx tsc --noEmit` **EXIT 0** on the final state (run after each task).
- Task 1 greps: `ClassificationSuggestion` + `_classification` both match in `types/index.ts`; `status` is the `"suggested" | "accepted"` union; `suggested_folder_name: string | null`.
- Task 2 greps: `classification-rules` matches in `api.ts` (rule CRUD) AND `App.tsx` (union); `classification/accept` + `classification/dismiss` both match; `createRule`'s POST body has **no `is_global`** (`sed`-scoped grep of the fn = empty); **no new count fn** (the only count_only references are the pre-existing Phase-114 `resolveView`/`resolveAdHoc`/`resolveFilterCount`).
- **G-5**: `threads.py` byte-untouched (`git diff a7986c2b HEAD -- backend/app/api/threads.py` = 0 lines).
- **Net-new failures = 0**: the changes are purely additive (new exported types, new exported fns, one extended union member — zero existing symbols modified), and `tsc` is clean project-wide. Confirmed live: the api client test suites (`src/lib/api.test.ts` + `src/__tests__/lib/api.test.ts`) ran **48/48 passed**.
- No file deletions in either commit; no new untracked files created by this plan (the untracked roster is pre-existing GSD-tooling/snippet/UAT artifacts, out of scope, left alone).

## Deviations from Plan

None — plan executed exactly as written. Both tasks committed individually; the two acceptance-grep batteries and `tsc` all passed first try.

## Authentication Gates

None.

## Known Stubs

None. This plan defines the interface contract only; Plans 05/06 wire the consuming UI. The types/client are complete, real, and exercised by the existing api test suite — no placeholder values, no empty data sources.

## Self-Check: PASSED

- Created files: N/A (no net-new files — 3 edits to existing files).
- Modified files exist:
  - `frontend/src/types/index.ts` — FOUND (ClassificationRule + ClassificationSuggestion + `_classification`).
  - `frontend/src/lib/api.ts` — FOUND (rule CRUD + accept/dismiss).
  - `frontend/src/App.tsx` — FOUND (`classification-rules` in ActiveView).
- Commits exist:
  - `4751480d` — FOUND (Task 1 types).
  - `48567973` — FOUND (Task 2 client + union).
