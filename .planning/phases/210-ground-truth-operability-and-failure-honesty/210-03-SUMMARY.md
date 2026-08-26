---
phase: 210-ground-truth-operability-and-failure-honesty
plan: 03
subsystem: api
tags: [RAG-09, backend, retrieval, failure-honesty, citations, validation-gates]
requires:
  - phase: 210-01
    provides: "GovernedFeature type union & Control Room live_connectors switch"
provides:
  - "ToolResult carries structured error citations on search_documents failure"
  - "_validate_citations_required identifies provider failure errors and reports honest service outage"
  - "End-to-end integration tests in test_retrieval_failure_honesty.py verifying outage propagation"
affects: [211]
tech-stack:
  added: []
  patterns:
    - "Structured error propagation via ToolResult.citations channel without mutating phase_types.py"
key-files:
  created:
    - backend/tests/unit/test_retrieval_failure_honesty.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/harness/validator_kinds.py
    - backend/tests/unit/test_tool_dispatcher.py
key-decisions:
  - "D-210-08: When document retrieval fails due to external provider errors (such as embedding rate limit or quota breach), ToolResult passes an error citation object through the citations channel."
  - "D-210-09: _validate_citations_required checks output['citations'] for is_error and emits an honest service outage message, preventing false attribution to LLM non-compliance or zero sources."
patterns-established:
  - "Retrieval failure honesty: External provider errors are explicitly labeled as service outages rather than empty retrieval results or hallucination errors."
requirements-completed: [RAG-09]
duration: 15min
completed: 2026-08-26
---

# Phase 210 Plan 03: Provider Failure Honesty in Retrieval & Citations Validation Summary

**Retrieval provider outages (e.g. OpenAI rate limits / quota exhaustion) are cleanly captured as structured error citations and surfaced by `_validate_citations_required` as honest service outages rather than false claims of 0 sources or model non-compliance.**

## Performance
- **Tasks:** 2 tasks completed (Backend error channeling + Validator honesty + Integration tests)
- **Files created:** 1 test suite (`test_retrieval_failure_honesty.py`)
- **Files modified:** 3 files
- **Backend Tests:** 37/37 passed across touched test files (`test_retrieval_failure_honesty.py`, `test_tool_dispatcher.py`)
- **Frontend Typecheck:** 34 errors (exact baseline)

## Accomplishments
1. **Captured Retrieval Provider Outages (RAG-09):** In `_handle_search_documents`, caught exceptions generate a `ToolResult` with structured `is_error: True` citation objects in `citations`.
2. **Emitted Honest Validator Rejections:** `_validate_citations_required` in `validator_kinds.py` inspects `output["citations"]`. When an error citation is present, it returns `citations_required: retrieval failed ({provider}: {detail}) — this is a service outage, not model non-compliance`.
3. **Respected 211 File Fences:** The error structure passes seamlessly through existing `task_service.py:765` (`sub_citations.extend(tr.citations)`) into `phase_types.py:823` (`output["citations"]`) with 0 edits to `phase_types.py`.
4. **Added End-to-End Integration Tests:** `test_retrieval_failure_honesty.py` exercises the complete pipeline from tool failure to gate rejection.

## Verification
- `pytest tests/unit/test_retrieval_failure_honesty.py`: 4/4 passed.
- `pytest tests/unit/test_tool_dispatcher.py`: 33/33 passed.
- `npx tsc --noEmit -p tsconfig.app.json`: 34 errors (baseline).
