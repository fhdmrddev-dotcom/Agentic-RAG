"""N-01 (HIGH) router auto-resolution — Phase 067.3 Plan 01.

Repro fixture: run_id 6eab949f-78da-4ea4-ac01-f04b16c9be7d (D-067.3-N01-03).
User had user_settings.active_provider='openai' and submitted model=
claude-sonnet-4-6 with no body.provider override. The pre-Phase-067.3 code
at threads.py:949 set _resolved_provider = _user_settings.active_provider
('openai'), so the agent_runner SDK selection picked OpenAI and the
Anthropic-only model returned 404.

Resolution order tested (D-067.3-N01-01):
  1. explicit body.provider              (Test 3)
  2. MODEL_CAPABILITIES[model][provider] (Tests 1, 2)
  3. _user_settings.active_provider      (Test 4 — unknown model)

CRITICAL anti-mask invariant (D-067.3-N01-03 + Specifics §"N-01 unit-test trap"):
Tests 1, 2, 4 MUST NOT hand-set body.provider. Test 3 IS the only test that
hand-sets — and it sets it to 'openai' (the bug's WRONG value) to verify
the precedence rule, NOT to mask the bug.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import httpx
import pytest
from httpx import ASGITransport

from app.dependencies import get_redis, get_supabase
from app.main import app
from app.services.openai_service import CallingMode
from tests.integration._run_helpers import (
    _build_mock_supabase,
    _fast_chunks,
    _make_result,
)

THREAD_ID = str(uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests.

    Mirrors test_063_post_contract.py:96-113. Even though our redis is mocked
    via dependency_overrides, the singleton would otherwise hold a stale
    AsyncMock across tests. Belt-and-suspenders.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


def _make_user_settings(active_provider: str) -> SimpleNamespace:
    """Build a minimal UserEffectiveSettings-shaped object for load_user_settings mocks.

    Includes a `providers` list so override_provider() can find a matching
    provider with api_key set — its return value would otherwise be a
    no-op for non-credentialed providers (see user_settings.py:296).
    """
    providers = [
        SimpleNamespace(id=p, name=p, base_url="", api_key=f"sk-{p}-test", models=[], is_active=False)
        for p in ("openai", "anthropic", "google", "openrouter")
    ]
    return SimpleNamespace(
        active_provider=active_provider,
        llm_api_key=f"sk-{active_provider}-test",
        llm_base_url="",
        llm_model="gpt-4o",
        available_models=[],
        providers=providers,
        # Other UserEffectiveSettings fields touched by downstream code; defaulted
        # so the mock survives the auto-title block (run_in_threadpool path).
        web_search_enabled=False,
        sandbox_enabled=False,
        embedding_api_key="",
        embedding_base_url="",
        embedding_model="",
        embedding_dimensions=1536,
        rerank_enabled=False,
        rerank_provider="",
        rerank_api_key="",
        rerank_model="",
        rerank_top_n=3,
        retrieval_top_k=10,
        retrieval_match_threshold=0.5,
        hybrid_search_enabled=True,
        hybrid_candidate_count=20,
        vector_search_weight=0.5,
        keyword_search_weight=0.5,
        rrf_k=60,
        tavily_api_key="",
        web_search_max_results=5,
        context_window_max_tokens=128000,
        sub_agent_max_output_tokens=4096,
        sub_agent_model="",
        llm_max_output_tokens=0,
        openrouter_tool_strategy="quality",
    )


def _override_provider_passthrough(effective, provider_id: str):
    """Test stand-in for app.models.user_settings.override_provider.

    The real helper requires providers[*].api_key to be non-empty; our
    fixture supplies fake keys so it'd work. But to keep the SimpleNamespace
    fixture light AND to make the test independent of the override helper's
    no-op-on-missing-key semantics, we override the helper itself with a
    pass-through that mutates active_provider unconditionally. Acceptance
    criterion (Plan 01) is the value written to runs.insert(...,'provider'),
    which uses _resolved_provider (set by the routing logic), NOT the
    helper's return value — this stub is hygiene only.
    """
    new_settings = SimpleNamespace(**vars(effective))
    new_settings.active_provider = provider_id
    return new_settings


def _last_runs_insert_payload(insert_run_mock: AsyncMock) -> dict:
    """Return the payload of the most-recent insert_run(...) call.

    Phase 075.4-06 Task 3 — FK-violation fix.

    Alternative considered: ``fk_aware_runs_factory`` (Plan 075.4-05 Task 4
    suite-wide fixture in backend/tests/conftest.py). Rejected here because
    the factory seeds parents in a REAL Postgres pool (auth.users → threads
    → runs), but this test file's conftest stack uses placeholder
    ``SUPABASE_URL=https://test.supabase.co`` so the factory would hit its
    ``pytest.skip`` path. The factory remains the canonical tool for real-
    Postgres binding tests; AsyncMock-patching is the correct idiom for
    mock-Supabase test files like this one (D-075.4-G3 bucket-c bulk
    pattern). See 075.4-TEST-TRIAGE.md "Engineering note" for full rationale.

    Pre-Phase-073-04: the production code called
    ``_supabase.table("runs").insert(...).execute()``. This helper used to
    read from ``mock_supabase.table("runs").insert.call_args_list``.

    Phase 073-04 (D-073-04 SC-minimum) flipped the runs INSERT hot path to
    ``app.db.runs.insert_run`` (asyncpg). The supabase mock's
    ``runs.insert.call_args_list`` is now always empty (production code
    never touches it); the production asyncpg call previously hit real
    Postgres and FK'd out on ``runs_thread_id_fkey`` because the parent
    threads row was never seeded.

    The fix swaps the source-of-truth assertion target from the supabase
    mock to the AsyncMock-patched ``app.api.threads.insert_run``. Callers
    pass the same AsyncMock here that they applied to the patch. The
    resulting dict mirrors the legacy supabase payload shape closely
    enough for the existing test assertions: every field the test asserts
    on (``provider``, ``model``, ``status``) comes from the kwargs of the
    asyncpg helper signature defined at backend/app/db/runs.py:26-56.
    """
    calls = insert_run_mock.call_args_list
    assert calls, (
        "Expected at least one insert_run(...) call (D-061-11 lifecycle / "
        "Phase 073-04 D-073-04 SC-minimum asyncpg helper)"
    )
    # The helper is invoked exactly once per run lifecycle (status='streaming'
    # at entry). Tests assert on the FIRST call's kwargs.
    call = calls[0]
    kwargs = dict(call.kwargs)
    # Convert any UUID/typed values to strings for assertion parity with the
    # legacy supabase payload shape (which used str everywhere).
    return {
        "provider": kwargs.get("provider"),
        "model": kwargs.get("model"),
        "status": kwargs.get("status"),
        "run_id": str(kwargs.get("run_id")) if kwargs.get("run_id") is not None else None,
        "thread_id": str(kwargs.get("thread_id")) if kwargs.get("thread_id") is not None else None,
        "user_id": str(kwargs.get("user_id")) if kwargs.get("user_id") is not None else None,
    }


async def _post_message(client: httpx.AsyncClient, body: dict) -> httpx.Response:
    return await client.post(
        f"/threads/{THREAD_ID}/messages",
        headers={"Authorization": "Bearer test-token"},
        json=body,
    )


def _make_redis_mock() -> MagicMock:
    """AsyncMock-backed Redis stand-in.

    The producer task XADDs / EXPIREs / ZADDs against the redis client; the
    handler ZADDs runs:active and runs_by_thread:{tid} pre-return. None of
    those side-effects matter for the runs.insert payload assertion, so a
    MagicMock with AsyncMock methods is sufficient.
    """
    redis_mock = MagicMock()
    redis_mock.zadd = AsyncMock(return_value=1)
    redis_mock.zrem = AsyncMock(return_value=1)
    redis_mock.xadd = AsyncMock(return_value=b"0-0")
    redis_mock.xlen = AsyncMock(return_value=0)
    redis_mock.expire = AsyncMock(return_value=True)
    redis_mock.aclose = AsyncMock(return_value=None)
    return redis_mock


async def _run_post_and_capture(active_provider: str, body: dict) -> dict:
    """Spin up a TestClient, POST, return the runs.insert payload + cleanup.

    Args:
        active_provider: the user_settings.active_provider value to set on
            the load_user_settings mock.
        body: the POST JSON body — controls model/provider selection per test.

    Returns:
        The runs INSERT payload dict (status='streaming' row).
    """
    mock_supabase = _build_mock_supabase()
    # threads ownership SELECT must return a row (the route 404s otherwise).
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_ID})

    redis_mock = _make_redis_mock()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_redis] = lambda: redis_mock

    captured_run_id: list[str] = []

    # Phase 075.4-06 Task 3 — FK-violation fix.
    # Patch the asyncpg helpers as AsyncMock no-ops so the real Postgres pool
    # never sees a runs INSERT (which FK'd out on runs_thread_id_fkey without
    # the parent threads row). The test design is mock-supabase throughout;
    # patching the new helpers preserves that idiom for the Phase 073-04 flip.
    insert_run_mock = AsyncMock(return_value=None)
    finalize_run_mock = AsyncMock(return_value=None)
    insert_message_mock = AsyncMock(return_value=uuid4())  # returns UUID
    try:
        with patch(
            "app.api.threads.load_user_settings",
            return_value=_make_user_settings(active_provider),
        ), patch(
            "app.api.threads.override_provider",
            side_effect=_override_provider_passthrough,
        ), patch(
            "app.services.agent_loop.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_fast_chunks()), CallingMode.NATIVE),
        ), patch(
            # 092.5 Wave 2: the Anthropic adapter now owns the stream_anthropic
            # call (imported into provider_gateway.anthropic) — patch it THERE.
            "app.services.provider_gateway.anthropic.stream_anthropic",
            side_effect=lambda *a, **k: iter([]),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.insert_run",
            new=insert_run_mock,
        ), patch(
            "app.api.threads.finalize_run",
            new=finalize_run_mock,
        ), patch(
            "app.services.agent_loop.insert_assistant_message",
            new=insert_message_mock,
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await _post_message(ac, body)

            assert resp.status_code == 201, (
                f"Expected 201; got {resp.status_code} body={resp.text[:300]}"
            )
            captured_run_id.append(resp.json()["run_id"])
            payload = _last_runs_insert_payload(insert_run_mock)
            return payload
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)
        # Cancel any spawned producer task to avoid leaking into next test
        # (Pitfall 6 — closed event loop on next test's producer XADD).
        import asyncio as _asyncio
        from app.api.threads import RUN_TASKS as _RUN_TASKS
        for run_id_str in captured_run_id:
            try:
                task = _RUN_TASKS.get(UUID(run_id_str))
                if task is not None and not task.done():
                    task.cancel()
                    try:
                        await _asyncio.wait_for(task, timeout=2.0)
                    except (_asyncio.CancelledError, _asyncio.TimeoutError, Exception):
                        pass
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_n01_runs_6eab949f_router_uses_capability_registry():
    """D-067.3-N01-01/03: Anthropic model + active_provider='openai' (no body.provider)
    → runs.provider='anthropic'.

    Repro: run_id 6eab949f-78da-4ea4-ac01-f04b16c9be7d. Pre-Plan-01 code
    set _resolved_provider = _user_settings.active_provider ('openai'),
    routing the Anthropic model through the OpenAI SDK → 404.

    THIS TEST MUST NOT HAND-SET body.provider — doing so would mask the bug
    by going through the explicit-override path instead of the auto-resolution
    path. The body deliberately omits the 'provider' key (D-067.3-N01-03).
    """
    payload = await _run_post_and_capture(
        active_provider="openai",
        body={"content": "test", "model": "claude-sonnet-4-6"},  # NO provider key!
    )
    assert payload["provider"] == "anthropic", (
        f"router fell back to active_provider — bug repro "
        f"6eab949f-78da-4ea4-ac01-f04b16c9be7d NOT fixed; "
        f"got provider={payload['provider']!r}"
    )
    assert payload["model"] == "claude-sonnet-4-6"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_n01_openrouter_model_resolves_via_registry():
    """D-067.3-N01-01: OpenRouter model + active_provider='openai' → runs.provider='openrouter'.

    Symmetric to the Anthropic case — proves auto-resolution works for ALL
    providers in MODEL_CAPABILITIES, not just Anthropic. moonshotai/kimi-k2.5
    is a known OpenRouter entry (config.py:124).
    """
    payload = await _run_post_and_capture(
        active_provider="openai",
        body={"content": "test", "model": "moonshotai/kimi-k2.5"},  # NO provider key!
    )
    assert payload["provider"] == "openrouter", (
        f"router did not resolve OpenRouter model via MODEL_CAPABILITIES; "
        f"got provider={payload['provider']!r}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_n01_explicit_body_provider_takes_precedence():
    """D-067.3-N01-01 step 1: explicit body.provider='openai' on a claude model
    overrides the registry → runs.provider='openai'.

    This is the ONLY test that hand-sets body.provider — to verify the
    precedence rule. The override targets 'openai' (the bug's WRONG value)
    deliberately: a test that hand-sets to 'anthropic' would pass with or
    without the fix and not exercise the precedence assertion.
    """
    payload = await _run_post_and_capture(
        active_provider="openai",
        body={"content": "test", "model": "claude-sonnet-4-6", "provider": "openai"},
    )
    assert payload["provider"] == "openai", (
        f"explicit body.provider was not honored over MODEL_CAPABILITIES; "
        f"got provider={payload['provider']!r}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_n01_unknown_model_falls_back_to_active_provider():
    """D-067.3-N01-02: Model not in MODEL_CAPABILITIES → falls back to active_provider.

    The get_model_capability helper returns provider='unknown' for unknown
    models; the resolver hits the else branch and uses _user_settings.active_provider.
    """
    payload = await _run_post_and_capture(
        active_provider="openrouter",
        body={"content": "test", "model": "totally-fake-model-id"},  # NO provider key!
    )
    assert payload["provider"] == "openrouter", (
        f"unknown-model fallback did not use active_provider; "
        f"got provider={payload['provider']!r}"
    )
