# Phase 210: Ground Truth — Operability & Failure Honesty - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 210 ensures that the installation honestly reports and controls its own external-action, scheduling, and retrieval state — so that everything connected across milestone v3.9 lands on a foundation that does not misrepresent or mask its operational condition.

In scope:
- **CONN-09:** Add `live_connectors` operator control card to Control Room (`FeatureVisibility.tsx`), update `GovernedFeature` type union across frontend, repair exhaustive `Record<GovernedFeature, ...>` maps, and retire temporary fail-closed cast (`BUG-260826-04`).
- **CONN-10 (Part A):** Scheduler-off honesty — surface scheduler daemon status (`SCHEDULER_PROCESS_ENABLED`) in UI and API; provide clear warning banners on schedule creation/modal when the poller daemon is disabled rather than silently accepting no-op schedules (`BUG-260826-06`).
- **CONN-10 (Part B):** Scheduled run token & duration budgets — recalibrate default `max_tokens_per_run` from 50,000 to 500,000 tokens (and default duration to 1,800s) across backend models and frontend modals; surface structured cancellation reason from `metadata.circuit_breaker` on cancelled workflow runs (`BUG-260826-07`).
- **CONN-11:** Trigger route hardening — make `POST /schedules/{id}/trigger` and `SchedulerService.launch_scheduled_run` safely parse string-scalar definitions (`isinstance(row["definition"], str)`), handle missing `org_id` cleanly with structured JSON error responses, and ensure error responses preserve CORS headers (`BUG-260826-03`).
- **RAG-09:** Embedding & retrieval failure honesty — propagate embedding provider errors (e.g. OpenAI 429 quota exhaustion, auth failure, network errors) up the stack as structured failure statuses (`retrieval_status: "provider_error"`); update `citations_required` validation gate to distinguish provider outage from zero matches ("citations_required: embedding provider refused the request ({provider}: {reason}) — document search could not run"); surface embedding health in Control Room (`BUG-260815-05`).

Out of scope:
- Migrations modifying connection tables or introducing OAuth schemas (Phase 211 / 215).
- Service catalog, popular rows, or custom MCP URL connection forms (Phase 212).
- Per-tool approval dialogs or posture models (Phase 213).
- Adding embedding provider fallback / multi-provider re-embedding (separate architectural concern).
</domain>

<decisions>
## Implementation Decisions

### live_connectors Control Room Card & Type Union (CONN-09)
- **D-210-01:** Restrict `live_connectors` card in `FeatureVisibility.tsx` / Control Room to a clean On/Off (Everyone vs Off) toggle. Since `phase_types.py:2391` requires `live_audience == "everyone"` for live sends, exposing multi-audience options would create misleading states where the UI appears enabled but live sending refuses execution.
- **D-210-02:** Add `"live_connectors"` to the `GovernedFeature` union in `frontend/src/lib/api/_core.ts`.
- **D-210-03:** Update all exhaustive `Record<GovernedFeature, ...>` maps across frontend (including `DEFAULT_VISIBILITY` in `ControlRoomPage.tsx`, `FEATURES` in `FeatureVisibility.tsx`, admin API callers, and test files).
- **D-210-04:** Retire the interim `liveConnectorsOnFrom` cast in `frontend/src/components/settings/connectionsCopy.ts` and replace with standard `GovernedFeature` access.

### Scheduler-Off Honesty (CONN-10 Part A)
- **D-210-05:** Expose the effective `scheduler_process_enabled` flag to the frontend via settings/health or feature state.
- **D-210-06:** Non-blocking honest UI: display a clear warning banner and status indicator in `WorkflowScheduleModal.tsx` and schedule listings when the scheduler daemon is disabled (`"Background scheduler daemon is disabled on this installation. Schedules will not run automatically on cadence unless the scheduler process is enabled or triggered manually"`), while still permitting creation/editing and manual on-demand triggers.

### Default Token Budget & Cancellation Surfacing (CONN-10 Part B)
- **D-210-07:** Calibrate default `max_tokens_per_run` to **500,000 tokens** (10x previous 50k default, calibrated for multi-step RAG and synthesis workflows while safely within the 2,000,000 ceiling).
- **D-210-08:** Calibrate default `max_duration_seconds` to **1,800 seconds** (30 minutes) to accommodate RAG processing and approval waits.
- **D-210-09:** Keep backend default in `models/schedule.py` and frontend default in `WorkflowScheduleModal.tsx` in strict lockstep.
- **D-210-10:** Surface the detailed cancellation reason from `workflow_runs.metadata.circuit_breaker` in workflow run banners/cards (e.g., `"Stopped: Token budget exceeded — used 181,892 of 50,000 tokens"` or `"Stopped: Duration limit exceeded"`) rather than bare `"cancelled"`.

### Manual Schedule Trigger Hardening (CONN-11)
- **D-210-11:** Add string-guard handling to `SchedulerService.launch_scheduled_run` for `row["definition"]`: `if isinstance(raw, str): json.loads(raw)` before `WorkflowDefinition.model_validate`, mirroring `publish_service.py`.
- **D-210-12:** Wrap `POST /schedules/{id}/trigger` error paths in structured `ScheduleTriggerResult(launched=False, detail=...)` JSON responses so errors never leak as unhandled 500s or trigger browser CORS false-alarms.

### Embedding & Retrieval Failure Honesty (RAG-09)
- **D-210-13:** In `retrieval_service.py` / `tool_dispatcher.py`, distinguish between an executed search with zero results and a search that could not execute due to embedding provider failure (`RateLimitError`, `AuthenticationError`, `APIConnectionError`, etc.).
- **D-210-14:** Propagate structured error information (`retrieval_status: "provider_error"`, `retrieval_error: "..."`, provider name) up into the harness run context and output citations.
- **D-210-15:** Update `citations_required` validator in `validator_kinds.py` to check for provider failure and emit explicit, actionable error message: `"citations_required: document search failed because the embedding provider ({provider}) returned: {error} — this is a provider failure, not an empty knowledge base"`.
- **D-210-16:** Surface embedding provider health status in Control Room vitals / health probes.

### Claude's Discretion
- Exact layout styling and color tokens for the scheduler inactive warning banner (following standard Aether Intelligence design system).
- Internal exception categorization helper in `retrieval_service.py` / `openai_service.py` following existing `classify_provider_error` patterns.

### Folded Todos & Bugs
- **BUG-260826-04:** `live_connectors` has no Control Room card. (Folded into CONN-09).
- **BUG-260826-06:** Schedules can be created while scheduler is disabled without notice. (Folded into CONN-10 Part A).
- **BUG-260826-07:** Scheduled run default token budget (50k) cancels realistic workflows. (Folded into CONN-10 Part B).
- **BUG-260826-03:** Manual schedule trigger 500s on unparsed string definition or null org. (Folded into CONN-11).
- **BUG-260815-05:** Embedding provider outage reported as "nothing was retrieved (0 sources)". (Folded into RAG-09).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Contract & Governance
- `CLAUDE.md` — Project contract, G-5 hot-file scan rules, gate baselines.
- `AGENTS.md` — Multi-agent roles, bus protocol, and test rules.
- `.planning/phases/210-ground-truth-operability-and-failure-honesty/210-MEASUREMENTS.md` — Pre-flight measurement pack captured on untouched tree.

### Bug Reports & Findings
- `.planning/reported-bugs/BUG-260826-04-live-connectors-has-no-control-room-card.md` — live_connectors control card specifications.
- `.planning/reported-bugs/BUG-260826-06-schedules-can-be-created-while-the-scheduler-is-disabled.md` — scheduler-off silent failure report.
- `.planning/reported-bugs/BUG-260826-07-scheduled-run-default-token-budget-cancels-realistic-workflows.md` — token budget measurement & cancellation report.
- `.planning/reported-bugs/BUG-260826-03-schedule-trigger-500-when-org-id-null.md` — trigger route parsing & 500 analysis.
- `.planning/reported-bugs/BUG-260815-05-provider-outage-is-reported-as-zero-sources.md` — embedding 429 vs zero sources analysis.

### Related Seeds
- `.planning/seeds/SEED-057-google-429-credit-depletion-reads-as-rate-limit.md` — Google 429 trade-offs & classification.
- `.planning/seeds/SEED-078-runtime-feature-flag-killswitch-maintenance-mode.md` — Runtime feature flagging and operator kill-switches.
- `.planning/seeds/SEED-090-metadata-extraction-observability-and-provider-error-distinction.md` — Distinguishing provider errors from empty results.
- `.planning/seeds/SEED-026-error-handling-observability-lift.md` — Structured error handling and observability.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/admin/FeatureVisibility.tsx` — Feature visibility UI and card renderer.
- `frontend/src/components/admin/ControlRoomPage.tsx` — Operator control room layout, vitals, and feature toggles.
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx` — Schedule creation & configuration modal.
- `backend/app/services/harness/validator_kinds.py` — Validation gates including `citations_required`.
- `backend/app/services/provider_gateway/errors.py` — `classify_provider_error` and error categorization.

### Established Patterns
- **Tri-state honesty:** Distinguish "could not read / provider failed" from "read succeeded and found 0 items".
- **Governed feature toggle:** Backend `_GOVERNED_FEATURES` in `user_settings.py`, exposed via `GET /admin/visibility` and updated via `PUT /admin/visibility`.
- **String scalar definition guard:** `if isinstance(raw, str): raw = json.loads(raw)` before `model_validate`.

### Integration Points
- `frontend/src/lib/api/_core.ts` (`GovernedFeature` union).
- `backend/app/services/retrieval_service.py` & `backend/app/services/tool_dispatcher.py` (`search_documents`).
- `backend/app/services/scheduler_service.py` & `backend/app/api/schedules.py` (schedule execution & trigger route).
- `backend/app/models/schedule.py` & `frontend/src/components/workflows/WorkflowScheduleModal.tsx` (token/duration caps).
</code_context>

<specifics>
## Specific Ideas
- The `live_connectors` card in `FeatureVisibility.tsx` should clearly label that Turning OFF immediately disables all live external sends platform-wide.
- The `citations_required` gate message for embedding failures must explicitly name the provider and the exact refusal (e.g. `insufficient_quota` / `429`).
</specifics>

<deferred>
## Deferred Ideas
- Dynamic embedding model fallback or automatic corpus re-indexing (SEED-048 / SEED-165).
- Fine-grained per-tool approval dialogs (Phase 213).
- Migration 127 connection schema refactoring (Phase 211).
</deferred>

---

*Phase: 210-Ground Truth — Operability & Failure Honesty*
*Context gathered: 2026-08-26*
