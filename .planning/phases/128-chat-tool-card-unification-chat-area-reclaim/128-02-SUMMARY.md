---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 02
subsystem: ui
tags: [react, tailwind, chat, message-item, line-clamp, useLayoutEffect, ctc-04]

# Dependency graph
requires:
  - phase: 095-chat-tool-card-unification
    provides: the MessageItem user-bubble surface (gradient-primary right-aligned bubble) this clamp refines
provides:
  - CTC-04 user-prompt clamp — long USER prompts collapse to a -webkit-line-clamp:7 preview + gradient-matched fade + Read more / Show less toggle
  - UserBubble local subcomponent (overflow-detect via useLayoutEffect + ref) keeping MessageItem's parent hook order pristine
affects: [128-05 (D-06 long-message UAT axis covers the live overflow reveal), any future MessageItem user-branch work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overflow-detect clamp: always-render the clamp container; the fade + Read-more only appear when scrollHeight > clientHeight (cheapest-honest, RESEARCH Pattern 3)"
    - "useLayoutEffect (not useEffect) for pre-paint DOM measurement to avoid the one-frame full-height flash (Pitfall 5)"
    - "Local subcomponent factoring (UserBubble, mirrors FinalOutputsPanel) to isolate new hooks from a parent with conditional-adjacent hooks"
    - "Test the real overflow branch in jsdom by mocking HTMLElement.prototype.scrollHeight/clientHeight (jsdom has no layout) — assert structure + the fade class, not runtime measurement"

key-files:
  created:
    - frontend/src/__tests__/components/MessageItem.clamp.test.tsx
  modified:
    - frontend/src/components/chat/MessageItem.tsx

key-decisions:
  - "Fade dissolves to the bubble violet from-[hsl(258_90%_66%)] (the 135° gradient END, index.css:199), NOT the page bg (D-03 / sketch 050-A)"
  - "Sketch 050 winner A (fade + inline Read more) — inline chip inside the bubble, lowest chrome"
  - "content renders as React text children (auto-escaped); never dangerouslySetInnerHTML (T-128-02-01 / V5 output-encoding)"

patterns-established:
  - "CTC-04 overflow-detect clamp pattern for long user content in chat bubbles"

requirements-completed: [CTC-04]

# Metrics
duration: 6min
completed: 2026-06-27
---

# Phase 128 Plan 02: CTC-04 User-Prompt Clamp Summary

**Long USER prompts in the chat now collapse to a `-webkit-line-clamp:7` preview with a violet gradient-matched fade and an inline Read more / Show less chip — reclaiming chat-area vertical space — via a `UserBubble` subcomponent that detects overflow with `useLayoutEffect`; short prompts and the assistant branch render byte-identically.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-27T06:07:53Z
- **Completed:** 2026-06-27T06:14:26Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Factored a local `UserBubble({ content })` subcomponent inside `MessageItem.tsx` (mirrors `FinalOutputsPanel`) so its `useRef`/`useLayoutEffect`/`useState` do not perturb `MessageItem`'s already conditional-adjacent hook order.
- `useLayoutEffect` overflow-detect (`scrollHeight > clientHeight + 1`) flips an `overflowing` flag pre-paint, gating the fade + Read-more affordance so SHORT prompts render with no fade and no button — visually unchanged from today.
- Clamp classes `[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden` applied (via `cn`) only when `!expanded`; the violet fade `bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent` (the 135° gradient END, NOT the page bg) shows only while `overflowing && !expanded`.
- 5 structural vitest cases (RED→GREEN), asserting: long content → Read more button + Show less toggle; short content → no button + preserved `whitespace-pre-wrap break-words`; fade class `from-[hsl(258_90%_66%)]` present; assistant branch renders no user-bubble clamp.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 (RED): failing test for CTC-04 user-prompt clamp** - `a9eff41e` (test)
2. **Task 1 (GREEN): implement CTC-04 user-prompt clamp (UserBubble)** - `59a8f8bc` (feat)

_No REFACTOR commit — the GREEN implementation was already minimal and clean (the UserBubble factoring is the structurally-correct shape; nothing to tidy)._

## Files Created/Modified
- `frontend/src/components/chat/MessageItem.tsx` - Added `useLayoutEffect` + `cn` imports; added the `UserBubble` local subcomponent (overflow-detect clamp + violet fade + Read more/Show less); rendered it from the `if (isUser)` branch in place of the bare `<p>`. Bubble shell, `rounded-br-md` tail, `max-w-[70%]`, right-alignment, and `User` avatar all preserved; assistant branch untouched.
- `frontend/src/__tests__/components/MessageItem.clamp.test.tsx` - New structural test (5 cases). Uses a `forceOverflow()` helper that mocks `HTMLElement.prototype.scrollHeight`/`clientHeight` so the REAL `useLayoutEffect` overflow branch renders in jsdom (which has no layout); asserts structure + the fade class, deferring live overflow to the D-06 manual UAT.

## Decisions Made
- **Sketch 050 winner A** (fade + inline Read more) is the implemented affordance — inline chip inside the bubble, lowest chrome — matching the plan `<action>` and the operator-approved sketch.
- **Fade color = `hsl(258 90% 66%)`** (the violet END of the bubble's 135° `gradient-primary`, `index.css:199`), authored as the Tailwind arbitrary class `from-[hsl(258_90%_66%)]`. The fade dissolves text into the bubble, never into a page-color band (D-03).
- **Tested the production overflow path, not a test-only prop:** rather than expose an `overflow`/`expanded` test hook on `UserBubble`, the test mocks `scrollHeight`/`clientHeight` so the real `useLayoutEffect` measure trips — keeping the component's public surface clean while still exercising the real branch.

## Deviations from Plan

None - plan executed exactly as written. The `<action>` block, the pattern map (§ "MessageItem.tsx (MOD) — CTC-04 user-prompt clamp" + § "Local subcomponent factoring" + § "Component (render) test scaffold"), and sketch 050-A were followed verbatim.

## Issues Encountered

- **Pre-existing `react-hooks/rules-of-hooks` eslint error in `MessageItem.tsx` (line 349, `stickyLabelRef = useRef(...)`)** — NOT introduced by this change. Proven pre-existing: in the unchanged original file the `if (isUser)` early return is at line 205 and that `useRef` is at line 283 (a hook after the early return). This is exactly WHY the plan mandated the `UserBubble` local-subcomponent factoring — the new hooks live in their own component and run unconditionally there, adding **zero** new violations (eslint flags exactly 1 error, the pre-existing one; `UserBubble`'s hooks at lines 81/87 are clean). Out of scope per the scope-boundary rule (predates this phase, lives in the assistant-path code I did not touch).
- **Frontend vitest/tsc rot (SEED-056) confirmed, not regressed:** the existing `MessageItem.test.tsx` "shows thinking indicator when streaming with empty content" test (`/thinking/i` at line 106) fails at BOTH baseline AND HEAD (the empty-streaming copy is now `outerBannerLabel(...)`, not "Thinking…"); `tsc -b` surfaces 29 pre-existing project-wide type errors in unrelated files (`IngestionPage.test.tsx`, `useMessages.test.ts`, `ChatAreaMode.test.tsx`, `SettingsPage.tsx`, `streamsStore.ts`, etc.). **None** of these reference `MessageItem.tsx` or `MessageItem.clamp.test.tsx` — my two files are type-clean and the new 5-test suite passes on its own (the success-criteria caveat honored: proved net-new green, did not chase the absolute pass count).

## User Setup Required

None - no external service configuration required. Pure client-side clamp over content already in `message.content` — no net-new wire, no backend, no migration, no new dependency.

## Next Phase Readiness
- CTC-04 satisfied: long user prompts collapse to a gradient-faded clamped preview + Read more; short prompts render exactly as before; the assistant branch is untouched.
- The live overflow reveal (the actual `scrollHeight > clientHeight` behavior in a real browser) is covered by the D-06 manual UAT (Plan 05, long-message axis) — jsdom has no layout, so the automated test asserts structure + the fade class.
- This plan is independent of the provider-logo chain (it imports nothing from `@lobehub/icons`) — no cross-plan coupling introduced.

## Self-Check: PASSED

- FOUND: `frontend/src/components/chat/MessageItem.tsx`
- FOUND: `frontend/src/__tests__/components/MessageItem.clamp.test.tsx`
- FOUND: `.planning/phases/128-chat-tool-card-unification-chat-area-reclaim/128-02-SUMMARY.md`
- FOUND commit `a9eff41e` (RED test)
- FOUND commit `59a8f8bc` (GREEN feat)
- `npx vitest run src/__tests__/components/MessageItem.clamp.test.tsx` → 5 passed (exit 0)

---
*Phase: 128-chat-tool-card-unification-chat-area-reclaim*
*Completed: 2026-06-27*
