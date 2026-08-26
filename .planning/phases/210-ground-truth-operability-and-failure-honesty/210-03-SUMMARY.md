---
phase: 210-ground-truth-operability-and-failure-honesty
plan: 03
subsystem: api
tags: [RAG-09, backend, retrieval, failure-honesty, validator-kinds, citations-required, provider-error]
requires:
  - phase: 210-01
    provides: "GovernedFeature type union & Control Room live_connectors switch"
provides:
  - "Dedicated retrieval_error channel on ToolResult -> task_service -> phase_types -> validator_kinds"
  - "Citations and source_refs channels kept strictly clean (empty list on retrieval outage), eliminating KeyError('document_id') in deduplication and preventing phantom citations in source_refs"
  - "Explicit naming of the failing provider (e.g. openai) in citations_required gate rejection"
  - "End-to-end integration tests in test_retrieval_failure_honesty.py verifying complete pipeline propagation and consumer safety"
affects: [211]
tech-stack:
  added: []
  patterns:
    - "Dedicated retrieval_error failure channel across ToolResult, sub-agents and harness phases without contaminating grounding citations"
key-files:
  created:
    - backend/tests/unit/test_retrieval_failure_honesty.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/task_service.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/validator_kinds.py
    - backend/tests/unit/test_tool_dispatcher.py
key-decisions:
  - "D-210-08: When document retrieval fails due to external provider errors (such as embedding rate limit or quota breach), ToolResult populates a dedicated retrieval_error object while leaving citations and source_refs strictly empty ([])."
  - "D-210-09: _validate_citations_required checks output.get('retrieval_error') and emits an honest service outage message naming the exact provider, preventing false attribution to LLM non-compliance or zero sources."
patterns-established:
  - "Retrieval failure honesty: External provider errors are explicitly labeled as service outages naming the provider rather than empty retrieval results or hallucination errors."
requirements-completed: [RAG-09]
duration: 20min
completed: 2026-08-26
---

# Phase 210 Plan 03: Provider Failure Honesty in Retrieval & Citations Validation Summary

**Retrieval provider outages (e.g. OpenAI rate limits / quota exhaustion) are cleanly captured through a dedicated `retrieval_error` channel and surfaced by `_validate_citations_required` as honest service outages naming the provider, while keeping `citations` and `source_refs` strictly clean to prevent downstream consumer crashes.**

## Performance
- **Tasks:** Fixed V-1 (clean citations list, no `KeyError`), V-2 (explicit provider name in rejection), V-3 (clean `source_refs`), and added multi-layer end-to-end tests.
- **Files created:** 1 test suite (`test_retrieval_failure_honesty.py`)
- **Files modified:** 5 files
- **Backend Tests:** 40/40 passed across touched test files (`test_retrieval_failure_honesty.py`, `test_tool_dispatcher.py`)
- **Frontend Typecheck:** 34 errors (exact baseline)
- **Vitest Count Gate:** 114/114 pinned files present, 0 failing, total 5798

## Accomplishments
1. **Dedicated Failure Channel (V-1, V-3):** Added `retrieval_error: dict | None = None` to `ToolResult`, harvested in `task_service.py:run_task_sub_agent` and returned in `phase_types.py:_exec_llm_agent` and `_exec_llm_batch_agents`. Left `citations` and `source_refs` as clean empty lists (`[]`) on retrieval failure so `_deduplicate_citations` never throws `KeyError('document_id')` and `messages.source_refs` never receives pseudo-citations.
2. **Explicit Provider Naming (V-2 / SC#5):** `_handle_search_documents` derives the active embedding provider (`getattr(ctx.user_settings, 'embedding_provider', None) or 'openai'`) and populates `retrieval_error = {"provider": provider, "detail": str(exc), "retrieval_status": "provider_error"}`.
3. **Emitted Honest Validator Rejections:** `_validate_citations_required` in `validator_kinds.py` inspects `output.get("retrieval_error")`. When present, it returns `citations_required: retrieval failed ({provider}: {detail}) — this is a service outage, not model non-compliance`.
4. **Added Comprehensive Integration Tests:** `test_retrieval_failure_honesty.py` exercises tool handler, `run_task_sub_agent`, `_exec_llm_agent`, `_validate_citations_required`, and downstream `_deduplicate_citations` across both `citation_markers` and `agent_loop`.

## Verification
- `pytest tests/unit/test_retrieval_failure_honesty.py`: 7/7 passed.
- `pytest tests/unit/test_tool_dispatcher.py`: 33/33 passed.
- `pytest tests/unit`: 68 failed / 2690 passed (exact baseline rot set preserved, +10 passed).
- `npx tsc --noEmit -p tsconfig.app.json`: 34 errors (exact baseline).
- `node scripts/vitest-count-gate.cjs`: OK (114/114, 5798 total, 0 failing).
