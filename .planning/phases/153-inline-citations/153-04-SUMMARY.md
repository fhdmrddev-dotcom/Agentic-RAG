---
phase: 153-inline-citations
plan: 04
subsystem: ui
tags: [react, citations, popover, portal, accessibility, cross-view-nav, tdd]

# Dependency graph
requires:
  - phase: 153-02
    provides: "the citationNav contract this peek consumes — useCitationNav().openDocument (owner/RLS-scoped cross-view nav); the Citation type; the additive Deep-Midnight citation CSS + reduced-motion (CSS-owned)"
provides:
  - "CitationPeek — the net-new positioned hover-peek → click-to-pin popover: a chunk variant (head [n] filename + italic passage snippet + loc + ↗ Open document) and a full-doc variant (D-10: 'Full document — no single passage' + Open document only, no snippet/score), portaled to document.body for z-index safety"
  - "Calm-degrade (D-04): a null/short/blank passage on a chunk citation drops the snippet and keeps head + Open document — never an error banner or red text"
  - "Non-blocking a11y contract: pinned peek = role='dialog' aria-modal='false' labelled by its head (no focus trap); Esc → onClose; the icon-only pin toggle carries a state-toggled accessible name (Pin/Unpin citation {n})"
affects: [153-05, MessageItem, CitedMarkdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consume the interface-first 153-02 contract by reuse — Open-document routes through the exported owner-scoped useCitationNav().openDocument; no re-invented fetch"
    - "Mirror ui/tooltip.tsx surface tokens (bg-popover/border/shadow) for a net-new floating card; sizing/positioning from UI-SPEC (width 320, z-60, top=bottom+scrollY+8, left=min(anchor.left, vw−340))"
    - "createPortal to document.body for z-index safety (first createPortal use in frontend/src) — a node the component owns; no dangerouslySetInnerHTML, model text renders as auto-escaped React text nodes"
    - "Reuse the CitationCard is_full_doc branch shape verbatim (D-09/D-10) — full-doc carries no chunk/score by construction"

key-files:
  created:
    - frontend/src/components/chat/CitationPeek.tsx
    - frontend/src/components/chat/__tests__/CitationPeek.test.tsx
  modified: []

key-decisions:
  - "Used the throwing useCitationNav() (not useCitationNavOptional) — CitationPeek is a leaf citation component that always renders inside the App-level CitationNavProvider (the 153-02 decision: leaf citation components require the provider by construction); tests wrap in CitationNavProvider"
  - "Pin glyph = the vendored lucide `Pin` icon (aria-hidden) rather than the sketch's 📌 emoji shorthand — consistent with the rest of the citation surface (ArrowUpRight etc. are lucide), calm-instrument, no emoji chrome-noise; the LOAD-BEARING part (the state-toggled aria-label Pin/Unpin citation {n}) matches the UI-SPEC Dimension-2 contract exactly, and the pinned state is also carried by fill + text-primary (never colour-alone)"
  - "Passage 'present' = non-empty, non-whitespace (`passage.trim().length > 0`) — a null OR blank/short passage degrades identically to the calm path (D-04), mirroring CitationCard's truthiness gate but tightened for whitespace"
  - "Motion handled inside the component via tailwindcss-animate (`animate-in fade-in-0 slide-in-from-top-1 duration-100`) + `motion-reduce:animate-none`, since index.css defines no `.citation-peek` class and index.css is out of this plan's 2-file scope — reduced-motion is honored without a CSS edit"
  - "Footer divider uses `border-border` (full token) and all meaningful muted text uses `--muted-foreground` — the `--muted-foreground-dim` ~3.6:1 trap appears only in an explanatory code comment, never as a className"

patterns-established:
  - "A net-new positioned/portaled hover-peek→click-to-pin popover with non-blocking dialog semantics (aria-modal=false, no focus trap) + Esc-to-close — the peek/pin state machine the 153-05 marker will drive"

requirements-completed: []  # CITE-01 stays open until verify-work/secure-phase after the Wave-3 render (153-05) + live SC#10 4-axis cross-provider UAT (false-green avoidance)

# Metrics
duration: 4min
completed: 2026-07-15
---

# Phase 153 Plan 04: CitationPeek Click-through Popover Summary

**The net-new hover-peek → click-to-pin popover the 075-A sketch locked: `CitationPeek` renders a positioned, portaled card that surfaces the retrieved passage for a chunk citation (head `[n] {filename}` + italic snippet + `{loc}` + `↗ Open document`) and a "Full document — no single passage" affordance for a full-doc citation (D-10, no snippet/score), degrades calmly on a null/short passage (D-04, never an error banner), routes Open-document through the owner-scoped `useCitationNav().openDocument`, and is fully keyboard/AT-operable — pinned = `role="dialog" aria-modal="false"` labelled by its head (non-blocking, no focus trap), Esc closes, and the icon-only pin toggle carries a state-toggled accessible name (`Pin`/`Unpin citation {n}`).**

## Performance

- **Duration:** ~4 min execution (context/reading prior)
- **Started:** 2026-07-15T07:54:40Z
- **Completed:** 2026-07-15T07:58:19Z
- **Tasks:** 1 (TDD RED → GREEN; no refactor needed)
- **Files modified:** 2 (both created)

## Accomplishments
- **`CitationPeek` — the click-through peek (SC#2).** A `{ citation, n, anchorRect, pinned, onPin, onClose }` component rendering an absolutely-positioned card portaled to `document.body`, mirroring the `ui/tooltip.tsx` surface tokens (`bg-popover`/`border`/`shadow-lg`) and the UI-SPEC sizing (`width 320`, `z-index 60`, `rounded-[10px]`, `padding 12px 14px`).
- **Chunk variant.** Head `[n] {filename}` (+ `(v{version_number})` when > 1), the `passage` as an italic `--muted-foreground` snippet, and a footer `{loc}` (`Chunk {chunk_index+1} · {similarity 2dp}`) left + `↗ Open document` right.
- **Full-doc variant (D-10).** Reuses the CitationCard `is_full_doc` branch shape: head + a `Full document — no single passage` line (NO snippet), footer `↗ Open document` only (no loc/score) — even when a stray `similarity` is present it is never rendered.
- **Calm degrade (D-04).** A null / empty / whitespace passage on a chunk citation drops the snippet and keeps head + Open document — no `role="alert"`, no error/unavailable copy, no `text-red`/`destructive` styling.
- **Owner-scoped Open document.** The footer link calls the exported owner/RLS-scoped `useCitationNav().openDocument(citation.document_id)` — no new fetch, no unscoped `document_id` lookup (T-153-04-02).
- **Non-blocking a11y (feeds Phase 155).** Pinned → `role="dialog" aria-modal="false"` labelled by its head (accessible name resolves to the filename); Esc invokes `onClose`; the icon-only pin toggle carries the state-toggled `aria-label` `Pin citation {n}` ↔ `Unpin citation {n}` (+ `aria-pressed`). No focus trap, no `alert()`/`confirm()`, no modal dead-end.
- **Positioning.** `top = anchorRect.bottom + scrollY + 8`; `left = max(8, min(anchorRect.left, viewportWidth − 340))` (right-edge clamp keeps the card on-screen; the `max(8,…)` guards the mobile left edge).

## Task Commits

Single TDD task, committed atomically:

1. **Task 1 (TDD RED): failing test for CitationPeek popover** — `f5d4f0ef` (test — import failure, 0 tests)
2. **Task 1 (TDD GREEN): CitationPeek hover-peek/pin popover** — `3ccab39c` (feat — 13/13 green)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `frontend/src/components/chat/CitationPeek.tsx` — the net-new positioned/portaled hover-peek → click-to-pin popover (chunk + full-doc variants, calm degrade, owner-scoped Open document, non-blocking pin/dialog/Esc a11y).
- `frontend/src/components/chat/__tests__/CitationPeek.test.tsx` — 13 vitest cases: chunk variant (head/snippet/loc/Open) + version suffix; full-doc D-10 (no snippet/score); D-04 degrade (null + whitespace passage, no error/red); owner-scoped Open document; pin toggle name flip (Pin↔Unpin) + onPin; role=dialog aria-modal=false + accessible name; no-dialog when unpinned (non-blocking); Esc → onClose; left-clamp + below-anchor positioning.

## Decisions Made
- **Throwing `useCitationNav()` (not the optional accessor).** `CitationPeek` is a leaf citation component that always renders inside the App-level `CitationNavProvider` (153-02's decision that leaf citation components require the provider). The key-link contract names `useCitationNav().openDocument`; tests wrap in `CitationNavProvider`.
- **lucide `Pin` icon over the sketch's 📌 emoji.** Visual consistency with the vendored icon set already on the citation surface (`ArrowUpRight` for Open document), calm-instrument, no emoji chrome-noise. The load-bearing accessibility contract is the state-toggled `aria-label` (matches UI-SPEC Dimension-2 verbatim), and the pinned state is also carried by `fill-current` + `text-primary` (never colour-alone, WCAG 1.4.1).
- **Passage-present = `trim().length > 0`.** A null OR blank/whitespace passage degrades identically to the calm path (D-04) — mirrors CitationCard's truthiness gate, tightened so a "short"/blank passage never renders a bare snippet paragraph.
- **Motion inside the component (no CSS edit).** `index.css` defines no `.citation-peek` class and is out of this plan's 2-file scope, so the enter motion uses tailwindcss-animate (`animate-in fade-in-0 slide-in-from-top-1 duration-100`, ≈ the UI-SPEC 120ms/translateY(4px)) with `motion-reduce:animate-none` honoring `prefers-reduced-motion` without touching CSS.

## Deviations from Plan

None - plan executed exactly as written. (The two documented judgment calls — lucide `Pin` vs the 📌 glyph, and in-component tailwindcss-animate motion because `index.css` is out of scope — are design-fidelity/scope choices within the plan's `<action>`, not functional deviations; no auto-fix Rules 1–3 fired.)

## Issues Encountered
- **No `.citation-peek` CSS home in scope.** The 153-02 additive CSS block styles the marker/row, not the peek; `index.css` is outside this plan's declared 2-file set. Resolved by owning the peek's surface + motion via Tailwind/tailwindcss-animate classes inside the component (reduced-motion via the `motion-reduce:` variant) — no out-of-scope file touched. The `citation-peek` class is retained as a stable test/query hook (and a future CSS seam if 153-05 needs one).

## Threat Surface
No new security surface beyond the plan's `<threat_model>`. T-153-04-01 (XSS): `filename`/`passage` render as auto-escaped React text nodes — NO `dangerouslySetInnerHTML` (grep-confirmed 0); the portaled card is a node the component owns, model text is never re-parsed as HTML. T-153-04-02 (info disclosure): Open-document routes through the existing owner/RLS-scoped `useCitationNav().openDocument` (T-153-02-01) — no raw unscoped fetch. T-153-04-03 (a11y trap): `aria-modal="false"` (non-trapping), Esc closes, the pin toggle carries a state-toggled name. T-153-04-SC: no package installs (createPortal from react-dom, icons vendored) — Legitimacy Gate not triggered.

## Known Stubs
None. `CitationPeek` is a fully-wired presentational + interaction component: it renders real citation fields, calls the real owner-scoped `openDocument`, and exposes `pinned/onPin/onClose` for the 153-05 marker producer to drive. The marker that mounts it (`data-citation-marker` `<sup>` → peek portal) is the Wave-3 153-05 plan — interface-first sequencing, not a stub.

## User Setup Required
None - frontend-only; no backend, migration, or package change. No uvicorn restart needed for this plan.

## Self-Check: PASSED
- Files exist: FOUND `frontend/src/components/chat/CitationPeek.tsx`, `frontend/src/components/chat/__tests__/CitationPeek.test.tsx`.
- Commits exist: FOUND `f5d4f0ef` (RED test), `3ccab39c` (GREEN feat).
- Gates: `CitationPeek.test.tsx` **13/13 GREEN**; `npx tsc -b` = exactly **30** pre-existing SEED-056/049 baseline errors, **0 referencing CitationPeek** (0 net-new); `npx vite build` exit **0**; `grep muted-foreground-dim` = 1 (an explanatory comment, not a className); `dangerouslySetInnerHTML`/`alert(`/`confirm(` = **0**.
- Diff scope: exactly the 2 declared files (the untracked `frontend/test-results/` is pre-existing Playwright E2E rot, NOT mine — left untouched).

## Next Phase Readiness
- **153-05 (Wave 3)** — CitedMarkdown + MessageItem — will stamp `data-citation-marker="{n}"` on its owned `<sup>`, compute the `anchorRect` from the marker on hover/focus, and mount `CitationPeek` with `pinned`/`onPin`/`onClose` state (pin on click/Enter, unpin/Esc/outside-click), restoring focus to the marker on close.
- Blocker/concern: the live SC#10 4-axis cross-provider marker UAT (`153-VALIDATION.md`) remains the phase gate; CITE-01 stays open until then (false-green avoidance).

---
*Phase: 153-inline-citations*
*Completed: 2026-07-15*
