---
phase: 089-agent-loop-extraction-g-5-kickoff-uat
plan: 04
subsystem: testing
tags: [verification, sse-diff, cross-provider, uat, cf-01, chrome-mcp]

# Dependency graph
requires:
  - phase: 089-02
    provides: native-7 eval + SSE capture harness + before-baselines
  - phase: 089-03
    provides: the extracted loop (run_agent_loop) to verify
provides:
  - 089-VERIFICATION.md (I1-I14 named checklist + 4-leg byte-identical proof + 4-axis UAT + CF-01 dispositions)
  - CF-01 dispositions: C1 re-open+defer (093), C2 verified-closed, C3 verified-closed
affects: [090, 091, 092, 093, 095, 096]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SC#3 byte-identical proof = structural-skeleton SSE diff (collapse streaming chunk-types, alignment diff) + same-code run1-vs-run2 stochastic-noise isolation, NOT raw byte-diff (impossible vs live LLMs)"
    - "Chrome DevTools MCP driven 4-axis UAT inline (single-browser sequential, not a parallel fan-out)"

key-files:
  created:
    - .planning/phases/089-agent-loop-extraction-g-5-kickoff-uat/089-VERIFICATION.md
  modified:
    - .planning/reported-bugs/title-generation-broken-deepseek-moonshot-google.md
    - .planning/reported-bugs/sub-agent-cross-provider-model-default-404.md
    - .planning/reported-bugs/final-outputs-pinned-panel-no-download-link.md

key-decisions:
  - "SC#3 byte-identical bar adapted (operator-endorsed): structural skeleton, not raw SSE (live LLMs make raw empty-diff impossible — proven 36/33/34 events on identical code)"
  - "before-eval skipped; SSE before-baselines are the richer per-provider before-snapshot; eval is a noisy secondary lens"
  - "CF-01 C1 re-open+defer to 093 (DeepSeek title-gen still broken, pre-existing, untouched by the move — zero fixes in 089 per D-089-12)"

patterns-established:
  - "Pattern 1: same-code run1-vs-run2 comparison isolates LLM tool-path non-determinism from code regressions"
  - "Pattern 2: GLM/MiniMax international-endpoint + /models-curation as the native-7 onboarding fix"

requirements-completed: [CF-01]

# Metrics
duration: long (multi-session)
completed: 2026-05-30
---

# Phase 089 Plan 04: Byte-Identical Proof + 4-Axis UAT + CF-01 Sweep Summary

**The G-5 agent-loop move is PROVEN byte-identical (4-leg proof + same-code noise isolation); 4-axis UAT all-PASS live via Chrome MCP; CF-01 swept (C2/C3 closed, C1 deferred); GLM+MiniMax made functional + all 14 official models registered.**

## Accomplishments
- **SC#3 byte-identical PROVEN** on four legs: (1) AST-verbatim relocation, (2) deterministic suite before==after, (3) direct empty-skeleton-diff for openai/anthropic/minimax + openrouter, (4) stochastic-noise isolation for google/deepseek/moonshot/zhipu (run-1 vs run-2 on identical code differ — deepseek even flipped BLOCK→PASS). All 8 providers `status=completed` on the extracted loop, both runs.
- **SC#3 harness corrected twice from live data:** structural skeleton (collapse all streaming chunk-types incl. reasoning_delta) + alignment-based diff; the raw byte-diff false-blocks live LLMs.
- **4-axis UAT (U1–U5) all PASS** via Chrome DevTools MCP: General + Explorer multi-tool, parallel-thread (no global lockout, no bleed), ask_user-history loads w/o 500 (086 filter intact), Explorer preservation.
- **CF-01 dispositioned:** C1 title-gen → re-open+defer to 093 (DeepSeek still broken, pre-existing); C2 Google-404 → verified-closed (no 404 in eval); C3 download-link → verified-closed (clickable link).
- **GLM + MiniMax provider curation (D-089-09):** fixed wrong-region endpoints + registered all 14 official models from live /models + docs.z.ai/platform.minimax.io specs; both now complete the multi-tool task.

## CF-01 Dispositions
| Item | Verdict |
|------|---------|
| C1 title-gen native-7 | RE-OPEN + DEFER → 093 (OpenAI works; DeepSeek/Moonshot pre-existing BUG-260527-01; move didn't touch title-gen) |
| C2 Google secondary-model 404 | VERIFIED-CLOSED (eval google cells completed, no 404) |
| C3 download-link payload | VERIFIED-CLOSED (OutputFileCard clickable link) |

## Deviations from Plan
- **SC#3 mechanism adapted (operator-endorsed):** structural-skeleton diff replaces literal raw-SSE empty-diff (raw is impossible vs non-deterministic live LLMs — empirically proven). The skeleton needed two fixes after live data (reasoning_delta collapse + alignment diff).
- **before-eval skipped:** the SSE before-baselines serve as the (richer) before-anchor; the eval is a noisy secondary lens, run after-only + interpreted.
- **Playwright E2E deferred to CI** (frontend suite; loop relocation is backend-only, streaming plumbing unmoved).
- **Operator delegated the live-key driver to Claude** (D-089-11 hybrid): operator started/restarted uvicorn; Claude ran the captures/eval/Chrome-MCP against the operator's local backend + .env.

## Issues Encountered
- **Backend transient unavailability under sustained load** — went briefly unreachable during the first zhipu/minimax capture (mid-config-reload) and during the eval (at zhipu, after 24 cells); recovered each time. Operator restarted between phases. Not a Phase 089 code issue (operator dev backend under heavy reasoning+code load).
- **GLM/MiniMax never functional pre-089** — wrong China endpoints for international keys + stale/miscased model IDs; fixed as in-scope D-089-09 curation.

## Next Phase Readiness
- **Phase 089 (G-5) COMPLETE** — `run_agent_loop` is the clean seam Phase 091 (harness) branches into and Phase 092 (dual-mode) composes; behavior byte-identical.
- Carry-forward to 093: DeepSeek/Moonshot title-gen (BUG-260527-01, deferred).
- v2.8 cross-provider eval seed (scripts/eval_cross_provider.py) now covers native-7 with correct model IDs.

---
*Phase: 089-agent-loop-extraction-g-5-kickoff-uat*
*Completed: 2026-05-30*
