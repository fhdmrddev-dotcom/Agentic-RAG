---
phase: 243
kind: uat-results
driven: 2026-09-11
driver: claude (solo — OV-SOLO-01)
environment: "local dev — vite :5173, backend :8000, Supabase :54322, Redis :6379; deepseek / deepseek-v4-flash"
thread: "261d5f57-36fb-40ec-bb0b-1c72b7550350 — 'UAT 243 L-2 — long thread (seeded, deletable)'"
rows_driven: [L-2, L-3]
rows_partial: [L-1]
rows_owed: [L-4, L-5, L-6, M-1, P-1, G-1, N-1, N-2, N-3, N-4, cross-provider x8]
---

# Phase 243 — UAT results, driven in a real browser

⚠ **This is the first time a browser has been opened on this phase.** Everything before it was
mechanical: fences, gates, typechecks. Those are unchanged in value; **what follows is the other
kind of evidence.**

## Setup — and why a thread had to be built

`L-2` requires a **≥50-message** thread, because *"works on a short thread and fails on a long one"*
is a named ROADMAP failure mode. **No thread in the local database qualified** — the longest was
**29** messages (measured). So a dedicated thread was seeded: **60 messages**, titled
*"UAT 243 L-2 — long thread (seeded, deletable)"*, purely additive, no existing row touched.

At arming: `scrollTop = 10530`, **7,924 px of scrollback**, `dist = 0` (pinned to the live edge).

⚠ **Vite was serving the new code — verified, not assumed**, because `StreamsProvider.tsx` changed
heavily and HMR has served stale provider code on this project before:
`includes(kind)` ×2 (the MD-4 gates), `reasoningLastMs` ×4 (HI-1), `DELTA_COALESCE_MS` ×3.

---

## ✅ L-2 — PASSES. Scroll up mid-tool-call, stay put.

**Drive:** a five-step `execute_code` run on the 60-message thread. Nine seconds in, with a tool
live, a **real wheel-up** (6 ticks, injected through the browser's input pipeline — not a synthetic
`WheelEvent`). Then measured for ~25 s, through the rest of the run.

| | |
|---|---|
| Anchor at release | visible paragraph at viewport `top = 287` |
| Anchor after 25 s / 257 samples | `top = 287` |
| min / max across the window | **287 / 287** |
| **Drift** | **0 px** |
| `scrollIntoView` calls by the app since release | **0** |
| `scrollTop` then → now | `12950 → 12950` |

⭐ **The release itself was correct and visible:** the `↓ Jump to live` chip appeared on the wheel-up
(`18s · Step 5 · Streaming… · ↓ Jump to live`), and the run continued to completion underneath
without moving the reader a single pixel.

### ⚠⚠ I called this FAILED twice before it passed, and the reason is the finding

The first two measurements tracked **`scrollTop`** and showed the reader apparently dragged **1,039 px**
back to the live edge. That reading was **wrong**, and `scrollIntoView` instrumentation is what
proved it: wrapping `Element.prototype.scrollIntoView` and correlating call timestamps against the
chip-visible windows returned **zero app-initiated scrolls during either release window**.

⛔ **`scrollTop` is not the reader's position when content is mutating.** Message rows grow, run
cards collapse at terminal, and `scrollHeight` changes under the viewport — so `scrollTop` moves
while the text on screen does not. **The correct instrument is a fixed anchor element's
`getBoundingClientRect().top`**, which is what the passing measurement uses.

⭐ **This matters beyond L-2: a future re-run that measures `scrollTop` will "reproduce" a defect
that is not there.** Record the anchor method, not the number.

⚠ And the honest limit of this row: it is **one drive, on one provider, with one gesture shape.**
`BUG-260823-01`'s own history records two fixes that passed and later failed on a real mouse. One
green real-wheel sample is stronger than a synthetic fence — **it is not proof.**

---

## ✅ L-3 — PASSES. Reasoning on a reply that called no tools.

**Drive:** *"Do not use any tools at all. Just think it through and answer in prose: why does a rope
bridge sway more when people walk in step than out of step?"*

Confirmed at the database, not from the screen:

```
assistant  tools = 0   reasoning_chars = 645   content_chars = 2397
```

**The rendered surface shows a `▸ Thinking` fold sitting directly in the message body, above the
answer** — sketch 235's winner **B**, on the exact message shape that had **nowhere to put its
reasoning** before this phase. `105 of 340` reasoning-bearing rows (31%, measured at scoping) are
this shape. **CHAT-04 is live.**

### ⭐ And D-243-13 was observed working, in both directions

- Immediately after the stream: the trigger read **`Thought for 1 second`** — a **measured** span.
  ⛔ Under the sketch's `chars / 180` formula, 645 characters would have read **"Thought for 4
  seconds."** The label is a clock reading, not a function of string length.
- After a later re-render the same trigger read **`Thinking`** — **no duration.** That is the
  honesty rule doing exactly what it was built to do: **a message the client did not watch stream
  has no measured span and must not invent one.**

⚠ Whether the span *should* survive a re-render is a separate question and is **not** answered here.
It is recorded as an observation, not as a defect.

---

## ◐ L-1 — PARTIAL. No churn observed, but the instrument was wrong.

Across **799 samples** the watched trigger's label changed **once**. ⛔ **That does not score L-1**,
because the watcher used `querySelector` and therefore tracked the **first** trigger in the document
— a settled historical message — not the live one. **Reported as inconclusive rather than as a
pass.** The mechanical cadence evidence stands separately: 243-03 measured 60 deltas → 61
`scrollIntoView` calls before the coalescer and ≤14 after.

---

## ⛔ Owed — not driven

| Row | What it needs |
|---|---|
| **L-4** | navigate away mid-run, return without reloading |
| **L-5** | the fold opened at **33,713** chars and at **198** chars — the 170× spread |
| **L-6** | the shipped surface **beside `sketches/234-the-thinking-block/index.html`** — the G-2 acceptance bar, and the only row that can catch sketch-to-build drift |
| **M-1 / P-1 / G-1 / N-1..N-4** | multi-tool, parallel-thread, long-message, and the phase's own added rows |
| **Cross-provider ×8** | every row above ran on **deepseek only**. Reasoning is a provider-shaped feature; seven native providers plus OpenRouter are untested here |

⚠ **One provider is not a cross-provider scoreboard.** `SC#10`'s roster is unmet, and saying so is
the point of the rule.

## Cleanup owed

The seeded thread is **deletable** and says so in its title:
`261d5f57-36fb-40ec-bb0b-1c72b7550350`. It also now carries five real runs' worth of genuine
transcript, which makes it a useful fixture for L-1/L-5 — **left in place deliberately**, to be
removed when the remaining rows are done.
