"""PACK-11 at the API layer — `GET /experts` and the grant-aware list path (Phase 262 plan 02).

⛔ WHAT THIS FILE DOES **NOT** CLAIM.

It does **not** re-prove the SQL predicate. `test_261_expert_grants_db.py:354-364` already drives
`list_expert_bundles_for_caller` against a real Postgres with a plain-member, no-grant user and
asserts the granted bundle is absent — so the ROADMAP's *"no test drives the no-grant user"* is
FALSE at that layer (RESEARCH R-4). ⚠ That file bails out silently when the local Postgres port is
unreachable, so a green CI run proves nothing about it — which is why the claim was believable.

⛔ It also does not touch a database, and the absence of the two guard tokens that would let it do
so (a hardcoded local DB port, and a runtime bail-out) is itself an acceptance criterion of this
plan. There must never be one: the gap this closes is the **endpoint's own wiring**, which runs
everywhere.

WHAT IT DOES CLAIM, and nothing wider:
  1. `for_management=False` hands the AUTHENTICATED caller's id and roles to
     `list_experts_service`, i.e. it reaches the grant-aware branch (`caller_user_id is not None`,
     `expert_service.py:172-180`) rather than the unfiltered one.
  2. The endpoint returns EXACTLY what that path returned. Nothing is re-added afterwards — a
     bundle the grant-aware path excluded does not reappear in the response body.
  3. `for_management=true` from a caller without `experts:manage` is refused 403 and the service
     is never awaited at all (T-262-06: the management arm must not be a way past one's own
     grants).
  4. A caller with no `role` yields `caller_roles == []`, never `[None]` (T-262-07: a null role
     must not widen a `grantee_type = 'role'` match).

⚠ Every fixture bundle below carries `visibility: "granted"` ON PURPOSE. RESEARCH §6 traced the
predicate and the grant check bites for that value **alone** — an `org`- or `public`-visibility
bundle is visible to every org member no matter what grants exist, so a fixture at those values
would pass while proving nothing.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from app.api.experts import router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.services.entitlement_service import EntitlementResult

CALLER_ID = str(uuid4())
ORG_ID = str(uuid4())

ALLOWED = EntitlementResult(
    allowed=True,
    capability="experts",
    current_tier="enterprise",
    required_tier=None,
    reason=None,
    upgrade_hint=None,
)


def _granted_bundle(name: str) -> dict:
    """A bundle at the ONE visibility for which the grant predicate bites (RESEARCH §6)."""
    return {
        "id": str(uuid4()),
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "visibility": "granted",
        "is_system": False,
        "is_enabled": True,
    }


@pytest.fixture
def expert_test_app():
    app = FastAPI()
    app.include_router(experts_router)
    return app


def _wire(app, *, user: dict | None = None):
    app.dependency_overrides[get_current_user] = lambda: (
        user if user is not None else {"id": CALLER_ID, "email": "member@example.com", "role": "member"}
    )
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    app.dependency_overrides[get_pg_pool] = lambda: MagicMock()


def test_default_list_hands_caller_identity_and_roles_to_the_grant_aware_path(expert_test_app):
    """`for_management=False` reaches the grant-aware branch, with the CALLER's own id/roles."""
    _wire(expert_test_app)

    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_check, patch(
        "app.api.experts.list_experts_service", new_callable=AsyncMock
    ) as mock_list:
        mock_check.return_value = ALLOWED
        mock_list.return_value = []

        resp = TestClient(expert_test_app).get("/experts")

    assert resp.status_code == status.HTTP_200_OK
    mock_list.assert_awaited_once()
    kwargs = mock_list.await_args.kwargs

    # ⛔ THE POINT: `caller_user_id` is what flips `list_experts_service` onto
    # `list_expert_bundles_for_caller`. Absent it, the endpoint would silently take the
    # UNFILTERED path and every org member would see every granted bundle.
    assert str(kwargs["caller_user_id"]) == CALLER_ID
    assert kwargs["caller_roles"] == ["member"]
    assert str(kwargs["caller_org_id"]) == ORG_ID


def test_a_bundle_the_grant_aware_path_excluded_is_not_re_added_by_the_endpoint(expert_test_app):
    """The response body is EXACTLY the grant-aware result — nothing is re-added downstream."""
    _wire(expert_test_app)

    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_check, patch(
        "app.api.experts.list_experts_service", new_callable=AsyncMock
    ) as mock_list:
        mock_check.return_value = ALLOWED
        # The DB layer (driven by test_261_expert_grants_db.py against real PG) excluded the
        # granted bundle for this no-grant caller. The endpoint must agree.
        mock_list.return_value = []

        resp = TestClient(expert_test_app).get("/experts")

    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []


def test_the_endpoint_returns_exactly_the_bundles_the_grant_aware_path_returned(expert_test_app):
    """The positive control: two granted bundles in, the same two out, nothing added or dropped."""
    _wire(expert_test_app)
    visible = [_granted_bundle("Payroll Advisor"), _granted_bundle("Supply Chain Advisor")]

    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_check, patch(
        "app.api.experts.list_experts_service", new_callable=AsyncMock
    ) as mock_list:
        mock_check.return_value = ALLOWED
        mock_list.return_value = visible

        resp = TestClient(expert_test_app).get("/experts")

    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert [b["id"] for b in body] == [b["id"] for b in visible]
    assert all(b["visibility"] == "granted" for b in body)


def test_management_arm_without_permission_is_refused_and_never_reaches_the_service(expert_test_app):
    """T-262-06 — `for_management=true` is not a way past one's own grants."""
    _wire(expert_test_app)

    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_check, patch(
        "app.api.experts._has_org_permission", new_callable=AsyncMock
    ) as mock_perm, patch(
        "app.api.experts.list_experts_service", new_callable=AsyncMock
    ) as mock_list:
        mock_check.return_value = ALLOWED
        mock_perm.return_value = False

        resp = TestClient(expert_test_app).get("/experts?for_management=true")

    assert resp.status_code == status.HTTP_403_FORBIDDEN
    # ⛔ Not merely "the body was empty" — the unfiltered query is never issued at all.
    mock_list.assert_not_awaited()


def test_a_caller_with_no_role_yields_an_empty_role_list_not_a_null_entry(expert_test_app):
    """T-262-07 — `[None]` would be a role-grant match surface a null must never open."""
    _wire(expert_test_app, user={"id": CALLER_ID, "email": "noroles@example.com"})

    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_check, patch(
        "app.api.experts.list_experts_service", new_callable=AsyncMock
    ) as mock_list:
        mock_check.return_value = ALLOWED
        mock_list.return_value = []

        resp = TestClient(expert_test_app).get("/experts")

    assert resp.status_code == status.HTTP_200_OK
    roles = mock_list.await_args.kwargs["caller_roles"]
    # v4.3 verification: the role is now RESOLVED (resolve_caller_role), and an unresolvable one
    # fails closed to the least-privileged REAL role — never None, never a fabricated role.
    assert roles == ["member"]
    assert None not in roles
