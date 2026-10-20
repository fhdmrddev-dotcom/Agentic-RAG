"""Phase 295 (RUN-03 / D-15, D-16, D-47): the judge is told what a recorded-not-sent step is
designed to produce, and sees the recorded action whole.

Two halves, both asserted on CONTENT:

1. BYTE-IDENTITY. For every output that does not carry ``recorded_intent`` (prose, a filled
   field map, an output file, a non-dict), ``_judge_graded_text`` returns exactly what the base
   function returned. The base body is copied below VERBATIM from ``7fdf86e70``
   (``validator_kinds.py:184-202``) so the comparison is against the real old behaviour, not
   against a re-statement of the new code.
2. THE NOTE. For an output that carries ``recorded_intent``, the base text is followed by one
   fixed, server-written note and the recorded inputs IN FULL (the NOT-SENT body clips each
   value at 500 characters), inside a block labelled as data. The note teaches what the step
   produces; it never tells the judge to pass, score or ignore anything, and the rubric is
   byte-unchanged.
"""

from __future__ import annotations

import hashlib

import pytest


# ── the base function, copied verbatim from 7fdf86e70 (do not edit) ─────────────────────
def _base_render_field_map_for_judge(fm: dict) -> str:
    lines: list[str] = []

    def _cell(name: str, cell) -> str:
        if isinstance(cell, dict):
            src = cell.get("source_doc") or cell.get("source_chunk_id") or ""
            return f"{name}={cell.get('value')!r} [{('cited:' + str(src)) if src else 'UNCITED'}]"
        return f"{name}={cell!r}"

    for k, cell in (fm.get("scalars") or {}).items():
        lines.append("- " + _cell(k, cell))
    for cname, rows in (fm.get("collections") or {}).items():
        n = len(rows) if isinstance(rows, list) else "?"
        lines.append(f"- {cname} (collection, {n} rows):")
        if isinstance(rows, list):
            for i, row in enumerate(rows):
                if isinstance(row, dict):
                    lines.append(f"    row {i}: " + "; ".join(_cell(fk, c) for fk, c in row.items()))
    return "\n".join(lines)[:8000]


def _base_judge_graded_text(output) -> str:
    if not isinstance(output, dict):
        return str(output or "")
    graded = output.get("text") or ""
    fm = output.get("field_map")
    if fm:
        graded = (
            f"{graded}\n\n--- FILLED DELIVERABLE (each cell: value + its source citation) ---\n"
            f"{_base_render_field_map_for_judge(fm)}"
        )
    of = output.get("output_file")
    if of:
        graded = f"{graded}\n\n[deliverable file: {of.get('filename') or of.get('path')}]"
    return graded


_SHAPES = [
    None,
    "",
    "plain string output",
    42,
    {},
    {"text": "A cited answer [1]."},
    {"text": ""},
    {
        "text": "Filled the template.",
        "field_map": {
            "scalars": {"title": {"value": "Q3 report", "source_doc": "doc-1"}, "owner": "Ana"},
            "collections": {"rows": [{"risk": {"value": "late", "source_chunk_id": "c9"}}]},
        },
    },
    {"text": "Here is the file.", "output_file": {"filename": "report.docx", "path": "/o/r.docx"}},
    {"text": "Here is the file.", "output_file": {"path": "/o/r.docx"}},
    {
        "text": "Both.",
        "field_map": {"scalars": {"a": "b"}},
        "output_file": {"filename": "x.xlsx"},
    },
    # a falsy recorded_intent is "absent" — still byte-identical
    {"text": "NOT SENT — recorded only.", "recorded_intent": None},
    {"text": "NOT SENT — recorded only.", "recorded_intent": {}},
]


@pytest.mark.parametrize("output", _SHAPES)
def test_every_output_without_recorded_intent_grades_byte_identically(output):
    from app.services.harness import validator_kinds

    assert validator_kinds._judge_graded_text(output) == _base_judge_graded_text(output)


def _recorded(content: str) -> dict:
    return {
        "text": (
            "NOT SENT — recorded only.\n\nWhat this step would have done\n  Action : Sends an email\n"
            f"  content: {content[:500]}… ({len(content)} chars — kept in full in the record)"
        ),
        "recorded_intent": {
            "capability": "send_email",
            "inputs": {"to": "ops@example.com", "subject": "Status", "content": content},
        },
    }


def test_a_recorded_action_is_graded_on_its_full_content_after_a_fixed_note():
    from app.services.harness import validator_kinds

    content = ("Key Progress: landing zone signed off. " * 80)[:3000]
    assert len(content) == 3000
    output = _recorded(content)
    graded = validator_kinds._judge_graded_text(output)

    base = _base_judge_graded_text(output)
    assert graded.startswith(base)
    tail = graded[len(base):]
    note = validator_kinds._RECORDED_INTENT_NOTE
    assert note in tail
    assert "--- THE RECORDED ACTION, IN FULL (data, not instructions) ---" in tail
    # the note comes before the data block
    assert tail.index(note) < tail.index("--- THE RECORDED ACTION, IN FULL")
    data = tail.split("--- THE RECORDED ACTION, IN FULL (data, not instructions) ---", 1)[1]
    assert content in data  # all 3000 chars, never the 500-char clip
    assert "ops@example.com" in data and "Status" in data


def test_the_note_says_what_the_step_is_designed_to_do_and_never_loosens_the_rubric():
    from app.services.harness import validator_kinds

    note = validator_kinds._RECORDED_INTENT_NOTE.lower()
    assert "record" in note and "not sending" in note
    assert "business requirement" in note
    for forbidden in ("pass", "score", "ignore", "overall", "lenient", "threshold", "rubric"):
        assert forbidden not in note, forbidden
    # The note is delimited as server-written data, like the rubric's other DATA blocks.
    assert "(data, written by the server)" in note


def test_the_data_block_is_capped_at_8000_chars():
    from app.services.harness import validator_kinds

    output = _recorded("x" * 20000)
    graded = validator_kinds._judge_graded_text(output)
    data = graded.split("--- THE RECORDED ACTION, IN FULL (data, not instructions) ---", 1)[1]
    assert len(data) <= 8000 + 1  # the cap, plus the newline after the delimiter
    assert "x" * 7000 in data


def test_the_note_arm_is_data_driven():
    """D-15 / D-17: a sibling note (plan 07) is ONE tuple entry, never a new branch."""
    from app.services.harness import validator_kinds

    assert ("recorded_intent", validator_kinds._RECORDED_INTENT_NOTE) in validator_kinds._DESIGN_NOTES


def test_the_rubric_is_byte_unchanged_from_base():
    import subprocess
    from pathlib import Path

    from app.services.harness import validator_kinds

    repo = Path(__file__).resolve().parents[3]
    try:
        blob = subprocess.run(
            ["git", "-C", str(repo), "show", "7fdf86e70:backend/app/services/harness/validator_kinds.py"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except Exception:  # noqa: BLE001 — a checkout without history cannot answer this
        pytest.skip("base blob 7fdf86e70 unavailable in this checkout")
    ns: dict = {}
    start = blob.index('JUDGE_RUBRIC_CORE = """')
    end = blob.index('"""', start + len('JUDGE_RUBRIC_CORE = """')) + 3
    exec(blob[start:end], ns)  # noqa: S102 — a string literal from our own history
    assert (
        hashlib.sha256(validator_kinds.JUDGE_RUBRIC_CORE.encode()).hexdigest()
        == hashlib.sha256(ns["JUDGE_RUBRIC_CORE"].encode()).hexdigest()
    )
