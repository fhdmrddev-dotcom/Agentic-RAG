"""Phase 181 (REVERT-01 / REVERT-02 / D-181-06) — the backend byte-identical acceptance gate.

This is the CI-run acceptance gate for operator HARD gate #1 ("preserve v1 + revert at any
time"). It rides the existing ``backend-tests.yml`` (no new CI job) and is the backend half
of the D-181-06 gate; the frontend half (nav-set parity + the ChatLayout render guard) is a
sibling ``revertByteIdentical`` vitest.

What "byte-identical" means here — OBSERVABLY, NOT a bundle hash (D-181-07):
with ``visual_workflow_canvas`` off (its cold default), the product a user experiences is
indistinguishable from today's — the same **nav set**, the same **reachable-route set** (every
canvas-gated route is a 404, byte-identical to a path that was never built — never a 403 that
leaks its existence), the same **HTTP responses**, the same **GET /features map** (the canvas
key is absent-as-false for EVERYONE, operators included), and the same **two authoring doors**
(Describe & run / Author & govern) + **run surface**, all untouched. It is deliberately NOT a
built-artifact hash: a hash is brittle (whitespace / bundler-nondeterminism) and proves the
wrong thing. Observable equivalence is the contract.

Each future canvas route (183+) MUST add its own "404 when off" assertion to
``test_require_canvas_404s_when_off`` (or a sibling) so the reachable-route set stays provably
empty while off — the gate grows WITH the surface it protects.

**Phase 182 (D-182-04) — repointed onto the REAL routes.** These assertions originally probed
the throwaway Phase-181 ``/canvas`` canary route, which was DELETED in 182-03 once the real
``require_canvas``-gated routes shipped in 182-02. They now ride:

  - ``GET  /workflows/grounding-bundle`` — the primary probe: a clean GET, no request body, so
    nothing can race the flag gate (the exact shape the canary had);
  - ``POST /workflows/validate`` — probed with a MINIMAL **VALID** ``WorkflowDefinition`` body
    (Pitfall 5). With an absent/malformed body a 422 could race the 404 and the test would pass
    for the wrong reason, so the body is validated against the real model in-test.

This is strictly STRONGER than the canary: the gate is now proven on the surface it actually
protects, not on a probe built to be proven.

Modeled on ``test_148_visibility_cold_default.py`` (monkeypatch the settings read to drive the
cold default) + TestClient 404 probes on the real canvas routes. The response body of
``GET /features`` IS ``get_effective_features(...)``'s return value, so the map-hides assert
reads it directly.
"""
from types import SimpleNamespace

# The two real canvas-gated routes (182-02) this gate rides. Both carry
# ``Depends(require_canvas())`` ALONE — see test_182_grounding_bundle.py /
# test_182_validate.py for the STRUCTURAL assertions that no 403-raising
# ``require_visible`` is stacked on either.
_BUNDLE_PATH = "/workflows/grounding-bundle"
_VALIDATE_PATH = "/workflows/validate"

# The smallest schema-valid WorkflowDefinition (Pitfall 5): ``phases: []`` IS shape-valid, so
# this body cannot 422 — the ONLY thing that can 404 the POST probe is the flag gate. Validated
# against the real model inside the test so schema drift can never silently weaken the proof.
_MINIMAL_VALID_DEFINITION = {"slug": "x", "version": 1, "name": "X", "phases": []}


async def _is_op_true(user_id):
    return True


async def _is_op_false(user_id):
    return False


def _cold_off(monkeypatch):
    """Flag off (cold default): an empty feature_visibility map -> canvas resolves "off"."""
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))


# ── 1) the /features map hides the canvas from EVERYONE when off (D-181-01) ────

def test_features_map_hides_canvas_from_everyone_when_off(client, monkeypatch):
    """get_effective_features -> visual_workflow_canvas is False for an operator AND a user.

    The operator case is the load-bearing one: the "off" guard must win over the ``op or ...``
    short-circuit, else an operator sees a phantom canvas by default and flag-off is NOT
    byte-identical for them.
    """
    import app.api.features as feats

    _cold_off(monkeypatch)

    # operator caller — must STILL see the canvas hidden
    monkeypatch.setattr(feats, "is_operator", _is_op_true)
    op_map = client.get("/features").json()["features"]
    assert op_map["visual_workflow_canvas"] is False, "operator must not see a phantom canvas"

    # end-user caller — hidden
    monkeypatch.setattr(feats, "is_operator", _is_op_false)
    user_map = client.get("/features").json()["features"]
    assert user_map["visual_workflow_canvas"] is False


# ── 2) a canvas-gated route is a 404 (never a 403) while off (D-181-02) ────────

def test_require_canvas_404s_when_off(client, monkeypatch):
    """Every require_canvas-gated route returns 404 (NEVER 403) while off, for ALL callers.

    404 (not 403) is the byte-identity posture: the off canvas is indistinguishable from a
    route that was never built. NOTE: each real canvas route added in 183+ should append
    its own 404-when-off probe here so the reachable-route set stays provably empty while off.

    Phase 182 (D-182-04): probes the REAL routes (the canary is gone). ``GET /grounding-bundle``
    carries the operator/user pair (a body-free GET), and ``POST /validate`` is probed with a
    minimal VALID body so the 404 can only come from the flag (Pitfall 5).
    """
    import app.dependencies as deps
    from app.main import app
    from app.models.harness import WorkflowDefinition

    _cold_off(monkeypatch)

    # operator — "off" resolves BEFORE the operator no-op, so an operator gets the same 404
    monkeypatch.setattr(deps, "is_operator", _is_op_true)
    resp_op = client.get(_BUNDLE_PATH)
    assert resp_op.status_code == 404, resp_op.text
    assert resp_op.status_code != 403

    # end user — 404
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    resp_user = client.get(_BUNDLE_PATH)
    assert resp_user.status_code == 404, resp_user.text
    assert resp_user.status_code != 403

    # POST /workflows/validate — same posture on the phase's other real route (SC#3).
    # The body is VALID (asserted here, not assumed) so a 422 can never race the 404: were
    # the body malformed this probe would pass for the wrong reason.
    WorkflowDefinition.model_validate(_MINIMAL_VALID_DEFINITION)
    resp_validate = client.post(_VALIDATE_PATH, json=_MINIMAL_VALID_DEFINITION)
    assert resp_validate.status_code == 404, resp_validate.text
    assert resp_validate.status_code != 403
    assert resp_validate.status_code != 422  # the gate fired BEFORE body validation
    assert resp_validate.status_code != 405  # and the path itself matched (not a method miss)

    # POSITIVE CONTROL — the 404s above are the GATE, not an absent route. Both paths are
    # genuinely mounted with the probed method, so "404" cannot mean "never built" here.
    # (The 200-when-on counterpart lives in test_181_flip_on.py + test_182_grounding_bundle.py.)
    mounted = {
        (getattr(r, "path", None), m)
        for r in app.routes
        for m in (getattr(r, "methods", None) or set())
    }
    assert (_BUNDLE_PATH, "GET") in mounted, f"{_BUNDLE_PATH} is not mounted — the 404 is vacuous"
    assert (_VALIDATE_PATH, "POST") in mounted, f"{_VALIDATE_PATH} is not mounted — 404 is vacuous"


# ── 2a) D-181-01: the flag wins over the operator no-op on a REAL authenticated call ──

def test_require_canvas_404s_for_an_authenticated_operator_when_off(client, monkeypatch):
    """An AUTHENTICATED OPERATOR still gets the byte-identical 404 while off (D-181-01).

    This is the discriminating version of the operator case, and it is the one that pins
    ``require_canvas``'s step ORDER. The sibling probes above send no Authorization header, so
    ``authenticate_canvas_request`` resolves ``None`` and the gate 404s at its anonymous-caller
    fold — meaning their ``is_operator`` patch is never even reached and their 404 does not
    prove WHICH step fired.

    Here the caller seam is injected (so the auth fold CANNOT be the cause) and ``is_operator``
    is true, with the flag OFF. The gate must STILL 404, because the "off" check runs BEFORE the
    operator no-op (D-181-01) — no phantom canvas for operators. Falsifiable: reorder the flag
    check after the operator short-circuit and this operator sails through to the handler
    (200/500), never 404.
    """
    import app.dependencies as deps

    _cold_off(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": "00000000-0000-0000-0000-000000000001", "email": "op@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_true)

    resp = client.get(_BUNDLE_PATH)
    assert resp.status_code == 404, resp.text  # any non-404 (incl. 200) is a D-181-01 regression
    assert resp.status_code != 403

    post = client.post(_VALIDATE_PATH, json=_MINIMAL_VALID_DEFINITION)
    assert post.status_code == 404, post.text
    assert post.status_code not in (200, 401, 403, 422)


# ── 2b) CR-01: require_canvas 404s PRE-AUTH for anonymous + bogus-token callers ───────

def test_require_canvas_404s_pre_auth_when_off(client, monkeypatch):
    """CR-01 regression: while off, a canvas route 404s (never 403/401) for callers who are NOT
    already authenticated — an ABSENT Authorization header AND a BOGUS/invalid bearer token.

    These are the two cases that previously LEAKED the gated route's existence: the shared
    auto_error=True ``bearer_scheme`` raised **403** ("Not authenticated") on an absent header,
    and ``get_current_user`` raised **401** ("Invalid or expired token") on a bad token — BOTH
    before ``require_canvas``'s off-flag check ran, so the off canvas was distinguishable from an
    unbuilt route for any unauthenticated caller. The fix resolves the off-flag FIRST against a
    non-raising ``_canvas_bearer_scheme``, folding both into the byte-identical 404.

    Exercises the REAL pre-auth path — the class of bug the rest of the 181 suite structurally
    cannot catch, because conftest's blanket ``get_current_user`` override injects a user and
    bypasses the genuine bearer scheme. So this pops that override (exactly as the /admin WR-02
    regression pops ``authenticate_operator_request``) and leaves the canvas ON-path auth seam
    (``authenticate_canvas_request``) REAL — nothing injects a caller, so an absent/bogus token
    flows through as in production. Falsifiable against the pre-fix code: with the override
    popped, the old ``Depends(get_current_user)`` chain returned 403 for the no-header case here.

    Phase 182 (D-182-04): repointed off the deleted canary onto the REAL
    ``GET /workflows/grounding-bundle`` — a body-free GET, the same shape the canary had.
    """
    from app.dependencies import get_current_user
    from app.main import app

    _cold_off(monkeypatch)  # flag off (cold default)
    # Pop the blanket override so the REAL auth path runs (reset_mocks restores it next test).
    app.dependency_overrides.pop(get_current_user, None)

    # (a) NO Authorization header — pre-fix leaked 403 "Not authenticated"
    no_auth = client.get(_BUNDLE_PATH)
    assert no_auth.status_code == 404, no_auth.text
    assert no_auth.status_code != 403
    assert no_auth.status_code != 401

    # (b) a bogus/invalid bearer token — pre-fix leaked 401 "Invalid or expired token"
    bogus = client.get(_BUNDLE_PATH, headers={"Authorization": "Bearer not-a-real-token"})
    assert bogus.status_code == 404, bogus.text
    assert bogus.status_code != 403
    assert bogus.status_code != 401

    # (c) the POST route holds the same pre-auth posture (valid body — Pitfall 5)
    post_no_auth = client.post(_VALIDATE_PATH, json=_MINIMAL_VALID_DEFINITION)
    assert post_no_auth.status_code == 404, post_no_auth.text
    assert post_no_auth.status_code not in (401, 403, 422)

    # parity: an unbuilt path in the SAME namespace returns a byte-identical 404. NOTE the probe
    # is TWO segments: a single unknown segment matches PATCH/DELETE /workflows/{definition_id}
    # and yields 405, not 404 (every real 2-segment workflow route has a literal 2nd segment).
    unknown = client.get("/workflows/__nope__/__nope__")
    assert unknown.status_code == 404, unknown.text
    assert no_auth.json() == unknown.json() == {"detail": "Not Found"}


# ── 3) the 4 shipped governed features are unchanged (no 148 regression, REVERT-02) ──

def test_existing_governed_features_unchanged(client, monkeypatch):
    """The 4 shipped governed keys resolve exactly as the Phase-148 contract — no regression.

    Adding the "off" audience + the canvas key must not perturb skill_studio /
    model_management (operators-only -> False for a user) or workflow_authoring /
    governance_health (everyone -> True for a user).
    """
    import app.api.features as feats

    _cold_off(monkeypatch)
    monkeypatch.setattr(feats, "is_operator", _is_op_false)
    features = client.get("/features").json()["features"]

    # the exact Phase-148 polarity for a non-operator
    assert features["skill_studio"] is False
    assert features["model_management"] is False
    assert features["workflow_authoring"] is True
    assert features["governance_health"] is True

    # and an operator still sees every SHIPPED governed feature True (the canvas alone is off)
    monkeypatch.setattr(feats, "is_operator", _is_op_true)
    op_features = client.get("/features").json()["features"]
    assert op_features["skill_studio"] is True
    assert op_features["model_management"] is True
    assert op_features["workflow_authoring"] is True
    assert op_features["governance_health"] is True
