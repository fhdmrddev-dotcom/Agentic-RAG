"""Phase 293 — the two named seams were TAKEN, move-only, and stay taken.

1. ``scheduler_service.py`` ("split cadence claiming from job execution"): the thread insert,
   the run row, the cap arming and the background drive moved to ``unattended_launch.py``.
   The scheduler is a thin mapper that CALLS the shared core; it no longer defines a drive.
2. ``api/workflow_runs.py`` ("move the viewer-aware wording beside run_read_wire.py"): the
   wording moved to ``harness/run_read_words.py`` and is RE-EXPORTED, so the old name and the
   new name are the same object.

Every source assertion is an AST CALL walk, never a substring, because a comment naming a
function is not a use of it (the 187-24 trap).
"""
from __future__ import annotations

import ast
import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

REPO = Path(__file__).resolve().parents[2]
SCHEDULER = REPO / "app" / "services" / "scheduler_service.py"
UNATTENDED = REPO / "app" / "services" / "unattended_launch.py"
WORDS = REPO / "app" / "services" / "harness" / "run_read_words.py"


def _tree(p: Path) -> ast.Module:
    return ast.parse(io.open(p, encoding="utf-8").read())


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _function(tree: ast.Module, name: str):
    return next(
        n
        for n in tree.body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name
    )


# (a) the scheduler no longer drives, and its launch CALLS the shared core.
def test_the_scheduler_defines_no_drive_and_calls_the_shared_core():
    tree = _tree(SCHEDULER)
    top = {
        n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    assert "_drive_run" not in top, "scheduler_service.py still defines its own _drive_run"
    launch = _function(tree, "launch_scheduled_run")
    calls = {_call_name(n) for n in ast.walk(launch) if isinstance(n, ast.Call)}
    assert "launch_unattended_run" in calls, (
        "launch_scheduled_run must CALL launch_unattended_run (share, not copy, D-09)"
    )
    # Nothing the core owns is re-done here.
    for owned in ("create_workflow_run", "arm_run_budget", "create_task"):
        assert owned not in calls, f"scheduler_service.py still calls {owned} itself"


# (b) the core arms the cap BEFORE the drive task is created.
def test_the_core_arms_the_cap_before_the_drive_task():
    launch = _function(_tree(UNATTENDED), "launch_unattended_run")
    arm = drive = None
    for node in ast.walk(launch):
        if not isinstance(node, ast.Call):
            continue
        name = _call_name(node)
        if name == "arm_run_budget" and arm is None:
            arm = node.lineno
        if name == "_drive_run" and drive is None:
            drive = node.lineno
    assert arm is not None and drive is not None
    assert arm < drive, f"arm_run_budget (line {arm}) must precede _drive_run (line {drive})"


# (c) the old import path and the new one are the SAME objects (a re-export, not a copy).
def test_the_wording_is_re_exported_not_copied():
    from app.api import workflow_runs
    from app.services.harness import run_read_words

    for name in (
        "waiting_who",
        "unsourced_who",
        "compose_waiting_on",
        "_first_line",
        "_WAITING_FALLBACK_NAME",
    ):
        assert getattr(workflow_runs, name) is getattr(run_read_words, name), name
    # The I/O-doing reader stays in the route module.
    assert hasattr(workflow_runs, "panel_unsourced_who")
    assert not hasattr(run_read_words, "panel_unsourced_who")


def test_the_route_module_no_longer_defines_the_wording():
    top = {
        n.name
        for n in _tree(REPO / "app" / "api" / "workflow_runs.py").body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    for name in ("waiting_who", "unsourced_who", "compose_waiting_on", "_first_line"):
        assert name not in top, f"api/workflow_runs.py still defines {name}"


# (d) the leaf imports nothing from the route layer.
def test_the_wording_leaf_imports_nothing_from_app_api():
    for node in ast.walk(_tree(WORDS)):
        if isinstance(node, ast.ImportFrom):
            assert not (node.module or "").startswith("app.api"), node.module
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert not alias.name.startswith("app.api"), alias.name


# (e) Commit B — the unattended thread carries the run's org EXPLICITLY.
# Without it ``threads_autofill_org_id`` files the thread, and therefore the run, under the
# owner's arbitrary FIRST org: fatal for a two-org owner's key start (D-06) and a latent bug for
# schedules (RESEARCH Pattern 2).
@pytest.mark.asyncio
async def test_the_unattended_thread_insert_stamps_the_org():
    from app.services import unattended_launch

    org_id = uuid4()
    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]
    with (
        patch("app.dependencies.get_service_role_supabase", return_value=supabase),
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())),
        patch("app.db.workflows.arm_run_budget", AsyncMock()),
        patch.object(unattended_launch, "_drive_run", AsyncMock()),
    ):
        await unattended_launch.launch_unattended_run(
            owner_id=uuid4(),
            org_id=org_id,
            workflow_id=uuid4(),
            definition=MagicMock(),
            inputs={},
            title="t",
            max_tokens=500_000,
            max_duration=1_800,
            pool=MagicMock(),
            redis=MagicMock(),
        )
    payload = supabase.table.return_value.insert.call_args.args[0]
    assert payload["org_id"] == str(org_id), payload
