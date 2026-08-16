---
id: BUG-260816-05
title: The canvas run surface PAINTS a waiting human step but hosts no way to answer it — the responder is mounted only in WorkspacePanel
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [frontend/workflow-run-surface, frontend/panel, human-in-the-loop]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-148, SEED-167]
re_open_trigger: "Phase 198 / NODE-02 — its requirement text already says `llm_human_input` already exists — establish what it does and does not cover BEFORE building a form node. THIS REPORT IS PART OF THAT ESTABLISHING WORK and must be read at `/gsd:discuss-phase 198`. ⚠ ALSO re-open at Phase 195 / RUN-02 if that phase mounts anything run-scoped on `WorkflowRunPage.tsx`: the output-file mount and the ask responder are the same missing-surface class, and a phase already opening that file should be asked whether it takes both. Independently: the first operator report of a run appearing STUCK on the canvas — the waiting state is paint-only, so a run parked on an approval looks identical to a hung one from that surface."
reproduces_on:
  branch: develop
  commit: 25104616
  date: 2026-08-16
---

# BUG-260816-05: The canvas run surface cannot answer a human-in-the-loop step

## What we observed

> "before running the workflow I assume that the ask user is not available in the canvas that's why I have to
> open it in the chat. Please confirm and if this is the case also this is a gap … overall in the canvas when
> I run a workflow I should be able to … watch it and see in the future files it produced, the human in the
> loop, the everything completely it should be functional in the canvas"
> — operator, 2026-08-16, during Phase 194.1 UAT

**Confirmed by measurement, and the shape is sharper than "not available":**

1. `WorkflowRunPage.tsx` **DOES** read pending asks — `useAskUserPrompt(run?.thread_id)` at `:451` — and
   **DOES** paint the waiting step, setting `pendingAsk: askToken` on the phase before computing its
   `CanvasReading` (`:643`). So the canvas correctly shows that a human is needed.
2. The responder — `PendingAskCard` / `PendingAskStack` — is mounted in **exactly one place in the entire
   application**: `WorkspacePanel.tsx:71`. A repo-wide search for the component returns no other production
   mount.
3. `POST /runs/{runId}/ask_user_response` has **exactly one caller**: `PendingAskCard.tsx`.

⇒ The canvas tells you a human is needed and then offers nowhere to be that human. The operator must leave for
the chat/panel surface to answer.

## Why it matters

**A surface that reports a blocking state it cannot clear is a dead end**, and it is the same failure class
Phase 194.1 exists to fix one layer up: 194.1's own `BUG-260816`-era finding was that `WorkflowRunPage.tsx`
had *no Stop control at all* (`grep → 0`) while showing a run in progress. Stop is now mounted there. The ask
responder is the identical hole, unfixed.

⚠ **It is also indistinguishable from a hang.** From the canvas, a run parked on an approval and a run that has
died look the same — the step sits, nothing advances. The operator's only recovery instinct from that surface
is the Stop button 194.1 just added, i.e. **the surface actively encourages killing a healthy run.**

The operator's stated bar is broader than this one control, and it is recorded verbatim above: watch the run,
see the files it produced, answer the human step — *"everything completely it should be functional in the
canvas."* Today the canvas is a **viewer, not a place work can be finished**:

| capability | canvas run surface | chat + panel |
|---|---|---|
| watch step status | ✅ | ✅ |
| see that a human is needed | ✅ (paints it) | ✅ |
| **answer** the human step | ❌ | ✅ |
| see produced output files | ❌ (→ RUN-02, phase 195) | ✅ |
| Stop the run | ✅ (new in 194.1) | ✅ |

## Hypothesized cause

Not a defect — an unbuilt mount. Hypothesis, not finding: `PendingAskStack` may be close to portable, since it
takes the asks it renders and `WorkflowRunPage` already holds them (`asks`, plus `reconcileAsks`). ⚠ **What is
NOT known and must not be assumed** is whether the card depends on panel-scoped context (layout width, the
panel's own reconcile lifecycle, the chat↔panel seam). `WorkflowRunPage.tsx` carries a comment at `:437-445`
recording that `reconcilePhases` hardcodes `pendingAsk: null` and that the page composes the waiting state
itself from a separate `PendingAsk[]` feed — *"No new endpoint is owed."* That is evidence the data half is
solved and only the render/submit half is missing, but it is not proof.

## Surface classification

`Agentic-RAG` — this app. Routing candidate at the four GSD touchpoints.

## Fit against the current milestone (v3.7) — assessed, and PARTLY absorbable

| half of the complaint | home | status |
|---|---|---|
| **no produced files on the run surface** | **RUN-02 / RUN-03, phase 195 — ALREADY IN THIS MILESTONE** | ✅ absorbed; see the note added to `SEED-148` |
| **cannot answer the human step** | **NODE-02, phase 198** — whose requirement explicitly demands establishing what `llm_human_input` does and does not cover *before* building a form node | ✅ routed as establishing evidence |

⚠ **The file half is not a new requirement — it is RUN-02 restated by an operator**, and RUN-02 is scoped as
*"shows that file to the user when the run finishes, **from the run surface**."* This report is evidence the
requirement is correctly scoped and wanted; it should be read at `/gsd:discuss-phase 195`.

⚠ **Deliberately NOT absorbed into Phase 194.1.** Mounting a responder is new user-facing capability, and
CLAUDE.md **G-7** forbids a gap-closure round from adding one — *"that is a phase, not a gap."*
