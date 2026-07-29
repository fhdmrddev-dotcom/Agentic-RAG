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


def test_output_file_valid_config_path_out_of_workspace_refused():
    """WR-07: an author-supplied ``config["path"]`` must resolve through the run's
    workspace (``get_file_by_path``) — an out-of-workspace path is REFUSED, never
    opened. With a ctx whose ``get_file_by_path`` returns None, the gate fails and
    ``assert_integrity`` is NEVER called (no raw server-filesystem open / oracle)."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["output_file_valid"]

    # An author-controlled path with NO of.get("path") — the config[path] branch.
    output = {"output_file": {"filename": "passwd.docx"}}
    config = {"path": "/etc/passwd.docx"}
    ctx = SimpleNamespace(pool=object(), thread_id="thread-1")

    # The workspace lookup says this path is NOT a workspace file → refuse.
    get_file = AsyncMock(return_value=None)
    assert_integrity = patch(
        "app.services.template_render_service.assert_integrity"
    )

    with patch("app.db.workspace.get_file_by_path", get_file), assert_integrity as ai:
        result = asyncio.run(validator(output, config, ctx))

    assert result.passed is False
    # The out-of-workspace path was refused, NOT opened.
    ai.assert_not_called()
    get_file.assert_awaited_once()


def test_output_file_valid_no_workspace_context_refused():
    """WR-07: a ``config["path"]`` with no ctx pool/thread_id to resolve it against
    fails closed ('no workspace context') — never a raw open."""
    import asyncio
    from unittest.mock import patch

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["output_file_valid"]
    output = {"output_file": {"filename": "out.docx"}}
    config = {"path": "/srv/secret.docx"}

    with patch("app.services.template_render_service.assert_integrity") as ai:
        result = asyncio.run(validator(output, config, None))  # ctx=None → no pool/thread

    assert result.passed is False
    assert "workspace" in str(result.error_message).lower()
    ai.assert_not_called()


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


# ══════════════════════════════════════════════════════════════════════════════
# Phase 185 (GOVERN-01 / GOVERN-03) — the engine-synthesized behaviours.
#
# Neither of these is ever declared by an author: ``retrieved_and_cited`` and
# ``action_risk_approval`` are both attached at run time by
# ``harness/grounding.effective_phase``. They are tested here, at the registry, so
# the BEHAVIOUR is pinned independently of the attachment seam (which
# ``test_185_engine_attachment.py`` owns).
# ══════════════════════════════════════════════════════════════════════════════

# The agent-step output shape (``_exec_llm_agent`` / ``_exec_llm_batch_agents``):
# {text, sub_run_id(s), source_refs, citations, similarity_scores}. Note what is
# NOT here and never is: ``field_map``. That absence is the whole reason the new
# mode exists (RESEARCH L-1).
def _agent_output(text: str, citations: list | None) -> dict:
    return {
        "text": text,
        "sub_run_id": "sub-1",
        "source_refs": [{"doc": "unrelated-non-kb-tool-ref"}],
        "citations": citations if citations is not None else [],
        "similarity_scores": [0.71],
    }


def test_retrieved_and_cited_fails_when_nothing_was_retrieved():
    """D-185-01 half (a): an EMPTY ``citations`` list fails the gate outright, with the
    retrieval reason — even when the text is stuffed with citation markers, which is
    exactly the fabricated-citation case the half exists to catch (T-185-03-02).
    ``source_refs`` being populated must not rescue it."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    cfg = {"mode": "retrieved_and_cited"}

    result = asyncio.run(
        validator(_agent_output("A claim [1] and another [2].", []), cfg, None)
    )
    assert result.passed is False
    assert "nothing was retrieved" in result.error_message
    assert result.error_message.startswith("citations_required: ")


def test_retrieved_and_cited_fails_when_the_answer_points_at_nothing():
    """D-185-01 half (b): real retrieval but ZERO citation markers in the text fails,
    with the marker reason (not the retrieval one)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    cfg = {"mode": "retrieved_and_cited"}

    result = asyncio.run(
        validator(
            _agent_output("Revenue grew last quarter.", [{"chunk_id": "c1"}]),
            cfg,
            None,
        )
    )
    assert result.passed is False
    assert "citation markers in the answer" in result.error_message
    assert "nothing was retrieved" not in result.error_message


def test_retrieved_and_cited_passes_when_both_halves_hold():
    """BOTH halves satisfied -> pass. The default ``min_markers`` is 1 and the default
    pattern is the shipped ``presence`` one, reused rather than re-derived."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    cfg = {"mode": "retrieved_and_cited"}

    result = asyncio.run(
        validator(
            _agent_output("Revenue grew 4% [1].", [{"chunk_id": "c1"}]),
            cfg,
            None,
        )
    )
    assert result.passed is True
    assert result.error_message is None


def test_retrieved_and_cited_never_reads_field_map():
    """THE headline landmine (RESEARCH L-1). The shipped default/emit mode returns
    ``"citations_required: no field_map on output"`` when ``output["field_map"]`` is
    absent — and NO agent step ever produces one, so attaching the shipped mode
    unchanged would fail 100% of detected steps. An agent-shaped output with no
    ``field_map`` key at all must PASS the new mode when both halves hold."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    output = _agent_output("Findings [1] and [2].", [{"chunk_id": "c1"}])
    assert "field_map" not in output  # the positive control for the claim below

    ok = asyncio.run(validator(output, {"mode": "retrieved_and_cited"}, None))
    assert ok.passed is True

    # The SAME output through the shipped deterministic mode fails on field_map —
    # this is what the new mode routes around, asserted rather than assumed.
    shipped = asyncio.run(validator(output, {"mode": "deterministic"}, None))
    assert shipped.passed is False
    assert "no field_map" in shipped.error_message


def test_action_risk_approval_always_fails_with_the_structured_prefix():
    """D-185-12: the armed pre-gate NEVER inspects ``output`` and ALWAYS fails, so the
    shipped ``on_failure: ask_user`` disposition owns the pause. The
    ``action_risk:approval|`` prefix mirrors ``freshness:staleness|`` because
    ``_ask_user_choices_from_finding`` branches on exactly that shape."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    assert "action_risk_approval" in VALIDATOR_REGISTRY
    validator = VALIDATOR_REGISTRY["action_risk_approval"]

    # An empty output and an empty config still fail, and never raise.
    bare = asyncio.run(validator({}, {}, None))
    assert bare.passed is False
    assert bare.error_message == "action_risk:approval|"

    # The engine-generated sentence rides through as the payload, verbatim.
    sentence = 'Step 2 of 4, "Send the renewal notice", is about to run.'
    withprompt = asyncio.run(
        validator(_agent_output("anything", [{"chunk_id": "c1"}]), {"prompt": sentence}, None)
    )
    assert withprompt.passed is False
    assert withprompt.error_message == "action_risk:approval|" + sentence


def test_presence_mode_is_byte_unchanged_by_the_new_mode():
    """The regression fence for sharing the branch: ``presence`` must still ignore
    ``citations`` entirely (a text-only gate) and must still emit its ORIGINAL
    message. Phase 185 added a mode, it did not change one."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    validator = VALIDATOR_REGISTRY["citations_required"]
    cfg = {"mode": "presence", "min_markers": 1}

    # Zero citations but a marker present -> presence PASSES (it never reads citations).
    passes = asyncio.run(validator(_agent_output("a claim [1]", []), cfg, None))
    assert passes.passed is True

    # No markers -> the original wording, character-identical.
    fails = asyncio.run(validator({"text": "no markers here"}, cfg, None))
    assert fails.passed is False
    assert fails.error_message == "citations_required: only 0/1 citation markers"
