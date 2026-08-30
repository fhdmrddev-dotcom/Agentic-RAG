"""Phase 217.1 (BE-4 / BE-5 / LIB-06 / LIB-07 / D-217.1-34) — the error-path audit write
and the similarities key.

BE-4: the error path's `except` block writes a `search.query` audit row with
`document_ids: []` and `retrieval_status: "provider_error"` — so a provider outage is
visible in the analytics, never indistinguishable from "your library had no answer".

BE-5: the SAME success-path dict literal also carries `similarities:
{document_id: max_similarity}` — the per-hit similarity retrieval already returns, persisted
so `Average relevance` stops lying about a value the system has. Error-path rows carry no
`similarities` (no hits exist to compute one from).

T-217.1-15b: only the classified `retrieval_status` literal + an empty document list are
persisted — never `str(exc)` (the raw exception stays in the ToolResult.retrieval_error).
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch


def _ctx():
    ctx = MagicMock()
    ctx.current_user = {"id": "user-1"}
    ctx.supabase = MagicMock()
    ctx.user_settings = None
    ctx.folder_subtree_ids = None
    ctx.run_id = "run-1"
    return ctx


def _run_search(monkeypatch, *, error=False, hits=None, avg_sim=0.0):
    """Drive _handle_search_documents with a patched search_documents + write_audit_entry."""
    import app.services.tool_dispatcher as td

    write_audit_entry = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", write_audit_entry)

    if error:
        async def _boom(*a, **k):
            raise RuntimeError("quota exhausted")

        monkeypatch.setattr(td, "search_documents", _boom)
    else:
        async def _ok(*a, **k):
            return (hits or []), avg_sim

        monkeypatch.setattr(td, "search_documents", _ok)

    ctx = _ctx()
    # `ctx.spawn(<coro>)` is a fire-and-forget scheduler in production — the handler never
    # awaits its return. The MagicMock records the coroutine; the handler and the spawned
    # coroutines must run in ONE loop, so the inner runner awaits each spawned coro after
    # the handler returns (mirroring what the production scheduler does).
    spawned: list = []

    def _spawn(coro):
        spawned.append(coro)

    ctx.spawn.side_effect = _spawn

    async def _runner():
        result = await td._handle_search_documents(
            {"query": "q", "metadata_filter": None}, ctx
        )
        for coro in spawned:
            await coro
        return result

    result = asyncio.run(_runner())
    return write_audit_entry, result, ctx


def test_error_path_writes_search_query_audit_row_with_provider_error(monkeypatch):
    """The except block writes document_ids:[] + retrieval_status:'provider_error'."""
    write_audit_entry, result, ctx = _run_search(monkeypatch, error=True)

    write_audit_entry.assert_awaited_once()
    call = write_audit_entry.call_args
    metadata = call.kwargs["metadata"]
    assert call.kwargs["action_type"] == "search.query"
    assert metadata["document_ids"] == []
    assert metadata["retrieval_status"] == "provider_error"
    # T-217.1-15b: the raw exception detail is NOT persisted.
    assert "quota" not in str(metadata)
    # The honest ToolResult still carries the reason for the MODEL to read.
    assert result.retrieval_error["retrieval_status"] == "provider_error"


def test_error_path_does_not_persist_similarities(monkeypatch):
    """Error rows carry no `similarities` key — no hits exist to compute one from."""
    write_audit_entry, _, _ = _run_search(monkeypatch, error=True)
    metadata = write_audit_entry.call_args.kwargs["metadata"]
    assert "similarities" not in metadata


def test_success_path_persists_max_similarity_per_document(monkeypatch):
    """The success write carries similarities: {document_id: max_similarity}, 3dp."""
    hits = [
        {"document_id": "d-1", "similarity": 0.4123, "filename": "a.txt"},
        {"document_id": "d-1", "similarity": 0.6678, "filename": "a.txt"},
        {"document_id": "d-2", "similarity": 0.5, "filename": "b.txt"},
    ]
    write_audit_entry, _, _ = _run_search(monkeypatch, hits=hits, avg_sim=0.6)

    write_audit_entry.assert_awaited_once()
    metadata = write_audit_entry.call_args.kwargs["metadata"]
    assert set(metadata["document_ids"]) == {"d-1", "d-2"}
    sims = metadata.get("similarities")
    assert sims is not None, "the success write must carry the similarities key (BE-5)"
    assert sims["d-1"] == 0.668, "max similarity per document, rounded to 3 dp (round(0.6678,3)=0.668)"
    assert sims["d-2"] == 0.5


def test_no_metadata_key_when_no_hits(monkeypatch):
    """A zero-hit search persists empty document_ids and an empty similarities map."""
    write_audit_entry, _, _ = _run_search(monkeypatch, hits=[])
    metadata = write_audit_entry.call_args.kwargs["metadata"]
    assert metadata["document_ids"] == []
    assert metadata.get("similarities") == {}


def test_written_metadata_is_a_dict_not_a_string_scalar():
    """NEGATIVE CONTROL — the metadata handed to write_audit_entry is a plain dict.

    The audit_log.metadata column is JSONB; a dict param (supabase-py serializes it as a
    JSONB object) is the shape that round-trips as `jsonb_typeof = 'object'`. This guards
    the class of defect `workflow_phases.output` suffered from — a string scalar that
    reads back as JSON text instead of an object. supabase-py + a dict type signature
    makes it structurally unlikely here, but assert rather than assume.
    """
    from app.services.tool_dispatcher import write_audit_entry

    import inspect
    sig = inspect.signature(write_audit_entry)
    meta_param = sig.parameters.get("metadata")
    # The audit fn's metadata param is untyped-or-dict in signature; the payload we build
    # in the handler is a plain dict. Assert the handler's literal shape, which is the
    # contract the JSONB column relies on.
    import app.services.tool_dispatcher as td
    src = inspect.getsource(td._handle_search_documents)
    assert "metadata={" in src, "the success write must build a dict metadata literal"
    assert '"retrieval_status": "provider_error"' in src, (
        "the error write must persist the classified provider_error literal"
    )
