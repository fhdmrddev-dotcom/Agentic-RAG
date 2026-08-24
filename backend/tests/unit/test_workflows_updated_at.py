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

import ast
import inspect
import textwrap
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

    # ⚠ ``**kwargs`` since Phase 192.2 (LIB-06 / D-07): ``/starters`` now hands the db layer
    # the caller id its owner-scoped run-facts lateral binds as ``$1``. Matching
    # ``_fake_published`` above, whose fake has always been tolerant for the same reason —
    # a fake that is stricter than the seam it stands in for fails on the seam's growth, not
    # on a defect.
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


# ── F-1 — the D-16 ORDER BY divergence (Phase 193.2 / BUG-260815-02) ──────────────────
#
# ⚠ THE FENCE BELOW IS VERIFIED OVER NON-COMMENT CODE, and that is this repository's own
# recorded resolution rather than a convenience. **The 187-24 trap: a module that DOCUMENTS a
# clause reds a raw grep for it.** It is live on this exact file pair —
# ``193.2-BASELINE.md`` §1 measured
# ``git show HEAD:backend/app/db/workflows.py | grep -c "ORDER BY name"`` = **4**, not the 3
# call sites, because ``list_starter_workflows``' own docblock QUOTES the clause. That
# docblock is inside ``_starter_source()``, which is precisely the accessor this fence reads.
# A raw ``in`` here would judge a comment instead of a query. (Prior instances of the same
# trap: ``rowIdentity.test.ts:99`` and ``libraryFilter.test.ts:461-468`` both strip comments
# for the identical reason; 192.1-03 hit it on three greps at once.)


def _code_only(source: str) -> str:
    """The executable half of a ``inspect.getsource`` blob — comments and docstring removed.

    Parsed rather than regexed: ``ast`` cannot mistake a ``#`` inside a SQL string literal
    for a comment, and ``ast.unparse`` re-emits only the tree, so every ``#`` line and the
    function docstring are gone by construction. Implicitly-concatenated SQL fragments are
    joined into one literal, which is what a reader means by "the query text".
    """
    tree = ast.parse(textwrap.dedent(source))
    fn = tree.body[0]
    body = getattr(fn, "body", [])
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        fn.body = body[1:]
    return ast.unparse(tree)


def test_the_code_stripper_keeps_the_query_and_drops_the_prose():
    """NON-VACUITY FOR THE STRIPPER ITSELF. Without this, F-1 could pass by returning "".

    The pairing is the whole point: ``D-16`` is written into all three feeds as a COMMENT
    (asserted by ``test_the_d16_divergence_is_recorded_at_all_three_sites``), so it must be
    visible in the raw source and invisible in the stripped code. If it survived the strip,
    the stripper is not stripping; if the query text did not, it is stripping too much.
    """
    for accessor, needle in (
        (_published_source, "list_published_workflows"),
        (_starter_source, "list_starter_workflows"),
        (_draft_source, "list_draft_workflows"),
    ):
        source = accessor()
        code = _code_only(source)

        assert len(source) > 500, needle
        assert needle in source
        assert needle in code, f"the stripper ate the function itself: {needle}"
        assert "SELECT id, slug" in code, needle
        # PROSE goes, CODE stays — the ``rowIdentity.test.ts:113-114`` idiom exactly.
        assert "D-16" in source, needle
        assert "D-16" not in code, f"the stripper left prose behind: {needle}"


def test_the_two_author_feeds_order_by_recency_and_starters_stay_alphabetical():
    """F-1 — Phase 193.2, D-15 / D-16. Formerly ``test_no_feed_orders_by_updated_at``.

    ⚠ **SUPERSEDED — the 192.1 reasoning this fence carried until 2026-08-15 is recorded
    here VERBATIM rather than deleted, because a fence whose history is erased cannot be
    audited.** What it said, in full:

        "CONTEXT is explicit that 160-C (recency ORDERING) LOST. ``ORDER BY name`` stands.

        SC#3 is met by the "changed <rel>" segment on the card, never by re-ordering the
        list — so a future "obvious improvement" here is a scope-fence violation, and this
        says so."

    **Superseding authority: ``BUG-260815-02`` (severity `blocking`), folded into Phase
    193.2 as D-15 / D-16.** A just-published workflow was unfindable — the AI names it, all
    three feeds sorted ``ORDER BY name``, and nothing anywhere sorted by recency.

    **Why the supersession is legitimate and not a fence being argued away:** the sentence
    above was a Phase 192.1 **SCOPE** fence — its job was to stop *that* phase widening from
    an additive projection into an ordering change — never a correctness rule about what the
    right order IS. 192.1 could not have known the ordering was the defect; the blocking
    report is what learned it. The fence is therefore rewritten in place, keeping its
    identity in ``git log -S "test_no_feed_orders_by_updated_at"``, and it now guards the
    DIVERGENCE instead of the uniformity.

    **What it guards now — a three-way split, not a global flip:**

      • ``list_published_workflows`` → ``ORDER BY updated_at DESC``. On this feed that IS
        ``ORDER BY publish-time DESC``: the publish flip is an ``UPDATE`` and
        ``workflow_definitions_set_updated_at`` is an unconditional ``BEFORE UPDATE``
        trigger, after which ``workflow_definitions_block_published`` freezes the row.
      • ``list_draft_workflows`` → ``ORDER BY updated_at DESC``. The author's own work.
      • ``list_starter_workflows`` → **still ``ORDER BY name``** (D-16). "Most recently
        updated starter" is meaningless to someone browsing a curated catalogue they did
        not write. ``BUG-260815-02`` warns *"change them together or the feeds disagree"*
        and this deliberately does not — accepted with eyes open, on the recorded condition
        that the divergence lives in the code, which the sibling case below asserts.

    ⚠ **AMENDED 2026-08-15 (code review ``WR-03``) — RECORDED BESIDE THE THREE BULLETS
    ABOVE RATHER THAN OVER THEM, because what those bullets say was true and INCOMPLETE,
    not wrong.** The two author feeds now read ``ORDER BY updated_at DESC, id DESC``. The
    reason is a MEASUREMENT, not a style preference: ``updated_at`` is **not unique**, and
    Postgres' ``now()`` is transaction-scoped, so every row touched by one migration or one
    bulk update carries an identical timestamp. Censused against the live local DB
    (``127.0.0.1:54322``, 225 rows) on the day this amendment was written:

        published rows sharing one updated_at : 39  (2026-07-18 20:43:42.856183+00)
                                                 2  (2026-07-30 20:16:20.222893+00)
        draft     rows sharing one updated_at : 24  (2026-07-18 20:43:42.856183+00)

    Within a tie Postgres guarantees NO order at all, so a third of the library was free to
    reshuffle between two fetches — on a feed whose entire purpose this phase is *"find the
    thing that just changed"*. The old ``ORDER BY name`` was total in practice (names are
    near-unique); ``updated_at DESC`` alone is not, and the fence as first written could not
    see the difference.

    **Why ``id``:** it is the table's PRIMARY KEY (``workflow_definitions_pkey``), therefore
    ``NOT NULL`` and unique — measured against ``pg_constraint``/``pg_attribute``, not
    assumed — and it is ALREADY in the SELECT list of both changed feeds, so nothing widens.

    **It orders WITHIN ties and nowhere else, and that is measured too.** Driving both
    clauses over all three live predicate shapes (drafts 78 rows, owned published 28,
    published-with-globals 91): the sequence of ``updated_at`` VALUES is identical with and
    without the tiebreaker, the top row is unchanged, every position that moved sits inside
    a tie group (0 outside), and two consecutive runs agree exactly. The recency behaviour
    D-15 bought is therefore untouched — a freshly published row has a unique fresh
    timestamp, is in no tie, and still lands first.

    ⚠ **The needle below is the FULL clause, deliberately.** ``"ORDER BY updated_at DESC"``
    is a PREFIX of ``"ORDER BY updated_at DESC, id DESC"``, so the pre-amendment needle
    stays green against a feed with no tiebreaker at all — it could not fire on this
    property. Asserting the whole clause is what makes the RED observable, and it was
    observed: run against the pre-amendment source, the published and draft arms both FAIL.

    ⚠ The starter's ABSENCE needle is scoped to ``ORDER BY updated_at``, never to the bare
    token ``updated_at`` — that feed legitimately PROJECTS the column in its SELECT list, so
    a bare ``not in`` would be red on a correct tree. Same scoping error, different shape.
    """
    published = _code_only(_published_source())
    starter = _code_only(_starter_source())
    draft = _code_only(_draft_source())

    # NON-VACUITY — a broken ``inspect.getsource`` returning "" must not read as a pass.
    for name, code in (
        ("list_published_workflows", published),
        ("list_starter_workflows", starter),
        ("list_draft_workflows", draft),
    ):
        assert code, f"empty source for {name}"
        assert name in code, f"{name} is not its own source"

    # POSITIVE CONTROLS — every needle really does catch the shape it judges.
    assert "ORDER BY updated_at DESC, id DESC" in 'sql += " ORDER BY updated_at DESC, id DESC"'
    assert "ORDER BY name" in 'sql += " ORDER BY name"'
    # …and the control that proves WHY the full clause is the needle: the OLD, shorter one
    # is satisfied by a feed carrying no tiebreaker whatsoever, so it cannot see WR-03.
    assert "ORDER BY updated_at DESC" in 'sql += " ORDER BY updated_at DESC"'

    # The two feeds holding the author's OWN work: recency, made TOTAL by a unique
    # tiebreaker (WR-03), and no trace of the old clause.
    for name, code in (("published", published), ("draft", draft)):
        assert "ORDER BY updated_at DESC, id DESC" in code, name
        assert "ORDER BY name" not in code, name

    # The curated shelf: alphabetical, NOT re-ordered by recency, and NOT given the
    # tiebreaker either — D-16 leaves this feed byte-identical to what shipped.
    assert "ORDER BY name" in starter
    assert "ORDER BY updated_at" not in starter
    assert "id DESC" not in starter
    # …but it still PROJECTS the column, which is why the needle above is scoped to the
    # clause. This assertion is what makes that scoping honest rather than convenient.
    assert "updated_at" in starter


def test_the_d16_divergence_is_recorded_at_all_three_sites():
    """The divergence is written into the code, at every site, as a recorded decision.

    Pinned as source prose for the same reason as
    ``test_d17_is_recorded_at_the_published_builder`` below: the alternative failure is a
    later reader "tidying" the inconsistency back into uniformity — restoring exactly the
    defect ``BUG-260815-02`` reports — and that is a design regression no behavioural test
    would catch. Two feeds sorting one way and a third sorting another looks like a bug
    unless the code says it is not.

    ⚠ **THE BARE ``D-16`` NEEDLE IS VACUOUS ON ONE OF THE THREE FEEDS, AND THAT WAS
    MEASURED RATHER THAN REASONED ABOUT.** ``193.2-03-PLAN.md`` specifies this case as
    *"assert each of the three sources contains the literal token ``D-16``"* — but the
    clause-by-clause RED probe run before the SQL changed reported ``'D-16' in draft
    source`` **already PASSING**. ``list_draft_workflows`` has carried a
    *"⚠ D-16 IS A FENCE, NOT ADVICE"* docblock since Phase **192.1**, where ``D-16`` names
    an entirely different decision — *the opaque concurrency token is not the timestamp*.
    **Two phases reused one decision id on one function.** So on that feed the specified
    needle would have been satisfied by a comment about something else, and one third of
    this fence could never have fired.

    The specified clause is KEPT (it is what the plan asks for and it is true), and a
    disambiguating clause is asserted BESIDE it: ``BUG-260815-02`` is unique to this
    supersession and appears nowhere in 192.1's vocabulary. That pairing is what makes the
    draft arm mean the ordering decision rather than the token one.
    """
    for name, accessor, extra in (
        ("list_published_workflows", _published_source, "D-15"),
        ("list_starter_workflows", _starter_source, None),
        ("list_draft_workflows", _draft_source, "D-15"),
    ):
        source = accessor()
        # The clause the plan specifies…
        assert "D-16" in source, name
        # …and the clauses that stop it passing for 192.1's unrelated ``D-16``.
        assert "BUG-260815-02" in source, name
        assert "193.2" in source, name
        if extra:
            assert extra in source, name


# ── D-16: the token and the timestamp are two fields, and stay two ────────────────────


def test_concurrency_token_sql_still_renders_from_to_char():
    """The token expression is untouched — it is the thing a save compares byte-for-byte."""
    from app.db.workflows import CONCURRENCY_TOKEN_SQL

    assert CONCURRENCY_TOKEN_SQL == (
        "to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
    )


def test_draft_select_keeps_the_token_alias_alongside_the_new_column():
    """Both, on one row: ``… AS token, updated_at``. Not one derived from the other.

    ⚠ AMENDED 2026-08-19 (Phase 192.2 / LIB-06, D-07) — RECORDED BESIDE THE ORIGINAL RATHER
    THAN OVER IT, because the needle was not wrong so much as OVER-SPECIFIED, and the
    distinction is what keeps this from reading as a fence being argued away. It was:

        assert "AS token, updated_at " in source

    ⚠ **The load-bearing character was the TRAILING SPACE**, which pinned that ``updated_at``
    was the LAST column of the drafts SELECT — a property this test never claimed and never
    needed. Phase 192.2 appends ``lr.last_run_at, lr.last_run_status`` to that same
    projection, so the line now reads ``… AS token, updated_at,`` and the shipped needle went
    red against a tree where **the property it names is perfectly intact**. That is the
    187-24 trap in its other form: a needle judging one character more than its own sentence.

    The needle is narrowed to the adjacency it actually asserts. It still fails if ``token``
    and ``updated_at`` stop being two independently-projected columns on one row, which is
    D-16's whole point (``token`` is ``to_char(updated_at …)`` in disguise and the cheap move
    is to parse it — forbidden, because Postgres keeps microseconds and a JS ``Date`` keeps
    milliseconds, so a re-rendered token matches ZERO rows). The behavioural half of that
    property is pinned independently by
    ``test_draft_updated_at_is_not_parsed_out_of_the_token`` directly below, which no
    projection edit can satisfy by accident.
    """
    source = _draft_source()

    assert "AS token, updated_at" in source
    # NON-VACUITY — the needle must still catch the collapse it exists to forbid.
    assert "AS token, updated_at" not in "SELECT id, to_char(updated_at) AS token FROM t"


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
