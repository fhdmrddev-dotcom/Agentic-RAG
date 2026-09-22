"""Phase 256 (METER-06 / D-256-11 / D-256-12) — the emit leg reaches the RUN-level box.

Plan 256-04 Task 1 makes ``forced_emit`` MEASURE its ladder. This file pins the other
half: that the measurement actually ARRIVES somewhere a human can read. A number that is
computed and then dropped one frame up is indistinguishable from never counting at all —
and that is precisely the state ``llm_emit`` was in before this phase.

⚠ **THE RECORDING FIRES ON THE FAILURE PATH TOO (D-256-12).** ``_exec_llm_emit``'s state-(a)
arm is an early ``return _emit_failure_output(...)``, and an emit that failed is the
outcome that cost the MOST — the full recovery ladder ran, every rung was served and
billed, and nothing was delivered. A recording placed below that return would count the
cheap runs and skip the expensive ones, which is worse than counting nothing: the totals
would look plausible and be systematically biased downward.

⚠ **THE ABSENT BOX IS THE COMMON CASE, NOT AN ERROR.** ``_run_usage_box`` reads the ctx
bag with ``getattr(ctx, "run_usage_box", None)``; a Deep run, a unit stub and a publish
golden run all reach this executor with no box at all. They must be byte-identical to what
shipped — no raise, no attribute creation.

CONVENTION (this repo's): ``from app.services... import ...`` INSIDE each test body.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


# ── the harness ctx / phase / definition fakes (shape copied from the shipped
#    tests/unit/test_llm_emit_executor.py precedent) ────────────────────────────


def _fake_asset_ref(kind: str = "template", filename: str = "register.docx"):
    from app.models.harness import AssetRef

    return AssetRef(
        asset_id=f"{kind}-asset-id",
        filename=filename,
        kind=kind,  # type: ignore[arg-type]
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


def _fake_definition():
    return SimpleNamespace(
        slug="risk-register",
        version=3,
        definition_id="00000000-0000-0000-0000-0000000101a0",
        assets=[_fake_asset_ref()],
    )


def _fake_phase(slug="fill", emitter="render_template"):
    cfg = SimpleNamespace(
        phase_type="llm_emit",
        prompt="Fill the register.",
        emitter=emitter,
        model=None,
        folder_scope=None,
        skill_ref=None,
        skill_snapshot=None,
        available_tools=["render_template"],
    )
    return SimpleNamespace(slug=slug, phase_index=1, config=cfg)


def _fake_ctx(*, run_usage_box=None, model="gpt-5.4"):
    """The harness ctx bag. ``run_usage_box=None`` means the attribute is ABSENT —
    the Deep-run / unit-stub / publish-golden-run case, which is the common one."""
    ctx = SimpleNamespace(
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
        definition=_fake_definition(),
        folder_subtree_ids=None,
    )
    if run_usage_box is not None:
        ctx.run_usage_box = run_usage_box
    return ctx


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


def _retrieved():
    return {"retrieval": {"text": "retrieved", "source_refs": [{"chunk_id": "chunk-1"}]}}


def _forced_ok(*, input_tokens, output_tokens):
    from app.services.template_render_service import EmitFieldMap

    return {
        "emitted": EmitFieldMap.model_validate(_VALID_FM),
        "tier": "force_strict",
        "provider": "openai",
        "forced": True,
        "recovered_from_narration": False,
        "truncated": False,
        "failure": None,
        "emit_rung": "strict_force",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


def _forced_fail(*, input_tokens, output_tokens):
    """The exhausted-ladder floor — every rung served, nothing delivered."""
    return {
        "emitted": None,
        "tier": "force_strict",
        "provider": "openai",
        "forced": False,
        "recovered_from_narration": False,
        "truncated": False,
        "failure": "model_failed_to_emit",
        "emit_rung": None,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


@pytest.fixture()
def _patch_executor(monkeypatch):
    """Patch the executor's substrate seams so the ladder runs deterministically
    offline. Mirrors the shipped ``test_llm_emit_executor._patch_executor``."""
    from app.services.harness import emitters, phase_types

    bag: dict = {
        "forced_queue": [],
        "forced_calls": [],
        "audit": [],
        "surface_calls": [],
        "resolve_result": {
            "bytes": b"PK\x03\x04docx",
            "filename": "register.docx",
            "provenance": "library",
            "mime": (
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            "error": None,
        },
        "render_result": {
            "status": "ok",
            "path": "/register.docx",
            "output_file": {"path": "/register.docx", "sha256": "abc", "bytes": 1234},
        },
    }

    async def _fake_forced_emit(**kwargs):
        bag["forced_calls"].append(kwargs)
        return bag["forced_queue"].pop(0)

    async def _fake_resolve(**kwargs):
        return bag["resolve_result"]

    async def _fake_write_audit(pool, run_id, *, user_id, event_type, metadata):
        bag["audit"].append((event_type, metadata))

    async def _fake_render_post(validated_map, resolved_template, ctx):
        return bag["render_result"]

    async def _fake_surface(ctx, run_id, reason, pool):
        bag["surface_calls"].append(reason)
        return "msg-id"

    monkeypatch.setattr(phase_types, "forced_emit", _fake_forced_emit)
    monkeypatch.setattr(phase_types, "resolve_template_source", _fake_resolve)
    monkeypatch.setattr(phase_types, "write_audit", _fake_write_audit)
    monkeypatch.setattr(phase_types, "_surface_failure_message", _fake_surface)
    entry = emitters.EMITTER_REGISTRY["render_template"]
    monkeypatch.setitem(
        emitters.EMITTER_REGISTRY,
        "render_template",
        emitters.EmitterEntry(
            schema_builder=entry.schema_builder, post_processor=_fake_render_post
        ),
    )
    return bag


# ══════════════════════════════════════════════════════════════════════════════


async def test_the_success_path_folds_the_emit_spend_into_the_run_box(_patch_executor):
    """A delivered emit adds EXACTLY the ladder's totals to the run-level box."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=900, output_tokens=120)]
    box: dict = {}
    ctx = _fake_ctx(run_usage_box=box)

    out = await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)

    assert isinstance(out, dict)
    assert box == {"input_tokens": 900, "output_tokens": 120}


async def test_the_failure_path_records_the_spend_too(_patch_executor):
    """⭐ D-256-12 — the state-(a) early ``return _emit_failure_output(...)``.

    ⛔ This is the outcome that cost the MOST: the whole recovery ladder ran, every rung
    was served and billed, and nothing was delivered. A recording placed BELOW that
    return would count only the cheap runs — plausible totals, systematically biased
    downward, and nothing in the product could ever say so."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_fail(input_tokens=600, output_tokens=60)]
    box: dict = {}
    ctx = _fake_ctx(run_usage_box=box)

    out = await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)

    # The honest failure still happened — the recording did not change the outcome.
    assert _patch_executor["surface_calls"], "the honest-fail surface must still fire"
    assert out.get("failure") == "model_failed_to_emit" or "failure" in str(out)
    # …and the spend is on the books.
    assert box == {"input_tokens": 600, "output_tokens": 60}


async def test_an_absent_run_box_records_nothing_and_raises_nothing(_patch_executor):
    """The Deep-run / unit-stub / publish-golden-run case — the COMMON one. The ctx has
    no ``run_usage_box`` attribute at all; the executor must be byte-identical to what
    shipped: no raise, and no attribute conjured onto the bag."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=900, output_tokens=120)]
    ctx = _fake_ctx(run_usage_box=None)  # attribute genuinely absent

    out = await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)

    assert isinstance(out, dict)
    assert not hasattr(ctx, "run_usage_box"), (
        "the disarmed case must not gain a box — absence is the signal, not a bug"
    )


async def test_none_token_values_leave_the_box_untouched(_patch_executor):
    """A provider that emitted no usage yields ``None``, and ``None`` ADDS NOTHING.

    ⛔ It must NOT become a ``0`` key in the box: an absent measurement and a measured
    zero are different facts, and only one of them belongs in a total."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=None, output_tokens=None)]
    box: dict = {}
    ctx = _fake_ctx(run_usage_box=box)

    await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)

    assert box == {}, "None must add nothing — not a zero-valued key"


async def test_two_emit_phases_accumulate_into_the_one_run_box(_patch_executor):
    """The METER-04 rollup path this phase does NOT rebuild, exercised through the new
    leg: a run with two ``llm_emit`` phases sums both into the single run-level box."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [
        _forced_ok(input_tokens=900, output_tokens=120),
        _forced_fail(input_tokens=100, output_tokens=10),
    ]
    box: dict = {}
    ctx = _fake_ctx(run_usage_box=box)

    await phase_types._exec_llm_emit(_fake_phase(slug="fill_one"), _retrieved(), ctx)
    await phase_types._exec_llm_emit(_fake_phase(slug="fill_two"), _retrieved(), ctx)

    assert box == {"input_tokens": 1000, "output_tokens": 130}


async def test_a_measured_zero_does_not_create_a_phantom_key(_patch_executor):
    """``_record_run_usage``'s shipped guards are ``if input_tokens:`` — so a genuine
    ``0`` also adds nothing, and that is CORRECT at this layer: adding zero to a total
    changes no total. The distinction that matters lives one layer down, in
    ``forced_emit._drain``, and this case pins that the summer was NOT modified to
    chase it."""
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=0, output_tokens=0)]
    box: dict = {}
    ctx = _fake_ctx(run_usage_box=box)

    await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)

    assert box == {}


def test_the_summer_itself_is_reused_not_reimplemented():
    """⛔ ``_record_run_usage`` is the METER-04 rollup and must be REUSED. This pins that
    the emit leg did not grow its own private adder — one home for the addition, so a
    future change to the summing rule cannot apply to three legs and miss the fourth."""
    import inspect

    from app.services.harness import phase_types

    src = inspect.getsource(phase_types._exec_llm_emit)
    assert "_record_run_usage(" in src, (
        "_exec_llm_emit must fold its spend through the shared summer"
    )
    # No private accumulation arithmetic in this executor.
    for forbidden in ('box["input_tokens"]', 'box.get("input_tokens")',
                      "run_usage_box["):
        assert forbidden not in src, (
            f"{forbidden!r} in _exec_llm_emit is a second home for the addition"
        )


def test_the_extension_contract_is_untouched_by_this_leg():
    """⛔ Phase 255: ``phase_types.py`` is one of the six Extension Contract trigger
    files. The recording is ONE call to an existing module-level function — it resolves
    no callable from data, config, a database row or a user-supplied name."""
    import inspect

    from app.services.harness import phase_types

    src = inspect.getsource(phase_types._exec_llm_emit)
    for forbidden in ("importlib", "__import__", "eval(", "exec(", "getattr(globals()"):
        assert forbidden not in src, (
            f"{forbidden!r} would make a counter resolvable from data (T-256-22)"
        )
