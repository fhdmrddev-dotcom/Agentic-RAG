"""Phase 192.1 (LIB-05 / D-15, D-16, D-17) — the ``updated_at`` ADDITIVE projection.

SC#3 ("a user can tell which workflow changed most recently") needs a timestamp the client
can read. This file pins the whole hop, and — the part that matters — pins that widening the
projection did NOT widen the access boundary.

What is pinned, and why each pin exists:

  • **All three feeds serialize it.** ``/published``, ``/starters`` and ``/drafts``. The first
    two share ONE response model (RESEARCH C-6), so a field added for the Published shelf and
    not mirrored on the Starters handler leaves every starter card silently missing its
    "changed <rel>" segment while the type claims it has one. Asserted per handler.

  • **THE PROJECTION WIDENED AND THE PREDICATE DID NOT (D-15).** This is the load-bearing
    group. ``list_published_workflows`` runs on a service-role asyncpg pool that BYPASSES
    RLS (``db/workflows.py`` — "this pool bypasses RLS, so whatever leaves the API layer is
    what the caller gets"), so the ``WHERE`` clause is the ONLY access boundary. Widening a
    predicate here is the mig-116 / CR-01 information-disclosure shape Phase 190's review
    caught. The SQL is asserted directly: the ``updated_at`` column is present in the SELECT
    list AND each shipped predicate substring is byte-identical.

  • **⚠ D-16 — ``token`` IS NOT THE TIMESTAMP, AND THE TWO MUST NOT COLLAPSE.**
    ``CONCURRENCY_TOKEN_SQL`` is ``to_char(updated_at AT TIME ZONE 'UTC', …)``, so the drafts
    feed has ALWAYS shipped ``updated_at`` in disguise. The cheap move is to parse ``token``
    and skip the new column; it is forbidden, because the token is opaque by contract —
    Postgres keeps MICROSECONDS, a JS ``Date`` keeps milliseconds, and a
    parsed-and-re-rendered token matches ZERO rows, after which every save refuses as stale
    (probed live 2026-08-01). Pinned two ways: the token expression is byte-identical, and
    the two response fields are proved to be independently sourced.

  • **THE "FAIL LOUDLY" GUARD, RELOCATED ON PURPOSE.** ``192.1-01-PLAN.md`` asked the
    builders to read ``r["updated_at"]`` so a silently-dropped column would raise. Measured,
    that reading raises ``KeyError`` against the shipped
    ``test_row_dict_missing_both_columns_serializes_with_defaults``, which exists to pin that
    a pre-192 row dict still flows through both handlers. The builders therefore use
    ``r.get(...)`` — matching every sibling optional column in the same expression — and the
    dropped-column guard lives HERE instead, as the SELECT-list assertions below. That fails
    in CI rather than at runtime, which is strictly earlier.

  • **D-17 is documented, not "fixed".** A published row is immutable
    (``workflow_definitions_block_published``), so its ``updated_at`` is frozen at the publish
    flip — "changed <rel>" honestly means "when it was published". Pinned as a prose
    assertion on the builder's comment so a later reader cannot quietly add a second field.

House shape (``test_published_workflow_ownership.py:33-36``): imports live INSIDE the test
bodies so ``--collect-only`` stays clean. **This suite touches NO database** — the db-layer
feeds are monkeypatched and the pool is a sentinel, so it performs zero
INSERT/UPDATE/DELETE and is safe to run concurrently with other worktrees (CLAUDE.md
§ Parallel execution, rule 4).
"""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from uuid import UUID

import pytest

_CALLER = UUID("11111111-1111-1111-1111-111111111111")
_OTHER = UUID("22222222-2222-2222-2222-222222222222")
_SEED_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")

# Deliberately carries MICROSECONDS (``…123456``). A value with 0 microseconds would let a
# ``datetime``-typed field pass by luck — the exact drop-the-fraction trap
# ``DraftCreateResponse.token``'s binding warning records.
_UPDATED = datetime(2026, 8, 12, 9, 30, 15, 123456, tzinfo=timezone.utc)
_UPDATED_ISO = "2026-08-12T09:30:15.123456+00:00"

# The token is rendered by Postgres, never by Python. This is the shape
# ``CONCURRENCY_TOKEN_SQL`` produces, and it is deliberately NOT equal to ``_UPDATED_ISO``.
_TOKEN = "2026-08-12T09:30:15.123456Z"


def _published_row(*, created_by: UUID = _CALLER, updated_at: object = _UPDATED) -> dict:
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "slug": "vendor-risk-review",
        "name": "Vendor risk review",
        "definition": {"phases": []},
        "created_by": created_by,
        "is_system_global": False,
        "updated_at": updated_at,
    }


def _draft_row(*, updated_at: object = _UPDATED, token: str = _TOKEN) -> dict:
    return {
        "id": UUID("44444444-4444-4444-4444-444444444444"),
        "slug": "vendor-risk-review",
        "version": 2,
        "name": "Vendor risk review",
        "definition": {"phases": []},
        "token": token,
        "updated_at": updated_at,
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

    async def _fake_starters(pool):
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


# ── all three feeds carry the field ───────────────────────────────────────────────────
async def test_published_serializes_updated_at(monkeypatch):
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row()])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].updated_at == _UPDATED_ISO


async def test_starters_serializes_updated_at(monkeypatch):
    """C-6: ONE model, TWO feeds. The Starters handler must serialize it too."""
    from app.api.workflows import get_starter_workflows

    _patch_starters(monkeypatch, [_published_row(created_by=_SEED_SYSTEM_USER)])
    out = await get_starter_workflows(current_user={"id": str(_CALLER)})

    assert out[0].updated_at == _UPDATED_ISO


async def test_drafts_serializes_updated_at(monkeypatch):
    from app.api.workflows import list_drafts

    _patch_drafts(monkeypatch, [_draft_row()])
    out = await list_drafts(current_user={"id": str(_CALLER)})

    assert out[0].updated_at == _UPDATED_ISO


async def test_the_microseconds_survive_the_wire(monkeypatch):
    """The whole reason the field is typed ``str`` and formatted in the builder.

    A ``datetime``-typed model field re-serializes through Pydantic and drops the fractional
    part when microseconds are 0, so the wire width would vary with the clock. Asserted on
    the JSON dump, which is what the browser actually receives.
    """
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row()])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].model_dump(mode="json")["updated_at"] == _UPDATED_ISO
    assert "123456" in out[0].model_dump(mode="json")["updated_at"]


@pytest.mark.parametrize("absent", [None, "missing-key"])
async def test_a_row_without_the_column_degrades_to_none(monkeypatch, absent):
    """No fabricated time. ``None`` means "the row did not say", and the card renders nothing.

    POSITIVE CONTROL is the test directly above — a row WITH the column yields the string —
    so this absence assertion cannot pass for the wrong reason.
    """
    from app.api.workflows import get_published_workflows

    row = _published_row()
    if absent == "missing-key":
        del row["updated_at"]
    else:
        row["updated_at"] = None

    _patch_published(monkeypatch, [row])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert out[0].updated_at is None


def test_both_models_default_the_field_so_an_old_row_still_validates():
    """Additive AND defaulted — the ``is_mine`` precedent, so a stale deploy degrades."""
    from app.api.workflows import DraftRow, PublishedWorkflow

    pub = PublishedWorkflow(id=_OTHER, slug="s", name="N")
    assert pub.updated_at is None

    draft = DraftRow(id=_OTHER, slug="s", version=1, token=_TOKEN)
    assert draft.updated_at is None


def test_both_models_type_it_as_str_never_datetime():
    """``str``, for the ``DraftCreateResponse.token`` reason (:184-188)."""
    from app.api.workflows import DraftRow, PublishedWorkflow

    for model in (PublishedWorkflow, DraftRow):
        annotation = str(model.model_fields["updated_at"].annotation)
        assert "str" in annotation, annotation
        assert "datetime" not in annotation, annotation


# ── D-15: THE PROJECTION WIDENED; THE PREDICATE DID NOT ───────────────────────────────
#
# The access boundary is the WHERE clause and nothing else — this pool bypasses RLS. These
# assert the SQL text directly, which is also the dropped-column guard the builders' use of
# ``r.get(...)`` relocates here (see this module's docstring).


def _published_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_published_workflows)


def _starter_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_starter_workflows)


def _draft_source() -> str:
    from app.db import workflows as db

    return inspect.getsource(db.list_draft_workflows)


def test_published_projects_updated_at_in_both_select_lists():
    """TWO SELECT lists — the ``owned_only`` branch and the default branch."""
    source = _published_source()
    select_lists = [
        line
        for line in source.splitlines()
        if "SELECT id, slug, name" in line and not line.strip().startswith("#")
    ]

    assert len(select_lists) == 2, select_lists
    for line in select_lists:
        assert "updated_at" in line, line


def test_starter_projects_updated_at():
    select_lists = [
        line
        for line in _starter_source().splitlines()
        if "SELECT id, slug, name" in line and not line.strip().startswith("#")
    ]

    assert len(select_lists) == 1, select_lists
    assert "updated_at" in select_lists[0]


def test_draft_projects_updated_at():
    select_lists = [
        line
        for line in _draft_source().splitlines()
        if "SELECT id, slug, version" in line and not line.strip().startswith("#")
    ]

    assert len(select_lists) == 1, select_lists
    assert "updated_at" in select_lists[0]


@pytest.mark.parametrize(
    "predicate",
    [
        "status = 'published' AND created_by = $1",
        "status = 'published' AND (is_system_global = true OR created_by = $1)",
    ],
)
def test_published_predicates_are_byte_identical_to_what_shipped(predicate):
    """T-192.1-01. Widening one of these is the mig-116 / CR-01 shape, not a projection."""
    assert predicate in _published_source()


def test_starter_predicate_is_byte_identical_to_what_shipped():
    source = _starter_source()

    assert "WHERE status = 'published' AND is_system_global = true " in source
    assert "AND definition->>'category' = 'starter' " in source


def test_draft_predicate_is_byte_identical_to_what_shipped():
    """The drafts owner-scope: a second user's draft is ABSENT (T-103-01-01)."""
    assert "WHERE status = 'draft' AND created_by = $1 " in _draft_source()


def test_no_feed_orders_by_updated_at():
    """CONTEXT is explicit that 160-C (recency ORDERING) LOST. ``ORDER BY name`` stands.

    SC#3 is met by the "changed <rel>" segment on the card, never by re-ordering the list —
    so a future "obvious improvement" here is a scope-fence violation, and this says so.
    """
    for source in (_published_source(), _starter_source(), _draft_source()):
        assert "ORDER BY name" in source
        assert "ORDER BY updated_at" not in source


# ── D-16: the token and the timestamp are two fields, and stay two ────────────────────


def test_concurrency_token_sql_still_renders_from_to_char():
    """The token expression is untouched — it is the thing a save compares byte-for-byte."""
    from app.db.workflows import CONCURRENCY_TOKEN_SQL

    assert CONCURRENCY_TOKEN_SQL == (
        "to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
    )


def test_draft_select_keeps_the_token_alias_alongside_the_new_column():
    """Both, on one row: ``… AS token, updated_at``. Not one derived from the other."""
    source = _draft_source()

    assert "AS token, updated_at " in source


async def test_draft_updated_at_is_not_parsed_out_of_the_token(monkeypatch):
    """The mechanical form of D-16: feed a token that DISAGREES with the column.

    If any code path ever derived ``updated_at`` from ``token``, this row would report the
    token's time. It reports the column's, so the two are independently sourced.
    """
    from app.api.workflows import list_drafts

    _patch_drafts(
        monkeypatch,
        [_draft_row(token="1999-01-01T00:00:00.000001Z")],
    )
    out = await list_drafts(current_user={"id": str(_CALLER)})

    assert out[0].token == "1999-01-01T00:00:00.000001Z"
    assert out[0].updated_at == _UPDATED_ISO
    assert out[0].updated_at != out[0].token


async def test_the_token_still_reaches_the_client_verbatim(monkeypatch):
    """The 186 contract survives the addition — the builder echoes the token untouched."""
    from app.api.workflows import list_drafts

    _patch_drafts(monkeypatch, [_draft_row()])
    out = await list_drafts(current_user={"id": str(_CALLER)})

    assert out[0].token == _TOKEN


# ── the disclosure fence still holds with the wider projection ────────────────────────


async def test_widened_projection_still_emits_no_raw_creator_uuid(monkeypatch):
    """T-192.1-01 at the serialization boundary, re-run now that the SELECT is wider.

    The db layer now hands the API layer one more column; the response must still carry no
    other user's identifier. Re-asserted here rather than assumed from
    ``test_published_workflow_ownership.py``, because the row shape it fences has changed.
    """
    from app.api.workflows import get_published_workflows

    _patch_published(monkeypatch, [_published_row(created_by=_OTHER)])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    dumped = out[0].model_dump(mode="json")
    assert "created_by" not in dumped
    assert str(_OTHER) not in str(dumped)
    assert out[0].is_mine is False
    assert out[0].updated_at == _UPDATED_ISO


async def test_a_non_owner_sees_only_global_rows_after_the_widening(monkeypatch):
    """The access boundary did not move — asserted end to end, not just as SQL text.

    The db layer is stubbed to behave as the SHIPPED predicate does: a non-owner's request
    returns only ``is_system_global`` rows. The handler must pass those through with
    ``is_mine=False`` and must not resurrect the private row from anywhere else. Paired with
    ``test_published_predicates_are_byte_identical_to_what_shipped`` above, which pins that
    the real query still contains that predicate.
    """
    from app.api.workflows import get_published_workflows

    private = _published_row(created_by=_OTHER)
    private["id"] = UUID("55555555-5555-5555-5555-555555555555")
    private["slug"] = "someone-elses-private-workflow"

    glob = _published_row(created_by=_SEED_SYSTEM_USER)
    glob["is_system_global"] = True

    # What the shipped predicate yields for a caller who owns neither row: the global only.
    _patch_published(monkeypatch, [glob])
    out = await get_published_workflows(current_user={"id": str(_CALLER)})

    assert len(out) == 1
    assert out[0].is_system_global is True
    assert out[0].is_mine is False
    assert str(private["slug"]) not in str([r.model_dump(mode="json") for r in out])


# ── D-17: the published-row semantics are recorded where they cannot rot ──────────────


def test_d17_is_recorded_at_the_published_builder():
    """A published row's ``updated_at`` IS its publish time, and that is honest.

    Pinned as source prose because the alternative failure — a later reader "fixing" it by
    adding a second field — is a design regression no behavioural test would catch.
    """
    from app.api import workflows as wf

    source = inspect.getsource(wf.get_published_workflows)

    assert "D-17" in source
    assert "immutable" in source
    assert "publish flip" in source
