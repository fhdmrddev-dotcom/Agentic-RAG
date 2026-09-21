"""Phase 263 (PACK-16 / D-263-09 / D-263-10) — the SAVE-TIME refusal, driven at the wire.

⛔ EVERY REFUSAL CASE ASSERTS THE LITERAL STATUS CODE `422`, never merely "it refused".
``create_expert`` wraps its service call in a bare ``except Exception`` and ``HTTPException``
subclasses ``Exception``: a 422 raised *inside* that ``try`` is swallowed at the catch, logged,
and re-raised as a **400 whose detail is the stringified exception**. A test that asserted only
``resp.status_code >= 400`` would pass on that defect and ship it — that is RESEARCH's named
Pitfall 3, and it is why ``test_refusal_is_raised_above_the_try_in_create_expert`` below checks
the PLACEMENT mechanically (source index), not by eye.

⚠ FastAPI reserves 422 for its own ``RequestValidationError``, whose body is
``{"detail": [ ... ]}`` — a **LIST**. Ours is a **DICT** carrying ``error``. The last test pins
that the two remain distinguishable, because the client discriminates on ``detail.error``.
"""

from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from app.api.experts import require_expert_manage, router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.services.entitlement_service import EntitlementResult

API_EXPERTS_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "app" / "api" / "experts.py"

_ALLOWED = EntitlementResult(
    allowed=True,
    capability="experts",
    current_tier="enterprise",
    required_tier=None,
    reason=None,
    upgrade_hint=None,
)


def _valid_create_payload(**overrides) -> dict:
    payload = {
        "name": "Systematic Reviewer",
        "slug": "systematic-reviewer",
        "description": "Runs PRISMA screening passes.",
        "member_skills": ["docx", "prisma-screening"],
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def mock_user():
    return {"id": str(uuid4()), "email": "author@example.com", "role": "org-admin"}


@pytest.fixture
def expert_app(mock_user):
    app = FastAPI()
    app.include_router(experts_router)
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    app.dependency_overrides[require_expert_manage] = lambda: mock_user
    return app


# ── PACK-16: the refusal itself ───────────────────────────────────────────────

def test_post_experts_refuses_unknown_member_skill_with_a_named_422(expert_app):
    """POST /experts naming a skill that does not exist → 422 carrying the NAMES (D-263-10)."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch(
        "app.api.experts.create_expert_service", new_callable=AsyncMock
    ) as mock_create:
        mock_ent.return_value = _ALLOWED
        mock_filter.return_value = {"docx"}

        resp = TestClient(expert_app).post("/experts", json=_valid_create_payload())

    assert resp.status_code == 422, (
        f"Expected the named 422 refusal, got {resp.status_code}: {resp.text}. "
        "A 400 here means the check was raised INSIDE create_expert's bare `except Exception`."
    )
    detail = resp.json()["detail"]
    assert isinstance(detail, dict), "Our refusal is a DICT; FastAPI's own 422 is a LIST"
    assert detail["error"] == "expert_member_skills_unknown"
    assert detail["unknown_skills"] == ["prisma-screening"]
    assert "prisma-screening" in detail["detail"]
    mock_create.assert_not_awaited()


def test_post_experts_refusal_names_every_unknown_skill_in_caller_order(expert_app):
    """The refusal names EACH unknown skill, in the order the caller submitted them."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch("app.api.experts.create_expert_service", new_callable=AsyncMock):
        mock_ent.return_value = _ALLOWED
        mock_filter.return_value = {"docx"}

        resp = TestClient(expert_app).post(
            "/experts",
            json=_valid_create_payload(
                member_skills=["prisma-screening", "docx", "thematic-synthesis"]
            ),
        )

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["unknown_skills"] == ["prisma-screening", "thematic-synthesis"]
    assert "2" in detail["detail"], "the human sentence names the COUNT"
    assert "thematic-synthesis" in detail["detail"]


def test_patch_expert_refuses_unknown_member_skill_with_the_same_422(expert_app):
    """PATCH /experts/{id} carries the SAME envelope and the SAME 422 — not a 400."""
    bundle_id = uuid4()
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch(
        "app.api.experts.update_expert_service", new_callable=AsyncMock
    ) as mock_update:
        mock_ent.return_value = _ALLOWED
        mock_filter.return_value = {"docx"}

        resp = TestClient(expert_app).patch(
            f"/experts/{bundle_id}", json={"member_skills": ["docx", "prisma-screening"]}
        )

    assert resp.status_code == 422, f"got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    assert detail["error"] == "expert_member_skills_unknown"
    assert detail["unknown_skills"] == ["prisma-screening"]
    mock_update.assert_not_awaited()


# ── The None-vs-[] distinction: a PATCH that is not changing member_skills ─────

def test_patch_omitting_member_skills_runs_no_check_at_all(expert_app):
    """`None` means 'not being changed' — treating it as `[]` would refuse every unrelated PATCH."""
    bundle_id = uuid4()
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch(
        "app.api.experts.update_expert_service", new_callable=AsyncMock
    ) as mock_update:
        mock_ent.return_value = _ALLOWED
        mock_update.return_value = {"id": str(bundle_id), "name": "Renamed"}

        resp = TestClient(expert_app).patch(f"/experts/{bundle_id}", json={"name": "Renamed"})

    assert resp.status_code == 200, resp.text
    mock_filter.assert_not_awaited()
    mock_update.assert_awaited_once()


def test_patch_with_empty_member_skills_proceeds(expert_app):
    """An explicit `[]` has no unknown names, so the update proceeds."""
    bundle_id = uuid4()
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ), patch(
        "app.api.experts.update_expert_service", new_callable=AsyncMock
    ) as mock_update:
        mock_ent.return_value = _ALLOWED
        mock_update.return_value = {"id": str(bundle_id), "member_skills": []}

        resp = TestClient(expert_app).patch(f"/experts/{bundle_id}", json={"member_skills": []})

    assert resp.status_code == 200, resp.text
    mock_update.assert_awaited_once()


# ── The bundle_id argument: None at save time, the real id on PATCH ───────────

def test_post_experts_passes_bundle_id_none_and_creates(expert_app):
    """Every name visible → 201, and the save-time call carries `bundle_id=None` (T-263-02)."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch(
        "app.api.experts.create_expert_service", new_callable=AsyncMock
    ) as mock_create:
        mock_ent.return_value = _ALLOWED
        mock_filter.return_value = {"docx", "prisma-screening"}
        mock_create.return_value = {"id": str(uuid4()), "name": "Systematic Reviewer"}

        resp = TestClient(expert_app).post("/experts", json=_valid_create_payload())

    assert resp.status_code == 201, resp.text
    mock_filter.assert_awaited_once()
    assert mock_filter.await_args.kwargs["bundle_id"] is None, (
        "bundle_id MUST be None at save time — a bare `==` on a NULL column would otherwise "
        "admit every other user's private skill in the org"
    )
    mock_create.assert_awaited_once()


def test_patch_passes_the_path_bundle_id_so_a_born_for_skill_resolves(expert_app):
    """PATCH passes its own bundle id, so 263-01's born-for arm can resolve (D-263-06)."""
    bundle_id = uuid4()
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.filter_visible_skill_names", new_callable=AsyncMock
    ) as mock_filter, patch(
        "app.api.experts.update_expert_service", new_callable=AsyncMock
    ) as mock_update:
        mock_ent.return_value = _ALLOWED
        mock_filter.return_value = {"born-for-this-one"}
        mock_update.return_value = {"id": str(bundle_id)}

        resp = TestClient(expert_app).patch(
            f"/experts/{bundle_id}", json={"member_skills": ["born-for-this-one"]}
        )

    assert resp.status_code == 200, resp.text
    assert mock_filter.await_args.kwargs["bundle_id"] == bundle_id


# ── Distinguishability from FastAPI's own 422 ────────────────────────────────

def test_a_genuine_pydantic_422_stays_a_LIST_and_is_distinguishable(expert_app):
    """FastAPI's request-validation 422 body is a LIST; ours is a DICT carrying `error`."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch("app.api.experts.filter_visible_skill_names", new_callable=AsyncMock):
        mock_ent.return_value = _ALLOWED
        # `slug` is required (min_length=1) — omitting it is a genuine Pydantic failure.
        resp = TestClient(expert_app).post("/experts", json={"name": "No Slug"})

    assert resp.status_code == 422
    assert isinstance(resp.json()["detail"], list), (
        "a naive `status === 422` client arm would swallow this; the discriminator is detail.error"
    )


# ── T-263-17: the PLACEMENT, asserted mechanically rather than by eye ─────────

def _create_expert_node() -> ast.AsyncFunctionDef:
    tree = ast.parse(API_EXPERTS_PATH.read_text(encoding="utf-8"), filename=str(API_EXPERTS_PATH))
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "create_expert":
            return node  # type: ignore[return-value]
    raise AssertionError("create_expert not found in api/experts.py")


def test_refusal_is_raised_above_the_try_in_create_expert():
    """⛔ The check must sit ABOVE the `try:` — inside it, the 422 degrades to a 400 (T-263-17)."""
    node = _create_expert_node()

    call_lines = [
        n.lineno
        for n in ast.walk(node)
        if isinstance(n, ast.Call)
        and getattr(n.func, "id", None) == "_refuse_unknown_member_skills"
    ]
    assert call_lines, "create_expert does not call _refuse_unknown_member_skills at all"

    try_lines = [n.lineno for n in ast.walk(node) if isinstance(n, ast.Try)]
    assert try_lines, "create_expert's bare `except Exception` try is gone — re-derive this fence"

    assert min(call_lines) < min(try_lines), (
        f"_refuse_unknown_member_skills is called at line {min(call_lines)}, at or below the "
        f"`try:` at line {min(try_lines)} — the 422 will be caught and re-raised as a 400."
    )
