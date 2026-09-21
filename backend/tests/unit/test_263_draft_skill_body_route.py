"""Phase 263 (PACK-15 / D-263-14 / D-263-15) — the body-authoring route, at the wire.

⛔ THE TWO FAILURE ARMS MUST STAY DISTINGUISHABLE. ``SkillBodyAuthoringDisabled`` is the
operator's deliberate FLAG-01 kill-switch and ``None`` is an honest provider failure. Collapsing
them into one status renders a switch someone chose to flip as an outage, and the UI then cannot
tell an author "create it by hand" from "try again later".

⛔ AND THE GUARD MUST BE DECLARED WHERE THE FENCE CAN SEE IT. ``test_261_single_expert_authoring_gate``
walks ``fn_node.args.defaults``, which does NOT contain keyword-only defaults — so a guard
declared after a bare ``*`` lands in ``kw_defaults`` and the route reads as UNPROTECTED even
though it is correctly guarded. The last two tests restate that fence locally so a future
refactor to ``*``-syntax fails HERE first, with a legible message.
"""

from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.experts import require_expert_manage, router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.services.entitlement_service import EntitlementResult
from app.services.skill_body_authoring import AuthoredSkillBody, SkillBodyAuthoringDisabled

from tests.unit.test_261_single_expert_authoring_gate import _has_expert_manage_dependency

API_EXPERTS_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "app" / "api" / "experts.py"

_ALLOWED = EntitlementResult(
    allowed=True,
    capability="experts",
    current_tier="enterprise",
    required_tier=None,
    reason=None,
    upgrade_hint=None,
)

_BRIEF = {
    "skill_name": "prisma-screening",
    "skill_description": "Screen abstracts against PRISMA inclusion criteria.",
    "why_needed": "The Expert reviews systematic literature and the library has no screener.",
    "expert_name": "Systematic Reviewer",
    "expert_description": "Runs PRISMA screening passes over a corpus.",
}


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


def test_draft_skill_body_returns_the_authored_body(expert_app):
    """A successful shot returns 200 and the two authored fields."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.author_skill_body", new_callable=AsyncMock
    ) as mock_author, patch("app.models.user_settings.load_user_settings", return_value=None):
        mock_ent.return_value = _ALLOWED
        mock_author.return_value = AuthoredSkillBody(
            instructions="## When to use\nScreen each abstract against the criteria.",
            summary="Screens abstracts against PRISMA inclusion criteria.",
        )

        resp = TestClient(expert_app).post("/experts/draft-skill-body", json=_BRIEF)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["summary"] == "Screens abstracts against PRISMA inclusion criteria."
    assert "Screen each abstract" in body["instructions"]


def test_flag_disabled_is_a_409_refusal_naming_the_manual_path(expert_app):
    """FLAG-01 OFF is a REFUSAL (409), and the sentence tells the author they can still write it."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.author_skill_body", new_callable=AsyncMock
    ) as mock_author, patch("app.models.user_settings.load_user_settings", return_value=None):
        mock_ent.return_value = _ALLOWED
        mock_author.side_effect = SkillBodyAuthoringDisabled(
            "Self-improvement is turned off, so AI authoring of skill instructions is "
            "unavailable. The skill can still be created and written by hand."
        )

        resp = TestClient(expert_app).post("/experts/draft-skill-body", json=_BRIEF)

    assert resp.status_code == 409, f"got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    assert detail["error"] == "self_improve_disabled"
    assert isinstance(detail["detail"], str) and detail["detail"].strip()


def test_honest_failure_is_a_503_and_never_a_fabricated_body(expert_app):
    """`None` is an honest failure → 503, a DIFFERENT code from the operator's refusal."""
    with patch(
        "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
    ) as mock_ent, patch(
        "app.api.experts.author_skill_body", new_callable=AsyncMock
    ) as mock_author, patch("app.models.user_settings.load_user_settings", return_value=None):
        mock_ent.return_value = _ALLOWED
        mock_author.return_value = None

        resp = TestClient(expert_app).post("/experts/draft-skill-body", json=_BRIEF)

    assert resp.status_code == 503, f"got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    assert detail["error"] == "skill_body_unavailable"
    assert "instructions" not in resp.text or detail["error"] == "skill_body_unavailable"


def test_the_two_failure_arms_do_not_share_a_status_code(expert_app):
    """⛔ D-263-14: a deliberate operator flip must never be indistinguishable from an outage."""
    codes = []
    for outcome in ("disabled", "none"):
        with patch(
            "app.services.entitlement_service.check_entitlement", new_callable=AsyncMock
        ) as mock_ent, patch(
            "app.api.experts.author_skill_body", new_callable=AsyncMock
        ) as mock_author, patch("app.models.user_settings.load_user_settings", return_value=None):
            mock_ent.return_value = _ALLOWED
            if outcome == "disabled":
                mock_author.side_effect = SkillBodyAuthoringDisabled("off")
            else:
                mock_author.return_value = None
            codes.append(TestClient(expert_app).post("/experts/draft-skill-body", json=_BRIEF).status_code)

    assert codes[0] != codes[1], f"both arms answered {codes[0]} — the UI cannot tell them apart"
    assert codes == [409, 503]


# ── T-263-14: the guard, seen the way the real fence sees it ──────────────────

def _draft_skill_body_node() -> ast.AsyncFunctionDef:
    tree = ast.parse(API_EXPERTS_PATH.read_text(encoding="utf-8"), filename=str(API_EXPERTS_PATH))
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "draft_skill_body":
            return node  # type: ignore[return-value]
    raise AssertionError("draft_skill_body not found in api/experts.py")


def test_the_new_route_is_seen_as_guarded_by_the_real_ast_fence():
    """A local restatement of test_261's detector, so a `*`-refactor fails here first."""
    node = _draft_skill_body_node()
    assert _has_expert_manage_dependency(node), (
        "draft_skill_body is invisible to test_261_single_expert_authoring_gate's detector. "
        "It walks args.defaults ONLY — declare current_user as a positional-or-keyword "
        "parameter, never after a bare `*`."
    )


def test_the_new_route_takes_the_typed_brief_as_its_first_parameter():
    """⚠ Replaces the plan's single-line `grep -cE "async def draft_skill_body\\(payload: ..."`.

    That grep returns 0 against this module's MULTI-LINE signature style — the style the plan
    itself said to copy from ``draft_expert`` — so it was a proxy that could not see the shape
    it was written for. This asserts the PROPERTY instead: the first parameter is ``payload``,
    typed ``SkillBodyDraftRequest``, which is what the grep was standing in for.
    """
    node = _draft_skill_body_node()
    first = node.args.args[0]
    assert first.arg == "payload"
    assert getattr(first.annotation, "id", None) == "SkillBodyDraftRequest"


def test_the_new_route_declares_no_keyword_only_parameters():
    """The structural reason the fence above can see it at all."""
    node = _draft_skill_body_node()
    assert node.args.kwonlyargs == [], (
        f"draft_skill_body declares keyword-only params {[a.arg for a in node.args.kwonlyargs]} — "
        "their Depends() defaults live in kw_defaults, which the fence never reads."
    )
