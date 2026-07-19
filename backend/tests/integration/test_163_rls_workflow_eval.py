"""Phase 163 (TEN-01) — WORKFLOW-EVAL cluster membership-RLS contract (RED until plan 163-05).

Cluster tables (8): workflow_definitions, workflow_phases, workflow_runs, eval_runs, eval_results,
eval_ratings, tuner_runs, harness_audit. Special cases exercised here:
  * workflow_definitions owner column is ``created_by`` (NOT user_id) + ``is_global`` global branch;
  * workflow_phases / workflow_runs resolve ownership through the parent thread (subquery preserved);
  * tuner_runs preserves the EXISTS-on-skills(is_global) global branch.

  (a) CROSS-ORG ISOLATION (behavioral) — a workflow_definition created_by user A (Org X) is invisible /
      unwritable to user B (Org Y), under the real SET-LOCAL-as-user path + fail-loud auth.uid() preflight.
  (b) MEMBERSHIP PROOF (structural) — every rewritten policy references ``current_user_org_ids``.
  (c) PRESERVATION (structural) — workflow_definitions SELECT keeps ``is_global`` + resolves the
      ``created_by`` owner; tuner_runs keeps the EXISTS-on-skills subquery; workflow_runs/workflow_phases
      keep the parent-thread subquery — all alongside the membership macro (T-163-02 / T-163-02b).
  (c) BEHAVIORAL — a GLOBAL workflow_definition renders for a same-org co-member but NOT cross-org.

STATE: RED now, GREEN after plan 163-05 applies 107→108. THIS plan only needs ``--collect-only``.
Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg

_WF_EVAL_TABLES = [
    "workflow_definitions", "workflow_phases", "workflow_runs", "eval_runs",
    "eval_results", "eval_ratings", "tuner_runs", "harness_audit",
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


async def _seed_workflow_def(pool, created_by: str, org_id: str, is_global: bool):
    wf_id = uuid4()
    await pool.execute(
        "INSERT INTO public.workflow_definitions (id, slug, name, created_by, org_id, is_global) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        wf_id, f"163-wf-{wf_id}", f"163-wf-{wf_id}", created_by, org_id, is_global,
    )
    return wf_id


# ── (a) cross-org isolation (owner column = created_by) ──

@pytest.mark.asyncio
async def test_cross_org_cannot_read_or_write_workflow_definitions(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    wf_id = await _seed_workflow_def(pg_pool, a["uid"], a["org_id"], is_global=False)
    try:
        async with pg_pool.acquire() as conn:
            tx = conn.transaction()
            await tx.start()
            try:
                await _apply_rls_user_context(conn, b["uid"])
                await assert_auth_uid(conn, b["uid"])
                seen = await conn.fetchval(
                    "SELECT count(*) FROM public.workflow_definitions WHERE id = $1", wf_id
                )
                assert seen == 0, "cross-org leak: user B sees user A's workflow_definition"
                deleted = await conn.fetch(
                    "DELETE FROM public.workflow_definitions WHERE id = $1 RETURNING id", wf_id
                )
                assert len(deleted) == 0, "cross-org leak: user B deleted user A's workflow_definition"
            finally:
                await tx.rollback()
    finally:
        await pg_pool.execute("DELETE FROM public.workflow_definitions WHERE id = $1", wf_id)


# ── (b) structural membership proof (RED→GREEN), across the whole cluster ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _WF_EVAL_TABLES)
async def test_policy_enforces_membership(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "current_user_org_ids" in text, (
        f"{table} policies do not reference current_user_org_ids — migration 108 not applied "
        f"(expected RED until plan 163-05)."
    )


# ── (c) preservation: created_by owner + is_global, EXISTS-on-skills, parent-thread (structural) ──

@pytest.mark.asyncio
async def test_workflow_definitions_created_by_and_is_global_preserved(pg_pool):
    text = await _policy_text(pg_pool, "workflow_definitions")
    assert "created_by" in text, "workflow_definitions must key ownership off created_by (T-163-02b)"
    assert "is_global" in text, "workflow_definitions lost its is_global global branch (T-163-02)"
    assert "current_user_org_ids" in text, "workflow_definitions missing the membership predicate"


@pytest.mark.asyncio
async def test_tuner_runs_exists_on_skills_preserved(pg_pool):
    text = await _policy_text(pg_pool, "tuner_runs")
    assert "skills" in text and "is_global" in text, (
        "tuner_runs lost its EXISTS-on-skills(is_global) global branch in the rewrite (T-163-02)"
    )
    assert "current_user_org_ids" in text, "tuner_runs missing the membership predicate"


@pytest.mark.asyncio
@pytest.mark.parametrize("table", ["workflow_phases", "workflow_runs"])
async def test_parent_thread_ownership_preserved(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "threads" in text, f"{table} lost its parent-thread ownership subquery in the rewrite"
    assert "current_user_org_ids" in text, f"{table} did not gain the membership predicate"


# ── (c) global-branch preservation (behavioral) ──

@pytest.mark.asyncio
async def test_global_workflow_def_renders_for_comember_not_cross_org(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    c_uid = await _add_comember(pg_pool, a["org_id"])
    wf_id = await _seed_workflow_def(pg_pool, a["uid"], a["org_id"], is_global=True)
    try:
        async with open_user_conn(pg_pool, c_uid) as conn:
            await assert_auth_uid(conn, c_uid)
            comember_sees = await conn.fetchval(
                "SELECT count(*) FROM public.workflow_definitions WHERE id = $1", wf_id
            )
        assert comember_sees == 1, (
            "global-branch regression: a same-org co-member cannot see A's global workflow_definition"
        )
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            crossorg_sees = await conn.fetchval(
                "SELECT count(*) FROM public.workflow_definitions WHERE id = $1", wf_id
            )
        assert crossorg_sees == 0, (
            "cross-org leak: a global workflow_definition is visible across orgs (membership must gate "
            "the is_global branch post-163)"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.workflow_definitions WHERE id = $1", wf_id)
        await _drop_user(pg_pool, c_uid)
