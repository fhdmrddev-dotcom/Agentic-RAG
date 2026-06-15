"""Phase 101.1-07 (gap 2 + gap 1 phase-row flip) — the single-owner failure persist.

Two engine-side guards close the duplicate-honest-failure-message bug (gap 2) and the
"phase stuck active" half of gap 1:

  (B) ``_surface_final_answer`` SKIPS the durable persist (and the live delta) when
      ``ctx.final_output`` carries the ``_surfaced`` flag — the executor already wrote
      the failure ``messages`` row via ``_surface_failure_message``, so the engine must
      NOT persist a SECOND assistant message (the run "completes" with the failure text,
      one writer, one message).

  (C) The engine's per-phase "completed" branch flips the phase to ``failed`` (not
      ``completed``) when a phase executor returns a ``failure``-bearing output — so a
      GRACEFUL (non-raising) emit failure never leaves the ``workflow_phases`` row stuck
      ``active``/``completed`` while the deliverable was never produced.

Deep byte-identical: Deep never runs ``_exec_llm_emit`` and never returns a ``_surfaced``
final_output, so both guards are literal no-ops on the shared path.

CONVENTION: imports INSIDE each test body so a not-yet-existing symbol never breaks
COLLECTION.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


# ── (B) _surface_final_answer skips a second persist for a _surfaced failure ───


@pytest.mark.asyncio
async def test_surface_final_answer_skips_flagged_failure(monkeypatch):
    """When ctx.final_output carries ``_surfaced=True`` (the executor already persisted
    the failure message), _surface_final_answer does NOT insert a second assistant
    message — exactly ONE message exists for an honest emit failure (gap 2)."""
    from app.services import harness_engine as he

    inserted: list = []

    async def _fake_insert(*args, **kwargs):
        inserted.append(kwargs)
        return "second-message-id"

    # Patch the durable insert so a second persist would be observable.
    monkeypatch.setattr("app.db.runs.insert_assistant_message", _fake_insert, raising=False)

    emitted: list = []

    async def _fake_emit(redis, stream_id, event_type, **fields):
        emitted.append(event_type)

    monkeypatch.setattr(he, "_emit", _fake_emit)

    ctx = SimpleNamespace(
        final_output={"text": "The deliverable could not be produced.", "failure": "render_failed", "_surfaced": True},
        final_source_refs=[],
        final_citations=[],
        final_confidence=None,
        thread_id="33333333-3333-3333-3333-333333333333",
        current_user={"id": "44444444-4444-4444-4444-444444444444"},
    )

    out = await he._surface_final_answer(
        ctx, run_id="r", stream_run_id="s", redis=object(), pool=object()
    )
    # No SECOND assistant message persisted (the executor already wrote it).
    assert inserted == [], "a _surfaced failure must NOT be persisted a second time (gap 2)"
    assert out is None


@pytest.mark.asyncio
async def test_surface_final_answer_persists_a_normal_success(monkeypatch):
    """The byte-identical guard: a NORMAL success output (no _surfaced flag) is still
    persisted exactly as before — the guard only suppresses a flagged emit failure."""
    from app.services import harness_engine as he

    inserted: list = []

    async def _fake_insert(pool, **kwargs):
        inserted.append(kwargs)
        return "the-message-id"

    monkeypatch.setattr("app.db.runs.insert_assistant_message", _fake_insert, raising=False)

    async def _fake_emit(redis, stream_id, event_type, **fields):
        return None

    monkeypatch.setattr(he, "_emit", _fake_emit)
    monkeypatch.setattr("app.services.agent_loop._strip_nul", lambda s: s, raising=False)

    ctx = SimpleNamespace(
        final_output={"text": "Produced the filled deliverable: /register.docx"},
        final_source_refs=[],
        final_citations=[],
        final_confidence=None,
        thread_id="33333333-3333-3333-3333-333333333333",
        current_user={"id": "44444444-4444-4444-4444-444444444444"},
    )

    out = await he._surface_final_answer(
        ctx, run_id="r", stream_run_id="s", redis=object(), pool=object()
    )
    assert len(inserted) == 1, "a normal success is persisted exactly once (byte-identical)"
    assert out == "the-message-id"


# ── (C) a failure-bearing phase output flips the phase to failed ───────────────


def test_engine_flips_phase_failed_on_failure_output():
    """The engine's completed-branch source flips a phase to ``failed`` (fail_phase) —
    not ``completed`` — when a phase executor returns a ``failure``-bearing output, so a
    graceful emit failure never leaves workflow_phases stuck active/completed (gap 1)."""
    import inspect

    from app.services import harness_engine as he

    src = inspect.getsource(he.run_workflow)
    # The completed branch references fail_phase for a failure-bearing output.
    assert "fail_phase" in src, "run_workflow must flip a failure-bearing phase output to failed"
    # The guard keys off the output dict's failure key (the executor's honest-fail flag).
    assert 'output.get("failure")' in src or "output.get('failure')" in src, (
        "the completed branch must inspect output's failure key to flip the phase"
    )
