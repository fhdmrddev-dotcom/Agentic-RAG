"""Phase 200 (DES-02 / D-07) — the per-step count is DECLARED by the phase type, and
FOUR of the seven types declare nothing at all.

**The rule, and both halves are load-bearing.** A phase type emits
``output["_measure"] = {"count": int, "noun": str}`` **only where a count is already a fact
in its own output**. The number is read off something the executor genuinely produced
(``len(source_refs)`` / ``len(sub_run_ids)`` / ``len(field_map)``); no model authors it.

  * ⚠ **A TYPE WITH NO REAL NUMBER EMITS NO KEY AT ALL** — not ``0``, not ``null``, not a
    dash. The absence must be an ABSENT KEY so the client's arm is ``hasOwnProperty``-shaped
    rather than ``?? 0``-shaped. A ``None`` with a noun beside it renders as a real
    measurement of zero, which is the lie this rule exists to prevent.
  * ⚠ **BUT ``count: 0`` IS A REAL FACT AND IS EMITTED** (IDIOM-3 / SEED-159). A step that
    searched and found nothing measured zero. **That is a DIFFERENT statement from "this type
    does not count things", and the two must never collapse into each other — in either
    direction.** ``test_zero_sources_emits_a_real_count_of_zero`` is the count-side twin of
    migration 121's no-backfill negative control, and it is the single most important case in
    this file.

**SEVEN phase types, not eight.** ``PHASE_TYPE_REGISTRY_ENTRIES`` has exactly seven keys and
its own comment reads *"The 7 executors"*. ``llm_judge_rubric`` is a ``ValidatorSpec.kind``,
not a phase type — the claim that it is an eighth type lives in two documents and was
REFUTED by measurement (``200-CHECKLIST.md`` §0.2 X-2). ``test_the_registry_has_exactly_seven
_types`` pins that so the table below cannot silently go stale.

| # | type | declares | noun |
|---|---|---|---|
| 1 | ``programmatic``      | NO — deliberately | — |
| 2 | ``llm_single``        | NO | — |
| 3 | ``llm_agent``         | ``len(source_refs)``  | ``sources`` |
| 4 | ``llm_batch_agents``  | ``len(sub_run_ids)``  | ``agents``  |
| 5 | ``llm_human_input``   | NO | — |
| 6 | ``llm_emit``          | ``len(field_map)``    | ``fields``  |
| 7 | ``external_action``   | NO — one send is not a count | — |

⚠ **``programmatic`` DECLARES NOTHING ON PURPOSE**, and this is the one abstention most
likely to be "fixed" by a later reader: several of its registry ``fn``s return lists, so
``len(whatever_list_is_there)`` looks available. That is exactly the structural derivation
D-07 rejected — the ``fn``s are pluggable and their shapes differ, so a generic count would
silently mean something different per ``fn``.

⚠ **THE THREE NOUNS ARE AUTHORED COPY, NOT MEASURED FACTS** (``200-CHECKLIST.md`` §5.1). The
NUMBER is measured; the WORD is the step's own, chosen once by us — never the contract's and
never the domain's (SEED-168). Reproducing the sketch's ``312 docs matched`` /
``48 fields extracted`` phrasing by letting a model author the number would ship the
fabricated business figure ``199-05`` refused. Each noun is spelled at exactly ONE executor
site and pinned by ONE case here, so a wording change is a one-line edit.

CONVENTION: fixtures are COPIED from ``test_dual_mode_wiring.py`` / ``test_harness_engine.py``
/ ``tests/unit/test_llm_emit_executor.py`` / ``tests/unit/test_190_connector_check.py`` rather
than imported. The backend suite carries ~62 pre-existing failures and is not a safe import
surface; the repo's per-file convention is to copy. Imports are INSIDE test bodies so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest

# D-13 (Phase 200): ``_exec_llm_human_input`` moved to
# ``app.services.harness.human_input``, and its module-global
# ``subscribe_for_response`` moved WITH it — so the patch target is the new
# home, not ``phase_types``. Patching the old module now patches a name the
# executor no longer reads (measured: 5 failures + one HANG).
from app.services.harness import human_input as _human_input_home


MEASURE = "_measure"


# ══ shared fixtures ══════════════════════════════════════════════════════════


def _ctx(**overrides):
    """A harness-shaped engine ctx bag (SimpleNamespace, NOT a RunContext)."""
    defaults = dict(
        run_id=uuid.uuid4(),
        producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        current_user={"id": str(uuid.uuid4())},
        user_settings=None,
        redis=None,
        pool=None,
        supabase=None,
        emit=None,
        retry_feedback=None,
        inputs={},
        model="gpt-5.4-mini",
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _spec(config: dict, *, slug="step", phase_index=0):
    """A real ``PhaseSpec`` (validated) — the shape the registry executors read."""
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {"slug": slug, "phase_index": phase_index, "config": config}
    )


# ══ 0) the registry is SEVEN — the table above cannot go stale silently ══════


def test_the_registry_has_exactly_seven_phase_types():
    """SEVEN executors, and every one of them is accounted for by a case in this file.

    ⚠ Pinned rather than assumed because ``200-CONTEXT.md`` and ``FORWARD-CHECK.md`` both
    claim EIGHT types with a missing glyph for ``llm_judge_rubric``. That claim was refuted
    by measurement: ``llm_judge_rubric`` is a ``ValidatorSpec.kind``, not a phase type
    (``200-CHECKLIST.md`` §0.2 X-2). If an eighth executor is ever really added, this case
    goes red and whoever adds it must decide whether it declares a count.
    """
    from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES

    assert set(PHASE_TYPE_REGISTRY_ENTRIES) == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
        "llm_emit",
        "external_action",
    }
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7


# ══ the helper's own contract ════════════════════════════════════════════════


def test_measure_helper_emits_zero_as_a_real_count():
    """``_measure(0, ...)`` produces a real ``count: 0`` — it does NOT degrade to silence.

    The helper is the one place the shape is built, so this pins that a falsy count survives
    it. A ``if count:`` guard anywhere in that helper would turn every honest zero into an
    absence, and every case below that asserts a positive count would still pass.
    """
    from app.services.harness.phase_types import _measure

    assert _measure(0, "sources") == {MEASURE: {"count": 0, "noun": "sources"}}
    assert _measure(3, "agents") == {MEASURE: {"count": 3, "noun": "agents"}}


# ══ 1/7 · programmatic — DECLARES NOTHING ════════════════════════════════════


@pytest.mark.asyncio
async def test_programmatic_emits_no_measure_key():
    """Type 1 of 7 — no key at all, even though the output DOES carry a list.

    ⚠ This case is the sharpest of the four abstentions: ``split_topic`` returns
    ``sub_questions``, a genuine list of length 2, so a structural "count whichever key is a
    list" implementation would emit ``{"count": 2}`` here and pass every other case in this
    file. D-07 rejected that derivation precisely because ``programmatic``'s ``fn``s are
    pluggable and their shapes differ per ``fn`` — the number would mean something different
    every time while looking equally confident.
    """
    from app.services.harness import phase_types

    phase = _spec({"phase_type": "programmatic", "fn": "split_topic",
                   "input_keys": ["topic"]})
    out = await phase_types._exec_programmatic(phase, {}, _ctx(inputs={"topic": "a; b"}))

    assert out["sub_questions"] == ["a", "b"], "fixture guard: the list really is length 2"
    assert MEASURE not in out, (
        f"programmatic must emit NO {MEASURE} key — it has a list in its output and that is "
        f"exactly the structural count D-07 rejected. Got: {sorted(out)!r}"
    )


# ══ 2/7 · llm_single — DECLARES NOTHING ══════════════════════════════════════


@pytest.mark.asyncio
async def test_llm_single_emits_no_measure_key():
    """Type 2 of 7 — a single prose turn measures nothing, so it says nothing."""
    from app.services.harness import phase_types

    async def _fake_stream(*, messages, tools, model, user_settings):
        return ("the summary", [])

    phase = _spec({"phase_type": "llm_single", "prompt": "Summarize."})
    with patch.object(phase_types, "_stream_one_iteration", _fake_stream):
        out = await phase_types._exec_llm_single(phase, {}, _ctx())

    assert MEASURE not in out, f"llm_single must emit NO {MEASURE} key. Got: {sorted(out)!r}"
    # The whole dict, so a future key added here is a deliberate decision rather than drift.
    assert out == {"text": "the summary"}


# ══ 3/7 · llm_agent — DECLARES len(source_refs) AS "sources" ═════════════════


def _agent_phase():
    return _spec({"phase_type": "llm_agent", "prompt": "do research",
                  "available_tools": ["search_documents"]}, slug="research")


def _sub_result(source_refs):
    return {
        "sub_run_id": uuid.uuid4(),
        "summary": "research summary",
        "status": "completed",
        "source_refs": source_refs,
        "citations": [],
        "similarity_scores": [],
    }


async def _run_agent(source_refs):
    from app.services.harness import phase_types

    async def _fake_sub_agent(**kwargs):
        return _sub_result(source_refs)

    ctx = _ctx(supabase=object())
    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        return await phase_types._exec_llm_agent(_agent_phase(), {}, ctx)


@pytest.mark.asyncio
async def test_llm_agent_declares_the_source_count_with_the_sources_noun():
    """Type 3 of 7 — the count is the number of grounding sources actually gathered.

    The noun ``sources`` is AUTHORED COPY (§5.1) and this is the ONE case that pins it, so a
    wording change is a one-line edit here and at the single executor site.
    """
    out = await _run_agent([{"document_id": "d1"}, {"document_id": "d2"},
                            {"document_id": "d3"}])

    assert out[MEASURE] == {"count": 3, "noun": "sources"}
    # the count is read off the executor's OWN output, not invented beside it
    assert len(out["source_refs"]) == out[MEASURE]["count"]


@pytest.mark.asyncio
async def test_zero_sources_emits_a_real_count_of_zero():
    """⚠ **THE COUNT-SIDE NEGATIVE CONTROL — the most important case in this file.**

    A sub-agent that searched and found NOTHING measured **0 sources**. That is a REAL fact
    about a step that really ran, and it is NOT the same statement as "this phase type does
    not count things" (IDIOM-3 / SEED-159).

    So ``source_refs: []`` must produce ``{"count": 0, "noun": "sources"}`` — a key that is
    PRESENT, carrying a zero. Without this case, an implementation that suppressed falsy
    counts would pass every other assertion in this file while silently erasing the
    difference between *"found nothing"* and *"does not measure"*. Its exact twin on the
    timestamp side is migration 121's no-backfill control: both exist because **an absence
    and a zero are different claims**, and folding them together is the defect.
    """
    out = await _run_agent([])

    assert MEASURE in out, (
        "an empty source list must still DECLARE — 'searched and found nothing' is a real "
        "measurement, and dropping the key would make it indistinguishable from a phase "
        "type that does not count things at all"
    )
    assert out[MEASURE] == {"count": 0, "noun": "sources"}
    assert out[MEASURE]["count"] == 0
    assert out[MEASURE]["count"] is not None, "0, never None — None means 'no count declared'"


# ══ 4/7 · llm_batch_agents — DECLARES len(sub_run_ids) AS "agents" ═══════════


@pytest.mark.asyncio
async def test_llm_batch_agents_declares_the_agent_count_with_the_agents_noun():
    """Type 4 of 7 — how many parallel sub-agents actually ran, one ``sub_run_id`` each.

    ⚠ The count is ``len(sub_run_ids)`` and NOT ``len(source_refs)``: this executor UNIONS
    the grounding across every branch, so the source list answers a different question. The
    fixture gives the two different lengths (2 branches, 3 unioned refs) on purpose, so an
    implementation that counted the wrong list goes red here rather than coincidentally
    passing.
    """
    from app.services.harness import phase_types

    async def _fake_sub_agent(**kwargs):
        return {
            "sub_run_id": uuid.uuid4(),
            "summary": "branch answer",
            "status": "completed",
            # 2 branches x these refs => a unioned length that differs from the branch count
            "source_refs": [{"document_id": "d1"}],
            "citations": [],
            "similarity_scores": [],
        }

    phase = _spec({"phase_type": "llm_batch_agents", "prompt": "fan out",
                   "available_tools": ["search_documents"]}, slug="batch")
    accumulated = {"split": {"sub_questions": ["q1", "q2"]}}

    ctx = _ctx(supabase=object())
    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        out = await phase_types._exec_llm_batch_agents(phase, accumulated, ctx)

    assert out[MEASURE] == {"count": 2, "noun": "agents"}
    assert len(out["sub_run_ids"]) == 2
    # the discriminator: the unioned grounding is a DIFFERENT length from the branch count
    assert len(out["source_refs"]) == 2  # 2 branches x 1 ref each, unioned
    assert out[MEASURE]["count"] == len(out["sub_run_ids"])


# ══ 5/7 · llm_human_input — DECLARES NOTHING ═════════════════════════════════


@pytest.mark.asyncio
async def test_llm_human_input_emits_no_measure_key():
    """Type 5 of 7 — asking one person one question is not a count of anything."""
    from app.services.harness import phase_types

    async def _fake_emit(redis, run_id, evt_type, **fields):
        return None

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout):
        # ⚠ THIS RETURNED ``None`` (a TIMEOUT) UNTIL PHASE 200 / D-10, and the change is
        # recorded rather than made quietly: a timeout no longer PRODUCES an output at
        # all — the executor raises ``HumanInputTimeout`` and the engine pauses the run
        # (``BUG-260816-06``: the empty answer used to advance the workflow as though the
        # person had approved). This case is about the count key, not about the timeout,
        # so it now takes the ANSWERED path — the one that really does return a dict.
        return {"kind": "response", "response_text": "yes", "choice_index": None}

    phase = _spec(
        {"phase_type": "llm_human_input", "prompt": "Confirm?", "timeout_seconds": 1},
        slug="confirm",
    )
    ctx = _ctx(emit=_fake_emit, redis=object(), supabase=None)

    with patch.object(_human_input_home, "subscribe_for_response", _fake_subscribe):
        out = await phase_types._exec_llm_human_input(phase, {}, ctx)

    assert MEASURE not in out, (
        f"llm_human_input must emit NO {MEASURE} key. Got: {sorted(out)!r}"
    )


# ══ 6/7 · llm_emit — DECLARES len(field_map) AS "fields" ═════════════════════
#
# The driving harness below is COPIED from tests/unit/test_llm_emit_executor.py (the
# per-file convention). It patches the executor's substrate seams so the 6-layer ladder
# runs deterministically offline.


_VALID_FM = {
    "scalars": [
        {"key": "project_name", "value": "Meridian", "source_chunk_id": "chunk-1",
         "source_doc": "brief.docx", "source_page": 1},
        {"key": "owner", "value": "Ops", "source_chunk_id": "chunk-1",
         "source_doc": "brief.docx", "source_page": 1},
    ],
    "rows": [],
}


@pytest.mark.asyncio
async def test_llm_emit_declares_the_field_count_with_the_fields_noun(monkeypatch):
    """Type 6 of 7 — the number of top-level entries in the emitted field-map.

    ⚠ **``_exec_llm_emit`` has exactly ONE success return** (measured: every other exit
    routes through ``_emit_failure_output`` / ``_emit_unexpected_failure``), so the noun
    ``fields`` has exactly one home. A FAILED emit declares nothing — it produced no
    deliverable and has no honest count to report, which is the same rule as the four silent
    types rather than a special case.
    """
    from app.services.harness import emitters, phase_types
    from app.services.template_render_service import EmitFieldMap

    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": EmitFieldMap.model_validate(_VALID_FM),
            "tier": "TIER-FORCE",
            "provider": "openai",
            "forced": True,
            "recovered_from_narration": False,
            "truncated": False,
            "failure": None,
        }

    async def _fake_resolve(**kwargs):
        return {
            "bytes": b"PK\x03\x04docx",
            "filename": "register.docx",
            "provenance": "library",
            "mime": "application/vnd.openxmlformats-officedocument."
                    "wordprocessingml.document",
            "error": None,
        }

    async def _fake_write_audit(pool, run_id, *, user_id, event_type, metadata):
        return None

    async def _fake_render_post(validated_map, resolved_template, ctx):
        return {"status": "ok", "path": "/register.docx",
                "output_file": {"path": "/register.docx", "sha256": "abc", "bytes": 1234}}

    async def _fake_surface(ctx, run_id, reason, pool):
        return "msg-id"

    monkeypatch.setattr(phase_types, "forced_emit", _fake_forced_emit)
    monkeypatch.setattr(phase_types, "resolve_template_source", _fake_resolve)
    monkeypatch.setattr(phase_types, "write_audit", _fake_write_audit)
    monkeypatch.setattr(phase_types, "_surface_failure_message", _fake_surface)
    entry = emitters.EMITTER_REGISTRY["render_template"]
    monkeypatch.setitem(
        emitters.EMITTER_REGISTRY,
        "render_template",
        emitters.EmitterEntry(schema_builder=entry.schema_builder,
                              post_processor=_fake_render_post),
    )

    from app.models.harness import AssetRef

    definition = SimpleNamespace(
        slug="risk-register", version=3,
        definition_id="00000000-0000-0000-0000-0000000101a0",
        assets=[AssetRef(
            asset_id="template-asset-id", filename="register.docx", kind="template",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )],
    )
    phase = SimpleNamespace(
        slug="fill", phase_index=1,
        config=SimpleNamespace(
            phase_type="llm_emit", prompt="Fill the register.",
            emitter="render_template", model=None, folder_scope=None,
            skill_ref=None, skill_snapshot=None, available_tools=["render_template"],
        ),
    )
    ctx = _ctx(
        pool=object(), supabase=object(), definition=definition,
        folder_subtree_ids=None, model="gpt-5.4",
        inputs={"kickoff_prompt": "Fill the risk register from the KB."},
    )
    accumulated = {"retrieval": {"text": "retrieved",
                                 "source_refs": [{"chunk_id": "chunk-1"}]}}

    out = await phase_types._exec_llm_emit(phase, accumulated, ctx)

    assert "field_map" in out, f"fixture guard: emit did not reach success. Got {sorted(out)!r}"
    assert out[MEASURE] == {"count": len(out["field_map"]), "noun": "fields"}
    assert out[MEASURE]["count"] == 2, (
        "two scalars => two top-level field-map entries. The count is TOP-LEVEL entries "
        "(each scalar key, each collection as ONE), deliberately not a leaf-cell count"
    )


# ══ 7/7 · external_action — DECLARES NOTHING ═════════════════════════════════


@pytest.mark.asyncio
async def test_external_action_emits_no_measure_key(monkeypatch):
    """Type 7 of 7 — ⚠ **ONE SEND IS NOT A COUNT.**

    The tempting implementation is ``{"count": 1, "noun": "actions"}`` on every send. That
    would be a number nobody measured: it is a constant dressed as a measurement, and it
    would put a confident ``1 action`` on a step whose interesting facts (which system, what
    was sent, whether it was recorded rather than transmitted) live elsewhere entirely.

    Driven through the D-13/D-17 unbound branch — nothing bound is not a failure, it RECORDS
    — which is the cheapest real path through this executor.
    """
    from app.services.harness import phase_types

    monkeypatch.setattr(phase_types, "feature_audience", lambda _f: "everyone")

    phase = SimpleNamespace(
        slug="notify-ops", phase_index=0,
        config=SimpleNamespace(
            phase_type="external_action", capability="post_message",
            available_tools=["post_message"], connection_id=None,
        ),
    )
    ctx = _ctx(inputs={"text": "Renewal follow-up", "channel": "#ops-alerts"},
               org_id=str(uuid.uuid4()), user_id=None, is_golden_run=False)

    out = await phase_types._exec_external_action(phase, {}, ctx)

    assert MEASURE not in out, (
        f"external_action must emit NO {MEASURE} key — one send is not a count, and a "
        f"hardcoded 1 would be a constant dressed as a measurement. Got: {sorted(out)!r}"
    )


# ══ the census — FOUR silent, THREE declaring, and the nouns have ONE home ═══


def test_exactly_three_nouns_are_authored_and_each_has_exactly_one_home():
    """§5.1 — the three nouns are AUTHORED COPY and each is spelled at ONE executor site.

    A second home for any of these words is the drift this rule exists to prevent — the same
    one-string-home rule the repo already enforces four times over (``doorVocabulary.ts``,
    ``libraryVocabulary.ts``, ``decisionsVocabulary.ts``, ``runVocabulary.ts``). Read off the
    real source rather than asserted in prose, so a copy-paste of a declaring return into a
    fourth site goes red here.
    """
    import inspect

    from app.services.harness import phase_types

    src = inspect.getsource(phase_types)
    for noun in ("sources", "agents", "fields"):
        occurrences = src.count(f'_measure(len(')  # guard below counts per-noun
        assert occurrences == 3, (
            f"expected exactly 3 declaring call sites, found {occurrences}"
        )
        assert src.count(f', "{noun}")') == 1, (
            f'the noun "{noun}" must be spelled at exactly ONE executor site (§5.1) — a '
            f"second home is drift, and a wording change would then need two edits"
        )
