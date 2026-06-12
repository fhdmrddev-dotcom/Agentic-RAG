"""Phase 102 (D-01 / SEED-082) — the ``citation_policy`` enum dispositions.

Wave 0 RED stubs (Plan 01 Task 1). One policy family governs the citation gate (and
the judge gate): ``strict | flag | partial | draft``. ``strict`` is the DEFAULT and stays
byte-identical (today's honest-fail). Every non-strict mode marks or blanks — never a
silent pass-off of unverified data as authoritative.

``test_strict_is_byte_identical`` targets Plan 04; the strict-default model field is
satisfiable at Plan 02 (the enum default exists), but the DISPOSITION behavior (what
``strict`` does to an uncited output) is Plan 04. All marked ``xfail(strict=False)``.
Imports INSIDE the body.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_strict_is_byte_identical():
    """``citation_policy="strict"`` (default) -> the uncited disposition is the existing
    state-(b) honest fail (``_emit_failure_output("citation_gate_rejected", ...)``)."""
    from app.models.harness import LlmEmitPhaseConfig

    # The default is strict (satisfied at Plan 02; the disposition is Plan 04).
    cfg = LlmEmitPhaseConfig(phase_type="llm_emit", prompt="x")
    assert cfg.citation_policy == "strict"
    # The strict -> citation_gate_rejected honest-fail disposition is Plan 04's to wire.


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_flag_delivers_with_marks():
    """``flag`` -> delivers WITH visible marks + a coverage summary in the surfaced
    message (never silent)."""
    from app.services.harness import emit_policy  # noqa: F401 — Plan 04 module

    # apply_citation_policy(field_map, gate, policy="flag") -> delivered output carries
    # visible "[unverified]" marks + a coverage summary string.
    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["k"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "unverified" in str(applied).lower() or applied.get("coverage_summary")


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_partial_blanks_uncited():
    """``partial`` -> blanks the ``gate["uncited_leaves"]`` values + a gap list; delivers."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["k"]},
        policy="partial",
    )
    assert applied["delivered"] is True
    assert applied.get("gap_list")  # the blanked-key gap list


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
def test_draft_labels_and_delivers():
    """``draft`` -> no citation enforcement, doc labeled DRAFT, delivers."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["k"]},
        policy="draft",
    )
    assert applied["delivered"] is True
    assert "draft" in str(applied).lower()
