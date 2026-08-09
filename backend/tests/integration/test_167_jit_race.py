"""Phase 167 (INV-02) — the LIVE concurrent-accept convergence proof.

The one guarantee the unit suite (mocked ``accept_invitation``) CANNOT prove: that two
concurrent accepts of the SAME invite token converge to EXACTLY ONE ``org_members`` row. This
runs the real ``invitation_service.accept_invitation`` twice under ``asyncio.gather`` against
the local Postgres, exercising the ``pg_advisory_xact_lock`` + ``INSERT … ON CONFLICT DO
NOTHING`` + guarded status-flip transaction (D-167-05). Skip-guarded on :54322 via the shared
``pg_pool`` fixture (tests/integration/conftest.py).

Also asserts join-additivity (D-167-01): the invitee KEEPS the personal org the mig-105
``handle_new_user`` trigger created and simply GAINS the inviting org — never absorbed.
"""
from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.services import invitation_service as inv
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def test_concurrent_accept_converges_to_one_membership(pg_pool):
    """Two concurrent accepts of one token → EXACTLY ONE membership (advisory lock + ON CONFLICT)."""
    for tbl in ("organizations", "org_members", "org_invitations"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} absent — org schema (mig 104/105) not applied")

    invitee = uuid.uuid4()
    invitee_email = f"jit-invitee-{invitee}@test.local"
    inviting_org = uuid.uuid4()
    raw = "jit-race-" + uuid.uuid4().hex
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    created_orgs = [inviting_org]

    try:
        # The inviting org (separate from any personal org the invitee gets).
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
            inviting_org, f"jit-race-org-{inviting_org}",
        )
        # The invitee — the mig-105 handle_new_user trigger auto-provisions a personal org +
        # membership (join-additive baseline). Capture those orgs for cleanup + the additive check.
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)", invitee, invitee_email
        )
        personal_rows = await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", invitee
        )
        personal_count = len(personal_rows)
        for r in personal_rows:
            created_orgs.append(r["org_id"])

        # The pending invitation to the inviting org.
        await pg_pool.execute(
            "INSERT INTO public.org_invitations "
            "(org_id, email, role, token_hash, status, expires_at, invited_by) "
            "VALUES ($1, $2, 'member', $3, 'pending', $4, NULL)",
            inviting_org, invitee_email, token_hash,
            datetime.now(timezone.utc) + timedelta(days=7),
        )

        # THE RACE: two concurrent accepts of the SAME token on the SAME (org, user).
        results = await asyncio.gather(
            inv.accept_invitation(pg_pool, token_hash, str(invitee)),
            inv.accept_invitation(pg_pool, token_hash, str(invitee)),
        )

        # Convergence: exactly ONE membership row for (inviting_org, invitee).
        n = await pg_pool.fetchval(
            "SELECT count(*) FROM public.org_members WHERE org_id = $1 AND user_id = $2",
            inviting_org, invitee,
        )
        assert n == 1, f"expected exactly one membership, got {n}"

        # Exactly ONE of the two concurrent accepts reports the NEW insert (joined=True).
        joined_true = sum(1 for r in results if r["joined"])
        assert joined_true == 1, f"expected exactly one joined=True, got {joined_true}: {results}"

        # The invite is single-use: flipped to 'accepted' exactly once.
        status_now = await pg_pool.fetchval(
            "SELECT status FROM public.org_invitations WHERE token_hash = $1", token_hash
        )
        assert status_now == "accepted", status_now

        # Join-additive (D-167-01): personal org(s) kept + the inviting org gained.
        total = await pg_pool.fetchval(
            "SELECT count(*) FROM public.org_members WHERE user_id = $1", invitee
        )
        assert total == personal_count + 1, (
            f"expected personal({personal_count}) + inviting(1) memberships, got {total}"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.org_members WHERE user_id = $1", invitee)
        await pg_pool.execute(
            "DELETE FROM public.org_invitations WHERE org_id = $1", inviting_org
        )
        for oid in created_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", oid)
            except Exception:
                pass
        try:
            await pg_pool.execute("DELETE FROM public.profiles WHERE id = $1", invitee)
        except Exception:
            pass
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", invitee)
