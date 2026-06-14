"""Phase 101.1 (D-01 / D-04 / D-08 / D-10 / D-12) — the ``_exec_llm_emit`` executor contract.

Wave 3 (Plan 101.1-03) un-marks these from the Wave-0 RED stubs to GREEN. The 6th
harness executor (``_exec_llm_emit``) composes the Plan 01 substrate (the flat
``EmitFieldMap`` + ``EMITTER_REGISTRY`` + the audit kinds) and the Plan 02 core (the
gateway forcing seam + ``forced_emit`` with NATIVE recovery + truncation guard) into a
working forced-emit phase:

  - Pitfall 5 / D-01: the emit step does its OWN sealed forced single call (``forced_emit``)
    — it MUST NOT route through the open agent loop (``run_task_sub_agent``), which is the
    exact GAP-A root cause (reasoning models narrate under ``tool_choice=auto``).
  - GAP-B / D-10: the bound library template AssetRef is RESOLVED server-side and injected
    at phase-build time — the model NEVER selects the template.
  - D-08: the 6-layer no-fail ladder (isolation → forcing → NATIVE recovery → citation gate
    → bounded retry → honest failure), engine-owned; 5 distinguishable failure states.
  - render: the validated field-map rides the EMITTER_REGISTRY ``render_template``
    post_processor → the HARDENED ``_handle_render_template`` (one render code path).
  - D-12: every emit transition writes an INSERT-only ``harness_audit`` receipt.
  - Deep byte-identical: ``render_template`` reachable ONLY from a declaring ``llm_emit``
    phase, never from ``get_tools()``.

CONVENTION: ``from app.services... import ...`` is INSIDE each test body so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest


# ── synthetic harness ctx + phase fakes (the project's existing harness shape) ──


def _fake_asset_ref(kind: str = "template", filename: str = "register.docx"):
    """A WorkflowDefinition.assets[] entry of the given kind (the GAP-B source)."""
    from app.models.harness import AssetRef

    return AssetRef(
        asset_id=f"{kind}-asset-id",
        filename=filename,
        kind=kind,  # type: ignore[arg-type]
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


def _fake_definition(assets):
    """A minimal definition stand-in carrying assets + version/id (the audit keys)."""
    return SimpleNamespace(
        slug="risk-register",
        version=3,
        definition_id="00000000-0000-0000-0000-0000000101a0",
        assets=assets,
    )


def _fake_phase(prompt="Fill the register.", emitter="render_template", slug="fill"):
    cfg = SimpleNamespace(
        phase_type="llm_emit",
        prompt=prompt,
        emitter=emitter,
        model=None,
        folder_scope=None,
        skill_ref=None,
        skill_snapshot=None,
        available_tools=["render_template"],
    )
    return SimpleNamespace(slug=slug, phase_index=1, config=cfg)


def _fake_ctx(definition, *, audit_sink, model="gpt-5.4"):
    """The harness ctx bag the executor reads via getattr (mirrors the live SimpleNamespace).

    ``audit_sink`` records every write_audit call so the per-transition receipts can be
    asserted. ``pool``/``supabase`` are inert stand-ins (resolve_template_source is patched).
    """
    return SimpleNamespace(
        run_id="11111111-1111-1111-1111-111111111111",
        producer_run_id="22222222-2222-2222-2222-222222222222",
        thread_id="33333333-3333-3333-3333-333333333333",
        current_user={"id": "44444444-4444-4444-4444-444444444444"},
        user_settings=None,
        model=model,
        inputs={"kickoff_prompt": "Fill the risk register from the KB."},
        pool=object(),
        supabase=object(),
        redis=None,
        emit=None,
        retry_feedback=None,
        definition=definition,
        folder_subtree_ids=None,
    )


_VALID_FM = {
    "scalars": [
        {
            "key": "project_name",
            "value": "Meridian",
            "source_chunk_id": "chunk-1",
            "source_doc": "brief.docx",
            "source_page": 1,
        }
    ],
    "rows": [],
}


def _retrieved_accumulated(*chunk_ids):
    """A prior-retrieval-phase output carrying the spotlight ids the citation gate
    validates the emission's source_chunk_id against (the D-13 two-step grounding)."""
    return {"retrieval": {"text": "retrieved", "source_refs": [
        {"chunk_id": cid} for cid in (chunk_ids or ("chunk-1",))
    ]}}


def _forced_ok(emitted=None):
    """A forced_emit success result (the happy path the executor consumes)."""
    from app.services.template_render_service import EmitFieldMap

    fm = emitted or EmitFieldMap.model_validate(_VALID_FM)
    return {
        "emitted": fm,
        "tier": "TIER-FORCE",
        "provider": "openai",
        "forced": True,
        "recovered_from_narration": False,
        "truncated": False,
        "failure": None,
    }


def _forced_fail():
    return {
        "emitted": None,
        "tier": "TIER-FORCE",
        "provider": "openai",
        "forced": True,
        "recovered_from_narration": False,
        "truncated": False,
        "failure": "model_failed_to_emit",
    }


@pytest.fixture()
def _patch_executor(monkeypatch):
    """Patch the executor's substrate seams (forced_emit / resolve_template_source /
    write_audit / the render post_processor / the honest-fail surface) so the 6-layer
    ladder runs deterministically offline. Returns a recorder bag."""
    from app.services.harness import phase_types
    from app.services.harness import emitters

    bag: dict = {
        "audit": [],          # [(event_type, metadata)] per write_audit
        "forced_calls": [],   # the kwargs forced_emit was called with
        "resolve_calls": [],  # the kwargs resolve_template_source was called with
        "render_calls": [],   # the post_processor render dispatches
        "surface_calls": [],  # the honest-fail reasons surfaced
        "forced_result": _forced_ok(),
        "resolve_result": {
            "bytes": b"PK\x03\x04docx",
            "filename": "register.docx",
            "provenance": "library",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "error": None,
        },
        "render_result": {"status": "ok", "path": "/register.docx",
                          "output_file": {"path": "/register.docx", "sha256": "abc", "bytes": 1234}},
    }

    async def _fake_forced_emit(**kwargs):
        bag["forced_calls"].append(kwargs)
        # 101.1-06 retry tests: an optional per-attempt queue; static result otherwise.
        if bag.get("forced_queue"):
            return bag["forced_queue"].pop(0)
        return bag["forced_result"]

    async def _fake_resolve(**kwargs):
        bag["resolve_calls"].append(kwargs)
        return bag["resolve_result"]

    async def _fake_write_audit(pool, run_id, *, user_id, event_type, metadata):
        bag["audit"].append((event_type, metadata))

    async def _fake_render_post(validated_map, resolved_template, ctx):
        bag["render_calls"].append((validated_map, resolved_template))
        return bag["render_result"]

    async def _fake_surface(ctx, run_id, reason, pool):
        bag["surface_calls"].append(reason)
        return "msg-id"

    monkeypatch.setattr(phase_types, "forced_emit", _fake_forced_emit)
    monkeypatch.setattr(phase_types, "resolve_template_source", _fake_resolve)
    monkeypatch.setattr(phase_types, "write_audit", _fake_write_audit)
    monkeypatch.setattr(phase_types, "_surface_failure_message", _fake_surface)
    # The render dispatch rides the EMITTER_REGISTRY post_processor — patch the entry's
    # callable so the executor test does not need a live sandbox.
    entry = emitters.EMITTER_REGISTRY["render_template"]
    monkeypatch.setitem(
        emitters.EMITTER_REGISTRY,
        "render_template",
        emitters.EmitterEntry(schema_builder=entry.schema_builder, post_processor=_fake_render_post),
    )
    return bag


# ── D-01 / Pitfall 5: the sealed forced shot, never the open loop ──────────────


def test_emit_never_uses_agent_loop():
    """``_exec_llm_emit`` MUST NOT invoke the open agent loop (``run_task_sub_agent``)
    — it runs a sealed forced single call instead (the GAP-A root-cause guard).
    Proven by source inspection of the executor."""
    import inspect

    from app.services.harness import phase_types

    src = inspect.getsource(phase_types._exec_llm_emit)
    assert "run_task_sub_agent" not in src, (
        "_exec_llm_emit must not call the open agent loop (GAP-A root cause / Pitfall 5)"
    )
    assert "run_agent_loop" not in src
    # It MUST call the sealed forced-emit substrate.
    assert "forced_emit" in src


async def test_emit_runs_forced_shot_not_open_loop(_patch_executor):
    """The executor drives forced_emit (the sealed shot) and never the sub-agent loop;
    monkeypatch run_task_sub_agent to raise so any accidental call fails loudly."""
    from app.services.harness import phase_types

    def _boom(*a, **k):
        raise AssertionError("_exec_llm_emit must NOT call run_task_sub_agent (GAP-A)")

    # If the executor ever reached the open loop this would raise.
    phase_types.run_task_sub_agent  # symbol exists
    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)

    out = await phase_types._exec_llm_emit(phase, _retrieved_accumulated("chunk-1"), ctx)
    assert _patch_executor["forced_calls"], "forced_emit was not called (the sealed shot)"
    assert isinstance(out, dict) and "text" in out


# ── GAP-B / D-10: the bound AssetRef is resolved server-side + injected ─────────


async def test_bound_assetref_injected(_patch_executor):
    """The bound library template ``AssetRef`` is resolved server-side and injected
    into the emit args at phase-build time — the model never selects the template
    (closes the GAP-B fall-through to the ephemeral-upload branch)."""
    from app.services.harness.phase_types import _emit_bound_asset_ref, _exec_llm_emit

    # The helper picks the assets[] entry of kind=="template" (NOT a reference asset).
    tmpl = _fake_asset_ref("template", "register.docx")
    ref = _fake_asset_ref("reference", "notes.docx")
    definition = _fake_definition([ref, tmpl])
    assert _emit_bound_asset_ref(definition) is tmpl

    # The executor resolves THAT AssetRef (not None) — the model never selects it.
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)
    await _exec_llm_emit(phase, {}, ctx)
    assert _patch_executor["resolve_calls"], "resolve_template_source was not called"
    call = _patch_executor["resolve_calls"][0]
    assert call.get("asset_ref") is tmpl, "GAP-B: the bound template AssetRef must be injected, not None"


async def test_no_template_bound_is_honest_state_e(_patch_executor):
    """A definition with NO template asset AND no ephemeral upload that resolves =>
    failure state (e) no_template_bound — an honest receipt + a surfaced reason."""
    from app.services.harness.phase_types import _exec_llm_emit

    # No template asset on the definition AND the ephemeral resolve returns no bytes.
    _patch_executor["resolve_result"] = {
        "bytes": None, "filename": None, "provenance": "template_input",
        "mime": None, "error": "No template uploaded to this thread.",
    }
    definition = _fake_definition([])  # no assets at all
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)

    out = await _exec_llm_emit(phase, {}, ctx)
    kinds = [k for k, _ in _patch_executor["audit"]]
    assert "emit_failed" in kinds
    # The honest reason names the no_template_bound state.
    assert any("no_template_bound" in str(r) or "template" in str(r).lower()
               for r in _patch_executor["surface_calls"])
    assert out.get("failure") == "no_template_bound"


# ── D-12: every transition writes an INSERT-only audit receipt ─────────────────


def test_emit_writes_audit_receipt():
    """Every emit transition writes an INSERT-only ``harness_audit`` receipt
    (``emit_forced`` / ``emit_validated`` / ...) keyed to run_id + definition@version."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    # The receipt kinds the executor writes must be accepted by the audit helper.
    assert "emit_forced" in _AUDIT_EVENT_TYPES
    assert "emit_validated" in _AUDIT_EVENT_TYPES


async def test_emit_audit_receipt_transitions(_patch_executor):
    """The happy path writes emit_forced → emit_validated → emit_rendered, each keyed
    to run_id + definition@version with the RESEARCH §4 metadata keys (D-12)."""
    from app.services.harness.phase_types import _exec_llm_emit

    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)

    await _exec_llm_emit(phase, _retrieved_accumulated("chunk-1"), ctx)
    kinds = [k for k, _ in _patch_executor["audit"]]
    # The forced shot, the validated gate, and the rendered file each leave a receipt.
    assert "emit_forced" in kinds
    assert "emit_validated" in kinds
    assert "emit_rendered" in kinds
    # The receipt carries the definition@version + the emitter/tier/provider facts (§4).
    meta = dict(_patch_executor["audit"])["emit_forced"] if False else None
    forced_meta = next(m for k, m in _patch_executor["audit"] if k == "emit_forced")
    for key in ("definition_version", "definition_id", "phase_slug", "emitter", "tier", "provider"):
        assert key in forced_meta, f"emit_forced receipt missing §4 metadata key {key!r}"


# ── D-08 layer 4: the citation gate rejects an uncited map BEFORE render (state b) ─


async def test_citation_gate_rejects_before_render(_patch_executor):
    """An uncited/invented emission is rejected at the citation gate (state b
    citation_gate_rejected) BEFORE touching the render — emit_rejected receipt +
    honest fail; the render post_processor is NEVER reached."""
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.template_render_service import EmitFieldMap

    # A value present but with a source_chunk_id that was NOT retrieved => invented.
    uncited = EmitFieldMap.model_validate({
        "scalars": [{
            "key": "project_name", "value": "Meridian",
            "source_chunk_id": "not-retrieved", "source_doc": "x.docx", "source_page": 1,
        }],
        "rows": [],
    })
    _patch_executor["forced_result"] = _forced_ok(uncited)

    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)
    # No retrieved ids in accumulated outputs => the citation source_chunk_id is invented.
    out = await _exec_llm_emit(phase, {}, ctx)

    kinds = [k for k, _ in _patch_executor["audit"]]
    assert "emit_rejected" in kinds
    assert not _patch_executor["render_calls"], "render must NOT run on a rejected field-map (state b)"
    assert out.get("failure") == "citation_gate_rejected"


# ── D-08 layer 6: model_failed_to_emit is an honest failure (state a) ──────────


async def test_model_failed_to_emit_honest_fail(_patch_executor):
    """forced_emit returning failure=model_failed_to_emit (after Plan 02 recovery +
    truncation) => honest fail (state a): emit_failed receipt + a surfaced reason,
    never an empty 'done'."""
    from app.services.harness.phase_types import _exec_llm_emit

    _patch_executor["forced_result"] = _forced_fail()
    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)

    out = await _exec_llm_emit(phase, {}, ctx)
    kinds = [k for k, _ in _patch_executor["audit"]]
    assert "emit_failed" in kinds
    assert _patch_executor["surface_calls"], "an honest reason must be surfaced (RC-4)"
    assert out.get("failure") == "model_failed_to_emit"


# ── GAP-C / D-11: discrete phase_substep run-honesty sub-events on each transition ─


class _RecordingRedis:
    """A minimal redis stand-in that records every XADD payload so the GAP-C
    phase_substep sub-events can be asserted (no live Redis)."""

    def __init__(self):
        self.events: list[dict] = []

    async def xadd(self, stream, fields, **kwargs):
        import json as _json

        self.events.append(_json.loads(fields["data"]))


def _fake_ctx_with_redis(definition, *, audit_sink, redis, model="gpt-5.4"):
    """The harness ctx bag WITH a recording redis + the canonical _emit bound on it,
    so the executor's phase_substep emits are captured (GAP-C wire vocabulary)."""
    from app.services.harness_engine import _emit

    ctx = _fake_ctx(definition, audit_sink=audit_sink, model=model)
    ctx.redis = redis
    ctx.emit = _emit  # the canonical one-XADD the executor reuses (no new wire path)
    return ctx


def _substep_statuses(redis):
    return [e.get("status") for e in redis.events if e.get("type") == "phase_substep" and e.get("status")]


def _substep_failures(redis):
    return [e.get("failure") for e in redis.events if e.get("type") == "phase_substep" and e.get("failure")]


async def test_gapc_emit_substeps_happy_path(_patch_executor):
    """The happy path streams the discrete forcing → emitting → validating → rendering →
    validated sub-events on the EXISTING producer stream via the canonical _emit (GAP-C /
    D-11). Each rides the one-XADD path (type='phase_substep') — no new wire branch."""
    from app.services.harness.phase_types import _exec_llm_emit

    redis = _RecordingRedis()
    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx_with_redis(definition, audit_sink=_patch_executor, redis=redis)

    await _exec_llm_emit(phase, _retrieved_accumulated("chunk-1"), ctx)

    statuses = _substep_statuses(redis)
    # The live transitions fire in order (recovering only on a D-06 narration — absent here).
    assert statuses == ["forcing", "emitting", "validating", "rendering", "validated"]
    # Every sub-event carries the phase slug so the frontend maps it to the right rail row.
    substeps = [e for e in redis.events if e.get("type") == "phase_substep"]
    assert all(e.get("phase") == phase.slug for e in substeps)
    # No failure sub-event on the happy path (never a failed-as-failed on success).
    assert _substep_failures(redis) == []


async def test_gapc_recovering_substep_on_native_narration(_patch_executor):
    """When D-06 NATIVE narration recovery fires (recovered_from_narration=True), the
    degraded-but-honest 'recovering' sub-event is emitted between emitting and validating."""
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.template_render_service import EmitFieldMap

    recovered = dict(_forced_ok(EmitFieldMap.model_validate(_VALID_FM)))
    recovered["recovered_from_narration"] = True
    _patch_executor["forced_result"] = recovered

    redis = _RecordingRedis()
    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx_with_redis(definition, audit_sink=_patch_executor, redis=redis)

    await _exec_llm_emit(phase, _retrieved_accumulated("chunk-1"), ctx)
    statuses = _substep_statuses(redis)
    assert "recovering" in statuses
    # It sits between emitting and validating (amber-tint, degraded but honest).
    assert statuses.index("emitting") < statuses.index("recovering") < statuses.index("validating")


async def test_gapc_failure_substep_state_a_model_failed(_patch_executor):
    """State (a): a model-failed-to-emit terminal emits a phase_substep with
    failure=model_failed_to_emit (failed-as-failed — never a 'validated' done node, RC-4)."""
    from app.services.harness.phase_types import _exec_llm_emit

    _patch_executor["forced_result"] = _forced_fail()
    redis = _RecordingRedis()
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx_with_redis(definition, audit_sink=_patch_executor, redis=redis)

    await _exec_llm_emit(_fake_phase(), {}, ctx)
    assert "model_failed_to_emit" in _substep_failures(redis)
    assert "validated" not in _substep_statuses(redis)  # never a success node on failure


async def test_gapc_failure_substep_state_b_citation_rejected(_patch_executor):
    """State (b): an uncited/invented emission emits failure=citation_gate_rejected and
    never reaches the rendering sub-event (the gate rejects BEFORE render)."""
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.template_render_service import EmitFieldMap

    uncited = EmitFieldMap.model_validate({
        "scalars": [{"key": "project_name", "value": "Meridian",
                     "source_chunk_id": "not-retrieved", "source_doc": "x.docx", "source_page": 1}],
        "rows": [],
    })
    _patch_executor["forced_result"] = _forced_ok(uncited)
    redis = _RecordingRedis()
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx_with_redis(definition, audit_sink=_patch_executor, redis=redis)

    await _exec_llm_emit(_fake_phase(), {}, ctx)
    assert "citation_gate_rejected" in _substep_failures(redis)
    assert "rendering" not in _substep_statuses(redis)  # render never reached on a reject


async def test_gapc_failure_substep_state_e_no_template(_patch_executor):
    """State (e): no template bound emits failure=no_template_bound — and no forcing
    sub-event (the executor fails before the forced shot)."""
    from app.services.harness.phase_types import _exec_llm_emit

    _patch_executor["resolve_result"] = {
        "bytes": None, "filename": None, "provenance": "template_input",
        "mime": None, "error": "No template uploaded.",
    }
    redis = _RecordingRedis()
    definition = _fake_definition([])
    ctx = _fake_ctx_with_redis(definition, audit_sink=_patch_executor, redis=redis)

    await _exec_llm_emit(_fake_phase(), {}, ctx)
    assert "no_template_bound" in _substep_failures(redis)
    assert "forcing" not in _substep_statuses(redis)  # never started the forced shot


async def test_gapc_substep_emit_is_best_effort(_patch_executor):
    """A missing redis (a minimal ctx) must NEVER crash the emit — the GAP-C sub-events
    are best-effort run-honesty, not load-bearing for producing the deliverable."""
    from app.services.harness.phase_types import _exec_llm_emit

    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=_patch_executor)  # redis=None
    out = await _exec_llm_emit(_fake_phase(), _retrieved_accumulated("chunk-1"), ctx)
    # The deliverable still produced despite no redis (the emit short-circuited cleanly).
    assert out.get("path") or out.get("output_file")


# ── registration: llm_emit is the 6th phase type ──────────────────────────────


def test_llm_emit_registered_as_sixth_phase_type():
    """``llm_emit`` is the 6th PHASE_TYPE_REGISTRY entry (the engine dispatch seam)."""
    from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES

    assert "llm_emit" in PHASE_TYPE_REGISTRY_ENTRIES
    # register_all() propagates it to the engine registry.
    from app.services.harness_engine import PHASE_TYPE_REGISTRY

    assert "llm_emit" in PHASE_TYPE_REGISTRY


# ── Task 2: the render_template post_processor re-dispatches the hardened handler ─


async def test_render_post_reuses_handler(monkeypatch):
    """The render_template EMITTER_REGISTRY post_processor re-dispatches the EXISTING
    hardened ``_handle_render_template`` (one render code path) — it calls it exactly
    once with the validated field-map + the resolved template, and returns its verdict.
    It does NOT re-implement the render command / gates / sandbox plumbing."""
    from app.services.harness import emitters
    import app.services.tool_dispatcher as td

    entry = emitters.EMITTER_REGISTRY["render_template"]
    assert entry.post_processor is not None, "render_template post_processor must be wired"

    calls: list = []

    class _FakeResult:
        def __init__(self, payload):
            self.result = json.dumps(payload)

    async def _recorder(args, ctx):
        calls.append((args, ctx))
        return _FakeResult({"status": "ok", "path": "/register.docx",
                            "size_bytes": 1234, "engine": "docxtpl"})

    monkeypatch.setattr(td, "_handle_render_template", _recorder)

    validated_map = {"scalars": {"project_name": {"value": "Meridian",
                     "source_chunk_id": "chunk-1", "source_doc": "b.docx", "source_page": 1}},
                     "collections": {}}
    resolved_template = {
        "bytes": b"PK\x03\x04", "filename": "register.docx", "provenance": "library",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "error": None, "asset_ref": _fake_asset_ref(), "retrieved_ids": ["chunk-1"],
    }
    fake_ctx = SimpleNamespace(pool=object(), supabase=object(),
                              thread_id="t", current_user={"id": "u"}, run_id="r",
                              emit=None, redis=None)

    out = await entry.post_processor(validated_map, resolved_template, fake_ctx)
    assert len(calls) == 1, "the hardened handler must be re-dispatched exactly once"
    args, _ = calls[0]
    # The validated field-map is passed as the handler's field_map arg.
    assert args["field_map"] == validated_map
    # The retrieved ids thread through so the handler's citation gate re-passes.
    assert "chunk-1" in args.get("retrieved_ids", [])
    # The post_processor returns the handler's parsed verdict (status ok).
    assert out["status"] == "ok"
    assert out["path"] == "/register.docx"


def test_emitter_post_no_top_level_docxtpl():
    """Pitfall 4 — no ``import docxtpl`` at the emitters.py module top (render is
    sandbox-only; the heavy lib never enters backend/app/**)."""
    import pathlib

    src = pathlib.Path(
        __file__
    ).resolve().parents[2].joinpath("app", "services", "harness", "emitters.py").read_text(encoding="utf-8")
    for line in src.splitlines():
        stripped = line.strip()
        assert not stripped.startswith("import docxtpl"), "no module-top docxtpl (Pitfall 4)"
        assert not stripped.startswith("from docxtpl"), "no module-top docxtpl (Pitfall 4)"
    # And no second render path (no SandboxedEnvironment / DocxTemplate.render here).
    assert "SandboxedEnvironment" not in src
    assert "DocxTemplate" not in src


# ── 101.1-06 regression — the live citation-id namespace (UAT run a12ee906) ─────
#
# The live gate over-rejected 100% of emissions (cited=0/uncited=0/invented=24):
# (1) the emit user turn was prior-phase PROSE — no <doc id=…> spotlight, so the model
#     had no real id to cite; (2) _retrieved_ids only recognized chunk_id-shaped keys
#     while live enriched refs carry document_id + chunk_index → valid set always empty.
# These tests pin the LIVE ref shape (the offline fakes had drifted to chunk_id).

_LIVE_DOC_ID = "8b95ddd2-b834-4b25-83df-85f8614c0aed"
_LIVE_COMPOSITE = f"{_LIVE_DOC_ID}#2"


def _live_shape_accumulated():
    """EXACTLY the live enriched-retrieval ref shape (document_id + chunk_index +
    passage + filename — NO chunk_id key), as read back from messages.source_refs."""
    return {"gather": {"text": "Project Meridian risk evidence summary.", "source_refs": [
        {
            "passage": "Strategic risk SR-03 (Legacy decommission dependency). "
                       "Likelihood Medium, impact High. Owner: Priya Nair (Data Lead).",
            "filename": "Project-Meridian-Charter-Excerpt.docx",
            "similarity": 0.520934502608147,
            "chunk_index": 2,
            "document_id": _LIVE_DOC_ID,
            "is_full_doc": False,
            "version_number": 1,
        },
    ]}}


def _fm_citing(cid):
    from app.services.template_render_service import EmitFieldMap

    return EmitFieldMap.model_validate({
        "scalars": [{
            "key": "project_name", "value": "Meridian",
            "source_chunk_id": cid, "source_doc": "charter.docx", "source_page": 1,
        }],
        "rows": [],
    })


def test_ref_spotlight_id_one_namespace():
    """Explicit chunk ids win; live document_id+chunk_index falls back to the composite;
    a bare document_id stands alone; an id-less ref yields None."""
    from app.services.harness.phase_types import _ref_spotlight_id

    assert _ref_spotlight_id({"chunk_id": "chunk-7", "document_id": "D"}) == "chunk-7"
    assert _ref_spotlight_id({"document_id": _LIVE_DOC_ID, "chunk_index": 2}) == _LIVE_COMPOSITE
    assert _ref_spotlight_id({"document_id": _LIVE_DOC_ID}) == _LIVE_DOC_ID
    assert _ref_spotlight_id({"passage": "no ids here"}) is None


def test_emit_evidence_live_shape_spotlight_and_ids():
    """ONE walk yields both sides: the <doc id=…> spotlight (with passage + filename)
    AND a NON-EMPTY valid-id set from the SAME assignment — the live shape that used to
    produce an always-empty set."""
    from app.services.harness.phase_types import _emit_evidence

    spotlight, ids = _emit_evidence(_live_shape_accumulated())
    assert ids == {_LIVE_COMPOSITE}
    assert f'<doc id="{_LIVE_COMPOSITE}" file="Project-Meridian-Charter-Excerpt.docx">' in spotlight
    assert "Strategic risk SR-03" in spotlight
    # No retrieval => no spotlight, empty set (the honest-reject default is unchanged).
    assert _emit_evidence({}) == ("", set())


@pytest.mark.asyncio
async def test_live_shape_citation_passes_gate(_patch_executor):
    """THE regression: live-shaped refs + an emission citing the composite id =>
    the gate PASSES (emit_validated, render reached) and the forced call's user turn
    carries the spotlight the model cited from."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor
    bag["forced_result"] = _forced_ok(_fm_citing(_LIVE_COMPOSITE))
    audit_sink = bag["audit"]
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=audit_sink)

    out = await _exec_llm_emit(_fake_phase(), _live_shape_accumulated(), ctx)

    events = [ev for ev, _ in bag["audit"]]
    assert "emit_validated" in events, f"gate must pass for a spotlighted citation: {events}"
    assert "emit_rejected" not in events
    assert len(bag["render_calls"]) == 1, "render must be reached"
    assert out.get("failure") is None
    user_turn = bag["forced_calls"][0]["messages"][0]["content"]
    assert f'<doc id="{_LIVE_COMPOSITE}"' in user_turn, "the model must SEE the id it cites"


@pytest.mark.asyncio
async def test_fabricated_citation_still_rejected_with_live_refs(_patch_executor):
    """The no-hallucination guarantee is UNCHANGED: real retrieval present, but the
    emission cites an id never shown => state (b) reject, render never reached."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor
    bag["forced_result"] = _forced_ok(_fm_citing("fabricated-id-999"))
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])

    out = await _exec_llm_emit(_fake_phase(), _live_shape_accumulated(), ctx)

    events = [ev for ev, _ in bag["audit"]]
    assert "emit_rejected" in events
    assert "emit_validated" not in events
    assert bag["render_calls"] == []
    assert out.get("failure") == "citation_gate_rejected"


# ── 101.1-06 layer-5 bounded retry — citation reject feeds back, then honest fail ─


@pytest.mark.asyncio
async def test_citation_reject_retries_with_named_feedback(_patch_executor):
    """With real retrieval evidence, a citation reject triggers a bounded retry whose
    system prompt NAMES the offending leaves; a compliant second attempt passes the
    gate and renders. Receipts carry the attempt trail (2x emit_forced, 1x rejected)."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor
    bag["forced_queue"] = [
        _forced_ok(_fm_citing(None)),             # attempt 1: filled but UNCITED -> reject
        _forced_ok(_fm_citing(_LIVE_COMPOSITE)),  # attempt 2: cited from the spotlight -> pass
    ]
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])

    out = await _exec_llm_emit(_fake_phase(), _live_shape_accumulated(), ctx)

    events = [ev for ev, _ in bag["audit"]]
    assert events.count("emit_forced") == 2, f"one retry expected: {events}"
    assert events.count("emit_rejected") == 1
    assert "emit_validated" in events and "emit_rendered" in events
    assert len(bag["render_calls"]) == 1
    assert out.get("failure") is None
    # The retry's system prompt names the offending leaf (cite-or-null feedback).
    retry_prompt = bag["forced_calls"][1]["system_prompt"]
    assert "REJECTED by the citation gate" in retry_prompt
    assert "scalar.project_name" in retry_prompt
    # The first attempt got NO feedback (clean prompt).
    assert "REJECTED" not in bag["forced_calls"][0]["system_prompt"]
    # Per-attempt receipts carry the attempt number.
    forced_metas = [m for k, m in bag["audit"] if k == "emit_forced"]
    assert [m.get("attempt") for m in forced_metas] == [1, 2]


@pytest.mark.asyncio
async def test_citation_reject_exhausts_attempts_then_honest_fail(_patch_executor):
    """A model that never cites exhausts the 3 bounded attempts and lands the honest
    state-(b) fail — render never reached, the last field-map preserved."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor
    bag["forced_result"] = _forced_ok(_fm_citing(None))  # always uncited
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])

    out = await _exec_llm_emit(_fake_phase(), _live_shape_accumulated(), ctx)

    events = [ev for ev, _ in bag["audit"]]
    assert events.count("emit_forced") == 3, "bounded at 3 total attempts"
    assert events.count("emit_rejected") == 3
    assert "emit_validated" not in events
    assert bag["render_calls"] == []
    assert out.get("failure") == "citation_gate_rejected"


@pytest.mark.asyncio
async def test_citation_reject_no_evidence_fails_fast(_patch_executor):
    """With NO retrieval evidence the model can never cite validly — the first reject
    is final (no wasted retries; the pre-101.1-06 single-shot behavior preserved)."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor
    bag["forced_result"] = _forced_ok(_fm_citing("fabricated"))
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])

    out = await _exec_llm_emit(_fake_phase(), {}, ctx)

    events = [ev for ev, _ in bag["audit"]]
    assert events.count("emit_forced") == 1, "no retry without evidence"
    assert out.get("failure") == "citation_gate_rejected"


# ── 101.1-06 template-placeholder oracle (the 097 "parse template first" step) ──


def _real_template_bytes():
    import pathlib

    return pathlib.Path(__file__).resolve().parents[1].joinpath(
        "fixtures", "templates", "risk-register.docx"
    ).read_bytes()


def test_parse_docx_template_variables_real_fixture():
    """The stdlib parser (no docxtpl — Pitfall 4) extracts the REAL trusted fixture's
    oracle: dotted Cited derefs root to scalars, loop vars excluded, loop target is the
    collection. Matches the 097 get_undeclared_template_variables ground truth."""
    from app.services.template_render_service import parse_docx_template_variables

    oracle = parse_docx_template_variables(_real_template_bytes())
    assert oracle == {
        "scalars": ["project_name", "report_date"],
        "collections": ["rows"],
        # The Cited cells the MODEL must emit; `score` (bare {{ r.score }}, no .value)
        # is driver-computed (D-11) and correctly excluded.
        "columns": {"rows": ["cause", "effect", "event", "impact", "owner",
                             "probability", "response_strategy", "risk_id", "status"]},
    }
    # Not-a-docx => None (no oracle, never a crash).
    assert parse_docx_template_variables(b"PK..garbage") is None


@pytest.mark.asyncio
async def test_oracle_keys_reach_model_and_gate_coverage(_patch_executor):
    """With a REAL docx template resolved, the forced shot's user turn names EXACTLY
    the template's keys, and an emission that misses them is rejected with the missing
    keys named in the retry feedback; a compliant retry passes and renders.
    (Live regression: run 7fa36d2a passed citations 24/24 but died in the render with
    UndefinedError 'project_name' is undefined — the model invented its own keys.)"""
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.template_render_service import EmitFieldMap

    bag = _patch_executor
    bag["resolve_result"] = dict(bag["resolve_result"], bytes=_real_template_bytes())

    wrong_keys = EmitFieldMap.model_validate({
        "scalars": [],
        "rows": [{
            "collection": "risks",  # the template wants "rows"
            "cells": [{"key": "cause", "value": "Legacy CRM",
                       "source_chunk_id": _LIVE_COMPOSITE, "source_doc": "c.docx", "source_page": 1}],
        }],
    })
    # All 9 template columns (the oracle's column set — score is driver-computed,
    # excluded). A row missing any of these would die in the render as UndefinedError
    # (live run 454e30c9: "'dict object' has no attribute 'risk_id'").
    _COLS = ["cause", "effect", "event", "impact", "owner", "probability",
             "response_strategy", "risk_id", "status"]
    right_keys = EmitFieldMap.model_validate({
        "scalars": [
            {"key": "project_name", "value": "Meridian",
             "source_chunk_id": _LIVE_COMPOSITE, "source_doc": "c.docx", "source_page": 1},
            {"key": "report_date", "value": None,
             "source_chunk_id": None, "source_doc": None, "source_page": None},
        ],
        "rows": [{
            "collection": "rows",
            "cells": [{"key": c, "value": "x",
                       "source_chunk_id": _LIVE_COMPOSITE, "source_doc": "c.docx", "source_page": 1}
                      for c in _COLS],
        }],
    })
    bag["forced_queue"] = [_forced_ok(wrong_keys), _forced_ok(right_keys)]

    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])
    out = await _exec_llm_emit(_fake_phase(), _live_shape_accumulated(), ctx)

    # The oracle reached the model verbatim — keys AND row-cell columns.
    user_turn = bag["forced_calls"][0]["messages"][0]["content"]
    assert "TEMPLATE PLACEHOLDERS" in user_turn
    assert "project_name" in user_turn and "report_date" in user_turn and "rows" in user_turn
    assert "risk_id" in user_turn and "response_strategy" in user_turn
    # Attempt 1 (wrong keys) rejected with the missing keys named; attempt 2 passed.
    events = [ev for ev, _ in bag["audit"]]
    assert events.count("emit_rejected") == 1
    assert "emit_validated" in events and "emit_rendered" in events
    retry_prompt = bag["forced_calls"][1]["system_prompt"]
    assert "project_name" in retry_prompt and "rows" in retry_prompt
    assert out.get("failure") is None
    # A null-valued scalar (report_date unsupported by sources) is acceptable coverage.
    assert len(bag["render_calls"]) == 1


@pytest.mark.asyncio
async def test_no_oracle_for_unparseable_template_keeps_old_behavior(_patch_executor):
    """Unparseable template bytes (the fixture default) => no oracle => the gate keys
    off the emitted map exactly as before (no coverage rejection, no crash)."""
    from app.services.harness.phase_types import _exec_llm_emit

    bag = _patch_executor  # resolve_result bytes are b"PK\x03\x04docx" — not a real zip
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=bag["audit"])
    out = await _exec_llm_emit(_fake_phase(), _retrieved_accumulated("chunk-1"), ctx)

    assert "TEMPLATE PLACEHOLDERS" not in bag["forced_calls"][0]["messages"][0]["content"]
    assert out.get("failure") is None  # the chunk-1-cited _VALID_FM still passes


# ── Phase 101.1-07 (gap 1b executor half) — the layer-6 catch-all backstop ─────
# ANY raise inside the emit ladder (render dispatch raising, an unexpected error)
# is caught → emit_failed receipt + a phase_substep failure + one surfaced message
# + an honest flagged output. No exception escapes to the engine's generic run-
# failed catch (which would leave the phase stuck 'active' forever).


@pytest.mark.asyncio
async def test_render_dispatch_raise_caught_as_honest_failure(_patch_executor):
    """When the render post_processor RAISES, _exec_llm_emit does NOT propagate — it
    writes an emit_failed receipt, surfaces one honest message, and returns a flagged
    failure output (text non-empty, failure set). No exception escapes."""
    from app.services.harness import emitters, phase_types
    from app.services.harness.phase_types import _exec_llm_emit

    async def _boom_render(validated_map, resolved_template, ctx):
        raise RuntimeError("docxtpl crashed mid-render")

    entry = emitters.EMITTER_REGISTRY["render_template"]
    monkeypatch_entry = emitters.EmitterEntry(
        schema_builder=entry.schema_builder, post_processor=_boom_render
    )
    emitters.EMITTER_REGISTRY["render_template"] = monkeypatch_entry
    try:
        definition = _fake_definition([_fake_asset_ref()])
        ctx = _fake_ctx(definition, audit_sink=_patch_executor["audit"])
        # No exception escapes.
        out = await _exec_llm_emit(_fake_phase(), _retrieved_accumulated("chunk-1"), ctx)
    finally:
        emitters.EMITTER_REGISTRY["render_template"] = entry

    kinds = [k for k, _ in _patch_executor["audit"]]
    assert "emit_failed" in kinds
    assert _patch_executor["surface_calls"], "an honest reason must be surfaced once"
    assert out.get("failure") is not None
    assert out.get("text"), "the honest output carries a non-empty reason (RC-4)"


@pytest.mark.asyncio
async def test_provider_error_is_honest_state_a(_patch_executor):
    """A forced_emit result carrying failure='provider_error' (Task 2's backstop) is
    treated as an honest model/provider failure (state a family) — emit_failed receipt,
    a surfaced reason, an honest flagged output (not a crash, not a silent success)."""
    from app.services.harness.phase_types import _exec_llm_emit

    _patch_executor["forced_result"] = {
        "emitted": None, "tier": "TIER-FORCE", "provider": "deepseek",
        "forced": True, "recovered_from_narration": False, "truncated": False,
        "failure": "provider_error",
    }
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=_patch_executor["audit"])
    out = await _exec_llm_emit(_fake_phase(), {}, ctx)

    kinds = [k for k, _ in _patch_executor["audit"]]
    assert "emit_failed" in kinds
    assert _patch_executor["surface_calls"], "a provider error must surface honestly (RC-4)"
    assert out.get("failure") is not None
    assert out.get("text")


@pytest.mark.asyncio
async def test_failure_output_is_surfaced_flagged(_patch_executor):
    """gap 2 — single-owner persist: a failure output returned by _exec_llm_emit carries
    a _surfaced flag (the executor already wrote the message via _surface_failure_message),
    so the engine knows not to persist it a second time."""
    from app.services.harness.phase_types import _exec_llm_emit, _emit_failure_output

    # _emit_failure_output flags its output.
    out = _emit_failure_output("model_failed_to_emit", "honest reason")
    assert out.get("_surfaced") is True

    # And the executor's honest-fail return carries the flag end-to-end.
    _patch_executor["forced_result"] = _forced_fail()
    definition = _fake_definition([_fake_asset_ref()])
    ctx = _fake_ctx(definition, audit_sink=_patch_executor["audit"])
    failed = await _exec_llm_emit(_fake_phase(), {}, ctx)
    assert failed.get("_surfaced") is True
    assert failed.get("failure") == "model_failed_to_emit"


# ── 104-03 (live-UAT root cause, runs 27571799 / f18fb994): the emit SUCCESS output must
#    carry retrieved_ids + placeholder_keys so a POST-PHASE citations_required validator
#    (the 102 validation-gate library, first attached to an llm_emit phase by the Phase-104
#    PM defs) re-validates against the REAL valid-id set, not an empty one. Without them the
#    validator's check_coverage saw retrieved_ids=∅ → every cited value read "invented"
#    (uncited=0 invented=N) and the run FAILED *after* emit_validated + emit_rendered (a
#    correct, cited, integrity-checked .docx had already been produced). ──────────────────


async def test_emit_success_output_carries_retrieved_ids_for_post_phase_validator(_patch_executor):
    """The emit success output exposes the SAME valid-id set + oracle keys the internal
    citation gate passed on, so a post-phase ``citations_required`` validator re-validates
    against the real set (regression: these keys were absent → the validator over-rejected
    every cited value as invented after the .docx had already rendered)."""
    from app.services.harness.phase_types import _exec_llm_emit
    from app.services.harness.validator_kinds import (
        _validate_citations_required,
        _validate_output_file_valid,
    )

    definition = _fake_definition([_fake_asset_ref()])
    phase = _fake_phase()
    ctx = _fake_ctx(definition, audit_sink=_patch_executor["audit"])

    # The emission cites chunk-1; the retrieval evidence exposes chunk-1 — the internal
    # gate passes and the .docx renders (render_result status "ok").
    out = await _exec_llm_emit(phase, _retrieved_accumulated("chunk-1"), ctx)

    # The fix: the success output exposes retrieved_ids + placeholder_keys.
    assert "retrieved_ids" in out, (
        "emit success output must expose retrieved_ids for a post-phase citations_required validator"
    )
    assert "chunk-1" in out["retrieved_ids"]
    assert "placeholder_keys" in out

    # The post-phase citations_required validator (102 library) now PASSES over the emit
    # output — before the fix it saw retrieved_ids=∅ and rejected every cited value as
    # invented (uncited=0 invented=N), failing the run after emit_validated + emit_rendered.
    gate = await _validate_citations_required(out, {"mode": "deterministic"}, ctx)
    assert gate.passed, (
        f"post-phase citations_required must pass when the internal gate passed; got: {gate.error_message}"
    )

    # And the SECOND post-phase validator (output_file_valid): the emit output_file carries
    # the engine's integrity verdict (opened=True), so the validator honors it instead of
    # re-opening the workspace-INLINE virtual path (which would fail "integrity re-open").
    assert out["output_file"].get("opened") is True, (
        "emit success output_file must carry the engine's pre-computed integrity verdict"
    )
    ofv = await _validate_output_file_valid(out, {}, ctx)
    assert ofv.passed, (
        f"post-phase output_file_valid must honor the engine's opened=True verdict for a "
        f"workspace-inline file; got: {ofv.error_message}"
    )
