"""Phase 238 plan 04 (CR-01 / BL-01) — the STORED `metadata.source.path` is real or it is absent.

⛔ THE DEFECT THESE FENCES CLOSE, and every link of it was inside Phase 238's own diff:

    walk_source_files:333-334  f.path = f"{current_path}/{f.name}" ...   # MUTATES the DTO
    build_preview:592          file_path = getattr(f, "path", None) or f"/{f.name}"
    build_preview:620          PreviewItem(..., path=file_path)
    confirm_preview:728        import_single_file(..., source_path=item.path)
    import_service:233         metadata["source"]["path"] = source_path
    ingest_enrich:568-571      eval_facts["path"] = src_path  ->  rule matching

Phase 238 removed the `/<filename>` fabrication at `ingest_enrich.py` *because a fabricated
value reached a RULE* — and re-opened SEED-253 by a new route in the same commit.

⚠ **WHY THE PHASE'S OWN FENCES SHIPPED GREEN OVER IT.**
`test_EVERY_writer_of_metadata_source_carries_the_path_key` greps for the literal
`'"path": source_path,'` — **key PRESENCE, not value honesty** (WR-08). This project's own
recorded lesson (*"presence assertions cannot see content drift"*) landed inside the fence
written to close a miss of exactly that shape. So every fence in this file **drives the
behaviour and asserts the VALUE**; there is not one source grep here, deliberately.

⭐ THE DISPLAY FALLBACK IS KEPT AND IS FENCED TOO. A preview ROW is a thing a person is
looking at, and a blank path column is not the honest signal there. The distinction this file
pins is *display vs stored*: `PreviewItem.path` may be a breadcrumb; `PreviewItem.source_path`
— the only value that may be persisted — is `None` whenever no adapter supplied a real path.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.ingest_splice import MintResult
from app.services.sources.base import FilePage, SourceFile

USER_ID = str(uuid4())
ORG_ID = str(uuid4())


# ── harness ───────────────────────────────────────────────────────────────────────────────


def _adapter(files: list[SourceFile]) -> MagicMock:
    a = MagicMock()
    a.list_files = AsyncMock(return_value=FilePage(files=files, next_page_token=None))
    a.browse = AsyncMock(return_value=MagicMock(items=[]))
    a.read_file = AsyncMock(return_value=("Q3 Rates.pdf", b"%PDF-1.4 bytes", "application/pdf"))
    return a


def _connection() -> MagicMock:
    conn = MagicMock()
    conn.id = "conn-1"
    conn.service_id = "google_drive"
    conn.default_ingest_visibility = "private"
    return conn


def _mint_result() -> MintResult:
    doc_id = uuid4()
    return MintResult(
        document={"id": str(doc_id), "user_id": USER_ID},
        is_duplicate=False,
        storage_path=f"{USER_ID}/{doc_id}/Q3 Rates.pdf",
        version_number=1,
    )


async def _import_door_mints(
    *, adapter_path: str | None, folder_name: str | None
) -> tuple[dict, list]:
    """Drive the door a person clicks — preview -> confirm -> import_single_file -> mint.

    Returns `(metadata_handed_to_the_mint, preview_items)`. `import_single_file` runs for real;
    only the network (`fetch_cloud_file`), the mint and the enqueue are stubbed, so the whole
    `PreviewItem -> source_path -> metadata["source"]["path"]` chain is exercised.
    """
    from app.services.sources.preview_service import confirm_preview

    f = SourceFile(
        id="ext-1",
        name="Q3 Rates.pdf",
        mime_type="application/pdf",
        size=2048,
        modified_at="2026-09-01T12:00:00Z",
        path=adapter_path,
    )
    adapter = _adapter([f])
    mint = AsyncMock(return_value=_mint_result())
    captured: dict = {}

    async def _fetch(connection, file_id):  # noqa: ANN001
        return ("Q3 Rates.pdf", b"%PDF-1.4 bytes", "application/pdf")

    preview_holder: dict = {}
    real_build = None

    with patch(
        "app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter
    ), patch(
        "app.services.sources.preview_service._rule_destinations",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.sources.preview_service._known_source_files",
        new_callable=AsyncMock,
        return_value={},
    ), patch(
        "app.services.sources.import_service.fetch_cloud_file", new=AsyncMock(side_effect=_fetch)
    ), patch(
        "app.services.sources.import_service._enqueue_or_splice", new=AsyncMock()
    ), patch(
        "app.services.ingest_splice.async_mint_document_row", new=mint
    ):
        from app.services.sources import preview_service as ps

        real_build = ps.build_preview

        async def _spy_build(**kwargs):
            preview = await real_build(**kwargs)
            preview_holder["preview"] = preview
            return preview

        with patch.object(ps, "build_preview", new=_spy_build):
            await confirm_preview(
                connection=_connection(),
                folder_id="fld-root",
                folder_name=folder_name,
                user_id=USER_ID,
                active_org=ORG_ID,
                supabase=MagicMock(),
                background_tasks=MagicMock(),
                recursive=True,
            )

    mint.assert_awaited_once()
    captured = mint.call_args[1]["metadata"]
    return captured, preview_holder["preview"].items


async def _watch_door_mints(*, adapter_path: str | None) -> dict:
    """Drive the OTHER writer — the scheduled watch loop — over the SAME `SourceFile`."""
    from app.services.watch_service import WatchService

    watch_id, conn_id, org_id = uuid4(), uuid4(), uuid4()
    watch_record = {
        "id": watch_id,
        "connection_id": conn_id,
        "user_id": uuid4(),
        "org_id": org_id,
        "library_folder_id": None,
        "source_folder_id": "fld-root",
        "interval_minutes": 30,
        "status": "running",
    }
    f = SourceFile(
        id="ext-1",
        name="Q3 Rates.pdf",
        mime_type="application/pdf",
        size=2048,
        modified_at="2026-09-01T12:00:00Z",
        path=adapter_path,
    )
    adapter = _adapter([f])
    mint = AsyncMock(return_value=_mint_result())

    sb = MagicMock()
    conn_query = MagicMock()
    conn_query.select.return_value = conn_query
    conn_query.eq.return_value = conn_query
    conn_query.maybe_single.return_value = conn_query
    conn_query.execute.return_value = MagicMock(
        data={
            "id": str(conn_id),
            "service_id": "google_drive",
            "name": "Team Drive",
            "is_enabled": True,
            "default_ingest_visibility": "private",
        }
    )
    sb.table.return_value = conn_query
    sb.storage.from_.return_value = MagicMock()

    with patch(
        "app.services.watch_service.claim_due_watches",
        new=AsyncMock(return_value=[watch_record]),
    ), patch(
        "app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])
    ), patch(
        "app.services.watch_service.upsert_watch_item",
        new=AsyncMock(return_value={"id": uuid4()}),
    ), patch(
        "app.services.watch_service.insert_ingestion_job", new=AsyncMock(return_value=uuid4())
    ), patch(
        "app.services.watch_service.release_watch", new=AsyncMock()
    ), patch(
        "app.services.watch_service.async_mint_document_row", new=mint
    ), patch(
        "app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter
    ):
        svc = WatchService(pool=MagicMock(), supabase=sb)
        await svc.tick()

    mint.assert_awaited_once()
    return mint.call_args[1]["metadata"]


# ── FENCE 1: the value fence ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_unknown_path_is_stored_as_None_not_as_a_filename():
    """⭐ CR-01. Google Drive supplies no `path`. The hand-import door must store `None`.

    ⛔ The value, not the key. `test_EVERY_writer_of_metadata_source_carries_the_path_key`
    greps for `'"path": source_path,'` and is satisfied while `source_path` carries
    `/Q3 Rates.pdf` — which is exactly how this shipped green.
    """
    metadata, _items = await _import_door_mints(adapter_path=None, folder_name=None)

    assert metadata["source"]["path"] is None, (
        f"stored a FABRICATED path {metadata['source']['path']!r}. `path contains '/Finance/'` "
        "is then False for a file that IS in Finance, while `path contains 'Rates'` is True "
        "because it matched the FILENAME — SEED-253, reopened."
    )


@pytest.mark.asyncio
async def test_a_real_adapter_path_survives_to_the_stored_fact_verbatim():
    """The other half: honesty is not silence. Graph's `parentReference.path` must arrive."""
    metadata, _items = await _import_door_mints(
        adapter_path="/Documents/Finance/Q3 Rates.pdf", folder_name=None
    )
    assert metadata["source"]["path"] == "/Documents/Finance/Q3 Rates.pdf"


@pytest.mark.asyncio
async def test_the_preview_ROW_still_shows_a_breadcrumb_when_the_path_is_unknown():
    """⭐ THE DISPLAY FALLBACK IS DELIBERATE AND MUST SURVIVE THE FIX.

    `build_preview`'s own comment says why: a preview row is a thing a person is looking at,
    and a blank path column is not the honest signal there. The fix separates *what the row
    shows* from *what may be persisted* — it does not blank the column.
    """
    _metadata, items = await _import_door_mints(adapter_path=None, folder_name="Finance")
    assert len(items) == 1
    assert items[0].path == "/Finance/Q3 Rates.pdf", "the DISPLAY breadcrumb was lost"


# ── FENCE 2: the caller-control fence ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_request_supplied_folder_name_cannot_reach_the_stored_path():
    """⛔ `SourcePreviewRequest.folder_name` is `str | None = None` with NO validation, and
    `walk_source_files` seeds the breadcrumb from it verbatim. A client POSTing
    `{"folder_name": "Finance"}` stamped `path = "/Finance/<name>"` on EVERY imported
    document regardless of where the files are — and a `path contains '/Finance/'`
    auto-classification rule then fired on all of them.

    **A request body must not decide a stored provenance fact that governs automated filing.**
    """
    metadata, _items = await _import_door_mints(adapter_path=None, folder_name="Finance")

    stored = metadata["source"]["path"]
    assert stored is None, (
        f"the request body decided a stored provenance fact: {stored!r}. The caller named the "
        "folder; the SOURCE did not."
    )


@pytest.mark.asyncio
async def test_folder_name_cannot_overwrite_a_path_the_adapter_did_supply():
    """The caller may not contradict the source either."""
    metadata, _items = await _import_door_mints(
        adapter_path="/Documents/Archive/Q3 Rates.pdf", folder_name="Finance"
    )
    assert metadata["source"]["path"] == "/Documents/Archive/Q3 Rates.pdf"


# ── FENCE 3: the two writers must agree ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "adapter_path", [None, "/Documents/Finance/Q3 Rates.pdf"], ids=["unknown", "real"]
)
@pytest.mark.asyncio
async def test_BOTH_writers_of_metadata_source_mint_the_SAME_path_for_the_same_file(
    adapter_path: str | None,
):
    """⭐ THE ASYMMETRY THAT CAUSED CR-01, driven rather than grepped.

    `metadata.source` has TWO writers — `watch_service` (the scheduled loop) and
    `import_service.import_single_file` (Library -> Add files). After Phase 238 the same
    OneDrive/Drive file got `path = None` through the watch door and `path = "/Q3 Rates.pdf"`
    through the hand-import door. Two doors, one Library, two different stored facts about
    the same file — so a folder-shaped rule's behaviour depended on how the file arrived.

    ⚠ This is the claim `test_EVERY_writer_of_metadata_source_carries_the_path_key` says it
    makes and cannot: it proves both writers have the KEY. This proves they agree on the VALUE.
    """
    watch_meta = await _watch_door_mints(adapter_path=adapter_path)
    import_meta, _items = await _import_door_mints(adapter_path=adapter_path, folder_name=None)

    assert watch_meta["source"]["path"] == import_meta["source"]["path"], (
        "the two writers disagree about the same file: watch minted "
        f"{watch_meta['source']['path']!r}, hand-import minted "
        f"{import_meta['source']['path']!r}"
    )
    assert import_meta["source"]["path"] == adapter_path
