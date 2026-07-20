"""Phase 163 (TEN-01) — DM (doc-management) cluster membership-RLS contract (RED until plan 163-05).

Cluster tables: document_images, document_tables, document_relationships, classification_rules,
metadata_field_definitions, pdf_extraction_runs. Encodes what migration 108 must make true:

  (a) CROSS-ORG ISOLATION (behavioral) — a classification_rule owned by user A (Org X) is invisible /
      unwritable to user B (Org Y), under the real SET-LOCAL-as-user path + fail-loud auth.uid() preflight.
  (b) MEMBERSHIP PROOF (structural) — each rewritten DM policy references ``current_user_org_ids``
      (RED→GREEN: the OLD policies are auth.uid()-only). Includes the document_images/document_tables
      single FOR-ALL policies and the SELECT-only pdf_extraction_runs.
  (c) GLOBAL-BRANCH PRESERVATION (structural + behavioral) — classification_rules /
      metadata_field_definitions SELECT predicates STILL carry ``is_system_global`` (T-163-02), AND a global
      classification_rule renders for a same-org co-member but NOT for a cross-org user.

STATE: RED now, GREEN after plan 163-05 applies 107→108. THIS plan only needs ``--collect-only``.
Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg

_DM_TABLES = [
    "document_images", "document_tables", "document_relationships",
    "classification_rules", "metadata_field_definitions", "pdf_extraction_runs",
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


async def _seed_rule(pool, user_id: str, org_id: str, is_system_global: bool):
    rule_id = uuid4()
    await pool.execute(
        "INSERT INTO public.classification_rules (id, user_id, org_id, name, match_expr, is_system_global) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        rule_id, user_id, org_id, f"163-rule-{rule_id}", {"kind": "all", "conditions": []}, is_system_global,
    )
    return rule_id


# ── (a) cross-org isolation ──

@pytest.mark.asyncio
async def test_cross_org_cannot_read_or_write_classification_rules(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    rule_id = await _seed_rule(pg_pool, a["uid"], a["org_id"], is_system_global=False)
    try:
        async with pg_pool.acquire() as conn:
            tx = conn.transaction()
            await tx.start()
            try:
                await _apply_rls_user_context(conn, b["uid"])
                await assert_auth_uid(conn, b["uid"])
                seen = await conn.fetchval(
                    "SELECT count(*) FROM public.classification_rules WHERE id = $1", rule_id
                )
                assert seen == 0, "cross-org leak: user B sees user A's classification_rule"
                deleted = await conn.fetch(
                    "DELETE FROM public.classification_rules WHERE id = $1 RETURNING id", rule_id
                )
                assert len(deleted) == 0, "cross-org leak: user B deleted user A's classification_rule"
            finally:
                await tx.rollback()
    finally:
        await pg_pool.execute("DELETE FROM public.classification_rules WHERE id = $1", rule_id)


# ── (b) structural membership proof (RED→GREEN), across the whole DM cluster ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _DM_TABLES)
async def test_policy_enforces_membership(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "current_user_org_ids" in text, (
        f"{table} policies do not reference current_user_org_ids — migration 108 not applied "
        f"(expected RED until plan 163-05)."
    )


# ── (c) global-branch preservation (structural) ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", ["classification_rules", "metadata_field_definitions"])
async def test_is_system_global_branch_preserved(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "is_system_global" in text, f"{table} lost its is_system_global global branch in the rewrite (T-163-02)"
    assert "current_user_org_ids" in text, f"{table} missing the membership predicate"


# ── (c) global-branch preservation (behavioral) ──

@pytest.mark.asyncio
async def test_global_rule_renders_for_comember_not_cross_org(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    c_uid = await _add_comember(pg_pool, a["org_id"])
    rule_id = await _seed_rule(pg_pool, a["uid"], a["org_id"], is_system_global=True)
    try:
        async with open_user_conn(pg_pool, c_uid) as conn:
            await assert_auth_uid(conn, c_uid)
            comember_sees = await conn.fetchval(
                "SELECT count(*) FROM public.classification_rules WHERE id = $1", rule_id
            )
        assert comember_sees == 1, (
            "global-branch regression: a same-org co-member cannot see A's global classification_rule"
        )
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            crossorg_sees = await conn.fetchval(
                "SELECT count(*) FROM public.classification_rules WHERE id = $1", rule_id
            )
        assert crossorg_sees == 0, (
            "cross-org leak: a global classification_rule is visible across orgs (membership must gate "
            "the is_system_global branch post-163)"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.classification_rules WHERE id = $1", rule_id)
        await _drop_user(pg_pool, c_uid)
