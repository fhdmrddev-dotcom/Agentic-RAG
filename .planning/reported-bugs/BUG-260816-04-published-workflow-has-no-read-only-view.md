---
id: BUG-260816-04
title: A published workflow cannot be opened or inspected — `▶ Run` is the only way to learn what it does
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [frontend/workflows-library, workflow-authoring, IA]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-155]
re_open_trigger: "Any phase touching the workflows LIBRARY surface (`WorkflowsPage.tsx` or `components/workflows/library/*`) — the card's action contract is where this lives, and a phase already in that file should settle it rather than a dedicated one. ⚠ The deferred library-layout sketch (G-2 fires) named in SEED-155 is the natural home: a read affordance is a layout decision before it is a code decision. ALSO re-open on the second operator request to see inside a published workflow, or the first request from a NON-author user (a shared/global workflow's consumer has no authoring context at all and is the worst-served case)."
reproduces_on:
  branch: develop
  commit: 25104616
  date: 2026-08-16
---

# BUG-260816-04: A published workflow cannot be opened or inspected

## What we observed

> "the issue is that I cannot see for the published workflows I cannot open them to see what is inside and
> this is I think a gap I only have one action which is run that's it"
> — operator, 2026-08-16, during Phase 194.1 UAT

The operator needed to know which published workflow contained a human-approval step, in order to drive a UAT
row. There is no way to answer that from the UI. It was answered by querying Postgres directly.

**This is by construction, not a regression.** `WorkflowCard.tsx`'s own docblock states the action contract:

| row state | primary | secondary |
|---|---|---|
| runnable (published or starter) | `▶ Run` | the fork verb · Delete workflow… |
| draft ("Still building") | `✎ Open` | Delete |

`✎ Open` is draft-only. `onOpen` is documented as *"Open a draft in the Builder (edit-in-place; saves PATCH
the same row)"* — it is an EDIT door, and there is no read door beside it.

⚠ **There are two indirect paths, and stating them is what makes this a gap rather than a blocker:**
1. **Fork it** into a draft and open that — works, but mutates the library with a copy the operator did not
   want, and the copy is not the thing that runs.
2. **Run it** and read the phase chips in the workspace panel's `THIS WORKFLOW` section — i.e. you must
   execute a workflow to discover what it does.

## Why it matters

Published is the state you most want to inspect *before* committing to a run, and it is the only state you
cannot inspect. The asymmetry is backwards: a draft — the thing that cannot be run and whose contents you
already know because you just wrote it — is the only one that opens.

Three concrete costs:
- **Pre-run judgement is impossible.** A workflow may search a folder, call a model N times, or perform an
  armed external action. Today the only way to find out is to start it.
- **Non-author consumers are worst served.** A `is_system_global` / shared workflow reaches users who never
  authored it and have no other source of truth about its steps. This is the B2B case the product targets.
- **It blocked a UAT row in this very session** — the operator could not select a test fixture without
  developer database access, which is not a workflow real users have.

## Hypothesized cause

Not a defect — an unbuilt affordance. Phase 192's D-01 split the library seam **by SURVIVAL** (runnable vs
draft) and assigned exactly one primary verb per row state. That is a coherent design; it simply has no third
state for *"look, don't touch"*. Hypothesis, not finding: a read-only Builder mount is likely cheap, because
the Builder already renders a definition it did not author (the fork path proves the renderer is not
edit-coupled), but **this has NOT been verified** and the read-only enforcement surface (no PATCH, no publish,
no save) is the part that would need real design.

## Surface classification

`Agentic-RAG` — this app, our code, our IA decision. Routing candidate at the four GSD touchpoints.

## Fit against the current milestone (v3.7) — assessed, not assumed

**No natural home in phases 195-198.** 195 is RUN-02/RUN-03 (produced files), 196 is AUTH-04 (model picker),
197 is AUTH-02 (guided authoring), 198 is NODE-01/NODE-02 (node vocabulary). None owns the library card's
action contract. ⚠ **Deliberately NOT absorbed into Phase 194.1**: 194.1 is a stop-visibility phase, this is a
new user-facing capability, and CLAUDE.md **G-7** forbids a gap-closure round from introducing one — *"that is
a phase, not a gap."* Deferred with the trigger above rather than squeezed in.
