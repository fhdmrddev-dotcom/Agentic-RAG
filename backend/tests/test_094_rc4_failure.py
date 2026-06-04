"""Phase 094 Plan 01 Task 3 — Wave 0 RED scaffold.  owner: Plan 04.

Seeds INV-3a (the BACKEND half of the RC-4 honesty contract): today a harness
run that fails returns WITHOUT persisting any assistant `messages` row — the
chat shows an empty "done" card instead of a failure-with-a-reason. Plan 04 adds
a `_surface_failure_message(ctx, run_id, reason, pool)` helper, called from BOTH
of `run_workflow`'s harness-only failure-return sites:

  site #1  `fail_run` outcome      (harness_engine.py ~699-709, before `return`)
  site #2  `skip_to_phase` missing-target runtime guard (~729-735, before `return`)

The invariants Plan 04 flips from skip → live (each must drive `run_workflow` to
the respective failure-return site using the existing harness test conftest
fixtures — `build_workflow_definition`, `mock_asyncpg_pool`, `fake_redis`):

  INV-3a-1  a `fail_run` outcome persists an assistant `messages` row whose
            content IS the failure reason (NOT empty, NOT a `done` card).
  INV-3a-2  the missing-skip-target runtime guard ALSO persists a failure row
            (the second return site the CONTEXT's single "~699-709" anchor
            misses — both sites need the fix).
  INV-3a-3  the empty-reason case (`reason == ""`) persists the `reason_unknown`
            sentinel content ("Failure reason not captured by the backend."),
            never an empty assistant row.
  INV-3a-4  `_shielded_finalize` is NOT in the call path of the new helper — the
            helper lives inside `harness_engine.py` and is called ONLY from the
            two harness-only failure branches, so the shared Deep+harness
            terminal path stays byte-identical (D-14 / Pitfall 2).

These are marked `pytest.mark.skip` so the suite COLLECTS without erroring while
the helper does not exist yet; Plan 04 removes the skips and lands the asserts.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 scaffold, Plan 04 implements")
@pytest.mark.asyncio
async def test_rc4_fail_run_persists_failure_message():
    """INV-3a-1: a fail_run outcome persists an assistant messages row = the reason."""
    # Plan 04: drive run_workflow to the fail_run return site (a validator gate
    # exhausted with on_failure='fail_run'); assert an assistant `messages` row is
    # inserted with content == the failure reason (NOT empty, NOT the done card).
    raise NotImplementedError("owner: Plan 04")


@pytest.mark.skip(reason="Wave 0 scaffold, Plan 04 implements")
@pytest.mark.asyncio
async def test_rc4_missing_skip_target_persists_failure_message():
    """INV-3a-2: the skip_to_phase missing-target guard ALSO persists a failure row."""
    # Plan 04: drive run_workflow to the second failure-return site (an
    # on_failure='skip_to_phase:<unknown-slug>' whose target does not exist →
    # runtime guard); assert a failure messages row is persisted there too.
    raise NotImplementedError("owner: Plan 04")


@pytest.mark.skip(reason="Wave 0 scaffold, Plan 04 implements")
@pytest.mark.asyncio
async def test_rc4_empty_reason_persists_sentinel():
    """INV-3a-3: an empty failure reason persists the reason_unknown sentinel."""
    # Plan 04: with reason == "" (or missing), assert the persisted content is the
    # sentinel "Failure reason not captured by the backend." — never an empty row.
    raise NotImplementedError("owner: Plan 04")


@pytest.mark.skip(reason="Wave 0 scaffold, Plan 04 implements")
@pytest.mark.asyncio
async def test_rc4_helper_does_not_touch_shielded_finalize():
    """INV-3a-4: the failure helper is NOT in the _shielded_finalize call path (D-14)."""
    # Plan 04: assert the shared Deep+harness terminal path (_shielded_finalize)
    # is byte-identical — the new _surface_failure_message is invoked ONLY from
    # run_workflow's two harness-only failure branches, never the shared finalize.
    raise NotImplementedError("owner: Plan 04")
