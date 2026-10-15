---
phase: 282-the-slow-run-and-the-paused-run
plan: 04
subsystem: backend+ui
tags: [timeout, local-models, self-hosted, model-registry, add-model, tdd]

requires:
  - phase: 282-01
    provides: "per-model timeout reaches the provider call; 1800 ceiling + refusal sentence"
provides:
  - "config.DEFAULT_LLM_CALL_TIMEOUT_SECONDS_SELF_HOSTED = 900; resolvers take provider="
  - "admin._timeout_out_of_range_detail — one refusal sentence for PATCH and add"
  - "AddModelRequest.llm_call_timeout_seconds (1..1800, checked before any write)"
  - "Timeout field on Add model by ID (placeholder = provider default; blank sends nothing)"
affects: [config.py, admin.py, agent_loop.py, forced_emit.py, task_service.py, ModelRegistryTab.tsx, lib/api/admin.ts]

key-decisions:
  - "D-27: default follows config._SELF_HOSTED_PROVIDERS (mig 180's predicate); no second list"
  - "D-28: the four budget lookups pass the provider they already route on"
  - "D-29: the add path refuses with the PATCH's sentence via one helper"
  - "Live fix: native min/max removed from the field so the server's reason is shown"

requirements-completed: [FIX-06]

duration: ~2h
completed: 2026-10-15
---

# Phase 282 Plan 04: Local models get 900 s; Timeout on Add model by ID

**An LM Studio, Ollama or custom model with no timeout set now gets 900 s instead of the 300 s cloud default. "Add model by ID" takes a Timeout, and 1801 is refused with the same reason the Registry cell gives.**

## Commits

| Commit | What |
|---|---|
| `f173d3a4a` | feat: resolver default by provider, call-site wiring, add-model field + bound, form field, 25 backend tests RED → green, frontend cases RED → green, OpenAPI snapshot, ledger |
| `8fb2bb684` | fix: drop the field's native `min`/`max` (the browser blocked 1801 with a generic message); +1 vitest case; live evidence |

## What now works (verified live)

- **Resolver on the live DB:** an unregistered id resolves to **900** with lmstudio and **300** with openai.
- **Add form:** the placeholder reads `300` and switches to **`900`** on lmstudio.
- **Add with 1801:** the server returns **422** with the exact watchdog sentence, and **0** rows are written.
- **Nemotron at its stored 1200 s:** one 356 s call completed, past the old 300 s cut-off.

## Gates

- **Backend baseline:** 71 failed. The failing set equals base.
- **Targeted backend tests:** `test_282_*` and `test_249_add_model_routing_roster` are green. `test_159_add_model.py` ×4 is inherited red (its stub has no `fetchval`).
- **Vitest:** `ModelRegistryTab.test.tsx` passes 37/37. The count-gate pin went 33 → 37.
- **tsc:** 103 lines, 0 new.
- **OpenAPI snapshot:** regenerated. `test_276_openapi_snapshot_fresh` is green.

## Deviations

- **The live drive found a defect, fixed in this plan.** Native `min=1 max=1800` made the browser block the submit, so the reason never appeared.
- **`test_282_open_off_loop.py`:** its stub was widened to accept the new `provider=` keyword.

## Owed

- **Click-through of the fixed Add form:** the Chrome renderer froze. The fix is proven by vitest.
- **G4-4 (> 600 s):** stays owed, with a measured maximum of 356 s.
- **`spark-x2.5-4b` is disabled in the Registry** (added rows start disabled). It is the operator's row to enable.
