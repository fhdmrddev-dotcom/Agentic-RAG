---
id: BUG-260911-03
title: The Library nav badge says something needs attention but nothing inside the Library says which tab — the count stops at the door
reported: 2026-09-11
reported_by: operator
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/navigation, frontend/library, UX/legibility, SURF-03]
folded_into: 244
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 52d110f86
  date: 2026-09-11
---

# BUG-260911-03: the attention count stops at the Library door

## What the operator observed

> *"In the Library there is a notification in the navigation menu indicating that there is something
> in the library. However while I opened the library, this same number — one or two or three
> notifications — should also be above the tab that this issue is where it's located."*

**Reproduced visually in this session's screenshots:** the left nav reads **`Library  1`** with a
count badge. Clicking it opens the Library — and **the badge's information ends there.** The five
tabs (**Documents · Views · Ingestion · Indexing · Health**) carry no count, no dot, nothing.

## Why it matters

**The badge creates a question it then refuses to answer.** It is a call to action whose target is
hidden: the operator is told *"one thing needs you"*, taken to a surface with **five** tabs, and left
to open each one hunting for it.

⚠ **The cost scales the wrong way.** The badge is most useful when several things need attention at
once — and that is exactly when "which tab?" is most expensive to answer by hand.

⭐ **The fix the operator describes is the small one and the right one: carry the same number onto
the tab that owns it.** The count already exists and is already computed; what is missing is
attributing it to a tab and drawing it there. **This is a propagation gap, not a new signal.**

## Where to look (a starting point, NOT a traced finding)

The attention machinery already exists and is not in doubt:

- `frontend/src/components/layout/attentionConditions.ts` — the conditions the count is derived from
- `frontend/src/components/layout/AttentionPopover.tsx`
- `frontend/src/components/layout/NavPanel.tsx` — draws the nav badge
- `frontend/src/hooks/useSourceAttention.ts` (suites: `NavPanel.badge.test.tsx`,
  `ChatLayout.badge.test.tsx`, `useSourceAttention.test.tsx`)

⛔ **Not traced in this session.** The likely shape is that `attentionConditions` already knows what
KIND each condition is, and the mapping *condition-kind → Library tab* is the piece that does not
exist. **Verify that before building anything** — this report asserts the symptom, not the cause.

## Routing

⚠ **Belongs with `SURF-03` and the chat-shell work — Phase 244** (*"a source that stopped reading
raises a signal the operator sees in the app shell"*). Phase 244 already owns the shell signal; **this
is the same signal's second half: the shell tells you THAT, the tab must tell you WHERE.**

⛔ **Not Phase 243's.** 243 was the thinking block, the delta cadence, the follow-scroll seam and the
answer's render branch. Filed rather than absorbed.
