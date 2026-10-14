"""BUG-261014-06 — the Library showed 0 documents once a user owned ~200+ of them.

`GET /documents` counted tables/images with ONE `.in_("document_id", <every id>)` per table.
PostgREST carries `in.(...)` in the URL, so 286 UUIDs (~10 KB) came back `414 URI too long`,
the handler raised, and the browser saw a CORS-less 500 (`net::ERR_FAILED`) — every folder
read 0 while the vector count, a separate request, still read 8,851.

Pinned: no `.in_("document_id", …)` call ever carries more than the batch size, every id is
still asked about exactly once, and the counts are summed across batches.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_supabase
from app.main import app

USER_ID = "00000000-0000-0000-0000-000000000001"
MOCK_USER = {"id": USER_ID, "email": "test@example.com"}
N_DOCS = 250
_ID_BATCH = 100  # PostgREST in.(...) rides the URL; 100 UUIDs ~ 3.7 KB


def _doc(i: int) -> dict:
    return {
        "id": f"00000000-0000-0000-0000-{i:012d}",
        "user_id": USER_ID,
        "filename": f"doc-{i}.txt",
        "file_path": f"{USER_ID}/doc-{i}.txt",
        "file_size": 1,
        "mime_type": "text/plain",
        "status": "completed",
        "content_hash": f"h{i}",
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "error_message": None,
        "chunk_count": 1,
        "metadata": None,
        "created_at": f"2026-10-14T00:00:{i % 60:02d}",
        "updated_at": "2026-10-14T00:00:00",
    }


def _result(data):
    r = MagicMock()
    r.data = data
    return r


def test_list_documents_never_puts_more_than_a_batch_of_ids_in_one_url():
    docs = [_doc(i) for i in range(N_DOCS)]
    first_id, last_id = docs[0]["id"], docs[-1]["id"]

    in_calls: list[tuple[str, str, list]] = []  # (table, column, ids)

    def table(name):
        b = MagicMock()
        state = {"ids": None}
        for m in ("select", "eq", "neq", "order", "limit", "is_", "or_"):
            getattr(b, m).return_value = b

        def _in(col, ids):
            in_calls.append((name, col, list(ids)))
            state["ids"] = list(ids)
            return b

        b.in_.side_effect = _in

        def execute():
            if name == "documents":
                return _result(docs)
            ids = state["ids"] or []
            # one table row for the first doc, one image row for the last — wherever they land
            if name == "document_tables":
                return _result([{"document_id": first_id}] if first_id in ids else [])
            if name == "document_images":
                return _result([{"document_id": last_id}] if last_id in ids else [])
            return _result([])

        b.execute.side_effect = execute
        return b

    sb = MagicMock()
    sb.table.side_effect = table

    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_supabase] = lambda: sb
    try:
        with patch("app.api.documents.get_globally_visible_folder_ids", return_value=[]):
            with TestClient(app) as client:
                resp = client.get("/documents", headers={"Authorization": "Bearer t"})
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == N_DOCS

    for tbl in ("document_tables", "document_images"):
        batches = [ids for (t, col, ids) in in_calls if t == tbl and col == "document_id"]
        assert batches, f"{tbl} was never queried"
        assert max(len(b) for b in batches) <= _ID_BATCH, (
            f"{tbl}: one URL carried {max(len(b) for b in batches)} ids — the 414 is back"
        )
        flat = [i for b in batches for i in b]
        assert sorted(flat) == sorted(d["id"] for d in docs), f"{tbl}: ids lost or repeated"

    by_id = {d["id"]: d for d in body}
    assert by_id[first_id]["table_count"] == 1
    assert by_id[last_id]["image_count"] == 1
    assert sum(d["table_count"] for d in body) == 1
    assert sum(d["image_count"] for d in body) == 1
