---
id: BUG-261020-03
title: Four LangSmith-traced functions still send a provider key (or user_settings) as a traced input
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/observability, security]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4e7e94a82
  date: 2026-10-20
---

# BUG-261020-03: Four LangSmith-traced functions still send a provider key (or user_settings) as a traced input

## What we observed

LangSmith's `@traceable` serialises a traced function's arguments into the run's `inputs`, and
`LANGSMITH_TRACING` defaults to `"true"` (`config.py`). Phase 294 research drove a fake LangSmith
client against `rerank()` and `search_documents()` (both take `user_settings`) and found the
planted provider keys in the captured `create_run` inputs (294-RESEARCH, Pitfall 1). Phase 294
plan 01 fixed those two (`process_inputs=redact_inputs`, pinned by
`backend/tests/unit/test_294_no_key_egress.py` and `test_294_instruction.py`).

The same shape still exists, unfixed, on four traced functions outside Phase 294's scope:

| Function | Decorator | Secret-bearing argument |
|---|---|---|
| `anthropic_service.stream_anthropic` | `@_ls_traceable(name="ChatAnthropic", run_type="llm")` | `api_key` |
| `google_service.stream_google` | `@_ls_traceable(run_type="llm", name="google.genai.streaming_chat")` | `api_key` |
| `sub_agent_service.run_sub_agent` | `@traceable(name="sub-agent", run_type="llm")` | `user_settings` (every provider key) |
| `web_search_service.web_search` | `@traceable(name="web_search")` | `api_key` |

Expected: no key ever leaves the server in a trace. Actual: whenever tracing is on, each call of
these functions sends its key (or the whole `user_settings`, whose `providers[*].api_key`,
`llm_api_key`, `embedding_api_key` and `rerank_api_key` are all keys) to LangSmith.

## Why it matters

Every trace of a main-loop Anthropic or Google turn, every sub-agent run and every web search
ships a live credential to a third-party tracing vendor. Anyone with read access to the LangSmith
project can read the keys. Nothing in the test suite catches it, because no test captures what
the LangSmith client is sent.

## Hypothesized cause

Finding, not hypothesis, for the two Phase 294 functions (measured with the fake client). For the
four above it is inferred from the identical decorator shape and argument names; the fix should
drive the same fake-client probe first, per function.

## Surface classification

`Agentic-RAG` — this app's own tracing configuration.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 294 fixes only `rerank-documents` and `search-documents`, by plan)
- **Defer to future phase / milestone:** the next phase touching any of the four files, or a `/gsd:quick` (one decorator argument per function)
- **Plant as seed:** n/a
- **External — note only:** no

## Fix shape

Add `process_inputs=redact_inputs` (from `backend/app/services/rerank_engines/tracing.py`, which
redacts `user_settings`, `api_key` and `supabase`) to each of the four decorators, and copy the
fake-client test (`FakeLangSmithClient` / `tracing_into` in
`backend/tests/unit/decision_engine_fakes.py`) with a planted key per function. The
`_ls_traceable` fallback shims in `anthropic_service.py` / `google_service.py` accept `**kwargs`,
so the extra argument is safe when langsmith is absent.

## Workarounds

Set `LANGSMITH_TRACING=false` in environments where the LangSmith project is readable by anyone
who should not see provider keys.

## Reference / evidence links

- `.planning/phases/294-decision-engine-rerank-and-citation-check/294-RESEARCH.md` → Pitfall 1
- `backend/tests/unit/test_294_no_key_egress.py` (the probe, including its non-vacuity case)
