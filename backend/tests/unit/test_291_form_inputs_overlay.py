"""Phase 291 (AUTH-02, plan 291-03 Task 2) — the person's answers reach the filled form (D-09).

An LLM phase never sees the run's launch inputs, and the citation gate rejects any value
without a retrieved citation (RESEARCH Pitfall 1). So an "ask the person" input used to
reach the run and then vanish: the filled form came back with every asked field blank.

``harness.form_inputs.overlay_user_inputs`` is the pure leaf that fixes it: for each declared
input whose ``source == "user"`` and whose key the template names, the launch value is
written into the field map with a SERVER-MINTED ``input:<key>`` citation, and that id is
returned so both gates accept it. KB-filled keys still need real retrieved citations.

Also pinned here: ``_template_oracle`` reads a fillable PDF's field names (the one reader,
``describe_files.acroform_oracle``), so the forced emit is told the form's exact fields.
"""

from __future__ import annotations

import copy
import io
from types import SimpleNamespace

import pytest


def _spec(key, source="user", type_="text"):
    from app.models.harness import InputFieldSpec

    return InputFieldSpec(key=key, label=key.title(), type=type_, source=source)


def _definition(inputs, assets=None):
    return SimpleNamespace(
        slug="vendor-form",
        version=1,
        definition_id="00000000-0000-0000-0000-000000000291",
        assets=assets or [],
        inputs=inputs,
    )


def _leaf(value, cid):
    return {"value": value, "source_chunk_id": cid, "source_doc": None, "source_page": None}


def _map():
    return {
        "scalars": {
            "name": _leaf(None, None),
            "company": _leaf("X Corp", "chunk-1"),
        },
        "collections": {},
    }


# ── the pure overlay ──────────────────────────────────────────────────────────


def test_user_input_is_written_with_a_server_minted_citation():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name"), _spec("company", source="kb_auto", type_="kb_auto")])
    new_map, ids = overlay_user_inputs(_map(), d, {"name": "Ann", "company": "X"}, ["name", "company"])
    assert new_map["scalars"]["name"] == {
        "value": "Ann", "source_chunk_id": "input:name", "source_doc": None, "source_page": None,
    }
    assert new_map["scalars"]["company"] == _leaf("X Corp", "chunk-1")  # kb_auto ignored
    assert ids == {"input:name"}


def test_both_gates_accept_it_and_a_kb_invented_citation_is_still_rejected():
    from app.services.harness.form_inputs import overlay_user_inputs
    from app.services.template_render_service import check_coverage

    d = _definition([_spec("name"), _spec("company", source="kb_auto", type_="kb_auto")])
    new_map, ids = overlay_user_inputs(_map(), d, {"name": "Ann"}, ["name", "company"])
    gate = check_coverage(new_map, {"chunk-1"} | ids, ["name", "company"])
    assert "name" in gate["covered_keys"]
    assert gate["uncited_value_count"] == 0 and gate["invented_citation_count"] == 0

    bad = copy.deepcopy(new_map)
    bad["scalars"]["company"] = _leaf("X Corp", "chunk-invented")
    gate = check_coverage(bad, {"chunk-1"} | ids, ["name", "company"])
    assert gate["invented_citation_count"] == 1  # the overlay never weakens KB citations


def test_a_minted_id_cited_by_any_other_leaf_counts_as_uncited():
    # WR-05: an emitter (or an injected passage naming the predictable id) must not be able
    # to pass an invented KB value, or a collection cell, by citing someone else's input:<key>.
    from app.services.harness.form_inputs import overlay_user_inputs
    from app.services.template_render_service import check_coverage

    d = _definition([_spec("name"), _spec("company", source="kb_auto", type_="kb_auto")])
    emitted = _map()
    emitted["scalars"]["company"] = _leaf("Invented Ltd", "input:name")
    emitted["collections"] = {"rows": [{"item": _leaf("Fake", "input:name")}]}
    new_map, ids = overlay_user_inputs(emitted, d, {"name": "Ann"}, ["name", "company", "rows"])
    assert new_map["scalars"]["name"]["source_chunk_id"] == "input:name"
    assert new_map["scalars"]["company"]["source_chunk_id"] is None
    assert new_map["collections"]["rows"][0]["item"]["source_chunk_id"] is None
    assert emitted["scalars"]["company"]["source_chunk_id"] == "input:name"  # input untouched
    gate = check_coverage(new_map, {"chunk-1"} | ids, ["name", "company", "rows"])
    assert gate["uncited_value_count"] == 2


def test_a_user_key_cannot_mint_a_citation_for_a_kb_key():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name"), _spec("company", source="kb_auto", type_="kb_auto")])
    _, ids = overlay_user_inputs(_map(), d, {"name": "Ann", "company": "Evil"}, ["name", "company"])
    assert ids == {"input:name"}


@pytest.mark.parametrize(
    "run_inputs, keys",
    [
        ({"name": "Ann"}, ["company"]),  # not a placeholder of this template
        ({"name": ""}, ["name", "company"]),  # empty answer
        ({"name": "   "}, ["name", "company"]),  # blank answer
        ({}, ["name", "company"]),  # no answer
        (None, ["name", "company"]),  # no launch bag at all
    ],
)
def test_untouched_cases_leave_the_map_as_emitted(run_inputs, keys):
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name")])
    m = _map()
    before_map, before_d, before_in = copy.deepcopy(m), copy.deepcopy(d), copy.deepcopy(run_inputs)
    new_map, ids = overlay_user_inputs(m, d, run_inputs, keys)
    assert new_map == before_map
    assert ids == set()
    assert m == before_map and d == before_d and run_inputs == before_in


def test_inputs_are_never_mutated():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name")])
    m = _map()
    run_inputs = {"name": "Ann"}
    before_map, before_d = copy.deepcopy(m), copy.deepcopy(d)
    new_map, _ = overlay_user_inputs(m, d, run_inputs, ["name"])
    assert m == before_map and d == before_d and run_inputs == {"name": "Ann"}
    assert new_map is not m and new_map["scalars"] is not m["scalars"]


def test_numbers_and_booleans_overlay_as_strings():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("qty", type_="number"), _spec("agree")])
    m = {"scalars": {"qty": _leaf(None, None), "agree": _leaf(None, None)}, "collections": {}}
    new_map, ids = overlay_user_inputs(m, d, {"qty": 3, "agree": True}, ["qty", "agree"])
    assert new_map["scalars"]["qty"]["value"] == "3"
    assert new_map["scalars"]["agree"]["value"] == "True"
    assert ids == {"input:qty", "input:agree"}


def test_a_placeholder_key_absent_from_the_emitted_map_is_added():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name")])
    m = {"scalars": {}, "collections": {}}
    new_map, ids = overlay_user_inputs(m, d, {"name": "Ann"}, ["name"])
    assert new_map["scalars"]["name"]["source_chunk_id"] == "input:name"
    assert ids == {"input:name"}


def test_golden_run_placeholder_overlays_like_any_value():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name"), _spec("agree")])
    golden = {"name": "golden run placeholder for name", "agree": "golden run placeholder for agree"}
    new_map, ids = overlay_user_inputs(_map(), d, golden, ["name", "agree"])
    assert new_map["scalars"]["name"]["value"] == "golden run placeholder for name"
    assert new_map["scalars"]["agree"]["value"] == "golden run placeholder for agree"
    assert ids == {"input:name", "input:agree"}


@pytest.mark.parametrize("inputs", [None, []])
def test_no_declared_inputs_is_a_no_op(inputs):
    from app.services.harness.form_inputs import overlay_user_inputs

    new_map, ids = overlay_user_inputs(_map(), _definition(inputs), {"name": "Ann"}, ["name"])
    assert new_map == _map() and ids == set()


def test_dict_shaped_definitions_work_too():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = {"inputs": [{"key": "name", "source": "user"}, {"key": "company", "source": "kb_auto"}]}
    new_map, ids = overlay_user_inputs(_map(), d, {"name": "Ann", "company": "X"}, ["name", "company"])
    assert ids == {"input:name"}
    assert new_map["scalars"]["name"]["value"] == "Ann"


def test_template_derived_inputs_are_ignored():
    from app.services.harness.form_inputs import overlay_user_inputs

    d = _definition([_spec("name", source="template_derived")])
    new_map, ids = overlay_user_inputs(_map(), d, {"name": "Ann"}, ["name"])
    assert ids == set() and new_map == _map()


# ── the PDF oracle ────────────────────────────────────────────────────────────


def _acro_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.acroForm.textfield(name="name", x=150, y=690, width=200, height=20)
    c.acroForm.checkbox(name="agree", x=150, y=640, size=14)
    c.showPage()
    c.save()
    return buf.getvalue()


def _flat_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 700, "Name: ____________")
    c.showPage()
    c.save()
    return buf.getvalue()


def test_template_oracle_reads_a_fillable_pdf():
    from app.services.harness.phase_types import _template_oracle

    assert _template_oracle({"filename": "w9.pdf", "bytes": _acro_pdf()}) == {
        "scalars": ["name", "agree"], "collections": [], "columns": {},
    }
    assert _template_oracle({"filename": "W9.PDF", "bytes": _acro_pdf()})["scalars"] == ["name", "agree"]


def test_template_oracle_pdf_without_fields_or_bytes_is_none():
    from app.services.harness.phase_types import _template_oracle

    assert _template_oracle({"filename": "flat.pdf", "bytes": _flat_pdf()}) is None
    assert _template_oracle({"filename": "w9.pdf", "bytes": b""}) is None
    assert _template_oracle({"filename": "w9.pdf"}) is None


def test_template_oracle_docx_and_others_unchanged():
    from app.services.harness.phase_types import _template_oracle

    assert _template_oracle({"filename": "x.pptx", "bytes": b"PK"}) is None
    assert _template_oracle({"filename": "x.docx", "bytes": b""}) is None


# ── the executor: a user-sourced key no longer reaches emit_rejected ─────────


@pytest.fixture()
def _emit_bag(monkeypatch):
    """The test_llm_emit_executor.py fakes, copied (forced_emit / resolve / audit / render)."""
    from app.services.harness import emitters, phase_types

    bag: dict = {"audit": [], "forced_calls": [], "render_calls": [], "surface": []}

    async def _forced(**kwargs):
        bag["forced_calls"].append(kwargs)
        return bag["forced_result"]

    async def _resolve(**kwargs):
        return {"bytes": _acro_pdf(), "filename": "vendor.pdf", "provenance": "library",
                "mime": "application/pdf", "error": None}

    async def _audit(pool, run_id, *, user_id, event_type, metadata):
        bag["audit"].append((event_type, metadata))

    async def _render(validated_map, resolved_template, ctx):
        bag["render_calls"].append((validated_map, resolved_template))
        return {"status": "ok", "path": "/vendor.pdf",
                "output_file": {"path": "/vendor.pdf", "sha256": "abc", "bytes": 10}}

    async def _surface(ctx, run_id, reason, pool):
        bag["surface"].append(reason)
        return "msg-id"

    monkeypatch.setattr(phase_types, "forced_emit", _forced)
    monkeypatch.setattr(phase_types, "resolve_template_source", _resolve)
    monkeypatch.setattr(phase_types, "write_audit", _audit)
    monkeypatch.setattr(phase_types, "_surface_failure_message", _surface)
    entry = emitters.EMITTER_REGISTRY["render_template"]
    monkeypatch.setitem(
        emitters.EMITTER_REGISTRY, "render_template",
        emitters.EmitterEntry(schema_builder=entry.schema_builder, post_processor=_render),
    )
    return bag


def _phase():
    cfg = SimpleNamespace(
        phase_type="llm_emit", prompt="Fill the vendor form.", emitter="render_template",
        model=None, folder_scope=None, skill_ref=None, skill_snapshot=None,
        available_tools=["render_template"],
    )
    return SimpleNamespace(slug="fill", phase_index=1, config=cfg)


def _ctx(definition, inputs):
    return SimpleNamespace(
        run_id="11111111-1111-1111-1111-111111111111",
        producer_run_id="22222222-2222-2222-2222-222222222222",
        thread_id="33333333-3333-3333-3333-333333333333",
        current_user={"id": "44444444-4444-4444-4444-444444444444"},
        user_settings=None, model="gpt-5.4", inputs=inputs, pool=object(), supabase=object(),
        redis=None, emit=None, retry_feedback=None, definition=definition, folder_subtree_ids=None,
    )


@pytest.mark.asyncio
async def test_user_sourced_key_is_filled_and_never_rejected(_emit_bag):
    from app.models.harness import AssetRef
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.template_render_service import EmitFieldMap

    bag = _emit_bag
    # The model cannot see the person's answer: it emits ``name`` uncited.
    bag["forced_result"] = {
        "emitted": EmitFieldMap.model_validate({
            "scalars": [
                {"key": "name", "value": "a guess", "source_chunk_id": None,
                 "source_doc": None, "source_page": None},
                {"key": "agree", "value": "yes", "source_chunk_id": "chunk-1",
                 "source_doc": "terms.pdf", "source_page": 1},
            ],
            "rows": [],
        }),
        "tier": "TIER-FORCE", "provider": "openai", "forced": True,
        "recovered_from_narration": False, "truncated": False, "failure": None,
    }
    asset = AssetRef(asset_id="u/_library/d/vendor.pdf", filename="vendor.pdf",
                     kind="template", mime="application/pdf")
    definition = _definition(
        [_spec("name"), _spec("agree", source="kb_auto", type_="kb_auto")], assets=[asset]
    )
    acc = {"retrieval": {"text": "retrieved", "source_refs": [{"chunk_id": "chunk-1"}]}}
    out = await _exec_llm_emit(_phase(), acc, _ctx(definition, {"kickoff_prompt": "go", "name": "Ann"}))

    events = [ev for ev, _ in bag["audit"]]
    assert "emit_rejected" not in events, bag["audit"]
    assert out.get("failure") is None
    assert len(bag["render_calls"]) == 1
    validated_map, resolved = bag["render_calls"][0]
    assert validated_map["scalars"]["name"]["value"] == "Ann"
    assert validated_map["scalars"]["name"]["source_chunk_id"] == "input:name"
    assert "input:name" in resolved["retrieved_ids"]  # the handler gate accepts it too
    assert "chunk-1" in resolved["retrieved_ids"]
    assert "input:name" in out["retrieved_ids"]
    # The PDF oracle told the forced shot the form's exact fields.
    assert "TEMPLATE PLACEHOLDERS" in bag["forced_calls"][0]["messages"][0]["content"]
