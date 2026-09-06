"""Phase 234 (LIB-08 / SURF-01 / VIS-05) — Wire models for folder watches & source sync."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class WatchCreateRequest(BaseModel):
    connection_id: UUID
    source_folder_id: str
    source_folder_name: str
    source_drive_id: str | None = None
    library_folder_id: UUID | None = None
    interval_minutes: int = Field(default=30, ge=5, le=1440)


class WatchUpdateRequest(BaseModel):
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    is_active: bool | None = None
    library_folder_id: UUID | None = None
    clear_library_folder: bool = False


class WatchItemResponse(BaseModel):
    id: UUID
    watch_id: UUID
    external_id: str
    name: str
    path_hint: str = ""
    source_version: str | None = None
    source_modified_at: datetime | None = None
    content_hash: str | None = None
    document_id: UUID | None = None
    state: str = "present"
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    missing_since: datetime | None = None
    last_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WatchResponse(BaseModel):
    id: UUID
    org_id: UUID | None = None
    user_id: UUID
    connection_id: UUID
    source_folder_id: str
    source_folder_name: str
    source_drive_id: str | None = None
    library_folder_id: UUID | None = None
    interval_minutes: int = 30
    next_run_at: datetime | None = None
    leased_until: datetime | None = None
    is_active: bool = True
    last_run_at: datetime | None = None
    last_status: str | None = "pending"
    last_error: str | None = None
    item_count: int = 0
    connection_name: str | None = None
    service_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WatchDetailResponse(WatchResponse):
    items: list[WatchItemResponse] = []


class WatchSyncResponse(BaseModel):
    """The reply to `POST /sources/watches/{id}/sync` (Phase 235 · BUG-260906-02 · D-235-14).

    ⚠ `status` stays a free string for wire compatibility, but its VALUES changed: it used to
    describe the request and now describes the outcome of asking — `"asked"` when the reader is
    live and the poke was written, `"refused"` when nothing is running to consume it.

    ⚠ `"pending"` is deliberately NOT one of those values. `_enrich_watch_rows` already
    SYNTHESISES `last_status = "pending"` at read time for a watch that has never ticked, and
    two different meanings behind one token is how a surface starts lying quietly.

    The three net-new fields default so every existing caller stays valid.
    """

    status: str
    message: str
    #: When the check was asked for — the moment the scheduler poke was written. `None` on a
    #: refusal, because a refusal writes nothing.
    next_run_at: datetime | None = None
    #: The reader's poll cadence, so the surface can say "next check within N" (D-235-16)
    #: instead of a bare spinner that reads as a hang for up to a minute.
    next_check_within_seconds: int | None = None
    #: Whether a reader process is genuinely live in THIS worker (D-235-21) — not what the
    #: instance's configuration claims.
    reader_running: bool = True


class WatchPurgeResponse(BaseModel):
    status: str
    purged_count: int
    message: str


# ══ Phase 235 (SURF-02 / SURF-03 · D-235-05 / D-235-07 / D-235-12 / D-235-21) ═════════════
#
# ⚠ APPENDED, NEVER INTERLEAVED. Plan 07 widens `WatchResponse` and `WatchSyncResponse` above
#   in the same wave; these three classes sit at the end of the file so the two plans cannot
#   collide on a line. Field names are character-for-character the contract already declared
#   in `frontend/src/lib/api/sources.ts` — a rename here is a silent `undefined` there, because
#   a TS interface over `res.json()` is an assertion, not a check.


class SyncRunResponse(BaseModel):
    """ONE stored tick of a watch — `connector_sync_runs`, 1:1.

    D-235-07: **every** tick gets a row, including the quiet ones, so *"when did it last
    successfully READ?"* is answerable rather than inferred from a `last_status` that only
    ever remembers the most recent thing that happened.

    ⚠ `count_missing = 0` ON A RUN WHOSE `listing_complete` IS FALSE DOES NOT MEAN "nothing
    was deleted". The watch loop SUPPRESSES missing-transitions when the listing was
    incomplete (the H-5 / SRC-06 structural guard), so that zero is by DESIGN, not by
    observation. `listing_complete` travels with the counts precisely so a renderer can tell
    the two apart; dropping it would make the row a confident lie.
    """

    id: UUID
    org_id: UUID | None = None
    user_id: UUID | None = None
    watch_id: UUID
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    failure_cause: str | None = None
    last_error: str | None = None
    listing_complete: bool = False
    count_new: int = 0
    count_modified: int = 0
    count_renamed: int = 0
    count_missing: int = 0
    count_restored: int = 0
    count_errors: int = 0
    created_at: datetime | None = None


class StoppedSourceResponse(BaseModel):
    """A source the SERVER has judged to have stopped reading.

    ⛔ D-235-05 — the debounce threshold is applied server-side and this list is the whole
    truth. There is deliberately no `consecutive_failures` field: exposing the count would
    invite a client to re-apply the rule, which is how the badge, the Health row and the
    source card come to disagree.

    ⚠ A watch with no run rows at all never appears here. That is `has not read yet`, not
    `stopped` — a different sentence, owned by the surface.
    """

    watch_id: UUID
    source_folder_name: str
    connection_name: str | None = None
    cause: str
    #: Whether the cause is one the next check cannot recover from (D-235-10). It changes the
    #: SENTENCE and the offered control, never the verdict — the verdict already accounted
    #: for it when it decided to stop on failure 1 rather than 3.
    hard: bool = False
    stopped_since: datetime | None = None
    last_good_at: datetime | None = None


class SourceHealthResponse(BaseModel):
    """The single polled verdict every Phase 235 source surface consumes."""

    stopped: list[StoppedSourceResponse] = []
    #: ⛔ D-235-21 — the LIVE reader process, never `settings.watch_process_enabled`. See the
    #: comment at the route: a failed start is swallowed, so the flag can read true while
    #: nothing is running.
    #:
    #: ⚠ D-235-12 — this is an INSTANCE-level fact stated ONCE. When it is False the per-watch
    #: rows stay honest (*"waiting — the reader is off"*) and `stopped` does not fill up with
    #: N identical red states: nothing is wrong with any individual source.
    reader_running: bool = False
    #: How often the server intends to check. Declared here so the surfaces can say *"next
    #: check within …"* without a second knob that could drift from the daemon's real cadence.
    poll_interval_seconds: int = 60
