"""Phase 091 — HARNESS-07 seed-template contracts (Wave-0 skeleton).

End-to-end seed execution (each seed runs through the engine on a mocked LLM) is
owned by Plan 07. The parse + 5-type-coverage contracts are LIVE NOW (they only
need the finalized models from Task 1 + the four_seed_defs fixture). Skips name
Plan 07.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.models.harness import WorkflowDefinition

# The migration 061 file (repo root) whose `definition` JSONB blobs MUST be
# byte-equal in shape to the conftest `four_seed_defs()` single source.
_MIGRATION_061 = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "061_harness_seed_templates.sql"
)


def _extract_migration_definitions() -> list[dict]:
    """Parse the 4 `definition` JSONB blobs out of migration 061.

    Each seed row is ``... 'published', '<json>'::jsonb, ...``. We extract every
    ``'{...}'::jsonb`` blob, un-double the SQL single-quote escaping (``''`` -> ``'``),
    and json.loads it. Returns the 4 definition dicts in file order.
    """
    sql = _MIGRATION_061.read_text(encoding="utf-8")
    # Match a single-quoted SQL literal immediately followed by ::jsonb. The
    # literal may contain doubled single-quotes ('') as escaped apostrophes.
    blobs = re.findall(r"'((?:[^']|'')*)'::jsonb", sql, flags=re.DOTALL)
    defs = []
    for blob in blobs:
        unescaped = blob.replace("''", "'")
        defs.append(json.loads(unescaped))
    return defs


def test_each_seed_parses_via_model_validate(four_seed_defs):
    """LIVE — each of the 4 seed shapes parses via WorkflowDefinition.model_validate."""
    defs = four_seed_defs()
    assert len(defs) == 4
    for wf in defs:
        assert isinstance(wf, WorkflowDefinition)
        assert wf.status in ("draft", "published")
        assert len(wf.phases) >= 1


def test_seeds_cover_all_5_phase_types(four_seed_defs):
    """LIVE — the 4 seeds collectively exercise every one of the 5 phase types."""
    kinds = {p.config.phase_type for wf in four_seed_defs() for p in wf.phases}
    assert kinds == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
    }


# ═══════════════════════════════════════════════════════════════════════
# LIVE — Plan 07 Task 1: migration 061 shape + parity with the single source
# ═══════════════════════════════════════════════════════════════════════


def test_migration_061_exists_and_is_idempotent_global_published():
    """Migration 061 ships the 4 seeds as idempotent global+published seed rows."""
    assert _MIGRATION_061.exists(), f"missing {_MIGRATION_061}"
    sql = _MIGRATION_061.read_text(encoding="utf-8")
    # 4 seed INSERTs into workflow_definitions, each idempotent (ON CONFLICT).
    assert sql.count("INSERT INTO public.workflow_definitions") == 4
    assert sql.count("ON CONFLICT (id) DO NOTHING") >= 4
    # is_global true on each seed (the 4 trailing `true` + the seed-user row uses
    # ON CONFLICT, not is_global) — assert at least 4 `true` flags.
    assert sql.count("\n  true\n") >= 4
    # Seed system user present (created_by FK).
    assert "00000000-0000-0000-0000-000000000001" in sql
    # No db push/reset anywhere (CLAUDE.md migration discipline).
    assert "db push" not in sql and "db reset" not in sql
    # status='published' on every seed row (4 column-position literals).
    assert sql.count("', 'published',") == 4


def test_migration_061_definitions_match_four_seed_defs(four_seed_defs):
    """The migration JSONB is byte-equal in SHAPE to the conftest single source.

    Parse the 4 `definition` blobs out of the SQL and confirm each round-trips
    through WorkflowDefinition.model_validate to the SAME parsed model the conftest
    `four_seed_defs()` produces (T-091-25 — single source, no drift).
    """
    migration_defs = _extract_migration_definitions()
    assert len(migration_defs) == 4
    source_defs = {wf.slug: wf for wf in four_seed_defs()}
    for raw in migration_defs:
        parsed = WorkflowDefinition.model_validate(raw)
        assert parsed.slug in source_defs, f"unexpected seed {parsed.slug!r}"
        # The migration row ships status='published' (the block-published trigger
        # then freezes it); the conftest source builds at default 'draft'. That is
        # the ONLY intended difference — normalize it out and assert the rest of the
        # SHAPE (slug/name/phases/configs/validators) is field-for-field identical.
        mig = parsed.model_dump()
        src = source_defs[parsed.slug].model_dump()
        mig.pop("status", None)
        src.pop("status", None)
        assert mig == src, (
            f"migration seed {parsed.slug!r} drifted from conftest four_seed_defs()"
        )
        # The stored row is published.
        assert parsed.status == "published"


def test_migration_061_seeds_cover_all_5_phase_types():
    """The migration's 4 seed definitions collectively exercise all 5 phase types."""
    kinds = set()
    for raw in _extract_migration_definitions():
        for phase in raw["phases"]:
            kinds.add(phase["config"]["phase_type"])
    assert kinds == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
    }


# ═══════════════════════════════════════════════════════════════════════
# LIVE — Plan 07 Task 2: end-to-end per seed through the engine (mocked LLM)
# ═══════════════════════════════════════════════════════════════════════

import uuid as _uuid  # noqa: E402
from unittest.mock import patch  # noqa: E402


def _seed_phase_rows(wf):
    """Pre-seeded ``workflow_phases`` rows (all pending) for a parsed seed.

    Mirrors the migration-058 column shape the engine's ``load_run_phases`` reads
    (``id``, ``slug``, ``phase_index``, ``status``, ``output``) — the engine drives
    these durable rows in phase_index order.
    """
    return [
        {
            "id": _uuid.uuid4(),
            "slug": p.slug,
            "phase_index": p.phase_index,
            "status": "pending",
            "output": {},
        }
        for p in sorted(wf.phases, key=lambda p: p.phase_index)
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "seed_index, slug",
    [
        (0, "research_summarize"),
        (1, "plan_execute_verify"),
        (2, "literature_review"),
        (3, "doc_qa_human"),
    ],
)
async def test_each_seed_runs_end_to_end_mocked_llm(
    seed_index, slug, four_seed_defs, fake_redis, mock_asyncpg_pool
):
    """Each seed runs end-to-end through the engine on a MOCKED LLM substrate.

    Proves Plans 02-06 compose on the real seed definitions: ordered active->completed
    per phase + completion-is-chat-message (D-10) + the run_completed SSE event + the
    gate (plan_execute_verify) + batch fan-out (literature_review) + human-input
    resume (doc_qa_human) all fire. The LLM substrate is mocked at the executor
    boundary; split_topic runs for real (pure Python).
    """
    from types import SimpleNamespace

    from app.services import harness_engine
    from app.services.harness import phase_types

    # Re-assert the real executors in the dispatch registry. Other harness test
    # files (test_harness_engine.py) swap-and-pop entries in a finally, which can
    # leave the registry without the real llm_single executor depending on run
    # order; register_all() is idempotent and restores the canonical 5.
    phase_types.register_all()

    wf = four_seed_defs()[seed_index]
    assert wf.slug == slug
    run_id = _uuid.uuid4()
    rows = _seed_phase_rows(wf)
    mock_asyncpg_pool.set_fetch_result(rows)
    # claim_run / fetchrow paths are unused on the fresh-run path; keep them None.

    # ── mock the LLM substrate at the executor boundary ──────────────────────
    async def _fake_stream(*, messages, tools, model, user_settings):
        # llm_single (incl. the verify phase) — return content that PASSES the
        # plan_execute_verify regex gate (it searches for "VERIFIED").
        return ("Synthesized answer. VERIFIED.", [])

    async def _fake_sub_agent(*, parent_ctx, description, instructions,
                              allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
        return {
            "sub_run_id": _uuid.uuid4(),
            "summary": "sub-agent findings",
            "status": "completed",
        }

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        # human-input resume: canned answer immediately (no real pub/sub block).
        return {"kind": "response", "response_text": "Looks good", "choice_index": 0}

    ctx = SimpleNamespace(
        run_id=run_id,
        # Facet A (092-07): producer runs.run_id is the sub-agent parent_run_id FK
        # target; _build_phase_tool_context sources it fail-closed.
        producer_run_id=_uuid.uuid4(),
        thread_id=str(_uuid.uuid4()),
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        redis=fake_redis,
        pool=mock_asyncpg_pool,
        supabase=None,
        user_settings=None,
        emit=harness_engine._emit,
        model="gpt-4o",
        retry_feedback=None,
        inputs={"topic": "transformers in NLP; diffusion models"},
    )

    with patch.object(phase_types, "_stream_one_iteration", _fake_stream), \
            patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent), \
            patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis
        )

    calls = mock_asyncpg_pool.calls

    # ── every phase reached active->completed in phase_index ORDER ────────────
    def _first_index(sql_frag, phase_id):
        for i, (sql, args) in enumerate(calls):
            if sql_frag in sql and phase_id in args:
                return i
        return -1

    for p_row in rows:
        pid = p_row["id"]
        active_i = _first_index("status='active'", pid)
        completed_i = _first_index("status='completed'", pid)
        assert active_i >= 0, f"{p_row['slug']}: no active UPDATE"
        assert completed_i >= 0, f"{p_row['slug']}: no completed UPDATE"
        # 2-phase write: active BEFORE completed for THIS phase.
        assert active_i < completed_i, (
            f"{p_row['slug']}: completed before active (2-phase write violated)"
        )

    # phase_index ordering: each phase's `active` UPDATE precedes the NEXT phase's.
    active_indices = [_first_index("status='active'", r["id"]) for r in rows]
    assert active_indices == sorted(active_indices), (
        f"{slug}: phases did not run in phase_index order"
    )

    # ── completion: final phase output IS the chat message (D-10) ─────────────
    assert ctx.final_output is not None
    assert "text" in ctx.final_output

    # ── run_completed SSE event emitted ───────────────────────────────────────
    emitted_types = []
    for stream, fields in fake_redis.xadds:
        try:
            emitted_types.append(json.loads(fields["data"])["type"])
        except (KeyError, ValueError):
            pass
    assert "run_completed" in emitted_types
    # phase lifecycle events present for the phases.
    assert "phase_started" in emitted_types
    assert "phase_completed" in emitted_types

    # ── per-seed branch assertions ────────────────────────────────────────────
    if slug == "plan_execute_verify":
        # the gate ran (validators present on the verify phase → gate_passed audit).
        assert any(
            "INSERT INTO harness_audit" in sql and "gate_passed" in args
            for sql, args in calls
        ), "plan_execute_verify: gate_passed audit missing"
    if slug == "doc_qa_human":
        # the ask_user phase blocked-then-resumed with the canned answer, which fed
        # the finalize phase (the confirm phase's output carries the answer).
        confirm_id = next(r["id"] for r in rows if r["slug"] == "confirm")
        confirm_output = None
        for sql, args in calls:
            if "status='completed'" in sql and confirm_id in args:
                confirm_output = json.loads(args[1])
                break
        assert confirm_output is not None, "doc_qa_human: confirm phase not completed"
        assert confirm_output.get("answer") == "Looks good", (
            "doc_qa_human: human-input answer did not flow into the phase output"
        )

    if slug == "literature_review":
        # split_topic fanned the batch out — the `review` (llm_batch_agents) phase
        # stored a concat_numbered merge of N sub-agents. The topic
        # "transformers in NLP; diffusion models" splits into 2 sub-questions, so
        # the persisted review output carries '## Result 2'. (The FINAL phase is the
        # merge llm_single, whose mocked text is generic — assert on the batch
        # phase's persisted output, not ctx.final_output.)
        review_id = next(r["id"] for r in rows if r["slug"] == "review")
        review_output = None
        for sql, args in calls:
            if "status='completed'" in sql and review_id in args:
                # complete_phase: args = (phase_id, json.dumps(output))
                review_output = json.loads(args[1])
                break
        assert review_output is not None, "literature_review: review phase not completed"
        assert "## Result 2" in review_output["text"], (
            "literature_review: batch did not fan out over the split sub-questions"
        )


@pytest.mark.asyncio
async def test_retry_feedback_producer_consumer_round_trip(
    four_seed_defs, fake_redis, mock_asyncpg_pool
):
    """07-T2: the gate-retry PRODUCER (engine) ↔ CONSUMER (llm executor) round-trip.

    Runs the real plan_execute_verify seed (whose verify phase carries a regex_match
    'VERIFIED' gate, on_failure=retry, max_retries=2). The mocked llm_single returns a
    FAILING output ('...') on the first verify attempt and a PASSING output
    ('...VERIFIED') only once it SEES the retry feedback the engine produced — proving
    the Plan-05 producer (sets ctx.retry_feedback) drives the Plan-03 consumer (appends
    it to the prompt) within ≤ 3 attempts (SC#3 — never loops).
    """
    from types import SimpleNamespace

    from app.services import harness_engine
    from app.services.harness import phase_types

    phase_types.register_all()  # order-independent: restore the canonical 5 executors

    wf = four_seed_defs()[1]
    assert wf.slug == "plan_execute_verify"
    run_id = _uuid.uuid4()
    rows = _seed_phase_rows(wf)
    mock_asyncpg_pool.set_fetch_result(rows)

    verify_attempts = {"n": 0, "saw_feedback": []}

    async def _fake_stream(*, messages, tools, model, user_settings):
        sys_prompt = messages[0]["content"]
        # The verify phase is the only llm_single whose prompt mentions VERIFIED.
        if "VERIFIED" in sys_prompt and "Verify" in sys_prompt:
            verify_attempts["n"] += 1
            saw = "failed validation" in sys_prompt  # the engine's retry feedback
            verify_attempts["saw_feedback"].append(saw)
            if saw:
                return ("Re-checked. VERIFIED.", [])  # passes once feedback seen
            return ("Result looks incomplete.", [])    # fails the gate first time
        return ("plan/exec output", [])

    async def _fake_sub_agent(*, parent_ctx, description, instructions,
                              allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
        return {"sub_run_id": _uuid.uuid4(), "summary": "executed", "status": "completed"}

    ctx = SimpleNamespace(
        run_id=run_id,
        # Facet A (092-07): producer runs.run_id is the sub-agent parent_run_id FK
        # target; _build_phase_tool_context sources it fail-closed.
        producer_run_id=_uuid.uuid4(),
        thread_id=str(_uuid.uuid4()),
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        redis=fake_redis, pool=mock_asyncpg_pool, supabase=None, user_settings=None,
        emit=harness_engine._emit, model="gpt-4o", retry_feedback=None, inputs={},
    )

    with patch.object(phase_types, "_stream_one_iteration", _fake_stream), \
            patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis
        )

    # The verify phase ran twice (fail → retry-with-feedback → pass), NEVER looped.
    assert verify_attempts["n"] == 2, f"expected 2 verify attempts, got {verify_attempts['n']}"
    # First attempt had no feedback; second attempt SAW the producer's feedback.
    assert verify_attempts["saw_feedback"] == [False, True]
    # A gate_failed was audited (the first failing attempt) then gate_passed.
    calls = mock_asyncpg_pool.calls
    assert any("INSERT INTO harness_audit" in s and "gate_failed" in a for s, a in calls)
    assert any("INSERT INTO harness_audit" in s and "gate_passed" in a for s, a in calls)
    # The run completed (the retry succeeded — no fail_run).
    assert ctx.final_output["text"] == "Re-checked. VERIFIED."
