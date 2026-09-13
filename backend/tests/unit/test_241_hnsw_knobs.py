"""Phase 241 (QUEUE-06 / D-09 / D-12) — the HNSW search knobs are SETTINGS, not constants.

241-CONTEXT F-2, measured live on 2026-09-10::

    hnsw.ef_search = 40      hnsw.iterative_scan = off      pgvector 0.8.0      PostgreSQL 17.6

`match_document_chunks` applies SEVEN predicates INSIDE the ``ORDER BY … <=> … LIMIT`` scan, so
the index walks 40 global candidates, discards with the predicates, and only then takes
``hybrid_candidate_count = 20``. That is the collapse mechanism, and the remedy the operator asked
for is a knob **in the shipped Settings UI** — not a number baked into a migration or a constant.

⚠ EVERY CASE HERE RUNS WITHOUT A DATABASE. The migration that carries the two columns
(``176_app_settings_hnsw_knobs.sql``) is AUTHORED by this plan and pasted by an operator in
241-04, so the *authored-but-not-applied* state is the state these cases must prove is harmless
(D-12). ``test_an_empty_row_reads_the_live_server_configuration`` IS that proof.

Task 2's cases (the ``SET LOCAL`` seam) live in the second half of this file.
"""

from __future__ import annotations

import ast
import asyncio
import inspect
import pathlib
import re
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
import app.models.user_settings as us
from app.config import settings as env_settings
from app.models.user_settings import _build_settings_from_row

# ─────────────────────────────────────────────────────────────────────────────
# Task 1 — the settings chain: migration 176 -> config.py -> _val -> the API
# ─────────────────────────────────────────────────────────────────────────────

#: The live server configuration measured 2026-09-10 (241-CONTEXT F-2). Written out here
#: DELIBERATELY rather than imported: if the shipped defaults ever drift away from what the
#: server actually does, the fail-soft claim ("applying these settings changes nothing until an
#: operator sets a value") stops being true and this file must say so.
LIVE_SERVER_EF_SEARCH = 40
LIVE_SERVER_ITERATIVE_SCAN = "off"
CODE_DEFAULT_EF_SEARCH = 40


def test_an_empty_row_reads_the_live_server_configuration():
    s = _build_settings_from_row({})
    assert s.hnsw_ef_search == CODE_DEFAULT_EF_SEARCH
    assert s.hnsw_iterative_scan == LIVE_SERVER_ITERATIVE_SCAN


def test_a_stored_value_wins_over_the_fallback():
    """The whole point: once the column exists and carries a value, that value is what ships."""
    s = _build_settings_from_row(
        {"hnsw_ef_search": 200, "hnsw_iterative_scan": "relaxed_order"}
    )
    assert s.hnsw_ef_search == 200
    assert s.hnsw_iterative_scan == "relaxed_order"


def test_the_config_defaults_are_the_minimal_hardcoded_values_d09_names():
    assert env_settings.hnsw_ef_search == CODE_DEFAULT_EF_SEARCH
    assert env_settings.hnsw_iterative_scan == LIVE_SERVER_ITERATIVE_SCAN


def test_the_val_fallback_literal_is_the_same_number_config_holds():
    src = " ".join(inspect.getsource(_build_settings_from_row).split())

    m_ef = re.search(r'_val\(\s*row,\s*"hnsw_ef_search",\s*"hnsw_ef_search",\s*(\d+)\s*\)', src)
    assert m_ef, (
        "POSITIVE CONTROL FAILED — the shipped `_val` call for hnsw_ef_search is not in the "
        "form this fence reads. Re-point the fence before trusting it."
    )
    assert int(m_ef.group(1)) == CODE_DEFAULT_EF_SEARCH == env_settings.hnsw_ef_search

    m_it = re.search(
        r'_val\(\s*row,\s*"hnsw_iterative_scan",\s*"hnsw_iterative_scan",\s*"([a-z_]+)"\s*\)', src
    )
    assert m_it, (
        "POSITIVE CONTROL FAILED — the shipped `_val` call for hnsw_iterative_scan is not in "
        "the form this fence reads. Re-point the fence before trusting it."
    )
    assert m_it.group(1) == LIVE_SERVER_ITERATIVE_SCAN == env_settings.hnsw_iterative_scan


def test_the_memory_companions_are_hardcoded_only_and_never_settings():
    """D-09 / T-241-16. ``max_scan_tuples`` and ``scan_mem_multiplier`` matter only once
    iterative scan is ON, and a wrong value there is a MEMORY FOOTGUN rather than a tuning
    choice with a safe bounded control. They live in ``config.py`` and nowhere else: no
    ``UserEffectiveSettings`` field, no request field, no column an operator could reach.
    """
    assert env_settings.hnsw_max_scan_tuples == 20000
    assert env_settings.hnsw_scan_mem_multiplier == 1.0

    for knob in ("hnsw_max_scan_tuples", "hnsw_scan_mem_multiplier"):
        assert knob not in us.UserEffectiveSettings.model_fields, (
            f"{knob} became a setting — D-09 keeps it hardcoded because a wrong value is a "
            "memory footgun, not a tuning choice."
        )
        assert knob not in settings_api.SettingsUpdate.model_fields, (
            f"{knob} became writable through PATCH /settings — see T-241-16."
        )


# ── The bounds are SERVED, never re-typed by a form ───────────────────────────

async def test_the_response_serves_the_bounds_from_the_module_constants():
    """SEED-258's shape, applied here. The API STATES the bounds so the React form never owns a
    copy of them — *"a form carrying its own copy of 50 is a fourth private constant, which is
    the defect this replaced"* (``api/settings.py:79``).
    """
    resp = await settings_api._build_response(_build_settings_from_row({}))

    assert resp.hnsw_ef_search == CODE_DEFAULT_EF_SEARCH
    assert resp.hnsw_iterative_scan == LIVE_SERVER_ITERATIVE_SCAN
    assert resp.hnsw_ef_search_floor == us.HNSW_EF_SEARCH_FLOOR
    assert resp.hnsw_ef_search_ceiling == us.HNSW_EF_SEARCH_CEILING
    assert list(resp.hnsw_iterative_scan_values) == list(us.HNSW_ITERATIVE_SCAN_VALUES)


def test_the_bounds_live_in_exactly_one_module_and_the_api_imports_them():
    """The single source. ``api/settings.py`` re-exports the names (so callers may read
    ``settings_api.HNSW_EF_SEARCH_FLOOR``) but does not define a second pair."""
    assert settings_api.HNSW_EF_SEARCH_FLOOR is us.HNSW_EF_SEARCH_FLOOR
    assert settings_api.HNSW_EF_SEARCH_CEILING is us.HNSW_EF_SEARCH_CEILING
    assert settings_api.HNSW_ITERATIVE_SCAN_VALUES is us.HNSW_ITERATIVE_SCAN_VALUES

    # The floor sits BELOW the server default so a smaller value stays measurable; the ceiling
    # is pgvector's own maximum for hnsw.ef_search.
    assert us.HNSW_EF_SEARCH_FLOOR < LIVE_SERVER_EF_SEARCH
    # ⚠ FIXTURE PREMISE. `test_the_api_refuses_an_ef_search_outside_the_bounds` parametrises the
    # literal 1001 as "one past the maximum" — it must be evaluated at COLLECTION time, so it
    # cannot read the constant. Pin the relation here or that case rots into a second constant.
    assert us.HNSW_EF_SEARCH_CEILING == 1000


# ── The refusal ──────────────────────────────────────────────────────────────

def _patch(**kwargs):
    return asyncio.run(
        settings_api.update_settings(
            body=settings_api.SettingsUpdate(**kwargs),
            background_tasks=MagicMock(),
            current_user={"id": "u-241", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


@pytest.fixture(autouse=True)
def _no_database(monkeypatch):
    """⚠ RESTORES THIS FILE'S OWN STATED PROPERTY: *"EVERY CASE HERE RUNS WITHOUT A DATABASE."*

    CR-01 put a live column probe (`app_settings_has_hnsw_columns`) at the top of
    `update_settings`, ahead of the two bounds. It fails CLOSED, which is right for production
    and wrong here: on a database without migration 176 the refusal cases below would meet a
    409 about the migration instead of the 400 they are about, and the whole file's verdict
    would depend on whether somebody had pasted a migration. Stubbed TRUE so these cases test
    the bound. CR-01's own behaviour has its own file
    (`test_241_cr01_settings_write_without_migration.py`) and is not weakened by this.
    """
    async def _columns_exist() -> bool:
        return True

    monkeypatch.setattr(settings_api, "app_settings_has_hnsw_columns", _columns_exist)


def _capture_the_write(monkeypatch) -> dict:
    """Make ``update_settings`` writable without a database, and hand back what it wrote.

    Returns the dict `save_app_settings` is called with — which is the thing an accept-side
    case has to look at. "Did not raise" is only half of accepted; the other half is that the
    value reached the write, and a handler that silently dropped a key would satisfy the first
    half perfectly (Phase 240's "screen that discards its own answer").
    """
    saved: dict = {}

    async def _save(updates):
        saved.update(updates)
        return True

    async def _load():
        return _build_settings_from_row({})

    async def _response(*_a, **_kw):
        return "response-not-under-test"

    monkeypatch.setattr(settings_api, "save_app_settings", _save)
    monkeypatch.setattr(settings_api, "load_app_settings_async", _load)
    monkeypatch.setattr(settings_api, "_build_response", _response)
    return saved


@pytest.mark.parametrize(
    "bad",
    [
        0,  # a scan that walks nothing
        -1,
        1001,  # one past pgvector's own maximum; pinned to the constant below
        999_999_999,
    ],
)
def test_the_api_refuses_an_ef_search_outside_the_bounds(bad):
    """⚠ THE API IS THE BOUNDARY, NOT THE FORM (T-241-13). A ``NumberInput`` with min/max is a
    convenience for somebody who is not attacking anything; a PATCH carrying 999999999 has to be
    refused here or the bound does not exist.

    ⚠ And the CHECK constraint in migration 176 is the BACKSTOP, not the load-bearing arm:
    ``BUG-260909-01`` records that ``save_app_settings`` swallows a CHECK violation and returns
    as if it succeeded.
    """
    with pytest.raises(HTTPException) as exc:
        _patch(hnsw_ef_search=bad)
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert str(us.HNSW_EF_SEARCH_FLOOR) in detail
    assert str(us.HNSW_EF_SEARCH_CEILING) in detail


def test_the_refusal_states_the_COST_not_merely_the_range():
    """⭐ SEED-258's binding property for this file family, recorded in
    ``docs/HOT-FILE-LEDGER.md`` → ``backend/app/api/settings.py``: *"the refusal states the COST,
    not just the range"*.

    A bare "must be between 10 and 1000" leaves the operator exactly as blind as the constant
    did. Raising search breadth means more candidate vectors walked per query — slower searches
    and more memory — and that is the sentence a person deciding needs.
    """
    with pytest.raises(HTTPException) as exc:
        _patch(hnsw_ef_search=999_999_999)
    detail = str(exc.value.detail).lower()
    assert "candidate" in detail, (
        "the refusal names a range but never says what a bigger search breadth COSTS — more "
        "candidate vectors walked per query (SEED-258's shape, Phase 241 D-09)"
    )
    assert "memor" in detail or "slower" in detail


def test_the_api_refuses_an_iterative_scan_outside_the_enum():
    """A free-text mode reaches a Postgres GUC. Only the three pgvector modes are accepted, and
    the refusal names them."""
    with pytest.raises(HTTPException) as exc:
        _patch(hnsw_iterative_scan="on")
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    for member in us.HNSW_ITERATIVE_SCAN_VALUES:
        assert member in detail


def test_the_enum_has_THREE_members_not_a_boolean():
    """⛔ ``strict_order`` and ``relaxed_order`` are DIFFERENT modes and a toggle would silently
    drop one of them. pgvector 0.8's three values are the contract."""
    assert us.HNSW_ITERATIVE_SCAN_VALUES == ("off", "strict_order", "relaxed_order")
    assert settings_api.SettingsUpdate(hnsw_iterative_scan="strict_order").hnsw_iterative_scan == (
        "strict_order"
    )
    assert settings_api.SettingsUpdate(hnsw_iterative_scan="relaxed_order").hnsw_iterative_scan == (
        "relaxed_order"
    )


@pytest.mark.parametrize("ok", [10, 40, 200, 1000])
def test_the_api_accepts_both_boundaries_and_the_shipped_default(ok, monkeypatch):
    """An off-by-one here silently narrows what an operator may choose and nothing would say so.

    ⛔ THIS CASE USED TO CONSTRUCT A PYDANTIC MODEL AND READ THE FIELD BACK (241-REVIEW WR-07).
    The bound is `if not FLOOR <= body.hnsw_ef_search <= CEILING` inside `update_settings`;
    `SettingsUpdate(...)` never sees it. Tightening the comparison to `<` left all four
    parameters GREEN while an operator entering 1000 was refused by a message saying 1000 is
    allowed, against an `<input min="10" max="1000">` that accepts it. Measured: with `<`
    planted, the old form stayed 4 passed and this form goes 2 failed (10 and 1000).

    Both halves are asserted, because they are different claims: the request was not refused,
    AND the value reached the write rather than being quietly dropped.
    """
    saved = _capture_the_write(monkeypatch)
    _patch(hnsw_ef_search=ok)                       # must NOT raise
    assert saved["hnsw_ef_search"] == ok, (
        f"the API accepted hnsw_ef_search={ok} and then did not write it: {saved!r}"
    )


# -- WR-07 (241-REVIEW): a fence that cannot fail for the reason its docstring gives -----
#
# `test_the_api_accepts_both_boundaries_and_the_shipped_default` constructed a Pydantic model
# and read the field back. The bound it claims to guard lives in `update_settings`, and that
# function was never called -- so tightening
#
#     if not FLOOR <= body.hnsw_ef_search <= CEILING      ->      if not FLOOR < ... < CEILING
#
# leaves all four of its parameters GREEN while an operator entering 1000 is refused by a
# message that says 1000 is allowed, against an `<input min="10" max="1000">` that accepts it.
#
# The vacuity is a CLASS, not one case: the file's own `_patch()` helper is the tool that
# reaches the boundary, and eight lines above it the refusal cases use it. So the guard below
# is written over the class rather than over the one case -- a re-written case that later drifts
# back to round-tripping a model would fail here on the day it is written, not at the next review.


def _api_cases_that_never_reach_the_handler() -> list[str]:
    """Cases named for what THE API does that never call ``_patch`` (i.e. ``update_settings``).

    Read from this file's own AST. A name is deliberately part of the contract: a case called
    ``test_the_api_...`` is making a claim about the request boundary, and the only way to make
    that claim true is to cross it.
    """
    tree = ast.parse(pathlib.Path(__file__).read_text(encoding="utf-8"))
    offenders: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if not node.name.startswith("test_the_api_"):
            continue
        calls = {
            getattr(c.func, "id", None) or getattr(c.func, "attr", None)
            for c in ast.walk(node)
            if isinstance(c, ast.Call)
        }
        if "_patch" not in calls:
            offenders.append(node.name)
    return offenders


def test_the_ast_helper_has_a_positive_control():
    """A fence with no positive control can pass vacuously -- which is the very finding here."""
    tree = ast.parse(pathlib.Path(__file__).read_text(encoding="utf-8"))
    names = {
        n.name
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        and n.name.startswith("test_the_api_")
    }
    assert len(names) >= 3, f"the scan found almost no api cases to check: {sorted(names)}"
    assert "test_the_api_refuses_an_ef_search_outside_the_bounds" in names
    assert "test_the_api_refuses_an_ef_search_outside_the_bounds" not in (
        _api_cases_that_never_reach_the_handler()
    ), "the helper cannot see `_patch` even where it is plainly called -- it is broken"


def test_every_api_case_actually_crosses_the_request_boundary():
    """The bound lives in ``update_settings``; a case that never calls it guards nothing."""
    offenders = _api_cases_that_never_reach_the_handler()
    assert not offenders, (
        "these cases are named for what the API does but never call update_settings, so the "
        "bound they claim to guard could be changed without any of them failing: "
        + ", ".join(offenders)
    )


def test_an_absent_field_is_not_a_write():
    """The partial-update contract every other knob on this handler keeps."""
    body = settings_api.SettingsUpdate()
    assert body.hnsw_ef_search is None
    assert body.hnsw_iterative_scan is None


# ─────────────────────────────────────────────────────────────────────────────
# Task 2 — the SET LOCAL seam: retrieval_tuning.py, and the landing on the hot file
# ─────────────────────────────────────────────────────────────────────────────
#
# ⛔ `backend/app/services/retrieval_service.py` FIRES G-5 at 18 / 10 / 423 and its extraction
#    has been OWED since Phase 231. D-11 takes a DELIBERATE SECOND landing on it, which is why
#    the helper lives in a NEW module: the hot file's whole delta is a call and its arguments.
#    Nothing below may be read as a discharge — the ledger row still says *extraction still OWED*.

import asyncpg  # noqa: E402

import app.services.retrieval_service as rs  # noqa: E402


def _tuning():
    """Import the module under test LAZILY, deliberately.

    Before ``retrieval_tuning.py`` exists a module-level import would make the whole file one
    collection error — and a collection error is an ABSENCE, not evidence. Imported here, the
    RED run names every case it breaks.
    """
    import app.services.retrieval_tuning as rt

    return rt


class _RecordingConn:
    """A connection that records every ``(sql, args)`` it is handed. No database.

    ``raise_on`` makes ONE knob's statement fail the way an older pgvector would, so the
    "degrade the tuning, never the search" arm is driven rather than asserted about.
    """

    def __init__(self, raise_on: str | None = None, exc: type[BaseException] | None = None):
        self.calls: list[tuple[str, tuple]] = []
        self._raise_on = raise_on
        self._exc = exc or asyncpg.exceptions.UndefinedObjectError

    async def execute(self, sql: str, *args):
        self.calls.append((sql, args))
        if self._raise_on and self._raise_on in sql:
            raise self._exc(f"unrecognized configuration parameter {self._raise_on!r}")
        return "SELECT 1"

    async def fetch(self, sql: str, *args):
        self.calls.append((sql, args))
        return []

    def is_in_transaction(self) -> bool:
        return True


def _names(conn: _RecordingConn) -> list[str]:
    """The GUC each recorded statement targets — read out of the statement's LITERAL, which is
    only possible because the name is a literal. That is the invariant, read back."""
    return [sql.split("'")[1] for sql, _ in conn.calls if "set_config" in sql]


async def test_the_guc_name_is_a_literal_and_only_the_value_is_bound():
    """⛔ T-241-14 — THE INJECTION SHAPE, and this module's one binding invariant.

    A Postgres session parameter cannot take a bind parameter for its NAME, so the only safe
    form is ``SELECT set_config('<literal>', $1, true)``. If a caller's string could reach the
    statement TEXT, an operator-settable field would be an injection vector into a ``SET``.
    """
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=200, iterative_scan="relaxed_order")

    assert conn.calls, "no statement was issued at all"
    for sql, args in conn.calls:
        assert "set_config" in sql
        assert "$1" in sql, f"the value is not a bind parameter: {sql!r}"
        for value in args:
            assert str(value) not in sql, (
                f"a caller value {value!r} was interpolated into the statement text: {sql!r}"
            )

    assert "hnsw.ef_search" in _names(conn)
    assert "hnsw.iterative_scan" in _names(conn)


def test_the_module_never_builds_a_SET_statement_by_concatenation():
    """A SOURCE fence beside the behavioural one above, because a behavioural test can only see
    the call shapes somebody thought to drive. Comments are stripped first, so the prose
    explaining the rule cannot satisfy the rule."""
    rt = _tuning()
    body = "\n".join(
        line for line in inspect.getsource(rt).splitlines() if not line.strip().startswith("#")
    )
    assert 'f"SET' not in body and "f'SET" not in body, (
        "an f-string SET statement appeared in retrieval_tuning.py — the GUC name must be a "
        "hardcoded literal and only the VALUE may be bound (T-241-14)"
    )
    assert '"SET LOCAL " +' not in body and "'SET LOCAL ' +" not in body
    assert "set_config" in body, (
        "POSITIVE CONTROL FAILED — the scan cannot find set_config in retrieval_tuning.py, so "
        "both assertions above would pass vacuously."
    )


async def test_every_knob_is_applied_LOCAL_to_the_transaction():
    """⛔ D-10 / T-241-15 — the property the whole remedy's safety rests on.

    ``get_user_pg_connection`` opens ``async with conn.transaction()`` and its own docstring
    states *"the COMMIT at context exit auto-reverts every SET LOCAL"*. That is what stops a
    knob leaking to the NEXT borrower of the pooled connection. ``set_config``'s third argument
    is what makes it local — assert the ARGUMENT, never a comment, so a future refactor to
    ``false`` turns this red instead of leaking silently.
    """
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=200, iterative_scan="strict_order")

    assert conn.calls
    for sql, _args in conn.calls:
        assert "true" in sql.split(",")[-1], (
            f"set_config's is_local argument is not true — the knob would OUTLIVE the "
            f"transaction and leak to the next pool borrower: {sql!r}"
        )


async def test_a_knob_the_server_does_not_know_degrades_the_TUNING_not_the_SEARCH():
    """⚠ NOT DEFENSIVE DECORATION. ``hnsw.iterative_scan`` DOES NOT EXIST below pgvector 0.8 and
    cloud parity is UNVERIFIED (D-14). An unrecognised parameter must cost the tuning and
    nothing else — so ``ef_search`` is still applied, in either order of failure.
    """
    rt = _tuning()
    conn = _RecordingConn(raise_on="hnsw.iterative_scan")
    await rt.apply_hnsw_session_knobs(conn, ef_search=200, iterative_scan="relaxed_order")
    assert "hnsw.ef_search" in _names(conn), (
        "the ef_search knob was skipped because a DIFFERENT knob failed — each is applied in "
        "its own try, or one old GUC disables the remedy entirely"
    )

    conn2 = _RecordingConn(raise_on="hnsw.ef_search")
    await rt.apply_hnsw_session_knobs(conn2, ef_search=200, iterative_scan="relaxed_order")
    assert "hnsw.iterative_scan" in _names(conn2)


async def test_an_invalid_parameter_value_is_swallowed_too():
    """``InvalidParameterValueError`` is the other shape an unusable knob arrives in — a value
    the server will not accept for a parameter it DOES know."""
    rt = _tuning()
    conn = _RecordingConn(
        raise_on="hnsw.iterative_scan", exc=asyncpg.exceptions.InvalidParameterValueError
    )
    await rt.apply_hnsw_session_knobs(conn, ef_search=200, iterative_scan="relaxed_order")
    assert "hnsw.ef_search" in _names(conn)


async def test_the_default_configuration_issues_NO_statements():
    """⭐ THE CHOICE, PINNED RATHER THAN LEFT TO BE DISCOVERED.

    When the effective values ARE the pgvector server defaults (40 / "off") there is nothing to
    change: ``SET LOCAL`` reverts at COMMIT, so every transaction starts at the server's own
    configuration. Issuing the statements anyway would cost two extra round trips on EVERY
    search to assert what is already true — and, worse, would silently OVERRIDE a server whose
    ``postgresql.conf`` had been tuned away from 40 by somebody who meant it.

    So: nothing stored => this code touches nothing. That is the same fail-soft claim
    ``test_an_empty_row_reads_the_live_server_configuration`` makes one layer up, and THIS is
    the layer where it is actually true.
    """
    rt = _tuning()
    rt._set_server_ef_cache(40)
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=40, iterative_scan="off")
    assert conn.calls == [], (
        "the default configuration issued statements — a no-op setting must cost no round trips "
        "and must never override a server tuned by hand"
    )

    conn2 = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn2, ef_search=None, iterative_scan=None)
    assert conn2.calls == []


async def test_the_memory_companions_ride_only_when_iterative_scan_is_ON():
    """D-09 / T-241-16. Read from ``config.py`` — never from a row, never from a request — and
    they mean nothing while iterative scan is off."""
    rt = _tuning()
    off = _RecordingConn()
    await rt.apply_hnsw_session_knobs(off, ef_search=200, iterative_scan="off")
    assert "hnsw.max_scan_tuples" not in _names(off)
    assert "hnsw.scan_mem_multiplier" not in _names(off)

    on = _RecordingConn()
    await rt.apply_hnsw_session_knobs(on, ef_search=200, iterative_scan="relaxed_order")
    by_name = {sql.split("'")[1]: args for sql, args in on.calls}
    assert by_name["hnsw.max_scan_tuples"][0] == str(env_settings.hnsw_max_scan_tuples)
    assert by_name["hnsw.scan_mem_multiplier"][0] == str(env_settings.hnsw_scan_mem_multiplier)


async def test_a_mode_outside_the_enum_never_reaches_the_database():
    """Validated against the three-member tuple BEFORE it is bound. The API refuses one on the
    way IN; this is the second door, because the value is also read back out of a database
    column a hand-edit could have written."""
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=None, iterative_scan="'; DROP TABLE x --")
    assert "hnsw.iterative_scan" not in _names(conn)


# -- WR-05 (241-REVIEW): the second door exists for iterative_scan, not for ef_search ----
#
# The module validates `iterative_scan` a SECOND time at the apply boundary and writes the
# reason out: *"this value is also READ BACK OUT of a database column that a hand-edit in the
# SQL editor could have written."* Every word of that applied to `ef_search` too, and
# `ef_search` had only `int()` -- `HNSW_EF_SEARCH_FLOOR` / `_CEILING` were not even imported
# here.
#
# AND THERE IS A ROUTE PAST BOTH OTHER DOORS. `config.py` declares `hnsw_ef_search: int = 40`
# on a `BaseSettings`, so `HNSW_EF_SEARCH=250000` in `backend/.env` is read by `_val`'s env
# link whenever the column is NULL -- the state of every row until an operator sets a value.
# That number has seen neither the API's 400 nor migration 176's CHECK.
#
# The observable cost is a WARNING logged on EVERY SINGLE SEARCH, forever, with the tuning
# silently inert -- `_set_local` swallows `InvalidParameterValueError` by design, which is
# right for "this server is too old" and wrong for "nobody chose this number".


async def test_an_ef_search_outside_the_bounds_never_reaches_the_database():
    """The second door for `ef_search`, symmetric with the one `iterative_scan` already had."""
    rt = _tuning()
    for bad in (250_000, 1001, 9, 0, -1):
        conn = _RecordingConn()
        await rt.apply_hnsw_session_knobs(conn, ef_search=bad, iterative_scan=None)
        assert "hnsw.ef_search" not in _names(conn), (
            f"ef_search={bad!r} was issued to the server; it is outside "
            f"{us.HNSW_EF_SEARCH_FLOOR}..{us.HNSW_EF_SEARCH_CEILING} and nobody could have "
            "chosen it through the API"
        )


async def test_an_out_of_range_ef_search_does_not_cost_the_OTHER_knob():
    """Degrade the TUNING, never the SEARCH -- and per knob, exactly as an unknown GUC does.

    An unusable `ef_search` is the same class of event as a `hnsw.iterative_scan` an old server
    does not know: it costs the knob it names and nothing else. This is deliberately NOT the
    early `return` the review's suggested patch sketched, because that arm would let one
    rejected number silently discard a mode the operator did choose.
    """
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=250_000, iterative_scan="relaxed_order")
    assert "hnsw.ef_search" not in _names(conn)
    assert "hnsw.iterative_scan" in _names(conn), (
        "a rejected ef_search took the iterative_scan mode down with it"
    )


@pytest.mark.parametrize("ok", [10, 200, 1000])
async def test_the_apply_boundary_bounds_are_INCLUSIVE(ok):
    """POSITIVE CONTROL. A clamp that refuses everything would satisfy the case above.

    The two boundaries are the ones the API serves to the form and accepts on the way in; a
    value an operator may legitimately save must not be discarded on the way out.
    """
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=ok, iterative_scan=None)
    assert _names(conn) == ["hnsw.ef_search"], (
        f"ef_search={ok} is inside the API's own bounds but was not applied"
    )


def test_the_apply_boundary_reads_THE_bounds_rather_than_re_typing_them():
    """SEED-258's shape: one home for the numbers.

    A re-typed copy here would drift from the ones the API refuses on and the UI renders, and
    the drift would be invisible -- the knob would simply stop working at some value nobody
    could name.
    """
    rt = _tuning()
    assert rt.HNSW_EF_SEARCH_FLOOR is us.HNSW_EF_SEARCH_FLOOR
    assert rt.HNSW_EF_SEARCH_CEILING is us.HNSW_EF_SEARCH_CEILING


async def test_the_config_env_route_is_bounded_too(monkeypatch):
    """WR-05's actual failure scenario, driven end to end rather than described.

    An operator (or a copied `.env.example`) carries `HNSW_EF_SEARCH=250000`. No column is set,
    so `_val` returns the env field, the settings object carries it, and `_vector_search` hands
    it straight to the apply boundary. Neither the API nor the CHECK constraint was ever
    consulted, because neither was ever on this path.
    """
    monkeypatch.setattr(env_settings, "hnsw_ef_search", 250_000)
    s = _build_settings_from_row({})
    assert s.hnsw_ef_search == 250_000, (
        "the env route no longer reaches the settings object -- re-derive this case rather "
        "than deleting it"
    )

    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search=s.hnsw_ef_search, iterative_scan=None)
    assert "hnsw.ef_search" not in _names(conn), (
        "a value that reached the settings object only through backend/.env was issued to "
        "the server; it passed neither the API 400 nor migration 176's CHECK"
    )


async def test_ef_search_is_coerced_through_int_before_it_is_bound():
    """Belt and braces beside the bind parameter: what travels is a plain integer's text, never
    whatever object a caller happened to hold."""
    rt = _tuning()
    conn = _RecordingConn()
    await rt.apply_hnsw_session_knobs(conn, ef_search="200", iterative_scan=None)
    matching = [(s, a) for s, a in conn.calls if "hnsw.ef_search" in s]
    assert len(matching) == 1
    assert matching[0][1] == ("200",)


# ── The landing on the G-5 hot file ──────────────────────────────────────────

def _hnsw_lines_in_retrieval_service() -> list[str]:
    return [
        line.strip()
        for line in inspect.getsource(rs).splitlines()
        if ("hnsw" in line.lower() or "retrieval_tuning" in line)
        and not line.strip().startswith("#")
    ]


def test_the_landing_on_the_hot_file_is_a_call_and_its_arguments():
    """⛔ D-11 / G-5. ``retrieval_service.py``'s extraction has been OWED since Phase 231 and
    this is the SECOND milestone landing on it; the ROADMAP says a THIRD must propose the
    extraction before adding behaviour. The cap exists so the delta cannot quietly grow into
    the thing that should have been extracted: the LOGIC lives in ``retrieval_tuning.py``, and
    what lands here is a signature, a guard, a call and two argument expressions.

    ⚠ MEASURED, NOT PREDICTED — and the prediction was wrong, which is why the number is
    recorded here rather than reasoned about. 241-03 first wrote *"8"* from counting the edit it
    intended; the shipped landing measures **11** (the `_vector_search` argument expression wraps
    across three lines, and one docstring line names the module). The cap is **12**: one line of
    slack, which is deliberately tight. Driven RED against a real plant — threading the knobs
    through `_keyword_search` as well took it to 13 and this case failed by name alongside
    `test_keyword_search_carries_no_hnsw_argument`.
    """
    lines = _hnsw_lines_in_retrieval_service()
    assert lines, (
        "POSITIVE CONTROL FAILED — no hnsw / retrieval_tuning line found in "
        "retrieval_service.py, so the cap below would pass vacuously."
    )
    assert len(lines) <= 12, (
        f"the D-11 landing has grown to {len(lines)} non-comment lines:\n"
        + "\n".join(lines)
        + "\n⛔ G-5: put the logic in retrieval_tuning.py. This file's extraction is still OWED."
    )


def test_keyword_search_carries_no_hnsw_argument():
    """HNSW is irrelevant to ``keyword_search_chunks`` — it is a tsquery, not a vector scan.
    Threading the knobs through it would spend the cost with none of the benefit, and would
    make the seam look like a general-purpose one."""
    src = inspect.getsource(rs._keyword_search)
    assert "keyword_search_chunks" in src, (
        "POSITIVE CONTROL FAILED — this is not the function the fence thinks it is."
    )
    assert "hnsw" not in src.lower()


def test_the_G5_sentence_is_written_into_the_hot_file_itself():
    """⛔ A future reader must not be able to mistake this landing for a discharge — and the
    place they will be reading is the FILE, not this test and not a SUMMARY."""
    src = inspect.getsource(rs).lower()
    assert "owed" in src and "g-5" in src, (
        "the G-5 sentence is missing from retrieval_service.py: the second landing must say, "
        "in the file, that the extraction is still owed and that a third must propose it first"
    )


async def test_vector_search_passes_the_resolved_knobs_and_keyword_search_does_not(monkeypatch):
    """The wiring, driven end to end with no database: ``_vector_search`` resolves the two
    values off ``user_settings`` (in the shipped ``x = user_settings.x if user_settings else
    settings.x`` idiom) and hands them to ``_call_as_user``; ``_keyword_search`` hands nothing.
    """
    seen: list[dict] = []

    async def _fake_call_as_user(user_id, fn_sql, *args, **kwargs):
        seen.append({"sql": fn_sql, "kwargs": kwargs})
        return []

    monkeypatch.setattr(rs, "_call_as_user", _fake_call_as_user)
    monkeypatch.setattr(rs, "embed_texts", lambda *a, **k: [[0.1, 0.2, 0.3]])

    s = _build_settings_from_row({"hnsw_ef_search": 400, "hnsw_iterative_scan": "strict_order"})
    await rs._vector_search("q", "u1", MagicMock(), None, 5, 0.3, s)
    assert seen[-1]["kwargs"] == {"hnsw_ef_search": 400, "hnsw_iterative_scan": "strict_order"}

    await rs._keyword_search("q", "u1", MagicMock(), None, 5)
    assert seen[-1]["kwargs"] == {}


async def test_call_as_user_applies_the_knobs_INSIDE_the_existing_transaction(monkeypatch):
    """⛔ D-10, and the whole point: NO NEW PLUMBING. The knobs ride the transaction
    ``get_user_pg_connection`` already opens, so the COMMIT that already happens reverts them.

    Driven by asserting the ORDER — the knobs are applied on the same connection, before the
    fetch, inside the one context manager — and by asserting that a call with neither knob
    resolved is byte-identical to the shipped one.
    """
    from contextlib import asynccontextmanager

    conn = _RecordingConn()

    @asynccontextmanager
    async def _fake_conn(request, current_user):
        yield conn

    monkeypatch.setattr(rs, "get_user_pg_connection", _fake_conn)
    await rs._call_as_user(
        "u1", "SELECT 1", hnsw_ef_search=400, hnsw_iterative_scan="strict_order"
    )

    kinds = ["knob" if "set_config" in sql else "query" for sql, _ in conn.calls]
    assert kinds.count("query") == 1
    assert kinds.index("query") == len(kinds) - 1, (
        "the knobs were applied AFTER the query (or not on this connection) — they must be set "
        "before the scan they are meant to widen"
    )

    plain = _RecordingConn()

    @asynccontextmanager
    async def _fake_plain(request, current_user):
        yield plain

    monkeypatch.setattr(rs, "get_user_pg_connection", _fake_plain)
    await rs._call_as_user("u1", "SELECT 1")
    assert [s for s, _ in plain.calls] == ["SELECT 1"]
