---
sketch: 152
name: the-runs-own-room
question: "You click Run. Where do you stand — and tomorrow, how do you find that run again and get the file it made?"
winner: "B"
tags: [phase-188, runviz-03, run-surface, workflow-vs-chat, launch-redirect, run-history, deliverable-reach, three-homes, d-14, g2-sketch-gate]
---

# Sketch 152: The run's own room

## Design Question

You click Run on a published workflow. **Where do you stand while it runs — and tomorrow,
how do you find that run again and get the file it produced?**

This is RUNVIZ-03, added to Phase 188 on 2026-07-31 from the operator call after Phase 185 UAT:

> *"a workflow that is RUNNING, and its output, should have their own place — not be dumped into chat."*

## How to View

```
open .planning/sketches/152-the-runs-own-room/index.html
```

Cycle the four **moments** in the bar — `▶ Just launched` · `⏸ Waiting for you` · `✓ Finished` ·
`🕐 Tomorrow — find it again` — inside each variant. The fourth is the one that separates them.

## Variants

- **A: One place** — the canvas you built on is the canvas you watch. Launching takes you nowhere;
  the workflow surface gains a `Watch` tab beside `Build`, and a `Runs` tab holds this workflow's history.
  Carries sketch 146-A ("one place") forward from Phase 185, where it was explicitly logged as a
  *proposal to Phase 188*, not a commitment.
- **B: The run has its own room** — a dedicated run surface with its own header, its own spine,
  **no message list and no composer**, plus a first-class `Runs` home listing every run across every
  workflow. This is the shape sketches 145 and 146 were both drawn on.
- **C: Un-redirect the thread** — the path of least resistance. The run stays thread-backed exactly as
  today; `doRun` simply loses its `onNavigate("chat")` and the canvas is what you see first, with the
  transcript collapsed behind a disclosure.

## ★ Winner: B — the run has its own room

**Operator, 2026-08-05.** A run becomes a thing with an address: its own header, its own spine,
**no message list and no composer**, plus a first-class `Runs` home listing every run across every
workflow. This is the shape sketches 145 and 146 were both already drawn on — 146-A logged it as a
*proposal to Phase 188*, and 188 is where it is now accepted.

**What B commits the plan to — stated plainly, because it is the largest bill in this phase:**

1. **Two net-new reads.** `GET /runs` (the home) and `GET /runs/{id}` (the surface). Neither exists;
   `runs.py` has only `/stream`, `/ask_user_response`, `/continue` and a `DELETE`.
2. **A fourth home in a three-homes contract.** `app-information-architecture.md` (#23-A) locks
   Builder / Workflows-page / Chat-thread, wired with **no router** — every redirect is a
   `useState<ActiveView>` switch. A Runs home extends that union; it must not smuggle in a router.
3. **The launch redirect goes.** `doRun`'s closing `selectThread(thread); onNavigate("chat")`
   (`ChatLayout.tsx:264-266`) is what SC#5 removes.
4. **Durations will be approximations until a column exists.** With no `started_at`/`completed_at`,
   every elapsed figure is `updated_at − claimed_at`. Either the table gains a column, or **the UI
   must not present the number as a runtime** — B's own cost note says so on screen.

**Not chosen, and why they stay on file:** **A (one place)** loads the canvas with a second job on top
of the two 185 and 189 already give it, and its `Runs` tab can only ever answer *"how has this workflow
behaved?"*, never *"what ran last night?"* — which is the question an operator actually asks.
**C (un-redirect the thread)** is free, and it remains the honest fallback if B's net-new wire cannot be
afforded; but it does not answer the operator's sentence, because tomorrow the run is still found by
scrolling chat history and a second run is a second identically-named thread.

**Both overridden positions are now spent, not merely noted:** SEED-051's *"NO separate execution
route"* and D-094-UNIFY's *"artefacts live in the chat-thread panel FILES section"*.

## What to Look For

1. **The `🕐 Tomorrow` moment is the whole sketch.** All three look similar while a run is live.
   Only the fourth moment shows what each one costs you a day later.
2. **Count the violet flags.** Violet = net-new wire that does not exist today. C has none. A has one.
   B has two, and needs both before anything renders.
3. **Where the deliverable sits** in each — and note that it says, in all three, that a `.docx`
   *cannot be previewed*. That is real: `FilePreview` routes DOCX/PPTX/XLSX/PDF to a download-only
   fallback, and `render_template` produces `.docx`. The flagship artefact is the one a reviewer cannot see.
4. **Whether the canvas can hold two jobs.** A gives it design-time editing *and* run-time watching.
   146-A named that cost; 188 and 189 both landing on the same surface is the reason B stays on file.

## Measured Facts Behind It

Every one of these was read from the tree on 2026-08-04, not inherited from a prior document.

| Fact | Source |
|---|---|
| `doRun` ends `selectThread(thread); onNavigate("chat")` — the redirect is three lines | `ChatLayout.tsx:264-266` |
| A run mints a **new thread every time**, so run history *is* chat history | `ChatLayout.tsx:236` (`createThread`) |
| **No `GET /runs`, no `GET /runs/{id}`** — only `/stream`, `/ask_user_response`, `/continue`, `DELETE` | `backend/app/api/runs.py` |
| A finished run's spine **is** already re-readable, but only thread-scoped — falls back to the latest `workflow_run` by `thread_id` | `threads.py:1189-1197` |
| `workflow_runs` has **no `started_at` / `completed_at`** — only `created_at`, `updated_at`, `claimed_at` | `full-schema.sql:1947-1962` |
| `workflow_runs.status` = `active｜paused｜cap_paused｜completed｜failed｜cancelled` | `full-schema.sql:1962` |

**The `started_at` correction matters.** Sketch 130-C's rule — *anchor the elapsed timer to `started_at`,
never to component mount* — is right in spirit and **wrong in field** for a workflow run: there is no such
column. Every clock in this sketch is labelled with what it is actually anchored to, because an unlabelled
clock that silently means "since queued" is a lie the moment a run waits in a queue.

## Positions This Overrides

Both carry dated notes in their seeds and must not be re-inherited unread:

- **SEED-051** — *"Execution = in a thread … NO separate execution route"* (superseded 2026-07-31).
- **D-094-UNIFY** — *"artefacts live in the chat-thread panel FILES section, NOT a separate place"*
  (re-opened, workflow-run-scoped).

## The Red Line

**D-14 forbids a second *runtime*, not a second *view*.** Every variant keeps the harness engine as the
only executor and keeps the run thread-backed via `threads.active_workflow_run_id`. What changes is where
a person stands and how a finished run plus its artefact are reached. Nothing here proposes a second executor.

## Glyph Audit (icon-convention §4)

Canvas marks used: **`⛨`** only — the governance seal, traced to `PhaseNodeCard.tsx:440`.
All other glyphs in this sketch (`▤ ⌗ 💬 ⚙ ▸ ›`) are page chrome — nav rail, file card, ribbon separators —
never canvas marks, and none is a phase-type glyph used as a category icon.
