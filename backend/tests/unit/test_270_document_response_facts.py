"""Phase 270 Plan 02 Task 1 — file facts + connection name on the wire (FIND-04/05, D-05, D-10, P-02).

The serialized HTTP body is the assertion surface for the list route; the model tests pin the
None-default (a narrow select must never 500 and never invent a 0 / a date).
"""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_supabase
from app.main import app
from app.models.document import DocumentDownloadUrl, DocumentResponse

USER_ID = "00000000-0000-0000-0000-000000000001"
NOW = datetime.now(timezone.utc).isoformat()
CONN_ID = str(uuid4())


def _row(doc_id=None, **over):
    base = {
        "id": doc_id or str(uuid4()),
        "user_id": USER_ID,
        "folder_id": None,
        "filename": "a.pdf",
        "file_path": f"{USER_ID}/x/a.pdf",
        "file_size": 10,
        "mime_type": "application/pdf",
        "status": "completed",
        "error_message": None,
        "chunk_count": 1,
        "content_hash": "h",
        "created_at": NOW,
        "updated_at": NOW,
    }
    base.update(over)
    return base


# ── model ────────────────────────────────────────────────────────────────────


def test_response_carries_all_five_facts():
    r = DocumentResponse.model_validate(
        _row(
            page_count=12,
            source_created_at="2019-03-12T14:03:00+00:00",
            source_modified_at="2020-01-01T00:00:00+00:00",
            source_author="Ada",
            source_connection_name="Team Drive",
        )
    ).model_dump(mode="json")
    assert r["page_count"] == 12
    assert r["source_created_at"].startswith("2019-03-12")
    assert r["source_modified_at"].startswith("2020-01-01")
    assert r["source_author"] == "Ada"
    assert r["source_connection_name"] == "Team Drive"


def test_narrow_select_row_dumps_all_five_as_none():
    r = DocumentResponse.model_validate(_row()).model_dump(mode="json")
    for k in (
        "page_count",
        "source_created_at",
        "source_modified_at",
        "source_author",
        "source_connection_name",
    ):
        assert r[k] is None, k


def test_download_url_model_requires_four_fields():
    ok = DocumentDownloadUrl(url="u", expires_in=60, version_number=1, filename="a.pdf")
    assert ok.expires_in == 60
    with pytest.raises(Exception):
        DocumentDownloadUrl(url="u", expires_in=60, version_number=1)  # type: ignore[call-arg]


def test_ttl_setting_default_and_override():
    from app.models.user_settings import _build_settings_from_row

    assert _build_settings_from_row({}).document_download_url_ttl_seconds == 60
    assert (
        _build_settings_from_row({"document_download_url_ttl_seconds": 120}).document_download_url_ttl_seconds
        == 120
    )


# ── list route ───────────────────────────────────────────────────────────────


class _Recorder:
    """A table-routing supabase double that records every `table(...)` call."""

    def __init__(self, tables, conn_raises=False):
        self.tables = tables
        self.conn_raises = conn_raises
        self.calls = []  # (table, selected cols, in_ ids)

    def table(self, name):
        return _Q(self, name)


class _Q:
    def __init__(self, rec, name):
        self.rec, self.name, self.cols, self.in_ids = rec, name, None, None

    def select(self, cols="*"):
        self.cols = cols
        return self

    def __getattr__(self, attr):  # eq / in_ / order / ... all chain
        def _chain(*a, **k):
            if attr == "in_":
                self.in_ids = a[1]
            return self

        return _chain

    def execute(self):
        self.rec.calls.append((self.name, self.cols, self.in_ids))
        if self.name == "connector_connections" and self.rec.conn_raises:
            raise RuntimeError("boom")
        return SimpleNamespace(data=self.rec.tables.get(self.name, []))


def _get(rec):
    app.dependency_overrides[get_supabase] = lambda: rec
    from unittest.mock import patch

    with patch("app.api.documents.get_globally_visible_folder_ids", return_value=[]):
        return TestClient(app).get("/documents")


def test_list_batches_one_connection_read_and_names_connector_docs():
    d1 = _row(source_connection_id=CONN_ID)
    d2 = _row(source_connection_id=CONN_ID)
    d3 = _row()
    rec = _Recorder(
        {"documents": [d1, d2, d3], "connector_connections": [{"id": CONN_ID, "name": "Team Drive"}]}
    )
    res = _get(rec)
    assert res.status_code == 200, res.text
    conn_reads = [c for c in rec.calls if c[0] == "connector_connections"]
    assert len(conn_reads) == 1
    assert conn_reads[0][1] == "id, name"
    assert conn_reads[0][2] == [CONN_ID]
    by_id = {d["id"]: d for d in res.json()}
    assert by_id[d1["id"]]["source_connection_name"] == "Team Drive"
    assert by_id[d2["id"]]["source_connection_name"] == "Team Drive"
    assert by_id[d3["id"]]["source_connection_name"] is None


def test_list_survives_connection_read_failure():
    rec = _Recorder({"documents": [_row(source_connection_id=CONN_ID)]}, conn_raises=True)
    res = _get(rec)
    assert res.status_code == 200, res.text
    assert res.json()[0]["source_connection_name"] is None


def test_list_without_connector_docs_issues_no_connection_read():
    rec = _Recorder({"documents": [_row()]})
    res = _get(rec)
    assert res.status_code == 200, res.text
    assert not [c for c in rec.calls if c[0] == "connector_connections"]
