"""Phase 266 plan 03 — the per-org Expert install writer (PACK-18 / D-266-07, D-266-12, D-266-13).

WHAT THIS FILE PROVES, and nothing wider:

  1. A fresh install writes ONE folder through the caller's user-JWT client, with the caller as
     owner, the VALIDATED active org, and ``is_org_shared`` on the FOLDER only (RESEARCH C-1:
     documents have no such column).
  2. Every corpus file goes through the ONE ingest path — ``async_mint_document_row`` with an
     explicit ``org_id`` then ``_enqueue_or_splice`` with the same org — and never a pre-chunked
     insert, never a connection-only field.
  3. No row anywhere carries the retired seed user (``SYSTEM_USER_ID``).
  4. Every refusal is a NAMED exception carrying a fixed human sentence, and the install row's
     recorded error is a LITERAL — never ``str(exc)``, which could carry a driver message.

⛔ It touches no database. The db layer is patched at the installer's import site, and the
Supabase client is an in-memory recorder, so the payloads asserted here are exactly the payloads
the installer built.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services import expert_install_service as svc
from app.services.expert_corpus import CorpusFile, ExpertCorpus
from app.services.ingest_splice import MintResult

ORG = uuid4()
CALLER = uuid4()
BUNDLE_ID = uuid4()
NEW_FOLDER = uuid4()
SYSTEM_USER = "00000000-0000-0000-0000-000000000001"
FILENAME = "acme_q3_2026_financial_report.md"
RAW = b"# ACME Corporation\n\nRevenue $124.5 (+18.2%)\n"


# ── fakes ────────────────────────────────────────────────────────────────────────────────────


class _Query:
    """Records every builder call; ``execute`` asks the client what the table returns."""

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
    def __init__(self, *, existing_folder: dict | None = None, new_folder_id: UUID = NEW_FOLDER) -> None:
        self.existing_folder = existing_folder
        self.new_folder_id = new_folder_id
        self.executed: list[tuple[str, list]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def respond(self, table: str, ops: list) -> Any:
        verbs = [o[0] for o in ops]
        if table == "folders" and "insert" in verbs:
            payload = next(o[1][0] for o in ops if o[0] == "insert")
            return [{**payload, "id": str(self.new_folder_id)}]
        if table == "folders" and "select" in verbs:
            return self.existing_folder
        if table == "documents" and "update" in verbs:
            return [{"id": "updated"}]
        return []

    # helpers for assertions
    def calls(self, table: str, verb: str) -> list[list]:
        return [ops for t, ops in self.executed if t == table and any(o[0] == verb for o in ops)]

    def payloads(self, table: str, verb: str) -> list[Any]:
        out = []
        for ops in self.calls(table, verb):
            out.extend(o[1][0] for o in ops if o[0] == verb)
        return out


def _corpus(files: list[tuple[str, bytes]] | None = None) -> ExpertCorpus:
    import hashlib

    files = files or [(FILENAME, RAW)]
    return ExpertCorpus(
        slug="financial-analyzer",
        folder_name="Financial Reports & Filings",
        files=[
            CorpusFile(filename=n, mime_type="text/markdown", raw=r, sha256=hashlib.sha256(r).hexdigest())
            for n, r in files
        ],
        corpus_version="v-test",
    )


def _bundle(**over: Any) -> dict:
    row = {
        "id": BUNDLE_ID,
        "slug": "financial-analyzer",
        "name": "Financial Analyzer",
        "is_system": True,
        "org_id": None,
    }
    row.update(over)
    return row


def _claim(folder_id: UUID | None = None) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "org_id": ORG,
        "expert_bundle_id": BUNDLE_ID,
        "folder_id": folder_id,
        "status": "installing",
        "error": None,
        "installed_by": CALLER,
        "corpus_version": "v-test",
        "created_at": now,
        "updated_at": now,
    }


def _db(*, claim: dict | None, docs: list[dict] | None = None) -> MagicMock:
    db = MagicMock()
    db.claim_expert_install = AsyncMock(return_value=claim)
    db.set_expert_install_folder = AsyncMock(return_value={})
    db.set_expert_install_status = AsyncMock(return_value={})
    db.list_install_corpus_documents = AsyncMock(return_value=docs or [])
    db.get_expert_install = AsyncMock(
        return_value={**(claim or {}), "folder_id": NEW_FOLDER, "folder_exists": True} if claim else None
    )
    db.list_expert_installs_for_org = AsyncMock(return_value=[])
    return db


def _mint(doc: dict | None = None, *, is_duplicate: bool = False) -> AsyncMock:
    doc = doc or {"id": str(uuid4()), "org_id": str(ORG), "folder_id": str(NEW_FOLDER), "status": "pending"}
    return AsyncMock(
        return_value=MintResult(
            document=doc,
            is_duplicate=is_duplicate,
            storage_path=f"{CALLER}/{doc['id']}/{FILENAME}",
            version_number=1,
        )
    )


async def _run(db: MagicMock, supa: FakeSupabase, mint: AsyncMock, enqueue: AsyncMock, *, bundle: dict | None = None,
               corpus: ExpertCorpus | None = None, corpus_present: bool = True):
    with patch.object(svc, "experts_db", db), patch.object(
        svc.ingest_splice, "async_mint_document_row", new=mint
    ), patch.object(svc, "_enqueue_or_splice", new=enqueue), patch.object(
        svc, "has_corpus", return_value=corpus_present
    ), patch.object(svc, "load_corpus", return_value=corpus or _corpus()):
        return await svc.install_expert(
            pool=MagicMock(),
            supabase=supa,
            bundle=bundle or _bundle(),
            org_id=ORG,
            user_id=CALLER,
            can_install=True,
            background_tasks=MagicMock(),
        )


# ── fresh install ────────────────────────────────────────────────────────────────────────────


async def test_fresh_install_writes_one_org_shared_folder_through_the_user_client():
    db, supa, mint, enq = _db(claim=_claim()), FakeSupabase(), _mint(), AsyncMock()
    await _run(db, supa, mint, enq)

    folder_inserts = supa.payloads("folders", "insert")
    assert folder_inserts == [
        {
            "user_id": str(CALLER),
            "org_id": str(ORG),
            "name": "Financial Reports & Filings",
            "parent_id": None,
            "is_org_shared": True,
        }
    ]
    db.set_expert_install_folder.assert_awaited_once()
    kw = db.set_expert_install_folder.await_args.kwargs
    assert kw["org_id"] == ORG and kw["bundle_id"] == BUNDLE_ID
    assert str(kw["folder_id"]) == str(NEW_FOLDER)
    assert kw["installed_by"] == CALLER


async def test_fresh_install_mints_through_the_one_ingest_path_in_the_active_org():
    db, supa, mint, enq = _db(claim=_claim()), FakeSupabase(), _mint(), AsyncMock()
    await _run(db, supa, mint, enq)

    mint.assert_awaited_once()
    kw = mint.await_args.kwargs
    assert kw["org_id"] == str(ORG)
    assert kw["folder_id"] == str(NEW_FOLDER)
    assert kw["user_id"] == str(CALLER)
    assert kw["supabase"] is supa, "the mint must run on the caller's user-JWT client (RLS proves org + owner)"
    assert kw["on_conflict"] == "link"
    assert kw["raw"] == RAW and kw["filename"] == FILENAME and kw["mime_type"] == "text/markdown"
    # Connection-only provenance is written as a pair or not at all (ingest_splice.py) — never here.
    assert "source_connection_id" not in kw
    assert "ingest_visibility" not in kw

    enq.assert_awaited_once()
    ekw = enq.await_args.kwargs
    assert ekw["active_org"] == str(ORG)
    assert ekw["user_id"] == str(CALLER)
    assert ekw["storage_path"] == mint.return_value.storage_path
    assert ekw["raw"] == RAW

    db.set_expert_install_status.assert_awaited()
    last = db.set_expert_install_status.await_args.kwargs
    assert last["status"] == "installed" and last["error"] is None
    assert last["org_id"] == ORG


async def test_fresh_install_returns_a_result_with_the_derived_state():
    db, supa, mint, enq = _db(claim=_claim()), FakeSupabase(), _mint(), AsyncMock()
    result = await _run(db, supa, mint, enq)
    assert isinstance(result, svc.ExpertInstallResult)
    assert result.expert_bundle_id == BUNDLE_ID
    assert result.corpus_version == "v-test"
    assert result.install.can_install is True


async def test_no_payload_carries_the_retired_seed_user_and_no_document_carries_is_org_shared():
    db, supa, mint, enq = _db(claim=_claim()), FakeSupabase(), _mint(), AsyncMock()
    await _run(db, supa, mint, enq)

    everything = repr(supa.executed) + repr(mint.await_args) + repr(enq.await_args) + repr(
        db.mock_calls
    )
    assert SYSTEM_USER not in everything
    assert "is_org_shared" not in repr(mint.await_args)
    for payload in supa.payloads("documents", "insert") + supa.payloads("documents", "update"):
        assert "is_org_shared" not in payload


# ── refusals ─────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "bundle, corpus_present",
    [
        (_bundle(is_system=False, org_id=uuid4()), True),
        (_bundle(slug="no-such-expert"), False),
    ],
    ids=["org-authored bundle", "system bundle without a shipped corpus"],
)
async def test_a_bundle_that_is_not_installable_is_refused_before_any_write(bundle, corpus_present):
    db, supa, mint, enq = _db(claim=_claim()), FakeSupabase(), _mint(), AsyncMock()
    with pytest.raises(svc.ExpertNotInstallable) as ei:
        await _run(db, supa, mint, enq, bundle=bundle, corpus_present=corpus_present)
    assert ei.value.sentence and "{" not in ei.value.sentence
    db.claim_expert_install.assert_not_awaited()
    db.set_expert_install_status.assert_not_awaited()
    db.set_expert_install_folder.assert_not_awaited()
    mint.assert_not_awaited()
    enq.assert_not_awaited()
    assert supa.executed == []


async def test_a_folder_owned_by_another_admin_is_a_named_refusal_with_a_literal_error():
    other_admins_folder = uuid4()
    db = _db(claim=_claim(folder_id=other_admins_folder))
    supa = FakeSupabase(existing_folder={"id": str(other_admins_folder)})
    mint = AsyncMock(
        side_effect=HTTPException(status_code=403, detail="Cannot upload to a folder you do not own")
    )
    enq = AsyncMock()
    corpus = _corpus([(FILENAME, RAW), ("second.md", b"# two\n")])

    with pytest.raises(svc.ExpertInstallFolderNotOwned) as ei:
        await _run(db, supa, mint, enq, corpus=corpus)

    assert mint.await_count == 1, "nothing further is minted after the owner refusal"
    enq.assert_not_awaited()
    kw = db.set_expert_install_status.await_args.kwargs
    assert kw["status"] == "failed"
    assert kw["error"] == ei.value.sentence
    assert "Cannot upload" not in kw["error"], "the recorded error is our sentence, never the raw detail"


async def test_a_dedup_hit_in_this_install_folder_is_adopted_as_present():
    doc = {"id": str(uuid4()), "org_id": str(ORG), "folder_id": str(NEW_FOLDER), "status": "completed"}
    db, supa, enq = _db(claim=_claim()), FakeSupabase(), AsyncMock()
    mint = _mint(doc, is_duplicate=True)
    await _run(db, supa, mint, enq)
    enq.assert_not_awaited()
    assert db.set_expert_install_status.await_args.kwargs["status"] == "installed"


async def test_a_dedup_hit_pointing_at_another_folder_is_a_named_conflict():
    doc = {"id": str(uuid4()), "org_id": str(ORG), "folder_id": str(uuid4()), "status": "completed"}
    db, supa, enq = _db(claim=_claim()), FakeSupabase(), AsyncMock()
    mint = _mint(doc, is_duplicate=True)
    with pytest.raises(svc.ExpertInstallConflict) as ei:
        await _run(db, supa, mint, enq)
    assert FILENAME in ei.value.sentence
    enq.assert_not_awaited()
    kw = db.set_expert_install_status.await_args.kwargs
    assert kw["status"] == "failed" and kw["error"] == ei.value.sentence


async def test_an_unexpected_failure_records_a_literal_and_re_raises(caplog):
    db, supa, enq = _db(claim=_claim()), FakeSupabase(), AsyncMock()
    secret = "connection to 10.0.0.5:5432 password=hunter2 failed"
    mint = AsyncMock(side_effect=RuntimeError(secret))
    with caplog.at_level(logging.ERROR), pytest.raises(RuntimeError):
        await _run(db, supa, mint, enq)
    kw = db.set_expert_install_status.await_args.kwargs
    assert kw["status"] == "failed"
    assert kw["error"] == "The copy step failed before every document was queued."
    assert "hunter2" not in kw["error"]
    assert "EXPERT_INSTALL_FAILED" in caplog.text
