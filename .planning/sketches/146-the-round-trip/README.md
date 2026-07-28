---
sketch: 146
name: the-round-trip
question: "How do you get from the canvas into a human review and back out again — for every kind of output, and when things go wrong?"
winner: null
tags: [phase-185, govern-03, round-trip, canvas-to-review, output-types, docx-not-previewable, ask-user-timeout, failure-modes, phase-188-input, g2-sketch-gate]
---

# Sketch 146: The round trip

## What it answers

Operator, 2026-07-28:

> *"How is this coming from the actual canvas — does it open separately, then when I take an action does
> it return to the canvas and continue? I want the linkages, the views, the switches, the different types
> of outputs, whether they render correctly, and everything that could go wrong."*

Three controls, driven live: **where the run is** (building → running → paused → after), **what it
produced** (six output types), and **what went wrong** (four real failure modes).

## How to View

```
open .planning/sketches/146-the-round-trip/index.html
```

## The variants — where does the canvas sit in the journey?

- **A: One place. The canvas you built on is the canvas you watch.** Launching takes you nowhere; the
  same flow lights up as it runs. A pause grows the document *over* the canvas, which stays visible
  behind it. Approve and it closes — you are already where the run continues. No "where did it go"
  moment; the cost is one canvas carrying two jobs.
- **B: Two places. Build here, run there.** The canvas is design-time; launching moves you to a run view
  with its own step list and a *← back to the canvas* switch. Each surface does one job. The cost is a
  hand-off, and every return trip is a decision about where you land.

---

# ⚠ Two engine truths found while drawing this — both falsify sketch 145

These were found by reading shipped code, not assumed. Each is a **Phase-185 scope item**, and each is
drawn in-surface in red rather than quietly fixed.

## 1. The approval gate does not hold. It expires into "yes".

`_exec_llm_human_input` (`backend/app/services/harness/phase_types.py`) blocks on
`subscribe_for_response(redis, run_id, tool_call_id, float(timeout_seconds))` where `timeout_seconds =
min(phase.config.timeout_seconds, settings.ask_user_max_timeout_seconds)` — **default 300 seconds**, hard
cap 1800.

On timeout the helper returns `None`, `answer` becomes `""`, and **the phase returns normally**:

```python
return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}
```

A normal return means the workflow **advances**. In this flow the next step is the email.

**Sketch 145 claimed *"Not yet holds — the run waits until someone decides; it does not quietly time out
and send."* That is false against the shipped engine.** An approval that expires into a send is not an
approval.

**Consequence for Phase 185.** GOVERN-03 says the action-risk checkpoint is "built on the existing
`llm_human_input` phase-type substrate". It may reuse the *substrate* — the durable prompt row, the
`tool_call_id`, the resume sweep — but it **must not inherit the timeout disposition**. An action-risk
gate has to **fail closed**: no answer means it never proceeds, however long that takes. That is an
engine change and belongs in the phase scope, not in UAT.

## 2. The flagship deliverable is the one artefact that cannot be previewed.

`FilePreview.tsx` routes by mime/extension:

| Output | Renders inline today |
|---|---|
| Markdown | ✅ `MarkdownRenderer` |
| Plain text | ✅ `<pre>` |
| Code | ✅ `ShikiCode` |
| CSV | ✅ `CsvTablePreview` |
| Image / chart | ✅ `<img>` |
| **DOCX / PPTX / XLSX** | ❌ download-only fallback |
| **PDF** | ❌ download-only fallback |

And `llm_emit` + the `render_template` emitter (docxtpl, Phase 101) — the "attach a Word template, the AI
fills it" path — produces **`.docx`**.

So the single most important artefact a workflow makes is the one a reviewer **cannot see**. Sketch 145
drew a Word document rendering beautifully in-app; that was aspirational, not shipped.

**Consequence for Phase 185.** Either the review moment gains a docx→viewable conversion, or **every
template deliverable is approved blind** — which guts GOVERN-03. This is a fork the spec must take
deliberately. Cycle **It produced** through all six to see exactly where the wall is.

---

## The other failure modes it draws

- **You closed the tab.** The question is a durable row (`messages` + `tool_call_id`), so it survives and
  the boot-time resume sweep re-subscribes. **But the clock keeps running** — "it survives a refresh" and
  "it waits for you" are two different promises and only the first is true today.
- **Someone else approved it.** Workflows are org-shareable, so two people can sit on this screen. The
  buttons must disappear and name *who* decided and when, not fail silently on the second click. The
  co-editing guard is Phase 186; **this is its run-time twin and should be named there.**
- **You approved, then the next step failed.** The email went; the shared-drive step did not. Your
  approval is not undone by a later failure and **must never look like it was** — the canvas shows step 4
  approved and green, step 5 failed and red. And **retrying step 5 must not silently re-run step 4 and
  send a second email.**
- **The step produced no document at all.** It updated a record and moved on. An approval screen showing
  an empty frame would be worse than one that says so.

## What to Look For

1. **Walk *Where the run is* left to right.** Do you always know where you are and how to get back? Watch
   the "You are on…" line at the right of the ribbon change between A and B.
2. **Cycle *It produced*.** Which can you actually read? Note the one you cannot — and that it is the one
   the product is built around.
3. ***Went wrong → Nobody answered.*** Read what the engine does today.
4. ***Next step failed*** — after you already said yes. Does the canvas stay honest about what you did?
5. **In A, press *← back to the flow* without deciding.** Nothing was lost and nothing was decided. In B,
   the same press takes you somewhere else and the report is one click away again. Which do you want at
   5pm?

## Verification

Driven in Chrome DevTools at 1440×900 across **2 variants × 4 run states × 5 failure modes** (40
combinations) plus all 6 output types: 0 overlaps between the note cards, the approve dock and any step
card in any combination, and no horizontal scroll anywhere. The artefact matrix was asserted
programmatically — `docx` and `none` produce the honest block, `md`/`txt`/`csv`/`png` each produce their
own renderer. The approve → advance round trip was driven end to end (review → Sent → the ribbon moves to
*Running on* → step 4 green, step 5 continues). No console errors; inline JS passes `node --check`; zero
inline `on*` handlers.
