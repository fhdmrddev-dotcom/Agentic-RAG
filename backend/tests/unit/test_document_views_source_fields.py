"""Phase 237 (RULES-02 / SC#2) — source facts in filter compiler and resolver.

Verifies:
1. `_build_field_meta` adds source facts (source_system, source_connection_id, path,
   file_path, ingest_visibility, source_state) to the filterable whitelist.
2. `compile_filter` produces correct typed and custom fragments for source facts with
   case-normalization where appropriate.
3. SC#2 seam closure: typed columns not in PROMOTED_TYPED_COLUMNS and custom fields
   not in whitelist are rejected with ResolveError.
4. Resolver `_apply` generates correct selectors (`metadata->source->>system`,
   `file_path`, `source_connection_id`).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.document_view import ViewCondition, ViewFilter
from app.services import document_view_resolver, view_filter_compiler
from app.services.document_view_resolver import ResolveError, _build_field_meta, resolve_filter


USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_build_field_meta_includes_source_facts():
    supabase = MagicMock()
    with patch(
        "app.services.metadata_field_service.list_field_definitions",
        new_callable=AsyncMock,
    ) as mock_list_defs:
        mock_list_defs.return_value = []
        whitelist, number_fields = await _build_field_meta(USER_ID, supabase)

        for field in (
            "source_system",
            "source_connection_id",
            "path",
            "file_path",
            "ingest_visibility",
            "source_state",
        ):
            assert field in whitelist, f"{field} must be in filterable whitelist"


def test_compile_filter_source_connection_id_typed():
    conn_id = str(uuid4())
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="source_connection_id", op="eq", value=conn_id)],
    )
    frags = view_filter_compiler.compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "typed"
    assert frags[0].field == "source_connection_id"
    assert frags[0].builder == "eq"
    assert frags[0].value == conn_id


def test_compile_filter_source_connection_id_is_empty():
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="source_connection_id", op="is_empty")],
    )
    frags = view_filter_compiler.compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "typed"
    assert frags[0].field == "source_connection_id"
    assert frags[0].builder == "is_empty"


def test_compile_filter_ingest_visibility_lowered():
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="ingest_visibility", op="eq", value="ORG")],
    )
    frags = view_filter_compiler.compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "typed"
    assert frags[0].field == "ingest_visibility"
    assert frags[0].builder == "eq"
    assert frags[0].value == "org"


def test_compile_filter_source_system_custom_lowered():
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="source_system", op="eq", value="Google_Drive")],
    )
    frags = view_filter_compiler.compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "custom"
    assert frags[0].field == "source_system"
    assert frags[0].builder == "eq"
    assert frags[0].value == "google_drive"


def test_compile_filter_path_typed_file_path():
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="path", op="contains", value="Invoices")],
    )
    frags = view_filter_compiler.compile_filter(flt)
    assert len(frags) == 1
    assert frags[0].leg == "typed"
    assert frags[0].field == "file_path"
    assert frags[0].builder == "ilike"
    assert frags[0].value == "%Invoices%"


@pytest.mark.asyncio
async def test_resolver_defense_in_depth_closes_typed_bypass_seam():
    """SC#2 seam test: A fragment with leg='typed' pointing to an un-promoted column is refused."""
    supabase = MagicMock()
    with patch.object(
        document_view_resolver,
        "_build_field_meta",
        new_callable=AsyncMock,
        return_value=(set(view_filter_compiler.PROMOTED_TYPED_COLUMNS.keys()), set()),
    ):
        flt = ViewFilter(
            op="and",
            conditions=[ViewCondition(field="document_type", op="eq", value="report")],
        )

        # Inject a malicious/stray fragment into compiled output
        malicious_frag = view_filter_compiler.Fragment(
            leg="typed", field="unvetted_secret_column", builder="eq", value="hack"
        )
        with patch(
            "app.services.view_filter_compiler.compile_filter",
            return_value=[malicious_frag],
        ):
            with pytest.raises(ResolveError) as exc_info:
                await resolve_filter(
                    caller=USER_ID,
                    flt=flt,
                    folder_scope=None,
                    count_only=False,
                    supabase=supabase,
                )
            assert "unvetted_secret_column" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_resolver_applies_source_system_nested_json_selector():
    supabase = MagicMock()
    table_mock = MagicMock()
    supabase.table.return_value = table_mock
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.or_.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.range.return_value = table_mock
    table_mock.execute.return_value = MagicMock(
        data=[{"id": "doc-1", "created_at": "2026-09-01T10:00:00Z"}], count=1
    )

    with patch(
        "app.services.document_view_resolver.get_globally_visible_folder_ids",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.metadata_field_service.list_field_definitions",
        new_callable=AsyncMock,
        return_value=[],
    ):
        flt = ViewFilter(
            op="and",
            conditions=[ViewCondition(field="source_system", op="eq", value="google")],
        )
        await resolve_filter(
            caller=USER_ID,
            flt=flt,
            folder_scope=None,
            count_only=False,
            supabase=supabase,
        )

        # Verify that eq was called with the nested selector metadata->source->>system
        table_mock.eq.assert_any_call("metadata->source->>system", "google")
