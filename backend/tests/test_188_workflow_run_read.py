"""Phase 188 (RUNVIZ-03 / D-188-14 / D-188-15 / D-188-16) — the run read's own suite.

``GET /workflow-runs/{workflow_run_id}`` gives a workflow run an address so a finished run can
be re-opened. This file pins the three properties that make that safe and useful:

  1. **the IDOR posture** — a run belonging to another account is INDISTINGUISHABLE from one
     that does not exist. Both take the same single-query path to the same 404 (never 403,
     never 200-with-empty). Tests 1 + 2, with test 2 asserting the two responses match rather
     than merely asserting each is a 404 on its own.
  2. **the flag-off posture** — with ``visual_workflow_canvas`` off the route is a byte-
     identical ``{"detail": "Not Found"}`` even for the run's OWN owner, and even for an
     operator. Test 6, with the mounted-routes positive control so the 404 cannot mean
     "never built". NOTE the two 404s in this file carry DIFFERENT bodies on purpose:
     the handler's ownership miss says ``"Run not found"`` (it is past the gate, so the route
     provably exists to this caller), while the gate's says ``"Not Found"`` (byte-identical to
     an unbuilt path). Asserting the gate body is the handler's would be wrong.
  3. **the definition version that RAN** — test 5, the reason D-188-14 puts the definition in
     the payload at all. A run re-opened months later must be drawn against the definition it
     EXECUTED, not whatever is published under that slug now.

Authored fresh (MEMORY project_frontend_vitest_rot / RESEARCH § "Backend test-suite reality"):
the full backend suite carries ~200 pre-existing failures across ~50 files and is NOT a safe
import surface, so ``_is_op_true`` / ``_cold_off`` / ``_flipped_on`` are COPIED from
``test_182_canvas_gate.py`` per the repo's per-file convention rather than shared.

**The DB seam.** ``_FakeSupabase`` below is a small honest stand-in that actually APPLIES the
``.eq(...)`` filters the handler chains, rather than returning a canned answer. That matters:
if the ownership filter were dropped from the handler, a canned-``None`` mock would still 404
and test 1 would pass for the wrong reason. Here, dropping ``.eq("user_id", ...)`` makes the
foreign row VISIBLE and test 1 goes red. The phase rows are likewise seeded SHUFFLED so the
ordering assertion in test 4 can only pass if the handler really asked for
``.order("phase_index")``.
"""
from types import SimpleNamespace

# ── identities + ids (all well-formed uuids — a malformed one would 422 and a probe would
#    then pass for the wrong reason, the Pitfall-5 discipline test_revert_byte_identical uses)
_OWNER_ID = "00000000-0000-0000-0000-000000000001"
_OTHER_ID = "00000000-0000-0000-0000-0000000000ff"

_OWNED_RUN_ID = "2f1c9a5e-0000-4000-8000-00000000188a"
_FOREIGN_RUN_ID = "2f1c9a5e-0000-4000-8000-00000000188b"
_MISSING_RUN_ID = "2f1c9a5e-0000-4000-8000-00000000188c"

_THREAD_ID = "3a2b1c0d-0000-4000-8000-000000001880"

# TWO definition rows, SAME slug, DIFFERENT versions (test 5). The run points at the OLDER one.
_OLD_DEF_ID = "4b3c2d1e-0000-4000-8000-000000000003"
_NEW_DEF_ID = "4b3c2d1e-0000-4000-8000-000000000007"
_DEF_SLUG = "quarterly-report"

# The phase types differ between the two versions ON PURPOSE: if the handler ever resolved the
# definition by slug (the CURRENT published version) instead of by definition_id, the derived
# phase_type values would silently change and test 5 would catch it.
_OLD_DEFINITION_JSON = {
    "slug": _DEF_SLUG,
    "version": 3,
    "name": "Quarterly report (v3)",
    "phases": [
        {"slug": "gather", "phase_index": 0, "config": {"phase_type": "llm_agent"}},
        {"slug": "review", "phase_index": 1, "config": {"phase_type": "llm_human_input"}},
        {"slug": "write", "phase_index": 2, "config": {"phase_type": "llm_single"}},
    ],
}
_NEW_DEFINITION_JSON = {
    "slug": _DEF_SLUG,
    "version": 7,
    "name": "Quarterly report (v7)",
    "phases": [
        {"slug": "gather", "phase_index": 0, "config": {"phase_type": "programmatic"}},
        {"slug": "review", "phase_index": 1, "config": {"phase_type": "programmatic"}},
        {"slug": "write", "phase_index": 2, "config": {"phase_type": "programmatic"}},
    ],
}


async def _is_op_true(user_id):
    return True


async def _is_op_false(user_id):
    return False


def _cold_off(monkeypatch):
    """Flag off (cold default): an empty feature_visibility map -> canvas resolves "off"."""
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))


def _flipped_on(monkeypatch):
    """Operator On flip: a stored {"audience": "everyone"} record for the canvas key."""
    from app.models import user_settings as us

    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}}
        ),
    )


# ══ the DB seam ═══════════════════════════════════════════════════════════════


class _FakeQuery:
    """A supabase-py query builder that really applies the filters it is handed.

    Only the surface the two run routes chain is implemented: ``select`` / ``eq`` / ``in_`` /
    ``order`` / ``range`` / ``maybe_single`` / ``execute``. ``execute`` is SYNC because
    ``aexec`` runs it through ``run_in_threadpool`` exactly as it would the real blocking
    client.

    ⚠ ``in_`` / ``range`` / ``count="exact"`` ARRIVED WITH SEED-190's RUN LOG, and they were
    added HERE rather than re-implemented in that route's own test file. The reason is the
    paragraph directly below: this fake models PROJECTION honestly, and a second fake built
    beside it would have started life without that property — which is how the discarded
    column list got shipped the first time. One fake, both routes; ``tests/test_seed190_run_log.py``
    imports it.

    ⚠ **``select`` REALLY PROJECTS, as of Phase 200 — and the version it replaces is quoted
    here because the defect it carried is the exact kind this file exists to catch.** It
    read, verbatim:

        def select(self, *_columns, **_kwargs):
            return self

    **A no-op that discarded its column list.** PostgREST does the opposite: a column absent
    from ``.select(...)`` is absent from the row. So a test that seeded ``started_at`` read
    it straight back **even if the handler's ``.select()`` had never been widened to ask for
    it** — the fake answered from the store, not from the projection. The warning sign,
    stated plainly for whoever reads this next: **a test that would still pass if you
    deleted the handler's ``.select()`` line is not testing the projection.**

    That mattered the moment the run read grew fields (Phase 200 / D-05, D-07): the route
    declares ``response_model=WorkflowRunRead``, which DROPS UNDECLARED KEYS SILENTLY, so
    the projection, the Pydantic model and the serializer must widen in LOCKSTEP. Two of
    the three produce a green model and an empty field — 192.2 measured precisely that on
    ``api/workflows.py``: a green db test beside an unchanged UI. With projection modelled
    here, forgetting the ``.select()`` half now goes RED.
    """

    def __init__(self, store: "_FakeSupabase", table: str):
        self._store = store
        self._table = table
        self._filters: dict[str, str] = {}
        self._order_by: str | None = None
        self._single = False
        self._columns: list[str] | None = None
        self._in: dict[str, set[str]] = {}
        self._orders: list[tuple[str, bool]] = []
        self._range: tuple[int, int] | None = None
        self._count: str | None = None

    def select(self, *columns, **_kwargs):
        """Record the requested columns so ``execute`` can PROJECT to them.

        supabase-py takes ONE comma-separated string (``"a, b, c"``); the star form is
        accepted too so a future caller that passes several args is handled. ``"*"`` means
        every column, which is the one case where projection is a no-op.
        """
        requested: list[str] = []
        for chunk in columns:
            requested.extend(part.strip() for part in str(chunk).split(",") if part.strip())
        self._columns = None if "*" in requested else requested
        # ⚠ ``count="exact"`` IS A KWARG ON ``select``, not a chained call. Recording it is
        # what lets ``execute`` answer a total that is the count UNDER THE FILTERS but BEFORE
        # the range — the property a paged surface's "N of M" line depends on, and the one a
        # fake that counted the returned page would silently get wrong.
        self._count = _kwargs.get("count")
        # Recorded so a case can assert WHICH columns the handler asked for — the one
        # member of the three-place lockstep that no type checker can see.
        self._store.calls.append(("select", self._table, list(requested)))
        return self

    def eq(self, column, value):
        self._filters[column] = str(value)
        return self

    def in_(self, column, values):
        """PostgREST's ``?col=in.(a,b,c)`` — membership, applied for real.

        ⚠ AN EMPTY LIST MATCHES NOTHING, which is PostgREST's own behaviour and is the case
        SEED-190's slug filter turns on: an unknown slug resolves to zero definition ids, and
        an ``in_`` that quietly matched EVERYTHING there would hand the caller the whole log
        under the name of a workflow that does not exist. The route early-returns before it
        gets here; this fake would still catch a future edit that removed that return.
        """
        self._in[column] = {str(v) for v in values}
        return self

    def order(self, column, **kwargs):
        # ⚠ ``desc`` IS RECORDED AND APPLIED. The run log orders ``created_at DESC, id DESC``
        # and a fake that ignored the flag would let a route ship ASCENDING — an oldest-first
        # log, which reads as a truncation of the newest rows rather than as a wrong sort.
        self._orders.append((column, bool(kwargs.get("desc"))))
        self._order_by = column
        self._store.calls.append(("order", self._table, column))
        return self

    def range(self, start, end):
        """PostgREST's inclusive ``range(start, end)`` — the paging window."""
        self._range = (int(start), int(end))
        return self

    def maybe_single(self):
        self._single = True
        return self

    def execute(self):
        rows = [
            row
            for row in self._store.rows.get(self._table, [])
            if all(str(row.get(col)) == val for col, val in self._filters.items())
            and all(str(row.get(col)) in allowed for col, allowed in self._in.items())
        ]
        if self._orders:
            # Applied LAST key first, so the first `.order()` call is the primary key —
            # PostgREST's own precedence.
            for column, desc in reversed(self._orders):
                rows = sorted(rows, key=lambda r: (r.get(column) is None, r.get(column)), reverse=desc)
        elif self._order_by is not None:
            rows = sorted(rows, key=lambda r: r[self._order_by])
        # The total is counted HERE — after the filters, BEFORE the range. See ``select``.
        total = len(rows)
        if self._range is not None:
            start, end = self._range
            rows = rows[start : end + 1]
        # ⚠ THE PROJECTION, applied the way PostgREST applies it: a column the handler did
        # not ASK FOR is not in the row it gets back, however happily it sits in the store.
        # Ordering/filtering above run against the FULL row (as they do server-side), so a
        # handler may legitimately order by a column it does not select.
        if self._columns is not None:
            rows = [{k: v for k, v in row.items() if k in self._columns} for row in rows]
        self._store.calls.append(("execute", self._table, dict(self._filters)))
        if self._single:
            return SimpleNamespace(data=rows[0] if rows else None)
        # ⚠ ``count`` IS ``None`` UNLESS THE CALLER ASKED FOR IT. supabase-py exposes the
        # attribute either way, and a fake that always answered a number would let a route
        # forget ``count="exact"`` and still read a correct total — from the fake, not from
        # the database.
        return SimpleNamespace(data=rows, count=total if self._count == "exact" else None)


class _FakeSupabase:
    """Row store + ``.table(name)`` factory. ``calls`` records every execute in order."""

    def __init__(self, rows: dict[str, list[dict]]):
        self.rows = rows
        self.calls: list[tuple] = []

    def table(self, name):
        return _FakeQuery(self, name)


def _seed() -> _FakeSupabase:
    """The canonical fixture set: one owned run, one FOREIGN run, two definition versions.

    The phase rows are deliberately stored OUT OF ORDER (2, 0, 1) so an ordered response can
    only come from the handler's own ``.order("phase_index")``.
    """
    return _FakeSupabase(
        {
            "workflow_runs": [
                {
                    "id": _OWNED_RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _OLD_DEF_ID,  # the OLDER version — see test 5
                    "status": "completed",
                    "created_at": "2026-08-05T10:00:00+00:00",
                    "updated_at": "2026-08-05T10:07:30+00:00",
                    "claimed_at": "2026-08-05T10:00:02+00:00",
                    "user_id": _OWNER_ID,
                },
                {
                    # Exists, but belongs to SOMEONE ELSE. This row is the whole point of
                    # test 1: it is present in the store, so a handler that forgot the
                    # user_id filter would happily return it.
                    "id": _FOREIGN_RUN_ID,
                    "thread_id": "3a2b1c0d-0000-4000-8000-000000001881",
                    "definition_id": _OLD_DEF_ID,
                    "status": "completed",
                    "created_at": "2026-08-05T09:00:00+00:00",
                    "updated_at": "2026-08-05T09:05:00+00:00",
                    "claimed_at": None,
                    "user_id": _OTHER_ID,
                },
            ],
            "workflow_definitions": [
                {
                    "id": _OLD_DEF_ID,
                    "slug": _DEF_SLUG,
                    "version": 3,
                    "name": "Quarterly report (v3)",
                    "definition": _OLD_DEFINITION_JSON,
                },
                {
                    "id": _NEW_DEF_ID,
                    "slug": _DEF_SLUG,
                    "version": 7,
                    "name": "Quarterly report (v7)",
                    "definition": _NEW_DEFINITION_JSON,
                },
            ],
            # Phase 200 (D-05 / D-07) — the three rows carry the THREE renders the wire
            # must keep distinguishable, one per row, plus the secret-bearing `output`:
            #   gather  -> ran, and DECLARED a count (llm_agent / "sources")
            #   review  -> SKIPPED: never ran, so BOTH timestamps are NULL (D-06)
            #   write   -> ran, but its type DECLARES NO COUNT (no `_measure` key at all)
            # A fourth render — a real `count: 0` — is seeded by its own case below, since
            # it needs a row whose declared count is zero rather than absent.
            "workflow_phases": [
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "write", "phase_index": 2,
                 "status": "completed",
                 "started_at": "2026-08-05T10:05:00+00:00",
                 "completed_at": "2026-08-05T10:07:30+00:00",
                 # no `_measure` key: llm_single declares nothing. The other keys are the
                 # prompt-and-payload material that must NEVER reach the wire.
                 "output": {"text": "the written section",
                            "_internal_prompt": "SECRET-PROMPT-MUST-NOT-SHIP"}},
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "gather", "phase_index": 0,
                 "status": "completed",
                 "started_at": "2026-08-05T10:00:05+00:00",
                 "completed_at": "2026-08-05T10:02:35+00:00",
                 "output": {"text": "gathered",
                            "_measure": {"count": 312, "noun": "sources"},
                            "_internal_prompt": "SECRET-PROMPT-MUST-NOT-SHIP"}},
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "review", "phase_index": 1,
                 "status": "skipped",
                 # ⚠ BOTH NULL, and that is the POINT of this row: a skipped phase never
                 # ran (D-06 correct silence), and a historic pre-migration-121 row looks
                 # identical. Neither may render as a zero duration.
                 "started_at": None, "completed_at": None,
                 "output": {}},
            ],
        }
    )


def _canvas_on(monkeypatch, *, operator=False) -> _FakeSupabase:
    """Flag ON + an injected canvas caller + the fake DB wired onto the user-JWT client dep.

    ``require_canvas`` validates the bearer token itself and publishes the identity on
    ``request.state.canvas_caller`` (WR-08), so the caller seam is ``authenticate_canvas_request``
    — patching ``get_current_user`` would do nothing here, because the handler never calls it.
    """
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_true if operator else _is_op_false)

    store = _seed()
    # conftest's autouse reset_mocks restores this override before the next test.
    app.dependency_overrides[get_user_supabase_client] = lambda: store
    return store


# ── 1) OWNERSHIP: a run that exists but belongs to another account is a 404 ────


def test_foreign_run_id_404s_and_never_403s(client, monkeypatch):
    """A ``workflow_runs`` row owned by ANOTHER user is a 404 — never 403, never 200.

    ``_FOREIGN_RUN_ID`` is genuinely present in the fake store, owned by ``_OTHER_ID``. The
    only thing standing between the caller and that row is the handler's
    ``.eq("user_id", current_user["id"])`` on the SAME select as the id. Falsifiable: delete
    that one line and this test returns 200 with someone else's thread id, definition and
    phase spine — which is exactly threat T-188-IDOR.

    A 403 would be just as bad in a different way: it would confirm the run EXISTS while
    refusing it, which is the enumeration channel the 404 posture closes.
    """
    _canvas_on(monkeypatch)

    resp = client.get(f"/workflow-runs/{_FOREIGN_RUN_ID}")

    assert resp.status_code == 404, resp.text
    assert resp.status_code not in (200, 401, 403)
    assert resp.json() == {"detail": "Run not found"}


# ── 2) the foreign id and a nonexistent id are INDISTINGUISHABLE ───────────────


def test_foreign_and_missing_ids_are_indistinguishable(client, monkeypatch):
    """The two 404s match — status AND body — so a foreign id cannot be probed apart.

    This is the assertion that makes test 1 meaningful. Two responses can both be 404 and
    still leak, if (say) the missing case carried a different message or the foreign case
    took a visibly different path. The handler reaches both through ONE query with both
    predicates on it, so there is no second lookup whose presence or absence could be timed
    or worded apart.
    """
    _canvas_on(monkeypatch)

    foreign = client.get(f"/workflow-runs/{_FOREIGN_RUN_ID}")
    missing = client.get(f"/workflow-runs/{_MISSING_RUN_ID}")

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json() == {"detail": "Run not found"}


# ── 3) a MALFORMED id is FastAPI's own 422 — and why that is acceptable HERE ───


def test_malformed_run_id_422s_from_path_validation(client, monkeypatch):
    """A non-uuid path segment is rejected by ``workflow_run_id: UUID`` (V5, 422).

    Recorded EXPLICITLY rather than left implicit, because the acceptability of this 422 is
    route-shape-dependent and the next person to add a route here needs the boundary written
    down:

      * for THIS route it discloses nothing the 404 does not already. It is a body-free GET,
        so there is no request body to decode ahead of the dependency, and while the canvas is
        OFF the gate wins anyway (pinned in test 6 — the flag-off malformed probe is asserted
        there, not here);
      * but a POST added to this router later would inherit D-182-R2-01 verbatim: FastAPI
        decodes the body in ``get_request_handler`` BEFORE ``solve_dependencies`` runs, so
        hostile bytes would 422 AHEAD of the gate's 404 and advertise the route. That is the
        exact leak ``CanvasGateMiddleware`` exists to close for the two literal ``/workflows``
        paths — and it CANNOT close it for a templated path, because it matches request paths
        exactly. A future POST here needs its own answer.
    """
    _canvas_on(monkeypatch)

    resp = client.get("/workflow-runs/not-a-uuid")
    assert resp.status_code == 422, resp.text


# ── 4) HAPPY PATH: the whole D-188-14 payload, in one round trip ───────────────


def test_owned_run_returns_the_full_shape_with_ordered_phases(client, monkeypatch):
    """An owned run returns every ``WorkflowRunRead`` field, phases ordered by phase_index.

    The ordering assertion is real, not decorative: ``_seed`` stores the phase rows as
    (2, 0, 1), and ``_FakeQuery`` only sorts when ``.order(...)`` was actually chained. So a
    handler that dropped ``ORDER BY phase_index`` would return 2/0/1 here and go red.

    ``phase_type`` is asserted per phase because it is DERIVED from the definition JSON (the
    ``workflow_phases`` table has no such column) — a broken derivation would silently yield
    three ``None``s, which is a plausible failure that a mere "the key exists" check misses.
    """
    store = _canvas_on(monkeypatch)

    resp = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["id"] == _OWNED_RUN_ID
    assert body["thread_id"] == _THREAD_ID
    assert body["definition_id"] == _OLD_DEF_ID
    assert body["workflow_slug"] == _DEF_SLUG
    assert body["workflow_name"] == "Quarterly report (v3)"
    assert body["status"] == "completed"
    assert body["created_at"].startswith("2026-08-05T10:00:00")
    assert body["claimed_at"].startswith("2026-08-05T10:00:02")
    assert body["updated_at"].startswith("2026-08-05T10:07:30")

    # phases: ordered by phase_index, each carrying the DB-native status + derived phase_type
    assert [p["phase_index"] for p in body["phases"]] == [0, 1, 2]
    assert [p["slug"] for p in body["phases"]] == ["gather", "review", "write"]
    assert [p["status"] for p in body["phases"]] == ["completed", "skipped", "completed"]
    assert [p["phase_type"] for p in body["phases"]] == [
        "llm_agent",
        "llm_human_input",
        "llm_single",
    ]

    # ...and the ordering was REQUESTED, not accidental.
    assert ("order", "workflow_phases", "phase_index") in store.calls

    # ONE round trip for the client, three reads server-side — and the ownership read is FIRST
    # (a definition or phase read ahead of it would be a lookup performed for an unauthorized
    # caller, even if its result were later discarded).
    executed = [c for c in store.calls if c[0] == "execute"]
    assert [c[1] for c in executed] == [
        "workflow_runs",
        "workflow_definitions",
        "workflow_phases",
    ]


# ── 5) D-188-14: the definition version that RAN, not the current published one ─


def test_response_carries_the_older_definition_version_that_actually_ran(client, monkeypatch):
    """Two definition rows share a slug; the run points at the OLDER (v3) — v3 is what returns.

    THE reason D-188-14 puts the definition in this payload. ``list_published_workflows`` (the
    picker feed the client already has) only ever returns the CURRENT published version, so if
    the run surface resolved the definition itself — or if this handler joined on ``slug``
    instead of ``definition_id`` — a run re-opened after a re-publish would be drawn against a
    definition it never executed: wrong phase names, wrong phase glyphs, wrong step count, all
    rendered with total confidence.

    v7 exists in the store under the SAME slug with every ``phase_type`` changed to
    ``programmatic``, so a slug-resolved join is not merely detectable here — it is loud.
    """
    _canvas_on(monkeypatch)

    body = client.get(f"/workflow-runs/{_OWNED_RUN_ID}").json()

    assert body["workflow_version"] == 3, "resolved the current published version, not the one that ran"
    assert body["workflow_name"] == "Quarterly report (v3)"
    assert body["definition"] == _OLD_DEFINITION_JSON
    assert body["definition"] != _NEW_DEFINITION_JSON
    # the derived phase types come from v3 — v7 would have made all three "programmatic"
    assert [p["phase_type"] for p in body["phases"]] != ["programmatic"] * 3


# ── 6) D-188-16: flag off ⇒ 404 for the OWNER and for an operator ──────────────


def test_flag_off_404s_for_owner_and_operator_with_the_gate_body(client, monkeypatch):
    """With the canvas off, even the run's OWNER gets the byte-identical unbuilt-path 404.

    Two things are being pinned at once.

    (a) The GATE, not the handler, answers — so the body is ``{"detail": "Not Found"}``, NOT
        the handler's ``"Run not found"``. The distinction is load-bearing: a caller past the
        gate has learned the route exists (and ``"Run not found"`` is a fine thing to tell
        them), whereas a caller while off must not be able to tell this route apart from one
        that was never built. Asserting the wrong body here would pass while quietly proving
        the wrong property.

    (b) The flag beats the OPERATOR no-op (D-181-01) and it beats path-param validation: the
        malformed-id probe that 422s while ON (test 3) returns the same 404 while OFF, because
        ``require_canvas`` is a sub-dependency solved before the route's own params.

    The positive control at the end is what stops this whole test being vacuous — with the
    route deleted, every assertion above still passes.
    """
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _cold_off(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    app.dependency_overrides[get_user_supabase_client] = lambda: _seed()

    # the OWNER of an existing, completed run — still 404
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    owner = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")
    assert owner.status_code == 404, owner.text
    assert owner.status_code not in (200, 401, 403)
    assert owner.json() == {"detail": "Not Found"}
    assert owner.json() != {"detail": "Run not found"}, (
        "the HANDLER answered while the canvas is off — the gate did not run"
    )

    # an OPERATOR — "off" resolves before the operator no-op (D-181-01)
    monkeypatch.setattr(deps, "is_operator", _is_op_true)
    op = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")
    assert op.status_code == 404, op.text
    assert op.json() == {"detail": "Not Found"}

    # a malformed id while off: the gate wins over the 422 that test 3 observes while ON
    malformed = client.get("/workflow-runs/not-a-uuid")
    assert malformed.status_code == 404, malformed.text
    assert malformed.status_code != 422
    assert malformed.json() == {"detail": "Not Found"}

    # POSITIVE CONTROL — the 404s above are the GATE, not an absent route.
    mounted = {
        (getattr(r, "path", None), m)
        for r in app.routes
        for m in (getattr(r, "methods", None) or set())
    }
    assert ("/workflow-runs/{workflow_run_id}", "GET") in mounted, (
        "/workflow-runs/{workflow_run_id} is not mounted — every 404 above is vacuous"
    )


# ══════════════════════════════════════════════════════════════════════════════
# 7) Phase 200 (DES-02 / D-05 / D-07) — the measurable facts on the wire
# ══════════════════════════════════════════════════════════════════════════════


def test_the_projection_is_real_an_unselected_column_is_absent(client, monkeypatch):
    """⚠ **THE POSITIVE CONTROL FOR THE FAKE ITSELF.** Prove ``_FakeQuery`` projects.

    Every assertion in this section is worthless if the fake still answers from the store
    regardless of what the handler asked for — which is exactly what it did before Phase
    200 (see ``_FakeQuery``'s docblock). So this case seeds a column NOBODY selects and
    asserts it comes back ABSENT.

    Falsifiable by construction: restore ``def select(self, *_columns): return self`` and
    this case goes red immediately, and so does
    ``test_a_forgotten_projection_is_now_detectable`` below.
    """
    store = _canvas_on(monkeypatch)
    for row in store.rows["workflow_phases"]:
        row["a_column_nobody_selects"] = "leak"

    resp = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")
    assert resp.status_code == 200, resp.text

    # Drive the fake directly: the handler's own projection is asserted by the next case.
    projected = _FakeQuery(store, "workflow_phases").select(
        "slug, phase_index, status"
    ).eq("workflow_run_id", _OWNED_RUN_ID).execute().data
    assert projected, "fixture guard: the filter matched no rows"
    for row in projected:
        assert "a_column_nobody_selects" not in row, (
            "the fake returned a column the query never selected — it is not projecting, "
            "so every projection assertion in this file is vacuous"
        )
        assert set(row) == {"slug", "phase_index", "status"}


def test_a_forgotten_projection_is_now_detectable(client, monkeypatch):
    """The handler really ASKS for the Phase 200 columns — not merely declares them.

    The three-place lockstep (projection + model + serializer) has exactly one member that
    no type checker and no Pydantic validation can see: the ``.select()`` string. This case
    is the one that covers it, by reading the columns the handler actually requested off
    the fake's own recorder.
    """
    store = _canvas_on(monkeypatch)
    resp = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")
    assert resp.status_code == 200, resp.text

    selected = [c for c in store.calls if c[0] == "select" and c[1] == "workflow_phases"]
    assert selected, "the handler never called .select() on workflow_phases"
    columns = set(selected[-1][2])
    for required in ("slug", "phase_index", "status", "started_at", "completed_at", "output"):
        assert required in columns, (
            f"the workflow_phases projection does not ask for {required!r} — the model can "
            f"declare it and the serializer can pass it through, and the field would still "
            f"arrive empty. Requested: {sorted(columns)}"
        )


def test_a_phase_that_ran_carries_both_timestamps(client, monkeypatch):
    """D-05 — a per-step duration is derivable from the wire for the first time."""
    _canvas_on(monkeypatch)
    body = client.get(f"/workflow-runs/{_OWNED_RUN_ID}").json()

    gather = next(p for p in body["phases"] if p["slug"] == "gather")
    assert gather["started_at"].startswith("2026-08-05T10:00:05")
    assert gather["completed_at"].startswith("2026-08-05T10:02:35")

    from datetime import datetime

    span = (
        datetime.fromisoformat(gather["completed_at"])
        - datetime.fromisoformat(gather["started_at"])
    )
    assert span.total_seconds() == 150, (
        "completed_at - started_at IS the per-step duration DES-02 exists to make "
        "renderable; it was underivable before migration 121"
    )


def test_a_phase_that_never_ran_carries_neither_timestamp(client, monkeypatch):
    """D-06 — NULL means *time not recorded*, and it must survive to the wire as null.

    ⚠ The skipped row is the wire-side twin of migration 121's no-backfill control. If a
    serializer ever coalesced these to ``0`` or to the run's own timestamps, the client
    would render a confident duration for a step that never ran.
    """
    _canvas_on(monkeypatch)
    body = client.get(f"/workflow-runs/{_OWNED_RUN_ID}").json()

    review = next(p for p in body["phases"] if p["slug"] == "review")
    assert review["status"] == "skipped"
    assert review["started_at"] is None
    assert review["completed_at"] is None


def test_step_count_zero_is_distinct_from_step_count_null(client, monkeypatch):
    """⚠ **D-07's CENTRAL DISTINCTION, on the wire: `0` is a FACT and `null` is a SILENCE.**

    Three renders, asserted together in one case so the contrast cannot be split up and
    half-forgotten:

      * ``gather`` DECLARED 312 — a measured number;
      * ``write``  declares NOTHING — ``step_count`` is ``null`` and so is ``step_noun``,
        because its phase type does not count things. The client renders no count at all;
      * ``count: 0`` — a step that searched and found nothing. ``step_count == 0``,
        **not** ``None``, and the noun is still present.

    A consumer that writes ``step_count ?? 0`` collapses the second into the third and
    prints "0 sources" under a step that never claimed to measure anything. A producer
    that suppressed falsy counts collapses the third into the second and erases an honest
    zero. Both directions are the defect; this case pins both.
    """
    store = _canvas_on(monkeypatch)
    body = client.get(f"/workflow-runs/{_OWNED_RUN_ID}").json()

    gather = next(p for p in body["phases"] if p["slug"] == "gather")
    assert gather["step_count"] == 312
    assert gather["step_noun"] == "sources"

    write = next(p for p in body["phases"] if p["slug"] == "write")
    assert write["step_count"] is None, (
        "a phase type that declares no count must send null - not 0. 0 would claim a "
        "measurement of nothing, which is a different and false statement"
    )
    assert write["step_noun"] is None, "the noun is non-null iff the count is non-null"

    # ...and the honest zero, on a row seeded for exactly this.
    for row in store.rows["workflow_phases"]:
        if row["slug"] == "gather":
            row["output"] = {"_measure": {"count": 0, "noun": "sources"}}
    zero = next(
        p for p in client.get(f"/workflow-runs/{_OWNED_RUN_ID}").json()["phases"]
        if p["slug"] == "gather"
    )
    assert zero["step_count"] == 0, "a real measurement of zero must survive to the wire"
    assert zero["step_count"] is not None
    assert zero["step_noun"] == "sources", "a zero count still carries its noun"


def test_the_raw_output_jsonb_never_reaches_the_wire(client, monkeypatch):
    """T-200-02-02 — ``output`` is SELECTED server-side but is NOT a wire field.

    ``_persist_output`` stores each executor's dict FULL AND INLINE, so this jsonb carries
    prompts, citations and field maps. The projection has to ask for it (that is where the
    declared measure lives), and the thing that keeps it off the wire is that no response
    model declares it: ``response_model=WorkflowRunRead`` drops undeclared keys.

    The fixture plants a sentinel string in every phase's output, so this is a real search
    of the response bytes rather than a check that one key name is absent.
    """
    _canvas_on(monkeypatch)
    resp = client.get(f"/workflow-runs/{_OWNED_RUN_ID}")

    assert resp.status_code == 200
    assert "SECRET-PROMPT-MUST-NOT-SHIP" not in resp.text, (
        "the raw output jsonb reached the client - it carries prompts and citations, and "
        "only the two extracted scalars (step_count / step_noun) may cross"
    )
    for phase in resp.json()["phases"]:
        assert "output" not in phase
        assert "_measure" not in phase
