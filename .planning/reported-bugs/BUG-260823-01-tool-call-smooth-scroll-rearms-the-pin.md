---
id: BUG-260823-01
title: Scrolling up during a tool call snaps you back to the bottom — the smooth auto-follow scroll re-arms the pin it was supposed to leave released
reported: 2026-08-23
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, frontend/chat, UX/scroll]
folded_into: "243"        # CHAT-03, at /gsd:plan-phase 243, 2026-09-11
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

---

## ⚠⚠ CORRECTION 2026-09-11 — THE ROOT CAUSE NAMED ABOVE NO LONGER EXISTS. The original is kept verbatim, never overwritten.

Routed into **Phase 243 (CHAT-03)** at `/gsd:plan-phase 243`. Before planning, `hooks/useFollowScroll.ts`
was opened at HEAD (`96adfd668`) rather than read off this report — and **every line this report blames
has already been replaced**, by the `BUG-260904-02` work at Phase 228, **twelve days after this report
was filed**:

| This report says | Measured at HEAD 2026-09-11 |
|---|---|
| `beginProgrammaticScroll()` "clears it on the **next animation frame**" | ⛔ **Gone.** `PROGRAMMATIC_SCROLL_SETTLE_MS = 900` — the window lasts until the animation settles |
| every late smooth-scroll event "passes the `isProgrammaticScrollRef` check" | ⛔ **Gone.** There are now **two** clocks: `programmaticUntilRef` (cancellable, gates the RELEASE) and `hardProgrammaticUntilRef` (**uncancellable**, gates the RE-ARM) |
| those events "land in the **re-arm** branch: `setIsPinned(true)`" | A re-arm now additionally requires a **real user gesture** inside `USER_GESTURE_WINDOW_MS = 1500` — `noteUserGesture`, fed by wheel / touch / pointer / key, with direction |
| the re-armed pin "re-enables the auto-follow effect" | The effect gates on `isPinnedNow()` (the **ref**, not the state), so it cannot fire on a stale `true` |

⚠ **This does NOT mean the defect is gone** — it means **this report's explanation of it is.** The
report's own header already warned it was *"Confirmed by reading, not yet by driving the browser."*
It stayed `status: open` for nineteen days while the code underneath it changed, which is the
project's recurring finding: **a register only knows the register below it, and the code is the bottom.**

⛔ **Phase 243 may not "fix" CHAT-03 against this report.** Its first task is a TDD RED drive
establishing what still reproduces at HEAD. If nothing does, CHAT-03 closes as *already-fixed-by-228*
and this file is closed with the discharging commit named — **and that is a legitimate outcome, not
a failure.** See `243-CONTEXT.md` → **D-243-05** for the candidate residual that must be checked
rather than assumed (a ~600 ms window between the 900 ms hard clock and the 1500 ms gesture window).
