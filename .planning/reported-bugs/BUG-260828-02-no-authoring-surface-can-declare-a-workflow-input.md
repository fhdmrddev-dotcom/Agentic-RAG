---
id: BUG-260828-02
title: Nothing can declare a workflow input, so "Asked when this runs" is a dead end for every author
surface: Agentic-RAG
severity: blocking
status: closed
folded_into: 214.1
verified_closed_by: 214.1 # ✅ operator-driven 2026-08-28 18:00 — run inputs carried {topic:"test", to:"fhdmrd@gmail.com"} from a library launch
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas:
  - frontend/src/components/workflows/builderStore.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/lib/api/workflows.ts
  - backend/app/services/workflow_authoring.py
  - backend/app/services/harness/reachability.py
re_open_trigger: n/a — open
relates_to:
  - BUG-260826-01 (this is its ROOT CAUSE; -01 cannot close while this is open)
  - SEED-217 (an upstream argument source is inert on native capability rows)
---

# The three halves work and the fourth does not exist

Phase 214 shipped the publish gate, the launch forms and the run wire. It did **not** ship the one
authoring surface that makes any of them reachable.

| Piece | State | Built by |
|---|---|---|
| Publish refuses an undeclared launch argument | ✅ works | 214-05 |
| Launch forms render DECLARED inputs | ✅ works | 214-09 / 214-12 |
| The run carries inputs through to the step | ✅ works | 214-16 |
| **Anything that CREATES a declared input** | ⛔ **does not exist** | — |

## What the operator hit

Set `to` on a `send_email` step to **"Asked when this runs"**, then pressed Publish. The gauntlet
refused, correctly:

> `phase 'act': the required argument 'to' is asked for at launch, but the workflow declares no
> matching input`

That refusal is right. But there is no surface anywhere that can declare the input it asks for, so
the author is stuck in a loop with no exit. The only way to send an email today is to hardcode the
recipient with **"Set here"** — which is exactly the state `BUG-260826-01` describes.

## ⚠ CORRECTION 2026-08-28 (Phase 214.1 planning) — one claim below is a TRUE GREP with a
## POSSIBLY FALSE CONCLUSION

*"`lib/api/workflows.ts` never sends `inputs`: zero occurrences"* is literally true and may still
be the wrong inference. `updateWorkflowDraft` sends `JSON.stringify(def)` with **no field
whitelist**, and `useDraftPersistence.ts:619` hands it `selectDefinition(snapshot)` whole — so
`inputs` present on `meta` would ship ALREADY, without the symbol ever appearing in that file.

The grep proved the absence of a NAME, not the absence of a BEHAVIOUR. Phase 214.1-01 treats it as
diagnose-then-act with a driven assertion on the parsed request body, and forbids inventing a field
whitelist that would defend nothing.

**The headline claim is unaffected**: nothing can CREATE a declared input, which is what makes
*Asked when this runs* a dead end. Only that one bullet's conclusion is in question.

## Measured, not inferred (2026-08-28)

- `frontend/src/components/workflows/builderStore.ts` has **no action** that writes
  `definition.inputs[]`. The builder's only two references —
  `PhaseFormPanel.tsx:293` and `WorkflowBuilderPage.tsx:1112` — are **read-only comments**.
- `frontend/src/lib/api/workflows.ts` **never sends** `inputs` on save: zero occurrences.
- `backend/app/services/workflow_authoring.py` **never emits** `inputs`: zero occurrences, so the
  AI describe door cannot produce one either.
- Both completed drive runs recorded `workflow_runs.inputs = {"kickoff_prompt": ""}` — the reserved
  key that `RESERVED_RUN_INPUT_KEYS` strips, and nothing else.
- Of 293 rows in `workflow_definitions`, the only published workflow with an external step carries
  `inputs: null` and hardcoded `tool_args`.

## Why it survived the phase

Every automated check passed, because **each half is correct in isolation**. The gate has tests, the
forms have tests, the wire has an integration test that reads the row back out of Postgres. What no
test asserted is that an author can *reach* the state those tests set up by hand — the fixtures
construct `definition.inputs[]` directly.

⚠ This is the reachability lesson Phase 118 recorded and Phase 214 re-learned one surface over: a
capability that only fixtures can construct is not shipped.

## Classification

**A MISSING CAPABILITY, not a defect in shipped code.** Under G-7 that makes it a new phase, never a
gap-closure round on 214.

## What closing it requires

1. An authoring surface for `definition.inputs[]` — name, label, required, and the type the launch
   forms already know how to render.
2. The save path actually sending it (`lib/api/workflows.ts`).
3. The describe door emitting it when it drafts a step whose argument is asked at launch.
4. A reachability test that starts from an EMPTY builder and ends at a published workflow whose
   `inputs[]` is non-empty — mocking neither the store nor the API.
