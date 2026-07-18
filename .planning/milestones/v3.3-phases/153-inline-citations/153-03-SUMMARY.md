---
phase: 153-inline-citations
plan: 03
subsystem: ui
tags: [react, citations, footer, accessibility, cross-view-nav, tdd]

# Dependency graph
requires:
  - phase: 153-02
    provides: "the citationNav contract this footer consumes — useCitationNav.openDocument (owner-scoped), flashCitationMarker, and the shared DOM constants CITATION_ROW_ATTR / CITATION_MARKER_ATTR / CITATION_FLASH_CLASS / CITATION_ACTIVE_CLASS; the additive index.css citation classes (.citation-ref-row scroll anchor + flash bloom)"
provides:
  - "CitationList — the numbered `References · {N} source(s)` footer with the canonical `defaultOpen: boolean` open-state prop (open-by-default when markers exist, D-06/D-07), threading n = i+1 to each row (D-03) + an optional flashContainer"
  - "CitationCard — a numbered `[n]` row + `↗ Open document` (owner-scoped nav) + reused is_full_doc branch (D-09/D-10) + data-citation-row flash target + keyboard-operable role=button; back-compat when n is omitted"
affects: [153-04, 153-05, MessageItem, CitedMarkdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consume the interface-first 153-02 contract by reuse — Open-document + flash reuse the exported citationNav helpers/constants; no re-invented attribute strings"
    - "Optional-prop + non-throwing hook (n?: number, useCitationNavOptional) keep the pre-existing out-of-scope CitationCard.test.tsx green with zero edits to it"
    - "Reuse the existing is_full_doc conditional verbatim (D-10) — full-doc rows carry no chunk/score by construction, not a new branch"

key-files:
  created:
    - frontend/src/components/chat/__tests__/CitationList.test.tsx
  modified:
    - frontend/src/components/chat/CitationList.tsx
    - frontend/src/components/chat/CitationCard.tsx

key-decisions:
  - "Canonical `defaultOpen: boolean` is the ONE footer open-state prop (no `hasMarkers` alias) — the locked wave-2↔wave-3 contract; 153-05 (MessageItem) passes the SAME name, computing it from whether the settled message has ≥1 valid in-range marker"
  - "`n` is optional on CitationCard and Open-document uses `useCitationNavOptional()` — so the pre-existing provider-free, un-numbered `src/__tests__/components/CitationCard.test.tsx` stays green without an out-of-scope edit; CitationList always passes n so the real footer is fully numbered"
  - "Reused the existing is_full_doc ternary verbatim (D-09/D-10) — added similarity ONLY on the chunk branch so a full-doc row shows `· Full document` with no chunk index and no score"
  - "Location text upgraded from `text-muted-foreground/50` to `text-muted-foreground` (WCAG AA, meaningful muted text) — no `--muted-foreground-dim` introduced (the ~3.6:1 trap)"

patterns-established:
  - "The footer row is a keyboard-operable role=button (Enter/Space) with aria-label + data-citation-row={n} + transient aria-current; inner Open-document / Show-more buttons stopPropagation so they don't also fire the row flash"

requirements-completed: []  # CITE-01 stays open until verify-work/secure-phase after Wave-3 render + live SC#10 4-axis UAT (false-green avoidance)

# Metrics
duration: 5min
completed: 2026-07-15
---

# Phase 153 Plan 03: References Footer Restructure Summary

**The sources footer is now the numbered, click-through References footer the sketch locked (075-A): `CitationList` gains a `References · {N} source(s)` header, opens by default when valid inline markers exist via the canonical `defaultOpen` prop (D-06/D-07), and threads a 1-based `[n]` into each row (D-03); `CitationCard` gains the mono `[n]` chip, an owner-scoped `↗ Open document`, a keyboard-operable `data-citation-row` flash target wired to `flashCitationMarker`, and reuses the existing `is_full_doc` branch for full-doc rows (D-09/D-10) — a pure render layer over the 153-02 citation-nav contract.**

## Performance

- **Duration:** ~5 min execution (context/reading prior)
- **Started:** 2026-07-15T11:42:31Z (Task 1 commit)
- **Completed:** 2026-07-15T11:45:46Z (Task 2 GREEN commit)
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- **`CitationCard` — numbered, click-through, flash-linked row.** Optional 1-based `n` → leading mono `[n]` chip in `--primary` (D-03, keyed 1:1 to the marker). Reused the existing `is_full_doc` conditional verbatim: a full-doc row shows `· Full document` with **no** chunk index and **no** similarity; a chunk row shows `· Chunk N · {similarity 2dp}` (D-09/D-10). Added `↗ Open document` calling the owner/RLS-scoped `useCitationNavOptional().openDocument(document_id)` (T-153-03-02 — no new unscoped fetch). The row is a keyboard-operable `role="button"` (Enter/Space) with `aria-label` (filename + location), `data-citation-row={n}` (imported `CITATION_ROW_ATTR` — not a hardcoded string), a transient `aria-current`, and `flashCitationMarker(n, flashContainer)` on activate (the row→marker direction of the bidirectional flash).
- **`CitationList` — the References footer.** Canonical **`defaultOpen: boolean`** prop initializes `useState(defaultOpen)`: open-by-default when markers exist (D-07), collapsed otherwise (today's default). Header copy `References · {N} source(s)` reuses today's pluralization. Kept the `citations.length === 0 → null` guard (D-06: renders only when a set exists, but **always** when it does — marker-independent). Threads `n = i + 1` preserving `citations` order (D-03) plus an optional `flashContainer` to each row for the 153-05 producer. Kept the existing `Collapsible`/`CollapsibleTrigger` + `aria-expanded` (no hand-rolled disclosure).
- **Contract fidelity by reuse.** Open-document + flash reuse the exported 153-02 `citationNav` helpers and DOM constants; nothing re-invented, no attribute strings hardcoded.

## Task Commits

Each task was committed atomically:

1. **Task 1 (feat): CitationCard numbered `[n]` row + Open document + flash target** — `9f7d4977`
2. **Task 2 (TDD RED): failing footer contract** (numbering / open-by-default / full-doc / flash) — `c5ebf7a9`
3. **Task 2 (TDD GREEN): CitationList References header + open-by-default + numbering** — `4ba0ffa6`

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `frontend/src/components/chat/CitationCard.tsx` — added `n?`, `flashContainer?`; the `[n]` chip, `↗ Open document`, keyboard-operable row + `data-citation-row`, reused full-doc branch (+ AA location text). Legacy un-numbered render preserved for isolated hosts.
- `frontend/src/components/chat/CitationList.tsx` — canonical `defaultOpen` open-state, `References · {N} source(s)` header, `n = i + 1` threading, optional `flashContainer`.
- `frontend/src/components/chat/__tests__/CitationList.test.tsx` — 11 vitest cases (empty-set null, header + pluralization, open-by-default vs collapsed, 1-based numbering + order, full-doc no chunk/score, row→marker flash, owner-scoped Open document, legacy provider-free render).

## Decisions Made
- **Canonical `defaultOpen` (no alias).** One footer open-state prop; 153-05 passes the SAME name. Initialized as `useState(defaultOpen)` — the footer only mounts when `citations` exist (on settle), so the initial-default is the correct open behavior; the user can then toggle.
- **`n` optional + `useCitationNavOptional`.** Keeps the pre-existing, out-of-scope `src/__tests__/components/CitationCard.test.tsx` (renders CitationCard with no `n` and no provider) green with **zero** edits to a file outside my declared set. The real footer path always passes `n`, so numbering/flash are fully wired in production.
- **Reused the existing `is_full_doc` branch verbatim (D-10).** Similarity is rendered only on the chunk branch; full-doc rows carry no chunk/score by construction. The location line and number are split into their own text spans so the existing `getByText("Chunk 3")` / `getByText("Full document")` assertions keep matching.
- **AA muted text.** Location upgraded `/50 → --muted-foreground`; `--muted-foreground-dim` (~3.6:1) never introduced.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Pre-existing out-of-scope test renders CitationCard provider-free and un-numbered.** `src/__tests__/components/CitationCard.test.tsx` (not in my declared set) renders `<CitationCard citation={...} />` with no `n` and no `CitationNavProvider`, and asserts `getByText("Chunk 3")` / `getByText("Full document")`. A required `n` would have been a net-new `tsc` error there, and a throwing `useCitationNav()` would have thrown at render. Resolved without editing that file: `n?: number` (legacy render when omitted), `useCitationNavOptional()` (non-throwing), and location split into own spans so `getByText` still matches. Confirmed 7/7 green throughout.

## Threat Surface
No new security surface beyond the plan's `<threat_model>`. T-153-03-01 (XSS): filename/passage render as React text nodes (auto-escaped); no `dangerouslySetInnerHTML`; `[n]`/Open are inert markup. T-153-03-02 (info disclosure): Open-document routes through the existing owner-scoped `openDocument` (T-153-02-01) — no raw unscoped fetch. T-153-03-03 (spoofing): `n = i + 1` over the backend-finalized `citations` array; no client-side re-derivation of set membership (D-03). No package installs (Legitimacy Gate not triggered).

## Known Stubs
None. `defaultOpen` defaults to `false` (correct collapsed default, not a stub); `flashContainer` defaults to document scope inside the integer-guarded `flashCitationMarker` (a no-op on a missing target). The producer that supplies `defaultOpen`/`flashContainer` and the in-text `[data-citation-marker]` targets is the Wave-3 153-05 plan — interface-first sequencing, not a stub.

## User Setup Required
None - frontend-only; no backend, migration, or package change. No uvicorn restart needed for this plan.

## Self-Check: PASSED
- Files exist: FOUND all 3 (`CitationCard.tsx`, `CitationList.tsx`, `__tests__/CitationList.test.tsx`).
- Commits exist: FOUND `9f7d4977`, `c5ebf7a9`, `4ba0ffa6`.
- Gates: `CitationList.test.tsx` 11/11 green; pre-existing `CitationCard.test.tsx` 7/7 green (no edit); non-regression `MessageItem.test.tsx` + `citationNav.test.tsx` 16/16 green; `tsc -b` 30 baseline / 0 net-new; `vite build` exit 0.
- Diff scope: `git diff --name-only` (my changes) = exactly the 3 declared files.

## Next Phase Readiness
- **153-04 (Wave 2)** — CitationPeek hover-peek → click-to-pin — is disjoint from this footer; it reuses the same `is_full_doc` branch shape and the `openDocument`/flash contract.
- **153-05 (Wave 3)** — CitedMarkdown + MessageItem — will pass the canonical `defaultOpen` (true when the settled message has ≥1 valid marker) + a `flashContainer` (the message's marker host) into `CitationList`, and stamp `data-citation-marker="{n}"` on its owned `<sup>` (the flash target this footer's `flashCitationMarker` calls resolve against).
- Blocker/concern: the live SC#10 4-axis cross-provider marker UAT (`153-VALIDATION.md`) remains the phase gate; CITE-01 stays open until then (false-green avoidance).

---
*Phase: 153-inline-citations*
*Completed: 2026-07-15*
