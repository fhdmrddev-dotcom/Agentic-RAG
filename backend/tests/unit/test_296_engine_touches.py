"""Phase 296-02 — the three audited one-statement touches to ``harness_engine.py`` beside the
boot-sweep arm, plus the two ``db/workflows.py`` halves SEED-362 needs.

* 295-RES-a — the armed checkpoint announced ``action_risk_pending`` on EVERY entry, including
  the answered re-drive that only consumes the approval, so one approval wrote two rows.
* 289-F3 — the run-level confidence used the shipped default buckets, not the owner's
  (``phase_confidence`` and chat already pass the owner's settings).
* SEED-362 — a resumed run finished on the OWNER'S default model, never the run's own.
"""
from __future__ import annotations

import asyncio
import inspect
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from pydantic import BaseModel

from tests.unit.test_185_engine_attachment import _armed_ctx, _armed_effective_phase


# ── 295-RES-a ──────────────────────────────────────────────────────────────────────────
def _enter_armed(ctx):
    """Enter ``_run_phase_with_gates`` for the armed step. On the re-drive the REAL
    ``consume_engine_answer`` runs over a durable world that holds the approved answer, so
    the guard is exercised on the state the engine actually leaves behind: the consume
    CLEARS ``resume_answered_tool_call_id`` and records ``engine_ask_approved[slug]``."""
    from app.services import harness_engine
    from app.services.harness import engine_ask

    _authored, eff = _armed_effective_phase()
    approve = engine_ask._ACTION_RISK_APPROVE_CHOICE
    active = {"id": uuid4(), "slug": eff.slug, "phase_index": 1, "status": "active",
              "output": {"_awaiting_answer": {"tool_call_id": "tc-approve",
                                              "kind": "action_risk",
                                              "options": [approve, "Don't run it"]}},
              "started_at": None, "completed_at": None}
    write_audit = AsyncMock()
    emit = AsyncMock()
    with patch.object(harness_engine, "write_audit", write_audit), \
         patch.object(harness_engine, "_emit", emit), \
         patch.object(engine_ask, "get_active_phase", AsyncMock(return_value=active)), \
         patch.object(engine_ask, "get_ask_user_response", AsyncMock(
             return_value={"response_text": approve, "choice_index": 0})), \
         patch.object(harness_engine, "_resolve_failure_with_ask_user",
                      AsyncMock(return_value=harness_engine.PhaseOutcome(
                          "fail_run", None, None, "stub"))):
        asyncio.run(harness_engine._run_phase_with_gates(
            eff, {}, ctx, run_id=uuid4(), pool=object(), redis=object(),
            wall_clock=60, _audit_user_id=uuid4(), total_phases=4))
    pending = [c for c in write_audit.await_args_list
               if c.kwargs.get("event_type") == "action_risk_pending"]
    emitted = [c for c in emit.await_args_list
               if len(c.args) >= 3 and c.args[2] == "action_risk_pending"]
    return len(pending), len(emitted)


def test_an_approved_armed_step_announces_its_pending_approval_once():
    first_ctx = _armed_ctx()                       # the step reaches its checkpoint
    redrive_ctx = _armed_ctx()                     # the answer re-drives it
    redrive_ctx.resume_answered_tool_call_id = "tc-approve"
    a1, e1 = _enter_armed(first_ctx)
    a2, e2 = _enter_armed(redrive_ctx)
    assert (a1 + a2, e1 + e2) == (1, 1), (
        f"approve + re-drive wrote {a1 + a2} action_risk_pending rows / {e1 + e2} emits")


# ── 289-F3 ─────────────────────────────────────────────────────────────────────────────
def test_run_confidence_uses_the_owners_buckets():
    from app.services import harness_engine

    owner = SimpleNamespace(confidence_bucket_high=0.9, confidence_bucket_medium=0.8)
    _refs, _cites, conf = harness_engine._finalize_run_grounding(
        [], [], [0.6], user_settings=owner)
    assert conf["level"] == "low"


def test_run_confidence_without_settings_keeps_the_default_buckets():
    from app.services import harness_engine

    _refs, _cites, conf = harness_engine._finalize_run_grounding([], [], [0.6])
    assert conf["level"] == "high"  # 0.6 ≥ the shipped 0.54


def test_the_run_finaliser_passes_the_owners_settings():
    from app.services import harness_engine

    src = inspect.getsource(harness_engine)
    assert "_compute_confidence(final_avg, user_settings)" in src
    assert 'user_settings=getattr(ctx, "user_settings", None)' in src


# ── SEED-362 ───────────────────────────────────────────────────────────────────────────
def _owner(provider="openai", model="gpt-5.5"):
    return SimpleNamespace(active_provider=provider, llm_model=model, available_models=[],
                           confidence_bucket_high=0.54, confidence_bucket_medium=0.38)


def _build(run, owner):
    from app.services import harness_engine

    with ExitStack() as st:
        st.enter_context(patch("app.models.user_settings.load_user_settings",
                               MagicMock(return_value=owner)))
        st.enter_context(patch("app.dependencies.get_service_role_supabase",
                               MagicMock(return_value=MagicMock())))
        st.enter_context(patch.object(harness_engine, "_load_run_definition",
                                      AsyncMock(return_value=None)))
        st.enter_context(patch("app.services.harness.scope.resolve_run_scope_root",
                               AsyncMock(return_value=None)))
        st.enter_context(patch("app.db.runs.insert_run", AsyncMock()))
        return asyncio.run(harness_engine._build_resume_context(run, object(), MagicMock()))


def _run_row(**extra):
    row = {"run_id": uuid4(), "thread_id": uuid4(), "user_id": uuid4(), "org_id": uuid4()}
    row.update(extra)
    return row


def test_a_resumed_run_continues_on_its_own_model_and_provider():
    ctx = _build(_run_row(model="glm-5.2", metadata={"provider": "zhipu"}), _owner())
    assert ctx.model == "glm-5.2"
    assert ctx.provider == "zhipu"


def test_metadata_as_a_json_string_is_read_too():
    ctx = _build(_run_row(model="glm-5.2", metadata='{"provider": "zhipu"}'), _owner())
    assert (ctx.model, ctx.provider) == ("glm-5.2", "zhipu")


class _OwnerSettings(BaseModel):
    """The fields ``override_provider`` reads and writes, plus what the resolvers read."""
    model_config = {"arbitrary_types_allowed": True}
    active_provider: str = "deepseek"
    llm_model: str = "deepseek-v4-flash"
    llm_api_key: str = "sk-deepseek-owner"
    llm_base_url: str = "https://api.deepseek.com"
    available_models: list = []
    providers: list = []
    confidence_bucket_high: float = 0.54
    confidence_bucket_medium: float = 0.38


def _p(pid, key):
    return SimpleNamespace(id=pid, api_key=key, base_url=f"https://{pid}.example", models=[])


def test_a_resumed_runs_settings_carry_the_recorded_providers_credentials():
    """296 review CR-01, measured live by the board's --resume-model rows (5 FAIL, 2026-10-27):
    the ctx kept the run's model + provider but the OWNER's key and active_provider, so the next
    llm_single step sent gpt-5.6-luna to DeepSeek with DeepSeek's key."""
    owner = _OwnerSettings(providers=[_p("deepseek", "sk-deepseek-owner"), _p("openai", "sk-openai")])
    ctx = _build(_run_row(model="gpt-5.6-luna", metadata={"provider": "openai"}), owner)
    assert (ctx.model, ctx.provider) == ("gpt-5.6-luna", "openai")
    assert ctx.user_settings.active_provider == "openai"
    assert ctx.user_settings.llm_api_key == "sk-openai"


def test_a_recorded_provider_with_no_key_falls_back_to_the_owner_safely():
    """No key for the recorded provider → the pre-296 safe resolver on the owner's settings,
    never the run's model on another provider's key."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    owner = _OwnerSettings(providers=[_p("deepseek", "sk-deepseek-owner"), _p("openai", "")])
    ctx = _build(_run_row(model="gpt-5.6-luna", metadata={"provider": "openai"}), owner)
    assert ctx.user_settings.active_provider == "deepseek"
    assert ctx.provider is None
    assert ctx.model == resolve_sub_agent_model_safely(owner, override_model="gpt-5.6-luna")


def test_a_run_with_no_model_falls_back_to_the_owner_default():
    from app.services.sub_agent_models import resolve_workflow_ctx_model

    owner = _owner()
    ctx = _build(_run_row(model=None, metadata=None), owner)
    assert ctx.model == resolve_workflow_ctx_model(owner)
    assert getattr(ctx, "provider", None) is None


def test_find_resumable_runs_selects_the_runs_model_and_metadata():
    from app.db.workflows import find_resumable_runs

    pool = MagicMock()
    pool.fetch = AsyncMock(return_value=[])
    asyncio.run(find_resumable_runs(pool))
    sql = pool.fetch.await_args.args[0]
    assert "wr.model" in sql and "wr.metadata" in sql


class _Con:
    def __init__(self):
        self.calls = []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return uuid4()

    async def execute(self, sql, *args):
        return None

    def transaction(self):
        con = self

        class _T:
            async def __aenter__(self_inner):
                return con

            async def __aexit__(self_inner, *a):
                return False

        return _T()


class _Pool:
    def __init__(self):
        self.con = _Con()

    def acquire(self):
        pool = self

        class _A:
            async def __aenter__(self_inner):
                return pool.con

            async def __aexit__(self_inner, *a):
                return False

        return _A()


def _create(**kw):
    from app.db.workflows import create_workflow_run

    pool = _Pool()
    definition = SimpleNamespace(phases=[], model_dump=lambda mode=None: {"phases": []})
    asyncio.run(create_workflow_run(
        pool, thread_id=uuid4(), definition_id=uuid4(), definition=definition,
        inputs={}, model="glm-5.2", user_id=uuid4(), **kw))
    return pool.con.calls[0]


# The INSERT exactly as it reads at base 606a4e31b — provider=None must not change one byte.
_BASE_INSERT = """
                INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id, is_golden_run, definition_snapshot, origin_kind, origin_label, origin_ref)
                VALUES ($1, $2, 'active', $3::jsonb, $4, $5, $6, $7::jsonb, $8, $9, $10)
                RETURNING id
                """


def test_create_workflow_run_without_a_provider_is_byte_identical():
    sql, args = _create()
    assert sql == _BASE_INSERT
    assert len(args) == 10


def test_create_workflow_run_records_the_provider_in_the_same_insert():
    sql, args = _create(provider="zhipu")
    assert "metadata" in sql
    assert {"provider": "zhipu"} in list(args)


@pytest.mark.parametrize("name", ["_build_resume_context"])
def test_resume_never_validates_a_known_provider_against_the_owner(name):
    """Owner on openai, run on zhipu: the run's model is NOT swapped for an openai default."""
    ctx = _build(_run_row(model="glm-5.2", metadata={"provider": "zhipu"}),
                 _owner(provider="openai", model="gpt-5.5"))
    assert ctx.model != "gpt-5.5"
