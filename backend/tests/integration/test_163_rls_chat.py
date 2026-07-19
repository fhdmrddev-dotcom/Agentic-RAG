"""Phase 163 (TEN-01) — CHAT-cluster membership-RLS contract (RED until plan 163-05 applies 108).

Cluster tables (10): threads, messages, message_feedback, runs, code_executions, sandbox_files,
todos, user_memory, workspace_files, workspace_file_versions. No global branches in this cluster —
so the cluster-specific regression is PARENT-THREAD PRESERVATION: todos / workspace_files /
workspace_file_versions resolve ownership through the parent thread, and the rewrite must keep that
subquery AND prepend the membership macro.

  (a) CROSS-ORG ISOLATION (behavioral) — user B (Org Y) reads / updates / deletes ZERO of user A's
      threads (Org X), under the real SET-LOCAL-as-user path + fail-loud auth.uid() preflight.
  (b) MEMBERSHIP PROOF (structural) — every rewritten chat policy references ``current_user_org_ids``
      (RED→GREEN; the OLD policies are auth.uid()-only, incl. the terse runs_select_own / todos_*).
  (c) PARENT-THREAD PRESERVATION (structural) — the todos / workspace_files / workspace_file_versions
      predicates STILL resolve ownership through the parent ``threads`` subquery AND now also carry the
      membership macro (a botched rewrite that dropped the parent join would silently widen access).

STATE: RED now (membership assert fails on the auth.uid()-only policies), GREEN after plan 163-05.
THIS plan only needs ``--collect-only``. Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg

_CHAT_TABLES = [
    "threads", "messages", "message_feedback", "runs", "code_executions",
    "sandbox_files", "todos", "user_memory", "workspace_files", "workspace_file_versions",
]
# The parent-thread-resolved chat tables whose ownership subquery must survive the rewrite.
_PARENT_THREAD_TABLES = ["todos", "workspace_files", "workspace_file_versions"]


async def _policy_text(pool, table: str) -> str:
    rows = await pool.fetch(
        "SELECT COALESCE(qual, '') AS qual, COALESCE(with_check, '') AS with_check "
        "FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        table,
    )
    return "\n".join(f"{r['qual']} {r['with_check']}" for r in rows)


# ── (a) cross-org isolation — read + write ──

@pytest.mark.asyncio
async def test_cross_org_cannot_read_threads(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])
        seen = await conn.fetchval(
            "SELECT count(*) FROM public.threads WHERE user_id = $1", a["uid"]
        )
    assert seen == 0, "cross-org leak: user B (Org Y) can see user A's threads (Org X)"


@pytest.mark.asyncio
async def test_cross_org_cannot_write_threads(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, b["uid"])
            await assert_auth_uid(conn, b["uid"])
            updated = await conn.fetch(
                "UPDATE public.threads SET title = title WHERE user_id = $1 RETURNING id", a["uid"]
            )
            assert len(updated) == 0, "cross-org leak: user B updated user A's threads"
            deleted = await conn.fetch(
                "DELETE FROM public.threads WHERE user_id = $1 RETURNING id", a["uid"]
            )
            assert len(deleted) == 0, "cross-org leak: user B deleted user A's threads"
        finally:
            await tx.rollback()


# ── (b) structural membership proof (RED→GREEN), across the whole chat cluster ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _CHAT_TABLES)
async def test_policy_enforces_membership(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "current_user_org_ids" in text, (
        f"{table} policies do not reference current_user_org_ids — migration 108 not applied "
        f"(expected RED until plan 163-05)."
    )


# ── (c) parent-thread ownership preservation (structural) ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _PARENT_THREAD_TABLES)
async def test_parent_thread_ownership_preserved(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "threads" in text, (
        f"{table} lost its parent-thread ownership subquery in the rewrite — access would silently widen"
    )
    assert "current_user_org_ids" in text, (
        f"{table} did not gain the membership predicate alongside the preserved parent-thread subquery"
    )
