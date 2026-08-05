"""Phase 182 (VALID-01 / ROADMAP SC#3) — the canvas off-switch is NON-DISCOVERABLE.

This file closes the CR-01 / CR-02 blocker independently confirmed in ``182-VERIFICATION.md``
and re-raised in ``182-REVIEW.md``. ``Depends(require_canvas())`` made the flag-off canvas a
404 for every *dependency-reachable* caller, but two channels sat structurally OUTSIDE the
dependency-injection layer and still told an anonymous prober that the routes exist:

  1. **the request-body decode race** — FastAPI decodes the body in ``get_request_handler``
     BEFORE ``solve_dependencies`` runs, so hostile bytes 422'd ahead of the gate's 404;
     Starlette's router likewise 405'd a wrong-method probe and 307'd a trailing slash, both
     before any dependency;
  2. **the published OpenAPI schema** — ``GET /openapi.json`` is anonymous + unconditional
     and advertised both gated paths plus every canvas-only model.

**Every probe here FAILS against the pre-fix code.** Transcript captured at the pre-fix HEAD
(flag cold-off, anonymous, TestClient) so a future reader can re-falsify:

    POST /workflows/validate   b"{"   -> 422  {"detail":[{"type":"json_invalid",...}]}
    POST /workflows/validate/  b"{"   -> 422
    GET  /workflows/validate          -> 405  {"detail":"Method Not Allowed"}
    POST /workflows/grounding-bundle  -> 405  {"detail":"Method Not Allowed"}
    GET  /openapi.json                -> 200, BOTH canvas paths + all 5 canvas models present

The honest 404 baseline every byte-identity assertion compares against is
``/workflows/__nope__/__nope__`` — deliberately TWO segments, because a single unknown
segment matches ``PATCH/DELETE /workflows/{definition_id}`` and yields 405, not 404 (the same
choice ``test_revert_byte_identical.py`` makes; the single-segment asymmetry is round-2 review
WR-09 and is out of scope here).

Repo conventions followed: imports inside test bodies (Phase 102 posture), the ``client``
fixture, and three-line local ``_cold_off`` / ``_flipped_on`` helpers copied from the sibling
files rather than a shared fixture.
"""
from types import SimpleNamespace

# The canvas-gated routes. Kept as literals here — this file is the EXPECTATION side, so it
# must not read ``CANVAS_GATED_PATHS`` (a test that imports the constant it is checking would
# pass even if someone emptied the constant).
_VALIDATE_PATH = "/workflows/validate"
_BUNDLE_PATH = "/workflows/grounding-bundle"
# Phase 188 (RUNVIZ-03 / D-188-15) — the run read, on its OWN router prefix. This is a path
# TEMPLATE, and it is the member that proves ``CANVAS_GATED_PATHS`` is a set of absolute
# templates spanning routers rather than "the /workflows namespace". Note the asymmetry it
# exposes: a template can never match the middleware's exact-request-path half, so this member
# is load-bearing for the OpenAPI filter ONLY — its request-path 404 comes from
# ``Depends(require_canvas())`` (pinned in test_188_workflow_run_read.py +
# test_revert_byte_identical.py), which is why the path probes below stay on the two
# ``/workflows`` members.
_RUN_READ_PATH = "/workflow-runs/{workflow_run_id}"
_CANVAS_PATHS = (_VALIDATE_PATH, _BUNDLE_PATH, _RUN_READ_PATH)

# The two literal-path canvas routes — the subset that the REQUEST-path probes (malformed
# body / wrong method / trailing slash) can meaningfully target. A templated path cannot be
# probed as a literal, and its request-side gate is a different mechanism.
_CANVAS_LITERAL_PATHS = (_VALIDATE_PATH, _BUNDLE_PATH)

# The honest 404 baseline: a path in the SAME namespace that was never built.
_UNBUILT_PATH = "/workflows/__nope__/__nope__"

# The models declared ONLY by the canvas routes — five from the two /workflows routes (182-02)
# plus the two Phase-188 run-read models.
#
# ⚠ MEASURED, NOT PREDICTED (188-03 Task 2; RESEARCH A5). Which models actually move is a
# property of the reference graph, not of which route declared them: ``canvas_filtered_openapi``
# subtracts ``kept_refs`` so anything a surviving path still references is NEVER removed. The
# observed set difference at 188-03 was exactly:
#     {'GroundingBundleResponse', 'PaletteFolder', 'PaletteSkill', 'ValidateResponse',
#      'Verdict', 'WorkflowRunPhaseRead', 'WorkflowRunRead'}
# ``WorkflowDefinition`` did NOT move even though ``POST /workflows/validate`` takes it as its
# body — it stays published because three NON-canvas paths still reference it
# (``POST /workflows``, ``PATCH /workflows/{definition_id}``, ``POST /workflows/generate``).
# That is the filter behaving correctly, and it is why this list is read off a run rather than
# derived by reading the route decorators.
_CANVAS_SCHEMAS = (
    "ValidateResponse",
    "Verdict",
    "GroundingBundleResponse",
    "PaletteFolder",
    "PaletteSkill",
    "WorkflowRunRead",
    "WorkflowRunPhaseRead",
)

# CONTROLS — a schema and a path from NON-canvas routes on the same router. These are what
# prove the filter removes the canvas surface and NOT more: ``PublishVerdict`` is the publish
# gauntlet's model and ``GET /workflows/published`` is a sibling route (workflows.py:156).
_CONTROL_SCHEMA = "PublishVerdict"
_CONTROL_PATH = "/workflows/published"

_JSON_CT = {"content-type": "application/json"}


async def _is_op_true(user_id):
    return True


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


# ── 1) CR-01: a MALFORMED body is byte-identical to an unbuilt path ────────────


def test_malformed_body_is_byte_identical_to_an_unbuilt_path(client, monkeypatch):
    """Hostile bytes to a gated path are indistinguishable from a path that never existed.

    THE blocker probe. The pre-fix code returned **422 json_invalid** here, because FastAPI
    decodes the body before dependencies run — which advertised, to an anonymous caller with
    no credentials, that a JSON-body handler is declared at exactly that path.

    Byte-identity is asserted on the raw ``.content`` and the ``content-type`` header, not
    just the status: a 404 carrying a different body or media type would still be a
    distinguishing signal.
    """
    _cold_off(monkeypatch)

    baseline = client.post(_UNBUILT_PATH, content=b"{", headers=_JSON_CT)
    assert baseline.status_code == 404, baseline.text

    # Only the LITERAL-path members can be probed as request paths — a templated member
    # (``/workflow-runs/{workflow_run_id}``) is not a URL, and its request-side gate is
    # ``Depends(require_canvas())`` rather than this middleware (see _RUN_READ_PATH).
    for path in _CANVAS_LITERAL_PATHS:
        resp = client.post(path, content=b"{", headers=_JSON_CT)
        assert resp.status_code == 404, f"{path}: {resp.text}"
        assert resp.status_code != 422, (
            f"CR-01 regression on {path}: a malformed body raced the flag gate and 422'd, so "
            "the off canvas is distinguishable from an unbuilt route. The flag must be "
            "decided in CanvasGateMiddleware, BEFORE routing and body decode."
        )
        assert resp.content == baseline.content, (
            f"{path}: body bytes differ from the unbuilt-path baseline "
            f"({resp.content!r} vs {baseline.content!r})"
        )
        assert resp.headers.get("content-type") == baseline.headers.get("content-type"), (
            f"{path}: content-type differs from the unbuilt-path baseline"
        )
        assert resp.json() == {"detail": "Not Found"}


# ── 2) CR-01: a WRONG-METHOD probe must not 405 ───────────────────────────────


def test_wrong_method_probe_404s_not_405(client, monkeypatch):
    """A method that is not declared on a gated path returns 404, never 405.

    Pre-fix: ``GET /workflows/validate`` -> 405 and ``POST /workflows/grounding-bundle`` ->
    405. A 405 admits that a handler IS declared at exactly that path (just not for this
    method) — an unbuilt path answers identically for every method, so the gate matches on
    PATH ONLY.

    ⚠ THIS ASSERTION ENCODES AN ACCEPTED RISK, NOT A CLOSED ONE — read before "fixing" it.

    The round-3 verification (``182-VERIFICATION.md`` Truth 3 / review CR-01) showed that a
    uniform 404 does not actually make these paths indistinguishable, because this router
    declares ``PATCH``/``DELETE /workflows/{definition_id}``: EVERY other single-segment
    ``/workflows/<x>`` name is shadowed by those and answers 405/403/422, so the two paths that
    answer 404 are the two gated ones. One anonymous method sweep over a wordlist enumerates
    them. Closing that properly means deriving the gate's response from what the router WOULD
    have answered for the path+method shape had the routes never been declared — which is real
    work and is deliberately deferred, see SEED-134.

    The operator accepted the residual on 2026-07-25: the leak discloses two ROUTE NAMES and
    no data or access, and the flag flips ON in Phase 183/184, at which point the routes are
    public by design. That decision is recorded in ``182-DECISION-NOTES.md``.

    So: keep this test (it still guards the 405-on-a-gated-path form, a strictly worse leak
    that also confirms the handler's METHOD set). But if you are here because a correct SC#3
    fix made it fail, the FIX is right and this expectation is the thing to update — do not
    weaken the fix to satisfy this line.
    """
    _cold_off(monkeypatch)

    probes = (
        ("GET", _VALIDATE_PATH, client.get(_VALIDATE_PATH)),
        ("POST", _BUNDLE_PATH, client.post(_BUNDLE_PATH, content=b"{", headers=_JSON_CT)),
    )
    for method, path, resp in probes:
        assert resp.status_code == 404, f"{method} {path}: {resp.text}"
        assert resp.status_code != 405, (
            f"CR-01 regression: {method} {path} returned 405, which advertises that a handler "
            "is declared at exactly that path while the canvas is off."
        )
        assert resp.json() == {"detail": "Not Found"}


# ── 3) CR-01: the TRAILING-SLASH variant must not 307/422 ─────────────────────


def test_trailing_slash_probe_404s_not_307_or_422(client, monkeypatch):
    """``/workflows/validate/`` and ``/workflows/grounding-bundle/`` are 404 while off.

    Starlette's ``redirect_slashes`` issues a 307 ONLY when the slash-stripped path matches a
    mounted route — so the redirect itself is an existence signal, and pre-fix the redirect
    was followed straight into the 422 (``POST /workflows/validate/`` + ``b"{"`` -> 422). The
    gate normalizes one trailing slash before its membership test.
    """
    _cold_off(monkeypatch)

    post_slash = client.post(_VALIDATE_PATH + "/", content=b"{", headers=_JSON_CT)
    assert post_slash.status_code == 404, post_slash.text
    assert post_slash.status_code not in (307, 422), (
        "trailing-slash escape: a redirect (or the 422 behind it) advertises the route"
    )

    get_slash = client.get(_BUNDLE_PATH + "/")
    assert get_slash.status_code == 404, get_slash.text
    assert get_slash.status_code != 307
    assert get_slash.json() == {"detail": "Not Found"}


# ── 4) the AUTHENTICATED-OPERATOR case (holds by construction) ────────────────


def test_malformed_body_404s_for_an_authenticated_operator(client, monkeypatch):
    """An authenticated OPERATOR gets the same 404 for the malformed-body probe.

    Reuses the caller-injection posture of
    ``test_revert_byte_identical.py::test_require_canvas_404s_for_an_authenticated_operator_when_off``
    (inject ``authenticate_canvas_request`` so the anonymous fold cannot be the cause, and
    make ``is_operator`` true). This must hold BY CONSTRUCTION — the middleware precedes auth
    entirely, so no caller identity can reach the handler while off. Falsifiable: move the
    decision back into the dependency and the operator's malformed body 422s again.
    """
    import app.dependencies as deps

    _cold_off(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": "00000000-0000-0000-0000-000000000001", "email": "op@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_true)

    resp = client.post(_VALIDATE_PATH, content=b"{", headers=_JSON_CT)
    assert resp.status_code == 404, resp.text
    assert resp.status_code not in (200, 401, 403, 422)
    assert resp.json() == {"detail": "Not Found"}


# ── 5) CR-02: /openapi.json publishes no canvas surface while off ─────────────


def test_openapi_omits_the_canvas_surface_when_off(client, monkeypatch):
    """The anonymous, unconditional schema read hides both paths and all five models.

    Pre-fix this returned 200 with both canvas paths and all five models present — a complete
    map of the surface the 404 is meant to hide, readable with no credentials on any
    finalized deploy.

    The CONTROL assertions are what make this a real proof rather than "the filter deleted
    something": a sibling non-canvas path and a non-canvas model must SURVIVE.
    """
    _cold_off(monkeypatch)

    resp = client.get("/openapi.json")
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    paths = doc["paths"]
    schemas = doc["components"]["schemas"]

    for path in _CANVAS_PATHS:
        assert path not in paths, f"CR-02: {path} is still advertised while the canvas is off"
    for name in _CANVAS_SCHEMAS:
        assert name not in schemas, f"CR-02: model {name} is still published while off"

    # CONTROL — the filter removes the canvas surface and NOTHING else.
    assert _CONTROL_PATH in paths, (
        f"{_CONTROL_PATH} is a non-canvas sibling route and must survive the filter"
    )
    assert _CONTROL_SCHEMA in schemas, (
        f"{_CONTROL_SCHEMA} belongs to a non-canvas route and must survive the filter"
    )
    assert "HTTPValidationError" in schemas, "the app-wide error model must survive the filter"


# ── 6) D-182-R2-02: the CACHE TRAP — both directions in ONE process ───────────


def test_openapi_tracks_the_flag_in_both_directions_in_one_process(client, monkeypatch):
    """off -> on -> off, same process, no restart. THE falsifier for the cache trap.

    ``FastAPI.openapi()`` memoizes its result on the app. A hook that computes the filtered
    document once and stores it in that memo — or that mutates the cached full document in
    place instead of deep-copying — PASSES the first (off) assertion and FAILS the second
    (on) one, serving a stale document forever. That is precisely the mistake this test
    exists to catch, which is why the flip-on assertion runs AFTER the off assertion has
    already forced a filtered read.

    Observed against a deliberately mis-cached implementation (falsification run, plan
    182-08): the flag-on assertion failed with
    ``AssertionError: cache trap: /workflows/validate did not come back after the flip on``.
    """
    _cold_off(monkeypatch)
    off_doc = client.get("/openapi.json").json()
    for path in _CANVAS_PATHS:
        assert path not in off_doc["paths"]
    for name in _CANVAS_SCHEMAS:
        assert name not in off_doc["components"]["schemas"]

    _flipped_on(monkeypatch)
    on_doc = client.get("/openapi.json").json()
    for path in _CANVAS_PATHS:
        assert path in on_doc["paths"], (
            f"cache trap: {path} did not come back after the flip on — the hook is serving a "
            "memoized filtered document (or mutated the cached original in place)."
        )
    for name in _CANVAS_SCHEMAS:
        assert name in on_doc["components"]["schemas"], (
            f"cache trap: model {name} did not come back after the flip on."
        )

    # ...and back off again — the other direction of the same trap.
    _cold_off(monkeypatch)
    off_again = client.get("/openapi.json").json()
    for path in _CANVAS_PATHS:
        assert path not in off_again["paths"], (
            f"cache trap (reverse): {path} is still published after flipping back off."
        )
    assert set(off_again["paths"]) == set(off_doc["paths"])
    assert set(off_again["components"]["schemas"]) == set(off_doc["components"]["schemas"])

    # Exactly the canvas surface moved — nothing else drifted between the two states.
    assert set(on_doc["paths"]) - set(off_doc["paths"]) == set(_CANVAS_PATHS)
    assert set(on_doc["components"]["schemas"]) - set(
        off_doc["components"]["schemas"]
    ) == set(_CANVAS_SCHEMAS)
    assert not set(off_doc["paths"]) - set(on_doc["paths"])


# ── 7) the middleware is a NO-OP outside CANVAS_GATED_PATHS ───────────────────


def test_non_canvas_paths_are_untouched_while_off(client, monkeypatch):
    """An ordinary route behaves exactly as before with the flag off (red line D-14).

    The gate must be invisible to every path it does not own — otherwise "byte-identical" is
    traded for a new, broader regression.
    """
    _cold_off(monkeypatch)

    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["status"] == "ok"

    # A sibling on the SAME router is equally untouched (a 404 here would mean the gate
    # over-matched the /workflows namespace).
    assert client.get(_CONTROL_PATH).status_code != 404

    # And the unbuilt-path baseline itself still answers the honest 404.
    assert client.get(_UNBUILT_PATH).status_code == 404


# ── 8) the expectation literals are test-local BY CONSTRUCTION, not by comment ─


def test_this_file_never_imports_the_module_it_checks():
    """The literals at the top of this file must never become an import (188-03 Task 2).

    The header has said since 182 that this file *"must not read ``CANVAS_GATED_PATHS``"* —
    but that was enforced only by the sentence itself. Phase 188 was the first time the
    constant grew, and the temptation to import it (so the fence "can't drift") is exactly
    what the convention forbids: a test that imports the constant it is checking passes even
    if someone empties that constant, and the whole exact-set fence becomes vacuous.

    This pins it mechanically. The needle is ASSEMBLED FROM PARTS (the 187-24 lesson) so this
    file's OWN source cannot satisfy the grep that is run over it — spelling the module path
    inline, even inside this docblock, would make the assertion fail against a clean file and
    teach the next reader to delete it.
    """
    from pathlib import Path

    source = Path(__file__).read_text(encoding="utf-8")
    gate_module = "app.middleware." + "canvas_gate"

    assert gate_module not in source, (
        "this file imports (or names) the gate module — the expectation side must keep its "
        "own literals, or the exact-set fence passes against an emptied constant"
    )

    # POSITIVE CONTROL — the needle really does match the shape it forbids, so its absence
    # above is a measurement and not a tautology.
    forbidden_import = "from " + gate_module + " import " + "CANVAS_" + "GATED_PATHS"
    assert gate_module in forbidden_import
