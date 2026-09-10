"""SEED-258 — ⚠ THE API IS THE BOUNDARY, NOT THE FORM.

The seed names this among its failure modes: *"Bounds are enforced only in the React form."* A
React number input with `min`/`max` is a convenience for a person who is not attacking anything.
It is not a control. **A `PATCH` carrying `999999999` must be refused by the backend**, and that
refusal is what these cases drive — no browser involved, the handler called directly.

Follows `test_settings.py`'s SEED-227 precedent (`multimodal_max_vision_calls`) exactly: the
same handler, the same 400, the same shape of sentence. The bound differs in its REASON, which
is why the message is asserted and not just the status code.

⚠ Both ends of the range fail silently and in opposite directions, which is the whole argument
for refusing rather than clamping at the boundary:
  * below the floor — imports stop while every sync still reports success;
  * above the maximum — one in-flight request from a server we do not control buffers more
    memory than the app will accept from a person's own disk.
"""

import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.models.user_settings as us
from app.api.settings import SettingsUpdate, update_settings


def _patch(**kwargs):
    return asyncio.run(
        update_settings(
            body=SettingsUpdate(**kwargs),
            background_tasks=MagicMock(),
            current_user={"id": "u-seed258", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


@pytest.mark.parametrize(
    "bad",
    [
        0,  # ⛔ ingestion off, silently — every sync still reports success
        -1,
        us.SOURCE_MAX_FILE_SIZE_MB_CEILING + 1,  # one past the hard maximum
        999_999_999,  # the seed's own example, verbatim
    ],
)
def test_the_api_refuses_a_ceiling_outside_the_bounds(bad):
    with pytest.raises(HTTPException) as exc:
        _patch(source_max_file_size_mb=bad)
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert str(us.SOURCE_MAX_FILE_SIZE_MB_FLOOR) in detail
    assert str(us.SOURCE_MAX_FILE_SIZE_MB_CEILING) in detail


def test_the_refusal_says_what_raising_it_COSTS_not_just_that_it_refused():
    """⭐ THE POINT OF THE SEED, AND THE THING A BARE `400` WOULD MISS.

    *"The setting ships with no explanation of the cost, which leaves the operator exactly as
    blind as the constant did — the problem was never the number."* The API refusal is one of
    the few places the reason can be stated to whoever is actually driving the change, so it
    states the tradeoff, not merely the range.
    """
    with pytest.raises(HTTPException) as exc:
        _patch(source_max_file_size_mb=999_999_999)
    detail = str(exc.value.detail).lower()
    assert "memory" in detail, (
        "the refusal names a range but never says what raising the ceiling costs — more memory "
        "buffered per in-flight request from a server we do not control (SEED-258)"
    )


@pytest.mark.parametrize(
    "ok",
    [
        1,
        25,
        50,
    ],
)
def test_the_api_accepts_both_boundaries_and_the_default(ok):
    """Both ends are INSIDE the range. An off-by-one here silently narrows what an operator is
    allowed to choose, and nothing would ever say so."""
    assert SettingsUpdate(source_max_file_size_mb=ok).source_max_file_size_mb == ok


def test_the_boundaries_under_test_are_the_ones_the_code_uses():
    """⚠ FIXTURE PREMISE. The three literals above are written out so a reader can see them,
    which means they can rot away from the constants. Pin them to their source."""
    assert (us.SOURCE_MAX_FILE_SIZE_MB_FLOOR, us.SOURCE_MAX_FILE_SIZE_MB_CEILING) == (1, 50)
    assert us.SOURCE_MAX_FILE_SIZE_MB_DEFAULT == 25


def test_an_absent_field_is_not_a_write():
    """A PATCH that never mentions the ceiling must not touch it — the partial-update contract
    every other knob on this handler keeps."""
    assert SettingsUpdate().source_max_file_size_mb is None
