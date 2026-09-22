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


def test_tools_lost_names_only_models_that_actually_lose_tools(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⭐ The CONSEQUENCE field: which unregistered ids will silently lose tool calling.

    Asserted against ``_NATIVE_TOOL_PROVIDERS`` itself rather than a re-typed provider list, so
    adding a native provider to that frozenset cannot leave this fence quietly wrong.
    """
    from app.config import _NATIVE_TOOL_PROVIDERS

    _prime(monkeypatch, mock_asyncpg_pool, [])
    body = _get_providers(client, auth_headers)

    assert "tools_lost_models" in body
    for mid in body["tools_lost_models"]:
        # ⚠ CR-02: a flagged model is not necessarily UNREGISTERED any more — tool loss is a claim
        # about resolved capability. For the UNREGISTERED ones the inference table must agree.
        if mid in body["inferred_provider_for"]:
            assert body["inferred_provider_for"][mid] not in _NATIVE_TOOL_PROVIDERS, (
                f"{mid} was flagged as losing tools, but its inferred provider supports native tools"
            )
    # and the converse: an unverified id whose bucket IS native must NOT be flagged
    for mid, prov in body["inferred_provider_for"].items():
        if prov in _NATIVE_TOOL_PROVIDERS:
            assert mid not in body["tools_lost_models"]


# The same unknown model, configured under a LOCAL provider block. ⚠ The shared
# ``_SETTINGS_ROW`` lists it under ``openai`` only because that block is the one carrying an
# api_key — a fixture convenience, never a statement about where the model is served.
_LOCAL_BLOCK_SETTINGS_ROW = {
    **_SETTINGS_ROW,
    "provider_model_lists": {
        "openai": ["gpt-4o", "my-db-only-model"],
        "ollama": ["llama-4-scout-local"],
    },
}


def test_a_local_model_is_flagged_as_losing_tools(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The case the whole field exists for.

    ``llama-4-scout-local`` matches no inference pattern, so it is inferred to a provider
    OUTSIDE ``_NATIVE_TOOL_PROVIDERS``. The run then goes to STRUCTURED mode, the ``tools``
    param is never sent, and any tool call arrives as unparseable prose — the failure that
    stayed invisible for a day on 2026-08-18.

    ⚠ RE-DRIVEN 2026-09-21 (Phase 262), and the original input is described rather than
    silently swapped, because WHY it had to move is the finding.

    This case used to drive the model through the shared ``_SETTINGS_ROW``, where it sits in
    the **openai** block — and it passed for a reason that had nothing to do with the
    operator's configuration: every id matching none of the ten naming patterns fell to the
    ``ollama`` bucket no matter which provider it was listed under. **That fallback was the
    defect, not the mechanism.** It silently disabled tool calling for `grok-`, `mistral-`,
    `command-`, `qwen` and every id a vendor has not shipped yet.

    Phase 262 makes the unmatched case read the provider block the operator actually chose,
    so the model above is now correctly inferred ``openai``. The property THIS case exists to
    prove — *an unknown model on a tool-less provider is flagged* — is untouched, and it is
    proven here on an input where it still holds: the same id, listed under ``ollama``.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [], settings_row=_LOCAL_BLOCK_SETTINGS_ROW)

    body = _get_providers(client, auth_headers)

    assert "llama-4-scout-local" in body["tools_lost_models"]


def test_an_unknown_model_on_a_native_provider_is_NOT_flagged(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⭐ THE RETIREMENT, ASSERTED POSITIVELY — a retired fence that leaves nothing behind is
    indistinguishable from a deleted one.

    The same id, in the **openai** block of the shared fixture. Before Phase 262 this was
    flagged as losing tools, and the flag was TRUE: the runtime really did route it
    STRUCTURED. Both halves changed together, which is what makes this correct rather than
    merely quieter — ``resolve_calling_mode`` now returns NATIVE for it too.

    ⛔ THIS SURFACE AND THE RUNTIME MUST AGREE. They compute the inference separately —
    ``settings.py`` for the chip, ``openai_service`` for the request — so a change applied to
    one and not the other makes the warning a claim about nothing. That is precisely why the
    provider hint is passed at all three inference sites in ``settings.py``.
    """
    _prime(monkeypatch, mock_asyncpg_pool, [])

    body = _get_providers(client, auth_headers)

    assert "llama-4-scout-local" not in body["tools_lost_models"]
    assert body["inferred_provider_for"]["llama-4-scout-local"] == "openai"
    # Still UNVERIFIED — registered and calls-tools are two different questions, and this
    # phase changes only the second. The amber chip stays; its consequence line does not.
    assert "llama-4-scout-local" not in body["verified_models"]


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
    # ⚠ CR-02: NOT because it is registered — because its provider (`openai`) genuinely HAS
    # native tools. Registration alone no longer silences this claim; see the CR-02 cases below.
    assert "my-db-only-model" not in body["tools_lost_models"]


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


# ── ⛔ Gap-closure round 1 — the two blockers the code review found ────────────

def test_cr01_the_judge_picker_feed_is_exactly_the_validator_set(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⛔ CR-01 — the judge picker must not offer options the server refuses with 400.

    DRIVEN before this fence existed: `glm-4.7-flash` (an operator override row) appeared in
    `verified_models`, `SettingsPage` fed that set to `JudgeModelPicker`, and `PUT /settings`
    answered **400 "Unknown judge model: glm-4.7-flash"** — because the judge validator uses the
    SYNC `get_model_capability`, which never reads the DB.

    So `registry_models` exists as the validator's EXACT set. ⛔ If the validator is ever widened
    to accept `db_override`, widen it here too — the two must not drift, which is the whole shape
    of the defect this phase is about.
    """
    from app.config import MODEL_CAPABILITIES

    _prime(monkeypatch, mock_asyncpg_pool, [_DB_ONLY_ROW])
    res = client.get("/settings", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()

    assert set(body["registry_models"]) == set(MODEL_CAPABILITIES), (
        "the judge picker's feed must mirror `get_model_capability`'s sync path exactly"
    )
    assert "my-db-only-model" not in body["registry_models"], (
        "an override-only model in this set is a guaranteed 400 in the judge dropdown"
    )
    # …and the chip's set is still the wider union — the two answer different questions.
    assert "my-db-only-model" in body["verified_models"]


def test_cr02_a_registered_but_toolless_model_is_still_flagged(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """⛔ CR-02 — the phase's own regression, fenced.

    The first version computed tool loss only over UNREGISTERED ids. An operator-added self-hosted
    row is REGISTERED (so no `unverified` chip — correct) and resolves `native_tools=False`
    whenever its Native-tools field was left unset (which is the DEFAULT, because `familyDefaults`
    matches nothing for `lmstudio`/`custom`). Both surfaces went silent on exactly the models
    MODEL-04 newly enabled.

    ⚠ MEASURED, not reasoned: `{"model_id": "cr02-probe-local", "provider": "lmstudio"}` resolved
    `capability_source="db_override", native_tools=False` while sitting inside `verified_models`.
    """
    toolless_row = {
        "model_id": "local-no-tools",
        "provider": "lmstudio",   # outside _NATIVE_TOOL_PROVIDERS
        "enabled": True,
        "deprecated": False,
        "native_tools": None,     # the Add form's `unknown` tri-state stores NULL
    }
    settings_row = dict(_SETTINGS_ROW)
    settings_row["provider_model_lists"] = {"openai": ["gpt-4o", "local-no-tools"]}
    _prime(monkeypatch, mock_asyncpg_pool, [toolless_row], settings_row)

    body = _get_providers(client, auth_headers)

    assert "local-no-tools" in body["verified_models"], "it IS registered — the operator added it"
    assert "local-no-tools" in body["tools_lost_models"], (
        "REGISTERED and TOOL-LESS at the same time is not a contradiction — it is the default for "
        "a self-hosted row, and the warning must survive registration"
    )


def test_cr02_an_explicit_native_tools_true_is_believed(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The converse arm: when the operator SAID the model has tools, do not contradict them.

    Without this, the fix above would flag every self-hosted model forever — a warning on
    everything is a warning on nothing.
    """
    row = {
        "model_id": "local-with-tools",
        "provider": "lmstudio",
        "enabled": True,
        "deprecated": False,
        "native_tools": True,     # explicit — the operator ticked it
    }
    settings_row = dict(_SETTINGS_ROW)
    settings_row["provider_model_lists"] = {"openai": ["gpt-4o", "local-with-tools"]}
    _prime(monkeypatch, mock_asyncpg_pool, [row], settings_row)

    body = _get_providers(client, auth_headers)

    assert "local-with-tools" in body["verified_models"]
    assert "local-with-tools" not in body["tools_lost_models"]
