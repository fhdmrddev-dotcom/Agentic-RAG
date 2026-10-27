"""Phase 293 (D-22 / D-23 / START-04) — a run's origin is written ONCE, at start, by its one writer.

``create_workflow_run`` is the only live-app path that inserts a ``workflow_runs`` row, so it is
the only place the origin is stamped. Three start paths reach it with an origin (app kickoff,
the scheduler and Run now (A6), an API key) and one deliberately reaches it without one (the
publish golden run: a validation run, not a start; D-23 says no line). Every existing caller
that passes nothing stays byte-identical: the three columns bind NULL.
"""
from __future__ import annotations

import ast
import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

REPO = Path(__file__).resolve().parents[2]


class _Con:
    def __init__(self):
        self.fetchval_calls: list[tuple] = []
        self.execute = AsyncMock()

    async def fetchval(self, sql, *args):
        self.fetchval_calls.append((sql, args))
        return uuid4()

    def transaction(self):
        return _Ctx(None)


class _Ctx:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, *_exc):
        return False


class _Pool:
    def __init__(self):
        self.con = _Con()

    def acquire(self):
        return _Ctx(self.con)


def _definition():
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(
        {"name": "Weekly digest", "slug": "weekly-digest", "version": 1, "phases": []}
    )


async def _create(pool, **origin):
    from app.db.workflows import create_workflow_run

    return await create_workflow_run(
        pool,
        thread_id=uuid4(),
        definition_id=uuid4(),
        definition=_definition(),
        inputs={},
        model=None,
        user_id=uuid4(),
        **origin,
    )


def _bound(pool) -> tuple[str, dict]:
    sql, args = pool.con.fetchval_calls[0]
    cols_text = sql.split("(", 1)[1].split(")", 1)[0]
    cols = [c.strip() for c in cols_text.split(",")]
    # The VALUES list is $-placeholders plus the literal 'active'; map each column to its bind.
    values_text = sql.split("VALUES", 1)[1].split("(", 1)[1].split(")", 1)[0]
    values = [v.strip() for v in values_text.split(",")]
    by_col = {}
    for col, val in zip(cols, values):
        if val.startswith("$"):
            idx = int(val[1:].split("::")[0]) - 1
            by_col[col] = args[idx]
    return sql, by_col


@pytest.mark.asyncio
async def test_no_origin_kwargs_bind_null_for_all_three_columns():
    pool = _Pool()
    await _create(pool)
    sql, by_col = _bound(pool)
    for col in ("origin_kind", "origin_label", "origin_ref"):
        assert col in by_col, f"{col} is not in the INSERT"
        assert by_col[col] is None, (col, by_col[col])


@pytest.mark.asyncio
async def test_a_key_origin_binds_all_three():
    pool = _Pool()
    key_id = uuid4()
    await _create(pool, origin_kind="key", origin_label="n8n-prod", origin_ref=key_id)
    _sql, by_col = _bound(pool)
    assert by_col["origin_kind"] == "key"
    assert by_col["origin_label"] == "n8n-prod"
    assert by_col["origin_ref"] == key_id


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["manual", "", "App", "system"])
async def test_an_unknown_origin_kind_is_refused_before_any_write(kind):
    pool = _Pool()
    with pytest.raises(ValueError):
        await _create(pool, origin_kind=kind)
    assert pool.con.fetchval_calls == []


def _calls_named(tree, name):
    out = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Call):
            f = n.func
            fname = f.id if isinstance(f, ast.Name) else getattr(f, "attr", None)
            if fname == name:
                out.append(n)
    return out


def _kw(call, name):
    for k in call.keywords:
        if k.arg == name:
            return k.value
    return None


def _tree(rel):
    return ast.parse(io.open(REPO / rel, encoding="utf-8").read())


def test_the_app_kickoff_stamps_app():
    calls = _calls_named(_tree("app/api/threads.py"), "create_workflow_run")
    assert len(calls) == 1, len(calls)
    kind = _kw(calls[0], "origin_kind")
    assert isinstance(kind, ast.Constant) and kind.value == "app"
    # D-22: "Started in the app" has no label and no ref.
    assert _kw(calls[0], "origin_label") is None and _kw(calls[0], "origin_ref") is None


def test_the_publish_golden_run_carries_no_origin():
    calls = _calls_named(_tree("app/services/harness/publish_service.py"), "create_workflow_run")
    assert calls, "the golden-run call moved; re-derive this fence"
    for call in calls:
        for name in ("origin_kind", "origin_label", "origin_ref"):
            assert _kw(call, name) is None, f"golden run passes {name} (D-23: it is not a start)"


@pytest.mark.asyncio
async def test_the_core_passes_the_origin_straight_to_the_writer():
    from app.services import unattended_launch

    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]
    ref = uuid4()
    with (
        patch("app.dependencies.get_service_role_supabase", return_value=supabase),
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())) as create,
        patch("app.db.workflows.arm_run_budget", AsyncMock()),
        patch.object(unattended_launch, "_drive_run", AsyncMock()),
    ):
        await unattended_launch.launch_unattended_run(
            owner_id=uuid4(),
            org_id=uuid4(),
            workflow_id=uuid4(),
            definition=MagicMock(),
            inputs={},
            title="t",
            max_tokens=500_000,
            max_duration=1_800,
            pool=MagicMock(),
            redis=MagicMock(),
            origin_kind="key",
            origin_label="n8n-prod",
            origin_ref=ref,
        )
    kw = create.call_args.kwargs
    assert (kw["origin_kind"], kw["origin_label"], kw["origin_ref"]) == ("key", "n8n-prod", ref)


@pytest.mark.asyncio
async def test_a_scheduled_launch_stamps_the_schedule_name_and_id():
    """A6: the tick and Run now share ``launch_scheduled_run``, so both read as schedule origin."""
    from app.services.entitlement_service import EntitlementResult
    from app.services.scheduler_service import launch_scheduled_run

    schedule_id = uuid4()
    schedule = {
        "id": schedule_id,
        "user_id": str(uuid4()),
        "workflow_id": str(uuid4()),
        "org_id": str(uuid4()),
        "name": "Monday digest",
        "inputs": {},
        "max_tokens_per_run": 500_000,
        "max_duration_seconds": 1_800,
    }
    row = {"definition": {"name": "W", "slug": "w", "version": 1, "phases": []}}
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch(
            "app.services.entitlement_service.check_entitlement",
            AsyncMock(return_value=EntitlementResult(allowed=True, capability="workflows")),
        ),
        patch("app.services.unattended_launch.launch_unattended_run", AsyncMock(return_value=uuid4())) as core,
    ):
        await launch_scheduled_run(schedule, pool=MagicMock(), redis=MagicMock())
    kw = core.call_args.kwargs
    assert kw["origin_kind"] == "schedule"
    assert kw["origin_label"] == "Monday digest"
    assert str(kw["origin_ref"]) == str(schedule_id)
