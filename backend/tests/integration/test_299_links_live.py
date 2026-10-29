"""Phase 299 (299-01, D-07 / D-08 / D-34 / T-299-04 / T-299-05) — the resolver statements, LIVE.

Every statement in ``app.services.link_resolver.SQL_BY_KIND`` is executed against the REAL local
Postgres, inside ONE transaction that is ALWAYS rolled back (nothing is committed; the seed never
outlives the test). Thread + workflow run under the caller's RLS context — the SAME
``_apply_rls_user_context`` the request factory uses, imported, never retyped — each inside its own
savepoint that is rolled back, so the role swap cannot bleed into the next probe. Run + Expert run
as the session role (the service pool bypasses RLS) with the caller bound as ``$2``, which is how
``app.api.links`` issues them (planner corrections P1 / P2).

The matrix, for two orgs A and B:
  * U (member of A) opens her own thread, draft, finished and unfinished run;
  * M (a second member of A) opens U's run once it is ``completed``, and NOT while ``active``;
  * N (member of B only) gets nothing for every kind;
  * a ``granted`` Expert in A opens for its USER grantee and for a ROLE grantee whose role is held
    IN A — and not for a user holding that role only in B;
  * a disabled Expert in A opens only for an ``experts:manage`` holder in A;
  * a random UUID gets nothing for every kind;
  * the thread/workflow statements under ``SET LOCAL ROLE anon`` return no rows (or are refused).

Skip-guarded on :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from app.services import link_resolver as lr
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = requires_pg


class _Rollback(Exception):
    pass


async def _savepoint(conn, fn):
    """Run ``fn(conn)`` in a savepoint that is always rolled back; return its result."""
    box: dict = {}
    try:
        async with conn.transaction():
            box["v"] = await fn(conn)
            raise _Rollback
    except _Rollback:
        pass
    return box.get("v")


async def _open(conn, kind: str, item: UUID, uid: UUID):
    """The resolver statement as ``app.api.links`` issues it for ``uid``."""
    if kind in lr.POOL_KINDS:
        return await lr.lookup(conn, kind, item, uid)

    async def _as_user(c):
        await _apply_rls_user_context(c, str(uid))
        return await lr.lookup(c, kind, item, uid)

    return await _savepoint(conn, _as_user)


async def _user(conn, label: str) -> UUID:
    uid = uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"299-{label}-{uid}@test.local"
    )
    return uid


async def _org(conn, name: str) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", name
    )


async def _member(conn, org: UUID, uid: UUID, role: str = "member") -> None:
    await conn.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3) "
        "ON CONFLICT DO NOTHING",
        org, uid, role,
    )


async def _expert(conn, org: UUID, owner: UUID, *, visibility: str, enabled: bool = True) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.expert_bundles (org_id, created_by, name, slug, visibility, is_enabled)"
        " VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        org, owner, f"299 {visibility}", f"299-{visibility}-{uuid4().hex[:8]}", visibility, enabled,
    )


async def test_the_resolver_matrix_on_real_postgres():
    import asyncpg

    conn = await asyncpg.connect(PG_TEST_DSN)
    tx = conn.transaction()
    await tx.start()
    try:
        u, m, n, g, r, x, mgr = [
            await _user(conn, label) for label in ("u", "m", "n", "g", "r", "x", "mgr")
        ]
        org_a = await _org(conn, f"299 Org A {uuid4().hex[:6]}")
        org_b = await _org(conn, f"299 Org B {uuid4().hex[:6]}")
        for uid in (u, m, g, mgr):
            await _member(conn, org_a, uid)
        await _member(conn, org_a, r, "dept-admin")  # role grantee: holds the role IN A
        await _member(conn, org_a, x, "member")      # holds dept-admin only in B
        await _member(conn, org_b, x, "dept-admin")
        await _member(conn, org_b, n)

        manage_role = await conn.fetchval(
            "SELECT role FROM public.role_permissions WHERE permission_key = 'experts:manage' "
            "AND role NOT IN ('member', 'dept-admin') ORDER BY role LIMIT 1"
        )
        if manage_role is None:
            manage_role = "org-admin"
            await conn.execute(
                "INSERT INTO public.role_permissions (role, permission_key) VALUES ($1, $2)",
                manage_role, "experts:manage",
            )
        await conn.execute(
            "UPDATE public.org_members SET role = $1 WHERE org_id = $2 AND user_id = $3",
            manage_role, org_a, mgr,
        )
        # Non-vacuity: plain members of A must NOT carry experts:manage, else "disabled opens only
        # for a manager" below would pass for the wrong reason.
        assert not await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM public.role_permissions"
            " WHERE role = 'member' AND permission_key = 'experts:manage')"
        )

        thread = await conn.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
            u, org_a, "299 thread",
        )
        draft = await conn.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
            " VALUES ($1, $2, $3, $4, 'draft') RETURNING id",
            f"299-draft-{uuid4().hex[:8]}", "299 draft", u, org_a,
        )
        published = await conn.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
            " VALUES ($1, $2, $3, $4, 'published') RETURNING id",
            f"299-pub-{uuid4().hex[:8]}", "299 published", u, org_a,
        )
        run_done = await conn.fetchval(
            "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id)"
            " VALUES ($1, $2, 'completed', $3, $4) RETURNING id",
            thread, published, org_a, u,
        )
        run_live = await conn.fetchval(
            "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id)"
            " VALUES ($1, $2, 'active', $3, $4) RETURNING id",
            thread, published, org_a, u,
        )
        granted = await _expert(conn, org_a, u, visibility="granted")
        await conn.execute(
            "INSERT INTO public.expert_grants (expert_id, grantee_type, grantee_id) VALUES"
            " ($1, 'user', $2), ($1, 'role', 'dept-admin')",
            granted, str(g),
        )
        disabled = await _expert(conn, org_a, u, visibility="org", enabled=False)
        org_wide = await _expert(conn, org_a, u, visibility="org")
        private = await _expert(conn, org_a, u, visibility="private")

        # ── the owner opens her own items ─────────────────────────────────────────
        t = await _open(conn, "thread", thread, u)
        assert t is not None and t["org_id"] == org_a and t["org_name"].startswith("299 Org A")
        d = await _open(conn, "workflow", draft, u)
        assert d is not None and d["status"] == "draft"
        assert lr.to_target("workflow", d).state == "draft"
        assert await _open(conn, "run", run_done, u) is not None
        assert await _open(conn, "run", run_live, u) is not None
        assert lr.to_target("run", await _open(conn, "run", run_done, u)).audience == "org_members"
        assert await _open(conn, "expert", private, u) is not None

        # ── a second member of the run's org: finished yes, running no (D-34) ─────
        assert await _open(conn, "run", run_done, m) is not None
        assert await _open(conn, "run", run_live, m) is None
        assert await _open(conn, "thread", thread, m) is None
        assert await _open(conn, "workflow", draft, m) is None
        assert await _open(conn, "workflow", published, m) is None  # D-33: no member arm
        assert await _open(conn, "expert", org_wide, m) is not None
        assert await _open(conn, "expert", private, m) is None

        # ── a non-member gets nothing for every kind (T-299-04) ──────────────────
        for kind, item in (
            ("thread", thread), ("workflow", draft), ("workflow", published),
            ("run", run_done), ("run", run_live), ("expert", granted),
            ("expert", org_wide), ("expert", disabled), ("expert", private),
        ):
            assert await _open(conn, kind, item, n) is None, (kind, "non-member")

        # ── grants: user grantee, role grantee by the role held IN THE BUNDLE'S ORG ─
        assert await _open(conn, "expert", granted, g) is not None
        assert await _open(conn, "expert", granted, r) is not None
        assert await _open(conn, "expert", granted, x) is None
        assert await _open(conn, "expert", granted, m) is None
        assert lr.to_target("expert", await _open(conn, "expert", granted, g)).audience == "granted"

        # ── disabled: only an experts:manage holder in the bundle's org ───────────
        assert await _open(conn, "expert", disabled, mgr) is not None
        assert await _open(conn, "expert", disabled, m) is None
        assert await _open(conn, "expert", disabled, u) is None  # even its author, a member

        # ── a random id gets nothing, on the same statement ───────────────────────
        for kind in ("thread", "workflow", "run", "expert"):
            assert await _open(conn, kind, uuid4(), u) is None

        # ── anon: the RLS statements return no rows, or are refused ──────────────
        for kind, item in (("thread", thread), ("workflow", draft)):
            async def _as_anon(c, kind=kind, item=item):
                await c.execute("SET LOCAL ROLE anon")
                try:
                    return await c.fetchrow(lr.SQL_BY_KIND[kind], item)
                except asyncpg.InsufficientPrivilegeError:
                    return "refused"

            got = await _savepoint(conn, _as_anon)
            assert got is None or got == "refused", (kind, got)
    finally:
        await tx.rollback()
        await conn.close()

