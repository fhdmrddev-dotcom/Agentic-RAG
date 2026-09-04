# Phase 210: Ground Truth — Operability & Failure Honesty - Research

**Researched:** 2026-08-26
**Domain:** Operator governance, automations/scheduler truth, and embedding provider failure honesty
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-210-01:** Restrict `live_connectors` card in `FeatureVisibility.tsx` / Control Room to a clean On/Off (Everyone vs Off) toggle.
- **D-210-02:** Add `"live_connectors"` to `GovernedFeature` in `frontend/src/lib/api/_core.ts`.
- **D-210-03:** Update all exhaustive `Record<GovernedFeature, ...>` maps across frontend (including `DEFAULT_VISIBILITY` in `ControlRoomPage.tsx`, `FEATURES` in `FeatureVisibility.tsx`, admin API callers, and test files).
- **D-210-04:** Retire the interim `liveConnectorsOnFrom` cast in `frontend/src/components/settings/connectionsCopy.ts`.
- **D-210-05:** Expose the effective `scheduler_process_enabled` flag to the frontend.
- **D-210-06:** Non-blocking honest UI: display clear warning banner in `WorkflowScheduleModal.tsx` and schedule lists when scheduler daemon is disabled.
- **D-210-07 / D-210-08:** Calibrate default `max_tokens_per_run` to 500,000 tokens and `max_duration_seconds` to 1,800s.
- **D-210-09:** Keep backend default in `models/schedule.py` and frontend default in `WorkflowScheduleModal.tsx` in strict lockstep.
- **D-210-10:** Surface detailed cancellation reason from `workflow_runs.metadata.circuit_breaker` in workflow run banners/cards.
- **D-210-11:** Add string-guard handling to `SchedulerService.launch_scheduled_run` for `row["definition"]` (`if isinstance(raw, str): json.loads(raw)`).
- **D-210-12:** Wrap `POST /schedules/{id}/trigger` error paths in structured `ScheduleTriggerResult(launched=False, detail=...)` JSON responses.
- **D-210-13 / D-210-14:** Distinguish executed zero-result searches from embedding provider failures in `retrieval_service.py` / `tool_dispatcher.py` and propagate structured provider failure info up into run context and citations.
- **D-210-15:** Update `citations_required` validator in `validator_kinds.py` to check for provider failure and emit explicit, actionable error message.
- **D-210-16:** Surface embedding provider health status in Control Room vitals / health probes.

### Claude's Discretion
- Styling and exact warning badge palette for scheduler-disabled notices following Aether theme.
- Error taxonomy integration with `classify_provider_error` for embedding providers.

### Deferred Ideas (OUT OF SCOPE)
- Dynamic embedding model fallback or automatic corpus re-indexing (SEED-048 / SEED-165).
- Fine-grained per-tool approval dialogs (Phase 213).
- Migration 127 connection schema refactoring (Phase 211).
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `live_connectors` toggle UI & Type Union (CONN-09) | Frontend (Admin UI) | Backend API | Backend already has `_GOVERNED_FEATURES` and `PUT /admin/visibility`; frontend needs type union & control card |
| Scheduler daemon status & warning (CONN-10) | Frontend (Workflows UI) | Backend API | Backend exposes `scheduler_process_enabled`; frontend displays warning on schedule modal/list |
| Scheduled token budget calibration & circuit breaker (CONN-10) | Backend Models & DB | Frontend Modal | Default schema in `models/schedule.py` + `WorkflowScheduleModal.tsx` + run cancellation parser |
| Manual schedule trigger string guard (CONN-11) | Backend Scheduler | Database | Safe parsing of jsonb string scalars from `workflow_definitions` table |
| Embedding failure propagation & gate honesty (RAG-09) | Backend Services & Harness | Frontend Admin Health | `retrieval_service.py` & `validator_kinds.py` propagate provider errors rather than collapsing to empty results |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 210 fixes 5 open defects without requiring schema migrations:
1. **CONN-09 (`BUG-260826-04`):** The backend already supports `live_connectors` in `_GOVERNED_FEATURES` and `api/admin.py`. The frontend's `GovernedFeature` union was deliberately kept stale under `D-190-DEF-09` to avoid breaking 5 exhaustive maps. Widening the union, adding the `FeatureVisibility.FEATURES` card with an On/Off toggle, updating `ControlRoomPage.tsx` and tests, and retiring the cast in `connectionsCopy.ts` completes the control loop.
2. **CONN-10 (`BUG-260826-06`, `BUG-260826-07`):** The scheduler daemon defaults to `off` in config. Workflows schedule modal will inspect the daemon flag and display an informative warning banner so users know automatic triggers are inactive on this instance unless manually triggered. In addition, the default token budget is calibrated from 50k to 500k tokens (and 1800s), and the cancellation reason stored in `workflow_runs.metadata.circuit_breaker` is displayed when a run is stopped.
3. **CONN-11 (`BUG-260826-03`):** `SchedulerService.launch_scheduled_run` was the only caller parsing `definition` without checking `if isinstance(raw, str): json.loads(raw)`. Adding this guard and structured JSON error responses prevents unhandled 500s and CORS masking.
4. **RAG-09 (`BUG-260815-05`):** During retrieval, if the embedding provider throws an exception (such as `RateLimitError` 429 insufficient quota), `retrieval_service.py` / `tool_dispatcher.py` will record structured provider error state. The `citations_required` validator in `validator_kinds.py` will inspect this and report the explicit provider error rather than claiming "nothing was retrieved (0 sources)".
</research_summary>

<code_context>
## Existing Code Details

### 1. GovernedFeature Maps (Frontend)
Files holding `Record<GovernedFeature, ...>`:
- `frontend/src/lib/api/_core.ts:79` (`GovernedFeature` definition)
- `frontend/src/components/admin/ControlRoomPage.tsx:188` (`DEFAULT_VISIBILITY`)
- `frontend/src/components/admin/ControlRoomPage.tsx:223, 229` (`visibility`, `greenlist` state)
- `frontend/src/components/admin/FeatureVisibility.tsx:99+` (`FEATURES` array)
- `frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx:24, 33` (`ALL_EVERYONE`, `MIXED`)
- `frontend/src/components/admin/revertByteIdentical.test.tsx:87`
- `frontend/src/components/settings/connectionsCopy.ts:39-66` (`liveConnectorsOnFrom` to be retired)

### 2. Scheduler Service & Trigger Route (Backend)
- `backend/app/config.py:1139` (`scheduler_process_enabled`)
- `backend/app/models/schedule.py:147` (`max_tokens_per_run = 50_000`, `max_duration_seconds = 600`)
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx:110` (`useState(50000)`)
- `backend/app/services/scheduler_service.py:107` (`WorkflowDefinition.model_validate(row["definition"])`)
- `backend/app/api/schedules.py:227` (`POST /schedules/{id}/trigger`)

### 3. Retrieval & Validation (Backend)
- `backend/app/services/retrieval_service.py:72` (`_vector_search` calling `embed_texts`)
- `backend/app/services/tool_dispatcher.py:686` (`_handle_search_documents`)
- `backend/app/services/harness/validator_kinds.py:293` (`citations_required` gate)
- `backend/app/services/provider_gateway/errors.py` (`classify_provider_error`)
</code_context>
