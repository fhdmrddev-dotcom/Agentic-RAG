"""Phase 073 unit tests - app.db.runs typed SQL helpers (D-073-05).

Drives the three helpers (insert_run / finalize_run / insert_assistant_message)
against a _build_mock_pg_pool() AsyncMock pool. Asserts:
  - SQL string contains the expected operation + table
  - Positional args tuple is in exact order matching the helper signature
  - NULL values pass through unchanged (D-073-09)
  - Return value of insert_assistant_message matches pool.fetchval.return_value

SQL injection coverage (T-073-02) is handled at the app/db/runs.py level via
grep acceptance criteria; this test asserts the parameter-binding contract
holds - no string interpolation occurs in the helpers.
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.db.runs import insert_run, finalize_run, insert_assistant_message
from tests.integration._run_helpers import _build_mock_pg_pool


# ────────────────────────────────────────────────────────────────────────────
# insert_run
# ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insert_run_passes_args_positionally():
    pool = _build_mock_pg_pool()
    run_id, thread_id, user_id = uuid4(), uuid4(), uuid4()

    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="claude-opus-4-7",
        provider="anthropic",
    )

    assert pool.execute.await_count == 1
    sql, *args = pool.execute.call_args[0]
    assert "INSERT INTO runs" in sql
    assert args == [run_id, thread_id, user_id, "streaming", "claude-opus-4-7", "anthropic"]


@pytest.mark.asyncio
async def test_insert_run_uses_positional_placeholders():
    """T-073-02: SQL must contain $1..$6 placeholders, not literal values."""
    pool = _build_mock_pg_pool()
    await insert_run(
        pool,
        run_id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        status="streaming",
        model="gpt-4o",
        provider="openai",
    )
    sql, *_ = pool.execute.call_args[0]
    for placeholder in ("$1", "$2", "$3", "$4", "$5", "$6"):
        assert placeholder in sql, f"missing placeholder {placeholder} in SQL: {sql!r}"


# ────────────────────────────────────────────────────────────────────────────
# finalize_run
# ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_finalize_run_passes_args_positionally():
    pool = _build_mock_pg_pool()
    run_id = uuid4()
    msg_id = uuid4()
    completed_at = datetime.now(timezone.utc)

    await finalize_run(
        pool,
        run_id=run_id,
        status="completed",
        error=None,
        completed_at=completed_at,
        message_id=msg_id,
        input_tokens=120,
        output_tokens=45,
    )

    assert pool.execute.await_count == 1
    sql, *args = pool.execute.call_args[0]
    assert "UPDATE runs" in sql
    assert args == [run_id, "completed", None, completed_at, msg_id, 120, 45]


@pytest.mark.asyncio
async def test_finalize_run_null_tokens_passthrough():
    """D-073-09: NULL is the type-safe sentinel when SDK doesn't surface usage."""
    pool = _build_mock_pg_pool()
    run_id = uuid4()
    completed_at = datetime.now(timezone.utc)

    await finalize_run(
        pool,
        run_id=run_id,
        status="completed",
        error=None,
        completed_at=completed_at,
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )

    sql, *args = pool.execute.call_args[0]
    # Positions 5 and 6 (0-indexed) should be None - D-073-09 NULL sentinel
    assert args[5] is None  # input_tokens
    assert args[6] is None  # output_tokens
    assert args[4] is None  # message_id (also NULL when no assistant msg persisted)
    assert args[2] is None  # error TEXT column is None on happy-path completion


@pytest.mark.asyncio
async def test_finalize_run_error_text_passthrough():
    """Q2: error column is TEXT (not JSONB) - string passes through unchanged."""
    pool = _build_mock_pg_pool()
    await finalize_run(
        pool,
        run_id=uuid4(),
        status="timed_out",
        error="timed_out after 120s",
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )
    _, *args = pool.execute.call_args[0]
    assert args[2] == "timed_out after 120s"


# ────────────────────────────────────────────────────────────────────────────
# insert_assistant_message
# ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insert_assistant_message_returns_uuid():
    pool = _build_mock_pg_pool()
    expected_id = uuid4()
    pool.fetchval.return_value = expected_id

    result = await insert_assistant_message(
        pool,
        thread_id=uuid4(),
        user_id=uuid4(),
        content="hello world",
    )

    assert result == expected_id
    assert pool.fetchval.await_count == 1


@pytest.mark.asyncio
async def test_insert_assistant_message_sql_shape():
    pool = _build_mock_pg_pool()
    await insert_assistant_message(
        pool,
        thread_id=uuid4(),
        user_id=uuid4(),
        content="hi",
        tool_calls=[{"name": "search", "args": {}}],
        source_refs=[{"id": "doc-1"}],
        confidence_level="high",
        confidence_avg_similarity=0.92,
        confidence_disclaimer="grounded",
    )
    sql, *args = pool.fetchval.call_args[0]
    assert "INSERT INTO messages" in sql
    assert "RETURNING id" in sql
    # Role 'assistant' is hardcoded in SQL - should NOT be in args
    assert "'assistant'" in sql
    # All 8 expected positional args present in the correct positions
    assert len(args) == 8
    assert args[2] == "hi"  # content
    assert args[3] == [{"name": "search", "args": {}}]  # tool_calls (plain list - JSONB codec handles encoding)
    assert args[4] == [{"id": "doc-1"}]  # source_refs


@pytest.mark.asyncio
async def test_insert_assistant_message_optional_fields_none():
    """Optional fields default to None - args list still has 8 positions."""
    pool = _build_mock_pg_pool()
    await insert_assistant_message(
        pool,
        thread_id=uuid4(),
        user_id=uuid4(),
        content="minimal",
    )
    _, *args = pool.fetchval.call_args[0]
    assert len(args) == 8
    assert args[3] is None  # tool_calls
    assert args[4] is None  # source_refs
    assert args[5] is None  # confidence_level
    assert args[6] is None  # confidence_avg_similarity
    assert args[7] is None  # confidence_disclaimer
