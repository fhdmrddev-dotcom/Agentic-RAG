---
id: BUG-261015-01
title: A validated emit failure writes N+1 chat messages that disagree on the attempt total
reported: 2026-10-15
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/harness, chat]
folded_into: "295"
verified_closed_by: "295"
related_seeds: []
re_open_trigger: null
fixed_by_commit: "b23554309 (fix(295-04): one failure, one message, D-23 claim_failure_message); 295-VERIFICATION RUN-04; closed by the 296-05 record flip"
reproduces_on:
  branch: develop
  commit: bdb4247f5
  date: 2026-10-15
---

# BUG-261015-01: A validated emit failure writes N+1 chat messages with different attempt totals

Source: Phase 281 code review, `281-REVIEW.md` **WR-04**. The operator deferred it at the review
triage (2026-10-15) because it changes chat-history behaviour, so it is not a review fix.

## What happens

- For an emit step with a declared validator, every engine attempt runs the executor, and every
  executor failure calls `_surface_failure_message` (`phase_types.py:1651, 1741, 1764`), which inserts
  an assistant message.
- The engine's `fail_run` branch (`harness_engine.py:2473`) then inserts one more with `outcome.reason`.
- For the golden-run shape the thread reads `This step failed after 3 attempts:` three times, then
  `This step failed after 9 attempts:` — two totals for one failure, in the surface D-04 says carries
  one string.
- Before 281 the messages repeated but carried no total, so they did not visibly disagree. 281's
  composed cause made the repetition contradictory.
- `_surfaced` (the single-writer flag) guards only the success surface (`harness_engine.py:437`).

## Suggested fix (from the review)

Suppress the executor's per-invocation surface while the engine will still retry or route (a ctx flag
set in `_run_phase_with_gates` while `attempt < phase_max_retries`, read by `_surface_failure_message`),
so the engine's final message is the only one and equals the gauntlet's cause. Needs a test that counts
the thread's assistant rows for one failed run (expect 1).

## Phase 295 record (295-07, 2026-10-21)

Addressed by 295-04 (D-23: `claim_failure_message` / `surface_unless_engine_owns`; one failed validated emit writes ONE message, driven through the real loop in `test_295_truthful_run_ends.py`). Not driven live by 295-07 (no emit-failure plant). Not closed (verifier's call).
