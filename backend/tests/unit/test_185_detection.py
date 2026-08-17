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


def test_no_external_action_capability_ever_arms_the_grounding_dial():
    """189 (D-03 / T-189-12) — the 7th type carries `available_tools` and still reports None.

    Detection is `available_tools ∩ KB_TOOLS`, and Phase 189 put a THIRD config type into
    that read: an `external_action` step's whitelist carries its chosen capability, exactly
    so it rides the guard every other tool rides. A capability colliding with a KB tool
    would therefore make every external-action step read as grounding-`detected` — locking
    a step that opens no document to a *must prove it* gate it can never satisfy.

    Asserted over the whole capability SET, never one name: a `send_email`-only case would
    stay green the day a fourth capability were added with a colliding name. The set is
    read from `EXTERNAL_ACTION_CAPABILITIES` rather than re-typed, so it cannot drift.

    THE MISSING ⛨ SEAL IS THE CORRECT ANSWER, NOT A BUG. `None` here means the step is
    *free to think*, which is what a step that reads no knowledge base should be. Its
    governance reading is the armed edge (D-04), not a grounding cause.
    """
    from app.models.harness import WorkflowDefinition
    from app.services.harness.grounding import (
        EXTERNAL_ACTION_CAPABILITIES,
        KB_TOOLS,
        grounding_cause,
    )

    assert EXTERNAL_ACTION_CAPABILITIES, "the capability set is empty — this would pass vacuously"

    for capability in sorted(EXTERNAL_ACTION_CAPABILITIES):
        spec = _spec(
            {
                "slug": "notify",
                "phase_index": 0,
                "config": {"phase_type": "external_action", "capability": capability},
                "validators": [],
            }
        )
        # D-03: the capability IS the whitelist, derived by the model — so this is the
        # list `grounding_cause` actually intersects, not a hand-written stand-in.
        assert spec.config.available_tools == [capability]
        assert grounding_cause(spec) is None, (
            f"an external_action step whose available_tools is {spec.config.available_tools!r} "
            f"reported {grounding_cause(spec)!r} — a capability colliding with KB_TOOLS "
            "would silently arm the grounding dial on a step that reads nothing"
        )

    # The whole-set disjointness, stated directly as well as observed through the cause.
    assert set(EXTERNAL_ACTION_CAPABILITIES) & set(KB_TOOLS) == set()

    # Control: the SAME assertion machinery DOES report `detected` when the intersection
    # is non-empty, so the greens above measure disjointness rather than a broken read.
    assert grounding_cause(_spec(_llm_agent(tools=sorted(KB_TOOLS)[:1]))) == "detected"

    # And the step is armed regardless (D-04) — the absent seal is not an absent gate.
    armed = WorkflowDefinition.model_validate(
        _definition(
            [
                {
                    "slug": "notify",
                    "phase_index": 0,
                    "config": {"phase_type": "external_action", "capability": "send_email"},
                    "validators": [],
                    "action_risk_armed": False,
                }
            ]
        )
    )
    assert grounding_cause(armed.phases[0]) is None
    assert armed.phases[0].action_risk_armed is True


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


def _phase_spec_source() -> str:
    """`PhaseSpec`'s own source slice — the class, never the whole module.

    `harness.py` carries validators on OTHER models (two on `WorkflowDefinition`, one on
    `ExternalActionPhaseConfig`), and none of them is in scope for L-2.
    """
    from app.models import harness as h

    source = pathlib.Path(h.__file__).read_text(encoding="utf-8")
    start = source.index("class PhaseSpec(")
    end = source.index("class InputFieldSpec(", start)
    return source[start:end]


# The ONE validator `PhaseSpec` is permitted to carry, named rather than counted, so a
# SECOND one cannot arrive under cover of the first. Phase 189 / D-04 — see that method's
# own docstring in `harness.py` for why it lives on `PhaseSpec` rather than on the config
# or on `WorkflowDefinition`.
_ALLOWED_PHASE_SPEC_VALIDATOR = "_external_action_is_always_armed"


def test_phase_spec_carries_no_validator_that_could_derive_a_grounding_state():
    """The other half of L-2, narrowed at Phase 189 to the claim it was always making.

    ⚠ NARROWED, NOT WEAKENED — and the reason is recorded because a loosened fence that
    nobody explained is indistinguishable from a fence somebody gave up on. This test used
    to assert that `PhaseSpec`'s slice contained NO `@model_validator` at all. That was a
    PROXY for L-2's real claim: the draft save path persists `model_dump(mode="json")`, so
    a value DERIVED here is BAKED into the JSONB — after which removing the KB tool would
    leave the step locked forever, i.e. SPEC Req 3 inverted.

    Phase 189 (D-04) required exactly one validator on this class: `action_risk_armed` must
    be structurally TRUE on the `external_action` phase type, on every write path including
    a hand-edited JSONB row. That pin is the OPPOSITE case to the one L-2 forbids. It bakes
    a value that must NEVER change (it is a function of the phase type alone, and arming is
    fail-closed), where L-2 forbids baking a value that must stay free to change when the
    row changes. So the proxy is replaced by the property, in three parts:

      1. the ONLY validator on `PhaseSpec` is the named D-04 pin — a second one, or a
         rename, fails here;
      2. that slice ASSIGNS or DECLARES none of the forbidden cause tokens, checked with
         the same `_code_only` / `_stores` machinery (and therefore the same positive
         controls) the `grounding.py` guard above uses; and
      3. the detectors still fire on planted source, so a green here is a measurement.

    Part 2 is strictly STRONGER than what this test asserted before: the old regex would
    have passed a `PhaseSpec` that cached `grounding_cause` in a plain field, because a
    plain field carries no decorator at all.
    """
    phase_spec_src = _phase_spec_source()

    # (1) Exactly one validator, and it is the one D-04 authorised.
    decorated = re.findall(
        r"@\s*model_validator[^\n]*\n\s*def\s+(\w+)", phase_spec_src
    )
    assert decorated == [_ALLOWED_PHASE_SPEC_VALIDATOR], (
        f"PhaseSpec's validators are {decorated!r}; the only one L-2 admits is "
        f"[{_ALLOWED_PHASE_SPEC_VALIDATOR!r}] (Phase 189 / D-04, the arming pin). A new "
        "one here can BAKE derived state into the saved JSONB — read that method's "
        "docstring, and the (b) block above `grounding_escalated`, before adding another."
    )

    # (2) THE ACTUAL L-2 CLAIM: no cause is assigned or declared anywhere in the class.
    flat = _code_only(phase_spec_src)
    for token in _FORBIDDEN_TOKENS:
        assert not _stores(flat, token), (
            f"PhaseSpec assigns or declares {token!r} — a grounding cause is DERIVED at "
            "read time by grounding.grounding_cause() and must never be stored, because "
            "the draft save path persists model_dump(mode='json') (D-185-07 / L-2)"
        )

    # (3) Controls — both detectors fire on planted source, so (1) and (2) are measurements.
    assert re.findall(
        r"@\s*model_validator[^\n]*\n\s*def\s+(\w+)",
        "@model_validator(mode='after')\n    def _planted(self): ...",
    ) == ["_planted"]
    assert _stores(_code_only(f"    {_CAUSE_FIELD}: str | None = None\n"), _CAUSE_FIELD)


# ══ D-185-09 — the palette route serves the list as DATA ═════════════════════
#
# The route half of the one-home rule. These call the REAL
# `grounding.assemble_grounding_bundle` behind a fake supabase (rather than monkeypatching
# the assembler), because the claim under test is precisely that the ASSEMBLER populates the
# field on every path — a stubbed bundle would prove only that the route copies whatever it
# is handed. The fakes are the `test_182_grounding_degradation.py` doubles, trimmed.


class _FakeQuery:
    """A fluent supabase-py query stand-in serving a fixed row set."""

    def __init__(self, rows):
        self._rows = list(rows)
        self._ranged = None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def range(self, start, end):
        self._ranged = (start, end)
        return self

    def execute(self):
        if self._ranged is not None:
            start, end = self._ranged
            self._ranged = None
            return SimpleNamespace(data=self._rows[start:end + 1])
        return SimpleNamespace(data=list(self._rows))


class _RaisingQuery(_FakeQuery):
    """A table whose read blows up — the DEGRADED path, not a verdict."""

    def __init__(self):
        super().__init__([])

    def execute(self):
        raise RuntimeError("simulated registry outage")


class _FakeSupabase:
    def __init__(self, **tables):
        self.tables = dict(tables)

    def table(self, name):
        return self.tables.setdefault(name, _FakeQuery([]))


def _folder_rows(n: int = 2) -> list[dict]:
    return [
        {
            "id": f"{i:08d}-0000-0000-0000-00000000000f",
            "user_id": _CALLER,
            "name": f"folder-{i}",
            "parent_id": None,
            "is_org_shared": False,
            "org_id": _ORG,
        }
        for i in range(n)
    ]


def _skill_rows() -> list[dict]:
    return [
        {
            "id": _SKILL_ID,
            "name": "A Real Registered Skill",
            "user_id": _CALLER,
            "is_org_shared": False,
            "is_system": False,
            "org_id": _ORG,
            "is_enabled": True,
        }
    ]


def _healthy_client() -> _FakeSupabase:
    return _FakeSupabase(
        folders=_FakeQuery(_folder_rows()),
        org_members=_FakeQuery([{"org_id": _ORG}]),
        skills=_FakeQuery(_skill_rows()),
    )


async def _palette(supabase):
    """Call the `/workflows/grounding-bundle` handler DIRECTLY (the `_validate` posture)."""
    from app.api import workflows as wf

    return await wf.get_grounding_bundle(
        current_user={"id": _CALLER},
        supabase=supabase,
        template_asset_id=None,
    )


@pytest.mark.asyncio
async def test_the_palette_serves_every_kb_tool_name_sorted():
    """D-185-09 — the client can read the safety-defining list instead of hardcoding it."""
    from app.services.harness.grounding import KB_TOOLS_SORTED

    response = await _palette(_healthy_client())

    assert response.kb_tools == KB_TOOLS_SORTED
    assert len(response.kb_tools) == 5
    assert response.degraded == []  # the healthy control


@pytest.mark.asyncio
async def test_a_degraded_palette_still_carries_the_kb_tool_list():
    """A folders/skills outage must NOT silently un-mark a locked step.

    PRE-FIX SHAPE THIS GUARDS AGAINST: filtering the list through `tools`, or skipping it on
    the degraded branch. Either would make a transient PostgREST blip render a grounded step
    as ungoverned — on the one surface whose whole job is to say what is governed — while the
    engine went on gating it. "We could not read your palette" is a different sentence from
    "this step reads nothing".
    """
    from app.services.harness.grounding import KB_TOOLS_SORTED

    degraded_client = _FakeSupabase(
        folders=_RaisingQuery(),
        org_members=_FakeQuery([{"org_id": _ORG}]),
        skills=_FakeQuery(_skill_rows()),
    )

    response = await _palette(degraded_client)

    assert response.degraded == ["folders"], "the control: this request really did degrade"
    assert response.kb_tools == KB_TOOLS_SORTED


@pytest.mark.asyncio
async def test_the_route_computes_nothing_it_serves_the_shared_bundle_field():
    """The list is read off the ONE shared bundle, never re-derived in the route.

    Proven behaviourally: swap the assembler for one returning a DIFFERENT list and the
    response follows it. A route that spelled the constant itself would ignore the swap —
    and would be a second home for the safety-defining names (D-182-06).
    """
    from app.services.harness import grounding as g

    async def _fake_assemble(**_kwargs):
        return g.GroundingBundle(
            tools=["search_documents"],
            tool_names={"search_documents"},
            kb_tools=["a_sentinel_tool"],
        )

    original = g.assemble_grounding_bundle
    g.assemble_grounding_bundle = _fake_assemble
    try:
        response = await _palette(_healthy_client())
    finally:
        g.assemble_grounding_bundle = original

    assert response.kb_tools == ["a_sentinel_tool"]


@pytest.mark.asyncio
async def test_the_tools_field_keeps_its_shipped_string_list_shape():
    """`tools: list[str]` is typed `string[]` on BOTH members of `useGroundingBundle`'s state
    union and on `PhaseFormRails.toolOptions` — converting it to a list of objects would be a
    breaking change to a shipped, cacheable, near-static route. The new list is ADDITIVE."""
    response = await _palette(_healthy_client())

    assert response.tools, "the healthy control must actually carry a tool palette"
    assert all(isinstance(t, str) for t in response.tools)


# ══ BUG-260730-01 — the attached gate is ANNOUNCED to the step that must satisfy it ══
#
# Detection earning a gate is only half a promise. As first shipped, a detected step got its
# `citations_required` validator attached automatically and was told about it NOWHERE — not by
# the step prompt (the author's), not by the attachment seam (it appends a ValidatorSpec and no
# prose), not by the retry feedback (which echoed the deficit without naming the format). The
# operator's publish golden run (`workflow_runs.id = ded89703-44c4-4e40-b5fe-9af35a44a54d`,
# `deepseek-v4-flash`) died on it:
#
#   Phase 1 (retrieve) gate failed after 3 attempt(s): citations_required: 0/1 citation
#   markers in the answer
#
# Half (a) — the "nothing was retrieved (0 sources)" branch — did NOT fire, which is the proof
# retrieval SUCCEEDED and the loss was purely the missing marker.
#
# What these guard, in the order they matter:
#
#   1. the gate is NO LESS STRICT (the fix is on the producer; loosening the checker is the
#      tempting wrong turn, so an unmarked answer must still FAIL);
#   2. the instruction and the checker cannot DRIFT (the advertised example is compiled
#      against the gate's own pattern);
#   3. D-14 byte-identity survives a prompt-composition edit in a shared module (asserted by
#      EQUALITY, not by a substring absence);
#   4. BOTH agent executors carry it (a one-path fix leaves every batch step failing);
#   5. the instruction is derived from the ATTACHED spec, never from a second detection call.


def _cited_output(text: str, citations: list | None = None) -> dict:
    """The documented `_exec_llm_agent` output shape. Note the absence of `field_map`."""
    return {
        "text": text,
        "sub_run_id": "sub-1",
        "source_refs": [{"document_id": "d1"}],
        "citations": [{"chunk_id": "c1"}] if citations is None else citations,
        "similarity_scores": [0.71],
    }


def _gate(output: dict, **cfg):
    """Run the REAL registered `citations_required` validator (never a stand-in)."""
    import asyncio

    import app.services.harness.validator_kinds  # noqa: F401 — registration side-effect
    from app.services.harness.validators import VALIDATOR_REGISTRY

    return asyncio.run(VALIDATOR_REGISTRY["citations_required"](output, cfg, None))


# ── guard 2: the drift pin (the strongest one) ────────────────────────────────


def test_every_advertised_marker_example_matches_the_pattern_the_gate_compiles():
    """THE DRIFT PIN. "The instruction and the checker agree" as a TEST, not a comment.

    The gate counts markers matching `CITATION_MARKER_PATTERN`; the prompt suffix tells the
    model to write `CITATION_MARKER_EXAMPLES`. If someone rephrases the guidance to advertise
    a form the regex rejects, or tightens the regex past an advertised example, this reds —
    which is the only thing standing between a future edit and a silent return of
    BUG-260730-01, where the producer was asked for one thing and judged on another.
    """
    import re as _re

    from app.services.harness.validator_kinds import (
        CITATION_MARKER_EXAMPLES,
        CITATION_MARKER_GUIDANCE,
        CITATION_MARKER_PATTERN,
    )

    compiled = _re.compile(CITATION_MARKER_PATTERN)

    assert CITATION_MARKER_EXAMPLES, "the format must advertise at least one example"
    for example in CITATION_MARKER_EXAMPLES:
        assert compiled.search(example), (
            f"the guidance advertises {example!r} but the gate's own pattern "
            f"{CITATION_MARKER_PATTERN!r} does not accept it — a model that obeyed the "
            "instruction to the letter would still fail the gate"
        )
        assert example in CITATION_MARKER_GUIDANCE, (
            f"{example!r} is not in the human phrasing — the guidance must be COMPOSED from "
            "the examples, so the words and the regex cannot be edited apart"
        )

    # POSITIVE CONTROL: the assertion above can go RED. A marker shape the pattern rejects
    # is what the falsification of this pin substitutes, and it must not slip through.
    assert not compiled.search("<<1>>"), (
        "the control failed — this pattern accepts anything, so the pin proves nothing"
    )


def test_the_gate_default_pattern_has_exactly_one_home():
    """The constant IS the default the validator compiles — not a hopeful copy of it.

    Proven behaviourally: an output carrying an advertised marker passes with NO `pattern` in
    the config, so the default really is the shared constant. A second literal in
    `validator_kinds.py` would leave this green while drifting, which is why the pin above
    compiles the constant the instruction reads.
    """
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    for example in CITATION_MARKER_EXAMPLES:
        result = _gate(_cited_output(f"Revenue grew 4% {example}."), mode="retrieved_and_cited")
        assert result.passed is True, f"the default pattern rejected its own example {example!r}"


# ── guard 1: the gate is no less strict, and now says what it wants ───────────


def test_a_retrieved_but_unmarked_answer_STILL_FAILS_and_now_names_the_format():
    """The bug reproduction, end to end at the gate — and the anti-regression for the FIX.

    This plan fixed the PRODUCER, never the checker. The whole point is that this case still
    fails: half (b) is the "point at what you read" half, and making it optional would trade a
    blocked publish for a dishonest citation claim. What changed is only that the message now
    carries the remedy, which the engine interpolates verbatim into `ctx.retry_feedback`.
    """
    from app.services.harness.validator_kinds import (
        CITATION_MARKER_EXAMPLES,
        CITATION_MARKER_GUIDANCE,
    )

    result = _gate(_cited_output("Revenue grew last quarter."), mode="retrieved_and_cited")

    assert result.passed is False, (
        "the gate was LOOSENED — an answer that points at nothing must still fail "
        "(T-185-12-01); the fix belongs on the producer"
    )
    # The production message, still recognisable (log greps + the shipped assertion).
    assert "0/1 citation markers in the answer" in result.error_message
    assert "nothing was retrieved" not in result.error_message, "half (a) must not have fired"
    # ... and now the remedy, from its one home.
    assert CITATION_MARKER_GUIDANCE in result.error_message
    assert CITATION_MARKER_EXAMPLES[0] in result.error_message
    assert "\n" not in result.error_message, "one line — this string is logged and re-prompted"


def test_the_same_answer_passes_once_it_carries_the_advertised_marker():
    """The other side of the reproduction: obeying the instruction satisfies the gate.

    Same output, same config, one marker added. Before this plan a model could only get here
    by GUESSING the format — which is why the failure looked like provider flakiness.
    """
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    marked = _gate(
        _cited_output(f"Revenue grew 4% {CITATION_MARKER_EXAMPLES[0]}."),
        mode="retrieved_and_cited",
    )
    assert marked.passed is True
    assert marked.error_message is None


def test_half_a_still_owns_the_nothing_retrieved_case():
    """The control for the claim this whole bug rests on: the two halves stay distinguishable.

    A marker-stuffed answer with an EMPTY `citations` list must still fail on retrieval, not on
    the marker count — otherwise "half (a) did not fire" would not have been evidence that the
    operator's step really did retrieve.
    """
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    result = _gate(
        _cited_output(f"A claim {CITATION_MARKER_EXAMPLES[0]} and another [2].", []),
        mode="retrieved_and_cited",
    )
    assert result.passed is False
    assert "nothing was retrieved" in result.error_message


# ── the instruction helper: derived from the ATTACHED spec ────────────────────


def _instruction(phase) -> str:
    from app.services.harness.phase_types import _citation_instruction

    return _citation_instruction(phase)


def _effective(phase_dict: dict, total: int = 1):
    """The phase AS THE EXECUTOR SEES IT — through the engine's one synthesis seam."""
    from app.services.harness.grounding import effective_phase

    return effective_phase(_spec(phase_dict), total_phases=total)


def test_a_detected_step_is_told_the_format_before_attempt_1():
    """The fix, at its narrowest: detection attaches the gate, and the gate is announced."""
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    text = _instruction(_effective(_llm_agent(tools=["search_documents"])))

    assert text, "a detected step must carry the instruction"
    assert CITATION_MARKER_EXAMPLES[0] in text
    assert text.startswith("\n\n"), "an additive SUFFIX, appended to the author's prompt"


def test_the_instruction_reads_the_attached_spec_not_a_second_detection_call():
    """The load-bearing design point (T-185-12-03).

    Proven behaviourally in both directions:

      * a phase carrying the spec but NO KB tool — the author-declared shape — is still told,
        because the spec is what the judge will run;
      * a phase with a KB tool whose spec was NOT attached is silent, because nothing will
        judge it.

    A helper that re-derived the cause would answer both of these backwards.
    """
    from app.models.harness import ValidatorSpec

    spec = ValidatorSpec(
        kind="citations_required", timing="post", on_failure="fail_run", max_retries=2,
        config={"mode": "retrieved_and_cited"},
    )

    # Spec present, detection absent -> instructed (the judge is what matters).
    declared = _spec(_llm_agent(tools=["execute_code"]))
    declared = declared.model_copy(update={"validators": [spec]})
    assert _instruction(declared), "an attached spec must be announced even without detection"

    # Detection present, spec absent (the RAW parsed phase, before the engine's seam) -> silent.
    raw = _spec(_llm_agent(tools=["search_documents"]))
    assert raw.validators == []  # the positive control for the claim below
    assert _instruction(raw) == "", (
        "the helper announced a gate that is not attached — it is re-deciding governance "
        "instead of reading the spec the engine synthesized"
    )


@pytest.mark.parametrize("mode", ["deterministic", "emit", "presence"])
def test_the_instruction_is_silent_for_every_other_citation_mode(mode):
    """Scope, asserted. `deterministic`/`emit` gate a `field_map` (a different obligation the
    emit path already instructs); a `presence` author opted in and wrote their own marker
    instructions — they were never the ones left uninformed."""
    from app.models.harness import ValidatorSpec

    phase = _spec(_llm_agent(tools=["search_documents"])).model_copy(
        update={"validators": [ValidatorSpec(kind="citations_required", config={"mode": mode})]}
    )
    assert _instruction(phase) == ""


def test_the_instruction_never_asks_for_fewer_markers_than_the_strictest_gate():
    """D-185-05 lets an author's spec AND the engine's both run, so `min_markers` is the MAX.

    An instruction that quoted the FIRST spec it found could tell the model "1 marker" while a
    sibling gate demanded 3 — the same asked-one-thing-judged-on-another shape as the bug.
    """
    from app.models.harness import ValidatorSpec

    weak = ValidatorSpec(kind="citations_required", config={"mode": "retrieved_and_cited", "min_markers": 0})
    strong = ValidatorSpec(kind="citations_required", config={"mode": "retrieved_and_cited", "min_markers": 3})
    phase = _spec(_llm_agent(tools=["search_documents"])).model_copy(
        update={"validators": [weak, strong]}
    )

    text = _instruction(phase)
    assert "At least 3" in text and "markers" in text

    # A gate satisfied by zero markers alone has nothing to announce.
    only_weak = _spec(_llm_agent(tools=["search_documents"])).model_copy(
        update={"validators": [weak]}
    )
    assert _instruction(only_weak) == ""


def test_a_spec_with_its_own_pattern_is_not_given_the_shared_guidance():
    """Honesty over coverage: `CITATION_MARKER_GUIDANCE` describes the DEFAULT pattern only.

    Advertising `[1]` for a gate compiling some other author-supplied regex would instruct the
    model to fail. Such a spec is author-declared, so its prompt is the author's job (the
    pre-185 contract) — and a junk `min_markers` must never raise out of a prompt builder.
    """
    from app.models.harness import ValidatorSpec

    custom = _spec(_llm_agent(tools=["search_documents"])).model_copy(
        update={"validators": [ValidatorSpec(
            kind="citations_required",
            config={"mode": "retrieved_and_cited", "pattern": r"SRC-\d+"},
        )]}
    )
    assert _instruction(custom) == ""

    junk = _spec(_llm_agent(tools=["search_documents"])).model_copy(
        update={"validators": [ValidatorSpec(
            kind="citations_required",
            config={"mode": "retrieved_and_cited", "min_markers": "lots"},
        )]}
    )
    assert _instruction(junk), "a malformed config must degrade to the gate's default, not raise"


# ── guard 3: D-14 byte-identity, by EQUALITY ──────────────────────────────────


@pytest.mark.parametrize(
    "phase_dict",
    [
        _llm_agent(tools=["execute_code"]),          # ungoverned agent
        _llm_agent(tools=[]),                        # no tools at all
        _llm_single(),                               # no available_tools field
        _llm_emit(citation_policy="strict"),         # already-set, gate NOT synthesized
        _llm_batch_agents(tools=["web_search"]),     # ungoverned batch
    ],
)
@pytest.mark.parametrize("feedback", [None, "Previous output failed validation: x. Fix it."])
def test_a_phase_that_earns_no_citation_gate_gets_a_byte_identical_prompt(phase_dict, feedback):
    """D-14 (T-185-12-04) — the fence a prompt-composition edit in a SHARED module needs.

    EQUALITY, not `not in`: the composed prompt must equal the pre-plan composition
    (`prompt + _skill_block + _retry_suffix`) exactly, so the new helper is proven to have
    contributed the empty string rather than merely "nothing recognisable". Run with the retry
    suffix both absent and present, because the helper sits between the two shipped suffixes
    and an ordering slip would show up only when both are live.
    """
    from app.services.harness.phase_types import (
        _citation_instruction,
        _retry_suffix,
        _skill_block,
    )

    phase = _effective(phase_dict, total=4)
    ctx = SimpleNamespace(retry_feedback=feedback)

    pre_plan = phase.config.prompt + _skill_block(phase, ctx) + _retry_suffix(ctx)
    composed = (
        phase.config.prompt
        + _skill_block(phase, ctx)
        + _citation_instruction(phase)
        + _retry_suffix(ctx)
    )

    assert composed == pre_plan
    assert _citation_instruction(phase) == ""


# ── guard 4: BOTH agent executors ─────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "executor_name,phase_dict",
    [
        ("_exec_llm_agent", _llm_agent(tools=["search_documents"])),
        ("_exec_llm_batch_agents", _llm_batch_agents(tools=["search_documents"])),
    ],
)
async def test_both_agent_executors_carry_the_instruction_into_the_system_prompt(
    monkeypatch, executor_name, phase_dict
):
    """The one-path-fix failure mode, guarded.

    Both `llm_agent` and `llm_batch_agents` carry `available_tools`, so BOTH are detectable and
    both earn the gate. Fixing only the single-agent path would leave every detected batch step
    failing a gate nothing announced — the original bug, narrowed rather than closed.

    Driven OFFLINE (the suite's standing posture): the sub-agent call, the tool-budget build and
    the ToolContext build are stubbed, and what is captured is the real
    `system_prompt_override` the executor composed.
    """
    from app.services.harness import phase_types as pt
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    captured: list[str] = []

    async def _fake_sub_agent(**kwargs):
        captured.append(kwargs["system_prompt_override"])
        return {
            "summary": "done",
            "sub_run_id": "sub-1",
            "source_refs": [],
            "citations": [{"chunk_id": "c1"}],
            "similarity_scores": [0.7],
        }

    monkeypatch.setattr(pt, "run_task_sub_agent", _fake_sub_agent)
    monkeypatch.setattr(pt, "_phase_tools_override", lambda *a, **k: [])
    # 196-03: the builder gained an optional keyword `model` (the CHECKED per-phase
    # model — run_task_sub_agent reads parent_ctx.model, not the executor's local), so
    # this stub absorbs it. A 2-arg stub now raises TypeError inside the executor.
    monkeypatch.setattr(pt, "_build_phase_tool_context", lambda phase, ctx, **_: object())

    ctx = SimpleNamespace(
        model="deepseek-v4-flash",
        retry_feedback=None,
        inputs={"kickoff_prompt": "Where are our compliance gaps?"},
    )

    await getattr(pt, executor_name)(_effective(phase_dict, total=2), {}, ctx)

    assert len(captured) == 1, f"{executor_name} did not reach the stubbed sub-agent"
    prompt = captured[0]
    assert CITATION_MARKER_EXAMPLES[0] in prompt, (
        f"{executor_name} composed a prompt with no citation instruction — a detected step on "
        "this path is judged on a format it was never told"
    )
    # The author's prompt still leads; the instruction is a SUFFIX, not a replacement.
    assert prompt.startswith(_spec(phase_dict).config.prompt)


@pytest.mark.asyncio
async def test_the_retry_feedback_stays_last_after_the_instruction(monkeypatch):
    """Ordering, asserted where it matters: feedback about a FAILED attempt is closest to the
    model's next turn, so the instruction cannot bury it. Both suffixes present at once."""
    from app.services.harness import phase_types as pt
    from app.services.harness.validator_kinds import CITATION_MARKER_EXAMPLES

    captured: list[str] = []

    async def _fake_sub_agent(**kwargs):
        captured.append(kwargs["system_prompt_override"])
        return {"summary": "done", "sub_run_id": "s", "source_refs": [], "citations": [],
                "similarity_scores": []}

    monkeypatch.setattr(pt, "run_task_sub_agent", _fake_sub_agent)
    monkeypatch.setattr(pt, "_phase_tools_override", lambda *a, **k: [])
    # 196-03: the builder gained an optional keyword `model` (the CHECKED per-phase
    # model — run_task_sub_agent reads parent_ctx.model, not the executor's local), so
    # this stub absorbs it. A 2-arg stub now raises TypeError inside the executor.
    monkeypatch.setattr(pt, "_build_phase_tool_context", lambda phase, ctx, **_: object())

    feedback = "Previous output failed validation: citations_required: 0/1. Fix it."
    ctx = SimpleNamespace(model="gpt-5.5", retry_feedback=feedback, inputs={})
    await pt._exec_llm_agent(
        _effective(_llm_agent(tools=["search_documents"]), total=1), {}, ctx
    )

    prompt = captured[0]
    assert prompt.endswith(feedback), "the retry feedback must be the LAST thing the model reads"
    assert prompt.index(CITATION_MARKER_EXAMPLES[0]) < prompt.index(feedback)


# ── guard 5: the instruction module re-derives nothing ────────────────────────


def test_the_prompt_module_never_re_derives_which_steps_are_governed():
    """The one-home rule, machine-checked — the same idiom as criterion 8 above.

    `phase_types.py` must reach the citation obligation through the ATTACHED spec ONLY. A second
    detection call there would be a second copy of "which steps are governed", which
    `grounding.py`'s own docblock names as a safety hole: the two copies could disagree about a
    step, and the disagreement would surface as a run that is judged on a rule it was not told.

    The needle is ASSEMBLED FROM PARTS (rule 1 of the criterion-8 block) so this guard cannot be
    satisfied by editing a neighbouring docblock. Both the flattened CODE and the raw source are
    checked: code catches a call or an import, raw catches a prose mention that would defeat the
    literal grep this criterion is written as.
    """
    from app.services.harness import phase_types as pt

    source = pathlib.Path(pt.__file__).read_text(encoding="utf-8")

    assert _CAUSE_FIELD not in _code_only(source), (
        f"`phase_types.py` references {_CAUSE_FIELD!r} in CODE — the instruction must be "
        "derived from the attached ValidatorSpec, never from a second detection call"
    )
    assert _CAUSE_FIELD not in source, (
        f"{_CAUSE_FIELD!r} appears in `phase_types.py` (prose or code) — the guard for this "
        "invariant is a literal file grep pinned to zero"
    )

    # POSITIVE CONTROL: both halves DO fire on planted source.
    planted = f"from app.services.harness.grounding import {_CAUSE_FIELD}\n"
    assert _CAUSE_FIELD in _code_only(planted)
    assert _CAUSE_FIELD in planted


def test_the_prompt_module_still_reads_the_shared_marker_format():
    """The other half of one-home: `phase_types.py` must not re-type or re-phrase the format.

    Behavioural, not textual — the instruction it composes CONTAINS the guidance string from
    `validator_kinds.py` verbatim, so a locally-worded copy would red here.
    """
    from app.services.harness.validator_kinds import CITATION_MARKER_GUIDANCE

    text = _instruction(_effective(_llm_agent(tools=["search_documents"])))
    assert CITATION_MARKER_GUIDANCE in text
