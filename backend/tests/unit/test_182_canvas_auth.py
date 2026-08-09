"""Phase 182 (VALID-01) — WR-08: the canvas routes must resolve their caller EXACTLY ONCE.

**The defect, in numbers.** Both canvas routes carried
``dependencies=[Depends(require_canvas())]`` **and** ``current_user: dict = Depends(get_current_user)``.
``require_canvas._dep`` resolves the caller itself through ``authenticate_canvas_request``
(``supabase.auth.get_user(...)`` + ``_is_banned(...)``); ``get_current_user`` then validated the
SAME bearer token again with another ``supabase.auth.get_user(...)`` + another ``_is_banned(...)``.
Per request that is **2 GoTrue round-trips + 2 ``auth.users`` ban queries**, on a route the seam
header itself documents as firing "on every canvas edit". Both calls are synchronous
``supabase-py`` invoked directly inside ``async def`` — the pattern CLAUDE.md forbids
(D-v2.5-01) — so each one owned the event loop of a worker that also serves SSE chat streams.

**Why the pre-existing suite structurally could not see it.** The doubling lives in the gap
between two seams the suite already fakes on OPPOSITE sides: ``conftest`` installs a blanket
``app.dependency_overrides[get_current_user]`` (short-circuiting the handler's resolution to a
dict, so it costs nothing and is invisible), while ``test_182_grounding_bundle`` /
``test_181_flip_on`` monkeypatch ``authenticate_canvas_request`` (short-circuiting the gate's
resolution, so IT costs nothing either). Every existing canvas test blinds itself to one half or
the other. A test that wants to SEE the doubling therefore has to do two things the suite never
did: **pop the conftest override** so the handler's resolution is real, and **count at the ONE
seam both resolution paths traverse**.

That shared seam is ``supabase.auth.get_user`` — the GoTrue round-trip WR-08 actually counts.
Counting at ``authenticate_canvas_request`` alone cannot observe the defect at all, because
``get_current_user`` does not call it: that counter reads 1 both before and after the fix. So the
load-bearing counter here is installed on a fake supabase client (``get_user`` calls +
``_is_banned`` calls), and ``authenticate_canvas_request`` is additionally WRAPPED (not replaced)
so the gate's own resolution count is asserted alongside it, with the real threadpooled body
still running underneath.

**Falsifiability (re-run any time).** Revert ONLY the two ``Depends(canvas_caller)`` edits in
``workflows.py`` back to ``Depends(get_current_user)`` and tests (1) and (2) FAIL with an observed
GoTrue count of **2**. Remove the ``request.state.canvas_caller`` assignment from
``require_canvas._dep`` and the flag-on routes return **404, not 500** — the hand-off fails CLOSED
onto the same byte-identical 404 every deny path in the gate raises (D-182-05: never a 403, which
would admit the route exists; never a 500, which is itself an existence signal).

Fully offline: no DB, no pg pool, no network. Follows the repo conventions — imports inside test
bodies, the ``client`` fixture, local ``_cold_off`` / ``_flipped_on`` helpers.
"""
import threading
from types import SimpleNamespace

_BUNDLE_PATH = "/workflows/grounding-bundle"
_VALIDATE_PATH = "/workflows/validate"

# A DISTINCTIVE caller id — deliberately NOT conftest's mock user
# (00000000-0000-0000-0000-000000000001). Test (3) asserts the handler acted on THIS id, which
# proves the identity travelled through the gate's hand-off rather than arriving from the
# blanket conftest override or some incidental default.
_CALLER_ID = "7f3a1c58-2b64-4e19-9d0a-000000000abc"
_CALLER_EMAIL = "canvas.caller@example.com"

# The smallest schema-valid WorkflowDefinition (mirrors test_revert_byte_identical.py):
# ``phases: []`` IS shape-valid, so this body cannot 422 and the count is never confounded by a
# request that died at the shape tier.
_MINIMAL_VALID_DEFINITION = {"slug": "x", "version": 1, "name": "X", "phases": []}

_AUTH_HEADER = {"Authorization": "Bearer canvas-token-abc"}


async def _is_op_false(user_id):
    return False


async def _is_op_true(user_id):
    return True


async def _not_banned(user_id):
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


def _arm_counting_auth(monkeypatch, *, caller_id=_CALLER_ID):
    """Arm the WR-08 instrumentation and return the counter dict.

    Installs a fake supabase client whose ``auth.get_user`` is the SHARED seam both resolution
    paths go through — the gate's ``authenticate_canvas_request`` and the handler's (pre-fix)
    ``get_current_user`` both call it with the same token. Counting HERE is the only way to
    observe the doubling; a counter on ``authenticate_canvas_request`` reads 1 either way.

    Also:
      * WRAPS (does not replace) ``authenticate_canvas_request`` so the gate's own resolution
        count is observable while its real, threadpooled body still runs;
      * counts ``_is_banned`` calls — the second half of WR-08's cost (2 ``auth.users`` queries
        per request) — and answers False so no pg pool is touched;
      * pops conftest's blanket ``get_current_user`` override so the handler's resolution is
        REAL. Without this pop the pre-fix code costs nothing observable and the test is
        decoration. (``reset_mocks`` restores every override at the next test — the
        ``test_revert_byte_identical`` posture.)
    """
    import app.dependencies as deps
    from app.dependencies import get_current_user, get_supabase
    from app.main import app

    counters = {"gotrue": 0, "ban_checks": 0, "gate_resolutions": 0, "tokens": []}
    lock = threading.Lock()

    def _get_user(token):
        # Runs on a threadpool worker (D-v2.5-01), hence the lock.
        with lock:
            counters["gotrue"] += 1
            counters["tokens"].append(token)
        return SimpleNamespace(user=SimpleNamespace(id=caller_id, email=_CALLER_EMAIL))

    fake_supabase = SimpleNamespace(auth=SimpleNamespace(get_user=_get_user))

    async def _counting_is_banned(user_id):
        counters["ban_checks"] += 1
        return False

    real_authenticate = deps.authenticate_canvas_request

    async def _counting_authenticate(credentials, supabase):
        counters["gate_resolutions"] += 1
        return await real_authenticate(credentials, supabase)

    monkeypatch.setattr(deps, "authenticate_canvas_request", _counting_authenticate)
    monkeypatch.setattr(deps, "_is_banned", _counting_is_banned)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    app.dependency_overrides[get_supabase] = lambda: fake_supabase
    app.dependency_overrides.pop(get_current_user, None)

    return counters


def _fake_palette(monkeypatch, *, record=None):
    """Swap the ONE registry read for a fake bundle (no live DB, no supabase call).

    When ``record`` is a dict, the ``user_id`` keyword the route passes is captured into it —
    that is how test (3) proves WHICH identity the handler acted on.
    """
    from app.services.harness import grounding as g

    async def _fake_assemble(**kwargs):
        if record is not None:
            record["user_id"] = kwargs.get("user_id")
        return g.GroundingBundle(
            tools=["search_documents"],
            tool_names={"search_documents"},
            folders=[],
            skills=[],
            skill_ids=set(),
            placeholders=[],
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _fake_assemble)


# ── 1) the load-bearing proof: ONE caller resolution per GET request ──────────


def test_the_get_route_resolves_the_caller_exactly_once(client, monkeypatch):
    """`GET /workflows/grounding-bundle` validates the bearer token ONCE (WR-08).

    FAILS AGAINST THE PRE-FIX CODE with an observed count of 2: the gate resolved the caller
    via ``authenticate_canvas_request`` and the handler's ``Depends(get_current_user)`` then
    validated the SAME token again. The conftest override that used to hide the second call is
    popped here, so the handler's resolution is the real one.
    """
    _flipped_on(monkeypatch)
    counters = _arm_counting_auth(monkeypatch)
    _fake_palette(monkeypatch)

    resp = client.get(_BUNDLE_PATH, headers=_AUTH_HEADER)
    assert resp.status_code == 200, resp.text

    assert counters["gotrue"] == 1, (
        f"WR-08: the bearer token was validated {counters['gotrue']}x for ONE canvas request. "
        "A count of 2 means the handler re-authenticated the same token the gate had already "
        "validated (2 GoTrue round-trips per canvas edit) — this is exactly what the pre-fix "
        f"code did. Tokens seen: {counters['tokens']}"
    )
    assert counters["ban_checks"] == 1, (
        f"WR-08: {counters['ban_checks']} auth.users ban queries for ONE request; expected 1."
    )
    # The gate itself resolved once — the other half of "exactly once", asserted separately so a
    # regression tells you WHICH side doubled.
    assert counters["gate_resolutions"] == 1, counters


# ── 2) the same proof on the POST route ───────────────────────────────────────


def test_the_post_route_resolves_the_caller_exactly_once(client, monkeypatch):
    """`POST /workflows/validate` validates the bearer token ONCE (WR-08).

    The keystroke-frequency route — the seam header documents it as firing on every canvas
    edit, which is what makes the doubling a real DoS surface rather than a style nit.
    Same construction as (1); FAILS with an observed count of 2 against the pre-fix code.
    """
    _flipped_on(monkeypatch)
    counters = _arm_counting_auth(monkeypatch)
    _fake_palette(monkeypatch)

    resp = client.post(_VALIDATE_PATH, json=_MINIMAL_VALID_DEFINITION, headers=_AUTH_HEADER)
    assert resp.status_code == 200, resp.text

    assert counters["gotrue"] == 1, (
        f"WR-08: the bearer token was validated {counters['gotrue']}x for ONE canvas request. "
        "A count of 2 means the handler re-authenticated the same token the gate had already "
        "validated — the pre-fix behaviour, on the route that fires on every canvas edit."
    )
    assert counters["ban_checks"] == 1, counters
    assert counters["gate_resolutions"] == 1, counters


# ── 3) the hand-off carries the RIGHT identity, not merely some identity ──────


def test_the_handler_acts_on_the_identity_the_gate_resolved(client, monkeypatch):
    """The palette read is scoped to the user id the GATE validated (`request.state` hand-off).

    A single-resolution count alone would still pass if the hand-off delivered the wrong caller
    (or a stale conftest default), so this pins WHICH identity crossed the seam: the distinctive
    ``_CALLER_ID`` the gate resolved must be the ``user_id`` the owner-scoped palette read
    receives. It is deliberately NOT conftest's mock user id.
    """
    _flipped_on(monkeypatch)
    _arm_counting_auth(monkeypatch)
    seen: dict = {}
    _fake_palette(monkeypatch, record=seen)

    resp = client.get(_BUNDLE_PATH, headers=_AUTH_HEADER)
    assert resp.status_code == 200, resp.text

    assert seen.get("user_id") == _CALLER_ID, (
        "the handler scoped its owner-only read to "
        f"{seen.get('user_id')!r}, not to the identity the gate validated ({_CALLER_ID!r}) — "
        "the request.state hand-off delivered the wrong caller"
    )
    assert seen["user_id"] != "00000000-0000-0000-0000-000000000001", (
        "the handler acted on conftest's blanket mock user — the identity did not come from "
        "the gate at all"
    )


# ── 4) D-v2.5-01: the blocking GoTrue read is off the event loop ──────────────


async def test_the_blocking_gotrue_read_runs_off_the_event_loop(monkeypatch):
    """`authenticate_canvas_request` dispatches `supabase.auth.get_user` through the threadpool.

    Determinism: ``run_in_threadpool`` (anyio ``to_thread.run_sync``) ALWAYS executes on a worker
    thread distinct from the event-loop thread, and this coroutine runs on the event-loop thread.
    So "the recorded thread differs from the test's own thread" is true iff the call was
    threadpooled — a direct call would necessarily record the SAME thread. That is why the thread
    identity is the assertion rather than a timing or ordering probe (which pytest-asyncio would
    not make deterministic).

    Offline: the fake supabase returns an object with a ``user`` attribute and ``_is_banned`` is
    patched, so no pg pool and no network are touched.
    """
    import app.dependencies as deps

    test_thread = threading.current_thread()
    seen: dict = {}

    def _get_user(token):
        seen["thread"] = threading.current_thread()
        return SimpleNamespace(user=SimpleNamespace(id=_CALLER_ID, email=_CALLER_EMAIL))

    monkeypatch.setattr(deps, "_is_banned", _not_banned)

    caller = await deps.authenticate_canvas_request(
        SimpleNamespace(credentials="canvas-token-abc"),
        SimpleNamespace(auth=SimpleNamespace(get_user=_get_user)),
    )

    # The contract is unchanged by the wrap — same dict shape, same keys.
    assert caller == {"id": _CALLER_ID, "email": _CALLER_EMAIL}
    assert seen["thread"] is not test_thread, (
        "D-v2.5-01: supabase.auth.get_user executed on the event-loop thread "
        f"({test_thread.name}) — the blocking GoTrue call is NOT wrapped in run_in_threadpool, "
        "so it stalls every concurrent SSE stream on this worker for its duration"
    )


# ── 5) the hand-off fails CLOSED, onto the byte-identical 404 ─────────────────


async def test_canvas_caller_fails_closed_to_the_byte_identical_404():
    """An absent `request.state.canvas_caller` is a 404 — never 500, never 403, never 401.

    The only way to reach a canvas handler is through ``require_canvas``, which always publishes
    the caller before letting a request past — so an absent value means the gate did not run, and
    the honest answer to that on a canvas route is the SAME ``_NOT_FOUND`` every deny path raises
    (T-182-34). The negative assertions are the point: a 403 admits the route exists-but-forbidden
    (D-182-05 forbids it outright, which is why this surface uses ``require_canvas`` and never
    ``require_visible``), a 401 leaks the same thing through the "you'd be allowed if you
    authenticated" channel (CR-01), and a 500 is itself an existence signal on a route contracted
    to be indistinguishable from one that was never built.
    """
    import pytest
    from fastapi import HTTPException
    from starlette.requests import Request

    import app.dependencies as deps

    request = Request(
        {"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""}
    )
    assert getattr(request.state, "canvas_caller", None) is None  # the gate did not run

    with pytest.raises(HTTPException) as exc:
        await deps.canvas_caller(request)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Not Found"  # byte-identical to an unbuilt path
    assert exc.value.status_code != 500, "a 500 is an existence signal (REVERT-01 / D-181-02)"
    assert exc.value.status_code != 403, "a 403 admits the route exists (D-182-05)"
    assert exc.value.status_code != 401, "a 401 leaks the same existence (CR-01)"


# ── 6) regression guard: the flag-off 404 posture is unperturbed ──────────────


def test_the_flag_off_404_posture_is_unperturbed(client, monkeypatch):
    """With the canvas off, BOTH routes still 404 for anonymous, operator and bogus-token callers.

    The auth rework touched the gate's success branches and the handlers' identity source; this
    proves it perturbed none of the deny paths. conftest's blanket ``get_current_user`` override
    is popped so the REAL path runs — the same posture ``test_revert_byte_identical`` uses for
    its pre-auth probes.
    """
    import app.dependencies as deps
    from app.dependencies import get_current_user
    from app.main import app

    _cold_off(monkeypatch)
    app.dependency_overrides.pop(get_current_user, None)

    for is_op, label in ((_is_op_false, "end user"), (_is_op_true, "operator")):
        monkeypatch.setattr(deps, "is_operator", is_op)

        anonymous_get = client.get(_BUNDLE_PATH)
        bogus_get = client.get(_BUNDLE_PATH, headers={"Authorization": "Bearer not-a-real-token"})
        anonymous_post = client.post(_VALIDATE_PATH, json=_MINIMAL_VALID_DEFINITION)
        bogus_post = client.post(
            _VALIDATE_PATH,
            json=_MINIMAL_VALID_DEFINITION,
            headers={"Authorization": "Bearer not-a-real-token"},
        )

        for resp in (anonymous_get, bogus_get, anonymous_post, bogus_post):
            assert resp.status_code == 404, f"{label}: {resp.status_code} — {resp.text}"
            assert resp.status_code not in (200, 401, 403, 422, 500), label
            assert resp.json() == {"detail": "Not Found"}, label
