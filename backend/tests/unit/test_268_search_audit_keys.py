"""Phase 268 (D-268-13) — every ``search.query`` audit row can be joined to the run that made it.

SC#3 asks that the next turn's retrieval be "verified against the run's retrieved-chunk records". No
such table exists; the fix is additive metadata on the audit row both arms of
``_handle_search_documents`` already write: ``run_id``, ``thread_id``, ``parent_run_id`` (a sub-agent's
search joins to its ROOT run) and ``folder_ids`` (the scope actually handed to retrieval — evidence
independent of the result set). ``query_text`` / ``document_ids`` / ``similarities`` are unchanged and
``retrieval_service.py`` is not touched (D-268-14).

The driver is the RAG-09 / 217.1 ``ctx.spawn`` stub shape (``tests/test_2171_search_error_audit.py``).
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID

RUN = UUID("a1000000-0000-4000-8000-0000000000a1")
PARENT = UUID("a2000000-0000-4000-8000-0000000000a2")
THREAD = "7d000000-0000-4000-8000-000000000001"
FOLDERS = ["f3000000-0000-4000-8000-000000000003", "f4000000-0000-4000-8000-000000000004"]


def _ctx(*, parent=None, folders=FOLDERS):
    spawned: list = []
    ctx = SimpleNamespace(
        current_user={"id": "user-1"},
        supabase=object(),
        user_settings=None,
        folder_subtree_ids=folders,
        run_id=RUN,
        thread_id=THREAD,
        parent_run_id=parent,
        spawn=spawned.append,
        has_connection_retrieval=False,
    )
    return ctx, spawned


def _run(monkeypatch, *, error=False, hits=None, parent=None, folders=FOLDERS):
    import app.services.tool_dispatcher as td

    write = AsyncMock()
    monkeypatch.setattr("app.services.search_documents_tool.write_audit_entry", write)
    if error:
        async def _boom(*a, **k):
            raise RuntimeError("quota exhausted")

        monkeypatch.setattr("app.services.search_documents_tool.search_documents", _boom)
        monkeypatch.setattr(
            "app.services.openai_service.resolve_effective_embedding_provider", lambda s: "openai"
        )
    else:
        async def _ok(*a, **k):
            return (hits or []), 0.5

        monkeypatch.setattr("app.services.search_documents_tool.search_documents", _ok)

    ctx, spawned = _ctx(parent=parent, folders=folders)

    async def _runner():
        await td._handle_search_documents({"query": "q", "metadata_filter": None}, ctx)
        for coro in spawned:
            await coro

    asyncio.run(_runner())
    write.assert_awaited_once()
    return write.call_args.kwargs["metadata"]


HITS = [{"document_id": "d-1", "similarity": 0.61, "filename": "a.txt", "folder_id": FOLDERS[0]}]


def test_the_success_row_carries_the_run_join_keys(monkeypatch):
    meta = _run(monkeypatch, hits=HITS)
    assert meta["run_id"] == str(RUN)
    assert meta["thread_id"] == THREAD
    assert meta["parent_run_id"] is None
    assert meta["folder_ids"] == FOLDERS
    # the existing keys are unchanged
    assert meta["query_text"] == "q"
    assert meta["document_ids"] == ["d-1"]
    assert meta["similarities"] == {"d-1": 0.61}


def test_the_provider_error_row_carries_the_run_join_keys(monkeypatch):
    meta = _run(monkeypatch, error=True)
    assert meta["run_id"] == str(RUN)
    assert meta["thread_id"] == THREAD
    assert meta["folder_ids"] == FOLDERS
    assert meta["document_ids"] == [] and meta["retrieval_status"] == "provider_error"
    assert "similarities" not in meta


def test_a_sub_agents_search_joins_to_its_root_run(monkeypatch):
    meta = _run(monkeypatch, hits=HITS, parent=PARENT)
    assert meta["parent_run_id"] == str(PARENT)


def test_an_unscoped_run_records_an_empty_folder_list(monkeypatch):
    meta = _run(monkeypatch, hits=HITS, folders=None)
    assert meta["folder_ids"] == []


def test_both_arms_carry_the_literal_run_key():
    """Re-driven by 272-04 (D-12): the run join keys now live in ONE writer every arm uses.

    This used to count the literal ``"run_id": str(ctx.run_id)`` in the handler == 2 — one per
    hand-written audit write (success + provider error). 272-04 CENTRALISED the write into
    ``search_documents_tool._write_search_audit`` (the four result kinds + the lock refusal would
    otherwise need six copies), so the honest assertion is now: exactly ONE write site, it carries
    the run key, the handler writes nothing itself, and both arms above still produce the key
    (``test_the_success_row_…`` / ``test_the_provider_error_row_…`` drive them).
    """
    import inspect

    import app.services.search_documents_tool as sdt
    import app.services.tool_dispatcher as td

    module_code = [
        ln for ln in inspect.getsource(sdt).splitlines() if not ln.lstrip().startswith("#")
    ]
    assert sum("write_audit_entry(" in ln for ln in module_code) == 1
    writer = inspect.getsource(sdt._write_search_audit)
    assert writer.count('"run_id": str(ctx.run_id)') == 1
    assert "write_audit_entry(" in writer
    assert "write_audit_entry(" not in inspect.getsource(td._handle_search_documents)
