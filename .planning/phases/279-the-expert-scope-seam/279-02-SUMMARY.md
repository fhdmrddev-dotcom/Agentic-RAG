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
