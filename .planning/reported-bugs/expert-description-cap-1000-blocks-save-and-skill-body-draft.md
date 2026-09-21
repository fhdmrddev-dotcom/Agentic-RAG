---
id: BUG-260921-02
title: The drafter emits a ~4.8k-char blueprint into two fields capped at 1000, so a drafted Expert can neither be saved nor have its proposals drafted
reported: 2026-09-21
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [backend/experts, frontend/experts, expert-authoring, PACK-14, PACK-15, PACK-16]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-303]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 795884b68d3ca467040baa1061fdd72fbe6c2bbe
  date: 2026-09-21
---

# BUG-260921-02: a 1000-char cap that the app's own drafter overshoots by 4.8x

## What we observed

Driven live during Phase 263's G-4 UAT (rows R-1/R-3/R-6), main tree at `795884b68`, local stack.

1. Organization admin -> Experts -> Author New Expert. Brainstorm prompt describing a doctoral
   systematic-literature-review expert. `Generate Candidate Draft`.
2. The draft is GOOD (R-1 passes): it names six real domain skills and writes a detailed blueprint.
   **The blueprint it wrote into `description` is 4,833 characters.**
3. Click `Create this skill ->` on any proposal. `POST /experts/draft-skill-body` returns **422**:

   ```
   {"type":"string_too_long","loc":["body","expert_description"],
    "msg":"String should have at most 1000 characters"}
   ```

   The dialog never opens. The proposal cannot be approved. Clicked four times, four 422s.
4. The SAME value also breaks the save path. Direct `POST /experts` with that description:

   ```
   422 {"type":"string_too_long","loc":["body","description"],
        "msg":"String should have at most 1000 characters"}
   ```

   It fails validation BEFORE the PACK-16 unknown-skills check is ever reached.

Caps, measured in source:
  `backend/app/models/expert.py:45`  SkillBodyDraftRequest.expert_description  max_length=1000
  `backend/app/models/expert.py:55`  ExpertBundleCreate.description            max_length=1000
No truncation exists on the client: `ExpertAuthoringStudio.tsx:332` and `:430` send `description` verbatim.

## Why it matters

**The app's own AI drafter produces an Expert that the app then refuses to save.** This is the
default path, not an edge case — it fired on the first fresh Expert authored. PACK-15's
"approve one proposal at a time" moment is unreachable for any realistically-detailed blueprint,
and PACK-14's whole point is that blueprints ARE detailed.

Both surfaces that consume the field cap it at 1000 while the producer has no cap at all.

## Hypothesized cause

The caps were sized against the thin drafts that existed earlier. The two saved Experts in the
local DB have descriptions of 129 and 35 chars, which is why nothing caught it.

⭐ The codebase ALREADY KNEW the producer was unbounded. `backend/app/services/expert_authoring.py:51`
says, in a comment: *"identical prompt, `description` came back 293 chars on one run and 2163 on
another"*. That observation was recorded and never connected to the two `max_length=1000` consumers.

## Why every gate stayed green

- Backend tests build `SkillBodyDraftRequest` with short fixture strings.
- Frontend tests mock `@/lib/api/experts`, so no payload ever reaches a Pydantic model.
- Nothing in either suite asserts that the DRAFTER's output satisfies the CONSUMER's constraints.

This is a cross-plan SEAM defect: 263-02 owns the producer, 263-03 owns the consumer, and each is
internally correct. No single plan's tests could see it.

## Secondary finding (same repro)

The 422 IS surfaced — `[data-testid="proposal-error"]` renders — but the text is the raw Pydantic
string *"String should have at most 1000 characters"*: no field name, no indication that the
blueprint is the problem, no suggested action. At 11px destructive it reads as noise.

## Suggested fix

Raise both caps to match what the producer actually emits (~8000 gives real headroom over the 4,833
measured and the 2,163 the comment records), OR bound the producer and truncate at the client with a
visible notice. Add a fence that asserts the drafter's output satisfies the consumer's model —
the absence of that assertion is the actual hole.
