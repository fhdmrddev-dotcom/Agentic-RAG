"""Phase 281 (FIX-09 / BUG-260730-02) — the ONE composer of an emit step's failure cause.

``app.services.harness.emit_cause`` turns per-shot cause records into one plain-text
string: a header (D-32: the author-set step name when one exists, else "This step")
and one ``• k attempt(s) — <cause>. <Check line>`` bullet per DISTINCT cause kind.

Every pinned word is READ OFF THE MODULE, never retyped here (the runVocabulary.test.ts
idiom): a test that retypes the copy pins the test, not the product.

CONVENTION: the module is imported inside each test body so a not-yet-existing module
fails each case rather than breaking COLLECTION (the RED commit of 281-01).
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

import pytest

_MODULE_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "services" / "harness" / "emit_cause.py"
)


def _ec():
    from app.services.harness import emit_cause

    return emit_cause


def _golden_records():
    """The measured golden run 43b34171 shape (281-RESEARCH Finding 1): 9 sealed model
    calls — 7 rejected for the missing ``rows`` collection (the FIRST of them also had 2
    uncited values), and 2 narrated."""
    ec = _ec()
    records = [
        ec.shot_record(
            1, [ec.KIND_MISSING_FIELDS, ec.KIND_UNCITED], missing=["rows"], uncited=2
        )
    ]
    for n in range(2, 8):
        records.append(ec.shot_record(n, [ec.KIND_MISSING_FIELDS], missing=["rows"]))
    records.append(ec.shot_record(8, [ec.KIND_NARRATED]))
    records.append(ec.shot_record(9, [ec.KIND_NARRATED]))
    return records


# ═══════════════════════════════════════════════════════════════════════════════
# 1. The leaf invariant — asserted by AST, never by comment
# ═══════════════════════════════════════════════════════════════════════════════


def _forbidden_imports(source: str) -> list[str]:
    """Every import in ``source`` that is NOT stdlib (or ``__future__``), or that names
    ``phase_types`` / ``harness_engine`` / anything under ``app.``."""
    tree = ast.parse(source)
    bad: list[str] = []
    for node in ast.walk(tree):
        names: list[str] = []
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level:  # a relative import is package-internal by definition
                bad.append("." * node.level + (node.module or ""))
                continue
            names = [node.module or ""]
        for mod in names:
            top = mod.split(".")[0]
            if (
                "phase_types" in mod
                or "harness_engine" in mod
                or mod.startswith("app.")
                or mod == "app"
                or (top != "__future__" and top not in sys.stdlib_module_names)
            ):
                bad.append(mod)
    return bad


def test_leaf_imports_stdlib_only():
    """The 200-03 invariant: the composer never imports phase_types, harness_engine or
    anything under ``app.`` — callers import IT, function-locally."""
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert _forbidden_imports(source) == []


def test_leaf_guard_fires_on_a_planted_import(tmp_path):
    """The guard above is DRIVEN RED: a copy of the module with a planted harness import
    must be reported. The plant goes into a tmp copy, never into app code."""
    source = _MODULE_PATH.read_text(encoding="utf-8")
    planted = tmp_path / "emit_cause_planted.py"
    planted.write_text(
        source + "\nfrom app.services.harness import phase_types  # planted\n",
        encoding="utf-8",
    )
    assert _forbidden_imports(planted.read_text(encoding="utf-8")) == [
        "app.services.harness"
    ]


def test_dunder_all_is_the_pinned_contract():
    """281-03 consumes these names; a rename here without it is drift."""
    ec = _ec()
    assert ec.__all__ == [
        "KIND_MISSING_FIELDS",
        "KIND_UNCITED",
        "KIND_INVENTED",
        "KIND_NARRATED",
        "KIND_TRUNCATED",
        "KIND_PROVIDER_ERROR",
        "KIND_NO_TEMPLATE",
        "KIND_RENDER_FAILED",
        "KIND_INTEGRITY_FAILED",
        "KIND_UNEXPECTED",
        "KIND_ORDER",
        "FAILURE_TEMPLATE_FIELDS_MISSING",
        "shot_record",
        # 281-REVIEW WR-01: added deliberately — the executor attaches a terminal cause to
        # the model call it belongs to instead of counting that call twice.
        "record_terminal",
        "classify_forced_failure",
        "classify_rejection",
        "terminal_failure_value",
        "compose_emit_failure",
        # Phase 295 (D-12): added deliberately — the ONE pre-run refusal sentence for a fill
        # step with no template; lint, kickoff and the scheduler read it off the lint finding.
        "no_template_bound_sentence",
    ]
    for name in ec.__all__:
        assert hasattr(ec, name), name


def test_kind_values_and_order():
    ec = _ec()
    assert ec.KIND_ORDER == (
        "missing_fields",
        "uncited",
        "invented",
        "narrated",
        "truncated",
        "provider_error",
        "no_template_bound",
        "render_failed",
        "integrity_failed",
        "unexpected",
    )
    assert ec.KIND_ORDER == (
        ec.KIND_MISSING_FIELDS,
        ec.KIND_UNCITED,
        ec.KIND_INVENTED,
        ec.KIND_NARRATED,
        ec.KIND_TRUNCATED,
        ec.KIND_PROVIDER_ERROR,
        ec.KIND_NO_TEMPLATE,
        ec.KIND_RENDER_FAILED,
        ec.KIND_INTEGRITY_FAILED,
        ec.KIND_UNEXPECTED,
    )
    assert ec.FAILURE_TEMPLATE_FIELDS_MISSING == "template_fields_missing"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Classifiers
# ═══════════════════════════════════════════════════════════════════════════════


def test_classify_forced_failure():
    ec = _ec()
    assert ec.classify_forced_failure("provider_error", False) == ec.KIND_PROVIDER_ERROR
    assert ec.classify_forced_failure("provider_error", True) == ec.KIND_PROVIDER_ERROR
    assert ec.classify_forced_failure("model_failed_to_emit", True) == ec.KIND_TRUNCATED
    assert ec.classify_forced_failure("model_failed_to_emit", False) == ec.KIND_NARRATED


def test_classify_rejection():
    ec = _ec()
    assert ec.classify_rejection(uncited=0, invented=0, missing=["rows"], oracle_present=True) == [
        ec.KIND_MISSING_FIELDS
    ]
    # Without an oracle the executor's missing list is not a rejection cause.
    assert ec.classify_rejection(uncited=2, invented=0, missing=["rows"], oracle_present=False) == [
        ec.KIND_UNCITED
    ]
    assert ec.classify_rejection(uncited=1, invented=3, missing=["a"], oracle_present=True) == [
        ec.KIND_MISSING_FIELDS,
        ec.KIND_UNCITED,
        ec.KIND_INVENTED,
    ]


def test_terminal_failure_value():
    ec = _ec()
    assert ec.terminal_failure_value(["missing_fields"]) == "template_fields_missing"
    assert ec.terminal_failure_value(["missing_fields", "uncited"]) == "citation_gate_rejected"
    assert ec.terminal_failure_value(["invented"]) == "citation_gate_rejected"
    assert ec.terminal_failure_value(["uncited"]) == "citation_gate_rejected"


def test_shot_record_is_json_safe():
    import json

    ec = _ec()
    rec = ec.shot_record(2, [ec.KIND_MISSING_FIELDS], missing=["rows"])
    assert rec["attempt"] == 2
    assert rec["kinds"] == ["missing_fields"]
    assert rec["missing"] == ["rows"]
    assert json.loads(json.dumps(rec)) == rec
    terminal = ec.shot_record(1, [ec.KIND_NO_TEMPLATE], detail="no template uploaded")
    assert terminal["detail"] == "no template uploaded"
    assert "detail" not in ec.shot_record(1, [ec.KIND_NARRATED])


# ═══════════════════════════════════════════════════════════════════════════════
# 3. The composer
# ═══════════════════════════════════════════════════════════════════════════════


def test_empty_records_compose_to_empty_string():
    assert _ec().compose_emit_failure([]) == ""


def test_golden_run_shape():
    """9 calls, three DISTINCT causes, ordered by count; 'citation' only in its own bullet."""
    ec = _ec()
    text = ec.compose_emit_failure(_golden_records())
    lines = text.split("\n")
    assert lines[0] == "This step failed after 9 attempts:"
    assert len(lines) == 4
    assert lines[1].startswith("• 7 attempts — ")
    assert "rows" in lines[1]
    assert lines[2].startswith("• 2 attempts — ")
    assert ec._NARRATED_SENTENCE in lines[2]
    assert lines[3].startswith("• 1 attempt — ")
    assert "citation" in lines[3].lower()
    for line in lines[:3]:
        assert "citation" not in line.lower(), line


def test_full_coverage_shape_never_says_citation():
    """The SC#1 fixture: 100% citation coverage on every shot, only ``rows`` missing."""
    ec = _ec()
    records = [ec.shot_record(n, [ec.KIND_MISSING_FIELDS], missing=["rows"]) for n in (1, 2, 3)]
    text = ec.compose_emit_failure(records)
    assert "citation" not in text.lower()
    assert "citations_required" not in text
    assert text.split("\n") == [
        "This step failed after 3 attempts:",
        "• 3 attempts — "
        + ec._MISSING_FIELDS_SENTENCE.format(names="rows")
        + " "
        + ec._CHECK_LINES[ec.KIND_MISSING_FIELDS],
    ]
    assert text.split("\n")[1] == (
        "• 3 attempts — filled the template, but these fields were missing: rows. "
        "Check that the template's field names match what this step produces."
    )


def test_missing_names_first_five_then_and_n_more_in_first_seen_order():
    ec = _ec()
    records = [
        ec.shot_record(1, [ec.KIND_MISSING_FIELDS], missing=["a", "b", "c"]),
        ec.shot_record(2, [ec.KIND_MISSING_FIELDS], missing=["b", "d", "e", "f", "g"]),
    ]
    text = ec.compose_emit_failure(records)
    assert "these fields were missing: a, b, c, d, e, and 2 more." in text
    exactly_five = [ec.shot_record(1, [ec.KIND_MISSING_FIELDS], missing=list("vwxyz"))]
    assert "missing: v, w, x, y, z." in ec.compose_emit_failure(exactly_five)


def test_singular_and_plural():
    ec = _ec()
    one = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_NARRATED])])
    assert one.split("\n")[0] == "This step failed after 1 attempt:"
    assert one.split("\n")[1].startswith("• 1 attempt — ")
    two = ec.compose_emit_failure([ec.shot_record(n, [ec.KIND_NARRATED]) for n in (1, 2)])
    assert two.split("\n")[0] == "This step failed after 2 attempts:"
    assert two.split("\n")[1].startswith("• 2 attempts — ")


def test_citation_counts_single_and_merged():
    ec = _ec()
    single = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_UNCITED], uncited=2)])
    assert "the citation check failed: 2 values cited no source." in single
    merged = ec.compose_emit_failure(
        [
            ec.shot_record(1, [ec.KIND_INVENTED], invented=4),
            ec.shot_record(2, [ec.KIND_INVENTED], invented=7),
        ]
    )
    assert "up to 7 values in one attempt cited a source that was never retrieved." in merged
    one_value = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_INVENTED], invented=1)])
    assert "the citation check failed: 1 value cited a source that was never retrieved." in one_value


def test_terminal_detail_is_bounded_and_single_line():
    ec = _ec()
    text = ec.compose_emit_failure(
        [ec.shot_record(1, [ec.KIND_NO_TEMPLATE], detail="No template uploaded to this thread.")]
    )
    assert "no template is attached to this step: No template uploaded to this thread." in text
    long = ec.compose_emit_failure(
        [ec.shot_record(1, [ec.KIND_RENDER_FAILED], detail="x" * 500 + "\nsecond line")]
    )
    bullet = long.split("\n")[1]
    assert len(long.split("\n")) == 2, "a detail never breaks the one-bullet-per-line shape"
    assert "x" * 201 not in bullet
    no_detail = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_RENDER_FAILED])])
    assert "the template could not be filled in." in no_detail


@pytest.mark.parametrize("kind", [
    "missing_fields", "uncited", "invented", "narrated", "truncated",
    "provider_error", "no_template_bound", "render_failed", "integrity_failed", "unexpected",
])
def test_every_kind_composes_one_sentence_and_one_check_line(kind):
    ec = _ec()
    rec = ec.shot_record(1, [kind], missing=["rows"], uncited=1, invented=1)
    text = ec.compose_emit_failure([rec])
    lines = text.split("\n")
    assert len(lines) == 2
    bullet = lines[1]
    check = ec._CHECK_LINES[kind]
    assert check.startswith("Check ")
    assert bullet.endswith(" " + check)
    assert bullet.count("Check ") == 1
    sentence = bullet[len("• 1 attempt — "): -len(" " + check)]
    assert sentence.strip(), kind


def test_check_lines_cover_every_kind_exactly():
    ec = _ec()
    assert set(ec._CHECK_LINES) == set(ec.KIND_ORDER)


_NEVER_SAY = re.compile(r"\b(fix|soon|later|will)\b", re.IGNORECASE)


def test_no_word_promises_or_says_fix():
    """D-03 / run-honesty: worded as CHECK, never FIX, never a promise."""
    ec = _ec()
    every = [ec.shot_record(i + 1, [k], missing=list("abcdefg"), uncited=3, invented=2, detail="d")
             for i, k in enumerate(ec.KIND_ORDER)]
    text = ec.compose_emit_failure(every + every)
    assert not _NEVER_SAY.search(text), _NEVER_SAY.search(text)
    for line in ec._CHECK_LINES.values():
        assert not _NEVER_SAY.search(line), line


def test_citation_only_when_the_citation_check_failed():
    ec = _ec()
    for kind in ec.KIND_ORDER:
        text = ec.compose_emit_failure([ec.shot_record(1, [kind], missing=["rows"], uncited=1, invented=1)])
        if kind in (ec.KIND_UNCITED, ec.KIND_INVENTED):
            assert "citation" in text.lower(), kind
        else:
            assert "citation" not in text.lower(), kind


def test_provider_error_is_not_called_prose():
    ec = _ec()
    text = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_PROVIDER_ERROR])])
    assert "provider returned an error" in text
    assert "prose" not in text


# ═══════════════════════════════════════════════════════════════════════════════
# 4. D-32 — the header names the step ONLY by its author-set name
# ═══════════════════════════════════════════════════════════════════════════════


def test_named_step_header_and_byte_identical_bullets():
    ec = _ec()
    records = _golden_records()
    named = ec.compose_emit_failure(records, step_name="Write the report").split("\n")
    unnamed = ec.compose_emit_failure(records).split("\n")
    assert named[0] == 'Step "Write the report" failed after 9 attempts:'
    assert named[1:] == unnamed[1:]


@pytest.mark.parametrize("blank", [None, "", "   "])
def test_unnamed_step_reads_this_step(blank):
    ec = _ec()
    text = ec.compose_emit_failure(_golden_records(), step_name=blank)
    assert text.split("\n")[0] == "This step failed after 9 attempts:"


def test_named_step_singular():
    ec = _ec()
    text = ec.compose_emit_failure([ec.shot_record(1, [ec.KIND_NARRATED])], step_name="X")
    assert text.split("\n")[0] == 'Step "X" failed after 1 attempt:'


# ═══════════════════════════════════════════════════════════════════════════════
# 281-REVIEW WR-01 — a terminal cause rides the call it belongs to; zero calls, no count
# ═══════════════════════════════════════════════════════════════════════════════


def test_wr01_record_terminal_merges_into_the_same_call():
    ec = _ec()
    records = [ec.shot_record(n, [ec.KIND_UNCITED], uncited=1) for n in (1, 2, 3)]
    ec.record_terminal(records, 3, ec.KIND_RENDER_FAILED, detail="boom")
    assert len(records) == 3
    assert records[-1]["kinds"] == [ec.KIND_UNCITED, ec.KIND_RENDER_FAILED]
    text = ec.compose_emit_failure(records)
    assert text.split("\n")[0] == "This step failed after 3 attempts:"
    assert "• 1 attempt — the template could not be filled in: boom." in text


def test_wr01_record_terminal_appends_for_a_new_call():
    ec = _ec()
    records = [ec.shot_record(1, [ec.KIND_UNCITED], uncited=1)]
    ec.record_terminal(records, 2, ec.KIND_RENDER_FAILED)
    assert [r["attempt"] for r in records] == [1, 2]


def test_wr01_zero_call_record_is_worded_without_a_count():
    ec = _ec()
    zero = [ec.shot_record(0, [ec.KIND_NO_TEMPLATE], detail="No template uploaded to this thread.")]
    text = ec.compose_emit_failure(zero)
    assert text == (
        "This step failed:\n"
        "• No template is attached to this step: No template uploaded to this thread. "
        "Check that this step names a template."
    )
    named = ec.compose_emit_failure(zero, step_name="Write the report")
    assert named.split("\n")[0] == 'Step "Write the report" failed:'
    assert "attempt" not in named
