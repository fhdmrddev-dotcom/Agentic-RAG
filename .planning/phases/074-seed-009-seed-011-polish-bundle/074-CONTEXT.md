# Phase 074: SEED-009 + SEED-011 Polish Bundle - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two narrow, additive carry-forward seeds bundled into one polish phase:

1. **SEED-009** — Stop `claude-haiku-4-5-20251001` (and every other listed Anthropic / OpenAI / OpenRouter / Google model) from 400-ing when a `max_tokens` request exceeds the provider's hard API cap. Mechanism: extend `MODEL_CAPABILITIES` with a `max_output_tokens: int` field and apply a single clamp inside `openai_service._resolve_max_tokens` (the existing chokepoint shared across providers). Bug originally surfaced during Phase 067.5 Cycle 5 (run_id `8ca784f2-…`, haiku-4-5 with `max_tokens=65536 > 64000`).

2. **SEED-011** — Make `pytest backend/tests/integration/test_059_disconnect.py -q` 3/3 PASS by giving it the same `_reset_redis_singleton` autouse fixture that already protects test_062 / test_063 from the pytest-asyncio per-test event-loop loop-binding trap. Hoist the fixture into `backend/tests/integration/conftest.py` so the three local copies (062, 063, plus the new paste into 059) collapse to one canonical home.

**Out of phase scope:** any change to `_resolve_max_tokens` decision tree beyond inserting the clamp step; any new env vars; any new user_settings columns; the related Anthropic UX bug BUG-260514-02 (deferred — see `<deferred>` below); any frontend change; any DB migration; the parallel work to unify settings storage (Phase 081.1 / SEED-024).

</domain>

<decisions>
## Implementation Decisions

### Clamp scope (Area 1)
- **D-074-01:** The clamp lives at a single chokepoint: `openai_service._resolve_max_tokens` returns `min(resolved, MODEL_CAPABILITIES[model]["max_output_tokens"])` when the registry entry exists. All providers (OpenAI / Anthropic / Google / OpenRouter) get clamp protection automatically because every provider's call path resolves max_tokens through this helper (verified: `threads.py:1251`, `:1381`, `:1419`, `:1429` and the Anthropic dispatcher at `threads.py:1429` passes the resolved value through unchanged into `stream_anthropic(..., max_tokens=_ant_max_tokens, ...)`).
- **D-074-02:** When the requested model is **not** in MODEL_CAPABILITIES, the clamp is a pass-through (no change to current behavior). Mirrors the existing `get_per_call_timeout` fallback pattern (`config.py:154-183`): unknown models get the runtime default, not a guessed cap.
- **D-074-03:** When the clamp actually trims a value, emit `logger.info("clamped max_tokens for model=%s: %d -> %d", model, requested, cap)`. Identifier-only format mirrors Phase 073's T-073-04 no-leak literal — no token-value leak risk; gives operators a breadcrumb when env vars or settings drift past a model cap.
- **D-074-04:** No new `_clamp_max_tokens` helper inside `anthropic_service.py`. SEED-009 Path 1 (anthropic-only clamp) is **rejected** in favor of the universal `_resolve_max_tokens` integration — same intent, broader coverage, smaller LOC.

### Two output-token tables coexistence (Area 2)
- **D-074-05:** `_MODEL_OUTPUT_DEFAULTS` (in `openai_service.py:592-625`) **stays** as the practical default — "what we *request* by default per model" (e.g., haiku=8192 conservative). It is the input to `_resolve_max_tokens`.
- **D-074-06:** New `MODEL_CAPABILITIES.max_output_tokens` field is the **hard API cap** — "what the provider API *refuses to exceed*" (e.g., haiku=64000). It is the clamp ceiling applied **after** `_resolve_max_tokens` picks a default. The two layers compose as `min(resolved_default, hard_cap)`. Nominal cases (default request ≤ cap) yield zero behavior change.
- **D-074-07:** Anthropic per-model `max_output_tokens` values follow SEED-009's docs-verified 2026-05 set: `claude-opus-4-7`=32000, `claude-opus-4-6`=32000, `claude-sonnet-4-6`=64000, `claude-sonnet-4-5`=64000, `claude-haiku-4-5-20251001`=64000. The planner MUST re-verify each value against the live Anthropic docs (`https://docs.anthropic.com/en/docs/about-claude/models`) at plan time and surface any drift as a Rule-1 deviation.
- **D-074-08:** Every currently-listed model in MODEL_CAPABILITIES (OpenAI + Anthropic + OpenRouter + Google = 26 entries per `config.py:92-129`) gets `max_output_tokens` populated. OpenAI and Google entries verified against vendor docs at plan time; OpenRouter entries verified against each upstream provider's docs (kimi-k2.5, deepseek-r1, minimax, etc.) per the existing `_MODEL_OUTPUT_DEFAULTS` comments as a starting point.
- **D-074-09:** Future migration of these per-model knobs to a DB-backed `model_capabilities_overrides` table (planned in Phase 081.1 / SEED-024) is **explicitly deferred** — static-dict extension is the right move for v2.6 polish; the DB table is the v3.0 / Skill Studio milestone story.

### BUG-260514-02 routing (Area 3)
- **D-074-10:** BUG-260514-02 (Anthropic-routed cycles end with tool-call narration instead of a synthesized final summary) is **NOT folded** into Phase 074. Different root cause (system-prompt / agent-loop tail OR frontend block-ordering, per the bug report's hypothesis a/b), different fix surface (`backend/app/api/threads.py` system prompt assembly + agent-loop terminal frame OR `frontend/src/components/Message*.tsx` rendering). Folding would ~3x phase size, cross the backend/frontend boundary, and almost certainly cause a UI change. Reported-bug frontmatter is updated to `status: deferred` with `re_open_trigger: "Phase 075 polish bundle planning OR any system-prompt redesign touching anthropic_service.py / threads.py agent loop terminal frame OR v2.7 Agent Workspace milestone planning"`. Suggested target phase: 075.1 or fold into v2.7.

### Test fixture hoist (Area 4)
- **D-074-11:** Hoist `_reset_redis_singleton` into `backend/tests/integration/conftest.py` as a single `autouse=True` fixture. Remove the three local copies (canonical at `test_062_stream_replay.py:36-51`; verbatim copy at `test_063_post_then_subscribe.py:45-62`; new addition that would have gone into `test_059_disconnect.py`). One source of truth, future integration tests inherit protection automatically.
- **D-074-12:** `_reset_sse_starlette_app_status` stays local to `test_059_disconnect.py:63-94` (sse-starlette-specific, already cross-imported by `test_062_stream_replay.py:31`). Do NOT touch its location — preserves the pinned-version assertion (`sse_starlette.__version__.startswith("2.4.")`) and the existing import path.
- **D-074-13:** Phase 073's `_reset_pg_pool_singleton` autouse fixture (lives in `backend/tests/conftest.py` per Phase 073 Plan 01 / D-073-12) is **explicitly NOT touched** by this phase. Consolidating both singleton-reset fixtures into one conftest is scope creep into Phase 073's deliverables.
- **D-074-14:** Phase-level ship gate: `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py tests/integration/test_059_disconnect.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py -q` is all-green. Catches any cross-file fallout from the hoist (the three pre-existing files had identical-but-local copies; if hoist breaks any one of them, this gate fails loud).

### Claude's Discretion
- Registry key shape (`MODEL_CAPABILITIES` keys use **full model IDs** like `"claude-haiku-4-5-20251001"`, not family stems like `"claude-haiku-4-5"`). SEED-009's `model.rsplit("-", 1)[0]` family-stem suggestion is rejected — full-ID key matches existing `MODEL_CAPABILITIES` shape and avoids ambiguity when Anthropic ships a `-20260601` snapshot with a different cap.
- Plan split: 2 plans is the ROADMAP budget. Recommended split: Plan 01 = SEED-009 (registry field + clamp + per-model docs verification + unit tests + live UAT), Plan 02 = SEED-011 (conftest hoist + remove local copies + 4-file regression sweep). Plans are independent — no dependency edges, can execute parallel-able if the executor wants.
- Unit test for SC#2 (haiku-4.5 64K boundary): pytest parametrize with three cases — under cap (32000), at cap (64000), over cap (65536) — assert clamp returns 64000 for the third case and logs the info line.
- Live UAT for SC#3: drive the chat UI at `http://localhost:5173/` with the test-login (`fhdmrd@gmail.com` / `123456`) per `reference_local_dev_app.md`; select `claude-haiku-4-5-20251001`; send a long-output prompt; verify no `BadRequestError` in backend logs and that `runs.status='completed'`. Chrome DevTools MCP can drive this if needed (per `feedback_chrome_mcp_testing.md`).
- Code-review depth: quick (matches Phase 065 / 073 polish-phase precedent — pure helper + registry + test-infra; nothing crosses RLS, no migration, no new endpoints).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 074 charter
- `.planning/ROADMAP.md` §Phase 074 (lines 437-446) — locked goal + 4 success criteria
- `.planning/REQUIREMENTS.md` §Theme D rows POLISH-SEED-009-01 + POLISH-SEED-011-01 (lines 40, 42)
- `.planning/PRDs/v2.6.md` §Theme D — Polish Carry-forwards section

### Seeds
- `.planning/seeds/SEED-009-claude-haiku-max-tokens-cap.md` — original bug surface, two fix paths, recommended-Path-2 rationale (the universal registry approach)
- `.planning/seeds/SEED-011-test-059-fixture-teardown.md` — root-cause analysis (pytest-asyncio loop-binding), canonical fixture template location, 5-step concrete protocol

### Deferred bug (NOT folded into 074)
- `.planning/reported-bugs/anthropic-end-of-cycle-shows-actions-not-summary.md` — BUG-260514-02, status flipped to `deferred` by this discussion

### Code sites (where the changes land)
- `backend/app/config.py:66-129` — `ModelCapability` TypedDict + `MODEL_CAPABILITIES` registry (add `max_output_tokens` field here)
- `backend/app/services/openai_service.py:592-625` — `_MODEL_OUTPUT_DEFAULTS` (KEEP; do NOT delete or migrate per D-074-05)
- `backend/app/services/openai_service.py:588` — `NATIVE_PROVIDERS = {openai, anthropic, google}` (relevant to _resolve_max_tokens decision tree)
- `backend/app/services/openai_service.py:647-690` — `_resolve_max_tokens` (clamp step inserted at the bottom, per D-074-01)
- `backend/app/services/anthropic_service.py:128-169` — `stream_anthropic` entry; receives clamped `max_tokens` from caller; **no change required** per D-074-04
- `backend/app/api/threads.py:1251, 1381, 1419, 1429` — call sites that invoke `_resolve_max_tokens` (Anthropic dispatch at :1429 → `_ant_max_tokens = _resolve_max_tokens(None, user_settings)`)

### Test sites
- `backend/tests/integration/test_059_disconnect.py:63-94` — existing `_reset_sse_starlette_app_status` autouse (stays local per D-074-12)
- `backend/tests/integration/test_062_stream_replay.py:36-51` — canonical `_reset_redis_singleton` template (delete local copy after hoist per D-074-11)
- `backend/tests/integration/test_063_post_then_subscribe.py:45-62` — verbatim copy (delete after hoist per D-074-11)
- `backend/tests/integration/conftest.py` — target location for the hoisted fixture (per D-074-11)
- `backend/tests/conftest.py` — Phase 073 `_reset_pg_pool_singleton` lives here (do NOT touch per D-074-13)

### Precedent (prior-phase patterns to reuse)
- `.planning/phases/066-adaptive-run-timeouts-and-lifecycle-states/066-CONTEXT.md` — D-066-03 set the precedent for "extend MODEL_CAPABILITIES with a new optional field" (added `llm_call_timeout_seconds`); follow the same TypedDict-update + per-model-population shape
- `.planning/phases/073-asyncpg-pool-integration/073-CONTEXT.md` — D-073-08 / T-073-04 set the precedent for identifier-only `logger.warning`/`logger.info` format strings (no token-value leak); the clamp log line in D-074-03 follows the same pattern
- `.planning/phases/065-skills-test-infrastructure-repair/deferred-items.md` D-065-01-DEFER-2 — original record of the test_059 fixture-cleanup bug; closing this completes that deferral

### Project-level rules
- `CLAUDE.md` — project rules: Python venv, no LangChain/LangGraph, single-uvicorn-worker (still authoritative pre-D-PRD-12), reported-bugs cross-check protocol (applied to BUG-260514-02 routing in this discussion)
- `.planning/PROJECT.md` Key Decisions — D-v2.6-01 (httpx pin), D-066-03 (per-model timeouts), D-073-08 (stream_options=include_usage)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MODEL_CAPABILITIES` registry pattern** (`config.py:92-129`): existing `TypedDict` with `native_tools`, `provider`, `llm_call_timeout_seconds`. Adding `max_output_tokens: int` is a one-line TypedDict extension (per Phase 066 D-066-03 precedent for `llm_call_timeout_seconds`) + populating 26 entries.
- **`_resolve_max_tokens` chokepoint** (`openai_service.py:647-690`): every provider's max_tokens decision flows through this function. Single insertion point clamps universally. No duplicate per-provider clamping logic needed.
- **`_reset_redis_singleton` template** (`test_062_stream_replay.py:36-51`): verbatim-paste-ready, 15 LOC, well-documented. Hoist is straightforward — change one autouse path, delete 2 local copies.
- **`_reset_sse_starlette_app_status` parallel** (`test_059_disconnect.py:63-94`): same-shape pre-existing fixture. Adding the Redis sibling next to it (then hoisting both — sse-starlette one stays local, Redis one hoists) is the canonical mental model.

### Established Patterns
- **`TypedDict` extension with `total=False`** (`config.py:66-78`): partial entries allowed; new field is optional with `.get()` fallback at the read site. Lets the patch ship without forcing every entry to be updated in lockstep — though SC#1 in ROADMAP requires "populated for every currently-listed model" which we honor anyway.
- **Identifier-only log format strings** (Phase 073 T-073-04): `logger.info("clamped max_tokens for model=%s: %d -> %d", model, requested, cap)` — no leak of actual token-value beyond the clamp boundary (which is itself bounded by `max_output_tokens` from a public registry).
- **Autouse fixtures in `conftest.py` for loop-bound singletons** (Phase 062 deviation pattern; Phase 073 D-073-12): the canonical way to break pytest-asyncio per-test event-loop trap. Hoist makes this the project's default integration-test posture.
- **Pytest gate command in shell-runnable form**: `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py ... -q` (CLAUDE.md venv rule; Phase 065 / 073 precedent).

### Integration Points
- **Anthropic dispatcher** (`threads.py:1419-1437`): `_ant_max_tokens = _resolve_max_tokens(None, user_settings)` is the value that flows into `stream_anthropic(..., max_tokens=_ant_max_tokens, ...)`. Clamp inside `_resolve_max_tokens` protects this path with zero call-site change.
- **OpenAI dispatcher** (`threads.py:1251, 1381`): same `_resolve_max_tokens` call. Clamp protects automatically.
- **Sub-agent paths** (`openai_service.create_adaptive_streaming_chat:793-810`): also flows through `_resolve_max_tokens` via the explicit `max_tokens=` parameter when set, or the resolver when not. Clamp covers sub-agents transparently.
- **No frontend integration** — both seeds are backend-only.
- **No DB migration** — both seeds are code-only.

</code_context>

<specifics>
## Specific Ideas

- **Plan split:** 2 plans per ROADMAP budget. Plan 01 = SEED-009 (registry field + per-model values + clamp + log + unit + UAT). Plan 02 = SEED-011 (conftest hoist + 3-file delete + 4-file pytest gate). No dependency between plans — parallel-able.
- **Anthropic-doc verification at plan time:** Planner should curl `https://docs.anthropic.com/en/docs/about-claude/models` (or the per-model card pages) at plan time and lock the exact `max_output_tokens` values into PLAN.md before execute. Any drift from SEED-009's 2026-05 numbers gets surfaced as a Rule-1 plan deviation.
- **OpenAI / Google / OpenRouter values:** SEED-009 doesn't enumerate these. Planner pulls from each vendor's docs; existing `_MODEL_OUTPUT_DEFAULTS` comments are a starting reference (e.g., gpt-5.4 = 65536 because supports 128k; planner verifies actual API hard cap is 128000 and uses that as `max_output_tokens` while leaving `_MODEL_OUTPUT_DEFAULTS` at 65536 as the practical default).
- **Live UAT (SC#3):** Drive at `localhost:5173` with `fhdmrd@gmail.com` / `123456` (per `reference_local_dev_app.md`). Send a haiku-4-5 prompt with explicit "use a lot of output" framing OR set a temporary env override `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` to force the clamp path. Verify backend log emits the `clamped max_tokens` info line AND the run reaches `runs.status='completed'` (no `BadRequestError`).
- **Chrome DevTools MCP:** Available for the live UAT per `feedback_chrome_mcp_testing.md` if the executor prefers automation over manual click-through.

</specifics>

<deferred>
## Deferred Ideas

- **BUG-260514-02 (Anthropic narration vs synthesized summary)** — same provider neighborhood, different root cause (system-prompt or frontend ordering). Reported-bug frontmatter updated to `status: deferred`, `re_open_trigger: "Phase 075 polish bundle planning OR any system-prompt redesign touching anthropic_service.py / threads.py agent loop terminal frame OR v2.7 Agent Workspace milestone planning"`. Suggested re-route: Phase 075.1 (decimal insert) or fold into v2.7 Agent Workspace.
- **Consolidate `_MODEL_OUTPUT_DEFAULTS` into `MODEL_CAPABILITIES`** — explicitly rejected per D-074-05 / D-074-06. Two-layer model preserves clarity (practical default vs hard cap) and avoids changing default request-size behavior. Phase 081.1 / SEED-024 will eventually unify via DB-backed `model_capabilities_overrides` table.
- **Hoist `_reset_pg_pool_singleton` alongside `_reset_redis_singleton`** — explicitly rejected per D-074-13. Touching Phase 073's deliverables is scope creep; pg-pool fixture stays in `backend/tests/conftest.py` per Phase 073 D-073-12.
- **Hoist `_reset_sse_starlette_app_status`** — explicitly rejected per D-074-12. Already cross-imported; pinned-version assertion is sse-starlette-specific.
- **Per-provider `_clamp_max_tokens` helpers** — rejected per D-074-04. Single chokepoint at `_resolve_max_tokens` covers all providers; per-provider helpers would be redundant defense-in-depth without clear payoff.
- **Hard-fail on unknown-model clamp request** — rejected per D-074-02 (would break ad-hoc model experiments in the chat UI). Pass-through preserves current UX; the bug class only fires when a registry value exists and is wrong, not when one is missing.

### Reviewed Todos (not folded)
- No todos surfaced by `todo.match-phase` for Phase 074 (todo cross-reference yielded zero matches; the two SEED bodies cover the full intended scope).

</deferred>

---

*Phase: 074-seed-009-seed-011-polish-bundle*
*Context gathered: 2026-05-17*
