"""Phase 167 Plan 03 (VIS-01 / D-167-06) — role-greenlist resolver + gate + write.

Extends the Phase 148 ``require_visible`` precedent (test_148_require_visible.py /
test_148_visibility_cold_default.py) to the v3.4 ``{audience: role, roles:[...]}``
greenlist shape. The RED LINE (D-167-06): the ONE resolver is EXTENDED, never forked —
operators and everyone-audience features stay byte-identical no-ops; a caller whose org
role is NOT greenlisted is denied FAIL-CLOSED.

Covers all six D-167-06 behaviors:
  1. operator no-op (byte-identical carve-out)
  2. everyone no-op (byte-identical carve-out)
  3. a greenlisted role passes; an ungranted role gets 403 (fail-closed)
  4. precedence-merge: highest-role-wins for the primary tier
  5. precedence-merge: UNION for the secondary group grant
  6. cold/unknown/malformed record -> safe-deny (never a raise), and the GET /features
     map resolves the SAME greenlist so hide == refuse.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException


def _stored(feature_records):
    """A load_app_settings() stand-in returning a fixed feature_visibility map."""
    return lambda: SimpleNamespace(feature_visibility=feature_records)


# ── resolve_feature_access — the pure Glean precedence-merge (fail-closed) ──────

def test_resolve_everyone_true(monkeypatch):
    from app.models import user_settings as us
    monkeypatch.setattr(us, "load_app_settings", _stored({"f": {"audience": "everyone"}}))
    assert us.resolve_feature_access("f", "member", set()) is True


def test_resolve_operators_false(monkeypatch):
    """operators -> False here (the operator no-op is handled UPSTREAM by is_operator)."""
    from app.models import user_settings as us
    monkeypatch.setattr(us, "load_app_settings", _stored({"f": {"audience": "operators"}}))
    assert us.resolve_feature_access("f", "org-admin", set()) is False


def test_resolve_role_granted(monkeypatch):
    from app.models import user_settings as us
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"f": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    assert us.resolve_feature_access("f", "org-admin", set()) is True


def test_resolve_role_ungranted_fail_closed(monkeypatch):
    """A caller_role NOT in roles + no group intersection -> False (fail-closed)."""
    from app.models import user_settings as us
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"f": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    assert us.resolve_feature_access("f", "member", set()) is False


def test_precedence_merge(monkeypatch):
    """Highest-role-wins for the primary tier; UNION for the secondary group grant."""
    from app.models import user_settings as us
    # Primary tier: the highest greenlisted role passes; a lower ungranted role does not.
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"f": {"audience": "role", "roles": ["super-admin", "org-admin"], "groups": []}}),
    )
    assert us.resolve_feature_access("f", "super-admin", set()) is True
    assert us.resolve_feature_access("f", "member", set()) is False
    # Secondary UNION: a caller NOT in roles but whose group is granted still passes.
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"f": {"audience": "role", "roles": ["org-admin"], "groups": ["eng"]}}),
    )
    assert us.resolve_feature_access("f", "member", {"eng"}) is True
    assert us.resolve_feature_access("f", "member", {"sales"}) is False


def test_resolve_unknown_and_malformed_safe_deny(monkeypatch):
    """Unknown audience / malformed record / missing key -> safe-deny False, never raise."""
    from app.models import user_settings as us
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({
            "unknown": {"audience": "banana"},
            "malformed": {"audience": "role", "roles": "not-a-list"},
            "notdict": "operators",
        }),
    )
    assert us.resolve_feature_access("unknown", "super-admin", set()) is False
    assert us.resolve_feature_access("malformed", "super-admin", set()) is False
    assert us.resolve_feature_access("notdict", "super-admin", set()) is False
    assert us.resolve_feature_access("missing", "super-admin", set()) is False


# ── require_visible — the extended gate (operator/everyone no-op preserved) ─────

async def test_require_visible_operator_noop(monkeypatch):
    """Operator -> literal no-op pass-through (byte-identical carve-out)."""
    from app import dependencies as deps
    dep = deps.require_visible("skill_studio")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))
    assert await dep(current_user={"id": "op-1"}) is None


async def test_require_visible_everyone_noop(monkeypatch):
    """everyone-audience feature -> no-op for a non-operator (byte-identical carve-out)."""
    from app import dependencies as deps
    dep = deps.require_visible("workflow_authoring")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "everyone")
    assert await dep(current_user={"id": "u1"}) is None


async def test_require_visible_role_granted_passes(monkeypatch):
    """A caller whose resolved org role IS greenlisted passes the role gate (returns None)."""
    from app import dependencies as deps
    from app.models import user_settings as us
    dep = deps.require_visible("skill_studio")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "role")
    monkeypatch.setattr(deps, "resolve_caller_role", AsyncMock(return_value=("org-admin", set())))
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"skill_studio": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    req = SimpleNamespace(state=SimpleNamespace(org_role="org-admin"))
    assert await dep(current_user={"id": "u1"}, request=req) is None


async def test_require_visible_role_ungranted_403(monkeypatch):
    """A caller whose role is NOT greenlisted gets 403 (fail-closed)."""
    from app import dependencies as deps
    from app.models import user_settings as us
    dep = deps.require_visible("skill_studio")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "role")
    monkeypatch.setattr(deps, "resolve_caller_role", AsyncMock(return_value=("member", set())))
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"skill_studio": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    req = SimpleNamespace(state=SimpleNamespace(org_role="member"))
    with pytest.raises(HTTPException) as ei:
        await dep(current_user={"id": "u1"}, request=req)
    assert ei.value.status_code == 403


async def test_require_visible_role_resolution_failure_denies(monkeypatch):
    """If the caller's role can't be resolved (None) -> deny (fail-closed), never a raise."""
    from app import dependencies as deps
    from app.models import user_settings as us
    dep = deps.require_visible("skill_studio")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "role")
    monkeypatch.setattr(deps, "resolve_caller_role", AsyncMock(return_value=(None, set())))
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"skill_studio": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    req = SimpleNamespace(state=SimpleNamespace())
    with pytest.raises(HTTPException) as ei:
        await dep(current_user={"id": "u1"}, request=req)
    assert ei.value.status_code == 403


# ── GET /features — the map resolves the SAME greenlist (hide == refuse) ────────

async def test_effective_features_matches_gate(monkeypatch):
    """The /features bool for a role feature == what require_visible would enforce."""
    from app.api import features as feat
    from app.models import user_settings as us
    monkeypatch.setattr(feat, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr(
        feat, "feature_audience",
        lambda f: "role" if f == "skill_studio" else "everyone",
    )
    monkeypatch.setattr(feat, "resolve_caller_role", AsyncMock(return_value=("org-admin", set())))
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"skill_studio": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    req = SimpleNamespace(state=SimpleNamespace(org_role="org-admin"))
    out = await feat.get_effective_features(request=req, current_user={"id": "u1"})
    assert out["features"]["skill_studio"] is True          # granted role -> visible
    assert out["features"]["workflow_authoring"] is True    # everyone -> visible


async def test_effective_features_denies_ungranted(monkeypatch):
    """A member (not greenlisted) sees the role feature as False (hide == refuse)."""
    from app.api import features as feat
    from app.models import user_settings as us
    monkeypatch.setattr(feat, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr(feat, "feature_audience", lambda f: "role")
    monkeypatch.setattr(feat, "resolve_caller_role", AsyncMock(return_value=("member", set())))
    monkeypatch.setattr(
        us, "load_app_settings",
        _stored({"skill_studio": {"audience": "role", "roles": ["org-admin"], "groups": []}}),
    )
    req = SimpleNamespace(state=SimpleNamespace(org_role="member"))
    out = await feat.get_effective_features(request=req, current_user={"id": "u1"})
    assert out["features"]["skill_studio"] is False


# ── PUT /admin/visibility — role audience + allowlist-validated roles[] ─────────

async def test_admin_visibility_accepts_role(monkeypatch):
    """audience='role' + roles=['org-admin'] is accepted and serialized via the writer."""
    from app.api import admin
    spy = AsyncMock(return_value=True)
    monkeypatch.setattr(admin, "set_feature_visibility", spy)
    body = admin.VisibilityUpdate(feature="skill_studio", audience="role", roles=["org-admin"])
    req = SimpleNamespace(state=SimpleNamespace())
    resp = await admin.set_visibility(request=req, body=body, _floor=None)
    assert resp.status_code == 204
    spy.assert_awaited_once()
    args, kwargs = spy.call_args
    assert args[0] == "skill_studio"
    assert args[1] == "role"
    assert (kwargs.get("roles") or (args[2] if len(args) > 2 else None)) == ["org-admin"]


async def test_admin_visibility_rejects_bad_role(monkeypatch):
    """A role outside the 4-tier set -> 400 BEFORE any write."""
    from app.api import admin
    spy = AsyncMock(return_value=True)
    monkeypatch.setattr(admin, "set_feature_visibility", spy)
    body = admin.VisibilityUpdate(feature="skill_studio", audience="role", roles=["root"])
    req = SimpleNamespace(state=SimpleNamespace())
    with pytest.raises(HTTPException) as ei:
        await admin.set_visibility(request=req, body=body, _floor=None)
    assert ei.value.status_code == 400
    spy.assert_not_awaited()
