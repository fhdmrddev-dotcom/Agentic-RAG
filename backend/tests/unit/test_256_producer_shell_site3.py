"""Phase 256 / METER-05 site 3 (D-256-08) — the boot-sweep resume producer shell.

``resume_stranded_workflows`` mints a producer-shell ``runs`` row for every run it
re-drives and terminalizes it in a ``finally``. That finalize passed the literal
``input_tokens=None, output_tokens=None``, so every resumed run's segment read as
*never measured* even when the segment had been measured all along — the box was
sitting on ``ctx`` the whole time.

⚠ THE REQUIREMENT'S OWN COUNT IS WRONG AND IS CORRECTED RATHER THAN INHERITED.
METER-05 names two finalize sites and ``256-PREFLIGHT.md`` §4 repeats "two";
``grep -rn "input_tokens=None" backend/app`` returns **seven** argument sites plus
one default parameter (D-256-08). This file closes **site 3**; the rest belong to
other plans in this phase.

THE TWO PROPERTIES, and they pull in opposite directions on purpose:

  1. A measured segment is WRITTEN. Not ``None``, not a re-derivation — the
     values the box actually holds.
  2. An UNMEASURED segment stays ``None``/``None`` and emits the missing-usage
     warning FIRST. ⛔ Never ``0``/``0``: ``NULL`` means never measured and ``0``
     means measured as zero, and collapsing them makes an uninstrumented run
     indistinguishable from a free one (D-256-06).

⚠ GRAIN (D-256-03): the box holds the SEGMENT's spend and this shell is a
per-segment ``runs`` row, so writing segment onto segment is correct here. The
cumulative ``workflow_runs`` total is written by ``persist_run_usage`` at the
phase boundary and is a DIFFERENT grain — never sum the two tables.

T-256-07 / T-073-04: the warning carries run/provider/model IDENTIFIERS ONLY.
A token VALUE in a log line is an information-disclosure finding, and the format
string is asserted literally below for that reason.
"""

from __future__ import annotations

import logging
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services import harness_engine


_WARNING_FORMAT = "runs.usage missing for run=%s provider=%s model=%s"


class _ResumeCtx:
    """The shape ``_build_resume_context`` returns, reduced to what site 3 reads."""

    def __init__(self, producer_run_id, run_usage_box=None):
        self.producer_run_id = producer_run_id
        if run_usage_box is not None:
            self.run_usage_box = run_usage_box


async def _drive_sweep(box, *, producer_run_id=None):
    """Run ONE stranded run through the real sweep; return the finalize kwargs.

    Only the sweep's collaborators are replaced — the shell's own finally block,
    which is the code under test, is the shipped one.
    """
    run_id = uuid.uuid4()
    pid = producer_run_id or uuid.uuid4()
    finalize = AsyncMock()

    with (
        patch.object(
            harness_engine, "find_resumable_runs",
            AsyncMock(return_value=[{"run_id": run_id, "thread_id": uuid.uuid4()}]),
        ),
        patch.object(harness_engine, "claim_run", AsyncMock(return_value=True)),
        patch.object(harness_engine, "get_active_phase", AsyncMock(return_value=None)),
        patch.object(
            harness_engine, "_load_run_definition", AsyncMock(return_value=object()),
        ),
        patch.object(
            harness_engine, "_build_resume_context",
            AsyncMock(return_value=_ResumeCtx(pid, box)),
        ),
        patch.object(harness_engine, "_resume_run", AsyncMock(return_value=None)),
        patch("app.db.runs.finalize_run", finalize),
    ):
        await harness_engine.resume_stranded_workflows(pool=object(), redis=object())

    assert finalize.await_count == 1, (
        f"the shell finalize must run exactly once per resumed run; "
        f"got {finalize.await_count}"
    )
    return finalize.await_args.kwargs


# ===========================================================================
# 1. A measured segment is written
# ===========================================================================

@pytest.mark.asyncio
async def test_a_measured_segment_is_written_not_dropped():
    kwargs = await _drive_sweep({"input_tokens": 410, "output_tokens": 133})
    assert kwargs["input_tokens"] == 410
    assert kwargs["output_tokens"] == 133
    assert kwargs["status"] == "completed"


@pytest.mark.asyncio
async def test_a_partially_measured_segment_keeps_the_missing_half_none():
    """⛔ No ``or 0``, no default. An absent key stays ``None`` to the column."""
    kwargs = await _drive_sweep({"input_tokens": 77})
    assert kwargs["input_tokens"] == 77
    assert kwargs["output_tokens"] is None, (
        "an absent output_tokens key must reach the column as NULL — a 0 here "
        "would claim the segment produced nothing, which is a different fact"
    )


# ===========================================================================
# 2. An unmeasured segment stays NULL, and says so first
# ===========================================================================

@pytest.mark.asyncio
async def test_an_empty_box_writes_none_and_never_zero():
    kwargs = await _drive_sweep({})
    assert kwargs["input_tokens"] is None
    assert kwargs["output_tokens"] is None


@pytest.mark.asyncio
async def test_a_ctx_with_no_box_at_all_writes_none():
    kwargs = await _drive_sweep(None)
    assert kwargs["input_tokens"] is None
    assert kwargs["output_tokens"] is None


@pytest.mark.asyncio
async def test_the_missing_usage_warning_is_emitted_before_the_finalize(caplog):
    """The warning CONTRACT from ``db/runs.py:93-99``, honoured at this site."""
    with caplog.at_level(logging.WARNING, logger="app.services.harness_engine"):
        await _drive_sweep({})

    hits = [
        r for r in caplog.records
        if r.getMessage().startswith("runs.usage missing for run=")
    ]
    assert len(hits) == 1, (
        f"expected exactly one missing-usage warning, got {len(hits)}: "
        f"{[r.getMessage() for r in caplog.records]}"
    )


@pytest.mark.asyncio
async def test_no_warning_when_usage_was_measured(caplog):
    """The vacuity control: a warning that fires always says nothing."""
    with caplog.at_level(logging.WARNING, logger="app.services.harness_engine"):
        await _drive_sweep({"input_tokens": 5, "output_tokens": 5})

    assert not [
        r for r in caplog.records
        if r.getMessage().startswith("runs.usage missing for run=")
    ]


# ===========================================================================
# 3. T-256-07 / T-073-04 — identifiers only, never token values
# ===========================================================================

def test_the_warning_format_string_is_the_shipped_literal_and_leaks_no_values():
    src = harness_engine.__file__
    with open(src, encoding="utf-8") as fh:
        text = fh.read()

    assert text.count(_WARNING_FORMAT) == 1, (
        f"expected exactly one {_WARNING_FORMAT!r} in harness_engine.py — the "
        "format string is shared verbatim with run_producer.py so a log search "
        "finds every site at once"
    )

    start = text.index(_WARNING_FORMAT)
    window = text[start : start + 400]
    for leak in ("tokens=", "value=", "usage_dict"):
        assert leak not in window, (
            f"the missing-usage warning must carry IDENTIFIERS ONLY (T-073-04); "
            f"found {leak!r} near the call"
        )


def test_site_three_no_longer_hardcodes_a_null_usage():
    """The literal this task exists to remove is gone from the whole module.

    ⚠ This also covers the STALE COMMENT at ``:1826``, which claimed ``harness/``
    contained "two ``usage`` references in total, both ``input_tokens=None``" —
    measurably wrong (seven argument sites plus a default parameter).
    """
    with open(harness_engine.__file__, encoding="utf-8") as fh:
        text = fh.read()
    assert "input_tokens=None" not in text, (
        "harness_engine.py still hardcodes input_tokens=None somewhere — either "
        "site 3 was not closed or the stale :1826 comment still quotes the literal"
    )
