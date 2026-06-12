"""Phase 102 (GATE-01) — the D-11 4th ``on_failure`` disposition: ``ask_user``.

Wave 0 RED stubs (Plan 01 Task 1). ``ask_user`` becomes a generic fourth disposition
(``fail_run`` / ``retry`` / ``skip_to_phase`` / ``ask_user``). The engine pauses via the
Phase 085 ``ask_user_service`` cross-worker machinery, presenting the validator's
structured finding as choices. Proceed continues + writes a ``validator_ask_user_approved``
receipt; Abort -> honest ``fail_run``; unanswered -> honest fail (never hung).

Behaviors targeting Plan 04 are ``@pytest.mark.xfail(strict=False)`` until it lands.
Imports INSIDE the body.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_ask_user_parsed():
    """``_parse_on_failure("ask_user")`` returns the ask_user disposition (not the
    fail_run fallback)."""
    from app.services.harness_engine import _parse_on_failure

    disposition = _parse_on_failure("ask_user")
    # The disposition kind is "ask_user" (exact shape is Plan 04's; assert it is NOT
    # silently coerced to the fail_run fallback).
    assert disposition is not None
    assert "ask_user" in str(disposition)


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_ask_user_proceed_continues_with_receipt():
    """A mocked ``subscribe_for_response`` returning a "Proceed" choice -> the phase
    continues + a ``validator_ask_user_approved`` audit receipt is written."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    # The receipt kind exists (this plan's Task 3 lockstep guarantees it).
    assert "validator_ask_user_approved" in _AUDIT_EVENT_TYPES
    # The Proceed-continues behavior (the engine calls ask_user_service, gets "Proceed",
    # continues the phase + writes the receipt) is Plan 04's to satisfy.


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_ask_user_abort_fails_run():
    """An "Abort" choice -> ``PhaseOutcome.kind == "fail_run"`` (honest fail)."""
    from app.services.harness_engine import _parse_on_failure

    disposition = _parse_on_failure("ask_user")
    assert disposition is not None
    # The Abort -> fail_run mapping is Plan 04's behavior; the disposition seam is here.


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_ask_user_unanswered_expiry_fails():
    """``subscribe_for_response`` returns None (timeout) -> honest fail, never hung —
    inheriting the existing Phase 085 ask_user expiry."""
    from app.services.harness_engine import _parse_on_failure

    disposition = _parse_on_failure("ask_user")
    assert disposition is not None
    # The expiry -> honest-fail behavior reuses the 085 machinery; Plan 04 wires it.
