"""Phase 093 / Plan 05 — shared answer-surfacing helper — RED contract.

D-11: the harness answer surfacing (delta + sources + citations + confidence)
currently fires ONLY on the live-kickoff branch (threads.py:1268-1373). Resumed and
Continue'd workflows call run_workflow directly and NEVER reach that block → they
lose the answer. Plan 05 refactors the surfacing into ONE shared helper run_workflow
calls on its success terminal, so live + resume + Continue all surface identically.

This file pins the helper's contract: each grounding event is emitted EXACTLY ONCE
and BEFORE the terminal run_completed (mirroring _shielded_finalize ordering —
Pitfall 5 single-persist-owner). It stays skipped until 093-05 lands the shared
helper, then 093-05 removes the skip and wires the real mock-redis recorder +
mock-pool persist assertions.

asyncio_mode = auto (backend/pytest.ini).
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="093-05 owns the shared surfacing helper (D-11)")
class Test093SharedSurfacing:
    """RED contract for 093-05 — the single surfacing site on the success terminal."""

    @pytest.mark.asyncio
    async def test_grounding_events_emitted_exactly_once(self):
        """delta + sources + citations + confidence each emit EXACTLY ONCE.

        093-05 wires: a fake-redis recorder capturing _harness_emit calls in order
        + a mock asyncpg pool for the persist. Drive the shared helper with a ctx
        carrying final_output/final_source_refs/final_citations/final_confidence and
        assert each event-type appears exactly once (no double-emit / two assistant
        messages — the single-persist-owner invariant).
        """
        raise NotImplementedError("093-05 flips this GREEN")

    @pytest.mark.asyncio
    async def test_grounding_emitted_before_run_completed(self):
        """All grounding events are emitted BEFORE the terminal run_completed
        (mirrors _shielded_finalize ordering — the durable finish_run + the
        terminal run_completed emit are LAST). Assert recorded-event ordering:
        every delta/sources/citations/confidence index < run_completed index.
        """
        raise NotImplementedError("093-05 flips this GREEN")

    @pytest.mark.asyncio
    async def test_resume_and_continue_paths_surface_identically(self):
        """The resume and Continue re-entry paths reach the SAME shared helper, so a
        resumed/Continue'd workflow surfaces its answer (previously lost — only the
        live-kickoff branch surfaced). Assert the helper is invoked on all 3 paths.
        """
        raise NotImplementedError("093-05 flips this GREEN")
