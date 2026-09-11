"""Phase 244 plan 06 Task 1 (SHELL-04 / D-244-06 / BUG-260905-01) —
THE SINGLE-FILE CLOUD IMPORT ASKS WHERE THE FILE GOES, AND REFUSES WHEN NOBODY SAID.

The operator's sentence: *"it ingested into a folder I did not want — the root."* The cause is one
line: `import_single_file` has accepted `folder_id` since Phase 233, and
`POST /connections/{id}/files/{fid}/import` simply never passed one.

⛔ **D-244-06's ruling is that an unset destination REFUSES — silently rooting is the defect, not
the fallback.** This suite fences the refusal at the MODEL boundary rather than in a branch:
`ConnectionFileImportRequest.folder_id` is a REQUIRED `str` on a `_StrictBase` (`extra="forbid"`),
so FastAPI answers 422 *before the handler runs*. A hand-rolled `if not body.folder_id: raise …`
was the rejected arm precisely because it lives inside a handler that already has two `except` arms
and a 502 catch-all — exactly the kind of guard that survives as prose after a refactor.

⚠ THE FOLDER DOOR IS DELIBERATELY DIFFERENT. `SourcePreviewRequest.destination_folder_id` is
`str | None = None` and its docstring says `None = root` — **by design**, because a folder import
of a whole tree into the root is a thing a person can mean. A single named file landing in the root
is not; it is what happens when nobody was asked.

Every case is STUBBED. ⛔ No `documents` row is minted and no Postgres connection is opened.
"""
from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import connectors
from app.main import app as real_app
from app.models.connector import ConnectionFileImportRequest, SourcePreviewRequest
from app.services import connector_service
from app.services.sources.base import SourceConnectionDisabled

CONNECTORS_SRC = Path(connectors.__file__).read_text(encoding="utf-8")

ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
CONNECTION_ID = "cccccccc-0000-4000-8000-00000000000c"
FILE_ID = "cloud-file-1"
FOLDER_ID = "ffffffff-0000-4000-8000-00000000000f"
IMPORT_PATH = f"/connectors/connections/{CONNECTION_ID}/files/{FILE_ID}/import"


def _strip_comments(src: str) -> str:
    """Prose about code is not code (the 244-05 finding, both directions)."""
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out


@pytest.fixture
def router_client():
    """A TestClient over `connectors.router` ALONE, sharing the live override dict.

    The SAME dict object, not a copy — conftest's autouse `reset_mocks` re-assigns keys on
    `app.main.app.dependency_overrides` in place and this must see those writes
    (the `test_190_connectors_api.py` precedent).
    """
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


@pytest.fixture
def wired(monkeypatch, mock_asyncpg_pool):
    """Caller is an org member; the connection resolves; the minter seam is a spy."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "member"})
    monkeypatch.setattr(
        connector_service,
        "get_connection",
        AsyncMock(return_value=SimpleNamespace(id=CONNECTION_ID, service_id="google_workspace")),
    )
    spy = AsyncMock(return_value={"id": "doc-1", "filename": "Q4.docx", "status": "processing"})
    monkeypatch.setattr("app.services.sources.import_service.import_single_file", spy)
    return spy


# ── 1 · the destination is FORWARDED to the only minter seam ─────────────────────────────
def test_the_chosen_folder_reaches_import_single_file(router_client, wired):
    res = router_client.post(IMPORT_PATH, headers=_headers(), json={"folder_id": FOLDER_ID})

    assert res.status_code == 200, res.text
    assert wired.await_count == 1
    assert wired.await_args.kwargs["folder_id"] == FOLDER_ID


# ── 2 · NO BODY ⇒ 422. ⛔ Never 200-into-root — that IS BUG-260905-01 ─────────────────────
#
# ⚠ MEASURED, AND IT CHANGES WHAT THIS CASE IS WORTH: case 2 alone does NOT pin the requirement.
# Driven against a plant that weakened the field to `folder_id: str | None = None`, this case
# stayed GREEN — FastAPI requires the BODY because the parameter has no default, regardless of
# whether any field inside it is required. It was cases 3 and 6b that went red
# (`assert 200 == 422`, and `is_required()` returning False). ⛔ So the no-body case is the
# REGRESSION guard for `BUG-260905-01`'s literal reproduction; the REQUIREMENT is pinned by the
# other two, and dropping either of them would leave a fence that cannot see the defect.
def test_an_import_with_no_body_is_refused_never_rooted(router_client, wired):
    res = router_client.post(IMPORT_PATH, headers=_headers())

    assert res.status_code == 422, res.text
    assert wired.await_count == 0, (
        "the minter was reached with no destination — a file landed SOMEWHERE nobody chose, "
        "which is the whole of BUG-260905-01"
    )


# ── 3 · an EXPLICIT null is not a destination ────────────────────────────────────────────
def test_an_explicit_null_folder_is_refused(router_client, wired):
    res = router_client.post(IMPORT_PATH, headers=_headers(), json={"folder_id": None})

    assert res.status_code == 422, res.text
    assert wired.await_count == 0


# ── 4 · `_StrictBase`'s extra="forbid" is live on this shape ─────────────────────────────
def test_an_unknown_key_is_refused(router_client, wired):
    res = router_client.post(
        IMPORT_PATH, headers=_headers(), json={"folder_id": FOLDER_ID, "destination": "root"}
    )

    assert res.status_code == 422, res.text
    assert wired.await_count == 0


# ── 5 · THE ORDERING FENCE — a comment is not a test ─────────────────────────────────────
def test_a_disabled_connection_is_named_not_reported_as_a_provider_error(
    monkeypatch, router_client, wired
):
    """PLANT to drive RED: move `except SourceConnectionDisabled` BELOW the broad handler.

    `connectors.py` carries a comment saying this ordering is load-bearing (BUG-260907-03) —
    *"a disabled connection is not a provider error, and wording it that way is how a control
    that failed to stop something reads as Microsoft's fault."* Until this case, the comment
    was the only thing holding it.
    """
    monkeypatch.setattr(
        "app.services.sources.import_service.import_single_file",
        AsyncMock(side_effect=SourceConnectionDisabled("This connection is turned off.")),
    )
    res = router_client.post(IMPORT_PATH, headers=_headers(), json={"folder_id": FOLDER_ID})

    assert res.status_code != 502, (
        "a control WE applied was reported as the provider's fault — the broad handler caught "
        "SourceConnectionDisabled first"
    )
    assert res.status_code in (403, 409, 422), res.text
    assert "provider returned an error" not in res.text.lower()
    assert "download cloud file" not in res.text.lower()


# ── 6 · THE MINTER FENCE — `import_single_file` stays the only seam ──────────────────────
def test_the_import_route_mints_only_through_import_single_file():
    """⛔ ROADMAP-level warning, tied to Phase 229's splice. Asserted on SOURCE, comments
    stripped, because a mock only sees the paths a test happens to exercise."""
    body = _strip_comments(CONNECTORS_SRC)
    assert "async def import_connection_file" in body  # non-vacuity
    assert "folder_id=body.folder_id" in body
    for forbidden in ('table("documents").insert', "mint_document_row", "async_mint_document_row"):
        assert forbidden not in body, (
            f"{forbidden!r} appears in connectors.py — a second minter beside the splice"
        )


# ── 6b · the model's shape is the refusal, not a branch ──────────────────────────────────
def test_the_request_model_makes_the_refusal_mechanical():
    field = ConnectionFileImportRequest.model_fields["folder_id"]
    assert field.is_required(), (
        "`folder_id` has a default — the refusal is now optional, and a future edit that adds a "
        "root fallback branch would pass every test in this file"
    )
    assert ConnectionFileImportRequest.model_config.get("extra") == "forbid"
    # ⛔ No hand-rolled branch in the handler. If one is ever needed it must carry its OWN driven
    # case and the SUMMARY must say why the model-level refusal was not usable (the plan's rule).
    body = _strip_comments(CONNECTORS_SRC)
    assert "if not body.folder_id" not in body


# ── 6c · the FOLDER door is deliberately the opposite, and stays that way ─────────────────
def test_the_folder_door_still_treats_none_as_root_by_design():
    """⚠ The two doors disagree ON PURPOSE. A whole-tree import into the root is a thing a person
    can mean; a single named file landing there is what happens when nobody was asked."""
    assert not SourcePreviewRequest.model_fields["destination_folder_id"].is_required()


# ── 7 · the 502 arm is UNCHANGED — its message is the shipped one ─────────────────────────
def test_a_genuine_provider_failure_still_reads_as_one(monkeypatch, router_client, wired):
    monkeypatch.setattr(
        "app.services.sources.import_service.import_single_file",
        AsyncMock(side_effect=RuntimeError("drive said no")),
    )
    res = router_client.post(IMPORT_PATH, headers=_headers(), json={"folder_id": FOLDER_ID})

    assert res.status_code == 502, res.text
    assert "Failed to download cloud file" in res.text
