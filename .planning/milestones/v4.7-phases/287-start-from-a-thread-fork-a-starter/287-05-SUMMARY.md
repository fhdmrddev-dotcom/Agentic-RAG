---
phase: 287-start-from-a-thread-fork-a-starter
plan: 05
subsystem: live-proof
tags: [g-4, sc5, uat, live-gauntlet]
requirements: [START-01, START-03]
key-files:
  created:
    - .planning/phases/287-start-from-a-thread-fork-a-starter/287-VALIDATION.md
    - .planning/phases/287-start-from-a-thread-fork-a-starter/287-UAT.md
  modified:
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
completed: 2026-10-19
status: human_needed
---

# Phase 287 Plan 05: Live proof

Driven in a real browser (claude-in-chrome) as the operator against the already-running backend, with SQL reads as evidence. Status `human_needed`: two roster rows blocked by provider billing, everything else observed.

## Verdicts
- G-4 scenario 1 (in-thread start): PASS. Threads 1173 -> 1173, run attached to the open thread, title unchanged.
- G-4 scenario 2 (empty required field): in-thread form PASS; library RunModal FAILED then fixed (below), re-driven PASS.
- G-4 scenario 3 (fork, edit, reshelf, second fork): PASS, starter md5 identical, second fork free of the first's edit.
- SC#5: 6 of 8 roster rows PASS on the two-tool prompt; Anthropic and OpenRouter BLOCKED (billing banner, no credit). Parallel-thread PASS, long-message (6 KB) PASS.
- SC#3 live half: all 3 new starters passed the real publish gauntlet (golden run + judge) as KB-bound forks.

## The defect the drive found (and the fix)
`RunModal.tsx:471` hid the block containing the required-field refusal when the workflow did not admit a template, so Run on an empty required field did nothing and said nothing (the 287-01 tests used an `llm_emit` fixture and could not see it). Fixed with one condition (`|| requiredRefusal`) plus a regression test that is RED without the fix; `RunModal.test.tsx` 56/56 green. This exceeds nothing in the "<= 10 lines" allowance (1 source line, 1 test case) but is a source change in a "no source changes" plan, so the orchestrator should accept or revert it. Commit `f96ed449b`.

## Cleanup
Fixture workflow, 2 test forks, 2 golden-run forks, 17 threads, 8 runs, 16 phases and 33 messages deleted; operator counts back to 1172 / 272 / 3016; starter unchanged.

## Not done / owed
Anthropic + OpenRouter rows; cloud migration 210; 50-message long-thread variant. See 287-UAT.md.

## Deviations
- One source fix in a verification plan (above), allowed by the brief's <= 10-line exception.
- Parallel and long-message rows sent the picker's payload over the API rather than clicking the picker; the picker click path is covered by G-4 scenario 1.
- Gauntlet run on forks, not on the immutable global starters.
