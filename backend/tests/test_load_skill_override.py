"""Phase 135 Plan 02 (SI-01) — _handle_load_skill instructions-override branch guard.

Two direct-ToolContext unit tests over ``_handle_load_skill`` prove the additive,
default-off ``skill_instructions_override`` branch (RESEARCH Pitfall #1):

  * override map contains the loaded skill's name  -> the DRAFT body is returned (the
    re-eval measures the proposed instructions, NOT the live skills row).
  * override is None (every Deep / normal caller)  -> the LIVE DB body is returned,
    byte-identical to pre-135 behavior (D-16 red line).

COVERAGE HONESTY (branch vs wiring): these tests construct a ``ToolContext`` DIRECTLY,
so they prove the ``_handle_load_skill`` branch but NOT the RunContext -> ToolContext
threading at the agent_loop build sites (:2279 primary / :1501 resume) nor the
task_service sub-agent copy. Those wiring sites are proven by the Task-1 SOURCE
assertions (135-02-PLAN.md <verification>) and finally by manual UAT U5
(135-VALIDATION.md). The branch and the wiring are verified by DIFFERENT gates —
a future reader must not read "override works" here as "the eval build sites are wired".

No live LLM / no live provider / no live DB — a pure in-memory supabase fake + stubbed
SSE emits (the ctx.spawn'd audit coroutine is closed, never executed).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services.tool_dispatcher import ToolContext, _handle_load_skill

USER_ID = "00000000-0000-0000-0000-000000000001"
SKILL_NAME = "my-skill"


# ── In-memory supabase fake: chainable no-op builder whose ``execute`` returns the
#    fixed rows a table was seeded with. aexec() calls ``.execute`` off the event loop. ──
class _FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _FakeQuery:
    """Every select/or_/eq/order chains back to self; ``execute`` returns the seeded rows."""

    def __init__(self, rows):
        self._rows = rows

    def __getattr__(self, _name):
        # select/.or_/.eq/.order/... are all chainable no-ops that return self.
        def _chain(*a, **k):
            return self

        return _chain

    def execute(self):
        return _FakeResult(self._rows)


class _FakeSupabase:
    def __init__(self, skills_rows, files_rows):
        self._skills = skills_rows
        self._files = files_rows

    def table(self, name):
        if name == "skills":
            return _FakeQuery(self._skills)
        if name == "skill_files":
            return _FakeQuery(self._files)
        return _FakeQuery([])


def _make_ctx(supabase, *, skill_instructions_override) -> ToolContext:
    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="eval-thread",
        supabase=supabase,
        pool=None,
        user_settings=None,
        current_user={"id": USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        # Close the write_audit_entry coroutine ctx.spawn() receives so it is never
        # left un-awaited (no RuntimeWarning) and never touches the fake supabase.
        spawn=lambda c: c.close(),
        skill_instructions_override=skill_instructions_override,
    )


def _skills_rows(instructions: str) -> list[dict]:
    return [{
        "id": "skill-1",
        "name": SKILL_NAME,
        "description": "a test skill",
        "instructions": instructions,
        "user_id": USER_ID,
    }]


@pytest.mark.asyncio
async def test_override_returns_draft_instructions():
    """When the override map contains the loaded skill's name, _handle_load_skill
    returns the DRAFT body (the re-eval measures the proposed instructions)."""
    sb = _FakeSupabase(skills_rows=_skills_rows("LIVE BODY"), files_rows=[])
    ctx = _make_ctx(sb, skill_instructions_override={SKILL_NAME: "DRAFT BODY"})

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    assert payload["instructions"] == "DRAFT BODY"
    assert payload["name"] == SKILL_NAME


@pytest.mark.asyncio
async def test_none_override_returns_live_instructions():
    """With skill_instructions_override=None (every Deep / normal caller),
    _handle_load_skill returns the LIVE DB body — byte-identical to pre-135 (D-16)."""
    sb = _FakeSupabase(skills_rows=_skills_rows("LIVE BODY"), files_rows=[])
    ctx = _make_ctx(sb, skill_instructions_override=None)

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    assert payload["instructions"] == "LIVE BODY"
