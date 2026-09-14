"""Phase 249 Plan 01 (MODEL-04 / SEED-172) — add-by-ID validates the ROUTING roster.

⚠ THE DEFECT THIS FENCES, stated as two lists rather than as a bug:

  * ``config.py::_PROVIDER_BASE_URLS``            — the ROUTING roster.   11 providers.
  * ``model_discovery_service.py::PROVIDER_ENDPOINTS`` — the SSRF DISCOVERY allowlist. 8 clouds.

``POST /admin/models`` validated its ``provider`` argument against the SECOND one. The gap between
them is exactly ``ollama`` / ``lmstudio`` / ``custom`` — the three providers whose endpoint the
OPERATOR supplies — so a local or self-hosted model was answered ``422 Unknown provider`` and was
unaddable from the Model Registry UI for its entire life (SEED-172, trigger fired by the operator
2026-09-13: *"I need to add manually from the model registry the models for Ollama or LM Studio"*).

⛔ THE FENCE THAT MATTERS MOST IS THE NEGATIVE ONE. Widening the routing roster must NOT widen the
SSRF allowlist — they are different lists for different reasons. ``PROVIDER_ENDPOINTS`` is the set
of URLs this server will make an OUTBOUND REQUEST to, and it is hardcoded precisely so no
caller-supplied URL reaches the HTTP client (T-149-03). A self-hosted provider's base URL comes
from the operator's own ``app_settings`` column (``_SELF_HOSTED_PROVIDERS``, migration 180); the
server never DISCOVERS it, so it has no business in a discovery allowlist.

Harness mirrors ``backend/tests/test_159_add_model.py`` — the handler is called directly with a
fake Request and a recording pool, and ``load_all_model_overrides`` is stubbed, so no test here
touches the live DB. This file lives under ``tests/unit`` (unlike 159's, which sits one level up)
so that it runs under the ``pytest tests/unit`` baseline gate.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.admin as admin_mod
import app.dependencies as deps
from app.api.admin import AddModelRequest, add_model_by_id

# The three the gap was made of. Named once, used by several cases.
SELF_HOSTED = ("ollama", "lmstudio", "custom")

# The eight the SSRF discovery allowlist is allowed to hold — a CODE-CONSTANT expectation, so a
# silent widening of that list fails here rather than passing quietly.
EXPECTED_DISCOVERY_PROVIDERS = frozenset({
    "openai", "anthropic", "google", "deepseek",
    "moonshot", "zhipu", "minimax", "openrouter",
})


class _RecordingPool:
    """asyncpg-pool stand-in recording every write.

    ⚠ It answers ``fetchval`` as well as ``execute``. ``add_model_by_id`` persists through
    ``fetchval`` (it reads back the inserted id to tell a real insert from a no-op), and
    ``backend/tests/test_159_add_model.py`` — the ONLY other suite covering this endpoint — still
    has an execute-only stub and fails 4/12 on that alone, at HEAD, before this phase. That suite
    sits in ``backend/tests/``, NOT ``backend/tests/unit/``, so the baseline gate has never run it.
    """

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return "row-id"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []


def _fake_request():
    return SimpleNamespace(
        state=SimpleNamespace(),
        method="POST",
        url=SimpleNamespace(path="/admin/models"),
    )


def _stub_overrides(monkeypatch, rows):
    async def _fake():
        return rows

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _fake)


def _quiet_cache(monkeypatch):
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)


# ── The roster itself ──────────────────────────────────────────────────────────

def test_routing_roster_contains_the_three_self_hosted_providers():
    """``ROUTING_PROVIDERS`` covers every provider the app can route a completion through."""
    from app.config import ROUTING_PROVIDERS

    missing = [p for p in SELF_HOSTED if p not in ROUTING_PROVIDERS]
    assert not missing, (
        f"the routing roster omits {missing} — a model on one of these cannot be added, "
        "which is SEED-172 exactly"
    )


def test_routing_roster_is_derived_not_retyped():
    """⛔ DERIVED from the table, never a second hand-typed list.

    This project's measured failure mode is a list that exists twice: the roster existed in
    ``config.py``, again in ``model_discovery_service.py`` for a different purpose, and a THIRD
    time in ``ModelRegistryTab.tsx``. A frozenset built from the dict cannot drift from it.
    """
    from app.config import ROUTING_PROVIDERS, _PROVIDER_BASE_URLS

    assert set(ROUTING_PROVIDERS) == set(_PROVIDER_BASE_URLS)


# ── The add endpoint ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("provider", SELF_HOSTED)
async def test_add_model_accepts_a_self_hosted_provider(monkeypatch, provider):
    """A self-hosted provider is a VALID routing target, so add-by-ID must accept it."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _quiet_cache(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(
        model_id="qwen3-coder:30b", provider=provider,
        context_window_tokens=262144, max_output_tokens=32768, native_tools=True,
    )
    out = await add_model_by_id(_fake_request(), body, _floor=None)

    assert out["ok"] is True
    assert out["provider"] == provider


@pytest.mark.parametrize("provider", SELF_HOSTED)
async def test_a_self_hosted_add_still_lands_disabled(monkeypatch, provider):
    """SC#3 / D-149-02 — an add NEVER auto-enables, and widening the roster must not change that."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _quiet_cache(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="llama4:70b", provider=provider)
    out = await add_model_by_id(_fake_request(), body, _floor=None)

    assert out["enabled"] is False
    # ⚠ And the forced False actually reached the BIND LIST, not only the response body — a
    # handler that returned `enabled: False` while writing something else would pass the line
    # above and ship the defect. Find the INSERT among the pool's calls rather than indexing
    # [0]: the handler issues other statements first, and `calls[0]` is not the write.
    inserts = [
        (sql, args) for sql, args in pool.calls
        if "INSERT INTO model_capabilities_overrides" in sql
    ]
    assert len(inserts) == 1, f"expected exactly one insert, saw {len(inserts)}"
    _sql, args = inserts[0]
    assert any(a is False for a in args), (
        "enabled=false must be a bound value on the insert — `is False`, not `== False`, "
        "because 0 == False in Python and a bound 0 would satisfy the weaker test"
    )


async def test_add_model_still_refuses_an_unknown_provider(monkeypatch):
    """Widening is not opening: a name in NEITHER list is still 422, still before any DB touch."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _quiet_cache(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="foo-1", provider="definitely-not-a-provider")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)

    assert ei.value.status_code == 422
    assert pool.calls == [], "allowlist-before-touch: no DB call may precede the refusal"


# ── ⛔ The negative fence — the SSRF allowlist is NOT widened ───────────────────

def test_ssrf_discovery_allowlist_is_not_widened():
    """⛔ ``PROVIDER_ENDPOINTS`` is the OUTBOUND-REQUEST allowlist and this phase does not touch it.

    If this test ever fails because a self-hosted provider appeared in it, that is not a roster
    update — it is a new egress surface pointed at an operator-supplied URL, and it needs its own
    threat model (see SEED-088, deferred out of Phase 249 for exactly this reason).
    """
    from app.services.model_discovery_service import PROVIDER_ENDPOINTS

    assert set(PROVIDER_ENDPOINTS) == EXPECTED_DISCOVERY_PROVIDERS
    leaked = [p for p in SELF_HOSTED if p in PROVIDER_ENDPOINTS]
    assert not leaked, (
        f"{leaked} reached the SSRF discovery allowlist — widening the ROUTING roster must never "
        "widen the list of URLs the server will fetch"
    )


def test_the_two_lists_are_still_different_lists():
    """The routing roster is a strict SUPERSET of the discovery allowlist, and stays one.

    Pinned as a relationship rather than as two counts, so adding a ninth cloud provider (which
    belongs in both) does not trip the fence, while adding a self-hosted one to the wrong list does.
    """
    from app.config import ROUTING_PROVIDERS
    from app.services.model_discovery_service import PROVIDER_ENDPOINTS

    assert set(PROVIDER_ENDPOINTS) < set(ROUTING_PROVIDERS)
