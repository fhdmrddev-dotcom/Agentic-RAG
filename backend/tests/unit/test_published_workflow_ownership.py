"""Phase 192 (LIB-01 / D-04) — the ``PublishedWorkflow`` ownership contract + its fence.

D-04 adds two ADDITIVE, DEFAULTED booleans to the one response model shared by
``GET /workflows/published`` and ``GET /workflows/starters``, so the Workflows-page
*Yours* and *Starters* chips can filter client-side with honest SIMULTANEOUS counts
instead of a ``?scope=mine`` server round-trip.

What this file pins, and why each pin exists:

  • **is_mine is computed, per caller.** Same row, two callers, two answers — the value
    comes from the authenticated caller, never from the client and never from the row alone.
  • **/starters computes it IDENTICALLY, not hard-coded False.** Under today's seeding a
    starter is never the caller's (mig 094 seeds ``created_by`` as the system user), but a
    hard-coded ``False`` would ship that as an unstated invariant that lies in silence the
    day the seeding changes.
  • **THE NEGATIVE FENCE — no raw ``created_by`` UUID reaches the wire.** This is the
    load-bearing test. ``list_published_workflows`` runs on a service-role asyncpg pool
    that BYPASSES RLS (``db/workflows.py:445-447``, ``:493``), so the ``WHERE`` clause is
    the ONLY boundary and whatever the response model carries, the caller receives. A raw
    ``created_by`` is safe under TODAY's predicate and begins emitting other users'
    identifiers the moment a later phase widens it — v3.4's co-tenant ``org_id`` model is
    exactly that widening. That is the mig-116 / CR-01 shape, fenced prospectively.
    **The fence was observed RED** against a real ``created_by: UUID | None = None`` field
    planted on ``PublishedWorkflow``, then the file was restored md5-identical.
  • **The RUN CARVE-OUT survives.** Neither read route may acquire a ``dependencies=[...]``
    gate (``workflows.py`` — *"Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT gate /published
    or /starters"*). ``APIRoute.dependencies`` holds exactly the decorator-declared list, so
    this asserts the decorator, not the signature's ``Depends(get_current_user)``.
  • **The defaults hold.** A row dict carrying neither column still validates — that is what
    makes a frontend deployed AHEAD of this backend degrade to "nothing is mine" rather
    than crash.

House shape (``test_starter_workflows.py:1-60``): imports live INSIDE the test bodies so
``--collect-only`` stays clean. **This suite touches NO database** — the two db-layer calls
are monkeypatched and the pool is a sentinel object, so it performs zero INSERT/UPDATE/DELETE
and is safe to run concurrently with other worktrees (CLAUDE.md § Parallel execution, rule 4).
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest

# Two fixed, distinct ids — the caller, and somebody else. The "other" id is the value the
# negative fence hunts for anywhere in the serialized payload.
_CALLER = UUID("11111111-1111-1111-1111-111111111111")
_OTHER = UUID("22222222-2222-2222-2222-222222222222")
_SEED_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")


_ROW_UPDATED_AT = datetime(2026, 8, 12, 9, 30, 15, 123456, tzinfo=timezone.utc)


def _row(*, created_by: UUID, is_system_global: bool = False, name: str = "Row") -> dict:
    """One asyncpg-shaped row as the db layer now returns it (Task 1's widened SELECT).

    Phase 192.1 (LIB-05 / D-15): carries ``updated_at`` as a ``datetime``, because that is
    what asyncpg decodes a ``timestamptz`` to — a ``str`` fixture here would let the
    ``.isoformat()`` coercion in the handler go untested.
    """
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "slug": "some-workflow",
        "name": name,
        "definition": {"phases": []},
        "created_by": created_by,
        "is_system_global": is_system_global,
        "updated_at": _ROW_UPDATED_AT,
    }


def _patch_feeds(monkeypatch, *, published: list[dict], starters: list[dict]) -> None:
    """Stub both db-layer feeds and the pool. No database is contacted."""
    from app.api import workflows as wf

    async def _fake_pool():
        return object()  # a sentinel — the stubbed feeds never touch it

    async def _fake_published(pool, **kwargs):
        return list(published)

    async def _fake_starters(pool):
        return list(starters)

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_published_workflows", _fake_published)
    monkeypatch.setattr(wf, "list_starter_workflows", _fake_starters)


# ── (a) + (b): is_mine is computed against the authenticated caller ───────────────────
async def test_is_mine_true_when_row_created_by_matches_caller(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_feeds(monkeypatch, published=[_row(created_by=_CALLER)], starters=[])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert len(out) == 1
    assert out[0].is_mine is True


async def test_is_mine_false_when_row_created_by_differs(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_feeds(monkeypatch, published=[_row(created_by=_OTHER)], starters=[])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert len(out) == 1
    assert out[0].is_mine is False


async def test_same_row_answers_differently_for_two_callers(monkeypatch):
    """The value is a fact about the CALLER, not a stored property of the row."""
    from app.api.workflows import get_published_workflows

    _patch_feeds(monkeypatch, published=[_row(created_by=_CALLER)], starters=[])

    mine = await get_published_workflows(current_user={"id": str(_CALLER)})
    theirs = await get_published_workflows(current_user={"id": str(_OTHER)})

    assert mine[0].is_mine is True
    assert theirs[0].is_mine is False


# ── (c): is_system_global is projected through ────────────────────────────────────────
async def test_is_system_global_true_row_serializes_true(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_feeds(
        monkeypatch,
        published=[_row(created_by=_SEED_SYSTEM_USER, is_system_global=True)],
        starters=[],
    )
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].is_system_global is True
    assert out[0].is_mine is False


async def test_is_system_global_false_row_serializes_false(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_feeds(monkeypatch, published=[_row(created_by=_CALLER)], starters=[])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].is_system_global is False


# ── /starters computes is_mine IDENTICALLY — it is not hard-coded False ───────────────
async def test_starters_computes_is_mine_rather_than_hardcoding_false(monkeypatch):
    """If /starters hard-coded ``is_mine=False``, this row would still report False."""
    from app.api.workflows import get_starter_workflows

    _patch_feeds(
        monkeypatch,
        published=[],
        starters=[_row(created_by=_CALLER, is_system_global=True, name="Starter")],
    )
    out = await get_starter_workflows(current_user={"id": str(_CALLER)})

    assert len(out) == 1
    assert out[0].is_mine is True
    assert out[0].is_system_global is True


async def test_starters_under_todays_seeding_is_not_mine(monkeypatch):
    """The shipped reality: mig-094 starters are the system user's, so is_mine is False."""
    from app.api.workflows import get_starter_workflows

    _patch_feeds(
        monkeypatch,
        published=[],
        starters=[_row(created_by=_SEED_SYSTEM_USER, is_system_global=True)],
    )
    out = await get_starter_workflows(current_user={"id": str(_CALLER)})

    assert out[0].is_mine is False


# ── (d) THE NEGATIVE FENCE — no raw created_by reaches the wire ───────────────────────
def test_published_workflow_field_set_excludes_created_by():
    """Exact field set. Adding ``created_by: UUID | None = None`` turns this RED.

    ⚠ Phase 192.1 (LIB-05 / D-15): this set GREW BY ONE — ``updated_at`` — and the growth is
    the pin doing its job, not a nuisance. An exact-set assertion means every new field on
    this model must be argued for in a diff a reviewer reads, which is exactly the control
    the mig-116 / CR-01 shape needs. ``updated_at`` passes the model's own BINDING RULE for
    the rule's stated reason: it describes the ROW, never a person.
    """
    from app.api.workflows import PublishedWorkflow

    assert set(PublishedWorkflow.model_fields) == {
        "id",
        "slug",
        "name",
        "definition",
        "is_mine",
        "is_system_global",
        "updated_at",
    }
    assert "created_by" not in PublishedWorkflow.model_fields


@pytest.mark.parametrize("dump_mode", ["python", "json"])
async def test_no_serialized_value_equals_another_users_raw_uuid(monkeypatch, dump_mode):
    """The disclosure fence: a row owned by SOMEBODY ELSE must not emit their identifier.

    Checked against the serialized payload rather than the model's field list, so a field
    added under any NAME — ``created_by``, ``owner``, ``author_id`` — still trips it.
    """
    from app.api.workflows import get_published_workflows

    _patch_feeds(
        monkeypatch,
        published=[_row(created_by=_OTHER, is_system_global=True)],
        starters=[],
    )
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    dumped = out[0].model_dump(mode=dump_mode)

    assert "created_by" not in dumped
    haystack = {str(v) for v in dumped.values()}
    assert str(_OTHER) not in haystack
    # ...and not hidden one level down inside ``definition`` either.
    assert str(_OTHER) not in str(dumped)


async def test_starters_response_also_carries_no_raw_creator_uuid(monkeypatch):
    """Same fence on the second endpoint — one model, two handlers, two exits."""
    from app.api.workflows import get_starter_workflows

    _patch_feeds(
        monkeypatch,
        published=[],
        starters=[_row(created_by=_OTHER, is_system_global=True)],
    )
    out = await get_starter_workflows(current_user={"id": str(_CALLER)})

    dumped = out[0].model_dump(mode="json")
    assert "created_by" not in dumped
    assert str(_OTHER) not in str(dumped)


# ── (e) the defaults hold — a row missing both columns still validates ────────────────
def test_row_without_the_two_columns_still_validates():
    """A frontend deployed ahead of this backend degrades to "nothing is mine", not a crash."""
    from app.api.workflows import PublishedWorkflow

    model = PublishedWorkflow(
        id=UUID("44444444-4444-4444-4444-444444444444"),
        slug="pre-192",
        name="Pre-192 shape",
    )

    assert model.is_mine is False
    assert model.is_system_global is False


async def test_row_dict_missing_both_columns_serializes_with_defaults(monkeypatch):
    """The db layer's pre-192 four-column row shape still flows through both handlers."""
    from app.api.workflows import get_published_workflows

    legacy_row = {
        "id": UUID("55555555-5555-5555-5555-555555555555"),
        "slug": "legacy",
        "name": "Legacy row",
        "definition": None,
    }
    _patch_feeds(monkeypatch, published=[legacy_row], starters=[])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].is_mine is False
    assert out[0].is_system_global is False


def test_caller_uuid_coercion_never_raises():
    """``_caller_uuid`` degrades to ``None`` rather than raising.

    Measured, not assumed: ``/published`` can never reach a malformed id, because its
    PRE-EXISTING ``UUID(user_id) if isinstance(user_id, str)`` coercion (shipped long before
    192) raises first — so the honest scope of this guard is the helper itself plus
    ``/starters``, which has no such prior coercion. Stating that here keeps a later reader
    from concluding 192 introduced a 500 path, or that it removed one.
    """
    from app.api.workflows import _caller_uuid

    assert _caller_uuid({"id": str(_CALLER)}) == _CALLER
    assert _caller_uuid({"id": _CALLER}) == _CALLER
    assert _caller_uuid({"id": "not-a-uuid"}) is None
    assert _caller_uuid({"id": None}) is None
    assert _caller_uuid({}) is None


async def test_starters_with_unparseable_caller_id_degrades_to_not_mine(monkeypatch):
    """A malformed caller id yields ``is_mine=False``, never a 500 on a carve-out read.

    ``/starters`` is where this is reachable — it does no UUID coercion of its own.
    """
    from app.api.workflows import get_starter_workflows

    _patch_feeds(
        monkeypatch,
        published=[],
        starters=[_row(created_by=_CALLER, is_system_global=True)],
    )
    out = await get_starter_workflows(current_user={"id": "not-a-uuid"})

    assert out[0].is_mine is False


# ── T-192-03: the RUN CARVE-OUT is untouched ──────────────────────────────────────────
@pytest.mark.parametrize("path", ["/workflows/published", "/workflows/starters"])
def test_run_carve_out_routes_declare_no_dependencies(path):
    """``workflows.py``: *"RUN CARVE-OUT: DO NOT gate /published or /starters."*

    ``APIRoute.dependencies`` is exactly the decorator's ``dependencies=[...]`` list — the
    signature's ``Depends(get_current_user)`` lives in ``dependant``, so this asserts the
    gate specifically, not authentication.
    """
    from app.api.workflows import router

    matches = [r for r in router.routes if getattr(r, "path", None) == path]
    assert matches, f"route {path} not found on the workflows router"
    for route in matches:
        assert route.dependencies == [], (
            f"{path} acquired a dependencies=[...] gate — the RUN CARVE-OUT forbids it"
        )
