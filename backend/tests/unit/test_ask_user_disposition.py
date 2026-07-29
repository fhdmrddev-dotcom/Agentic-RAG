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


def _armed_phase(slug="send-the-notice"):
    """Phase 185 (GOVERN-03) — a phase carrying the ARMED action-risk pre-gate, as
    ``grounding.effective_phase`` synthesizes it: ``timing="pre"``,
    ``on_failure="ask_user"``, ``max_retries=0``, prompt in ``config``."""
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug=slug,
        phase_index=1,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[
            ValidatorSpec(
                kind="action_risk_approval",
                timing="pre",
                on_failure="ask_user",
                max_retries=0,
                config={"prompt": "Step 2 of 4 is about to run."},
            )
        ],
    )


_ARMED_FINDING = "action_risk:approval|Step 2 of 4 is about to run."


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


def test_version_ambiguity_choices_are_honest():
    """WR-08: a ``freshness:version_ambiguity|`` finding presents the HONEST pair
    ["Proceed despite version ambiguity", "Abort"] — NOT "Use newest version" /
    "Use as-is" (both old non-abort choices routed identically to Proceed but implied
    unimplemented version-scoped retrieval). The staleness branch is unchanged."""
    from app.services.harness_engine import _ask_user_choices_from_finding

    version = _ask_user_choices_from_finding(
        "freshness:version_ambiguity|report-v2.docx,report-v3.docx"
    )
    assert version == ["Proceed despite version ambiguity", "Abort"]
    # The dishonest version-selection wording is gone.
    assert "Use newest version" not in version
    assert "Use as-is" not in version

    # The staleness branch is untouched (honest Proceed/Abort pair as before).
    staleness = _ask_user_choices_from_finding("freshness:staleness|400d old")
    assert staleness == ["Proceed anyway", "Abort"]

    # The generic fallback is untouched.
    generic = _ask_user_choices_from_finding("some other finding")
    assert generic == ["Proceed anyway", "Abort"]


def test_version_ambiguity_proceed_records_v1_cut_note():
    """WR-08: a Proceed on a version-ambiguity finding writes the
    ``validator_ask_user_approved`` receipt carrying the ``version_ambiguity_v1_cut``
    metadata note (the honest record that the user approved continuing with UNFILTERED
    retrieval); a staleness Proceed receipt does NOT carry the note."""
    from app.services import harness_engine

    # ── version-ambiguity Proceed → the v1-cut note is on the receipt ──
    write_audit = AsyncMock()
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "Proceed despite version ambiguity"}
    )
    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(),
                "freshness:version_ambiguity|report-v2.docx,report-v3.docx",
                0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )
    assert outcome is None  # pre-gate Proceed → run the body
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert "version_ambiguity_v1_cut" in kwargs["metadata"]
    assert "version-scoped retrieval not yet implemented" in kwargs["metadata"][
        "version_ambiguity_v1_cut"
    ]

    # ── a staleness Proceed receipt does NOT carry the note ──
    write_audit2 = AsyncMock()
    subscribe2 = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})
    with patch.object(harness_engine, "write_audit", write_audit2), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe2):
        asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _phase(), "freshness:staleness|400d old", 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )
    _, kwargs2 = write_audit2.await_args
    assert "version_ambiguity_v1_cut" not in kwargs2["metadata"]


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


# ══ Phase 185 (GOVERN-03 / L-4) — the armed action-risk checkpoint's choices ═══
#
# The fail-open being closed here: the routing is asymmetric. An abort-like choice
# fails the run; EVERYTHING ELSE falls through to Proceed, writes a
# ``validator_ask_user_approved`` receipt and runs the step. Before this plan
# ``_is_abort_choice`` matched only ("abort","cancel","stop",""), so an armed
# checkpoint's "Do not run it" was read as APPROVAL.


def test_action_risk_choices_are_about_the_step_not_a_finding():
    """The ``action_risk:approval|`` prefix yields the armed pair. Nothing was flagged
    on an armed step — the author simply said a person decides first — so the wording is
    about the STEP ("Approve and run this step" / "Do not run it"), not about proceeding
    despite a problem. The three shipped freshness/generic branches are untouched."""
    from app.services.harness_engine import _ask_user_choices_from_finding

    armed = _ask_user_choices_from_finding(_ARMED_FINDING)
    assert armed == ["Approve and run this step", "Do not run it"]

    # The shipped branches are byte-identical (regression fence for the new branch).
    assert _ask_user_choices_from_finding("freshness:staleness|400d old") == [
        "Proceed anyway", "Abort"
    ]
    assert _ask_user_choices_from_finding(
        "freshness:version_ambiguity|a.docx,b.docx"
    ) == ["Proceed despite version ambiguity", "Abort"]
    assert _ask_user_choices_from_finding("anything else") == ["Proceed anyway", "Abort"]


def test_every_presented_choice_pair_is_classified():
    """THE INVARIANT GUARD (L-4), pinned instead of the instance. For EVERY finding
    prefix ``_ask_user_choices_from_finding`` branches on — plus the generic fallback —
    the returned pair must contain EXACTLY ONE abort-like choice and one that is not.

    This is deliberately stronger than "does 'Do not run it' fail_run?": it makes a
    FUTURE third choice pair impossible to add fail-open silently. Add a branch without
    extending ``_is_abort_choice`` and this test goes red on the new pair, before a user
    ever clicks a decline that runs the step."""
    from app.services.harness_engine import (
        _ask_user_choices_from_finding,
        _is_abort_choice,
    )

    findings = [
        "freshness:staleness|400d old",
        "freshness:version_ambiguity|a.docx,b.docx",
        _ARMED_FINDING,
        "some validator said something unstructured",  # the generic fallback
        "",                                            # and the empty finding
    ]

    for finding in findings:
        pair = _ask_user_choices_from_finding(finding)
        assert len(pair) == 2, f"{finding!r} did not present a two-option pair"
        aborts = [c for c in pair if _is_abort_choice(c)]
        assert len(aborts) == 1, (
            f"{finding!r} presented {pair!r}, of which {len(aborts)} classify as "
            f"abort-like — exactly one must. An UNCLASSIFIED decline reads as PROCEED "
            f"and runs the step with an 'approved' receipt (L-4)."
        )
        # And the surviving option is the one that continues.
        assert not _is_abort_choice([c for c in pair if not _is_abort_choice(c)][0])


def test_armed_decline_fails_the_run_and_writes_no_approval():
    """L-4, the instance. Clicking "Do not run it" on an armed checkpoint FAILS the run.
    No ``validator_ask_user_approved`` receipt is written — declining is not approving,
    and the ledger must not record it as such."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "Do not run it"}
    )

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(), _ARMED_FINDING, 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None, "a decline returned None — the body would RUN"
    assert outcome.kind == "fail_run"
    assert write_audit.await_count == 0


def test_armed_approval_runs_the_body_and_writes_the_receipt():
    """The other half of the pair. "Approve and run this step" on a PRE gate returns
    ``None`` (the signal: run the body) and writes the governance receipt carrying the
    chosen text — so the ledger records WHO said yes to WHAT."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "Approve and run this step"}
    )

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(), _ARMED_FINDING, 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is None  # pre-gate approval → run the body
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert kwargs["metadata"]["choice"] == "Approve and run this step"


def test_armed_empty_answer_fails_the_run():
    """An empty answer is not consent. A ``{"kind": "response"}`` carrying no text and
    no resolvable ``choice_index`` classifies as abort-like → fail_run, so a silently
    empty POST can never advance an armed step."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "", "choice_index": None}
    )

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(), _ARMED_FINDING, 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert write_audit.await_count == 0


def test_armed_decline_by_choice_index_also_fails():
    """A choice CLICK arrives as ``{response_text: "", choice_index: 1}``. The engine
    resolves index 1 of the armed pair back to "Do not run it" and fails the run — the
    click path and the typed path must route identically."""
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "", "choice_index": 1}
    )

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(), _ARMED_FINDING, 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert write_audit.await_count == 0
