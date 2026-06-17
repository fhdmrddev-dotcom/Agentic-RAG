---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
plan: 04
subsystem: ui
tags: [react, typescript, vitest, vitest-axe, accessibility, push-split-panel, inline-edit, metadata, lucide-react]

# Dependency graph
requires:
  - phase: 112-metadata-enrichment-document-detail-panel-manual-edit (Plan 01)
    provides: "PATCH /documents/{id}/metadata (audited single-field write, server-stamps _source='user') — the endpoint the inline-edit commit calls"
  - phase: 112-metadata-enrichment-document-detail-panel-manual-edit (Plan 03)
    provides: "ConfidenceChip primitive + extended DocumentMetadata/MetadataFieldDef types + updateDocumentMetadata/listMetadataFields API methods — consumed directly, not re-implemented"
provides:
  - "DocumentDetailPanel (frontend/src/components/metadata/DocumentDetailPanel.tsx) — the right-side push/split document-detail shell; the SHARED shell Phases 117/118 plug accordion sections into"
  - "InlineEdit (frontend/src/components/metadata/InlineEdit.tsx) — type-appropriate honest inline metadata edit (FolderNode pattern)"
  - "InlineEdit Wave-0 suite (5 tests, AC10) + DocumentDetailPanel a11y suite (7 tests, AC11 automatable core)"
  - "IngestionPage push/split grid + selectedDocId state + panel mount"
  - "DocumentList row-click onSelect (inline MetadataPanel retired; version-history inline-expand preserved)"
affects: [117-relationships (adds a Relationships section to THIS panel shell), 118-classification (adds a Classification section + row affordance to THIS panel)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Right-side push/split detail panel: IngestionPage grid gridTemplateColumns minmax(0,1fr) 430px when a doc is selected; list shrinks but stays visible; panel owns its own useIsMobile(<768) bottom-sheet fallback (reuses the WorkspacePanel sheet shape)"
    - "Union field set, never raw keys: BUILTIN_FIELDS (7, schema order) ∪ enabled custom defs (filtered enabled && !field_key.startsWith('_') && !builtin); _confidence/_source nested keys never enumerated as fields (T-112-04-03)"
    - "Honesty receipt only-after-write: 'Saved · audit logged' renders ONLY inside the await updateDocumentMetadata(...) success branch (role=status aria-live=polite); error path is role=alert 'wasn't recorded' (T-112-04-01)"
    - "motion-safe: receipt animation — the receipt element renders regardless of prefers-reduced-motion; only the fadeSlideUp animation is gated by the Tailwind motion-safe: variant (honesty receipt still renders instantly when motion off)"
    - "Inline edit = correction not a form (FolderNode pattern): value is a <button> trigger → click swaps to a type-appropriate control in place; Enter commits if dirty, Esc cancels + restores trigger focus (requestAnimationFrame), guarded blur-commit; empty field = focusable dashed 'Not extracted — add' affordance"
    - "Panel-scoped AA tokens only (--panel-status-done/-active, --panel-muted-foreground, lightened red hsl(0 80% 80%)) — never global --muted-foreground (3.59:1)"

key-files:
  created:
    - "frontend/src/components/metadata/DocumentDetailPanel.tsx"
    - "frontend/src/components/metadata/InlineEdit.tsx"
    - "frontend/src/components/metadata/InlineEdit.test.tsx"
    - "frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx"
  modified:
    - "frontend/src/pages/IngestionPage.tsx"
    - "frontend/src/components/ingestion/DocumentList.tsx"

key-decisions:
  - "Typecheck ran via tsc -b --noEmit (project-references build mode, what npm run build uses), NOT the plan's literal tsc --noEmit -p tsconfig.json (root tsconfig is a references shell with files:[] → -p typechecks nothing). Net-new errors proven 0 via baseline-stash diff (comm -13), consistent with Plan 03's documented mechanism."
  - "InlineEdit fieldType is a superset of the custom-field field_type vocab — built-ins title/author/summary/topics are not in MetadataFieldDef.field_type, so InlineFieldType adds them; the panel maps each built-in to its control type explicitly (BUILTIN_FIELDS)."
  - "enum/boolean edit commits immediately on Select value-change (a Select has no 'Enter'); string-likes/date/number/topics commit on Enter/blur. topics edits as comma-text in v1 (RESEARCH Open Q2) — pill editor deferred."
  - "Empty field renders NO ConfidenceChip (nothing was extracted to score) — only the InlineEdit 'Not extracted — add' affordance; the warn-count badge counts LOW + EMPTY fields."

patterns-established:
  - "The document-detail shell is the shared surface for v3.0 DM panels: ships ONLY the Metadata PanelSection this phase (no inert Relationships/Classification/Versions stubs — honesty: no signposts to unbuilt features); 117/118 add their accordion sections here."
  - "Inline-edit honesty is asserted in tests: the receipt's 'audit logged' claim renders only in the PATCH success branch; the error path is the role=alert inverse."

requirements-completed: [META-02, META-05]

# Metrics
duration: ~12min
completed: 2026-06-17
---

# Phase 112 Plan 04: Document Detail Panel + Honest Inline Metadata Edit Summary

**Net-new right-side push/split `DocumentDetailPanel` (Metadata-only `PanelSection` accordion, union of 7 built-ins + enabled custom defs, per-field `ConfidenceChip` honest states, mobile bottom-sheet) + `InlineEdit` (FolderNode-pattern type-appropriate edit with Enter/Esc/blur + empty-add) wired into `IngestionPage` push/split grid; `DocumentList` inline metadata retired (row-click opens the panel, chevron toggles versions only); WCAG 2.1 AA proven via vitest-axe + the honest-states ARIA contract.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-17T21:41:14Z
- **Completed:** 2026-06-17T21:53Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Built `DocumentDetailPanel` — the right-side push/split detail shell (sketch 027/028 winner A). Renders the **Metadata-only** `PanelSection` accordion (reused DIRECTLY — no new accordion), the **union** of the 7 Phase-111 built-ins (schema order) + enabled custom field defs (`listMetadataFields()` filtered `enabled && !startsWith('_') && !builtin`), each row carrying the Plan-03 `ConfidenceChip` with its honest states + a decorative trust-gutter spine. No inert Relationships/Classification/Versions stubs (honesty: the shell is architecturally ready but ships only the section this phase delivers; 117/118 add theirs).
- Built `InlineEdit` — the FolderNode-pattern type-appropriate correction control: `input` (string/title/author/date/number), `Textarea` (summary, Cmd/Ctrl+Enter commits), `Select` (enum + boolean), comma-text (topics/array v1). Enter commits if dirty, Esc cancels + restores trigger focus, guarded blur-commit; editing an empty/absent field opens the same control from a focusable "Not extracted — add" affordance.
- Wired the honesty contract: the **"🛡 Saved · audit logged" receipt renders ONLY inside the `await updateDocumentMetadata(...)` 200 branch** (`role=status aria-live=polite`), with `loadDocuments()` reconcile (Realtime best-effort, D-v2.5-03); the failure path is the honest inverse (`role=alert` "your change wasn't recorded"). The receipt animation is `motion-safe:` so it STILL renders instantly under `prefers-reduced-motion`.
- Wired `IngestionPage`: `selectedDocId` state + a push/split grid (`gridTemplateColumns: minmax(0,1fr) 430px` when a doc is selected, `minmax(0,1fr)` otherwise — the list shrinks but stays visible); mounts `DocumentDetailPanel` (with `onReconcile=loadDocuments`); the panel owns its own mobile bottom-sheet (`useIsMobile()<768`).
- Retired `DocumentList`'s inline `MetadataPanel` (one honest surface): the filename cell is now a `<button>` → `onSelect?.(doc.id)` opening the panel; the chevron toggles **version history only** (`isExpandable = hasVersions`); `VersionHistoryPanel` + the `expanded`/`toggle` machinery preserved; a selected-row affordance (`data-selected` + `bg-primary/5` + `aria-pressed`).
- Proved WCAG 2.1 AA: `DocumentDetailPanel.a11y.test.tsx` (7 tests) — aXe `toHaveNoViolations()` across all states, the APG accordion (`button aria-expanded aria-controls` + `role=region`), every chip a visible WORD (never colour-alone), an unscored field NEVER renders "High", the polite/assertive ARIA split, and the receipt rendering under simulated `prefers-reduced-motion`.

## Task Commits

Each task was committed atomically (with hooks, no --no-verify):

1. **Task 1: DocumentDetailPanel + InlineEdit + InlineEdit.test** - `b2449392` (feat)
2. **Task 2: IngestionPage push/split + DocumentList retire-inline-metadata + row-click** - `650a0141` (feat)
3. **Task 3: WCAG 2.1 AA a11y proof + DocumentList dead-prop cleanup** - `a38a5ae5` (test)

**Plan metadata:** committed separately by the orchestrator (this SUMMARY).

## Files Created/Modified
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` - The push/split detail shell: Metadata-only `PanelSection` accordion, union field render (built-ins ∪ enabled custom defs, never raw keys), per-field `ConfidenceChip` + trust-gutter spine + honest states, the success/error receipt (only-after-write), mobile bottom-sheet, focus-on-close-button, panel-scoped AA tokens.
- `frontend/src/components/metadata/InlineEdit.tsx` - Type-appropriate inline edit control (FolderNode pattern): control-by-`fieldType`, Enter/Esc/blur commit semantics, dirty guard, empty-add affordance, `onCommit(field, value)`.
- `frontend/src/components/metadata/InlineEdit.test.tsx` - 5-test Wave-0 suite (AC10): click-to-edit swap, Enter saves changed value, dirty guard (no commit when unchanged), Esc cancel + focus restore, empty-field add.
- `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` - 7-test a11y suite (AC11 automatable core): aXe no-violations, accordion ARIA, never-colour-alone, never-"High"-unscored, polite/assertive receipt split, reduced-motion receipt render.
- `frontend/src/pages/IngestionPage.tsx` - `selectedDocId` state + `selectedDoc` memo + push/split grid + `DocumentDetailPanel` mount + `onSelect`/`selectedDocId` threaded into `DocumentList`.
- `frontend/src/components/ingestion/DocumentList.tsx` - Retired the inline `MetadataPanel`; `onSelect`/`selectedDocId` props; filename-cell click opens the panel; `isExpandable = hasVersions`; selected-row affordance; removed the dead `currentVersionNumber` prop (Rule 1 cleanup).

## Checks: what ran green vs skipped (honest report)

- **vitest (InlineEdit.test.tsx — AC10):** GREEN — 5/5 pass (click-to-edit, Enter save, dirty guard, Esc cancel+focus restore, empty-add).
- **vitest (DocumentDetailPanel.a11y.test.tsx — AC11):** GREEN — 7/7 pass, including aXe `toHaveNoViolations()` on the rendered panel. (A benign jsdom "HTMLCanvasElement.getContext not implemented" log appears — it is NOT a test failure; it is the known jsdom canvas limitation and does not affect any assertion.)
- **vitest (full src/components/metadata):** GREEN — 20/20 (8 ConfidenceChip from Plan 03 + 5 InlineEdit + 7 a11y).
- **vitest (src/__tests__/components/IngestionPage.test.tsx — regression):** GREEN — 4/4 still pass after the push/split rewire (no regression).
- **tsc (type-check):** RAN via `tsc -b --noEmit` (build mode — the root `tsconfig.json` is a project-references shell with `files: []`, so `-p tsconfig.json` typechecks nothing; build mode is what `npm run build` uses). **Zero net-new type errors** introduced by this plan: a normalized baseline-signature diff (`comm -13` before vs after) is empty. My 4 created files + IngestionPage emit ZERO tsc errors. As a side effect the plan **removed** one pre-existing baseline error (`DocumentList.tsx ... 'currentVersionNumber' is declared but never read` TS6133) by deleting the dead prop in the file I was editing.
- **eslint (my 4 created files + IngestionPage.tsx):** GREEN — exit 0, no findings.
- **eslint (DocumentList.tsx):** 1 PRE-EXISTING finding remains — `no-unused-expressions` on the `toggle()` `next.has(id) ? next.delete(id) : next.add(id)` ternary (line 221). This is preserved machinery (the version-expand toggle I explicitly kept), predates this plan, and is out of scope per the scope boundary. Down from 2 (I cleared the `currentVersionNumber` unused-vars finding).
- **Full vitest suite:** NOT run. The plan's automated verify is scoped to the InlineEdit + a11y tests + tsc; the full suite carries the known SEED-056 frontend rot (~14-17 pre-existing failures unrelated to this plan).

## Decisions Made
- **tsc invocation:** Used `tsc -b --noEmit` (the project's real typecheck) instead of the plan's literal `tsc --noEmit -p tsconfig.json` (typechecks nothing against the references shell). Net-new proven 0 by baseline diff, per the SEED-056 / `project_frontend_vitest_rot` guidance (prove net-new via baseline, not raw count). Same mechanism Plan 03 documented.
- **InlineEdit control mapping LOCKED** per RESEARCH Open Q1/Q2 + the plan: string/title/author/date/number → Input; summary → Textarea (Cmd/Ctrl+Enter); enum/boolean → Select (commit-on-change); topics/array → comma text (v1, pill editor deferred).
- **Empty field renders no chip** — only the "Not extracted — add" affordance (a chip would imply something was scored). The warn-count badge counts LOW + EMPTY (the needs-review signal).
- **enum/boolean commit-on-change** — a Select has no Enter; selecting a new value commits immediately and returns focus to the trigger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the dead `currentVersionNumber` prop in DocumentList (the file I was editing)**
- **Found during:** Task 3 (eslint + tsc verification of the edited DocumentList)
- **Issue:** `VersionHistoryPanel`'s `currentVersionNumber` prop was declared but never read — a pre-existing TS6133 + eslint `no-unused-vars` error that sat in the file I was modifying (it was in the tsc baseline).
- **Fix:** Deleted the prop from the `VersionHistoryPanel` interface and its single call site (the prop value was never referenced inside the component).
- **Files modified:** `frontend/src/components/ingestion/DocumentList.tsx`
- **Verification:** tsc baseline diff shows this signature REMOVED (not net-new); eslint DocumentList findings dropped 2 → 1.
- **Committed in:** `a38a5ae5` (Task 3 commit)

**2. [Verification-mechanism clarification] `tsc -b` vs `tsc -p`**
- Not a code deviation; the AC intent ("no new type errors introduced") is met and proven via baseline diff. See Decisions.

**Total deviations:** 1 auto-fixed (Rule 1 dead-code cleanup directly in the edit path) + 1 verification-mechanism clarification. No scope creep — the panel/edit/wiring delta is exactly the plan's spec.

## Issues Encountered
- A benign jsdom log "Not implemented: HTMLCanvasElement's getContext()" surfaces during the a11y render (lucide/Radix touch canvas in the layout). It does NOT fail any assertion or aXe check — confirmed by 7/7 green. No action needed.
- The plan's `tsc --noEmit -p tsconfig.json` verify literal would have typechecked nothing (references shell) — used `tsc -b --noEmit` and proved net-new via baseline diff (same as Plan 03).

## Threat surface
All four planned threats mitigated as designed:
- **T-112-04-01 (receipt-before-write):** the "Saved · audit logged" receipt renders ONLY inside the `await updateDocumentMetadata(...)` success branch; the error path is the `role=alert` inverse. Asserted by the a11y test's success/error path assertions ("no `role=status` before any edit"; "no success receipt on a failed write").
- **T-112-04-02 (fabricated authority / unbuilt signposts):** ConfidenceChip honest states (Plan 03) + the panel ships ONLY the Metadata section (grep: no Relationships/Classification/Versions section literals). Asserted by the never-"High"-unscored a11y test.
- **T-112-04-03 (raw-key disclosure):** the field set is BUILTIN_FIELDS ∪ enabled custom defs; `_`-prefixed keys are never enumerated; no `Object.keys(metadata)` for the field set.
- **T-112-04-04 (a11y regression):** panel-scoped AA tokens only; vitest-axe `toHaveNoViolations`; APG accordion reuse; focus management (close button on open, Esc → trigger).

No new security-relevant surface beyond the plan's threat model.

## Known Stubs
None. The panel is fully wired to real data sources: `listMetadataFields()` hits the live `GET /metadata-fields`; inline-edit commits hit the live `PATCH /documents/{id}/metadata` (Plan 01); `ConfidenceChip` consumes the real `_confidence`/`_source` maps. The only `placeholder` strings are legitimate form-control placeholders (`<SelectValue placeholder>`, the topics comma-input hint) — not stub data. The shell intentionally ships only the Metadata section (Relationships/Classification are owned by Phases 117/118, NOT stubbed here — that is the honesty contract, not a stub).

## User Setup Required
None - no external service configuration required. (The PATCH endpoint from Plan 01 must be live for end-to-end edit; the client is written against its contract and 112-01-SUMMARY confirms it is live on :54322.)

## Next Phase Readiness
- **Phase 117 (Relationships):** add a `Relationships` `PanelSection` to `DocumentDetailPanel` — the shell, the push/split grid, the mobile bottom-sheet, and the focus management are already in place. Do NOT build a new surface.
- **Phase 118 (Classification):** add a `Classification` `PanelSection` here + a row affordance in `DocumentList`.
- Manual-only (VALIDATION.md, the G-4 lived-experience gate — NOT this plan's automated scope): desktop split-push + mobile bottom-sheet feel; greyscale Low distinguishability; full keyboard sweep (j/k/Arrow roving); the end-to-end edit→PATCH→re-extract-preserve via the UI cross-checked against the `metadata.update` audit row on :54322.
- No blockers.

## TDD Gate Compliance
This plan's tasks are `type="auto"` (not plan-level `type: tdd`), so the RED→GREEN gate sequence is not mandated. Tests were authored alongside the components they exercise (Wave-0 co-location): InlineEdit.test.tsx with InlineEdit (Task 1), DocumentDetailPanel.a11y.test.tsx with the panel (Task 3). All assertions are live and green.

## Self-Check: PASSED
- FOUND: frontend/src/components/metadata/DocumentDetailPanel.tsx
- FOUND: frontend/src/components/metadata/InlineEdit.tsx
- FOUND: frontend/src/components/metadata/InlineEdit.test.tsx
- FOUND: frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
- FOUND (modified): frontend/src/pages/IngestionPage.tsx, frontend/src/components/ingestion/DocumentList.tsx
- FOUND commit b2449392 (Task 1 feat — panel + inline edit + test)
- FOUND commit 650a0141 (Task 2 feat — IngestionPage push/split + DocumentList retire/row-click)
- FOUND commit a38a5ae5 (Task 3 test — a11y proof + dead-prop cleanup)

---
*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Completed: 2026-06-17*
