---
seed_id: SEED-253
title: "At mobile width there is no way to open the nav drawer from any view except chat — `onOpenDrawer` is threaded ONLY to `ChatArea`, so a phone user on Library, Workflows, Settings or Connections has no navigation control on screen at all"
created: 2026-09-06
planted_during: "Phase 235 plan 09 (SURF-03) — building the mobile home for the app-shell attention signal. Found by measurement while answering the question 'where does a phone user see this?', not by a report"
status: planted
surface: Agentic-RAG
severity: medium
category: navigation / mobile / reachability
priority: medium
relates_to:
  - "`frontend/src/components/layout/ChatLayout.tsx` — the ONE `onOpenDrawer={() => setDrawerOpen(true)}`, passed to `<ChatArea>` and to nothing else"
  - "`frontend/src/components/chat/ChatArea.tsx` — the two shipped drawer triggers (the welcome-state bar and the thread header), both `md:hidden`, both inside the chat view"
  - "`frontend/src/components/layout/NavPanel.tsx` — `hidden md:flex`; the desktop rail does not exist below the `md` breakpoint, which is WHY the drawer is the only mobile nav"
  - SEED-185 — the app has no router, so there is no URL a stranded mobile user could type either
  - Phase 235 SURF-03 — the requirement whose sentence ("a broken watch reaches a person who is not already looking at the page") is what surfaced this
trigger_when: >
  The first phase that adds a mobile-reachable surface outside the chat view, OR the
  first report of a mobile user unable to open the nav drawer. Either event makes the
  gap load-bearing; until one of them happens it is a pre-existing limitation that has
  never been reported.
---

## What is true today — measured 2026-09-06, not assumed

`ChatLayout` owns `drawerOpen`. There is exactly **one** place that sets it to `true`:

```tsx
<ChatArea
  …
  onOpenDrawer={() => setDrawerOpen(true)}
/>
```

`ChatArea` renders that callback on two controls, both `md:hidden`: the welcome-state bar
(`ChatArea.tsx`, the `if (!thread)` branch) and the thread header. **Both are inside the chat
view.** Every other view — Library, Workflows, Skills, Connections, Settings, the Control Room,
the run surface — mounts in `ChatLayout`'s `else` branch, which renders a bare `<main>` with no
drawer trigger of any kind.

Below the `md` breakpoint `NavPanel` is `hidden`, so on those views there is **no navigation
control on screen at all**. A phone user who reaches Library (by tapping the drawer's Library
button, which then closes the drawer) can go nowhere else without reloading the app.

## Why this is recorded rather than fixed

⚠ **It is PRE-EXISTING and Phase 235 did not create it.** The gap has been there since the
drawer was introduced; SURF-03 merely walked past it. Plan 09's job was to make a broken source
reach a person who is not looking at the Library page, and it does: the drawer's Library button
carries the badge, and the drawer-**opening** control carries a dot so a closed drawer still
signals. **The signal therefore reaches every mobile surface that has a trigger today.**

Fixing the navigation gap itself means adding a persistent mobile app bar (or moving the drawer
trigger up into `ChatLayout` so it renders on every branch) — a navigation change with its own
sketch, its own breakpoint decisions and its own layout consequences on eleven views. That is a
phase, not a line in a plan about source health, and building it inside plan 09 would have been
the "closure round smuggles in a feature" failure G-7 exists to stop.

## The shape of the fix, when it is taken

The cheap version is **one move, not a new component**: lift the `md:hidden` trigger out of
`ChatArea` and render it in `ChatLayout` above the branch, so every view gets it. That costs
`ChatArea` its two trigger sites (they become redundant) and gains a header row on ten views
that currently have none — which is exactly the layout decision that needs a sketch rather than
a judgement call, since several of those views already own their own page header.

⚠ **Whoever takes it must move the attention dot with the trigger.** It lives on the trigger
today (`ChatArea`'s `attentionDot`, fed by `attentionCount`) precisely because that is where the
only mobile trigger is; a trigger that moves and leaves the dot behind would silently un-ship the
mobile half of SURF-03.
