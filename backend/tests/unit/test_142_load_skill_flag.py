"""Phase 142 (SRH-01 / D-05 / D-05b) — proactive per-skill runtime note on load_skill.

Plan 03 adds a non-blocking runtime note to the ``load_skill`` RESULT when the
loaded skill bundles a non-Python script the Python-only sandbox cannot execute —
the load_skill-RESULT-flag half of the D-05 proactive home. It mirrors the
``lint_warnings`` posture on ``save_skill``: computed defensively, attached as an
additive JSON key, NEVER blocks the load.

  * ``test_flag_present_for_js``   — a skill whose file list includes ``helper.js``
    returns a result carrying the ``runtime_note`` key, and the note NAMES ``helper.js``.
  * ``test_no_flag_all_python``    — an all-``.py`` file list returns NO ``runtime_note``
    key and the load still succeeds (name/instructions/files intact).
  * ``test_note_never_blocks``     — even if the note computation is forced to raise,
    the load result STILL returns name/instructions/files (degrade silently — the
    ``lint_warnings`` posture; D-05b never blocks).
  * ``test_runtime_note_pure``     — ``_skill_runtime_note`` scans extensions against
    the shared ``SCRIPT_EXTS`` and returns the note (naming offenders) or ``None``.

RED before Task 3: ``_handle_load_skill`` does not compute a note, so the
``runtime_note`` key is absent and ``_skill_runtime_note`` does not exist
(AttributeError referenced lazily so the FILE still collects).

No live LLM / provider / DB — a pure in-memory supabase fake (copied from
test_load_skill_collision) plus stubbed SSE emits (the ctx.spawn'd audit coroutine
is closed, never executed).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.services.tool_dispatcher as td
from app.services.tool_dispatcher import SCRIPT_EXTS, ToolContext, _handle_load_skill

SKILL_NAME = "deck-builder"
TEST_USER_ID = "00000000-0000-0000-0000-000000000042"


class _FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _PassthroughQuery:
    """Chainable builder whose ``.execute()`` returns the seeded rows verbatim.

    Sufficient here: this suite loads a SINGLE skill (no name collision), so the
    tie-break ordering the sorting fake exercises is irrelevant. select/or_/eq/order
    are chainable no-ops routed through ``__getattr__``.
    """

    def __init__(self, rows):
        self._rows = list(rows)

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
            return _PassthroughQuery(self._skills)
        if name == "skill_files":
            return _PassthroughQuery(self._files)
        return _PassthroughQuery([])


def _skill_row(instructions="Build the deck."):
    return {
        "id": "skill-1",
        "name": SKILL_NAME,
        "description": "builds decks",
        "instructions": instructions,
        "user_id": TEST_USER_ID,
        "is_system": False,
        "is_global": False,
        "is_enabled": True,
    }


def _make_ctx(supabase) -> ToolContext:
    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="flag-thread",
        supabase=supabase,
        pool=None,
        user_settings=None,
        current_user={"id": TEST_USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        spawn=lambda c: c.close(),
        skill_instructions_override=None,
    )


# ── D-05b — the note rides along when a script file is bundled ────────────────
@pytest.mark.asyncio
async def test_flag_present_for_js():
    """A skill bundling ``helper.js`` loads AND carries a non-blocking runtime note
    naming the offending file."""
    files_rows = [{"filename": "helper.js"}, {"filename": "guide.md"}]
    ctx = _make_ctx(_FakeSupabase([_skill_row()], files_rows))

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    # The load itself always succeeds with its core keys.
    assert payload["name"] == SKILL_NAME
    assert payload["instructions"] == "Build the deck."
    assert payload["files"] == ["helper.js", "guide.md"]

    # The additive runtime note is present and names the script file.
    assert "runtime_note" in payload
    assert payload["runtime_note"]  # non-empty string
    assert "helper.js" in payload["runtime_note"]


@pytest.mark.asyncio
async def test_no_flag_all_python():
    """An all-Python file list loads with NO runtime_note key (nothing to warn about)."""
    files_rows = [{"filename": "main.py"}, {"filename": "utils.py"}]
    ctx = _make_ctx(_FakeSupabase([_skill_row()], files_rows))

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    assert payload["name"] == SKILL_NAME
    assert payload["files"] == ["main.py", "utils.py"]
    assert "runtime_note" not in payload


@pytest.mark.asyncio
async def test_note_never_blocks(monkeypatch):
    """If the note computation raises, the load STILL returns name/instructions/files
    (defensive degrade — the lint_warnings posture; D-05b never blocks)."""

    def _boom(_file_names):
        raise RuntimeError("note computation exploded")

    monkeypatch.setattr(td, "_skill_runtime_note", _boom)

    files_rows = [{"filename": "helper.js"}]
    ctx = _make_ctx(_FakeSupabase([_skill_row()], files_rows))

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    # Load survived the exploding note computation.
    assert payload["name"] == SKILL_NAME
    assert payload["instructions"] == "Build the deck."
    assert payload["files"] == ["helper.js"]


# ── The pure helper — extension scan against the shared SCRIPT_EXTS ───────────
def test_runtime_note_pure():
    """``_skill_runtime_note`` returns the note naming offenders for a script file,
    and ``None`` for an all-Python (or empty) list."""
    assert "js" in SCRIPT_EXTS  # single-source guard

    note = td._skill_runtime_note(["helper.js", "guide.md"])
    assert isinstance(note, str)
    assert "helper.js" in note

    assert td._skill_runtime_note(["main.py", "data.csv"]) is None
    assert td._skill_runtime_note([]) is None
