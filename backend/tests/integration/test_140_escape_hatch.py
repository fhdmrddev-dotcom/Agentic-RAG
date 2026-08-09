"""Phase 140 (TRIG-02 / Plan 04, Task 2) — the D-02 name-load escape hatch (SC#3 half 2).

The smart-dispatch pre-filter (Plan 04) trims the ``## Available Skills`` catalog to a
token budget when it overflows. SC#3's honesty red line has TWO halves:

  1. an honest truncation marker (never-silent — proven by ``test_140_catalog_trim.py`` +
     the seam tests in ``test_agent_loop_catalog_override.py``), and
  2. **this file:** ``load_skill`` can still load ANY enabled skill by its exact name even
     when the pre-filter trimmed it out of the injected menu — the model/user is never
     blocked by the budget.

This is a VERIFICATION test, not a rebuild: ``_handle_load_skill``
(``tool_dispatcher.py``) already resolves a skill by ``name`` + ``is_enabled`` (owner +
global scope), completely INDEPENDENT of whatever catalog was injected into the system
prompt. So a skill that was cut from the menu still loads by name. This test proves that
independence — it does NOT modify ``_handle_load_skill``.

No live LLM / no live provider / no live DB — a pure in-memory fake supabase plus stubbed
SSE emits (the ``ctx.spawn``'d audit coroutine is closed, never executed). It exercises the
``skills`` table (which exists today), NOT the not-yet-applied ``skill_embeddings`` table,
so it passes now without migration 091.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services.tool_dispatcher import ToolContext, _handle_load_skill

TEST_USER_ID = "00000000-0000-0000-0000-000000000042"

# The skill deliberately ABSENT from the (over-budget, trimmed) injected menu. It is a
# low-relevance skill the pre-filter would have cut — yet naming it must still load it.
MENU_ABSENT_SKILL = "obscure-legacy-report-formatter"

# The trimmed catalog the pre-filter actually injected this turn — note it does NOT
# contain MENU_ABSENT_SKILL. ``_handle_load_skill`` never receives this list; it is here
# only to document the scenario (the skill the model names is NOT in the menu).
INJECTED_MENU = ["pdf-tools", "excel-helper", "web-summarizer"]


class _FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _FakeQuery:
    """Chainable builder: select/or_/eq/order/... are no-op passthroughs; ``execute``
    returns the seeded rows verbatim (a single enabled skill needs no real ordering)."""

    def __init__(self, rows):
        self._rows = rows

    def __getattr__(self, _name):
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
            return _FakeQuery(list(self._skills))
        if name == "skill_files":
            return _FakeQuery(list(self._files))
        return _FakeQuery([])


def _make_ctx(supabase) -> ToolContext:
    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="escape-hatch-thread",
        supabase=supabase,
        pool=None,
        user_settings=None,
        current_user={"id": TEST_USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        # Close the write_audit_entry coroutine ctx.spawn() receives so it never runs
        # against the fake supabase and is never left un-awaited.
        spawn=lambda c: c.close(),
        skill_instructions_override=None,
    )


@pytest.mark.asyncio
async def test_load_skill_by_name_bypasses_catalog():
    """A skill that is enabled but ABSENT from the injected (trimmed) menu still loads by
    its exact name — proving the D-02 escape hatch (SC#3 half 2). ``_handle_load_skill``
    keys on name + is_enabled, independent of the catalog, so the pre-filter can never
    block a named skill."""
    # Sanity: the skill really is not in the menu the pre-filter injected this turn.
    assert MENU_ABSENT_SKILL not in INJECTED_MENU

    enabled_skill = {
        "id": "skill-obscure-1",
        "name": MENU_ABSENT_SKILL,
        "description": "Formats legacy quarterly reports (rarely used).",
        "instructions": "LEGACY REPORT FORMATTER BODY",
        "user_id": TEST_USER_ID,
        "is_system": False,
        "is_org_shared": False,
        "is_enabled": True,
    }
    sb = _FakeSupabase(skills_rows=[enabled_skill], files_rows=[])
    ctx = _make_ctx(sb)

    result = await _handle_load_skill({"skill_name": MENU_ABSENT_SKILL}, ctx)
    payload = json.loads(result.result)

    # Loaded successfully by exact name despite being absent from the injected menu.
    assert "error" not in payload, "a menu-absent enabled skill must still load by name"
    assert payload["name"] == MENU_ABSENT_SKILL
    assert payload["instructions"] == "LEGACY REPORT FORMATTER BODY"


@pytest.mark.asyncio
async def test_load_skill_still_404s_when_truly_absent():
    """Control: the escape hatch is name+is_enabled scoped, not a bypass of enablement —
    a name that matches NO enabled owner/global skill still returns the not-found error
    (so the hatch can't be used to load a disabled or non-existent skill)."""
    sb = _FakeSupabase(skills_rows=[], files_rows=[])
    ctx = _make_ctx(sb)

    result = await _handle_load_skill({"skill_name": "does-not-exist"}, ctx)
    payload = json.loads(result.result)

    assert "error" in payload
    assert "not found or not enabled" in payload["error"]
