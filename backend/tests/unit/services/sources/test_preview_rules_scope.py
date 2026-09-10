"""Phase 237 (RULES-01 / SC#1 / SC#3) — preview destination suggestion uses watch scope rules.

Verifies:
1. `_suggest_destination` matches arrival properties (mime, path, size, name, source_system, source_connection_id)
   against watch-scope rules.
2. Classification-scope rules are filtered out / ignored during preview destination suggestion.
3. `_load_user_rules` requests `rule_scope="watch"` from classification_rule_service.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.sources.preview_service import _rule_destinations, _suggest_destination


USER_ID = "00000000-0000-0000-0000-000000000001"


class _FakeSupabase:
    def __init__(self, folder_name="Invoices"):
        self.folder_name = folder_name

    def table(self, name):
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.or_.return_value = table_mock
        resp = MagicMock()
        resp.data = {"id": "fld-1", "name": self.folder_name}
        table_mock.maybe_single.return_value.execute.return_value = resp
        return table_mock


def _make_rule(
    rule_id: str,
    conditions: list[dict],
    *,
    scope: str = "watch",
    suggest_folder_id: str = "fld-1",
    enabled: bool = True,
):
    return {
        "id": rule_id,
        "name": f"Rule {rule_id}",
        "rule_scope": scope,
        "enabled": enabled,
        "suggest_folder_id": suggest_folder_id,
        "match_expr": {
            "op": "and",
            "conditions": conditions,
        },
    }


def test_suggest_destination_matches_watch_rule_arrival_mime():
    supabase = _FakeSupabase(folder_name="Finance")
    rules = [
        _make_rule("r1", [{"field": "type", "op": "eq", "value": "application/pdf"}], scope="watch"),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="invoice.pdf",
        modified_at="2026-09-01T10:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/Default",
        mime_type="application/pdf",
    )

    assert matched is True
    assert dest == "/Finance"


def test_suggest_destination_matches_watch_rule_arrival_source_facts():
    supabase = _FakeSupabase(folder_name="Google Drive Imports")
    rules = [
        _make_rule(
            "r1",
            [
                {"field": "source_system", "op": "eq", "value": "google"},
                {"field": "path", "op": "contains", "value": "Tax"},
            ],
            scope="watch",
        ),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="Tax_2026.xlsx",
        modified_at="2026-09-01T10:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/Default",
        path="/Shared/Tax/2026",
        source_system="google",
        source_connection_id="conn-abc",
    )

    assert matched is True
    assert dest == "/Google Drive Imports"


def test_suggest_destination_ignores_classification_scope_rules():
    supabase = _FakeSupabase(folder_name="Should Not Match")
    # A rule with rule_scope="classification" matching document_type or type
    rules = [
        _make_rule(
            "r-class",
            [{"field": "type", "op": "eq", "value": "application/pdf"}],
            scope="classification",
        ),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="report.pdf",
        modified_at="2026-09-01T10:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/Default",
        mime_type="application/pdf",
    )

    # Classification rules must be skipped at arrival preview
    assert matched is False
    assert dest == "/Default"


def test_suggest_destination_falls_back_when_no_match():
    supabase = _FakeSupabase()
    rules = [
        _make_rule(
            "r-watch",
            [{"field": "name", "op": "contains", "value": "StrictKeyword"}],
            scope="watch",
        ),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="random_file.txt",
        modified_at="2026-09-01T10:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/FallbackFolder",
        mime_type="text/plain",
    )

    assert matched is False
    assert dest == "/FallbackFolder"


@pytest.mark.asyncio
async def test_rule_destinations_passes_watch_scope():
    supabase = MagicMock()
    with patch(
        "app.services.classification_rule_service.list_rules",
        new_callable=AsyncMock,
    ) as mock_list_rules:
        mock_list_rules.return_value = [
            {"id": "r1", "enabled": True, "rule_scope": "watch"},
            {"id": "r2", "enabled": False, "rule_scope": "watch"},
        ]

        rules = await _rule_destinations(user_id="usr-123", supabase=supabase)

        mock_list_rules.assert_awaited_once_with(
            "usr-123", rule_scope="watch", supabase=supabase
        )
        assert len(rules) == 1
        assert rules[0]["id"] == "r1"


def test_suggest_destination_matches_date_rule():
    """Watch rules can match on date derived from modified_at."""
    supabase = _FakeSupabase(folder_name="September 2026")
    rules = [
        _make_rule(
            "r-date",
            [{"field": "date", "op": "gte", "value": "2026-09-01"}],
            scope="watch",
        ),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="contract.pdf",
        modified_at="2026-09-06T12:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/Default",
        mime_type="application/pdf",
    )

    assert matched is True
    assert dest == "/September 2026"


def test_suggest_destination_matches_path_rule():
    """Watch rules can match on path or source_path."""
    supabase = _FakeSupabase(folder_name="Invoices Folder")
    rules = [
        _make_rule(
            "r-path",
            [{"field": "path", "op": "contains", "value": "Invoices"}],
            scope="watch",
        ),
    ]

    dest, matched = _suggest_destination(
        rules=rules,
        name="inv_001.pdf",
        modified_at="2026-09-06T12:00:00Z",
        supabase=supabase,
        user_id=USER_ID,
        fallback="/Default",
        mime_type="application/pdf",
        path="/Accounting/Invoices/inv_001.pdf",
    )

    assert matched is True
    assert dest == "/Invoices Folder"


@pytest.mark.asyncio
async def test_build_preview_populates_path_and_applies_watch_rule():
    """build_preview sets item.path and applies watch rules matching by path."""
    from app.services.sources.base import FilePage, SourceFile
    from app.services.sources.preview_service import build_preview

    adapter = MagicMock()
    adapter.list_files = AsyncMock(
        return_value=FilePage(
            files=[
                SourceFile(
                    id="f1",
                    name="Q3_Report.txt",
                    mime_type="text/plain",
                    size=2048,
                    modified_at="2026-09-06T12:00:00Z",
                )
            ]
        )
    )
    adapter.browse = AsyncMock(return_value=MagicMock(items=[]))

    conn = MagicMock()
    conn.id = "conn-1"
    conn.service_id = "google_drive"

    supabase = _FakeSupabase(folder_name="Quarterly Reports")

    rules = [
        _make_rule(
            "r-path",
            [{"field": "path", "op": "contains", "value": "Reports"}],
            scope="watch",
        ),
    ]

    with patch(
        "app.services.sources.base.SourceRegistry.get_adapter",
        return_value=adapter,
    ), patch(
        "app.services.sources.preview_service._rule_destinations",
        new_callable=AsyncMock,
        return_value=rules,
    ), patch(
        "app.services.sources.preview_service._known_source_files",
        new_callable=AsyncMock,
        return_value={},
    ):
        preview = await build_preview(
            connection=conn,
            folder_id="fld-root",
            folder_name="Reports",
            user_id=USER_ID,
            supabase=supabase,
        )

    assert len(preview.items) == 1
    item = preview.items[0]
    assert item.path == "/Reports/Q3_Report.txt"
    assert item.rule_suggested is True
    assert item.destination == "/Quarterly Reports"

