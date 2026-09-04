"""Phase 181 (REVERT-01 / D-181-01,02,04) — the require_canvas 404 gate + flip-on path.

The gate half of the off-switch — the OFF -> ON round trip on ONE canvas-gated route.

**Phase 182 (D-182-04) — repointed onto the REAL route.** These three gate tests originally
probed the TEMPORARY Phase-181 ``/canvas`` canary route, which existed only because no real
canvas route did yet. 182-02 shipped the real ``require_canvas``-gated routes and 182-03 DELETED
the canary, so they now ride ``GET /workflows/grounding-bundle`` — a body-free GET, exactly the
canary's shape, and the surface the gate actually protects. (Without this repoint
``test_canvas_ping_200_after_flip_on`` would have failed outright: no route -> 404, not 200.)

Behaviors pinned:
  - flag off -> ``GET /workflows/grounding-bundle`` returns **404, never 403** — for an operator
    AND a non-operator caller (the "off" resolves BEFORE the operator no-op, D-181-01), byte-
    identical to an unknown path;
  - operator flip on (a stored {"audience": "everyone"} record) -> the gate is a no-op and the
    SAME path returns 200 (which is also what makes the 404s above provably the GATE and not an
    absent route);
  - ``GET /features`` returns ``visual_workflow_canvas: false`` for an operator AND an end
    user when off (the "off" guard wins over the ``op or ...`` short-circuit), and ``true``
    after the flip on.

Drives the resolver via ``monkeypatch.setattr(us, "load_app_settings", ...)`` (the Phase-148
pattern) + patches the async ``is_operator`` seam per module (dependencies for the gate,
features for the effective map) so no live operator_users row / pg pool is needed. The flip-on
read also fakes the shared ``assemble_grounding_bundle`` so this stays a pure GATE test, fully
offline and independent of registry/DB contents (the palette's own contents are pinned in
``test_182_grounding_bundle.py``).

NOTE the ``canvas_ping`` test names are retained deliberately — they are the identifiers the
Phase-181/182 verification maps reference. Only the probed PATH changed, never the behavior.
"""
from types import SimpleNamespace

# The real canvas-gated route these gate tests ride (182-02), replacing the deleted
# Phase-181 ``/canvas`` canary probe (D-182-04).
_CANVAS_PATH = "/workflows/grounding-bundle"


async def _is_op_true(user_id):
    return True


async def _is_op_false(user_id):
    return False


def _cold_off(monkeypatch):
    """Canvas OFF — and after D-214-19 that is an operator's FLIP, no longer the default.

    ⚠ THIS HELPER USED TO HAND BACK AN EMPTY ``feature_visibility`` MAP and let the canvas
    key fall through to ``_GOVERNED_FEATURES``, because that cold default was ``"off"``.
    Phase 214 (plan 214-14, D-214-19) flipped it to ``"everyone"`` — left off, the surface
    this milestone governs rendered for nobody on a fresh install. So an empty map now
    resolves ON, and every *"when off"* assertion downstream silently INVERTED: 20 cases
    across seven suites, measured rather than predicted.

    The OFF state is therefore STORED EXPLICITLY. What each case asserts is unchanged —
    only how OFF is reached. ``feature_audience`` honours a stored ``{"audience": "off"}``
    record (Phase 181 / D-181-01 put ``"off"`` in the accepted-enum tuple for exactly this
    reason), so this is the product's own re-flip route rather than a test-only shape.
    """
    from app.models import user_settings as us

    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "off"}}
        ),
    )


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


# ── require_canvas: 404 when off (never 403), for operator AND user ────────────

def test_canvas_ping_404s_when_off_for_operator(client, monkeypatch):
    """Even an OPERATOR gets a byte-identical 404 while off — "off" resolved before the no-op."""
    import app.dependencies as deps

    _cold_off(monkeypatch)
    monkeypatch.setattr(deps, "is_operator", _is_op_true)  # operator — must STILL 404
    resp = client.get(_CANVAS_PATH)
    assert resp.status_code == 404, resp.text  # never 403 — indistinguishable from not-built
    assert resp.status_code != 403


def test_canvas_ping_404s_when_off_for_user(client, monkeypatch):
    """A non-operator gets a 404 (never 403) while off."""
    import app.dependencies as deps

    _cold_off(monkeypatch)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    resp = client.get(_CANVAS_PATH)
    assert resp.status_code == 404, resp.text
    assert resp.status_code != 403


def test_canvas_ping_200_after_flip_on(client, monkeypatch):
    """After an operator flip on (audience "everyone"), the gate is a no-op -> 200.

    CR-01: the canvas gate no longer rides the blanket conftest ``get_current_user`` override;
    the ON path resolves the caller via ``authenticate_canvas_request`` — called AFTER the
    off-flag check so the off-state 404 stays pre-auth. Monkeypatch that seam to inject a caller
    so this proves the flag-on no-op without a live token. (The OFF-path 404 for anonymous /
    bogus-token callers — the property CR-01 fixed — is proven in ``test_revert_byte_identical``
    with this seam left REAL.)

    Phase 182 (D-182-04): repointed onto the REAL ``GET /workflows/grounding-bundle``. This is
    the load-bearing half of the round trip — it proves the two 404s above are the GATE and not
    an absent route, since the very same path answers 200 once the flag is on. The shared
    ``assemble_grounding_bundle`` is faked to an EMPTY bundle so this stays a pure gate test:
    provable with no DB and no dependence on registry contents (the palette's real contents are
    pinned separately in ``test_182_grounding_bundle.py``).
    """
    import app.dependencies as deps
    from app.services.harness import grounding as g

    _flipped_on(monkeypatch)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)  # even a plain user: everyone -> pass

    async def _fake_caller(credentials, supabase):
        # A UUID-shaped id: the canvas ON path hands this identity onward, so a non-UUID here
        # would be a latent trap the moment anything downstream coerces it.
        return {"id": "00000000-0000-0000-0000-000000000001", "email": "u@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)

    async def _empty_bundle(**_kwargs):
        return g.GroundingBundle(
            tools=[], tool_names=set(), folders=[], skills=[], skill_ids=set(), placeholders=[]
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _empty_bundle)

    resp = client.get(_CANVAS_PATH)
    assert resp.status_code == 200, resp.text
    # the real handler answered (the palette envelope), not some other 200.
    # `degraded` joined the envelope in the round-3 gap closure (CR-02) so the palette can
    # distinguish "we could not READ your folders/skills" from "you have none" — this fake
    # bundle resolved cleanly, so the honest value is the empty list.
    assert resp.json() == {
        "tools": [],
        "folders": [],
        "skills": [],
        "template_placeholders": [],
        "degraded": [],
    }


# ── GET /features: "off" hides the key from EVERYONE (operators included) ──────

def test_features_hides_canvas_from_operator_when_off(client, monkeypatch):
    """The "off" guard wins over the operator short-circuit (D-181-01) — operator sees False."""
    import app.api.features as feats

    _cold_off(monkeypatch)
    monkeypatch.setattr(feats, "is_operator", _is_op_true)
    resp = client.get("/features")
    assert resp.status_code == 200, resp.text
    assert resp.json()["features"]["visual_workflow_canvas"] is False


def test_features_hides_canvas_from_user_when_off(client, monkeypatch):
    """A non-operator sees visual_workflow_canvas: false when off."""
    import app.api.features as feats

    _cold_off(monkeypatch)
    monkeypatch.setattr(feats, "is_operator", _is_op_false)
    resp = client.get("/features")
    assert resp.status_code == 200, resp.text
    assert resp.json()["features"]["visual_workflow_canvas"] is False


def test_features_shows_canvas_after_flip_on(client, monkeypatch):
    """After the flip on (everyone), the map reveals the canvas to operator AND user."""
    import app.api.features as feats

    _flipped_on(monkeypatch)

    monkeypatch.setattr(feats, "is_operator", _is_op_true)
    assert client.get("/features").json()["features"]["visual_workflow_canvas"] is True

    monkeypatch.setattr(feats, "is_operator", _is_op_false)
    assert client.get("/features").json()["features"]["visual_workflow_canvas"] is True


# ── no Phase-148 regression: the 4 shipped keys keep their polarity ───────────

def test_features_existing_keys_unchanged_for_user_when_off(client, monkeypatch):
    """The 4 shipped keys resolve for a non-operator exactly as Phase 148 shipped."""
    import app.api.features as feats

    _cold_off(monkeypatch)
    monkeypatch.setattr(feats, "is_operator", _is_op_false)
    features = client.get("/features").json()["features"]
    assert features["skill_studio"] is False
    assert features["model_management"] is False
    assert features["workflow_authoring"] is True
    assert features["governance_health"] is True
