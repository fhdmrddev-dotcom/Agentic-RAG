---
phase: 224-what-the-agent-is-doing-reads-like-a-sentence
plan: 02
subsystem: backend-dispatcher
tags: [approval, timeout, wire-deadline, audit]

requires:
  - phase: 223
    provides: durable audit logging & connector thread state
provides:
  - "Single module constant _APPROVAL_TIMEOUT_SECONDS = 120.0 in tool_dispatcher.py"
  - "tool_approval_required wire emission includes expires_at (ISO 8601 UTC) and timeout_seconds"
  - "asyncio.wait_for pause consumes _APPROVAL_TIMEOUT_SECONDS directly"
  - "test_224_approval_deadline.py asserting wire parameters and timeout behavior"
affects: [224-03]

tech-stack:
  added: []
  patterns: [single source of truth for safety gate timeouts]

key-files:
  created:
    - backend/tests/test_224_approval_deadline.py
  modified:
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "D-224-01: Defined module-level _APPROVAL_TIMEOUT_SECONDS = 120.0 in tool_dispatcher.py consumed by both wait_for and emit"
  - "D-224-02: Emitted both ISO 8601 UTC expires_at and float timeout_seconds to eliminate client clock skew via local anchoring"

requirements-completed:
  - BUG-260902-04

duration: 8min
completed: 2026-09-03
---

# Phase 224 Plan 02 Summary

**Approval wire deadline and timeout unified under single module constant `_APPROVAL_TIMEOUT_SECONDS = 120.0` in `tool_dispatcher.py`, eliminating safety-gate timeout divergence and clock skew.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-03T00:29:00Z
- **Completed:** 2026-09-03T00:34:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)
- **Net code delta:** +221 / -2 lines

## Accomplishments

1. **Single Source of Truth for Approval Timeout**:
   - Defined `_APPROVAL_TIMEOUT_SECONDS: float = 120.0` at the module scope of [`backend/app/services/tool_dispatcher.py`](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/app/services/tool_dispatcher.py).
   - In `_handle_connector_chat_tool`, computed deadline:
     `deadline_utc = now_utc + timedelta(seconds=_APPROVAL_TIMEOUT_SECONDS)`
     `expires_at_iso = deadline_utc.isoformat()`
   - Emitted both `expires_at=expires_at_iso` and `timeout_seconds=_APPROVAL_TIMEOUT_SECONDS` on the `tool_approval_required` event payload.
   - Replaced raw literal `timeout=120.0` in `asyncio.wait_for(_wait_for_decision(), timeout=_APPROVAL_TIMEOUT_SECONDS)`.
   - Wired `_record_connector_audit("timeout", f"Approval request timed out after {int(_APPROVAL_TIMEOUT_SECONDS)}s")` to format against the same constant.

2. **Automated Verification**:
   - Authored unit test suite [`backend/tests/test_224_approval_deadline.py`](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/tests/test_224_approval_deadline.py) importing `_APPROVAL_TIMEOUT_SECONDS` directly:
     - `test_tool_approval_wire_deadline_and_timeout`: verifies that `posture == 'ask'` emits `tool_approval_required` with `timeout_seconds == _APPROVAL_TIMEOUT_SECONDS` and `expires_at` within 1.0s of now + `_APPROVAL_TIMEOUT_SECONDS`.
     - `test_tool_approval_timeout_uses_constant`: mocks `asyncio.wait_for` asserting the timeout argument matches `_APPROVAL_TIMEOUT_SECONDS` exactly, and checks the audit record outcome and copy.
   - Both tests pass cleanly (100%).
   - Regression verified all 6 existing tests in [`backend/tests/test_223_dispatcher_audit.py`](file:///c:/Vibe%20Apps/Agentic%20RAG/backend/tests/test_223_dispatcher_audit.py) pass cleanly.
