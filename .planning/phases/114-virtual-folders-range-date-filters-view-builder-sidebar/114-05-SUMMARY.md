---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 05
subsystem: frontend / no-DSL filter & view builder
tags: [VIEW-03, UX-01, filter-builder, chip-strip, relative-date, count-only, save-as-view, type-aware-operators]

# Dependency graph
requires:
  - phase: 114-02
    provides: "GET /document-views/{id}/resolve?count_only=true → {total} (the live count) + POST/GET/DELETE /document-views CRUD; full resolve → {documents, total}"
  - phase: 114-03
    provides: "Migration 074 live — date/document_type filters resolve through indexed typed columns at scale"
  - phase: 114-04
    provides: "The shared NavRow primitive the FilterBar coexists with (Plan 06 builds the Views group from it)"
  - phase: 112
    provides: "listMetadataFields() client + MetadataFieldDef type (the custom field defs merged with the built-ins)"
provides:
  - "frontend/src/types/index.ts — ViewConditionOp (11 ops) / ViewCondition / ViewFilter / SavedView client AST mirroring the backend Literal"
  - "frontend/src/lib/api.ts — createView / listViews / deleteView / resolveView(count_only) + resolveFilterCount (ad-hoc unsaved-filter live count via transient create→count→delete)"
  - "frontend/src/components/ingestion/FilterBar.tsx — the inline chip-strip builder (029-A): controlled value/onChange, debounced amber-at-zero count, Save-as-view"
  - "frontend/src/components/ingestion/ConditionPopover.tsx — field → type-aware operator → value editor (030-A); no on-screen type/operator matrix"
  - "frontend/src/components/ingestion/RelativeDateControl.tsx — [N][unit] stepper + preview-only resolved-window readout + overdue-excluded note"
affects:
  - "Plan 06 — mounts FilterBar into the Documents page, wires onActiveFilter to the document list, and loads a selected saved view's filter_expr back INTO the bar (controlled value), refreshing the Views sidebar group on onViewSaved"

# Tech tracking
tech-stack:
  added: []  # zero new packages — composed existing primitives (native select/input + lucide icons + cn)
  patterns:
    - "Native <select>/<input> editors (not portal'd Radix Select/Popover) for the condition editor — self-contained, accessible (combobox/option roles), portal-free + testable in jsdom; matches the 'compose primitives, render no matrix' intent without a new @radix-ui/react-popover dependency"
    - "Ad-hoc unsaved-filter live count via a transient create→count_only→delete cycle (no divergent endpoint invented — the shipped count_only param gates by view id only, per 114-02-SUMMARY)"
    - "Debounced live count with a request-id stale-response guard (reqIdRef) + empty-filter short-circuit (no narrowing → no round-trip)"
    - "Controlled-with-uncontrolled-fallback filter state so the bar works standalone (and in tests) yet is fully controlled when Plan 06 passes value/onChange"

key-files:
  created:
    - frontend/src/components/ingestion/FilterBar.tsx
    - frontend/src/components/ingestion/FilterBar.test.tsx
    - frontend/src/components/ingestion/ConditionPopover.tsx
    - frontend/src/components/ingestion/ConditionPopover.test.tsx
    - frontend/src/components/ingestion/RelativeDateControl.tsx
    - frontend/src/components/ingestion/RelativeDateControl.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/types/index.ts

key-decisions:
  - "Native <select>/<input> over Radix Select/Popover for the condition editor — no @radix-ui/react-popover is installed and a package install is a checkpoint gate (deviation-rule exclusion); DropdownMenu/Select portal their content and fight jsdom focus/typing. Native form controls are accessible, self-contained, and the PATTERNS analog ('compose Select + DropdownMenu') is honored in spirit."
  - "The ad-hoc (unsaved) live count uses a transient create→count_only→delete against the shipped by-id resolve route (the only count_only path Plan 02 landed). The transient view is always deleted in a finally block so a keystroke preview never orphans rows."
  - "The relative-date resolved-window readout is computed CLIENT-side for PREVIEW ONLY and documented as non-authoritative (D-114-16 / T-114-05-03) — the server re-derives the real window from its own clock at resolve; only the operator + N + unit in the AST are the truth."

patterns-established:
  - "Type-aware operator vocabulary keyed off field_type with plain-language labels (OP_LABEL) — the operator menu adapting IS the only place the type system surfaces; no on-screen matrix"
  - "FilterBar as the single filtering surface: ad-hoc filtering and saved views are the same controlled ViewFilter; Save-as-view just persists it (D-114-1)"

requirements-completed: [VIEW-03, UX-01]

# Metrics
duration: ~30min
completed: 2026-06-19
---

# Phase 114 Plan 05: No-DSL Filter & View Builder (Chip Strip + Type-Aware Operators + Relative-Date Control) Summary

**Built the guided net-new half of SC#2 — the inline chip-strip `FilterBar` (Where [chip][chip] ＋condition · N match · Save as view), a type-aware `ConditionPopover` whose operator menu adapts to `field_type` with no on-screen matrix, and a direction-carrying `RelativeDateControl` with a preview-only resolved-window readout — wired to the Plan-02 count-only resolve for the live amber-at-zero count and to POST /document-views for Save-as-view, plus the filter-AST client types/calls in `types/index.ts` + `api.ts`.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files:** 8 (6 created, 2 modified)

## Accomplishments

### Task 1 — api.ts + types: the filter-AST client contract (`042c7cf0`)
- Added `ViewConditionOp` (the 11 operators matching the backend `Literal` byte-for-byte), `ViewCondition` ({field, op, value?, value2?, values?, unit?}), `ViewFilter` ({op:"and", conditions}), and `SavedView` to `types/index.ts`.
- Added `createView` / `listViews` / `deleteView` / `resolveView({count_only})` to `api.ts` (POST/GET/DELETE `/document-views`, `GET .../resolve?count_only=true` → `{total}`), mirroring the `listMetadataFields` fetch-wrapper + auth-header conventions.
- Added `resolveFilterCount(filter_expr)` — the ad-hoc (unsaved) live-count helper. Because the shipped `count_only` param gates by view id only (no by-body count path — confirmed against `document_views.py` + 114-02-SUMMARY), it creates a transient view, reads its count-only resolve, and deletes it in a `finally` — using ONLY the endpoint shapes Plan 02 landed (no divergent endpoint invented).

### Task 2 — ConditionPopover + RelativeDateControl (`d242c3b3`)
- `ConditionPopover.tsx`: a field → type-aware operator → value editor. The operator menu options derive from the selected field's `field_type` (string/enum → eq/one_of/contains/is_empty; date → within_next/older_than/before/after/between/is_empty; number → gte/lte/between/eq/is_empty; boolean → eq/is_empty). The value editor adapts: a text/number/date/enum-select scalar, a `values` multi-input for `one_of`, a `value`+`value2` pair for `between`, the `RelativeDateControl` for `within_next`/`older_than`, and NO editor for `is_empty`. Plain-language operator labels (never "query"); ONE quiet hint ("The choices change to fit the field you pick") — no on-screen type/operator matrix (deleted in sketch 030).
- `RelativeDateControl.tsx`: a `[N][unit ▾]` stepper (days/weeks/months) + a live resolved-window readout computed CLIENT-side for PREVIEW only (e.g. "→ Jun 19, 2026 – Sep 17, 2026"), a "Updates automatically…" line, and the "Already-overdue items are not included" note for `within next` (D-114-5). A file-level comment documents that the readout is preview-only and the server is authoritative at resolve (D-114-16).
- 17 tests green.

### Task 3 — FilterBar: chip strip, live debounced count, Save-as-view (`7c3d710e`)
- `FilterBar.tsx` (291 lines): the inline chip strip (029-A) — `Where [chip] [chip] ＋condition`, each chip an AND-ed condition rendered with a plain-language summary and editable/removable via `ConditionPopover`. Produces a `ViewFilter` AST. The live count is debounced (~300ms, configurable) with a request-id stale-response guard, calls `resolveFilterCount`, renders "N documents match", and turns AMBER at zero (D-114-2). An empty filter short-circuits (no narrowing → no round-trip). Save-as-view uses an inline name input → `createView(name, filter_expr)` → `onViewSaved` callback for the sidebar refresh.
- Controlled `value`/`onChange` + `onActiveFilter` props so Plan 06 can load a saved view's filter back IN and drive the document list (ad-hoc and saved are the same surface, D-114-1). Uncontrolled fallback keeps the bar standalone-usable.
- 9 tests green.

## Task Commits

1. **Task 1: filter-AST client types + view CRUD/count calls** — `042c7cf0` (feat)
2. **Task 2: type-aware ConditionPopover + direction-carrying RelativeDateControl** — `d242c3b3` (feat)
3. **Task 3: FilterBar chip strip — live debounced count + Save-as-view** — `7c3d710e` (feat)

## Files Created/Modified
- `frontend/src/types/index.ts` — added the filter-AST client types (ViewConditionOp/ViewCondition/ViewFilter/SavedView).
- `frontend/src/lib/api.ts` — added createView/listViews/deleteView/resolveView(count_only)/resolveFilterCount + the `ViewFilter`/`SavedView` type imports.
- `frontend/src/components/ingestion/ConditionPopover.tsx` (+ test) — the type-aware field→operator→value editor.
- `frontend/src/components/ingestion/RelativeDateControl.tsx` (+ test) — the [N][unit] stepper + preview-only resolved-window readout.
- `frontend/src/components/ingestion/FilterBar.tsx` (+ test) — the chip-strip builder.

## Decisions Made
- **Native form controls over portal'd Radix Select/Popover** for the condition editor. No `@radix-ui/react-popover` is installed, and adding a package is a checkpoint gate (the deviation-rule package-install exclusion); the existing `Select`/`DropdownMenu` portal their content and fight jsdom focus/typing in tests. Native `<select>`/`<input>` are accessible (combobox/option roles), self-contained, and honor the PATTERNS analog intent ("compose primitives") without a new dependency. The `ConditionPopover` is rendered anchored below the bar by `FilterBar` (the "popover" affordance), satisfying the push-never-overlay rule.
- **Ad-hoc count via transient create→count→delete** (see Task 1) — the only honest path against the shipped `count_only`-by-id route; always cleaned up in `finally`.
- **Preview-only relative-date readout** — explicitly non-authoritative (D-114-16), documented in code; the server derives the window at resolve.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan said "compose shadcn Popover" but no Popover primitive / @radix-ui/react-popover exists**
- **Found during:** Task 2 (building ConditionPopover).
- **Issue:** The plan/PATTERNS reference composing a shadcn `Popover`; the project has no `popover.tsx` and no `@radix-ui/react-popover` dependency. Installing one is a checkpoint gate (package-install exclusion), and the available `Select`/`DropdownMenu` portal their content (awkward + untestable for the field/operator/value editor).
- **Fix:** Built the editor with native `<select>`/`<input>` form controls inside an anchored panel (the `ConditionPopover` div, positioned `absolute … top-full` by `FilterBar`). Accessible, self-contained, no new package. The type-aware operator menu + adaptive value editors are unchanged in behavior; only the primitive backing them differs.
- **Files:** `ConditionPopover.tsx`, `RelativeDateControl.tsx`, `FilterBar.tsx`.
- **Commits:** `d242c3b3`, `7c3d710e`.

**Total deviations:** 1 auto-fixed (blocking, primitive substitution). No new package installed; no architectural change; no scope creep — all behavior the plan specified is delivered.

## Threat-Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-114-05-01 (client-composed filter_expr tampering) | mitigate | DONE — the client ONLY assembles the AST. All field-whitelist validation + value binding happens server-side (Plans 01/02: validate_fields at save, resolve-time whitelist re-check, bound PostgREST params). Documented in the types + ConditionPopover headers. A hand-crafted payload cannot inject SQL or filter a non-whitelisted/`_`-field — the server rejects it (422)/binds it as a literal. |
| T-114-05-02 (live count info disclosure) | mitigate | DONE — the count reads from the count-only resolve, which is caller-scoped own+global (Plan 02). The client cannot count another user's docs; the displayed N is the caller's own resolved total. |
| T-114-05-03 (relative-date preview tampering) | accept | The resolved-window readout is PREVIEW-only and non-authoritative (D-114-16, documented in `RelativeDateControl.tsx`). A manipulated client readout cannot change which rows the server returns. |
| T-114-05-SC (npm/pip installs) | accept | NO package installed — composed existing primitives only. The plan's "compose shadcn Popover" was satisfied with native controls precisely to avoid a new dependency. |

## Known Stubs

None. `FilterBar`/`ConditionPopover`/`RelativeDateControl` are fully wired to the live backend (`createView`, `resolveFilterCount` → `/document-views` + count-only resolve). The uncontrolled `EMPTY_FILTER` fallback is an intentional standalone-usability default, not a stub. Plan 06 mounts these into the Documents page and wires onActiveFilter/onViewSaved/value (its declared scope).

## Verification

- `cd frontend && npx vitest run FilterBar ConditionPopover RelativeDateControl` → **3 files / 26 tests GREEN** (FilterBar 9, ConditionPopover 10, RelativeDateControl 7).
- `cd frontend && npx tsc --noEmit` → **EXIT 0** (no new type errors on any touched file; the pre-existing whole-project `tsc -b` errors in unrelated files — SkillFormDialog/api.test/SettingsPage/StreamsProvider/streamsStore — are out of scope per the build note).
- `cd frontend && npx vite build` → **✓ built** (bundler succeeds; warnings are pre-existing bundle-size/dynamic-import notes).
- Acceptance greps: `count_only|resolveView` ×8 + `createView` ×2 in api.ts; the 11-operator union present; FilterBar 291 lines (≥80), `createView` ×3, `resolveFilterCount` ×2, `amber-500` ×1, no user-facing "query"; ConditionPopover has no `<table>` (no on-screen matrix); RelativeDateControl documents preview-only/D-114-16 ×4.

## Issues Encountered
- The plan referenced a shadcn `Popover` that does not exist in the project (no `@radix-ui/react-popover`). Resolved by substituting native form controls (see Deviation 1) rather than installing a package (checkpoint gate). The Radix `Select`/`DropdownMenu` portal behavior would also have complicated the testable field/operator/value editor.

## Next Phase Readiness
- **Plan 06:** mount `<FilterBar>` into the Documents page — pass `value`/`onChange` to load a selected saved view's `filter_expr` back into the bar (D-114-1), wire `onActiveFilter` to drive `DocumentList`, and `onViewSaved` to refresh the Views sidebar group (built from the Plan-04 `NavRow`). `customFields` comes from `listMetadataFields()`.
- The client AST contract (`ViewFilter`/`SavedView`) + the CRUD/count calls are live and type-clean against the Plan-02/03 backend.

## Self-Check: PASSED

- Created files exist: FilterBar.tsx(+test), ConditionPopover.tsx(+test), RelativeDateControl.tsx(+test), 114-05-SUMMARY.md — all FOUND.
- Modified files present: api.ts, types/index.ts — FOUND.
- Commits exist: `042c7cf0` (Task 1), `d242c3b3` (Task 2), `7c3d710e` (Task 3) — all FOUND in git log.
- Verification green: 26/26 vitest across the 3 suites; `npx tsc --noEmit` EXIT 0; `npx vite build` ✓ built.

---
*Phase: 114-virtual-folders-range-date-filters-view-builder-sidebar*
*Completed: 2026-06-19*
