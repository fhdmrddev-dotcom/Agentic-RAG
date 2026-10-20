"""Phase 295 (RUN-02 / D-12, D-13, D-45): a report step with no template is named at save,
refused at publish, and refused at run start unless a template is staged.

One sentence, one home (``emit_cause.no_template_bound_sentence``). Every surface below is
asserted on the CONTENT of that sentence, never on the presence of a code: the code exists so
``/validate`` can classify it, and the words are what the author reads.

Stubbed throughout: no row is created by this file. The Branch-2 SQL predicate is asserted
on its text (it is shared with ``resolve_template_source`` through one constant); whether
Postgres evaluates it the way the text says was driven separately against the local DB and
is recorded in ``295-02-SUMMARY.md``.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

STEP_NAME = "Fill the status report"
EXPECTED = (
    "“Fill the status report” fills a template, but no template is attached to this "
    "workflow. Attach a template before you publish or run it."
)

_TEMPLATE_ASSET = {
    "asset_id": "u/_library/report.docx",
    "filename": "report.docx",
    "kind": "template",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _definition_dict(*, assets=None, emitter="render_template", name=STEP_NAME, with_emit=True):
    phases = [
        {
            "slug": "gather",
            "phase_index": 0,
            "name": "Gather the facts",
            "config": {"phase_type": "llm_single", "prompt": "Gather."},
            "validators": [],
        }
    ]
    if with_emit:
        emit = {
            "slug": "fill-report",
            "phase_index": 1,
            "config": {"phase_type": "llm_emit", "prompt": "Fill it.", "emitter": emitter},
            "validators": [],
        }
        if name is not None:
            emit["name"] = name
        phases.append(emit)
    return {
        "slug": "report-wf",
        "version": 1,
        "name": "Report workflow",
        "status": "draft",
        "phases": phases,
        "business_requirement": "Produce the weekly status report.",
        "assets": assets,
    }


def _definition(**kw):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(_definition_dict(**kw))


# ── the sentence (one home) ──────────────────────────────────────────────────────────────


def test_the_sentence_reads_exactly_the_ui_spec_words_and_names_no_code():
    from app.services.harness import emit_cause

    sentence = emit_cause.no_template_bound_sentence(STEP_NAME)
    assert sentence == EXPECTED
    lowered = sentence.lower()
    assert "citation" not in lowered
    assert "citations_required" not in lowered
    assert "no_template_bound" not in sentence
    assert "field_map" not in sentence


def test_the_run_time_bullet_body_is_unchanged():
    """The run-time cause bullet keeps its own lowercase body (281); only a new composer
    is added for the pre-run refusal."""
    from app.services.harness import emit_cause

    assert emit_cause._NO_TEMPLATE_SENTENCE == "no template is attached to this step{detail}."


# ── lint ─────────────────────────────────────────────────────────────────────────────────


def test_lint_names_a_template_less_fill_step_once_with_the_sentence():
    from app.services.harness.reachability import lint_workflow

    errors = [e for e in lint_workflow(_definition()) if e.code == "no_template_bound"]
    assert len(errors) == 1
    assert errors[0].phase_slug == "fill-report"
    assert errors[0].message == EXPECTED


def test_lint_falls_back_to_the_slug_when_the_step_has_no_name():
    from app.services.harness import emit_cause
    from app.services.harness.reachability import lint_workflow

    errors = [e for e in lint_workflow(_definition(name=None)) if e.code == "no_template_bound"]
    assert [e.message for e in errors] == [emit_cause.no_template_bound_sentence("fill-report")]


def test_an_attached_template_clears_the_finding():
    from app.services.harness.reachability import lint_workflow

    codes = {e.code for e in lint_workflow(_definition(assets=[_TEMPLATE_ASSET]))}
    assert "no_template_bound" not in codes


def test_a_reference_asset_is_not_a_template():
    from app.services.harness.reachability import lint_workflow

    ref = dict(_TEMPLATE_ASSET, kind="reference")
    codes = [e.code for e in lint_workflow(_definition(assets=[ref]))]
    assert codes.count("no_template_bound") == 1


def test_a_non_template_emitter_and_a_workflow_without_an_emit_step_are_not_named():
    from app.services.harness.reachability import lint_workflow

    assert "no_template_bound" not in {
        e.code for e in lint_workflow(_definition(emitter="some_other_emitter"))
    }
    assert "no_template_bound" not in {e.code for e in lint_workflow(_definition(with_emit=False))}


def test_the_code_is_a_published_lint_code():
    from app.services.harness import reachability

    assert "no_template_bound" in reachability.LINT_CODES


# ── /validate severity (D-45: incomplete, never a rejected save) ────────────────────────


def test_validate_classifies_it_incomplete_without_the_loud_branch(caplog):
    from app.api import workflows

    with caplog.at_level(logging.WARNING, logger="app.api.workflows"):
        assert workflows._severity("no_template_bound", phases_empty=False) == "incomplete"
    assert not [r for r in caplog.records if "unrecognised verdict code" in r.getMessage()]
    # Lint-minted, like input_unsatisfied: the route never mints it.
    assert "no_template_bound" not in workflows._ROUTE_ASSIGNED_CODES
    assert "no_template_bound" in workflows._INCOMPLETE_CODES


# ── publish (stage 2 already calls lint_workflow; zero edits to publish_service) ─────────


@pytest.mark.asyncio
async def test_publish_refuses_at_lint_with_the_sentence_and_never_runs_the_golden_run():
    from app.services.harness import publish_service

    user_id = str(uuid4())
    row = {
        "id": uuid4(),
        "slug": "report-wf",
        "version": 1,
        "name": "Report workflow",
        "status": "draft",
        "definition": _definition_dict(),
        "created_by": UUID(user_id),
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await publish_service.publish(
            definition_id=row["id"],
            golden_input="a representative kickoff prompt",
            user={"id": user_id},
            pool=AsyncMock(),
            redis=AsyncMock(),
        )

    assert result["published"] is False
    assert result["blocked_stage"] == "lint"
    messages = [f.get("message") for f in result["named_failures"] if isinstance(f, dict)]
    assert EXPECTED in messages
    assert not any("citation" in (m or "").lower() for m in messages)
    drive.assert_not_called()
    flip.assert_not_called()


# ── run start: chat kickoff (D-13 / D-45) ────────────────────────────────────────────────


class _FakePool:
    def __init__(self, staged):
        self.staged = staged
        self.calls: list[tuple[str, tuple]] = []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return 1 if self.staged else None


def _def_row(definition_dict, *, status="published", user_id):
    return {
        "id": str(uuid4()),
        "definition": definition_dict,
        "status": status,
        "is_system_global": False,
        "created_by": user_id,
        "skill_snapshots": None,
    }


async def _kickoff(definition_dict, *, pool):
    from app.services import workflow_kickoff
    from app.services.entitlement_service import EntitlementResult

    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    body = SimpleNamespace(workflow_definition_id=uuid4())
    row = _def_row(definition_dict, user_id=user["id"])
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=pool),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch.object(workflow_kickoff, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))),
        patch.object(workflow_kickoff, "assert_folder_scopes_subset", AsyncMock()) as scope,
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough) as snap,
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()) as pin,
    ):
        out = await workflow_kickoff.preflight_workflow_kickoff(
            request=MagicMock(), body=body, thread_id=str(uuid4()),
            thread_row={"active_workflow_run_id": None}, supabase=MagicMock(),
            current_user=user,
        )
    return out, SimpleNamespace(scope=scope, snap=snap, pin=pin)


@pytest.mark.asyncio
async def test_kickoff_refuses_a_template_less_fill_step_with_nothing_staged():
    pool = _FakePool(staged=False)
    with pytest.raises(HTTPException) as ei:
        await _kickoff(_definition_dict(), pool=pool)
    assert ei.value.status_code == 400
    assert ei.value.detail == EXPECTED
    assert len(pool.calls) == 1  # exactly the staged-template probe


@pytest.mark.asyncio
async def test_kickoff_refuses_before_any_snapshot_or_pin_write():
    from app.services import workflow_kickoff  # noqa: F401

    pool = _FakePool(staged=False)
    with patch("app.services.template_service.pin_templates_for_run", AsyncMock()) as pin:
        with pytest.raises(HTTPException):
            await _kickoff(_definition_dict(), pool=pool)
    pin.assert_not_called()


@pytest.mark.asyncio
async def test_kickoff_admits_the_launch_upload_shape_when_a_template_is_staged():
    pool = _FakePool(staged=True)
    (definition, definition_id), mocks = await _kickoff(_definition_dict(), pool=pool)
    assert definition is not None and definition_id is not None
    mocks.pin.assert_awaited_once()


@pytest.mark.asyncio
async def test_kickoff_with_a_definition_template_never_probes_for_a_staged_one():
    pool = _FakePool(staged=False)
    (definition, _), _ = await _kickoff(_definition_dict(assets=[_TEMPLATE_ASSET]), pool=pool)
    assert definition is not None
    assert pool.calls == []  # no extra DB call for a workflow that is not template-less


@pytest.mark.asyncio
async def test_the_staged_probe_shares_branch_two_and_never_admits_a_thread_life_attachment():
    """T-295-02-03. The probe reads the SAME WHERE clause Branch 2 of resolve_template_source
    reads (one module constant), and binds a claim that is neither NULL nor 'deep', so the
    thread-life gate ``(expires_at IS NOT NULL OR $3 IS NULL OR $3 = 'deep')`` excludes a chat
    attachment whose ``expires_at`` is NULL. Only a kind='template_input' row can match."""
    from app.services import template_asset_service as tas

    pool = _FakePool(staged=False)
    thread_id, user_id = str(uuid4()), str(uuid4())
    assert await tas.has_staged_template(pool, thread_id=thread_id, user_id=user_id) is False
    (sql, args), = pool.calls
    assert tas._STAGED_TEMPLATE_WHERE in sql
    assert "kind = 'template_input'" in tas._STAGED_TEMPLATE_WHERE
    assert "(expires_at IS NOT NULL OR $3::text IS NULL OR $3::text = 'deep')" in tas._STAGED_TEMPLATE_WHERE
    assert "(run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)" in tas._STAGED_TEMPLATE_WHERE
    assert args[0] == thread_id and args[1] == user_id
    assert args[2] is not None and args[2] != tas.DEEP_CLAIM

    pool_yes = _FakePool(staged=True)
    assert await tas.has_staged_template(pool_yes, thread_id=thread_id, user_id=user_id) is True


@pytest.mark.asyncio
async def test_branch_two_reads_the_same_constant(mock_asyncpg_pool):
    from app.services import template_asset_service as tas

    await tas.resolve_template_source(
        pool=mock_asyncpg_pool, supabase=MagicMock(), thread_id=str(uuid4()),
        user_id=str(uuid4()), asset_ref=None, own_claim=str(uuid4()),
    )
    selects = [sql for sql, _ in mock_asyncpg_pool.calls if "kind = 'template_input'" in sql]
    assert selects, "Branch 2 issued no template_input SELECT"
    assert tas._STAGED_TEMPLATE_WHERE in selects[0]


# ── run start: scheduled launch (D-13: the definition asset alone) ──────────────────────


def _schedule():
    return {"id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()),
            "org_id": str(uuid4()), "name": "Weekly", "inputs": {}}


@pytest.mark.asyncio
async def test_a_scheduled_launch_is_refused_and_its_outcome_names_the_template():
    from app.services import scheduler_service

    schedule = _schedule()
    with (
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": _definition_dict(), "org_id": None}),
        patch("app.db.workflows.create_workflow_run", new_callable=AsyncMock) as create_run,
        patch("app.dependencies.get_service_role_supabase") as sr,
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
    ):
        with pytest.raises(scheduler_service.ScheduledLaunchRefused) as ei:
            await scheduler_service.launch_scheduled_run(schedule, pool=MagicMock(), redis=MagicMock())
    assert str(ei.value) == EXPECTED
    create_run.assert_not_called()
    sr.assert_not_called()  # no thread inserted
    record.assert_awaited_once()
    assert record.await_args.kwargs["status"] == EXPECTED


@pytest.mark.asyncio
async def test_the_tick_keeps_the_refusal_sentence_instead_of_overwriting_it():
    from app.services import scheduler_service

    schedule = _schedule()
    svc = scheduler_service.SchedulerService(pool=MagicMock(), redis=MagicMock())
    with (
        patch("app.db.schedules.claim_due_schedules", new_callable=AsyncMock, return_value=[schedule]),
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": _definition_dict(), "org_id": None}),
        patch("app.db.workflows.create_workflow_run", new_callable=AsyncMock) as create_run,
        patch("app.dependencies.get_service_role_supabase"),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
    ):
        launched = await svc.tick()
    assert launched == 0
    create_run.assert_not_called()
    statuses = [c.kwargs.get("status") for c in record.await_args_list]
    assert statuses == [EXPECTED]  # never overwritten with launch_failed
