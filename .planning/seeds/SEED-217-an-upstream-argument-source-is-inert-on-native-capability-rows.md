---
id: SEED-217
title: An `upstream` argument source is INERT on native capability rows — `send_email`'s `subject` sourced from an earlier step is silently DROPPED, and `body` falls back to the LATEST phase's text
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, measured by plan `214-06` while wiring the approval pause; deliberately NOT fixed inside the phase
surface: Agentic-RAG
severity: major
category: harness / argument resolution
priority: high
scope: >
  The fix lives in `backend/app/services/harness/phase_types.py`, on the NATIVE capability arm
  only. The MCP arm and the shared leaf (`backend/app/services/connectors/args.py`) are correct;
  what is missing is the native arm honouring a per-argument `upstream(<phase>)` source instead
  of falling through to its legacy "latest phase's text goes in `body`" behaviour.
affected_areas: [backend/harness, backend/connectors, workflows/steps]
related_seeds: [SEED-164, SEED-214]
related_bugs: [BUG-260826-01]
relates_to:
  - backend/app/services/harness/phase_types.py — the native capability arm
  - backend/app/services/connectors/args.py — the shared argument leaf (214-01), which is correct
  - .planning/phases/214-a-step-names-its-service-and-its-action/214-06-SUMMARY.md
re_open_trigger: >
  ⚠ THE FIRST TRIGGER IS ALREADY TRUE AT PLANTING, AND IT IS A ROADMAP SUCCESS CRITERION.
  Phase 214's SC#2 asks that a step's arguments actually reach the adapter from every launch
  path; a `subject` sourced `upstream(draft)` on a NATIVE `send_email` row does not, and it
  fails SILENTLY — the step runs, the mail sends, and the subject is simply not the one the
  author chose. Re-open at whichever comes first: (1) the operator drives `214-UAT.md` G4-2 /
  G4-3 with a non-`body` argument sourced from an earlier step and sees the drop; (2) any phase
  that touches `phase_types.py`'s native capability arm; (3) the next phase that claims SC#2 is
  met — this seed is the standing reason that claim needs a driven check, not a green suite.

  Mechanical check that the gap is still real, from the repo root:
    grep -n "upstream" backend/app/services/harness/phase_types.py
  If the native arm still has no per-argument `upstream` read, the gap is live.
---

# SEED-217: an `upstream` argument source is inert on native capability rows

## What was measured

Plan `214-06` wired the approval pause to name its service and list every argument that leaves.
While doing so it measured that the **native capability arm** of `phase_types.py` does not honour
a per-argument `upstream(<phase>)` source at all:

- `send_email`'s `subject` sourced `upstream(draft)` is **silently DROPPED**.
- `body` does not read the named phase either — it falls back to the **latest** phase's text.

The MCP arm and the shared argument leaf `214-01` created are both correct. This is one arm.

## Why it matters

**It fails silently and plausibly.** The step runs. The mail sends. The subject is just not the one
the author picked, and the body may come from a phase the author did not name. There is no error,
no refusal and no receipt that disagrees — which is the same shape as `BUG-260826-01`, the
milestone's blocking defect, one layer down.

⚠ **It directly threatens SC#2.** Phase 214's own success criterion is that a step's arguments reach
the adapter from every launch path. They do — for the `here` and `ask` sources. The `upstream` source
is the third arm of a three-arm picker the phase shipped, and on native rows it is decorative.

## Why Phase 214 did not fix it

It was found in wave 3, inside a plan whose subject was the approval pause, on a file
(`phase_types.py`) that fires G-5 and whose extraction obligation is already OWED. Fixing a
resolution arm there is a behaviour change with its own threat surface, not a gap-closure —
G-7's "a closure round may NEVER introduce a new user-facing capability" applies by analogy.

## What the fix looks like

The native arm reads the same `arg_sources` map the MCP arm and the leaf already read, resolves
`upstream(<phase_id>)` against the named phase's output rather than the latest one, and refuses
(rather than falls back) when the named phase does not exist — because a fallback is exactly what
made this invisible.
