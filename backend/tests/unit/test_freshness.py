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


def test_freshness_live_scope_resolves_from_subtree():
    """WR-01 (live path): a REAL ctx bag carries ``folder_subtree_ids`` (NOT
    ``scope_folder_ids`` / ``folder_scope`` — neither is ever set on a live ctx). The
    live freshness path must resolve the scope from that third fallback and RUN the
    deterministic query — it must NOT return "no KB scope context".

    No ``_freshness_probe`` on the output forces the live ctx-pool branch; the two
    freshness queries are mocked (an in-range newest age, no version collisions) so the
    gate PASSES — proving the scope resolved and the query fired."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["freshness"]

    # A ctx that carries ONLY folder_subtree_ids (the real engine/publish ctx shape) —
    # no scope_folder_ids, no folder_scope.
    ctx = SimpleNamespace(pool=object(), folder_subtree_ids=["fld-1", "fld-2"])
    # No probe on the output → the live path must run.
    output: dict = {}

    newest = AsyncMock(return_value=10.0)  # 10 days old, < max_age_days=30 → fresh
    collisions = AsyncMock(return_value=[])

    with patch(
        "app.services.harness.freshness.newest_document_age_days", newest
    ), patch("app.services.harness.freshness.exact_stem_collisions", collisions):
        result = asyncio.run(validator(output, {"max_age_days": 30}, ctx))

    # The scope resolved from folder_subtree_ids and the query ran → PASS, NOT the
    # "no KB scope context" fail.
    assert result.passed is True
    assert "no KB scope context" not in str(result.error_message)
    newest.assert_awaited_once()
    # The third fallback (folder_subtree_ids) was the resolved scope passed to the query.
    assert newest.await_args.args[1] == ["fld-1", "fld-2"]


def test_freshness_live_scope_subtree_stale_fails():
    """WR-01 (live path, stale): the SAME folder_subtree_ids resolution, but the newest
    doc is older than ``max_age_days`` → the live path fires a ``freshness:staleness|``
    finding (proving the resolved scope drives the real staleness check)."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["freshness"]
    ctx = SimpleNamespace(pool=object(), folder_subtree_ids=["fld-1"])

    newest = AsyncMock(return_value=400.0)  # 400 days old, > max_age_days=30 → stale
    collisions = AsyncMock(return_value=[])

    with patch(
        "app.services.harness.freshness.newest_document_age_days", newest
    ), patch("app.services.harness.freshness.exact_stem_collisions", collisions):
        result = asyncio.run(validator({}, {"max_age_days": 30}, ctx))

    assert result.passed is False
    assert str(result.error_message).startswith("freshness:staleness|")
