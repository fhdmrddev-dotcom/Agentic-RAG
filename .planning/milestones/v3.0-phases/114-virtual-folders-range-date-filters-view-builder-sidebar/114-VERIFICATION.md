---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
verified: 2026-06-20T00:00:00Z
status: passed
score: 4/4 must-haves verified; the SC#4 WCAG item was measured (Lighthouse a11y 87/100) and resolved by operator decision (gaps are app-wide/pre-existing → SEED-092)
overrides_applied: 0
human_resolution: "2026-06-20 — Orchestrator ran a calibrated Lighthouse accessibility audit (snapshot, desktop) on the live Documents page with the filter builder open + a view selected: accessibility 87/100, best-practices 100. The 2 failing audits — color-contrast (19 nodes, predominantly the shared app-wide text-muted-foreground/60 token) and button-name (46 nodes, predominantly pre-existing DocumentList/nav icon buttons) — are cross-cutting design-system issues, NOT Phase-114 regressions (114's own controls carry accessible names). UX-01 is a cross-cutting criterion. Operator elected (Complete + log) to COMPLETE Phase 114 and log the app-wide WCAG AA remediation as SEED-092. SC#4 Deep Midnight + mobile-responsive were confirmed live in the G-4 UAT. Phase verification → passed."
human_verification:
  - test: "Exhaustive WCAG 2.1 AA contrast measurement and keyboard reach for every row action menu in the NavRow (folder rows AND view rows), including the G-pill focus path and action menu focusability at the NavRow level"
    expected: "All interactive controls reachable by keyboard; visible focus indicator meets WCAG 2.1 AA; color contrast on chip text, amber count, and muted-foreground count badges all pass the 4.5:1 minimum against Deep Midnight background tokens"
    why_human: "The G-4 UAT confirmed WCAG visually but explicitly noted that exhaustive contrast measurement was not numerically measured; a programmatic WCAG audit tool (e.g. Axe, Lighthouse accessibility) or a calibrated color-picker on each token against the design system is required to confirm the AA threshold rather than rely on a visual assertion"
---

# Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar — Verification Report

**Phase Goal:** Complete virtual folders end-to-end — add the range/relative-date evaluator on typed indexed columns and the guided view/filter builder UI that renders saved views in the sidebar exactly like folders.
**Verified:** 2026-06-20
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | View filters support equals / one-of / contains / is-empty / numeric & date comparisons including relative dates ("expiring within N days"); correct rows across month/day boundaries because date/document_type are promoted to typed, btree-indexed columns (VIEW-03) | VERIFIED | 10 VIEW-03 operators registered in `view_operators_extra.py` (12 `@register_operator` occurrences); compiler returns `list[Fragment]` confirmed by grep; `document_type_norm` and `date_typed` GENERATED STORED columns live in DB (`full-schema.sql` L537-538, L1488/L1495); Plan-03 report: 26/26 integration tests GREEN including month-boundary `within_next` test; G-4 UAT step 1: "date within next 30 days" → amber "0 documents match"; G-4 step 3: `document_type is report` → "11 documents match" confirmed against DB count |
| 2 | A guided condition builder (no raw DSL); saved views render in the sidebar as a distinct "Views" group with a visual affordance that they are saved queries (not folders), reusing the global-folder indicator pattern | VERIFIED | `FilterBar.tsx` (329 lines), `ConditionPopover.tsx` (380 lines), `RelativeDateControl.tsx` (207 lines) all substantive; `ViewsGroup.tsx` (258 lines) confirmed to use `Filter` (funnel) lucide icon vs amber `FolderIcon`; copy verified: "saved filters, never query"; G-4 UAT step 3: "appeared in the VIEWS group with an '11' count badge + Actions menu; main view read 'Reports · Documents matching this saved filter'"; G-pill `isGlobal` prop threaded to NavRow (`ViewsGroup.tsx:170`) |
| 3 | EXPLAIN shows index use (not seq scan) for a view query at ~10k docs; sidebar render does not degrade with corpus size | VERIFIED | `test_114_explain_index.py` exists; Plan-03 SUMMARY: "seeded 10,000 throwaway docs + ANALYZE, asserted Index/Bitmap Index Scan, NOT Seq Scan, then fully deleted the seed with a real-document-count preservation guard (33 → 33)"; `full-schema.sql` shows `USING btree (date_typed)` and `USING btree (document_type_norm)` at L1488/1495; ViewsGroup lazy-fetches counts via `countsRef` (5 occurrences) — no eager all-count fetch on mount |
| 4 | The builder + sidebar match Deep Midnight / Aether, are mobile-responsive, and meet WCAG 2.1 AA (UX-01) | UNCERTAIN (human needed) | G-4 UAT step 6 (PASS core): "Deep Midnight dark theme rendered the rail, chip, table, and detail panel cleanly with legible contrast. At 390px the detail panel became a full-width bottom-sheet with all metadata legible." UAT NOTES: "exhaustive WCAG contrast measurement + full keyboard-reach of every row action were not numerically measured this pass." NavRow `aria-invalid` wiring found (line 137); `aria-hidden` on decorative icon (line 105); `opacity-25` at rest (not `opacity-0`) for action menus confirmed in Plan-04. Automated WCAG pass requires human-tool confirmation. |

**Score:** 3/4 truths fully VERIFIED automated; 1/4 UNCERTAIN pending human WCAG measurement (no FAIL)

---

### Deferred Items

None. All four success criteria are active and addressed within this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/view_operators_extra.py` | Additive operators returning Fragment descriptors | VERIFIED | 12 `register_operator` occurrences; 7 VIEW-03 operators directly; `within_next`, `older_than`, `before`, `after`, `between` all present |
| `backend/app/services/view_filter_compiler.py` | Widened compile_filter returning list[Fragment] + Fragment dataclass + seam import | VERIFIED | 20 `Fragment` occurrences; 2 `view_operators_extra` imports (seam wired); `validate_operands` exported (line 60) |
| `backend/app/models/document_view.py` | Additively-widened ViewCondition.op Literal including within_next | VERIFIED | `within_next` appears 2 times; widened Literal confirmed |
| `supabase/migrations/074_view_typed_columns.sql` | GENERATED STORED columns + btree indexes + ISO-regex guard | VERIFIED | 3 `GENERATED ALWAYS AS` occurrences (2 columns + function); 6 `btree` occurrences; `view_iso_to_date` IMMUTABLE helper (3 occurrences) replacing bare `::date` cast rejected by PG15 |
| `supabase/full-schema.sql` | Regenerated with typed columns + indexes | VERIFIED | `document_type_norm` and `date_typed` at L537-538; both btree indexes at L1488/L1495; `view_iso_to_date` at L227 |
| `backend/app/api/document_views.py` | Widened two-leg _apply, count_only mode, server-clock relative-date, Phase-115 handoff | VERIFIED | `count_only` ×2 confirmed; `date.today` confirmed present; `date_typed`/`document_type_norm` ×6 confirmed; `@router.post("/resolve")` stateless endpoint at line 327 (CR-01 fix); `older_than` using `.lt` strict upper bound (WR-03 fix confirmed line 467) |
| `backend/tests/integration/test_114_typed_columns.py` | Auto-backfill + bad-date-yields-NULL + lower() correctness tests | VERIFIED | File exists; Plan-03: "26/26 GREEN live on :54322" |
| `backend/tests/integration/test_114_explain_index.py` | ~10k-seed EXPLAIN index-use proof (SC#3) | VERIFIED | File exists; Plan-03: "asserted Index/Bitmap Index Scan (not Seq Scan)" |
| `backend/tests/integration/test_114_resolve_range_date.py` | Live relative-date boundary + widened-operator resolve + leak-safety | VERIFIED | File exists; Plan-02 SUMMARY: "11 passed, 2 xfailed" → Plan-03: "26/26 GREEN (xfails un-marked)" |
| `backend/tests/integration/test_114_count_only.py` | count_only == full-resolve length incl. own+global overlap dedupe | VERIFIED | File exists; Plan-02: "4 passed, 1 xfailed" → Plan-03: un-marked, all GREEN |
| `backend/tests/integration/test_114_resolve_adhoc.py` | Zero audit/view rows proof for CR-01 stateless resolve | VERIFIED | File exists (confirmed path + content grep); CR-01 resolution note: "9 junk `__live_*` audit rows purged; exercising the builder's live count created 0 new `view.create` rows + 0 transient views" |
| `frontend/src/components/ingestion/NavRow.tsx` | Shared row primitive (icon/name/count/G-pill/actions) | VERIFIED | 222 lines (exceeds 60-line minimum); `opacity-25` at rest (reachable, not `opacity-0`-only); `NAVROW_INDENT_CAP = 3` |
| `frontend/src/components/ingestion/FolderNode.tsx` | Folder row refactored onto NavRow (NavRow grep ≥ 1) | VERIFIED | `grep -c NavRow FolderNode.tsx` = 3 |
| `frontend/src/components/ingestion/DocumentList.tsx` | Move-to-folder action reusing MoveToFolderDialog | VERIFIED | `grep -c MoveToFolderDialog DocumentList.tsx` = 3; `onDrop`/`onDragStart` = 0 |
| `frontend/src/components/ingestion/FilterBar.tsx` | Chip-strip builder, live debounced amber-at-zero count, Save-as-view | VERIFIED | 329 lines (exceeds 80-line minimum); `text-amber-500` at line 263; `createView` ×3 |
| `frontend/src/components/ingestion/ConditionPopover.tsx` | Type-aware operator+value editor, no on-screen matrix | VERIFIED | 380 lines (exceeds 50-line minimum); no `<table>` element (confirmed Plan-05) |
| `frontend/src/components/ingestion/RelativeDateControl.tsx` | [N][unit] stepper + preview-only readout + overdue note | VERIFIED | 207 lines (exceeds 40-line minimum); "Already-overdue items are not included" at line 201; D-114-16 authoritative-server comment present |
| `frontend/src/components/ingestion/ViewsGroup.tsx` | Views sidebar group from NavRow (funnel icon, lazy count, actions) | VERIFIED | 258 lines (exceeds 60-line minimum); `NavRow` ×6; `Filter` (funnel) import; `countsRef` lazy-fetch (5 occurrences) |
| `frontend/src/pages/IngestionPage.tsx` | FilterBar mount + Views group + sidebar rail + column-shedding | VERIFIED | `ViewsGroup` ×10 and `FilterBar` ×10; `selectedViewId` state (line 65); `sessionStorage` pin key `SIDEBAR_PIN_KEY` (line 38) |
| `frontend/src/lib/api.ts` | resolveViewCount + createView + filter-AST client types + updateView | VERIFIED | `count_only\|resolveView` ×9; `createView` ×3; `updateView` at line 2064 (edit-on-save, D-114-3) |
| `frontend/src/types/index.ts` | ViewConditionOp (11 ops) / ViewCondition / ViewFilter / SavedView | VERIFIED | `ViewConditionOp\|within_next` ×5; all 11 operators present (confirmed Plan-05 SUMMARY) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `view_filter_compiler.py` | `view_operators_extra.py` | `from . import view_operators_extra` at line-79 SEAM | WIRED | 2 occurrences confirmed by grep |
| `document_views.py` resolve route | `view_filter_compiler.compile_filter` | `compile_filter` consumed in `resolve_view` + `resolve_adhoc` | WIRED | `resolve_adhoc` at line 327; `compile_filter` called; 6 `count_only` matches |
| `document_views.py` | `documents.date_typed / document_type_norm` | typed-column leg in `_apply` | WIRED | 6 confirmed occurrences; `.lt` strict for `older_than` (WR-03 fix at line 467) |
| `ViewsGroup.tsx` | `NavRow.tsx` | `NavRow` import + usage for view rows | WIRED | `NavRow` ×6 in ViewsGroup; funnel `Filter` icon passed via `icon` prop |
| `IngestionPage.tsx` | `FilterBar.tsx` | controlled `value`/`onChange` + `onViewSaved` | WIRED | `FilterBar` ×10 in IngestionPage; `editingView` state at line 65; `updateView` at line 20 (import) |
| `IngestionPage.tsx` | `ViewsGroup.tsx` | `onSelectView` → loads `filter_expr` into FilterBar | WIRED | `ViewsGroup` ×10 in IngestionPage; `selectedViewId` mutually exclusive with `selectedFolderId` |
| `FilterBar.tsx` | `POST /document-views/resolve` (stateless) | `resolveFilterCount` via `api.ts` after CR-01 fix | WIRED | CR-01 resolution: "api.ts rewired off the transient create/delete dance"; `test_114_resolve_adhoc.py` proves zero audit rows |
| `FolderNode.tsx` | `NavRow.tsx` | delegate row body to NavRow | WIRED | `grep -c NavRow FolderNode.tsx` = 3 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FilterBar.tsx` | live count ("N documents match") | `resolveFilterCount` → `POST /document-views/resolve` (stateless, Plan-02 + CR-01 fix) | Yes — server returns `{total: N}` from live DB query against real documents, caller-scoped | FLOWING |
| `ViewsGroup.tsx` | per-view count badges | `resolveView(id, {count_only: true})` via lazy `countsRef` fetch | Yes — count-only resolve is caller-scoped own+global DISTINCT dedupe (Plan-02); fetched on first open, cached | FLOWING |
| `IngestionPage.tsx` | `views` list | `listViews()` → `GET /document-views` (Phase-113 leak-safe service) | Yes — returns caller's own + global views from live DB | FLOWING |
| `FilterBar.tsx` | document list on active filter | `onActiveFilter` prop → drives `DocumentList` resolve | Yes — full resolve on the live typed-column resolve route | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| 10 VIEW-03 operators compile to bound Fragment descriptors (not SQL strings) | 20 `Fragment` occurrences in compiler; Plan-01: "no f-string SQL anywhere in `view_filter_compiler.py` or `view_operators_extra.py`"; `test_113::test_injection_value_neutralized` green byte-for-byte | PASS |
| SQL injection payload rides as bound literal (SC#4) | Plan-02: "values URL-encode as bound predicate operands (never SQL-interpolated)"; `test_injection_value_neutralized_live` GREEN; `.in_` for `one_of` (PostgREST quoted), `is_empty` hard-coded RHS tokens | PASS |
| Unknown op fails closed (KeyError / ValidationError) | Pydantic `Literal` discriminator + registry `KeyError`; `test_unknown_op_rejected` confirmed GREEN (Plan-01 SUMMARY); `validate_operands` at compiler line 214 | PASS |
| Ad-hoc live count creates ZERO audit rows after CR-01 fix | `test_114_resolve_adhoc.py` exists and proven; CR-01 resolution: "0 new `view.create` rows + 0 transient views"; `@router.post("/resolve")` at document_views.py:327 — no DB write, no audit call | PASS |
| Migration 074 applied without data loss | Plan-03: "documents preserved 33 → 33"; `scripts/apply_migration_074.py` psycopg2-direct apply; `full-schema.sql` carries both columns | PASS |
| EXPLAIN uses Index Scan at ~10k rows | `test_114_explain_index.py` seeds 10k rows + ANALYZE, asserts "Index/Bitmap Index Scan, NOT Seq Scan" on both indexes (Plan-03 SUMMARY) | PASS |
| `older_than` strict boundary (WR-03 fix) | `document_views.py:467`: `.lt(col, high) if frag.builder == "older_than"` — strict `<`, not `<=`; `4da23739` commit; WR-03 boundary test added | PASS |
| Operand validation (WR-02 fix) | `validate_operands` at `view_filter_compiler.py:214`; called at create/update/resolve (lines 179, 241, 388); `e6feb1d3` commit | PASS |
| Relative-date OverflowError guarded (WR-05 fix) | `OverflowError` guard at `document_views.py:108-119`; `61bff2cc` commit; client clamps N on edit | PASS |
| Sidebar→rail collapse pinnable and session-persisted | `SIDEBAR_PIN_KEY` sessionStorage constant at IngestionPage:38; `sessionStorage.getItem` at line 102; G-4 UAT step 5: "Expand sidebar" toggle verified | PASS |

---

### Probe Execution

No conventional probe scripts (`scripts/*/tests/probe-*.sh`) exist for this phase. The Phase-03 verification was driven by `scripts/apply_migration_074.py` (the psycopg2-direct applier) with its own read-back assertions. The Phase-03 SUMMARY documents "OK migration 074 live" as the probe result.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-03 | Plans 01, 02, 03, 05, 06 | View filters support equals / one-of / contains / is-empty / numeric & date comparisons, including relative dates | SATISFIED | 10 operators registered + compiled + resolved against live typed indexed columns; G-4 UAT passes all 4 VIEW-03-touching scenarios |
| UX-01 (Phase 114 slice) | Plans 04, 05, 06 | New DM UI matches Deep Midnight / Aether, mobile-responsive, WCAG 2.1 AA | PARTIALLY SATISFIED | Deep Midnight rendering confirmed live; mobile bottom-sheet at 390px verified; WCAG AA numerical contrast not yet measured — delegated to human item |

**Orphaned requirements check:** No REQUIREMENTS.md entries map to Phase 114 beyond VIEW-03 and UX-01 (cross-cutting). No orphans.

**Note on REQUIREMENTS.md traceability table:** The table still shows `VIEW-03 | Phase 114 | Pending`. This is a documentation artifact — the code is complete and verified. The table should be updated to "Complete" as a documentation task; it is not evidence of a code gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `view_filter_compiler.py` | 23 | `$N``-placeholder discipline` — benign inline comment, not a stub | Info | Documentation context in a comment; the comment explicitly discusses parameterized binding, not a debt marker |
| `ViewsGroup.tsx` | 104, 114 | `console.error` on rename/delete failure — swallows error with no user toast | Warning (pre-existing project pattern, IN-05) | Silent failure path; user sees nothing on rename/delete error. Logged in 114-REVIEW.md as IN-05; project-wide pattern, not a 114 regression |
| `ConditionPopover.tsx` | various | `topics` field declared as `string` type though semantically array-valued (IN-03 in review) | Warning (pre-existing field-type modeling) | `topics` operators (eq/one_of/contains/is_empty) may not match the array-valued field as expected. Documented in 114-REVIEW.md IN-03 as "low priority — pre-existing field-type modeling, not introduced cleanly by this phase" |
| `074_view_typed_columns.sql` | 92-94 | `EXCEPTION WHEN others` catches all errors in `view_iso_to_date` (IN-06) | Info (defensive hardening) | Swallows unexpected errors as NULL. Reviewed as IN-06 in 114-REVIEW.md; low priority per reviewer |

**Debt marker gate:** No `TBD`, `FIXME`, or `XXX` markers found in any Phase-114-modified file (grep clean on all 6 key backend files and 5 key frontend files).

**Stubs check:** No placeholder returns (empty `return []`, `return {}`, `return null`, hardcoded empty responses) found in the Phase-114 implementation paths. The one intentional xfail (`test_within_next_window_math_deferred`) is the documented relative-date window math delegated to the resolve route's server clock per D-114-16 — the unit test is a scope marker, not a stub in a shipped code path.

---

### Human Verification Required

#### 1. WCAG 2.1 AA Contrast and Keyboard Reach — Exhaustive Measurement

**Test:** Run an automated accessibility audit (Axe DevTools, Lighthouse Accessibility, or equivalent) against the live Documents page with the filter builder open, a view selected, the sidebar in rail mode, and at least one chip condition active. Then: use keyboard-only navigation to (a) open the filter condition popover and add a condition, (b) reach the action menu on a folder row in NavRow and trigger Rename, (c) reach the action menu on a view row in ViewsGroup and trigger Edit. Measure color contrast numerically on the amber count (`text-amber-500` on Deep Midnight `bg-card/50`), the muted count badges (`text-muted-foreground`), the summary chip text, and the resolved-window readout in RelativeDateControl.

**Expected:** No WCAG 2.1 AA violations flagged by the automated tool. Color contrast ratios ≥ 4.5:1 on all text elements. All interactive row action menus reachable by Tab/Enter without a pointing device.

**Why human:** The G-4 UAT (scenario 6) confirmed visual legibility and noted the action menus render at `opacity-25` at rest (not invisible), but explicitly stated "exhaustive WCAG contrast measurement + full keyboard-reach of every row action were not numerically measured this pass." WCAG AA requires specific contrast ratios measurable only with calibrated tools, not visual judgment. Keyboard navigation completeness requires tab-through without a mouse, which a Chrome-MCP screenshot pass cannot fully exercise.

---

## Gaps Summary

No blocking gaps were identified. The code is complete, wired, and live-verified through the G-4 Chrome-MCP UAT.

The code review (114-REVIEW.md) surfaced one BLOCKER (CR-01 audit-log pollution from transient view create/delete on every debounced keystroke) and seven warnings. All eight were resolved in a dedicated fix pass (`eb187b32` through `76e1c2e1`), with the backend 113/114 suite confirmed at 71 passed / 1 intentional xfail and 66 frontend tests green post-fix.

The sole remaining open item is the human WCAG AA exhaustive measurement noted above — a completeness gap in the G-4 UAT coverage, not a code defect. The `status: human_needed` classification is conservative: the UX is live and visually confirmed, but the AA threshold requires a calibrated tool pass to formally satisfy UX-01's "meets WCAG 2.1 AA" claim.

**Three items flagged as Warnings (not blocking) for awareness:**

1. **Views count badge refresh lag (P3, non-blocking):** After editing a view's filter in-place via "Update view," the sidebar count badge briefly shows the pre-edit cached value, then self-corrects on the next re-render. DB and list are always correct. Follow-up: invalidate the cached count in the `onViewSaved` refresh path so it updates immediately. Not blocking view of this phase.

2. **`topics` field operator mismatch (IN-03, pre-existing):** The `topics` built-in is typed as `string` in `BUILTIN_FIELDS`, but it is semantically array-valued. The offered operators (`eq`/`one_of`/`contains`/`is_empty`) may not match as the user expects. This is a pre-existing field-type modeling issue, not introduced by Phase 114, and is documented in the review. A future phase that handles array-valued metadata fields should address it.

3. **Silent failure on rename/delete errors (IN-05, pre-existing project pattern):** `console.error` only on folder/view rename and delete failures, no user toast. Matches the existing project pattern; a future a11y/UX sweep should add feedback.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
