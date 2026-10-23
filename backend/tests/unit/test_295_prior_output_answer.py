"""Phase 295 plan 04 (D-10 / D-11 / D-46, BUG-261020-01): what one step hands the next.

BUG-261020-01: in the 289 Run A shape (KB step, then an approval step, then a wrap step) the
person answered "Yes" and the wrap step wrote "I can't confirm the note was approved because no
approval decision was provided." ``_prior_output_text`` handed the next step each prior step's
``text``, and a human step's ``text`` is the QUESTION. The answer sat in ``answer``, unread.

These cases pin the reader, not the executor: the stored output keeps ``text`` = the question
(the receipt and the evidence page read it), and the next step sees the question AND the answer,
labelled. The same reader carries D-11's unsourced note, which must never reach an external
action's body (Pitfall 10), so ``_latest_phase_text`` reads the raw text and skips human steps.
"""
from __future__ import annotations

from types import SimpleNamespace


QUESTION = "Approve the note?"


def _human(answer="Yes", **extra):
    return {"text": QUESTION, "answer": answer, "tool_call_id": "t1", **extra}


def _unsourced(text="The summary of the folder."):
    return {"text": text, "unsourced": {"continued_by": "u-1", "at": "2026-10-21T00:00:00Z"}}


# ── handoff_text, the one helper ────────────────────────────────────────────────────────────


def test_a_human_output_hands_over_the_question_and_the_answer_labelled():
    from app.services.harness.run_handoff import handoff_text

    assert handoff_text(_human()) == (
        "Question asked: Approve the note?\nThe person answered: Yes"
    )


def test_an_empty_answer_reads_no_answer_never_a_blank():
    from app.services.harness.run_handoff import handoff_text

    assert handoff_text(_human(answer="")) == (
        "Question asked: Approve the note?\nThe person answered: (no answer)"
    )
    assert handoff_text(_human(answer="   ")).endswith("The person answered: (no answer)")


def test_the_golden_mock_answer_is_handed_over_the_same_way():
    from app.services.harness.run_handoff import handoff_text

    out = _human(answer="Approved", _golden_run_mock=True)
    assert handoff_text(out).endswith("The person answered: Approved")


def test_an_unsourced_output_is_prefixed_by_the_note_then_the_text():
    from app.services.harness.run_handoff import handoff_text

    got = handoff_text(_unsourced())
    assert got.endswith("The summary of the folder.")
    note = got[: got.index("The summary of the folder.")]
    assert "without sources" in note
    assert "must not be presented as sourced" in note


def test_a_plain_output_is_its_text_and_nothing_else():
    from app.services.harness.run_handoff import handoff_text

    assert handoff_text({"text": "x"}) == "x"
    assert handoff_text({"text": "x", "answer": "y"}) == "x"  # no tool_call_id: not a human step
    assert handoff_text("x") is None
    assert handoff_text(None) is None
    assert handoff_text({"text": ""}) is None
    assert handoff_text({"citations": ["c1"]}) is None


def test_run_handoff_stays_a_leaf_with_no_module_level_app_import():
    import re
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/services/harness/run_handoff.py").read_text(
        encoding="utf-8"
    )
    assert re.findall(r"^(?:from app|import app)", src, flags=re.M) == []


# ── _prior_output_text: the 289 Run A shape ─────────────────────────────────────────────────


def test_the_wrap_step_input_carries_the_persons_answer():
    from app.services.harness.phase_types import _prior_output_text

    accumulated = {
        "search": {"text": "Found three notes about the renewal."},
        "approve": _human(),
    }
    got = _prior_output_text(accumulated)
    assert "The person answered: Yes" in got
    assert "Question asked: Approve the note?" in got
    assert "Found three notes about the renewal." in got


def test_the_unsourced_note_reaches_the_next_model():
    from app.services.harness.phase_types import _prior_output_text

    got = _prior_output_text({"summary": _unsourced()})
    assert "must not be presented as sourced" in got
    assert got.endswith("The summary of the folder.")


def test_prior_output_text_is_unchanged_for_plain_outputs():
    from app.services.harness.phase_types import _prior_output_text

    assert _prior_output_text({}) == ""
    assert _prior_output_text({"a": {"text": "one"}}) == "one"
    assert _prior_output_text({"a": {"text": "one"}, "b": {"x": 1}, "c": {"text": "two"}}) == (
        "one\n\ntwo"
    )


def test_phase_types_spends_one_call_on_each_helper():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/services/harness/phase_types.py").read_text(
        encoding="utf-8"
    )
    assert src.count("handoff_text(") == 1
    assert src.count("surface_unless_engine_owns(") == 1


# ── _latest_phase_text: the draft / external-action content ─────────────────────────────────


def test_latest_phase_text_skips_the_human_step_and_returns_the_produced_text():
    from app.services.harness.human_input import _latest_phase_text

    accumulated = {"summary": {"text": "The summary."}, "approve": _human()}
    assert _latest_phase_text(accumulated) == "The summary."


def test_latest_phase_text_never_carries_the_unsourced_note():
    from app.services.harness.human_input import _latest_phase_text

    assert _latest_phase_text({"summary": _unsourced()}) == "The summary of the folder."


def test_an_external_action_after_kb_summary_approve_sends_the_summary():
    from app.services.harness.phase_types import _external_action_inputs

    accumulated = {
        "search": {"text": "Raw search notes."},
        "summary": _unsourced("The status summary."),
        "approve": _human(),
    }
    resolved = _external_action_inputs(accumulated, SimpleNamespace(inputs={}))
    assert resolved["content"] == "The status summary."
    assert "without sources" not in resolved["content"]
    assert QUESTION not in resolved["content"]
