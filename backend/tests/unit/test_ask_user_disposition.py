"""Phase 102 (GATE-01) — the D-11 4th ``on_failure`` disposition: ``ask_user``.

Plan 04 GREEN (un-marked from the Plan-01 Wave-0 RED stubs). ``ask_user`` is a
generic fourth disposition (``fail_run`` / ``retry`` / ``skip_to_phase`` /
``ask_user``). The engine pauses via the Phase 085 ``ask_user_service`` cross-worker
machinery (SUBSCRIBE-before-emit), presenting the validator's structured finding as
choices. Proceed continues + writes a ``validator_ask_user_approved`` receipt; Abort
-> honest ``fail_run``; unanswered -> honest fail (never hung).

The pause is resolved INLINE in ``_run_phase_with_gates`` via the async helper
``_resolve_failure_with_ask_user`` (the sync ``_route_on_failure`` cannot await the
user). These tests mock ``subscribe_for_response`` (the 085 block primitive) +
``write_audit`` (the receipt) per ``feedback_mock_completeness`` — all network deps
mocked, MagicMock attrs set explicitly.

Imports INSIDE the body.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest


# ── a minimal ctx + phase the helper accepts (no live redis/pool needed — mocked) ──
def _phase(slug="p", on_failure="ask_user"):
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug=slug,
        phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure=on_failure)],
    )


def _ctx():
    # A minimal ctx: no supabase (skip the durable-row insert), an emit stub, a
    # producer_run_id so the prompt emits on the producer stream.
    return SimpleNamespace(
        supabase=None, thread_id=None, current_user={"id": uuid4()},
        producer_run_id=uuid4(), emit=AsyncMock(),
    )


def test_ask_user_parsed():
    """``_parse_on_failure("ask_user")`` returns the ask_user disposition (not the
    fail_run fallback); an unknown value still fails safe to fail_run."""
    from app.services.harness_engine import _parse_on_failure

    disposition = _parse_on_failure("ask_user")
    assert disposition is not None
    assert disposition.kind == "ask_user"
    assert "ask_user" in str(disposition)

    # Unknown values still fail-safe to fail_run (T-091-18 preserved).
    assert _parse_on_failure("bogus").kind == "fail_run"
    assert _parse_on_failure("fail_run").kind == "fail_run"


def test_ask_user_proceed_continues_with_receipt():
    """A mocked ``subscribe_for_response`` returning a "Proceed" choice -> the phase
    continues (pre-gate returns None = run the body) + a ``validator_ask_user_approved``
    audit receipt is written."""
    from app.db.workflows import _AUDIT_EVENT_TYPES
    from app.services import harness_engine

    # The receipt kind exists (Plan 01/02 lockstep + live migration 070).
    assert "validator_ask_user_approved" in _AUDIT_EVENT_TYPES

    run_id = uuid4()
    redis = object()  # opaque — the helper only passes it to the mocked subscribe
    write_audit = AsyncMock()
    subscribe = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|newest source is 400d old (> 90d)",
                0, 0,
                run_id=run_id, pool=object(), redis=redis, ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    # Pre-gate Proceed -> None (signal: run the body).
    assert outcome is None
    # The governance receipt was written with the right kind + the chosen text.
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert kwargs["metadata"]["choice"] == "Proceed anyway"


def test_ask_user_proceed_post_gate_returns_completed_output():
    """A POST-gate Proceed returns ``completed`` carrying the already-produced output
    (the user approved delivering despite the finding)."""
    from app.services import harness_engine

    produced = {"text": "the deliverable", "field_map": {}}
    subscribe = AsyncMock(return_value={"kind": "response", "choice_index": 0})

    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|stale", 2, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), produced_output=produced, is_pre=False,
            )
        )

    assert outcome.kind == "completed"
    assert outcome.output is produced


def test_ask_user_abort_fails_run():
    """An "Abort" choice -> ``PhaseOutcome.kind == "fail_run"`` (honest fail); NO
    approval receipt is written."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(return_value={"kind": "response", "response_text": "Abort"})

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|stale", 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert "aborted" in (outcome.reason or "").lower()
    # An abort is NOT an approval — no validator_ask_user_approved receipt.
    assert write_audit.await_count == 0


def test_ask_user_unanswered_expiry_fails():
    """``subscribe_for_response`` returns None (timeout) -> honest fail, never hung —
    inheriting the existing Phase 085 ask_user expiry."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(return_value=None)  # the 085 expiry

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|stale", 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert "unanswered" in (outcome.reason or "").lower()
    assert write_audit.await_count == 0


def test_non_ask_user_disposition_delegates_to_route():
    """A non-ask_user disposition (fail_run) delegates to ``_route_on_failure`` — the
    helper never pauses (subscribe is never called)."""
    from app.services import harness_engine

    subscribe = AsyncMock()
    with patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(on_failure="fail_run"), "some gate error", 2, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=False,
            )
        )

    assert outcome.kind == "fail_run"
    subscribe.assert_not_awaited()
