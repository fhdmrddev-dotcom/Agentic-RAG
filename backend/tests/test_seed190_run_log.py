"""SEED-190 — ``GET /workflow-runs``, the run log.

**What this route exists for, in the operator's words:** *"in the chat area I cannot
distinguish between any regular chat or any workflow run. We should have one place to see the
history of the runs and view it."* Before it there was exactly ONE door to a run and it was
inside the run's own chat thread — so to open a run you had to already have found it, in a
sidebar that renders a workflow run exactly like any other conversation. Measured on the dev
database 2026-08-20: **230 runs, 226 threads, none of them marked.**

**The three cases that would catch a real defect**, and the rest of this file is ordinary
coverage:

  §1 **OWNER SCOPING.** The list is filtered by ``user_id`` on the SAME select as everything
     else. Delete that one predicate and the route hands every caller every run in the
     database. Asserted against a store that really contains a foreign run.

  §2 **THE SLUG FILTER, ACROSS VERSIONS.** ``workflow_runs.definition_id`` points at ONE
     version row. Filtering by definition would answer about a VERSION and call it the
     workflow — measured on the dev database, ``pm-weekly-status-report`` has **21 runs across
     3 definition rows**. This block seeds exactly that shape and asserts all three versions
     come back. It also asserts the case that would be silently catastrophic: an UNKNOWN slug
     must be an EMPTY log, never an unfiltered one.

  §3 **THE SPAN IS THE PHASES', NOT THE ROW'S.** ``created_at`` is when the run row was
     INSERTED and ``updated_at`` is the last write of any kind; neither is how long the work
     took. The reduction is ``min(started_at) → max(completed_at)`` across the run's phases —
     the SAME reduction ``phaseDuration.runSpan`` performs on the client. A run whose phases
     carry no timings must report NOTHING rather than a zero: migration 121 is not backfilled
     and, measured, **10 of 580** phase rows carry the pair today.

The DB seam is ``test_188_workflow_run_read``'s ``_FakeQuery`` / ``_FakeSupabase`` — imported
rather than re-implemented, deliberately. That fake models PROJECTION honestly (a column the
handler did not ``.select()`` is absent from the row it gets back), and its own docblock
records why: it once discarded its column list, and a test that would still pass with the
handler's ``.select()`` deleted is not testing the projection. A second fake built beside it
would have started life without that property.

Fully offline: no DB, no pg pool, no network.
"""
from types import SimpleNamespace

from tests.test_188_workflow_run_read import (  # noqa: F401 — the shared DB seam
    _FakeSupabase,
    _flipped_on,
    _is_op_false,
)

_OWNER_ID = "00000000-0000-0000-0000-0000000000aa"
_OTHER_ID = "00000000-0000-0000-0000-0000000000bb"

_DEF_V1 = "11111111-1111-1111-1111-111111111111"
_DEF_V2 = "22222222-2222-2222-2222-222222222222"
_DEF_V3 = "33333333-3333-3333-3333-333333333333"
_OTHER_DEF = "44444444-4444-4444-4444-444444444444"
_GONE_DEF = "55555555-5555-5555-5555-555555555555"

_SLUG = "pm-weekly-status-report"

# ⚠ THE RUN IDS ARE REAL UUIDs, NOT READABLE SLUGS, and the reason is a measured one rather
# than a convention: `WorkflowRunListItem.id` is typed `UUID`, so Pydantic REFUSES a
# readable non-UUID id outright. That is itself a small proof worth keeping: the wire cannot
# ship a run id of a shape the client's `getWorkflowRun` could not then encode into a path.
# The readable names survive as the CONSTANT names below.
RUN_001 = "aaaa0001-0000-4000-8000-000000000001"
RUN_002 = "aaaa0002-0000-4000-8000-000000000002"
RUN_003 = "aaaa0003-0000-4000-8000-000000000003"
RUN_004 = "aaaa0004-0000-4000-8000-000000000004"
RUN_ORPHAN = "aaaa000f-0000-4000-8000-00000000000f"
RUN_FOREIGN = "aaaa00ff-0000-4000-8000-0000000000ff"

_THREAD_ID = "99999999-9999-4999-8999-999999999999"


def _run(run_id, *, definition_id=_DEF_V1, user_id=_OWNER_ID, status="completed", created_at):
    return {
        "id": run_id,
        "thread_id": _THREAD_ID,
        "definition_id": definition_id,
        "status": status,
        "created_at": created_at,
        "updated_at": created_at,
        "claimed_at": None,
        "user_id": user_id,
    }


def _phase(run_id, slug, index, *, started=None, completed=None, status="completed"):
    return {
        "workflow_run_id": run_id,
        "slug": slug,
        "phase_index": index,
        "status": status,
        "started_at": started,
        "completed_at": completed,
        # The secret-bearing column the single-run read must never ship. The LIST never
        # selects it at all, which §5 asserts.
        "output": {"text": "x", "_internal_prompt": "SECRET-PROMPT-MUST-NOT-SHIP"},
    }


def _seed_log() -> _FakeSupabase:
    """One workflow across THREE published versions, one other workflow, one FOREIGN run,
    and one run whose definition row is GONE.

    ⚠ The timed run's phases are seeded OUT OF ORDER and its span deliberately does NOT
    coincide with either its first or its last row in the store, so a reduction that took
    ``rows[0]`` instead of ``min()`` would read a different figure.
    """
    return _FakeSupabase(
        {
            "workflow_runs": [
                # newest → oldest, seeded in a scrambled order so the sort is the handler's
                _run(RUN_002, definition_id=_DEF_V2, created_at="2026-08-18T09:00:00+00:00"),
                _run(RUN_004, definition_id=_OTHER_DEF, created_at="2026-08-15T09:00:00+00:00"),
                _run(RUN_001, definition_id=_DEF_V3, created_at="2026-08-20T09:00:00+00:00"),
                _run(RUN_003, definition_id=_DEF_V1, status="failed",
                     created_at="2026-08-17T09:00:00+00:00"),
                _run(RUN_ORPHAN, definition_id=_GONE_DEF,
                     created_at="2026-08-10T09:00:00+00:00"),
                # NOT the caller's. It shares the filtered slug's definition on purpose, so
                # the slug filter alone would return it if the owner predicate were dropped.
                _run(RUN_FOREIGN, definition_id=_DEF_V1, user_id=_OTHER_ID,
                     created_at="2026-08-19T09:00:00+00:00"),
            ],
            "workflow_definitions": [
                {"id": _DEF_V1, "slug": _SLUG, "version": 1, "name": "Weekly status report"},
                {"id": _DEF_V2, "slug": _SLUG, "version": 2, "name": "Weekly status report"},
                {"id": _DEF_V3, "slug": _SLUG, "version": 3, "name": "Weekly status report"},
                {"id": _OTHER_DEF, "slug": "other-workflow", "version": 1, "name": "Other"},
                # _GONE_DEF is DELIBERATELY ABSENT — the run whose workflow was deleted.
            ],
            "workflow_phases": [
                # r-001 — TIMED. min(started) = 10:00:05, max(completed) = 10:07:30.
                _phase(RUN_001, "write", 2,
                       started="2026-08-20T10:05:00+00:00",
                       completed="2026-08-20T10:07:30+00:00"),
                _phase(RUN_001, "gather", 0,
                       started="2026-08-20T10:00:05+00:00",
                       completed="2026-08-20T10:02:35+00:00"),
                # SKIPPED: never ran, both NULL — must not drag the span to nothing.
                _phase(RUN_001, "review", 1, status="skipped"),
                # r-002 — UNTIMED (a pre-migration-121 run). Three rows, no instants.
                _phase(RUN_002, "a", 0), _phase(RUN_002, "b", 1), _phase(RUN_002, "c", 2),
                # r-003 — one row only.
                _phase(RUN_003, "a", 0),
            ],
        }
    )


def _canvas_on(monkeypatch) -> _FakeSupabase:
    """Flag ON + an injected canvas caller + the fake DB on the user-JWT client dep.

    ``require_canvas`` validates the bearer token itself and publishes the identity on
    ``request.state.canvas_caller`` (WR-08), so the caller seam is
    ``authenticate_canvas_request`` — the 188 file's own reasoning, reused verbatim.
    """
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    store = _seed_log()
    app.dependency_overrides[get_user_supabase_client] = lambda: store
    return store


# ── §1 OWNER SCOPING ──────────────────────────────────────────────────────────


def test_the_log_carries_only_the_callers_own_runs(client, monkeypatch):
    """A run owned by another account is absent — from the rows AND from the total.

    Falsifiable: delete ``.eq("user_id", current_user["id"])`` from the runs select and
    ``r-foreign`` appears. It is seeded on the SAME definition as the caller's own runs
    precisely so that no other predicate in the route could exclude it by accident.
    """
    _canvas_on(monkeypatch)

    body = client.get("/workflow-runs").json()

    ids = [row["id"] for row in body["runs"]]
    assert RUN_FOREIGN not in ids
    assert set(ids) == {RUN_001, RUN_002, RUN_003, RUN_004, RUN_ORPHAN}
    # ⚠ THE TOTAL IS SCOPED TOO. A count taken before the owner filter would say 6 — a
    # surface reading "showing 5 of 6" while there is no sixth row to page to.
    assert body["total"] == 5


def test_the_owner_scope_also_binds_under_a_slug_filter(client, monkeypatch):
    """The two predicates COMPOSE. A slug filter must not become a way around the owner one."""
    _canvas_on(monkeypatch)

    body = client.get(f"/workflow-runs?slug={_SLUG}").json()

    assert RUN_FOREIGN not in [row["id"] for row in body["runs"]]
    assert body["total"] == 3  # r-001, r-002, r-003 — the caller's, across three versions


def test_there_is_no_all_users_mode(client, monkeypatch):
    """No query parameter widens the scope. Asserted against the route's own signature so a
    future ``?user_id=`` or ``?all=`` cannot be added without this failing."""
    import inspect

    from app.api.workflow_runs import list_workflow_runs

    params = set(inspect.signature(list_workflow_runs).parameters)
    assert params == {"slug", "limit", "offset", "current_user", "supabase"}


# ── §2 THE SLUG FILTER, ACROSS VERSIONS ───────────────────────────────────────


def test_a_slug_filter_spans_every_version_of_the_workflow(client, monkeypatch):
    """THE HEADLINE. Three definition rows share one slug; all three versions' runs come back.

    ⚠ This is the shape a ``definition_id`` filter gets wrong while looking right: it would
    return ONE of these three and present it as the workflow's history. Measured on the dev
    database, ``pm-weekly-status-report`` really does have 21 runs across 3 definition rows.
    """
    _canvas_on(monkeypatch)

    body = client.get(f"/workflow-runs?slug={_SLUG}").json()

    assert {row["id"] for row in body["runs"]} == {RUN_001, RUN_002, RUN_003}
    # …and the versions are reported PER ROW, so a reader can see which one ran.
    assert sorted(row["workflow_version"] for row in body["runs"]) == [1, 2, 3]
    # The other workflow's run is excluded.
    assert RUN_004 not in [row["id"] for row in body["runs"]]


def test_an_unknown_slug_is_an_EMPTY_log_and_never_an_unfiltered_one(client, monkeypatch):
    """⚠ THE SILENTLY CATASTROPHIC CASE. A slug matching no definition resolves to zero ids.

    An ``in`` filter skipped for an empty list would hand the caller EVERY run under the name
    of a workflow that does not exist — a screen that says "every run of X" and lists other
    people's workflows. The route early-returns instead, and this asserts it.
    """
    _canvas_on(monkeypatch)

    body = client.get("/workflow-runs?slug=no-such-workflow").json()

    assert body["runs"] == []
    assert body["total"] == 0


def test_an_empty_log_is_a_200_and_never_a_404(client, monkeypatch):
    """"You have no runs" is an ANSWER, not a missing resource."""
    _canvas_on(monkeypatch)
    resp = client.get("/workflow-runs?slug=no-such-workflow")
    assert resp.status_code == 200


# ── §3 THE SPAN IS THE PHASES', NOT THE ROW'S ─────────────────────────────────


def test_a_timed_run_reports_the_span_of_its_PHASES(client, monkeypatch):
    """min(started_at) → max(completed_at), across rows seeded OUT OF ORDER.

    ⚠ NEITHER INSTANT IS THE RUN ROW'S. ``created_at`` is 09:00 and the span is 10:00:05 →
    10:07:30 — an hour apart — so a route reaching for the run row's own columns reads a
    figure that is wrong by an hour while still looking like a duration.
    """
    _canvas_on(monkeypatch)

    row = next(r for r in client.get("/workflow-runs").json()["runs"] if r["id"] == RUN_001)

    assert row["started_at"].startswith("2026-08-20T10:00:05")
    assert row["completed_at"].startswith("2026-08-20T10:07:30")
    assert row["created_at"].startswith("2026-08-20T09:00:00")
    assert row["step_total"] == 3


def test_a_SKIPPED_phase_does_not_drag_the_span(client, monkeypatch):
    """r-001 carries a skipped phase with both instants NULL. It contributes nothing.

    A reduction that folded NULL into the comparison would report a span starting at the
    epoch, or none at all — and the run really did run.
    """
    _canvas_on(monkeypatch)
    row = next(r for r in client.get("/workflow-runs").json()["runs"] if r["id"] == RUN_001)
    assert row["started_at"] is not None and row["completed_at"] is not None


def test_an_untimed_run_reports_NOTHING_never_a_zero(client, monkeypatch):
    """A pre-migration-121 run: three phase rows, no instants. Both fields are NULL.

    ⚠ THERE IS NO BACKFILL (D-06). A value derived from ``updated_at`` would be right for
    some rows and silently wrong for others, with nothing on the row to say which. The step
    count is still real — the run genuinely created three phases.
    """
    _canvas_on(monkeypatch)

    row = next(r for r in client.get("/workflow-runs").json()["runs"] if r["id"] == RUN_002)

    assert row["started_at"] is None
    assert row["completed_at"] is None
    assert row["step_total"] == 3


def test_a_run_with_no_phase_rows_at_all_reports_zero_steps(client, monkeypatch):
    """``r-004`` has no ``workflow_phases`` rows. ``0`` is a fact, and the row still lists."""
    _canvas_on(monkeypatch)
    row = next(r for r in client.get("/workflow-runs").json()["runs"] if r["id"] == RUN_004)
    assert row["step_total"] == 0
    assert row["started_at"] is None


# ── §4 IDENTITY, ORDER AND PAGING ─────────────────────────────────────────────


def test_the_log_is_newest_first(client, monkeypatch):
    """``created_at DESC`` — and the store is seeded scrambled, so the order is the route's."""
    _canvas_on(monkeypatch)
    ids = [row["id"] for row in client.get("/workflow-runs").json()["runs"]]
    assert ids == [RUN_001, RUN_002, RUN_003, RUN_004, RUN_ORPHAN]


def test_a_run_whose_workflow_was_DELETED_still_lists(client, monkeypatch):
    """⚠ Deleting a workflow does not delete its runs — ``WorkflowDeleteSheet`` tells the
    operator the threads become normal chats. An orphaned run must still be in the log and
    still be openable, so its identity fields normalise rather than 500 the whole page.

    The client has a WORD for an empty name (``WORKFLOW_DELETED``); the wire's job is to be
    unambiguous about the absence, which an empty string is and a missing key is not.
    """
    _canvas_on(monkeypatch)

    row = next(r for r in client.get("/workflow-runs").json()["runs"] if r["id"] == RUN_ORPHAN)

    assert row["workflow_name"] == ""
    assert row["workflow_slug"] == ""
    assert row["workflow_version"] == 0
    # …and the id that opens it survived.
    assert row["id"] == RUN_ORPHAN


def test_paging_reports_the_total_under_the_filter_not_the_page_size(client, monkeypatch):
    """⚠ ``total`` IS COUNTED BEFORE THE RANGE. A total taken after paging always equals the
    page length, so "showing 2 of 2" would be printed on a log of five."""
    _canvas_on(monkeypatch)

    body = client.get("/workflow-runs?limit=2").json()

    assert len(body["runs"]) == 2
    assert body["total"] == 5
    assert body["limit"] == 2 and body["offset"] == 0


def test_an_offset_page_continues_rather_than_restarts(client, monkeypatch):
    _canvas_on(monkeypatch)
    first = client.get("/workflow-runs?limit=2&offset=0").json()["runs"]
    second = client.get("/workflow-runs?limit=2&offset=2").json()["runs"]
    assert [r["id"] for r in first] == [RUN_001, RUN_002]
    assert [r["id"] for r in second] == [RUN_003, RUN_004]


def test_a_nonsense_limit_is_refused_by_validation_not_by_the_database(client, monkeypatch):
    """``ge``/``le`` on the Query — so an unbounded page cannot be asked for at all."""
    _canvas_on(monkeypatch)
    assert client.get("/workflow-runs?limit=0").status_code == 422
    assert client.get("/workflow-runs?limit=99999").status_code == 422
    assert client.get("/workflow-runs?offset=-1").status_code == 422


# ── §5 WHAT IS NOT ON THIS WIRE ───────────────────────────────────────────────


def test_the_log_never_ships_a_definition_or_a_prompt(client, monkeypatch):
    """⚠ THE PAYLOAD STAYS NARROW, and the two things it must not carry are named.

    ``definition`` is on the SINGLE-run read because the run SURFACE draws a spine from it; a
    log draws no spine, and shipping it would put 230 workflow documents on one response for a
    list of names and times. ``workflow_phases.output`` carries prompts and citations inline —
    the list never selects it, which is a stronger statement than relying on the response
    model to drop it.
    """
    _canvas_on(monkeypatch)

    raw = client.get("/workflow-runs").text

    assert "SECRET-PROMPT-MUST-NOT-SHIP" not in raw
    assert "_internal_prompt" not in raw
    assert "definition_snapshot" not in raw
    for row in client.get("/workflow-runs").json()["runs"]:
        assert "definition" not in row
        assert "phases" not in row


def test_the_projection_is_real_the_phase_read_asks_for_three_columns(client, monkeypatch):
    """The phase read selects only what the reduction needs.

    ⚠ IT IS ASSERTED AGAINST THE RECORDED ``select`` CALL, which is the one member of the
    projection/model/serializer lockstep no type checker can see. The fake really projects, so
    a ``.select("*")`` here would also be caught by the secret-prompt case above — but this
    names the intent rather than relying on a downstream symptom.
    """
    store = _canvas_on(monkeypatch)

    client.get("/workflow-runs")

    phase_selects = [
        cols for kind, table, cols in store.calls
        if kind == "select" and table == "workflow_phases"
    ]
    assert phase_selects, "the route never read workflow_phases"
    assert phase_selects[-1] == ["workflow_run_id", "started_at", "completed_at"]


# ── §6 THE CANVAS GATE ────────────────────────────────────────────────────────


def test_the_log_404s_WITH_THE_GATE_BODY_when_the_canvas_is_off(client, monkeypatch):
    """The flag resolves BEFORE auth, so an anonymous caller and the owner get the SAME 404.

    ⚠ AND THE BODY IS THE GATE'S, not the route's own "Run not found" — which is how a reader
    can tell the route was hidden rather than the row missed.
    """
    import app.dependencies as deps
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    resp = client.get("/workflow-runs")

    assert resp.status_code == 404
    assert resp.json() == {"detail": "Not Found"}


def test_the_list_path_is_registered_in_the_canvas_gate(client, monkeypatch):
    """⚠ THE SAME-COMMIT RULE, ASSERTED. ``CANVAS_GATED_PATHS``' own header says a new canvas
    route's absolute path is added in the commit that mounts it — that single edit is what
    makes the route non-discoverable on BOTH channels (the request-path gate and
    ``/openapi.json``). A route mounted without it is discoverable while the canvas is off.
    """
    from app.middleware.canvas_gate import CANVAS_GATED_PATHS

    assert "/workflow-runs" in CANVAS_GATED_PATHS
    # …and the single-run template is still its own separate member. Two shapes, neither
    # shadowing the other.
    assert "/workflow-runs/{workflow_run_id}" in CANVAS_GATED_PATHS
