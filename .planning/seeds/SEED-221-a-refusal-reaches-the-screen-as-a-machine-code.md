---
seed_id: SEED-221
title: "The describe door's refusal reaches a real screen as a MACHINE CODE — *\"Couldn't generate — connection_not_allowed\"*. One plan owns the code, another owns the page, neither owns the translation"
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, measured by plan `214-14`'s cross-plan seam audit (seam S-7) and recorded at the phase close
surface: Agentic-RAG
severity: major
category: frontend / refusal copy
priority: high
scope: >
  A wire code needs a human sentence at exactly one place. The seam is between the service that
  emits the code (`214-13`) and the page that renders whatever it receives (`214-04`); the fix is a
  translation table beside the existing door vocabulary, not a change to either side's contract.
affected_areas: [frontend/workflows, backend/workflows, workflows/describe-door]
related_seeds: [SEED-208, SEED-218]
related_bugs: [BUG-260815-06]
relates_to:
  - frontend/src/components/workflows/doorVocabulary.ts — where a refusal sentence belongs
  - frontend/src/pages/WorkflowBuilderPage.tsx — the page that renders the raw code
  - backend/app/services/workflow_authoring.py — where `connection_not_allowed` is emitted
  - backend/tests/integration/test_214_argument_seams.py — the seam test that PROVES it reaches a rendered screen
re_open_trigger: >
  ⚠ ALREADY TRUE AT PLANTING, and it is PROVEN by a passing test rather than argued: the seam
  suite asserts that the refusal reaches a rendered screen AND that the screen shows the RAW
  CODE. Re-open at whichever comes first: (1) the operator drives `214-UAT.md` G4-8; (2) any
  phase whose `files_modified` names `doorVocabulary.ts`, `workflow_authoring.py` or
  `WorkflowBuilderPage.tsx`; (3) ⚠ THE NEXT PHASE THAT FIRES `BUG-260815-06`'s TRIGGER — that
  bug is the same disease on the PUBLISH surface and has now been declined twice; a third
  sighting on a second surface is the signal that this is a class, not two incidents.

  Mechanical check that the gap is still real, from the repo root:
    grep -rn "connection_not_allowed" frontend/src --include=*.ts --include=*.tsx | grep -v "\.test\."
  If the only hits are pass-throughs and none is a translation, the gap is live.
trigger_when: unset
---

# SEED-221: a refusal that reaches the user as a machine code

## What was measured

`214-14`'s cross-plan seam audit drove seam S-7 with **neither side mocked** and recorded two
assertions in `backend/tests/integration/test_214_argument_seams.py`:

- `test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service`
- `test_S7_the_refusal_reaches_a_rendered_screen_and_the_screen_shows_the_RAW_CODE`

The second one is deliberately named for what it found. The author sees:

> Couldn't generate — `connection_not_allowed`

## Why it matters

⚠ **`214-13` owns the code and `214-04` owns the page, and neither owns the translation.** That is
precisely the cross-plan seam failure the 204 pre-flight recorded — both sides green, the join
unowned — and it is the second instance of it in this one phase (`SEED-218` is the first).

⚠ **It is the same disease as `BUG-260815-06`, one surface over.** That bug — *the publish gauntlet's
structural-gate refusal names nothing actionable* — has now been read, understood and **declined
twice** (Phase 197, then `D-214-13`). This seed is the evidence that it is a CLASS rather than an
incident: a refusal path that computes a precise machine reason and shows it verbatim. The next phase
that fires `BUG-260815-06`'s trigger should weigh both together.

## Why Phase 214 did not fix it

It surfaced in wave 5's seam audit, after both owning plans had merged. Adding a translation is small,
but it is a copy decision on a refusal surface, and a fix authored in response to a finding needs its
own UAT row — which this phase cannot supply, since its own G-4 drive is still owed.
