"""Phase 300-01 Task 1 (FIX-04 / D-14, BUG-261027-04) — a blank required input is refused by
LABEL at both schedule doors (create, and patch-inputs / resume) and at fire time.

One predicate, never a second one: ``missing_required_labels`` walks the same declared fields
``missing_required`` walks (the browser twin pinned by ``launch_fields_cases.json``), and the
sentence is built in one home (``blank_required_sentence``). Every case asserts the WORDS the
author reads, never only a code.

Stubbed throughout: the pool, the definition read and the schedule writers are fakes, so this
file never touches Postgres.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "launch_fields_cases.json")
    .read_text(encoding="utf-8")
)
MISSING_CASES = [c for c in FIXTURE["cases"] if "expected_missing" in c]

ONE_NEW = "Client name is required and has no value."
ONE_SAVED = (
    "Client name is required and has no value. "
    "Add a new schedule with it filled in, then delete this one."
)
TWO_SAVED = (
    "Client name and Due date are required and have no value. "
    "Add a new schedule with them filled in, then delete this one."
)

# A stored definition as the pool returns it: a JSON STRING scalar (293-05), declaring one
# required labelled input, one required unlabelled input and one optional input.
DEFINITION = {
    "slug": "brief",
    "version": 1,
    "name": "Client brief",
    "status": "published",
    "phases": [
        {"slug": "a", "phase_index": 0, "name": "A",
         "config": {"phase_type": "llm_single", "prompt": "Go."}, "validators": []}
    ],
    "inputs": [
        {"key": "client_name", "label": "Client name", "type": "text"},
        {"key": "due_date", "label": "Due date", "type": "text"},
        {"key": "notes", "label": "Notes", "type": "text", "required": False},
    ],
}
DEFINITION_JSON = json.dumps(DEFINITION)


def _ii():
    from app.services import inbound_inputs

    return inbound_inputs


# ── the pure helpers ────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("case", MISSING_CASES, ids=[c["name"] for c in MISSING_CASES])
def test_labels_cover_exactly_the_keys_the_one_predicate_finds(case):
    ii = _ii()
    keys = ii.missing_required(case["definition"], case["inputs"])
    labels = ii.missing_required_labels(case["definition"], case["inputs"])
    label_of = {f.key: f.label for f in ii.declared_fields(case["definition"])}
    assert keys == case["expected_missing"]
    assert labels == [label_of[k] for k in keys]
    assert (labels == []) == (keys == [])


def test_labels_name_the_label_and_fall_back_to_the_key():
    ii = _ii()
    definition = {"inputs": [
        {"key": "client_name", "label": "Client name"},
        {"key": "region", "label": "  "},
        {"key": "notes", "label": "Notes", "required": False},
    ]}
    assert ii.missing_required_labels(definition, {}) == ["Client name", "region"]
    assert ii.missing_required_labels(definition, {"client_name": "Acme", "region": "EU"}) == []


def test_labels_read_a_stored_json_string_definition():
    ii = _ii()
    assert ii.missing_required_labels(DEFINITION_JSON, {"client_name": " "}) == [
        "Client name", "Due date"]


@pytest.mark.parametrize(
    "labels,joined",
    [(["A"], "A"), (["A", "B"], "A and B"), (["A", "B", "C"], "A, B and C")],
)
def test_join_labels(labels, joined):
    assert _ii().join_labels(labels) == joined


def test_the_sentences_are_exactly_the_ui_spec_words():
    ii = _ii()
    assert ii.blank_required_sentence(["Client name"], saved_schedule=False) == ONE_NEW
    assert ii.blank_required_sentence(["Client name"], saved_schedule=True) == ONE_SAVED
    assert ii.blank_required_sentence(["Client name", "Due date"], saved_schedule=True) == TWO_SAVED
    assert ii.blank_required_sentence(["Client name", "Due date"], saved_schedule=False) == (
        "Client name and Due date are required and have no value.")
    assert ii.MISSING_REQUIRED_CODE == "missing_required"


def test_no_sentence_leaks_a_code_or_a_labelled_key():
    ii = _ii()
    labels = ii.missing_required_labels(DEFINITION, {})
    for saved in (False, True):
        sentence = ii.blank_required_sentence(labels, saved_schedule=saved)
        for bad in ("422", "missing_required", "invalid", "client_name", "due_date"):
            assert bad not in sentence


# ── the create door ─────────────────────────────────────────────────────────────────────────


def _create(inputs, *, status_="published"):
    from app.api import schedules
    from app.models.schedule import WorkflowScheduleCreate

    create = AsyncMock(side_effect=AssertionError("create_schedule must not be called"))
    body = WorkflowScheduleCreate(name="nightly", cron_expression="0 3 * * *", inputs=inputs)
    with patch.object(schedules, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(schedules, "get_definition", AsyncMock(return_value={
             "id": uuid4(), "status": status_, "definition": DEFINITION_JSON})), \
         patch.object(schedules, "create_schedule", create):
        with pytest.raises(HTTPException) as ei:
            asyncio.run(schedules.create_workflow_schedule(
                uuid4(), body, current_user={"id": str(uuid4())}))
    create.assert_not_called()
    return ei.value


def test_create_with_a_blank_required_input_is_a_worded_422_and_nothing_is_written():
    exc = _create({"client_name": "Acme", "due_date": "   "})
    assert exc.status_code == 422
    assert exc.detail == {
        "code": "missing_required",
        "message": "Due date is required and has no value.",
        "missing": ["Due date"],
    }


def test_create_names_every_blank_input_by_label():
    exc = _create({})
    assert exc.status_code == 422
    assert exc.detail["message"] == "Client name and Due date are required and have no value."
    assert exc.detail["missing"] == ["Client name", "Due date"]


def test_create_with_every_required_input_filled_reaches_the_insert():
    from app.api import schedules
    from app.models.schedule import WorkflowScheduleCreate

    sentinel = object()
    create = AsyncMock(return_value={"x": 1})
    body = WorkflowScheduleCreate(
        name="nightly", cron_expression="0 3 * * *",
        inputs={"client_name": "Acme", "due_date": "Friday"})
    with patch.object(schedules, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(schedules, "get_definition", AsyncMock(return_value={
             "id": uuid4(), "status": "published", "definition": DEFINITION_JSON})), \
         patch.object(schedules, "create_schedule", create), \
         patch.object(schedules.link_resolver, "workflow_org", AsyncMock(return_value=None)), \
         patch.object(schedules.org_lists, "active_org_uuid", AsyncMock(return_value=None)), \
         patch.object(schedules, "_serialize", lambda row: sentinel):
        out = asyncio.run(schedules.create_workflow_schedule(
            uuid4(), body, current_user={"id": str(uuid4())}))
    assert out is sentinel
    create.assert_awaited_once()


# ── the patch door (edit inputs, resume; a pause is never refused) ──────────────────────────


def _patch(fields: dict, *, stored_inputs=None, owned=True, definition=DEFINITION_JSON):
    from app.api import schedules
    from app.models.schedule import WorkflowScheduleUpdate

    stored = {"id": uuid4(), "workflow_id": uuid4(), "inputs": stored_inputs or {},
              "is_active": False}
    update = AsyncMock(return_value={"updated": True})
    get_def = AsyncMock(return_value=None if definition is None else {
        "id": uuid4(), "status": "published", "definition": definition})
    body = WorkflowScheduleUpdate(**fields)
    with patch.object(schedules, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(schedules, "get_schedule", AsyncMock(return_value=stored if owned else None)), \
         patch.object(schedules, "get_definition", get_def), \
         patch.object(schedules, "update_schedule", update if owned else AsyncMock(return_value=None)), \
         patch.object(schedules, "_serialize", lambda row: row):
        try:
            out = asyncio.run(schedules.patch_schedule(
                uuid4(), body, current_user={"id": str(uuid4())}))
            return out, None, update, get_def
        except HTTPException as exc:
            return None, exc, update, get_def


def test_editing_inputs_to_blank_is_the_saved_schedule_422_and_nothing_is_written():
    _, exc, update, _ = _patch({"inputs": {"client_name": "", "due_date": "Friday"}})
    assert exc is not None and exc.status_code == 422
    assert exc.detail == {"code": "missing_required", "message": ONE_SAVED,
                          "missing": ["Client name"]}
    update.assert_not_called()


def test_resuming_a_schedule_whose_stored_inputs_are_blank_is_refused():
    _, exc, update, _ = _patch({"is_active": True}, stored_inputs={})
    assert exc is not None and exc.status_code == 422
    assert exc.detail["message"] == TWO_SAVED
    assert exc.detail["missing"] == ["Client name", "Due date"]
    update.assert_not_called()


def test_resuming_a_complete_schedule_is_written():
    out, exc, update, _ = _patch(
        {"is_active": True}, stored_inputs={"client_name": "Acme", "due_date": "Fri"})
    assert exc is None and out == {"updated": True}
    update.assert_awaited_once()


def test_a_pause_is_never_refused_and_reads_nothing_new():
    out, exc, update, get_def = _patch({"is_active": False}, stored_inputs={})
    assert exc is None and out == {"updated": True}
    update.assert_awaited_once()
    get_def.assert_not_called()


def test_a_foreign_schedule_is_the_existing_404_with_no_check():
    out, exc, _, get_def = _patch({"is_active": True}, owned=False)
    assert exc is not None and exc.status_code == 404
    assert exc.detail == "schedule not found"
    get_def.assert_not_called()


def test_an_unreadable_definition_skips_the_check():
    out, exc, update, _ = _patch({"is_active": True}, stored_inputs={}, definition=None)
    assert exc is None
    update.assert_awaited_once()


# ── fire time ───────────────────────────────────────────────────────────────────────────────


def _schedule(inputs):
    return {"id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()),
            "org_id": str(uuid4()), "name": "Weekly", "inputs": inputs}


async def _fire(schedule):
    from app.services import scheduler_service

    launch = AsyncMock(return_value=uuid4())
    with (
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": DEFINITION_JSON, "org_id": None}),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
        patch("app.services.unattended_launch.launch_unattended_run", launch),
        patch("app.services.unattended_launch.workflows_disabled", return_value=False),
        patch("app.services.foreign_folder_refusal.foreign_binding_refusal",
              new_callable=AsyncMock, return_value=None),
    ):
        try:
            await scheduler_service.launch_scheduled_run(schedule, pool=MagicMock(), redis=MagicMock())
            return record, launch, None
        except scheduler_service.ScheduledLaunchRefused as refused:
            return record, launch, refused


@pytest.mark.asyncio
async def test_fire_time_refuses_a_blank_required_input_and_launches_nothing(caplog):
    schedule = _schedule({"client_name": "Acme"})
    with caplog.at_level(logging.WARNING, logger="app.services.scheduler_service"):
        record, launch, refused = await _fire(schedule)
    expected = (
        "Due date is required and has no value. "
        "Add a new schedule with it filled in, then delete this one."
    )
    assert refused is not None and str(refused) == expected
    record.assert_awaited_once()
    assert record.await_args.kwargs["status"] == expected
    launch.assert_not_called()
    lines = [r.getMessage() for r in caplog.records]
    assert any(str(schedule["id"]) in m and "1" in m for m in lines), lines
    assert not any("Acme" in m for m in lines), "an input value reached the log"


@pytest.mark.asyncio
async def test_fire_time_launches_when_every_required_input_has_a_value():
    from app.services.entitlement_service import EntitlementResult

    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
               return_value=allowed):
        record, launch, refused = await _fire(_schedule({"client_name": "Acme", "due_date": "Fri"}))
    assert refused is None
    record.assert_not_called()
    launch.assert_awaited_once()


@pytest.mark.asyncio
async def test_the_tick_keeps_the_blank_input_sentence():
    from app.services import scheduler_service

    schedule = _schedule({})
    svc = scheduler_service.SchedulerService(pool=MagicMock(), redis=MagicMock())
    launch = AsyncMock(return_value=uuid4())
    with (
        patch("app.db.schedules.claim_due_schedules", new_callable=AsyncMock, return_value=[schedule]),
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": DEFINITION_JSON, "org_id": None}),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
        patch("app.services.unattended_launch.launch_unattended_run", launch),
        patch("app.services.unattended_launch.workflows_disabled", return_value=False),
        patch("app.services.foreign_folder_refusal.foreign_binding_refusal",
              new_callable=AsyncMock, return_value=None),
    ):
        launched = await svc.tick()
    assert launched == 0
    launch.assert_not_called()
    assert [c.kwargs.get("status") for c in record.await_args_list] == [TWO_SAVED]
