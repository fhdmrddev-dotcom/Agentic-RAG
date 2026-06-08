---
phase: 095-chat-tool-card-unification
plan: 04
subsystem: ui
tags: [react, vitest, typescript, scroll, follow-scroll, jump-to-live, message-list, D-03]

# Dependency graph
requires:
  - phase: 095-02
    provides: "RunStatusStrip — the ONE '⏱ elapsed · Step N · activity' strip with a placement prop; this plan MOUNTS it (no second strip) inside the floating Jump-to-live chip"
  - phase: 095-01
    provides: "unifiedStepCount(message) — the D-04 deduped count; the floating chip reads the live step count from it"
  - phase: 083
    provides: "MessageList key={run-${runId}} remount guard + the BL-05 scrollListenerAttachedRef retry-attach — both preserved verbatim (extended, never replaced)"
provides:
  - "useFollowScroll — the D-03 follow/release/re-arm/jump state machine (isPinned, showJumpToLive, jumpToLive, onScroll, beginProgrammaticScroll); the one genuinely-new chat-scroll behavior (BUG-260529-02 #1)"
  - "MessageList wires useFollowScroll over the Radix viewport (auto-follow gated on isPinned) + renders the floating '↓ Jump to live' chip on scroll-away, reusing the ONE RunStatusStrip"
affects: [095-05, MessageList, useFollowScroll, RunStatusStrip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pin-state machine over a getViewport() accessor: isPinned drives render (the chip + the auto-follow gate); a mirrored ref lets onScroll/jumpToLive read the current value without a stale closure (the scroll listener attaches once)"
    - "Programmatic-scroll immunity: beginProgrammaticScroll() flags isProgrammaticScrollRef before each scrollIntoView/scrollTop write and clears it on the next rAF, so the auto-follow's own scroll event can never trip the release (T-095-04-02)"
    - "Hybrid status-strip placement: the persistent timer identity lives in the header strip (Plan 02); the floating chip carries only step + a calm motion verb + the Jump-to-live affordance, reusing the SAME RunStatusStrip component (build-once)"

key-files:
  created:
    - "frontend/src/hooks/useFollowScroll.ts — the D-03 follow-but-release scroll state machine"
    - "frontend/src/__tests__/hooks/useFollowScroll.test.ts — 7 state-machine cases (RED→GREEN, TDD)"
  modified:
    - "frontend/src/components/chat/MessageList.tsx — wires useFollowScroll (auto-follow gated on isPinned, programmatic scrolls flagged), renders the floating JumpToLive chip reusing RunStatusStrip; BL-05 guard preserved"
    - "frontend/src/__tests__/components/chat/MessageList.test.tsx — 5 new D-03 chip cases (scroll-up renders / scroll-bottom hides+re-arms / not-streaming no chip / click re-pins / pinned no chip)"

key-decisions:
  - "THRESHOLD = the EXISTING 120px (MessageList.tsx:37), chosen over the sketch's 56 — keeps the felt near-bottom heuristic byte-for-byte unchanged (PLAN Task 1 explicit guidance: 'the existing 120 is safest to avoid changing felt behavior')"
  - "The floating chip mounts RunStatusStrip with placement=\"header\" (not \"floating\") INSIDE the pill button — the button IS the single floating pill (border + bg + glow); a placement=\"floating\" strip would render a SECOND nested pill border, double-framing inside this pill. Both placements satisfy 'reuses RunStatusStrip — no second strip'; header gives plain-text segments. Documented discretion call (PLAN Task 2 grants it)."
  - "Chip status is HONEST, not a stub: stepCount = unifiedStepCount(the live-streaming assistant message) — real; elapsed = a compact stable-start-ts derivation from that message's created_at (mirrors Plan 02's formatElapsed, Xm Ys past a minute, null-on-unparseable); activityVerb = 'Streaming…' (a calm motion signal — the per-tool verb lives in the header strip per the hybrid)"
  - "isNearBottomRef + the bare handleScroll are REPLACED by the hook's isPinned + onScroll (the explicit release/re-arm machine extends the old < 120 heuristic); the BL-05 scrollListenerAttachedRef retry-on-rAF attach is preserved verbatim, now attaching onScroll"
  - "Auto-follow effect now gates BOTH branches (new-message AND token-delta) on isPinned and calls beginProgrammaticScroll() before every scroll write; the active-[data-tool-status='preparing'] Focus-Mode priority (076.1 D-01/D-02) and the behavior: isStreaming ? 'instant' : 'smooth' choice are preserved"

patterns-established:
  - "The release is structural: when the user scrolls up the hook flips isPinned=false and the auto-follow effect simply stops scrolling — there is no scroll-fight code, the programmatic-immunity flag guarantees the auto-follow can't re-trip itself"
  - "A live-run affordance gates on isStreaming: showJumpToLive = !isPinned && isStreaming, so the chip never lingers after a run terminates even if the user is scrolled away"

requirements-completed: [CHAT-04]

# Metrics
duration: 12min
completed: 2026-06-05
---

# Phase 095 Plan 04: useFollowScroll Follow-but-Release + Floating Jump-to-Live Chip Summary

**The one genuinely-new chat-scroll behavior — D-03 follow-but-release scroll (follow the live edge while pinned, release the instant the user scrolls up, re-arm at the bottom, immune to the auto-follow's own scrolls) — plus the floating "↓ Jump to live" chip that mounts the ONE Plan-02 RunStatusStrip (no second strip) and re-pins on click. Closes BUG-260529-02 #1.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-05T19:46:20Z
- **Completed:** 2026-06-05T19:58:00Z
- **Tasks:** 2 (Task 1 `type=auto tdd=true`; Task 2 `type=auto`)
- **Files created:** 2 (useFollowScroll.ts + its test)
- **Files modified:** 2 (MessageList.tsx + its test)

## Accomplishments

- **`useFollowScroll` — the D-03 state machine (Task 1, TDD RED→GREEN).** New `frontend/src/hooks/useFollowScroll.ts` exporting `useFollowScroll(getViewport, isStreaming)` → `{ isPinned, showJumpToLive, jumpToLive, onScroll, beginProgrammaticScroll }`. `isPinned` (default true) drives render + the auto-follow gate, mirrored into a ref so `onScroll`/`jumpToLive` read the current value without a stale closure (the listener attaches once). `onScroll()` computes `distFromBottom = scrollHeight - scrollTop - clientHeight` from the viewport: `> 120` → release (`isPinned=false`); `< 120` → re-arm (`isPinned=true`). A PROGRAMMATIC scroll (flagged via `beginProgrammaticScroll()`, cleared on the next rAF) is skipped so the auto-follow can never fight a scrolled-up user (T-095-04-02). `showJumpToLive = !isPinned && isStreaming` (a live-run-only affordance). `jumpToLive()` re-pins, flags the scroll programmatic, and scrolls the viewport to the live edge. Pure hook — the only DOM coupling is the `getViewport()` accessor; imports no components. **Threshold = the existing 120px** (chosen over the sketch's 56 to keep the felt near-bottom heuristic byte-for-byte unchanged). 7 state-machine tests prove follow/release/re-arm/jump + programmatic-immunity + not-streaming-hides-chip + null-viewport-no-op.
- **MessageList wiring + the floating chip (Task 2).** MessageList calls `useFollowScroll(() => containerRef.current?.closest("[data-radix-scroll-area-viewport]"), isStreaming)`. The BL-05 `useLayoutEffect` retry-attach now attaches the hook's `onScroll` (replacing the bare `handleScroll`) — the `scrollListenerAttachedRef` guard preserved verbatim. The auto-scroll effect gates BOTH branches (new-message AND token-delta) on `isPinned` and calls `beginProgrammaticScroll()` before each `scrollIntoView`/`scrollTop` write; the active-`preparing` Focus-Mode scroll-target priority and the `behavior: isStreaming ? "instant" : "smooth"` choice are preserved. The floating `<button data-testid="jump-to-live-chip">` renders ONLY when `showJumpToLive` (scroll-away during a live run, so it never occludes the live stream while following): a sticky bottom-center pill (`border-primary/50 bg-popover/92 shadow-lg backdrop-blur-md animate-fadeSlideUp`) carrying the "↓ Jump to live" label + the ONE `RunStatusStrip` (real `stepCount` from `unifiedStepCount(the streaming message)`, a compact stable-start-ts elapsed, `activityVerb="Streaming…"`); `onClick={jumpToLive}` re-pins + scrolls to the live edge. The chat is NOT caged in a bordered fixed-height box (seamless-scroll rule held); the RunCard sticky header is untouched.

## Task Commits

1. **Task 1 — useFollowScroll state machine + 7-case test** — `53b6128b` (feat) — `frontend/src/hooks/useFollowScroll.ts` + `frontend/src/__tests__/hooks/useFollowScroll.test.ts`
2. **Task 2 — wire useFollowScroll + floating JumpToLive chip into MessageList + 5-case test** — `547a8439` (feat) — `frontend/src/components/chat/MessageList.tsx` + `frontend/src/__tests__/components/chat/MessageList.test.tsx`

**Plan metadata:** (final commit — docs: complete plan)

## Files Created/Modified

- `frontend/src/hooks/useFollowScroll.ts` (NEW) — `export function useFollowScroll(getViewport, isStreaming)`; the D-03 follow/release/re-arm/jump machine; `FOLLOW_SCROLL_THRESHOLD = 120`; programmatic-scroll immunity via `isProgrammaticScrollRef` + rAF-clear; no component imports.
- `frontend/src/__tests__/hooks/useFollowScroll.test.ts` (NEW) — 7 cases: initial pinned / scroll-up release + chip / re-arm at bottom / programmatic immunity / jumpToLive re-pin + scrolls to edge / not-streaming hides chip / null-viewport no-op. Drives a fake viewport with settable scroll geometry; stubs rAF to flush the programmatic-flag clear.
- `frontend/src/components/chat/MessageList.tsx` — wires `useFollowScroll`; auto-follow gated on `isPinned`; `beginProgrammaticScroll()` before each scroll write; BL-05 `scrollListenerAttachedRef` retry-attach preserved (now attaching `onScroll`); the floating JumpToLive chip reusing `RunStatusStrip`; added `formatFloatingElapsed` (stable-start-ts compact elapsed). `isNearBottomRef` + the bare `handleScroll` removed (superseded by the hook).
- `frontend/src/__tests__/components/chat/MessageList.test.tsx` — 5 new D-03 chip cases under a `TooltipProvider` wrapper (the assistant `MessageItem` renders Radix tooltips) + a flushable rAF stub so the programmatic-flag clear runs before each simulated user scroll.

## Decisions Made

- **Threshold = the existing 120px**, not the sketch's 56 — felt near-bottom heuristic unchanged (PLAN Task 1 explicit guidance).
- **Floating chip mounts `RunStatusStrip` with `placement="header"`** (not `"floating"`) inside the pill `<button>`: the button IS the single floating pill (border + bg + glow); a `placement="floating"` strip would render a SECOND nested pill border, double-framing. Both placements satisfy "no second strip"; header gives plain-text segments inside the existing pill. The button carries `data-placement="floating"` for the chip's own identity. Documented discretion call (PLAN Task 2 grants it).
- **Chip status is honest, not a stub** — `stepCount = unifiedStepCount(the live-streaming assistant message)` (real, deduped); elapsed = a compact `Xm Ys`/`Ns` stable-start-ts derivation from that message's `created_at` (mirrors Plan 02's `formatElapsed`, null-on-unparseable so never NaN); `activityVerb="Streaming…"` (a calm motion verb — the per-tool activity verb is the header strip's job per the hybrid).
- **`isNearBottomRef` + `handleScroll` replaced by the hook's `isPinned` + `onScroll`** — the explicit release/re-arm machine EXTENDS the old `< 120` heuristic; the BL-05 retry-attach guard is preserved verbatim, now attaching `onScroll`.

## Deviations from Plan

**1. [Rule 3 — Blocking] Test paths corrected to the real layout.** The PLAN's `files_modified` names `frontend/src/hooks/__tests__/useFollowScroll.test.ts` and `frontend/__tests__/components/chat/MessageList.test.tsx`. Neither directory exists — this project's real test layout is `frontend/src/__tests__/...` (the SAME deviation Plan 03 hit, DI-095-03; the planner's path convention is consistently off for this repo). Used `frontend/src/__tests__/hooks/useFollowScroll.test.ts` (new) and the existing `frontend/src/__tests__/components/chat/MessageList.test.tsx` (extended). No behavioral change — the tests, names, and assertions are exactly as specified; only the directory differs.

**2. [Rule 3 — Blocking, test-only] TooltipProvider + flushable-rAF harness for the D-03 component tests.** Two test-infra additions, both required to exercise the real wiring (not behavioral changes to source): (a) the D-03 chip cases render a real assistant `MessageItem`, which mounts a Radix tooltip and throws `Tooltip must be used within TooltipProvider` — wrapped the renders in `<TooltipProvider>`; (b) the mount auto-scroll effect flags a programmatic scroll and schedules a rAF to clear it, and jsdom never auto-flushes rAF, so a simulated user scroll would be wrongly skipped as "our own" — stubbed `requestAnimationFrame` with a flushable queue and flush it before each dispatched scroll (in the browser the rAF clears within ~16ms, well before a real user scroll). These are documented test-mechanics adjustments, not Rule-1 source fixes.

No Rule 1 (no bugs found), Rule 2 (no missing critical functionality — the threat register's two `mitigate` items, no-`dangerouslySetInnerHTML` and programmatic-scroll-immunity, are both satisfied by construction and asserted), or Rule 4 (no architectural change) triggers.

## Authentication Gates

None.

## Deferred Issues

None net-new from this plan. The 17 pre-existing full-suite failures (7 files: `streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`, `StreamsProvider.dedup.test.ts`, `MessageItem.test.tsx`, `useMessages.test.ts`, `Plan04.frontend.test.tsx`, `model-info.test.ts`) are the documented flaky StreamsProvider/timing baseline cluster (project memory `project_e2e_suite_rotted`; proven pre-existing by Plans 02 and 03 via clean-baseline rerun) — none reference `MessageList`/`useFollowScroll`. This plan adds ZERO net-new failures and +12 net-new passing tests (7 useFollowScroll + 5 MessageList D-03).

## Known Stubs

None. The floating chip reads real data (`unifiedStepCount` of the live message + a real stable-start-ts elapsed). `activityVerb="Streaming…"` is a calm motion label, not a placeholder. The `RunStatusStrip` `placement="floating"` styling provided by Plan 02 remains a forward contract; this plan reuses the SAME component via `placement="header"` to avoid a double-frame inside the chip pill (the strip + both placements are complete and correct — see Decisions).

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change. The plan operates entirely on DOM scroll events → render state (the only trust boundary in the threat model); both `mitigate` dispositions (T-095-04-01 no `dangerouslySetInnerHTML`, T-095-04-02 programmatic-scroll immunity) are satisfied and asserted. PANEL-06 isolation held (0 panel-store reads in both files).

## User Setup Required

None.

## Next Phase Readiness

- **Plan 05 unblocked** (it depends only on 01, runs parallel to this plan in Wave 3): D-08 backend hero tag + D-07 OutputFileCard hero/working split + fileIcon. No dependency on this plan's scroll work.
- **Verification clean:** useFollowScroll 7/7 + MessageList 9/9 green; `tsc -b` = 37 (the documented baseline — zero net-new, zero errors reference `MessageList.tsx`/`useFollowScroll.ts`/their tests); `vite build` exit 0 (only the pre-existing chunk-size + dynamic-import advisories). All Task-1 + Task-2 acceptance greps pass (useFollowScroll export=1, four-token match, no RunStatusStrip import in the hook; MessageList useFollowScroll≥1, isPinned≥1, beginProgrammaticScroll≥1, RunStatusStrip|Jump-to-live|jumpToLive≥1, scrollListenerAttachedRef preserved, dangerouslySetInnerHTML=0). PANEL-06 held.
- **083 + BL-05 non-regression:** MessageList `key={run-${msg.runId}}` untouched; the `scrollListenerAttachedRef` retry-on-rAF attach preserved verbatim (now attaching `onScroll`); the active-`preparing` Focus-Mode scroll priority and the streaming/instant behavior choice kept.

## Self-Check: PASSED

- Files: `useFollowScroll.ts` + `useFollowScroll.test.ts` + `MessageList.tsx` + `MessageList.test.tsx` + this SUMMARY.md FOUND on disk.
- Commits: `53b6128b` (Task 1) + `547a8439` (Task 2) FOUND in git log.
- Tests: useFollowScroll 7/7 + MessageList 9/9 green; full suite 486 passed / 17 pre-existing failures (zero net-new).
- `tsc -b` = 37 (baseline, zero net-new); `vite build` exit 0.

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-05*
