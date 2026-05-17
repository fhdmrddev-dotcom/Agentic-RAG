# Phase 074: SEED-009 + SEED-011 Polish Bundle - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 7 (2 created, 5 modified)
**Analogs found:** 7 / 7 (all exact or in-file)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/config.py` (MODIFIED) | config / registry | request-response (lookup) | self — extend in place; precedent: same-file Phase 066 D-066-03 `llm_call_timeout_seconds` addition (lines 66-78, 92-129) | exact (in-file precedent) |
| `backend/app/services/openai_service.py` (MODIFIED) | service / resolver | request-response (transform) | self — current `_resolve_max_tokens` lines 647-687 is the target; clamp insertion point | exact (in-file modification) |
| `backend/tests/integration/conftest.py` (NEW) | test fixture (autouse, pytest-asyncio loop-bound singleton reset) | event-driven (pytest setup/teardown) | `backend/tests/conftest.py` (root conftest `_reset_pg_pool_singleton` autouse @ lines 175-198) — same autouse shape, different scope (integration vs root) | exact (sibling pattern, different conftest level) |
| `backend/tests/unit/test_resolve_max_tokens.py` (NEW) | test (unit, parametrize) | request-response (function call assertion) | `backend/tests/unit/test_module7_tools.py:21-40` (parametrize-3-cases shape) + `backend/tests/unit/test_openai_service.py:1-46` (openai_service mock-patching shape) + `backend/tests/unit/test_settings.py:10-43` (boundary-case assertion shape) | strong composite |
| `backend/tests/integration/test_059_disconnect.py` (MODIFIED) | test (integration) | event-driven | self — gains inherited autouse via new sibling `integration/conftest.py`; **no fixture body change**; `_reset_sse_starlette_app_status` at lines 63-94 stays put per D-074-12 | exact (no-op consumer of hoist) |
| `backend/tests/integration/test_062_stream_replay.py` (MODIFIED) | test (integration) | event-driven | self — DELETE local `_reset_redis_singleton` at lines 36-51 after hoist | exact (deletion target) |
| `backend/tests/integration/test_063_post_then_subscribe.py` (MODIFIED) | test (integration) | event-driven | self — DELETE local `_reset_redis_singleton` at lines 45-62 after hoist | exact (deletion target) |

## Pattern Assignments

### `backend/app/config.py` (config / registry — EXTEND TypedDict + 26 entries)

**Analog:** Same file — Phase 066 D-066-03 precedent inside `config.py` itself shows the exact one-line TypedDict extension shape.

**Current `ModelCapability` TypedDict** (`backend/app/config.py:66-78` — BEFORE Phase 074):
```python
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
```

**Pattern to copy — add ONE LINE inside the TypedDict** (the exact Phase 066 shape — adding a single `name: type  # Phase 066 D-066-03 — comment` line):
```python
# AFTER Phase 074 — append one field with phase-tagged comment
    max_output_tokens: int  # Phase 074 D-074-06 — hard API cap (vendor docs); clamp ceiling
```

**Registry population pattern** (`backend/app/config.py:92-129` — current shape of `MODEL_CAPABILITIES` dict-literal):
```python
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    # OpenAI — proven native tool support
    "gpt-4o":       {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180},
    "gpt-4o-mini":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    # ... 23 more entries ...
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90},
    # Google direct — native function calling
    "gemini-2.5-pro":         {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 240},
    # OpenRouter — mixed; start safe with structured mode
    "minimax/minimax-m2.5:free":  {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
}
```

**Per-entry update pattern (the diff each line takes):**
```python
# BEFORE
"claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90},
# AFTER (Phase 074 SEED-009)
"claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90, "max_output_tokens": 64000},
```

**Verified per-model values** (planner MUST use RESEARCH.md `Verified per-model max_output_tokens registry` table; key Anthropic-line Rule-1 deviation: Opus 4.7 + 4.6 = **128000** not 32000).

**Comment-block precedent** (above `MODEL_CAPABILITIES`, lines 80-91 — keep this comment block as-is; Phase 074 may append a one-line note about the new field):
```python
# Capability registry: which models support native API tool calling.
# Unknown models default to native_tools=False (structured mode).
# User-extensible: add new models here after testing.
#
# Phase 066 D-066-03: per-model `llm_call_timeout_seconds` carries the
# per-LLM-call deadline (seconds). The matrix follows RESEARCH.md A1:
# ...
# Resolved by ``get_per_call_timeout(model_id, settings)`` below.
```

**Read-site pattern** (`get_per_call_timeout` at `config.py:154-183` — shows the canonical `.get(model_id, {})` + `if "field" in cap` fallback shape that the new clamp at `_resolve_max_tokens` should mirror; lines 177-183 are the key 3 lines):
```python
    # 2. Per-model registered default
    cap = MODEL_CAPABILITIES.get(model_id, {})
    if "llm_call_timeout_seconds" in cap:
        return cap["llm_call_timeout_seconds"]  # type: ignore[typeddict-item]

    # 3. Unknown-model fallback
    return DEFAULT_LLM_CALL_TIMEOUT_SECONDS
```

This is the exact shape D-074-02 mandates for the clamp lookup (registry-miss = passthrough).

---

### `backend/app/services/openai_service.py` (service / resolver — INSERT CLAMP)

**Analog:** Self — current `_resolve_max_tokens` body at lines 647-687.

**Current function** (`backend/app/services/openai_service.py:647-687` — verbatim from the file, six `return` statements all of which need to flow through the new clamp gate per RESEARCH.md Pitfall 1):
```python
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
        return explicit                                            # Early-return #1

    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

    # For native providers: skip user override to prevent stale slider values
    # from silently capping output. (GEN-05 defense-in-depth)
    if provider.lower() not in NATIVE_PROVIDERS:
        user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
        if user_max_tokens > 0:
            return user_max_tokens                                  # Early-return #2

    env_val = settings.llm_max_output_tokens
    env_default = 8192  # matches the default in config.py
    if env_val != env_default:
        # User deliberately set LLM_MAX_OUTPUT_TOKENS in .env — respect it for all providers
        return env_val                                              # Early-return #3

    model = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model:
        env_overrides = _parse_model_output_limits(settings.model_output_limits)
        if model in env_overrides:
            return env_overrides[model]                             # Early-return #4
        if model in _MODEL_OUTPUT_DEFAULTS:
            return _MODEL_OUTPUT_DEFAULTS[model]                    # Early-return #5

    return _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)  # Early-return #6
```

**6 early-return branches** that the clamp must cover per RESEARCH.md Pitfall 1. Recommended refactor: replace each `return X` with `resolved = X; <fall through>` and add a single bottom-of-function clamp gate.

**Pattern to insert — clamp gate** (drop in at bottom of function, after assigning `resolved` from every former return-site):
```python
    # Phase 074 D-074-01: Clamp against per-model hard cap (no-op if entry missing per D-074-02).
    model_id = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model_id:
        cap = MODEL_CAPABILITIES.get(model_id, {}).get("max_output_tokens")
        if cap and resolved > cap:
            logger.info(
                "clamped max_tokens for model=%s: %d -> %d",
                model_id, resolved, cap,
            )
            return cap
    return resolved
```

**Imports already in place** (verified at `openai_service.py:1-100` — `MODEL_CAPABILITIES` is already imported into this module; do NOT add a new import unless `MODEL_CAPABILITIES` is not yet visible — verify before writing the clamp).

**Logger pattern** (identifier-only `%s` + integer `%d` format — mirrors Phase 073 T-073-04 precedent at `backend/app/api/threads.py:2719-2722`):
```python
# Phase 073 T-073-04 precedent — identifier-only log format, NO secret leak
logger.warning(
    "runs.usage missing for run=%s provider=%s model=%s",
    run_id, _resolved_provider, _resolved_model,
)
```
The Phase 074 clamp log follows the same shape: `model=%s` (identifier from public registry), `%d -> %d` (integer caps from public vendor docs). No token-value leak risk.

**Log-level decision** (D-074-03 mandates `logger.info` not `logger.warning`): the clamp is a benign protective action, not an error; `info` is the right level per the seed.

---

### `backend/tests/integration/conftest.py` (NEW FILE — hoisted autouse fixture)

**Analog:** `backend/tests/conftest.py:175-198` — Phase 073 D-073-12 `_reset_pg_pool_singleton`. Same autouse shape, different conftest level (root vs integration), different singleton (pg_pool vs redis).

**Imports pattern** (mirror the root conftest's minimal import block; `pytest` only at module level — `app.dependencies` imported inside the fixture body to avoid import-order issues, per the canonical shape in test_062):
```python
"""Shared integration-test fixtures.

Phase 074 D-074-11: hoists ``_reset_redis_singleton`` from per-file copies in
``test_062_stream_replay.py`` (canonical at :36-51) and
``test_063_post_then_subscribe.py`` (verbatim copy at :45-62). The two local
copies are deleted in this commit; ``test_059_disconnect.py`` now inherits
the same protection that fixes the original SEED-011 fixture-teardown bug.

Phase 073's ``_reset_pg_pool_singleton`` (lives in ``backend/tests/conftest.py``)
is intentionally NOT hoisted here — Phase 074 D-074-13 keeps it at root scope
because asyncpg pools matter to unit + integration tests alike.

``_reset_sse_starlette_app_status`` stays in test_059_disconnect.py per D-074-12
(sse-starlette-specific; co-located version-pin assertion at 2.4.x).
"""
import pytest
```

**Autouse fixture body** (verbatim from `backend/tests/integration/test_062_stream_replay.py:36-51` — the canonical template; identical to `test_063_post_then_subscribe.py:45-62`):
```python
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

**Sibling-pattern reference** (`backend/tests/conftest.py:175-198` — Phase 073 root-level autouse for the asyncpg pool singleton; PATTERN of "autouse + dep singleton reset", DIFFERENT scope choice):
```python
@pytest_asyncio.fixture(autouse=True)
async def _reset_pg_pool_singleton():
    """Phase 073 D-073-12 — reset app.dependencies._pg_pool between tests.

    asyncpg pools are event-loop-bound (Pitfall 1). pytest-asyncio creates a
    fresh loop per test (asyncio_mode=auto). A singleton created in test N's
    loop, reused by test N+1, raises RuntimeError("Event loop is closed").

    Mirrors the per-file _reset_redis_singleton fixture in test_062_stream_replay
    (Phase 062 introduced; Phase 074 SEED-011 formalizes suite-wide). Promoted
    to top-level conftest so any test importing get_pg_pool() inherits the reset.

    Must be pytest_asyncio.fixture (NOT pytest.fixture) — teardown awaits
    pool.close().
    """
    import app.dependencies as _deps
    _deps._pg_pool = None
    yield
    if _deps._pg_pool is not None:
        try:
            await _deps._pg_pool.close()
        except Exception:
            pass
        _deps._pg_pool = None
```

**Key differences vs the root pg-pool analog:**
1. Use `@pytest.fixture` (NOT `@pytest_asyncio.fixture`) — the redis singleton is a plain Python attribute, no `await close()` needed in teardown.
2. Body is synchronous (no `async def`) — also distinct from the asyncpg sibling.
3. Scope is `backend/tests/integration/conftest.py` (sub-directory), NOT `backend/tests/conftest.py` (root). Per D-074-13, do NOT touch root.

**No-collision verification** (pre-write check the planner runs at task time):
- `ls backend/tests/integration/conftest.py` MUST return non-zero (file doesn't yet exist; verified 2026-05-18).
- After write: `git diff --stat` shows ONE new file at exactly that path + 2 deletions in test_062 / test_063, plus ZERO bytes touched in `backend/tests/conftest.py` (Pitfall 3 sentinel).

---

### `backend/tests/unit/test_resolve_max_tokens.py` (NEW FILE — unit test, parametrize 3 cases)

**Analog:** Composite of three sibling files in `backend/tests/unit/`:
- `test_module7_tools.py:21-40` — parametrize-multi-case decorator shape
- `test_openai_service.py:1-46` — openai_service unit-test mock-patching shape
- `test_settings.py:10-43` — boundary-case assertions (min/at-boundary/max)

**Imports pattern** (mirror `test_openai_service.py:1-7` — module docstring + `unittest.mock` + `pytest` + direct import of the function under test):
```python
"""Unit test for SEED-009 (Phase 074): _resolve_max_tokens clamps against
MODEL_CAPABILITIES[model]["max_output_tokens"] when entry exists; passes
through unchanged when entry missing.

Covers SC#2 — haiku-4-5 64K boundary cases (under/at/over).
"""
import logging
from unittest.mock import MagicMock
import pytest

from app.services.openai_service import _resolve_max_tokens
```

**Fixture pattern for synthetic UserEffectiveSettings** (mirrors the `MagicMock` settings approach used at `test_openai_service.py:13-15` — `with patch("app.services.openai_service.settings") as mock_settings: mock_settings.attr = val`; for THIS new test the right shape is a per-test `MagicMock` shaped to UserEffectiveSettings):
```python
@pytest.fixture
def haiku_settings():
    """UserEffectiveSettings configured for haiku-4-5-20251001."""
    s = MagicMock()
    s.active_provider = "anthropic"
    s.llm_model = "claude-haiku-4-5-20251001"
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    return s
```

**Parametrize-3-cases pattern** (verbatim shape from `test_module7_tools.py:21-22`):
```python
@pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
def test_tool_has_type_function(self, tool):
    assert tool["type"] == "function"
```

**For SEED-009 the parametrize takes 3-tuple form** (per RESEARCH.md Code Examples §Example 2):
```python
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
```

**Unknown-model passthrough test** (D-074-02 — second `def test_...` in same file):
```python
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

**Boundary-test precedent for shape** (`test_settings.py:10-28` — min/valid/max + above-max validation pattern is the strongest existing analog for "test 3 boundary cases of a single function"):
```python
def test_sub_agent_output_tokens_field_range():
    """SettingsUpdate rejects sub_agent_max_output_tokens outside 4096-65536."""
    from pydantic import ValidationError
    from app.api.settings import SettingsUpdate

    # Valid boundary values must be accepted
    s_min = SettingsUpdate(sub_agent_max_output_tokens=4096)
    assert s_min.sub_agent_max_output_tokens == 4096

    s_max = SettingsUpdate(sub_agent_max_output_tokens=65536)
    assert s_max.sub_agent_max_output_tokens == 65536

    # Below minimum must raise ValidationError
    with pytest.raises(ValidationError):
        SettingsUpdate(sub_agent_max_output_tokens=4095)

    # Above maximum must raise ValidationError
    with pytest.raises(ValidationError):
        SettingsUpdate(sub_agent_max_output_tokens=65537)
```

This test uses 4 discrete assert blocks; the SEED-009 test uses parametrize over 3 cases — slightly different shape, same boundary-coverage intent.

---

### `backend/tests/integration/test_059_disconnect.py` (MODIFIED — passive beneficiary)

**Analog:** Self. The fix for this file is achieved by writing the new `backend/tests/integration/conftest.py` (which the file inherits). The file itself is **not edited** — its `_reset_sse_starlette_app_status` fixture stays put per D-074-12.

**Preserved fixture** (`test_059_disconnect.py:63-94` — must NOT be touched in Phase 074; the version-pin assertion at line 83 is the load-bearing guard):
```python
@pytest.fixture(autouse=True)
def _reset_sse_starlette_app_status():
    """Reset sse-starlette's module-level AppStatus.should_exit_event before each test.

    sse-starlette caches `AppStatus.should_exit_event = anyio.Event()` on the
    first call to `_listen_for_exit_signal()`. With pytest's per-function
    asyncio loop scope (configured in pytest.ini via asyncio_mode = auto),
    each test gets a fresh loop, but the cached event remains bound to the
    FIRST loop that created it. A second test awaiting on it raises
    `RuntimeError: Event is bound to a different event loop`.

    This fixture clears the cached event before each test so sse-starlette
    creates a fresh one per test loop.

    WR-07: assert the sse-starlette version we validated this against — any
    minor-version bump that renames or relocates AppStatus would silently
    break the fixture without obvious failure mode otherwise. Currently
    pinned to 2.4.x in requirements.txt; bump this guard alongside the pin.
    """
    import sse_starlette
    assert sse_starlette.__version__.startswith("2.4."), (
        f"AppStatus reset fixture validated only for sse-starlette 2.4.x; "
        f"installed version {sse_starlette.__version__!r} may have moved or "
        f"renamed AppStatus. Re-validate fixture before bumping the version "
        f"assertion."
    )
    from sse_starlette.sse import AppStatus
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
    yield
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
```

**Cross-import already in place** at `test_062_stream_replay.py:31` and `test_063_post_then_subscribe.py:40`:
```python
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402
```
These cross-imports are also preserved in Phase 074 (sse-starlette stays per D-074-12).

---

### `backend/tests/integration/test_062_stream_replay.py` (MODIFIED — delete local fixture)

**Analog:** Self. After hoist, delete the local fixture body.

**Deletion target** (`test_062_stream_replay.py:36-51` — exactly 16 lines; canonical template — the planner's hoist source):
```python
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) — same loop-binding trap, different module.
    Required for Phase 062's stream tests because the route handler hits the
    real `get_redis()` singleton (no Redis dependency override).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**What stays** (lines 31, 33 — unrelated cross-import + test thread UUID — keep):
```python
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())
```

---

### `backend/tests/integration/test_063_post_then_subscribe.py` (MODIFIED — delete local fixture)

**Analog:** Self. After hoist, delete the local fixture body.

**Deletion target** (`test_063_post_then_subscribe.py:45-62` — verbatim copy of test_062's template; 18 lines including the trailing blank line before `@pytest.mark.asyncio`):
```python
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) — same loop-binding trap, different module.
    Required for any test that hits the real `get_redis()` singleton (no Redis
    dependency override). Verbatim copy from test_062_stream_replay.py:36-51
    per D-062-14 / 063-PATTERNS.md "Shared Patterns: Test fixture: Redis
    singleton reset" mandate.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**What stays** (line 40 — sse-starlette cross-import; line 42 — THREAD_A; line 65+ — the actual test function):
```python
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())
```

---

## Shared Patterns

### Pattern A — TypedDict extension with `total=False` (D-074-06 / Phase 066 D-066-03 precedent)
**Source:** `backend/app/config.py:66-78`
**Apply to:** `backend/app/config.py` ONLY (this is a one-file pattern; not cross-cutting)
**Rule:** When adding a new optional field to an existing `TypedDict(total=False)` registry: append the field declaration as the LAST line in the class body, tag with a `# Phase NNN D-NNN-NN — short rationale` comment, and rely on `.get()` (registry-miss yields no-op) at every read site.

```python
class ModelCapability(TypedDict, total=False):
    native_tools: bool
    provider: str
    llm_call_timeout_seconds: int  # Phase 066 D-066-03 — per-LLM-call deadline
    max_output_tokens: int  # Phase 074 D-074-06 — hard API cap (vendor docs); clamp ceiling
```

Read-site shape (mirror `get_per_call_timeout` at lines 178-180):
```python
cap = MODEL_CAPABILITIES.get(model_id, {}).get("max_output_tokens")
if cap and resolved > cap:
    ...
```

### Pattern B — Identifier-only log format (Phase 073 T-073-04)
**Source:** `backend/app/api/threads.py:2719-2722`
**Apply to:** `backend/app/services/openai_service.py` (the new clamp log line)
**Rule:** Log lines that reference user-or-secret-adjacent data MUST use `%s`/`%d` placeholders for IDs and integers only — never embed user content, API keys, or token contents.

```python
# Phase 073 T-073-04 precedent — identifier-only log format, NO content leak
logger.warning(
    "runs.usage missing for run=%s provider=%s model=%s",
    run_id, _resolved_provider, _resolved_model,
)
```

Phase 074 clamp log follows the same shape:
```python
logger.info(
    "clamped max_tokens for model=%s: %d -> %d",
    model_id, resolved, cap,
)
```

Why no leak: `model_id` is a static dict key (public registry); `resolved` is the post-resolution integer (bounded by env or registry); `cap` is the public vendor doc value. Zero token-content escapes.

### Pattern C — Autouse fixture for pytest-asyncio loop-bound singleton reset
**Source primary:** `backend/tests/conftest.py:175-198` (Phase 073 D-073-12, root-level, asyncpg pool)
**Source secondary:** `backend/tests/integration/test_062_stream_replay.py:36-51` (canonical Redis template — the file being hoisted FROM)
**Apply to:** `backend/tests/integration/conftest.py` (NEW FILE — D-074-11 hoist target)
**Rule:** When ≥2 integration tests need the same pytest-asyncio loop-bound singleton reset, hoist into the nearest `conftest.py` that covers all consumers. Use `@pytest.fixture(autouse=True)` for sync singletons; `@pytest_asyncio.fixture(autouse=True)` for async singletons (requires `await close()`).

Sync template (Redis — Phase 074):
```python
@pytest.fixture(autouse=True)
def _reset_<singleton_name>():
    """..."""
    import app.dependencies as _deps
    _deps._<attr> = None
    yield
    _deps._<attr> = None
```

Async template (asyncpg pool — Phase 073, reference only):
```python
@pytest_asyncio.fixture(autouse=True)
async def _reset_<pool_singleton>():
    """..."""
    import app.dependencies as _deps
    _deps._<attr> = None
    yield
    if _deps._<attr> is not None:
        try:
            await _deps._<attr>.close()
        except Exception:
            pass
        _deps._<attr> = None
```

### Pattern D — Test gate command (venv-relative pytest, multi-file regression sweep)
**Source:** CLAUDE.md "Python backend must use a `venv`" rule + Phase 065 / 073 precedent
**Apply to:** D-074-14 ship gate
**Rule:** All pytest invocations use `cd backend && venv/Scripts/python -m pytest <files> -q`. Per-plan gates run a narrow file list; phase-level gate runs the full 4-file regression sweep.

```bash
# Per-plan (Plan 01 — SEED-009 unit gate)
cd backend && venv/Scripts/python -m pytest tests/unit/test_resolve_max_tokens.py -q

# Per-plan (Plan 02 — SEED-011 integration gate)
cd backend && venv/Scripts/python -m pytest \
    tests/integration/test_058_concurrency.py \
    tests/integration/test_059_disconnect.py \
    tests/integration/test_062_stream_replay.py \
    tests/integration/test_063_post_then_subscribe.py \
    -q

# Phase-level ship gate (D-074-14)
cd backend && venv/Scripts/python -m pytest \
    tests/integration/test_058_concurrency.py \
    tests/integration/test_059_disconnect.py \
    tests/integration/test_062_stream_replay.py \
    tests/integration/test_063_post_then_subscribe.py \
    tests/unit/test_resolve_max_tokens.py \
    -q
```

## No Analog Found

None — every file in Phase 074 has a strong analog (in-file precedent or sibling file).

| File | Why No Analog Concern |
|------|-----------------------|
| (none) | — |

The integration `conftest.py` is "new" in the sense that the file at that exact path does not yet exist, but the AUTOUSE-FIXTURE-FOR-LOOP-BOUND-SINGLETON pattern has TWO existing precedents (root-level Phase 073 pg-pool autouse, plus the local Phase 062/063 redis autouse copies). The new file is the formalization of a pattern that already lives in the codebase.

## Metadata

**Analog search scope:**
- `backend/app/config.py` (entire file — small, one-Read fit)
- `backend/app/services/openai_service.py:580-705` (clamp insertion target + neighborhood)
- `backend/app/api/threads.py` (grep for identifier-only log precedent only — no full Read)
- `backend/app/db/runs.py:60-145` (T-073-04 precedent docstring)
- `backend/tests/conftest.py:1-230` (root conftest precedent)
- `backend/tests/integration/test_059_disconnect.py:1-100` (sse-starlette fixture to preserve)
- `backend/tests/integration/test_062_stream_replay.py:1-100` (canonical redis fixture template)
- `backend/tests/integration/test_063_post_then_subscribe.py:1-80` (verbatim copy)
- `backend/tests/unit/test_module7_tools.py` (parametrize shape)
- `backend/tests/unit/test_openai_service.py:1-100` (openai_service unit-test shape)
- `backend/tests/unit/test_settings.py:1-44` (boundary-case test shape)

**Files scanned:** 11 Read calls + 6 Grep calls + 3 Glob calls

**Pre-write collision check confirmed:**
- `backend/tests/integration/conftest.py` does NOT exist (verified via Glob, 2026-05-18).
- No name collision between `_reset_redis_singleton` and any fixture in root `backend/tests/conftest.py` (which defines `_reset_pg_pool_singleton`, `redis_client`, `reset_mocks`, `client`, `mock_user`, `auth_headers`, `mock_execute_result`, `mock_builder`, `_flushdb_at_session_end` — all distinct names).
- `MODEL_CAPABILITIES` is already imported into `backend/app/services/openai_service.py` (verified by reading the file's neighborhood at L580-700 — the clamp insertion does not need a new import; planner should confirm at task time with a quick `Grep "from app.config import" backend/app/services/openai_service.py`).

**Pattern extraction date:** 2026-05-18
