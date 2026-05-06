"""Phase 066 SC#3: runs.status CHECK admits 'timed_out' + Pydantic Literal mirror.

Tests:
1. test_pydantic_literal_admits_timed_out — pure-Python; no DB required.
2. test_pydantic_literal_rejects_unknown_status — negative case proving Literal narrowness.
3. test_terminal_types_includes_timed_out — module-import assertion.
4. test_namespace_map_routes_timed_out — module-import assertion.

(The DB CHECK constraint is verified live in Plan 01 Task 2 SQL editor smoke
test — no integration test runs against the live DB CHECK because Postgres
DDL acquires ACCESS EXCLUSIVE lock and would conflict with parallel test
execution. The test_062 / test_063_1 pattern of mocking supabase is preserved.)
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE
from app.models.message import MessageResponse


def test_pydantic_literal_admits_timed_out():
    """SC#3: MessageResponse.run_status='timed_out' validates without error."""
    m = MessageResponse(
        id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        role="assistant",
        content="",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        run_status="timed_out",
    )
    assert m.run_status == "timed_out"


def test_pydantic_literal_rejects_unknown_status():
    """Negative: 'foo' is NOT a valid run_status — Literal must reject it."""
    with pytest.raises(ValidationError):
        MessageResponse(
            id=uuid4(),
            thread_id=uuid4(),
            user_id=uuid4(),
            role="assistant",
            content="",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            run_status="foo",  # type: ignore[arg-type]
        )


def test_terminal_types_includes_timed_out():
    """SC#3 + D-066-06: TERMINAL_TYPES set frozen at runtime; 'timed_out' present."""
    assert "timed_out" in TERMINAL_TYPES, (
        f"TERMINAL_TYPES must include 'timed_out' per D-066-06; "
        f"got: {sorted(TERMINAL_TYPES)}"
    )
    # Sanity: legacy types still there
    assert "done" in TERMINAL_TYPES
    assert "error" in TERMINAL_TYPES
    assert "cancelled" in TERMINAL_TYPES


def test_namespace_map_routes_timed_out():
    """D-066-06: 5th row in _RUN_STATUS_TO_TERMINAL_TYPE maps timed_out -> timed_out."""
    assert _RUN_STATUS_TO_TERMINAL_TYPE.get("timed_out") == "timed_out", (
        f"_RUN_STATUS_TO_TERMINAL_TYPE['timed_out'] must equal 'timed_out'; "
        f"got: {_RUN_STATUS_TO_TERMINAL_TYPE}"
    )
    # Sanity: legacy mappings unchanged
    assert _RUN_STATUS_TO_TERMINAL_TYPE["completed"] == "done"
    assert _RUN_STATUS_TO_TERMINAL_TYPE["failed"] == "error"
    assert _RUN_STATUS_TO_TERMINAL_TYPE["cancelled"] == "cancelled"
