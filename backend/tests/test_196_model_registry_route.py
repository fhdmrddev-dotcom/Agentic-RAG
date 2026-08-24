"""Phase 196 Plan 04 (AUTH-04 / D-01 / D-02 / D-13) — GET /models/registry, the NON-operator
model-registry union read.

What this file is the only wall for:

- **T-196-AC1** — an authenticated NON-operator reaches the union (200). That is the whole
  point of the route: a workflow author must see what models exist in order to pick one.
- **T-196-AC2** — the SAME identity, in THIS file, still gets a byte-identical 404 from
  ``GET /admin/models``. Proving it by CONTRAST in one file is what stops the two claims from
  drifting apart; ``admin.py``'s router gate has **no RLS backstop** (SC#4 / D-149-09), so a
  test is the only thing standing between an author and the operator payload.
- **T-196-LEAK** — every row's key set EQUALS the six-key allowlist. Asserted as SET EQUALITY,
  never as individual ``not in`` checks, so a field added to ``_registry_row`` next year fails
  HERE instead of travelling silently (the Phase 190 CR-01 shape: migration 116's RLS copy
  leaked a secret column by inheriting rather than allowlisting).

Fixture posture is cloned from ``test_149_registry_read.py``: the identity and every read are
driven through ``app.dependencies._pg_pool``, and **no case mutates a row** — the file
contains no insert or update statement of any kind, which is what keeps it parallel-safe under
CLAUDE.md rule 4 (worktrees isolate files, not Postgres).
"""
import app.models.user_settings as us
from app.config import MODEL_CAPABILITIES

# The six fields a workflow author may see. Kept as a LITERAL here on purpose: importing
# _AUTHOR_ROW_FIELDS would make the test agree with the implementation by construction and
# assert nothing. If this literal and the projection disagree, that is the finding.
_ALLOWED_KEYS = {
    "model_id",
    "provider",
    "capability_source",
    "enabled",
    "deprecated",
    "emit_tier",
}

# Operator-only / editor-internal field names that must never appear in the serialized body.
_FORBIDDEN_SUBSTRINGS = (
    "deprecated_reason",
    "overridden_fields",
    "is_locked",
    "llm_call_timeout_seconds",
    "context_window_tokens",
    "max_output_tokens",
    "api_key",
    "base_url",
)


def _reset_override_caches():
    """Load-bearing (test_149_registry_read.py:34-38): the override caches are module-level
    with a 30 s TTL, so a case that does not reset them reads the PREVIOUS case's rows."""
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


def _prime_non_operator(monkeypatch, mock_asyncpg_pool, override_rows, fetchrow_row=None):
    """Seed the reads and drive a NON-OPERATOR identity.

    ``fetchrow_row=None`` is what makes the caller a non-operator: ``require_operator``'s
    ``operator_users`` membership lookup finds no row (the ``test_149_model_gate.py:26-27``
    posture), and the SAME sticky value doubles as the absent ``app_settings`` row, which
    ``_load_settings_from_db`` folds to ``{}``. ``get_current_user`` is globally overridden in
    conftest, so the caller is authenticated throughout — non-operator, never anonymous.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(fetchrow_row)
    mock_asyncpg_pool.set_fetch_result(override_rows)
    us._settings_cache = None
    us._settings_cache_time = 0.0
    _reset_override_caches()


# Two DB-only ids (absent from MODEL_CAPABILITIES) plus one override OVER a built-in id, so
# the union exercises all three row classes in one call.
_SEEDED_DB_ONLY_IDS = ("brand-new-model", "glm-4.7-flash")
_SEEDED_ROWS = [
    # OVR over a built-in id — DISABLED and with a DB emit_tier that must beat the code value.
    {"model_id": "gpt-4o", "provider": "openai", "enabled": False, "deprecated": True,
     "deprecated_reason": "internal: vendor incident 2026-08 — operator eyes only",
     "context_window_tokens": 128000, "max_output_tokens": 8192,
     "native_tools": True, "llm_call_timeout_seconds": 300, "emit_tier": "coerce"},
    # DB-only rows — discovery-confirmed models the code registry has never heard of.
    {"model_id": "brand-new-model", "provider": "openai", "enabled": True, "deprecated": False},
    {"model_id": "glm-4.7-flash", "provider": "lmstudio", "enabled": True, "deprecated": False},
]


# ── T-196-AC1 / the union ──────────────────────────────────────────────────────


def test_non_operator_reads_the_registry(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-196-AC1: an authenticated NON-operator gets 200 from GET /models/registry."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    res = client.get("/models/registry", headers=auth_headers)

    assert res.status_code == 200, (
        "a plain authenticated author must reach the registry — this route exists precisely "
        "because /admin/models cannot be widened"
    )
    body = res.json()
    assert "models" in body and isinstance(body["models"], list)


def test_union_size_is_code_registry_plus_db_only_rows(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """D-03: the expected size is RE-DERIVED here, never pinned to the 69 measured on
    2026-08-17 — that number moves the moment an operator adds a registry row."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    res = client.get("/models/registry", headers=auth_headers)
    assert res.status_code == 200
    rows = res.json()["models"]

    db_only = [m for m in _SEEDED_DB_ONLY_IDS if m not in MODEL_CAPABILITIES]
    expected = len(MODEL_CAPABILITIES) + len(db_only)
    assert len(rows) == expected, (
        f"the union must be every code-registry model plus every DB-only model "
        f"({len(MODEL_CAPABILITIES)} + {len(db_only)}); got {len(rows)}"
    )

    by_id = {r["model_id"]: r for r in rows}
    # A DB-only id is present and marked as coming from the DB.
    assert by_id["brand-new-model"]["capability_source"] == "db_override"
    # A pure DEF row (no override) is present and marked as coming from the code registry.
    assert by_id["claude-opus-4-8"]["capability_source"] == "registry"
    # A disabled row is PRESENT AND FLAGGED, never omitted — a picker that silently drops a
    # model teaches the author it never existed (the _registry_row enabled semantics).
    assert by_id["gpt-4o"]["enabled"] is False
    assert by_id["gpt-4o"]["deprecated"] is True


def test_absent_override_row_reads_enabled(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The `enabled` semantics are _registry_row's — an ABSENT override row means ENABLED,
    which is what the RUNTIME enforcement (_resolve_enabled_model) agrees with. Pinned here
    because a reviewer comparing this count against /me/preferences' allowed_models (which
    treats an absent row as NOT offerable) must find a decision, not a bug."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, [])  # zero override rows at all

    rows = client.get("/models/registry", headers=auth_headers).json()["models"]
    assert rows, "an empty overrides table must still yield the full code registry"
    assert all(r["enabled"] is True for r in rows), (
        "with no override rows at all, every model must read enabled — a picker NARROWER "
        "than the engine is a different lie, not an absence of one"
    )


# ── T-196-AC2: the operator gate is NOT widened ────────────────────────────────


def test_admin_models_still_404_for_the_same_identity(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """T-196-AC2, the load-bearing contrast: the SAME seeded non-operator identity that just
    got a 200 from /models/registry gets a byte-identical 404 from /admin/models.

    Both halves live in ONE test so the two claims cannot drift apart, and so nobody can read
    the 200 as evidence that the gate was widened to produce it.
    """
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    author = client.get("/models/registry", headers=auth_headers)
    admin = client.get("/admin/models", headers=auth_headers)

    assert author.status_code == 200, "the narrow route must serve this identity"
    assert admin.status_code == 404, "the operator gate must still refuse the SAME identity"
    assert admin.json() == {"detail": "Not Found"}, "byte-identical body (non-discoverable)"
    assert "application/json" in admin.headers.get("content-type", ""), (
        "byte-identical content-type — a differently-shaped 404 is a disclosure"
    )


def test_registry_route_is_not_registered_under_admin(client):
    """Structural backstop: the new path is top-level, so it can never inherit — or be
    mistaken for inheriting — admin.py's router-level require_operator."""
    from app.main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/models/registry" in paths, "the author route must be registered"
    assert not any(p.startswith("/admin") and "registry" in p for p in paths), (
        "the author route must not live under /admin"
    )


# ── T-196-LEAK: the six-key allowlist ──────────────────────────────────────────


def test_every_row_key_set_equals_the_six_key_allowlist(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """T-196-LEAK: SET EQUALITY, not `not in` checks. A field added to _registry_row later
    must fail HERE rather than travel to every author silently (CR-01)."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    rows = client.get("/models/registry", headers=auth_headers).json()["models"]
    assert rows

    for row in rows:
        assert set(row.keys()) == _ALLOWED_KEYS, (
            f"{row.get('model_id')!r} carries {sorted(set(row.keys()) ^ _ALLOWED_KEYS)} — the "
            f"author projection is an ALLOWLIST; add a field deliberately or not at all"
        )


def test_serialized_body_contains_no_operator_only_field_name(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """Substring backstop over the RAW body, so a leak nested anywhere (not just at row top
    level) still fails. The seeded deprecated_reason is deliberately sensitive-looking prose:
    api.ts documents that field as 'operator context, never shown to end users'."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    raw = client.get("/models/registry", headers=auth_headers).text

    for needle in _FORBIDDEN_SUBSTRINGS:
        assert needle not in raw, f"{needle!r} leaked into the author payload"
    assert "vendor incident" not in raw, (
        "the seeded operator prose leaked — deprecated_reason must not travel"
    )


# ── D-13: emit_tier on the wire, for the first time ────────────────────────────


def test_emit_tier_travels_on_every_row(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """D-13: every union row carries an emit_tier key. A DB-only row with no stored value
    carries null — 'not tracked', which the consumer reads as coerce. It is deliberately NOT
    coalesced to 'coerce' on the wire: a row that says coerce could not be told apart from a
    row that says nothing."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    rows = client.get("/models/registry", headers=auth_headers).json()["models"]
    by_id = {r["model_id"]: r for r in rows}

    assert all("emit_tier" in r for r in rows), "emit_tier must be present on EVERY row"
    assert by_id["brand-new-model"]["emit_tier"] is None, (
        "an untracked DB-only row reports null, not a guessed tier"
    )
    assert by_id["claude-opus-4-8"]["emit_tier"] == (
        MODEL_CAPABILITIES["claude-opus-4-8"].get("emit_tier")
    ), "a pure DEF row reports the CODE registry's tier"


def test_db_emit_tier_beats_the_code_value(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The overlay rule (OVR wins over DEF) reaches the wire: gpt-4o ships force_strict in
    MODEL_CAPABILITIES and the seeded override says coerce — the author must see coerce, which
    is what a run would actually do."""
    assert MODEL_CAPABILITIES["gpt-4o"].get("emit_tier") == "force_strict", (
        "fixture premise: the code value must differ from the seeded DB value, else this "
        "case cannot distinguish an overlay from a passthrough"
    )
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    rows = client.get("/models/registry", headers=auth_headers).json()["models"]
    by_id = {r["model_id"]: r for r in rows}
    assert by_id["gpt-4o"]["emit_tier"] == "coerce"


# ── Open Q1/Q4: run_default_model is COMPUTED, never guessed ───────────────────


def test_run_default_model_is_present_and_matches_the_run_chain(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The field is present, and its value is re-derived here through the SAME chain
    workflow_kickoff.py:485 uses — never compared against a literal id. A hardcoded
    'gpt-5.4' in either place would recreate exactly the lie AUTH-04 removes."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    body = client.get("/models/registry", headers=auth_headers).json()
    assert "run_default_model" in body

    # Re-derive independently, from the same seeded state.
    import asyncio

    from app.models.user_settings import load_app_settings_async
    from app.services.sub_agent_models import resolve_workflow_ctx_model

    us._settings_cache = None
    us._settings_cache_time = 0.0
    _reset_override_caches()
    expected = resolve_workflow_ctx_model(asyncio.run(load_app_settings_async())) or None

    # NON-VACUITY FLOOR: if the chain resolved to nothing here, this case and the
    # null-when-empty case below would both be asserting `is None` and neither would prove
    # anything. State it, so a future fixture change that empties the chain fails loudly.
    assert expected, (
        "fixture non-vacuity: the run chain must resolve to a real id under this seeding"
    )
    assert body["run_default_model"] == expected


def test_run_default_model_is_null_when_the_chain_resolves_empty(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """An honest absence, never a guessed id. resolve_workflow_ctx_model returns "" when it
    cannot resolve (e.g. user_settings is None on resume) — that must surface as null so the
    picker falls back to its bare 'Use the run's model' label (D-06)."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)
    monkeypatch.setattr(
        "app.services.sub_agent_models.resolve_workflow_ctx_model", lambda *_a, **_k: ""
    )

    body = client.get("/models/registry", headers=auth_headers).json()
    assert body["run_default_model"] is None, (
        "an unresolvable default must be null — never app_settings.llm_model, never a constant"
    )


def test_run_default_model_survives_a_broken_chain(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """Fail-soft: a blip in the run-default chain returns null and the union still ships. A
    500 here would take the whole picker down over a cosmetic label."""
    _prime_non_operator(monkeypatch, mock_asyncpg_pool, _SEEDED_ROWS)

    def _boom(*_a, **_k):
        raise RuntimeError("settings read blew up")

    monkeypatch.setattr("app.services.sub_agent_models.resolve_workflow_ctx_model", _boom)

    res = client.get("/models/registry", headers=auth_headers)
    assert res.status_code == 200, "the union must still be served"
    assert res.json()["run_default_model"] is None
    assert res.json()["models"], "the models list is unaffected by a run-default failure"
