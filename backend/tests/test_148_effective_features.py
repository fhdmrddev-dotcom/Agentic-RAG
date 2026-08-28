"""Phase 148 Wave 0 (VIS-01) — RED scaffold for the ``GET /features`` effective map.

Encodes the D-04/D-05 per-user effective-features contract that 148-05 (wave 3) builds in
``app.api.features`` (authenticated, NOT operator-gated — a non-operator MUST reach it to
learn their own map):

  - an operator -> all four governed keys True;
  - an end user -> True ONLY for the day-one Everyone features (workflow_authoring,
    governance_health), False for the Operators-only ones (skill_studio, model_management).

The operator branch is driven via the asyncpg pool mock (``set_fetchrow_result``) — the same
seam ``is_operator`` reads (Pitfall 6: the supabase builder mock has no effect on that path).
The end-user map falls to the D-06 per-feature cold default, which IS the day-one map.

RED-by-design: ``GET /features`` does not exist yet, so the route 404s today; the tests turn
GREEN in wave 3. Owner: 148-05.
"""
FEATURE_KEYS = {"skill_studio", "model_management", "workflow_authoring", "governance_health"}


def _cold_defaults(monkeypatch):
    """Pin the COLD-DEFAULT settings read both tests below are actually about.

    T-184-UAT-02 made this explicit. Both assertions describe the ``_GOVERNED_FEATURES``
    cold-read polarity (D-06), which requires an EMPTY ``feature_visibility``. That used to
    hold by accident: ``GET /features`` resolved purely from the in-process settings cache and
    never read the DB, so in a test run the map was empty unless something else had warmed it.
    The endpoint now awaits ``ensure_settings_fresh()`` first (so a flipped kill switch cannot
    be served from an unboundedly stale cache), which means it reads the real ``app_settings``
    row — and a developer whose local DB has ``visual_workflow_canvas`` flipped ON would see
    the canvas assertion below fail for a reason that has nothing to do with the contract.

    So the precondition is now STATED rather than assumed. The assertions are unchanged; only
    their input is pinned. Same one-line idiom as ``test_182_canvas_gate.py``'s ``_cold_off``.
    """
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.models.user_settings.load_app_settings",
        lambda: SimpleNamespace(feature_visibility={}),
    )


def test_operator_sees_all_features_true(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """An operator's effective map is all-True across the four SHIPPED governed features.

    Phase 181 (REVERT-01 / D-181-01) added a 5th governed key, ``visual_workflow_canvas``,
    whose cold default was the ``"off"`` audience — hidden from EVERYONE, operators included.
    So the operator map carried 5 keys: the 4 shipped ones all-True (no Phase-148 regression,
    REVERT-02), and the canvas key False, because the master switch won over the operator
    short-circuit.

    ⚠ **AMENDED BY PHASE 214 / D-214-19.** That cold default is now ``"everyone"``, so the
    canvas key reads **True** here. The Phase-181 property this case was really pinning — that
    an ``"off"`` master switch outranks the operator short-circuit — has NOT been weakened and
    is still proven, in ``test_181_off_audience.py`` and ``test_revert_byte_identical.py``,
    against a STORED off record. The original expectation is written out above rather than
    overwritten, because reading `False` -> `True` with no explanation is how a security-shaped
    assertion gets loosened by accident.
    """
    _cold_defaults(monkeypatch)
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # membership present -> operator

    res = client.get("/features", headers=auth_headers)
    assert res.status_code == 200, f"GET /features must be reachable; got {res.status_code}"
    feats = res.json()["features"]
    assert FEATURE_KEYS <= set(feats), "the 4 shipped governed keys are still present"
    assert all(feats[k] is True for k in FEATURE_KEYS), "operator -> every SHIPPED governed feature True"
    # Phase 214 / D-214-19: the canvas cold default is now "everyone", so it is VISIBLE here.
    # (Phase 181 asserted `is False` on this line; see the docstring for why that flipped and
    # where the "an off master switch outranks the operator short-circuit" property still lives.)
    assert feats["visual_workflow_canvas"] is True
    # ⭐ THE NEIGHBOUR IS THE CONTROL. `live_connectors` shares the "off" cold default the
    # canvas key just left, so it proves the map still HAS an off-audience arm and that this
    # case is reading a per-key decision rather than a blanket True.
    assert feats["live_connectors"] is False


def test_end_user_sees_only_everyone_features(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator sees True only for the day-one Everyone features (D-05 map)."""
    _cold_defaults(monkeypatch)
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # no membership -> end user

    res = client.get("/features", headers=auth_headers)
    assert res.status_code == 200, "a non-operator MUST reach /features (never 403/404)"
    feats = res.json()["features"]
    assert feats["skill_studio"] is False
    assert feats["model_management"] is False
    assert feats["workflow_authoring"] is True
    assert feats["governance_health"] is True
