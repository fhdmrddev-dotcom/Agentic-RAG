---
seed_id: SEED-023
title: Adaptive per-call LLM timeouts + per-run duration telemetry — replace fixed wall-clock budgets with stall detection and observed-percentile defaults
status: planted
planted: 2026-05-17
phase_origin: 073-asyncpg-pool-integration (organic discovery during post-073 user testing)
related_seeds: [SEED-009, SEED-010, SEED-012]
relates_to:
  - Phase 066 — Adaptive Run Timeouts & Lifecycle States (introduced the per-iteration budget architecture; this seed extends it from wall-clock to adaptive)
  - Phase 067.2-11/12 — OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol (v2.5 carry-forward, never exercised — same root cause class as this seed)
  - SEED-010 — OpenRouter synthetic timeout protocol (parent of 067.2-11/12 carry-forward)
  - Phase 073 — `runs.input_tokens` / `runs.output_tokens` (this seed needs a sibling column set: `first_token_ms`, `total_duration_ms`, `stall_events_count`)
  - `backend/app/config.py::MODEL_CAPABILITIES` (current source of `llm_call_timeout_seconds`)
  - `backend/app/config.py::_parse_llm_call_timeout_overrides` (current env-var override path — `LLM_CALL_TIMEOUT_OVERRIDES=model=seconds,...`)
  - `backend/app/api/threads.py:1418,1554` (where the per-call deadline is enforced via `asyncio.timeout(per_call_budget)`)
  - `backend/app/api/threads.py:2648` (the `"Run %s timed out at iteration %d (model=%s, budget=%ds)"` log line)

re_open_triggers:
  - Any user report of `timed_out` errors on OpenRouter free-tier models (MiniMax m2.5:free, Gemma 4 free, Kimi free variants) — already triggered organically 2026-05-17 by user testing
  - Any user report of `timed_out` on reasoning models (deepseek-r1, o1/o3/o4) where the 600s budget isn't enough on a complex chain
  - When Phase 077 (Backpressure & Operational Surface) opens for planning — telemetry surface is a natural pair
  - When v3.1 admin shell plans its "operator-tunable per-model timeout" UI (`model_capabilities_overrides` editor) — this seed says "make the data drive the default, not the operator's guess"
  - When v3.4 spend caps milestone opens — duration telemetry is a prerequisite for cost-per-second budgets
priority: medium
suggested_phase: 076-079 range (after v2.6 closes); could fold into Phase 077's telemetry scope OR ship as a standalone polish phase (e.g., 077.1 or 078.1)
---

# SEED-023 — Adaptive per-call LLM timeouts + duration telemetry

## What we observed

Today's per-LLM-call timeout architecture is **fixed wall-clock budget per iteration** (`MODEL_CAPABILITIES[model_id]["llm_call_timeout_seconds"]`). The agent loop wraps each iteration in `asyncio.timeout(per_call_budget)`; the budget resets at each tool-call boundary (Phase 066 D-066-03). Defaults were eyeballed from typical paid-tier behavior:

| Tier | Models | Default budget |
|---|---|---|
| Fast | gpt-4o-mini, gpt-5.4-mini/nano, gemini-flash, haiku-4-5 | 60–90s |
| Standard | gpt-4o/4.1/5/5.4, sonnet, gemini-pro | 180–240s |
| Reasoning | o1/o3/o4, opus-4-6/7, deepseek-r1/reasoner | 600s |
| OpenRouter (paid) | deepseek-chat, kimi, minimax-01/m2.7 | 240s |
| **OpenRouter (free)** | **minimax-m2.5:free, gemma-4 free, kimi free** | **240s — too tight** |

**The free tier hits the limit far more than paid.** Free-tier OpenRouter models share lower-priority infrastructure: first-token-time (FTT) can exceed 60s on cold cache, full responses run 5–10 min for complex prompts, and the 240s default fails before the model is anywhere near done.

User test 2026-05-17 (`minimax/minimax-m2.5:free`, run `d02358b5-336f-4654-8bce-7dfb34945a57`) timed out at **iteration 4** — meaning the 4th LLM call alone exceeded 240s. The model was making progress; the wall-clock just won.

This was foreshadowed at v2.5 close as carry-forward **NR-067.2-11/12** ("OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol — user-deferred; OpenRouter creds present, just exercise the protocol later"). Never exercised. SEED-010 codified the broader OpenRouter timeout protocol but stayed at fixed-budget assumptions.

## Why the fix isn't just "raise the budget"

Two reasons:

1. **A stream that's actively yielding tokens is not stalled.** Wall-clock says "240s elapsed → kill"; but if the model has been producing tokens steadily, the right call is "keep waiting." Wall-clock conflates *progress* with *stalls*. A stall detector (no tokens for N seconds, where N is much smaller than total budget) is more discriminating.

2. **Hand-picked per-model budgets don't scale.** We have ~30 models in MODEL_CAPABILITIES today; v3.1 will add operator-editable overrides; v3.2's multi-tenancy will need per-org tuning. Manual is wrong by the time you have 100 models × 10 orgs = 1000 combinations to tune. Data-driven defaults solve this — observe real p95/p99 first-token-time and total duration from `runs` history, derive defaults from observations, ship a percentile-based default that gets better as the corpus grows.

## What "good" looks like

Three pieces working together:

### Piece 1 — Duration telemetry (Phase 073 sibling columns)

New columns on `runs` table populated alongside the Phase 073 token columns:
- `first_token_ms` (int, NULL-safe) — time from `chat.completions.create` to first content chunk
- `total_duration_ms` (int, NULL-safe) — full call duration including final usage chunk
- `stall_events_count` (int, default 0) — number of stall-detector triggers within this call (0 = clean, >0 = had to wait through pauses)

Same wiring pattern as Phase 073: on-chunk callback in `send_message` accumulates the per-call timings, finalize writes them.

Adds a 2nd dimension to v3.1's admin dashboards (token cost AND speed per model) and gives v3.4 spend-cap pre-flight the data to project both money AND wall-clock budgets.

### Piece 2 — Stall detector (replace wall-clock with progress-based deadline)

Instead of `asyncio.timeout(240)`, run two parallel guards inside each LLM iteration:

- **Stall guard** (default 60s) — kill if no token received in the last N seconds, regardless of total elapsed
- **Soft ceiling** (default 1800s = 30 min, env-overridable) — backstop against runaway loops; should rarely fire

Stall guard is the real protection. Soft ceiling is the safety net. The current 240s "fixed budget" goes away — the model can take 20 minutes if it's actively producing.

Implementation pattern (rough): instrument the async stream loop with a `last_token_at: float = time.monotonic()` checkpoint; spawn a watchdog task that polls every 5s; if `time.monotonic() - last_token_at > stall_threshold` → cancel.

Cleanly composable with Phase 066's per-iteration budget reset on tool-call boundaries — the stall counter just resets at the same point.

### Piece 3 — Observed-percentile defaults (data-driven `MODEL_CAPABILITIES`)

A nightly (or per-deploy) job that:
1. Queries `runs` table for last 7 days of completed runs per model
2. Computes p95 of `first_token_ms` and p95 of `total_duration_ms` per model
3. Writes derived defaults into `model_capabilities_observed` table (separate from operator-editable `model_capabilities_overrides` from v3.1)
4. Admin UI shows: "Default: 240s (operator). Observed p95: 412s. Suggestion: raise to 600s."

Operator stays in control. Data informs. New models bootstrap from the static MODEL_CAPABILITIES until they have enough sample size (≥ 50 completed runs); observed defaults take over when stable.

## Minimum viable slice

If full scope is too big for one phase, sequence as:

1. **MV-1 (small phase, e.g. 077.1, ~3 plans):** Ship Piece 1 (duration telemetry) only. Mirror Phase 073's structure — on-chunk callbacks, finalize writes, migration adds the 3 columns, integration test asserts non-NULL on happy-path runs. **Immediate operator value:** the admin dashboard can now show speed per model alongside cost per model.
2. **MV-2 (small phase, e.g. 078.1, ~2-3 plans):** Ship Piece 2 (stall detector). Replaces fixed wall-clock with progress-based deadline. Default 60s stall + 1800s soft ceiling. Old `MODEL_CAPABILITIES.llm_call_timeout_seconds` becomes the soft ceiling (per-model overridable), not the actual kill switch.
3. **MV-3 (larger phase or v3.1 scope expansion):** Ship Piece 3 (observed-percentile defaults). Background job + new table + admin UI surface.

## Out of scope (won't open here)

- Hard total-run cap. Phase 066 D-066-09 explicitly says runs have no total cap, only per-iteration. Keep that.
- Per-user timeout tunability. v3.2 multi-tenancy work owns per-org/per-user customization tiers.
- LangSmith trace integration of stall events. Trace hygiene is owned by Phase 067.1's drain-into-queue pattern + future LangSmith-specific work.

## Spike candidates before commitment

1. **Stall threshold calibration** — what's the actual minimum reasonable stall window? Need empirical data. Some providers buffer chunks (especially Anthropic with extended thinking); 30s might fire false positives on opus-4-7's reasoning passes. Could start at 60s, telemetry-tune over time.
2. **Watchdog overhead** — is a 5s-poll asyncio task per active stream sustainable at 1000 concurrent users? Probably yes (it's a single `asyncio.sleep`), but worth a load-bench data point.
3. **Tool-call boundary interaction** — does the stall counter reset at tool-call exit (so the SDK call that follows the tool result gets fresh stall budget)? Probably yes; needs explicit decision.

## Quick wins without waiting for the seed

For the user's immediate MiniMax m2.5:free pain — bump the budget via the existing operator override:

Add to `backend/.env`:
```
LLM_CALL_TIMEOUT_OVERRIDES=minimax/minimax-m2.5:free=900,moonshotai/kimi-k2.5=900,moonshotai/kimi-k2.6=900,minimax/minimax-m2.7=600,minimax/minimax-01=600
```

This is the env-var path documented at `backend/app/config.py:398`. Takes effect on uvicorn restart. NOT a long-term fix (see [[SEED-024]] for why env-based config drifts) but lets the user run free-tier OpenRouter today.
