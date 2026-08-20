"""Phase 200.1 / plan 01 — the `workflow_phases.output` shape contract.

WHY THIS FILE EXISTS. `declared_phase_measure` opened with
`if not isinstance(raw, dict): return None, None`, and the column it reads is a jsonb
**STRING SCALAR** on 484 of 484 `completed` rows (measured against the live local DB on
2026-08-20 — 527 of 588 non-null values overall). The declared per-step count was built,
gated, green and reached NOBODY, because the degradation is silent and the absent-arm
render is HONEST. A green suite is exactly the evidence that was already available when
the defect shipped, so this file's job is to hold the two halves of the repair:

  1. the read-side unwrap contract, INCLUDING a driven counterfactual that reproduces the
     old behaviour after the source is fixed — a fence that was never driven RED is a
     fence that could not fire; and
  2. the writer fence (Task 2), which proves new rows land as jsonb OBJECTS and that the
     SQL literals moved not one byte.

⚠ THE COUNTERFACTUAL IS A LOCAL RE-STATEMENT OF THE OLD GUARD, never an import of it.
Asserting against the shipped function post-fix would assert the fix against itself.
"""

import inspect
import json
import re
import subprocess
from pathlib import Path

import pytest

from app.models.thread import declared_phase_measure, phase_output_object

# The commit this plan was dispatched against. The SQL byte-identity fences below diff the
# shipped literals against THIS revision, so "only the parameter moved" is proved rather
# than claimed.
PLAN_BASE_SHA = "4ffae459cb853ed6330ad02b9deb898484fe3ea9"

REPO_ROOT = Path(__file__).resolve().parents[3]


def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


# ── the fixture the whole plan turns on ────────────────────────────────────────────────
# A real `_measure` payload, in the shape the executors write it, encoded exactly the way
# the double-encoding defect encodes it: a JSON *string* whose text is the JSON object.
MEASURE_OBJECT = {"_measure": {"count": 15, "noun": "sources"}, "text": "…"}
MEASURE_STRING_SCALAR = json.dumps(MEASURE_OBJECT)


# ═══════════════════════════════════════════════════════════════════════════════════════
# 1. THE UNWRAP CONTRACT
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_dict_passes_through_unchanged():
    """The 61 `pending`/`cancelled`/`skipped` rows already carry objects. Identity, not a copy."""
    assert phase_output_object(MEASURE_OBJECT) is MEASURE_OBJECT


def test_string_scalar_is_parsed_to_its_object():
    assert phase_output_object(MEASURE_STRING_SCALAR) == MEASURE_OBJECT


def test_none_yields_none():
    assert phase_output_object(None) is None


# ⚠ FOUR MALFORMED INPUTS, ASSERTED INDIVIDUALLY (T-200.1-01). This function is a PARSER on
# a boundary that previously carried only an `isinstance` test, and it reads content a model
# influenced. A parser that raises here 500s the run page for that run's owner.
def test_unparseable_string_degrades_to_none():
    assert phase_output_object("not json") is None


def test_json_array_is_not_an_object():
    assert phase_output_object(json.dumps([1, 2])) is None


def test_json_string_is_not_an_object():
    """A doubly-encoded string scalar whose payload is itself a bare string."""
    assert phase_output_object(json.dumps("a string")) is None


def test_non_str_non_dict_yields_none():
    assert phase_output_object(12) is None


@pytest.mark.parametrize(
    "malformed",
    ["not json", json.dumps([1, 2]), json.dumps("a string"), json.dumps(None), 12, 3.5, True, b"{}"],
)
def test_never_raises_on_anything(malformed):
    """No `pytest.raises` anywhere in this file — the contract is that it CANNOT raise."""
    assert phase_output_object(malformed) is None


# ═══════════════════════════════════════════════════════════════════════════════════════
# 2. THE REPAIR, AND THE DRIVEN COUNTERFACTUAL
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_declared_measure_now_reads_a_string_scalar_row():
    """THE REPAIR. This is the assertion the whole plan exists for."""
    assert declared_phase_measure(MEASURE_STRING_SCALAR) == (15, "sources")


def _shipped_pre_change_guard(raw: object) -> tuple[int | None, str | None]:
    """The SHIPPED pre-change predicate, re-stated locally so it keeps reproducing.

    Verbatim from `models/thread.py` at the plan's base commit:

        if not isinstance(raw, dict):
            return None, None

    ⚠ It is re-stated rather than imported BECAUSE the source is now fixed. A counterfactual
    that calls the repaired function would assert the fix against itself and pass forever.
    """
    if not isinstance(raw, dict):
        return None, None
    measure = raw.get("_measure")
    if not isinstance(measure, dict):
        return None, None
    count = measure.get("count")
    noun = measure.get("noun")
    if not isinstance(count, int) or isinstance(count, bool):
        return None, None
    if not isinstance(noun, str) or not noun:
        return None, None
    return count, noun


def test_counterfactual_the_old_guard_loses_the_measure_silently():
    """⚠ THE DEFECT, DRIVEN. Same input, old guard: `(None, None)` — AND NO EXCEPTION.

    The silence is the whole finding. Nothing logged, nothing raised, and D-07's absent arm
    renders honestly, so no test and no eye could catch it.
    """
    assert _shipped_pre_change_guard(MEASURE_STRING_SCALAR) == (None, None)


def test_counterfactual_agrees_with_the_repair_on_the_object_shape():
    """POSITIVE CONTROL for the counterfactual: it is the real old guard, not a stub that
    always returns `(None, None)`. On the object shape the two agree exactly."""
    assert _shipped_pre_change_guard(MEASURE_OBJECT) == (15, "sources")
    assert declared_phase_measure(MEASURE_OBJECT) == (15, "sources")


# ═══════════════════════════════════════════════════════════════════════════════════════
# 3. WHAT MUST NOT HAVE MOVED
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_the_honest_zero_survives_the_unwrap():
    """`0` is a real measurement of nothing; `None` is "this type declares no count"."""
    raw = json.dumps({"_measure": {"count": 0, "noun": "sources"}})
    assert declared_phase_measure(raw) == (0, "sources")


def test_bool_is_still_excluded_through_the_unwrap():
    """`bool` subclasses `int`; a stray `{"count": true}` would otherwise serialize as `1`."""
    raw = json.dumps({"_measure": {"count": True, "noun": "sources"}})
    assert declared_phase_measure(raw) == (None, None)


def test_empty_noun_is_still_rejected_through_the_unwrap():
    raw = json.dumps({"_measure": {"count": 3, "noun": ""}})
    assert declared_phase_measure(raw) == (None, None)


def test_missing_measure_key_still_yields_the_pair_of_nones():
    assert declared_phase_measure(json.dumps({"text": "no measure here"})) == (None, None)


def test_the_dict_path_is_unregressed():
    """The 61 object-shaped rows must be entirely unaffected by this change."""
    assert declared_phase_measure(MEASURE_OBJECT) == (15, "sources")
    assert declared_phase_measure({"_measure": {"count": 0, "noun": "fields"}}) == (0, "fields")
    assert declared_phase_measure({}) == (None, None)


def test_declared_phase_measure_tail_is_byte_identical_to_the_base_commit():
    """⚠ ASSERTED, NOT CLAIMED. Everything from the `_measure` dict guard downward — the
    `isinstance(count, int) and not isinstance(count, bool)` test, the non-empty `noun` test
    and the `(0, "sources")` vs `(None, None)` distinction — is unchanged byte for byte.
    Only the opening guard became an unwrap.
    """
    anchor = "    if not isinstance(measure, dict):"

    def tail(source: str) -> str:
        body = source[source.index("def declared_phase_measure"):]
        # stop at the next top-level definition
        end = body.index("\nclass ")
        return body[body.index(anchor):end]

    base = _blob_at_base("backend/app/models/thread.py")
    now = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")

    assert anchor in base, "positive control: the anchor must exist at the base commit"
    # ⚠ NON-VACUITY BEFORE CONTENTS. Two empty slices compare equal and prove nothing; this
    # repo has shipped exactly that fence before. Measured: 312 chars on both sides.
    assert len(tail(base)) > 200, "the base tail must be a real slice, not an empty one"
    assert tail(now) == tail(base)


def test_the_old_guard_literal_is_gone_from_the_function():
    """The repair landed in the shipped source, not only in this file's expectations."""
    src = inspect.getsource(declared_phase_measure)
    assert "phase_output_object(" in src
    # ⚠ COMMENT/DOCSTRING-STRIPPED: the docblock legitimately QUOTES the old guard while
    # explaining it, and a naive `in` check would read that quotation as the live code.
    code = src[src.index('"""', src.index('"""') + 3) + 3:]
    assert "if not isinstance(raw, dict)" not in code


def test_the_module_does_not_spell_the_forbidden_form_in_its_own_prose():
    """⚠ THE 187-24 TRAP, GUARDED. A NAIVE grep over the whole module must read ZERO.

    `toolNames.ts` read `3` where its guard required `0` — every hit a comment. A docblock that
    QUOTES the pre-change predicate makes the acceptance grep count the module's own prose and
    report a fix that landed as a fix that did not. `models/thread.py` therefore DESCRIBES the
    old guard and never spells it; the verbatim form lives here, in `_shipped_pre_change_guard`.
    """
    source = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")
    assert source.count("if not isinstance(raw, dict)") == 0
    # POSITIVE CONTROL: the pattern is a real one that DID appear — proved against the base blob,
    # so a typo in the needle cannot make this fence pass vacuously.
    assert _blob_at_base("backend/app/models/thread.py").count("if not isinstance(raw, dict)") == 1


def test_there_is_exactly_one_read_side_home():
    """One `phase_output_object`, defined once, in the module that already owns the read."""
    source = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")
    assert len(re.findall(r"^def phase_output_object", source, re.M)) == 1


def test_the_decision_is_recorded_in_the_source():
    """A decision that lives only in a plan file is a decision that was deleted."""
    doc = phase_output_object.__doc__ or ""
    assert "D-200.1-01" in doc
    # the sibling deferral, honoured in writing with its re-open trigger
    assert "workflow_runs.inputs" in doc
    assert "workflow_definitions.definition" in doc
    assert "WRITE path" in doc
    # the no-migration decision and ITS re-open trigger
    assert "queryable IN SQL" in doc
