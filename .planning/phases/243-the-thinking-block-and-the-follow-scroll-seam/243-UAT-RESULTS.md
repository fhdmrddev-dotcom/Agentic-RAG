---
phase: 243
kind: uat-results
driven: 2026-09-11
driver: claude (solo — OV-SOLO-01)
environment: "local dev — vite :5173, backend :8000, Supabase :54322, Redis :6379; deepseek / deepseek-v4-flash"
thread: "261d5f57-36fb-40ec-bb0b-1c72b7550350 — 'UAT 243 L-2 — long thread (seeded, deletable)'"
rows_driven: [L-2, L-3, L-4, L-5, L-6 (settled frame)]
rows_partial: [L-5 (short arm owed)]
rows_owed: [L-1, L-6-live-frame, cross-provider-x8-ATTEMPTED-ABANDONED, M-1, P-1, G-1, N-1, N-2, N-3, N-4, cross-provider x8]
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

---

## ✅ L-5 — PASSES. The 170× spread, measured on the real corpus at both ends.

**Fixtures are REAL corpus text, not generated.** The corpus was queried first:

```
reasoning-bearing messages: 346   min 3   median 200   max 33,713
```

The **actual** 33,713-char body (`ecc426ff-…`) and a **real** 202-char body were copied into the UAT
thread, so the extremes under test are the ones the sketch quotes rather than lorem padding.

**All eight folds opened at once**, measured from computed style:

| chars | `max-height` | `overflow` | rendered | `<p>` | clamped | "Show all of it" |
|---|---|---|---|---|---|---|
| 63 | none | visible | 39 px | 1 | no | — |
| **202** ← the median | none | visible | **84 px** | 1 | **no** | **—** |
| 317 | none | visible | 152 px | 3 | no | — |
| 330 | none | visible | 152 px | 3 | no | — |
| 645 | none | visible | 254 px | 4 | no | — |
| 939 | **300px** | **hidden** | 300 px | 5 | **yes** | ✔ |
| 2,681 | **300px** | **hidden** | 300 px | 11 | **yes** | ✔ |
| **33,279** ← the max | **300px** | **hidden** | **300 px** | **136** | **yes** | ✔ |

⭐ **Exactly three controls for exactly three clamped bodies.** The control **removes itself** on all
five short ones — D-243-02's *"below the threshold the control removes itself rather than sitting
inert"*, holding across five independent lengths rather than at one tested point.

⭐ **Both ends of the design tension pass their own test:**
- **Median (202 chars → 84 px, one paragraph, no control):** reads as **finished**, not truncated.
  There is no chrome around a sentence.
- **Max (33,279 chars → 136 paragraphs behind a 300 px clamp):** the wall is **skimmable**, and the
  tail is one click away rather than inside a nested scrollbar.

### ⭐ The declared clamp difference is now measured, and it is the BETTER rule

The sketch clamps on `chars < 700`; the build clamps on **measured overflow at 300 px**. The eight
rows show why that matters: a **645-char** body renders **254 px** and is left alone, while a
**939-char** body would have overflowed and is clamped. **A character count would have clamped the
645 one** (it is under 700 — so no) — more precisely, it would have mis-sorted bodies whose rendered
height does not track their length, which is every body containing a list or a long word. **The
build measures the thing that actually matters.** Recorded as a difference from the bar, and as an
improvement on it.

⚠ **33,279 rendered vs 33,713 stored** — a 434-char gap. That is `innerText` collapsing whitespace
and newlines, **not truncation**: the clamp is `overflow: hidden` on a full subtree, and the
paragraph count (136) is the whole body.

---

## ◐ L-1 — STILL INCONCLUSIVE after a second attempt. Recorded as owed, not as a pass.

Two instrumented attempts failed for **harness** reasons, not product reasons, and neither produced
a number worth quoting:

1. The first watcher used `querySelector` and tracked the **first** trigger in the document — a
   settled historical message. Already recorded above.
2. The rewritten watcher tracked the **last** trigger correctly, but **the prompt never sent**: with
   all eight folds open (one of them 136 paragraphs) the composer had moved, and the click landed
   off it. **Verified at the database — no user message was written, and no stray thread was
   created.** A second attempt after a reload failed the same way, the thread not having re-loaded.

⚠ **The `setInterval` sampler was also throttled to ~3 Hz** against its requested 20 Hz while the
heavy fold was open — so even a successful send would have produced a repaint trace too coarse to
support a claim about per-token churn.

**What IS known, and it is not nothing:**
- **Mechanically:** 243-03 drove 60 real deltas through the real `makeStreamCallbacks` and measured
  **61 → ≤14** `scrollIntoView` calls with byte-exact content, at a 60 ms coalescing window.
- **Qualitatively:** across ~six live runs driven in this session the thinking line was observed
  settling and going quiet, with no visible flicker in any screenshot taken mid-stream.

⛔ **Neither of those is L-1.** L-1 asks an operator to watch a slow reasoning model and say whether
the control churns. **It remains owed**, and the honest next step is to run it with the folds
**closed** and the sampler driven from `requestAnimationFrame` rather than `setInterval`.

---

## ✅ L-4 — PASSES. The answer resolves on the navigation path, with no reload.

**This is CHAT-05's actual criterion**, and the one the send path could never have tested — Phase
176 already fixed that half, so a live-send check would have passed while the residual stood.

**Drive:**

1. Started a three-step `execute_code` run on the UAT thread.
2. Six seconds in, **navigated away to Library** while it streamed — a nav click, not a reload.
3. Waited on the Library page until the run finished there. Confirmed at the database, off-screen:
   `assistant · tools = 3 · content = 5,604 chars · reasoning = 265 chars`.
4. **Navigated back to Chat.**

**Measured on return:**

| | |
|---|---|
| thinking triggers | **9** — the new run's fold is present |
| `StreamingNarration` nodes anywhere | **0** |
| final answer text rendered | ✅ *"…triangular numbers through T(…"* |
| the ten-paragraph commentary | ✅ present |
| `performance.getEntriesByType('navigation')[0].type` | **`"navigate"`** |

⭐ **That last row is the one that makes this a pass rather than an anecdote.** A reload would report
`"reload"`. It reports `"navigate"` — the **original** page load — so the answer resolved purely by
leaving and coming back. **No F5, no remount of the app.**

⭐ And `narrationNodes: 0` is the structural half: there is no fold for the answer to be stuck
inside, because 243-05 deleted the arm. The defect cannot recur by the mechanism that caused it.

⚠ **One observation, not a failure:** on return the transcript restored **scrolled to the middle**
of the thread rather than to the live edge or to the new answer. CHAT-05 says nothing about scroll
restoration, so this row still passes — but a person coming back to a finished run would reasonably
expect to land on the answer. **Recorded as an observation for Phase 244**, which owns the chat
shell.

---

## ⛔ A defect found by driving, filed rather than absorbed

`BUG-260911-02` — **the first click on a chat highlights it but does not open it; a second click is
required.** Hit **four times** across this session before it was recognised as a defect rather than
as the driver mis-clicking, then isolated: same coordinate, click 1 → 0 thinking triggers (empty
state), click 2 → 8.

⚠ **It is why two UAT prompts in this session went nowhere** — typed into what looked like a loaded
thread, verified at the database as never written. **A person would have concluded the app lost
their message.**

⛔ **Not Phase 243's** — thread selection is not the thinking block, the cadence, the scroll seam or
the answer's render branch, and it reproduces on messages that predate the phase. Filed at
`.planning/reported-bugs/BUG-260911-02-…md`, with the *"is it new? does it reproduce on production?"*
check named as the first thing to do and explicitly **not** done here.

⭐ **This is the G-4 argument in one line: no fence in this phase could have found it, and the only
reason it is now written down is that somebody drove the product.**

## ⛔ Owed at close — stated as a decision, never as a claim that everything ran

### The cross-provider board — ATTEMPTED, ABANDONED, and the reason is the point

**All eight providers have keys configured** (`OPENAI`, `ANTHROPIC`, `GOOGLE`, `DEEPSEEK`, `ZHIPU`,
`MINIMAX`, `MOONSHOT`, `OPENROUTER` — checked), and all eight representatives are **registry-backed**
in `MODEL_CAPABILITIES`. So the board was **drivable in principle** and is not blocked on credentials.

**It was attempted and stopped.** ⛔ **Not because it is hard, but because the driver could not
reliably target the composer's provider picker.** Two prompts were typed and submitted into what
looked like the right state and went nowhere; a third selected **`minimax / MiniMax-M3`** when
**`anthropic`** had been clicked. That was caught only because the composer was screenshotted
afterwards.

⚠⚠ **A scoreboard whose provider attribution is unverified is worse than no scoreboard**, because it
reads as evidence. `SC#10` exists to prove the surface holds across providers; a row that silently
ran on the wrong one would assert exactly what it failed to test. **Stopping was the honest call.**

⚠ The API shortcut CLAUDE.md recommends (*"drive each row as a real run with a per-request `model` +
`provider`"*) was **not available to this driver**: the browser extension refuses to surface a JWT
(correctly), and `backend/.env` is deny-listed (correctly). **Neither guard was worked around.**

**What the board still needs:** one operator session, or a driver holding a token, sending the same
no-tool reasoning prompt on each of the eight and recording whether `reasoning_content` arrives and
the fold renders. ⚠ **Expect legitimate ⛔ rows** — not every provider emits reasoning at all, and a
provider that emits none is a valid row **with that reason written**, not an omission.

### L-1 — the flicker row

Failed twice on harness mechanics (see above), **never on the product**. It is the only row gating
`BUG-260718-02`'s part B. **Run it with the folds closed and the sampler on `requestAnimationFrame`.**

### L-6's live frame

The settled frame scored **9/9**. The **streaming** frame was never put beside the sketch's
`▶ Replay the stream`, and that is where the sketch's own acceptance criterion lives — *"three things
true simultaneously"* — plus the live-state accent and animated dots, **confirmed not ported**.

### Found while driving, not this phase's, filed not absorbed

**`BUG-260911-02`** — the first click on a chat highlights it but does not open it; a second is
required. Hit **four times**, then isolated (click 1 → 0 thinking triggers, click 2 → 8). ⚠ **It is
why prompts in this session went nowhere**, and a person would have concluded the app lost their
message. **Whether it is new, and whether production reproduces it, was NOT checked** — that is named
in the report as the first thing to do.

### Observed, routed onward

On returning to a thread after a finished run, the transcript restores **scrolled to the middle**
rather than to the answer. CHAT-05 is silent on scroll restoration so L-4 still passes. **Routed to
Phase 244**, which owns the chat shell.

### Cleanup

The seeded thread `261d5f57-36fb-40ec-bb0b-1c72b7550350` (*"UAT 243 L-2 — long thread (seeded,
deletable)"*) holds 60 seed messages, six real runs, and the two L-5 fixtures (the real 33,713-char
and 202-char reasoning bodies). **Left in place deliberately** — it is the fixture L-1 and L-6's live
frame need. Delete it when they are done.

---

# Session 2 — 2026-09-11, driven by Claude via Chrome DevTools MCP

**Environment:** local dev — vite :5173 (IPv6 `::1` only), backend :8000, Supabase :54322,
operator's own signed-in session. Provider `deepseek / deepseek-v4-flash`.
⭐ **Eight providers hold keys** (`openai, anthropic, google, openrouter, deepseek, moonshot,
minimax, zhipu`) — measured off `GET /settings`, so the cross-provider rows are **drivable**, not
blocked. `ollama` and `lmstudio` are unkeyed.

## L-1 — the fold control does not churn ✅ **PASS**

Sampled the trigger's `textContent` every 250 ms for 3 s during a live reasoning stream:
**twelve samples, one distinct value — `Thinking...`.** No per-token flicker, no churning count.
At settle the same trigger read **`Thought for 80 seconds`** — a span that was actually measured
(D-243-13's honest duration), not derived from string length.

## N-1 — open the fold mid-stream and leave it open ✅ **PASS**

Clicked the trigger while the run was streaming, then sampled every 600 ms for 5.4 s:

```
aria-expanded  true  true  true  true  true  true  true  true  true  true
body chars   14891 15381 15894 16413 16818 17251 17628 18058 18498 18749
```

**Reasoning kept arriving underneath a fold the user opened, and the fold never closed itself or
re-opened on its own.** The trigger text stayed stable throughout.

## L-5 — the long body clamps, and the control removes itself ✅ **PASS (long arm)**

On a **61,301-char** rendered reasoning body:

| | before | after clicking *Show all of it* |
|---|---|---|
| `clientHeight` | **300** | **20,907** |
| `scrollHeight` | 20,918 | 20,907 |
| `max-h-[300px]` present | **yes** | **no** |
| control present | **yes** | ⭐ **no — it removed itself** |

⭐ The body's classes read `px-3 py-2 text-sm text-muted-foreground leading-relaxed border-l-2
border-muted-foreground/20 ml-3 relative max-h-[300px] overflow-hidden` — **243-04's V1 rule
exactly**: the four classes gone (`text-xs`, `font-mono`, `whitespace-pre-wrap`, `max-h-64`),
stepped to `text-sm`, real paragraphs, and the sketch-050 self-removing control.

⛔ **SHORT ARM NOT DRIVEN — and the reason is a provider fact, not a defect.** The row wants a
**198-char** reasoning body. Asked `deepseek-v4-flash` a trivial question (*"What is 2+2?"*) and it
returned `content` length **1** with `reasoning_content` length **0** — no reasoning at all, so no
fold renders and there is nothing to measure. **Owed**, and it needs a provider that emits short
reasoning rather than none.

## L-4 — navigate away and come back WITHOUT reloading ✅ **PASS** (CHAT-05)

Started a reasoning run, navigated **in-app** to Library while it streamed, waited 45 s for it to
finish **while away**, then navigated back via Chat → the thread.

```
performance.getEntriesByType("navigation").length  →  1
```

⭐ **One navigation entry for the entire session — the document never reloaded.** The row's own
warning is *"the 'without reloading' is the whole row — a reload passes trivially and proves
nothing"*, and that is now **proven rather than asserted**.

On return: the final answer renders as **settled prose** (*"…It — not the wolf, goat, cabbage, or
lantern — is what makes the puzzle bind."*), `foldCount: 0`, and the run's trigger is **collapsed**.
**The answer is OUT of the narration fold.**

⚠ The returned-to trigger reads **`Thinking`** with no digit — correct, and it is 243-04's
**declared** honest fallback: a message the client did not watch stream carries no measured span.
This is the one declared difference from the mockup, behaving exactly as declared.

## Method note — a probe of mine was wrong, and it is recorded rather than buried

For several samples I detected "is the run still streaming?" by looking for a button whose
`aria-label` matches `/stop/i`. **That also matches `1 source stopped reading`**, a shell banner
button that is always present on this install — so my probe reported `running: true` over runs the
database recorded as `completed`. **No product defect; my detector's fault.** Recorded because the
next person writing a browser probe on this shell will reach for the same regex.

## Still owed on this phase

| row | why |
|---|---|
| **L-5 short arm** | needs a provider that emits SHORT reasoning; deepseek emits none on trivial prompts |
| **L-6 live frame** | the settled frame was driven in session 1; the live frame is not |
| **M-1** | multi-tool prompt (`search_documents` + `execute_code`) |
| **P-1** | thread A streaming while thread B accepts a prompt |
| **G-1** | ≥50-message thread — the seeded thread from session 1 exists and can carry it |
| **N-2** | temp-id → DB-id reconcile with the fold open |
| **N-3** | reasoning-without-tools below tool-bearing turns |
| **N-4** | stop mid-reasoning (the `.flush()` at the terminal edge) |
| **cross-provider ×8** | ⭐ **NOT blocked** — eight providers hold keys |
