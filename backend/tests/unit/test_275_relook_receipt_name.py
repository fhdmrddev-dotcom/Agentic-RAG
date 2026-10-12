"""Phase 275 G-4 re-look OBS-R2a — a did-not-delete receipt names its document.

A queued document MOVED before confirm is no longer in the snapshot under its queued family key,
so the confirm had no name and wrote ``document_name = NULL``; History then read
"Did not delete not recorded". The receipt now falls back to the document's CURRENT filename
(the row still exists — it moved, it was not deleted). A row that is truly gone stays NULL.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.services.retention import disposition as disp

DOC = "66666666-6666-4666-8666-666666666666"


class _Con:
    def __init__(self, filename):
        self.filename = filename
        self.queries: list[str] = []

    async def fetchval(self, sql, *args):
        self.queries.append(sql)
        return self.filename


def _run(con, name, monkeypatch):
    seen: dict = {}

    async def _insert(con_, org, action, **kw):
        seen.update(kw)

    monkeypatch.setattr(disp.rdb, "insert_receipt", _insert)
    p = SimpleNamespace(id="p1", name="Contracts 7y")
    asyncio.run(disp._receipt_did_not_delete(
        con, "org", p, {"latest_document_id": DOC}, name, "changed", None, None, "Admin"))
    return seen


def test_a_moved_document_is_named_from_its_current_row(monkeypatch):
    con = _Con("rl-life-b.txt")
    seen = _run(con, None, monkeypatch)
    assert seen["document_name"] == "rl-life-b.txt"
    assert "documents" in con.queries[0]


def test_a_known_name_is_kept_and_no_read_is_made(monkeypatch):
    con = _Con("other.txt")
    seen = _run(con, "kept-name.txt", monkeypatch)
    assert seen["document_name"] == "kept-name.txt"
    assert con.queries == []


def test_a_gone_document_stays_unnamed(monkeypatch):
    seen = _run(_Con(None), None, monkeypatch)
    assert seen["document_name"] is None
