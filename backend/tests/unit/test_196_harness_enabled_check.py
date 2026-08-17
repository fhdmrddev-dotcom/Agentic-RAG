"""Phase 196 Plan 03 (D-10 / AUTH-04) — the harness disabled-model check.

WHY THIS FILE EXISTS.

``_resolve_enabled_model`` (``app/services/run_model_resolution.py:35``, shipped in Phase 149
as D-149-10) has only ever guarded the CHAT ``send_message`` path. The harness's
``_effective_model`` (``harness/phase_types.py:393``) hands a per-phase model string
STRAIGHT to the provider with no check at all — so a workflow authored before this phase can
still burn a run on a model an operator disabled, in complete silence. A picker that is honest
at authoring time cannot fix that: the author's browser is long gone by the time the run
executes. This file is the runtime half.

THE CASES, in the order they are driven:

  A1  (RESEARCH assumption, driven FIRST and physically first in this file)
      A fresh interpreter imports ``app.services.harness.phase_types`` AND awaits the new
      ``_effective_model_checked``. ``_resolve_enabled_model`` resolves
      ``load_all_model_overrides`` LATE off ``app.api.threads``, so the call drags a REAL
      ``app.api.threads`` import into the harness AT CALL TIME. If that were a cycle the
      backend would not start. The mitigation is a REAL import in a test, not a reading of
      the source. ⚠ It runs in a SUBPROCESS — see that case's own docstring for the measured
      reason (the ``sys.modules``-eviction form broke 23 tests in two other files).

  D-10 behaviour
      · a DISABLED per-phase model falls back to the run's model AND produces a notice;
      · an ENABLED per-phase model is a STRICT no-op — same value, no sub-step, no receipt
        (the ``test_149_default_guard.py:86`` ``assert not pool.calls`` shape, transposed onto
        the two carriers);
      · a BLANK per-phase model still inherits ``ctx.model`` exactly as ``_effective_model``
        does today;
      · the DEAD-DEFAULT case resolves without an infinite substitution — the shipped
        resolver already handles it, and it is asserted HERE so a future re-implementation
        cannot lose it;
      · a registry-read failure FAILS OPEN — the per-phase model is returned unchanged and no
        notice fires. That is the shipped chat posture, inherited deliberately;
      · ``_effective_model`` is still importable, still SYNC, and still returns the same value
        for the same inputs.

ZERO DATABASE MUTATION, and it is a CONTRACT rather than an accident (RESEARCH §K.30 flags
this plan as one of two that could accidentally become DB-mutating, and a ``files_modified``
check cannot see a database write). Every case here stubs the harness ctx, patches the
override source in memory, and records the two carriers instead of firing them. No run row is
written, no live stream is opened, no cache is left dirty across cases.

⚠ THE MODEL IDS ARE THE INTERESTING ONES. ``gpt-5.2`` is the measured DISABLED row; ``gpt-5.4``
passes every check this plan adds and would prove nothing on its own — so it appears only as
the ENABLED fallback target and as the no-op control.
"""
from __future__ import annotations

import inspect
import pathlib
import subprocess
import sys

import pytest


# The measured registry rows this file drives. Named once so a case cannot silently
# swap the disabled id for one that passes every check.
DISABLED_MODEL = "gpt-5.2"   # the measured disabled row
ENABLED_MODEL = "gpt-5.4"    # enabled — the run's model / the fallback target


# ── A1: the import-cycle guard, driven FIRST ──────────────────────────────────


_A1_SUBPROCESS = """
import asyncio, importlib, inspect, types

# 1. The harness module imports CLEAN in an interpreter where nothing is preloaded.
m = importlib.import_module("app.services.harness.phase_types")
assert inspect.iscoroutinefunction(m._effective_model_checked), "checked helper must be async"

# 2. And it RUNS — which is the half that actually tests A1. The resolver reaches
#    `load_all_model_overrides` LATE off `app.api.threads`, so awaiting the helper performs a
#    REAL `app.api.threads` import from inside the harness. A cycle raises right here.
phase = types.SimpleNamespace(config=types.SimpleNamespace(model="gpt-5.4"), slug="s", phase_index=0)
ctx = types.SimpleNamespace(
    model="gpt-5.4", user_settings=types.SimpleNamespace(llm_model="gpt-5.4"),
    redis=None, pool=None, run_id=None, producer_run_id=None, current_user={}, emit=None,
)
assert asyncio.run(m._effective_model_checked(phase, ctx)) == "gpt-5.4"
print("A1-OK")
"""


def test_a1_harness_import_cycle_guard_fresh_interpreter():
    """A1: the harness imports AND RUNS the checked helper in a genuinely fresh interpreter.

    ``_resolve_enabled_model`` resolves ``load_all_model_overrides`` LATE off
    ``app.api.threads`` (``run_model_resolution.py:53``), so awaiting the new helper performs a
    REAL ``app.api.threads`` import from inside the harness AT CALL TIME. If that were a cycle
    the backend would not start — which is why the mitigation is a real import rather than a
    reading of the source.

    ⚠ DRIVEN IN A SUBPROCESS, AND THE REASON IS MEASURED RATHER THAN STYLISTIC. The first
    version of this case did what the plan literally asked: evict the three modules from
    ``sys.modules``, re-import, then restore. That RESTORES the ``sys.modules`` keys but NOT
    the parent package attribute — ``app.services.harness.phase_types`` keeps pointing at the
    SECOND module object the re-import created. The resulting split brain broke **23 tests in
    two other files** (`test_llm_emit_executor.py`, `test_185_detection.py`), each of which
    monkeypatches one module object while the code under test lives in the other. Every one of
    them passed in isolation, which is exactly what makes that failure mode expensive.

    A subprocess is also STRICTLY STRONGER evidence: an interpreter with nothing preloaded is
    the real "does the backend start" question, and it cannot perturb this session at all.
    """
    backend_dir = pathlib.Path(__file__).resolve().parents[2]
    proc = subprocess.run(
        [sys.executable, "-c", _A1_SUBPROCESS],
        cwd=str(backend_dir), capture_output=True, text=True, timeout=300,
    )
    assert proc.returncode == 0, (
        "A1 FAILED — the harness could not import or run the checked helper in a fresh "
        f"interpreter (a cycle here means the backend does not start).\n{proc.stderr}"
    )
    assert "A1-OK" in proc.stdout


def test_a1_checked_helper_is_present_and_async(harness):
    """The in-process half of A1 — the attribute exists on the module everyone else imports."""
    assert hasattr(harness, "_effective_model_checked")
    assert inspect.iscoroutinefunction(harness._effective_model_checked)


# ── the stubs: a harness ctx with no live substrate at all ────────────────────


class _StubUserSettings:
    """Carries only ``llm_model`` — the org default the shipped resolver falls back to."""

    def __init__(self, llm_model: str):
        self.llm_model = llm_model


class _StubPhaseConfig:
    def __init__(self, model):
        self.model = model


class _StubPhase:
    def __init__(self, model, slug="fill"):
        self.config = _StubPhaseConfig(model)
        self.slug = slug
        self.phase_index = 0


class _StubCtx:
    """The harness ctx bag, carrying ONLY what the helper reads.

    Every live seam is explicitly ``None``: no pool, no stream handle, no user row. The two
    carriers are recorded by patching the module functions, so nothing here is ever dialled.
    """

    def __init__(self, *, model: str, org_default: str):
        self.model = model
        self.user_settings = _StubUserSettings(org_default)
        self.redis = None
        self.pool = None
        self.run_id = None
        self.producer_run_id = None
        self.current_user = {}
        self.emit = None


class _CarrierRecorder:
    """Records the arguments each carrier was called with instead of firing it.

    The enabled case asserts ``len(...) == 0`` on BOTH recorders — an ENABLED per-phase model
    must be byte-identical to today: no sub-step on the run surface, no durable receipt.
    """

    def __init__(self):
        self.substeps: list[dict] = []
        self.audits: list[dict] = []

    async def substep(self, ctx, phase, *, status=None, failure=None):
        self.substeps.append({"phase": phase, "status": status, "failure": failure})

    async def audit(self, ctx, *, event_type, metadata):
        self.audits.append({"event_type": event_type, "metadata": metadata})


@pytest.fixture
def harness():
    """The module under test, with both carriers recorded rather than fired."""
    import app.services.harness.phase_types as phase_types

    return phase_types


@pytest.fixture
def carriers(monkeypatch, harness):
    rec = _CarrierRecorder()
    monkeypatch.setattr(harness, "_emit_phase_substep", rec.substep, raising=False)
    monkeypatch.setattr(harness, "_emit_audit", rec.audit, raising=False)
    return rec


def _patch_overrides(monkeypatch, overrides):
    """Supply the operator override rows IN MEMORY.

    ``_resolve_enabled_model`` resolves ``load_all_model_overrides`` LATE off
    ``app.api.threads`` (``run_model_resolution.py:53``), so the patch lands there. Patching
    the source rather than seeding a cache is what keeps the 30 s override TTL from leaking
    state between cases.
    """
    async def _fake():
        return overrides

    monkeypatch.setattr("app.api.threads.load_all_model_overrides", _fake)


def _patch_overrides_raising(monkeypatch):
    """The registry read BLIPS — the fail-open arm."""
    async def _boom():
        raise RuntimeError("override read blip")

    monkeypatch.setattr("app.api.threads.load_all_model_overrides", _boom)


# ── D-10 behaviour ────────────────────────────────────────────────────────────


async def test_disabled_phase_model_falls_back_to_the_run_model(monkeypatch, harness, carriers):
    """A DISABLED per-phase model resolves to the run's model, and says so twice."""
    _patch_overrides(monkeypatch, {
        DISABLED_MODEL: {"enabled": False},
        ENABLED_MODEL: {"enabled": True},
    })
    phase = _StubPhase(DISABLED_MODEL)
    ctx = _StubCtx(model=ENABLED_MODEL, org_default=ENABLED_MODEL)

    resolved = await harness._effective_model_checked(phase, ctx)

    assert resolved == ENABLED_MODEL, (
        "a disabled per-phase model must not reach the provider — it falls back to the run's model"
    )
    # Carrier 1 — the user-visible half, on the producer stream the frontend already tails.
    assert [s["status"] for s in carriers.substeps] == ["model_fallback"]
    assert carriers.substeps[0]["phase"] is phase
    # Carrier 2 — the durable half, on the EXISTING policy_applied kind (no 25th kind minted).
    assert [a["event_type"] for a in carriers.audits] == ["policy_applied"]
    meta = carriers.audits[0]["metadata"]
    assert meta["disabled_model"] == DISABLED_MODEL
    assert meta["fallback_model"] == ENABLED_MODEL
    assert meta["phase"] == "fill"
    assert DISABLED_MODEL in meta["message"] and ENABLED_MODEL in meta["message"]


async def test_enabled_phase_model_is_a_strict_noop(monkeypatch, harness, carriers):
    """An ENABLED per-phase model is byte-identical to today: no notice, no receipt."""
    _patch_overrides(monkeypatch, {
        DISABLED_MODEL: {"enabled": False},
        ENABLED_MODEL: {"enabled": True},
    })
    phase = _StubPhase(ENABLED_MODEL)
    ctx = _StubCtx(model="some-other-run-model", org_default="some-other-run-model")

    resolved = await harness._effective_model_checked(phase, ctx)

    assert resolved == ENABLED_MODEL, "an enabled per-phase override still wins"
    assert resolved == harness._effective_model(phase, ctx), (
        "the checked helper must agree with the shipped sync helper on the enabled path"
    )
    assert not carriers.substeps, "an enabled model must emit NO sub-step"
    assert not carriers.audits, "an enabled model must write NO receipt"


async def test_blank_phase_model_inherits_the_ctx_model(monkeypatch, harness, carriers):
    """A blank per-phase model still inherits ``ctx.model`` exactly as today."""
    _patch_overrides(monkeypatch, {ENABLED_MODEL: {"enabled": True}})
    phase = _StubPhase(None)
    ctx = _StubCtx(model=ENABLED_MODEL, org_default=ENABLED_MODEL)

    resolved = await harness._effective_model_checked(phase, ctx)

    assert resolved == ENABLED_MODEL
    assert resolved == harness._effective_model(phase, ctx)
    assert not carriers.substeps and not carriers.audits


async def test_dead_default_resolves_without_infinite_substitution(monkeypatch, harness, carriers):
    """The run's own model is ALSO disabled — resolve once, honestly, and terminate.

    Delegated to the shipped resolver (``run_model_resolution.py:73-79``), asserted here so a
    future re-implementation inside the harness cannot lose it. Two arms:

      1. phase model disabled, org default ALSO disabled -> the honest fallback still fires
         and returns ONCE (never a silent route, never a substitution loop);
      2. the phase model IS the org default and is disabled -> no substitution is possible,
         so the resolver returns it unchanged with NO notice rather than chasing itself.
    """
    dead_default = "gpt-5.3"
    _patch_overrides(monkeypatch, {
        DISABLED_MODEL: {"enabled": False},
        dead_default: {"enabled": False},
    })

    phase = _StubPhase(DISABLED_MODEL)
    ctx = _StubCtx(model=dead_default, org_default=dead_default)
    resolved = await harness._effective_model_checked(phase, ctx)
    assert resolved == dead_default, "one substitution, then stop — no loop"
    assert len(carriers.substeps) == 1 and len(carriers.audits) == 1

    # Arm 2: the phase model IS the (disabled) org default — nothing to substitute to.
    phase_same = _StubPhase(dead_default)
    ctx_same = _StubCtx(model=dead_default, org_default=dead_default)
    resolved_same = await harness._effective_model_checked(phase_same, ctx_same)
    assert resolved_same == dead_default
    assert len(carriers.substeps) == 1, "no second sub-step — there was nothing to fall back to"
    assert len(carriers.audits) == 1


async def test_registry_read_failure_fails_open(monkeypatch, harness, carriers):
    """FAIL-OPEN, and it is a DECISION rather than an inherited default.

    A registry-read blip lets the per-phase model run rather than sinking the phase. That is
    the shipped chat posture (``run_model_resolution.py:54-57``) and therefore consistent;
    failing closed would make an infrastructure hiccup look like an authoring error, which is
    a worse lie than the one this plan fixes.
    """
    _patch_overrides_raising(monkeypatch)
    phase = _StubPhase(DISABLED_MODEL)
    ctx = _StubCtx(model=ENABLED_MODEL, org_default=ENABLED_MODEL)

    resolved = await harness._effective_model_checked(phase, ctx)

    assert resolved == DISABLED_MODEL, "a read blip returns the per-phase model UNCHANGED"
    assert not carriers.substeps, "no notice on a blip — nothing was actually substituted"
    assert not carriers.audits


def test_phase_tool_context_carries_the_checked_model_when_given_one(harness):
    """The DEVIATION fence (Rule 3 / Rule 1) — the fifth call site is NOT in an async def.

    ``196-03-PLAN.md`` states all five ``_effective_model`` call sites *"already sit inside
    ``async def``, so no signature changes"*. Measured, that is FALSE for one of them:
    ``_build_phase_tool_context`` is SYNC and is called synchronously by fifteen shipped test
    sites, so making it async is a signature change with a large blast radius, not a one-word
    edit. It is also the load-bearing site — ``run_task_sub_agent`` reads ``parent_ctx.model``,
    NOT the executor's local ``model`` — so it cannot simply be skipped either.

    The seam taken instead is purely ADDITIVE: an optional keyword ``model``. The two
    PRODUCTION callers are both inside ``async def`` and pass the model they already awaited;
    every existing sync caller omits it and gets the shipped ``_effective_model`` fallback,
    byte-identical. This case pins both arms so the fallback cannot quietly become the only
    arm again.
    """
    import inspect as _inspect

    sig = _inspect.signature(harness._build_phase_tool_context)
    assert "model" in sig.parameters, "the checked model must have a way IN to the ToolContext"
    assert sig.parameters["model"].default is None, (
        "omitting it must keep every shipped sync call site byte-identical"
    )
    assert not _inspect.iscoroutinefunction(harness._build_phase_tool_context), (
        "the builder stays SYNC — fifteen shipped call sites invoke it without await"
    )

    # Both production call sites hand the awaited model in; neither re-derives it.
    src = _inspect.getsource(harness)
    assert src.count("_build_phase_tool_context(phase, ctx, model=model)") == 2
    assert "_build_phase_tool_context(phase, ctx)\n" not in src, (
        "a production call site that omits the model would run the sub-agent on an "
        "UNCHECKED id while the executor's own local was checked"
    )


def test_effective_model_is_still_sync_and_exported(harness):
    """``_effective_model`` is untouched: still importable, still sync, same values."""
    assert callable(harness._effective_model)
    assert not inspect.iscoroutinefunction(harness._effective_model), (
        "changing _effective_model's signature would break every importer — the new helper is "
        "purely ADDITIVE"
    )
    ctx = _StubCtx(model=ENABLED_MODEL, org_default=ENABLED_MODEL)
    assert harness._effective_model(_StubPhase(DISABLED_MODEL), ctx) == DISABLED_MODEL
    assert harness._effective_model(_StubPhase(None), ctx) == ENABLED_MODEL
    assert harness._effective_model(_StubPhase(None), _StubCtx(model="", org_default="")) == ""
