"""Phase 299 code review (299-REVIEW.md) — the resolver findings, DRIVEN on real Postgres.

Each test reproduces one review finding against the REAL local database, inside ONE transaction
that is ALWAYS rolled back (nothing is committed). The statements are issued exactly as the
service issues them: the pool kinds (run, Expert, the workflow-org read) as the session role with
the caller bound as ``$2``.

  * CR-01 — ``WORKFLOW_ORG_SQL`` named the org of a definition the caller OWNS but whose org they
    have LEFT, so a new schedule was stamped into (and run unattended in) that org.
  * CR-02 — ``RUN_SQL`` returned the owner's PRIVATE chat title to any member of a finished run's
    org; a non-owner now reads the run's frozen workflow name instead.
  * WR-02 — ``RUN_SQL``'s owner arm had no membership check, so a run started in an org the caller
    has since left resolved with that org (and the gate offered a switch that can never land).

Skip-guarded on :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import json
from uuid import UUID, uuid4

import pytest

from app.services import link_resolver as lr
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = requires_pg


async def _user(conn, label: str) -> UUID:
    uid = uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"299r-{label}-{uid}@test.local"
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


async def _leave(conn, org: UUID, uid: UUID) -> None:
    await conn.execute(
        "DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", org, uid
    )


async def _definition(conn, owner: UUID, org: UUID, *, status: str = "published", name: str = "299r wf") -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, $2, $3, $4, $5) RETURNING id",
        f"299r-{uuid4().hex[:8]}", name, owner, org, status,
    )


class _Tx:
    """``async with _Tx() as conn`` — one connection, one transaction, always rolled back."""

    async def __aenter__(self):
        import asyncpg

        self.conn = await asyncpg.connect(PG_TEST_DSN)
        self.tx = self.conn.transaction()
        await self.tx.start()
        return self.conn

    async def __aexit__(self, *exc):
        try:
            await self.tx.rollback()
        finally:
            await self.conn.close()
        return False


# ── CR-01 ────────────────────────────────────────────────────────────────────────


async def test_cr01_a_definition_in_an_org_the_owner_left_names_no_org():
    async with _Tx() as conn:
        u = await _user(conn, "u")
        org_a = await _org(conn, f"299r A {uuid4().hex[:6]}")
        org_b = await _org(conn, f"299r B {uuid4().hex[:6]}")
        await _member(conn, org_a, u)
        await _member(conn, org_b, u)
        wf = await _definition(conn, u, org_a)

        # Still a member: the definition's own org (the D-18 stamp).
        assert await lr.workflow_org(conn, wf, owner_id=u) == org_a

        # U leaves A. The row survives with created_by = U, org_id = A.
        await _leave(conn, org_a, u)
        # ⛔ A schedule (and a Tweak guard sentence) must never name an org U is no longer in.
        assert await lr.workflow_org(conn, wf, owner_id=u) is None


async def test_cr01_a_global_definition_and_a_stranger_still_name_no_org():
    async with _Tx() as conn:
        u = await _user(conn, "u")
        other = await _user(conn, "o")
        org_a = await _org(conn, f"299r A {uuid4().hex[:6]}")
        await _member(conn, org_a, u)
        await _member(conn, org_a, other)
        wf = await _definition(conn, u, org_a)
        # Someone else's definition in a shared org reads like an id that does not exist.
        assert await lr.workflow_org(conn, wf, owner_id=other) is None
        assert await lr.workflow_org(conn, uuid4(), owner_id=u) is None


# ── CR-02 ────────────────────────────────────────────────────────────────────────


async def _run(conn, thread: UUID, definition: UUID, org: UUID, owner: UUID, *, status: str = "completed", snapshot_name: str | None = None) -> UUID:
    snapshot = json.dumps({"name": snapshot_name}) if snapshot_name is not None else None
    return await conn.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, definition_snapshot)"
        " VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id",
        thread, definition, status, org, owner, snapshot,
    )


async def test_cr02_a_member_never_reads_the_owners_private_chat_title():
    async with _Tx() as conn:
        u = await _user(conn, "u")
        m = await _user(conn, "m")
        org_a = await _org(conn, f"299r A {uuid4().hex[:6]}")
        await _member(conn, org_a, u)
        await _member(conn, org_a, m)
        wf = await _definition(conn, u, org_a, name="Live name")
        thread = await conn.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
            u, org_a, "Severance terms for J. Smith",
        )
        run = await _run(conn, thread, wf, org_a, u, snapshot_name="Tender review")

        # The owner still reads her own chat's title.
        mine = await lr.lookup(conn, "run", run, u)
        assert mine is not None and mine["title"] == "Severance terms for J. Smith"

        # ⛔ A member of the run's org opens it (D-34) but never reads the private chat title:
        # the run's frozen workflow name, as the evidence report shows it.
        theirs = await lr.lookup(conn, "run", run, m)
        assert theirs is not None
        assert theirs["title"] == "Tender review"
        assert lr.to_target("run", theirs).title == "Tender review"


async def test_cr02_a_run_with_no_snapshot_falls_back_like_the_evidence_report():
    async with _Tx() as conn:
        u = await _user(conn, "u")
        m = await _user(conn, "m")
        org_a = await _org(conn, f"299r A {uuid4().hex[:6]}")
        await _member(conn, org_a, u)
        await _member(conn, org_a, m)
        wf = await _definition(conn, u, org_a, name="Live name")
        thread = await conn.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
            u, org_a, "Private title",
        )
        run = await _run(conn, thread, wf, org_a, u)  # a pre-122 run: no snapshot
        theirs = await lr.lookup(conn, "run", run, m)
        assert theirs is not None and theirs["title"] == "Live name"
