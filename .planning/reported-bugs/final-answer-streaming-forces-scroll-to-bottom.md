---
id: BUG-260904-02
title: "While the final answer streams, scrolling up is yanked back to the bottom"
reported: 2026-09-04
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/chat, frontend/streaming, UX/scroll, MessageList.tsx, useFollowScroll]
folded_into: null
verified_closed_by: "quick task 260904 — operator-confirmed in a real browser after the third fix"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 57274c7e0
  date: 2026-09-04
---

# BUG-260904-02: the final-answer stream re-pins the scroll and fights the reader

Reported by the operator, 2026-09-04, during Phase 227 review.

## What they observe

> *"when the final answer is generating … it is forcing me to scroll down. If I scroll up
> it is forcing me to go down."*

While the assistant's final answer is streaming, scrolling up does not hold. The view is
pulled back to the live edge, repeatedly, so a long answer cannot be read from the top while
it is still being written.

## Why this is a regression against a written contract, not a preference

Phase 095 Plan 04 (D-03) shipped a **follow-but-release** state machine precisely so this
could not happen — `frontend/src/components/chat/MessageList.tsx:70`, verbatim:

> *"auto-follow is now GATED on `isPinned`. While pinned, follow the live edge; the instant
> the user scrolls up the hook releases the pin and this effect stops scrolling (the release)."*

Each programmatic scroll is meant to be announced with `beginProgrammaticScroll()` so the
scroll event it generates does not itself trip the release (T-095-04-02). The reported
behaviour is that release either never fires or is immediately re-armed during final-answer
streaming. **The intended model is the Claude.ai one: follow while the reader is at the
bottom, release the moment they scroll away, and offer "↓ Jump to live" rather than dragging
them.**

## Not yet diagnosed — two candidates, both to be driven

1. The `scrollToTarget` effect (`MessageList.tsx:118-130`) re-runs as content grows, and the
   `preparing`-element branch (Focus Mode, 076.1 D-01/D-02) may scroll even when the pin is
   released.
2. `beginProgrammaticScroll()` may not cover the smooth-scroll tail: a `behavior: "smooth"`
   write emits scroll events for several frames, and a release-detecting listener can read
   the later frames as user input, re-arming the pin.

⚠ Likely the same family as **BUG-260823-01** (*"tool-call smooth scroll re-arms the pin"*),
which is open on the same file. Diagnose them together; they may be one defect with two
symptoms, and closing one without the other has already happened once on this surface.

## Acceptance

Scroll up mid-stream, at three different points, and stay there while the answer finishes.
The view must not move, and "↓ Jump to live" must be the only way back. jsdom cannot prove
this — it is a browser drive.

## Fixed — 2026-09-04, and it took THREE attempts. All three are recorded, because the two that
## failed are the finding.

**Attempt 1 — the one-frame flag.** `beginProgrammaticScroll` cleared its "this scroll is mine"
flag after a single animation frame. Correct for an `instant` scroll; wrong for
`scrollIntoView({behavior:"smooth"})`, which keeps emitting scroll events for hundreds of ms, so
every later frame of our OWN animation was read as the user and re-armed the pin. Fixed by making
the window last until the animation settles, and requiring a real user gesture for a re-arm.
Measured clean on the raw-text path: drift 0 while content grew 974 px.

**Attempt 2 — the second clock.** The operator said it still dragged them *"when it is generating
and calling tools in the card, not in the raw text"*, and they were right: that path uses
`preparingEl.scrollIntoView({behavior:"smooth"})` on EVERY token delta, so an animation is always
in flight. Measured in the browser: **+1136 px** (5661 → 6797), chip already gone. The release
fired; the tail then re-armed inside the gesture window, because the tail arrives milliseconds
after the very gesture that cancelled the soft timer. Fixed with two clocks: a gesture may cancel
our claim for the purpose of LETTING GO, never for TAKING HOLD again.

**⚠ Attempt 2 measured clean and was still broken, which is the lesson.** The synthetic probe was
`new WheelEvent(...)` followed by a `scrollTop` write — that is not a wheel. It produces ONE scroll
event and lands instantly, so it could not exercise either real cause:

  1. **React state is asynchronous.** `setIsPinned(false)` from the scroll handler does not reach
     the auto-follow effect until the next commit, and a token delta re-runs that effect every few
     tens of ms — so further `scrollIntoView` calls fired after the user had begun scrolling.
  2. **An in-flight smooth scroll does not stop because our state changed.** The browser keeps
     animating toward its target regardless.

**Attempt 3 — what actually fixed it**, operator-confirmed:
  - the gesture releases the pin SYNCHRONOUSLY, in the wheel handler, before the scroll event;
  - the gesture ABORTS the running animation (assigning the viewport's current offset to itself
    cancels a smooth scroll without moving anything);
  - the auto-follow effect gates on `isPinnedNow()` — the ref — not on React state;
  - direction is read where the event knows it: wheel-up releases, wheel-down at the live edge
    does not (or the chip would flash while the reader follows along).

⚠ **A synthetic input event is not evidence about an input-driven bug.** Two "measured clean"
readings preceded a defect the operator felt immediately with a real mouse. The browser drive is
the acceptance bar here, and only a human hand can meet it.

**Related:** `BUG-260823-01` (*"tool-call smooth scroll re-arms the pin"*) names the same
mechanism and is addressed by attempt 2's second clock. Left OPEN deliberately — it should be
closed by whoever drives its own repro, not folded in on this report's evidence.

Suite: `src/__tests__/hooks/useFollowScroll.test.ts`, adopted into BOTH gate knobs in the fixing
commit. ⚠ It was in NEITHER while carrying the whole scroll discipline of the chat.
