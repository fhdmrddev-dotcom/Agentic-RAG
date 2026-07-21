"""Phase 167 (INV-01 / INV-02) — invitation ENDPOINT suite (Plan 02).

The security + correctness assertions for the five invitation endpoints on the 166 org
router:
  - INV-01 default-deny: POST /org/invitations without org:invite → 403 (require_org_invite).
  - D-167-02 token secrecy: neither the send response NOR GET /org/invitations ever carries
    token_hash (or a bare token outside the returned link) — T-161-04.
  - D-167-03 role allowlist: an invite may grant ONLY member / org-admin (dept-admin +
    super-admin refused 400 server-side).
  - INV-01 adoption state: the roster surfaces server-derived active / pending state
    (derive_adoption_state), never a client flag.
  - INV-02 accept: token-gated (get_current_user ONLY — no org:invite, no X-Org-Id), idempotent
    (a second accept is a no-op), expired/revoked rejected, and the accept audit row carries the
    INVITATION's org_id (the org joined) — NOT active_org, which the accept path never resolves
    (T-167-23; the 2+-org invitee's accept is filed to the inviting org).

Test seams (reused from test_166_org_gate.py):
  - conftest overrides get_current_user → mock_user_data + get_user_supabase_client → the shared
    supabase mock.
  - app.dependencies._pg_pool → mock_asyncpg_pool drives get_active_org_id's membership lookup
    (set_fetchrow_result[s]) + the endpoint reads/writes on the recording connection.
  - app.dependencies._has_org_permission is monkeypatched per-key (_install_perms) so org:invite /
    org:manage are set independently.
  - app.api.org.write_audit_entry is monkeypatched to a recorder so the EXPLICIT org_id argument
    is asserted without a live audit_log round-trip.
  - app.services.invitation_service.accept_invitation is monkeypatched to canned results so the
    endpoint's status-mapping (200 / 409 / 404) + accept-org audit are unit-tested; the LIVE
    concurrent-race convergence proof lives in tests/integration/test_167_jit_race.py.
"""
from datetime import datetime, timedelta, timezone

from app.main import app
from app.api import org

CALLER_ID = "00000000-0000-0000-0000-000000000001"  # == conftest.mock_user_data
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
# The invitation's org is DELIBERATELY different from the caller's active org — the accept
# audit must carry THIS one (the org joined), proving it is NOT the active-org / autofill guess.
INVITE_ORG = "33333333-3333-3333-3333-333333333333"
INVITE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
FUTURE = datetime.now(timezone.utc) + timedelta(days=7)


def _install_perms(monkeypatch, perms: dict):
    """Monkeypatch the single _has_org_permission seam to return per-key booleans."""

    async def _fake(request, current_user, org_id, permission_key):
        return perms.get(permission_key, False)

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


def _audit_recorder(monkeypatch):
    """Replace app.api.org.write_audit_entry with an async recorder; return the call list."""
    calls: list = []

    async def _rec(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("app.api.org.write_audit_entry", _rec)
    return calls


def _patch_accept(monkeypatch, result: dict):
    """Stub invitation_service.accept_invitation + get_pg_pool for the accept endpoint."""

    async def _fake_accept(pool, token_hash, user_id):
        return result

    async def _fake_pool():
        return object()  # accept_invitation is stubbed → the pool is never touched

    monkeypatch.setattr("app.services.invitation_service.accept_invitation", _fake_accept)
    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_pool)


# ── INV-01: send gate (default-deny) ──────────────────────────────────────────

def test_send_requires_org_invite(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A caller WITHOUT org:invite → 403 (default-deny; NOT a 404)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "member"})  # a member, but no org:invite
    _install_perms(monkeypatch, {"org:invite": False})

    res = client.post(
        "/org/invitations",
        headers={**auth_headers, "X-Org-Id": ACTIVE_ORG},
        json={"email": "invitee@example.com", "role": "member"},
    )

    assert res.status_code == 403, res.text


# ── INV-01 / D-167-02: token secrecy + link-first ─────────────────────────────

def test_send_returns_link_and_never_token_hash(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The send response returns the copy/share link + invitation, and NEVER token_hash."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:invite": True})
    _audit_recorder(monkeypatch)
    # fetchrow order: get_active_org_id membership → INSERT RETURNING → org-name lookup.
    mock_asyncpg_pool.set_fetchrow_results([
        {"role": "org-admin"},
        {"id": INVITE_ID, "email": "invitee@example.com", "role": "member",
         "status": "pending", "expires_at": FUTURE},
        {"name": "Acme"},
    ])

    res = client.post(
        "/org/invitations",
        headers={**auth_headers, "X-Org-Id": ACTIVE_ORG},
        json={"email": "invitee@example.com", "role": "member"},
    )

    assert res.status_code == 200, res.text
    body = res.json()
    assert "link" in body and "token=" in body["link"]  # raw token only in the link
    assert body["invitation"]["id"] == INVITE_ID
    assert "token_hash" not in res.text  # never in the response body


def test_list_invitations_never_returns_token_hash(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """GET /org/invitations lists invites WITHOUT token_hash (T-161-04)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:invite": True})
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})  # get_active_org_id membership
    mock_asyncpg_pool.set_fetch_result([
        {"id": INVITE_ID, "email": "invitee@example.com", "role": "member",
         "status": "pending", "expires_at": FUTURE, "invited_by": CALLER_ID,
         "created_at": FUTURE},
    ])

    res = client.get("/org/invitations", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["invitations"]) == 1
    assert "token_hash" not in res.text


# ── D-167-03: role allowlist ──────────────────────────────────────────────────

def test_send_rejects_disallowed_roles(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """dept-admin (greyed) + super-admin (refused) → 400; only member/org-admin are allowed."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:invite": True})
    _audit_recorder(monkeypatch)
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})  # membership passes the gate

    for bad_role in ("super-admin", "dept-admin", "owner"):
        res = client.post(
            "/org/invitations",
            headers={**auth_headers, "X-Org-Id": ACTIVE_ORG},
            json={"email": "invitee@example.com", "role": bad_role},
        )
        assert res.status_code == 400, (bad_role, res.text)


# ── T-167-23: send audit carries the EXPLICIT active org ──────────────────────

def test_send_audit_passes_explicit_active_org(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The send audit row is written with an EXPLICIT org_id=active_org (never the autofill)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:invite": True})
    calls = _audit_recorder(monkeypatch)
    mock_asyncpg_pool.set_fetchrow_results([
        {"role": "org-admin"},
        {"id": INVITE_ID, "email": "invitee@example.com", "role": "member",
         "status": "pending", "expires_at": FUTURE},
        {"name": "Acme"},
    ])

    res = client.post(
        "/org/invitations",
        headers={**auth_headers, "X-Org-Id": ACTIVE_ORG},
        json={"email": "invitee@example.com", "role": "member"},
    )

    assert res.status_code == 200, res.text
    assert len(calls) == 1
    assert calls[0]["org_id"] == ACTIVE_ORG  # explicit, correct-org accountability
    assert calls[0]["metadata"]["event"] == "invitation.send"


# ── INV-01: adoption state on the roster ──────────────────────────────────────

def test_roster_surfaces_adoption_state(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """GET /org/members returns members (state=active) + pending invitees (state=pending)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    _install_perms(monkeypatch, {"org:manage": True})
    # fetchrow: get_active_org_id membership → get_org_members count.
    mock_asyncpg_pool.set_fetchrow_results([{"role": "org-admin"}, {"n": 1}])
    # fetch: roster members → pending invitations.
    mock_asyncpg_pool.set_fetch_results([
        [{"user_id": CALLER_ID, "email": "member@example.com", "role": "org-admin",
          "joined_at": None}],
        [{"id": INVITE_ID, "email": "pending@example.com", "role": "member",
          "status": "pending", "created_at": None, "expires_at": None}],
    ])

    res = client.get("/org/members", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["members"][0]["state"] == "active"
    assert body["pending_invitations"][0]["state"] == "pending"
    assert body["pending_invitations"][0]["email"] == "pending@example.com"


# ── INV-02: token-gated accept (no org:invite / no X-Org-Id) ──────────────────

def test_accept_creates_membership_and_audits_invitation_org(
    client, auth_headers, monkeypatch
):
    """Accept with a valid token → 200 joined + audit carries the INVITATION's org_id.

    NO X-Org-Id header is sent and NO org:invite is installed — the accept is authorized by the
    token alone (get_current_user only). The audit org_id is the invitation's org (INVITE_ORG),
    NOT the caller's active org (T-167-23; the accept path never resolves an active org).
    """
    _patch_accept(monkeypatch, {
        "joined": True, "claimable": True, "org_id": INVITE_ORG, "role": "member",
        "status": "accepted", "reason": "accepted",
    })
    calls = _audit_recorder(monkeypatch)

    res = client.post("/org/invitations/accept", headers=auth_headers,
                      json={"token": "raw-invite-token"})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["org_id"] == INVITE_ORG
    assert body["joined"] is True
    assert "token" not in res.text
    assert len(calls) == 1
    assert calls[0]["org_id"] == INVITE_ORG  # the org joined — NOT active_org, NOT autofill
    assert calls[0]["metadata"]["event"] == "invitation.accept"


def test_accept_second_call_is_idempotent_noop(client, auth_headers, monkeypatch):
    """A second accept of a single-use token (already_accepted) → 200 no-op, no new audit."""
    _patch_accept(monkeypatch, {
        "joined": False, "claimable": False, "org_id": INVITE_ORG, "role": "member",
        "status": "accepted", "reason": "already_accepted",
    })
    calls = _audit_recorder(monkeypatch)

    res = client.post("/org/invitations/accept", headers=auth_headers,
                      json={"token": "raw-invite-token"})

    assert res.status_code == 200, res.text
    assert res.json()["joined"] is False
    assert calls == []  # a no-op re-accept writes NO duplicate audit row


def test_accept_rejects_expired(client, auth_headers, monkeypatch):
    """An EXPIRED invite → 409, no membership, no audit."""
    _patch_accept(monkeypatch, {
        "joined": False, "claimable": False, "org_id": INVITE_ORG, "role": "member",
        "status": "expired", "reason": "expired",
    })
    calls = _audit_recorder(monkeypatch)

    res = client.post("/org/invitations/accept", headers=auth_headers,
                      json={"token": "raw-invite-token"})

    assert res.status_code == 409, res.text
    assert calls == []


def test_accept_rejects_revoked(client, auth_headers, monkeypatch):
    """A REVOKED invite → 409, no membership, no audit."""
    _patch_accept(monkeypatch, {
        "joined": False, "claimable": False, "org_id": INVITE_ORG, "role": "member",
        "status": "revoked", "reason": "revoked",
    })
    calls = _audit_recorder(monkeypatch)

    res = client.post("/org/invitations/accept", headers=auth_headers,
                      json={"token": "raw-invite-token"})

    assert res.status_code == 409, res.text
    assert calls == []


def test_accept_not_found(client, auth_headers, monkeypatch):
    """An unknown token → 404 (no invite row for that token_hash)."""
    _patch_accept(monkeypatch, {
        "joined": False, "claimable": False, "org_id": None, "role": None,
        "status": None, "reason": "not_found",
    })
    _audit_recorder(monkeypatch)

    res = client.post("/org/invitations/accept", headers=auth_headers,
                      json={"token": "no-such-token"})

    assert res.status_code == 404, res.text
