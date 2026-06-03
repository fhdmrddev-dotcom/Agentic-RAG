---
sketch: 012
name: workflows-page
question: "Where do you browse + launch a workflow, and how does Run hand off into a chat thread?"
winner: "A"
tags: [page, launcher, nav, library, handoff, phase-094]
---

# Sketch 012: Workflows Page (library + launcher)

## Design Question
The composer's workflow-picker dropdown leaves (011). Workflows get a **first-class page** in the
nav (like Skills): browse the available workflows, see what each does, and **Run** — which hands off
into a chat thread. Build NOW (renders existing `workflow_definitions` via `GET /workflows/published`
— no new backend). The NL builder ("Build new") is designed in 013, built in v2.9.

## How to View
open .planning/sketches/012-workflows-page/index.html

**Flow cycler** (bottom-right): `1 · Browse → 2 · Launch dialog → 3 · In thread`. Or just click a
**Run** button to walk the real path. Variants = page layout (top tabs).

## The launch handoff (the key flow — same in every variant)
**Run → launch dialog** (collects the kickoff prompt + KB folder scope) → **creates a NEW chat
thread**, sets `active_workflow_run_id`, and **redirects you into that thread** with the workflow
already streaming in the panel (step 3). Workflows are **a mode of a thread, never page-resident** —
the page only *launches*; execution always lives in a thread (reuses the existing run/stream/lock/
resume plumbing). Lowest-cost backend path reuses `POST /threads/{id}/messages` with the
`workflow_definition_id` attached (a thin `POST /workflows/{id}/run` is a cleaner future option).

## Variants (page layout)
- **A: Card grid ★** — all workflows as cards with their full phase chain visible at a glance, +
  a dashed "Build a workflow" card (→ 013, v2.9). Most scannable for a small library; matches the
  Skills-page feel the operator asked for.
- **B: Master-detail** — list on the left, selected workflow's detail (locked phase sequence,
  inputs, Run) on the right. Better when the library is large; hides phase chains until selected.
- **C: Compact list** — full-width rows that expand inline to show phases. Dense; good for many
  workflows, less visual.

## What to Look For
- The **Run → land-in-thread** handoff (flow step 3): does it read clearly that you've been
  redirected into a normal chat thread with the workflow streaming, *not* running on the page?
- Real content: the 4 seed workflows with their actual phase types + tool whitelists + the input
  each collects (`topics`, `your question`, `the task`).
- The "Build a workflow" entry point that hands off to the 013 NL builder (v2.9) — present so the
  page is coherent, clearly marked as next-milestone.

## Consistency note (operator, 2026-06-04)
012 contributes **only the page** (library + launch dialog). The thread you Run *into* renders the
**already-chosen** designs — **008-D** (timeline) · **009-C** (chat seam) · **011-A** (composer) —
NOT a new design. The flow step 3 ("In thread") was upgraded to show those real designs (with a
label) so the handoff is visually consistent, not a throwaway mini-view.

## Recommendation
**A (card grid).** For a small library (4 seeds + a few authored), seeing every workflow's phase
chain at a glance is the most legible, and it matches the Skills-page pattern the operator wanted.
B/C earn their keep only once the library is large — at which point A can gain search/filter rather
than switch layouts. The launch handoff (the part that matters most) is identical across all three.
