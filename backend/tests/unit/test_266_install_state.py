"""Phase 266 plan 03 — derived install state, the list/get overlay, install summaries (D-266-03/09/15).

⛔ Readiness has ONE source of truth: the corpus documents' own status, written by the ingest
worker. The install row only records the copy step. These tests pin the derivation as a table,
then pin the overlay that hands it to every Expert surface:

  - a list with NO first-party row costs ZERO extra queries;
  - otherwise exactly one install read and at most one document read for the whole list;
  - ``knowledge_folder_ids`` of a first-party row is REPLACED — the org's install folder or
    nothing — so the five surfaces that count folders become truthful without an edit, and a
    stale global seed id (…0260) can never survive;
  - org-authored rows come back byte-identical, with no ``install`` key.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services import expert_install_service as svc
from app.services.expert_corpus import CorpusFile, ExpertCorpus

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)
FOLDER = uuid4()
F1 = "acme_q3_2026_financial_report.md"
F2 = "acme_notes.md"
SEED_FOLDER = UUID("00000000-0000-0000-0000-000000000260")


def _install(status: str = "installed", *, folder: UUID | None = FOLDER, exists: bool = True,
             age: timedelta = timedelta(minutes=1), error: str | None = None) -> dict:
    return {
        "folder_id": folder,
        "folder_exists": exists,
        "status": status,
        "error": error,
        "updated_at": NOW - age,
    }


def _doc(filename: str = F1, status: str = "completed", chunks: int = 3, error: str | None = None) -> dict:
    return {"filename": filename, "status": status, "chunk_count": chunks, "error_message": error,
            "folder_id": FOLDER}


def _derive(install, docs, *, can_install=True, filenames=(F1,)):
    return svc.derive_install_state(install, docs, filenames=list(filenames), can_install=can_install, now=NOW)


# ── derive_install_state ─────────────────────────────────────────────────────────────────────


def test_no_install_row_is_not_installed():
    s = _derive(None, [])
    assert (s.state, s.folder_id, s.cause, s.can_install) == ("not_installed", None, None, True)


@pytest.mark.parametrize("folder, exists", [(None, False), (FOLDER, False)], ids=["no folder id", "folder deleted"])
def test_an_installed_row_whose_folder_is_gone_is_not_installed(folder, exists):
    s = _derive(_install(folder=folder, exists=exists), [_doc()])
    assert s.state == "not_installed" and s.folder_id is None


def test_a_fresh_installing_claim_is_installing():
    s = _derive(_install("installing", age=timedelta(minutes=2)), [])
    assert s.state == "installing" and s.folder_id == FOLDER


def test_a_stale_installing_claim_with_nothing_in_flight_is_failed_with_a_retry_sentence():
    s = _derive(_install("installing", age=timedelta(minutes=11)), [_doc()])
    assert s.state == "failed"
    assert s.cause_source == "install"
    assert s.cause == "The install did not finish. Retry to continue it."


def test_a_stale_installing_claim_with_a_document_in_flight_is_still_installing():
    s = _derive(_install("installing", age=timedelta(minutes=30)), [_doc(status="processing")])
    assert s.state == "installing"


def test_a_failed_copy_step_is_failed_with_the_recorded_sentence():
    s = _derive(_install("failed", error="The copy step failed before every document was queued."), [_doc()])
    assert s.state == "failed" and s.cause_source == "install"
    assert s.cause == "The copy step failed before every document was queued."


def test_a_failed_copy_step_before_the_folder_existed_still_reports_the_failure():
    # Refinement over "no folder → not_installed": a copy that died before the folder was made is
    # a FAILURE with a cause, never a silent "not installed" (D-266-03 names the cause).
    s = _derive(_install("failed", folder=None, exists=False, error="The copy step failed before every document was queued."), [])
    assert s.state == "failed" and s.folder_id is None and s.cause_source == "install"


def test_a_failed_document_is_failed_with_the_documents_own_cause():
    s = _derive(_install(), [_doc(status="failed", error="Could not extract text")])
    assert (s.state, s.cause, s.cause_source) == ("failed", "Could not extract text", "document")


@pytest.mark.parametrize("status", ["pending", "processing", "embedding"])
def test_a_document_still_in_flight_is_installing(status):
    assert _derive(_install(), [_doc(status=status)]).state == "installing"


def test_no_present_corpus_document_is_not_installed():
    # A same-folder document that is NOT a corpus file does not count as the corpus.
    s = _derive(_install(), [_doc(filename="someone_elses.pdf")])
    assert s.state == "not_installed"


def test_every_present_document_completed_with_chunks_is_ready():
    s = _derive(_install(), [_doc(F1), _doc(F2)], filenames=(F1, F2))
    assert (s.state, s.folder_id, s.cause) == ("ready", FOLDER, None)


def test_a_completed_document_with_no_chunks_is_failed():
    s = _derive(_install(), [_doc(chunks=0)])
    assert s.state == "failed" and s.cause_source == "install"
    assert s.cause == "A document finished with no searchable text."


def test_can_install_and_updated_at_pass_through():
    s = _derive(_install(), [_doc()], can_install=False)
    assert s.can_install is False
    assert s.updated_at == NOW - timedelta(minutes=1)


# ── overlay_install_state ────────────────────────────────────────────────────────────────────


def _corpus(slug: str, names: list[str]) -> ExpertCorpus:
    return ExpertCorpus(
        slug=slug,
        folder_name="F",
        files=[CorpusFile(filename=n, mime_type="text/markdown", raw=b"x", sha256=hashlib.sha256(b"x").hexdigest())
               for n in names],
        corpus_version="v",
    )


def _pool() -> MagicMock:
    pool = MagicMock()
    pool.fetch = AsyncMock(return_value=[])
    pool.fetchrow = AsyncMock(return_value=None)
    return pool


def _db(installs: list[dict], docs: list[dict]) -> MagicMock:
    db = MagicMock()
    db.list_expert_installs_for_org = AsyncMock(return_value=installs)
    db.list_install_corpus_documents = AsyncMock(return_value=docs)
    db.get_expert_install = AsyncMock(return_value=None)
    return db


async def test_a_list_with_no_first_party_row_costs_zero_queries():
    pool, db = _pool(), _db([], [])
    rows = [{"id": uuid4(), "is_system": False, "slug": "a", "knowledge_folder_ids": [uuid4()]}]
    with patch.object(svc, "experts_db", db):
        out = await svc.overlay_install_state(pool, rows, org_id=uuid4(), can_install=True)
    assert out == rows
    assert "install" not in out[0]
    assert pool.fetch.await_count == 0 and pool.fetchrow.await_count == 0
    assert db.list_expert_installs_for_org.await_count == 0
    assert db.list_install_corpus_documents.await_count == 0


async def test_the_overlay_tells_every_row_its_orgs_install_state():
    org = uuid4()
    installed, uninstalled, no_corpus = uuid4(), uuid4(), uuid4()
    authored_folder = uuid4()
    rows = [
        {"id": installed, "is_system": True, "slug": "financial-analyzer", "knowledge_folder_ids": [SEED_FOLDER]},
        {"id": uninstalled, "is_system": True, "slug": "legal-reviewer", "knowledge_folder_ids": [SEED_FOLDER]},
        {"id": no_corpus, "is_system": True, "slug": "no-corpus", "knowledge_folder_ids": [SEED_FOLDER]},
        {"id": uuid4(), "is_system": False, "slug": "house", "knowledge_folder_ids": [authored_folder]},
    ]
    snapshot = [dict(r) for r in rows]
    installs = [{"expert_bundle_id": installed, **_install(), "expert_name": "Financial Analyzer",
                 "expert_slug": "financial-analyzer"}]
    docs = [_doc(F1)]
    db = _db(installs, docs)
    corpora = {"financial-analyzer": _corpus("financial-analyzer", [F1]), "legal-reviewer": _corpus("legal-reviewer", [F2])}
    load = MagicMock(side_effect=lambda slug: corpora[slug])

    with patch.object(svc, "experts_db", db), patch.object(
        svc, "has_corpus", side_effect=lambda slug: slug in corpora
    ), patch.object(svc, "load_corpus", load):
        out = await svc.overlay_install_state(_pool(), rows + [dict(rows[0])], org_id=org, can_install=True)

    assert db.list_expert_installs_for_org.await_count == 1
    assert db.list_expert_installs_for_org.await_args.kwargs["org_id"] == org
    assert db.list_install_corpus_documents.await_count <= 1
    assert load.call_count == 2, "the manifest is read once per DISTINCT slug per call"

    a, b, c, d, a2 = out
    assert a["install"]["state"] == "ready"
    assert a["install"]["can_install"] is True
    assert a["knowledge_folder_ids"] == [FOLDER]
    assert SEED_FOLDER not in a["knowledge_folder_ids"]
    assert a2["knowledge_folder_ids"] == [FOLDER]

    assert b["install"]["state"] == "not_installed"
    assert b["knowledge_folder_ids"] == []

    assert c["install"] is None
    assert c["knowledge_folder_ids"] == []

    assert d == snapshot[3] and "install" not in d
    assert rows == snapshot, "the overlay copies each row; the input is never mutated"


async def test_a_failed_install_keeps_its_folder_so_its_knowledge_stays_countable():
    org, bundle = uuid4(), uuid4()
    rows = [{"id": bundle, "is_system": True, "slug": "financial-analyzer", "knowledge_folder_ids": []}]
    installs = [{"expert_bundle_id": bundle, **_install(), "expert_name": "FA", "expert_slug": "financial-analyzer"}]
    db = _db(installs, [_doc(status="failed", error="boom")])
    with patch.object(svc, "experts_db", db), patch.object(svc, "has_corpus", return_value=True), patch.object(
        svc, "load_corpus", return_value=_corpus("financial-analyzer", [F1])
    ):
        (row,) = await svc.overlay_install_state(_pool(), rows, org_id=org, can_install=False)
    assert row["install"]["state"] == "failed"
    assert row["install"]["can_install"] is False
    assert row["knowledge_folder_ids"] == [FOLDER]


# ── list_install_summaries ───────────────────────────────────────────────────────────────────


async def test_summaries_list_only_installs_whose_folder_exists():
    org, kept, gone = uuid4(), uuid4(), uuid4()
    installs = [
        {"expert_bundle_id": kept, **_install(), "expert_name": "Financial Analyzer", "expert_slug": "financial-analyzer"},
        {"expert_bundle_id": gone, **_install(folder=None, exists=False), "expert_name": "Gone", "expert_slug": "gone"},
    ]
    db = _db(installs, [_doc(F1)])
    with patch.object(svc, "experts_db", db), patch.object(svc, "has_corpus", return_value=True), patch.object(
        svc, "load_corpus", return_value=_corpus("financial-analyzer", [F1])
    ):
        out = await svc.list_install_summaries(_pool(), org_id=org)

    assert db.list_expert_installs_for_org.await_args.kwargs["org_id"] == org
    assert len(out) == 1
    s = out[0]
    assert isinstance(s, svc.ExpertInstallSummary)
    assert (s.expert_bundle_id, s.expert_name, s.folder_id, s.state) == (kept, "Financial Analyzer", FOLDER, "ready")
