"""Phase 285-03 (FIX-14 / BUG-261014-04; D-12, D-13, orchestrator ruling 9) — unit twin.

``/documents/upload`` after the bytes are stored: when the asyncpg ``insert_ingestion_job`` AND the
service-role ``ingestion_jobs`` insert both raise, and the durable worker is the reader
(``ingest_worker_enabled`` true), the document must be marked failed (status ``failed``,
ingestion_step ``failed``, the D-12 message, guarded by ``.eq("status", "pending")``) and the
route answers ``201`` with ``status: failed`` — the BUG-260905-08 storage-fail arm's shape — and
skips the audit task exactly as that arm does (D-13).

Pins that must keep holding: with the worker disabled the BackgroundTask pipeline reads the row,
so no refusal fires; when the asyncpg insert succeeds, no refusal fires; a refusal write that
itself raises never double-faults.
"""
from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.config import settings
from app.services.ingest_splice import MintResult

USER = "00000000-0000-0000-0000-000000000285"
RAW = b"phase 285 enqueue failure"
HASH = hashlib.sha256(RAW).hexdigest()
D12_MESSAGE = "This file could not be queued for reading. Please try uploading it again."


def _doc(doc_id: str) -> dict:
    return {
        "id": doc_id, "user_id": USER, "folder_id": None, "filename": "a.txt",
        "file_path": f"{USER}/{doc_id}/a.txt", "file_size": len(RAW), "mime_type": "text/plain",
        "status": "pending", "error_message": None, "chunk_count": None, "content_hash": HASH,
        "version_number": 1, "is_latest": True, "metadata": None,
        "created_at": "2026-10-16T00:00:00Z", "updated_at": "2026-10-16T00:00:00Z",
    }


class _Service:
    """A service-role client double: storage upload succeeds; ``ingestion_jobs`` insert can be
    made to raise; ``documents`` is a MagicMock chain whose calls the tests read back."""

    def __init__(self, *, jobs_insert_raises: bool, documents_update_raises: bool = False):
        self.storage = MagicMock()
        self.jobs = MagicMock()
        if jobs_insert_raises:
            self.jobs.insert.return_value.execute.side_effect = RuntimeError("sb insert refused")
        self.documents = MagicMock()
        chain = self.documents.update.return_value.eq.return_value.eq.return_value
        if documents_update_raises:
            chain.execute.side_effect = RuntimeError("refusal write refused")
            self.documents.update.return_value.eq.return_value.execute.side_effect = (
                RuntimeError("refusal write refused")
            )

    def table(self, name):
        return {"ingestion_jobs": self.jobs, "documents": self.documents}.get(name, MagicMock())


def _post(service: _Service, *, asyncpg_raises: bool, worker_enabled: bool, monkeypatch):
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
    from app.main import app

    monkeypatch.setattr(settings, "ingest_worker_enabled", worker_enabled)
    doc_id = str(uuid4())
    res = MintResult(document=_doc(doc_id), is_duplicate=False,
                     storage_path=f"{USER}/{doc_id}/a.txt", version_number=1)
    insert = AsyncMock(side_effect=RuntimeError("asyncpg refused")) if asyncpg_raises else AsyncMock()
    audit = MagicMock()
    pipeline = MagicMock()

    app.dependency_overrides[get_current_user] = lambda: {"id": USER, "email": "u@test.local"}
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    app.dependency_overrides[get_supabase] = lambda: service
    try:
        with patch("app.services.ingest_splice.async_mint_document_row", new=AsyncMock(return_value=res)), \
             patch("app.dependencies.get_pg_pool", new=AsyncMock(return_value=MagicMock())), \
             patch("app.db.ingestion_jobs.insert_ingestion_job", new=insert), \
             patch("app.api.documents.write_audit_entry", new=audit), \
             patch("app.api.documents._upload_pipeline", new=pipeline):
            resp = TestClient(app).post(
                "/documents/upload", files={"file": ("a.txt", RAW, "text/plain")},
            )
    finally:
        app.dependency_overrides.clear()
    return doc_id, resp, audit, pipeline


def _refusal_payloads(service: _Service) -> list[dict]:
    return [c.args[0] for c in service.documents.update.call_args_list]


def test_both_enqueue_paths_fail_marks_the_document_failed(monkeypatch):
    service = _Service(jobs_insert_raises=True)
    doc_id, resp, audit, _pipeline = _post(
        service, asyncpg_raises=True, worker_enabled=True, monkeypatch=monkeypatch,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["id"] == doc_id
    assert resp.json()["status"] == "failed", resp.json()
    assert _refusal_payloads(service) == [{
        "status": "failed", "ingestion_step": "failed", "error_message": D12_MESSAGE,
    }]
    first_eq = service.documents.update.return_value.eq
    first_eq.assert_called_once_with("id", doc_id)
    first_eq.return_value.eq.assert_called_once_with("status", "pending")
    first_eq.return_value.eq.return_value.execute.assert_called_once()
    audit.assert_not_called()


def test_the_refusal_write_raising_does_not_double_fault(monkeypatch):
    service = _Service(jobs_insert_raises=True, documents_update_raises=True)
    doc_id, resp, audit, _pipeline = _post(
        service, asyncpg_raises=True, worker_enabled=True, monkeypatch=monkeypatch,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["id"] == doc_id
    assert resp.json()["status"] == "failed"
    audit.assert_not_called()


def test_worker_disabled_never_refuses_the_background_task_reads_the_row(monkeypatch):
    """Orchestrator ruling 9: with ``ingest_worker_enabled`` false the BackgroundTask ingests the
    row, so a failed ``ingestion_jobs`` insert must NOT mark it failed."""
    service = _Service(jobs_insert_raises=True)
    doc_id, resp, audit, pipeline = _post(
        service, asyncpg_raises=True, worker_enabled=False, monkeypatch=monkeypatch,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "pending"
    assert _refusal_payloads(service) == []
    pipeline.assert_called_once()
    audit.assert_called_once()


def test_asyncpg_enqueue_succeeds_no_refusal(monkeypatch):
    service = _Service(jobs_insert_raises=True)  # never reached
    doc_id, resp, audit, _pipeline = _post(
        service, asyncpg_raises=False, worker_enabled=True, monkeypatch=monkeypatch,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "pending"
    assert _refusal_payloads(service) == []
    service.jobs.insert.assert_not_called()
    audit.assert_called_once()


def test_service_role_fallback_succeeds_no_refusal(monkeypatch):
    service = _Service(jobs_insert_raises=False)
    doc_id, resp, audit, _pipeline = _post(
        service, asyncpg_raises=True, worker_enabled=True, monkeypatch=monkeypatch,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "pending"
    assert _refusal_payloads(service) == []
    service.jobs.insert.assert_called_once()
    audit.assert_called_once()


@pytest.mark.parametrize("marker", ["could not be queued for reading"])
def test_the_d12_message_lives_once_in_the_route(marker):
    import pathlib

    src = (pathlib.Path(__file__).resolve().parents[2] / "app" / "api" / "documents.py").read_text(
        encoding="utf-8"
    )
    assert src.count(marker) == 1
