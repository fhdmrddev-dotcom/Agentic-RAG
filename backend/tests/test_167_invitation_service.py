"""Phase 167 (INV-01 / INV-02) — invitation-service unit suite.

The security-critical assertions for the invitation FOUNDATION (Plan 01):
  - D-167-02 token crypto: the raw token is high-entropy (``secrets.token_urlsafe(32)``);
    ONLY its ``sha256`` hash is stored; ``verify_token`` is a constant-time
    ``hmac.compare_digest`` compare — NOT the reversible Phase-150 cipher (T-167-01/02).
  - D-167-05 idempotent accept (INV-02): the accept runs a ``pg_advisory_xact_lock`` +
    ``INSERT … org_members … ON CONFLICT DO NOTHING`` + a guarded ``status='pending'`` flip,
    so a second accept of the same token creates NO new membership (T-167-03).
  - D-167-04 expiry/revoke gate: an EXPIRED or REVOKED invite is not claimable — no
    membership is ever inserted for it (T-167-04).
  - adoption-state derivation: active / pending / not-yet-invited from
    (org_members presence × invite status).

Test seam: the pure-python ``mock_asyncpg_pool`` (conftest) records every ``(sql, args)``
on ``.calls`` and yields a recording connection from ``.acquire()``. ``set_fetchrow_results``
queues the two accept reads (the org_id lookup + the authoritative in-lock re-read);
``set_execute_result`` injects the INSERT command tag (``INSERT 0 1`` joined / ``INSERT 0 0``
ON CONFLICT no-op). No live DB — the concurrent-race integration proof lives in Plan 02's
tests/integration/test_167_jit_race.py.
"""
from datetime import datetime, timedelta, timezone
import hashlib

import app.services.invitation_service as inv

FUTURE = datetime.now(timezone.utc) + timedelta(days=7)
PAST = datetime.now(timezone.utc) - timedelta(days=1)
ORG_ID = "11111111-1111-1111-1111-111111111111"
USER_ID = "00000000-0000-0000-0000-000000000001"
INVITE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def _sql_texts(pool):
    return [c[0] for c in pool.calls if isinstance(c[0], str)]


def _invite_row(status="pending", expires_at=FUTURE):
    return {
        "id": INVITE_ID,
        "org_id": ORG_ID,
        "role": "member",
        "status": status,
        "expires_at": expires_at,
    }


def _claim_row(status="pending", expires_at=FUTURE):
    return {"status": status, "expires_at": expires_at}


# ── token crypto (D-167-02) ───────────────────────────────────────────────────

def test_mint_returns_raw_and_sha256_hash():
    raw, token_hash = inv.mint_invite_token()
    assert isinstance(raw, str) and isinstance(token_hash, str)
    # The stored hash is a one-way sha256 of the raw token (never the raw token itself).
    assert token_hash == hashlib.sha256(raw.encode()).hexdigest()
    assert token_hash != raw
    # token_urlsafe(32) yields ~43 URL-safe chars of high entropy.
    assert len(raw) >= 40


def test_mint_tokens_are_unique():
    raws = {inv.mint_invite_token()[0] for _ in range(100)}
    assert len(raws) == 100  # CSPRNG — no collisions


def test_verify_token_matches_and_rejects():
    raw, token_hash = inv.mint_invite_token()
    assert inv.verify_token(raw, token_hash) is True
    assert inv.verify_token("wrong-token", token_hash) is False
    assert inv.verify_token(raw, hashlib.sha256(b"other").hexdigest()) is False


# ── idempotent accept (D-167-05 / INV-02) ─────────────────────────────────────

async def test_accept_creates_membership_when_pending(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchrow_results([_invite_row(), _claim_row()])
    mock_asyncpg_pool.set_execute_result("INSERT 0 1")

    result = await inv.accept_invitation(mock_asyncpg_pool, "tok-hash", USER_ID)

    assert result["joined"] is True
    assert result["org_id"] == ORG_ID
    assert result["role"] == "member"
    sqls = _sql_texts(mock_asyncpg_pool)
    # The concurrency guards are wired: advisory lock + ON CONFLICT + guarded flip.
    assert any("pg_advisory_xact_lock" in s for s in sqls)
    assert any("ON CONFLICT" in s and "org_members" in s for s in sqls)
    assert any("status = 'accepted'" in s and "status = 'pending'" in s for s in sqls)


async def test_accept_idempotent_on_conflict_no_new_membership(mock_asyncpg_pool):
    # The invite is claimable, but the membership already exists → ON CONFLICT DO NOTHING
    # returns a 0-row command tag → joined is False (the hard convergence guarantee, INV-02).
    mock_asyncpg_pool.set_fetchrow_results([_invite_row(), _claim_row()])
    mock_asyncpg_pool.set_execute_result("INSERT 0 0")

    result = await inv.accept_invitation(mock_asyncpg_pool, "tok-hash", USER_ID)

    assert result["joined"] is False
    assert result["claimable"] is True


async def test_accept_second_call_noop_when_already_accepted(mock_asyncpg_pool):
    # A second accept of a single-use token: the in-lock re-read sees status='accepted'
    # → not claimable → NO org_members insert is attempted at all.
    mock_asyncpg_pool.set_fetchrow_results(
        [_invite_row(status="accepted"), _claim_row(status="accepted")]
    )

    result = await inv.accept_invitation(mock_asyncpg_pool, "tok-hash", USER_ID)

    assert result["joined"] is False
    assert result["claimable"] is False
    assert result["reason"] == "already_accepted"
    assert not any(
        "INSERT INTO public.org_members" in s for s in _sql_texts(mock_asyncpg_pool)
    )


async def test_accept_rejects_expired(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchrow_results(
        [_invite_row(expires_at=PAST), _claim_row(expires_at=PAST)]
    )

    result = await inv.accept_invitation(mock_asyncpg_pool, "tok-hash", USER_ID)

    assert result["joined"] is False
    assert result["claimable"] is False
    assert result["reason"] == "expired"
    assert not any(
        "INSERT INTO public.org_members" in s for s in _sql_texts(mock_asyncpg_pool)
    )


async def test_accept_rejects_revoked(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchrow_results(
        [_invite_row(status="revoked"), _claim_row(status="revoked")]
    )

    result = await inv.accept_invitation(mock_asyncpg_pool, "tok-hash", USER_ID)

    assert result["joined"] is False
    assert result["claimable"] is False
    assert result["reason"] == "revoked"
    assert not any(
        "INSERT INTO public.org_members" in s for s in _sql_texts(mock_asyncpg_pool)
    )


async def test_accept_not_found(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchrow_result(None)  # no invite row for this token_hash

    result = await inv.accept_invitation(mock_asyncpg_pool, "nope", USER_ID)

    assert result["joined"] is False
    assert result["reason"] == "not_found"
    assert not any(
        "INSERT INTO public.org_members" in s for s in _sql_texts(mock_asyncpg_pool)
    )


# ── adoption-state derivation ─────────────────────────────────────────────────

def test_derive_adoption_state():
    assert inv.derive_adoption_state("pending", has_membership=True) == "active"
    assert inv.derive_adoption_state("accepted", has_membership=True) == "active"
    assert inv.derive_adoption_state("pending", has_membership=False) == "pending"
    assert inv.derive_adoption_state(None, has_membership=False) == "not-yet-invited"
    assert inv.derive_adoption_state("revoked", has_membership=False) == "not-yet-invited"


# ── require_org_invite gate (D-167-08 / Task 3) ───────────────────────────────

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

import app.dependencies as deps  # noqa: E402


async def test_require_org_invite_denies_without_permission(monkeypatch):
    """Default-deny: a caller lacking org:invite → 403 (a legitimate feature, NOT a 404)."""
    async def _fake(request, current_user, org_id, permission_key):
        assert permission_key == "org:invite"  # the gate mirrors org:manage on the invite key
        return False

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)

    with pytest.raises(HTTPException) as exc:
        await deps.require_org_invite(
            request=None, current_user={"id": USER_ID}, active_org=ORG_ID
        )
    assert exc.value.status_code == 403


async def test_require_org_invite_allows_with_permission(monkeypatch):
    """A caller holding org:invite passes and gets the current_user back unchanged."""
    async def _fake(request, current_user, org_id, permission_key):
        assert permission_key == "org:invite"
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)

    user = {"id": USER_ID}
    result = await deps.require_org_invite(
        request=None, current_user=user, active_org=ORG_ID
    )
    assert result == user
