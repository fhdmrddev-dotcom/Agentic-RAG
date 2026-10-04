"""Phase 276 (DOCS-04, D-03 / D-20) — the live API explorer is sign-in-gated in production.

**What changed.** Until Phase 276, ``GET /docs``, ``/redoc`` and ``/openapi.json`` answered 200 to
anyone, by a recorded decision (``main.py``'s Phase 182 comment: "App-wide ``docs_url`` gating has
never been a convention"). The operator reversed that **for production only** on 2026-10-04:
with ``ENVIRONMENT=production`` an unauthenticated caller gets 401; locally (``ENVIRONMENT``
unset) the explorer loads exactly as before.

**Why the conftest blanket override does not blind this file.** ``require_api_docs_access``
calls ``get_current_user`` DIRECTLY (not through ``Depends``), so the blanket
``app.dependency_overrides[get_current_user]`` never applies to it. The override is popped
anyway, so that if a future refactor routes the gate through ``Depends(get_current_user)`` the
production arms still exercise the real token check rather than a dict.

**The onebox assertion.** D-20's fail-open risk is ``ENVIRONMENT`` being unset on a deploy. The
onebox example is the default a fresh operator copies, so this file fails if it ever stops
setting ``ENVIRONMENT=production``. (The Coolify post-deploy ``curl`` expecting 401 stays an
owed verify-work item — no unit test can reach a live host.)

Fully offline: no DB, no pg pool, no network. Imports inside test bodies, ``client`` fixture.
"""
from pathlib import Path
from types import SimpleNamespace

import pytest

_DOC_PATHS = ("/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect")
_AUTH_HEADER = {"Authorization": "Bearer docs-token-abc"}


def _pop_user_override():
    from app.dependencies import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)


def _gate_on(monkeypatch, value="production"):
    from app.config import settings

    monkeypatch.setattr(settings, "environment", value)


def _gate_off(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "environment", "")


async def _not_banned(user_id):
    return False


def _fake_supabase(valid: bool):
    def _get_user(token):
        if not valid:
            raise Exception("invalid JWT")  # GoTrue's 4xx path -> 401
        return SimpleNamespace(
            user=SimpleNamespace(id="7f3a1c58-2b64-4e19-9d0a-000000000276", email="d@x.io")
        )

    return SimpleNamespace(auth=SimpleNamespace(get_user=_get_user))


def _install_supabase(monkeypatch, valid: bool):
    from app import dependencies
    from app.dependencies import get_supabase
    from app.main import app

    monkeypatch.setattr(dependencies, "_is_banned", _not_banned)
    fake = _fake_supabase(valid)
    app.dependency_overrides[get_supabase] = lambda: fake


# ── 1) local: open, exactly as before ────────────────────────────────────────


@pytest.mark.parametrize("path", _DOC_PATHS)
def test_local_unset_environment_serves_docs_without_a_token(client, monkeypatch, path):
    _pop_user_override()
    _gate_off(monkeypatch)
    resp = client.get(path)
    assert resp.status_code == 200, f"{path} -> {resp.status_code}: {resp.text[:200]}"


# ── 2) production: refuses without a bearer ──────────────────────────────────


@pytest.mark.parametrize("path", _DOC_PATHS)
def test_production_refuses_unauthenticated_docs_with_401(client, monkeypatch, path):
    _pop_user_override()
    _gate_on(monkeypatch)
    resp = client.get(path)
    assert resp.status_code == 401, f"{path} -> {resp.status_code}: {resp.text[:200]}"
    assert resp.json()["detail"] == "Sign in to view the API reference."
    assert resp.headers.get("www-authenticate") == "Bearer"


@pytest.mark.parametrize("value", ["prod", " Production ", "PRODUCTION"])
def test_production_spellings_also_gate(client, monkeypatch, value):
    _pop_user_override()
    _gate_on(monkeypatch, value)
    assert client.get("/openapi.json").status_code == 401


def test_production_refuses_an_invalid_bearer(client, monkeypatch):
    _pop_user_override()
    _gate_on(monkeypatch)
    _install_supabase(monkeypatch, valid=False)
    resp = client.get("/docs", headers=_AUTH_HEADER)
    assert resp.status_code == 401, resp.text[:200]


# ── 3) production: a signed-in token is served ───────────────────────────────


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_production_serves_docs_to_a_valid_bearer(client, monkeypatch, path):
    _pop_user_override()
    _gate_on(monkeypatch)
    _install_supabase(monkeypatch, valid=True)
    resp = client.get(path, headers=_AUTH_HEADER)
    assert resp.status_code == 200, f"{path} -> {resp.status_code}: {resp.text[:200]}"


def test_gated_openapi_still_applies_the_canvas_filter(client, monkeypatch):
    """The gated route returns ``request.app.openapi()`` — the canvas-aware hook — not a raw doc."""
    from app.models import user_settings as us

    _pop_user_override()
    _gate_on(monkeypatch)
    _install_supabase(monkeypatch, valid=True)
    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "off"}}
        ),
    )
    resp = client.get("/openapi.json", headers=_AUTH_HEADER)
    assert resp.status_code == 200, resp.text[:200]
    paths = resp.json()["paths"]
    assert "/workflows/grounding-bundle" not in paths, "canvas path leaked through the gated route"
    assert "/workflows/published" in paths, "control path must survive the canvas filter"


# ── 4) the explorer routes are not themselves documented ─────────────────────


def test_docs_routes_are_absent_from_the_schema():
    from fastapi import FastAPI

    from app.main import app

    paths = FastAPI.openapi(app)["paths"]
    for path in _DOC_PATHS:
        assert path not in paths, f"{path} must be include_in_schema=False"


# ── 5) the onebox default cannot silently fail open (D-20) ───────────────────


def test_onebox_env_example_sets_environment_production():
    onebox = Path(__file__).resolve().parents[3] / "deploy" / "onebox.env.example"
    lines = [
        ln.strip()
        for ln in onebox.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.lstrip().startswith("#")
    ]
    assert "ENVIRONMENT=production" in lines, (
        "deploy/onebox.env.example must keep a live `ENVIRONMENT=production` line — "
        "without it a fresh onebox serves the live API explorer to anyone (DOCS-04, D-20)"
    )
