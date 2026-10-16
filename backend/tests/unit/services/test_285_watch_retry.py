"""Phase 285-01 (FIX-12 / BUG-261014-02; D-01..D-06, orchestrator rulings 2, 3, 4, 5, 6, 8).

A watched file whose download failed once used to be NEVER read again: the existing-file branch
acts only on missing/unauthorized, a version change or a rename, and a `failed` item with an
unchanged version matched none of them. Its `last_error` was `str(exc)` — `''` for an
empty-message `httpx.ConnectError` — and the next run row read `count_errors = 0`,
`last_error = NULL` over a file that never arrived.

What this suite pins, each driven RED against the unmodified `watch_service.py` first:
  * a `failed` item below the cap (3) is read again through the EXISTING new-file branch and lands
    `present`, `failed_attempts = 0`, `minted = True` (D-01, D-05 re-mint);
  * past the cap with an unchanged version it is NOT read, but the run still counts and names it
    (D-02); a version change resets the cap (D-01, pitfall 6);
  * the item's `last_error` keeps the exception TYPE (D-04);
  * the run row's `last_error` names failed files: first 3 plus "and N more", bounded (D-03),
    passed as `run_error` so `connector_watches.last_error` stays NULL (orchestrator ruling 3);
  * the error arm marks a document failed ONLY when this iteration minted it — never the previous
    good copy, never a dedup-linked hand upload (orchestrator ruling 4);
  * the minted marker per M-1..M-4 (orchestrator ruling 2);
  * the modify arm passes `metadata=` (orchestrator ruling 8);
  * `set(counts)` stays exactly the six keys (no new key, no new status).

Harness copied from `test_watch_service.py`: everything is patched by module path; the mint is a
stub returning a real `MintResult`.
"""
from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import httpx
import pytest

from app.services.ingest_splice import MintResult
from app.services.sources.base import FilePage, SourceFile
from app.services.watch_service import WatchService

SIX = {"new", "modified", "renamed", "missing", "restored", "errors"}


@pytest.fixture
def mock_pool():
    return MagicMock()


@pytest.fixture
def doc_query():
    q = MagicMock()
    q.update.return_value = q
    q.eq.return_value = q
    q.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
    return q


@pytest.fixture
def mock_supabase(doc_query):
    sb = MagicMock()
    conn_query = MagicMock()
    conn_query.select.return_value = conn_query
    conn_query.eq.return_value = conn_query
    conn_query.maybe_single.return_value = conn_query
    conn_query.execute.return_value = MagicMock(
        data={
            "id": str(uuid4()),
            "service_id": "microsoft",
            "name": "Team OneDrive",
            "is_enabled": True,
            "default_ingest_visibility": "private",
        }
    )

    def table_side_effect(name):
        if name == "connector_connections":
            return conn_query
        if name == "documents":
            return doc_query
        return MagicMock()

    sb.table.side_effect = table_side_effect
    bucket = MagicMock()
    bucket.upload.return_value = {"Key": "documents/fake"}
    sb.storage.from_.return_value = bucket
    return sb


@pytest.fixture
def adapter():
    a = MagicMock()
    a.list_files = AsyncMock()
    a.read_file = AsyncMock(return_value=("a.txt", b"bytes", "text/plain"))
    return a


def _watch() -> dict:
    return {
        "id": uuid4(),
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "org_id": uuid4(),
        "library_folder_id": None,
        "source_folder_id": "folder-1",
    }


def _file(ext_id: str = "ext-1", name: str = "team-note-058.txt", version: str = "v1") -> SourceFile:
    return SourceFile(id=ext_id, name=name, mime_type="text/plain", modified_at=version)


def _item(**over) -> dict:
    base = {
        "id": uuid4(),
        "external_id": "ext-1",
        "name": "team-note-058.txt",
        "state": "failed",
        "source_version": "v1",
        "document_id": None,
        "failed_attempts": 0,
        "minted": False,
        "last_error": "",
    }
    base.update(over)
    return base


def _mint(doc_id: UUID | None = None, *, dup: bool = False) -> MintResult:
    d = doc_id or uuid4()
    return MintResult(
        document={"id": str(d)},
        is_duplicate=dup,
        storage_path=f"u/{d}/a.txt",
        version_number=1,
    )


class Mocks:
    upsert: AsyncMock
    mint: AsyncMock
    release: AsyncMock
    enqueue: AsyncMock
    state: AsyncMock


@contextmanager
def _patched(adapter, *, items, mint=None, upsert_side_effect=None):
    m = Mocks()
    m.upsert = AsyncMock(return_value={"id": uuid4()}, side_effect=upsert_side_effect)
    m.mint = AsyncMock(return_value=mint or _mint())
    m.release = AsyncMock()
    m.enqueue = AsyncMock(return_value=uuid4())
    m.state = AsyncMock()
    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=items)), \
         patch("app.services.watch_service.upsert_watch_item", new=m.upsert), \
         patch("app.services.watch_service.insert_ingestion_job", new=m.enqueue), \
         patch("app.services.watch_service.release_watch", new=m.release), \
         patch("app.services.watch_service.update_item_state", new=m.state), \
         patch("app.services.watch_service.async_mint_document_row", new=m.mint), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter):
        yield m


async def _sync(mock_pool, mock_supabase, adapter, files, **kw):
    adapter.list_files.return_value = FilePage(files=files, next_page_token=None)
    with _patched(adapter, **kw) as m:
        res = await WatchService(pool=mock_pool, supabase=mock_supabase).sync_watch(_watch())
    assert res["status"] == "success"
    assert set(res["counts"]) == SIX
    rel = m.release.call_args[1]
    assert set(rel["counts"]) == SIX
    assert rel["status"] == "success"
    assert rel["error"] is None
    return res, m, rel


def _failed_doc_writes(doc_query) -> list[dict]:
    return [
        c[0][0] for c in doc_query.update.call_args_list
        if isinstance(c[0][0], dict) and c[0][0].get("status") == "failed"
    ]


# ── D-01 / D-05: retry below the cap, through the existing new-file branch ──────────────────────

@pytest.mark.asyncio
async def test_failed_item_below_cap_is_read_again_and_lands(mock_pool, mock_supabase, adapter):
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(failed_attempts=0, document_id=None)],
    )

    adapter.read_file.assert_awaited_once()
    m.mint.assert_awaited_once()
    m.enqueue.assert_awaited_once()
    final = m.upsert.call_args_list[-1][1]
    assert final["state"] == "present"
    assert final["failed_attempts"] == 0
    assert final["minted"] is True  # M-1
    assert res["counts"]["new"] == 1
    assert res["counts"]["errors"] == 0
    assert rel.get("run_error") is None


@pytest.mark.asyncio
async def test_failed_item_again_failing_increments_attempts(mock_pool, mock_supabase, adapter):
    adapter.read_file.side_effect = httpx.ReadTimeout("timed out")
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(failed_attempts=1, last_error="ConnectError")],
    )

    adapter.read_file.assert_awaited_once()
    up = m.upsert.call_args_list[-1][1]
    assert up["state"] == "failed"
    assert up["failed_attempts"] == 2
    # Amended for 285-REVIEW CR-01: this pin used to read "the error arm never touches the
    # marker", which agreed with the bug. The error arm now writes the marker whenever the minter
    # answered (see the test_cr01_* pins); it keeps the stored value ONLY because the read failed
    # before any mint here, so the item's link is unchanged.
    assert up.get("minted") is None
    assert up["last_error"] == "ReadTimeout: timed out"
    assert res["counts"]["errors"] == 1
    assert rel["run_error"] == "1 file failed: team-note-058.txt (ReadTimeout)"


# ── D-01 / D-02: past the cap ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("stored, shown", [("ConnectError", "ConnectError"),
                                           ("ReadTimeout: timed out", "ReadTimeout"),
                                           ("", "unknown error")])
async def test_past_cap_unchanged_version_is_not_read_but_counted(
    mock_pool, mock_supabase, adapter, stored, shown
):
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(failed_attempts=3, last_error=stored)],
    )

    adapter.read_file.assert_not_awaited()
    m.mint.assert_not_awaited()
    assert res["counts"]["errors"] == 1
    assert rel["counts"]["errors"] == 1
    assert rel["run_error"] == f"1 file failed: team-note-058.txt ({shown})"


@pytest.mark.asyncio
async def test_past_cap_changed_version_is_read_again(mock_pool, mock_supabase, adapter):
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(failed_attempts=3, source_version="v1", last_error="ConnectError")],
    )

    adapter.read_file.assert_awaited_once()
    final = m.upsert.call_args_list[-1][1]
    assert final["state"] == "present"
    assert final["failed_attempts"] == 0
    assert res["counts"]["errors"] == 0
    assert rel.get("run_error") is None


@pytest.mark.asyncio
async def test_past_cap_changed_version_failing_restarts_the_count(mock_pool, mock_supabase, adapter):
    adapter.read_file.side_effect = httpx.ConnectError("")
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(failed_attempts=3, source_version="v1", last_error="ConnectError")],
    )

    assert m.upsert.call_args_list[-1][1]["failed_attempts"] == 1


# ── D-04: the type survives an empty message ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_new_file_empty_connect_error_is_typed(mock_pool, mock_supabase, adapter):
    adapter.read_file.side_effect = httpx.ConnectError("")
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file(name="a.txt")], items=[],
    )

    up = m.upsert.call_args_list[-1][1]
    assert up["state"] == "failed"
    assert up["last_error"] == "ConnectError"
    assert up["failed_attempts"] == 1
    assert res["counts"]["errors"] == 1
    assert rel["run_error"] == "1 file failed: a.txt (ConnectError)"


# ── Orchestrator ruling 4: the error arm marks only what THIS iteration minted ──────────────────

@pytest.mark.asyncio
async def test_modify_arm_read_failure_keeps_the_previous_good_copy(
    mock_pool, mock_supabase, adapter, doc_query
):
    good = uuid4()
    adapter.read_file.side_effect = httpx.ConnectError("")
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(state="present", source_version="v1", document_id=good)],
    )

    assert _failed_doc_writes(doc_query) == [], "the previous completed copy was marked failed"
    up = m.upsert.call_args_list[-1][1]
    assert UUID(str(up["document_id"])) == good  # the link is kept
    assert up["state"] == "failed"
    assert up["failed_attempts"] == 1


@pytest.mark.asyncio
async def test_dedup_linked_doc_is_never_marked_failed(mock_pool, mock_supabase, adapter, doc_query):
    linked = uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(name="a.txt")], items=[],
        mint=_mint(linked, dup=True),
        upsert_side_effect=[RuntimeError("db blip"), {"id": uuid4()}],
    )

    assert _failed_doc_writes(doc_query) == [], "a dedup-linked hand upload was marked failed"
    assert m.upsert.await_count == 2


@pytest.mark.asyncio
async def test_doc_this_iteration_minted_is_marked_failed(mock_pool, mock_supabase, adapter, doc_query):
    minted = uuid4()
    m_enqueue_fail = AsyncMock(side_effect=RuntimeError("queue down"))
    adapter.list_files.return_value = FilePage(files=[_file(name="a.txt")], next_page_token=None)
    with _patched(adapter, items=[], mint=_mint(minted)) as m:
        with patch("app.services.watch_service.insert_ingestion_job", new=m_enqueue_fail):
            await WatchService(pool=mock_pool, supabase=mock_supabase).sync_watch(_watch())

    writes = _failed_doc_writes(doc_query)
    assert len(writes) == 1
    assert writes[0]["error_message"] == "Watch sync failed: RuntimeError: queue down"
    up = m.upsert.call_args_list[-1][1]
    assert UUID(str(up["document_id"])) == minted
    assert up["state"] == "failed"


# ── M-1..M-4: the minted marker ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_m1_new_file_minted(mock_pool, mock_supabase, adapter):
    _, m, _ = await _sync(mock_pool, mock_supabase, adapter, [_file()], items=[], mint=_mint())

    up = m.upsert.call_args_list[-1][1]
    assert up["minted"] is True
    assert up["failed_attempts"] == 0


@pytest.mark.asyncio
async def test_m2_retry_returning_its_own_doc_keeps_the_marker(mock_pool, mock_supabase, adapter):
    own = uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(document_id=own, minted=True)],
        mint=_mint(own, dup=True),
    )

    m.mint.assert_awaited_once()
    up = m.upsert.call_args_list[-1][1]
    assert up["minted"] is None  # M-2: keep the stored value
    assert up["state"] == "present"
    assert up["failed_attempts"] == 0


@pytest.mark.asyncio
async def test_m3_dedup_to_another_doc_is_linked(mock_pool, mock_supabase, adapter):
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()], items=[], mint=_mint(uuid4(), dup=True),
    )

    up = m.upsert.call_args_list[-1][1]
    assert up["minted"] is False


@pytest.mark.asyncio
async def test_m4_rename_arm_does_not_touch_the_marker(mock_pool, mock_supabase, adapter):
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(name="renamed.txt")],
        items=[_item(state="present", document_id=uuid4(), minted=True)],
    )

    adapter.read_file.assert_not_awaited()
    up = m.upsert.call_args_list[-1][1]
    assert up.get("minted") is None


@pytest.mark.asyncio
async def test_modify_arm_marker_and_metadata(mock_pool, mock_supabase, adapter):
    own = uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(state="present", source_version="v1", document_id=own, minted=True)],
        mint=_mint(own, dup=True),
    )

    kwargs = m.mint.call_args[1]
    assert kwargs["metadata"]["source"]["external_id"] == "ext-1"  # orchestrator ruling 8
    assert kwargs["metadata"]["source"]["version"] == "v2"
    up = m.upsert.call_args_list[-1][1]
    assert up["minted"] is None  # M-2 in the modify arm (same bytes, version bump)
    assert up["failed_attempts"] == 0


@pytest.mark.asyncio
async def test_modify_arm_new_bytes_is_minted(mock_pool, mock_supabase, adapter):
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(state="present", source_version="v1", document_id=uuid4(), minted=True)],
        mint=_mint(),
    )

    assert m.upsert.call_args_list[-1][1]["minted"] is True


# ── 285-REVIEW CR-01: the error arm's marker must describe the document it links ────────────────
# Before the fix the error arm passed no `minted` (None = keep), so an item that had minted X and
# was re-linked by the error arm to a dedup-matched hand upload H kept `minted = true`. M-2 then
# kept that stale marker on every later sync (H is now the item's own document), and both purge
# doors deleted H's row and bytes — the exact FIX-13 bug.

@pytest.mark.asyncio
async def test_cr01_retry_dedup_upsert_raises_error_arm_marks_link_not_minted(
    mock_pool, mock_supabase, adapter, doc_query
):
    x, h = uuid4(), uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(state="failed", document_id=x, minted=True, failed_attempts=1)],
        mint=_mint(h, dup=True),
        upsert_side_effect=[RuntimeError("db blip"), {"id": uuid4()}],
    )

    assert m.upsert.await_count == 2
    up = m.upsert.call_args_list[-1][1]
    assert up["state"] == "failed"
    assert UUID(str(up["document_id"])) == h
    assert up.get("minted") is False, "the error arm re-linked a hand upload but kept minted=true (CR-01)"
    assert _failed_doc_writes(doc_query) == []


@pytest.mark.asyncio
async def test_cr01_modify_arm_dedup_upsert_raises_error_arm_marks_link_not_minted(
    mock_pool, mock_supabase, adapter
):
    x, h = uuid4(), uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(version="v2")],
        items=[_item(state="present", source_version="v1", document_id=x, minted=True)],
        mint=_mint(h, dup=True),
        upsert_side_effect=[RuntimeError("db blip"), {"id": uuid4()}],
    )

    up = m.upsert.call_args_list[-1][1]
    assert UUID(str(up["document_id"])) == h
    assert up.get("minted") is False, "the modify arm's error path kept minted=true on a hand upload (CR-01)"


@pytest.mark.asyncio
async def test_cr01_error_arm_after_own_doc_dedup_keeps_the_marker(mock_pool, mock_supabase, adapter):
    """M-2 still holds in the error arm: the minter returned the item's OWN document."""
    own = uuid4()
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(state="failed", document_id=own, minted=True, failed_attempts=1)],
        mint=_mint(own, dup=True),
        upsert_side_effect=[RuntimeError("db blip"), {"id": uuid4()}],
    )

    assert m.upsert.call_args_list[-1][1].get("minted") is None


# ── 285-REVIEW WR-01 (marker half): a new item whose mint landed but a later step failed ────────
# The error arm INSERTED the item with `minted` at its default `false`, so the watch's own failed
# document read as "linked" and a purge before the retry kept it. The orphan-on-re-mint half of
# WR-01 is deferred (285-REVIEW.md Fix Log).

@pytest.mark.asyncio
async def test_wr01_new_item_storage_upload_fails_is_marked_minted(
    mock_pool, mock_supabase, adapter, doc_query
):
    minted = uuid4()
    mock_supabase.storage.from_.return_value.upload.side_effect = RuntimeError("storage down")
    _, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file(name="a.txt")], items=[], mint=_mint(minted),
    )

    m.enqueue.assert_not_awaited()
    up = m.upsert.call_args_list[-1][1]
    assert up["state"] == "failed"
    assert UUID(str(up["document_id"])) == minted
    assert up.get("minted") is True, "the watch's own failed document was inserted as linked (WR-01)"
    assert len(_failed_doc_writes(doc_query)) == 1


# ── 285-REVIEW CR-02: a file that never landed stays retried and counted through an auth blip ──
# `_handle_unauthorized_watch` flips EVERY item to `unauthorized`, `failed` ones included (VIS-04,
# deliberately unchanged). When access returned, `retry_failed` read False and the restore arm set
# the item `present` with no live document: never read again, never counted — the FIX-12 failure
# mode. "Never landed" is now a property of the row (failed_attempts > 0, or no document at all),
# not only of `state`.

def _unauth(**over) -> dict:
    return _item(state="unauthorized", last_error="401 Unauthorized", **over)


def _state_calls(m, state: str) -> list:
    return [c for c in m.state.call_args_list if c[1].get("state") == state]


@pytest.mark.asyncio
async def test_cr02_unauthorized_never_landed_item_is_read_again_and_lands(
    mock_pool, mock_supabase, adapter
):
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_unauth(failed_attempts=1, document_id=None)],
    )

    adapter.read_file.assert_awaited_once()
    m.mint.assert_awaited_once()
    assert _state_calls(m, "present") == [], "restored to present without a document (CR-02)"
    final = m.upsert.call_args_list[-1][1]
    assert final["state"] == "present"
    assert final["failed_attempts"] == 0
    assert final["minted"] is True
    assert res["counts"]["new"] == 1
    assert res["counts"]["restored"] == 0
    assert rel.get("run_error") is None


@pytest.mark.asyncio
async def test_cr02_unauthorized_never_landed_item_failing_again_is_counted(
    mock_pool, mock_supabase, adapter
):
    adapter.read_file.side_effect = httpx.ConnectError("")
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_unauth(failed_attempts=1, document_id=uuid4())],
    )

    adapter.read_file.assert_awaited_once()
    up = m.upsert.call_args_list[-1][1]
    assert up["state"] == "failed"
    assert up["failed_attempts"] == 2  # the D-01 count continues across the blip
    assert res["counts"]["errors"] == 1
    assert rel["run_error"] == "1 file failed: team-note-058.txt (ConnectError)"


@pytest.mark.asyncio
async def test_cr02_missing_legacy_item_with_no_document_is_read_again(mock_pool, mock_supabase, adapter):
    """A legacy failed row carries failed_attempts = 0; no document at all still means never landed."""
    res, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_item(state="missing", failed_attempts=0, document_id=None, last_error=None)],
    )

    adapter.read_file.assert_awaited_once()
    assert _state_calls(m, "present") == []
    assert m.upsert.call_args_list[-1][1]["state"] == "present"
    assert res["counts"]["new"] == 1


@pytest.mark.asyncio
async def test_cr02_past_cap_unauthorized_item_is_counted_and_returned_to_failed(
    mock_pool, mock_supabase, adapter
):
    res, m, rel = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_unauth(failed_attempts=3, document_id=None)],
    )

    adapter.read_file.assert_not_awaited()
    assert _state_calls(m, "present") == []
    assert len(_state_calls(m, "failed")) == 1, "the item must read failed again, not unauthorized"
    assert res["counts"]["errors"] == 1
    assert rel["run_error"].startswith("1 file failed: team-note-058.txt (")


@pytest.mark.asyncio
async def test_cr02_landed_unauthorized_item_still_takes_the_restore_arm(mock_pool, mock_supabase, adapter):
    """Control: a file that DID land (no failed attempts, a document) is restored as before."""
    res, m, _ = await _sync(
        mock_pool, mock_supabase, adapter, [_file()],
        items=[_unauth(failed_attempts=0, document_id=uuid4(), minted=True)],
    )

    adapter.read_file.assert_not_awaited()
    assert len(_state_calls(m, "present")) == 1
    assert res["counts"]["restored"] == 1


@pytest.mark.asyncio
async def test_cr02_failed_item_through_an_auth_blip_is_read_again(mock_pool, mock_supabase, adapter):
    """The reviewer's drive: a failed item is flipped by a 401 listing, then access returns."""
    failed = _item(state="failed", failed_attempts=1, document_id=None, last_error="ConnectError")

    # Sync 1 — the listing raises a 401, so VIS-04 flips every item (this behaviour is unchanged).
    adapter.list_files.side_effect = RuntimeError("Client error '401 Unauthorized' for url")
    with _patched(adapter, items=[failed]) as m1:
        res1 = await WatchService(pool=mock_pool, supabase=mock_supabase).sync_watch(_watch())
    assert res1["status"] == "unauthorized"
    flips = _state_calls(m1, "unauthorized")
    assert len(flips) == 1 and flips[0][0][1] == failed["id"]

    # The row as `update_item_state` leaves it: state and last_error replaced, attempts untouched.
    after_blip = {**failed, "state": "unauthorized", "last_error": flips[0][1]["error"]}

    # Sync 2 — access is back. The file never landed, so it must be read again, not restored.
    adapter.list_files.side_effect = None
    res2, m2, _ = await _sync(mock_pool, mock_supabase, adapter, [_file()], items=[after_blip])
    adapter.read_file.assert_awaited_once()
    assert _state_calls(m2, "present") == []
    assert m2.upsert.call_args_list[-1][1]["state"] == "present"
    assert res2["counts"]["new"] == 1


# ── D-03: the summary's shape and bound ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_five_failures_summary_lists_three_and_counts_the_rest(mock_pool, mock_supabase, adapter):
    long_name = "x" * 300 + ".txt"
    names = [long_name, "b.txt", "c.docx", "d.pdf", "e.txt"]
    errors = {
        "e0": httpx.ConnectError(""),
        "e1": httpx.ReadTimeout("slow"),
        "e2": ValueError("bad"),
        "e3": OSError("disk"),
        "e4": httpx.ConnectError(""),
    }

    async def read(_conn, file_id):
        raise errors[file_id]

    adapter.read_file.side_effect = read
    files = [_file(ext_id=f"e{i}", name=n) for i, n in enumerate(names)]
    res, _, rel = await _sync(mock_pool, mock_supabase, adapter, files, items=[])

    s = rel["run_error"]
    assert s.startswith("5 files failed: ")
    assert s.endswith(" and 2 more")
    assert s.count("(") == 3
    assert "(ConnectError)" in s and "(ReadTimeout)" in s and "(ValueError)" in s
    assert long_name not in s  # each name is truncated
    assert len(s) <= 500
    assert res["counts"]["errors"] == 5
