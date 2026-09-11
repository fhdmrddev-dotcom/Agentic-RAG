---
id: BUG-260904-05
title: A cap-paused Deep run disables the composer and then tells you to "start a new message" — and Phase 228 removed the reload that used to free you
surface: Agentic-RAG
severity: major
status: folded
reported: 2026-09-04
reported_by: Claude, during Phase 228 post-execution verification
affected_areas: [chat, run-lifecycle, composer, cap_paused, continue]
folded_into: 244
re_open_trigger:
related: [BUG-260818-03, SEED-180]
---

## What happens

A **Deep** chat run hits the 15-iteration cap and pauses (`runs.status = 'cap_paused'`). The thread
then acquires a workflow lock — and lock **presence** is what disables the composer:

- `frontend/src/components/chat/ChatArea.tsx:102` — `const workflowLocked = workflowLock !== null`
- `:422` — `workflowLocked={workflowLocked}`
- `frontend/src/components/chat/MessageInput.tsx:339` — `disabled={disabled || workflowLocked}`
- `:337` — placeholder becomes **"Workflow running — Cancel to switch back"**

So a Deep chat, with no workflow anywhere near it, tells the user a workflow is running and refuses
input.

**It gets worse once continues are exhausted.** `MessageItem.tsx` renders, in the amber card:

> *"Reached the Continue limit — this run is stopped. **Start a new message to keep going.**"*

…while the composer directly beneath it is disabled. **The UI instructs an action it forbids.**

## Why it is being filed now

⚠ **Phase 228 did not introduce this** — the live SSE path already set the same lock
(`StreamsProvider.tsx:994-1002`, *"thread's lock to capPaused so the inline Continue card appears
out-of-band"*), so the contradiction existed during a live cap-pause.

⭐ **What Phase 228 changed is that reloading no longer escapes it.** `228-02` correctly extended the
Phase 092 mount reconcile with an `else if (state.cap_paused)` branch
(`ChatArea.tsx:167-180`, `StreamsProvider.tsx:2065-2078`) so the Continue card survives a reload —
which is exactly what `BUG-260818-03` asked for and is the right fix. The side effect is that the
composer lock now survives the reload too. **Before: reload freed the composer and lost the Continue
card. After: reload keeps the Continue card and keeps the composer disabled.** The accidental escape
hatch is gone, so the pre-existing defect is now permanent for the life of the thread.

## Why the lock is the wrong instrument here

`WorkflowLock`'s own docblock (`frontend/src/stores/streamsStore.ts`) says presence means *"the thread
is Harness-locked (a non-terminal workflow run owns its anchor); absence means Deep (unlocked)"*, and
`mode` is the literal `"harness"`. A cap-paused **Deep** run is neither harness nor running — it is
being represented by a structure that means both, purely because that structure is where `capPaused`
happens to live.

## Repro

1. Start a Deep chat that will exceed 15 tool iterations.
2. Let it hit the cap. Observe the amber Continue card and the disabled composer.
3. Reload the page. Card persists (the Phase 228 fix, working); composer stays disabled.
4. Click Continue until continues are exhausted (or start from an exhausted run).
5. Read the card: *"Start a new message to keep going."* Try to. The composer is disabled and says a
   workflow is running.

⚠ **Not driven live.** Verified by code path, not by a live run: the dev database contains **zero**
`cap_paused` rows (`runs.status` counts measured 2026-09-04 — completed 1274, failed 161, cancelled
56, timed_out 7, streaming 1), so forcing one needs either a real 15-iteration run or a seeded row.
The `runs_status_check` CHECK constraint **does** permit `'cap_paused'`, so the state is reachable.

## Suggested direction (not a decision)

Separate "a Continue is pending" from "the composer is locked". Either gate the composer on
`workflowLock.mode === "harness" && !capPaused`, or carry the Continue affordance on something that
does not also mean *locked*. ⚠ Whichever is chosen, the exhausted-state copy and the composer state
must agree — a card that says *start a new message* next to a disabled composer is the failure this
report is really about.
