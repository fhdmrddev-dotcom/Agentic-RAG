---
phase: 153-inline-citations
plan: 02
subsystem: ui
tags: [react, context, citations, css, accessibility, cross-view-nav, rls]

# Dependency graph
requires:
  - phase: 153-01
    provides: backend citation honesty core (normalize/strip/renumber + retrieval-gated instruction) — the provider-uniform `citations` set this UI layer renders over
provides:
  - "CitationNavProvider + useCitationNav(openDocument) — cross-view 'Open document' nav that pre-selects a cited doc through the existing owner/RLS-scoped DocumentDetailPanel fetch (SC#2)"
  - "useCitationNavOptional() — non-throwing accessor for hosts that render in isolation"
  - "flashCitationRow / flashCitationMarker — the scoped, integer-guarded marker↔row bidirectional flash helpers"
  - "Shared DOM constants (CITATION_ROW_ATTR / CITATION_MARKER_ATTR / CITATION_FLASH_CLASS / CITATION_ACTIVE_CLASS) — the single source both the footer (153-03) and cited markdown (153-05) import"
  - "Additive citation CSS block: .citation-marker chip states, @keyframes markerPop attach, .citation-ref-flash bloom, prefers-reduced-motion"
affects: [153-03, 153-04, 153-05, CitationList, CitationCard, CitedMarkdown, CitationPeek, MessageItem]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first shared contract (provider + DOM constants + CSS) built BEFORE its Wave-2/3 consumers so the marker↔row link has one source of truth"
    - "Owner/RLS gate by reuse: cross-view doc open routes through the EXISTING owner-scoped selection (setSelectedDocId over the user's own documents list), never a new unscoped document_id fetch"
    - "One-shot pending-intent via shared context (no ChatLayout prop-drill; consumed after use)"
    - "Non-throwing optional hook accessor keeps existing isolated component tests provider-free"

key-files:
  created:
    - frontend/src/lib/citationNav.tsx
    - frontend/src/lib/__tests__/citationNav.test.tsx
  modified:
    - frontend/src/index.css
    - frontend/src/App.tsx
    - frontend/src/pages/IngestionPage.tsx

key-decisions:
  - "Intent lives in the shared CitationNavProvider (read by IngestionPage via the hook), NOT prop-drilled through ChatLayout — keeps the change to the 5 declared files and honors the 'shared selected-doc intent' link"
  - "Two hooks: useCitationNav() throws outside a provider (leaf citation components require it); useCitationNavOptional() returns null so IngestionPage still renders in its existing provider-free test"
  - "Owner/RLS enforced by reusing selectedDoc = documents.find(...) over the user's own owner-scoped list — a non-visible doc simply never resolves (T-153-02-01), no new fetch"
  - "flash helpers coerce n to a positive integer before building the querySelector, scoped to a container — invalid/missing n is a no-op, never an injectable selector (T-153-02-02)"
  - "Active-marker ink inlined as the literal 239 84% 67% (sketch --primary-strong) since that token is not defined in index.css; additive-only, no existing token edited"

patterns-established:
  - "Shared data-citation-* attribute + flash/active class constants as the marker↔row DOM contract"
  - "CSS owns prefers-reduced-motion; JS helpers only toggle classes"

requirements-completed: []  # CITE-01 stays open until verify-work/secure-phase after Wave-2/3 render + live SC#10 UAT (false-green avoidance)

# Metrics
duration: 5min
completed: 2026-07-15
---

# Phase 153 Plan 02: Citation Interaction Foundation Summary

**Interface-first React citation-nav contract — a `CitationNavProvider`/`useCitationNav` cross-view "Open document" (owner/RLS-scoped), the scoped integer-guarded `flashCitationRow`/`flashCitationMarker` marker↔row helpers with shared `data-citation-*` constants, and the additive Deep-Midnight citation CSS (marker chip + `markerPop` + ref-row flash bloom + reduced-motion).**

## Performance

- **Duration:** ~5 min (execution); reading/context prior
- **Started:** 2026-07-15T11:24:29Z (RED commit)
- **Completed:** 2026-07-15T11:29:31Z (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- **Shared citation-nav contract** (`citationNav.tsx`): `CitationNavProvider` + `useCitationNav()` exposing `openDocument(documentId)` that records a one-shot pending-document intent and fires `navigate("documents")`; plus `useCitationNavOptional()` for isolated hosts.
- **marker↔row flash contract**: `flashCitationRow` / `flashCitationMarker` — container-scoped, integer-guarded DOM helpers, with the exported single-source constants `CITATION_ROW_ATTR` / `CITATION_MARKER_ATTR` / `CITATION_FLASH_CLASS` / `CITATION_ACTIVE_CLASS`.
- **Additive citation CSS**: `.citation-marker` states, `@keyframes markerPop` (staggerable attach), `.citation-ref-flash` bloom (inset bar + ring, never colour-alone), and a `prefers-reduced-motion` override — `--primary` reserved, no `--muted-foreground-dim` trap, zero existing tokens/keyframes touched.
- **Owner/RLS-scoped "Open document" wiring**: App mounts the provider wrapping the chat subtree + documents view; IngestionPage consumes the intent through the EXISTING owner-scoped `setSelectedDocId` — no new fetch/endpoint/unscoped lookup.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): failing test for nav + flash contract** — `09c401ed` (test)
2. **Task 1 (TDD GREEN): citationNav contract + flash helpers + additive CSS** — `44e59f9e` (feat)
3. **Task 2: wire openDocument to documents view, owner-scoped** — `3436d569` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `frontend/src/lib/citationNav.tsx` — CitationNavProvider + useCitationNav/useCitationNavOptional + flashCitationRow/flashCitationMarker + shared attribute/class constants (interface-first contract for Wave-2/3).
- `frontend/src/lib/__tests__/citationNav.test.tsx` — 13 unit tests: provider throw/return, records-intent + fires-navigate, optional accessor null-outside, flash add/scroll/scope/no-op-on-missing/injection-guard.
- `frontend/src/index.css` — appended additive citation CSS block (marker chip states, markerPop, ref-row flash bloom, reduced-motion).
- `frontend/src/App.tsx` — mount `CitationNavProvider(navigate=setActiveView)` around ChatLayout.
- `frontend/src/pages/IngestionPage.tsx` — consume the one-shot pending-doc intent via `useCitationNavOptional` → existing `setSelectedDocId` (owner/RLS-scoped panel fetch).

## Decisions Made
- **Shared-context intent (not prop-drill):** the pending-doc intent lives in the provider and is read by IngestionPage via the hook — this keeps the change within the 5 declared files (no ChatLayout edit) and matches the plan's "shared selected-doc intent" link.
- **Two hooks:** `useCitationNav()` throws outside a provider (leaf citation components require it — tested); `useCitationNavOptional()` returns null so the pre-existing `IngestionPage.test.tsx` (provider-free) stays green without editing it.
- **Owner/RLS by reuse:** opening a doc routes through `selectedDoc = documents.find(d => d.id === selectedDocId)` over the user's own owner-scoped list — a non-visible doc never resolves; no new unscoped `document_id` fetch (T-153-02-01).
- **Selector safety:** flash helpers coerce `n` to a positive integer before interpolating into the scoped querySelector — invalid/missing `n` is a no-op (T-153-02-02).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Existing IngestionPage test renders provider-free.** `src/__tests__/components/IngestionPage.test.tsx` wraps only `<TooltipProvider>`. A hard-throwing `useCitationNav()` in IngestionPage would have broken it (and that test file is out of scope). Resolved by adding the non-throwing `useCitationNavOptional()` accessor (also a cleaner isolation contract) — IngestionPage stays green with no test edit. The strict throwing `useCitationNav()` remains for leaf citation components (Task 1 tested behavior).
- **`--primary-strong` / `--font-mono` tokens not defined in index.css.** Used the literal `239 84% 67%` for the active-marker ink and the `"JetBrains Mono", ui-monospace, monospace` stack directly (matching the existing `.markdown code` convention) — additive, no existing token edited.

## Threat Surface
No new security surface beyond the plan's `<threat_model>`: T-153-02-01 (Open-document owner/RLS gate) mitigated by reusing the existing owner-scoped selection; T-153-02-02 (flash querySelector) mitigated by integer coercion + container scoping; T-153-02-03 (index.css additive) mitigated by an append-only block (0 existing tokens/keyframes touched). No new endpoint, auth path, or schema change.

## Known Stubs
None. `pendingDocumentId` defaults to `null` (correct initial state, not a stub); no placeholder text, no unwired data source. The marker↔row consumers (footer rows, in-text markers) are authored in Wave-2/3 plans against this fixed contract — that is the plan's interface-first sequencing, not a stub.

## User Setup Required
None - no external service configuration required. Frontend-only; no backend/migration/package change.

## Self-Check: PASSED
- Files exist: FOUND all 5 (`citationNav.tsx`, `citationNav.test.tsx`, `index.css`, `App.tsx`, `pages/IngestionPage.tsx`).
- Commits exist: FOUND `09c401ed`, `44e59f9e`, `3436d569`.
- `citationNav.test.tsx` 13/13 green; `IngestionPage.test.tsx` 4/4 green; `tsc -b` 30 baseline errors / 0 net-new; `vite build` exit 0.

## Next Phase Readiness
- **153-03 (Wave 2)** — References footer restructure — can now import `CITATION_ROW_ATTR` + `flashCitationRow`/`flashCitationMarker` and mount inside the provider; `openDocument` is ready for the row "Open document" link.
- **153-05 (Wave 3)** — CitedMarkdown — will stamp `data-citation-marker="{n}"` on its owned `<sup>` and call `flashCitationRow` on activation, and `useCitationNav().openDocument` from the peek footer.
- Blocker/concern: the live SC#10 4-axis cross-provider marker UAT (held in `153-VALIDATION.md`) remains the phase gate; CITE-01 stays open until then (false-green avoidance).

---
*Phase: 153-inline-citations*
*Completed: 2026-07-15*
