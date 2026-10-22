"""Phase 291-02 (D-10 / D-11 / D-12, SC#1) — every field found maps to exactly one input or to
a step whose slug names it, checked by the SERVER.

The prompt only asks; the server finds what the draft left out, retries once, and then adds
an ask-the-person input stamped ``server_added`` itself. Provenance is stamped server-side on
every generation and never read off the emitted payload (T-291-13, both directions).

Pure cases first (Task 1), then generate-level cases (Task 2). No network, no DB.
"""

from __future__ import annotations

import copy

import pytest

from pydantic import ValidationError

FIELDS = [
    {"key": "vendor_name", "label": "Vendor name", "type": "text", "enum_options": [], "origin": "exact"},
    {"key": "start_date", "label": "Start date", "type": "date", "enum_options": [], "origin": "ai_proposed"},
    {"key": "tier", "label": "Tier", "type": "enum", "enum_options": ["gold", "silver"], "origin": "exact"},
    {"key": "Summary", "label": "Summary", "type": "text", "enum_options": [], "origin": "exact"},
]


def _definition(inputs=None, slugs=("gather",)) -> dict:
    d = {
        "slug": "vendor-onboarding",
        "version": 1,
        "name": "Vendor onboarding",
        "status": "draft",
        "phases": [
            {
                "slug": s,
                "phase_index": i,
                "name": s,
                "config": {"phase_type": "llm_single", "prompt": f"Do {s}."},
                "validators": [],
            }
            for i, s in enumerate(slugs)
        ],
    }
    if inputs is not None:
        d["inputs"] = inputs
    return d


def _inp(key: str, **extra) -> dict:
    return {"key": key, "label": key, "type": "text", **extra}


def _wd(d: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(copy.deepcopy(d))


# ── InputFieldSpec origin / note ──────────────────────────────────────────────────────────


def test_input_field_spec_accepts_origin_and_note_and_still_forbids_extras():
    from app.models.harness import InputFieldSpec, WorkflowDefinition

    spec = InputFieldSpec(key="k", label="K", type="text", origin="server_added", note="why")
    assert spec.origin == "server_added" and spec.note == "why"
    with pytest.raises(ValidationError):
        InputFieldSpec(key="k", label="K", type="text", origin="hand_typed")
    with pytest.raises(ValidationError):
        InputFieldSpec(key="k", label="K", type="text", provenance="x")

    d = _definition(inputs=[_inp("a", origin="ai_proposed", note="n")])
    wd = WorkflowDefinition.model_validate(d)
    again = WorkflowDefinition.model_validate(wd.model_dump(mode="json"))
    assert again.inputs[0].origin == "ai_proposed"
    assert again.inputs[0].note == "n"


# ── missing_fields / covered_by ───────────────────────────────────────────────────────────


def test_missing_fields_in_form_order_slug_casefolded_input_exact():
    from app.services.describe_draft_guards import missing_fields

    wd = _wd(_definition(inputs=[_inp("vendor_name"), _inp("TIER")], slugs=("gather", "summary")))
    # tier: input key "TIER" != "tier" (input keys are EXACT) → missing.
    # Summary: phase slug "summary" (case-folded) names it → covered.
    assert missing_fields(wd, FIELDS) == ["start_date", "tier"]


def test_an_input_key_present_TWICE_is_reported():
    from app.services.describe_draft_guards import missing_fields

    wd = _wd(_definition(inputs=[_inp("vendor_name"), _inp("vendor_name")]))
    assert "vendor_name" in missing_fields(wd, FIELDS)


def test_inputs_None_means_every_unslugged_field_is_missing():
    from app.services.describe_draft_guards import missing_fields

    assert missing_fields(_wd(_definition()), FIELDS) == ["vendor_name", "start_date", "tier", "Summary"]
    assert missing_fields(_wd(_definition()), []) == []


def test_covered_by_input_wins_over_step():
    from app.services.describe_draft_guards import covered_by

    wd = _wd(_definition(inputs=[_inp("Summary")], slugs=("gather", "summary", "vendor_name")))
    got = covered_by(wd, FIELDS)
    assert got["Summary"] == "input"
    assert got["vendor_name"] == "step"
    assert got["start_date"] is None


# ── add_server_inputs ─────────────────────────────────────────────────────────────────────


def test_add_server_inputs_uses_the_D11_type_map_and_never_mutates():
    from app.services.describe_draft_guards import add_server_inputs

    wd = _wd(_definition(inputs=[]))
    out = add_server_inputs(wd, FIELDS, ["start_date", "tier"])
    assert wd.inputs == []  # the original is untouched
    assert [i.key for i in out.inputs] == ["start_date", "tier"]
    sd, tier = out.inputs
    assert (sd.type, sd.label, sd.required, sd.source) == ("date", "Start date", True, "user")
    assert (tier.type, tier.enum_options) == ("enum", ["gold", "silver"])


def test_add_server_inputs_skips_reserved_keys_and_preserves_None():
    from app.services.describe_draft_guards import add_server_inputs

    reserved = [{"key": "folder_id", "label": "Folder", "type": "text", "enum_options": [], "origin": "exact"}]
    wd = _wd(_definition())
    assert add_server_inputs(wd, reserved, ["folder_id"]).inputs is None
    assert add_server_inputs(wd, FIELDS, []).inputs is None
    wd_empty = _wd(_definition(inputs=[]))
    assert add_server_inputs(wd_empty, FIELDS, []).inputs == []


# ── stamp_input_origins (T-291-13, both directions) ───────────────────────────────────────


def test_stamps_OVERWRITE_what_the_model_emitted_both_directions():
    from app.services.describe_draft_guards import stamp_input_origins

    wd = _wd(_definition(inputs=[
        _inp("vendor_name", origin="server_added"),  # model lies: claims the server added it
        _inp("start_date"),                           # ai_proposed field, model emitted None
        _inp("tier"),                                 # added below by the server, emitted None
        _inp("budget", note="Asked so the brief can size the deal.", origin="server_added"),
        _inp("Summary", note="model note on a field input"),
    ]))
    out = stamp_input_origins(wd, FIELDS, ["tier"])
    by = {i.key: i for i in out.inputs}
    assert by["vendor_name"].origin is None
    assert by["start_date"].origin == "ai_proposed"
    assert by["tier"].origin == "server_added"
    assert by["budget"].origin is None
    assert by["budget"].note == "Asked so the brief can size the deal."  # non-field: kept
    assert by["Summary"].note is None  # field input: cleared


def test_with_no_fields_every_origin_and_note_is_cleared():
    from app.services.describe_draft_guards import stamp_input_origins

    wd = _wd(_definition(inputs=[_inp("a", origin="server_added", note="n")]))
    out = stamp_input_origins(wd, [], [])
    assert out.inputs[0].origin is None and out.inputs[0].note is None
    assert stamp_input_origins(_wd(_definition()), [], []).inputs is None
