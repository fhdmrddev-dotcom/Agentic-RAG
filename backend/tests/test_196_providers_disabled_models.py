"""Phase 196 Plan 07 Task 1 (D-18 / BUG-260718-04) — `disabled_models` on GET /settings/providers.

The composer's per-thread model restore must fall back when the thread's last-used model is
no longer ENABLED, and D-18 says to reuse D-07's disabled rule rather than invent a second
one. This file pins the wire contract that carries that rule to the client.

⚠ THE PREDICATE IS `_registry_row`'s, NOT `enabled_model_allowed_set`'s. Only an override row
that is PRESENT with ``enabled`` explicitly ``False`` is disabled; an ABSENT override row is
enabled. The overwhelming majority of model ids have no override row at all, so a truthiness
test (``not cap.get("enabled")``) would report almost every model in the product as disabled —
which is why the absent-row case below is a case and not a comment.

ZERO MUTATION: every row here is SEEDED through the patched pool. Nothing in this file writes
to ``model_capabilities_overrides`` or to ``app_settings`` — asserted mechanically by the
no-write case at the bottom, which reads the pool's own recorded call log.
"""
import app.models.user_settings as us


# ── seeding ───────────────────────────────────────────────────────────────────

# One provider must carry an api_key or `configured` is empty and the payload is degenerate.
# `provider_model_lists` gives that provider a deterministic model list so the assertions do
# not depend on whatever env CSV happens to be set on the box running the suite.
_SETTINGS_ROW = {
    "id": "global",
    "llm_provider": "openai",
    "llm_model": "gpt-4o",
    "openai_api_key": "sk-test",
    "provider_model_lists": {"openai": ["gpt-4o", "o3-mini"]},
}


def _reset_caches():
    """Both settings caches AND both override caches — the handler reads all four."""
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


# ── the cases ─────────────────────────────────────────────────────────────────


def test_disabled_models_field_is_present_and_sorted(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The field EXISTS on every response and is sorted — seeded deliberately out of order."""
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "zzz-old", "provider": "openai", "enabled": False, "deprecated": False},
        {"model_id": "aaa-old", "provider": "openai", "enabled": False, "deprecated": False},
        {"model_id": "mmm-old", "provider": "openai", "enabled": False, "deprecated": False},
    ])

    body = _get_providers(client, auth_headers)

    assert "disabled_models" in body, "the field must be present on every /providers response"
    assert body["disabled_models"] == ["aaa-old", "mmm-old", "zzz-old"], (
        "sorted, not insertion-ordered — the client renders/compares this set directly"
    )


def test_row_with_enabled_false_is_disabled(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The whole point: an operator-disabled row reaches the client by id."""
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "retired-model", "provider": "openai", "enabled": False, "deprecated": False},
    ])

    body = _get_providers(client, auth_headers)

    assert "retired-model" in body["disabled_models"]


def test_row_with_enabled_true_is_not_disabled(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """An explicitly ENABLED override row must not be reported as disabled."""
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "gpt-4o", "provider": "openai", "enabled": True, "deprecated": False},
    ])

    body = _get_providers(client, auth_headers)

    assert "gpt-4o" not in body["disabled_models"]
    assert body["disabled_models"] == []


def test_model_with_no_override_row_is_not_disabled(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """⚠ THE CASE THAT SEPARATES `_registry_row` SEMANTICS FROM A TRUTHINESS TEST.

    ``o3-mini`` is offered by the provider (it is in ``provider_model_lists`` above) and has
    NO override row at all. It is ENABLED. A ``not cap.get("enabled")`` predicate would still
    pass this case by accident — because an absent row is absent from ``_overrides`` entirely
    — so the case is strengthened: it also pins that a row present with ``enabled`` set to
    ``None`` (a NULL column, which IS in the dict) is likewise not disabled, since only an
    explicit ``False`` counts.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "null-enabled", "provider": "openai", "enabled": None, "deprecated": False},
    ])

    body = _get_providers(client, auth_headers)

    offered = next(p["models"] for p in body["providers"] if p["id"] == "openai")
    assert "o3-mini" in offered, "guard: the no-override model really is offered by the provider"
    assert "o3-mini" not in body["disabled_models"], "an ABSENT override row is ENABLED"
    assert "null-enabled" not in body["disabled_models"], (
        "`enabled IS NULL` is not `enabled = false` — only an explicit False disables"
    )


def test_deprecated_models_is_unchanged_for_the_same_seeded_input(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """Deprecated is NOT disabled (D-149-05) and the new field did not perturb the old one.

    The seed is deliberately adversarial: one row is deprecated-but-ENABLED (stays selectable,
    so it belongs to `deprecated_models` and NOT to `disabled_models`), one is
    disabled-but-NOT-deprecated (the mirror image), and one is both.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "dep-enabled", "provider": "openai", "enabled": True, "deprecated": True},
        {"model_id": "dis-current", "provider": "openai", "enabled": False, "deprecated": False},
        {"model_id": "dep-and-dis", "provider": "openai", "enabled": False, "deprecated": True},
    ])

    body = _get_providers(client, auth_headers)

    assert body["deprecated_models"] == ["dep-and-dis", "dep-enabled"], (
        "deprecated_models is computed exactly as before — the two sets are independent"
    )
    assert body["disabled_models"] == ["dep-and-dis", "dis-current"]
    assert "dep-enabled" not in body["disabled_models"], "a deprecated model stays SELECTABLE"
    assert "dis-current" not in body["deprecated_models"], "a disabled model is not deprecated"


def test_no_override_rows_yields_an_empty_list_not_a_missing_field(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The client's `?? []` default must be a belt, never the only thing holding the trousers
    up: an empty registry answers `[]`, so `disabled_models === undefined` on the client can
    only ever mean an OLDER BACKEND, which is exactly what that default is for."""
    _prime(monkeypatch, mock_asyncpg_pool, [])

    body = _get_providers(client, auth_headers)

    assert body["disabled_models"] == []
    assert body["deprecated_models"] == []


def test_the_read_mutates_nothing(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """Zero-mutation, asserted from the pool's own recorded call log rather than promised in
    a docstring. GET /settings/providers is a Run carve-out on the end-user hot path
    (test_148_carveouts) — it must never write."""
    _prime(monkeypatch, mock_asyncpg_pool, [
        {"model_id": "retired-model", "provider": "openai", "enabled": False, "deprecated": False},
    ])

    _get_providers(client, auth_headers)

    logged = [sql for sql, _args in mock_asyncpg_pool.calls]
    # ⚠ NON-VACUITY FIRST. An empty call log would make the write-check below pass for the
    # wrong reason — it would be asserting that a recorder which recorded nothing recorded no
    # writes. Pin that the handler's two reads really did travel through this pool.
    assert any("app_settings" in sql for sql in logged), (
        "positive control: the settings read must be visible in the recorded log"
    )
    assert any("model_capabilities_overrides" in sql for sql in logged), (
        "positive control: the overrides read must be visible in the recorded log"
    )

    written = [
        sql for sql in logged
        if any(verb in sql.upper() for verb in ("INSERT", "UPDATE", "DELETE"))
    ]
    assert written == [], f"the providers read issued a write: {written}"
