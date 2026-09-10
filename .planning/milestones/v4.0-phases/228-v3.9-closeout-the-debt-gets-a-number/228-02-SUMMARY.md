# Phase 228 Plan 02 Summary: Resume/Continue & cap_paused Mount Reconcile Cluster (Wave 2)

## Delivered Objectives
1. **Resume vs Continue Claude AI Parity (`BUG-260818-01`, `BUG-260818-02`):**
   - In `frontend/src/components/chat/MessageItem.tsx`: Renamed error recovery affordance from `"Resume"` to `"Retry turn"`, with `aria-label="Retry turn"` and `data-testid="retry-turn-button"`.
   - In `frontend/src/providers/StreamsProvider.tsx`: Updated `resumeFromFailed` to forward `model: failedMessage.model` and `provider: failedMessage.provider` to `sendMessage()`, ensuring that retrying a failed turn preserves the user's selected model rather than falling back to thread default.
   - Updated existing test suites (`MessageItem.finalOutputs.test.tsx` and `MessageItem.test.tsx`) to assert the new `"Retry turn"` accessible label.
   - Created `frontend/src/components/chat/__tests__/MessageItem.retry.test.tsx` covering button naming, testid, and model/provider preservation.

2. **Mount Reconcile for Deep Runs Paused at Iteration Cap (`BUG-260818-03`, G-2, G-9):**
   - Per preflight G-2, confirmed mount reconcile was the sole defect causing `BUG-260818-03` without widening the closed 5-value `runStatus` union (G-1 deleted).
   - In `backend/app/api/threads.py` (`get_thread_workflow`): Populated `latest_producer_run_id = deep_row["run_id"]` when a Deep run has `status = 'cap_paused'`, giving the frontend the run identifier needed to issue a continue request.
   - In `frontend/src/components/chat/ChatArea.tsx`: Updated mount reconcile hook so `state.cap_paused` sets `workflowLock` with `capPaused: true`, `runId: state.active_workflow_run_id || state.latest_producer_run_id`, and `continuesRemaining: state.continues_remaining`.
   - In `frontend/src/providers/StreamsProvider.tsx`: In `loadMessages` workflow reconciliation, preserved `workflowLock` when `wf.cap_paused` is true.
   - Created `frontend/src/components/chat/__tests__/MessageItem.capPaused.test.tsx` (5/5 passing).
   - Authored unmocked serializer integration test `backend/tests/test_228_cap_paused_reconcile.py` (G-9), proving `GET /threads/{id}/workflow` returns `cap_paused: true`, `latest_producer_run_id: <deep_run_id>`, `mode: "deep"`, `locked: false`, and `continues_remaining: 2` (1/1 passing).

3. **Settled Tool Entrance Wave Suppression (`BUG-260823-02`):**
   - In `frontend/src/components/chat/RunCard.tsx` and `ToolCallPanel.tsx`: Passed `isStreaming` state down to `ToolCallPanel`.
   - In `ToolCallPanel.tsx`: Conditioned `animate-toolSlideIn` so it is applied ONLY when the tool or skill call is live/streaming (`isStreaming && isLast`), suppressing the distracting multi-row slide-in animation replay on page load or thread switch.

4. **Vitest Count Gate Adoption:**
   - Adopted `MessageItem.retry.test.tsx` (4 tests) and `MessageItem.capPaused.test.tsx` (5 tests) into `scripts/vitest-count-gate.cjs` `BASELINE` and `TARGETS`.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/test_228_cap_paused_reconcile.py -v`: 1/1 passed in 0.50s
- `npx vitest run src/components/chat/__tests__/MessageItem.retry.test.tsx src/components/chat/__tests__/MessageItem.capPaused.test.tsx`: 9/9 passed in 2.44s
- `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx src/__tests__/components/MessageItem.test.tsx`: 35/35 passed in 2.88s
- `node scripts/check-backend-unit-baseline.cjs`: PASSED (71 failed <= 71, 3497 passed, 0 errors in 85.93s)
- `$env:GSD_VITEST_MAX_WORKERS="2"; node scripts/vitest-count-gate.cjs`: PASSED (7428 passed, 0 failed, 219/219 pinned files present)

## Next Steps
Proceed to Wave 3 (Plan 228-03): Cloud subdomain routing (`app.<domain>` via `frontend/vercel.json`, CORS in `config.py`), deploy drift audit (`scripts/check-deploy-drift.sh`), and docs update (`docs/OPERATOR.md`, `DEPLOYMENT-WORKFLOW.md`).
