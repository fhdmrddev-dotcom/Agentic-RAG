"""Phase 181 (REVERT-01 / D-181-01,02,03,05) — the "off" audience at the model + admin layer.

The v3.6 visual_workflow_canvas layer ships behind a governed feature flag whose cold
default is a 5th audience enum member: ``"off"`` — hidden from EVERYONE, operators included.
This file is the model-layer + admin-write-allowlist half of the off-switch (Task 1); the
gate (require_canvas 404) + the GET /features off-bypass are proven in test_181_flip_on.py.

Modeled on ``test_148_visibility_cold_default.py`` (monkeypatch ``us.load_app_settings`` to
drive cold-default vs stored-record). The five behaviors pinned here:

  1. cold read (DB unreachable / missing key) -> ``feature_audience`` resolves ``"off"``;
  2. a stored ``{"audience": "off"}`` record is HONORED (not silently re-defaulted);
  3. ``resolve_feature_access(..., off)`` denies for ANY role / groups (fail-closed);
  4. the 4 shipped governed keys resolve EXACTLY as Phase 148 asserts (no regression);
  5. ``PUT /admin/visibility`` accepts ``visual_workflow_canvas`` + ``off`` | ``everyone`` and
     still 400s a crafted off-allowlist audience (the T-181-03 write-allowlist).
"""
from types import SimpleNamespace


# ── 1-2: feature_audience resolves + honors "off" ─────────────────────────────

def test_cold_read_canvas_is_off(monkeypatch):
    """DB-unreachable (load_app_settings raises) -> visual_workflow_canvas resolves "off"."""
    from app.models import user_settings as us

    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")

    monkeypatch.setattr(us, "load_app_settings", _boom)
    assert us.feature_audience("visual_workflow_canvas") == "off", "cold read HIDES the canvas"


def test_missing_key_canvas_is_off(monkeypatch):
    """An unseeded feature_visibility map -> the canvas key falls through to its "off" default."""
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))
    assert us.feature_audience("visual_workflow_canvas") == "off"


def test_stored_off_record_is_honored(monkeypatch):
    """A stored {"audience": "off"} record is honored (in the accepted-enum tuple, not ignored)."""
    from app.models import user_settings as us

    stored = SimpleNamespace(feature_visibility={"visual_workflow_canvas": {"audience": "off"}})
    monkeypatch.setattr(us, "load_app_settings", lambda: stored)
    assert us.feature_audience("visual_workflow_canvas") == "off"


def test_stored_everyone_record_flips_canvas_on(monkeypatch):
    """An operator On flip persists {"audience": "everyone"} -> feature_audience returns it."""
    from app.models import user_settings as us

    stored = SimpleNamespace(feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}})
    monkeypatch.setattr(us, "load_app_settings", lambda: stored)
    assert us.feature_audience("visual_workflow_canvas") == "everyone"


# ── 3: resolve_feature_access denies when "off" ───────────────────────────────

def test_resolve_feature_access_off_denies_every_caller(monkeypatch):
    """audience "off" -> resolve_feature_access is False for ANY role / groups (fail-closed)."""
    from app.models import user_settings as us

    stored = SimpleNamespace(feature_visibility={"visual_workflow_canvas": {"audience": "off"}})
    monkeypatch.setattr(us, "load_app_settings", lambda: stored)

    assert us.resolve_feature_access("visual_workflow_canvas", "member", set()) is False
    assert us.resolve_feature_access("visual_workflow_canvas", "org-admin", {"eng"}) is False
    assert us.resolve_feature_access("visual_workflow_canvas", "super-admin", {"ops"}) is False


# ── 4: no Phase-148 regression on the 4 shipped keys ──────────────────────────

def test_existing_four_keys_unchanged_on_cold_read(monkeypatch):
    """The 4 shipped governed features resolve exactly as test_148 asserts (REVERT-02)."""
    from app.models import user_settings as us

    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")

    monkeypatch.setattr(us, "load_app_settings", _boom)
    assert us.feature_audience("skill_studio") == "operators"
    assert us.feature_audience("model_management") == "operators"
    assert us.feature_audience("workflow_authoring") == "everyone"
    assert us.feature_audience("governance_health") == "everyone"


# ── 5: the PUT /admin/visibility write allowlist (T-181-03) ───────────────────

async def _noop_set_feature_visibility(feature, audience, roles=None, groups=None):
    """Stand-in for the atomic JSONB writer so the acceptance case never touches the pool."""
    return True


def test_admin_visibility_accepts_canvas_off(client, operator_override, monkeypatch):
    """PUT /admin/visibility {canvas, off} is allowlisted -> 204 (not a 400 rejection)."""
    import app.api.admin as admin_mod

    monkeypatch.setattr(admin_mod, "set_feature_visibility", _noop_set_feature_visibility)
    resp = client.put(
        "/admin/visibility",
        json={"feature": "visual_workflow_canvas", "audience": "off", "roles": []},
    )
    assert resp.status_code == 204, resp.text


def test_admin_visibility_accepts_canvas_everyone(client, operator_override, monkeypatch):
    """PUT /admin/visibility {canvas, everyone} (the On flip) is allowlisted -> 204."""
    import app.api.admin as admin_mod

    monkeypatch.setattr(admin_mod, "set_feature_visibility", _noop_set_feature_visibility)
    resp = client.put(
        "/admin/visibility",
        json={"feature": "visual_workflow_canvas", "audience": "everyone", "roles": []},
    )
    assert resp.status_code == 204, resp.text


def test_admin_visibility_rejects_bogus_audience_for_canvas(client, operator_override):
    """A crafted off-allowlist audience 400s BEFORE any write (T-181-03 tamper guard)."""
    resp = client.put(
        "/admin/visibility",
        json={"feature": "visual_workflow_canvas", "audience": "bogus", "roles": []},
    )
    assert resp.status_code == 400, resp.text
    assert "audience" in resp.text.lower()
