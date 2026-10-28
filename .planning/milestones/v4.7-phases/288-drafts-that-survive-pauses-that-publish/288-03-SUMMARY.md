---
phase: 288-drafts-that-survive-pauses-that-publish
plan: 03
subsystem: workflow-run-surface
tags: [auth-01, waiting-on, run-read]
requires: []
provides:
  - "WorkflowRunRead.waiting_on {sentence, step_name, prompt_line, window_passed}"
  - "db.workflows.get_unanswered_ask_user"
  - "WaitingOnLine leaf"
key-files:
  created:
    - backend/tests/test_288_waiting_on.py
    - frontend/src/components/workflows/WaitingOnLine.tsx
    - frontend/src/components/workflows/WaitingOnLine.test.tsx
  modified:
    - backend/app/api/workflow_runs.py
    - backend/app/db/workflows.py
    - frontend/src/lib/api/workflows.ts
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
requirements-completed: [AUTH-01]
completed: 2026-10-19
---

# Phase 288 Plan 03: waiting-on sentence on the run surface

The run read now carries a server-composed `waiting_on` sentence for a run waiting on a human-input step (active or paused), built from the durable unanswered `ask_user_prompt` row, so it is identical after reload and never contains an id.

## Commits
- `9505135b8` server field, unanswered-prompt read, tests
- `972eea737` TS type and `WaitingOnLine` leaf, tests
- `2a5fa1172` one render in `WorkflowRunPage.tsx`, page tests, ledger rows and sections

## What was built
- `db/workflows.get_unanswered_ask_user`: NOT EXISTS variant, scoped by `tool_calls->0->>'run_id'`; `get_pending_ask_user` unchanged. Two-pause case handled by the NOT EXISTS on `tool_call_id`.
- `workflow_runs.py`: `WorkflowRunWaitingOn` model + field; `user_id` and `is_golden_run` added to the ownership select; pure `compose_waiting_on` (owner/viewer aware) and `_read_waiting_on` producer (only for active/paused, non-golden; any failure yields None). Step name = the active `llm_human_input` phase's name via the existing `_clean_label` scrub; display name from `profiles.display_name` via one pool read after the ownership select.
- A-06 reading used: email appears only when the viewer is the owner and no display name exists; non-owners see the owner's display name if one exists, else "the person who started this run", with `prompt_line` None and no "(you)". Paused wording: "Still waiting on X; the run continues as soon as they answer." (never "expired"). Operator note for plan 04: a non-owner sees the owner's display name (not hidden), which is the A-06 text as written; revisit if the operator wants non-owners to see only the generic phrase.
- Leaf renders the sentence as a text child under `run-waiting-on`; page has ONE render, no hook.

## Tests
- `tests/test_288_waiting_on.py`: 18 pass. `tests/test_188_workflow_run_read.py`, `tests/unit/test_214_failure_reason_seam.py`: green. `tests/test_200_human_gate_pause.py`: 1 failure, `test_no_twenty_fifth_audit_kind_was_added` (25 != 24), inherited from the audit-kind set, files untouched by this plan.
- Frontend: `WaitingOnLine.test.tsx` 4, `WorkflowRunPage.test.tsx` + seam286 pin (10 cases, 5 snapshots unchanged) + the `?raw` fences (StopControl.baseline, runStepCount, MessageItem.inlineApproval, RunReceipt) all pass. `tsc -p tsconfig.app.json` shows no errors in touched files.
- Gates: `check-claude-md-size.cjs` exit 0 (95,974 chars); `check-hot-file-ledger.cjs` on the phase dir exit 0.

## Deviations from Plan
- The run read TS type lives in `frontend/src/lib/api/workflows.ts`, not `types/index.ts` (plan allowed "edit only where declared"). `types/index.ts` untouched, so no ledger row change for it; `lib/api/workflows.ts` ledger row updated instead.
- The leaf was written together with its test rather than strict test-first (backend and page tests were RED first).
- Vitest rewrites `WorkflowRunPage.seam286.pin.test.tsx.snap` with CRLF line endings on each run (content identical); it was restored with a path-specific checkout and is not in any commit.

## Known Stubs
None.

## Self-Check: PASSED
Created files exist; commits `9505135b8`, `972eea737`, `2a5fa1172` present.
