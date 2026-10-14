"""Phase 280 (FIX-02 / BUG-261005-01, D-01..D-04, D-24, D-25) — the minter's query sequence, stubbed.

What was wrong (measured at a3d9406bc, ``ingest_splice.mint_document_row``):

  * the dedup leg saw only ``status = 'completed'`` copies, while the unique index it races,
    ``documents_dedup_idx``, is ``WHERE status <> 'failed'`` — so a ``pending`` copy was invisible;
  * the retire UPDATE (``is_latest = false``) ran BEFORE the INSERT, so a same-bytes second mint
    retired the in-flight copy and then hit 23505;
  * on 23505, ``on_conflict="raise"`` answered 409, and ``"link"`` returned the copy it had just
    retired.

The fix this file pins, one behaviour per test:

  1. a folder-agnostic IN-FLIGHT leg (user + hash + ``status <> 'failed'`` + ``is_latest``, + org
     when passed) returns the existing copy and writes nothing (D-24 — the
     ``workspace_promote.find_existing_copy`` live-leg shape, kept in ONE home in the minter);
  2. INSERT first, then retire — and only when a prior version exists, scoped
     ``.neq("id", new_id).lt("version_number", next_version)``, with the org taken from the inserted
     row when none was passed (D-03 / D-25);
  3. a 23505 resolves to the WINNER for both ``raise`` and ``link`` (D-02); 409 survives only as
     the "winner not found" fallback;
  4. a failed insert retires nothing; a failed retire is logged and never loses the inserted row;
  5. ``/upload`` answers 200 with ``already_in_library: true`` for a duplicate (D-01);
  6. all 7 callers reach the minter (D-04 inventory fence), and two of them are driven THROUGH the
     real caller rather than at the minter (plan-check W-1): the watch new-file path and the Expert
     installer.

The Supabase client is an in-memory fake that APPLIES its filters and enforces
``documents_dedup_idx`` on insert, so a missing predicate returns the wrong row and a race is a real
23505 rather than a scripted one.
"""

from __future__ import annotations

import ast
import hashlib
import logging
import pathlib
from collections import Counter
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.ingest_splice import MintResult, mint_document_row

USER = "00000000-0000-0000-0000-000000000001"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
F1 = "f1f1f1f1-0000-0000-0000-000000000001"
F2 = "f2f2f2f2-0000-0000-0000-000000000002"
RAW = b"# phase 280 same bytes"
HASH = hashlib.sha256(RAW).hexdigest()
FILENAME = "q3_board_pack.md"
MIME = "text/markdown"

_FILTERS = ("eq", "neq", "is_", "lt")


# ── the fake ────────────────────────────────────────────────────────────────────────────────


class _Q:
    def __init__(self, db: "_FakeDB", table: str, kind: str, arg: Any):
        self.db, self.table, self.kind, self.arg = db, table, kind, arg
        self.calls: list[tuple[str, tuple, dict]] = []
        self.single = False

    def _rec(name):  # noqa: N805 — builder factory
        def method(self, *a, **k):
            self.calls.append((name, a, k))
            return self

        return method

    eq = _rec("eq")
    neq = _rec("neq")
    is_ = _rec("is_")
    lt = _rec("lt")
    order = _rec("order")
    limit = _rec("limit")

    def maybe_single(self):
        self.single = True
        return self

    def filters(self) -> list[tuple]:
        return [(n, a) for n, a, _ in self.calls if n in _FILTERS]

    def _matches(self, row: dict) -> bool:
        for name, a, _ in self.calls:
            col, val = (a + (None,))[:2]
            have = row.get(col)
            if name == "eq" and str(have) != str(val):
                return False
            if name == "neq" and str(have) == str(val):
                return False
            if name == "is_" and val == "null" and have is not None:
                return False
            if name == "lt" and not (have is not None and have < val):
                return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.kind == "insert":
            return self.db._insert(self.table, dict(self.arg))
        matched = [r for r in rows if self._matches(r)]
        if self.kind == "update":
            if self.db.update_error is not None:
                raise self.db.update_error
            for r in matched:
                r.update(self.arg)
            return SimpleNamespace(data=[dict(r) for r in matched])
        for name, a, k in self.calls:
            if name == "order":
                matched.sort(key=lambda r: str(r.get(a[0]) or ""), reverse=bool(k.get("desc")))
        for name, a, _ in self.calls:
            if name == "limit":
                matched = matched[: a[0]]
        if self.single:
            return SimpleNamespace(data=dict(matched[0])) if matched else None  # postgrest 2.29
        return SimpleNamespace(data=[dict(r) for r in matched])


class _T:
    def __init__(self, db: "_FakeDB", name: str):
        self.db, self.name = db, name

    def _q(self, kind, arg):
        q = _Q(self.db, self.name, kind, arg)
        self.db.sites.append(q)
        return q

    def select(self, cols="*"):
        return self._q("select", cols)

    def update(self, payload):
        return self._q("update", payload)

    def insert(self, payload):
        return self._q("insert", payload)


class _FakeDB:
    """documents / folders / org_members / connector_connections, in memory.

    * ``trigger_org`` stamps an inserted document that carries no ``org_id`` (the
      ``autofill_org_id_by_owner`` trigger), so the minter must read the org back from the row;
    * ``documents_dedup_idx`` is enforced on insert: (org, user, hash, folder) among non-failed;
    * ``concurrent_winner`` is inserted by "another request" immediately before this insert;
    * ``insert_error`` / ``update_error`` fail those writes outright.
    """

    def __init__(self, *, docs=None, folders=None, members=None, connections=None,
                 trigger_org: str | None = ORG_A, concurrent_winner: dict | None = None,
                 insert_error: Exception | None = None, update_error: Exception | None = None):
        self.tables: dict[str, list[dict]] = {
            "documents": [dict(r) for r in (docs or [])],
            "folders": [dict(r) for r in (folders or [])],
            "org_members": [dict(r) for r in (members or [{"user_id": USER, "org_id": ORG_A}])],
            "connector_connections": [dict(r) for r in (connections or [])],
        }
        self.sites: list[_Q] = []
        self.trigger_org = trigger_org
        self.concurrent_winner = concurrent_winner
        self.insert_error = insert_error
        self.update_error = update_error
        self.storage = MagicMock()

    def table(self, name):
        assert name in self.tables, f"unexpected table {name!r}"
        return _T(self, name)

    def _insert(self, table: str, row: dict):
        rows = self.tables[table]
        if table != "documents":
            row.setdefault("id", str(uuid4()))
            rows.append(row)
            return SimpleNamespace(data=[dict(row)])
        if self.insert_error is not None:
            raise self.insert_error
        if self.concurrent_winner is not None:
            rows.append(dict(self.concurrent_winner))
            self.concurrent_winner = None
        if not row.get("org_id"):
            row["org_id"] = self.trigger_org
        for r in rows:
            if r.get("status") != "failed" and all(
                str(r.get(c)) == str(row.get(c)) for c in ("org_id", "user_id", "content_hash", "folder_id")
            ):
                raise Exception(
                    "{'message': 'duplicate key value violates unique constraint "
                    "\"documents_dedup_idx\"', 'code': '23505'}"
                )
        rows.append(row)
        return SimpleNamespace(data=[dict(row)])

    # -- views -----------------------------------------------------------------------------------

    def doc_sites(self) -> list[_Q]:
        return [s for s in self.sites if s.table == "documents"]

    def kinds(self) -> list[str]:
        return [s.kind for s in self.doc_sites()]

    def inflight_site(self) -> _Q:
        return next(s for s in self.doc_sites() if s.kind == "select"
                    and ("eq", ("is_latest", True)) in s.filters())

    def requery_site(self) -> _Q:
        return next(s for s in self.doc_sites() if s.kind == "select"
                    and ("neq", ("status", "failed")) in s.filters()
                    and ("eq", ("is_latest", True)) not in s.filters())

    def retire_site(self) -> _Q:
        return next(s for s in self.doc_sites() if s.kind == "update")

    def doc(self, doc_id: str) -> dict:
        return next(r for r in self.tables["documents"] if r["id"] == doc_id)


def _row(**over) -> dict:
    base = {
        "id": "doc-a",
        "user_id": USER,
        "org_id": ORG_A,
        "filename": FILENAME,
        "file_path": f"{USER}/doc-a/{FILENAME}",
        "content_hash": HASH,
        "status": "pending",
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": "2026-10-14T00:00:00Z",
    }
    base.update(over)
    return base


def _folders(*ids: str, org: str = ORG_A) -> list[dict]:
    return [{"id": f, "user_id": USER, "org_id": org} for f in ids]


def _mint(db: _FakeDB, **kw) -> MintResult:
    args: dict = dict(raw=RAW, filename=FILENAME, mime_type=MIME, user_id=USER, supabase=db)
    args.update(kw)
    return mint_document_row(**args)  # type: ignore[arg-type]


# ── 1. the /upload sequence ─────────────────────────────────────────────────────────────────


def test_first_upload_issues_dedup_then_inflight_then_version_then_insert_and_no_update():
    db = _FakeDB()
    res = _mint(db)

    assert res.is_duplicate is False
    assert db.kinds() == ["select", "select", "select", "insert"], db.kinds()
    completed, inflight, version, _ = db.doc_sites()
    assert ("eq", ("status", "completed")) in completed.filters()
    assert inflight.arg == "*"
    assert inflight.filters() == [
        ("eq", ("user_id", USER)),
        ("eq", ("content_hash", HASH)),
        ("neq", ("status", "failed")),
        ("eq", ("is_latest", True)),
    ], "the in-flight leg must be folder-agnostic and org-free for /upload (D-24)"
    assert version.arg == "id, version_number"


def test_inflight_leg_is_org_scoped_when_an_org_is_passed():
    db = _FakeDB()
    _mint(db, org_id=ORG_B)
    assert ("eq", ("org_id", ORG_B)) in db.inflight_site().filters()


def test_an_inflight_copy_is_returned_and_nothing_is_written():
    db = _FakeDB(docs=[_row(status="processing")])
    res = _mint(db)

    assert res.is_duplicate is True
    assert res.document["id"] == "doc-a"
    assert "insert" not in db.kinds() and "update" not in db.kinds()
    assert db.doc("doc-a")["is_latest"] is True


def test_the_inflight_leg_ignores_the_folder():
    """D-24: same bytes into another folder while the first copy is pending is that copy."""
    db = _FakeDB(docs=[_row(folder_id=F1)], folders=_folders(F1, F2))
    res = _mint(db, folder_id=F2)

    assert res.is_duplicate is True and res.document["id"] == "doc-a"
    assert not any(f[1][0] == "folder_id" for f in db.inflight_site().filters())
    assert db.doc("doc-a")["is_latest"] is True


def test_a_failed_copy_is_not_in_flight():
    db = _FakeDB(docs=[_row(status="failed")])
    res = _mint(db)
    assert res.is_duplicate is False


# ── 2. insert first, then retire (D-03 / D-25) ──────────────────────────────────────────────


def test_a_new_version_inserts_before_it_retires():
    db = _FakeDB(docs=[_row(id="v1", content_hash="other", status="completed")])
    res = _mint(db)

    assert res.is_duplicate is False and res.version_number == 2
    assert db.kinds() == ["select", "select", "select", "insert", "update"], db.kinds()
    new_id = res.document["id"]
    retire = db.retire_site()
    assert ("neq", ("id", new_id)) in retire.filters()
    assert ("lt", ("version_number", 2)) in retire.filters()
    assert db.doc("v1")["is_latest"] is False
    assert db.doc(new_id)["is_latest"] is True


def test_retire_takes_the_org_from_the_inserted_row_when_none_was_passed():
    """D-25 / T-280-15: /upload passes no org; the trigger stamps one. The retire must not touch a
    same-named file in the person's OTHER org."""
    db = _FakeDB(
        docs=[
            _row(id="v1-a", content_hash="h-a", status="completed", org_id=ORG_A),
            _row(id="v1-b", content_hash="h-b", status="completed", org_id=ORG_B),
        ],
        trigger_org=ORG_A,
    )
    _mint(db)
    assert ("eq", ("org_id", ORG_A)) in db.retire_site().filters()
    assert db.doc("v1-a")["is_latest"] is False
    assert db.doc("v1-b")["is_latest"] is True, "org B's same-named file was retired by an org A upload"


def test_retire_keeps_the_folder_predicate_under_folder_scope():
    db = _FakeDB(docs=[_row(id="v1", content_hash="other", status="completed", folder_id=F1)],
                 folders=_folders(F1))
    _mint(db, folder_id=F1, org_id=ORG_A, on_conflict="link", version_scope="folder")
    f = db.retire_site().filters()
    assert ("eq", ("folder_id", F1)) in f and ("eq", ("org_id", ORG_A)) in f


def test_two_concurrent_new_versions_do_not_retire_each_other():
    """The other v2 was inserted by a concurrent request; ours must leave it latest (lt, not neq)."""
    other_v2 = _row(id="v2-other", content_hash="h-other", version_number=2, created_at="2026-10-14T00:00:01Z")
    db = _FakeDB(docs=[_row(id="v1", content_hash="h-v1", status="completed")], concurrent_winner=other_v2)
    res = _mint(db)

    assert res.version_number == 2
    assert db.doc("v2-other")["is_latest"] is True
    assert db.doc(res.document["id"])["is_latest"] is True


def test_a_failed_insert_retires_nothing():
    db = _FakeDB(docs=[_row(id="v1", content_hash="other", status="completed")],
                 insert_error=RuntimeError("connection reset"))
    with pytest.raises(RuntimeError):
        _mint(db)
    assert "update" not in db.kinds()
    assert db.doc("v1")["is_latest"] is True


def test_a_failed_retire_is_logged_and_the_inserted_row_is_kept(caplog):
    db = _FakeDB(docs=[_row(id="v1", content_hash="other", status="completed")],
                 update_error=RuntimeError("retire refused"))
    with caplog.at_level(logging.WARNING, logger="app.services.ingest_splice"):
        res = _mint(db)

    assert res.is_duplicate is False
    new_id = res.document["id"]
    assert any(new_id in r.getMessage() for r in caplog.records), caplog.text
    assert any(r["id"] == new_id for r in db.tables["documents"])


@pytest.mark.parametrize("error", [RuntimeError("retire refused"), AttributeError("'_Q' has no attribute 'lt'")])
def test_a_failed_retire_is_logged_at_error_with_its_traceback(caplog, error):
    """280-REVIEW IN-01. The retire stays non-fatal (D-25: never lose the minted row), but a failure
    leaves two latest rows, and the catch-all also swallowed programming errors — a fake without
    `.lt` once kept a suite green while the retire never ran (test_274_promote_preview_parity).
    So it is logged at ERROR with exc_info, never as a one-line WARNING."""
    db = _FakeDB(docs=[_row(id="v1", content_hash="other", status="completed")], update_error=error)
    with caplog.at_level(logging.WARNING, logger="app.services.ingest_splice"):
        res = _mint(db)

    rec = next(r for r in caplog.records if res.document["id"] in r.getMessage())
    assert rec.levelno == logging.ERROR, rec.levelname
    assert rec.exc_info is not None and rec.exc_info[1] is error


# ── 3. 23505 → the winner (D-02) ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("on_conflict", ["raise", "link"])
def test_a_concurrent_insert_resolves_to_the_winner(on_conflict):
    winner = _row(id="winner")
    db = _FakeDB(concurrent_winner=winner)
    res = _mint(db, on_conflict=on_conflict)

    assert res.is_duplicate is True
    assert res.document["id"] == "winner"
    assert "update" not in db.kinds()
    f = db.requery_site().filters()
    assert ("is_", ("folder_id", "null")) in f, "the re-query is scoped as the index that fired"
    assert db.doc("winner")["is_latest"] is True


def test_the_requery_is_folder_and_org_scoped_when_both_are_known():
    winner = _row(id="winner", folder_id=F1)
    db = _FakeDB(concurrent_winner=winner, folders=_folders(F1))
    _mint(db, folder_id=F1, org_id=ORG_A, on_conflict="raise")
    f = db.requery_site().filters()
    assert ("eq", ("folder_id", F1)) in f and ("eq", ("org_id", ORG_A)) in f


RAW_B = b"# phase 280 different bytes"


def _latest_ids(db: _FakeDB, filename: str = FILENAME) -> list[str]:
    return [r["id"] for r in db.tables["documents"] if r["filename"] == filename and r["is_latest"]]


def test_same_bytes_as_a_retired_earlier_version_is_restored_never_returned_retired():
    """280-REVIEW WR-01, the reviewer's sequence, all in one folder (the root):

      1. bytes A as x → v1, still ``pending``;
      2. bytes B as x → v2 inserts, v1 is retired (``is_latest=false``, still ``pending``);
      3. bytes A as x again → the completed leg misses (v1 is not completed), the in-flight leg
         misses (v1 is not latest), v3 hits 23505 on v1.

    Before the fix the re-query returned RETIRED v1 as ``already_in_library`` — a document retrieval
    cannot see (it requires is_latest), and the person's "make A current again" was silently dropped.
    Now the retired same-named winner is restored (the ``POST /documents/{id}/restore`` semantics:
    promote it, then retire its siblings) and returned live."""
    db = _FakeDB()
    v1 = _mint(db)
    v2 = _mint(db, raw=RAW_B)
    v1_id, v2_id = v1.document["id"], v2.document["id"]
    assert db.doc(v1_id)["is_latest"] is False and db.doc(v1_id)["status"] == "pending"  # precondition

    res = _mint(db)

    assert res.is_duplicate is True
    assert res.document["id"] == v1_id
    assert res.document["is_latest"] is True, "a RETIRED row was returned as the live copy"
    assert db.doc(v1_id)["is_latest"] is True
    assert db.doc(v2_id)["is_latest"] is False
    assert _latest_ids(db) == [v1_id]


def test_the_requery_prefers_the_live_winner_over_a_retired_row():
    """With no org known (/upload, root), the 23505 re-query is not org-scoped and can match one row
    per org. The live (is_latest) one is the winner, never a retired one that happens to be newer."""
    retired_newer = _row(id="retired-b", org_id=ORG_B, is_latest=False, created_at="2026-10-14T00:00:09Z")
    winner = _row(id="winner")
    db = _FakeDB(docs=[retired_newer], concurrent_winner=winner)
    res = _mint(db)
    assert res.is_duplicate is True and res.document["id"] == "winner"
    assert db.doc("retired-b")["is_latest"] is False, "a retired row in another org was restored"


def test_same_bytes_as_a_retired_row_under_another_name_is_refused_not_returned():
    """The retired match is ANOTHER file's earlier version (same bytes, different name). Restoring it
    would flip that other file's current version behind the person's back, and returning it would
    report an invisible document as the live copy — so there is no live winner: the 409 fallback."""
    db = _FakeDB()
    v1 = _mint(db)
    v2 = _mint(db, raw=RAW_B)

    with pytest.raises(HTTPException) as exc:
        _mint(db, filename="renamed.md")
    assert exc.value.status_code == 409
    assert db.doc(v1.document["id"])["is_latest"] is False
    assert db.doc(v2.document["id"])["is_latest"] is True


def test_409_survives_only_when_no_winner_is_found():
    db = _FakeDB(insert_error=Exception("23505 duplicate key value violates unique constraint"))
    with pytest.raises(HTTPException) as exc:
        _mint(db, on_conflict="raise")
    assert exc.value.status_code == 409
    assert "update" not in db.kinds()


# ── 4. /upload surfaces the duplicate (D-01) ────────────────────────────────────────────────


def _upload_client():
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: {"id": USER, "email": "u@test.local"}
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    return app, TestClient(app)


def _doc_payload(doc_id: str) -> dict:
    return {
        "id": doc_id, "user_id": USER, "folder_id": None, "filename": "a.txt",
        "file_path": f"{USER}/{doc_id}/a.txt", "file_size": 3, "mime_type": "text/plain",
        "status": "pending", "error_message": None, "chunk_count": None, "content_hash": HASH,
        "version_number": 1, "is_latest": True, "metadata": None,
        "created_at": "2026-10-14T00:00:00Z", "updated_at": "2026-10-14T00:00:00Z",
    }


def test_upload_answers_200_with_already_in_library_for_a_duplicate():
    doc_id = str(uuid4())
    res = MintResult(document=_doc_payload(doc_id), is_duplicate=True, storage_path="", version_number=1)
    app, client = _upload_client()
    try:
        with patch("app.services.ingest_splice.async_mint_document_row", new=AsyncMock(return_value=res)):
            resp = client.post("/documents/upload", files={"file": ("a.txt", b"abc", "text/plain")})
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == doc_id
    assert resp.json()["already_in_library"] is True


def test_the_response_model_declares_already_in_library_as_optional():
    from app.models.document import DocumentResponse

    field = DocumentResponse.model_fields["already_in_library"]
    assert field.default is None and not field.is_required()


# ── 5. all 7 callers (D-04) ─────────────────────────────────────────────────────────────────

APP = pathlib.Path(__file__).resolve().parents[2] / "app"
_EXPECTED_CALLERS = Counter({
    "api/documents.py": 1,                       # /upload
    "services/watch_service.py": 2,              # new file + modified file
    "services/sources/import_service.py": 1,     # source import
    "api/workspace_promote.py": 1,               # promote, via mint_or_link
    "services/expert_install_service.py": 1,     # expert install
    "services/email_attachments.py": 1,          # email attachment (sync)
})
_MINTERS = {"mint_document_row", "async_mint_document_row"}


def _callee(node: ast.Call) -> str | None:
    f = node.func
    return f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None


def test_every_document_row_is_minted_by_the_one_minter_from_the_seven_known_sites():
    found: Counter = Counter()
    defined: list[str] = []
    for path in APP.rglob("*.py"):
        rel = path.relative_to(APP).as_posix()
        tree = ast.parse(path.read_text(encoding="utf-8-sig"))  # one module carries a BOM
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in _MINTERS:
                defined.append(rel)
            if isinstance(node, ast.Call) and _callee(node) in _MINTERS and rel != "services/ingest_splice.py":
                found[rel] += 1
    assert sorted(defined) == ["services/ingest_splice.py", "services/ingest_splice.py"], defined
    assert sum(found.values()) >= 7, f"floor of 7 caller sites, found {dict(found)}"
    assert found == _EXPECTED_CALLERS, (
        f"the minter's caller inventory changed: {dict(found)} — a new caller must be added to "
        "test_280_same_bytes_live's CALLERS matrix as well as here"
    )


# ── 6. through the real caller (plan-check W-1) ─────────────────────────────────────────────


async def test_the_watch_new_file_path_links_the_inflight_copy_through_the_real_caller():
    """``WatchService.sync_watch`` (the new-file arm, watch_service.py ~:344) against an in-flight
    same-hash row: the minter's in-flight leg answers, no documents insert and no is_latest update
    happen, and the watch item is linked to the existing id. Only the watch DB layer, the adapter
    and the job queue are stubbed — never the minter."""
    from app.services.sources.base import FilePage, SourceFile
    from app.services.watch_service import WatchService

    conn_id = str(uuid4())
    db = _FakeDB(
        docs=[_row(id=str(uuid4()))],
        connections=[{"id": conn_id, "service_id": "google", "is_enabled": True,
                      "default_ingest_visibility": "private"}],
    )
    existing_id = db.tables["documents"][0]["id"]
    adapter = MagicMock()
    adapter.list_files = AsyncMock(return_value=FilePage(files=[SourceFile(
        id="ext-1", name=FILENAME, mime_type=MIME, size=len(RAW), modified_at="2026-10-14T00:00:00Z",
    )]))
    adapter.read_file = AsyncMock(return_value=(FILENAME, RAW, MIME))
    watch = {"id": uuid4(), "connection_id": conn_id, "user_id": USER, "org_id": ORG_A,
             "library_folder_id": None, "source_folder_id": "root"}

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock(return_value={"id": uuid4()})) as upsert, \
         patch("app.services.watch_service.insert_ingestion_job", new=AsyncMock()) as enqueue, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter):
        await WatchService(pool=MagicMock(), supabase=db).sync_watch(watch)

    assert any(("eq", ("is_latest", True)) in s.filters() for s in db.doc_sites()), \
        "the watch path did not reach the minter's in-flight leg"
    assert "insert" not in db.kinds(), "a second documents row was attempted for in-flight bytes"
    assert "update" not in db.kinds(), "the in-flight copy's is_latest was touched"
    assert db.doc(existing_id)["is_latest"] is True
    upsert.assert_awaited_once()
    assert str(upsert.await_args.kwargs["document_id"]) == existing_id
    enqueue.assert_not_awaited()


async def test_expert_install_refuses_an_inflight_copy_in_another_folder_through_the_real_caller():
    """D-24 SIDE EFFECT, stated deliberately: ``install_expert`` now raises ExpertInstallConflict for
    an IN-FLIGHT same-bytes copy in another folder, exactly as it already did for a completed one
    (expert_install_service.py ~:631). Before Phase 280 the in-flight copy was invisible to the
    minter, so the install minted a second copy that would fail at completion on the
    completed-hash index. Only experts_db, the corpus loader and the enqueue are stubbed."""
    from app.services import expert_install_service as svc
    from app.services.expert_corpus import CorpusFile, ExpertCorpus

    org, caller, bundle_id = UUID(ORG_A), UUID(USER), uuid4()
    install_folder, other_folder = F1, F2
    db = _FakeDB(
        docs=[_row(id=str(uuid4()), folder_id=other_folder)],
        folders=_folders(install_folder, other_folder),
    )
    corpus = ExpertCorpus(
        slug="financial-analyzer", folder_name="Financial Reports",
        files=[CorpusFile(filename=FILENAME, mime_type=MIME, raw=RAW, sha256=HASH)],
        corpus_version="v-test",
    )
    experts_db = MagicMock()
    experts_db.claim_expert_install = AsyncMock(return_value={
        "id": uuid4(), "org_id": org, "expert_bundle_id": bundle_id, "folder_id": UUID(install_folder),
        "status": "installing", "error": None, "installed_by": caller, "corpus_version": "v-test",
    })
    experts_db.list_install_corpus_documents = AsyncMock(return_value=[])
    experts_db.set_expert_install_status = AsyncMock(return_value={})
    experts_db.set_expert_install_folder = AsyncMock(return_value={})
    experts_db.get_expert_install = AsyncMock(return_value=None)
    enqueue = AsyncMock()

    with patch.object(svc, "experts_db", experts_db), patch.object(svc, "_enqueue_or_splice", new=enqueue), \
         patch.object(svc, "has_corpus", return_value=True), patch.object(svc, "load_corpus", return_value=corpus):
        with pytest.raises(svc.ExpertInstallConflict):
            await svc.install_expert(
                pool=MagicMock(), supabase=db,
                bundle={"id": bundle_id, "slug": "financial-analyzer", "is_system": True, "org_id": None},
                org_id=org, user_id=caller, can_install=True, background_tasks=MagicMock(),
            )
    assert "insert" not in db.kinds(), "a second copy was minted beside the in-flight one"
    enqueue.assert_not_awaited()


# ── 7. CR-01: a folder files a document only into its own org (D-05 / D-26, BUG-261014-01) ──

OTHER_USER = "00000000-0000-0000-0000-0000000000ff"


def _missing_folder_refusal(db: _FakeDB, **kw) -> HTTPException:
    with pytest.raises(HTTPException) as exc:
        _mint(db, folder_id=str(uuid4()), **kw)
    return exc.value


def _assert_identical_404(got: HTTPException, ref: HTTPException) -> None:
    assert (got.status_code, got.detail, got.headers) == (ref.status_code, ref.detail, ref.headers)
    assert got.status_code == 404 and got.detail == "Folder not found"


def test_upload_into_a_folder_of_the_callers_other_org_mints_in_that_org():
    """org_id=None (the /upload shape), folder in org B, caller a member of B → org B, explicitly."""
    db = _FakeDB(
        folders=_folders(F1, org=ORG_B),
        members=[{"user_id": USER, "org_id": ORG_A}, {"user_id": USER, "org_id": ORG_B}],
        trigger_org=ORG_A,  # the LIMIT 1 pick — must NOT decide this document's org
    )
    res = _mint(db, folder_id=F1)

    assert res.is_duplicate is False
    inserted = next(s for s in db.doc_sites() if s.kind == "insert").arg
    assert inserted["org_id"] == ORG_B, "the folder's org was not stamped explicitly"
    assert db.doc(res.document["id"])["org_id"] == ORG_B
    assert ("eq", ("org_id", ORG_B)) in db.inflight_site().filters()


def test_a_folder_in_an_org_the_caller_is_not_in_refuses_like_a_missing_folder():
    db = _FakeDB(folders=_folders(F1, org=ORG_B), members=[{"user_id": USER, "org_id": ORG_A}])
    ref = _missing_folder_refusal(db)
    with pytest.raises(HTTPException) as exc:
        _mint(db, folder_id=F1)
    _assert_identical_404(exc.value, ref)
    assert "insert" not in db.kinds()


def test_an_explicit_org_that_differs_from_the_folders_org_refuses_like_a_missing_folder():
    db = _FakeDB(
        folders=_folders(F1, org=ORG_B),
        members=[{"user_id": USER, "org_id": ORG_A}, {"user_id": USER, "org_id": ORG_B}],
    )
    ref = _missing_folder_refusal(db, org_id=ORG_A, on_conflict="link")
    with pytest.raises(HTTPException) as exc:
        _mint(db, folder_id=F1, org_id=ORG_A, on_conflict="link")
    _assert_identical_404(exc.value, ref)
    assert "insert" not in db.kinds()


def test_another_owners_folder_is_still_the_existing_403():
    db = _FakeDB(folders=[{"id": F1, "user_id": OTHER_USER, "org_id": ORG_A}])
    with pytest.raises(HTTPException) as exc:
        _mint(db, folder_id=F1)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Cannot upload to a folder you do not own"


@pytest.mark.parametrize(
    "kw",
    [
        {},                                          # /upload shape: org_id=None → membership arm
        {"org_id": ORG_A, "on_conflict": "link"},    # watch_new / watch_modified shape
    ],
    ids=["org_from_membership", "explicit_org"],
)
def test_a_foreign_org_folder_of_another_owner_is_the_identical_404_under_the_service_role(kw):
    """280-REVIEW WR-05. This fake applies no RLS, so it reads like the SERVICE-ROLE client the watch
    sync mints with. A folder in an org the caller is not in, owned by someone else, must answer the
    404 a nonexistent folder gets — before 280-REVIEW the owner comparison ran first and answered
    403, which told a service-role caller the folder EXISTS (an existence oracle, D-05 / D-18)."""
    db = _FakeDB(
        folders=[{"id": F1, "user_id": OTHER_USER, "org_id": ORG_B}],
        members=[{"user_id": USER, "org_id": ORG_A}],
    )
    ref = _missing_folder_refusal(db, **kw)
    with pytest.raises(HTTPException) as exc:
        _mint(db, folder_id=F1, **kw)
    _assert_identical_404(exc.value, ref)
    assert "insert" not in db.kinds()
