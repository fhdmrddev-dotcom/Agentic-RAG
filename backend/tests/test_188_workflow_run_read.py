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

    Only the surface the run read chains is implemented: ``select`` / ``eq`` / ``order`` /
    ``maybe_single`` / ``execute``. ``execute`` is SYNC because ``aexec`` runs it through
    ``run_in_threadpool`` exactly as it would the real blocking client.
    """

    def __init__(self, store: "_FakeSupabase", table: str):
        self._store = store
        self._table = table
        self._filters: dict[str, str] = {}
        self._order_by: str | None = None
        self._single = False

    def select(self, *_columns, **_kwargs):
        return self

    def eq(self, column, value):
        self._filters[column] = str(value)
        return self

    def order(self, column, **_kwargs):
        self._order_by = column
        self._store.calls.append(("order", self._table, column))
        return self

    def maybe_single(self):
        self._single = True
        return self

    def execute(self):
        rows = [
            row
            for row in self._store.rows.get(self._table, [])
            if all(str(row.get(col)) == val for col, val in self._filters.items())
        ]
        if self._order_by is not None:
            rows = sorted(rows, key=lambda r: r[self._order_by])
        self._store.calls.append(("execute", self._table, dict(self._filters)))
        if self._single:
            return SimpleNamespace(data=rows[0] if rows else None)
        return SimpleNamespace(data=rows)


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
            "workflow_phases": [
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "write", "phase_index": 2,
                 "status": "completed"},
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "gather", "phase_index": 0,
                 "status": "completed"},
                {"workflow_run_id": _OWNED_RUN_ID, "slug": "review", "phase_index": 1,
                 "status": "skipped"},
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
