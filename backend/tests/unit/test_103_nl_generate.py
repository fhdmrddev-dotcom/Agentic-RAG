"""Phase 103 (REQ-2 / WFAUTH-02) — NL one-shot generation + single auto-retry.

Wave 0 (Plan 01 Task 1) authored the stubs; **Plan 02** fills them. The
``workflow_authoring`` service + ``POST /workflows/generate`` route now exist, so
these are GREEN (no longer xfail).

Behaviors proven (forced_emit + grounding accessors mocked at their boundaries —
NO live provider, NO agent loop):
  - test_one_call_on_valid: a first forced_emit that validates -> exactly ONE
    provider call (call_count == 1); no retry.
  - test_retry_once_on_validation_error: a first None -> EXACTLY one retry
    (call_count == 2), never a 3rd.
  - test_no_strict_for_authoring: every forced_emit call passes strict=False
    (Pitfall 1 — no OpenAI/DeepSeek strict 400 on the optional-heavy schema).
  - test_honest_fail_on_second_none: a second None -> an honest structured failure
    (ok=False / could_not_generate), NEVER a runnable/partial draft.
  - test_generate_route_delegates_and_does_not_persist: POST /workflows/generate
    delegates to the service and never calls create_workflow_definition.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; forced_emit mocked.
"""

from __future__ import annotations

import pytest


def _valid_definition_dict() -> dict:
    """A minimal valid WorkflowDefinition (no tools/skills/folder_scope so grounding
    fidelity is trivially clean)."""
    return {
        "slug": "weekly-risk",
        "version": 1,
        "name": "Weekly Risk Register",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Summarize the risks."},
                "validators": [],
            }
        ],
    }


def _valid_wd():
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(_valid_definition_dict())


def _patch_grounding(monkeypatch):
    """Patch the grounding accessors inside workflow_authoring so no live folder/tool/
    skill/DB read happens; return the (empty) registries the assembly uses."""
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        # (grounded_prompt, tool_names, skill_ids) — empty sets so a tool-free,
        # skill-free clean definition passes fidelity.
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)

    async def _fake_fidelity(*_args, **_kwargs):
        return None  # clean — no grounding violation

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)
    # A forceable authoring model with a real provider (no Settings knob needed).
    monkeypatch.setattr(
        wa,
        "resolve_authoring_model",
        lambda settings: "claude-opus-4-8",
    )


def _patch_provider(monkeypatch):
    """Make get_model_capability(authoring_model) resolve a provider."""
    import app.config as cfg

    monkeypatch.setattr(
        cfg, "get_model_capability", lambda model: {"forced_emission": True, "provider": "anthropic"}
    )


@pytest.mark.asyncio
async def test_one_call_on_valid(monkeypatch):
    """A first forced_emit that validates -> exactly ONE provider call (no retry)."""
    import app.services.workflow_authoring as wa

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)

    calls: list[int] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(1)
        return {"emitted": _valid_wd(), "failure": None}

    # forced_emit is imported function-locally inside generate_workflow_definition →
    # patch it on the module it is imported FROM.
    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    result = await wa.generate_workflow_definition(
        describe="Fill the risk register weekly.",
        supabase=object(),
        user_id="u1",
        settings=object(),
    )
    assert result["ok"] is True
    # The net-new draft slug is uniquified with a short hash suffix (UAT-103) so two
    # same-named generations never collide on UNIQUE(slug, version) at create time.
    assert result["definition"]["slug"].startswith("weekly-risk-")
    assert len(calls) == 1  # exactly ONE provider call


@pytest.mark.asyncio
async def test_retry_once_on_validation_error(monkeypatch):
    """A first None -> EXACTLY one retry (call_count == 2), never a 3rd, then success."""
    import app.services.workflow_authoring as wa

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)

    calls: list[int] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(1)
        if len(calls) == 1:
            return {"emitted": None, "failure": "model_failed_to_emit"}  # first-pass failure
        return {"emitted": _valid_wd(), "failure": None}  # retry succeeds

    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    result = await wa.generate_workflow_definition(
        describe="Fill the risk register weekly.",
        supabase=object(),
        user_id="u1",
        settings=object(),
    )
    assert result["ok"] is True
    assert len(calls) == 2  # EXACTLY one retry — never a 3rd


@pytest.mark.asyncio
async def test_no_strict_for_authoring(monkeypatch):
    """Every authoring forced_emit call passes strict=False (Pitfall 1)."""
    import app.services.workflow_authoring as wa

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)

    seen_strict: list = []

    async def _fake_forced_emit(**kwargs):
        seen_strict.append(kwargs.get("strict"))
        return {"emitted": _valid_wd(), "failure": None}

    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    result = await wa.generate_workflow_definition(
        describe="Fill the risk register weekly.",
        supabase=object(),
        user_id="u1",
        settings=object(),
    )
    assert result["ok"] is True
    assert seen_strict == [False]  # the authoring shot forces strict OFF


@pytest.mark.asyncio
async def test_honest_fail_on_second_none(monkeypatch):
    """A second None -> an honest structured failure (ok=False / could_not_generate),
    NEVER a runnable/partial draft."""
    import app.services.workflow_authoring as wa

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)

    calls: list[int] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(1)
        return {"emitted": None, "failure": "model_failed_to_emit"}  # both attempts fail

    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    result = await wa.generate_workflow_definition(
        describe="Fill the risk register weekly.",
        supabase=object(),
        user_id="u1",
        settings=object(),
    )
    assert result["ok"] is False
    assert result["error"] == "could_not_generate"
    assert "definition" not in result  # NEVER a partial/runnable draft
    assert len(calls) == 2  # attempt 1 + retry, no 3rd


@pytest.mark.asyncio
async def test_generate_route_delegates_and_does_not_persist(monkeypatch):
    """POST /workflows/generate delegates to the service and returns a draft object
    WITHOUT persisting it; an ok=False service result returns 200 with the structured
    error (persistence is REQ-1's explicit POST /workflows create)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api import workflows as wf_api
    import app.services.workflow_authoring as wa

    # The route imports workflow_authoring as a MODULE → patch the service fn on it.
    async def _fake_generate(**kwargs):
        return {"ok": True, "definition": _valid_definition_dict()}

    monkeypatch.setattr(wa, "generate_workflow_definition", _fake_generate)

    # The route resolves a pool via get_pg_pool() in its body — stub it so no live DB.
    async def _fake_pool():
        return object()

    monkeypatch.setattr(wf_api, "get_pg_pool", _fake_pool)

    # If the route ever tried to persist, this would be called — assert it is NOT.
    persisted: list = []

    async def _boom_create(*args, **kwargs):  # pragma: no cover — must never run
        persisted.append(1)
        return {"id": "00000000-0000-0000-0000-000000000000", "version": 1}

    monkeypatch.setattr(wf_api, "create_workflow_definition", _boom_create, raising=False)

    app = FastAPI()
    app.dependency_overrides[wf_api.get_current_user] = lambda: {"id": "u1"}
    app.dependency_overrides[wf_api.get_supabase] = lambda: object()
    app.include_router(wf_api.router)
    client = TestClient(app)

    resp = client.post("/workflows/generate", json={"describe": "weekly risk register"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["definition"]["slug"] == "weekly-risk"
    assert persisted == []  # the route NEVER persisted

    # An ok=False service result returns 200 with the structured error (honest fail).
    async def _fake_generate_fail(**kwargs):
        return {"ok": False, "error": "could_not_generate", "detail": "model_failed_to_emit"}

    monkeypatch.setattr(wa, "generate_workflow_definition", _fake_generate_fail)
    resp2 = client.post("/workflows/generate", json={"describe": "weekly risk register"})
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["ok"] is False
    assert body2["error"] == "could_not_generate"


@pytest.mark.asyncio
async def test_forced_emit_gets_user_settings_not_app_settings(monkeypatch):
    """REGRESSION (UAT-103 live blocker): the forced authoring shot MUST receive a
    per-USER settings object (``UserEffectiveSettings`` — it carries ``active_provider``,
    which the gateway dereferences to resolve the provider key/endpoint), NOT the
    app-level ``Settings``. The route passes the app ``Settings`` through as ``settings``;
    if that same object reached ``forced_emit`` as ``user_settings`` the gateway raised
    ``AttributeError('active_provider')`` → the backstop reported a generic
    ``provider_error`` and NL generation silently failed. The other tests mock
    ``forced_emit`` so they never exercised the gateway's settings contract — this pins it.
    """
    import app.services.workflow_authoring as wa
    import app.models.user_settings as us

    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)

    # The per-user object the loader returns — it has active_provider (gateway contract).
    class _Owner:
        active_provider = "openai"

    owner = _Owner()
    # load_user_settings is imported function-locally FROM app.models.user_settings →
    # patch it on the source module so the in-function import picks up the patch.
    monkeypatch.setattr(us, "load_user_settings", lambda user_id: owner)

    captured: dict = {}

    async def _fake_forced_emit(**kwargs):
        captured["user_settings"] = kwargs.get("user_settings")
        return {"emitted": _valid_wd(), "failure": None}

    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    # The app-level Settings the ROUTE passes — deliberately WITHOUT active_provider,
    # mirroring the real app config object that caused the live failure.
    class _AppSettings:
        harness_authoring_model = "claude-opus-4-8"

    app_settings = _AppSettings()

    result = await wa.generate_workflow_definition(
        describe="Fill the risk register weekly.",
        supabase=object(),
        user_id="u1",
        settings=app_settings,
    )
    assert result["ok"] is True
    # The gateway-bound settings must be the loaded OWNER object, never the app settings.
    assert captured["user_settings"] is owner
    assert hasattr(captured["user_settings"], "active_provider")
    assert captured["user_settings"] is not app_settings
