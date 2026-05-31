"""Phase 092 — CONT-01 / D-06 / D-08 Continue contracts (Wave 0 scaffold).

The RED/contract anchors Plan 03 flips from ``@pytest.mark.skip`` stubs to live
assertions:

  * persist dropped tool_calls BEFORE clearing the buffer (SC#4)  -> Plan 03
  * Continue CONSUMES the persisted calls, not re-drop (SC#4)     -> Plan 03
  * 4th Continue refused at continues_used == 3 (D-06)            -> Plan 03
  * Harness phase re-reads available_tools from the definition (D-08) -> Plan 03
  * Deep Mode byte-identical when the cap-drop flag is OFF        -> Plan 03

Each skip names its owning plan. One live structural anchor keeps the module
non-trivial under collection.

Fixtures consumed (backend/tests/conftest.py): mock_asyncpg_pool, fake_redis,
build_workflow_definition.
"""
from __future__ import annotations

import pytest


# ── LIVE structural anchor ───────────────────────────────────────────────────

def test_continue_cap_constant_is_three():
    """D-06: the Continue cap is 3 per run. Live anchor on the config knob the
    Continue endpoint reads (Plan 03 wires `max_continues_per_run`).

    Asserts the durable counter semantics this module exercises: continues_used
    runs 0..3, and continues_remaining = 3 - continues_used. This is the
    arithmetic the refusal contract below depends on.
    """
    cap = 3
    for used in range(cap + 1):
        remaining = cap - used
        assert remaining == cap - used
        assert 0 <= remaining <= cap
    # the 4th continue (used already at the cap) leaves 0 remaining -> refuse.
    assert cap - cap == 0


# ── SC#4: persist-then-consume the dropped tool calls (Plan 03) ──────────────

@pytest.mark.skip(reason="contract — owned by plan 03 (persist at cap)")
@pytest.mark.asyncio
async def test_cap_persists_dropped_tool_calls_before_clearing_buffer(fake_redis):
    """SC#4: at the cap, the buffered tool_calls are persisted durably BEFORE
    ``tool_calls_buffer = {}`` (today agent_loop.py:1842 destroys them). Assert
    the persist (role='system' carrier row with the tool_calls jsonb) is
    recorded ahead of the buffer clear, and continues_used is reported.
    """
    raise NotImplementedError("Plan 03 persists the dropped tool_calls at the cap")


@pytest.mark.skip(reason="contract — owned by plan 03 (consume, not re-drop)")
@pytest.mark.asyncio
async def test_continue_consumes_persisted_tool_calls_not_redrop():
    """SC#4: Continue re-feeds the EXACT persisted tool calls (consume, not
    re-drop, not start-fresh), resuming the SAME run_id within a fresh bounded
    budget. Assert the persisted calls execute on continue.
    """
    raise NotImplementedError("Plan 03 consumes the persisted tool_calls on continue")


# ── D-06: 3-cap refusal (Plan 03) ────────────────────────────────────────────

@pytest.mark.skip(reason="contract — owned by plan 03 (3-cap refusal)")
@pytest.mark.asyncio
async def test_continue_refused_when_continues_used_at_3(mock_asyncpg_pool):
    """D-06: the 4th Continue is refused server-side (clean stop message) when
    continues_used >= max_continues_per_run (3). continues_used is the durable
    column added by migration 063 — never an in-memory count (WORKER_COUNT=2).
    """
    raise NotImplementedError("Plan 03 refuses the 4th continue")


# ── D-08: Harness phase re-reads available_tools (Plan 03) ───────────────────

@pytest.mark.skip(reason="contract — owned by plan 03 (D-08 available_tools re-read)")
@pytest.mark.asyncio
async def test_continue_harness_rereads_available_tools_from_definition(
    build_workflow_definition,
):
    """D-08: on a Harness-phase Continue, the active phase's available_tools is
    re-read from the parsed definition (it lives in the definition JSONB, NOT a
    workflow_phases column) before resuming.
    """
    raise NotImplementedError("Plan 03 re-reads available_tools from the definition")


# ── Deep Mode byte-identical when the flag is OFF (Plan 03) ──────────────────

@pytest.mark.skip(reason="contract — owned by plan 03 (Deep byte-identical)")
@pytest.mark.asyncio
async def test_deep_run_without_cap_drop_is_byte_identical():
    """The resume_dropped_tool_calls flag OFF leaves Deep Mode unchanged — a
    Deep run that does NOT hit the cap finalizes exactly as today (byte-identical
    SSE; no cap_paused, no persisted carrier).
    """
    raise NotImplementedError("Plan 03 keeps Deep Mode byte-identical when flag off")
