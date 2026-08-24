---
id: BUG-260823-01
title: Scrolling up during a tool call snaps you back to the bottom — the smooth auto-follow scroll re-arms the pin it was supposed to leave released
reported: 2026-08-23
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/chat, UX/scroll]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-008]
re_open_trigger: null
reproduces_on:
  branch — develop
  commit — f17f9581
  date — 2026-08-23
---

# BUG-260823-01: Scrolling up during a tool call forces you back to the bottom

## What we observed

> Operator, 2026-08-23: *"when tools are called or something is generating, if I scrolled up, it is forcing to auto-scroll down."*

Scroll up while the agent is idle or emitting plain text → you stay where you put yourself
(the "↓ Jump to live" chip appears, as designed). Scroll up **while a tool card is in the
`preparing` state** → you are dragged back to the live edge within a few hundred milliseconds,
repeatedly, for as long as the tool is preparing.

## Why it matters

This is the single most-felt defect on the chat surface, and it hits precisely when the user
most wants to read back: mid-run, checking what the agent already said before it finishes. The
whole Phase 095 D-03 follow-but-release machine — the release, the chip, the re-arm — is
functionally absent during the exact window it was built for. The user cannot read their own
transcript while the agent works.

## Hypothesized cause

**Confirmed by reading, not yet by driving the browser** — treat as a strong hypothesis with a
named line for each step.

The follow/release gate itself is correct. The leak is in the *programmatic-scroll guard*:

1. `frontend/src/hooks/useFollowScroll.ts:66-71` — `beginProgrammaticScroll()` sets a boolean
   and clears it on the **next animation frame**. The docblock states the intent plainly: *"the
   single programmatic scroll event it produces is skipped."* That assumption holds only for an
   **instant** scroll, which emits one event.
2. `frontend/src/components/chat/MessageList.tsx:146` — the token-cadence branch scrolls with
   `scrollIntoView({ behavior: "smooth", block: "nearest" })` whenever a
   `[data-tool-status="preparing"]` element exists. A smooth scroll emits scroll events for
   roughly 300ms — dozens of frames after the flag cleared.
3. `useFollowScroll.ts:77` — every one of those late events therefore passes the
   `isProgrammaticScrollRef` check and is classified as a **user** scroll.
4. `useFollowScroll.ts:82-84` — because a smooth scroll is travelling *toward* the bottom,
   `distFromBottom` is shrinking, so those events land in the **re-arm** branch:
   `setIsPinned(true)`.
5. That re-armed pin re-enables the auto-follow effect (`MessageList.tsx:113-149`), which fires
   another smooth scroll on the next token, which leaks more events, which re-arms again.

So while a tool is `preparing` the pin cannot stay released: the machine re-pins itself faster
than the user can scroll away. Every other path uses `behavior: "instant"` or fires once per
message, which is why the defect is tool-specific — exactly as reported.

## Suggested fix shape

Do **not** simply widen the rAF window to a timer — that trades one guessed constant for
another, and a 300ms suppression window during a per-token cadence suppresses the user's real
scroll too. Two better shapes, either of which is ≤ 1 file:

- **Re-arm only on a real gesture.** Track `wheel` / `touchmove` / `keydown` on the viewport;
  `setIsPinned(true)` only when the latest scroll event follows one of those. Releases stay
  instant; programmatic approach can never re-pin. This is the honest state machine.
- **Make the tool-follow scroll instant.** `behavior: "instant"` in the token-cadence branch
  restores the one-event assumption the guard is written against. Cheaper, but it changes the
  felt motion of Focus Mode (076.1 D-01/D-02) and the smooth easing was a deliberate choice —
  so this is the fallback, not the first pick.

Either way the fix owes a test that **releases the pin while a `preparing` element is mounted**
and asserts it stays released across several token ticks. No existing test covers that
combination — which is why this shipped.

## Surface classification

`Agentic-RAG`. Frontend-only, one hook plus one call site.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** n/a — this is a G-3 candidate (`/gsd:fast`): ~10 lines,
  one file, no schema or API surface. It should not wait for a phase.
- **Plant as seed:** no
- **External — note only:** no

## Workarounds

None UI-side. The "↓ Jump to live" chip is the *opposite* affordance — it re-pins deliberately.
A user who wants to read back must stop the run or wait for the tool to leave `preparing`.

## Reference / evidence links

- `frontend/src/hooks/useFollowScroll.ts:66-86` — the guard and the re-arm branch
- `frontend/src/components/chat/MessageList.tsx:113-149` — the auto-follow effect, both branches
- Phase 095 Plan 04 (D-03) — the machine this defect defeats
