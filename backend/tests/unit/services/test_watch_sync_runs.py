"""Phase 235 plan 05 (SURF-02 / V-01 / V-02) — every release seam records what the tick DID.

⭐ WHAT THIS FILE IS ABOUT, AND WHAT IT IS NOT. This suite asserts what the SERVICE hands the
DAL. Plan 01's `tests/unit/db/test_watches_db.py` asserts what the DAL does with it. Neither
substitutes for the other: a service that passes nothing and a DAL that stores nothing are two
different defects, and each file can only see one of them.

⛔ THE DEFECT THIS EXISTS TO CATCH. `watch_service.py` releases a watch from FOUR places, and
one of them — `tick()`'s per-watch `except` — is OUTSIDE `sync_watch` entirely. A change
confined to `sync_watch` loses every crash-shaped failure from the history, which is precisely
the class of failure a person most needs to see. So there is one named case per seam, and a
seam that stops writing makes a named test fail rather than making a history quietly incomplete.

⚠ WHAT THIS SUITE CANNOT PROVE. `release_watch` SWALLOWS its INSERT exception by design
(T-235-05) — losing a history row must never turn a successful sync into a failed one. Nothing
here, and nothing in the production code, can distinguish "wrote a row" from "raised and was
logged". Every assertion below is about the CALL, never about the row. The first honest check
that a row exists is a non-zero `select count(*) from connector_sync_runs` after a real tick.
"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services import watch_service as ws
from app.services.sources.base import FilePage, SourceFile, SourceListing  # noqa: F401
from app.services.watch_service import WatchService


# ── Doubles (S-3 Source A: MagicMock pool, AsyncMock connection) ──────────────────────


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con
    return pool


def _supabase(*, is_enabled: bool = True):
    """A Supabase client double good enough for connector_connections + documents."""
    sb = MagicMock()

    conn_query = MagicMock()
    conn_query.select.return_value = conn_query
    conn_query.eq.return_value = conn_query
    conn_query.maybe_single.return_value = conn_query
    conn_query.execute.return_value = MagicMock(
        data={
            "id": str(uuid4()),
            "service_id": "google",
            "name": "Team Google Drive",
            "is_enabled": is_enabled,
            "default_ingest_visibility": "private",
        }
    )

    doc_query = MagicMock()
    doc_query.update.return_value = doc_query
    doc_query.eq.return_value = doc_query
    doc_query.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    def table_side_effect(name):
        if name == "connector_connections":
            return conn_query
        if name == "documents":
            return doc_query
        return MagicMock()

    sb.table.side_effect = table_side_effect
    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = {"Key": "documents/fake"}
    sb.storage.from_.return_value = storage_bucket
    return sb


@pytest.fixture
def mock_adapter():
    adapter = MagicMock()
    adapter.list_files = AsyncMock()
    adapter.read_file = AsyncMock()
    return adapter


def _watch(**over):
    row = {
        "id": uuid4(),
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "org_id": uuid4(),
        "library_folder_id": None,
        "source_folder_id": "folder-123",
        "interval_minutes": 30,
    }
    row.update(over)
    return row


# ── 0. NON-VACUITY CONTROL — collected FIRST, on purpose ──────────────────────────────


@pytest.mark.asyncio
async def test_release_watch_double_is_installed_and_callable():
    """⛔ COLLECTED FIRST BY DESIGN. Every case below asserts "called once with ..." over a
    patched `release_watch`. If the patch target were wrong — a stale module path, a rename,
    an import moved to a call-site-local import — those assertions would pass over a mock
    nobody ever invoked, and the whole file would be green while recording nothing.

    So this proves, before anything else runs, that the name the other cases patch is the
    name the production module actually calls through, and that the double records the call.
    """
    real = ws.release_watch
    with patch("app.services.watch_service.release_watch", new=AsyncMock()) as double:
        assert ws.release_watch is double, "patch target does not bind the module's own name"
        assert ws.release_watch is not real
        await ws.release_watch(None, uuid4(), status="probe", counts=None)
        assert double.await_count == 1
        assert double.await_args[1]["status"] == "probe"
    # And it is restored afterwards, so a leaked patch cannot silence a later suite.
    assert ws.release_watch is real


# ── 1. SEAM 1 of 4 — tick()'s per-watch except, OUTSIDE sync_watch ────────────────────


@pytest.mark.asyncio
async def test_tick_crash_arm_records_a_run_row(mock_pool, mock_adapter):
    """SEAM 1 (`tick()`): a crash-shaped failure still gets a row, with a NAMED cause."""
    watch = _watch()
    mock_adapter.list_files.side_effect = RuntimeError("Connection reset by peer")

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch])), \
         patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        processed = await svc.tick()

        assert processed == 0
        rel.assert_awaited_once()
        assert rel.call_args[0] == (mock_pool, watch["id"])
        kw = rel.call_args[1]
        assert kw["status"] == "failed"
        assert kw["failure_cause"] == "unreachable"
        # A crash counted nothing and completed nothing.
        assert kw["counts"] is None
        assert kw["listing_complete"] is False
        # started_at is the tick's own clock, not the claim's last_run_at.
        assert isinstance(kw["started_at"], datetime)
        assert kw["started_at"].tzinfo is not None
        assert kw["user_id"] == watch["user_id"]
        assert kw["org_id"] == watch["org_id"]


@pytest.mark.asyncio
async def test_crash_arm_is_reached_from_tick_not_from_sync_watch(mock_pool):
    """⛔ THE SEAM IS IN `tick()`, NOT IN `sync_watch` — proven by removing `sync_watch`.

    `sync_watch` is replaced wholesale by a mock that raises, so not one line of its body
    executes. A row is still requested. If the run-row write had been placed inside
    `sync_watch` (the mistake this plan's objective names), this case would find NO call.
    """
    watch = _watch()

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch])), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel:

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        svc.sync_watch = AsyncMock(side_effect=RuntimeError("Google Drive API 503 Backend Error"))

        await svc.tick()

        assert svc.sync_watch.await_count == 1
        rel.assert_awaited_once()
        assert rel.call_args[1]["status"] == "failed"
        assert rel.call_args[1]["failure_cause"] == "unreachable"


# ── 2. SEAM 2 of 4 — connection disabled ("paused") ───────────────────────────────────


@pytest.mark.asyncio
async def test_paused_arm_records_a_run_row(mock_pool):
    """SEAM 2: a paused tick DID NOT READ — but it DID TICK, and every tick gets a row (D-235-07).

    ⭐ This is what makes "when did this source last successfully READ?" a different question
    from "when did it last CHANGE anything?" — the confusion that let a dead watch look fine.
    """
    watch = _watch()

    with patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel:
        svc = WatchService(pool=mock_pool, supabase=_supabase(is_enabled=False))
        res = await svc.sync_watch(watch)

        assert res["status"] == "paused"
        rel.assert_awaited_once()
        kw = rel.call_args[1]
        assert kw["status"] == "paused"
        # Zero counts, EXPLICITLY — nothing was read, and zero is the honest observation.
        assert kw["counts"] == {"new": 0, "modified": 0, "renamed": 0, "missing": 0, "restored": 0, "errors": 0}
        assert kw["listing_complete"] is False
        # ⚠ RE-BASELINED from `is None` (Phase 235 plan 13, gap-closure round 1). The pin is
        #   REWRITTEN, not deleted: the assertion that this arm names its cause is exactly the
        #   thing that used to be missing. A paused tick that recorded no cause was promoted to
        #   `stopped` with `unknown` after three cadences, and the surface then offered
        #   "Retry now" for a connection somebody switched off on purpose.
        # ⛔ THIS IS THE ONLY PLACE THE CAUSE IS WRITTEN. It is never inferred — see
        #   `test_failure_cause.py::test_connection_disabled_is_never_inferred_from_a_message`.
        assert kw["failure_cause"] == "connection_disabled"
        assert isinstance(kw["started_at"], datetime)


def test_connection_disabled_is_written_by_exactly_one_seam() -> None:
    """⛔ ONE WRITER. The literal appears in `watch_service.py` exactly once, and it is the
    `failure_cause=` keyword of the connection-disabled arm.

    A second writer would mean a second place that decides a connection is off, and the two
    could disagree about a fact only one of them read. Asserted over the live source because
    the property is about the WHOLE FILE, which no call-level mock can observe.
    """
    from pathlib import Path

    import app.services.watch_service as mod

    source = Path(mod.__file__).read_text(encoding="utf-8")
    # ⚠ NON-VACUITY — the file was actually read and does carry the seam.
    assert "is_enabled" in source
    occurrences = [
        line.strip() for line in source.splitlines() if "connection_disabled" in line
    ]
    assert len(occurrences) == 1, f"expected ONE writer, found {occurrences}"
    assert occurrences[0].startswith("failure_cause=")


# ── 3. SEAM 3 of 4 — the happy path, and the counts that used to be discarded ─────────


@pytest.mark.asyncio
async def test_success_arm_records_a_run_row_with_real_counts(mock_pool, mock_adapter):
    """SEAM 3: the counts dict computed during the pass reaches storage instead of dying.

    A RENAME is used because it exercises a real counter without minting a document — so the
    number asserted here is one the sync actually produced, not one the fixture handed over.
    """
    watch = _watch()
    item = SourceFile(id="ext-1", name="renamed.pdf", mime_type="application/pdf",
                      modified_at="2026-09-01T12:00:00Z")
    mock_adapter.list_files.return_value = FilePage(files=[item], next_page_token=None)

    tracked = {
        "id": uuid4(),
        "external_id": "ext-1",
        "name": "old_name.pdf",
        "document_id": uuid4(),
        "state": "present",
        "source_version": "2026-09-01T12:00:00Z",
    }

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock()), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        res = await svc.sync_watch(watch)

        assert res["status"] == "success"
        rel.assert_awaited_once()
        kw = rel.call_args[1]
        assert kw["status"] == "success"
        assert kw["failure_cause"] is None
        assert kw["counts"]["renamed"] == 1
        assert kw["counts"]["new"] == 0
        # The listing finished exhaustively, so the flag says so.
        assert kw["listing_complete"] is True
        # The service's own return value is unchanged in shape — nothing downstream moved.
        assert res["counts"] is kw["counts"]


# ── 4. SEAM 4 of 4 — the VIS-04 403 arm ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unauthorized_arm_records_a_run_row_with_a_named_cause(mock_pool, mock_adapter):
    """SEAM 4: the only arm carrying token_revoked / folder_gone evidence records the cause.

    ⚠ `token_revoked`, never `unknown` — a 403 whose cause we refuse to name leaves the
    surface with nothing to offer but the raw provider string.
    """
    watch = _watch()
    mock_adapter.list_files.side_effect = PermissionError(
        "403 Forbidden: Insufficient permissions for folder"
    )
    tracked = {"id": uuid4(), "external_id": "ext-1", "name": "d.pdf",
               "document_id": uuid4(), "state": "present"}

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked])), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        res = await svc.sync_watch(watch)

        assert res["status"] == "unauthorized"
        rel.assert_awaited_once()
        kw = rel.call_args[1]
        assert kw["status"] == "failed"
        assert kw["failure_cause"] == "token_revoked"
        assert kw["counts"] is None
        assert kw["listing_complete"] is False
        # The raw provider text survives as EVIDENCE, in the field it always lived in.
        assert "403 Forbidden" in kw["error"]


# ── 5. V-02 — the suppressed zero, and the flag that stops it being a lie ─────────────


@pytest.mark.asyncio
async def test_incomplete_listing_pairs_listing_complete_false_with_zero_missing(mock_pool, mock_adapter):
    """⭐ V-02 / T-235-16 — ASSERTED AS A PAIR, because the zero ALONE is the thing that misleads.

    The H-5 guard suppresses missing-state transitions when the listing did not finish, so
    `count_missing = 0` here is BY DESIGN rather than by observation. There IS a deleted
    candidate — item `ext-gone` is tracked and `present` and absent from the listing — and it
    is still not counted. Only `listing_complete = False` stops that 0 being rendered as
    "nothing was deleted", which is the Onyx #1161 lie one layer up.
    """
    watch = _watch()
    seen = SourceFile(id="ext-here", name="here.pdf", mime_type="application/pdf",
                      modified_at="2026-09-01T12:00:00Z")
    # A page-token cycle: the loop detects it and marks the listing incomplete.
    mock_adapter.list_files.side_effect = [
        FilePage(files=[seen], next_page_token="tok-1"),
        FilePage(files=[], next_page_token="tok-1"),
    ]

    tracked = [
        {"id": uuid4(), "external_id": "ext-here", "name": "here.pdf", "document_id": uuid4(),
         "state": "present", "source_version": "2026-09-01T12:00:00Z"},
        {"id": uuid4(), "external_id": "ext-gone", "name": "gone.pdf", "document_id": uuid4(),
         "state": "present", "source_version": "2026-08-01T12:00:00Z"},
    ]

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=tracked)), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock()), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()) as upd, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        await svc.sync_watch(watch)

        rel.assert_awaited_once()
        kw = rel.call_args[1]
        # ⛔ THE PAIR. Neither half means anything on its own.
        assert kw["listing_complete"] is False
        assert kw["counts"]["missing"] == 0
        # ...and the deletion really was suppressed, not merely absent from the source.
        upd.assert_not_awaited()


# ── 6. The classifier is not the substring sniff ──────────────────────────────────────


@pytest.mark.asyncio
async def test_cause_is_classified_not_substring_sniffed(mock_pool, mock_adapter):
    """⭐ A message the OLD sniff could not classify at all is named `token_revoked`.

    `watch_service.py:189-197` tests only for the literals `403` / `permission` /
    `unauthorized`. This message contains none of them, so it does NOT take the VIS-04 branch
    — it re-raises into `tick()`'s crash arm. Under the old code that failure would have
    reached the history as prose and nothing else; `classify_failure_cause` names it.
    """
    watch = _watch()
    message = "invalid_grant: Token has been expired or revoked."
    assert "403" not in message
    assert "permission" not in message.lower()
    assert "unauthorized" not in message.lower()

    mock_adapter.list_files.side_effect = RuntimeError(message)

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch])), \
         patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as rel, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=_supabase())
        await svc.tick()

        rel.assert_awaited_once()
        assert rel.call_args[1]["failure_cause"] == "token_revoked"
        assert message in rel.call_args[1]["error"]
