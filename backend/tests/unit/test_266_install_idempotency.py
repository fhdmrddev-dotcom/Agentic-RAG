"""Phase 266 plan 03 — re-install restores what is missing and never overwrites (D-266-14, PACK-19).

Seven arms, each the smallest thing that could go wrong on a second press of Install:

  (i)   a LOST claim (another worker holds it) writes nothing at all;
  (ii)  a complete install repeated writes nothing — the "identical counts" arm of SC#2;
  (iii) a corpus file missing BY FILENAME is the only thing minted;
  (iv)  a FAILED document owned by the caller is re-driven IN PLACE (never re-minted);
  (v)   a FAILED document owned by someone else is left alone and named as the cause;
  (vi)  a deleted folder is recreated and the install row repointed;
  (vii) a document a person EDITED (same filename, different bytes) is left untouched.

⛔ No database: the db layer is patched at the installer's import site and the Supabase client is
an in-memory recorder, so "no write" below means no call reached either one.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from app.services import expert_install_service as svc
from app.services.expert_corpus import CorpusFile, ExpertCorpus
from app.services.ingest_splice import MintResult

ORG = uuid4()
CALLER = uuid4()
OTHER_ADMIN = uuid4()
BUNDLE_ID = uuid4()
FOLDER = uuid4()
NEW_FOLDER = uuid4()
F1 = "acme_q3_2026_financial_report.md"
F2 = "acme_notes.md"
RAW1 = b"# ACME\n\nRevenue $124.5 (+18.2%)\n"
RAW2 = b"# notes\n"


class _Query:
    def __init__(self, client: "FakeSupabase", table: str) -> None:
        self.client = client
        self.table = table
        self.ops: list[tuple[str, tuple, dict]] = []

    def __getattr__(self, name: str):
        def _op(*args: Any, **kwargs: Any) -> "_Query":
            self.ops.append((name, args, kwargs))
            return self

        return _op

    def execute(self) -> SimpleNamespace:
        self.client.executed.append((self.table, list(self.ops)))
        return SimpleNamespace(data=self.client.respond(self.table, self.ops))


class FakeSupabase:
    def __init__(self, *, folder_present: bool) -> None:
        self.folder_present = folder_present
        self.executed: list[tuple[str, list]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def respond(self, table: str, ops: list) -> Any:
        verbs = [o[0] for o in ops]
        if table == "folders" and "insert" in verbs:
            payload = next(o[1][0] for o in ops if o[0] == "insert")
            return [{**payload, "id": str(NEW_FOLDER)}]
        if table == "folders" and "select" in verbs:
            return {"id": str(FOLDER)} if self.folder_present else None
        if "update" in verbs:
            return [{"id": "updated"}]
        return []

    def writes(self) -> list[tuple[str, list]]:
        return [
            (t, ops) for t, ops in self.executed
            if any(o[0] in ("insert", "update", "delete", "upsert") for o in ops)
        ]


def _corpus(files: list[tuple[str, bytes]]) -> ExpertCorpus:
    return ExpertCorpus(
        slug="financial-analyzer",
        folder_name="Financial Reports & Filings",
        files=[
            CorpusFile(filename=n, mime_type="text/markdown", raw=r, sha256=hashlib.sha256(r).hexdigest())
            for n, r in files
        ],
        corpus_version="v-test",
    )


def _bundle() -> dict:
    return {"id": BUNDLE_ID, "slug": "financial-analyzer", "name": "Financial Analyzer", "is_system": True}


def _claim(folder_id: UUID | None) -> dict:
    created = datetime(2026, 9, 20, tzinfo=timezone.utc)
    return {
        "id": uuid4(),
        "org_id": ORG,
        "expert_bundle_id": BUNDLE_ID,
        "folder_id": folder_id,
        "status": "installing",
        "error": None,
        "installed_by": CALLER,
        "corpus_version": "v-test",
        "created_at": created,
        "updated_at": datetime.now(timezone.utc),
    }


def _doc(filename: str, *, status: str = "completed", owner: UUID = CALLER, chunks: int = 3,
         folder: UUID = FOLDER) -> dict:
    doc_id = str(uuid4())
    return {
        "id": doc_id,
        "folder_id": folder,
        "filename": filename,
        "status": status,
        "chunk_count": chunks,
        "error_message": "Extraction failed" if status == "failed" else None,
        "user_id": owner,
        "file_path": f"{owner}/{doc_id}/{filename}",
        "mime_type": "text/markdown",
    }


def _db(*, claim: dict | None, docs: list[dict]) -> MagicMock:
    db = MagicMock()
    db.claim_expert_install = AsyncMock(return_value=claim)
    db.set_expert_install_folder = AsyncMock(return_value={})
    db.set_expert_install_status = AsyncMock(return_value={})
    db.list_install_corpus_documents = AsyncMock(return_value=docs)
    db.get_expert_install = AsyncMock(
        return_value={
            "org_id": ORG,
            "expert_bundle_id": BUNDLE_ID,
            "folder_id": FOLDER,
            "folder_exists": True,
            "status": "installing",
            "error": None,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    db.list_expert_installs_for_org = AsyncMock(return_value=[])
    return db


def _mint() -> AsyncMock:
    doc_id = str(uuid4())
    return AsyncMock(
        return_value=MintResult(
            document={"id": doc_id, "org_id": str(ORG), "folder_id": str(FOLDER), "status": "pending"},
            is_duplicate=False,
            storage_path=f"{CALLER}/{doc_id}/x",
            version_number=1,
        )
    )


async def _run(db, supa, mint, enq, corpus):
    with patch.object(svc, "experts_db", db), patch.object(
        svc.ingest_splice, "async_mint_document_row", new=mint
    ), patch.object(svc, "_enqueue_or_splice", new=enq), patch.object(
        svc, "has_corpus", return_value=True
    ), patch.object(svc, "load_corpus", return_value=corpus):
        return await svc.install_expert(
            pool=MagicMock(),
            supabase=supa,
            bundle=_bundle(),
            org_id=ORG,
            user_id=CALLER,
            can_install=True,
            background_tasks=MagicMock(),
        )


async def test_i_a_lost_claim_mints_nothing_and_writes_nothing(caplog):
    db = _db(claim=None, docs=[_doc(F1, status="processing")])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    with caplog.at_level(logging.INFO):
        result = await _run(db, supa, mint, enq, _corpus([(F1, RAW1)]))

    assert supa.executed == []
    mint.assert_not_awaited()
    enq.assert_not_awaited()
    db.set_expert_install_folder.assert_not_awaited()
    db.set_expert_install_status.assert_not_awaited()
    assert "EXPERT_INSTALL_CLAIM_LOST" in caplog.text
    # The answer is the DERIVED state of the install someone else is running.
    assert result.install.state == "installing"


async def test_ii_a_complete_install_repeated_writes_nothing():
    db = _db(claim=_claim(FOLDER), docs=[_doc(F1), _doc(F2)])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, RAW1), (F2, RAW2)]))

    mint.assert_not_awaited()
    enq.assert_not_awaited()
    db.set_expert_install_folder.assert_not_awaited()
    assert supa.writes() == [], "no folder insert, no document update, no chunk delete"
    assert db.set_expert_install_status.await_args.kwargs["status"] == "installed"


async def test_iii_only_the_file_missing_by_filename_is_minted():
    db = _db(claim=_claim(FOLDER), docs=[_doc(F1)])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, RAW1), (F2, RAW2)]))

    mint.assert_awaited_once()
    assert mint.await_args.kwargs["filename"] == F2
    assert mint.await_args.kwargs["folder_id"] == str(FOLDER)
    enq.assert_awaited_once()
    assert not [w for w in supa.writes() if w[0] == "folders"]


async def test_iv_a_failed_document_owned_by_the_caller_is_re_driven_in_place():
    failed = _doc(F1, status="failed")
    db = _db(claim=_claim(FOLDER), docs=[failed])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, RAW1)]))

    mint.assert_not_awaited()
    deletes = {t: ops for t, ops in supa.executed if any(o[0] == "delete" for o in ops)}
    assert set(deletes) == {"document_chunks", "document_tables", "document_images"}
    for ops in deletes.values():
        assert ("eq", ("document_id", failed["id"]), {}) in ops

    updates = [ops for t, ops in supa.executed if t == "documents" and any(o[0] == "update" for o in ops)]
    assert len(updates) == 1
    ops = updates[0]
    payload = next(o[1][0] for o in ops if o[0] == "update")
    assert payload == {"status": "pending", "error_message": None}
    assert ("eq", ("id", failed["id"]), {}) in ops
    assert ("eq", ("user_id", str(CALLER)), {}) in ops, "the reset is filtered by id AND owner"

    enq.assert_awaited_once()
    ekw = enq.await_args.kwargs
    assert ekw["doc"]["id"] == failed["id"]
    assert ekw["storage_path"] == failed["file_path"]
    assert ekw["active_org"] == str(ORG)
    assert ekw["raw"] == RAW1
    assert db.set_expert_install_status.await_args.kwargs["status"] == "installed"


async def test_v_a_failed_document_owned_by_someone_else_is_named_not_touched():
    failed = _doc(F1, status="failed", owner=OTHER_ADMIN)
    db = _db(claim=_claim(FOLDER), docs=[failed])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, RAW1)]))

    mint.assert_not_awaited()
    enq.assert_not_awaited()
    assert supa.writes() == []
    kw = db.set_expert_install_status.await_args.kwargs
    assert kw["status"] == "failed"
    assert "installed it" in kw["error"] and "retry" in kw["error"].lower()
    assert str(OTHER_ADMIN) not in kw["error"], "a literal sentence, never an id"


async def test_vi_a_deleted_folder_is_recreated_and_the_install_repointed(caplog):
    stale = uuid4()
    db = _db(claim=_claim(stale), docs=[])
    supa, mint, enq = FakeSupabase(folder_present=False), _mint(), AsyncMock()
    with caplog.at_level(logging.INFO):
        await _run(db, supa, mint, enq, _corpus([(F1, RAW1)]))

    inserts = [ops for t, ops in supa.executed if t == "folders" and any(o[0] == "insert" for o in ops)]
    assert len(inserts) == 1
    db.set_expert_install_folder.assert_awaited_once()
    assert str(db.set_expert_install_folder.await_args.kwargs["folder_id"]) == str(NEW_FOLDER)
    assert "EXPERT_INSTALL_FOLDER_RECREATED" in caplog.text
    # The select that decided the folder was gone was filtered by id AND the active org.
    selects = [ops for t, ops in supa.executed if t == "folders" and any(o[0] == "select" for o in ops)]
    assert selects and ("eq", ("org_id", str(ORG)), {}) in selects[0]
    assert ("eq", ("id", str(stale)), {}) in selects[0]
    mint.assert_awaited_once()
    assert mint.await_args.kwargs["folder_id"] == str(NEW_FOLDER)


async def test_vii_an_edited_document_is_left_untouched():
    # Same filename, completed, but a person replaced its bytes — the corpus bytes differ.
    edited = _doc(F1, status="completed")
    db = _db(claim=_claim(FOLDER), docs=[edited])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, b"# the corpus's own bytes\n")]))

    mint.assert_not_awaited()
    enq.assert_not_awaited()
    assert supa.writes() == []


async def test_iv_b_a_real_asyncpg_row_with_uuid_ids_is_handed_on_with_a_string_id():
    """266-05 live finding: asyncpg returns ``id`` / ``user_id`` / ``folder_id`` as ``UUID``,
    not ``str`` (this suite's ``_doc`` fixture used strings, which is how the defect hid).
    A real Retry's storage PUT to the existing key fails (no upsert), so ``_enqueue_or_splice``
    falls back to ``splice_document(document_id=doc["id"])`` — and a ``UUID`` there reached a
    JSON payload: ``Object of type UUID is not JSON serializable``, measured live, leaving the
    document ``failed`` with its chunks already deleted. The id handed on must be a string."""
    failed = _doc(F1, status="failed")
    failed["id"] = UUID(failed["id"])  # the asyncpg shape
    db = _db(claim=_claim(FOLDER), docs=[failed])
    supa, mint, enq = FakeSupabase(folder_present=True), _mint(), AsyncMock()
    await _run(db, supa, mint, enq, _corpus([(F1, RAW1)]))

    enq.assert_awaited_once()
    handed = enq.await_args.kwargs["doc"]["id"]
    assert isinstance(handed, str), f"re-drive handed a {type(handed).__name__} id to the ingest path"
    assert handed == str(failed["id"])
    json.dumps({"document_id": handed})  # the payload shape that failed live
