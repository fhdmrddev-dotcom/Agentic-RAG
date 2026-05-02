"""Shared 061 test helpers — extracted to avoid relative cross-test imports.

Imported by test_061_producer_survives_disconnect.py, test_061_ttl.py,
test_061_runs_table.py, test_061_hard_timeout.py, and the rewritten
test_059_disconnect.py via absolute path:

    from tests.integration._run_helpers import _extract_run_id_from_mock

Absolute imports match the established 058/059 cross-import convention;
relative imports across sibling test files are inconsistent with the
rest of the suite and break collect-time module resolution under pytest.
"""
from typing import Any


def _extract_run_id_from_mock(mock_supabase: Any) -> str:
    """Inspect mock_supabase.table('runs').insert.call_args_list[0] for the run_id.

    Phase 061 producer (threads.py:610) calls
        supabase.table("runs").insert({"run_id": str(run_id), "thread_id": ..., ...})
    Plan 05 Step 0a extended _build_mock_supabase to route the 'runs' table
    through a per-table builder, so the insert call lands in call_args_list
    with the payload as args[0].
    """
    runs_builder = mock_supabase.table("runs")
    insert_calls = runs_builder.insert.call_args_list
    assert insert_calls, "Expected at least one runs INSERT call (D-061-11 lifecycle)"
    first_args = insert_calls[0]
    # call_args is (args, kwargs) — payload is args[0]; supabase-py also
    # accepts the kwarg form as a fallback shape.
    payload = first_args.args[0] if first_args.args else first_args.kwargs.get("data")
    assert isinstance(payload, dict) and "run_id" in payload, (
        f"Expected runs INSERT payload with 'run_id'; got {payload!r}"
    )
    return payload["run_id"]
