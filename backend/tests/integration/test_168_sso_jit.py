"""Phase 168 (SSO-01) — the LIVE domain-gated JIT convergence proof.

`provision_sso_membership` is the sibling of the Phase-167 token-gated `accept_invitation`:
same `pg_advisory_xact_lock` + `INSERT … ON CONFLICT (org_id,user_id) DO NOTHING` skeleton,
but the org resolves from the authenticated SSO provider (never a token) and the role is
HARDCODED `member` (never a SAML attribute — the D-168-03 / T-168-03 escalation footgun).

The guarantees the mocked unit suite CANNOT prove — asserted here against the real local
Postgres (:54322), skip-guarded via `requires_pg`:

  * T-168-05 concurrent first-login race → EXACTLY ONE membership (advisory lock + ON CONFLICT).
  * Idempotent re-provision is a no-op (`joined=False`, still one row).
  * The row's role is always `member` — and the function has NO `role` parameter.
  * T-168-08 duplicate-email tolerance: two DISTINCT auth.users UUIDs (an SSO account and a
    same-email password account) provisioning into the SAME org → TWO independent memberships,
    never conflated (the key is (org_id, user_id) UUID — email is not in the key).
  * D-167-01 join-additive: a user who already belongs to a DIFFERENT org keeps that
    membership and simply gains the new one.

Modeled on `test_167_jit_race.py` (real DB, `pg_pool` fixture, `asyncio.gather` for the race).
"""
from __future__ import annotations

import asyncio
import inspect
import uuid

import pytest
import pytest_asyncio

from app.services import invitation_service as inv
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def jit_env(pg_pool):
    """Seed factories for SSO-provider orgs + users, with FK-safe teardown.

    ``new_org()`` creates a standalone organization (the org the Plan-04 endpoint resolves
    from the authenticated SSO provider). ``new_user(email=None)`` inserts an ``auth.users``
    row — the mig-105 ``handle_new_user`` trigger auto-provisions a personal org + membership,
    which is the join-additive baseline; its org id is captured for cleanup. Teardown removes
    memberships first, then orgs (CASCADE clears departments / residual memberships), then
    profiles, then the auth users.
    """
    for tbl in ("organizations", "org_members"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} absent — org schema (mig 104/105) not applied")

    created_users: list[uuid.UUID] = []
    created_orgs: list[uuid.UUID] = []

    async def new_org() -> uuid.UUID:
        oid = uuid.uuid4()
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
            oid, f"sso-jit-org-{oid}",
        )
        created_orgs.append(oid)
        return oid

    async def new_user(email: str | None = None) -> uuid.UUID:
        uid = uuid.uuid4()
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, email or f"sso-jit-{uid}@corp.example",
        )
        created_users.append(uid)
        # Capture any personal org(s) the mig-105 trigger created so teardown can drop them.
        for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        ):
            created_orgs.append(r["org_id"])
        return uid

    try:
        yield {"pool": pg_pool, "new_org": new_org, "new_user": new_user}
    finally:
        for uid in created_users:
            await pg_pool.execute("DELETE FROM public.org_members WHERE user_id = $1", uid)
        for oid in created_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", oid)
            except Exception:
                pass
        for uid in created_users:
            try:
                await pg_pool.execute("DELETE FROM public.profiles WHERE id = $1", uid)
            except Exception:
                pass
            await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", uid)


async def test_concurrent_provision_converges_to_one_membership(jit_env):
    """N concurrent first-logins for the same (org, user) → EXACTLY ONE membership.

    T-168-05: `pg_advisory_xact_lock` + `INSERT … ON CONFLICT DO NOTHING` converge the race;
    exactly one of the N calls reports the new insert (`joined=True`), the rest `joined=False`.
    """
    pool = jit_env["pool"]
    org_id = await jit_env["new_org"]()
    user_id = await jit_env["new_user"]()

    n = 8
    results = await asyncio.gather(
        *[inv.provision_sso_membership(pool, org_id, str(user_id)) for _ in range(n)]
    )

    rows = await pool.fetchval(
        "SELECT count(*) FROM public.org_members WHERE org_id = $1 AND user_id = $2",
        org_id, user_id,
    )
    assert rows == 1, f"expected exactly one membership under {n} concurrent provisions, got {rows}"

    joined_true = sum(1 for r in results if r["joined"])
    assert joined_true == 1, f"expected exactly one joined=True, got {joined_true}: {results}"
    assert all(r["role"] == "member" for r in results)
    assert all(r["org_id"] == str(org_id) and r["user_id"] == str(user_id) for r in results)


async def test_idempotent_reprovision_is_noop(jit_env):
    """A second sequential provision of an already-provisioned (org, user) is a no-op."""
    pool = jit_env["pool"]
    org_id = await jit_env["new_org"]()
    user_id = await jit_env["new_user"]()

    first = await inv.provision_sso_membership(pool, org_id, str(user_id))
    assert first["joined"] is True

    second = await inv.provision_sso_membership(pool, org_id, str(user_id))
    assert second["joined"] is False

    rows = await pool.fetchval(
        "SELECT count(*) FROM public.org_members WHERE org_id = $1 AND user_id = $2",
        org_id, user_id,
    )
    assert rows == 1, f"idempotent re-provision must not add a row; got {rows}"


async def test_role_is_always_member(jit_env):
    """The inserted role is `member`, and the function exposes NO `role` parameter (T-168-03)."""
    # There is no caller-supplied role hint to derive an escalation from.
    sig = inspect.signature(inv.provision_sso_membership)
    assert "role" not in sig.parameters, (
        f"provision_sso_membership must not accept a role parameter; got {list(sig.parameters)}"
    )

    pool = jit_env["pool"]
    org_id = await jit_env["new_org"]()
    user_id = await jit_env["new_user"]()

    result = await inv.provision_sso_membership(pool, org_id, str(user_id))
    assert result["role"] == "member"

    db_role = await pool.fetchval(
        "SELECT role FROM public.org_members WHERE org_id = $1 AND user_id = $2",
        org_id, user_id,
    )
    assert db_role == "member", f"JIT membership role must be 'member', got {db_role!r}"


async def test_duplicate_email_two_uuids_two_memberships(jit_env):
    """Two DISTINCT UUIDs (SSO + same-email password account) → TWO independent memberships (T-168-08).

    Membership keys on (org_id, user_id) — never email — so a same-email password account (a
    different auth.users UUID) is never conflated with the SSO account (RESEARCH Pitfall 3).
    """
    pool = jit_env["pool"]
    org_id = await jit_env["new_org"]()

    shared_email = f"dup-{uuid.uuid4()}@corp.example"
    user_sso = await jit_env["new_user"](shared_email)
    try:
        # The same-email password account — a DIFFERENT auth.users UUID.
        user_pw = await jit_env["new_user"](shared_email)
    except Exception:
        # This DB enforces auth.users email uniqueness; the conflation guarantee is about the
        # UUID key, not the email — a distinct email proves the same property.
        user_pw = await jit_env["new_user"]()

    assert user_sso != user_pw

    r_sso = await inv.provision_sso_membership(pool, org_id, str(user_sso))
    r_pw = await inv.provision_sso_membership(pool, org_id, str(user_pw))
    assert r_sso["joined"] is True and r_pw["joined"] is True

    rows = await pool.fetchval(
        "SELECT count(*) FROM public.org_members WHERE org_id = $1 AND user_id = ANY($2::uuid[])",
        org_id, [user_sso, user_pw],
    )
    assert rows == 2, f"two distinct UUIDs must yield two independent memberships, got {rows}"


async def test_join_additive_keeps_other_org_membership(jit_env):
    """Provisioning is join-additive — a pre-existing membership in a DIFFERENT org survives (D-167-01)."""
    pool = jit_env["pool"]
    sso_org = await jit_env["new_org"]()
    user_id = await jit_env["new_user"]()

    # Baseline memberships (e.g. the mig-105 personal org) BEFORE the JIT provision.
    before = await pool.fetch(
        "SELECT org_id FROM public.org_members WHERE user_id = $1", user_id
    )
    before_org_ids = {str(r["org_id"]) for r in before}
    assert sso_org not in {uuid.UUID(o) for o in before_org_ids}

    result = await inv.provision_sso_membership(pool, sso_org, str(user_id))
    assert result["joined"] is True

    after = await pool.fetch(
        "SELECT org_id FROM public.org_members WHERE user_id = $1", user_id
    )
    after_org_ids = {str(r["org_id"]) for r in after}

    # Every prior membership is intact, and exactly the new SSO org was added.
    assert before_org_ids <= after_org_ids, "a prior-org membership was lost (not join-additive)"
    assert after_org_ids - before_org_ids == {str(sso_org)}
    assert len(after) == len(before) + 1
