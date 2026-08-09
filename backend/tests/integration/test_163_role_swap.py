"""Phase 163 (T-163-01 / D-08) — the role-swap-noop + spoof + fail-closed DETECTOR (RED until 163-05).

The load-bearing proof that ``SET LOCAL ROLE authenticated`` — NOT the JWT claims — is what
turns RLS on. Three encoded guarantees (RESEARCH §"The Live Two-User Leak Test Design" steps
5-6 + Pitfall 1):

  (a) ROLE-SWAP-NOOP DIFF (T-163-01) — with user B's claims SET but the role swap OMITTED, the
      connection stays ``postgres`` (BYPASSRLS) and SEES user A's row; WITH the swap, user B
      sees 0 of A's row. The 1-vs-0 diff is the detector: it proves the swap (not the claims)
      is the thing enabling RLS. A claims-only "fix" is a silent no-op — the single most
      dangerous failure mode of this milestone, and the reason the crux is atomic.
  (b) FAIL-CLOSED — role ``authenticated`` with NO claims (``auth.uid()`` NULL) sees 0 rows:
      the default is DENY, not allow.
  (c) SPOOF — a random / non-member ``sub`` is honored as a claim (``auth.uid()`` resolves) yet
      reaches 0 of A's rows; a REAL member of another org (user B) likewise reaches 0. Membership,
      not a merely well-formed claim, is the gate.

STATE CONTRACT: RED *now* — GREEN after plan 163-05 applies 107 then 108. For THIS plan the bar
is ``pytest ... --collect-only``. Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

import json
from uuid import uuid4

import pytest

from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg


# ── (a) role-swap-noop detector: the BYPASSRLS-vs-authenticated diff (T-163-01) ──

@pytest.mark.asyncio
async def test_role_swap_is_the_load_bearing_diff(pg_pool, two_orgs_two_users):
    """T-163-01: claims-WITHOUT-role-swap stays postgres/BYPASSRLS and SEES A's row (the
    Pitfall-1 silent no-op); role-swap-as-B sees 0. The diff proves the swap turns RLS on."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]

    # WITHOUT the role swap — set B's claims but DELIBERATELY omit SET LOCAL ROLE. A naive
    # "just set the claims" reader thinks they are now user B; in fact the connection is still
    # the pool's BYPASSRLS role and RLS never evaluates.
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('request.jwt.claim.sub', $1, true)", b["uid"]
            )
            await conn.execute(
                "SELECT set_config('request.jwt.claims', $1, true)",
                json.dumps({"sub": b["uid"], "role": "authenticated"}),
            )
            # role NOT swapped → still postgres.
            role = await conn.fetchval("SELECT current_user")
            without_swap = await conn.fetchval(
                "SELECT count(*) FROM public.documents WHERE id = $1", a["doc_id"]
            )
    assert role == "postgres", (
        f"expected the un-swapped pool role to be postgres (BYPASSRLS), got {role!r} — "
        f"the diff below is only meaningful from a BYPASSRLS baseline"
    )
    assert without_swap == 1, (
        "role-swap-noop: claims-only (no SET LOCAL ROLE) stays postgres/BYPASSRLS and MUST "
        "see A's row — this is the silent no-op the role swap fixes (Pitfall 1)."
    )

    # WITH the role swap as user B — RLS is now enforced → 0 of A's row.
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud: NULL uid would false-pass at 0
        with_swap = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE id = $1", a["doc_id"]
        )
    assert with_swap == 0, (
        "with SET LOCAL ROLE authenticated, user B sees 0 of A's row — the ROLE SWAP (not the "
        "claims) is what enables RLS (T-163-01). The 1→0 diff is the detector."
    )


# ── (b) fail-closed: role authenticated with NULL auth.uid() → 0 rows ──

@pytest.mark.asyncio
async def test_fail_closed_no_claims_sees_zero(pg_pool, two_orgs_two_users):
    """A fresh transaction with role ``authenticated`` but NO claims → ``auth.uid()`` NULL →
    0 rows. The default is deny: an unauthenticated context reaches nothing."""
    a = two_orgs_two_users["a"]
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated")
            # NO claims set — auth.uid() must be NULL.
            uid_val = await conn.fetchval("SELECT auth.uid()")
            assert uid_val is None, (
                f"expected NULL auth.uid() with no claims set, got {uid_val!r}"
            )
            seen = await conn.fetchval(
                "SELECT count(*) FROM public.documents WHERE id = $1", a["doc_id"]
            )
    assert seen == 0, (
        "fail-closed violation: role authenticated with NULL auth.uid() must see 0 rows "
        "(default deny), but user A's row was visible."
    )


# ── (c) spoof: a random / non-member sub is honored but reaches 0 (membership is the gate) ──

@pytest.mark.asyncio
async def test_spoof_random_non_member_sub_sees_zero(pg_pool, two_orgs_two_users):
    """A random ``sub`` that belongs to no org is HONORED as a claim (``auth.uid()`` resolves
    to it — this is a spoof, not a malformed token) yet reaches 0 of A's rows. Membership,
    not a syntactically valid claim, is the gate."""
    a = two_orgs_two_users["a"]
    random_uid = str(uuid4())  # a well-formed sub, member of nothing
    async with open_user_conn(pg_pool, random_uid) as conn:
        await assert_auth_uid(conn, random_uid)  # the claim IS honored ...
        seen = await conn.fetchval(  # ... yet it reaches nothing.
            "SELECT count(*) FROM public.documents WHERE id = $1", a["doc_id"]
        )
    assert seen == 0, (
        "spoof leak: a random/non-member sub reached A's row — membership must gate access, "
        "not merely a well-formed claim."
    )


@pytest.mark.asyncio
async def test_spoof_other_org_member_sees_zero(pg_pool, two_orgs_two_users):
    """The spoof's 'B's sub cannot reach Org X' variant: a REAL member of another org (user B,
    Org Y) — with a fully valid, honored claim — still reaches 0 of user A's Org-X rows.
    Ownership is not enough to leak; cross-org membership is the wall."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # B's claim is fully valid + honored
        seen = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE id = $1", a["doc_id"]
        )
    assert seen == 0, (
        "membership gate: Org-Y member B (valid claim) cannot reach Org-X owner A's row"
    )
