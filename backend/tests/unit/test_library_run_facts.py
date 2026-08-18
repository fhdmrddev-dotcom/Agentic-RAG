"""Phase 192.2 (LIB-06 / D-07) — the library's RUN FACTS: ``last_run_at`` + ``last_run_status``.

LIB-06's differentiator is *does this one work*. The data already exists — measured against
the live local DB on 2026-08-19, ``workflow_runs`` holds **228 rows** (186 completed / 31
failed / 11 cancelled) over **48 distinct definitions**, and **all 228 carry a non-NULL
``user_id``**. Nothing is written, nothing is migrated: the feeds simply did not read it.

⚠ **NO MIGRATION, NO NEW COLUMN, NO NEW WRITE.** This suite pins that too — the fences below
assert the shipped predicates are still byte-identical, because on a service-role pool that
bypasses RLS the ``WHERE`` clause IS the access boundary and a projection that quietly widens
it is the mig-116 / CR-01 information-disclosure shape.

What is pinned, and why each pin exists:

  • **All three feeds carry both keys.** ``/published``, ``/starters`` and ``/drafts``. The
    first two share ONE response model (RESEARCH C-6), so a field added for the Published
    shelf and not mirrored on the Starters handler leaves every starter card silently missing
    its run facts while the type claims it has them. The 192.1 ``updated_at`` precedent hit
    this exact trap and it is asserted per handler here for the same reason.

  • **⚠ T-08 — THE JOIN MUST NOT DROP NEVER-RUN ROWS.** ``LEFT``, never inner. Measured:
    69% of the library (81 of 117 real rows) is drafts and only 48 definitions have ANY run,
    so an inner join would hide most of the library. Pinned twice — as a source fence on the
    shared lateral, and LIVE, by executing the SHIPPED pre-change SQL beside the new function
    and asserting the id sequences are identical.

  • **⚠ T-09 — THE JOIN MUST NOT MULTIPLY ROWS.** ``LATERAL … LIMIT 1``, one row per
    definition. Measured: one definition carries **24** runs, another **22**, another **20** —
    a plain join to ``workflow_runs`` would render those workflows 24, 22 and 20 times. The
    live row-sequence comparison catches this too (a multiplied feed is not an equal
    sequence), and the ordering fence pins the ``LIMIT 1``.

  • **⚠ T-10 — VISIBILITY MUST NOT WIDEN, AND THIS ONE IS SECURITY-BEARING.**
    ``workflow_runs`` carries ``user_id`` and ``org_id``. A GLOBAL published definition is
    visible to everyone, so an UNSCOPED lateral would hand every caller another tenant's run
    activity. The lateral is scoped ``r.user_id = $1`` — the SAME ``$1`` the feed's own
    predicate already binds, so no new binding is introduced. Driven LIVE against a real
    global row with real runs: ``research_summarize`` (``is_system_global``, 20 runs by one
    user) must come back with BOTH facts ``None`` for any other caller, while the real runner
    sees them. Scoping by ``user_id`` is strictly narrower than scoping by ``org_id`` — a
    user belongs to one org — so the cross-org case is excluded by construction.
    ⚠ A run with a NULL ``user_id`` (legacy) is attributed to NOBODY, because
    ``r.user_id = $1`` is NULL and therefore not true. Fail-closed.

  • **⚠ T-11 — THE KEY MUST REACH THE CLIENT.** ``/published``, ``/starters`` and ``/drafts``
    all declare ``response_model``, which DROPS undeclared keys **silently** — a green db test
    with an unchanged UI. Pinned on the serialized ``model_dump(mode="json")``, which is what
    the browser actually receives.

  • **⚠ T-12 — NO f-STRING REACHES THE SQL.** The lateral is ONE module-level literal with a
    single positional ``$1``; the fences assert it carries no ``{`` and no ``%``.

  • **A row with no run returns EXPLICIT nulls** — not a zero, not a default, not an omitted
    key, and never a fabricated time or a green tick (CONTEXT D-08: three arms, never two).

⚠ **``updated_at`` IS NOT A RUN TIME and this suite does not conflate them.** On a published
row it is deliberately the PUBLISH time (published rows are immutable —
``workflow_definitions_block_published``), documented as such on
``PublishedWorkflow.updated_at`` and in ``lib/api.ts``. ``last_run_at`` is the run's own
``created_at``. Both are asserted to be independently sourced.

⚠ **WHY THE LATERAL LIVES IN ONE MODULE-LEVEL CONSTANT, stated plainly rather than
discovered.** Three copies of the same join is the drift shape this repository has recorded
repeatedly, and the three feeds MUST agree on the ``lr.last_run_at`` / ``lr.last_run_status``
aliases or a projection references a column its own join does not expose. It has a second,
smaller consequence worth naming so nobody thinks it was hidden: ``test_workflows_updated_at``
reads ``inspect.getsource(list_starter_workflows)`` and asserts ``"id DESC" not in`` it, to pin
that the STARTERS SHELF stays alphabetical (D-16). A lateral inlined into that function would
red that fence with a subquery's ordering, which is not the shelf's ordering — the needle
would be judging something it was never written to judge (the 187-24 trap this repo names).
One shared constant keeps that fence judging exactly the property it owns, and this suite adds
its own fence (``test_the_starters_shelf_ordering_is_untouched``) over the shelf clause AND
over the lateral's ordering, so neither goes unguarded.

House shape (``test_workflows_updated_at.py``, ``test_published_workflow_ownership.py``):
imports live INSIDE the test bodies so ``--collect-only`` stays clean. The wire + source
groups touch NO database. The LIVE group is **READ-ONLY** — it performs zero
INSERT/UPDATE/DELETE, so it cannot interfere with a concurrent worktree even though it opens
the local pool (CLAUDE.md § Parallel execution, rule 4).
"""

from __future__ import annotations

import inspect
import os
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

_CALLER = UUID("11111111-1111-1111-1111-111111111111")
_OTHER = UUID("22222222-2222-2222-2222-222222222222")
_SEED_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")

# Deliberately carries MICROSECONDS (``…123456``) for the reason
# ``test_workflows_updated_at`` records: a value with 0 microseconds would let a
# ``datetime``-typed field pass by luck, and the fraction is exactly what Pydantic drops.
_RAN_AT = datetime(2026, 8, 18, 22, 5, 41, 123456, tzinfo=timezone.utc)
_RAN_AT_ISO = "2026-08-18T22:05:41.123456+00:00"

# A definition's own ``updated_at`` — a DIFFERENT instant from the run's, on purpose. The two
# fields must be independently sourced; a suite that used one value could not tell them apart.
_UPDATED = datetime(2026, 8, 12, 9, 30, 15, 654321, tzinfo=timezone.utc)
_UPDATED_ISO = "2026-08-12T09:30:15.654321+00:00"

_TOKEN = "2026-08-12T09:30:15.654321Z"


def _published_row(
    *,
    created_by: UUID = _CALLER,
    last_run_at: object = _RAN_AT,
    last_run_status: object = "completed",
) -> dict:
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "slug": "vendor-risk-review",
        "name": "Vendor risk review",
        "definition": {"phases": []},
        "created_by": created_by,
        "is_system_global": False,
        "updated_at": _UPDATED,
        "last_run_at": last_run_at,
        "last_run_status": last_run_status,
    }


def _draft_row(
    *, last_run_at: object = _RAN_AT, last_run_status: object = "failed"
) -> dict:
    return {
        "id": UUID("44444444-4444-4444-4444-444444444444"),
        "slug": "vendor-risk-review",
        "version": 2,
        "name": "Vendor risk review",
        "definition": {"phases": []},
        "token": _TOKEN,
        "updated_at": _UPDATED,
        "last_run_at": last_run_at,
        "last_run_status": last_run_status,
    }


def _patch_published(monkeypatch, rows: list[dict]) -> None:
    from app.api import workflows as wf

    async def _fake_pool():
        return object()

    async def _fake_published(pool, **kwargs):
        return list(rows)

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_published_workflows", _fake_published)


def _patch_starters(monkeypatch, rows: list[dict]) -> None:
    from app.api import workflows as wf

    async def _fake_pool():
        return object()

    # ``**kwargs`` because ``/starters`` now hands the db layer the caller id the lateral
    # binds — see ``test_the_starters_route_hands_the_caller_id_to_the_db_layer``.
    async def _fake_starters(pool, **kwargs):
        return list(rows)

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_starter_workflows", _fake_starters)


def _patch_drafts(monkeypatch, rows: list[dict]) -> None:
    from app.api import workflows as wf

    async def _fake_pool():
        return object()

    async def _fake_drafts(pool, **kwargs):
        return list(rows)

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_draft_workflows", _fake_drafts)


# ══ GROUP A — the wire: all three feeds carry both facts ═══════════════════════════════


async def test_published_serializes_both_run_facts(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row()])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].last_run_at == _RAN_AT_ISO
    assert out[0].last_run_status == "completed"


async def test_starters_serializes_both_run_facts(monkeypatch):
    """C-6: ONE model, TWO feeds. A field mirrored on /published and not here leaves every
    starter card silently missing its run facts while the type says it has them."""
    from app.api.workflows import get_starter_workflows

    _patch_starters(monkeypatch, [_published_row(created_by=_SEED_SYSTEM_USER)])
    out = await get_starter_workflows(current_user={"id": str(_CALLER)})

    assert out[0].last_run_at == _RAN_AT_ISO
    assert out[0].last_run_status == "completed"


async def test_drafts_serializes_both_run_facts(monkeypatch):
    """A draft CAN have runs — the publish gauntlet's golden run is one, and the live DB
    carries drafts with 3, 2 and 2 runs. "Your test run failed" is the honest answer."""
    from app.api.workflows import list_drafts

    _patch_drafts(monkeypatch, [_draft_row()])
    out = await list_drafts(current_user={"id": str(_CALLER)})

    assert out[0].last_run_at == _RAN_AT_ISO
    assert out[0].last_run_status == "failed"


@pytest.mark.parametrize("absent", ["null", "missing-key"])
async def test_a_published_row_with_no_run_carries_explicit_nulls(monkeypatch, absent):
    """D-08, arm 3: NOT a zero, NOT a default, NOT an omitted key, NEVER a fabricated time.

    POSITIVE CONTROL is ``test_published_serializes_both_run_facts`` above — a row WITH a run
    yields both values — so this absence assertion cannot pass for the wrong reason.
    """
    from app.api.workflows import get_published_workflows

    row = _published_row()
    if absent == "missing-key":
        del row["last_run_at"]
        del row["last_run_status"]
    else:
        row["last_run_at"] = None
        row["last_run_status"] = None

    _patch_published(monkeypatch, [row])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].last_run_at is None
    assert out[0].last_run_status is None
    # The keys are PRESENT on the wire and explicitly null — an absent key is a different
    # message to the client ("this backend does not know about runs") and D-08 needs both.
    dumped = out[0].model_dump(mode="json")
    assert "last_run_at" in dumped and dumped["last_run_at"] is None
    assert "last_run_status" in dumped and dumped["last_run_status"] is None


@pytest.mark.parametrize("absent", ["null", "missing-key"])
async def test_a_draft_row_with_no_run_carries_explicit_nulls(monkeypatch, absent):
    from app.api.workflows import list_drafts

    row = _draft_row()
    if absent == "missing-key":
        del row["last_run_at"]
        del row["last_run_status"]
    else:
        row["last_run_at"] = None
        row["last_run_status"] = None

    _patch_drafts(monkeypatch, [row])
    out = await list_drafts(current_user={"id": str(_CALLER)})

    assert out[0].last_run_at is None
    assert out[0].last_run_status is None


def test_both_models_default_the_fields_so_an_old_row_still_validates():
    """ADDITIVE AND DEFAULTED — the ``definition`` / ``is_mine`` / ``updated_at`` precedent.

    A client deployed AHEAD of this backend degrades to "unknown", never to a fabricated
    value; a row dict built before this phase still flows through both handlers.
    """
    from app.api.workflows import DraftRow, PublishedWorkflow

    pub = PublishedWorkflow(id=_OTHER, slug="s", name="N")
    assert pub.last_run_at is None
    assert pub.last_run_status is None

    draft = DraftRow(id=_OTHER, slug="s", version=1, token=_TOKEN)
    assert draft.last_run_at is None
    assert draft.last_run_status is None


def test_last_run_status_is_a_plain_nullable_str_never_an_enum():
    """⚠ ``workflow_runs.status`` is written by the run lifecycle. A NEW terminal state must
    not 500 the library — so the wire type is a plain nullable ``str``, not an enum.

    The live CHECK constraint admits six values today (``active``, ``paused``, ``cap_paused``,
    ``completed``, ``failed``, ``cancelled``); the library only ever sees whatever the row
    holds, and a seventh added tomorrow must flow through untouched.
    """
    from app.api.workflows import DraftRow, PublishedWorkflow

    for model in (PublishedWorkflow, DraftRow):
        annotation = str(model.model_fields["last_run_status"].annotation)
        assert "str" in annotation, annotation
        assert "Enum" not in annotation and "Literal" not in annotation, annotation


async def test_an_unknown_terminal_state_flows_through_verbatim(monkeypatch):
    """The behavioural half of the test above — a status this code has never seen."""
    from app.api.workflows import get_published_workflows

    _patch_published(
        monkeypatch, [_published_row(last_run_status="quarantined_by_a_future_phase")]
    )
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].last_run_status == "quarantined_by_a_future_phase"


def test_last_run_at_is_typed_str_never_datetime():
    """The ``DraftCreateResponse.token`` / ``PublishedWorkflow.updated_at`` binding rule.

    A ``datetime``-typed field re-serializes through Pydantic and DROPS the fractional part
    when microseconds are 0, so the wire string's width would vary with the clock. Typing it
    ``str`` and formatting in the builder makes the wire value exactly what the DB returned.
    """
    from app.api.workflows import DraftRow, PublishedWorkflow

    for model in (PublishedWorkflow, DraftRow):
        annotation = str(model.model_fields["last_run_at"].annotation)
        assert "str" in annotation, annotation
        assert "datetime" not in annotation, annotation


async def test_the_microseconds_survive_the_wire(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row()])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].model_dump(mode="json")["last_run_at"] == _RAN_AT_ISO
    assert "123456" in out[0].model_dump(mode="json")["last_run_at"]


async def test_the_run_time_is_not_the_publish_time(monkeypatch):
    """⚠ ``updated_at`` IS NOT A RUN TIME and this phase must not conflate them.

    On a published row ``updated_at`` is deliberately the PUBLISH time (the row is immutable
    afterwards). The two fields are sourced from different columns, and the row fixture uses
    two different instants so this can be observed rather than asserted.
    """
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row()])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].updated_at == _UPDATED_ISO
    assert out[0].last_run_at == _RAN_AT_ISO
    assert out[0].updated_at != out[0].last_run_at


async def test_the_starters_route_hands_the_caller_id_to_the_db_layer(monkeypatch):
    """T-10 at the ROUTE seam. ``/starters`` used to take no user at all — the lateral is
    owner-scoped, so the caller id has to reach it or the shelf would show another tenant's
    activity on world-readable global rows.
    """
    from app.api import workflows as wf

    seen: dict = {}

    async def _fake_pool():
        return object()

    async def _fake_starters(pool, **kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_starter_workflows", _fake_starters)
    await wf.get_starter_workflows(current_user={"id": str(_CALLER)})

    assert seen.get("user_id") == _CALLER


async def test_an_unparseable_caller_degrades_to_no_run_facts_not_a_500(monkeypatch):
    """The RUN CARVE-OUT protects these read paths. An id that will not parse must not raise;
    it yields ``user_id=None``, which the lateral treats as "matches nothing" — fail-closed.
    """
    from app.api import workflows as wf

    seen: dict = {}

    async def _fake_pool():
        return object()

    async def _fake_starters(pool, **kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(wf, "get_pg_pool", _fake_pool)
    monkeypatch.setattr(wf, "list_starter_workflows", _fake_starters)
    out = await wf.get_starter_workflows(current_user={"id": "not-a-uuid"})

    assert out == []
    assert seen.get("user_id") is None


# ══ GROUP B — the SQL, asserted at the source ══════════════════════════════════════════
#
# The access boundary is the WHERE clause and nothing else — this pool bypasses RLS. These
# also serve as the dropped-column guard, which fails in CI rather than at runtime.


def _lateral() -> str:
    from app.db.workflows import _LAST_RUN_LATERAL_SQL

    return _LAST_RUN_LATERAL_SQL


def _published_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_published_workflows)


def _starter_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_starter_workflows)


def _draft_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_draft_workflows)


def test_all_three_feeds_project_both_run_facts():
    """The dropped-column guard. A projection that loses a column leaves every card blank."""
    for name, source in (
        ("published", _published_source()),
        ("starter", _starter_source()),
        ("draft", _draft_source()),
    ):
        assert "lr.last_run_at" in source, name
        assert "lr.last_run_status" in source, name


def test_the_published_feed_projects_them_in_BOTH_branches():
    """``list_published_workflows`` builds TWO SELECT lists — the ``owned_only`` branch and
    the default one. 192.1 had to assert this per branch; so does this phase."""
    source = _published_source()
    projections = [
        line
        for line in source.splitlines()
        if "lr.last_run_at" in line and not line.strip().startswith("#")
    ]

    assert len(projections) == 2, projections


def test_the_join_is_LEFT_and_LATERAL_and_never_inner():
    """⚠ T-08 + T-09 in one fence.

    ``LEFT`` so never-run rows survive — 69% of the library has never run, and an inner join
    would hide it. ``LATERAL … LIMIT 1`` so one row arrives per definition — the live DB has a
    definition with 24 runs, which a plain join would render 24 times.
    """
    lateral = _lateral()

    assert lateral.startswith("LEFT JOIN LATERAL ("), lateral
    assert "LIMIT 1" in lateral
    assert "ON TRUE" in lateral
    # POSITIVE CONTROLS — the needles really do catch the shapes they judge.
    assert "LEFT JOIN LATERAL (" not in "INNER JOIN LATERAL ("
    assert "LEFT JOIN LATERAL (" not in "JOIN workflow_runs r ON r.definition_id = wd.id"

    for name, source in (
        ("published", _published_source()),
        ("starter", _starter_source()),
        ("draft", _draft_source()),
    ):
        # No feed may grow its own inner join to the runs table.
        assert "INNER JOIN" not in source, name
        assert "JOIN workflow_runs" not in source, name


def test_the_lateral_picks_exactly_the_most_recent_run():
    """Ordered by the RUN's own timestamp, descending, with a UNIQUE tiebreaker.

    ⚠ The tiebreaker is the WR-03 lesson applied prospectively rather than defensively:
    ``created_at`` is not unique and Postgres' ``now()`` is transaction-scoped. Measured on
    the live DB 2026-08-19 there are **0** ``(definition_id, created_at)`` collisions today —
    so this is not fixing an observed reshuffle, it is refusing to depend on a property
    nothing enforces. ``workflow_runs.id`` is the PRIMARY KEY: NOT NULL and unique.
    """
    lateral = _lateral()

    assert "ORDER BY r.created_at DESC, r.id DESC" in lateral
    assert lateral.index("ORDER BY") < lateral.index("LIMIT 1")


def test_the_lateral_is_owner_scoped_to_the_already_bound_caller():
    """⚠ T-10, the security-bearing one.

    ``r.user_id = $1`` — the SAME ``$1`` all three feeds already bind to the caller, so the
    join introduces NO new binding and cannot renumber an existing one. Scoping by ``user_id``
    is strictly narrower than scoping by ``org_id`` (a user belongs to one org), so the
    cross-ORG case is excluded by construction rather than by a second clause.
    """
    lateral = _lateral()

    assert "r.user_id = $1" in lateral
    assert "r.definition_id = wd.id" in lateral
    # Exactly ONE placeholder, and it is $1. A $2 here would silently consume the project
    # filter's binding on the published feed.
    assert lateral.count("$") == 1, lateral
    assert "$2" not in lateral


def test_no_f_string_reaches_the_lateral():
    """T-12. It is a plain literal — no ``{}`` placeholder, no ``%`` interpolation."""
    lateral = _lateral()

    assert "{" not in lateral and "}" not in lateral, lateral
    assert "%" not in lateral, lateral


def test_the_three_feeds_share_ONE_lateral_rather_than_three_copies():
    """One home per concern — and the aliases MUST agree, or a projection references a column
    its own join does not expose."""
    for name, source in (
        ("published", _published_source()),
        ("starter", _starter_source()),
        ("draft", _draft_source()),
    ):
        assert "_LAST_RUN_LATERAL_SQL" in source, name
        # No second copy of the join text inlined beside the shared constant.
        assert "LEFT JOIN LATERAL" not in source, name


def test_the_lateral_aliases_cannot_collide_with_the_definition_columns():
    """⚠ NOT cosmetic — this is why the subquery aliases its outputs.

    The outer queries carry BARE ``status``, ``id`` and ``updated_at`` in their WHERE and
    ORDER BY clauses. ``workflow_runs`` has all three. If the lateral exposed them under their
    own names the outer ``WHERE status = 'published'`` would become AMBIGUOUS and every feed
    would raise — so the subquery renames them at the boundary.
    """
    lateral = _lateral()

    assert "r.created_at AS last_run_at" in lateral
    assert "r.status AS last_run_status" in lateral
    # The alias set the outer query sees is exactly those two names.
    assert " AS id" not in lateral
    assert " AS status" not in lateral
    assert " AS updated_at" not in lateral


@pytest.mark.parametrize(
    "predicate",
    [
        "WHERE status = 'published' AND created_by = $1",
        "WHERE status = 'published' AND (is_system_global = true OR created_by = $1)",
    ],
)
def test_the_published_predicates_are_still_byte_identical(predicate):
    """⚠ THE PROJECTION WIDENS; THE PREDICATE DOES NOT.

    Deliberately a SECOND pin of what ``test_workflows_updated_at`` already asserts, because
    THIS is the change that could have widened them: a join is the one edit that can move rows
    into a result set. On a service-role pool the WHERE clause is the only access boundary.
    """
    assert predicate in _published_source()


def test_the_starter_predicate_is_still_byte_identical():
    source = _starter_source()

    assert "WHERE status = 'published' AND is_system_global = true " in source
    assert "AND definition->>'category' = 'starter' " in source


def test_the_draft_owner_scope_is_still_byte_identical():
    """A second user's draft is ABSENT (T-103-01-01)."""
    assert "WHERE status = 'draft' AND created_by = $1 " in _draft_source()


def test_the_two_author_feeds_still_order_by_recency():
    """The join may only ADD columns. The shelf ordering is D-15/D-16's and is not this
    phase's to touch."""
    for name, source in (("published", _published_source()), ("draft", _draft_source())):
        assert "ORDER BY updated_at DESC, id DESC" in source, name


def test_the_starters_shelf_ordering_is_untouched():
    """⚠ D-16's divergence, re-pinned HERE deliberately.

    ``test_workflows_updated_at`` asserts ``"id DESC" not in`` the starters source to pin that
    the shelf stays alphabetical. That needle now passes for a second reason as well — the
    lateral's ordering lives in a shared constant, so it is not in that function's source at
    all. A needle that passes for a reason its author did not intend is worth re-stating
    explicitly, so this asserts the property directly: the SHELF clause is ``ORDER BY name``,
    and the lateral's ordering is over the RUN's key, never the shelf's.
    """
    starter = _starter_source()

    assert "ORDER BY name" in starter
    assert "ORDER BY updated_at" not in starter
    assert "ORDER BY r.created_at DESC, r.id DESC" in _lateral()
    assert "ORDER BY name" not in _lateral()


def test_no_migration_was_added_by_this_phase():
    """⚠ NO MIGRATION, NO NEW COLUMN, NO NEW WRITE — the plan's headline constraint.

    ``workflow_runs`` already holds every byte this phase reads. The fence is mechanical: the
    lateral is a pure SELECT, and neither feed module learned a write.
    """
    from app.db import workflows as db

    lateral = _lateral()
    for verb in ("INSERT", "UPDATE", "DELETE", "ALTER", "CREATE"):
        assert verb not in lateral.upper(), verb

    module_source = inspect.getsource(db)
    assert "ALTER TABLE workflow_runs" not in module_source
    assert "ALTER TABLE workflow_definitions" not in module_source


def test_the_source_accessors_are_not_vacuous():
    """NON-VACUITY. Without this, every fence above could pass by reading "" ."""
    for name, accessor in (
        ("list_published_workflows", _published_source),
        ("list_starter_workflows", _starter_source),
        ("list_draft_workflows", _draft_source),
    ):
        source = accessor()
        assert len(source) > 500, name
        assert name in source, name
        assert "SELECT id, slug" in source, name

    assert len(_lateral()) > 80


# ══ GROUP C — LIVE, READ-ONLY, against the local database ══════════════════════════════
#
# The properties below cannot be proved by a source fence: "the same rows, in the same order"
# is a statement about a result set. Each executes the SHIPPED pre-change SQL beside the new
# function and compares. ⚠ ZERO writes — no INSERT, no UPDATE, no DELETE, no DDL.

_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)


def _pg_reachable(dsn: str = _DSN) -> bool:
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()
live = pytest.mark.skipif(
    not PG_AVAILABLE, reason=f"local Postgres not reachable at {_DSN}"
)

# The SELECT lists + predicates EXACTLY as they shipped at 592e8602, before the lateral. The
# characterization baseline: whatever these return, the new functions must return the same
# rows in the same order.
_SHIPPED_PUBLISHED_ALL = (
    "SELECT id, slug, name, definition, created_by, is_system_global, updated_at "
    "FROM workflow_definitions "
    "WHERE status = 'published' AND (is_system_global = true OR created_by = $1) "
    "ORDER BY updated_at DESC, id DESC"
)
_SHIPPED_PUBLISHED_MINE = (
    "SELECT id, slug, name, definition, created_by, is_system_global, updated_at "
    "FROM workflow_definitions "
    "WHERE status = 'published' AND created_by = $1 "
    "ORDER BY updated_at DESC, id DESC"
)
_SHIPPED_STARTERS = (
    "SELECT id, slug, name, definition, created_by, is_system_global, updated_at "
    "FROM workflow_definitions "
    "WHERE status = 'published' AND is_system_global = true "
    "AND definition->>'category' = 'starter' "
    "ORDER BY name"
)


async def _pool():
    import asyncpg

    return await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=2)


async def _the_user_who_runs_things(pool) -> UUID:
    """The caller the live assertions are made as — DERIVED from the data, never hardcoded."""
    return await pool.fetchval(
        "SELECT user_id FROM workflow_runs "
        "WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY count(*) DESC LIMIT 1"
    )


@live
async def test_the_published_feed_returns_the_same_rows_in_the_same_order():
    """⚠ T-08 + T-09, LIVE and on both branches. The anti-regression that matters most.

    An accidentally-inner join drops every never-run row; a non-LATERAL join multiplies a
    24-run definition 24 times. Both show up here as an unequal id sequence.
    """
    from app.db.workflows import list_published_workflows

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)

        for label, shipped, kwargs in (
            ("all", _SHIPPED_PUBLISHED_ALL, {}),
            ("mine", _SHIPPED_PUBLISHED_MINE, {"owned_only": True}),
        ):
            before = await pool.fetch(shipped, me)
            after = await list_published_workflows(pool, user_id=me, **kwargs)

            assert len(before) > 0, f"{label}: nothing to characterize"
            assert [r["id"] for r in before] == [
                r["id"] for r in after
            ], f"{label}: the row sequence moved"
            # Row COUNT stated separately — a multiplied feed fails this even if a reader
            # only skims the sequence assertion.
            assert len(after) == len(before), label
    finally:
        await pool.close()


@live
async def test_the_starters_and_drafts_feeds_return_the_same_rows_in_the_same_order():
    from app.db.workflows import (
        CONCURRENCY_TOKEN_SQL,
        list_draft_workflows,
        list_starter_workflows,
    )

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)

        before = await pool.fetch(_SHIPPED_STARTERS)
        after = await list_starter_workflows(pool, user_id=me)
        assert len(before) > 0
        assert [r["id"] for r in before] == [r["id"] for r in after]

        shipped_drafts = (
            f"SELECT id, slug, version, name, definition, {CONCURRENCY_TOKEN_SQL} AS token, "
            f"updated_at FROM workflow_definitions "
            f"WHERE status = 'draft' AND created_by = $1 "
            f"ORDER BY updated_at DESC, id DESC"
        )
        before = await pool.fetch(shipped_drafts, me)
        after = await list_draft_workflows(pool, user_id=me)
        assert len(before) > 0
        assert [r["id"] for r in before] == [r["id"] for r in after]
        # The token is untouched by the join — it is compared byte-for-byte by the save path.
        assert [r["token"] for r in before] == [r["token"] for r in after]
    finally:
        await pool.close()


@live
async def test_a_definition_with_runs_carries_its_MOST_RECENT_run():
    """Assertion 2, checked against an INDEPENDENT query rather than against the join itself."""
    from app.db.workflows import list_published_workflows

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)
        rows = await list_published_workflows(pool, user_id=me)
        with_a_run = [r for r in rows if r["last_run_at"] is not None]

        assert with_a_run, "no published row carries a run — the feed cannot be characterized"

        for row in with_a_run[:5]:
            expected = await pool.fetchrow(
                "SELECT created_at, status FROM workflow_runs "
                "WHERE definition_id = $1 AND user_id = $2 "
                "ORDER BY created_at DESC, id DESC LIMIT 1",
                row["id"],
                me,
            )
            assert row["last_run_at"] == expected["created_at"], row["slug"]
            assert row["last_run_status"] == expected["status"], row["slug"]
    finally:
        await pool.close()


@live
async def test_a_definition_with_no_runs_carries_explicit_nulls():
    """Assertion 3, LIVE. 69% of the library has never run; it must survive with honest nulls.

    POSITIVE CONTROL is the test above — rows WITH runs carry real values on the same call.
    """
    from app.db.workflows import list_published_workflows

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)
        rows = await list_published_workflows(pool, user_id=me)
        never_run = [r for r in rows if r["last_run_at"] is None]

        assert never_run, "every published row has a run — the null arm is unexercised"
        for row in never_run[:5]:
            assert row["last_run_status"] is None, row["slug"]
            # And it really has none — verified against the table, not inferred from the join.
            count = await pool.fetchval(
                "SELECT count(*) FROM workflow_runs WHERE definition_id = $1 AND user_id = $2",
                row["id"],
                me,
            )
            assert count == 0, row["slug"]
    finally:
        await pool.close()


@live
async def test_another_users_runs_are_NOT_inherited_on_a_world_readable_row():
    """⚠ T-10, LIVE, on a REAL global row with REAL runs — the security assertion.

    ``research_summarize`` and its four siblings are ``is_system_global`` published rows
    visible to EVERY caller, and they carry 20 / 15 / 11 / 7 / 1 runs belonging to ONE user.
    An unscoped lateral would hand a second caller that activity. The same row is fetched
    twice — once as the real runner (facts present) and once as a stranger (facts absent) —
    so the negative cannot pass because the join is simply broken.
    """
    from app.db.workflows import list_published_workflows

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)
        stranger = uuid4()

        globals_with_runs = await pool.fetch(
            "SELECT DISTINCT d.id FROM workflow_definitions d "
            "JOIN workflow_runs r ON r.definition_id = d.id "
            "WHERE d.status = 'published' AND d.is_system_global = true "
            "AND r.user_id = $1",
            me,
        )
        target_ids = {r["id"] for r in globals_with_runs}
        assert target_ids, "no global published row carries a run — T-10 is unexercised"

        mine = {r["id"]: r for r in await list_published_workflows(pool, user_id=me)}
        theirs = {
            r["id"]: r for r in await list_published_workflows(pool, user_id=stranger)
        }

        for def_id in target_ids:
            # POSITIVE CONTROL — the runner really does see the facts on this very row.
            assert mine[def_id]["last_run_at"] is not None, def_id
            assert mine[def_id]["last_run_status"] is not None, def_id
            # THE ASSERTION — the stranger still SEES the row (visibility did not narrow)
            # and inherits NOTHING from it (visibility did not widen).
            assert def_id in theirs, f"{def_id} vanished for a second caller"
            assert theirs[def_id]["last_run_at"] is None, def_id
            assert theirs[def_id]["last_run_status"] is None, def_id
    finally:
        await pool.close()


@live
async def test_owner_scoping_is_unchanged_for_a_second_caller():
    """Assertion 5. The row set a caller may see is decided by the WHERE clause and by nothing
    the join added — so a stranger's row set is exactly the shipped query's row set."""
    from app.db.workflows import list_draft_workflows, list_published_workflows

    pool = await _pool()
    try:
        stranger = uuid4()

        before = await pool.fetch(_SHIPPED_PUBLISHED_ALL, stranger)
        after = await list_published_workflows(pool, user_id=stranger)
        assert [r["id"] for r in before] == [r["id"] for r in after]

        # A stranger owns no drafts — and still owns none after the join.
        assert await list_draft_workflows(pool, user_id=stranger) == []
    finally:
        await pool.close()


@live
async def test_the_starters_shelf_carries_run_facts_for_the_caller_who_ran_one():
    """C-6 proved against real data rather than against a fixture.

    The live shelf is 3 rows, exactly ONE of which has ever been run — so this single call
    exercises both arms of D-08 on the feed the 192.1 precedent warns is easiest to forget.
    """
    from app.db.workflows import list_starter_workflows

    pool = await _pool()
    try:
        me = await _the_user_who_runs_things(pool)
        rows = await list_starter_workflows(pool, user_id=me)

        assert rows, "the starters shelf is empty — nothing to characterize"
        assert any(r["last_run_at"] is not None for r in rows), rows
        assert any(r["last_run_at"] is None for r in rows), rows
        for row in rows:
            if row["last_run_at"] is None:
                assert row["last_run_status"] is None, row["slug"]
            else:
                assert row["last_run_status"] is not None, row["slug"]
    finally:
        await pool.close()
