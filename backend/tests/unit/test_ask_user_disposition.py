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


def _armed_phase(slug="send-the-notice", *, author_validators=None):
    """Phase 187 (D-187-01) — the phase the ARMED CHECKPOINT hands this helper.

    RE-SHAPED, and the reason is the whole of plan 187-06. Phase 185 expressed "armed"
    as a synthesized ``action_risk_approval`` ValidatorSpec that
    ``grounding.effective_phase`` APPENDED to ``phase.validators`` — so this fixture used
    to build that spec. ``run_gates`` is first-failure-wins and the append put the armed
    spec LAST, so any author-declared failing pre gate returned first and the armed one
    was never evaluated (SEED-137). D-187-01 hoisted the guarantee out of the author's
    list entirely: arming is now the ``action_risk_armed`` BOOLEAN on the phase, and
    ``effective_phase`` synthesizes no approval spec at all. A fixture still carrying that
    spec would be measuring a shape the engine can no longer produce.

    So this is what the hoisted checkpoint actually passes: an ``action_risk_armed=True``
    phase carrying **the author's own validators** — an empty list by default, because an
    armed phase owes nothing to the author's list, and a parametrizable set for the tests
    that need one (see the ``fail_run`` fail-open test at the bottom of this file).
    """
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug=slug,
        phase_index=1,
        config={"phase_type": "programmatic", "fn": "noop"},
        action_risk_armed=True,
        validators=[ValidatorSpec(**v) for v in (author_validators or [])],
    )


# The wire format the checkpoint sends, NOT a predicate (D-187-01). ``_resolve_failure_
# with_ask_user``'s DELTA 1 still splits the person's prompt back out of it on ``"|"``, so
# every armed drive below still passes a prefixed message. What changed is that the ARMED
# TREATMENT is now requested EXPLICITLY with ``is_action_risk=True`` rather than sniffed
# out of this string — the caller knows which gate it is, and a helper shared with the
# author's own ``ask_user`` gates must never guess.
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
                _armed_phase(), _ARMED_FINDING, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
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
                _armed_phase(), _ARMED_FINDING, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    assert outcome is None  # pre-gate approval → run the body
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert kwargs["metadata"]["choice"] == "Approve and run this step"

    # ── D-187-18 — THE GOVERNANCE-LEDGER SHAPE CHANGE, PINNED ────────────────────
    # ``metadata["validator"]`` is ``None`` on a HOISTED armed checkpoint's receipt, and
    # the key stays PRESENT. This is DELIBERATE, not an oversight. Before D-187-01 the
    # armed gate was a member of ``phase.validators``, so the receipt could name its
    # index; after the hoist the checkpoint is not in that list at all and there IS no
    # index — writing one would be a fiction. The key is kept so there is exactly ONE row
    # shape per ``event_type`` (two shapes for one event type is worse than an honest
    # null), and every pre-187 row keeps its int. Both halves are asserted so a future
    # edit can neither quietly drop the key nor quietly invent an index.
    assert "validator" in kwargs["metadata"], (
        "the receipt dropped the 'validator' key — one event_type must keep one row shape"
    )
    assert kwargs["metadata"]["validator"] is None, (
        f"the hoisted checkpoint's receipt named validator index "
        f"{kwargs['metadata']['validator']!r} — after D-187-01 it has no index (D-187-18)"
    )


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
                _armed_phase(), _ARMED_FINDING, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
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
                _armed_phase(), _ARMED_FINDING, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    assert outcome is not None
    assert outcome.kind == "fail_run"
    assert write_audit.await_count == 0


# ══ T-185-04-01 (quick-260731-3y4) — the FREE-TEXT box below those buttons ═════════
#
# The security audit of Phase 185 read the guard above as closing the threat "an
# unrecognised decline phrase must NOT read as PROCEED". It does not. The scope of
# ``test_every_presented_choice_pair_is_classified`` is the PRESENTED BUTTON LABELS,
# and the shipped ``PendingAskCard`` does not restrict the person to them: its
# ``<textarea>`` at ``:413-425`` is UNCONDITIONAL (the choice buttons are gated on
# ``options.length > 0``; the textarea is gated on nothing), ``runs.py:492-500``
# accepts ``response_text: str`` with no validation against the prompt's ``options``,
# and ``_is_abort_choice`` is exact-match membership over five literals — so a typed
# "no" walks straight past the deny-list into the PROCEED branch, runs the risky step
# and writes a ``validator_ask_user_approved`` receipt naming the person who refused.
#
# ``_ABORT_LIKE_CHOICES`` is deny-list-shaped and CANNOT be made fail-closed by
# extension; there is no finite set of ways to say no. The armed PROCEED side is
# therefore an ALLOW-LIST: exactly one string continues, the presented approve label.
#
# The tests below are a second, INDEPENDENT reading of the same seam — they guard the
# free-text box, not the buttons. The 14 tests above are untouched.


def _drive(phase, finding, payload, *, is_pre=True, is_action_risk=False):
    """Drive ONE answer through ``_resolve_failure_with_ask_user`` and return
    ``(outcome, write_audit_mock)``.

    The shipped harness every test above uses, hoisted verbatim so a table of answers
    can be driven without 18 copies of it: ``_ctx()`` (no supabase → no durable-row
    insert), ``write_audit`` patched on the engine module (the receipt counter), and
    ``ask_user_service.subscribe_for_response`` patched to hand back ``payload`` (the
    085 block primitive). No conftest, no fixture — same shape, one place.

    ``is_action_risk`` (D-187-01) requests the ARMED TREATMENT explicitly, the way the
    hoisted checkpoint does. It defaults to ``False``, so every NON-armed caller of this
    helper — including the D-14 regression fence below — drives byte-identically to what
    shipped. ``failed_idx`` follows it: an armed checkpoint has NO index into
    ``phase.validators`` (that is the whole point of the hoist), so it passes ``None``,
    while the non-armed path keeps the ``0`` it always passed.
    """
    from app.services import harness_engine

    write_audit = AsyncMock()
    subscribe = AsyncMock(return_value=payload)

    with patch.object(harness_engine, "write_audit", write_audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                phase, finding, 0, None if is_action_risk else 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=is_pre, is_action_risk=is_action_risk,
            )
        )
    return outcome, write_audit


def _typed(answer: str) -> dict:
    """The exact payload ``PendingAskCard`` publishes with NO button clicked: the
    trimmed contents of the free-text box and a null ``choice_index``."""
    return {"kind": "response", "response_text": answer, "choice_index": None}


# Every one of these reached the PROCEED branch on unfixed code. They are not exotic —
# the first eleven are how people actually type "no", and the last four are the
# near-misses that make the deny-list's shape visible.
_ARMED_NON_APPROVALS = (
    # refusals the deny-list never enumerated
    "no", "No", "nope", "don't", "do not", "decline", "reject", "not yet",
    "NO!", "absolutely not", "n",
    # near-misses of literals the deny-list DOES hold ("stop", "cancel",
    # "do not run it") — membership is exact, so a suffix defeats it
    "stop it", "cancel it", "Do not run it.",
    # affirmatives that are NOT the presented label. An allow-list refuses these too,
    # and that is correct: the run fails, the person clicks the button, nothing
    # irreversible happens on a string the engine had to guess about
    "yes", "sure", "approve",
    # THE CASE RULING, pinned. Matching is EXACT equality against the presented label
    # on the already-``.strip()``ed value — not casefold, not prefix, not substring.
    # Case-insensitive matching would be strictly MORE permissive for zero benefit:
    # no button can emit a lower-cased label (the click path resolves ``choices[0]``
    # to the exact literal), so widening only serves the typed path, which is the
    # attack surface. And the two errors are not symmetric — refusing an oddly-cased
    # approval fails a run the person can re-trigger by clicking; accepting one sends
    # the email. The engine's own words at ``harness_engine.py:1123-1127``: "a payload
    # we could not read is not consent, and the only safe reading of 'we don't know
    # what they said' is 'do not run it'."
    "approve and run this step",
)


def test_armed_typed_refusal_is_never_approval():
    """T-185-04-01. On an ARMED action-risk checkpoint, EVERY answer that is not the
    exact presented approve label routes to ``fail_run`` and writes ZERO
    ``validator_ask_user_approved`` receipts.

    Before the fix this was red on all 18 rows: each one returned ``None`` (is_pre →
    "run the body") with one approval receipt written, i.e. the risky step executed and
    the ledger recorded the refuser as having authorised it.

    The lowercase approve label is in the table on purpose — it pins the matching rule
    as EXACT equality rather than casefold. See ``_ARMED_NON_APPROVALS`` for why the
    stricter rule is also the safer one.
    """
    for answer in _ARMED_NON_APPROVALS:
        outcome, write_audit = _drive(
            _armed_phase(), _ARMED_FINDING, _typed(answer), is_action_risk=True
        )
        assert outcome is not None, (
            f"answer {answer!r} returned None on a PRE gate — the risky step body "
            f"WOULD RUN (T-185-04-01)"
        )
        assert outcome.kind == "fail_run", (
            f"answer {answer!r} routed to {outcome.kind!r}, not fail_run — an answer "
            f"the engine cannot read as the approval option is not consent"
        )
        assert write_audit.await_count == 0, (
            f"answer {answer!r} wrote {write_audit.await_count} audit row(s) — a "
            f"validator_ask_user_approved receipt on a refusal names the person who "
            f"said no as the one who authorised it (T-3y4-01)"
        )

    # POSITIVE CONTROL, same harness, same run. Without it "0 receipts" could be
    # vacuously true — this proves the counter moves and the assertions above can fail.
    outcome, write_audit = _drive(
        _armed_phase(), _ARMED_FINDING, _typed("Approve and run this step"),
        is_action_risk=True,
    )
    assert outcome is None, "the exact presented label must proceed (pre-gate → None)"
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert kwargs["metadata"]["choice"] == "Approve and run this step"


def test_armed_approval_by_choice_index_still_proceeds():
    """The CLICK path control. A button click arrives as ``{response_text: "",
    choice_index: 0}``; the engine resolves index 0 of the armed pair back to the exact
    label. The allow-list must not break the button — this is the intended path and the
    one an approving person actually uses."""
    outcome, write_audit = _drive(
        _armed_phase(), _ARMED_FINDING,
        {"kind": "response", "response_text": "", "choice_index": 0},
        is_action_risk=True,
    )

    assert outcome is None, "clicking Approve must run the body (pre-gate → None)"
    assert write_audit.await_count == 1
    _, kwargs = write_audit.await_args
    assert kwargs["event_type"] == "validator_ask_user_approved"
    assert kwargs["metadata"]["choice"] == "Approve and run this step"


def test_non_armed_free_text_fall_through_is_unchanged():
    """THE D-14 REGRESSION FENCE. The three non-armed choice pairs route byte-identically
    to today, in BOTH directions: a typed "no" still PROCEEDS (one receipt) and "Abort"
    still fails (no receipt).

    A typed "no" proceeding on a freshness gate is NOT an endorsement of that behaviour —
    it is the same fall-through, and it is recorded as a deferred item with a re-open
    trigger. SPEC Req 9 and D-14 scope the fail-closed change to ARMED checkpoints ("a
    plain llm_human_input step keeps its CURRENT timeout disposition unchanged"; "Only
    armed checkpoints change"), and no D-185-NN decision authorises widening it. Fixing
    the freshness twin here would be an unauthorised behaviour change smuggled in under a
    security fix — so this test exists to make that widening VISIBLE the moment it
    happens. Its two-sided shape is what gives it the power to notice.
    """
    non_armed_findings = (
        "freshness:staleness|newest source is 400d old (> 90d)",
        "freshness:version_ambiguity|report-v2.docx,report-v3.docx",
        "some validator said something unstructured",  # the generic fallback
    )

    for finding in non_armed_findings:
        # (a) an unrecognised free-text answer still falls through to Proceed
        outcome, write_audit = _drive(_phase(), finding, _typed("no"))
        assert outcome is None, (
            f"{finding!r}: a typed 'no' no longer proceeds — the armed allow-list has "
            f"leaked onto a non-armed pair (D-14 / SPEC Req 9 scope violation)"
        )
        assert write_audit.await_count == 1, (
            f"{finding!r}: the shipped Proceed receipt is no longer written"
        )

        # (b) and an abort-like answer still fails, with no receipt
        outcome, write_audit = _drive(_phase(), finding, _typed("Abort"))
        assert outcome is not None and outcome.kind == "fail_run", (
            f"{finding!r}: 'Abort' no longer fails the run"
        )
        assert "aborted" in (outcome.reason or "").lower(), (
            f"{finding!r}: the abort reason string moved — _is_abort_choice must stay "
            f"FIRST so every abort keeps the byte-identical '— aborted by user' reason"
        )
        assert write_audit.await_count == 0, (
            f"{finding!r}: an abort wrote an approval receipt"
        )


def test_approve_label_has_exactly_one_home():
    """The anti-drift pin. The string the armed pair PRESENTS and the string the armed
    allow-list ACCEPTS are the same object of prose, held in one constant.

    Rename the label in the presenter without the allow-list following and every armed
    approval would be refused — a run nobody can complete. Rename it in the allow-list
    alone and the gate would accept a string no button emits. Neither is possible while
    this holds. The second assertion is the other side of the same coin: the approve
    label must NEVER classify as abort-like, or the armed path would refuse its own
    approval before the allow-list ever ran.

    Equality, not identity — do not depend on CPython interning strings across code
    objects.
    """
    from app.services.harness_engine import (
        _ACTION_RISK_APPROVE_CHOICE,
        _ask_user_choices_from_finding,
        _is_abort_choice,
    )

    presented = _ask_user_choices_from_finding(_ARMED_FINDING)
    assert _ACTION_RISK_APPROVE_CHOICE == presented[0], (
        f"the allow-list holds {_ACTION_RISK_APPROVE_CHOICE!r} but the armed pair "
        f"presents {presented[0]!r} — the label and its gate have drifted (T-3y4-04)"
    )
    assert not _is_abort_choice(_ACTION_RISK_APPROVE_CHOICE), (
        "the approve label classifies as abort-like — the armed path would fail_run on "
        "its own approval before reaching the allow-list"
    )


# ══ Phase 187 (D-187-01 / RESEARCH Pitfall 4) — THE DISPOSITION FAIL-OPEN ══════
#
# The Phase-185 armed gate was a MEMBER of ``phase.validators``, so when it failed,
# ``failed_idx`` pointed at it and ``_failing_on_failure`` read the armed spec's own
# ``ask_user``. After the hoist the checkpoint has NO index — and
# ``_failing_on_failure(phase, None)`` falls back to ``validators[0]``, i.e. to an
# AUTHOR's disposition. An author who wrote ``on_failure: "fail_run"`` on an ordinary
# gate would therefore route the armed checkpoint straight into ``_route_on_failure``
# and THE PERSON WOULD NEVER BE ASKED — the same class of fail-open as the Phase-185
# BLOCKER T-185-04-01, reached by a completely different road.
#
# The SC#6 property test (``test_187_armed_checkpoint_property.py``) sees this through
# its ``pre_pass_fail_run_disposition`` row. This test asserts the same short-circuit at
# the HELPER, one layer down, so the guarantee does not depend on a single observer.


def test_armed_checkpoint_on_a_fail_run_phase_still_asks():
    """T-187-11-04. An armed checkpoint on a phase whose AUTHOR declared
    ``on_failure: "fail_run"`` still PAUSES for a person.

    ``is_action_risk=True`` must SHORT-CIRCUIT the disposition resolution entirely —
    ``_failing_on_failure`` is not consulted, so ``validators[0].on_failure`` cannot
    speak for the checkpoint. The observable is the rendezvous itself: if
    ``subscribe_for_response`` was never awaited, nobody was asked, and whatever the
    outcome says the guarantee is broken.

    The negative control is in the same test: the SAME phase and the SAME finding
    WITHOUT the parameter delegates to ``_route_on_failure`` and never subscribes — which
    is both the correct non-armed behaviour and the proof that this assertion is not
    vacuous (a helper that always subscribed would satisfy the positive half too).
    """
    from app.services import harness_engine

    author_fail_run = [{"kind": "freshness", "timing": "pre", "on_failure": "fail_run"}]

    # ── the ARMED call: the author's fail_run must not speak for the checkpoint ──
    subscribe = AsyncMock(
        return_value={"kind": "response", "response_text": "Approve and run this step"}
    )
    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe):
        outcome = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(author_validators=author_fail_run),
                _ARMED_FINDING, 0, None,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
            )
        )

    subscribe.assert_awaited(), (
        "the armed checkpoint never reached the rendezvous — the author's "
        "validators[0].on_failure='fail_run' routed it away and NOBODY WAS ASKED "
        "(RESEARCH Pitfall 4)"
    )
    assert subscribe.await_count == 1
    assert outcome is None, "an approval on a PRE gate must return None (run the body)"

    # ── the NEGATIVE CONTROL, same phase, same finding, no parameter ──
    # Without ``is_action_risk`` this is an ordinary gate failure on a phase whose first
    # validator says fail_run, so the sync mapper handles it and nobody is asked. That is
    # correct AND it proves the assertion above measures something.
    subscribe2 = AsyncMock()
    with patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe2):
        plain = asyncio.run(
            harness_engine._resolve_failure_with_ask_user(
                _armed_phase(author_validators=author_fail_run),
                _ARMED_FINDING, 0, 0,
                run_id=uuid4(), pool=object(), redis=object(), ctx=_ctx(),
                _audit_user_id=uuid4(), is_pre=True,
            )
        )
    subscribe2.assert_not_awaited()
    assert plain is not None and plain.kind == "fail_run"
