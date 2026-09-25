"""Phase 267 (PACK-22 / D-267-05..07 / D-267-02) — ONE "is it connected" rule, read by the run's
resolver AND by every Expert read.

* ``expert_service.connection_states`` is the one rule: an org row with ``is_enabled`` AND
  ``status = 'active'`` whose ``service_id`` OR ``capability`` equals the slug. It reads ALL the
  org's rows, so a missing service can still be NAMED (a revoked "Google Workspace").
* ``resolve_expert_bundle`` calls it and strips exactly what it stripped at the phase base — the
  characterization literals below were CAPTURED BY RUNNING THE BASE CODE (``785c03274``), not
  written from reading it.
* ``GET /experts`` (both arms) and ``GET /experts/{id}`` carry two NEW keys, ``connection_state``
  and ``can_connect``. ``required_connections`` is never mutated: it round-trips into
  ``PATCH /experts/{id}`` for org-authored Experts.
* ``can_connect`` is exactly the gate ``POST /connections`` applies — ``org:manage`` AND the
  ``live_connectors`` feature visible — and never ``experts:manage`` (UI-SPEC R-1).
* The overlaid row for a fixed input is the wire contract, frozen in
  ``tests/fixtures/phase267/expert_overlay_row.json``; plan 267-03's frontend test parses the same
  file, so neither side mocks the other's shape.
"""
from __future__ import annotations

import json
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.api import experts as experts_api
from app.api.experts import router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.services import expert_service as es
from app.services.entitlement_service import EntitlementResult

FIXTURE = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "phase267" / "expert_overlay_row.json"

ORG = UUID("11111111-1111-1111-1111-111111111111")
USER = UUID("22222222-2222-2222-2222-222222222222")
BID = UUID("33333333-3333-3333-3333-333333333333")

ORG_ROWS = [
    {"service_id": "google", "capability": None, "name": "Google Workspace", "is_enabled": True, "status": "revoked"},
    {"service_id": "notion", "capability": "docs", "name": "Notion", "is_enabled": True, "status": "active"},
    {"service_id": "slack", "capability": None, "name": "Slack", "is_enabled": False, "status": "active"},
]


class _Pool:
    """Honours the org binding the way Postgres would: rows only for ORG, only in $1.

    The base resolver's SQL filtered ``is_enabled`` / ``status`` itself; the fake applies that
    filter when the SQL asks for it, so one fake serves both the base and the extracted query.
    """

    def __init__(self, rows=ORG_ROWS):
        self.rows = rows
        self.calls: list[tuple[str, tuple]] = []

    async def fetch(self, query, *args):
        self.calls.append((query, args))
        rows = self.rows if (args and args[0] == ORG) else []
        if "status = 'active'" in query and "is_enabled = true" in query:
            rows = [r for r in rows if r["is_enabled"] and r["status"] == "active"]
        return rows


# ── connection_states: the ONE rule ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connection_states_names_and_judges_each_required_slug_in_order():
    pool = _Pool()
    states = await es.connection_states(pool, ORG, ["google", "notion", "docs", "hubspot"])
    assert [s.model_dump() for s in states] == [
        {"slug": "google", "name": "Google Workspace", "connected": False},
        {"slug": "notion", "name": "Notion", "connected": True},
        {"slug": "docs", "name": "Notion", "connected": True},
        {"slug": "hubspot", "name": "hubspot", "connected": False},
    ]
    assert len(pool.calls) == 1
    query, args = pool.calls[0]
    assert args == (ORG,)
    assert "org_id = $1" in query


@pytest.mark.asyncio
async def test_a_disabled_active_row_is_not_connected():
    states = await es.connection_states(_Pool(), ORG, ["slack"])
    assert states[0].model_dump() == {"slug": "slack", "name": "Slack", "connected": False}


@pytest.mark.asyncio
async def test_no_org_means_nothing_is_connected_and_nothing_is_queried():
    pool = _Pool()
    states = await es.connection_states(pool, None, ["google", "notion"])
    assert [s.model_dump() for s in states] == [
        {"slug": "google", "name": "google", "connected": False},
        {"slug": "notion", "name": "notion", "connected": False},
    ]
    assert pool.calls == []


@pytest.mark.asyncio
async def test_nothing_required_means_nothing_queried():
    pool = _Pool()
    assert await es.connection_states(pool, ORG, []) == []
    assert pool.calls == []


# ── the resolver: unchanged behaviour, one rule ──────────────────────────────────────────────

REQUIRED = ["google", "notion", "docs", "hubspot", "slack"]

# CAPTURED BY RUNNING resolve_expert_bundle AT THE PHASE BASE (785c03274) with these fixtures.
BASE_ORG = (["notion", "docs"], ["connection:google", "connection:hubspot", "connection:slack"], 3)
BASE_NO_ORG = (
    [],
    ["connection:google", "connection:notion", "connection:docs", "connection:hubspot", "connection:slack"],
    5,
)


async def _resolve(org):
    bundle = {
        "id": BID, "name": "RFP", "slug": "rfp", "is_system": False, "org_id": ORG,
        "member_skills": [], "knowledge_folder_ids": [], "required_connections": list(REQUIRED),
    }
    with patch.object(es.experts_db, "get_expert_bundle_by_id", AsyncMock(return_value=bundle)), \
         patch.object(es.experts_db, "check_expert_grant_access", AsyncMock(return_value=True)), \
         patch.object(es, "connection_states", wraps=es.connection_states) as spy:
        r = await es.resolve_expert_bundle(
            pool=_Pool(), bundle_id=BID, caller_org_id=org, caller_user_id=USER, caller_roles=[]
        )
    return r, spy


@pytest.mark.asyncio
@pytest.mark.parametrize("org,expected", [(ORG, BASE_ORG), (None, BASE_NO_ORG)])
async def test_the_resolver_strips_exactly_what_it_stripped_at_base(org, expected):
    r, spy = await _resolve(org)
    assert (r.effective_connections, r.stripped_details, r.stripped_members_count) == expected
    assert spy.await_count == 1


# ── the overlay on every Expert read ─────────────────────────────────────────────────────────

ALLOWED = EntitlementResult(
    allowed=True, capability="experts", current_tier="enterprise",
    required_tier=None, reason=None, upgrade_hint=None,
)


def _row(required, *, name="RFP Responder", rid=None):
    return {
        "id": rid or str(uuid4()),
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "is_system": False,
        "is_enabled": True,
        "visibility": "org",
        "required_connections": required,
    }


@pytest.fixture
def app_and_pool():
    app = FastAPI()
    app.include_router(experts_router)
    pool = _Pool()
    app.dependency_overrides[get_current_user] = lambda: {"id": str(USER), "email": "a@example.com"}
    app.dependency_overrides[get_active_org_id] = lambda: str(ORG)
    app.dependency_overrides[get_pg_pool] = lambda: pool
    return app, pool


def _perm(granted: set[str]):
    async def _has(_request, _user, _org, permission):
        return permission in granted
    return AsyncMock(side_effect=_has)


def _get(app, url, *, rows=None, bundle=None, perms=frozenset(), visible=True):
    with patch("app.services.entitlement_service.check_entitlement", AsyncMock(return_value=ALLOWED)), \
         patch.object(experts_api, "list_experts_service", AsyncMock(return_value=rows or [])), \
         patch.object(experts_api, "get_expert_service", AsyncMock(return_value=bundle)), \
         patch.object(experts_api, "_caller_roles", AsyncMock(return_value=["member"])), \
         patch.object(experts_api, "_has_org_permission", _perm(set(perms))) as has_perm, \
         patch.object(experts_api, "feature_visible", AsyncMock(return_value=visible)) as vis:
        resp = TestClient(app).get(url)
    return resp, has_perm, vis


def test_a_list_with_no_required_connections_costs_nothing(app_and_pool):
    app, pool = app_and_pool
    resp, has_perm, vis = _get(app, "/experts", rows=[_row([]), _row(None)])
    assert resp.status_code == status.HTTP_200_OK
    for r in resp.json():
        assert r["connection_state"] == []
        assert r["can_connect"] is False
    assert pool.calls == []
    has_perm.assert_not_awaited()
    vis.assert_not_awaited()


def test_a_missing_connection_is_named_and_required_connections_is_untouched(app_and_pool):
    app, pool = app_and_pool
    required = ["google", "notion"]
    row = _row(required)
    resp, _, _ = _get(app, "/experts", rows=[row], perms={"org:manage"})
    body = resp.json()[0]
    assert body["connection_state"] == [
        {"slug": "google", "name": "Google Workspace", "connected": False},
        {"slug": "notion", "name": "Notion", "connected": True},
    ]
    assert body["required_connections"] == ["google", "notion"]
    # the INPUT row was copied, never mutated
    assert row["required_connections"] is required and required == ["google", "notion"]
    assert "connection_state" not in row
    assert len(pool.calls) == 1, "one read for the whole list"


@pytest.mark.parametrize(
    "perms,visible,expected",
    [
        ({"org:manage"}, True, True),
        ({"org:manage"}, False, False),
        (set(), True, False),
        ({"experts:manage"}, True, False),
    ],
)
def test_can_connect_is_exactly_the_post_connections_gate(app_and_pool, perms, visible, expected):
    app, _ = app_and_pool
    resp, _, _ = _get(app, "/experts", rows=[_row(["google"])], perms=perms, visible=visible)
    assert resp.json()[0]["can_connect"] is expected


def test_every_connection_connected_does_not_ask_the_permission(app_and_pool):
    app, _ = app_and_pool
    resp, has_perm, _ = _get(app, "/experts", rows=[_row(["notion"])], perms={"org:manage"})
    assert resp.json()[0]["can_connect"] is False
    has_perm.assert_not_awaited()


def test_the_management_arm_carries_both_keys(app_and_pool):
    app, _ = app_and_pool
    resp, _, _ = _get(
        app, "/experts?for_management=true", rows=[_row(["google"])], perms={"experts:manage", "org:manage"}
    )
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()[0]
    assert body["connection_state"] == [{"slug": "google", "name": "Google Workspace", "connected": False}]
    assert body["can_connect"] is True


def test_get_one_expert_carries_both_keys(app_and_pool):
    app, _ = app_and_pool
    bundle = _row(["google", "notion"])
    resp, _, _ = _get(app, f"/experts/{BID}", bundle=bundle, perms=set())
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert [s["connected"] for s in body["connection_state"]] == [False, True]
    assert body["can_connect"] is False


# ── the wire contract (read by plan 267-03's frontend test) ──────────────────────────────────

FIXED_ROW = {
    "id": "44444444-4444-4444-4444-444444444444",
    "name": "RFP Responder",
    "slug": "rfp-responder",
    "is_system": False,
    "is_enabled": True,
    "visibility": "org",
    "required_connections": ["google", "notion"],
}


@pytest.mark.asyncio
async def test_the_overlaid_row_is_the_committed_wire_fixture():
    with patch.object(experts_api, "_has_org_permission", AsyncMock(return_value=True)), \
         patch.object(experts_api, "feature_visible", AsyncMock(return_value=True)):
        (overlaid,) = await experts_api._overlay_connection_state_for_caller(
            MagicMock(), {"id": str(USER)}, str(ORG), _Pool(), [dict(FIXED_ROW)], ORG
        )
    committed = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert json.dumps(overlaid, sort_keys=True) == json.dumps(committed, sort_keys=True)
    assert "connection_state" in committed and "can_connect" in committed


# ── feature_visible: the non-raising body of require_visible ─────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operator,audience,role_allowed,expected",
    [
        (True, "role", False, True),       # operator
        (False, "everyone", False, True),  # everyone audience
        (False, "role", True, True),       # role allowed
        (False, "role", False, False),     # role denied
        (False, "operator", False, False),  # anything else fails closed
    ],
)
async def test_feature_visible_matches_require_visible(operator, audience, role_allowed, expected):
    from app import dependencies as deps  # noqa: PLC0415

    user = {"id": str(USER)}
    with patch.object(deps, "is_operator", AsyncMock(return_value=operator)), \
         patch("app.models.user_settings.feature_audience", return_value=audience), \
         patch("app.models.user_settings.resolve_feature_access", return_value=role_allowed), \
         patch.object(deps, "resolve_caller_role", AsyncMock(return_value=("member", set()))):
        assert await deps.feature_visible(MagicMock(), user, "live_connectors") is expected
        dep = deps.require_visible("live_connectors")
        if expected:
            assert await dep(current_user=user, request=MagicMock()) is None
        else:
            with pytest.raises(HTTPException) as exc:
                await dep(current_user=user, request=MagicMock())
            assert exc.value.status_code == 403
            assert exc.value.detail == "This feature is available to administrators only."


# ── D-267-02: the kept field says it is not read ─────────────────────────────────────────────

def test_tool_floor_enabled_documents_that_nothing_reads_it():
    from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate  # noqa: PLC0415

    for model in (ExpertBundleCreate, ExpertBundleUpdate):
        desc = model.model_fields["tool_floor_enabled"].description or ""
        assert "not read since Phase 267" in desc, model.__name__


def test_the_drafter_prompt_no_longer_promises_a_tool_floor():
    from app.services import expert_authoring  # noqa: PLC0415

    src = pathlib.Path(expert_authoring.__file__).read_text(encoding="utf-8")
    assert "so deliverable tools" not in src


# ── 267-05 F-1: the visibility answer refreshes the settings cache first ─────────────────────
# Live drive (evidence/03b): on a cold worker an org-admin read ``can_connect: false`` until an
# unrelated ``GET /features`` warmed the cache, because ``feature_visible`` read the audience
# through the SYNC settings reader with no staleness bound. Every other gated read awaits
# ``ensure_settings_fresh()`` first (canvas gate, ``require_canvas``, ``/features``); this one
# did not, and ``require_visible`` — POST /connections included — shares its body.

@pytest.mark.asyncio
async def test_feature_visible_refreshes_settings_before_reading_the_audience():
    from app import dependencies as deps

    order: list[str] = []

    async def _fresh():
        order.append("fresh")

    def _audience(feature):
        order.append("audience")
        return "everyone"

    with patch.object(deps, "is_operator", AsyncMock(return_value=False)), \
         patch("app.models.user_settings.ensure_settings_fresh", _fresh), \
         patch("app.models.user_settings.feature_audience", _audience):
        assert await deps.feature_visible(None, {"id": str(USER)}, "live_connectors") is True
    assert order == ["fresh", "audience"], order
