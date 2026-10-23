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


# ══ Task 2 — generate-level cases on the test_214 fake harness ═══════════════════════════
#
# Shared by test_291_generate_closed_set / _degraded / test_291_powers_guard (imported, never
# re-typed). forced_emit is patched on the module it is imported FROM and routed by its
# ``emitter`` kwarg, so the description-only call can be answered separately.

from types import SimpleNamespace  # noqa: E402

STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")
STUB_PROVIDER = "stub-provider-not-a-real-one"
DESCRIBE = "Onboard a new vendor from their form and tell finance."


def make_form(fields=None, *, arm="form_fields", text="Vendor name: ACME", filename="vendor-form.pdf") -> dict:
    return {
        "filename": filename,
        "arm": arm,
        "fields": copy.deepcopy(FIELDS if fields is None else fields),
        "text": text,
    }


class Harness:
    """Records every forced_emit call and every _assemble_grounding kwarg set."""

    def __init__(self, monkeypatch, definitions, *, powers=None, powers_raises=False,
                 tool_names=None, fidelity="fake", vocabulary=None, degraded=None):
        import app.config as cfg
        import app.models.user_settings as us
        import app.services.forced_emit as fe
        import app.services.workflow_authoring as wa

        self.calls: list[dict] = []
        self.assemble_kwargs: list[dict] = []
        self.resolve_kwargs: list[dict] = []
        defs = list(definitions)
        draft_calls: list[int] = [0]

        async def _fake_assemble(**kwargs):
            self.assemble_kwargs.append(kwargs)
            out = kwargs.get("degraded_out")
            if degraded and out is not None:
                out.update(degraded)
            return ("GROUNDED", set(tool_names or ()), set())

        async def _fake_fidelity(*_a, **_k):
            return None

        async def _fake_resolve(**kwargs):
            self.resolve_kwargs.append(kwargs)
            return dict(vocabulary or {})

        async def _fake_forced_emit(**kwargs):
            self.calls.append(kwargs)
            if kwargs.get("emitter") == "emit_describe_powers":
                if powers_raises:
                    raise RuntimeError("provider down")
                return {"emitted": powers, "failure": None if powers is not None else "no_emit"}
            idx = min(draft_calls[0], len(defs) - 1)
            draft_calls[0] += 1
            d = defs[idx]
            if d is None:
                return {"emitted": None, "failure": "validation_failed"}
            return {"emitted": _wd(d), "failure": None}

        monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
        if fidelity == "fake":
            monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)
        monkeypatch.setattr(wa, "_resolve_allowed_vocabulary", _fake_resolve)
        monkeypatch.setattr(
            cfg, "get_model_capability", lambda model: {"forced_emission": True, "provider": STUB_PROVIDER}
        )
        monkeypatch.setattr(
            us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
        )
        monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    @property
    def draft_calls(self) -> list[dict]:
        return [c for c in self.calls if c.get("emitter") != "emit_describe_powers"]

    @property
    def power_calls(self) -> list[dict]:
        return [c for c in self.calls if c.get("emitter") == "emit_describe_powers"]


async def generate(**overrides):
    import app.services.workflow_authoring as wa

    kwargs = {"describe": DESCRIBE, "supabase": object(), "user_id": "u1", "settings": STUB_SETTINGS}
    kwargs.update(overrides)
    return await wa.generate_workflow_definition(**kwargs)


ALL_COVERED = [_inp("vendor_name"), _inp("start_date"), _inp("tier"), _inp("Summary")]


# ── 291-06 (CR-02) — a real fillable-PDF shape: options cut for the PROMPT only ───────────

COUNTRIES = [f"Country {i:03d}" for i in range(195)]
BIG_PDF_FIELDS = [
    {"key": "Country", "label": "Country", "type": "enum", "enum_options": COUNTRIES, "origin": "exact"},
    {"key": "Rate %", "label": "Rate %", "type": "text", "enum_options": [], "origin": "exact"},
]


def test_the_prompt_shows_25_options_and_says_how_many_more():
    from app.services.describe_draft_guards import render_documents_block

    block = render_documents_block(make_form(fields=BIG_PDF_FIELDS), None)
    line = next(ln for ln in block.splitlines() if ln.startswith("- Country:"))
    assert "Country 024" in line
    assert "Country 025" not in line
    assert line.endswith("; and 170 more)")


@pytest.mark.asyncio
async def test_a_big_pdf_form_keeps_EVERY_option_on_the_server_added_input(monkeypatch):
    h = Harness(monkeypatch, [_definition(inputs=[]), _definition(inputs=[])])
    result = await generate(form=make_form(fields=BIG_PDF_FIELDS))
    assert result["ok"] is True
    by_key = {i["key"]: i for i in result["definition"]["inputs"]}
    assert "Rate %" in by_key
    assert by_key["Country"]["enum_options"] == COUNTRIES
    assert by_key["Country"]["origin"] == "server_added"
    # The prompt the drafter saw carried the bounded list, never all 195.
    first = h.draft_calls[0]["messages"][0]["content"]
    assert "Country 194" not in first
    assert "and 170 more" in first


@pytest.mark.asyncio
async def test_a_MODEL_declared_enum_input_gets_the_full_read_list_back(monkeypatch):
    # 291-REVIEW-R1 CR-01: the model saw 25 options and declared the input with those 25.
    # The launch form must still offer every option the form carries.
    declared = _inp("Country", type="enum", enum_options=COUNTRIES[:25])
    Harness(monkeypatch, [_definition(inputs=[declared, _inp("Rate %")])])
    result = await generate(form=make_form(fields=BIG_PDF_FIELDS))
    assert result["ok"] is True
    by_key = {i["key"]: i for i in result["definition"]["inputs"]}
    assert by_key["Country"]["enum_options"] == COUNTRIES
    assert by_key["Country"].get("origin") is None  # model-declared, not server_added


@pytest.mark.asyncio
async def test_no_files_prompt_is_byte_identical_and_result_has_no_new_keys(monkeypatch):
    h = Harness(monkeypatch, [_definition(inputs=[_inp("budget", note="n", origin="server_added")])])
    result = await generate()
    assert h.calls[0]["messages"][0]["content"] == "GROUNDED\n\n## The task to author\n" + DESCRIBE
    assert len(h.calls) == 1
    assert result["ok"] is True
    assert "removed" not in result and "fields" not in result
    # W2 — origin / note never appear as null keys; a model-set origin is stamped away.
    inp = result["definition"]["inputs"][0]
    assert "origin" not in inp and "note" not in inp


@pytest.mark.asyncio
async def test_a_no_file_draft_serialises_with_no_origin_or_note_keys(monkeypatch):
    Harness(monkeypatch, [_definition(inputs=[_inp("budget")])])
    result = await generate()
    assert result["definition"]["inputs"] == [
        {"key": "budget", "label": "budget", "type": "text", "required": True,
         "source": "user", "enum_options": [], "folder_scope": None}
    ]


@pytest.mark.asyncio
async def test_with_a_form_the_documents_come_first_and_the_task_last(monkeypatch):
    from app.services.describe_draft_guards import DATA_NOT_INSTRUCTIONS

    h = Harness(monkeypatch, [_definition(inputs=ALL_COVERED)])
    await generate(form=make_form(text="SECRET-FORM-TEXT"))
    content = h.calls[0]["messages"][0]["content"]
    assert content.startswith(DATA_NOT_INSTRUCTIONS + "\n<documents>")
    assert content.endswith("## The task to author\n" + DESCRIBE)
    assert content.index("</documents>") < content.index("GROUNDED")
    assert "SECRET-FORM-TEXT" in content
    assert "SECRET-FORM-TEXT" not in h.calls[0]["system_prompt"]


@pytest.mark.asyncio
@pytest.mark.parametrize("arm", ["template_fields", "form_fields", "blanks"])
async def test_a_fillable_arm_forwards_its_keys_as_template_placeholders(monkeypatch, arm):
    h = Harness(monkeypatch, [_definition(inputs=ALL_COVERED)])
    await generate(form=make_form(arm=arm))
    assert h.assemble_kwargs[0]["template_placeholders"] == ["vendor_name", "start_date", "tier", "Summary"]


@pytest.mark.asyncio
async def test_suggested_fields_do_not_become_template_placeholders(monkeypatch):
    h = Harness(monkeypatch, [_definition(inputs=ALL_COVERED)])
    await generate(form=make_form(arm="suggested_fields"))
    assert h.assemble_kwargs[0]["template_placeholders"] is None


@pytest.mark.asyncio
async def test_a_missing_field_gets_ONE_retry_that_names_it_and_the_retry_wins(monkeypatch):
    first = _definition(inputs=[_inp("vendor_name"), _inp("start_date"), _inp("Summary")])
    h = Harness(monkeypatch, [first, _definition(inputs=ALL_COVERED)])
    result = await generate(form=make_form())
    assert len(h.draft_calls) == 2
    assert "tier" in h.draft_calls[1]["messages"][-1]["content"]
    assert result["ok"] is True
    assert all(i.get("origin") != "server_added" for i in result["definition"]["inputs"])
    assert [f["covered_by"] for f in result["fields"]] == ["input", "input", "input", "input"]


@pytest.mark.asyncio
async def test_still_missing_after_the_retry_is_SERVER_ADDED(monkeypatch):
    first = _definition(inputs=[_inp("vendor_name"), _inp("start_date")], slugs=("gather", "summary"))
    h = Harness(monkeypatch, [first, first])
    result = await generate(form=make_form())
    assert len(h.draft_calls) == 2
    by = {i["key"]: i for i in result["definition"]["inputs"]}
    assert by["tier"]["origin"] == "server_added"
    assert by["tier"]["source"] == "user"
    assert by["tier"]["type"] == "enum" and by["tier"]["enum_options"] == ["gold", "silver"]
    assert by["start_date"]["origin"] == "ai_proposed"
    assert "Summary" not in by  # covered by the "summary" step
    got = {f["key"]: f["covered_by"] for f in result["fields"]}
    assert got == {"vendor_name": "input", "start_date": "input", "tier": "input", "Summary": "step"}


@pytest.mark.asyncio
async def test_the_drafting_budget_is_at_most_three(monkeypatch):
    partial = _definition(inputs=[_inp("vendor_name")])
    h = Harness(monkeypatch, [None, partial, partial])
    result = await generate(form=make_form())
    assert result["ok"] is True
    assert len(h.draft_calls) == 3


@pytest.mark.asyncio
async def test_a_model_claimed_server_added_origin_is_overwritten(monkeypatch):
    inputs = [dict(i) for i in ALL_COVERED]
    inputs[0]["origin"] = "server_added"
    Harness(monkeypatch, [_definition(inputs=inputs)])
    result = await generate(form=make_form())
    by = {i["key"]: i for i in result["definition"]["inputs"]}
    assert "origin" not in by["vendor_name"]
    assert by["start_date"]["origin"] == "ai_proposed"


@pytest.mark.asyncio
async def test_R1_WR02_form_derived_placeholders_are_grounded_by_reference(monkeypatch):
    # The fillable form's keys already sit inside the escaped <form_fields> block, so the
    # grounding section is told to refer to it instead of listing them again, raw.
    h = Harness(monkeypatch, [_definition(inputs=ALL_COVERED)])
    await generate(form=make_form())
    assert h.assemble_kwargs[0]["placeholders_in_form_block"] is True


@pytest.mark.asyncio
async def test_R1_WR02_client_supplied_template_placeholders_keep_the_listed_grounding(monkeypatch):
    h = Harness(monkeypatch, [_definition(inputs=[])])
    await generate(template_placeholders=["project_name"])
    assert h.assemble_kwargs[0]["placeholders_in_form_block"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("emitted, expected_order", [
    ([1], ["gather"]),                              # live at 291 UAT S1: one step numbered 1
    ([1, 2, 3], ["gather", "write", "send"]),       # numbered from 1
    ([5, 0, 9], ["write", "gather", "send"]),       # gaps; order follows the model's numbers
    ([0, 0, 1], ["gather", "write", "send"]),       # a tie keeps the emitted order
])
async def test_an_accepted_draft_is_renumbered_0_to_n(monkeypatch, emitted, expected_order):
    # A draft whose phase_index is not 0..N-1 was saved as-is and could never publish
    # ("phase_index must be contiguous 0..0, got [1]"). The server now renumbers it.
    d = _definition(inputs=[], slugs=("gather", "write", "send")[: len(emitted)])
    for p, idx in zip(d["phases"], emitted):
        p["phase_index"] = idx
    Harness(monkeypatch, [d])
    result = await generate()
    assert result["ok"] is True
    phases = sorted(result["definition"]["phases"], key=lambda p: p["phase_index"])
    assert [p["phase_index"] for p in phases] == list(range(len(emitted)))
    assert [p["slug"] for p in phases] == expected_order
