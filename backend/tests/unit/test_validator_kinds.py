"""Phase 102 (GATE-01) — the 5 new validation-gate library kinds.

Wave 0 RED stubs (Plan 01 Task 1). These tests target the 5 first-class validator
kinds Plan 03 registers into the closed ``VALIDATOR_REGISTRY``
(``citations_required``, ``freshness``, ``structure_check``, ``output_file_valid``,
``llm_judge_rubric`` — D-12). All behaviors are ``@pytest.mark.xfail(strict=False)``
until Plan 03 lands; that plan un-marks each stub to GREEN (the 098/099/101.1
un-mark-on-landing convention).

CONVENTION (mirrors ``test_harness_audit_emit.py``): ``from app... import ...`` is
INSIDE each test body so a not-yet-existing symbol never breaks COLLECTION; the
suite exits 0 today (xfailed, never errored on collection).
"""

from __future__ import annotations


def test_citations_required_rejects_uncited():
    """``citations_required`` (emit-output deterministic mode) wraps ``check_coverage``:
    an output whose field_map carries an uncited value FAILS the gate (D-14)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401 — registration side-effect
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "citations_required" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["citations_required"]

    # An emit-shaped output with an UNCITED leaf value (no citation sibling).
    output = {
        "field_map": {
            "scalars": [{"key": "top_risk", "value": "supply chain", "citation": None}],
            "rows": [],
        }
    }
    result = asyncio.run(validator(output, {"mode": "emit"}, None))
    assert result.passed is False


def test_citations_required_presence():
    """``citations_required`` presence mode over a text output: at least N markers
    required (D-14). No markers -> fail; markers present -> pass."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    cfg = {"mode": "presence", "min_markers": 1}

    no_markers = asyncio.run(validator({"text": "no markers here"}, cfg, None))
    assert no_markers.passed is False

    with_markers = asyncio.run(validator({"text": "a claim [1] cited"}, cfg, None))
    assert with_markers.passed is True


def test_output_file_valid_reopens():
    """``output_file_valid`` wraps ``assert_integrity`` (format-aware): a verdict-shaped
    output where the file would not re-open FAILS the gate; an unknown extension fails
    CLOSED (never crashes)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "output_file_valid" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["output_file_valid"]

    not_opened = {"output_file": {"path": "/out.docx", "opened": False}}
    result = asyncio.run(validator(not_opened, {}, None))
    assert result.passed is False

    unknown_ext = {"output_file": {"path": "/out.zzz", "bytes": b"x"}}
    closed = asyncio.run(validator(unknown_ext, {}, None))
    assert closed.passed is False  # fails closed, no crash


def test_structure_check_loose():
    """``structure_check`` loose mode: named sections present, order-insensitive,
    extras allowed (D-14). A missing section fails."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "structure_check" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["structure_check"]
    cfg = {"mode": "loose", "sections": ["Summary", "Risks"]}

    out = {"text": "## Risks\n## Summary\n## Extra"}
    ok = asyncio.run(validator(out, cfg, None))
    assert ok.passed is True  # order-insensitive, extras allowed

    missing = asyncio.run(validator({"text": "## Summary only"}, cfg, None))
    assert missing.passed is False


def test_judge_rides_forced_emit():
    """``llm_judge_rubric`` rides ``forced_emit``: a ``model_failed_to_emit`` failure
    FAILS the gate (never a silent pass); an ``overall_passed=False`` verdict FAILS."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "llm_judge_rubric" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["llm_judge_rubric"]

    # A forced-emit FAILURE verdict must fail the gate, not silently pass.
    failed_emit = {"_judge_verdict": {"failure": "model_failed_to_emit"}}
    r1 = asyncio.run(validator(failed_emit, {}, None))
    assert r1.passed is False

    # An honest overall_passed=False verdict fails the gate.
    not_passed = {"_judge_verdict": {"overall_passed": False, "criteria": []}}
    r2 = asyncio.run(validator(not_passed, {}, None))
    assert r2.passed is False
