---
seed_id: SEED-219
title: "`stepIdentityVocabulary`'s six PAUSE sentences are consumed by NOTHING — `PendingAskCard` still renders `Needs you`"
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, measured by plan `214-11` (`ASK_PAUSED` count 0 in `PendingAskCard.tsx`) and recorded at the phase close
surface: Agentic-RAG
severity: minor
category: frontend / vocabulary reachability
priority: medium
scope: >
  One import and one render decision. The sentences exist, are pinned by a gated suite
  (`stepIdentityVocabulary.test.ts`, 34 cases) and are correct; the card that should say them
  says `Needs you` instead.
affected_areas: [frontend/panel, workflows/approval]
related_seeds: [SEED-206]
related_bugs: []
relates_to:
  - frontend/src/components/workflows/stepIdentityVocabulary.ts — the six ASK_PAUSED sentences
  - frontend/src/components/panel/PendingAskCard.tsx — the surface that should consume them
re_open_trigger: >
  ⚠ ALREADY TRUE AT PLANTING. Re-open at whichever comes first: (1) the operator drives
  `214-UAT.md` G4-6 and reads `Needs you` where a sentence naming the service was expected;
  (2) any phase whose `files_modified` names `PendingAskCard.tsx` or `stepIdentityVocabulary.ts`;
  (3) any phase that adds a SEVENTH pause sentence — writing more copy for a consumer that does
  not exist is the thing to stop.

  Mechanical check that the gap is still real, from the repo root:
    grep -c "ASK_PAUSED" frontend/src/components/panel/PendingAskCard.tsx
  A count of 0 means the gap is live.
trigger_when: unset
---

# SEED-219: a shipped pause vocabulary with no consumer

## What was measured

`214-11` shipped the step identity across five run surfaces and, while doing so, measured that
`stepIdentityVocabulary.ts`'s six `ASK_PAUSED` sentences are imported by **nothing**:
`grep -c "ASK_PAUSED" frontend/src/components/panel/PendingAskCard.tsx` returns **0**, and the card
still renders the generic `Needs you`.

The vocabulary is correct, gated and pinned at 34 cases. It is simply not reachable from the product.

## Why it matters

⚠ **This is Phase 213's failure shape exactly** — *"the whole ask/refusal vocabulary shipped consumed
by nothing"*, every gate green, the feature inert. Phase 213 closed once at `93fc2f521` in that state
and a driven check found it afterwards. **The only difference here is that it was caught at the close
by an author who went looking, rather than by the operator.** That is not a structural improvement; it
is the same defect with a luckier discovery path.

⚠ **A pinned suite is not evidence of reachability.** `stepIdentityVocabulary.test.ts` is green, in
`TARGETS` and in `BASELINE`, and it asserts the sentences are correct — which is a different claim
from *anyone can read them*.

## Why Phase 214 did not fix it

`214-11`'s scope was the identity (mark + action name) on the run surfaces; the pause SENTENCE is a
different string on a card the plan mounted the identity onto but did not re-word. Changing what the
approval card says is a copy decision on a governance surface, which belongs to an operator, not to a
closing plan.
