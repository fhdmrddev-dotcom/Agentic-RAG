"""Phase 275-03 (RET-04 / D-18 / D-21) — Find hides archived documents unless asked; the Library row
model carries the archive state.

* ``DocumentSearchRequest.include_archived`` defaults to ``False`` and ``extra="forbid"`` stays, so an
  unknown key still 422s (Pitfall 13 — the backend ships before the frontend sends the key).
* The default request excludes a row whose ``archived_at`` is set; ``include_archived=True`` returns
  it. Proven by CONTENT through 271's in-memory PostgREST, not by "a method was called".
* ``DocumentResponse`` accepts rows WITHOUT the new fields (five routes build it from narrow selects
  — the 217 precedent) and exposes them when present.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from tests.unit.test_271_search_core import CALLER, FakePostgrest, doc, ids, patched, run  # noqa: F401


def _archived(id_):
    row = doc(id_)
    row["archived_at"] = "2026-10-12T02:00:00+00:00"
    return row


def _live(id_):
    row = doc(id_)
    row["archived_at"] = None
    return row


async def test_find_hides_archived_documents_by_default(patched):
    client = FakePostgrest({"documents": [_live("live-1"), _archived("arch-1")]})
    result = await run(client)
    assert ids(result) == ["live-1"]


async def test_include_archived_returns_them(patched):
    client = FakePostgrest({"documents": [_live("live-1"), _archived("arch-1")]})
    result = await run(client, include_archived=True)
    assert sorted(ids(result)) == ["arch-1", "live-1"]


async def test_the_archived_filter_is_on_every_candidate_leg(patched):
    client = FakePostgrest({"documents": [_live("live-1")]})
    await run(client)
    legs = client.candidate_legs()
    assert legs, "no candidate read was issued"
    for q in legs:
        assert ("archived_at", "null") in [(c[1], c[2]) for c in q.filters("is_")], q.calls


def test_the_request_model_defaults_off_and_still_forbids_unknown_keys():
    from app.models.document_search import DocumentSearchRequest

    assert DocumentSearchRequest().include_archived is False
    assert DocumentSearchRequest(include_archived=True).include_archived is True
    with pytest.raises(ValidationError):
        DocumentSearchRequest(include_archive=True)  # a typo of the key is refused, never ignored


def test_document_response_defaults_the_archive_fields_and_exposes_them():
    from app.models.document import DocumentResponse

    base = {
        "id": "00000000-0000-0000-0000-0000000000aa",
        "user_id": CALLER,
        "filename": "a.md",
        "file_path": "u/a.md",
        "file_size": 1,
        "mime_type": "text/markdown",
        "status": "completed",
        "error_message": None,
        "chunk_count": 1,
        "content_hash": None,
        "created_at": "2026-10-12T00:00:00+00:00",
        "updated_at": "2026-10-12T00:00:00+00:00",
    }
    plain = DocumentResponse(**base)
    assert plain.archived_at is None and plain.archived_policy_id is None
    assert plain.archived_policy_name is None and plain.retrievable is None

    full = DocumentResponse(
        **base,
        archived_at="2026-10-12T02:00:00+00:00",
        archived_policy_id="00000000-0000-0000-0000-0000000000bb",
        archived_policy_name="Finance invoices",
        retrievable=False,
    )
    dumped = full.model_dump(mode="json")
    assert dumped["archived_policy_name"] == "Finance invoices" and dumped["retrievable"] is False
    assert dumped["archived_at"].startswith("2026-10-12")
