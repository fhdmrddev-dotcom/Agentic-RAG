---
seed_id: SEED-009
title: claude-haiku-4-5 max_tokens default exceeds 64K model cap
created: 2026-05-09
status: planted
priority: medium
re_open_triggers:
  - Any user report of BadRequestError on Anthropic models
  - Adding new Anthropic models to MODEL_CAPABILITIES (per-model max_tokens caps differ — Sonnet 64K, Haiku 64K, Opus 32K, etc.)
  - Next milestone touching `backend/app/services/anthropic_service.py`
  - Migrating to a newer Claude model family (Claude 5.x) where caps may shift
relates_to:
  - Phase 067.5 Plan 02 closing UAT — Cycle 5 surfaced the bug live (run_id `8ca784f2-1e5e-4918-9784-c79cadee145f`, thread `6e2913b7-6d93-49ae-aa02-c65c843c7970`)
  - D-063-04 Resume path — worked cleanly when this error surfaced (user clicked Resume → new run `53ee4e5a-692a-4c0d-bfe9-874248da6d31` succeeded)
  - MODEL_CAPABILITIES registry pattern (already used for `provider`, `supports_tools`, `default_temperature`, etc. in `backend/app/config.py`)
---

# SEED-009: claude-haiku-4-5 max_tokens default exceeds 64K model cap

## What happened

During Phase 067.5 Plan 02 closing UAT, Cycle 5 (2026-05-09, user-driven), one streaming run failed with this backend traceback:

```
Unexpected error in event stream (thread 6e2913b7-6d93-49ae-aa02-c65c843c7970):
Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error',
'message': 'max_tokens: 65536 > 64000, which is the maximum allowed number of
output tokens for claude-haiku-4-5-20251001'}, 'request_id': 'req_011Cars3a3BnEDpCaNVqLaSt'}
[BadRequestError]

  File "backend/app/services/anthropic_service.py", line 169, in stream_anthropic
    with client.messages.stream(**stream_kwargs) as stream:
  File ".../anthropic/_base_client.py", line 1141, in request
    raise self._make_status_error_from_response(err.response) from None
anthropic.BadRequestError
```

Run terminated cleanly with `runStatus="failed"`. User clicked Resume; the second POST succeeded with a new run_id, and the thread rendered correctly via D-063-04 resume semantics. **The application's failure UX worked exactly as designed.**

## Why this matters

The backend is sending `max_tokens=65536` (64K + 1024 overhead, presumably) on every Anthropic request, but the per-model cap is published in the Anthropic docs:

| Model | Output cap (max_tokens) |
|---|---|
| `claude-opus-4-7-…` | 32000 |
| `claude-sonnet-4-6-…` | 64000 |
| `claude-haiku-4-5-…` | **64000** |
| Older models | varies (Claude 3.5 Sonnet was 8192, etc.) |

The 65536 default was probably set assuming Sonnet/Haiku 4.5 would have a 65K cap (round number), but Anthropic actually capped them at 64000 (decimal-round, not binary-round). Result: any haiku-4-5 request 400s pre-stream.

This is **not a Phase 067.5 regression** — it's a pre-existing config bug that surfaced because the user picked Haiku 4.5 for one of the 4 cycle threads. Most prior 067.x UAT runs used Sonnet 4.6 or OpenAI models, masking it.

## When to surface

Trigger this seed when:
- A user reports `BadRequestError` on any Anthropic model
- The next milestone (Skill Studio) starts using Anthropic models in eval cases — eval cases that hit this bug would silently mark themselves as failed
- Adding a new Anthropic model to `MODEL_CAPABILITIES` — the developer should remember to set the per-model `max_tokens` cap
- Touching `backend/app/services/anthropic_service.py` for any reason — fix opportunistically

## Likely fix shape

Two paths, in increasing order of investment:

**Path 1 — clamp at the call site (~5 LOC, safe minimum):**

In `backend/app/services/anthropic_service.py` around line 150–169 where `stream_kwargs` is built:

```python
# Anthropic per-model output caps (as of 2026-05-09; verify before each model add)
ANTHROPIC_MAX_TOKENS_BY_MODEL = {
    "claude-opus-4-7": 32000,
    "claude-sonnet-4-6": 64000,
    "claude-haiku-4-5": 64000,
    # legacy models default to 8192 below
}

def _clamp_max_tokens(model: str, requested: int) -> int:
    model_family = model.rsplit("-", 1)[0] if model.count("-") >= 3 else model
    cap = ANTHROPIC_MAX_TOKENS_BY_MODEL.get(model_family, 8192)
    return min(requested, cap)

stream_kwargs["max_tokens"] = _clamp_max_tokens(model, stream_kwargs["max_tokens"])
```

**Path 2 — extend MODEL_CAPABILITIES registry (recommended, ~10-15 LOC):**

Add `max_output_tokens: int` to the `ModelCapability` TypedDict in `backend/app/config.py` and populate per-model. Anthropic service reads from registry. Same pattern is already used for `provider`, `supports_tools`, `default_temperature`. Cleaner; future-proofs the OpenAI/OpenRouter paths too (they have their own per-model caps).

Path 2 is the "right" fix; Path 1 is the "ship-it-now" fix. Either is fine — small phase, ≤30 LOC including tests.

## Out of scope for this seed

- Re-architecting how `max_tokens` is decided (currently it's a global default × user-settings override × model-family override — this is fine).
- Any frontend change. The frontend already handles `BadRequestError` cleanly via `runStatus="failed"` + Resume button (D-063-04). UX is correct.

## Re-open suggested phase number

When triggered, propose as a small side-phase (single plan, ≤30 LOC, ≤30 min). Slot into the next milestone as a "trivial" priority. Not worth a milestone of its own.
