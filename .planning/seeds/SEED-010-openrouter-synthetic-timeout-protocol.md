---
seed_id: SEED-010
title: NR-067.2-11/12 — OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol verification
created: 2026-05-09
status: closed
closed: 2026-05-27
closed_by: 082-cross-cutting-verification-extraction-telemetry
priority: low
re_open_triggers:
  - User report of agent hang or `GeneratorExit` on OpenRouter-routed models
  - Adding new OpenRouter-routed models to MODEL_CAPABILITIES that need lifecycle verification
  - Next milestone touching `backend/app/services/openai_service.py` or the per-call timeout machinery shipped in Phase 066
  - User explicitly asks to verify lifecycle parity across all four production providers
relates_to:
  - Phase 067.2 closing UAT Rows 11 + 12 (deferred at UAT — `OPENROUTER_API_KEY` was absent at that moment)
  - Phase 067.4 carry-forward — OpenRouter creds present but rows explicitly user-retained
  - Phase 066 D-066-11 `stream.close()` invariant + per-LLM-call timeout (`LLM_CALL_TIMEOUT_OVERRIDES`)
closure_note: "Fully consumed by Phase 081 (SEED-010 OpenRouter UAT). Kimi-k2.5 + MiniMax-m2.7 both produce clean timed_out status. POLISH-SEED-010-01 Validated."
---

# SEED-010: OpenRouter synthetic-timeout protocol verification

## What's deferred

Phase 067.2 closing UAT scoreboard included two rows:
- **Row 11** — `moonshotai/kimi-k2.5` synthetic-timeout: force `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10`, restart uvicorn, submit a long-form prompt with model=kimi-k2.5 → confirm `runs.status='timed_out'` + `runs.error='timed_out: 10s per-call deadline exceeded at iteration N (model=moonshotai/kimi-k2.5)'`. Clean cancellation format (NOT `GeneratorExit`).
- **Row 12** — `minimax/minimax-m2.7` synthetic-timeout: same protocol with model=`minimax/minimax-m2.7`.

Both rows verify that Phase 066's per-LLM-call timeout machinery (`LLM_CALL_TIMEOUT_OVERRIDES`) produces a clean `timed_out` lifecycle on OpenRouter-routed models, NOT a `GeneratorExit` like the original Gap-007 surface.

## Why it's deferred from v2.5

`OPENROUTER_API_KEY` was absent at Phase 067.2 UAT time → rows marked `n/a — provider unconfigured`. Creds returned by Phase 067.3 but the protocol was out-of-scope for 067.3 plan-set (D-067.3-WAVE-03 multi-provider availability rule). Phase 067.4 carry-forward declared the rows in scope; user explicitly retained ownership at the UAT-start handoff. The orchestrator delivered all UI-driveable rows but did not exercise the env-var protocol on user's behalf.

## When to surface

Re-open when any of the triggers above fires. Concrete protocol:

1. Confirm `OPENROUTER_API_KEY` in `backend/.env` (creds are present per latest STATE.md).
2. Set `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10`.
3. Restart uvicorn (`backend/start.sh` or equivalent).
4. Submit a long-form prompt with model=`moonshotai/kimi-k2.5`. Expect: `runs.status='timed_out'`, `runs.error` includes `timed_out: 10s per-call deadline exceeded`, no `GeneratorExit` in LangSmith trace, UI shows "Agent reached time limit" banner with Resume button.
5. Repeat with model=`minimax/minimax-m2.7`.
6. Spot-check a normal (non-synthetic-timeout) run with each model to confirm the per-call budget reset behavior on tool-call boundaries works as in the OpenAI/Anthropic paths.

## Cost estimate

~30 minutes of UAT (env edit + uvicorn restart + 4 runs + verdict capture + STATE.md / UAT scoreboard mirror). No code changes expected.

## Reference paths

- `backend/app/services/openai_service.py` — per-LLM-call timeout machinery (Phase 066).
- `backend/.env.example` — `LLM_CALL_TIMEOUT_OVERRIDES` syntax.
- `.planning/phases/067.2-streaming-render-and-storage-fixes/067.2-HUMAN-UAT.md` — Rows 11 + 12 protocol details.
- `.planning/phases/067.4-streaming-suggestions-tool-stage-render-code-execution/067.4-HUMAN-UAT.md` — carry-forward note.
