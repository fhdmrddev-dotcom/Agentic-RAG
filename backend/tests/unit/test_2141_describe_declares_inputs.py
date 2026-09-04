"""Phase 214.1-02 Task 1 (STEP-02 / SC#4 / D-214.1-05) — the describe door DECLARES the
inputs its own steps ask for.

WHY THIS FILE EXISTS, IN THE MODULE'S OWN WORDS. ``workflow_authoring.py`` records, twice,
about its own prompt clauses: *"a prompt clause reduces how often the model composes such a
step; it can never guarantee absence."* SC#4 says an AI-drafted workflow is publishable
**without hand-repair** — a GUARANTEE. So a prompt sentence cannot carry it, and every case
below drives a model that emits ``inputs: None`` ANYWAY and asserts the SERVER completed the
declaration.

⚠ THE PROMPT IS NEVER ASSERTED TO HAVE WORKED. It cannot be: the emit seam is stubbed, so the
words reach a fake. What IS asserted is that the derivation makes the definition satisfy the
SAME gate that would otherwise refuse it (``ask_undeclared``), with a POSITIVE CONTROL proving
the gate was actually reached.

⚠ ``None`` AND ``[]`` ARE DIFFERENT FACTS and are held apart by a byte-identity case: a
workflow that declared nothing is not a workflow whose list is empty.

CONVENTION: the ``test_214_describe_vocabulary.py`` harness, reused rather than reinvented —
``forced_emit`` patched on the module it is imported FROM, the grounding accessors stubbed, a
provider name that matches no real provider, and NO network and NO database of any kind.
"""

from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest

STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")
STUB_PROVIDER = "stub-provider-not-a-real-one"

DESCRIBE = "Email the renewal brief to whoever asks for it."


# ── the definition the MODEL emitted, built as a plain dict so every case is about what ──
# ── the SERVER does with a composition nobody asked it for. ──────────────────────────────


def _external_phase(
    *,
    slug: str = "act",
    phase_index: int = 1,
    arg_sources: dict | None = None,
    tool_args: dict | None = None,
) -> dict:
    config: dict = {
        "phase_type": "external_action",
        "capability": "send_email",
        "connection_id": "conn-smtp",
    }
    if arg_sources is not None:
        config["arg_sources"] = arg_sources
    if tool_args is not None:
        config["tool_args"] = tool_args
    return {
        "slug": slug,
        "phase_index": phase_index,
        "name": "Send the brief",
        "config": config,
        "validators": [],
    }


def _definition(
    *,
    external: list[dict] | None = None,
    inputs=...,
) -> dict:
    """A valid emitted definition. ``inputs`` is left ABSENT unless a case names it, so the
    default arm is the one the bug is about: the model said *ask at launch* and declared
    nothing."""
    phases: list[dict] = [
        {
            "slug": "gather",
            "phase_index": 0,
            "name": "Pull the renewal history",
            "config": {"phase_type": "llm_single", "prompt": "Pull the history."},
            "validators": [],
        }
    ]
    phases.extend(external or [])
    definition: dict = {
        "slug": "renewal-brief",
        "version": 1,
        "name": "Renewal Brief",
        "status": "draft",
        "phases": phases,
    }
    if inputs is not ...:
        definition["inputs"] = inputs
    return definition


def _asks(key: str | None, prop: str = "to") -> dict:
    """``arg_sources`` naming ONE property as asked at launch."""
    spec: dict = {"source": "ask"}
    if key is not None:
        spec["ask_key"] = key
    return {prop: spec}


def _wd(definition_dict: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(copy.deepcopy(definition_dict))


# ── the harness, lifted from test_214_describe_vocabulary.py ────────────────────────────


def _patch_grounding(monkeypatch):
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)

    async def _fake_fidelity(*_args, **_kwargs):
        return None

    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)


def _patch_vocabulary(monkeypatch, vocabulary: dict):
    import app.services.workflow_authoring as wa

    async def _fake_resolve(**_kwargs):
        return vocabulary

    monkeypatch.setattr(wa, "_resolve_allowed_vocabulary", _fake_resolve)


def _patch_provider(monkeypatch):
    import app.config as cfg

    monkeypatch.setattr(
        cfg,
        "get_model_capability",
        lambda model: {"forced_emission": True, "provider": STUB_PROVIDER},
    )


def _patch_user_settings(monkeypatch):
    import app.models.user_settings as us

    monkeypatch.setattr(
        us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
    )


def _patch_emit(monkeypatch, responses: list[dict]) -> list[dict]:
    import app.services.forced_emit as fe

    calls: list[dict] = []

    async def _fake_forced_emit(**kwargs):
        calls.append(kwargs)
        idx = min(len(calls) - 1, len(responses) - 1)
        return responses[idx]

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)
    return calls


async def _generate(**overrides):
    import app.services.workflow_authoring as wa

    kwargs = {
        "describe": DESCRIBE,
        "supabase": object(),
        "user_id": "u1",
        "settings": STUB_SETTINGS,
    }
    kwargs.update(overrides)
    return await wa.generate_workflow_definition(**kwargs)


def _arm(monkeypatch, definition: dict, vocabulary: dict | None = None) -> list[dict]:
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_vocabulary(monkeypatch, vocabulary or {})
    return _patch_emit(monkeypatch, [{"emitted": _wd(definition)}])


async def _emitted_inputs(monkeypatch, definition: dict):
    """Run the SUCCESS path and hand back ``(result, definition['inputs'] as emitted back)``.

    ⚠ Reads the key with ``.get`` rather than ``[...]`` so a case can tell ABSENT from
    ``None``; ``model_dump(mode="json")`` always carries the key, and that too is a fact a
    case is entitled to assert rather than assume.
    """
    _arm(monkeypatch, definition)
    result = await _generate()
    assert result["ok"] is True, result
    return result, result["definition"].get("inputs", ...)


# ── ⭐ THE MODEL-OMITS-IT ARM — the whole reason the derivation exists ───────────────────


@pytest.mark.asyncio
async def test_an_asked_argument_is_DECLARED_even_though_the_model_declared_nothing(
    monkeypatch,
):
    """The bug, in one case: the model says *ask for `to` at launch as `recipient`* and
    emits ``inputs: None``. The returned definition declares ``recipient``.

    ⚠ THE PROMPT IS NOT ASSERTED TO HAVE WORKED — the emit seam is a stub, so its words
    reach a fake. Only the SERVER's completion is under test."""
    _result, inputs = await _emitted_inputs(
        monkeypatch,
        _definition(external=[_external_phase(arg_sources=_asks("recipient"))], inputs=None),
    )
    assert isinstance(inputs, list) and len(inputs) == 1, inputs
    entry = inputs[0]
    assert entry["key"] == "recipient"
    assert entry["label"] == "recipient"  # label IS the key — a fabricated name is invention
    assert entry["type"] == "text"
    assert entry["required"] is True


@pytest.mark.asyncio
async def test_an_ask_with_NO_ask_key_falls_back_to_the_property_name(monkeypatch):
    """``key = ask_key or <property>`` — the SAME rule ``args.py`` resolves and the publish
    gate refuses with. A second answer here would draft a workflow the gate then refuses."""
    _result, inputs = await _emitted_inputs(
        monkeypatch,
        _definition(external=[_external_phase(arg_sources=_asks(None))], inputs=None),
    )
    assert [e["key"] for e in inputs] == ["to"]
    assert inputs[0]["label"] == "to"


# ── ⭐ THE GATE-AGREEMENT CASE — the absence AND its positive control, in one case ───────


@pytest.mark.asyncio
async def test_the_derived_declaration_SATISFIES_the_gate_that_would_refuse_it(monkeypatch):
    """Run the RETURNED definition through the real ``lint_workflow`` and assert ZERO
    ``ask_undeclared`` — paired with a POSITIVE CONTROL over the SAME definition with the
    derived entries stripped, which must yield EXACTLY ONE.

    Without the control the absence assertion would pass against a lint that was never
    reached — a schema that resolved to nothing, a phase the walk skipped, a typo in the
    code string. Nothing here is mocked: the real ``WorkflowDefinition``, the real
    ``schema_for_bound_tool``, the real ``unsatisfiable_arguments``."""
    from app.models.harness import WorkflowDefinition
    from app.services.harness.reachability import lint_workflow

    emitted = _definition(
        external=[
            _external_phase(
                arg_sources=_asks("recipient"),
                # subject/body are FIXED so `to` is the only gap left standing; otherwise
                # the control would count three and prove nothing about this one rule.
                tool_args={"subject": "Renewal brief", "body": "See attached."},
            )
        ],
        inputs=None,
    )
    emitted["phases"][1]["config"]["arg_sources"].update(
        {"subject": {"source": "fixed"}, "body": {"source": "fixed"}}
    )
    result, _inputs = await _emitted_inputs(monkeypatch, emitted)

    derived = WorkflowDefinition.model_validate(result["definition"])
    assert [e.code for e in lint_workflow(derived) if e.code == "ask_undeclared"] == []

    # ⭐ POSITIVE CONTROL — the same definition with the derivation's output removed.
    stripped = derived.model_copy(update={"inputs": None})
    control = [e for e in lint_workflow(stripped) if e.code == "ask_undeclared"]
    assert len(control) == 1, control
    assert control[0].argument == "to"


# ── the rules the derivation must NOT break ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_key_the_model_ALREADY_declared_is_not_duplicated_and_keeps_its_label(
    monkeypatch,
):
    _result, inputs = await _emitted_inputs(
        monkeypatch,
        _definition(
            external=[_external_phase(arg_sources=_asks("recipient"))],
            inputs=[
                {
                    "key": "recipient",
                    "label": "Who receives the brief",
                    "type": "text",
                    "required": False,
                }
            ],
        ),
    )
    assert len(inputs) == 1, inputs
    assert inputs[0]["label"] == "Who receives the brief"  # the model's own words survive
    assert inputs[0]["required"] is False  # and so does its own answer


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["fixed", "upstream"])
async def test_a_source_that_is_not_ASK_declares_nothing(monkeypatch, source):
    spec: dict = {"source": source}
    if source == "upstream":
        spec["upstream_slug"] = "gather"
    _result, inputs = await _emitted_inputs(
        monkeypatch,
        _definition(
            external=[
                _external_phase(
                    arg_sources={"to": spec},
                    tool_args={"to": "ops@example.com"} if source == "fixed" else None,
                )
            ],
            inputs=None,
        ),
    )
    assert inputs is None


@pytest.mark.asyncio
async def test_a_RESERVED_key_is_never_declared_and_a_non_reserved_one_beside_it_IS(
    monkeypatch,
):
    """T-214.1-02-01. ``RESERVED_RUN_INPUT_KEYS`` values are STRIPPED server-side, so a
    declared ``folder_id`` would mint a field whose value silently vanishes.

    ⚠ THE POSITIVE CONTROL IS IN THE SAME DEFINITION — a non-reserved key asked one property
    over. Without it, a derivation that had simply stopped walking would pass this case."""
    from app.models.message import RESERVED_RUN_INPUT_KEYS

    for reserved in sorted(RESERVED_RUN_INPUT_KEYS):
        _result, inputs = await _emitted_inputs(
            monkeypatch,
            _definition(
                external=[
                    _external_phase(
                        arg_sources={
                            "to": {"source": "ask", "ask_key": reserved},
                            "subject": {"source": "ask", "ask_key": "brief_title"},
                        }
                    )
                ],
                inputs=None,
            ),
        )
        keys = [e["key"] for e in inputs]
        assert reserved not in keys, (reserved, keys)
        assert "brief_title" in keys, (reserved, keys)  # ⭐ the positive control


@pytest.mark.asyncio
async def test_two_phases_asking_under_the_SAME_key_produce_ONE_entry(monkeypatch):
    _result, inputs = await _emitted_inputs(
        monkeypatch,
        _definition(
            external=[
                _external_phase(slug="act", phase_index=1, arg_sources=_asks("recipient")),
                _external_phase(slug="act-2", phase_index=2, arg_sources=_asks("recipient")),
            ],
            inputs=None,
        ),
    )
    assert [e["key"] for e in inputs] == ["recipient"]


@pytest.mark.asyncio
@pytest.mark.parametrize("emitted_inputs", [None, []])
async def test_a_definition_with_no_external_step_round_trips_inputs_BYTE_IDENTICALLY(
    monkeypatch, emitted_inputs
):
    """``None`` and ``[]`` are DIFFERENT FACTS. A workflow that declared nothing is not a
    workflow whose list is empty, and a derivation that collapses them has invented a
    claim the author never made."""
    _result, inputs = await _emitted_inputs(
        monkeypatch, _definition(inputs=emitted_inputs)
    )
    assert inputs == emitted_inputs
    assert type(inputs) is type(emitted_inputs)


@pytest.mark.asyncio
async def test_a_REFUSED_generation_still_carries_no_definition_at_all(monkeypatch):
    """T-214.1-02-03. The derivation sits on the SINGLE success path. A failed generation
    makes no claim about publishability, so it gains nothing — no ``definition`` key, no
    ``readiness`` key, exactly as before."""
    _patch_grounding(monkeypatch)
    _patch_provider(monkeypatch)
    _patch_user_settings(monkeypatch)
    _patch_vocabulary(monkeypatch, {})  # ⇒ the EMPTY tick: no external step may exist
    _patch_emit(
        monkeypatch,
        [
            {
                "emitted": _wd(
                    _definition(
                        external=[_external_phase(arg_sources=_asks("recipient"))],
                        inputs=None,
                    )
                )
            }
        ],
    )
    result = await _generate(allowed_connection_ids=[])
    assert result["ok"] is False
    assert result["error"] == "connection_not_allowed"
    assert "definition" not in result
    assert "readiness" not in result


# ── the SOURCE fences: shape claims the cases above cannot make ─────────────────────────


def _authoring_source() -> str:
    from pathlib import Path

    import app.services.workflow_authoring as wa

    return Path(wa.__file__).read_text(encoding="utf-8")


def test_the_derivation_is_declared_exactly_once_and_named(monkeypatch):
    src = _authoring_source()
    assert src.count("def _declare_asked_arguments") == 1


def test_the_prompt_now_names_inputs_at_all(monkeypatch):
    """⚠ AN OBSERVATION, NOT EVIDENCE. This asserts the WORD reached the prompt, which is the
    cheap half. It says nothing about whether a model obeys it, and the derivation above is
    what carries SC#4. Recorded so a future reader does not mistake a green here for the
    guarantee."""
    import app.services.workflow_authoring as wa

    assert "inputs" in wa.AUTHORING_SYSTEM_PROMPT
