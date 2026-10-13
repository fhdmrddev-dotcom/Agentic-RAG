---
phase: 279-the-expert-scope-seam
plan: 02
status: in-progress
---

# Phase 279 Plan 02: SEED-328 backend fixes — IN PROGRESS

Start state: branch `develop`, HEAD `10596004b` (279-01 complete; move commit `fa164ef3e`). Main working tree (no worktree bootstrap needed).

## Commit log

| Letter | Item | Commit SHA | RED test (node id) + RED line | GREEN result |
|---|---|---|---|---|
| A | CR-03(b) + IN-01 + D-05 + D-18 — `_require_thread_org` at PATCH / handoff / preview / send | `d55e0ef6a` | `test_279_org_helper.py` with the markers removed: `9 failed, 3 passed`. Send refusals: `Failed: DID NOT RAISE <class 'fastapi.exceptions.HTTPException'>`. Preview: `AssertionError: describe_expert_scope must not run` | `12 passed` (test_279_org_helper). 18 door-calling unit suites: `7 failed, 280 passed`, and all 7 failures are in `279-base-failed.txt` (test_061_consumer ×1, test_explorer_agent ×6). Greps: `_require_thread_org(` = 5, the pinned sentences = 2, the inline compares = 0 |
| B | WR-01 — refuse a handoff while the answer is streaming | `60ec3b3ae` | `test_267_handoff.py::test_WR01_a_handoff_while_the_answer_is_streaming_is_refused_before_any_read_or_write`: `AssertionError: assert 502 == 409`. Before the fix the route ran on to the summary; the 502 comes from the emit mock | `test_267_handoff` + `test_279_org_helper`: `38 passed`. `test_267_binding_gate`: `19 passed`. The new case also asserts that no messages are read, emit is not awaited and `txn.entered == 0` |
