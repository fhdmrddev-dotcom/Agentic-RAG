"""Phase 093 / Plan 05 — shared answer-surfacing helper — GREEN.

D-11: the harness answer surfacing (delta + sources + citations + confidence)
previously fired ONLY on the live-kickoff branch (threads.py:1268-1418). Resumed and
Continue'd workflows call run_workflow directly and NEVER reached that block → they
lost the answer. Plan 05 refactored the surfacing into ONE shared helper
(``harness_engine._surface_final_answer``) invoked on ``run_workflow``'s success
terminal, so live + resume + Continue all surface IDENTICALLY.

This file pins the helper's contract (Pitfall 5 / Landmine 5 — single persist owner):
  * each grounding event (delta/sources/citations/confidence) is emitted EXACTLY ONCE,
  * the assistant message is persisted EXACTLY ONCE (no duplicate assistant message),
  * all grounding emits land BEFORE the terminal ``run_completed`` (ordering),
  * all three entry paths reach the SAME single helper on the run_workflow terminal.

asyncio_mode = auto (backend/pytest.ini).
"""
from __future__ import annotations

import json
import uuid

import pytest

from app.services import harness_engine


# ── helpers ───────────────────────────────────────────────────────────────────
def _decode_events(fake_redis):
    """Return the ordered list of emitted event-type strings from the fake redis.

    The engine's ``_emit`` XADDs ``{"data": json.dumps({"type": <t>, **fields})}``;
    the fake redis records ``(stream, {"data": <json str>})`` in ``.xadds``.
    """
    out = []
    for _stream, fields in fake_redis.xadds:
        data = fields.get("data")
        if not data:
            continue
        try:
            parsed = json.loads(data)
        except (ValueError, TypeError):
            continue
        out.append(parsed.get("type"))
    return out


def _decoded_event_payloads(fake_redis):
    """Return ordered list of decoded event payload dicts (type + fields)."""
    out = []
    for _stream, fields in fake_redis.xadds:
        data = fields.get("data")
        if not data:
            continue
        try:
            out.append(json.loads(data))
        except (ValueError, TypeError):
            continue
    return out


def _persist_call_count(mock_pool):
    """Count assistant-message INSERTs recorded on the mock pool.

    ``insert_assistant_message`` issues ONE ``pool.fetchval`` with an
    ``INSERT INTO messages ... RETURNING id`` SQL. Count those.
    """
    n = 0
    for sql, _args in mock_pool.calls:
        if "INSERT INTO messages" in sql and "RETURNING" in sql:
            n += 1
    return n


def _make_ctx(thread_id, user_id):
    """A loose ctx bag mirroring the engine's wf_ctx surface (SimpleNamespace-like)."""
    ctx = type("Ctx", (), {})()
    ctx.thread_id = str(thread_id)
    ctx.current_user = {"id": str(user_id)}
    return ctx


# ── GREEN contract ──────────────────────────────────────────────────────────
class Test093SharedSurfacing:
    """The single surfacing site on the run_workflow success terminal (D-11)."""

    @pytest.mark.asyncio
    async def test_grounding_events_emitted_exactly_once(
        self, fake_redis, mock_asyncpg_pool
    ):
        """delta + sources + citations + confidence each emit EXACTLY ONCE + persist once.

        Drives the shared helper directly with a ctx carrying
        final_output/final_source_refs/final_citations/final_confidence and asserts
        each event-type appears exactly once (no double-emit / two assistant messages
        — the single-persist-owner invariant).
        """
        run_id = uuid.uuid4()
        stream_run_id = uuid.uuid4()
        ctx = _make_ctx(uuid.uuid4(), uuid.uuid4())
        ctx.final_output = {"text": "The final synthesized answer."}
        ctx.final_source_refs = [{"document_id": "doc-1", "chunk_index": 0}]
        ctx.final_citations = [
            {"document_id": "doc-1", "chunk_index": 0, "passage": "x" * 600}
        ]
        ctx.final_confidence = {
            "level": "high", "avg_similarity": 0.91, "disclaimer": None
        }
        # insert_assistant_message → pool.fetchval RETURNING id
        mock_asyncpg_pool.set_fetchval_result(uuid.uuid4())

        msg_id = await harness_engine._surface_final_answer(
            ctx, run_id, stream_run_id, fake_redis, mock_asyncpg_pool
        )

        events = _decode_events(fake_redis)
        for ev in ("delta", "sources", "citations", "confidence"):
            assert events.count(ev) == 1, f"{ev} emitted {events.count(ev)}x, want 1"

        # citation passage truncated to 400 (mirrors the Deep SSE payload shape).
        payloads = _decoded_event_payloads(fake_redis)
        cit = next(p for p in payloads if p.get("type") == "citations")
        assert len(cit["citations"][0]["passage"]) == 400

        # SINGLE persist owner — exactly one assistant-message INSERT.
        assert _persist_call_count(mock_asyncpg_pool) == 1, "must persist exactly once"
        assert msg_id is not None

    @pytest.mark.asyncio
    async def test_grounding_emitted_before_run_completed(
        self, fake_redis, mock_asyncpg_pool, build_workflow_definition, monkeypatch
    ):
        """All grounding events emit BEFORE the terminal run_completed.

        Drives run_workflow end-to-end with a one-phase stub that returns grounded
        text, then asserts: every delta/sources/citations/confidence index <
        run_completed index, run_completed is the LAST emit, and no event emitted
        twice (Pitfall 5 double-emit guard).

        Monkeypatches ``_execute_phase`` (not the registry) so the stub output is
        deterministic regardless of which executor the registry resolves — the
        registry carries the REAL Plan-03 executors, which would otherwise make a
        live provider call.
        """
        wf = build_workflow_definition.single_phase(
            {"phase_type": "llm_single", "prompt": "Summarize."}
        )
        run_id = uuid.uuid4()
        phase_id = uuid.uuid4()
        thread_id = uuid.uuid4()
        user_id = uuid.uuid4()
        mock_asyncpg_pool.set_fetch_result(
            [{"id": phase_id, "slug": "p0", "phase_index": 0,
              "status": "pending", "output": {}}]
        )
        mock_asyncpg_pool.set_fetchval_result(uuid.uuid4())

        async def _stub_exec(phase, accumulated, ctx):
            return {
                "text": "Grounded answer.",
                "source_refs": [{"document_id": "doc-1", "chunk_index": 0}],
                "citations": [
                    {"document_id": "doc-1", "chunk_index": 0, "passage": "p"}
                ],
                "similarity_scores": [0.8],
            }

        monkeypatch.setattr(harness_engine, "_execute_phase", _stub_exec)

        ctx = _make_ctx(thread_id, user_id)
        await harness_engine.run_workflow(
            run_id, wf, ctx,
            pool=mock_asyncpg_pool, redis=fake_redis, stream_run_id=run_id,
        )

        events = _decode_events(fake_redis)
        assert "run_completed" in events, "terminal run_completed must be emitted"
        rc_idx = events.index("run_completed")
        # run_completed is the LAST emit.
        assert rc_idx == len(events) - 1, f"run_completed not last: {events}"
        # every grounding event lands BEFORE run_completed.
        for ev in ("delta", "sources", "citations", "confidence"):
            assert ev in events, f"{ev} missing from {events}"
            assert events.index(ev) < rc_idx, f"{ev} after run_completed"
            assert events.count(ev) == 1, f"{ev} double-emitted: {events}"
        assert events.count("run_completed") == 1
        # single persist owner across the full terminal path.
        assert _persist_call_count(mock_asyncpg_pool) == 1

    @pytest.mark.asyncio
    async def test_resume_and_continue_paths_surface_identically(
        self, fake_redis, mock_asyncpg_pool, build_workflow_definition, monkeypatch
    ):
        """resume + Continue reach the SAME shared helper as live (the single site).

        live kickoff, resume (_build_resume_context → run_workflow) and Continue
        (_harness_continuation → run_workflow) all surface via the ONE terminal
        ``_surface_final_answer`` invocation inside run_workflow. We spy on the helper
        and assert run_workflow invokes it exactly once on its success terminal — so
        EVERY entry path that rides run_workflow surfaces identically (previously the
        answer was lost on resume/Continue because surfacing lived only in the live
        threads.py branch).
        """
        wf = build_workflow_definition.single_phase(
            {"phase_type": "llm_single", "prompt": "Summarize."}
        )
        run_id = uuid.uuid4()
        phase_id = uuid.uuid4()
        ctx = _make_ctx(uuid.uuid4(), uuid.uuid4())
        mock_asyncpg_pool.set_fetch_result(
            [{"id": phase_id, "slug": "p0", "phase_index": 0,
              "status": "pending", "output": {}}]
        )
        mock_asyncpg_pool.set_fetchval_result(uuid.uuid4())

        calls: list[tuple] = []

        async def _spy(_ctx, _run_id, _stream_run_id, _redis, _pool):
            calls.append((_run_id, _stream_run_id))
            return "stub-msg-id"

        monkeypatch.setattr(harness_engine, "_surface_final_answer", _spy)

        async def _stub_exec(phase, accumulated, ctx_):
            return {"text": "answer"}

        monkeypatch.setattr(harness_engine, "_execute_phase", _stub_exec)
        await harness_engine.run_workflow(
            run_id, wf, ctx,
            pool=mock_asyncpg_pool, redis=fake_redis, stream_run_id=run_id,
        )

        # The single surfacing site is reached exactly once on the success terminal.
        # Because resume + Continue + live ALL ride this same run_workflow terminal,
        # they surface identically (the helper is path-agnostic).
        assert len(calls) == 1, "run_workflow must invoke the shared helper exactly once"
        assert calls[0][0] == run_id

    @pytest.mark.asyncio
    async def test_no_text_means_no_persist(self, fake_redis, mock_asyncpg_pool):
        """An empty final answer surfaces nothing and persists nothing (no empty row)."""
        run_id = uuid.uuid4()
        ctx = _make_ctx(uuid.uuid4(), uuid.uuid4())
        ctx.final_output = {"text": ""}
        ctx.final_source_refs = []
        ctx.final_citations = []
        ctx.final_confidence = None

        msg_id = await harness_engine._surface_final_answer(
            ctx, run_id, run_id, fake_redis, mock_asyncpg_pool
        )
        assert msg_id is None
        assert _persist_call_count(mock_asyncpg_pool) == 0
        assert "delta" not in _decode_events(fake_redis)
