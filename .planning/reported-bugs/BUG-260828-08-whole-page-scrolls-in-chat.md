---
id: BUG-260828-08
title: The whole page scrolls in chat — the nav rail scrolls away and dead space opens under the composer
surface: Agentic-RAG
severity: medium
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [frontend/src/components/layout/ChatLayout.tsx]
re_open_trigger: n/a — open
---
# The app chrome scrolls instead of the message list

Screenshot evidence (2026-08-28 17:02): the left nav rail has scrolled so that `New chat`, `Chat`
and `Workflows` are off the top of the viewport, and a large empty band sits below the composer.

The rail and the composer are chrome — they should stay put while the message list scrolls inside its
own region. This is the *"seamless scroll, never a boxed chat"* contract inverted: instead of the
conversation scrolling within a stable frame, the frame moves and the conversation does not.

⚠ `ChatLayout.tsx` was modified this phase (214-12 added the launch moment). Whether that introduced
this or merely coincided with it is UNVERIFIED — `git log -p` on the layout/overflow declarations is
the first check, not an assumption.
