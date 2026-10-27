"""Phase 292.1 D-UAT-2: a thread whose latest run is ``cap_paused`` must still open.

Measured on the 292.1 live board (2026-10-24): once a Continue re-paused, ``runs.status`` read
``cap_paused`` (allowed by the DB CHECK since migration 063) and ``GET /threads/{id}/messages``
returned HTTP 500 with ``ValidationError ... input_value='cap_paused'``, because
``MessageResponse.run_status`` listed only the five terminal/streaming values. Threads
``e901e539`` and ``a6d673d1`` were unopenable. The Literal must mirror the full CHECK.
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.models.message import MessageResponse


def _row(run_status):
    now = datetime.now(timezone.utc)
    return dict(
        id=uuid4(), thread_id=uuid4(), user_id=uuid4(), role="assistant", content="ok",
        created_at=now, updated_at=now, run_id=uuid4(), run_status=run_status,
    )


@pytest.mark.parametrize(
    "status", ["streaming", "completed", "failed", "cancelled", "timed_out", "cap_paused"]
)
def test_message_response_accepts_every_runs_status_value(status):
    assert MessageResponse(**_row(status)).run_status == status


def test_message_response_still_refuses_an_unknown_status():
    with pytest.raises(Exception):
        MessageResponse(**_row("paused_forever"))
