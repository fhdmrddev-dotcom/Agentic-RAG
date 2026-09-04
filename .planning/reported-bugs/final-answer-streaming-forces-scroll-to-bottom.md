---
id: BUG-260904-02
title: "While the final answer streams, scrolling up is yanked back to the bottom"
reported: 2026-09-04
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, frontend/streaming, UX/scroll, MessageList.tsx, useFollowScroll]
folded_into: null
verified_closed_by: null
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
