---
phase: 302-close-out-and-a-true-register
plan: 02
subsystem: harness, provider-gateway, chat, workflows
tags: [backend, harness, provider-gateway, moonshot, frontend, a11y, review-findings]
requires: []
provides:
  - "async live_connectors_fully_on() — one liveness predicate for the executor and the judge"
  - "bounded Moonshot $ref unrolling (typed leaf, _MAX_DEPTH = 8)"
  - "in-thread start 409 worded by cause (locked by code / paused by prefix / refused by sentence)"
affects: [302-03 (SEED-391 flip, count-gate pins, ledger refresh)]
tech-stack:
  added: []
  patterns: ["code stamped on a provider-constructed error, never prose matching", "?raw cross-pin of a wire prefix"]
key-files:
  created:
    - backend/app/services/harness/live_connectors.py
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/provider_gateway/schema_moonshot.py
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/useStartWorkflowInThread.ts
    - frontend/src/components/chat/composerCopy.ts
    - frontend/src/components/chat/ThreadWorkflowPicker.tsx
    - frontend/src/components/workflows/DescribeTemplateRow.tsx
    - frontend/src/components/workflows/TeamPicture.tsx
    - frontend/src/components/workflows/teamVocabulary.ts
decisions:
  - "live_connectors_fully_on takes optional fresh/audience callables so phase_types passes its OWN namespace names (the kill-switch drives monkeypatch phase_types.ensure_settings_fresh / feature_audience)"
  - "a 409 with no code and no paused prefix but a non-empty sentence is 'refused' (server sentence); an empty 409 is 'failed'"
metrics:
  completed: 2026-10-30
  tasks: 3
---

# Phase 302 Plan 02: the six SEED-391 review findings Summary

The judge now checks whether connectors are live the same way the executor does, after the same freshness refresh. The publish practice run no longer makes up example answers for inputs it never asks for. A recursive connector tool schema no longer breaks a Moonshot request. An in-thread start refused with a 409 now gives the real reason. A disabled Word-blank tick tells screen readers why it can't be ticked. The Team view's scroll area and its picture now have different names. Each fix had a test that failed first.

## Finding → RED → fix (for 302-03 to record in SEED-391)

| Finding | RED commit | Fix commit | Disposition |
|---|---|---|---|
| BE-IN-01 (judge vs executor liveness) | 968d0b84d | a1e542833 (+ 1afa59462 import line, 93441397c test_196 control) | fixed |
| BE-IN-03 (stand-in for unasked inputs) | 968d0b84d | a1e542833 | fixed |
| BE-IN-04 (Moonshot recursive $ref) | 968d0b84d | a1e542833 | fixed (unit-tested only; live Moonshot row still ⛔, account suspended) |
| FE-IN-01 (every 409 read as "locked") | f9d06ab3c | 49a3a00c1 | fixed |
| FE-IN-04 (disabled tick, no reason) | a0f831efa | 09d642707 | fixed |
| FE-IN-06 (region and figure same name) | a0f831efa | 09d642707 (+ 09960aa0d 296 pin) | fixed |

None was accepted. All six were real at the base cf5a463d4.

## Grown test files (printed counts, for 302-03's pins)

Frontend (vitest JSON, all passing):
- `src/components/chat/__tests__/useStartWorkflowInThread.test.tsx`: 30
- `src/components/chat/__tests__/ThreadWorkflowPicker.test.tsx`: 18
- `src/__tests__/providers/streamsProvider.test.tsx`: 47 (count unchanged; 2 assertions added inside Test 3 / 3b)
- `src/components/workflows/DescribeTemplateRow.test.tsx`: 156
- `src/components/workflows/TeamPicture.test.tsx`: 44
- `src/components/workflows/teamVocabulary.test.ts`: 16
- `src/components/workflows/__tests__/teamAndVocab296.test.ts`: 16 (count unchanged; pin rewritten)

Backend (pytest collect):
- `tests/unit/test_296_judge_note_and_tasks.py`: 11
- `tests/unit/test_296_golden_inputs_and_lint.py`: 9
- `tests/unit/test_296_moonshot_schema.py`: 14
- `tests/unit/test_196_judge_model_db_backed.py`: 9 (count unchanged)

## Deviations from Plan

1. **[Rule 3 - Blocking] The executor call passes its own namespace names.** At least ten suites (`test_189_no_egress`, `test_190_*`, `test_213_*`, and others) stub `phase_types.ensure_settings_fresh` / `phase_types.feature_audience` with `monkeypatch.setattr`, as the CR-02 note at that import block requires. A bare `await live_connectors_fully_on()` would have bypassed every one of those stubs. So the predicate takes optional `fresh=` / `audience=` callables, and phase_types calls `await live_connectors_fully_on(fresh=ensure_settings_fresh, audience=feature_audience)`. The logic still lives in one place. The plan's literal grep `await live_connectors_fully_on()` therefore counts 0 in phase_types (the call has arguments). The non-comment `feature_audience(_LIVE_CONNECTORS_FEATURE)` count is 0 as required. The 87 executor-namespace tests pass.
2. **[Rule 1] The 190 import-graph fence pins a line number.** `test_190_connector_source_fence` pins the registry import at `phase_types.py:121`. The new import was moved below that line (1afa59462), so the fence stays green with no change to it.
3. **[Rule 1] The 196 precedence control.** `test_consumer_4_precedence_config_model_wins_and_db_not_consulted` asserted that the judge reads no settings at all. Under D-27 the judge now awaits the TTL-checked freshness read on purpose. The control now stubs `ensure_settings_fresh` (93441397c) and keeps its model-resolver assertion.
4. **[Rule 1] Old fakes for the lock.** The 296-04 test fakes built a plain 409 to stand for the lock. They now carry `code: "workflow_locked"` by default, which is the real provider's shape. The 298-02 case "a 409 is unchanged" became "a 409 is never a folder refusal" and now expects `refused`.
5. **[Rule 1] The TeamPicture empty arm draws no figure.** The plan said "populated and empty arms". The empty arm has a named region but no `<figure>`, so its test asserts the region name and no figure. The 296-07 pin in `teamAndVocab296.test.ts`, which pinned the region to `teamFigureLabel`, was rewritten (09960aa0d).
6. **W2 extra, done as instructed:** the real provider's lock arm is asserted in `streamsProvider.test.tsx` Test 3 (`code === "workflow_locked"`) and Test 3b (a non-lock 409 has no such code). Both were RED before the stamp (f9d06ab3c).

## Verification

- The three backend suites pass, plus the 87 executor-namespace tests and the 1741-test targeted set. That set has one failure, `test_forced_emit.py::test_forced_emit_judge_verdict_unmocked`, which also fails with the base sources checked out, so it was there before this plan.
- The six Task 2 frontend suites pass (141 tests), the three backend `?raw` fences pass (318), and the whole `src/components/workflows/` folder passes once the 296 pin was rewritten.
- `npx tsc -p tsconfig.app.json --noEmit` shows no errors in any frontend file this plan touched.
- StreamsProvider diff: 2 lines added, 2 removed; `workflow_locked` appears once.
- Backend baseline gate: see the self-check.

## Threat Flags

None. T-302-05..09 are mitigated as planned: depth cap plus cycle cut, a warning that names only the tool and definitions, the server sentence shown as React text, one fail-closed predicate, and the lock told by a code.

## Self-Check: PASSED

- Backend baseline gate at 93441397c: **70 failed, 10739 passed, 2 xfailed, 2 xpassed, 0 errors**. That is at or under the ceiling of 71. The first run, before the 190 import-line and 196 control fixes, read 74.
- All 11 commits exist (968d0b84d, a1e542833, f9d06ab3c, 49a3a00c1, a0f831efa, 09d642707, 09960aa0d, 1afa59462, 93441397c, plus this SUMMARY commit). `live_connectors.py` exists.
