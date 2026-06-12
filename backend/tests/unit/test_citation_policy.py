"""Phase 102 (D-01 / SEED-082) — the ``citation_policy`` enum dispositions.

Plan 04 GREEN (un-marked from the Plan-01 Wave-0 RED stubs). One policy family governs
the citation gate (and the judge gate): ``strict | flag | partial | draft``. ``strict``
is the DEFAULT and stays byte-identical (today's honest-fail, handled inline in
``_exec_llm_emit`` — never routed through ``emit_policy``). Every non-strict mode marks
or blanks — never a silent pass-off of unverified data as authoritative (T-102-04-03).

``flag``/``partial``/``draft`` are pure ``emit_policy.apply_citation_policy`` transforms
over the WR-02-persisted field-map (NO new emit shot — the deterministic driver
re-renders the modified map). Imports INSIDE the body.
"""

from __future__ import annotations

import pytest


def test_strict_is_byte_identical():
    """``citation_policy="strict"`` (default) -> the uncited disposition is the existing
    state-(b) honest fail; ``apply_citation_policy`` REFUSES strict (the strict path is
    inline, never routed here) so it can never silently deliver an uncited map."""
    from app.models.harness import LlmEmitPhaseConfig
    from app.services.harness import emit_policy

    # The default is strict (the enum default, Plan 02).
    cfg = LlmEmitPhaseConfig(phase_type="llm_emit", prompt="x")
    assert cfg.citation_policy == "strict"

    # strict is the inline honest-fail path — apply_citation_policy must REFUSE it so a
    # refactor can never accidentally deliver an uncited map under strict.
    with pytest.raises(ValueError):
        emit_policy.apply_citation_policy(
            field_map={"scalars": {}, "collections": {}},
            gate={"uncited_leaves": ["k"]},
            policy="strict",
        )


def test_flag_delivers_with_marks():
    """``flag`` -> delivers WITH visible marks + a coverage summary (never silent)."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": [{"key": "k", "value": "v", "citation": None}], "rows": []},
        gate={"uncited_leaves": ["k"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "unverified" in str(applied).lower()
    assert applied.get("coverage_summary")
    # The uncited value was actually MARKED in the returned field-map.
    assert "[unverified]" in applied["field_map"]["scalars"][0]["value"]


def test_flag_marks_legacy_envelope():
    """``flag`` over the LEGACY generic envelope (the executor's legacy_map shape) marks
    the uncited scalar — leaf-name matching handles the dotted ``scalar.k`` verdict key."""
    from app.services.harness import emit_policy

    applied = emit_policy.apply_citation_policy(
        field_map={"scalars": {"k": {"value": "v", "source_chunk_id": None}}, "collections": {}},
        gate={"uncited_leaves": ["scalar.k"]},
        policy="flag",
    )
    assert applied["delivered"] is True
    assert "[unverified]" in applied["field_map"]["scalars"]["k"]["value"]


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
    # The uncited value was actually BLANKED (null-over-invent).
    assert applied["field_map"]["scalars"][0]["value"] is None


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
    # draft does NOT enforce citations — the value is delivered unmarked + unblanked.
    assert applied["field_map"]["scalars"][0]["value"] == "v"
