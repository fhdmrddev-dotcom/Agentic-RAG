---
phase: 295-runs-that-don-t-dead-end
plan: 09
subsystem: harness engine ask, answer route, judge prompt
tags: [gap-closure, code-review, cr-01, wr-01, wr-02, wr-03, wr-05, wr-06, wr-07, bug-261021-01]
gap_closure: true
gap_closure_round: 1
requires:
  - "base bc4a31d54 (295-REVIEW.md: 1 critical, 7 warnings, 8 info)"
provides:
  - "CR-01: a harness answer must be for the run's current unanswered question (409 otherwise); a human step consumes only its own question's answer"
  - "WR-01: a sub-agent / provider error is an outage (fails with words), never 'found nothing'; no vendor text kept as a step's text"
  - "WR-02: the folder just searched is never re-offered"
  - "WR-03: a non-emit step routed by skip_to posts no new chat failure message"
  - "WR-05: the judge's design note is a system instruction; the graded data is fenced"
  - "WR-06: the 'Search another folder' list is narrowed to the run's org"
  - "WR-07: one pause write per engine ask, so a re-driven run is never flipped back to paused"
affects: [295 verification, BUG-261021-01, docs/HOT-FILE-LEDGER.md, CLAUDE.md]
tech-stack:
  added: []
  patterns:
    - "Every finding driven by a test committed BEFORE its fix (test(295-09) then fix(295-09))"
    - "Branches for hot files live in the leaf run_handoff.py; the hot files spend call lines"
key-files:
  created:
    - backend/tests/unit/test_295_09_review_fixes.py
  modified:
    - backend/app/api/runs.py
    - backend/app/db/workflows.py
    - backend/app/services/harness/human_input.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/engine_ask.py
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/harness/run_handoff.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/harness_engine.py
    - backend/tests/test_295_engine_ask_redrive.py
    - backend/tests/unit/test_295_judge_recorded_intent.py
    - .planning/reported-bugs/BUG-261021-01-kb-step-provider-error-offered-as-found-nothing.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "CR-01's human-step half keys on the joined prompt row (not an engine ask, and the same prompt words), because a human step's pause stores no tool_call_id on its phase row. The route's 409 is the primary guard; the human-step check is the second line"
  - "WR-01 marks the output with ONE optional key, sub_agent_status='error', and replaces the step's text with a fixed sentence when a sub-agent errored; the vendor message stays in the log and the sub-agent's runs.error. A non-KB step with an errored sub-agent still completes (pre-295 behaviour), now without the vendor text"
  - "WR-03 takes the reviewer's second option (surface only when the executor was actually silenced), because the existing D-23 tests model an emit with a programmatic stand-in; keying on phase_type == llm_emit would have broken them for no behavioural gain"
  - "WR-05's fence is keyed by a sha256 prefix of the data it encloses, so both judges compute it without passing a nonce, and the data cannot print its own real end line"
  - "WR-07 skips the pause arm's redundant write (a ctx mark set by engine_pause), rather than narrowing pause_run's SQL, so the human-step pause path is unchanged"
  - "IN-01..IN-08 not fixed, left in 295-REVIEW.md as recorded"
metrics:
  completed: 2026-10-21
  tasks: 7
  files: 15
---

# Phase 295 Plan 09: Review gap fix, round 1 (backend) Summary

The seven backend findings of `295-REVIEW.md` are fixed. Each was driven by a failing test committed before its fix, and every RED test failed for the reason the review gave. None was refuted. The tests are in `backend/tests/unit/test_295_09_review_fixes.py` (30 tests). Base: `bc4a31d54`.

## Findings

| Finding | Driven RED? | Result | RED commit | Fix commit |
|---|---|---|---|---|
| CR-01: an answer is not bound to the current question | Yes. The stale answer got 200 and re-drove the run. The human step completed with the engine ask's "Continue without sources". | Fixed | `ce87882d3` | `40b466e1b` |
| WR-01: a provider error is offered as "found nothing" | Yes. The run paused with the found-nothing choices. The output carried no error mark and the vendor text was kept as the step's text. | Fixed | `522e568c3` | `b48036bce` |
| WR-02: the folder just searched is offered again | Yes. The folder that came up empty was in the new list. | Fixed | `108d1835d` | `7a2745bb1` |
| WR-03: a non-emit `skip_to` posts a new chat failure message | Yes. One "Phase 1 (p0) gate failed …" message, where there were zero before 295. | Fixed | `3e8668fc4` | `667358056` |
| WR-05: the judge note sits in the untrusted graded content | Yes. The note was in the user turn and absent from the system prompt, and a forged heading counted twice. | Fixed | `1e4d45c32` | `77714a2ef` |
| WR-06: the folder list is not narrowed to the run's org | Yes. The pause passed no org (`org_id` None), and the list had no way to receive one. | Fixed | `233c4344a` | `c61972669` |
| WR-07: the second pause write can flip a re-driven run | Yes. The interleaving was reproduced through `run_workflow` with the real `engine_pause`: an answer in the gap ended `paused`. | Fixed | `22503e27a` | `ec0951f1e` |

IN-01 to IN-08 were not touched. They stay in `295-REVIEW.md` as recorded.

### What each fix does

- **CR-01.** For a harness answer, the answer route checks that the answer is for the run's newest unanswered prompt (`_is_current_question`, through the existing `get_unanswered_ask_user`). If it is not, the route returns 409 with "This question is no longer the one the run is waiting on." before it saves or re-drives anything. So a stale card or a replay cannot re-run the step, spend tokens, or bring back a third card. The human step now uses an answer only if that answer's prompt is not an engine ask and has the same words as its own prompt. Otherwise it asks its own question. To support this, `get_ask_user_response` returns two more keys: `prompt` and `engine_pause`.
- **WR-01.** When a sub-agent errors, the step's text is now a fixed sentence: "This step could not get an answer from its model, so it has no result." The output also carries `sub_agent_status: "error"`. The citations gate reads that mark as an outage ("the model call for this step failed — this is a service outage, not model non-compliance"), and so does `finding_from_output`. The run then fails through the existing D-06 route and offers no choices. The vendor message stays in the server log and in the sub-agent's own `runs.error`. A non-KB step whose sub-agent errors still completes, as it did before 295, but it no longer carries the vendor text.
- **WR-02.** `_searched_ids` now counts a folder chosen in an earlier answer as already searched.
- **WR-03.** The engine's `skip_to` arm and its completed-with-failure arm now post a message only when the executor actually stayed silent in that phase (`engine_silenced_failure_message`). Non-emit steps behave as they did before 295, and an emit step still gets exactly one message.
- **WR-05.** A new helper, `judge_system_prompt(output, ...)`, builds the judge's system prompt. For any output without `recorded_intent`, it returns `JUDGE_RUBRIC_CORE.format(...)` byte for byte. Otherwise it appends the design note, which names the fence and says that no text in the graded output is written by the server. The graded content now keeps only the recorded inputs, between `<<<RECORDED_ACTION tag>>>` and `<<<END RECORDED_ACTION tag>>>`. The tag is a sha256 prefix of the data inside the fence, so the data cannot print its own real end line. The in-run judge and the publish judge both use the helper.
- **WR-06.** `permitted_folder_options(..., org_id=)` now narrows the folder list with `restrict_org_ids={org}`. When the org is unknown it passes `set()`, so only the owner's own folders appear. The pause passes `ctx.org_id`.
- **WR-07.** `engine_pause` now records that it has already written the pause. The engine's pause arm skips its own `pause_run` when that mark is set. The audit row and the `run_paused` emit are unchanged, and a human-step pause still writes its own pause.

## Deviations from the brief

- **[Rule 1] Pinned tests re-pinned, with reasons:**
  - `tests/test_295_engine_ask_redrive.py`: the exact-shape pin of `get_ask_user_response` now includes the two new keys.
  - `tests/unit/test_295_judge_recorded_intent.py`: three tests now expect the note in the system prompt and the data inside the fence.
  - `tests/unit/test_256_finish_run_unchanged.py`: the `await finish_run(` line positions moved by +14, +3 and +76 lines. The call counts are unchanged and the calls themselves are byte for byte the same (`67dd49633`).
- **WR-03's fix uses the reviewer's second option.** The reviewer's first option was to set the flag only for `llm_emit`. That would have broken the existing D-23 tests, which use a programmatic executor to stand in for an emit, and it would have changed nothing a person can see.
- **BUG-261021-01** is now `status: folded`, `folded_into: "295"`, and has a dated fix note. It is not closed: closing it needs a live re-drive.

## Gates

- **Backend unit gate.** Both trees were run in the same environment. The local Supabase was not reachable, so tests that need the DB fail the same way in both trees.
  - Base `bc4a31d54`: **70 failed**, 8638 passed, 1 skipped, 2 xfailed, 2 xpassed.
  - First HEAD run: 71 failed. Diff of the failing-ID sets: exactly one new ID, `test_256_finish_run_unchanged::test_the_finish_run_call_site_set_is_unchanged`. It failed only because call-site positions moved, and it was re-pinned. No base failure was fixed.
  - Final HEAD (`67dd49633`): **70 failed**, 8668 passed, 1 skipped, 2 xfailed, 2 xpassed. The failing-ID set is **identical to base**, with zero new and zero fixed. The 30 new passes are this round's tests. This is within the 71 ceiling.
- **Named suites.** All `test_295_*`, `test_256_*` and `test_281_*` unit suites, `tests/test_295_engine_ask_redrive.py`, `tests/test_182_grounding_bundle.py`, the armed suites (185 / 187 / 214 / `ask_user_disposition`), and the judge, publish and security suites all pass. One test fails, `tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added` (25 ≠ 24). It also fails at base, so it is inherited.
- **Ledger and size gates.** `check-hot-file-ledger.cjs` reports OK (621 rows, 44 watched files). `check-claude-md-size.cjs` reports OK (97,490 chars). Every hot file touched had its scan-list row, its section and (where one exists) its CLAUDE.md row updated in the same commit as its code.
- **OpenAPI.** No route or response model changed (the 409 is an `HTTPException`), so no regeneration was needed.
- **graphify.** `graphify update .` was not run, because `graphify-out/` is tracked and outside this brief. It is owed after merge.

## What a live re-drive must check after merge

1. **CR-01.** Pause a KB step on an empty folder (card T1). Answer "Search another folder" with another empty folder, so card T2 appears. Then post an answer for T1 again, for example from a second tab. Expect a 409 with the plain sentence, no new step run, no new card, and only T2 live in `/pending`. Then answer T2 and check that it resumes.
2. **WR-01 / BUG-261021-01.** Run a KB step on a provider with no credit or a bad key. Expect the run to end failed with the outage sentence, no found-nothing card, the step's text to be the fixed sentence, and no vendor message on the step, the evidence page or the export. Close the bug only after this passes.
3. **WR-02.** Answer "Search another folder" with an empty folder. Check that the new card does not list that folder.
4. **WR-06.** As the two-org dev account, start an org-A run on an empty folder. Check that the folder list has no folder from the other org.
5. **WR-03.** Run a non-emit KB step whose validator routes `skip_to`. Expect no "gate failed" chat message, and the run to continue.
6. **WR-05.** Publish the DMT-shape workflow. The judge should still pass it, now with the note in the system prompt. Check the LangSmith trace for the system and user split.
7. **WR-07.** This is hard to time live. The unit test reproduces the interleaving. Spot-check that a paused run reads `paused` and an answered one reads `active` (or done).

## Self-Check

## Self-Check: PASSED

- All 15 commits exist, `ce87882d3` through `67dd49633`. Every finding has a `test(295-09)` commit followed by a `fix(295-09)` commit.
- `backend/tests/unit/test_295_09_review_fixes.py` exists and has 30 tests.
- No file was deleted since base.
