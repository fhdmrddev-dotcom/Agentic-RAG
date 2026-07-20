"""Phase 163 (TEN-01) — SKILLS-cluster membership-RLS contract (RED until plan 163-05 applies 108).

Cluster tables (7): skills, skill_files, skill_versions, skill_test_cases, skill_proposals,
skill_publish_overrides, skill_embeddings. Global branches: ``is_org_shared`` on skills; the
EXISTS-on-skills(is_org_shared) subquery on skill_files. skill_embeddings references the org_id column
added by migration 107.

  (a) CROSS-ORG ISOLATION (behavioral) — user B (Org Y) reads / updates / deletes ZERO of user A's
      (private) skills (Org X), under the real SET-LOCAL-as-user path + fail-loud auth.uid() preflight.
  (b) MEMBERSHIP PROOF (structural) — every rewritten skills-cluster policy references
      ``current_user_org_ids`` (RED→GREEN; the OLD policies are auth.uid()-only).
  (c) GLOBAL-BRANCH PRESERVATION (structural + behavioral) — the skills SELECT predicate STILL carries
      ``is_org_shared`` and skill_files STILL carries the EXISTS-on-skills subquery (T-163-02); AND a GLOBAL
      skill renders for a same-org co-member (never the owner's PRIVATE skill) but NOT for a cross-org
      user — global is now membership-scoped.

STATE: RED now, GREEN after plan 163-05 applies 107→108. THIS plan only needs ``--collect-only``.
Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg

_SKILLS_TABLES = [
    "skills", "skill_files", "skill_versions", "skill_test_cases",
    "skill_proposals", "skill_publish_overrides", "skill_embeddings",
]


async def _policy_text(pool, table: str) -> str:
    rows = await pool.fetch(
        "SELECT COALESCE(qual, '') AS qual, COALESCE(with_check, '') AS with_check "
        "FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        table,
    )
    return "\n".join(f"{r['qual']} {r['with_check']}" for r in rows)


async def _add_comember(pool, org_id: str) -> str:
    cid = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        cid, f"phase-163-cm-{cid}@test.local",
    )
    prow = await pool.fetchrow(
        "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1", cid
    )
    personal = prow["org_id"] if prow else None
    await pool.execute("DELETE FROM public.org_members WHERE user_id = $1", cid)
    if personal is not None:
        await pool.execute("DELETE FROM public.organizations WHERE id = $1", personal)
    await pool.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
        org_id, cid,
    )
    return str(cid)


async def _drop_user(pool, uid: str) -> None:
    for sql in (
        "DELETE FROM public.org_members WHERE user_id = $1",
        "DELETE FROM public.profiles WHERE id = $1",
        "DELETE FROM auth.users WHERE id = $1",
    ):
        try:
            await pool.execute(sql, uid)
        except Exception:
            pass


# ── (a) cross-org isolation — read + write ──

@pytest.mark.asyncio
async def test_cross_org_cannot_read_skills(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])
        seen = await conn.fetchval(
            "SELECT count(*) FROM public.skills WHERE user_id = $1", a["uid"]
        )
    assert seen == 0, "cross-org leak: user B (Org Y) can see user A's private skills (Org X)"


@pytest.mark.asyncio
async def test_cross_org_cannot_write_skills(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, b["uid"])
            await assert_auth_uid(conn, b["uid"])
            updated = await conn.fetch(
                "UPDATE public.skills SET name = name WHERE user_id = $1 RETURNING id", a["uid"]
            )
            assert len(updated) == 0, "cross-org leak: user B updated user A's skills"
            deleted = await conn.fetch(
                "DELETE FROM public.skills WHERE user_id = $1 RETURNING id", a["uid"]
            )
            assert len(deleted) == 0, "cross-org leak: user B deleted user A's skills"
        finally:
            await tx.rollback()


# ── (b) structural membership proof (RED→GREEN), across the whole skills cluster ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _SKILLS_TABLES)
async def test_policy_enforces_membership(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "current_user_org_ids" in text, (
        f"{table} policies do not reference current_user_org_ids — migration 108 not applied "
        f"(expected RED until plan 163-05)."
    )


# ── (c) global-branch preservation (structural) ──

@pytest.mark.asyncio
async def test_is_org_shared_branch_preserved(pg_pool):
    skills_text = await _policy_text(pg_pool, "skills")
    assert "is_org_shared" in skills_text, "skills lost its is_org_shared global branch in the rewrite (T-163-02)"
    assert "current_user_org_ids" in skills_text, "skills missing the membership predicate"
    files_text = await _policy_text(pg_pool, "skill_files")
    # The EXISTS-on-skills subquery references the skills table + is_org_shared.
    assert "skills" in files_text and "is_org_shared" in files_text, (
        "skill_files lost its EXISTS-on-skills(is_org_shared) global branch in the rewrite (T-163-02)"
    )


# ── (c) global-branch preservation (behavioral) ──

@pytest.mark.asyncio
async def test_global_skill_renders_for_comember_not_cross_org(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    c_uid = await _add_comember(pg_pool, a["org_id"])
    global_skill = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO public.skills (id, user_id, org_id, name, is_org_shared) "
            "VALUES ($1, $2, $3, $4, true)",
            global_skill, a["uid"], a["org_id"], f"163-globalskill-{global_skill}",
        )

        async with open_user_conn(pg_pool, c_uid) as conn:
            await assert_auth_uid(conn, c_uid)
            comember_sees_global = await conn.fetchval(
                "SELECT count(*) FROM public.skills WHERE id = $1", global_skill
            )
            comember_sees_private = await conn.fetchval(
                "SELECT count(*) FROM public.skills WHERE id = $1", a["skill_id"]
            )
        assert comember_sees_global == 1, (
            "global-branch regression: a same-org co-member cannot see A's GLOBAL skill"
        )
        assert comember_sees_private == 0, (
            "over-broad: co-membership alone leaked A's PRIVATE skill (only owner OR global should show)"
        )

        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            crossorg_sees_global = await conn.fetchval(
                "SELECT count(*) FROM public.skills WHERE id = $1", global_skill
            )
        assert crossorg_sees_global == 0, (
            "cross-org leak: a global skill is visible across orgs (membership must gate the is_org_shared "
            "branch post-163)"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.skills WHERE id = $1", global_skill)
        await _drop_user(pg_pool, c_uid)
