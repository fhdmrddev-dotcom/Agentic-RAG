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

## Diagnostic instrumentation (added → confirmed root cause → REMOVED same day)

Three `logger.warning` blocks gated on `active_provider_name == "google"` were added during investigation, fired exactly the data needed to pinpoint the chunk-handler early-return, then removed in the same quick task once the hotfix was verified working. Net zero residual code in the backend:

1. `threads.py:~1971` — per-iteration shape log (REMOVED).
2. `threads.py:~1800` — per-chunk counter + first-3-chunks raw sample (REMOVED).
3. `openai_service.py:~909` — one-shot request-kwargs log at stream creation (REMOVED).

Removal reasoning: fix is end-to-end verified; ongoing monitoring isn't needed; Phase 075.3 is not imminent, so if diagnostics are needed during that phase they're added fresh against the new code shape. Backend stays clean.

## Live UAT (2026-05-22)

| Prompt | Model | Before | After |
|---|---|---|---|
| `"hi"` | gemini-2.5-flash | empty response fallback at iter ≤2 | `"Hello! How can I help you today?"` (33 chars, finish_reason='stop') |

Other Gemini models not yet retested but expected GREEN by same code path (all 5 share the OpenAI-compat route + chunk handler).

## Carry-forward to Phase 075.3 (further slimmed — now 1 plan)

**Plan 01 — Defensive chunk handler + Google token accounting (only plan)**
- Remove the early-`return` after usage accumulation in `_on_chunk_openai` at `threads.py:1816`; let chunks with both usage AND content be fully processed.
- Add provider-aware accumulator: overwrite-last-wins for Google (per-chunk cumulative usage), accumulate-`+=` for OpenAI/OpenRouter (final-chunk-only emission). Decision point: research Google compat doc OR add a quick repro probe; if per-chunk usage is delta, accumulate works; if cumulative, overwrite-last-wins.
- Integration test for "chunks with both usage AND content" shape on a Google-spec mock.
- Revert the Path A `stream_options.include_usage` gate at `openai_service.py:886-893` (no longer needed once handler is defensive); confirm `runs.input_tokens` / `runs.output_tokens` populate on Google runs again.
- All 5 Gemini models green-light Chrome MCP UAT.

**Decisions baked in:**
- **BUG-260522-01** (misleading `max_iterations` message) routed to **Phase 082.5 Error Handler Foundation** — its `ErrorResponse{user_message, admin_message}` model with sanitization is the natural home; not bundled into 075.3.
- **Native Google SDK split** (`google_service.py` mirroring `anthropic_service.py`) **deferred to v3.1** alongside the planned Provider key management UI. Architectural appeal stands (multi-modal, parity with Anthropic) but no longer the cheapest fix for the user-facing bug, which is now closed.
- **Diagnostic re-add (if needed during 075.3)** — re-introduce against the new code shape with fresh eyes; do NOT reach for what was removed here.

## Related memory pointers

- [[project_phase075_1_shipped]] — preceding 075.x stability arc
- [[project_phase075_2_context]] — current execution context (this quick task did NOT touch 075.2's surface)
- [[feedback_preserve_engine_optionality]] — supports the eventual native split
- [[reference_local_dev_app]] — repro environment

## Commits (all on `v2.5-dev`)

1. `ee3b1f9 fix(google): exclude stream_options.include_usage for Google compat` — `openai_service.py` hotfix + `threads.py` diagnostic blocks (bundled because diagnostic data validated the hotfix in same commit).
2. `2e46b6b docs(quick): 260522-gdg PLAN + SUMMARY + BUG-260522-01` — planning artifacts.
3. *(this commit)* `chore(google): remove diagnostic logging — fix verified, backend clean` — strips the 3 diagnostic blocks now that the hotfix is end-to-end confirmed.
