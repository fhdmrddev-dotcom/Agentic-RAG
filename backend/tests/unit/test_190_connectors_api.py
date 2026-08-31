"""Phase 190 (CONN-02 / CONN-03) — the connector-router falsification set.

Ten cases. Six drive plan 190-09 Task 1's router contract; four drive Task 2's
`live_connectors` kill-switch and the router's registration. Every case that CAN be
plant-driven WAS: a plant was applied to REAL production source, the single case run, the
verbatim RED recorded in `190-09-SUMMARY.md`, and the file restored md5-identical.

  1. a cross-org id reads as ABSENT — 404, never the forbidden status, and the body names
     no owner                                     PLANT: return the forbidden status instead
  2. a plain member (no `org:manage`) is refused on POST / PATCH / DELETE **by the API
     alone**, with no UI involved                  PLANT: drop the permission dependency
  3. a plain member CAN list and get               — the NON-VACUITY control for case 2
  4. an unkeyed cipher surfaces as 503 + a stable machine-readable reason code
                                                   PLANT: let the refusal escape as a 500
  5. an unowned id sent with an unusual body still 404s — never 422, never 500
                                                   PLANT: drop the ConnectorNotFound handler
  6. **T7** — a row that HAS a `secret_ciphertext` serialises with neither the field name
     nor the ciphertext anywhere in the JSON       PLANT: add the field to the response model
  7. `live_connectors` is IN `_VISIBILITY_FEATURES` and ABSENT from `_FLAG_HUMAN_NAMES`
                                                   PLANT: move it to the other allowlist
  8. its cold default is `"off"`, READ from `_GOVERNED_FEATURES` rather than retyped
                                                   PLANT: flip the cold default to "everyone"
  9. the switch is exercised in BOTH directions in code (G-4)
                                                   PLANT: drop the write endpoint's gate
 10. the router is REGISTERED on the real app      PLANT: drop the include_router line

⚠ WHY CASE 2 IS THE ONE TO READ. UI-SPEC §2b's gate is a UI rule *and* a security rule, and
only the second half is falsifiable here: *"the gate must be API-enforced, not merely
hidden — a hidden button that the API still honours is the defect the 069-A contract exists
to prevent."* Case 2 therefore never renders anything. It sends the three write requests
over HTTP as a member and asserts the service was never reached at all.

── The probe app, and why it is not `app.main.app` ───────────────────────────────────────
Task 1 authors the router; Task 2 registers it. So the Task-1 cases drive a THROWAWAY
`FastAPI()` that includes `connectors.router` and nothing else, sharing the live
`app.dependency_overrides` **dict object** so conftest's `get_current_user` /
`get_supabase` / `get_user_supabase_client` seams (and its per-test `reset_mocks`
re-assignments, which mutate that same dict in place) apply unchanged. That isolation is a
feature, not a workaround: a refusal observed on the bare router cannot be an accident of
middleware ordering on the real app. Task 2 then asserts separately that the REAL app
carries the route, so "the router refuses correctly" and "the router is reachable" stay two
separately-falsifiable claims.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import connectors
from app.main import app as real_app
from app.services import connector_service

# Matches conftest.mock_user_data (the get_current_user override identity).
CALLER_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
OTHER_ORG = "22222222-2222-2222-2222-222222222222"
CONNECTION_OWNED_BY_ANOTHER_ORG = "cccccccc-0000-4000-8000-00000000000b"

# A greppable sentinel wearing the real envelope prefix. It is what a stored row carries and
# what T7 sweeps for — the PLAINTEXT is not the only thing that must not appear in a
# response. A ciphertext in a payload is a credential in a payload with an extra step: it
# outlives the key rotation meant to retire it.
SENTINEL_CIPHERTEXT = "enc:v1:xoxb-SENTINEL-CREDENTIAL-MUST-NEVER-REACH-A-BROWSER-190"

# A stored row exactly as migration 116 shapes it — twelve columns, secret included.
STORED_ROW = {
    "id": "dddddddd-0000-4000-8000-00000000000d",
    "org_id": ACTIVE_ORG,
    "created_by": CALLER_ID,
    "capability": "post_message",
    # Phase 211 — REQUIRED on `ConnectorConnectionResponse`, so a stored row without it is a
    # `ValidationError` rather than a missing key. That strictness is deliberate: after
    # migration 127 the database GUARANTEES a non-blank value on every row, and a None here
    # would mean the row is broken.
    "service_id": "slack",
    "name": "#ops-alerts",
    "config": {"default_channel": "#ops-alerts"},
    "secret_ciphertext": SENTINEL_CIPHERTEXT,
    "is_enabled": True,
    "last_checked_at": None,
    "last_check_verdict": "not_checked",
    "created_at": "2026-08-08T00:00:00Z",
    "updated_at": "2026-08-08T00:00:00Z",
}

VALID_CREATE_BODY = {
    "capability": "post_message",
    # Phase 211 — required on EVERY shape (D-211-01 / D-211-04: the model and the database
    # agree exactly, because a laxer model turns a check violation into a 500).
    "service_id": "slack",
    "name": "#ops-alerts",
    "config": {"default_channel": "#ops-alerts"},
    "secret": "xoxb-a-real-looking-bot-token",
}


# ── the probe app ────────────────────────────────────────────────────────────────────────
@pytest.fixture
def router_client():
    """A TestClient over `connectors.router` ALONE, sharing the live override dict."""
    probe = FastAPI()
    probe.include_router(connectors.router)
    # The SAME dict object, not a copy — conftest's autouse reset_mocks re-assigns keys on
    # `app.main.app.dependency_overrides` in place, and this must see those writes.
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _org_headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


def _install_perms(monkeypatch, perms: dict):
    """Patch the ONE `_has_org_permission` seam (the test_166 precedent).

    `require_org_manage` resolves this module global, so one patch controls every permission
    decision without a live `role_permissions` row.
    """
    async def _fake(request, current_user, org_id, permission_key):
        return perms.get(permission_key, False)

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


def _install_feature(monkeypatch, audience: str, *, operator: bool = False):
    """Pin the `live_connectors` audience + the operator boundary for `require_visible`.

    `is_operator` is the ONE swappable boundary (SEED-115) and is a module global of
    `app.dependencies`; `feature_audience` is lazy-imported INSIDE the closure, so it is
    patched at its source. Both mirror `tests/test_148_require_visible.py` exactly.
    """
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=operator))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: audience)


def _as_org_member(monkeypatch, mock_asyncpg_pool, role: str = "member"):
    """Make the caller a MEMBER of ACTIVE_ORG so `get_active_org_id` passes."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": role})


def _forbid_the_service(monkeypatch):
    """Make every write verb explode if it is reached at all.

    This is what turns case 2 from "the status was 403" into "the write never happened".
    A gate that refuses AFTER the row is written is not a gate.
    """
    def _never(*_a, **_kw):
        raise AssertionError(
            "T-190-09-U02: a connector WRITE reached connector_service for a caller with no "
            "org:manage — the API gate did not hold, and no amount of UI hiding fixes that"
        )

    for verb in ("create_connection", "update_connection", "delete_connection"):
        monkeypatch.setattr(connector_service, verb, _never)


# ── 1 · a cross-org id reads as ABSENT ───────────────────────────────────────────────────
def test_a_connection_id_from_another_org_is_absent_never_forbidden(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 1 — 404, never the forbidden status, and the body names no owner.

    PLANT (observed RED): replace the router's `raise _NOT_FOUND` on the GET-by-id miss with
    a forbidden-status raise. The whole point of the rule is that "you may not have this"
    confirms the id names a real row SOMEWHERE, which is the one fact the tenant boundary
    exists to withhold — so the assertion is on the STATUS and on the BODY, not on either
    alone.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:manage": True})  # even an ADMIN gets absence, not refusal
    mock_execute_result.data = []  # the org-scoped query matches nothing — another org's row

    res = router_client.get(
        f"/connectors/connections/{CONNECTION_OWNED_BY_ANOTHER_ORG}", headers=_org_headers()
    )

    assert res.status_code == 404, res.text
    assert res.status_code != 403, "a cross-org miss must NEVER be the forbidden status"
    body = res.text.lower()
    for leak in (OTHER_ORG, "org", "permission", "forbidden", "owner", "not allowed"):
        assert leak.lower() not in body, (
            f"the miss body leaked {leak!r}: {res.text!r} — a 404 that explains itself is a "
            "403 wearing a different number"
        )


# ── 2 · the API-enforced org-admin write gate (T-190-09-U02) ─────────────────────────────
@pytest.mark.parametrize(
    "method,path,body",
    [
        ("post", "/connectors/connections", VALID_CREATE_BODY),
        ("patch", f"/connectors/connections/{STORED_ROW['id']}", {"name": "renamed"}),
        ("delete", f"/connectors/connections/{STORED_ROW['id']}", None),
    ],
)
def test_a_plain_member_cannot_write_and_the_api_alone_says_so(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client, method, path, body
):
    """Case 2 — UI-SPEC U-02, proved WITHOUT any UI.

    A member who creates a connection binds colleagues' published workflows to a destination
    they chose. The refusal must therefore live in the API; §2b says so in as many words.

    PLANT (observed RED): delete `Depends(require_org_manage)` from the three write handlers
    (falling back to `get_current_user`) and watch the member's create SUCCEED.

    The feature audience is pinned to `"everyone"` on purpose, so `require_visible` no-ops
    and the refusal is provably the ORG-ADMIN gate rather than the kill-switch. Case 9
    exercises the kill-switch in isolation for the same reason.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="member")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": False})  # a plain member
    _forbid_the_service(monkeypatch)
    mock_execute_result.data = [STORED_ROW]  # a row IS available — the gate is what refuses

    res = getattr(router_client, method)(
        path, headers=_org_headers(), **({"json": body} if body is not None else {})
    )

    assert res.status_code == 403, (
        f"{method.upper()} {path} answered {res.status_code} for a caller with no org:manage "
        f"— the write gate is not API-enforced. Body: {res.text!r}"
    )


# ── 3 · the NON-VACUITY control for case 2 ───────────────────────────────────────────────
def test_a_plain_member_can_still_list_and_get(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 3 — read and bind stay ORG-WIDE (U-02).

    Without this control, a router that refused EVERYTHING would pass case 2 forever while
    breaking the picker for every non-admin author — which is the whole reason the gate is
    asymmetric rather than a blanket one.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="member")
    _install_perms(monkeypatch, {"org:manage": False})
    mock_execute_result.data = [STORED_ROW]

    listed = router_client.get("/connectors/connections", headers=_org_headers())
    got = router_client.get(
        f"/connectors/connections/{STORED_ROW['id']}", headers=_org_headers()
    )

    assert listed.status_code == 200, listed.text
    assert got.status_code == 200, got.text
    assert [r["id"] for r in listed.json()] == [STORED_ROW["id"]]
    # And the capability filter the picker uses is honoured on the same open read.
    filtered = router_client.get(
        "/connectors/connections?capability=post_message", headers=_org_headers()
    )
    assert filtered.status_code == 200, filtered.text


# ── 4 · the refusal a person cannot fix ──────────────────────────────────────────────────
def test_an_unkeyed_cipher_is_503_with_a_stable_reason_code(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 4 — D-11's write inversion reaches the browser as UI-SPEC §4b moment 9.

    Driven through the REAL service path (`get_cipher` -> None), not by stubbing the
    exception: the property under test is that the fail-CLOSED refusal survives the whole
    router, and a stubbed raise would not have proved the service still refuses.

    PLANT (observed RED): remove the `except ConnectorCipherUnavailable` clause from the POST
    handler and watch the refusal escape as an unhandled error.

    503, not 400: the request was well-formed and the caller did nothing wrong. The
    `reason_code` is what lets the panel render the DISABLED-Save copy rather than the
    correct-the-host copy — the §4b asymmetry lives or dies on this string.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})
    monkeypatch.setattr(connector_service, "get_cipher", lambda: None)  # D-11: no key

    res = router_client.post(
        "/connectors/connections", headers=_org_headers(), json=VALID_CREATE_BODY
    )

    assert res.status_code == 503, res.text
    assert res.json()["detail"]["reason_code"] == connectors.CIPHER_UNAVAILABLE_REASON
    assert connectors.CIPHER_UNAVAILABLE_REASON == "no_encryption_key"
    # And the refusal carries no credential — not the one that was submitted, either.
    assert VALID_CREATE_BODY["secret"] not in res.text


# ── 5 · no 422-vs-404 ordering oracle ────────────────────────────────────────────────────
def test_an_unowned_id_404s_whatever_the_body_says(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 5 — the status must be a fact about the CALLER's reach, never about the row.

    PLANT (observed RED): delete the `except ConnectorNotFound: raise _NOT_FOUND` clause from
    the PATCH handler; the unowned id then produces an unhandled `ConnectorNotFound` instead
    of the generic 404.

    Two halves, because only together do they close the oracle:
      (a) an unowned id with a body that PARSES 404s — never 422, never 500;
      (b) the SAME schema-invalid body returns the SAME status for an owned id and an unowned
          one, so a 422 can never be read as "the id exists and is yours".
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})

    # (a) parseable body + an id this org does not own.
    mock_execute_result.data = []
    res = router_client.patch(
        f"/connectors/connections/{CONNECTION_OWNED_BY_ANOTHER_ORG}",
        headers=_org_headers(),
        json={"name": "renamed", "is_enabled": False},
    )
    assert res.status_code == 404, res.text
    assert res.status_code not in (422, 500), "an unowned id must not be distinguishable"

    # (b) a schema-invalid body ( extra='forbid' ) — identical status either way.
    bad = {"capability": "send_email", "nonsense": 1}
    mock_execute_result.data = []
    unowned = router_client.patch(
        f"/connectors/connections/{CONNECTION_OWNED_BY_ANOTHER_ORG}",
        headers=_org_headers(), json=bad,
    )
    mock_execute_result.data = [STORED_ROW]
    owned = router_client.patch(
        f"/connectors/connections/{STORED_ROW['id']}", headers=_org_headers(), json=bad
    )
    assert unowned.status_code == owned.status_code == 422, (
        f"unowned={unowned.status_code} owned={owned.status_code} — a body-shape refusal "
        "that differs by ownership IS the oracle this case exists to close"
    )


# ── 6 · T7 — the credential never leaves ─────────────────────────────────────────────────
def test_no_response_shape_can_carry_the_credential(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 6 (T7 / T-190-09-T7) — swept across LIST and GET, on a row that HAS a secret.

    PLANT (observed RED): add `secret_ciphertext: str | None = None` to
    `ConnectorConnectionResponse`. This does not merely fail the assertion — it fails
    COLLECTION, because `connector_service`'s module-scope projection assert refuses to
    import. The response model cannot grow a secret-bearing field and have the service start.

    Both the field NAME and the ciphertext VALUE are swept. A test that looked only for the
    plaintext would be green over a payload carrying the stored envelope.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [STORED_ROW]

    listed = router_client.get("/connectors/connections", headers=_org_headers())
    got = router_client.get(
        f"/connectors/connections/{STORED_ROW['id']}", headers=_org_headers()
    )

    assert listed.status_code == 200 and got.status_code == 200
    for label, payload in (("list", listed.text), ("get", got.text)):
        assert "secret_ciphertext" not in payload, f"{label}: the FIELD NAME reached a client"
        assert SENTINEL_CIPHERTEXT not in payload, f"{label}: the CIPHERTEXT reached a client"
        assert "xoxb-" not in payload, f"{label}: a bot-token-shaped value reached a client"

    # ── the sweep's OWN positive control (PATTERNS §3.20) ────────────────────────────────
    # The plant above fails at IMPORT (the service's module-scope projection assert refuses
    # to load), which proves the model is fenced but says nothing about whether THIS sweep
    # can see a leak. So run the identical three checks over a payload that deliberately
    # carries the credential and assert every one of them fires. Without this, a typo in a
    # substring would leave the case green while checking nothing at all.
    leaking = (
        '{"id":"x","secret_ciphertext":"' + SENTINEL_CIPHERTEXT + '","name":"#ops-alerts"}'
    )
    assert "secret_ciphertext" in leaking
    assert SENTINEL_CIPHERTEXT in leaking
    assert "xoxb-" in leaking
    # …and the source row really does hold the sentinel the responses were built from, so
    # the real sweep above was looking for something that was genuinely available to leak.
    assert SENTINEL_CIPHERTEXT in STORED_ROW["secret_ciphertext"]


# ── 7 · the CORRECTED allowlist (CORRECTION #6) ──────────────────────────────────────────
def test_live_connectors_is_in_the_zero_migration_allowlist_and_not_the_other():
    """Case 7 — membership in ONE set and ABSENCE from the other, asserted together.

    CONTEXT D-26 names `admin.py`'s `/admin/flags` allowlist while citing Phase 181's
    `visual_workflow_canvas` precedent. Measured at HEAD, `visual_workflow_canvas` is at
    `admin.py:104`, inside `_VISIBILITY_FEATURES` (`:97-105`), NOT `_FLAG_HUMAN_NAMES`
    (`:67-79`). The difference is not stylistic:

      `_FLAG_HUMAN_NAMES` -> PUT /admin/flags  -> an app_settings BOOLEAN COLUMN -> migration 118
      `_VISIBILITY_FEATURES` -> PUT /admin/visibility -> mig-098 JSONB + audience enum -> ZERO

    The ABSENCE half is the load-bearing half. Without it, a later "tidy-up" that moves the
    key into the flags allowlist would be green here while silently owing a migration nobody
    wrote — and the flag would then read False forever off a column that does not exist.
    """
    from app.api.admin import _FLAG_HUMAN_NAMES, _VISIBILITY_FEATURES

    assert "live_connectors" in _VISIBILITY_FEATURES, (
        "live_connectors must ride PUT /admin/visibility (zero migrations), the path Phase "
        "181 actually used for visual_workflow_canvas"
    )
    assert "live_connectors" not in _FLAG_HUMAN_NAMES, (
        "live_connectors moved into the /admin/flags allowlist — that path writes an "
        "app_settings BOOLEAN COLUMN and therefore owes migration 118. Move it back, or "
        "write the migration in the SAME commit"
    )
    # Phase 181's precedent is still where this case says it is — if IT moves, so does the
    # reasoning above, and this assertion is how that gets noticed.
    assert "visual_workflow_canvas" in _VISIBILITY_FEATURES


# ── 8 · the cold default that makes "zero migration" true ────────────────────────────────
def test_the_cold_default_is_off_and_is_read_not_retyped():
    """Case 8 — `live_connectors` is hidden from EVERYONE, operators included, until a flip.

    Read from `_GOVERNED_FEATURES` rather than re-typed, because that dict is THE ONE
    authoritative cold default: an unseeded `feature_visibility` key falls through to it, and
    the `app_settings` JSONB gains the key only on an operator flip via
    `set_feature_visibility`'s atomic `||` merge. That is precisely why no migration is owed.
    """
    from app.api.admin import _VISIBILITY_AUDIENCES
    from app.models.user_settings import _GOVERNED_FEATURES

    assert _GOVERNED_FEATURES["live_connectors"] == "off"
    # "off" must still be a WRITABLE audience, or the operator could never turn it back on.
    assert "off" in _VISIBILITY_AUDIENCES and "everyone" in _VISIBILITY_AUDIENCES


# ── 9 · the switch, BOTH ways (G-4) — and the registration ───────────────────────────────
def test_the_kill_switch_refuses_writes_off_and_permits_them_on(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """Case 9a — exercised in BOTH directions in code, per G-4's *toggles BOTH ways*.

    A one-directional kill-switch test is satisfied by a router that refuses forever, which
    is exactly the failure a kill-switch is most likely to ship. `org:manage` is granted in
    both halves so the ONLY variable between them is the audience.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [STORED_ROW]

    # OFF — the cold default. A non-operator org admin is refused.
    _install_feature(monkeypatch, "off")
    off = router_client.post(
        "/connectors/connections", headers=_org_headers(), json=VALID_CREATE_BODY
    )
    assert off.status_code == 403, f"live_connectors=off must refuse the write: {off.text!r}"

    # ON — the operator has flipped it to "everyone". The SAME request is not refused.
    _install_feature(monkeypatch, "everyone")
    on = router_client.post(
        "/connectors/connections", headers=_org_headers(), json=VALID_CREATE_BODY
    )
    assert on.status_code != 403, (
        f"live_connectors=everyone must NOT refuse the write — got {on.status_code}: {on.text!r}"
    )
    assert on.status_code == 201, on.text

    # And the READ is deliberately NOT gated, in EITHER direction (UI-SPEC §2h): the Settings
    # tab has to render its OFF banner over the real table rather than a dead page.
    _install_feature(monkeypatch, "off")
    read = router_client.get("/connectors/connections", headers=_org_headers())
    assert read.status_code == 200, (
        "the read is gated — the OFF banner can never render, and every non-admin author "
        "loses the picker at the same time"
    )


def test_the_router_is_registered_on_the_real_app():
    """Case 9b — the router is REACHABLE, which the probe app deliberately cannot prove.

    Asserted against the real `app.main.app` route table (and by path template, not by a
    response), so a registration deleted in a later merge fails here rather than in UAT.
    """
    paths = {getattr(r, "path", None) for r in real_app.routes} | {
        getattr(sub, "path", None)
        for r in real_app.routes
        if hasattr(r, "original_router")
        for sub in getattr(r.original_router, "routes", [])
    }
    assert "/connectors/connections" in paths, (
        "connectors.router is not included in app.main — every case above would keep passing "
        "on the probe app while the real surface 404s"
    )
    assert "/connectors/connections/{connection_id}" in paths


# ══════════════════════════════════════════════════════════════════════════════════════════
# Phase 209 close / milestone-audit finding B-1
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_check_refuses_an_mcp_connection_with_409_never_a_500(
    router_client, monkeypatch, mock_asyncpg_pool
):
    """B-1 — POST /connectors/connections/{id}/check on an MCP row must be a WORDED 409.

    An MCP connection has ``capability = NULL`` by construction (mig 126's shape CHECK admits
    either a capability OR an mcp_server_url). The route read that NULL straight into
    ``get_adapter(capability)``, and ``registry.get_adapter`` raises a BARE ``KeyError`` for
    anything outside its closed three-member set — a ``KeyError`` that is NOT in this route's
    ``except`` ladder. The result was an unhandled **HTTP 500** on a control the shipped UI
    offered: ``ConnectionsTab.tsx:698`` hid it from the row menu with ``!isMcp`` and
    ``ConnectionFormPanel.tsx`` — the same control, one file over — never took that decision.

    ⚠ THIS TEST GUARDS THE ROUTE, NOT THE BUTTON. The endpoint is reachable without any UI, so
    a front-end guard alone would leave the 500 one curl away. Both were fixed; this pins the
    half that a future UI can never re-open.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:manage": True})

    mcp_row = SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        org_id=ACTIVE_ORG,
        name="DeepWiki",
        capability=None,                       # the shape that broke it
        mcp_server_url="https://mcp.deepwiki.com/mcp",
        config={},
        is_enabled=True,
    )
    monkeypatch.setattr(
        connector_service, "resolve_connection", AsyncMock(return_value=mcp_row)
    )

    resp = router_client.post(
        f"/connectors/connections/{mcp_row.id}/check", headers=_org_headers()
    )

    assert resp.status_code == 409, (
        f"an MCP row must be refused with a worded 409, got {resp.status_code}: {resp.text}"
    )
    detail = resp.json()["detail"]
    assert detail["reason_code"] == "check_not_available_for_mcp"
    # The message must tell the operator what to do INSTEAD, not merely that it declined.
    assert "Discover tools" in detail["message"]


# ══════════════════════════════════════════════════════════════════════════════════════════
# Phase 211 (CONN-05 / CONN-08) — the connection is a SERVICE, not a verb
# ══════════════════════════════════════════════════════════════════════════════════════════
#
# Migration 127 drops `connector_connections_shape_is_one_of_two` so that a row naming a
# service reached by NEITHER a first-party adapter NOR a remote MCP server can be stored, and
# adds two independent constraints in its place. The model must move with it, in BOTH
# directions: laxer than the database is a 500 where a 422 belongs, and stricter is a shape
# the database accepts that the API refuses.
#
# ⚠ The stored rows below grow `service_id` because the RESPONSE model does, and that model is
# `extra='forbid'` — a row missing it is a `ValidationError`, not a missing key.

SERVICE_ONLY_CREATE_BODY = {
    "service_id": "notion",
    "name": "Notion (the team wiki)",
}


def _stored(**overrides):
    """A stored row wearing every column the response model projects."""
    row = dict(STORED_ROW)
    row.update(
        {"service_id": "slack", "mcp_server_url": None, "tool_grants": {},
         "discovered_tools": []}
    )
    row.update(overrides)
    return row


def _last_insert_row(mock_builder) -> dict:
    """The row dict `create_connection` actually handed to PostgREST.

    ⚠ ASSERTED ON THE INSERT, NEVER ON THE MOCKED RESPONSE. The mock echoes back whatever the
    test told it to, so a response-side assertion would pass for a service that wrote nothing.
    `create_connection`'s row dict is an explicit literal — a column absent from it is never
    written, whatever the model declares — which is exactly the thing worth pinning.
    """
    assert mock_builder.insert.call_args is not None, "no insert was performed"
    return mock_builder.insert.call_args[0][0]


def test_a_service_only_connection_saves_and_comes_back_with_its_identity(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """⭐ SC#4 / CONN-08 THROUGH THE API — the case this whole phase exists for.

    A connection that names a service and NOTHING ELSE: no capability, no MCP server URL, no
    secret. Before Phase 211 the model refused it outright with a blanket demand for one of
    the two shapes — a 422 on the one shape an OAuth-authenticated service will have until
    Phase 215 gives it a credential. (The retired sentence is not quoted here: `grep -rn` over
    `backend/` is what proves nothing still expects it, and quoting it would defeat that.)

    ⚠ **IT MUST NOT REQUIRE A SECRET OR A CONFIG.** The capability arm's secret requirement
    (WR-05) is deliberately NOT inherited here: an OAuth service has no static token to store,
    and demanding one would make the shape unusable in exactly the case it was added for.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})

    mock_execute_result.data = [
        _stored(capability=None, service_id="notion", secret_ciphertext=None,
                name="Notion (the team wiki)", config={})
    ]

    res = router_client.post(
        "/connectors/connections", headers=_org_headers(), json=SERVICE_ONLY_CREATE_BODY
    )

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["service_id"] == "notion", body
    assert body["capability"] is None, body
    assert body["mcp_server_url"] is None, body


def test_a_blank_service_identity_is_a_422_on_every_one_of_the_three_shapes(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """⚠ THE NEGATIVE CONTROL. Without it, SC#4's green proves only that a rule was DELETED.

    Three shapes × three spellings of "no identity" (absent, empty, whitespace). Every one is
    a **422**, never a 500: the model and migration 127's
    `connector_connections_has_a_service_identity` must agree exactly, because a model laxer
    than the database turns a check violation into an unhandled error at the driver.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [_stored()]

    shapes = {
        "capability": dict(VALID_CREATE_BODY),
        "mcp": {"name": "DeepWiki", "mcp_server_url": "https://mcp.deepwiki.com/mcp"},
        "service_only": {"name": "Notion"},
    }
    for shape_name, base in shapes.items():
        for spelling, identity in (("absent", None), ("empty", ""), ("whitespace", "   ")):
            body = dict(base)
            body.pop("service_id", None)
            if identity is not None:
                body["service_id"] = identity
            res = router_client.post(
                "/connectors/connections", headers=_org_headers(), json=body
            )
            assert res.status_code == 422, (
                f"{shape_name}/{spelling} service_id produced {res.status_code}, not 422: "
                f"{res.text[:400]}"
            )


def test_a_body_wearing_both_shapes_is_a_422_naming_the_ambiguity(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """D-211-11 AT THE MODEL — the mirror of `connector_connections_shape_is_not_ambiguous`.

    ⚠ The refusal must be a **422**, which means it has to happen in the validator rather than
    at the database: the model guards the API, the constraint guards a service-role writer, and
    a body that reaches Postgres to be refused there arrives back as a 500.

    ⚠ The check must run BEFORE the MCP arm's `return self`. The ambiguous body carries an
    `mcp_server_url`, so an arm ordered after it would return early and ACCEPT.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [_stored()]

    res = router_client.post(
        "/connectors/connections",
        headers=_org_headers(),
        json={
            "service_id": "slack",
            "name": "both at once",
            "capability": "post_message",
            "config": {"default_channel": "#ops"},
            "secret": "xoxb-token",
            "mcp_server_url": "https://mcp.example.com/v1/mcp",
        },
    )

    assert res.status_code == 422, res.text
    # The wording must teach WHY, not merely refuse: the executor branches on the tool name
    # first, so the capability on such a row would go inert.
    assert "capability" in res.text and "mcp_server_url" in res.text, res.text


def test_the_column_lockstep_reaches_the_projection_and_t7_still_holds():
    """POINTS 3 AND 4 OF THE FIVE-POINT LOCKSTEP, asserted at the DERIVED constant.

    `_SELECTABLE_COLUMNS` is `",".join(ConnectorConnectionResponse.model_fields)` — it is not
    hand-maintained, and this asserts that the derivation actually carried the new field rather
    than that somebody remembered to add it somewhere.

    ⚠ **THE GRANT IS THE OTHER HALF AND IT IS NOT IN THIS FILE.** A column in this projection
    with no `GRANT SELECT` in migration 127 makes EVERY read of the table 503 — measured
    2026-08-25, on a pre-existing row that had nothing to do with the new feature.
    `tests/test_migration_127.py::test_the_migration_grants_select_on_the_new_column` is the
    fence for that half.
    """
    from app.models.connector import ConnectorConnectionResponse

    assert "service_id" in connector_service._SELECTABLE_COLUMNS.split(",")
    assert "service_id" in ConnectorConnectionResponse.model_fields
    # T7, untouched: the projection still cannot name a credential, in either spelling.
    assert "secret_ciphertext" not in connector_service._SELECTABLE_COLUMNS
    assert "secret" not in connector_service._SELECTABLE_COLUMNS.split(",")


def test_a_new_capability_row_is_born_advertising_its_own_action(
    mock_asyncpg_pool, mock_execute_result, mock_builder, monkeypatch, router_client
):
    """⭐ SC#2 FOR NEW ROWS — the descriptor is WRITTEN at create time, never projected at read.

    Read-time branching is what D-211-03 rejected: it makes a legacy row *look* like a service
    in one surface and not in the next. The row itself carries the advertisement, so every
    reader — picker, catalog, Phase 214's satisfiability check — sees the same thing.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [_stored(capability="post_message", service_id="slack")]

    body = dict(VALID_CREATE_BODY)
    body["service_id"] = "slack"
    res = router_client.post("/connectors/connections", headers=_org_headers(), json=body)
    assert res.status_code == 201, res.text

    insert_row = _last_insert_row(mock_builder)
    assert insert_row["service_id"] == "slack", insert_row
    tools = insert_row["discovered_tools"]
    # THE CAPABILITY DESCRIPTOR IS STILL FIRST AND STILL EXACT. It is the row identity:
    # the grant key every bound workflow step carries and the one action with a
    # first-party adapter behind it, and none of that changes.
    assert tools[0]["name"] == "post_message", tools
    assert tools[0]["inputSchema"]["required"] == ["text"], tools

    # THE `len(tools) == 1` THIS REPLACES WAS A MEASUREMENT OF THE PROBLEM, NOT A
    # REQUIREMENT, and it is recorded here rather than quietly deleted. SEED-207 asked for
    # "exactly ONE available tool" and that was the right first step - a service that
    # could not SAY what it did was the defect Phase 211 closed. The operator met the next
    # one while driving chat after Phase 216: a working, credentialled, enabled Jira
    # connection still answered "there is no JIRA integration", because create_ticket was
    # not the action that moment needed and there was no second one to reach for. GitHub
    # advertised 44 tools beside it.
    #
    # So a SERVICE now advertises its whole action list. The assertion below is written
    # about the PROPERTY rather than the count, because a count goes stale the first time
    # anyone adds a tool - which is exactly how this test came to pin the wrong fact.
    names = [t["name"] for t in tools]
    assert len(names) == len(set(names)), names
    assert names[0] == "post_message", names
    assert "list_channels" in names, names
    assert all(t.get("title") and t.get("description") for t in tools), tools
    assert all("inputSchema" in t for t in tools), tools
    # Every descriptor carries the four keys a sanitized tool carries, and NOTHING else -
    # the execution fields (http method, api method, path) are ours and never leave
    # `service_tools.py`. A URL path on a grant list is a leak of our own plumbing.
    assert all(set(t) == {"name", "title", "description", "inputSchema"} for t in tools), tools
    # A descriptor ADVERTISES an action; it does not GRANT one. The executor's gate denies on
    # a missing grant key by design, and that asymmetry is the desirable direction.
    assert insert_row["tool_grants"] == {}, insert_row


def test_a_service_only_row_is_born_advertising_nothing(
    mock_asyncpg_pool, mock_execute_result, mock_builder, monkeypatch, router_client
):
    """The counterfactual: no capability, so no static descriptor — an EMPTY list, honestly.

    It is not a stub. A service-only row genuinely has no action until OAuth (Phase 215) gives
    it one, and inventing a placeholder action would be worse than showing none.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})
    mock_execute_result.data = [
        _stored(capability=None, service_id="notion", secret_ciphertext=None, config={})
    ]

    res = router_client.post(
        "/connectors/connections", headers=_org_headers(), json=SERVICE_ONLY_CREATE_BODY
    )
    assert res.status_code == 201, res.text
    assert _last_insert_row(mock_builder)["discovered_tools"] == []


def test_discover_refuses_a_service_only_row_by_name_never_as_a_bad_gateway(
    mock_asyncpg_pool, mock_execute_result, monkeypatch, router_client
):
    """T-211-13d — a THIRD named refusal, and the reason it is not merely tidiness.

    A service-only row reaches `POST /connections/{id}/discover` through the Refresh control,
    hits `discover_connection_tools`'s generic `ConnectorError`, and the route's blanket
    `except Exception -> 502` renders it as *"MCP tool discovery failed: connection X is not
    configured with an mcp_server_url"* — **a remote-gateway error naming a shape the row never
    had**, about a server that was never contacted.

    ⚠ It is an ERROR-MESSAGE CONTRACT, not a loop. Nothing in Phase 211 gives a service-only
    row a way to populate tools; OAuth (Phase 215) does. That is precisely why the refusal has
    to be WORDED rather than generic — the honest sentence is *"not yet"*, and a 502 says
    *"something is broken"*.
    """
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="org-admin")
    _install_perms(monkeypatch, {"org:manage": True})

    service_only = SimpleNamespace(
        connection_id="99999999-9999-4999-8999-999999999999",
        org_id=ACTIVE_ORG,
        name="Notion",
        capability=None,
        mcp_server_url=None,
        config={},
        secret=None,
        tool_grants={},
        discovered_tools=[],
    )
    monkeypatch.setattr(
        connector_service, "resolve_connection", AsyncMock(return_value=service_only)
    )

    res = router_client.post(
        f"/connectors/connections/{service_only.connection_id}/discover",
        headers=_org_headers(),
    )

    assert res.status_code == 409, (
        f"a service-only row must be refused by NAME, got {res.status_code}: {res.text}"
    )
    detail = res.json()["detail"]
    assert detail["reason_code"] == "nothing_to_discover_yet", detail
    # ⚠ The row NEVER had an mcp_server_url, so naming one would be a lie about its shape.
    assert "mcp_server_url" not in res.text, res.text
