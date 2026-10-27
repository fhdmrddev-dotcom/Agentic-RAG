---
phase: 288-drafts-that-survive-pauses-that-publish
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/app/services/harness/publish_service.py
  - backend/app/api/workflow_wire.py
  - backend/app/api/workflow_runs.py
  - backend/app/db/workflows.py
  - frontend/src/components/workflows/DraftArrivalCard.tsx
  - frontend/src/components/workflows/decisionsVocabulary.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/WaitingOnLine.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/lib/api/knowledge.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/landing/facts.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 288: Code Review Report

**Depth:** standard. Findings were driven by reading the call path. No tests were run and no source was edited.

## Summary

The new waiting_on, auto_answered and timeout-lint code is sound. I found no privacy leak, no cross-run or cross-user read, and no 500 path. The one real defect is wording. The paused-run sentence promises that the run continues when answered. The code on the answer path does not back that up, and the UI cannot answer a paused run at all.

Checked and found correct:
- `read_workflow_run` still selects with `.eq("user_id", current_user["id"])`. The viewer is therefore always the owner.
- `compose_waiting_on` only gives the email and prompt line to the owner. The non-owner arm is dead defensive code, not a leak.
- `_read_waiting_on` wraps everything, including `get_pg_pool`, in `try/except Exception` and returns None.
- `get_unanswered_ask_user` is run-scoped on both sides. The prompt row is matched by `tool_calls->0->>'run_id' = $1`, and the join to `workflow_runs` on `thread_id` is keyed by `wr.id = $1`. Ownership is the caller's id+user_id select. Terminal and golden runs short-circuit before the read.
- The pause arm of the engine (`harness_engine.py:2444`) does not expire the prompt. A paused run therefore still has an unanswered prompt, and the `window_passed` branch is reachable.
- Timeout lint boundaries are right. `0` and negatives fail, `1800` passes, `1801` fails. The ceiling is read from `settings.ask_user_max_timeout_seconds`.
- `auto_answered` is derived from persisted `_golden_run_mock` outputs, so a pause skipped via `skip_to_phase` is never claimed. `result` is passed to `PublishVerdict(**result)` at `api/workflows.py:61`.

## Critical Issues

### CR-01: Paused-run copy promises a resume that the engine path does not deliver, and the UI cannot trigger it

**File:** `backend/app/api/workflow_runs.py:789-791`. Related: `backend/app/api/runs.py:636-712` and `backend/app/services/harness/human_input.py:169-197`.

**Issue:** When `window_passed` is true the sentence reads "Still waiting on X; the run continues as soon as they answer." Two things make this untrue today.

1. Plan-04 F-3 (`288-04-SUMMARY.md:68`) reproduced it twice. Answering a paused run returns 200 and flips the run and phase to `active`, and the run never completes. I read the re-drive path and the cause is not fully pinned down. What I confirmed by reading:
   - `_redrive_paused_workflow_run` calls `resume_run(pool, run_id)` before the producer has done anything. The run reads `active` as soon as the answer lands.
   - The `_wake` task (`runs.py:657-664`) swallows any exception from `_resume_run` with `logger.exception`. It then finalizes only the producer shell. It does not flip the workflow run back to `paused` or `failed`. A re-drive that throws leaves the run and phase `active` with no producer until a restart sweep. That matches the 17-minute `active` observation.
   - The consume branch at `human_input.py:169` can only complete the phase if `get_ask_user_response(pool, run_id, tcid)` finds a non-expired response row. Otherwise it falls through to a fresh prompt, which is a second defect.
   - I did not find the exact failing line without logs. To close this out, grep the backend log for `ask_user_response: re-drive failed` and `ask_user_response: re-drive skipped`.
2. F-1: after the window, `PendingAskCard.tsx:576` shows "EXPIRED ... agent stopped" with no answer control. The sentence "continues as soon as they answer" therefore points at an action the UI does not offer. D-11 says to never say "expired" about a run that will resume, and the neighbouring card does exactly that.

**Fix:** Do not ship the promise until the path is fixed. Either of these:
- Soften the sentence to what is true now, for example "Still waiting on {who}.", and drop the continuation claim in `compose_waiting_on` and in `test_288_waiting_on.py`.
- Fix the engine path, which belongs in its own phase per the summary. In `_wake`, on exception call `pause_run` (or `fail_phase`/`finish_run`) so the run does not sit `active` with no producer. Add a driven test for answer-then-complete of a paused run.

## Warnings

### WR-01: Re-drive failure strands the run `active` (the defect behind CR-01)

**File:** `backend/app/api/runs.py:651-664`

**Issue:** `resume_run` flips `paused` to `active` before `_wake` runs. `_wake` has no compensating write on failure. Any failure leaves a run that reads `active`, with a phase that reads `active` and no producer. The new waiting-on line then keeps showing the "Waiting on X to answer" sentence, because the answer row now exists and `get_unanswered_ask_user` returns None. The run surface ends up showing nothing about why it is stuck.

**Fix:** In the `except` arm of `_wake`, write the run back to `paused` with `pause_run`, or fail it. Alternatively call `resume_run` only after `_build_resume_context` and the first phase write succeed.

### WR-02: Lint error text states a wrong ceiling when the setting is not a multiple of 60

**File:** `backend/app/services/harness/publish_service.py:1319-1332`

**Issue:** `minutes = max(1, ceiling // 60)` is the only number shown. A ceiling of 90 prints "1 minute", and a ceiling of 30 prints "1 minute" as well. This is operator-tunable (`ask_user_max_timeout_seconds`), so the message can state a limit the check does not enforce. At the default 1800 it is correct.

**Fix:** Say seconds when the ceiling is not a whole number of minutes, for example `f"{ceiling} seconds"` if `ceiling % 60`.

### WR-03: `isinstance(wait, int)` admits `bool`

**File:** `backend/app/services/harness/publish_service.py:1321`

**Issue:** `True` passes `isinstance(True, int)` and `0 < True <= ceiling`. The model field is a plain `int` with strict base, so this is unlikely. A bool-typed `timeout_seconds` would still publish as a 1-second wait.

**Fix:** `if isinstance(wait, bool) or not isinstance(wait, int) or wait <= 0 or wait > ceiling:`

### WR-04: Non-owner branch of `compose_waiting_on` is dead, and its tests cover a path production cannot reach

**File:** `backend/app/api/workflow_runs.py:766-790`

**Issue:** The run is selected `.eq("user_id", viewer)`, so `is_owner` is always true in production. The A-06 non-owner privacy guarantee is tested only on the pure function. It is not enforced by anything real. If the select is ever widened to org members or admins, the "(you)" suffix would be correct only because the guard on `owner_id` happens to work. A future widening would not notice that `display_name` is still read from the owner's profile with no check on the viewer.

**Fix:** Add a comment at the ownership select (`workflow_runs.py:~900`) that `waiting_on` assumes owner-only access, and add a test that fails if the select drops `.eq("user_id", ...)`. Otherwise treat the non-owner arm as defence in depth only.

## Info

### IN-01: `auto_answered` is an untyped `list` on the wire

**File:** `backend/app/api/workflow_wire.py:319`

**Issue:** `list` with no item type means the OpenAPI snapshot carries `items: {}`. The frontend type in `frontend/src/lib/api/knowledge.ts` relies on the `{phase, message}` convention. `named_failures` has the same shape and the same weakness.

**Fix:** `list[dict[str, str]]`, or a small `AutoAnsweredNote(BaseModel)`, then re-baseline the snapshot.

### IN-02: Builder comment claims no published-gate is needed for the settings row

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:~2174`

**Issue:** The comment asserts that a published workflow is never on this surface. It was not verified against any edit-a-published-workflow-as-new-draft path. If one exists, the "Draft settings" row will label a non-draft.

**Fix:** Confirm with the builder entry points, or gate on the draft status that `WorkflowBuilderPage` already holds.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
