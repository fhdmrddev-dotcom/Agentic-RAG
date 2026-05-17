# Phase 074: SEED-009 + SEED-011 Polish Bundle - Research

**Researched:** 2026-05-18
**Domain:** Backend polish — per-model API output-cap registry + pytest-asyncio fixture hoist
**Confidence:** HIGH (Anthropic + OpenAI core models verified live); MEDIUM for Gemini/OpenRouter (vendor doc availability uneven)

## Plain-language summary (read this first)

Phase 074 fixes two small things in the backend. Neither touches the UI, neither needs a database change, neither adds a new env var.

**Thing 1 — Stop the "max_tokens too high" error.** Anthropic's haiku-4.5 only accepts up to 64,000 output tokens; the app currently asks for 65,536, so haiku runs fail before they start. Fix: add one new field (`max_output_tokens`) to the per-model registry, fill in the right number for each of the 26 known models, then add a one-line "don't ask for more than this" clamp inside the existing helper that already decides how many tokens to request. Every provider (Anthropic, OpenAI, Gemini, OpenRouter) goes through that helper, so one fix covers all of them.

**Thing 2 — Stop one specific test from failing.** A test file (`test_059_disconnect.py`) hits a known pytest-asyncio bug where a cached Redis client from a previous test gets reused with a closed event loop. Two other test files (062 and 063) already work around this with a 15-line "reset the Redis client" autouse fixture. Fix: move that fixture into a shared `conftest.py` so all three files (plus future ones) inherit it, then delete the two local copies.

**The key research finding that needs planner attention:** SEED-009 said Opus 4.7 maxes out at 32,000 output tokens. The live Anthropic docs (verified today) say **128,000**. Sonnet 4.6 and Haiku 4.5 are correctly 64,000. Opus 4.6 (which SEED-009 also listed at 32,000) is **128,000**. The planner must lock the verified-today numbers, not SEED-009's older numbers — this is a Rule-1 deviation candidate from the seed.

**Primary recommendation:** Two atomic plans, parallel-able. Plan 01 = registry extension + clamp + per-model verification (referencing the table below) + unit test + live UAT. Plan 02 = conftest hoist + 4-file regression sweep. Both plans land in one phase, both have ~30 LOC code changes.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Clamp scope (Area 1)**
- **D-074-01:** The clamp lives at a single chokepoint: `openai_service._resolve_max_tokens` returns `min(resolved, MODEL_CAPABILITIES[model]["max_output_tokens"])` when the registry entry exists. All providers (OpenAI / Anthropic / Google / OpenRouter) get clamp protection automatically.
- **D-074-02:** When the requested model is **not** in MODEL_CAPABILITIES, the clamp is a pass-through (no change to current behavior). Mirrors the existing `get_per_call_timeout` fallback pattern: unknown models get the runtime default, not a guessed cap.
- **D-074-03:** When the clamp actually trims a value, emit `logger.info("clamped max_tokens for model=%s: %d -> %d", model, requested, cap)`. Identifier-only format mirrors Phase 073's T-073-04 no-leak literal.
- **D-074-04:** No new `_clamp_max_tokens` helper inside `anthropic_service.py`. SEED-009 Path 1 is **rejected** in favor of the universal `_resolve_max_tokens` integration.

**Two output-token tables coexistence (Area 2)**
- **D-074-05:** `_MODEL_OUTPUT_DEFAULTS` (`openai_service.py:592-625`) **stays** as the practical default. Input to `_resolve_max_tokens`.
- **D-074-06:** New `MODEL_CAPABILITIES.max_output_tokens` field is the **hard API cap**. Clamp ceiling applied **after** `_resolve_max_tokens` picks a default. Composition: `min(resolved_default, hard_cap)`.
- **D-074-07:** Anthropic per-model `max_output_tokens` values follow SEED-009's docs-verified set, but planner MUST re-verify each value against the live docs at plan time and surface drift as Rule-1 deviation. *(See "Architectural Responsibility Map" → Rule-1 deviation table below — this research surfaces material drift.)*
- **D-074-08:** Every currently-listed model in MODEL_CAPABILITIES (26 entries per `config.py:92-129`) gets `max_output_tokens` populated.
- **D-074-09:** Future migration to DB-backed `model_capabilities_overrides` table is **explicitly deferred** to Phase 081.1 / SEED-024.

**BUG-260514-02 routing (Area 3)**
- **D-074-10:** BUG-260514-02 is **NOT folded** into Phase 074. Reported-bug frontmatter updated to `status: deferred` with re-open triggers documented.

**Test fixture hoist (Area 4)**
- **D-074-11:** Hoist `_reset_redis_singleton` into `backend/tests/integration/conftest.py` as a single `autouse=True` fixture. Remove 3 local copies (canonical at `test_062:36-51`, verbatim copy at `test_063:45-62`, plus what would have gone into `test_059`).
- **D-074-12:** `_reset_sse_starlette_app_status` **stays local** to `test_059_disconnect.py:63-94`.
- **D-074-13:** Phase 073's `_reset_pg_pool_singleton` (`backend/tests/conftest.py`) is **explicitly NOT touched**.
- **D-074-14:** Phase-level ship gate: `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py tests/integration/test_059_disconnect.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py -q` all-green.

### Claude's Discretion
- Registry key shape: full model IDs (e.g., `"claude-haiku-4-5-20251001"`), not family stems.
- Plan split: 2 plans (Plan 01 = SEED-009, Plan 02 = SEED-011), parallel-able.
- Unit test for SC#2: pytest parametrize with three cases — 32000 (under cap), 64000 (at cap), 65536 (over cap) — assert clamp returns 64000 for the third case and emits the info log.
- Live UAT for SC#3: drive `localhost:5173` with `fhdmrd@gmail.com` / `123456`; haiku-4-5 long-output prompt OR temporary `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` override; verify backend log + `runs.status='completed'`.
- Code-review depth: quick (Phase 065 / 073 polish precedent).

### Deferred Ideas (OUT OF SCOPE)
- BUG-260514-02 (Anthropic narration vs synthesized summary) — different root cause, route to Phase 075.1 or v2.7.
- Consolidating `_MODEL_OUTPUT_DEFAULTS` into `MODEL_CAPABILITIES` — rejected per D-074-05/06.
- Hoisting `_reset_pg_pool_singleton` alongside `_reset_redis_singleton` — Phase 073 scope per D-074-13.
- Hoisting `_reset_sse_starlette_app_status` — sse-starlette-specific, version-pinned assertion per D-074-12.
- Per-provider `_clamp_max_tokens` helpers — single chokepoint covers all per D-074-04.
- Hard-fail on unknown-model clamp request — pass-through preserves UX per D-074-02.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-SEED-009-01 | `claude-haiku-4-5-20251001` runs no longer 400 with `max_tokens > 64000`. `MODEL_CAPABILITIES.max_output_tokens` populated for all currently-listed Anthropic models. | Per-model verification table below (HIGH-confidence Anthropic numbers, all 5 verified live); TypedDict extension shape; `_resolve_max_tokens` clamp insertion point; identifier-only log format. |
| POLISH-SEED-011-01 | `pytest backend/tests/integration/test_059_disconnect.py -q` is 3/3 PASS without `RuntimeError: Event loop is closed`. | Canonical fixture body documented (15 LOC); deletion targets in test_062 + test_063; new conftest creation (file does not exist yet); 4-file regression gate verified collectable. |

---

## Summary

Phase 074 bundles two narrow, additive carry-forwards. Architecturally identical to Phase 065 (test-infra polish) and Phase 073 (asyncpg + token telemetry) — small surface, well-locked decisions, no migration, no frontend.

**SEED-009** adds one optional `int` field to the `ModelCapability` TypedDict (`max_output_tokens`) and inserts a single `min()` clamp at the bottom of `_resolve_max_tokens`. All providers (Anthropic / OpenAI / Google / OpenRouter) flow through this resolver — the Anthropic branch via the explicit call at `threads.py:1419`, and OpenAI/Google/OpenRouter via `create_adaptive_streaming_chat()` which internally invokes `_resolve_max_tokens` at `openai_service.py:801`. One insertion point clamps every dispatcher. Sub-agent path (`sub_agent_service.py:70`) also uses `_resolve_max_tokens` via the explicit `max_tokens` parameter.

**SEED-011** creates a new file `backend/tests/integration/conftest.py` (which does not exist today — confirmed via filesystem audit), pastes the 15-LOC `_reset_redis_singleton` fixture verbatim from `test_062_stream_replay.py:36-51`, then deletes the local copies in test_062 and test_063. The `_reset_sse_starlette_app_status` fixture stays in `test_059_disconnect.py:63-94` because it carries an sse-starlette version-pin assertion (`2.4.x`) that's intentionally co-located with the test file that validates against that version. Phase 073's `_reset_pg_pool_singleton` in `backend/tests/conftest.py` is unaffected (it lives at a different conftest level — root, not integration).

**Primary recommendation:** Plan 01 follows the Phase 066 D-066-03 precedent verbatim (extend TypedDict, populate per-model values, single-line clamp at chokepoint, identifier-only log per Phase 073 T-073-04). Plan 02 follows the Phase 062 P02 deviation pattern (autouse fixture in conftest to break pytest-asyncio per-test loop-binding trap). Both plans are independent; no inter-plan dependency edges. **Rule-1 deviation candidate for the planner: Opus 4.7 + Opus 4.6 cap = 128,000 not 32,000 per live Anthropic docs (verified 2026-05-18). See per-model table below.**

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-model output-cap policy (data) | Backend config | — | Single source of truth in `backend/app/config.py`; no env var, no DB row, no frontend |
| max_tokens clamp enforcement (logic) | Backend service | — | Lives inside `_resolve_max_tokens` chokepoint; transparent to all dispatchers |
| Anthropic dispatch consumes clamp | Backend API | — | `threads.py:1419` explicit call; clamped value flows into `stream_anthropic(max_tokens=...)` |
| OpenAI/Google/OpenRouter dispatch | Backend service | — | `create_adaptive_streaming_chat()` internally calls `_resolve_max_tokens` at line 801 |
| Sub-agent path | Backend service | — | `sub_agent_service.py:70` passes explicit `max_tokens`; clamp covers it transparently |
| Frontend rendering | — | — | **No frontend change** — both seeds are backend-only |
| Database | — | — | **No migration** — both seeds are code-only |
| pytest-asyncio loop-binding hygiene | Test infra | — | Autouse fixture in `tests/integration/conftest.py`; new file |
| Phase 073 pg-pool hygiene | Test infra (root) | — | `tests/conftest.py` — **explicitly untouched** per D-074-13 |

---

## Verified per-model `max_output_tokens` registry (HIGH-priority deliverable)

Each cell verified against the upstream provider's live docs on 2026-05-18. The "SEED-009 (2026-05)" column reflects what SEED-009 documented; **Rule-1 deviation** marks where live docs disagree and the planner should lock the verified-today value.

### Anthropic (verified live at `platform.claude.com/docs/en/about-claude/models/overview` 2026-05-18)

| Model | SEED-009 (2026-05) | Verified 2026-05-18 | Source | Status |
|-------|------------|---------------------|--------|--------|
| `claude-opus-4-7` | 32000 | **128000** | platform.claude.com models overview (current) | **Rule-1 deviation** — drift from seed |
| `claude-opus-4-6` | 32000 | **128000** | platform.claude.com models overview (legacy table) | **Rule-1 deviation** — drift from seed |
| `claude-sonnet-4-6` | 64000 | 64000 | platform.claude.com models overview (current) | Matches seed |
| `claude-sonnet-4-5` | 64000 | 64000 | platform.claude.com models overview (legacy table) | Matches seed |
| `claude-haiku-4-5-20251001` | 64000 | 64000 | platform.claude.com models overview (current); also AWS Bedrock model card | Matches seed |

**Note on Anthropic alias vs ID:** `claude-haiku-4-5` is the alias; `claude-haiku-4-5-20251001` is the pinned snapshot. The registry uses the snapshot ID per Claude's Discretion in CONTEXT.md. Both resolve to the same model and same 64k cap.

**Note on Message Batches API:** Opus 4.7 / 4.6 / Sonnet 4.6 support up to 300k output tokens via the `output-300k-2026-03-24` beta header on the Message Batches API. The app uses the synchronous Messages API (`stream_anthropic` → `client.messages.stream`), so the regular 128k/64k caps apply — not 300k. [CITED: platform.claude.com models overview "Note" callout]

### OpenAI (verified per-model docs + OpenAI community thread 2026-05-18)

| Model | _MODEL_OUTPUT_DEFAULTS (current) | Verified `max_output_tokens` | Source | Confidence |
|-------|----------|------------------------------|--------|------------|
| `gpt-4o` | 16384 | 16384 | Azure OpenAI docs + community thread | HIGH |
| `gpt-4o-mini` | 16384 | 16384 | OpenAI community thread (deprecated) | HIGH |
| `gpt-4.1` | 32768 | 32768 | OpenAI developer docs (deprecated) | HIGH |
| `gpt-4.1-mini` | 32768 | 32768 | developers.openai.com/gpt-4.1-mini | HIGH |
| `gpt-4.1-nano` | 16384 | 16384 | OpenAI community thread (deprecated) | MEDIUM |
| `gpt-5` | 32768 | 128000 | OpenAI community thread (gpt-5 = 272k input + 128k output) | HIGH |
| `gpt-5.4` | 65536 | 128000 | OpenAI gpt-5.5 model page (gpt-5.4-class same spec) | MEDIUM — [ASSUMED] gpt-5.4 ID is a representative-class label per `feedback_model_names_representative.md` |
| `gpt-5.4-mini` | 32768 | 128000 | Same OpenAI source as 5.4 | MEDIUM — [ASSUMED] same |
| `gpt-5.4-nano` | 16384 | 128000 | Same OpenAI source as 5.4 | MEDIUM — [ASSUMED] same |
| `gpt-5.5` | 65536 | 128000 | developers.openai.com/gpt-5.5 (explicit doc) | HIGH |
| `o1` | — | 100000 | OpenAI o-series docs | MEDIUM — value via community thread |
| `o3` | — | 100000 | platform.openai.com/docs/models/o3 | HIGH |
| `o4` | — | 100000 | OpenAI o-series docs | MEDIUM — [ASSUMED] o4 follows o3 family per `feedback_model_names_representative.md` |

**Note on `_MODEL_OUTPUT_DEFAULTS` disjoint set:** o1 / o3 / o4 currently have NO entry in `_MODEL_OUTPUT_DEFAULTS` even though they're in `MODEL_CAPABILITIES`. The fallback path returns `_PROVIDER_DEFAULT_MAX_TOKENS["openai"] = 16384` for these. Adding `max_output_tokens` per D-074-08 will set a CAP of 100000 for these models, but the resolved request stays at 16384 unless the user overrides — so for o-series the clamp is a pure ceiling that never triggers under defaults. No behavior change at default settings.

### Google Gemini (verified via Vertex AI docs + Google Cloud model cards 2026-05-18)

| Model | _MODEL_OUTPUT_DEFAULTS (current) | Verified `max_output_tokens` | Source | Confidence |
|-------|----------|------------------------------|--------|------------|
| `gemini-2.5-pro` | 32768 | 65536 | Vertex AI docs (also AI/ML API: 65535) | HIGH |
| `gemini-2.5-flash` | 32768 | 65536 | ai.google.dev gemini-2.5-flash; Oracle GenAI docs concur | HIGH |
| `gemini-2.5-flash-lite` | 16384 | 65536 | Oracle GenAI gemini-2.5-flash-lite docs (same family) | MEDIUM |
| `gemini-3-flash-preview` | 32768 | 65536 | [ASSUMED] gemini-3 flash family follows 2.5 max-output convention | LOW — preview model, doc availability sparse |
| `gemini-3.1-pro-preview` | 32768 | 65536 | [ASSUMED] gemini-3.1-pro follows 2.5-pro max-output convention | LOW — preview model, doc availability sparse |

**Note on Gemini 3.x preview docs:** Vendor docs do not yet publish output cap specs for the 3.x preview line. Per `feedback_model_names_representative.md`, these IDs are representative-class labels — the planner should either accept the 65536 LOW-confidence value as a placeholder (with a `# preview — verify before GA promotion` inline comment) OR exclude the preview models from `max_output_tokens` and let them fall through to pass-through behavior per D-074-02. Either choice is acceptable per the seed's "OpenRouter/Ollama stay flexible" stance.

### OpenRouter upstream providers (verified via upstream docs 2026-05-18)

| Model | _MODEL_OUTPUT_DEFAULTS (current) | Verified `max_output_tokens` | Source | Confidence |
|-------|----------|------------------------------|--------|------------|
| `deepseek/deepseek-chat` | — (no entry) | 8192 | api-docs.deepseek.com (recommended for quality; hard API max 32768) | MEDIUM — choosing quality threshold 8192 |
| `deepseek/deepseek-reasoner` | — | 8192 | DeepSeek R1 docs (recommended for quality; up to 32k) | MEDIUM |
| `deepseek/deepseek-r1` | 16384 | 32768 | DeepSeek-R1 hard API max | HIGH — Azure AI Foundry confirms 32768 |
| `z-ai/glm-5.1` | — | 131072 | Together AI + OpenRouter glm-5.1 docs (200K context, 131K max output) | HIGH |
| `moonshotai/kimi-k2.5` | 65536 | 65536 | Atlas Cloud + OpenRouter docs (262144 hard cap but 65536 practical-step cap used in production) | MEDIUM — [ASSUMED] practical step cap |
| `moonshotai/kimi-k2.6` | — | 65536 | NVIDIA NIM + Kimi platform docs (262142 hard, 49152 per-step recommended) | MEDIUM |
| `minimax/minimax-01` | — | 16384 | [ASSUMED] minimax-01 (legacy/discontinued ID); no clear doc found | LOW — recommend pass-through |
| `minimax/minimax-m2.7` | 65536 | 131072 | OpenRouter + Vercel AI Gateway m2.7 specs | HIGH |
| `minimax/minimax-m2.5:free` | 16384 | 16384 | OpenRouter m2.5:free (free tier — conservative) | MEDIUM |

**Note on OpenRouter values:** OpenRouter is a router, not a source of truth — caps come from each upstream provider's model card. Where the practical cap (used today in `_MODEL_OUTPUT_DEFAULTS`) is significantly lower than the documented hard cap, the planner's task is to set `max_output_tokens` to the **hard API cap**, NOT the practical default. The two-layer model in D-074-05/06 keeps `_MODEL_OUTPUT_DEFAULTS` as the practical request size and the new `max_output_tokens` as the don't-exceed ceiling — they compose via `min()`.

**Aggregate Rule-1 deviation summary:** Of the 26 models, the most material drift from SEED-009's recommendations is the Anthropic Opus line (32000 → 128000). For the remaining models — for which SEED-009 didn't enumerate values — the planner has full discretion within the citations above. Recommend the planner lock the table as a "verified 2026-05-18" appendix in PLAN.md before execution so the executor doesn't re-verify mid-task.

---

## Standard Stack

This is a polish phase — no new dependencies. The stack is what's already installed.

### Core (no changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` | pinned in `backend/requirements.txt` | Anthropic SDK — receives clamped `max_tokens` | Already in use; no change |
| `openai` | pinned | OpenAI SDK + OpenRouter compat — clamped via `_resolve_max_tokens` | Already in use; no change |
| `google-genai` | pinned | Google Gemini SDK | Already in use; no change |
| `redis` (async) | pinned | Tested by hoisted fixture; singleton lives in `app.dependencies._redis` | Already in use; fixture resets singleton between tests |
| `pytest-asyncio` | pinned (`asyncio_mode = auto` per `backend/pytest.ini`) | Per-test event-loop scope — root cause of fixture-hoist requirement | Already in use; fixture works around its known per-function loop scope |
| `sse-starlette` | `>=2.4.x` (assertion-pinned in `test_059`) | Provides `AppStatus` singleton that gets reset by `_reset_sse_starlette_app_status` (stays local) | Already in use; do NOT bump unless re-validating fixture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypedDict extension | Pydantic `BaseModel` for registry | Rejected — config.py already uses TypedDict with `total=False` for `ModelCapability` (Phase 066 D-066-03 precedent) |
| `min()` clamp in `_resolve_max_tokens` | Per-provider clamp helpers | Rejected per D-074-04 — single chokepoint covers all providers; redundant per-provider logic |
| Hoist into root `tests/conftest.py` | Hoist into `tests/integration/conftest.py` | Rejected per D-074-13 — root conftest is for cross-suite hygiene (e.g., env var setup, Phase 073 pg-pool); integration-only fixture belongs in integration scope |

**Installation:** None — no new packages.

**Version verification:** Confirmed via inspection of `backend/requirements.txt` (no changes required for this phase).

---

## Architecture Patterns

### System Architecture Diagram (per-request flow)

```
User chat input @ localhost:5173
         ↓
   POST /threads/{tid}/messages (frontend)
         ↓
backend/app/api/threads.py send_message()
         ↓
    user_settings.active_provider
         ↓
  ┌──────┴─────────┬──────────────┬──────────────┐
  ↓                ↓              ↓              ↓
[anthropic]   [openai]       [google]      [openrouter]
  ↓                ↓              ↓              ↓
threads.py:1419   create_adaptive_streaming_chat()
_resolve_max_      ↓ (internally calls _resolve_max_tokens at L801)
tokens(None,       ↓
user_settings)     ↓
  ↓                ↓
  └──────┬─────────┘
         ↓
    openai_service._resolve_max_tokens()        ← SEED-009 CLAMP INSERTED HERE
         ↓                                         (one-line min() at bottom-of-function,
       explicit?                                    post-resolution, pre-return)
         ↓
       env override (MODEL_OUTPUT_LIMITS)
         ↓
       _MODEL_OUTPUT_DEFAULTS lookup
         ↓
       provider default fallback
         ↓
       ─────── CLAMP STEP (NEW) ───────
       cap = MODEL_CAPABILITIES[model].get("max_output_tokens")
       if cap and resolved > cap:
           logger.info(...)
           return cap
       return resolved
         ↓
   stream_anthropic() / client.chat.completions.create()
         ↓
   Provider API (no more 400 BadRequestError)
         ↓
   SSE → runs.status='completed'
```

### Recommended Project Structure (no changes)

```
backend/
├── app/
│   ├── config.py                              # MODEL_CAPABILITIES + new max_output_tokens field
│   ├── services/
│   │   ├── openai_service.py                  # _resolve_max_tokens clamp insertion
│   │   ├── anthropic_service.py               # NO CHANGE (D-074-04)
│   │   └── sub_agent_service.py               # NO CHANGE — flows through _resolve_max_tokens transparently
│   └── api/threads.py                         # NO CHANGE — dispatcher already passes resolved value
└── tests/
    ├── conftest.py                            # NO CHANGE per D-074-13 (Phase 073 pg-pool stays)
    └── integration/
        ├── conftest.py                        # NEW FILE — hoisted _reset_redis_singleton
        ├── test_058_concurrency.py            # unchanged; in 4-file gate
        ├── test_059_disconnect.py             # NO change to _reset_sse_starlette_app_status; gains Redis reset via inherited conftest
        ├── test_062_stream_replay.py          # DELETE local _reset_redis_singleton (lines 36-51)
        └── test_063_post_then_subscribe.py    # DELETE local _reset_redis_singleton (lines 45-62)
```

### Pattern 1: TypedDict Extension with `total=False` (Phase 066 D-066-03 precedent)
**What:** Add `max_output_tokens: int` to `ModelCapability` TypedDict.
**When to use:** Any registry-extension that should be partial-allowed (older entries stay valid).
**Example (the exact one-line addition):**
```python
# backend/app/config.py:66-78 — BEFORE
class ModelCapability(TypedDict, total=False):
    """Per-model capability registry entry.

    ``total=False`` so partial entries are allowed — only ``native_tools`` and
    ``provider`` were previously required; Phase 066 D-066-03 adds
    ``llm_call_timeout_seconds`` as optional. Models without this field fall
    back to the 180s unknown-model default at the lookup site
    (``get_per_call_timeout`` below).
    """
    native_tools: bool
    provider: str  # documentation only; actual provider from user settings
    llm_call_timeout_seconds: int  # Phase 066 D-066-03 — per-LLM-call deadline


# backend/app/config.py:66-78 — AFTER (Phase 074 SEED-009)
class ModelCapability(TypedDict, total=False):
    """Per-model capability registry entry.

    ``total=False`` so partial entries are allowed — only ``native_tools`` and
    ``provider`` were previously required; Phase 066 D-066-03 adds
    ``llm_call_timeout_seconds`` as optional, Phase 074 D-074-06 adds
    ``max_output_tokens`` as the hard API cap. Models without these fields
    fall back to runtime defaults at the lookup site.
    """
    native_tools: bool
    provider: str  # documentation only; actual provider from user settings
    llm_call_timeout_seconds: int  # Phase 066 D-066-03 — per-LLM-call deadline
    max_output_tokens: int  # Phase 074 D-074-06 — hard API cap (vendor docs); clamp ceiling
```

Then populate per-model in `MODEL_CAPABILITIES` (config.py:92-129) using the verified table above.

### Pattern 2: Single-Chokepoint Clamp (D-074-01)
**What:** Add one `min()` clamp at the bottom of `_resolve_max_tokens`, post-resolution, pre-return.
**When to use:** When multiple call paths need the same protection and they all funnel through one helper.
**Example (clamp insertion point):**
```python
# backend/app/services/openai_service.py:647-690 — BEFORE
def _resolve_max_tokens(
    explicit: int | None,
    user_settings: "UserEffectiveSettings | None",
) -> int:
    """Pick the right max_tokens for this call.

    Priority:
    1. Caller-supplied explicit value (rare — used by sub-agents etc.)
    2. LLM_MAX_OUTPUT_TOKENS env var, IF the user changed it from the package default.
    3. MODEL_OUTPUT_LIMITS env var — per-model override.
    4. _MODEL_OUTPUT_DEFAULTS — hardcoded per-model practical limits.
    5. _PROVIDER_DEFAULT_MAX_TOKENS — per-provider fallback.
    6. _FALLBACK_MAX_TOKENS for unknown/legacy providers.
    """
    if explicit is not None:
        return explicit
    # ... [resolution logic L664-686, unchanged] ...
    return _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)


# AFTER (Phase 074 SEED-009) — clamp inserted bottom-of-function
def _resolve_max_tokens(
    explicit: int | None,
    user_settings: "UserEffectiveSettings | None",
) -> int:
    """Pick the right max_tokens for this call.

    Priority:
    1. Caller-supplied explicit value (rare — used by sub-agents etc.)
    2. LLM_MAX_OUTPUT_TOKENS env var, IF the user changed it from the package default.
    3. MODEL_OUTPUT_LIMITS env var — per-model override.
    4. _MODEL_OUTPUT_DEFAULTS — hardcoded per-model practical limits.
    5. _PROVIDER_DEFAULT_MAX_TOKENS — per-provider fallback.
    6. _FALLBACK_MAX_TOKENS for unknown/legacy providers.

    Phase 074 D-074-01: After resolution, clamp against
    MODEL_CAPABILITIES[model]["max_output_tokens"] when an entry exists.
    Unknown models pass through unchanged (D-074-02).
    """
    if explicit is not None:
        resolved = explicit
    else:
        # ... [resolution logic L664-686, unchanged — assign to `resolved` instead of returning] ...
        resolved = _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)

    # Phase 074 D-074-01: Clamp against per-model hard cap (no-op if entry missing per D-074-02).
    model = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model:
        cap = MODEL_CAPABILITIES.get(model, {}).get("max_output_tokens")
        if cap and resolved > cap:
            logger.info(
                "clamped max_tokens for model=%s: %d -> %d",
                model, resolved, cap,
            )
            return cap
    return resolved
```

**Implementation note for the planner:** the current function uses `return` mid-flow at multiple priority levels. The cleanest refactor is to replace each `return X` with `resolved = X; ...flow to bottom` so the clamp gate gets all return paths. Either approach is acceptable as long as every priority branch flows through the clamp gate.

### Pattern 3: Hoisted Autouse Fixture (Phase 062 P02 deviation precedent)
**What:** Move a per-file autouse fixture into a `conftest.py` so all files in the directory inherit it.
**When to use:** When ≥2 files have an identical-or-near-identical copy of the same loop-binding workaround.
**Example (new file content):**
```python
# backend/tests/integration/conftest.py — NEW FILE (Phase 074 SEED-011 D-074-11)
"""Shared integration-test fixtures.

Phase 074 D-074-11: hoists ``_reset_redis_singleton`` from per-file copies in
``test_062_stream_replay.py`` (canonical at :36-51) and
``test_063_post_then_subscribe.py`` (verbatim copy at :45-62). The two local
copies were deleted in this commit; ``test_059_disconnect.py`` now inherits
the same protection that fixes the original SEED-011 fixture-teardown bug.

Phase 073's ``_reset_pg_pool_singleton`` (lives in ``backend/tests/conftest.py``)
is intentionally NOT hoisted here — Phase 074 D-074-13 keeps it at root scope
because asyncpg pools matter to unit + integration tests alike.

``_reset_sse_starlette_app_status`` stays in test_059_disconnect.py per D-074-12
(sse-starlette-specific; co-located version-pin assertion at 2.4.x).
"""
import pytest


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) — same loop-binding trap, different module.
    Required for any test that hits the real `get_redis()` singleton (no Redis
    dependency override). Hoisted from per-file copies per Phase 074 D-074-11.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**Imports it relies on:** only `pytest` and runtime `app.dependencies` (inside the fixture body to avoid import-order issues per the canonical pattern in test_062).

**Deletion targets after hoist:**
- `test_062_stream_replay.py` lines 36-51 (the `@pytest.fixture(autouse=True)` block, 16 lines including blank line above)
- `test_063_post_then_subscribe.py` lines 45-62 (the `@pytest.fixture(autouse=True)` block, 18 lines including blank line above)

**Collision audit — confirmed safe:**
- `backend/tests/integration/conftest.py` does NOT currently exist (verified via filesystem audit on 2026-05-18). Creating it is safe.
- The root `backend/tests/conftest.py` defines `_reset_pg_pool_singleton` (Phase 073) AND `redis_client` (Phase 061) AND `reset_mocks`. None of these name-collide with `_reset_redis_singleton`.
- pytest autouse fixtures at child-conftest scope **stack** with parent-conftest autouse fixtures (verified pattern from `pytest_asyncio` + pytest docs). Both root `_reset_pg_pool_singleton` AND the new `_reset_redis_singleton` will run on every integration test. Execution order: root → integration → file-local (so `_reset_pg_pool_singleton` runs before `_reset_redis_singleton`, both finish setup, then the test body runs).
- No race between the two: pg-pool reset and redis reset target different singletons (`_deps._pg_pool` vs `_deps._redis`), no shared state.

### Anti-Patterns to Avoid
- **Inserting the clamp inside `stream_anthropic`** (SEED-009 Path 1) — rejected per D-074-04. Misses OpenAI/Google/OpenRouter; redundant once the universal clamp ships.
- **Consolidating `_MODEL_OUTPUT_DEFAULTS` into `MODEL_CAPABILITIES`** — rejected per D-074-05. The two tables mean different things (practical request vs hard cap); merging would force behavior change on every model.
- **Hoisting `_reset_sse_starlette_app_status`** — rejected per D-074-12. The fixture carries an sse-starlette `2.4.x` version-pin assertion that's intentionally co-located with its consumer.
- **Family-stem keys (`model.rsplit("-", 1)[0]`)** — rejected per Claude's Discretion. Full snapshot IDs (`claude-haiku-4-5-20251001`) match the existing registry shape and avoid ambiguity when a future `-20260601` snapshot ships with a different cap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-model output-cap lookup | A second registry table parallel to MODEL_CAPABILITIES | Extend MODEL_CAPABILITIES with one optional field | Single source of truth; Phase 066 D-066-03 precedent; lookups already cached at module import time |
| Per-provider clamp logic | One clamp helper per provider in `*_service.py` | Universal clamp in `_resolve_max_tokens` | Every dispatcher already flows through `_resolve_max_tokens` (Anthropic at threads.py:1419, others via `create_adaptive_streaming_chat` at openai_service.py:801) |
| Loop-binding workaround | Per-file copy of the singleton-reset fixture | Hoisted autouse fixture in conftest | pytest semantics already handle inheritance + stacking; Phase 062 P02 / Phase 073 D-073-12 precedent |
| Test-fixture identification | Hand-grep'd version-pin checks scattered across files | Single assertion co-located with the affected fixture (`sse_starlette.__version__.startswith("2.4.")`) | The version-pin guard makes silent breakage on minor bumps loud |

**Key insight:** Both seeds are textbook "use the existing chokepoint" patterns. SEED-009 reuses `_resolve_max_tokens`. SEED-011 reuses pytest conftest inheritance. Neither needs new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Resolution returns mid-flow, skipping clamp
**What goes wrong:** `_resolve_max_tokens` has 6 priority levels that each `return X` directly. If the clamp is added at the bottom only, the early-return branches (e.g., `explicit is not None`) bypass it.
**Why it happens:** The function's current shape uses early `return` for each priority level.
**How to avoid:** Refactor so every priority assigns to a `resolved` variable, then a single bottom-of-function clamp gate runs unconditionally. Alternative: insert the clamp before each `return` (5 sites) — uglier, more error-prone. Recommended: one-time refactor to single-return.
**Warning signs:** Unit test for `explicit=65536, model=haiku-4-5` returns 65536 instead of clamped 64000 — indicates the explicit-branch bypasses the clamp.

### Pitfall 2: pytest autouse fixture order at conftest stacking
**What goes wrong:** Test relies on `_reset_pg_pool_singleton` AND `_reset_redis_singleton`, but only one is invoked (autouse failure).
**Why it happens:** pytest discovers fixtures from root conftest → directory conftest → file-local. If a fixture name collides across levels, the closer-scope one wins (overrides). They don't collide here (different names) but verify both run.
**How to avoid:** Add a one-liner sanity assertion in the new integration conftest's fixture body: `assert getattr(_deps, "_pg_pool", "sentinel") != "sentinel", "Phase 073 root fixture must run before this"` — optional but cheap to catch the failure mode if a future refactor moves things around.
**Warning signs:** Test prints a `RuntimeError: Event loop is closed` from asyncpg path instead of Redis path → root conftest fixture didn't run.

### Pitfall 3: D-074-13 violation — accidentally touching root conftest
**What goes wrong:** Plan 02 reflexively edits `backend/tests/conftest.py` instead of creating `backend/tests/integration/conftest.py`.
**Why it happens:** Both files are named `conftest.py`; in editor open-tabs they're easy to confuse.
**How to avoid:** Plan task description MUST specify full path (`backend/tests/integration/conftest.py`). Verify path in commit diff: `git diff --stat` should show ONE new file at that exact path, plus 2 deletions in test_062 / test_063, plus nothing in `backend/tests/conftest.py`.
**Warning signs:** `git diff backend/tests/conftest.py` returns non-empty in the plan-02 commit → revert immediately.

### Pitfall 4: sse-starlette version drift breaks test_059 silently
**What goes wrong:** A future dependency upgrade bumps sse-starlette to 2.5.x. The `assert sse_starlette.__version__.startswith("2.4.")` line in `_reset_sse_starlette_app_status` fails. test_059 errors during fixture setup (not test body), looking like a Phase 074 regression.
**Why it happens:** Phase 074 is the most-recent commit touching the test file; the version drift gets blamed on it.
**How to avoid:** Lock sse-starlette in `backend/requirements.txt` (it likely already is; the planner should confirm at plan time). If a future bump is intentional, the upgrade PR must re-validate the fixture against the new version and update the assertion.
**Warning signs:** `pytest test_059_disconnect.py` fails with `AssertionError: AppStatus reset fixture validated only for sse-starlette 2.4.x`.

### Pitfall 5: Anthropic doc drift between plan-time and execute-time
**What goes wrong:** Planner verifies `claude-haiku-4-5` = 64k at plan time. Two weeks later, Anthropic ships `claude-haiku-4-5-20260601` with an 80k cap. Executor uses old number; new haiku snapshot 400s.
**Why it happens:** Registry uses full snapshot ID (per Claude's Discretion in CONTEXT.md), but the assumption is "the haiku-4-5 snapshot we know about." A new snapshot is a new entry.
**How to avoid:** The seed's `re_open_triggers` already covers this ("Adding new Anthropic models to MODEL_CAPABILITIES — per-model max_tokens caps differ"). When a new snapshot ships, add a new registry entry — don't reuse the old one with a date-bumped key.
**Warning signs:** User reports `BadRequestError` on a model ID with a date not in the registry. The fix is to add the new entry, not amend the old one.

### Pitfall 6: Live UAT prompt is too short to trigger over-cap request
**What goes wrong:** SC#3 live UAT sends "Hello, write me a recipe" to haiku-4-5. Default request size is 8192 (from `_MODEL_OUTPUT_DEFAULTS`), which is well under 64k cap. Clamp never fires. UAT looks green but didn't actually test the clamp path.
**Why it happens:** The bug only surfaces when the env / settings layer pushes max_tokens above the cap. A nominal prompt doesn't.
**How to avoid:** UAT protocol must force the over-cap path. Two options per CONTEXT.md Claude's Discretion: (a) set `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` in `backend/.env` before sending the prompt — explicit override pushes the request above the cap; (b) set the user-settings llm_max_output_tokens slider to 65536 in the Settings UI (NOTE: this path is the `NATIVE_PROVIDERS` skip path per `openai_service.py:668` — Anthropic ignores the slider override). Option (a) is the reliable trigger. Verify the `clamped max_tokens` info log appears in backend stdout.
**Warning signs:** UAT shows `runs.status='completed'` but the backend log has no `clamped max_tokens` line — the clamp path didn't run; UAT didn't validate the fix.

---

## Code Examples

### Example 1: Verified Anthropic registry population
```python
# backend/app/config.py:92-129 — populate Anthropic block (verified 2026-05-18)
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    # ... [OpenAI block unchanged] ...

    # Anthropic direct — native tool_use
    # max_output_tokens verified against platform.claude.com/docs/en/about-claude/models/overview 2026-05-18
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000},
    "claude-opus-4-6":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000},
    "claude-sonnet-4-6":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240, "max_output_tokens": 64000},
    "claude-sonnet-4-5":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240, "max_output_tokens": 64000},
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90, "max_output_tokens": 64000},
    # ... [Google / OpenRouter blocks per verified table above] ...
}
```

### Example 2: Unit test for SEED-009 (SC#2)
```python
# backend/tests/unit/test_resolve_max_tokens.py — NEW FILE (Phase 074 Plan 01)
"""Unit test for SEED-009 (Phase 074): _resolve_max_tokens clamps against
MODEL_CAPABILITIES[model]["max_output_tokens"] when entry exists; passes
through unchanged when entry missing.

Covers SC#2 — haiku-4-5 64K boundary cases (under/at/over).
"""
import logging
from unittest.mock import MagicMock
import pytest

from app.services.openai_service import _resolve_max_tokens


@pytest.fixture
def haiku_settings():
    """UserEffectiveSettings configured for haiku-4-5-20251001."""
    s = MagicMock()
    s.active_provider = "anthropic"
    s.llm_model = "claude-haiku-4-5-20251001"
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    return s


@pytest.mark.parametrize("explicit,expected_returned,should_clamp", [
    (32000, 32000, False),   # under cap — pass through
    (64000, 64000, False),   # at cap — pass through (not strictly > cap)
    (65536, 64000, True),    # over cap — CLAMP fires
])
def test_clamp_haiku_4_5(haiku_settings, caplog, explicit, expected_returned, should_clamp):
    """SEED-009 SC#2 — clamp boundary cases for haiku-4-5 (cap=64000)."""
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(explicit, haiku_settings)
    assert result == expected_returned
    clamp_logs = [r for r in caplog.records if "clamped max_tokens" in r.message]
    if should_clamp:
        assert len(clamp_logs) == 1
        assert "claude-haiku-4-5-20251001" in clamp_logs[0].getMessage()
        assert "65536" in clamp_logs[0].getMessage()
        assert "64000" in clamp_logs[0].getMessage()
    else:
        assert len(clamp_logs) == 0


def test_unknown_model_passthrough(caplog):
    """D-074-02 — unknown model passes through unchanged, no clamp log."""
    s = MagicMock()
    s.active_provider = "anthropic"
    s.llm_model = "claude-haiku-9-9-some-future-snapshot"  # not in registry
    s.llm_max_output_tokens = 0
    with caplog.at_level(logging.INFO):
        result = _resolve_max_tokens(999999, s)
    assert result == 999999
    assert not any("clamped" in r.message for r in caplog.records)
```

### Example 3: Hoisted conftest verification command
```bash
# After Plan 02 commit — verify all 4 files green and clamp didn't break
cd backend && venv/Scripts/python -m pytest \
    tests/integration/test_058_concurrency.py \
    tests/integration/test_059_disconnect.py \
    tests/integration/test_062_stream_replay.py \
    tests/integration/test_063_post_then_subscribe.py \
    -q --tb=short

# Expected: 7 collected / 7 passed in <30s
#   test_058: 1 test (test_cross_tab_unblocked_during_sse)
#   test_059: 3 tests (3/3 pass — the SEED-011 fix)
#   test_062: 2 tests (test_replay_then_tail_to_terminal, test_replay_from_specific_offset)
#   test_063: 1 test (test_post_then_get_stream_renders_full_response)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `_MODEL_OUTPUT_DEFAULTS` alone (practical default, no hard cap) | `_MODEL_OUTPUT_DEFAULTS` + `MODEL_CAPABILITIES.max_output_tokens` (two-layer) | Phase 074 (this) | Composes via `min()`; backward-compatible — default request stays the same; cap protects from over-request |
| Per-file `_reset_redis_singleton` (test_062 + test_063 verbatim copy) | Hoisted to `tests/integration/conftest.py` | Phase 074 (this) | All current + future integration tests inherit reset; test_059 gains protection automatically |
| Phase 062 Plan 02 deviation: "per-file scope avoids surprising 058/059/061 tests" | Hoist scope is the integration directory — explicit benefit per SEED-011 protocol step 5 | Phase 074 (this) | 058 is in 4-file gate to confirm no regression; rationale change in deviation note for posterity |

**Deprecated/outdated:**
- The 2026-05-09 SEED-009 hint that Opus 4.7 caps at 32000 — superseded by live docs (128000). Planner should NOT use this older value.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | gpt-5.4 / gpt-5.4-mini / gpt-5.4-nano caps follow gpt-5.5 = 128000 | Per-model table → OpenAI | Low — these are representative-class labels per memory `feedback_model_names_representative.md`; cap mismatch yields BadRequestError surfaced via Resume button (D-063-04), same UX as the bug being fixed |
| A2 | o4 follows o3 family (100000 cap) | Per-model table → OpenAI | Low — same reasoning as A1 |
| A3 | gemini-3-flash-preview and gemini-3.1-pro-preview cap at 65536 like 2.5 family | Per-model table → Gemini | Medium — preview models, vendor docs sparse; recommend pass-through (omit field) as alternative |
| A4 | OpenRouter kimi-k2.5 / kimi-k2.6 practical step-cap is 65536 | Per-model table → OpenRouter | Low — kimi docs document 49152/step + 262k total; 65536 is the existing `_MODEL_OUTPUT_DEFAULTS` value, which works in production today |
| A5 | minimax-01 cap = 16384 (conservative placeholder) | Per-model table → OpenRouter | Medium — no clear doc; recommend pass-through (omit field) instead |
| A6 | pytest autouse fixtures stack additively across conftest levels without race | Pattern 3 audit | Low — verified via pytest docs + existing Phase 062 / 073 working precedents (`_reset_pg_pool_singleton` already stacks with `redis_client`) |

**If this table is non-empty, the planner should ask the user whether to (a) accept the assumptions verbatim, (b) downgrade ambiguous OpenRouter / Gemini preview entries to pass-through (omit `max_output_tokens`), or (c) further verify with live API probes.** Recommended default: (b) for the LOW-confidence rows (A3, A5).

---

## Open Questions (RESOLVED)

1. **For Gemini 3.x preview models and minimax-01, populate or omit?**
   - What we know: official vendor docs do not publish output caps; the models exist in the registry but are flagged "preview"/legacy.
   - What's unclear: should the planner set a LOW-confidence placeholder (`65536` for Gemini 3.x, `16384` for minimax-01) or omit the field and let D-074-02 pass-through behavior take over?
   - Recommendation: omit the field for these specific models. D-074-08 says "every currently-listed model gets it populated" — but per D-074-02's pass-through philosophy, an explicit "no cap because the vendor doesn't publish one" stance is more honest than a guessed value. The planner should call this out in PLAN.md as a discretion choice and surface to discuss-phase if uncertain.
   - **RESOLVED:** Plan 01 Task 1 omits `max_output_tokens` for `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, and `minimax/minimax-01`; D-074-02 pass-through covers these models until vendor docs publish hard caps.

2. **Does the `:exacto` variant model (`minimax/minimax-m2.7:exacto`) need a separate registry entry?**
   - What we know: STATE.md mentions `minimax/minimax-m2.7:exacto requested 207985 tokens / cap 204800` — context-window overflow, not output overflow. `:exacto` is OpenRouter's quality-routing suffix appended at `openai_service.py:838-840`, not a real upstream model variant.
   - What's unclear: does the runtime see `minimax/minimax-m2.7:exacto` as the model ID when querying `MODEL_CAPABILITIES`? If yes, the cap lookup returns nothing and the clamp passes through.
   - Recommendation: the planner verifies how `model` is resolved at the `_resolve_max_tokens` call site (post-`:exacto` rewrite or pre?). If post-rewrite, the registry needs `:exacto` entries OR the clamp lookup needs to strip the suffix. **This is a real edge case worth resolving at plan time** — recommend the planner add a defensive `model.split(":")[0]` lookup OR add the registry entry to a follow-up backlog seed.
   - **RESOLVED:** Plan 01 Task 2 strips ONLY the `:exacto` suffix via `model_id.removesuffix(":exacto")` before `MODEL_CAPABILITIES.get(...)` lookup; generic `split(":")[0]` rejected because it would also strip legitimate suffixes like `:free` on `minimax/minimax-m2.5:free` (which has its own registry entry).

---

## Environment Availability

No external dependencies — both seeds are pure-code changes plus pytest. The existing `backend/venv` Python interpreter and installed packages are sufficient.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv at `backend/venv/` | Pytest gate per CLAUDE.md | ✓ | per backend/requirements.txt | — |
| `pytest` + `pytest-asyncio` | 4-file gate | ✓ | `asyncio_mode = auto` per `backend/pytest.ini` | — |
| Redis (Docker container) | test_062 / test_063 (real Redis per redis_client fixture) | ✓ assumed | Docker-Compose-managed per CLAUDE.md | If unavailable: `docker compose -f docker-compose.dev.yml up -d` |
| Chrome DevTools MCP | Live UAT SC#3 (optional) | ✓ per `feedback_chrome_mcp_testing.md` | — | Manual click-through at `localhost:5173` |
| Live uvicorn @ localhost:8000 | Live UAT SC#3 | required at UAT time | — | None — UAT requires live backend |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (asyncio_mode=auto) |
| Config file | `backend/pytest.ini` (existing, unchanged) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_resolve_max_tokens.py -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py tests/integration/test_059_disconnect.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py tests/unit/test_resolve_max_tokens.py -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| POLISH-SEED-009-01 (boundary) | `_resolve_max_tokens` clamps haiku-4-5 at 64000 for over-cap requests; passes through under-cap | unit (parametrize 3 cases) | `pytest tests/unit/test_resolve_max_tokens.py::test_clamp_haiku_4_5 -x` | ❌ Wave 0 — NEW FILE |
| POLISH-SEED-009-01 (passthrough) | Unknown model returns requested value unchanged, no clamp log | unit | `pytest tests/unit/test_resolve_max_tokens.py::test_unknown_model_passthrough -x` | ❌ Wave 0 |
| POLISH-SEED-009-01 (live) | Haiku run with forced over-cap reaches `runs.status='completed'` + `clamped max_tokens` log | live UAT (manual + Chrome MCP) | localhost:5173 with `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` | n/a — runtime |
| POLISH-SEED-011-01 (core) | `test_059_disconnect.py` 3/3 PASS without `RuntimeError: Event loop is closed` | integration | `pytest tests/integration/test_059_disconnect.py -q` | ✅ exists (the file's the target of the fix) |
| POLISH-SEED-011-01 (regression) | test_058/062/063 still PASS after hoist (no fixture-collision regression) | integration | `pytest tests/integration/test_058_concurrency.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py -q` | ✅ all 3 exist |

### Sampling Rate
- **Per task commit:** Plan 01 → `pytest tests/unit/test_resolve_max_tokens.py -q` (sub-1s). Plan 02 → 4-file gate command above (≤30s).
- **Per wave merge:** Both Plan 01 unit + Plan 02 integration gate.
- **Phase gate:** Full suite green before `/gsd:verify-work`. Additionally: live UAT SC#3 with the `MODEL_OUTPUT_LIMITS` override technique (see Pitfall 6).

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_resolve_max_tokens.py` — NEW FILE, covers POLISH-SEED-009-01 boundary + passthrough cases
- [ ] `backend/tests/integration/conftest.py` — NEW FILE, hoists `_reset_redis_singleton` (this IS the fix for POLISH-SEED-011-01, not a test of it)

**Framework install:** None — pytest + pytest-asyncio already installed via `backend/requirements.txt`.

**Live UAT note (no automated harness):** SC#3 lives in a human-driven loop because the over-cap path needs an env-override-driven prompt against a live Anthropic key. Phase 064 fixture harness (deferred) would automate this; for Phase 074 the manual UAT protocol is sufficient.

---

## Security Domain

**Scope:** Both seeds touch backend code paths but do NOT affect authentication, RLS, secrets, or cryptography. The new `max_output_tokens` field is non-secret config that mirrors public vendor documentation. The clamp log line is identifier-only (model name + integer values from public registry); no token leak risk.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — (no auth surface touched) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (no new RLS, no new endpoint) |
| V5 Input Validation | partial | The clamp itself is a defensive input validation — refuses to pass user-overridden `MODEL_OUTPUT_LIMITS` values above vendor caps |
| V6 Cryptography | no | — |
| V7 Error Handling & Logging | yes | Log format follows Phase 073 T-073-04 identifier-only pattern (no value leak); model names are public registry keys, integer caps are public vendor docs |

### Known Threat Patterns for backend Python + pytest

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator-set env var bypasses provider hard cap (`MODEL_OUTPUT_LIMITS=foo=99999`) | Tampering of user input | The clamp at `_resolve_max_tokens` enforces vendor cap regardless of env override — this IS the mitigation Phase 074 adds |
| Log-injection via model name in registry key | Information disclosure | Mitigated: model IDs in `MODEL_CAPABILITIES` are static dict keys defined in source, not user-controlled |
| Test fixture state leak across tests reveals secrets | Information disclosure | Mitigated by existing `reset_mocks` autouse + Phase 073 `_reset_pg_pool_singleton` + new `_reset_redis_singleton`; this phase strengthens the test-isolation posture |

---

## Project Constraints (from CLAUDE.md)

| Directive | Phase 074 Compliance |
|-----------|----------------------|
| Python backend must use a `venv` virtual environment | Test gates use `cd backend && venv/Scripts/python -m pytest …` per D-074-14 |
| No LangChain, no LangGraph — raw SDK calls only | No new dependencies; `anthropic.Anthropic()` SDK call path at anthropic_service.py:144 unchanged |
| Use Pydantic for structured LLM outputs | N/A — phase doesn't add LLM output parsing |
| All tables need RLS | N/A — no migration |
| Stream chat responses via SSE | N/A — no streaming changes |
| Stateless chat completions | N/A — no completion-flow changes |
| Ingestion is manual file upload only | N/A |
| Schema changes ship as numbered SQL migrations | N/A — no migration |
| Supabase Realtime is best-effort hint | N/A |
| Do not run blocking I/O directly inside async handlers | N/A — phase doesn't touch handler code |
| Single uvicorn worker | N/A |
| Settings live in `user_settings` / `app_settings` | The new `max_output_tokens` field is **code config**, not a setting. Per D-074-09, this is intentional — DB-backed override deferred to Phase 081.1 / SEED-024 |

---

## Sources

### Primary (HIGH confidence)

- [Anthropic Models Overview (current)](https://platform.claude.com/docs/en/about-claude/models/overview) — opus-4-7 (128k), sonnet-4-6 (64k), haiku-4-5 (64k); legacy table for opus-4-6 (128k) and sonnet-4-5 (64k). Verified 2026-05-18.
- [`backend/app/config.py:66-129`](backend/app/config.py) — current `ModelCapability` TypedDict + 26-entry `MODEL_CAPABILITIES` registry
- [`backend/app/services/openai_service.py:592-690`](backend/app/services/openai_service.py) — `_MODEL_OUTPUT_DEFAULTS` + `_resolve_max_tokens` chokepoint (clamp insertion point)
- [`backend/app/services/openai_service.py:801`](backend/app/services/openai_service.py) — `create_adaptive_streaming_chat` calls `_resolve_max_tokens` (covers OpenAI / Google / OpenRouter / Ollama)
- [`backend/app/api/threads.py:1419`](backend/app/api/threads.py) — Anthropic dispatcher explicit `_resolve_max_tokens` call
- [`backend/app/services/anthropic_service.py:128-169`](backend/app/services/anthropic_service.py) — receives clamped value; unchanged per D-074-04
- [`backend/tests/integration/test_062_stream_replay.py:36-51`](backend/tests/integration/test_062_stream_replay.py) — canonical `_reset_redis_singleton` template
- [`backend/tests/integration/test_063_post_then_subscribe.py:45-62`](backend/tests/integration/test_063_post_then_subscribe.py) — verbatim copy to delete
- [`backend/tests/integration/test_059_disconnect.py:63-94`](backend/tests/integration/test_059_disconnect.py) — `_reset_sse_starlette_app_status` (stays local per D-074-12)
- [`backend/tests/conftest.py:175-199`](backend/tests/conftest.py) — Phase 073 `_reset_pg_pool_singleton` (untouched per D-074-13)
- [Phase 066 D-066-03 precedent](.planning/milestones/v2.5-phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md) — extend MODEL_CAPABILITIES with a new optional field; same one-line TypedDict pattern
- [`.planning/phases/073-asyncpg-pool-integration/073-CONTEXT.md`](.planning/phases/073-asyncpg-pool-integration/073-CONTEXT.md) — D-073-08 / T-073-04 identifier-only log format precedent
- [`.planning/seeds/SEED-009-claude-haiku-max-tokens-cap.md`](.planning/seeds/SEED-009-claude-haiku-max-tokens-cap.md) — original bug surface
- [`.planning/seeds/SEED-011-test-059-fixture-teardown.md`](.planning/seeds/SEED-011-test-059-fixture-teardown.md) — root cause + 5-step protocol

### Secondary (MEDIUM-HIGH confidence, verified via WebSearch + multiple sources)

- [GPT-5.5 model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.5) — 128k max output tokens (HIGH)
- [Gemini 2.5 Flash | Google AI for Developers](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) — 65535 max output (HIGH)
- [Vertex AI gemini-2.5-pro docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro) — 65536 max output (HIGH)
- [OpenRouter Kimi K2.5](https://openrouter.ai/moonshotai/kimi-k2.5) — 262144 hard / 65536 step (MEDIUM)
- [MiniMax M2.7 - OpenRouter](https://openrouter.ai/minimax/minimax-m2.7) — 131072 max output (HIGH)
- [GLM-5.1 API | Together AI](https://www.together.ai/models/glm-51) — 131072 max output (HIGH)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing) — 8192 quality / 32768 hard cap (HIGH)
- [Azure GPT-4o-mini token limit thread](https://community.openai.com/t/gpt-4o-mini-max-token-16-384/927284) — 16384 max output (MEDIUM)
- [OpenAI o3 model page](https://platform.openai.com/docs/models/o3) — 100000 max output (HIGH)
- [GitHub issue: Haiku 4.5 64K output tokens](https://github.com/anthropics/claude-code/issues/9621) — corroborates Anthropic 64k cap (MEDIUM, third-party)

### Tertiary (LOW confidence — flagged in Assumptions Log, recommend pass-through fallback)

- Gemini 3.x preview model output caps — no published vendor spec; flagged A3
- gpt-5.4 / o4 specs — representative-class IDs per user memory `feedback_model_names_representative.md`; flagged A1, A2
- minimax-01 legacy ID — no clear doc; flagged A5

---

## Metadata

**Confidence breakdown:**
- Anthropic per-model caps: HIGH — verified live at platform.claude.com on 2026-05-18; SEED-009 Rule-1 deviation for Opus 4.7 / 4.6 (32000 → 128000) surfaced.
- OpenAI per-model caps: HIGH for current models (gpt-5 / 5.5 / o3); MEDIUM for representative IDs (gpt-5.4 family, o4) flagged in assumptions.
- Google Gemini caps: HIGH for 2.5 family (Vertex + Oracle GenAI corroborate); LOW for 3.x preview (no vendor spec).
- OpenRouter caps: HIGH for GLM-5.1, MiniMax m2.7; MEDIUM for Kimi (multi-source agreement); LOW for minimax-01.
- TypedDict + clamp pattern: HIGH — Phase 066 D-066-03 precedent + reviewed `_resolve_max_tokens` source verbatim.
- Conftest hoist + autouse stacking: HIGH — Phase 062 P02 + Phase 073 D-073-12 precedents; verified pytest semantics + working co-existence of `_reset_pg_pool_singleton` and `redis_client` today.
- Pitfalls: HIGH — drawn from actual function shape (early-return trap) + STATE.md history (`:exacto` context-overflow report; sse-starlette pin precedent).

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (vendor docs may update; recommend re-verify Anthropic table at plan time per D-074-07).

## RESEARCH COMPLETE
