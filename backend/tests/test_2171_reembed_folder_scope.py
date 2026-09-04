"""Phase 217.1 (BE-3 / D-217.1-27) — the folder scope on the re-embed path.

`folder_ids` on `POST /settings/reembed` narrows the worker's stale predicate ANDed (never
replacing it). The three response cases must be distinguishable:

  * unscoped default      — no `scope` marker (a real re-index is never a silent no-op);
  * already-current       — docs exist in the scope, none stale → `scope: "already_current"`;
  * folder-empty          — the selected folders have no docs at all → `scope: "folder_empty"`.

`reembed_job` takes the TOP-LEVEL supabase client (`.table(...)` → builder). The conftest
exposes `mock_builder` (the builder) and `mock_execute_result` (the shared result whose
`.data` every `.execute()` returns); this suite wires a top-level client mock to that
builder. Shape follows `test_knowledge_health.py:213-223`.
"""
import asyncio
from unittest.mock import MagicMock

from app.services.reembed_service import reembed_job


def _supabase_for(builder) -> MagicMock:
    """A top-level supabase client whose `.table(...)` returns the shared builder."""
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder
    return sb


class _FakeSettings:
    """Minimal duck-type of UserEffectiveSettings the job reads: the current model + dims."""
    embedding_model = "text-embedding-3-small"
    embedding_dimensions = 1536
    active_provider = "openai"


class _DummyData:
    """A result whose `.data` is a given list (the execute().data contract).

    `.count` is the PostgREST exact-count (used by reembed_progress's denominator); a
    MagicMock there would break the `remaining > 0` comparison.
    """
    def __init__(self, data, count=0):
        self.data = data
        self.count = count


def _mock_rows(*docs):
    """A list of {id}-shaped dicts for a builder's `.data` to return."""
    return [{"id": d} for d in docs]


def _run(job_coro):
    """Run an async coroutine to completion on a fresh event loop."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(job_coro)
    finally:
        loop.close()


def _run_job(builder, *, folder_ids=None):
    """Drive reembed_job once against the shared builder mock. Returns the result dict."""
    return _run(
        reembed_job(
            _supabase_for(builder), "user-1", _FakeSettings(), dims_changed=False,
            max_batches=1, batch_size=1, folder_ids=folder_ids,
        )
    )


# ── Task 2 regression guards ───────────────────────────────────────────────────────────

def test_unscoped_default_selects_no_in_clause(mock_builder, mock_execute_result):
    """folder_ids=None (the default) adds NO `.in_` scope — byte-identical to pre-217.1."""
    mock_execute_result.data = []
    mock_execute_result.count = 0
    _run_job(mock_builder, folder_ids=None)
    assert mock_builder.in_.call_args_list == [], (
        "unscoped reembed must not add an .in_ clause — folder_ids=None keeps the query "
        "byte-identical to pre-217.1"
    )


def test_folder_scope_ands_in_clause_onto_stale_predicate(mock_builder, mock_execute_result):
    """A folder scope adds `.in_("document_id", ids)` ANDed onto the `.or_(...)` clause."""
    # documents lookup returns one doc → scope resolves non-empty → the batch .in_ fires.
    # 6 execute calls: org_id resolve (×2) → scope resolve → stale batch
    # → progress total → progress done.
    mock_builder.execute.side_effect = [
        _DummyData([]),                 # reembed_job org_id resolve
        _DummyData(_mock_rows("d-1")),  # documents .select("id").in_("folder_id", [...]).execute()
        _DummyData([], count=0),        # stale-chunk batch (empty → break)
        _DummyData([]),                 # reembed_progress org_id resolve
        _DummyData([], count=0),        # progress total count
        _DummyData([], count=0),        # progress done count
    ]
    _run_job(mock_builder, folder_ids=["f1"])
    # The .in_ clause exists and targets document_id.
    in_args = [c[0] for c in mock_builder.in_.call_args_list if c[0]]
    assert in_args, "no .in_ call captured"
    assert any(args[0] == "document_id" for args in in_args), (
        "folder scope must .in_(\"document_id\", ids) — the ANDed predicate, not a folder_id filter"
    )
    # The stale or_ clause is still present (ANDed, never replaced).
    or_calls = mock_builder.or_.call_args_list
    assert or_calls, "the stale model-mismatch .or_ clause must survive a folder scope"
    mock_builder.execute.side_effect = None


def test_folder_scope_with_no_documents_is_folder_empty(mock_builder, mock_execute_result):
    """A folder scope resolving to zero documents marks `folder_empty`, never silent success."""
    # 6 execute calls: org_id resolve (×2) → scope resolve → stale batch
    # → progress total → progress done. All empty.
    mock_builder.execute.side_effect = [
        _DummyData([]),  # reembed_job org_id resolve
        _DummyData([]),  # documents .select("id").in_("folder_id", [...]).execute()
        _DummyData([]),  # stale-chunk batch (first pass, empty → break)
        _DummyData([]),  # reembed_progress org_id resolve
        _DummyData([], count=0),  # progress total count
        _DummyData([], count=0),  # progress done count
    ]
    result = _run_job(mock_builder, folder_ids=["empty-folder"])
    assert result.get("scope") == "folder_empty", (
        "a folder scope with zero documents must be distinguishable as folder_empty — "
        "not reported as an ordinary re-index"
    )
    mock_builder.execute.side_effect = None


def test_folder_scope_with_current_chunks_is_already_current(mock_builder, mock_execute_result):
    """A folder whose docs exist but chunks are all current marks `already_current`."""
    # 6 execute calls: org_id resolve (×2) → scope resolve → stale batch
    # → progress total → progress done.
    mock_builder.execute.side_effect = [
        _DummyData([]),                 # reembed_job org_id resolve
        _DummyData(_mock_rows("d-1")),  # documents (scope resolves to one doc)
        _DummyData([]),                 # stale batch (empty → already_current)
        _DummyData([]),                 # reembed_progress org_id resolve
        _DummyData([], count=0),        # progress total count
        _DummyData([], count=0),        # progress done count
    ]
    result = _run_job(mock_builder, folder_ids=["f1"])
    assert result.get("scope") == "already_current", (
        "a folder whose chunks are all current must be distinguishable as already_current — "
        "Plan 10 renders 'Already indexed with the current model.' from this marker"
    )
    mock_builder.execute.side_effect = None
