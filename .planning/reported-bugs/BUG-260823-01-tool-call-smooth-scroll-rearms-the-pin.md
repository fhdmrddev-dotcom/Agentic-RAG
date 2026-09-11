---
id: BUG-260823-01
title: Scrolling up during a tool call snaps you back to the bottom — the smooth auto-follow scroll re-arms the pin it was supposed to leave released
reported: 2026-08-23
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/streaming, frontend/chat, UX/scroll]
folded_into: "243"        # CHAT-03, at /gsd:plan-phase 243, 2026-09-11
verified_closed_by: "243-03 `8d7dfab43` + 243-06 `0790ad7b0`, driven by UAT row L-2 with a REAL wheel on a 60-message thread, 2026-09-11"  # 243-03 fixed a residual under DRIVEN vitest fences. NOT `closed`:
                          # this file records TWO prior fixes that measured clean on synthetic
                          # events and were refuted by a real mouse wheel. Closure needs the
                          # real-wheel UAT row (243-VALIDATION.md), not a unit test.
related_seeds: [SEED-008]
re_open_trigger: "A reader is dragged to the live edge during a run on a real mouse/trackpad after 243-03 ships, OR the 243 UAT row for a long streaming thread is not driven before the phase closes"
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

---

## ⚠ SECOND CORRECTION 2026-09-11 (`243-03`) — A RESIDUAL DID REPRODUCE, AND IT IS NOT THE ONE ABOVE. Both earlier texts are kept verbatim.

`D-243-05` named three legitimate outcomes for the RED drive this report was routed into. **The
outcome was #3: the residual is real but DIFFERENT from the report.** Recorded beside the original
rather than over it, because *why* the report was wrong is the useful part and *why it was still
pointing at something* is the second useful part.

### The discharging commit, established by measurement rather than asserted

`git log -S "hardProgrammaticUntilRef" -- frontend/src/hooks/useFollowScroll.ts` returns exactly one
commit, and the file has only three in its life:

| sha | date | subject |
|---|---|---|
| `53b6128b6` | 2026-06-05 | `feat(095-04): useFollowScroll follow/release/re-arm/jump state machine (D-03)` |
| **`64357e979`** | **2026-09-04** | **`fix(chat): stop the streaming run dragging a scrolled-away reader (BUG-260904-02)`** |
| `243-03` | 2026-09-11 | this work |

**`64357e979` is the commit that deleted every line this report blames**, and it landed **twelve
days** after this report was filed (`2026-08-23`), while the report sat `status: open` throughout.

⚠ **AND IT IS NOT A PHASE 228 COMMIT, although `243-CONTEXT.md` D-243-05 and the correction above
both say so.** Measured: it is timestamped `2026-09-04 11:46`, and Phase 228's first commit
(`7a5207dfd docs(228): capture phase context`) is `19:34` the same day — **7 hours 48 minutes
later**. `64357e979` is an untagged `fix(chat)` **quick task raised during Phase 227's review**
(`BUG-260904-02`'s own frontmatter: `verified_closed_by: "quick task 260904"`). The attribution is
corrected here rather than upstream, in the register that owns it. **The substance of D-243-05 is
unaffected** — the code was replaced before this report was ever acted on.

### What still reproduced at HEAD, driven before anything was written

Two levels, both RED **before** any production edit, on the code that exists today:

- `__tests__/hooks/useFollowScroll.test.ts` — *"⭐ A — an UPWARD gesture, then a near-bottom scroll
  1000 ms later: the pin must NOT re-arm"* → **`AssertionError: expected true to be false`**.
- `__tests__/components/chat/MessageList.scroll.test.tsx` §3 — the same sequence through the real
  component on a **54-message** thread → the Jump-to-live chip **vanished**, i.e. the pin re-armed.

**The mechanism, which this report did not and could not name:** a reader who nudges up by **less
than `FOLLOW_SCROLL_THRESHOLD` (120 px)** releases the pin and is still, by geometry, *near the
bottom*. `beginProgrammaticScroll` had set the uncancellable clock to `now + 900` on the last token
before the nudge, and `USER_GESTURE_WINDOW_MS` runs to `now + 1500` — so for roughly **600 ms** BOTH
re-arm conditions hold and **any** scroll event re-pins them. Scroll events are not produced only by
people: scroll anchoring as the streaming content above reflows, a focus move, a late layout shift.

### The fix, and the mirror that constrains it

One ref and one clause, at `useFollowScroll.ts:196-201` — **the exact line D-243-05 predicted**. A
re-arm now additionally requires that **the last classified gesture was not `"up"`**. That is the
file's own stated principle carried one step further: *a gesture buys the right to let go, never the
right to take hold again*.

⛔ It is a DIRECTION, not a ban, and the mirror is fenced beside the defect in both suites: a
deliberate flick back **down** that coasts to the bottom MUST still re-arm, and touch drags /
scrollbar grabs arrive as `"unknown"` and keep falling through to the geometry. **No reader is
stranded**, and a fix that passed one case by breaking the other would be a regression.

⚠ **`243-03`'s delta coalescing slightly WIDENS the window** (the effect refreshes the hard clock up
to 60 ms less often, so the gap can reach ~660 ms). The fix is needed *more* after the cadence
change, not less.

### Why this is `folded` and not `closed`

⛔ **Because this file's own history forbids the shortcut.** `64357e979`'s commit message:

> *"Attempts 1 and 2 measured CLEAN on a synthetic WheelEvent and were still broken with a real
> mouse. A synthetic input event is not evidence about an input-driven bug."*

Everything above is a synthetic `WheelEvent` in jsdom. It is strictly more than this report ever
had — the effect had **zero** behavioural coverage before `243-03`, because `MessageList.test.tsx`
stubs `scrollIntoView` to a no-op — but it is not a real wheel. **Closure is owed a real-mouse UAT
row on a long streaming thread**, and `re_open_trigger` now says so.

---

## ✅ CLOSED 2026-09-11 — by the real-wheel drive this file's own history demanded

This report was left `folded` rather than `closed` at 243-03 for one stated reason: **every fence was
a synthetic `WheelEvent`, and this file records two prior fixes that passed synthetic events and
failed a real mouse.** Its `re_open_trigger` named the missing evidence exactly.

**That evidence now exists.** UAT row **L-2**, driven 2026-09-11 on a **60-message** thread with a
**real wheel** injected through the browser's input pipeline, mid-tool-call, measured for ~25 s
through the end of a five-step run:

| | |
|---|---|
| anchor position at release → after 25 s | `top = 287` → `top = 287` |
| min / max across 257 samples | **287 / 287** |
| **drift** | **0 px** |
| app-initiated `scrollIntoView` calls since release | **0** |

The `↓ Jump to live` chip appeared on the wheel-up, and the run finished underneath without moving
the reader.

⚠ **The measurement method is part of the closure, because the first two readings said FAILED.**
They tracked `scrollTop`, which showed a 1,039 px "drag" that was not real — message rows grow and
run cards collapse under the viewport, so `scrollTop` moves while the text on screen does not.
Instrumenting `Element.prototype.scrollIntoView` proved **zero app scrolls in either release
window**. ⛔ **A future re-check that measures `scrollTop` will "reproduce" a defect that is not
there. Measure a fixed anchor's `getBoundingClientRect().top`.**

⚠ **What was fixed is NOT what this report blamed** — see the 2026-09-11 correction above. The named
root cause was gone before the phase started; the residual found by the RED drive was a **< 120 px
nudge** that releases the pin while leaving the reader near-bottom, re-pinned by any scroll in the
gap between the 900 ms hard clock and the 1500 ms gesture window. Plus `243-06` HI-2: a **click**
inside the transcript re-armed it, which this phase made routine by putting a `<button>` on every
assistant row.

⚠ **Honest limit:** one real-wheel drive, one provider, one gesture shape. Strong evidence, not proof.
**Re-open on any sighting of the reader being moved during a live run.**
