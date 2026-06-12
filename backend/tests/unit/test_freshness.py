"""Phase 102 (GATE-01) — the ``freshness`` validator (the first ``timing=pre`` gate).

Wave 0 RED stubs (Plan 01 Task 1). Two deterministic checks against the workflow's
KB scope (the 098 project-folder binding): stale sources (newest doc older than a
per-workflow ``max_age_days`` — NO global default, per CONTEXT) + version ambiguity
(exact-stem filename collision). ``on_failure=ask_user`` carries a structured finding.

All behaviors ``@pytest.mark.xfail(strict=False)`` until Plan 03 lands. Imports INSIDE
the test body (collection never breaks on an unbuilt symbol).
"""

from __future__ import annotations


def test_freshness_stale():
    """``timing="pre"``: the newest relevant document older than ``max_age_days`` ->
    ``GateResult.passed is False``."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "freshness" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["freshness"]

    # A scope whose newest doc is 400 days old, max_age_days=30 -> stale.
    old = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat()
    output = {"_freshness_probe": {"newest_doc_iso": old}}
    result = asyncio.run(validator(output, {"max_age_days": 30}, None))
    assert result.passed is False


def test_freshness_version_ambiguity_asks():
    """An exact-stem filename collision present -> the validator's failure carries a
    structured finding suitable for ``on_failure="ask_user"`` (Use version X / Use Y /
    Abort)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["freshness"]

    output = {
        "_freshness_probe": {
            "version_collisions": [["report-v2.docx", "report-v3.docx"]],
        }
    }
    result = asyncio.run(validator(output, {"max_age_days": 365, "check_versions": True}, None))
    assert result.passed is False
    # The structured finding (for the ask_user choice menu) is present.
    assert result.error_message is not None


def test_freshness_requires_max_age_days():
    """No ``max_age_days`` configured -> fails closed with a descriptive message (NO
    global default per CONTEXT — staleness is meaningless without the deliverable's
    cadence)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["freshness"]

    result = asyncio.run(validator({"_freshness_probe": {}}, {}, None))
    assert result.passed is False
    assert result.error_message is not None
    assert "max_age_days" in str(result.error_message)
