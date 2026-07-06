---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
plan: 03
subsystem: api
tags: [skills, token-budget, system-prompt, pgvector-prefilter, tdd, app_settings]

# Dependency graph
requires:
  - phase: 123-context-window-management
    provides: "CTX-03 substrate — _TRIM_MARKER honest-truncation vocabulary + PIN_BUDGET_FRACTION pin-cap + estimate_tokens (context_window.py)"
  - phase: 137-skill-studio
    provides: "LOAD_SKILL_POLICY single-source catalog-note policy string (skill_lint.py)"
provides:
  - "resolve_skill_catalog_budget(app_settings) — bounds-checked global token budget (0/negative/invalid => 0 inject-all kill switch; missing => 1500)"
  - "build_skill_catalog_block(enabled, budget, model, pinned_recent_ids, sim_by_id) — pure DB/LLM-free trim fn: byte-identical fast path + cut-least-relevant + honest marker + force-keep capped pins + None-safe sort"
  - "_CATALOG_TRIM_MARKER_TMPL — honest never-silent catalog-trim marker (mirrors CTX-03 _TRIM_MARKER)"
  - "_recently_loaded_skill_names(history_rows) — pin-set provenance scan from load_skill tool_calls"
  - "skill_catalog_max_tokens knob wired through config.py Settings + UserEffectiveSettings + _val readback"
affects: [140-04-hot-path-wiring, agent_loop-catalog-injection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "None-SAFE score resolver: raw = (sim_by_id or {}).get(id); score = raw if raw is not None else -1.0 (NEVER dict.get(id,-1.0) — present-but-None + -(None) TypeError, Blocker-3)"
    - "Byte-identical fast path: over-budget branch is the ONLY divergence from today; fits-budget reproduces agent_loop.py:1216-1224 verbatim (regression-tested by string equality)"
    - "app_settings-only knob via env_attr=None _val readback (mirrors harness_judge_model / skill_builder_model)"

key-files:
  created:
    - backend/app/services/skill_catalog_filter.py
    - backend/tests/test_140_catalog_trim.py
  modified:
    - backend/app/config.py
    - backend/app/models/user_settings.py

key-decisions:
  - "Pin cap reuses context_window.PIN_BUDGET_FRACTION (1/3 budget) directly (import, not a private mirror) so both budget surfaces read as one system"
  - "Sort key is (-_score, name) so fail-open (all-None) and score ties trim deterministically by NAME regardless of input order — hardens 'trims by name order only' beyond relying on caller pre-sort"
  - "config.py carries a vestigial skill_catalog_max_tokens default (readback is env_attr=None so it never reads config.settings) — kept per plan + harness_judge_model precedent"

patterns-established:
  - "Pure-fn-first TDD: prove SC#1/SC#2/SC#3 + fail-open + Blocker-3 deterministically with zero DB/LLM before any hot-path wiring (Plan 04)"

requirements-completed: [TRIG-02]

# Metrics
duration: ~25min
completed: 2026-07-06
---

# Phase 140 Plan 03: Skill-Catalog Pre-Filter Core Contracts Summary

**DB/LLM-free heart of the smart-dispatch pre-filter: a bounds-checked global token budget plus a pure `build_skill_catalog_block` trim function that is byte-identical to today's catalog when it fits, cuts the least-relevant skills first with an honest marker when over budget, always keeps capped pinned/recent skills, and never crashes on a mixed float+None similarity map (Blocker-3).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-06T22:12Z (approx)
- **Completed:** 2026-07-06T22:37Z
- **Tasks:** 2 (each RED→GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `resolve_skill_catalog_budget` resolves the global `app_settings.skill_catalog_max_tokens` and bounds-checks the untrusted admin value (0/negative/invalid/NaN → 0 kill switch; missing → 1500) — T-140-05 mitigated.
- `build_skill_catalog_block` proves all four honesty/safety contracts as pure logic: SC#1 byte-identical fast path + cut-least-relevant, SC#2 budget-zero inject-all, SC#3 honest `_CATALOG_TRIM_MARKER` with the real N-cut + always-keep pinned/recent, D-05 fail-open on None-sim, and Blocker-3 None-safe mixed-sim sort.
- Budget knob wired end-to-end through `config.py` Settings + `UserEffectiveSettings` field + `_val(row, "skill_catalog_max_tokens", None, 1500)` readback.
- 13/13 unit tests green with no DB, no LLM, no new packages (T-140-SC held).

## Task Commits

Each task was committed atomically (RED → GREEN, TDD plan gate):

1. **Task 1: Budget knob + bounds-checked resolver**
   - `ff09363a` (test) — failing budget-knob tests (RED)
   - `4f1c692e` (feat) — config field + user_settings readback + `resolve_skill_catalog_budget` (GREEN)
2. **Task 2: `build_skill_catalog_block` + marker + None-safe sort + pin-scan**
   - `c0b34c85` (test) — failing trim/pin-scan tests (RED)
   - `c8eda75d` (feat) — pure trim fn + `_CATALOG_TRIM_MARKER_TMPL` + `_recently_loaded_skill_names` (GREEN)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `backend/app/services/skill_catalog_filter.py` — NEW. `resolve_skill_catalog_budget`, `build_skill_catalog_block`, `_CATALOG_TRIM_MARKER_TMPL`, `_recently_loaded_skill_names`, and the `_line`/`_block`/`_score`/`_cap_pins` helpers. Pure — no DB, no LLM.
- `backend/tests/test_140_catalog_trim.py` — NEW. 13 unit tests (4 budget + 9 trim/pin-scan behavior cases).
- `backend/app/config.py` — `skill_catalog_max_tokens: int = 1500` added to the Settings class (D-04).
- `backend/app/models/user_settings.py` — `skill_catalog_max_tokens` field + `_val` app_settings-only readback.

## Decisions Made
- **Pin cap = `context_window.PIN_BUDGET_FRACTION` imported directly** (not a private constant), so the loaded-skill-pin surface (CTX-03) and the catalog-menu surface share one budget-fraction vocabulary.
- **Sort key `(-_score, name)`** — makes fail-open (all-None) and equal-score ties trim deterministically by name, hardening the "trims by name order only" guarantee beyond caller pre-sort assumptions.
- **`config.py` field is intentionally not the source of truth** — the readback is `env_attr=None` (app_settings-only), so `settings.skill_catalog_max_tokens` is a documentation/default anchor mirroring the `harness_judge_model` precedent; the live value comes from the DB row.

## Deviations from Plan

None — plan executed exactly as written. One within-discretion hardening: the trim sort key includes `name` as an explicit tiebreaker (`(-_score, name)`) rather than relying solely on stable-sort of a caller-name-sorted `enabled`, making the fail-open/tie behavior order-independent. This is additive and covered by `test_fail_open_on_none_sim` + `test_mixed_sim_none_safe_sorts_last`.

## Issues Encountered
None. Token math in the over-budget tests uses `model=""` (chars/4 heuristic) for deterministic, tiktoken-independent budgets, so the boundary-tuned cases are stable.

## User Setup Required
None — this plan is pure logic. The `app_settings.skill_catalog_max_tokens` column + backfill + hot-path wiring are Plan 04 / migration 091 concerns (deploy-parity flagged there), not this plan.

## Next Phase Readiness
- Contracts are ready for **Plan 04** to wire into `agent_loop.py`'s `skill_catalog_override is None` branch: resolve budget → fits path returns the byte-identical block with no embed → over-budget path embeds the turn, calls `match_skills`, builds `sim_by_id`, and calls `build_skill_catalog_block`. `build_skill_catalog_block` runs OUTSIDE Plan 04's try/except, so its None-safety (proven here) is load-bearing for D-05 fail-open.
- No blockers. `agent_loop.py` and `threads.py` were NOT modified (G-5 red line honored; Plan 04 owns the wiring).

## Self-Check: PASSED
- `backend/app/services/skill_catalog_filter.py` — FOUND
- `backend/tests/test_140_catalog_trim.py` — FOUND
- Commits `ff09363a`, `4f1c692e`, `c0b34c85`, `c8eda75d` — FOUND
- `tests/test_140_catalog_trim.py` — 13/13 PASSED; `test_agent_loop_catalog_override.py` (D-06 seam) — 3/3 PASSED (no regression)

---
*Phase: 140-smart-dispatch-relevance-pre-filter-stretch*
*Completed: 2026-07-06*
