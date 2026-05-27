---
phase: 073
plan: 03
subsystem: backend
tags: [openai, openrouter, anthropic, streaming, token-usage, accumulator, sse]
dependency_graph:
  requires:
    - 073-01 (foundation — get_pg_pool singleton + lifespan close)
    - 073-02 (foundation — app.db.runs typed helpers)
  provides:
    - "openai_service.create_adaptive_streaming_chat: kwargs.stream_options={'include_usage': True} on every streaming call"
    - "anthropic_service.stream_anthropic: yields {'type': 'usage', ...} on message_start + {'type': 'usage_delta', ...} on message_delta"
    - "accumulate_openai(chunk, in, out) -> (in, out) handler shape (canonical — Plan 04 inlines as nonlocal closure)"
    - "accumulate_anthropic(event, in, out) -> (in, out) handler shape (canonical — Plan 04 inlines as nonlocal closure)"
    - "_MISSING_USAGE_FORMAT literal 'runs.usage missing for run=%s provider=%s model=%s' (canonical — Plan 04 inlines verbatim into _shielded_finalize step 3)"
  affects:
    - 073-04 (will inline these handler shapes + format string into threads.py)
tech-stack:
  added: []
  patterns:
    - "SDK-native usage capture (no tiktoken estimation) — D-073-08"
    - "NULL + logger.warning sentinel for SDK gaps — D-073-09"
    - "Pure-function accumulator handlers — testable in isolation; inline into closures in Plan 04"
key-files:
  created:
    - backend/tests/unit/test_token_accumulator_openai.py
    - backend/tests/unit/test_token_accumulator_anthropic.py
    - backend/tests/unit/test_token_accumulator_multi_iter.py
    - backend/tests/unit/test_token_accumulator_missing_usage.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/anthropic_service.py
decisions:
  - "Plan 04 will inline accumulator handlers verbatim — these tests freeze the shape contract"
  - "Pitfall 9 regression-gate test asserts ONE usage_delta per Anthropic Message (not multiple) — naive sum across multiple usage_deltas per Message would double-count"
  - "T-073-04 negative-assertion gate prevents future log-line edits from leaking token values into the warning format string"
metrics:
  duration: 211s
  completed_date: 2026-05-17
  tasks_completed: 4
  files_touched: 6
  commits: 4
requirements_completed: [TOKEN-COL-01]
---

# Phase 073 Plan 03: Streaming Token-Usage Capture Summary

Wired SDK-native token-usage capture into the streaming-provider services (OpenAI/OpenRouter + Anthropic) and locked the canonical per-provider accumulator-function shapes via 12 isolated unit tests. Plan 04 will inline these shapes as `nonlocal` closure callbacks inside `send_message`'s on-chunk handlers — no further accumulator logic to design.

## What landed

### Service flips (2 files, 2 commits)

**`backend/app/services/openai_service.py`** (commit `be13baa`):
- Added `"stream_options": {"include_usage": True}` to the `kwargs` dict in `create_adaptive_streaming_chat` (lines 808-822).
- D-073-08 mandate: enabled GLOBALLY — no provider conditional. This single flip covers BOTH OpenAI direct AND OpenRouter (both route through `client.chat.completions.create(**kwargs)` per `config.py:_PROVIDER_BASE_URLS`).
- Pitfall 2: the trailing usage chunk has `chunk.choices=[]` and populated `chunk.usage`. The existing `_drain_stream_with_close_on_cancel` runs the iterator to natural StopIteration so the trailing chunk WILL be delivered.
- Pitfall 8: the flag is a no-op on OpenRouter (forward-compatible — OpenRouter deprecated it and always returns usage now); no harm.

**`backend/app/services/anthropic_service.py`** (commit `4b1a6fb`):
- New `if event_type == "message_start":` branch added as the FIRST branch in the if/elif chain (line 173). Yields `{"type": "usage", "input_tokens": <int>, "output_tokens": <int>}` where values come from `event.message.usage.input_tokens`/`output_tokens`. Defensive `getattr(_usage, ..., 0) or 0` guards against SDK drift.
- Existing `elif event_type == "content_block_start":` branch unchanged (became second branch after the new message_start).
- Extended existing `elif event_type == "message_delta":` branch (line 230) with a usage yield: when `event.usage` is non-None, yields `{"type": "usage_delta", "output_tokens": <int>}`. Original `stop_reason`/`finish_reason` lines preserved byte-identical.
- Pitfall 9: `event.usage.output_tokens` on `message_delta` is the FINAL CUMULATIVE output_tokens for THAT Message (NOT a per-event delta). Consumer (Plan 04) treats this as a single SUM contribution from the just-completed Message.

### Test files (4 files, 2 commits — 12 tests total)

**`backend/tests/unit/test_token_accumulator_openai.py`** (3 tests, in commit `544df57`):
- `test_openai_trailing_usage_chunk` — happy path: 4 normal chunks + 1 trailing chunk (`choices=[]`, `usage` populated) → accumulator captures (100, 50).
- `test_openai_no_usage_chunk_leaves_none` — interrupted stream (Pitfall 3): no trailing chunk → accumulator stays (None, None) per D-073-09 NULL sentinel.
- `test_openai_chunk_with_zero_usage` — (0, 0) != (None, None) — zero is a real value, not missing.

**`backend/tests/unit/test_token_accumulator_anthropic.py`** (4 tests, in commit `544df57`):
- `test_anthropic_message_start_then_delta` — happy path: usage event (200, 0) + usage_delta (75) → final (200, 75).
- `test_anthropic_only_message_start_no_delta` — cancelled before delta: only message_start fired → (150, 0). Valid non-NULL telemetry.
- `test_anthropic_non_usage_events_pass_through` — non-usage events leave accumulator at (None, None).
- `test_anthropic_pitfall_9_no_double_count` — regression gate: one usage_delta per Message adds output_tokens ONCE, not twice.

**`backend/tests/unit/test_token_accumulator_multi_iter.py`** (2 tests, in commit `7af262e`):
- `test_multi_iteration_sum_openai` — iter1 (100, 50) + iter2 (150, 80) → final (250, 130). D-073-07 SUM across iterations.
- `test_multi_iteration_mixed_providers` — iter1 OpenAI (100, 50) + iter2 Anthropic (200, 75) → final (300, 125). Cross-provider SUM works because both handlers share the same accumulator slot pair.

**`backend/tests/unit/test_token_accumulator_missing_usage.py`** (3 tests, in commit `7af262e`):
- `test_missing_usage_returns_none` — interrupted stream → accumulator stays (None, None). D-073-09 sentinel.
- `test_missing_usage_finalize_log_format` — caplog harness asserts warning fires with `run=`/`provider=`/`model=` identifiers when finalize detects (None, None).
- `test_missing_usage_format_string_has_no_token_values` — **T-073-04 security gate**. Negative assertions for `tokens=`, `value=`, `usage_dict`, `%d` lock out token-value leakage into the warning format string.

## Public surface for Plan 04

Plan 04 will inline the following two handler bodies as `nonlocal` closure callbacks inside `send_message`'s on-chunk dispatchers. These shapes are LOCKED by the unit tests above — Plan 04 must paste them verbatim (or fail the regression suite).

### Accumulator function shape (chosen — option (a) from plan: returns tuple)

The handler signature is `(chunk_or_event, input_total, output_total) -> (input_total, output_total)`. The caller assigns the returned tuple back into the closure slots:

```python
input_tokens_total, output_tokens_total = accumulate_openai(chunk, input_tokens_total, output_tokens_total)
```

This shape was selected over the mutable-state option because:
1. Pure-function semantics make the handler trivially unit-testable (no mocks of mutable state required).
2. The caller closure already has `nonlocal input_tokens_total, output_tokens_total` declarations — tuple-assignment back into the slots is one line.
3. Plan 04 can inline the body of `accumulate_openai`/`accumulate_anthropic` directly without renaming/refactoring (the variable names match: `chunk`/`event`, `input_total`/`output_total`).

### `accumulate_openai` — canonical body

```python
def accumulate_openai(chunk, input_total, output_total):
    if getattr(chunk, "usage", None) is not None:
        u = chunk.usage
        in_t = getattr(u, "prompt_tokens", 0) or 0
        out_t = getattr(u, "completion_tokens", 0) or 0
        if input_total is None:
            return (in_t, out_t)
        return (input_total + in_t, output_total + out_t)
    return (input_total, output_total)
```

### `accumulate_anthropic` — canonical body

```python
def accumulate_anthropic(event, input_total, output_total):
    etype = event.get("type")
    if etype == "usage":
        i = event.get("input_tokens", 0) or 0
        o = event.get("output_tokens", 0) or 0
        if input_total is None:
            return (i, o)
        return (input_total + i, output_total + o)
    elif etype == "usage_delta":
        o = event.get("output_tokens", 0) or 0
        if output_total is None:
            return (input_total, o)
        return (input_total, output_total + o)
    return (input_total, output_total)
```

### Canonical warning format string (T-073-04 frozen contract)

```python
_MISSING_USAGE_FORMAT = "runs.usage missing for run=%s provider=%s model=%s"
```

Plan 04 must use this EXACT literal in `_shielded_finalize` step 3 when `input_tokens_total is None and output_tokens_total is None`. The negative-assertion test in `test_token_accumulator_missing_usage.py::test_missing_usage_format_string_has_no_token_values` will break if a future edit ever introduces `tokens=`, `value=`, `usage_dict`, or `%d` into the format string — T-073-04 information-disclosure mitigation.

## pytest output (verification gate)

```
$ cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_token_accumulator_*.py -x -q
............                                                             [100%]
12 passed, 1 warning in 0.13s
```

12/12 tests pass. Warning is the pre-existing urllib3/chardet version-mismatch from `requests` (unrelated to this plan).

## Deviations from Plan

None — plan executed exactly as written. The accumulator shape selection (option (a) tuple return) was a planned discretion point per the plan's "Pick the shape that's easiest for Plan 04 to inline" instruction; documented above under "Public surface for Plan 04".

## Self-Check: PASSED

Files exist:
- FOUND: backend/app/services/openai_service.py (modified)
- FOUND: backend/app/services/anthropic_service.py (modified)
- FOUND: backend/tests/unit/test_token_accumulator_openai.py
- FOUND: backend/tests/unit/test_token_accumulator_anthropic.py
- FOUND: backend/tests/unit/test_token_accumulator_multi_iter.py
- FOUND: backend/tests/unit/test_token_accumulator_missing_usage.py

Commits exist:
- FOUND: be13baa (Task 1 — openai stream_options flip)
- FOUND: 4b1a6fb (Task 2 — anthropic usage event yields)
- FOUND: 544df57 (Task 3 — openai+anthropic accumulator tests)
- FOUND: 7af262e (Task 4 — multi-iter SUM + missing-usage tests)

Verification commands:
- `grep -c "include_usage" backend/app/services/openai_service.py` → 1
- `grep -c '"type": "usage' backend/app/services/anthropic_service.py` → 2 (usage + usage_delta)
- `pytest tests/unit/test_token_accumulator_*.py -x -q` → 12 passed
- Both services import without error
