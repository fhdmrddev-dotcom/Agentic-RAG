---
phase: 118-auto-classification
plan: 05
subsystem: ui
tags: [frontend, react, classification, detail-panel, document-list, accept-dismiss, a11y, CLASS-03, UX-01]

# Dependency graph
requires:
  - phase: 118-04
    provides: "ClassificationSuggestion type + _classification on DocumentMetadata + acceptClassification/dismissClassification client fns; moveDocument (existing) for Undo"
  - phase: 117-04
    provides: "RelationshipsSection clone-target (own-section state machine, re-fetch-not-optimistic, honest states, a11y always-on touch) + the DocumentDetailPanel PanelSection mount + count-lift pattern"
  - phase: 112-04
    provides: "DocumentDetailPanel shared shell (the host for the new section) + ConfidenceChip honest-states precedent"
provides:
  - "ClassificationSection — on-doc matched-rule provenance (rule_name + condition_summary + → folder), honest suggested/accepted/no-match states, reversible accept/dismiss/Undo (re-fetch-not-optimistic)"
  - "DocumentDetailPanel third PanelSection (Classification) with a classCount count-lift"
  - "DocumentList row chip (→ folder ✓ ✕) for a status==='suggested' doc — one-glance accept/dismiss"
affects: ["Phase 118 verify/secure/validate (the on-doc UX-01/CLASS-03 surface)", "Plan 06 (rules page) shares the classification client family"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provenance-not-percentage: a deterministic rule match renders the matched rule + condition_summary, NEVER a fabricated confidence % (the 028/036 honesty principle, applied to classification)"
    - "Re-fetch-not-optimistic without an own GET: the section reads the suggestion off the doc.metadata._classification prop (no getClassification endpoint exists) and reconciles by calling onChanged (the parent loadDocuments re-fetch) on a 200 — never an optimistic local splice"
    - "Count-lift mirror: a third PanelSection lifts a pending-suggestion count (1 when suggested, else 0) via onTotalChange, reset on doc.id change — cloned from the 117 relTotal pattern"
    - "Coarse-pointer always-on chip controls via the shared .rel-x-touch utility (the bottom-sheet/touch has no hover) — reused, not re-authored"

key-files:
  created:
    - "frontend/src/components/classification/ClassificationSection.tsx"
    - "frontend/src/components/classification/ClassificationSection.test.tsx"
    - "frontend/src/components/ingestion/DocumentList.test.tsx"
  modified:
    - "frontend/src/components/metadata/DocumentDetailPanel.tsx"
    - "frontend/src/components/ingestion/DocumentList.tsx"

key-decisions:
  - "ClassificationSection has NO independent GET (no getClassification endpoint exists) — it re-derives the suggestion from the doc.metadata._classification prop and reconciles via onChanged=onReconcile (the parent loadDocuments re-fetch). Re-fetch-not-optimistic is enforced by the onChanged-on-200 path, not a local load(true)."
  - "Undo reuses the existing moveDocument(docId, prior_folder_id ?? null) — no new endpoint (D-118-6 reversible-by-construction)."
  - "onTotalChange lifts 1 ONLY while a suggestion is pending (status==='suggested'); an accepted receipt is not a to-do → lifts 0."
  - "Row chip placed in the filename cell (after the version/table/image badges, outside the filename-open button) with stopPropagation so its ✓/✕ never trigger the row's panel-open click."

patterns-established:
  - "On-doc suggestion surface: a one-glance row chip (confident case) + a full provenance card in the detail panel (when you want to see the rule) — sketch 036-A Winner A, two honest speeds"

requirements-completed: [CLASS-03, UX-01]

# Metrics
duration: ~10min
completed: 2026-06-21
---

# Phase 118 Plan 05: On-Doc Classification Surface (ClassificationSection + DocumentList row chip) Summary

**The honest on-doc accept/dismiss surface for upload-time classification suggestions: a matched-rule provenance card (rule + condition_summary + → folder, NEVER a confidence %) as the 3rd DocumentDetailPanel section with reversible accept/dismiss/Undo, plus a compact `→ folder ✓ ✕` row chip for one-glance triage — both re-fetch-not-optimistic.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-21T03:18Z (approx)
- **Completed:** 2026-06-21T03:28Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 edited)

## Accomplishments
- `ClassificationSection.tsx` (net-new, sketch 036-A): matched-rule provenance (`rule_name` + frozen `condition_summary` + `→ {suggested_folder_name}`), NEVER a confidence %; the "suggested" state reads instantly as **not moved yet**; the "accepted" state renders the `🛡 classification.apply · audit logged` receipt + a reversible **Undo / move back**; the no-match state is a calm dashed empty (NOT `role=alert`).
- Accept/Dismiss/Undo re-fetch via `onChanged` (the parent `loadDocuments` reconcile) on a 200 — never an optimistic splice; a transient re-fetch beat is `role=status`, a mutation failure is `role=alert`.
- Mounted as the **3rd PanelSection** (`Classification`) in `DocumentDetailPanel` after Relationships, wired `doc.metadata?._classification` + `onChanged={onReconcile}` + a `classCount` count-lift (reset on `doc.id` change) mirroring `relTotal`.
- `DocumentList` row chip (`→ {folder} ✓ ✕`) renders **only** for a `status==='suggested'` doc (reads the existing `doc.metadata` — zero new fetch); `✓`→`acceptClassification`, `✕`→`dismissClassification`, both reconcile via the existing `onRefresh`.
- a11y throughout: all controls carry `aria-label`; the row chip controls are coarse-pointer always-on via the shared `.rel-x-touch`; panel-AA tokens (`text-panel-muted-foreground[-dim]`) for meaningful copy.

## Task Commits

Each task was committed atomically:

1. **Task 1: ClassificationSection.tsx + mount as the third PanelSection** — `af39cf8e` (feat). TDD: RED (test, component missing) → GREEN (component + panel mount). Committed test + impl together per the project's single-commit-per-TDD-task convention used in 117.
2. **Task 2: DocumentList row chip (→ folder ✓ ✕) for a suggested doc** — `c03f4c7f` (feat). TDD: RED (chip missing) → GREEN (chip + filename-cell render).

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP/REQUIREMENTS commit)_

_Note: TDD tasks committed as a single feat per task (test + impl together), matching the 117 precedent on this codebase._

## Files Created/Modified
- `frontend/src/components/classification/ClassificationSection.tsx` (created) — the on-doc provenance card + accept/dismiss/Undo state machine.
- `frontend/src/components/classification/ClassificationSection.test.tsx` (created) — 13 tests: provenance render, no-%, suggested-not-moved copy, accepted receipt + Undo, calm no-match, re-fetch-not-optimistic accept/dismiss/Undo, onTotalChange (1/0/0), a11y.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` (modified) — import + 3rd `<PanelSection title="Classification">` + `classCount` state + reset on `doc.id`.
- `frontend/src/components/ingestion/DocumentList.tsx` (modified) — `ClassificationRowChip` + filename-cell render (gated on `status==='suggested'`).
- `frontend/src/components/ingestion/DocumentList.test.tsx` (created) — 7 tests: chip renders only for suggested; absent for no-suggestion AND accepted; ✓/✕ call accept/dismiss + reconcile; a11y aria-labels + row containment.

## Decisions Made
- **No independent GET for the panel section.** There is no `getClassification(docId)` endpoint (Plan 04 added only accept/dismiss + rule CRUD), so `ClassificationSection` reads the suggestion off the `doc.metadata._classification` prop and reconciles via `onChanged=onReconcile` (the parent `loadDocuments` re-fetch). This is the PATTERNS-documented design ("own fetch **or re-derive from the doc**"; props `suggestion={doc.metadata?._classification}`, `onChanged={onReconcile}`). Re-fetch-not-optimistic is enforced by calling `onChanged` only on a 200 and re-rendering from the freshly-resolved prop — never a local optimistic mutation.
- **Undo reuses `moveDocument`** (`moveDocument(docId, prior_folder_id ?? null)`) — no new endpoint (D-118-6).
- **`onTotalChange` lifts 1 only while pending** (`status==='suggested'`); accepted/absent lift 0 (an accepted receipt is not a to-do badge).
- **Row chip in the filename cell**, outside the filename-open button, with `stopPropagation` so ✓/✕ never trigger the row's panel-open click.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-fetch-not-optimistic via `onChanged` instead of a local `load(true)`**
- **Found during:** Task 1 (ClassificationSection)
- **Issue:** The plan's acceptance criterion `grep -n "load(true)"` presumes the section owns an independent GET (the literal RelationshipsSection clone). But no `getClassification(docId)` endpoint exists — Plan 04 added only `acceptClassification`/`dismissClassification` + rule CRUD. A literal `load(true)` would have no fetch fn to call.
- **Fix:** The section re-derives the suggestion from the `doc.metadata._classification` prop and reconciles by calling `onChanged` (= `onReconcile` = the parent `loadDocuments` re-fetch) on a 200. This is exactly the PATTERNS-documented props shape (`onChanged={onReconcile}`) and preserves the load-bearing re-fetch-not-optimistic invariant (claim success only after the 200; re-render from server truth, never an optimistic splice). The behavior test asserts `acceptClassification`/`dismissClassification`/`moveDocument` are each followed by an `onChanged()` call.
- **Files modified:** `frontend/src/components/classification/ClassificationSection.tsx`, `frontend/src/components/metadata/DocumentDetailPanel.tsx`
- **Verification:** `ClassificationSection.test.tsx` 13/13 green (incl. the 3 re-fetch-not-optimistic mutation tests); the `grep -n "load(true)"` criterion is satisfied-in-spirit by the `onChanged`-on-200 path (the design has no local GET to re-run).
- **Committed in:** `af39cf8e` (Task 1 commit)

**2. [Rule 3 - Blocking] Wrapped the DocumentList test render in `TooltipProvider`**
- **Found during:** Task 2 (DocumentList row chip)
- **Issue:** `DocumentList`'s existing action buttons use radix `Tooltip`, which throws "`Tooltip` must be used within `TooltipProvider`" when rendered bare in a unit test (the provider is supplied by the app shell in production). The new `DocumentList.test.tsx` is the first test to render this component.
- **Fix:** Wrapped the test's `renderList` helper in `<TooltipProvider>` (a test-harness concern, not a component change).
- **Files modified:** `frontend/src/components/ingestion/DocumentList.test.tsx`
- **Verification:** `DocumentList.test.tsx` 7/7 green.
- **Committed in:** `c03f4c7f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking). No scope creep.
**Impact on plan:** Both are faithful adaptations to the actual Plan-04 client surface (no classification GET) and the existing component's tooltip dependency. The load-bearing invariants (provenance-not-%, re-fetch-not-optimistic, honest states, a11y always-on) are all preserved and tested.

## Issues Encountered
- A test-data ambiguity in Task 1's RED run: the first fixture used `rule_name="Invoices"` AND `suggested_folder_name="Invoices"`, so `getByText(/Invoices/)` matched two nodes. Resolved by making the fixture distinct (`rule_name="Acme Invoices Rule"`, `suggested_folder_name="Finance Inbox"`) — the component was correct; only the test fixture was ambiguous.

## Verification Results

- **Plan-owned tests GREEN:** `vitest run ClassificationSection DocumentList DocumentDetailPanel` → **4 files / 31 tests passed** (ClassificationSection 13 + DocumentList 7 + DocumentDetailPanel.a11y 7 + the panel mount test). The benign jsdom "HTMLCanvasElement getContext" note (vitest-axe) is not a failure.
- **`tsc --noEmit` EXIT 0** after each task.
- **Task 1 acceptance greps:** no confidence-% rendering (the only `confidence`/`%` matches are a prose comment + an HSL `80%` lightness token — neither is rendered provenance); `ClassificationSection` mounted in `DocumentDetailPanel` (import + 3rd PanelSection).
- **Task 2 acceptance greps:** `_classification` matches; the `status !== "suggested"` chip gate is present; both chip controls carry an `aria-label`; existing-tests-still-pass is trivially satisfied (the file is net-new — no prior DocumentList tests existed to preserve).
- **Net-new failures = 0:** only 3 test files import the 3 changed non-test components (the two new plan tests + the existing `DocumentDetailPanel.a11y.test.tsx`), all GREEN. The changes are purely additive (new component, new chip, new panel section) — no existing exported symbol was modified.
- **G-5:** `threads.py` byte-untouched (`git diff a7986c2b HEAD -- backend/app/api/threads.py` = empty).
- No new package, no new migration, no file deletions, no new untracked generated files.

## Known Stubs
None. Both surfaces are wired to the real Plan-04 client fns (`acceptClassification`/`dismissClassification`/`moveDocument`) and read real data off `doc.metadata._classification`. The no-match / accepted / suggested states are all driven by the live suggestion object — no hardcoded empties, no placeholder data sources.

## Threat Flags
None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced — the section/chip consume the existing owner-scoped accept/dismiss/move endpoints (Plan 03) and render only what the backend returns for the caller's own doc (T-118-05-01 accept: no cross-user render path).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The on-doc UX-01 / CLASS-03 surface is complete: provenance card + reversible accept/dismiss/Undo + row chip, all re-fetch-not-optimistic and a11y-correct.
- Plan 06 (rules page — AutomationGroup + RuleBuilderPanel + ClassificationRulesPage) is the remaining UI plan; it shares the classification client family from Plan 04.
- Deferred to verify-phase (per CONTEXT/VALIDATION): G-4 lived-experience UI UAT (live accept→move→audit→receipt + Undo round-trip; mobile bottom-sheet coarse-pointer reach) — the automated tests cover wiring + a11y shape; lived-experience stays manual.

## Self-Check: PASSED

- Created files exist: `ClassificationSection.tsx` FOUND, `ClassificationSection.test.tsx` FOUND, `DocumentList.test.tsx` FOUND, `118-05-SUMMARY.md` FOUND.
- Commits exist: `af39cf8e` FOUND (Task 1), `c03f4c7f` FOUND (Task 2).

---
*Phase: 118-auto-classification*
*Completed: 2026-06-21*
