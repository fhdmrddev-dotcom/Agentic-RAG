---
phase: 119-document-governance-health
plan: 02
subsystem: ui
tags: [react, vite, tailwind, shadcn, document-management, governance, health-panel, navigation, vitest]

# Dependency graph
requires:
  - phase: 119-document-governance-health (Plan 01)
    provides: "GET /document-governance/{broken-relationships,unclassified,low-confidence} — the 3 owner-scoped {items,total,offset,limit} signal routes the api.ts helpers wrap"
  - phase: 112-metadata-doc-detail-panel
    provides: "DocumentDetailPanel (the DGOV-02 link-out target) + ConfidenceChip/TIER (the honest low-conf chip)"
  - phase: 049-knowledge-health
    provides: "HealthPanel card shell + HealthEmptyState (variant=positive) + the initializedTabsRef no-refetch-loop guard (KnowledgeHealthPage)"
  - phase: 118-auto-classification
    provides: "the classification-rules ActiveView + ChatLayout branch — the EXACT navigation-triad template cloned here (the built-but-unreachable lesson)"
provides:
  - "GovernancePage — the Governance top-level home: counter header + 3 stacked HealthPanel-styled cards (broken / unclassified / low-confidence), each behind the no-refetch-loop guard, each row a pure link-out to DocumentDetailPanel"
  - "GovernanceRow — a read-only, link-out-only row (no inline mutate actions, D-119-6)"
  - "3 api.ts fetch helpers (getGovBroken/getGovUnclassified/getGovLowConfidence) + their item types"
  - "the D-119-2 navigation triad owned in ONE plan: App.tsx ActiveView union + nav-items.ts entry (ShieldCheck) + ChatLayout governance render branch — clicking Governance renders GovernancePage, not KnowledgeHealthPage"
affects: [document-governance-verify-phase, document-governance-secure-phase, document-governance-validate-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only governance consumer page: HealthPanel card shell mapped to a link-out-only GovernanceRow (NOT HealthDocumentRow's inline-mutate row) + own DocumentDetailPanel mount (A5/A6)"
    - "The navigation-triad-in-one-plan discipline (D-119-2): a plan adding an ActiveView member owns the union + the nav entry + the ChatLayout branch in-phase so the surface is reachable"
    - "initializedTabsRef per-card no-refetch-loop guard carried verbatim into a 3-stacked-card page (D-119-9); Refresh clears the ref"

key-files:
  created:
    - "frontend/src/pages/GovernancePage.tsx — counter header + 3 stacked cards + own DocumentDetailPanel mount + the init-guard"
    - "frontend/src/components/health/GovernanceRow.tsx — link-out-only row (no inline mutate actions)"
    - "frontend/src/pages/__tests__/GovernancePage.test.tsx — reachability/empty-state/no-loop/link-out/Refresh"
  modified:
    - "frontend/src/lib/api.ts — 3 governance fetch helpers + item types (additive)"
    - "frontend/src/App.tsx — ActiveView union += 'governance'"
    - "frontend/src/lib/nav-items.ts — NAV_ITEMS Governance entry (ShieldCheck, ungated)"
    - "frontend/src/components/layout/ChatLayout.tsx — governance render branch + GovernancePage import"

key-decisions:
  - "A5 lighter reuse: each card renders the first MAX_ROWS (10) rows of its signal and surfaces the TRUE backend `total` in the card header + counter, rather than wiring full PaginationControls (D-119-7/8 favor the lighter HealthPanel-style reuse; the count stays honest)."
  - "Document resolution for the panel via listDocuments() (the IngestionPage open-by-id pattern): the governance signals carry only ids, so the page holds the caller's docs and resolves a clicked id to its full Document (DocumentDetailPanel needs .metadata)."
  - "Glyph = ShieldCheck (distinct from Wand2=Classification, Activity=Library Health); h1 = 'Document Governance' (distinct from 'Library Health', D-119-1)."
  - "DMF-03 non-gate (A8): the Governance nav entry is NOT gated behind document_management_enabled — 113-118 all ungated; gating Governance alone would be the lone inconsistent surface (one-line comment on the nav entry notes the deliberate non-gate)."

patterns-established:
  - "Link-out-only governance row: clone ONLY HealthDocumentRow's chrome (file icon + truncated filename + chip slot); the whole row is a keyboard-operable <button> → onOpen(docId); imports no document-mutation helper (D-119-6 read-only)."
  - "Navigation-triad-in-one-plan: own App.tsx union + nav-items entry + ChatLayout branch together so an ActiveView member never ships built-but-unreachable (the Phase 118 lesson)."

requirements-completed: [DGOV-01, DGOV-02]

# Metrics
duration: 7min
completed: 2026-06-21
---

# Phase 119 Plan 02: Document Governance Health (Frontend) Summary

**The Governance top-level home — a counter header + 3 stacked HealthPanel-styled cards (broken relationships / unclassified documents / low-confidence metadata), each behind the `initializedTabsRef` no-refetch-loop guard and each row a pure link-out to the document's `DocumentDetailPanel` — wired reachable in-phase via the D-119-2 navigation triad (App.tsx union + nav-items entry + ChatLayout branch), frontend-only with zero migration / package / write path.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-21T14:43:39Z
- **Completed:** 2026-06-21T14:50:47Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Shipped `GovernancePage` — the counter header + 3 STACKED HealthPanel-styled cards (D-119-7, NOT Tabs), each fetched independently behind the `initializedTabsRef` infinite-loop guard (D-119-9), each row a read-only link-out into the document's `DocumentDetailPanel` (DGOV-02), with the low-confidence row chip rendering the honest raw `min_confidence` via the Phase-112 `ConfidenceChip`.
- Owned the **D-119-2 navigation triad in ONE plan** (the Phase 118 built-but-unreachable lesson): App.tsx `ActiveView` union + the `nav-items.ts` entry (distinct `ShieldCheck` glyph, ungated) + the `ChatLayout` governance render branch — clicking Governance now renders `GovernancePage`, not `KnowledgeHealthPage`.
- Added 3 thin additive `api.ts` fetch helpers + item types wrapping the Plan-01 routes, and a `GovernancePage` Vitest (5 tests) that pins reachability, the positive empty state, the no-refetch-loop (exactly-once-per-endpoint), the link-out (panel mounts, no write endpoint called), and Refresh-re-fires.

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts helpers + GovernanceRow + GovernancePage** — `f771e2ef` (feat)
2. **Task 2: the D-119-2 navigation triad (App.tsx union + nav-items entry + ChatLayout branch)** — `630641f0` (feat)
3. **Task 3: GovernancePage Vitest** — `dc7cd3ad` (test)

## Files Created/Modified
- `frontend/src/pages/GovernancePage.tsx` (305 lines) — the Governance home: `CARD_KEYS`/`CARD_META`-driven counter header + 3 stacked `<Card className="ghost-border bg-card/50 shadow-sm">` cards; per-card honest states (loading `role=status` ≠ error `role=alert` + Try again ≠ empty `HealthEmptyState variant="positive"` ≠ populated); the `initializedTabsRef` guard + a Refresh that `.clear()`s it; own `selectedDocId` + `DocumentDetailPanel` mount in a `minmax(0,1fr) 430px` push/split grid.
- `frontend/src/components/health/GovernanceRow.tsx` (50 lines) — a keyboard-operable `<button>` row (file icon + truncated filename + chip slot) → `onOpen(docId)`; disabled when `docId === null` (a broken edge whose openable end is gone); no inline mutate controls, no document-mutation helper import (D-119-6).
- `frontend/src/lib/api.ts` (additive) — `getGovBroken`/`getGovUnclassified`/`getGovLowConfidence` (+ `GovBrokenItem`/`GovUnclassifiedItem`/`GovLowConfidenceItem`), mirroring the knowledge-health helpers' `getAuthHeaders()` + throw-on-non-ok verbatim, returning the shared `PaginatedResponse<T>` shape.
- `frontend/src/App.tsx` — `ActiveView` union += `"governance"`.
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` Governance entry (`ShieldCheck`, label "Governance"), peer to Library Health, with the deliberate-non-gate comment (A8).
- `frontend/src/components/layout/ChatLayout.tsx` — `import { GovernancePage }` + the `activeView === "governance" ? (<GovernancePage />)` branch BEFORE the trailing `<KnowledgeHealthPage />` else.
- `frontend/src/pages/__tests__/GovernancePage.test.tsx` (209 lines) — 5 tests (cards render; positive empty state + exactly-once-per-endpoint no-loop; link-out mounts the panel with no write endpoint called; no inline mutate controls; Refresh re-fires).

## Decisions Made
- **A5 lighter reuse (top-N rows, honest total).** Each card renders the first `MAX_ROWS` (10) rows and surfaces the TRUE backend `total` in the card header + the counter, rather than full `PaginationControls` — D-119-7/8 favor the lighter HealthPanel-style reuse; the count stays honest. A "Showing N of TOTAL — open a document to act on it" line appears when truncated.
- **Document resolution via `listDocuments()`** (the IngestionPage open-by-id pattern). The governance signals carry only ids; `DocumentDetailPanel` needs a FULL `Document` (carries `.metadata`), so the page holds the caller's docs and resolves the clicked id. The broken card opens the READABLE end (`document_id`/`readable_doc_id`), guarding the click when both ends are gone.
- **ShieldCheck glyph + "Document Governance" h1** — distinct from Classification (`Wand2`) and Library Health (`Activity` / "Library Health"), per D-119-1.
- **DMF-03 non-gate (A8)** — the nav entry is deliberately NOT gated behind `document_management_enabled` (113-118 all ungated; gating Governance alone would be the lone inconsistent surface). A one-line comment on the nav entry records the deliberate non-gate.

## Deviations from Plan

None — plan executed exactly as written.

The two reuse-depth calls the plan left to Claude's discretion (A5 pagination granularity, document resolution for the panel) were resolved to the plan's documented lighter defaults and are recorded under Decisions Made, not as deviations. One cosmetic in-source rewording (the GovernanceRow docstring describes-without-naming the forbidden mutation helpers, so the literal-substring D-119-6 acceptance grep on the file is clean) — this is the 116/117 docstring-vs-grep convention, not a behavior change.

## Issues Encountered
- **Vitest `vi.mock` hoisting:** the first test cut declared the `ApiError` stub class at top-level and referenced it inside the hoisted `vi.mock("@/lib/api")` factory → `ReferenceError: Cannot access 'FakeApiError' before initialization`. Fixed by declaring the class INSIDE the factory (the factory is hoisted above module scope). The `vi.fn()`-assigned mock vars work inside the factory via Vitest's standard hoist handling. Resolved within Task 3; final run 5/5 GREEN.

## Verification
- `npx tsc --noEmit` → **EXIT 0** (run after Task 1, Task 2, and Task 3 — the `governance` union member is exhaustively handled by the ChatLayout branch).
- `npx vitest run GovernancePage` → **1 file / 5 tests passed**.
- Acceptance greps all pass: api.ts exports the 3 helpers; `GovernanceRow` imports zero document-mutation helpers / move dialog; `GovernancePage` contains `initializedTabsRef` + a Refresh `.clear()` + mounts `DocumentDetailPanel` with its own `selectedDocId`; the 3 cards use `HealthEmptyState variant="positive"`; the low-conf chip imports `ConfidenceChip` from `@/components/metadata/ConfidenceChip`; the triad is present in one plan (App.tsx union + nav-items `view: "governance"` with a distinct `ShieldCheck` glyph + the ChatLayout branch BEFORE the trailing `KnowledgeHealthPage` else).
- **Reachability proven structurally:** the `GovernancePage` Vitest renders the component the ChatLayout branch mounts; the branch grep confirms `activeView === "governance"` (line 301) precedes `<KnowledgeHealthPage />` (line 309) — so an unhandled view can never fall through to KnowledgeHealthPage.

## Net-new frontend test failures = 0 (base-checkout)
The only changed non-test source files vs the Plan-01 close (`f8d33704`) are `api.ts`, `App.tsx`, `nav-items.ts`, `ChatLayout.tsx` (all additive — a new export set, one new union member, one new nav entry, one new render branch + import) plus the two brand-new files (`GovernanceRow.tsx`, `GovernancePage.tsx`). No existing symbol was modified. Confirmation:
- The api-client suites (`src/lib/__tests__`, `src/__tests__/lib`) ran **8 files / 121 tests GREEN** with the additive api.ts change.
- The sibling-dir regression suites for the touched components (`health`, `metadata`, `relationships`, `classification`, `layout`) ran **9 files / 73 tests GREEN**.
- The ONLY existing importer of the 2 new components is `ChatLayout.tsx` (the Task-2 governance branch, intended); `GovernanceRow` is imported only by `GovernancePage`. The pre-existing streaming/chat/provider/model-info failing-file roster (documented in `117-04-SUMMARY.md`) is unchanged — this plan introduces no new failure by construction.

## Threat surface scan
No NEW security surface beyond the plan's `<threat_model>`. This is a read-only frontend consumer: GovernanceRow imports no write helper (T-119-02-02 mitigated — the Vitest link-out test asserts no write endpoint is called on row interaction); the `initializedTabsRef` guard fires each card once (T-119-02-03 mitigated — the no-loop test asserts one call per endpoint on empty); the navigation triad is owned in one plan so the surface is reachable (T-119-02-01 mitigated — reachability proven structurally + by Vitest); the low-conf chip renders the raw `min_confidence` via the 112 ConfidenceChip, never fabricated (T-119-02-04). Owner-scoping is enforced server-side (Plan 01); the frontend renders only the caller's own data (T-119-02-05 accept). No new package (T-119-02-SC accept). `threads.py` + all backend byte-untouched (G-5).

## Known Stubs
None — no stub patterns (`=[]`/`={}`/`=null`/`=""`-to-UI, "coming soon"/placeholder/TODO/FIXME) in the shipped surface. Empty `items` arrays are the legitimate "all clear" steady state (rendered as the positive HealthEmptyState), not stubs; every card is wired to a live Plan-01 route.

## Next Phase Readiness
- Governance is a reachable top-level home end-to-end: nav entry → ActiveView → ChatLayout branch → `GovernancePage` → 3 live signal cards → link-out into `DocumentDetailPanel` (Relationships / Classification / Metadata fix sections).
- DGOV-01 (the governance view + 3 signals) and DGOV-02 (each row links to its fix) delivered; UX-01 satisfied by HealthPanel/ConfidenceChip/DocumentDetailPanel reuse (Deep Midnight/Aether, single-column mobile-stacked cards, push/split detail panel → mobile bottom-sheet).
- Deferred to verify-phase (per VALIDATION.md): the manual G-4 lived-experience UAT — mobile-responsive 3-stacked-cards layout, WCAG AA, and the actual click-through into the correct detail-panel section across viewports (Chrome MCP). The SC#10 cross-provider 4-axis matrix is N/A (no streaming / agent-loop / provider / thread-state surface; `threads.py` untouched).
- Frontend-only; no migration, no new package, no new write path. **This is the LAST plan of the LAST v3.0 phase** — after verify/secure/validate, v3.0 Document Management is ready to close.

## Self-Check: PASSED

- All 3 created files present + the SUMMARY (`[ -f ]` FOUND for each).
- All 3 task commits present in `git log` (`f771e2ef`, `630641f0`, `dc7cd3ad`).
- `tsc --noEmit` EXIT 0; `vitest run GovernancePage` 5/5 passed; `threads.py` + backend byte-untouched (G-5); no new package.

---
*Phase: 119-document-governance-health*
*Completed: 2026-06-21*
