# Phase 213 Summary: Per-Tool Grants and the Approval Moment

## Executive Summary

Phase 213 delivers the full tri-state per-tool grant system and approval moment mechanics across the database schema, backend services, harness execution engine, and frontend settings/workflows UI.

---

## 1. Work Completed by Wave

### Wave 1: Posture Schema & Backend Model/Service/API Updates (`213-01`)
- Created and applied `supabase/migrations/128_connector_connection_posture.sql` adding `default_approval_posture` (`text CHECK in ('allow', 'ask', 'deny') DEFAULT 'ask'`) and `tool_grants` (`jsonb DEFAULT '{}'::jsonb`) with column-level `GRANT SELECT` to `authenticated` and `service_role`.
- Updated `supabase/full-schema.sql`.
- Updated `backend/app/models/connector.py` with `ToolGrantPosture = Literal["allow", "ask", "deny"]`, `ConnectorConnectionCreate`, `ConnectorConnectionUpdate`, `ConnectorConnectionRead`.
- Replaced `bool(v)` grant sanitizer in `backend/app/services/connector_service.py` with `_sanitize_tool_grants` enforcing exact `_LEGAL_GRANT_VALUES = {"allow", "ask", "deny"}`.
- Updated `backend/app/api/connectors.py` endpoint `PATCH /connections/{id}/grants` with `ValueError -> 422`.
- Updated frontend types in `frontend/src/lib/api/org.ts`, `frontend/src/lib/api/connectors.ts`, `frontend/src/lib/api.ts`.
- Updated `frontend/src/components/workflows/McpToolPicker.tsx` and its test suite.
- Created unit tests in `backend/tests/unit/test_213_posture_schema.py` (15/15 passed).

### Wave 2: Gate 5.5 Execution Engine Integration & Audit Receipts (`213-02`)
- Created leaf module `backend/app/services/connectors/grants.py` defining `resolve_effective_posture` and `is_tool_allowed` with ZERO imports of `phase_types` or `harness_engine` (refactor taken by construction / D-213-00).
- Integrated Gate 5.5 into `backend/app/services/harness/phase_types.py:_exec_external_action` between Gate 5 and Gate 6/7 shape fork (enforcing SEC-1 / BUG-260827-02).
- Extended `_write_send_receipt` to accept `tool_name: str | None = None` and record `metadata["tool_name"] = str(tool_name)` (D-213-13/14).
- Updated Gate 6 (MCP) and Gate 7 (Capability) dispatch to pass `tool_name` to `_write_send_receipt` on success, and emit `tool_refused` on Gate 5.5 failure.
- Created unit tests in `backend/tests/unit/test_213_gate55_execution.py` (9/9 passed).

### Wave 3: Human Pause / Approval Moment Engine Dispatch & Recovery (`213-03`)
- Verified `_approval_sentence` in `backend/app/services/harness/grounding.py` generates honest copy.
- Confirmed `PendingAskCard` integration in `frontend/src/pages/WorkflowRunPage.tsx` via `RunSpine` `renderAsk` at `askAnchorSlug`.

### Wave 4: UI Tri-State Chips, Vocabulary & Connection Grants List (`213-04`)
- Ported copy vocabulary `frontend/src/components/settings/grantsVocabulary.ts` verbatim from `COPY.js`.
- Created `frontend/src/components/settings/ConnectionGrantsList.tsx` implementing all 10 invariants from `BUILD-CONTRACT.generated.md`:
  - Invariant 1: Primary override edge indicator (no state color on edge).
  - Invariant 2: 2px transparent edge lane.
  - Invariant 3: Three arms per segmented control group, exactly 1 pressed.
  - Invariant 4: Deny arm styled with destructive token.
  - Invariant 5: Widened panel split track to `clamp(480px, 38%, 640px)`.
  - Invariant 6: Search filter with empty state (`LIST_EMPTY`).
  - Invariant 7: Unknown direction handling and help copy.
  - Invariant 8: Zero `[title]` attribute rule (all text in DOM).
  - Invariant 9: Default posture segmented control.
  - Invariant 10: "You changed this" override marker.
- Updated `frontend/src/components/settings/ConnectionsTab.tsx` and `ConnectionFormPanel.tsx`.
- Created unit tests in `frontend/src/components/settings/__tests__/ConnectionGrantsList.test.tsx` (8/8 passed).
- Updated `ConnectionFormPanel.test.tsx` (153/153 passed) and `ConnectionsTab.test.tsx` (86/86 passed).

### Wave 5: End-to-End Integration Tests & Gate Verification (`213-05`)
- Created `backend/tests/integration/test_213_end_to_end_grants.py` testing full flow without mocking posture logic (3/3 passed).
- Pinned `ConnectionGrantsList.test.tsx: 8` into `scripts/vitest-count-gate.cjs` TARGETS and BASELINE.
- Verified all gates:
  - Frontend count gate: 119/119 pinned files present, 0 failing, total 5865 tests passing.
  - Backend pytest suites: 173 passed, 0 failing across all connector, posture, Gate 5.5, end-to-end integration, and harness execution suites.
  - TypeScript compiler (`tsc`): 0 net-new errors.
