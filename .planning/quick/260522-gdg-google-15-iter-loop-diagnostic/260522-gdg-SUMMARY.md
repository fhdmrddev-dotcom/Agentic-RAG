---
slug: 260522-gdg-google-15-iter-loop-diagnostic
status: complete
type: investigation + hotfix
created: 2026-05-22
completed: 2026-05-22
related_phase: 075.3 (slimmed; planned, not yet inserted)
revertable: yes (1-line gate + 3 diagnostic blocks)
---

# Summary — Google 15-iter loop diagnostic + Path A hotfix

## Bug, in one sentence

All 5 Gemini models silently returned an empty assistant message because the agent-loop chunk handler at `backend/app/api/threads.py:1806-1816` early-returned the moment it saw `chunk.usage`, but Google's OpenAI-compat layer puts `usage` on **every** streaming chunk alongside content — so every content chunk was discarded before reaching `delta.content`.

## Root cause

**Phase 073-03 commit `be13baa`** *("enable stream_options include_usage on OpenAI/OpenRouter streaming")* enabled `stream_options={"include_usage": True}` globally in `openai_service.py:880`. The chunk handler comment at `threads.py:1802-1805` documented the assumption verbatim:

> *"final usage chunk has empty choices=[] and populated chunk.usage. Other chunks have chunk.usage=None."*

True for OpenAI and OpenRouter. False for Google's OpenAI-compat layer, which Phase 073-03 did not test against. Google sends `usage` populated on every chunk — and our handler's `return` at line 1816 dropped the chunk before its `delta.content` was read.

## Evidence (raw chunk data captured live)

```
chunk[1]: delta.content='Hello', finish_reason=None, has_usage=True
chunk[2]: delta.content='! How can I help you today?\n', finish_reason='stop', has_usage=True
```

User reproduction (`gemini-2.5-flash`, prompt `"hi"`): Google's compat sent the complete assistant reply across 2 content chunks. Both were discarded by our `if chunk.usage is not None: ... return` early-exit.

## Misleading symptom

The user-facing error message at `threads.py:2910` reports *"empty response after 15 iterations"* by formatting `max_iterations` (a constant), not the actual iteration count. The loop in fact ran ~2 iterations (iteration 0 empty → retry → iteration 1 empty → break via `_empty_retries < 1` guard at `threads.py:2024-2031`). Filed as **BUG-260522-01** for routing into Phase 082.5 (Error Handler Foundation).

## Fix shipped (Path A — minimal hotfix)

`backend/app/services/openai_service.py`: gate `stream_options.include_usage` on `provider.lower() != "google"`. One conditional, ~25 lines including the new explanatory comment block. Restores Google content delivery at the cost of NULL `runs.input_tokens` / `runs.output_tokens` for Google runs only — the Phase 073-04 SC#3 forward-fill emits its existing `"runs.usage missing"` warning as designed.

## Diagnostic instrumentation (left in place, tagged for removal in Phase 075.3)

Three `logger.warning` blocks gated on `active_provider_name == "google"`:

1. `threads.py:1971-1992` — per-iteration shape (finish_reason, tool_calls, content_len, chunks_received, chunk_samples).
2. `threads.py:1800-1817` — per-chunk counter + first-3-chunks raw sample, populated inside `_on_chunk_openai`.
3. `openai_service.py:909-923` — one-shot request-kwargs log at stream creation (model, key_len, base_url, kwargs_keys, tool_count, gate states).

Total surface: ~50 LOC of removable instrumentation. Phase 075.3 Plan 02 owns removal.

## Live UAT (2026-05-22)

| Prompt | Model | Before | After |
|---|---|---|---|
| `"hi"` | gemini-2.5-flash | empty response fallback at iter ≤2 | `"Hello! How can I help you today?"` (33 chars, finish_reason='stop') |

Other Gemini models not yet retested but expected GREEN by same code path (all 5 share the OpenAI-compat route + chunk handler).

## Carry-forward to Phase 075.3 (slimmed scope)

**Plan 01 — Defensive chunk handler + Google token accounting**
- Remove the early-`return` after usage accumulation in `_on_chunk_openai`; let chunks with both usage AND content be fully processed.
- Add provider-aware accumulator: overwrite-last-wins for Google (per-chunk cumulative usage), accumulate-`+=` for OpenAI/OpenRouter (final-chunk-only emission). Decision point: research Google compat doc; if per-chunk usage is delta, accumulate works; if cumulative, overwrite-last-wins.
- Integration test for "chunks with both usage AND content" shape on a Google-spec mock.
- Revert the Path A `stream_options.include_usage` gate (no longer needed once handler is defensive).

**Plan 02 — Diagnostic removal + BUG-260522-01**
- Remove the 3 diagnostic logging blocks (~50 LOC). Atomic revert of this quick task's instrumentation.
- Fix the misleading `max_iterations` message at `threads.py:2910` to report actual iteration count.
- All 5 Gemini models green-light Chrome MCP UAT.

**Decision:** Native Google SDK split (the parallel option considered earlier — `google_service.py` mirroring `anthropic_service.py`) **deferred to v3.1** alongside the planned Provider key management UI. Architectural appeal stands (multi-modal, parity with Anthropic) but no longer the cheapest fix for the user-facing bug.

## Related memory pointers

- [[project_phase075_1_shipped]] — preceding 075.x stability arc
- [[project_phase075_2_context]] — current execution context (this quick task did NOT touch 075.2's surface)
- [[feedback_preserve_engine_optionality]] — supports the eventual native split
- [[reference_local_dev_app]] — repro environment

## Commits

(staged shape, awaiting user confirm before `git commit`)
- `fix(google): exclude stream_options.include_usage for Google compat (Path A hotfix)` — `openai_service.py`
- `chore(google): add Google-only diagnostic logging for chunk shape + request kwargs` — `threads.py` + `openai_service.py`
- `docs(quick): 260522-gdg PLAN + SUMMARY + BUG-260522-01 report`
