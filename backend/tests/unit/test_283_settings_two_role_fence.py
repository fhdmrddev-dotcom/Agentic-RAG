"""Phase 283 Plan 02 (FIX-01 / BUG-261004-02, D-09 / D-10) — the Settings wall, on the REAL gate.

WHAT THIS FENCE PROTECTS. Phase 283 opens the Settings door on the rail to every org member
(``nav-items.ts`` drops its ``model_management`` tag). That is only safe because the API, not the
rail, is the wall: the four operator routes under ``/settings`` refuse a member with 403, while the
three things that are the member's own — ``/me/preferences`` (default chat model), ``/audit-logs``
(their own ledger) and the ``/settings/providers`` Run carve-out (the chat model picker) — answer
them. This file proves BOTH halves for BOTH roles on the decision chain that actually runs in
production:

    require_visible -> feature_visible -> is_operator -> feature_audience

WHY THE SEAM IS THE POOL, NOT THE GATE. A test that overrides ``require_visible`` — or stubs out
any link of the chain above — proves nothing about who is refused: it replaces the very decision
under test with the test's own answer. The ONLY seam here is
``app.dependencies._pg_pool``: the ``operator_users`` read is routed on the caller's IDENTITY (a row
only for ``OP``), ``app_settings`` comes from the primed row (no ``feature_visibility`` key, so the
cold default ``_GOVERNED_FEATURES`` applies) and identity is injected through ``get_current_user``,
exactly as the real JWT dependency would hand it over.

D-09 — NOT WIDENED. Phase 283 changes no backend source. ``_GOVERNED_FEATURES["model_management"]``
is pinned to ``"operators"`` here, inside the unit gate (before this file only
``tests/test_148_visibility_cold_default.py`` pinned it, and that file is outside the unit gate).

⚠ Honest about the read-back: under the mock, ``GET /me/preferences`` returns whatever ``fetchval``
is primed with. This proves the GET composes the stored preference and that the PUT wrote through
``auth.uid()`` on an RLS-swapped connection. Real persistence across a reload is D-13 / G-4, live.

Driven RED (283-02 SUMMARY): stripping ``require_visible`` from ``GET /settings`` turns the member
arm's 403 into a 200.
"""
import pytest

import app.models.user_settings as us
from app.dependencies import get_current_user
from app.main import app

OP = "11111111-1111-1111-1111-111111111111"
MEMBER = "22222222-2222-2222-2222-222222222222"

_REFUSED = "This feature is available to administrators only."

# One provider carries an api_key so the payloads are not degenerate; `provider_model_lists`
# fixes the model ids. No `feature_visibility` key -> the cold default (`_GOVERNED_FEATURES`).
_SETTINGS_ROW = {
    "id": "global",
    "llm_provider": "openai",
    "llm_model": "gpt-4o",
    "openai_api_key": "sk-test",
    "provider_model_lists": {"openai": ["gpt-4o"]},
}

# model_capabilities_overrides -> the ENABLED allowed set /me/preferences validates against.
_OVERRIDES = [{"model_id": "gpt-4o", "provider": "openai", "enabled": True, "deprecated": False}]


def _reset_caches(monkeypatch):
    """Cold-start every settings cache for THIS test, and give the originals back afterwards.

    283-REVIEW WR-01: these were plain assignments, so the row this file primes (including
    ``openai_api_key: "sk-test"``) stayed in the process-wide cache after the test, stamped
    fresh — and ``load_app_settings()`` has no TTL, so any later test that read settings
    without resetting first got this file's row. ``monkeypatch.setattr`` restores the original
    BINDING at teardown. That is sufficient because the loaders rebind these names rather than
    mutating them in place, and each call below passes a fresh object.
    """
    for name, cold in [
        ("_settings_cache", None),
        ("_settings_cache_time", 0.0),
        ("_model_overrides_cache", {}),
        ("_model_overrides_cache_time", 0.0),
        ("_all_model_overrides_cache", {}),
        ("_all_model_overrides_cache_time", 0.0),
        ("_removed_model_ids_cache", set()),
        ("_removed_model_ids_cache_time", 0.0),
    ]:
        monkeypatch.setattr(us, name, cold)


def _prime(monkeypatch, pool, who):
    """Wire the mock pool as the ONLY data seam and inject ``who`` as the caller.

    ``is_operator`` reads ``operator_users`` through ``pool.fetchrow`` -> ``pool._conn.fetchrow``;
    that read is decided by IDENTITY alone (a row only for ``OP``) and recorded on ``pool.calls``
    so a test can prove the real ``is_operator`` ran. Every other statement falls through to the
    recording connection's own behaviour. conftest's autouse ``reset_mocks`` restores the
    canonical ``get_current_user`` override after each test.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    pool.set_fetchrow_result(_SETTINGS_ROW)
    pool.set_fetch_result(_OVERRIDES)

    inner = pool._conn.fetchrow

    async def fetchrow(sql, *args):
        if "operator_users" in sql:
            pool.calls.append((sql, args))
            return {"?column?": 1} if args and args[0] == OP else None
        return await inner(sql, *args)

    monkeypatch.setattr(pool._conn, "fetchrow", fetchrow)
    _reset_caches(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: {"id": who, "email": f"{who[:4]}@x.test"}


def _sql_seen(pool, needle):
    return [c for c in pool.calls if isinstance(c[0], str) and needle in c[0]]


# ── D-09: model_management is NOT widened ─────────────────────────────────────

def test_model_management_audience_is_still_operators():
    """Opening the rail door must never be done by widening the feature's audience."""
    assert us._GOVERNED_FEATURES["model_management"] == "operators"


# ── D-10 member arm: the four operator routes refuse ──────────────────────────

@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/settings", None),
        ("PUT", "/settings", {}),
        ("GET", "/settings/reembed-progress", None),
        ("POST", "/settings/reembed", None),
    ],
)
def test_member_is_refused_every_operator_settings_route(
    client, auth_headers, mock_asyncpg_pool, monkeypatch, method, path, body
):
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)

    res = client.request(method, path, headers=auth_headers, json=body)

    assert res.status_code == 403, f"{method} {path} -> {res.status_code}: {res.text}"
    assert res.json()["detail"] == _REFUSED
    # Non-vacuity: the REAL is_operator asked operator_users about THIS caller.
    reads = _sql_seen(mock_asyncpg_pool, "operator_users")
    assert reads, "is_operator never ran — the refusal did not come from the real chain"
    assert reads[0][1] == (MEMBER,)


def test_member_reaches_the_providers_run_carve_out(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """GET /settings/providers feeds the chat model picker; it carries no gate by design (Phase 148)."""
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)

    res = client.get("/settings/providers", headers=auth_headers)

    assert res.status_code == 200, res.text


# ── D-10 member own-settings arm ──────────────────────────────────────────────

def test_member_sets_their_own_default_model_on_an_rls_connection(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)

    res = client.put("/me/preferences", headers=auth_headers, json={"default_model": "gpt-4o"})

    assert res.status_code == 200, res.text
    assert _sql_seen(mock_asyncpg_pool, "SET LOCAL ROLE authenticated"), (
        "the member's write must run on their RLS-swapped connection, not the service role"
    )
    assert _sql_seen(mock_asyncpg_pool, "INSERT INTO public.user_settings")


def test_member_reads_their_own_default_model_back(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)
    mock_asyncpg_pool.set_fetchval_result("gpt-4o")

    res = client.get("/me/preferences", headers=auth_headers)

    assert res.status_code == 200, res.text
    assert res.json()["default_model"] == "gpt-4o"


def test_member_cannot_pick_a_model_outside_the_enabled_set(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)

    res = client.put("/me/preferences", headers=auth_headers, json={"default_model": "not-a-model"})

    assert res.status_code == 400, res.text
    assert not _sql_seen(mock_asyncpg_pool, "INSERT INTO public.user_settings")


def test_member_reads_only_their_own_audit_log(
    client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch
):
    _prime(monkeypatch, mock_asyncpg_pool, MEMBER)

    res = client.get("/audit-logs", headers=auth_headers)

    assert res.status_code == 200, res.text
    eq_calls = [c.args for c in mock_builder.eq.call_args_list]
    assert ("user_id", MEMBER) in eq_calls, f"audit read was not owner-scoped: {eq_calls}"


# ── D-10 operator arm ─────────────────────────────────────────────────────────

def test_operator_reaches_get_settings(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _prime(monkeypatch, mock_asyncpg_pool, OP)

    res = client.get("/settings", headers=auth_headers)

    assert res.status_code == 200, res.text
    reads = _sql_seen(mock_asyncpg_pool, "operator_users")
    assert reads and reads[0][1] == (OP,)
