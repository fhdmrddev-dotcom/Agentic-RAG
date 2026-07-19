"""Phase 163 (TEN-01) — DOCUMENTS-cluster membership-RLS contract (RED until plan 163-05 applies 108).

Encodes what migration ``108_rls_membership_rewrite.sql`` must make true for the documents cluster
(documents / folders / document_views / document_chunks) once the Wave-4 client swap flips the
connection to role ``authenticated``:

  (a) CROSS-ORG ISOLATION (behavioral) — user B in Org Y reads / updates / deletes ZERO of user A's
      documents (Org X). Runs under the real SET-LOCAL-as-user path (role authenticated + JWT sub),
      with the fail-loud ``assert_auth_uid`` preflight so a NULL uid cannot false-green at "0 rows".
  (b) MEMBERSHIP PROOF (structural) — at least one rewritten documents policy's predicate references
      ``current_user_org_ids`` (the RED→GREEN signal: the OLD policy is auth.uid()-only). Proves the
      rewrite LANDED, not the pre-163 policy.
  (c) GLOBAL-BRANCH PRESERVATION (structural + behavioral) — the documents/folders SELECT predicate
      STILL contains ``folder_is_globally_visible`` (T-163-02: a dropped global branch is data-loss),
      AND a global-folder document renders for a same-org NON-OWNER (co-member) while a cross-org user
      no longer sees it (global is now org-scoped — the semantic the crux introduces).

STATE CONTRACT: RED *now* — the membership structural assert + the cross-org global-visibility assert
fail against the live auth.uid()-only / is_global-for-everyone policies. GREEN after plan 163-05 applies
107 then 108. For THIS plan the bar is ``pytest ... --collect-only`` (imports resolve) — do NOT try to
make it pass here (108 is deliberately not applied yet). Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg


# ── introspection + co-member helpers (pure SQL against the live catalog) ──

async def _policy_text(pool, table: str) -> str:
    """Concatenated qual + with_check across every policy on public.<table> (from pg_policies)."""
    rows = await pool.fetch(
        "SELECT COALESCE(qual, '') AS qual, COALESCE(with_check, '') AS with_check "
        "FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        table,
    )
    return "\n".join(f"{r['qual']} {r['with_check']}" for r in rows)


async def _add_comember(pool, org_id: str) -> str:
    """Seed a fresh user whose ONLY membership is ``org_id`` (a same-org co-member of that org)."""
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


# ── (a) cross-org isolation — read ──

@pytest.mark.asyncio
async def test_cross_org_cannot_read_documents(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud: NULL uid would false-pass at 0 rows
        seen = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE user_id = $1", a["uid"]
        )
    assert seen == 0, "cross-org leak: user B (Org Y) can see user A's documents (Org X)"


# ── (a) cross-org isolation — write (UPDATE/DELETE affect 0 rows; always rolled back) ──

@pytest.mark.asyncio
async def test_cross_org_cannot_write_documents(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, b["uid"])
            await assert_auth_uid(conn, b["uid"])
            updated = await conn.fetch(
                "UPDATE public.documents SET filename = filename WHERE user_id = $1 RETURNING id",
                a["uid"],
            )
            assert len(updated) == 0, "cross-org leak: user B updated user A's documents"
            deleted = await conn.fetch(
                "DELETE FROM public.documents WHERE user_id = $1 RETURNING id", a["uid"]
            )
            assert len(deleted) == 0, "cross-org leak: user B deleted user A's documents"
        finally:
            await tx.rollback()  # never mutate the seeded corpus


# ── (b) structural membership proof (RED→GREEN) ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", ["documents", "folders", "document_views", "document_chunks"])
async def test_policy_enforces_membership(pg_pool, table):
    text = await _policy_text(pg_pool, table)
    assert "current_user_org_ids" in text, (
        f"{table} policies do not reference current_user_org_ids — migration 108 not applied "
        f"(expected RED until plan 163-05)."
    )


# ── (c) global-branch preservation (structural) ──

@pytest.mark.asyncio
async def test_global_folder_branch_preserved(pg_pool):
    for table in ("documents", "folders"):
        text = await _policy_text(pg_pool, table)
        assert "folder_is_globally_visible" in text, (
            f"{table} lost its folder_is_globally_visible global branch in the rewrite (T-163-02)"
        )
        assert "current_user_org_ids" in text, f"{table} missing the membership predicate"


# ── (c) global-branch preservation (behavioral: renders for a same-org non-owner, not cross-org) ──

@pytest.mark.asyncio
async def test_global_folder_doc_renders_for_comember_not_cross_org(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    c_uid = await _add_comember(pg_pool, a["org_id"])
    folder_id, doc_id = uuid4(), uuid4()
    try:
        # A owns a GLOBAL folder + a document inside it (explicit org_id so we never rely on autofill).
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name, is_global) "
            "VALUES ($1, $2, $3, $4, true)",
            folder_id, a["uid"], a["org_id"], f"163-globalfolder-{folder_id}",
        )
        await pg_pool.execute(
            "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
            "file_size, mime_type, status, is_latest, version_number) "
            "VALUES ($1, $2, $3, $4, $5, $6, 100, 'text/plain', 'completed', true, 1)",
            doc_id, a["uid"], a["org_id"], folder_id, f"163-gf-{doc_id}.txt", f"{a['uid']}/{doc_id}.txt",
        )

        # Same-org co-member SEES it via the preserved global-folder branch.
        async with open_user_conn(pg_pool, c_uid) as conn:
            await assert_auth_uid(conn, c_uid)
            comember_sees = await conn.fetchval(
                "SELECT count(*) FROM public.documents WHERE id = $1", doc_id
            )
        assert comember_sees == 1, (
            "global-branch regression: a same-org co-member can no longer see A's global-folder document"
        )

        # Cross-org user does NOT (global is now membership-scoped — RED before 108, GREEN after).
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            crossorg_sees = await conn.fetchval(
                "SELECT count(*) FROM public.documents WHERE id = $1", doc_id
            )
        assert crossorg_sees == 0, (
            "cross-org leak: a global-folder document is visible across orgs (membership must gate the "
            "global branch post-163)"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", doc_id)
        await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", folder_id)
        await _drop_user(pg_pool, c_uid)
