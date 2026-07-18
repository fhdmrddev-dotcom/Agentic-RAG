---
phase: 153-inline-citations
plan: 05
subsystem: ui
tags: [react, citations, markdown, marker-injection, accessibility, tooltip, g5-hot-file, tdd]

# Dependency graph
requires:
  - phase: 153-01
    provides: "the backend honesty core — persisted answer `content` already carries ONLY validated, renumbered `[n]` markers (strip/renumber at settle, D-02/D-03); the frontend renders what this validated content carries (range-check is belt-and-suspenders)"
  - phase: 153-02
    provides: "the citationNav contract this render layer consumes — CITATION_MARKER_ATTR, flashCitationRow, CITATION_ACTIVE_CLASS + the additive `.citation-marker`/markerPop/ref-flash CSS"
  - phase: 153-03
    provides: "CitationList's canonical `defaultOpen: boolean` + `flashContainer` props (this plan is the producer)"
  - phase: 153-04
    provides: "CitationPeek ({ citation, n, anchorRect, pinned, onPin, onClose }) — the hover-peek→pin popover this marker drives"
provides:
  - "CitedMarkdown — reuses the MarkdownRenderer marked+DOMPurify pipeline verbatim, then upgrades in-range [n] to OWNED document.createElement <sup> markers (role/tabindex/aria-label set programmatically, code/pre/a skipped) + hover/focus peek + click/Enter pin+row-flash + Esc/outside-click dismiss"
  - "MessageItem additive cited branch (G-5): CitedMarkdown only when message.citations?.length; StreamingNarration + MarkdownRenderer paths byte-identical; producer of CitationList defaultOpen + flashContainer"
  - "AbsenceHint — the quiet, non-blocking absence-as-signal ⓘ (074-A) mounted once under cited answers; verbatim UI-SPEC copy; never a banner; self-guards to cited messages"
affects: [153-VALIDATION-cross-provider-UAT, verify-work, secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-mount marker upgrade via TreeWalker over sanitized HTML — OWNED createElement <sup> nodes (Pitfall 3), never re-parsed model text; code/pre/a ancestors skipped (Pitfall 2); range-checked to citations.length (D-07)"
    - "Layout effect SOLELY owns the marker host's innerHTML (no dangerouslySetInnerHTML in JSX) so injected markers survive a parent re-render — React manages zero children of that div"
    - "G-5 additive branch: a NEW component on the cited path only; the shared MarkdownRenderer/StreamingNarration/dedupParagraphs path is byte-identical (D-12/D-14)"
    - "Reuse the vendored Radix tooltip primitive for a quiet ⓘ teaching popover (non-blocking, keyboard-reachable, never a banner) — no new package"

key-files:
  created:
    - frontend/src/components/chat/CitedMarkdown.tsx
    - frontend/src/components/chat/AbsenceHint.tsx
    - frontend/src/components/chat/__tests__/CitedMarkdown.test.tsx
    - frontend/src/components/chat/__tests__/AbsenceHint.test.tsx
  modified:
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/__tests__/MessageItem.test.tsx

key-decisions:
  - "CitedMarkdown drops `dangerouslySetInnerHTML` from JSX and lets the layout effect solely set the div's innerHTML + inject markers — a parent re-render (MessageItem's callback-ref state) was re-applying dangerouslySetInnerHTML and WIPING the imperatively-injected markers. React manages zero children of that node, so the markers survive re-renders (Rule 1 auto-fix)."
  - "Marker→row flash is scoped at event time via `marker.closest('[data-testid=\"assistant-message\"]')` (fallback document) — no extra prop on CitedMarkdown; row→marker flash is scoped by the callback-ref message-body container passed to CitationList (flashContainer)."
  - "defaultOpen computed from a lightweight in-range `[n]` scan of the settled (deduped) content — the backend already stripped non-members (D-02), so any in-range marker is real; footer opens only when markers exist (D-06/D-07)."
  - "AbsenceHint self-guards on citations AND MessageItem gates its mount off the streaming-narration path — the ⓘ shows only under a settled cited answer, never on streaming/user/non-cited (G-5 additive)."

patterns-established:
  - "Owned-node marker injection: sanitize once (DOMPurify), then upgrade [n] to createElement <sup> with programmatic attributes/listeners — the XSS-safe, attribute-strip-proof marker pattern (V5/Pitfall 3)"
  - "A cited-path-only render component keeps a G-5 hot file additive: swap the renderer solely when message.citations?.length, leave every other branch byte-identical"

requirements-completed: []  # CITE-01 stays OPEN until verify-work/secure-phase after the live SC#10 4-axis cross-provider UAT (false-green avoidance, 148–152 + 153-01..04 convention)

# Metrics
duration: 24min
completed: 2026-07-15
---

# Phase 153 Plan 05: Inline Citations Assembly (CitedMarkdown + MessageItem + AbsenceHint) Summary

**The inline-marker experience assembled on the G-5 hot file: `CitedMarkdown` reuses the shared marked+DOMPurify pipeline verbatim and upgrades only valid in-range `[n]` (skipping code/pre/a) into OWNED `document.createElement` `<sup>` markers that hover/focus-peek and click/Enter-pin+flash the matching footer row; `MessageItem` gains the ONE additive branch (CitedMarkdown only when `message.citations?.length`, every other path byte-identical) plus the mount of the quiet, non-blocking absence-as-signal `ⓘ` (`AbsenceHint`, 074-A) under cited answers — and `StreamsProvider.tsx` is verified UNCHANGED.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-07-15T08:04:44Z
- **Completed:** 2026-07-15T08:28:54Z
- **Tasks:** 3 (Task 1 + Task 3 TDD RED→GREEN; Task 2 auto)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- **`CitedMarkdown`** — reuses the `MarkdownRenderer` `marked`+`DOMPurify` pipeline byte-identically; a post-mount `useLayoutEffect` walks the sanitized HTML's text nodes (`TreeWalker`), SKIPS `code`/`pre`/`a` ancestors (Pitfall 2), and upgrades each `[n]` where `n ∈ [1, citations.length]` (D-07) into a TRUSTED `<sup>` created via `document.createElement` (class/`data-citation-marker`/`role="button"`/`tabindex="0"`/`aria-label="Citation {n}: {filename}"` + delegated listeners set programmatically — Pitfall 3/V5). Out-of-range/`[0]` tokens stay literal. Hover/focus opens the `CitationPeek`; click/Enter pins it, marks the marker active, and `flashCitationRow(n, scope)` blooms the matching footer row; Esc/outside-click unpins and restores focus to the marker. `markerPop` attach + staggered `animationDelay` from the 153-02 CSS.
- **`MessageItem` (G-5 additive)** — the ONE new branch: `CitedMarkdown` only when `message.role === "assistant" && message.citations?.length`; the `StreamingNarration` and `MarkdownRenderer` paths are byte-identical (D-12/D-14). Produces `CitationList`'s canonical `defaultOpen` (true only when the settled content carries a valid in-range marker) + a `flashContainer` (a callback-ref message-body node) scoping the row→marker flash. Mounts `AbsenceHint` once under the answer, between the body and the footer, on the settled cited-assistant branch only.
- **`AbsenceHint` (074-A)** — a quiet inline row + a keyboard-reachable `ⓘ` (lucide `Info`, rest dim → `--primary` on hover/focus) revealing the VERBATIM UI-SPEC teaching copy via the vendored Radix tooltip (non-blocking, never a banner). Inline label `Unmarked claims read as general knowledge`; popover body with the bold lead sentence. Returns `null` when the message has no citations (parity with the marker/footer condition).
- **`StreamsProvider.tsx` verified UNCHANGED** — the attach-on-settle reconcile that swaps live→persisted normalized content already delivers the validated markers; no new SSE event, no reducer edit (confirmed absent from the plan diff).

## Task Commits

Each task committed atomically (TDD tasks split test → feat):

1. **Task 1 (RED): failing test for CitedMarkdown marker upgrade** — `75bc236e` (test)
2. **Task 1 (GREEN): CitedMarkdown reused pipeline + owned marker upgrade + peek/flash** — `9782b5b9` (feat)
3. **Task 2: MessageItem cited branch (G-5 additive) + non-regression tests** — `b889192e` (feat)
4. **Task 3 (RED): failing test for AbsenceHint absence-as-signal ⓘ** — `47bccfbc` (test)
5. **Task 3 (GREEN): AbsenceHint quiet ⓘ + MessageItem mount** — `57d1a937` (feat)

_TDD tasks produced separate test → feat commits (RED authored and committed before GREEN)._

## Files Created/Modified

- `frontend/src/components/chat/CitedMarkdown.tsx` — the cited render path (reused pipeline + owned marker upgrade + peek/flash/pin state machine).
- `frontend/src/components/chat/AbsenceHint.tsx` — the quiet, non-blocking absence-as-signal ⓘ (verbatim copy, never a banner, self-guards).
- `frontend/src/components/chat/MessageItem.tsx` — the ONE additive cited branch + defaultOpen/flashContainer producer + AbsenceHint mount (G-5 additive; non-cited + user byte-identical).
- `frontend/src/components/chat/__tests__/CitedMarkdown.test.tsx` — 6 cases: base-equals-MarkdownRenderer, in-range upgrade + owned attrs, range-check ([9]/[0] literal), code-span/link skip, activation → peek + row flash.
- `frontend/src/components/chat/__tests__/AbsenceHint.test.tsx` — 6 cases: verbatim label + popover body (bold lead) on activation, never-a-banner + non-blocking, null-on-no-citations.
- `frontend/src/components/chat/__tests__/MessageItem.test.tsx` — extended: non-cited assistant + user byte-identical (no markers/ⓘ), cited routes to CitedMarkdown, ⓘ mounts on cited (absent on non-cited), no-marker cited degrades to footer-only.

## Decisions Made

- **Layout effect solely owns the marker host's innerHTML.** Keeping `dangerouslySetInnerHTML` in the JSX caused a parent re-render (MessageItem's `setMessageBody` callback ref) to re-apply it and WIPE the imperatively-injected `<sup>` markers. Dropping it (the effect sets `container.innerHTML = html` then injects) means React manages zero children of that div, so the markers survive re-renders. This is the load-bearing fix that made the MessageItem-integrated marker render deterministic.
- **Flash scoping without new props.** Marker→row (`flashCitationRow`) is scoped at event time via `marker.closest('[data-testid="assistant-message"]')` (document fallback in isolation) — no extra prop on CitedMarkdown. Row→marker (`flashCitationMarker`) is scoped by the callback-ref message-body node passed to CitationList as `flashContainer` — both directions are contained to one message (no cross-message flash collision).
- **defaultOpen from an in-range `[n]` scan.** The footer opens by default only when the settled (deduped) content carries a valid in-range marker; else it keeps today's collapsed default (footer-only degradation, D-06/D-07). Safe because the backend already stripped non-members (D-02).
- **AbsenceHint double-gated.** Self-guards on citations AND MessageItem gates its mount off the streaming-narration path, so the ⓘ appears only under a settled cited answer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CitedMarkdown markers wiped by a parent re-render**
- **Found during:** Task 2 (MessageItem integration)
- **Issue:** With `dangerouslySetInnerHTML` in the JSX, MessageItem's callback-ref state update (`setMessageBody`) triggered a re-render that re-applied React's innerHTML and erased the layout-effect-injected `<sup>` markers — the cited MessageItem rendered `[1]` literal instead of a marker (caught by the new MessageItem routing test).
- **Fix:** Removed `dangerouslySetInnerHTML` from CitedMarkdown's JSX; the `useLayoutEffect` now solely sets `container.innerHTML = html` and injects the markers, so React owns zero children of the marker host and the injected DOM survives re-renders. Base render stays byte-identical to MarkdownRenderer (verified by the base-equals test).
- **Files modified:** `frontend/src/components/chat/CitedMarkdown.tsx`
- **Commit:** `b889192e` (folded into the Task 2 commit, since it is the fix that makes the Task 2 integration correct)

No other deviations — the six declared files were the only files touched; `StreamsProvider.tsx` was verified unchanged; no backend, migration, or package change.

## Issues Encountered

- **Radix tooltip content in jsdom.** The AbsenceHint popover copy is asserted with the repo's proven pattern (`fireEvent.mouseEnter` + `fireEvent.focus` on the trigger → `await screen.findAllByText(...)`, tolerating Radix's mirror nodes) — matches `NavRow`/`DocumentList` tooltip tests.
- **Split-text popover body.** The bold lead sentence is a `<span>` inside the body `<p>`, so the lead is asserted via exact `findAllByText` (matches the span) and the tail via a regex `findAllByText` (matches the p's direct text node) — avoids the getByText "text broken across elements" gotcha.

## Known Stubs

None. Every rendered marker is a real, clickable set member (the backend is the sole author of numbering truth); the footer/peek/ⓘ are fully wired to the 153-02/03/04 contracts. Historical messages with no persisted markers degrade to footer-only (D-06) — graceful, not a stub.

## Threat Flags

None. The implementation stays within the plan's `<threat_model>`: markers are OWNED `createElement` nodes over DOMPurify-sanitized HTML (T-153-05-01, V5), range-checked to the set (T-153-05-02), code/link-skipped (T-153-05-03); the shared render/streaming path is byte-identical and `StreamsProvider.tsx` is unedited (T-153-05-04); Open-document routes through the owner-scoped `useCitationNav().openDocument` (T-153-05-05); the ⓘ copy is static with no model/user input and the popover is non-blocking (T-153-05-06). No new network endpoint, auth path, file access, or schema change.

## User Setup Required

None — frontend-only; no backend, migration, or package change. No uvicorn restart needed for this plan.

**Operator note (verification, not setup):** the live SC#10 4-axis cross-provider marker UAT (`153-VALIDATION.md`) is the phase gate and requires the Phase 153-01 backend (`agent_loop.py`) loaded — the orchestrator restarts uvicorn before that UAT. This executor did not run the backend.

## Next Phase Readiness

- **Phase 153 render layer is complete** — backend honesty core (153-01) + interaction foundation (153-02) + numbered footer (153-03) + peek (153-04) + this assembly (markers + cited branch + absence ⓘ). The full inline-citation experience renders end-to-end over the provider-uniform `citations` SSE.
- **CITE-01 stays OPEN** at the requirement level (false-green avoidance, 148–152 + 153-01..04 convention) — it closes at `/gsd:verify-work` / secure-phase after the live SC#10 4-axis cross-provider UAT (markers render on native providers, degrade to footer-only where a model emits none per D-07; OpenRouter axis may stay blocked by external BUG-260714-02, operator-accept precedent from Phase 152).
- **NEXT:** run the `153-VALIDATION.md` SC#10 4-axis UAT (operator restarts uvicorn first), then `/gsd:verify-work 153`.

## Self-Check: PASSED

- All 6 declared files exist on disk (FOUND: CitedMarkdown.tsx, AbsenceHint.tsx, MessageItem.tsx, CitedMarkdown.test.tsx, AbsenceHint.test.tsx, MessageItem.test.tsx).
- All 5 task commits exist in git history (FOUND: `75bc236e`, `9782b5b9`, `b889192e`, `47bccfbc`, `57d1a937`).
- `git diff --name-only 75bc236e^..HEAD` = exactly the 6 declared files; `StreamsProvider.tsx` absent from the diff; no backend/migration/package touched.
- Gates: `CitedMarkdown.test.tsx` 6/6, `AbsenceHint.test.tsx` 6/6, `MessageItem.test.tsx` 11/11, `CitationList`/`CitationPeek`/`citationNav`/`CitationCard` + provider suites green (79/79 across 8 files); `npx tsc -b` = exactly 30 pre-existing SEED-056/049 baseline errors, 0 net-new; `npx vite build` exit 0.

---
*Phase: 153-inline-citations*
*Completed: 2026-07-15*
