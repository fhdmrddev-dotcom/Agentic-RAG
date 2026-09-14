"""Phase 249 Plan 02 (MODEL-05 / SEED-135 / SEED-172 arm 2) — the pick-time payload.

⚠ THE DEFECT, stated as a location rather than a behaviour: the ``unverified`` warning EXISTS
and is on the WRONG SURFACE. ``ModelPillRow`` (Settings) renders an amber chip driven by
``verified_models`` + ``inferred_provider_for``, both of which ``GET /settings`` already sends.
The chat composer's model dropdown — the surface where a model is actually PICKED — renders
``deprecated`` and ``active`` and has no such marker at all. MODEL-05 says *"at pick time"*, and
pick time is the composer.

So ``GET /settings/providers`` (the composer's feed) gains what the Settings feed already carries.

⭐ AND ONE THING THE SETTINGS FEED GETS WRONG TOO. ``verified_models`` was
``sorted(MODEL_CAPABILITIES.keys())`` — BUILT-INS ONLY. A model added through the Model Registry
UI lands in ``model_capabilities_overrides`` and resolves ``capability_source="db_override"``:
the operator TYPED its capabilities, so calling it "unverified" is the opposite of the truth, and
it would have made MODEL-04's success light MODEL-05's warning. The set is now a UNION.

⛔ NO CLIENT MIRROR. ``inferred_tools_lost`` is computed server-side from
``config._NATIVE_TOOL_PROVIDERS``. The five inference patterns and that frozenset live in
``config.py`` and are never re-implemented in TypeScript (RESEARCH §6 Approach b — zero-drift over
a client mirror).

ZERO MUTATION: every row is SEEDED through the patched pool, exactly as
``test_196_providers_disabled_models.py`` does.
"""
import app.models.user_settings as us

# One provider must carry an api_key or `configured` is empty and the payload is degenerate.
# `provider_model_lists` gives deterministic model ids so assertions do not depend on env CSV.
#
# The list mixes three kinds on purpose:
#   gpt-4o                  — a BUILT-IN registry model      → verified, no chip
#   my-db-only-model        — seeded as an override row      → verified (db_override), no chip
#   llama-4-scout-local     — in NEITHER                     → unverified, and inference sends it
#                                                              to `ollama`, which is OUTSIDE
#                                                              _NATIVE_TOOL_PROVIDERS → TOOLS LOST
_SETTINGS_ROW = {
    "id": "global",
    "llm_provider": "openai",
    "llm_model": "gpt-4o",
    "openai_api_key": "sk-test",
    "provider_model_lists": {
        "openai": ["gpt-4o", "my-db-only-model", "llama-4-scout-local"],
    },
}

_DB_ONLY_ROW = {
    "model_id": "my-db-only-model",
    "provider": "openai",
    "enabled": True,
    "deprecated": False,
}


def _reset_caches():
    us._settings_cache = None
    us._settings_cache_time = 0.0
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


def _prime(monkeypatch, pool, override_rows, settings_row=None):
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    pool.set_fetchrow_result(settings_row if settings_row is not None else _SETTINGS_ROW)
    pool.set_fetch_result(override_rows)
    _reset_caches()


def _get_providers(client, auth_headers):
    res = client.get("/settings/providers", headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()


# ── the three new fields exist on the composer's feed ──────────────────────────

def test_providers_payload_carries_the_verified_set(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Without this the composer cannot tell a registered model from an unregistered one."""
    _prime(monkeypatch, mock_asyncpg_pool, [])

    body = _get_providers(client, auth_headers)

    assert "verified_models" in body, (
        "the chat picker's feed must carry the verified set — the Settings feed has had it since "
        "Phase 075.3 and the composer is where the pick actually happens"
    )
    assert "gpt-4o" in body["verified_models"]


def test_providers_payload_carries_inferred_provider_for(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⛔ The client substitutes a value it was HANDED; it never re-implements the inference."""
    _prime(monkeypatch, mock_asyncpg_pool, [])

    body = _get_providers(client, auth_headers)

    assert "inferred_provider_for" in body
    # keyed only by ids that are NOT verified — a registered model has no inferred provider
    assert "llama-4-scout-local" in body["inferred_provider_for"]
    assert "gpt-4o" not in body["inferred_provider_for"]


def test_inferred_tools_lost_names_only_non_native_buckets(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⭐ The CONSEQUENCE field: which unregistered ids will silently lose tool calling.

    Asserted against ``_NATIVE_TOOL_PROVIDERS`` itself rather than a re-typed provider list, so
    adding a native provider to that frozenset cannot leave this fence quietly wrong.
    """
    from app.config import _NATIVE_TOOL_PROVIDERS

    _prime(monkeypatch, mock_asyncpg_pool, [])
    body = _get_providers(client, auth_headers)

    assert "inferred_tools_lost" in body
    for mid in body["inferred_tools_lost"]:
        assert body["inferred_provider_for"][mid] not in _NATIVE_TOOL_PROVIDERS, (
            f"{mid} was flagged as losing tools, but its inferred provider supports native tools"
        )
    # and the converse: an unverified id whose bucket IS native must NOT be flagged
    for mid, prov in body["inferred_provider_for"].items():
        if prov in _NATIVE_TOOL_PROVIDERS:
            assert mid not in body["inferred_tools_lost"]


def test_a_local_model_is_flagged_as_losing_tools(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The case the whole field exists for.

    ``llama-4-scout-local`` matches no inference pattern, so it falls to the ``ollama`` bucket,
    which is deliberately OUTSIDE ``_NATIVE_TOOL_PROVIDERS``. The run then goes to STRUCTURED
    mode, the ``tools`` param is never sent, and any tool call arrives as unparseable prose —
    the failure that stayed invisible for a day on 2026-08-18.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [])

    body = _get_providers(client, auth_headers)

    assert "llama-4-scout-local" in body["inferred_tools_lost"]


# ── ⭐ the union: an operator-added model is VERIFIED, not unverified ───────────

def test_verified_models_is_the_union_with_db_overrides(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A model added through the Model Registry UI must NOT render as unverified.

    ⭐ This is the MODEL-04 ↔ MODEL-05 interaction. `POST /admin/models` writes an override row
    and `get_model_capability_async` resolves it `capability_source="db_override"` — the operator
    entered those capabilities by hand. Reporting it as "not in our verified registry" would make
    the fix for one requirement light the warning of the other.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [_DB_ONLY_ROW])

    body = _get_providers(client, auth_headers)

    assert "my-db-only-model" in body["verified_models"], (
        "an operator-entered override row is REGISTERED — built-ins are not the whole registry"
    )
    assert "my-db-only-model" not in body["inferred_provider_for"], (
        "a verified model has no inferred provider, so the chip has nothing to render"
    )
    assert "my-db-only-model" not in body["inferred_tools_lost"]


def test_settings_payload_verified_models_is_the_same_union(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Both feeds answer the same question the same way — ONE helper, two callers."""
    _prime(monkeypatch, mock_asyncpg_pool, [_DB_ONLY_ROW])

    res = client.get("/settings", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert "my-db-only-model" in res.json()["verified_models"], (
        "the Settings feed had the built-ins-only bug too; fixing it in one place only would "
        "give the two surfaces different answers about the same model"
    )


# ── the end-user picker feed must never break ─────────────────────────────────

def test_the_new_fields_add_no_second_overrides_read():
    """⚠ THIS IS THE CHAT PICKER'S FEED — a 500 here is an end-user outage, not a missing chip.

    ⭐ TWO measurements corrected this case's own drafts, and both are recorded because each was
    a wrong assumption that a green test would have hidden:

    1. The first draft monkeypatched ``load_all_model_overrides`` to RAISE and asserted a 200.
       That tests an UNREACHABLE state: the function carries its own ``except Exception`` and
       returns the stale/empty cache on a blip (``user_settings.py:707-729``). It never raises.
    2. The second draft counted calls at runtime and asserted ``<= 1``. It measured **2** — and
       the second read is PRE-EXISTING: ``load_app_settings_async`` reads the overrides too, for
       ``_build_providers``' disabled set. Asserting a runtime count would have pinned an
       unrelated read and made this phase the owner of it.

    So the invariant is asserted where it actually lives — in the HANDLER'S OWN SOURCE. The three
    new fields must be computed from the ``_overrides`` dict the handler already fetched. A second
    read inside this function would be a second thing that can be slow, a second cache to go
    stale, and a genuinely new way for the end-user picker feed to break.
    """
    import inspect

    from app.api.settings import get_providers

    src = inspect.getsource(get_providers)
    assert src.count("load_all_model_overrides()") == 1, (
        "the three new fields must reuse the overrides dict already fetched for "
        "deprecated_models / disabled_models — this handler feeds the chat model picker"
    )
    # …and they genuinely are the new fields, not an accidental match on an unrelated line.
    for field in ("verified_models", "inferred_provider_for", "inferred_tools_lost"):
        assert field in src
