---
phase: 243
kind: uat-results
driven: 2026-09-11
driver: claude (solo — OV-SOLO-01)
environment: "local dev — vite :5173, backend :8000, Supabase :54322, Redis :6379; deepseek / deepseek-v4-flash"
thread: "261d5f57-36fb-40ec-bb0b-1c72b7550350 — 'UAT 243 L-2 — long thread (seeded, deletable)'"
rows_driven: [L-2, L-3, L-6 (settled frame)]
rows_partial: [L-1]
rows_owed: [L-4, L-5, L-6-live-frame, M-1, P-1, G-1, N-1, N-2, N-3, N-4, cross-provider x8]
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

---

## ◐ L-6 — the shipped surface beside `sketches/234/index.html`. **Body PASSES exactly. Order DIFFERS from the bar, and the difference was undeclared.**

**Method:** the sketch served over HTTP (`file://` is blocked to the driver) and the app opened in a
second tab. **Both surfaces measured from their own DOM**, not compared by eye off two screenshots.

### ✅ The body is an exact match to V1's diff table

Shipped, read from the live element's `className` and computed style:

```
px-3 py-2 text-sm text-muted-foreground leading-relaxed
border-l-2 border-muted-foreground/20 ml-3 relative
max-h-[300px] overflow-hidden
```

| V1 requires | Shipped | |
|---|---|---|
| drop `font-mono` | absent · computed `Inter, ui-sans-serif` | ✅ |
| drop `whitespace-pre-wrap` | absent · computed `white-space: normal` | ✅ |
| drop `max-h-64` | absent · replaced by the sketch's own `max-h-[300px]` | ✅ |
| drop `overflow-y-auto` | absent · `overflow: hidden` (the clamp) | ✅ |
| `text-xs` → `text-sm` | computed **14px** | ✅ |
| **keep** `border-l-2` | present · computed `1.6px` | ✅ |
| **keep** `ml-3` | present | ✅ |
| real paragraphs, not a blob | **11 `<p>` elements** | ✅ |
| clamp + a self-removing control | **"Show all of it"** present on the long body | ✅ |
| ⛔ no `count` on the trigger | trigger reads `Thinking`, **no digit** | ✅ |

⭐ **Nine of nine. The visual contract shipped exactly as drawn** — including the clamp height the
sketch specifies rather than a re-invented one.

### ⛔ THE FINDING: the two sketches contradict each other on ORDER, and the build followed the one that is *not* the bar

Measured from each DOM, same session:

| | thinking trigger | first tool row | verdict |
|---|---|---|---|
| **Sketch 234 V1** (the acceptance bar) | `top = 254` | `top = 188` | **TOOLS ABOVE THINKING** |
| **Shipped** | `top = 14100` | run card `top = 14233` | **THINKING ABOVE TOOLS** |

**They are opposite.**

- **Sketch 235's winner B** binds: *"thinking sits **above** the tool rows and the answer, matching
  the order in time"* — and `243-CONTEXT.md` **D-243-01** carried that rule into the build.
- **Sketch 234's V1 frame draws the reverse**, and **235's own README says**: *"Sketch 234's
  `index.html` is the G-2 acceptance bar for Phase 243, **not this one**."*

⇒ **The build is consistent with D-243-01 and inconsistent with the file that D-243-01's own phase
named as the bar.**

⚠ **This is not a defect in the code — it is an undeclared difference from the acceptance bar**, and
that is precisely the *named* failure mode: *"the sketch is approved and the build drifts from it,
and the phase closes against a description of the mockup rather than the mockup."* The phase
declared **two** differences (D-243-13's duration, and criterion 1's pre-sketch "timeline" wording).
**This is a third, and nobody wrote it down** — because everyone, including me, reasoned from
D-243-01's sentence rather than from the drawing.

⭐ **L-6 is the only row that could have caught it, and it did. That is the whole argument for the
row.**

### ⭐ RESOLVED FROM THE REGISTER — no operator call is needed, and my first framing was over-cautious

This was first written up as *"the operator's call"*. **That was wrong, and the answer was already
in the sketches.** Sketch 235's README, verbatim (`:79-80`):

> *"234 decides what the expanded surface **contains**, 235 decides **where it hangs**. They are one
> component in two questions."*

**Order IS placement, and placement is explicitly 235's question.** So:

- **The shipped order is CORRECT.** It follows the sketch that owns the question, via D-243-01.
- **234's V1 drawing is stale on a question it does not own.** Its authority is the expanded
  surface's *contents* — where it scores **nine of nine** above.

⚠ **The bar is therefore not "234's picture in every respect"** — it is *234 for contents, 235 for
placement*, and the phase satisfied both. **The difference is declared here rather than treated as
drift**, which is all that was ever owed.

⛔ **What IS still owed is an edit to sketch 234**, so the contradiction does not outlive this phase
and mislead the next reader: its V1 frame should carry a one-line note that placement was settled by
235 and that the frame's own tool/thinking order is superseded. **A drawing that disagrees with the
decision it helped produce is exactly the rot this project keeps paying for.**

~~### The operator's call, stated as a question rather than assumed~~

**Which order is right?** Both are defensible and the phase cannot settle it alone:

- **Thinking above** (shipped, 235-B): matches the order in time — the model thinks, then acts.
- **Tools above** (234-V1): the run's work reads first and the reasoning sits closer to the answer
  it produced.

⛔ **Not changed unilaterally.** `RunCard` and `MessageItem` both carry live G-5 obligations, and
re-ordering the message body is a visual decision with an operator-approved drawing on each side.
**Recorded here, routed to the operator.**

### Two differences the verifier flagged, re-checked here

| | |
|---|---|
| clamp threshold | shipped clamps on **measured overflow** (`max-h-[300px]` + `overflow-hidden`) rather than the sketch's `chars < 700`. **Behaviourally equivalent and arguably better** — it clamps what actually overflows rather than guessing from length. Still a difference; now declared. |
| live-state accent + animated dots | **not ported.** Confirmed absent. A live-state affordance the sketch draws and the build does not have. |

### What L-6 does NOT cover

The comparison ran on a **settled, historical** message. **The live/streaming frame was not compared
against the sketch's `▶ Replay the stream`** — which is where the accent and the dots live, and
where the sketch's own acceptance criterion (*"three things true simultaneously"*) is written.
**That half of L-6 is still owed.**

## ⛔ Owed — not driven

| Row | What it needs |
|---|---|
| **L-4** | navigate away mid-run, return without reloading |
| **L-5** | the fold opened at **33,713** chars and at **198** chars — the 170× spread |
| **L-6 (live frame)** | the settled frame is DONE above. The **streaming** frame vs the sketch's `▶ Replay the stream` is still owed — that is where the accent and the animated dots live |
| **M-1 / P-1 / G-1 / N-1..N-4** | multi-tool, parallel-thread, long-message, and the phase's own added rows |
| **Cross-provider ×8** | every row above ran on **deepseek only**. Reasoning is a provider-shaped feature; seven native providers plus OpenRouter are untested here |

⚠ **One provider is not a cross-provider scoreboard.** `SC#10`'s roster is unmet, and saying so is
the point of the rule.

## Cleanup owed

The seeded thread is **deletable** and says so in its title:
`261d5f57-36fb-40ec-bb0b-1c72b7550350`. It also now carries five real runs' worth of genuine
transcript, which makes it a useful fixture for L-1/L-5 — **left in place deliberately**, to be
removed when the remaining rows are done.
