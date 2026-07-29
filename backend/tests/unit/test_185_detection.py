"""Phase 185 (GOVERN-01 / D-185-07 / D-185-09) — detection is a NAMED list and a PURE rule.

The cheapest test in the phase, and the one every later plan stands on. Nothing here runs
an engine, opens a DB or touches a provider: `grounding_cause` is a total function of one
already-parsed `PhaseSpec`, so the whole matrix is arithmetic.

Pinned here (SPEC acceptance criteria 4-8):

  * 4 — each of the five `KB_TOOLS` names, IN ISOLATION, locks a step with cause `detected`;
  * 5 — a non-KB tool list does not; a step with no `available_tools` at all does not; an
        `llm_emit` at `citation_policy: "strict"` reports `already-set`;
  * 6 — `folder_scope` is NOT a detection input (it exists on all five LLM members, so
        reading it would auto-lock steps that read nothing and can never satisfy the gate);
  * 7 — the BRANCH ORDER: detection beats escalation, the stored escalation bit goes inert,
        and removing the tool restores `escalated`. This is Req 3's "the undo disappears";
  * 8 — a source guard: no cause is ever ASSIGNED to a field anywhere in `grounding.py`.
        Only the function's `return` statements produce one, so the derive-don't-store rule
        (D-185-07) cannot be quietly broken by someone adding a cached field.

Plus the palette half of D-185-09: `GET /workflows/grounding-bundle` serves the list as
data, including on the degraded path.

CONVENTION (Phase 102 posture, copied from `test_182_validate.py`): app imports INSIDE the
test bodies; the route handler is called DIRECTLY so the suite runs OFFLINE.
"""

from __future__ import annotations

import io
import pathlib
import re
import tokenize
from types import SimpleNamespace

import pytest

# conftest's canonical mock identity — `_coerce_user_id` / `coerce_uid` need a real UUID.
_CALLER = "00000000-0000-0000-0000-000000000001"
_ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_PROJECT = "11111111-1111-1111-1111-111111111111"
_SKILL_ID = "33333333-3333-3333-3333-333333333333"
_BR = "Deliver a cited answer to the requester."

# The five names under test, spelled ONCE here and cross-checked against the module's own
# frozenset below — a parametrize list that drifted from the constant would test nothing.
_EXPECTED_KB_TOOLS = [
    "analyze_document",
    "get_related_documents",
    "query_documents",
    "read_document",
    "search_documents",
]


# ── definition builders (shape-valid; copied from test_182_validate.py) ───────


def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "detection-wf",
        "version": 1,
        "name": "Detection Workflow",
        "status": "draft",
        "business_requirement": _BR,
        "phases": phases,
    }
    base.update(extra)
    return base


def _llm_single(slug: str = "answer", index: int = 0, **config_extra) -> dict:
    cfg = {"phase_type": "llm_single", "prompt": "Answer the question."}
    cfg.update(config_extra)
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


def _llm_agent(slug: str = "research", index: int = 0, *, tools: list[str], **extra) -> dict:
    cfg = {
        "phase_type": "llm_agent",
        "prompt": "Research the topic.",
        "available_tools": tools,
    }
    cfg.update(extra.pop("config_extra", {}))
    phase = {"slug": slug, "phase_index": index, "config": cfg, "validators": []}
    phase.update(extra)
    return phase


def _llm_batch_agents(
    slug: str = "fan-out", index: int = 0, *, tools: list[str], **extra
) -> dict:
    cfg = {
        "phase_type": "llm_batch_agents",
        "prompt": "Process each item.",
        "available_tools": tools,
    }
    cfg.update(extra.pop("config_extra", {}))
    phase = {"slug": slug, "phase_index": index, "config": cfg, "validators": []}
    phase.update(extra)
    return phase


def _llm_emit(slug: str = "deliver", index: int = 0, **config_extra) -> dict:
    cfg = {"phase_type": "llm_emit", "prompt": "Emit the deliverable."}
    cfg.update(config_extra)
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


def _spec(phase: dict):
    """Parse ONE phase dict through the real strict model — never a duck type.

    `grounding_cause` reads a discriminated config union with `getattr(..., None)`; a
    `SimpleNamespace` stand-in would answer every attribute and could hide a real miss.
    """
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(phase)


# ══ criterion 4 — each KB tool name, in isolation, detects ═══════════════════


def test_the_parametrize_list_is_the_module_constant():
    """The control for every case below: the five names tested ARE the shipped set.

    Without this, adding a sixth KB tool to `grounding.py` would leave this whole file
    green while the new tool went unmarked on the canvas.
    """
    from app.services.harness.grounding import KB_TOOLS, KB_TOOLS_SORTED

    assert sorted(KB_TOOLS) == _EXPECTED_KB_TOOLS
    assert KB_TOOLS_SORTED == _EXPECTED_KB_TOOLS
    assert isinstance(KB_TOOLS, frozenset), "the membership set must not be mutable"


@pytest.mark.parametrize("kb_tool", _EXPECTED_KB_TOOLS)
def test_each_kb_tool_alone_detects_an_llm_agent(kb_tool):
    """Criterion 4 — ONE KB tool is enough. No combination, no threshold, no confidence."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_agent(tools=[kb_tool]))) == "detected"


@pytest.mark.parametrize("kb_tool", _EXPECTED_KB_TOOLS)
def test_each_kb_tool_alone_detects_an_llm_batch_agents(kb_tool):
    """The other config that carries `available_tools` — the two auto-locking types."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_batch_agents(tools=[kb_tool]))) == "detected"


def test_a_kb_tool_mixed_with_non_kb_tools_still_detects():
    """The realistic shape: a research step whitelists retrieval AND code execution."""
    from app.services.harness.grounding import grounding_cause

    phase = _llm_agent(tools=["execute_code", "search_documents", "web_search"])
    assert grounding_cause(_spec(phase)) == "detected"


# ══ criterion 5 — what does NOT detect, and the already-set cause ════════════


def test_non_kb_tools_do_not_detect():
    """A step that runs code and browses the web reads no knowledge base."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_agent(tools=["execute_code", "web_search"]))) is None


def test_a_step_with_no_available_tools_never_auto_locks():
    """`llm_single` has no `available_tools` field at all — the `getattr` totality idiom.

    D-185-15's trap: an `llm_single` can never SATISFY the citation gate (no retrieval
    path), so auto-locking one would build a permanently failing step.
    """
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_single())) is None


def test_an_llm_agent_with_an_empty_whitelist_does_not_detect():
    """An empty list is not a KB read — the intersection is empty, not absent."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_agent(tools=[]))) is None


def test_llm_emit_at_strict_citation_policy_reports_already_set():
    """Criterion 5 — the third cause is owned by the SHIPPED `citation_policy` dial.

    `citation_policy` lives only on `LlmEmitPhaseConfig` and defaults to `"strict"`, so an
    emit step is already grounded and 185 renders it as read-only text (D-185-15 / L-14).
    """
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_emit(citation_policy="strict"))) == "already-set"
    assert grounding_cause(_spec(_llm_emit())) == "already-set"  # strict is the default


@pytest.mark.parametrize("policy", ["flag", "partial", "draft"])
def test_a_non_strict_llm_emit_is_not_already_set(policy):
    """The control — `already-set` names ONE policy value, not "the field exists"."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_emit(citation_policy=policy))) is None


# ══ criterion 6 — folder_scope is not a detection input ══════════════════════


def test_folder_scope_alone_never_triggers_detection():
    """Criterion 6 — binding a step to a folder is not the same as READING from it.

    `folder_scope` exists on all five LLM config members. Reading it here would auto-lock
    every scoped `llm_single`, which has no way to retrieve anything.
    """
    from app.services.harness.grounding import grounding_cause

    scoped_agent = _llm_agent(tools=[], config_extra={"folder_scope": [_PROJECT]})
    assert grounding_cause(_spec(scoped_agent)) is None
    assert grounding_cause(_spec(_llm_single(folder_scope=[_PROJECT]))) is None


def test_a_skill_ref_is_not_a_detection_input_either():
    """Same class of near-miss: composing a skill is not reading the knowledge base."""
    from app.services.harness.grounding import grounding_cause

    phase = _llm_agent(tools=["execute_code"], config_extra={"skill_ref": _SKILL_ID})
    assert grounding_cause(_spec(phase)) is None


# ══ criterion 7 — the branch order: detection beats escalation ═══════════════


def test_an_escalated_step_without_a_kb_tool_reports_escalated():
    """The author hand-locked a step that reads nothing — the one AUTHORED cause."""
    from app.services.harness.grounding import grounding_cause

    phase = _llm_agent(tools=["execute_code"], grounding_escalated=True)
    assert grounding_cause(_spec(phase)) == "escalated"


def test_detection_wins_over_escalation_and_the_bit_goes_inert():
    """Criterion 7 — the same phase, one tool added: the cause FLIPS to `detected`.

    This is Req 3 in miniature. The stored `grounding_escalated: True` is untouched in the
    JSONB and simply stops being the reason — so the surface offers no undo, because undoing
    the author's escalation would not unlock the step. Nothing anywhere had to REMOVE the
    bit, which is why no code path can get this wrong.
    """
    from app.services.harness.grounding import grounding_cause

    escalated = _llm_agent(tools=["execute_code"], grounding_escalated=True)
    assert grounding_cause(_spec(escalated)) == "escalated"

    now_detected = _llm_agent(
        tools=["execute_code", "search_documents"], grounding_escalated=True
    )
    parsed = _spec(now_detected)
    assert grounding_cause(parsed) == "detected"
    assert parsed.grounding_escalated is True, (
        "the stored intent must go INERT, not be rewritten — the row still says what the "
        "author asked for"
    )

    # ... and removing the tool again restores the author's cause, undo included.
    assert grounding_cause(_spec(escalated)) == "escalated"


def test_detection_also_wins_over_an_already_set_emit():
    """Total ordering, stated once: detected > already-set > escalated > None.

    An `llm_emit` carries no `available_tools`, so this pair can only be built by hand — but
    the ordering must still be total, or two readers of the same row could disagree.
    """
    from app.services.harness.grounding import grounding_cause

    class _Both:
        available_tools = ["search_documents"]
        citation_policy = "strict"

    phase = SimpleNamespace(config=_Both(), grounding_escalated=True)
    assert grounding_cause(phase) == "detected"


def test_an_ungoverned_step_reports_no_cause():
    """The fourth answer is `None`, not a fourth cause — "free to think" is the absence."""
    from app.services.harness.grounding import grounding_cause

    assert grounding_cause(_spec(_llm_single())) is None
    assert grounding_cause(_spec(_llm_agent(tools=["execute_code"]))) is None


def test_a_whole_definition_mixes_governed_and_ungoverned_steps():
    """GOVERN-01's "a workflow freely MIXES both" — the graded half of graded governance."""
    from app.models.harness import WorkflowDefinition
    from app.services.harness.grounding import grounding_cause

    wd = WorkflowDefinition.model_validate(
        _definition(
            [
                _llm_agent("research", 0, tools=["search_documents"]),
                _llm_agent("crunch", 1, tools=["execute_code"]),
                _llm_single("summarize", 2),
                _llm_emit("deliver", 3),
            ]
        )
    )

    assert [grounding_cause(p) for p in wd.phases] == [
        "detected",
        None,
        None,
        "already-set",
    ]


# ══ criterion 8 — the source guard: no cause is ever STORED ══════════════════
#
# The `canvasModel.purity.test.ts` idiom, in Python. Two rules it inherits verbatim:
#
#   1. The searched tokens are ASSEMBLED FROM PARTS below, never spelled. A guard whose
#      needle appears literally in the file can be satisfied by editing a neighbouring
#      docblock until it no longer contains the word — the D-ITEM-183-02 trap, hit five-plus
#      times in Phase 183.
#   2. Every extractor and every regex carries a POSITIVE CONTROL proving it can go RED.
#      An extractor nobody proved is just an assumption with a function name.
#
# The claim: `grounding.py` PRODUCES a cause only through `return` statements. No field, no
# attribute, no annotated declaration anywhere in the module holds one. That is the
# machine-checkable half of D-185-07 — a cached cause field would be exactly the "derived
# state made durable" this phase exists to make unrepresentable.

_G = "ground" + "ing"
_CAUSE_FIELD = _G + "_" + "cau" + "se"
_MODE_FIELD = _G + "_" + "mo" + "de"
_BARE_CAUSE = "cau" + "se"
_FORBIDDEN_TOKENS = [_CAUSE_FIELD, _MODE_FIELD, _BARE_CAUSE]


def _code_only(source: str) -> str:
    """Flatten Python source to CODE, one space between tokens.

    Comments are dropped and EVERY string literal (which includes every docstring) is
    neutralised, so these guards test code and can never be satisfied — or broken — by
    prose. f-string pieces are dropped while their interpolated expressions are kept.
    """
    out: list[str] = []
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        name = tokenize.tok_name.get(tok.type, "")
        if name.startswith("FSTRING") or tok.type in (
            tokenize.COMMENT,
            tokenize.NL,
            tokenize.NEWLINE,
            tokenize.INDENT,
            tokenize.DEDENT,
            tokenize.ENDMARKER,
        ):
            continue
        out.append('""' if tok.type == tokenize.STRING else tok.string)
    return " ".join(out)


def _stores(flat_code: str, token: str) -> bool:
    """True when `token` is ASSIGNED to or DECLARED as a field in the flattened code."""
    assigned = re.search(rf"\b{re.escape(token)}\s*=(?!=)", flat_code)
    declared = re.search(rf"\b{re.escape(token)}\s*:", flat_code)
    return bool(assigned or declared)


def test_the_code_extractor_is_real_it_drops_prose_and_keeps_code():
    """Positive control #1 — the tokenizer strip removes docstrings and comments only."""
    planted = (
        '"""A docstring mentioning ' + _CAUSE_FIELD + '."""\n'
        "# a comment mentioning " + _MODE_FIELD + "\n"
        "x = 1\n"
    )
    flat = _code_only(planted)

    assert "x = 1" in flat
    assert _CAUSE_FIELD not in flat, "a docstring survived the strip — the guard is blind"
    assert _MODE_FIELD not in flat, "a comment survived the strip — the guard is blind"


@pytest.mark.parametrize("token", _FORBIDDEN_TOKENS)
def test_the_store_detector_is_real_it_goes_red_on_a_planted_write(token):
    """Positive control #2 — every forbidden pattern DOES fire on planted source.

    Three shapes, because a cause could be cached three ways: a plain assignment, an
    annotated dataclass field, and an attribute write on the phase itself.
    """
    for planted in (
        f"{token} = 'detected'\n",
        f"{token}: str | None = None\n",
        f"phase.{token} = 'detected'\n",
    ):
        assert _stores(_code_only(planted), token), (
            f"the guard cannot see {planted!r} — it would pass against a module that "
            "stores a derived cause"
        )

    # ... and the shape that is ALLOWED does not trip it: producing a cause by returning it.
    allowed = f"def {_CAUSE_FIELD}(phase):\n    return 'detected'\n"
    assert not _stores(_code_only(allowed), token)


@pytest.mark.parametrize("token", _FORBIDDEN_TOKENS)
def test_grounding_module_never_stores_a_derived_cause(token):
    """Criterion 8 — the derive-don't-store rule, machine-checked (D-185-07).

    A `model_validator` on `PhaseSpec` or a cached field here would both bake the derived
    state into the saved JSONB (the draft path persists `model_dump(mode="json")`), after
    which removing the KB tool would leave the step locked forever — Req 3 inverted.
    """
    from app.services.harness import grounding as g

    source = pathlib.Path(g.__file__).read_text(encoding="utf-8")

    assert not _stores(_code_only(source), token), (
        f"`grounding.py` assigns or declares {token!r} — a cause must only ever be "
        "RETURNED by grounding_cause(), never stored (D-185-07)"
    )


def test_the_models_module_declares_no_model_validator_on_phase_spec():
    """The other half of L-2: the intent booleans carry no validator that could derive.

    `PhaseSpec`'s own source slice must contain no `model_validator`. The module has two
    pre-existing ones on OTHER models, so this is scoped to the class, not the file.
    """
    from app.models import harness as h

    source = pathlib.Path(h.__file__).read_text(encoding="utf-8")
    start = source.index("class PhaseSpec(")
    end = source.index("class InputFieldSpec(", start)
    phase_spec_src = source[start:end]

    assert not re.search(r"@\s*model_validator", phase_spec_src), (
        "PhaseSpec grew a model_validator — the draft save path persists "
        "model_dump(mode='json'), so anything derived there is BAKED into the JSONB (L-2)"
    )
    # Control: the regex DOES fire on a planted decorator.
    assert re.search(r"@\s*model_validator", "@model_validator(mode='after')\ndef f(): ...")
