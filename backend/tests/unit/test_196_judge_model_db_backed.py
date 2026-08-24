"""Phase 196 Plan 02 (D-17 / BUG-260731-01) — the judge model an operator SETS in Settings
is the judge model the code actually USES, at all FOUR consumers.

THE BINDING CONDITION, verbatim from the report: *a test that sets the row and asserts the
RESOLVED model changes.* Its absence is why the defect survived 2026-07-31 -> 2026-08-17.

THE FIXTURE IS THE WHOLE POINT. Every case patches
``app.models.user_settings._load_settings_from_db`` — the DB read at the BOTTOM of the
chain — so the WHOLE real path runs::

    _load_settings_from_db -> _build_settings_from_row -> UserEffectiveSettings
                           -> resolve_judge_model

⚠ ``SimpleNamespace`` is deliberately NEVER used as the settings object anywhere in this
file. ``tests/unit/test_settings.py:17-65`` builds ``SimpleNamespace(harness_judge_model=...)``
and hands it to the resolver — that shape is WHY the bug survived, because a test that
SUPPLIES the settings object has already made the choice the defect is about (RESEARCH
Pitfall 5). Every ``SimpleNamespace`` below is a ctx / definition / loop-result stub, never
settings, and each occurrence says so on its own line.

COVERAGE IS PER-CONSUMER — four cases, not one case on the resolver. The defect is
per-consumer: a single shared case would let three of four regress silently.

Consumers 1, 3 and 4 are asserted at the EMISSION BOUNDARY: the ``model=`` argument
``forced_emit`` actually received. That is a strictly stronger claim than a helper's return
value, and it is exactly the shape the report asks for. Consumer 2 records rather than
shoots, so its recorded ``judge_model`` is asserted instead.

The row value is ``deepseek-v4-pro`` — the operator's real value, and NEITHER of the two
fallback candidates (``claude-opus-4-8`` / ``gpt-5.5``) — so a pass cannot be a coincidence.

PARALLEL-SAFETY (CLAUDE.md rule 4): no case INSERTs or UPDATEs any real row. The DB read is
patched in memory; nothing here touches Postgres.
"""
from types import SimpleNamespace  # ctx / definition / loop-result stubs ONLY — never the settings object
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.config as config_mod
import app.models.user_settings as us

# The operator's real value. Deliberately NEITHER fallback candidate.
ROW_MODEL = "deepseek-v4-pro"
ROW_MODEL_PROVIDER = "deepseek"
# What resolve_judge_model falls back to when nothing is set (registry default #1).
FALLBACK_MODEL = "claude-opus-4-8"

# A minimal, schema-valid JudgeVerdict payload (extra="forbid" — no stray keys).
_VERDICT = {
    "overall_passed": True,
    "overall_score": 90,
    "grounded_in_evidence": True,
    "answers_business_requirement": True,
    "did_the_work_not_delegated": True,
    "criteria": [],
    "summary": "ok",
}


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Reset the module-level settings cache around EVERY case.

    ``_load_settings_from_db`` short-circuits on a 30 s TTL, so without this reset the TTL
    leaks state between cases and the assertions go non-deterministic (the same load-bearing
    reset ``tests/unit/test_149_registry_read.py:34-38`` performs for the override caches).
    Resetting AFTER as well keeps a fake row from leaking into the rest of the suite.
    """
    us._settings_cache = None
    us._settings_cache_time = 0.0
    yield
    us._settings_cache = None
    us._settings_cache_time = 0.0


def _patch_settings_row(monkeypatch, judge_model: str) -> list:
    """Patch the DB read at the BOTTOM of the settings chain and return its call log.

    Also pins ``app.config.settings.harness_judge_model`` to ``None`` EXPLICITLY. It
    measures ``None`` today, but without the explicit pin a case could pass for the wrong
    reason on a machine where someone has set ``HARNESS_JUDGE_MODEL`` in ``.env``.
    """
    db_calls: list = []

    async def _fake_load_settings_from_db():
        db_calls.append(judge_model)
        return {"harness_judge_model": judge_model}

    async def _fake_load_all_model_overrides():
        # load_app_settings_async warms this cache too; stub it so no case needs a pool.
        return {}

    monkeypatch.setattr(us, "_load_settings_from_db", _fake_load_settings_from_db)
    monkeypatch.setattr(us, "load_all_model_overrides", _fake_load_all_model_overrides)
    monkeypatch.setattr(config_mod.settings, "harness_judge_model", None)
    return db_calls


def _patch_forced_emit(monkeypatch) -> dict:
    """Capture the kwargs the emission layer actually received."""
    seen: dict = {}

    async def _fake_forced_emit(**kwargs):
        seen.update(kwargs)
        return {"emitted": dict(_VERDICT)}

    monkeypatch.setattr("app.services.forced_emit.forced_emit", _fake_forced_emit)
    return seen


# ── the four consumer drivers ────────────────────────────────────────────────────

async def _drive_consumer_1(monkeypatch) -> str:
    """Consumer 1 — eval_runner_service._judge_eval_answer (the judge SHOT)."""
    from app.services.eval_runner_service import _judge_eval_answer

    seen = _patch_forced_emit(monkeypatch)
    await _judge_eval_answer(
        answer="the arm's answer", expected_behavior="does the thing", user_settings=None,
    )
    return seen.get("model")


async def _drive_consumer_2(monkeypatch) -> str:
    """Consumer 2 — eval_runner_service._run_arm_body (the RECORDED judge model)."""
    import app.services.eval_runner_service as ers

    async def _fake_run_agent_loop(ctx, emit=None, emit_terminal=None, spawn=None):
        return SimpleNamespace(  # loop-result stub (an AgentLoopResult shape) — NOT the settings object
            full_content_final="an answer", input_tokens_total=1, output_tokens_total=2,
        )

    persisted: dict = {}

    async def _fake_persist_result(supabase, **kwargs):
        persisted.update(kwargs)

    monkeypatch.setattr(ers, "run_agent_loop", _fake_run_agent_loop)
    monkeypatch.setattr(ers, "_gather_tool_evidence", AsyncMock(return_value=""))
    monkeypatch.setattr(ers, "_judge_eval_answer", AsyncMock(return_value=dict(_VERDICT)))
    monkeypatch.setattr(ers, "_emit_eval", AsyncMock(return_value=None))
    monkeypatch.setattr(ers, "_persist_result", _fake_persist_result)

    await ers._run_arm_body(
        redis=None,
        supabase=None,
        run_id=uuid4(),
        thread_id="eval-thread",
        case={"id": "case-1", "prompt": "p", "expected_behavior": "e"},
        variant=ers.VARIANT_WITH,
        catalog_override=(),
        provider="openai",
        model="gpt-5.5",
        current_user={"id": "user-1"},
        user_settings=None,
        user_id="user-1",
        test_case_id="case-1",
    )
    assert persisted.get("verdict_state") == "graded", "the arm must reach the graded branch"
    return persisted.get("judge_model")


async def _drive_consumer_3(monkeypatch) -> str:
    """Consumer 3 — publish_service._judge_golden_output (the gauntlet HARD WALL)."""
    from app.services.harness.publish_service import _judge_golden_output

    seen = _patch_forced_emit(monkeypatch)
    # _author_judge_criteria scans .phases; a bare definition is enough.
    definition = SimpleNamespace(business_requirement="ship the QBR", phases=[])  # DEFINITION stub — NOT the settings object
    await _judge_golden_output(
        definition=definition, final_output={"text": "the deliverable"}, pool=None,
        owner_settings=None,
    )
    return seen.get("model")


async def _drive_consumer_4(monkeypatch, config: dict | None = None) -> str:
    """Consumer 4 — validator_kinds._validate_llm_judge_rubric (the IN-RUN validator)."""
    from app.services.harness.validator_kinds import _validate_llm_judge_rubric

    seen = _patch_forced_emit(monkeypatch)
    # No `judge_model` attr => rung 2 of the precedence chain is absent.
    ctx = SimpleNamespace(user_settings=None)  # RunContext/ctx stub — NOT the settings object
    await _validate_llm_judge_rubric({"text": "the output"}, dict(config or {}), ctx)
    return seen.get("model")


_DRIVERS = {
    "1-eval-judge-shot": _drive_consumer_1,
    "2-eval-recorded-judge-model": _drive_consumer_2,
    "3-publish-gauntlet-judge": _drive_consumer_3,
    "4-in-run-llm-judge-rubric": _drive_consumer_4,
}


# ── the four per-consumer cases (RED before the fix) ─────────────────────────────

async def test_consumer_1_eval_judge_shot_uses_db_backed_model(monkeypatch):
    """The eval judge SHOT routes to the model the operator set, not the env fallback."""
    _patch_settings_row(monkeypatch, ROW_MODEL)
    assert await _drive_consumer_1(monkeypatch) == ROW_MODEL


async def test_consumer_2_recorded_judge_model_is_db_backed(monkeypatch):
    """The judge model PERSISTED on the eval result is the model the operator set."""
    _patch_settings_row(monkeypatch, ROW_MODEL)
    assert await _drive_consumer_2(monkeypatch) == ROW_MODEL


async def test_consumer_3_publish_gauntlet_judge_is_db_backed(monkeypatch):
    """The publish-gauntlet judge — a HARD WALL — grades with the model the operator set."""
    _patch_settings_row(monkeypatch, ROW_MODEL)
    assert await _drive_consumer_3(monkeypatch) == ROW_MODEL


async def test_consumer_4_in_run_judge_rubric_is_db_backed(monkeypatch):
    """With config.model and ctx.judge_model both absent, rung 3 reads the DB-backed row."""
    _patch_settings_row(monkeypatch, ROW_MODEL)
    assert await _drive_consumer_4(monkeypatch) == ROW_MODEL


# ── the two controls (GREEN both before AND after the fix) ───────────────────────

@pytest.mark.parametrize("consumer", sorted(_DRIVERS))
async def test_negative_control_empty_row_falls_back_to_registry_default(monkeypatch, consumer):
    """NEGATIVE CONTROL: an EMPTY row still resolves to claude-opus-4-8.

    This proves the four cases above read the RESOLVER rather than a constant — if the row
    value were simply being echoed, this case would read "" and fail.
    """
    _patch_settings_row(monkeypatch, "")
    assert await _DRIVERS[consumer](monkeypatch) == FALLBACK_MODEL


async def test_consumer_4_precedence_config_model_wins_and_db_not_consulted(monkeypatch):
    """PRECEDENCE CONTROL: rung 1 (``config['model']``) still wins and the DB is NOT read.

    Consumer 4's three-rung chain (config -> ctx.judge_model -> the resolver) must survive
    the rewire untouched; only the THIRD rung changes.
    """
    db_calls = _patch_settings_row(monkeypatch, ROW_MODEL)
    assert await _drive_consumer_4(monkeypatch, config={"model": "gpt-5.5"}) == "gpt-5.5"
    assert db_calls == [], "rung 1 won — the settings row must never be read"
