"""Phase 181 (REVERT-01 / REVERT-02 / D-181-06) — the backend byte-identical acceptance gate.

This is the CI-run acceptance gate for operator HARD gate #1 ("preserve v1 + revert at any
time"). It rides the existing ``backend-tests.yml`` (no new CI job) and is the backend half
of the D-181-06 gate; the frontend half (nav-set parity + the ChatLayout render guard) is a
sibling ``revertByteIdentical`` vitest.

What "byte-identical" means here — OBSERVABLY, NOT a bundle hash (D-181-07):
with ``visual_workflow_canvas`` off (its cold default), the product a user experiences is
indistinguishable from today's — the same **nav set**, the same **reachable-route set** (a
``/canvas`` route is a 404, byte-identical to a path that was never built — never a 403 that
leaks its existence), the same **HTTP responses**, the same **GET /features map** (the canvas
key is absent-as-false for EVERYONE, operators included), and the same **two authoring doors**
(Describe & run / Author & govern) + **run surface**, all untouched. It is deliberately NOT a
built-artifact hash: a hash is brittle (whitespace / bundler-nondeterminism) and proves the
wrong thing. Observable equivalence is the contract.

Each future canvas route (182/183+) MUST add its own "404 when off" assertion to
``test_require_canvas_404s_when_off`` (or a sibling) so the reachable-route set stays provably
empty while off — the gate grows WITH the surface it protects.

Modeled on ``test_148_visibility_cold_default.py`` (monkeypatch the settings read to drive the
cold default) + a TestClient 404 probe on the Phase-181 canary route (``GET /canvas/ping``).
The response body of ``GET /features`` IS ``get_effective_features(...)``'s return value, so
the map-hides assert reads it directly.
"""
from types import SimpleNamespace


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
    """The require_canvas-gated canary route returns 404 (NEVER 403) while off, for ALL callers.

    404 (not 403) is the byte-identity posture: the off canvas is indistinguishable from a
    route that was never built. NOTE: each real canvas route added in 182/183+ should append
    its own 404-when-off probe here so the reachable-route set stays provably empty while off.
    """
    import app.dependencies as deps

    _cold_off(monkeypatch)

    # operator — "off" resolves BEFORE the operator no-op, so an operator gets the same 404
    monkeypatch.setattr(deps, "is_operator", _is_op_true)
    resp_op = client.get("/canvas/ping")
    assert resp_op.status_code == 404, resp_op.text
    assert resp_op.status_code != 403

    # end user — 404
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    resp_user = client.get("/canvas/ping")
    assert resp_user.status_code == 404, resp_user.text
    assert resp_user.status_code != 403


# ── 2b) CR-01: require_canvas 404s PRE-AUTH for anonymous + bogus-token callers ───────

def test_require_canvas_404s_pre_auth_when_off(client, monkeypatch):
    """CR-01 regression: while off, /canvas/ping 404s (never 403/401) for callers who are NOT
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
    """
    from app.dependencies import get_current_user
    from app.main import app

    _cold_off(monkeypatch)  # flag off (cold default)
    # Pop the blanket override so the REAL auth path runs (reset_mocks restores it next test).
    app.dependency_overrides.pop(get_current_user, None)

    # (a) NO Authorization header — pre-fix leaked 403 "Not authenticated"
    no_auth = client.get("/canvas/ping")
    assert no_auth.status_code == 404, no_auth.text
    assert no_auth.status_code != 403
    assert no_auth.status_code != 401

    # (b) a bogus/invalid bearer token — pre-fix leaked 401 "Invalid or expired token"
    bogus = client.get("/canvas/ping", headers={"Authorization": "Bearer not-a-real-token"})
    assert bogus.status_code == 404, bogus.text
    assert bogus.status_code != 403
    assert bogus.status_code != 401

    # parity: a nonexistent /canvas/<random> path is a byte-identical 404 too (unbuilt-route parity)
    unknown = client.get("/canvas/__definitely_not_a_route__")
    assert unknown.status_code == 404
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
