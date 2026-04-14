"""Unit tests for audit_service.write_audit_entry."""
import pytest
from unittest.mock import MagicMock

from app.services.audit_service import write_audit_entry, VALID_ACTION_TYPES


def _make_supabase_mock():
    """Create a fresh fluent-chainable Supabase mock for each test."""
    execute_result = MagicMock()
    execute_result.data = []

    builder = MagicMock()
    builder.insert.return_value = builder
    builder.execute.return_value = execute_result

    sb = MagicMock()
    sb.table.return_value = builder

    return sb, builder, execute_result


@pytest.mark.asyncio
async def test_write_audit_entry_inserts_row():
    """Calling write_audit_entry calls table('audit_log').insert(...).execute() exactly once."""
    sb, builder, _ = _make_supabase_mock()

    user_id = "00000000-0000-0000-0000-000000000001"
    action_type = "document.upload"
    metadata = {"filename": "test.pdf"}

    await write_audit_entry(user_id, action_type, metadata, sb)

    sb.table.assert_called_once_with("audit_log")
    builder.insert.assert_called_once_with({
        "user_id": user_id,
        "action_type": action_type,
        "metadata": metadata,
    })
    builder.execute.assert_called_once()


@pytest.mark.asyncio
async def test_write_audit_entry_all_action_types():
    """write_audit_entry correctly passes each of the 8 valid action types to insert."""
    user_id = "00000000-0000-0000-0000-000000000001"
    metadata = {}

    for action_type in VALID_ACTION_TYPES:
        sb, builder, _ = _make_supabase_mock()

        await write_audit_entry(user_id, action_type, metadata, sb)

        call_args = builder.insert.call_args[0][0]
        assert call_args["action_type"] == action_type, (
            f"Expected action_type={action_type!r} but got {call_args['action_type']!r}"
        )


@pytest.mark.asyncio
async def test_write_audit_entry_swallows_exception():
    """When execute() raises an Exception, write_audit_entry swallows it and returns None."""
    sb, builder, _ = _make_supabase_mock()
    builder.execute.side_effect = Exception("DB down")

    user_id = "00000000-0000-0000-0000-000000000001"
    action_type = "search.query"
    metadata = {}

    # Should not raise
    result = await write_audit_entry(user_id, action_type, metadata, sb)
    assert result is None


@pytest.mark.asyncio
async def test_search_query_metadata_shape():
    """A search.query entry with query_text and document_ids metadata is inserted correctly."""
    sb, builder, _ = _make_supabase_mock()

    user_id = "00000000-0000-0000-0000-000000000001"
    action_type = "search.query"
    metadata = {"query_text": "how to deploy", "document_ids": ["doc-1", "doc-2"]}

    await write_audit_entry(user_id, action_type, metadata, sb)

    call_args = builder.insert.call_args[0][0]
    assert call_args["user_id"] == user_id
    assert call_args["action_type"] == "search.query"
    assert call_args["metadata"]["query_text"] == "how to deploy"
    assert call_args["metadata"]["document_ids"] == ["doc-1", "doc-2"]
