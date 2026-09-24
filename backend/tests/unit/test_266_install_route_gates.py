"""Phase 266 plan 03 — the install routes sit behind the EXISTING gates, and nothing else (D-266-02/04).

  - ``POST /experts/{id}/install``: router-level ``require_capability("experts")`` (the ONE tier
    home — no second check) + ``require_expert_manage``. A refused tier or a non-manager is a 403
    and the install service is NEVER awaited.
  - The org comes ONLY from ``Depends(get_active_org_id)``: the route has no body, so an
    ``org_id`` a client sends is ignored (asserted by value, and by the signature below).
  - Every refusal is structured (``detail.error``) and the catch-all detail is a LITERAL.
  - ``GET /experts/installs`` is declared before ``/{bundle_id}`` so it is never captured as a
    UUID path parameter (which would 422).
  - ``GET /experts`` and ``GET /experts/{id}`` hand their rows to the install overlay, with
    ``can_install`` from ``experts:manage`` evaluated only when a first-party row is present.

⛔ No database: every dependency is overridden and every service is patched at the route
module's import site.
"""

from __future__ import annotations

import ast
import inspect
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from pydantic import BaseModel

import app.api.experts as experts_api
from app.api.experts import router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool, get_user_supabase_client
from app.services.entitlement_service import EntitlementResult
from app.services.expert_install_service import (
    ExpertInstallConflict,
    ExpertInstallFolderNotOwned,
    ExpertInstallResult,
    ExpertInstallState,
    ExpertInstallSummary,
    ExpertNotInstallable,
)

CALLER_ID = str(uuid4())
ORG_ID = str(uuid4())
OTHER_ORG = str(uuid4())
BUNDLE_ID = uuid4()
FOLDER = uuid4()
USER_CLIENT = MagicMock(name="user-jwt-client")

ALLOWED = EntitlementResult(
    allowed=True, capability="experts", current_tier="enterprise", required_tier=None, reason=None,
    upgrade_hint=None,
)
REFUSED = EntitlementResult(
    allowed=False, capability="experts", current_tier="standard", required_tier="enterprise",
    reason="Capability not enabled for tier", upgrade_hint="Upgrade to Enterprise to use experts.",
)

SYSTEM_BUNDLE = {"id": BUNDLE_ID, "slug": "financial-analyzer", "name": "Financial Analyzer", "is_system": True}


def _result() -> ExpertInstallResult:
    return ExpertInstallResult(
        expert_bundle_id=BUNDLE_ID,
        corpus_version="v1",
        install=ExpertInstallState(state="installing", folder_id=FOLDER, can_install=True),
    )


@pytest.fixture
def app_():
    app = FastAPI()
    app.include_router(experts_router)
    app.dependency_overrides[get_current_user] = lambda: {"id": CALLER_ID, "email": "admin@example.com"}
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    app.dependency_overrides[get_user_supabase_client] = lambda: USER_CLIENT
    return app


def _patches(*, tier=ALLOWED, perm=True, bundle=SYSTEM_BUNDLE, install=None):
    check = patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=tier)
    perm_p = patch("app.api.experts._has_org_permission", new_callable=AsyncMock, return_value=perm)
    get_p = patch("app.api.experts.get_expert_service", new_callable=AsyncMock, return_value=bundle)
    inst = patch("app.api.experts.install_expert_service", new_callable=AsyncMock)
    return check, perm_p, get_p, inst, install


def _post(app_, **kw):
    check, perm_p, get_p, inst, install = _patches(**kw)
    with check, perm_p as mperm, get_p as mget, inst as minst:
        if isinstance(install, Exception):
            minst.side_effect = install
        else:
            minst.return_value = install or _result()
        resp = TestClient(app_).post(f"/experts/{BUNDLE_ID}/install", json={"org_id": OTHER_ORG})
    return resp, mperm, mget, minst


# ── gates ────────────────────────────────────────────────────────────────────────────────────


def test_a_standard_tier_org_gets_the_plan_naming_refusal_and_nothing_runs(app_):
    resp, _perm, mget, minst = _post(app_, tier=REFUSED)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert resp.json()["detail"]["error"] == "entitlement_required"
    minst.assert_not_awaited()
    mget.assert_not_awaited()


def test_a_non_manager_is_refused_and_the_service_is_never_awaited(app_):
    resp, mperm, _get, minst = _post(app_, perm=False)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert resp.json()["detail"] == "You do not have permission to manage experts for this organization."
    assert mperm.await_args.args[3] == "experts:manage"
    minst.assert_not_awaited()


def test_a_manager_on_an_entitled_tier_gets_202_and_the_result(app_):
    resp, _perm, mget, minst = _post(app_)
    assert resp.status_code == status.HTTP_202_ACCEPTED
    body = ExpertInstallResult.model_validate(resp.json())
    assert body == _result()

    kw = minst.await_args.kwargs
    assert kw["bundle"] is SYSTEM_BUNDLE or kw["bundle"] == SYSTEM_BUNDLE
    assert kw["user_id"] == UUID(CALLER_ID)
    assert kw["supabase"] is USER_CLIENT, "tenant rows are written with the caller's user-JWT client"
    assert kw["can_install"] is True

    gkw = mget.await_args.kwargs
    assert gkw["bundle_id"] == BUNDLE_ID
    assert gkw["caller_user_id"] == UUID(CALLER_ID), "grant-aware lookup: an invisible bundle 404s first"
    assert "caller_roles" in gkw


def test_the_org_comes_only_from_the_active_org_never_the_body(app_):
    resp, _perm, _get, minst = _post(app_)
    assert resp.status_code == status.HTTP_202_ACCEPTED
    assert minst.await_args.kwargs["org_id"] == UUID(ORG_ID)
    assert minst.await_args.kwargs["org_id"] != UUID(OTHER_ORG)
    assert OTHER_ORG not in repr(minst.await_args)


def test_a_bundle_the_caller_cannot_see_is_404(app_):
    resp, _perm, _get, minst = _post(app_, bundle=None)
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert resp.json()["detail"] == "Expert bundle not found"
    minst.assert_not_awaited()


@pytest.mark.parametrize(
    "exc, error",
    [
        (ExpertNotInstallable("Only a first-party Expert that ships sample knowledge can be installed."), "expert_not_installable"),
        (ExpertInstallConflict("A copy of x.md already exists elsewhere."), "install_conflict"),
        (ExpertInstallFolderNotOwned("The folder belongs to the admin who first installed it."), "install_folder_not_owned"),
    ],
    ids=["not installable", "conflict", "folder not owned"],
)
def test_named_refusals_are_structured_409s(app_, exc, error):
    resp, *_ = _post(app_, install=exc)
    assert resp.status_code == status.HTTP_409_CONFLICT
    detail = resp.json()["detail"]
    assert detail == {"detail": exc.sentence, "error": error}


def test_an_http_exception_from_the_service_passes_through(app_):
    resp, *_ = _post(app_, install=HTTPException(status_code=404, detail="Folder not found"))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Folder not found"


def test_an_unexpected_failure_is_a_500_with_a_literal_detail(app_):
    secret = "asyncpg: password=hunter2 host=10.0.0.5"
    resp, *_ = _post(app_, install=RuntimeError(secret))
    assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert resp.json() == {"detail": "Could not install this Expert."}
    assert "hunter2" not in resp.text


# ── GET /experts/installs ────────────────────────────────────────────────────────────────────


def test_installs_route_returns_the_orgs_summaries_and_is_not_captured_by_bundle_id(app_):
    summary = ExpertInstallSummary(expert_bundle_id=BUNDLE_ID, expert_name="Financial Analyzer", folder_id=FOLDER, state="ready")
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ALLOWED), \
         patch("app.api.experts.list_install_summaries", new_callable=AsyncMock, return_value=[summary]) as msum, \
         patch("app.api.experts.get_expert_service", new_callable=AsyncMock) as mget:
        resp = TestClient(app_).get("/experts/installs")
    assert resp.status_code == status.HTTP_200_OK, resp.text
    assert [ExpertInstallSummary.model_validate(x) for x in resp.json()] == [summary]
    assert msum.await_args.kwargs["org_id"] == UUID(ORG_ID)
    mget.assert_not_awaited()


def test_installs_route_is_tier_gated(app_):
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=REFUSED), \
         patch("app.api.experts.list_install_summaries", new_callable=AsyncMock) as msum:
        resp = TestClient(app_).get("/experts/installs")
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert resp.json()["detail"]["error"] == "entitlement_required"
    msum.assert_not_awaited()


def test_installs_route_is_declared_before_the_bundle_id_route():
    src = pathlib.Path(experts_api.__file__).read_text(encoding="utf-8")
    assert src.index('@router.get("/installs"') < src.index('@router.get("/{bundle_id}"')


# ── overlay on list / get ────────────────────────────────────────────────────────────────────


def _overlay_mock():
    async def _ov(pool, rows, *, org_id, can_install):
        return [{**r, "install": {"state": "ready"}} if r.get("is_system") else r for r in rows]
    return AsyncMock(side_effect=_ov)


@pytest.mark.parametrize("perm", [True, False])
def test_list_hands_its_rows_to_the_overlay_with_can_install_from_experts_manage(app_, perm):
    ov = _overlay_mock()
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ALLOWED), \
         patch("app.api.experts.list_experts_service", new_callable=AsyncMock, return_value=[dict(SYSTEM_BUNDLE, id=str(BUNDLE_ID))]), \
         patch("app.api.experts._has_org_permission", new_callable=AsyncMock, return_value=perm) as mperm, \
         patch("app.api.experts.overlay_install_state", ov):
        resp = TestClient(app_).get("/experts")
    assert resp.status_code == 200
    assert resp.json()[0]["install"] == {"state": "ready"}
    assert ov.await_args.kwargs["org_id"] == UUID(ORG_ID)
    assert ov.await_args.kwargs["can_install"] is perm
    assert mperm.await_args.args[3] == "experts:manage"


def test_a_list_with_no_first_party_row_asks_no_permission_question(app_):
    ov = _overlay_mock()
    authored = [{"id": str(uuid4()), "is_system": False, "name": "House"}]
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ALLOWED), \
         patch("app.api.experts.list_experts_service", new_callable=AsyncMock, return_value=authored), \
         patch("app.api.experts._has_org_permission", new_callable=AsyncMock) as mperm, \
         patch("app.api.experts.overlay_install_state", ov):
        resp = TestClient(app_).get("/experts")
    assert resp.status_code == 200
    assert resp.json() == authored
    mperm.assert_not_awaited()


def test_management_list_is_overlaid_too(app_):
    ov = _overlay_mock()
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ALLOWED), \
         patch("app.api.experts.list_experts_service", new_callable=AsyncMock, return_value=[dict(SYSTEM_BUNDLE, id=str(BUNDLE_ID))]), \
         patch("app.api.experts._has_org_permission", new_callable=AsyncMock, return_value=True), \
         patch("app.api.experts.overlay_install_state", ov):
        resp = TestClient(app_).get("/experts?for_management=true")
    assert resp.status_code == 200
    assert resp.json()[0]["install"] == {"state": "ready"}
    ov.assert_awaited_once()


def test_get_one_expert_is_overlaid(app_):
    ov = _overlay_mock()
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ALLOWED), \
         patch("app.api.experts.get_expert_service", new_callable=AsyncMock, return_value=dict(SYSTEM_BUNDLE, id=str(BUNDLE_ID))), \
         patch("app.api.experts._has_org_permission", new_callable=AsyncMock, return_value=False), \
         patch("app.api.experts.overlay_install_state", ov):
        resp = TestClient(app_).get(f"/experts/{BUNDLE_ID}")
    assert resp.status_code == 200
    assert resp.json()["install"] == {"state": "ready"}
    assert ov.await_args.kwargs["can_install"] is False


# ── the signature is the contract ────────────────────────────────────────────────────────────


def _route_node(name: str) -> ast.AsyncFunctionDef:
    tree = ast.parse(pathlib.Path(experts_api.__file__).read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name:
            return node
    raise AssertionError(f"route {name} not found")


def test_the_install_route_takes_no_body_and_its_guards_sit_in_positional_defaults():
    node = _route_node("install_expert")
    assert node.args.kwonlyargs == [], "no bare `*` — the 261 fence reads args.defaults only"
    defaults = [ast.unparse(d) for d in node.args.defaults]
    assert "Depends(get_active_org_id)" in defaults
    assert "Depends(require_expert_manage)" in defaults

    sig = inspect.signature(experts_api.install_expert)
    for p in sig.parameters.values():
        ann = p.annotation
        assert not (inspect.isclass(ann) and issubclass(ann, BaseModel)), (
            f"parameter {p.name} is a request body — the org must never be client-supplied"
        )
