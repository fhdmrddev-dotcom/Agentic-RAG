"""Phase 270 (FIND-05 / P-06 / P-08) — splice_document writes file facts in ONE separate,
best-effort UPDATE. A failing or timed-out facts write never fails an ingest."""

from __future__ import annotations

import io
import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from pypdf import PdfWriter

from app.services.ingest_splice import splice_document

USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = "22222222-2222-2222-2222-222222222221"
FACT_KEYS = {"page_count", "source_created_at", "source_modified_at", "source_author"}
PDF = "application/pdf"


def _pdf_bytes() -> bytes:
    w = PdfWriter()
    for _ in range(2):
        w.add_blank_page(width=100, height=100)
    w.add_metadata({"/Author": "Ada Contract", "/CreationDate": "D:20190312140300Z"})
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def _builder():
    b = MagicMock()
    for m in ("eq", "neq", "is_", "order", "limit", "maybe_single", "single", "select"):
        getattr(b, m).return_value = b
    b.execute.return_value = SimpleNamespace(data=[])
    return b


def _supabase(update_side_effect=None):
    docs = MagicMock()
    docs.select.return_value = _builder()
    docs.insert.return_value = _builder()
    docs.update.return_value = _builder()
    if update_side_effect is not None:
        docs.update.side_effect = update_side_effect
    client = MagicMock()
    client.table.side_effect = lambda name: docs if name == "documents" else MagicMock()
    client._docs = docs
    client.storage.from_.return_value = MagicMock()
    return client


def _fact_updates(client):
    return [c.args[0] for c in client._docs.update.call_args_list if FACT_KEYS & set(c.args[0])]


async def _run(client, **kw):
    extracted = SimpleNamespace(text="body", extractor_name="pypdf")
    args = dict(
        document_id=DOC_ID,
        raw=_pdf_bytes(),
        mime_type=PDF,
        filename="a.pdf",
        user_id=USER_ID,
        storage_path=f"{USER_ID}/{DOC_ID}/a.pdf",
        supabase=client,
    )
    args.update(kw)
    with patch("app.services.extraction_service.extract_composable", return_value=extracted), \
         patch("app.api.documents.ingest_document") as ingest:
        await splice_document(**args)
    return ingest


async def test_facts_are_written_in_one_separate_update():
    client = _supabase()
    ingest = await _run(client)
    updates = _fact_updates(client)
    assert len(updates) == 1
    assert set(updates[0]) == FACT_KEYS  # never merged with status / step keys
    assert updates[0]["page_count"] == 2
    assert updates[0]["source_author"] == "Ada Contract"
    ingest.assert_called_once()


async def test_a_failing_facts_update_does_not_fail_ingest():
    def _upd(payload):
        if FACT_KEYS & set(payload):
            raise RuntimeError("column page_count does not exist")
        return _builder()

    client = _supabase(update_side_effect=_upd)
    ingest = await _run(client)
    ingest.assert_called_once()


async def test_a_facts_timeout_issues_no_update_and_ingest_continues():
    def _slow(raw, mime):
        time.sleep(0.5)

    client = _supabase()
    with patch("app.services.ingest_splice.read_file_facts", _slow), \
         patch("app.services.ingest_splice._FILE_FACTS_TIMEOUT_S", 0.05):
        ingest = await _run(client)
    assert _fact_updates(client) == []
    ingest.assert_called_once()


async def test_empty_bytes_backfill_shape_writes_no_facts():
    client = _supabase()
    await _run(client, raw=b"", storage_path="")
    assert _fact_updates(client) == []


async def test_storage_empty_guard_returns_before_any_facts_update():
    client = _supabase()
    client.storage.from_.return_value.download.return_value = b""
    ingest = await _run(client, raw=None)
    assert _fact_updates(client) == []
    ingest.assert_not_called()
