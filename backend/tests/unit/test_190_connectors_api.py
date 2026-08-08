"""Phase 190 (CONN-02 / CONN-03) — the connector-router falsification set.

Six cases, driving plan 190-09 Task 1's router contract. (Task 2 appends the
`live_connectors` kill-switch cases to this same file — see its own section marker below
once it lands.) Every case here was plant-driven: a plant was applied to REAL production
source, the single case run, the verbatim RED recorded in `190-09-SUMMARY.md`, and the file
restored md5-identical.

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

