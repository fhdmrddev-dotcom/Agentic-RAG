"""SEED-102 regression — a same-named owned skill row must NOT shadow an is_system built-in.

``_handle_load_skill`` resolves a name collision by ordering the candidate rows and
taking ``row[0]``. Before the fix it ordered ``.order("is_org_shared")`` ASCENDING, so an
owned row (is_org_shared False) sorted ahead of the same-named org-shared/system built-in
and the agent executed the user's UNVETTED body. The fix reverses the tie-break to
``.order("is_system", desc=True).order("is_org_shared", desc=True)`` — precedence
**system > org-shared > owned** — so the protected built-in always wins.
(Phase 165 / D-165-01: skills.is_global RENAMED -> is_org_shared; is_system unchanged.)

RED/GREEN CONTRACT — this test goes RED against the pre-fix tie-break and GREEN after it:
  * Against the OLD ``.order("is_org_shared")`` (ascending) the sort returns the owned row
    first, so ``payload["instructions"]`` would be ``"OWNED BODY"`` -> assertion FAILS.
  * Against the NEW two-key ``is_system DESC, is_org_shared DESC`` the built-in sorts first,
    so ``payload["instructions"]`` is ``"SYSTEM BODY"`` -> assertion PASSES.

WHY A NEW FAKE (not the passthrough in test_load_skill_override.py): that fake makes
``.order()`` a no-op and ``.execute()`` returns the seeded rows VERBATIM, so a collision
test using it proves NOTHING (it returns row[0] in seed order regardless of the code's
ordering — false-green). The fake below RECORDS every ``.order(col, desc=...)`` and, on
``.execute()``, applies them as a stable multi-key sort — mimicking SQL
``ORDER BY col1 <dir1>, col2 <dir2>`` (the first ``.order()`` is the primary key). Seeding
the rows in adversarial (owned-first) order then genuinely exercises the resolver.

No live LLM / no live provider / no live DB — a pure in-memory sorting supabase fake plus
stubbed SSE emits (the ctx.spawn'd audit coroutine is closed, never executed).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services.tool_dispatcher import ToolContext, _handle_load_skill

SKILL_NAME = "skill-creator"
# A non-system owned-by test user (deliberately NOT the migration-087 system uuid).
TEST_USER_ID = "00000000-0000-0000-0000-000000000042"
# The built-in seeded by migration 087.
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"


class _FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _SortingQuery:
    """Chainable builder that RECORDS ``.order(col, desc=...)`` calls and, on
    ``.execute()``, applies them as a stable multi-key sort over the seeded rows —
    mimicking SQL ``ORDER BY col1 <dir1>, col2 <dir2>`` (the FIRST ``.order()`` is the
    primary/most-significant key). Unlike the passthrough fake in
    test_load_skill_override.py this actually SORTS, so seeding rows in adversarial
    (owned-first) order genuinely exercises the resolver's tie-break instead of just
    returning the seed order."""

    def __init__(self, rows):
        self._rows = list(rows)
        self._orders: list[tuple[str, bool]] = []

    def order(self, column, desc=False):
        self._orders.append((column, desc))
        return self

    def __getattr__(self, _name):
        # select/.or_/.eq/... are chainable no-ops that return self. ``order`` is a real
        # method above, so it is never routed here.
        def _chain(*a, **k):
            return self

        return _chain

    def execute(self):
        rows = list(self._rows)
        # Apply recorded keys in REVERSED order so the FIRST ``.order()`` ends up the
        # primary key — Python's sort is stable, so we sort least-significant-first.
        # Booleans then sort True-high when desc=True (True=1 > False=0).
        for column, desc in reversed(self._orders):
            rows.sort(key=lambda r: r.get(column), reverse=desc)
        return _FakeResult(rows)


class _SortingSupabase:
    def __init__(self, skills_rows, files_rows):
        self._skills = skills_rows
        self._files = files_rows

    def table(self, name):
        # Fresh builder per ``.table()`` call so recorded orders never leak between the
        # skills query and the skill_files query.
        if name == "skills":
            return _SortingQuery(self._skills)
        if name == "skill_files":
            return _SortingQuery(self._files)
        return _SortingQuery([])


def _make_ctx(supabase) -> ToolContext:
    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="collision-thread",
        supabase=supabase,
        pool=None,
        user_settings=None,
        current_user={"id": TEST_USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        # Close the write_audit_entry coroutine ctx.spawn() receives so it is never left
        # un-awaited and never touches the fake supabase.
        spawn=lambda c: c.close(),
        skill_instructions_override=None,
    )


@pytest.mark.asyncio
async def test_collision_resolves_to_is_system_builtin():
    """Given a user who owns a skill named identically to an is_system built-in,
    _handle_load_skill returns the BUILT-IN's instructions — proving precedence
    system > owned on a name collision (SEED-102 closed)."""
    owned = {
        "id": "skill-owned",
        "name": SKILL_NAME,
        "description": "user's shadow copy",
        "instructions": "OWNED BODY",
        "user_id": TEST_USER_ID,
        "is_system": False,
        "is_org_shared": False,
        "is_enabled": True,
    }
    builtin = {
        "id": "skill-builtin",
        "name": SKILL_NAME,
        "description": "protected built-in",
        "instructions": "SYSTEM BODY",
        "user_id": SYSTEM_USER_ID,
        "is_system": True,
        "is_org_shared": True,
        "is_enabled": True,
    }
    # Adversarial seed order: OWNED first. A passthrough fake would return row[0] = owned;
    # the sorting fake orders by the recorded keys, so only a correct tie-break wins.
    sb = _SortingSupabase(skills_rows=[owned, builtin], files_rows=[])
    ctx = _make_ctx(sb)

    result = await _handle_load_skill({"skill_name": SKILL_NAME}, ctx)
    payload = json.loads(result.result)

    assert payload["instructions"] == "SYSTEM BODY"
    assert payload["name"] == SKILL_NAME
