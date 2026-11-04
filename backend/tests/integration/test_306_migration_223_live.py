"""Phase 306-01 (D-31 / T-306-08 / T-306-23 / T-306-24 / T-306-26) — migration 223, LIVE.

What this proves against the local database (127.0.0.1:54322):

* ``scripts/check-migration-223-live.py`` prints ``223 live`` and exits 0;
* the migration RE-RUNS cleanly (idempotent: applied a second time by this test);
* a thread's origin is FROZEN: a service-role INSERT keeps ``('mcp', label, ref)``; an UPDATE that
  rewrites ``origin_kind`` keeps ``'mcp'`` — as the service role AND as an authenticated member
  through the user-JWT path (``app.dependencies._apply_rls_user_context``, the same role swap +
  claims every user-scoped request uses); an authenticated INSERT that SENDS origin values stores
  NULLs; ``origin_kind = 'bogus'`` is refused by the CHECK;
* the four ``app_settings`` knobs read 30 / 2 / 4 / 6 on the existing row and their CHECKs refuse
  46 / 0 (and accept the boundaries);
* nobody but the service role may EXECUTE the trigger function.

⛔ BUG-261031-01: no statement here runs as ``anon``. Privilege facts are catalog functions called
as the connecting role. The authenticated statements run in a transaction with a real member's
claims, so the RLS policies (``current_user_org_ids()``) resolve as they do in the app.

Everything a test writes happens inside a transaction that is ROLLED BACK, so no thread survives
and ``app_settings`` is never changed. Every UPDATE asserts it touched exactly one row, so a policy
that silently matched nothing cannot pass for a frozen origin.

Guarded on :54322 only (``requires_pg``), never on 223 being applied: before 223 these FAIL.
"""
from __future__ import annotations

import subprocess
import sys
import uuid
from pathlib import Path

import pytest

from tests.integration._rls_harness import PG_TEST_DSN, assert_auth_uid, requires_pg

pytestmark = [requires_pg]

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION = REPO_ROOT / "supabase" / "migrations" / "223_mcp_ask_run_and_admission.sql"
CHECK_SCRIPT = REPO_ROOT / "scripts" / "check-migration-223-live.py"
FN = "public.threads_origin_immutable()"
KNOB_DEFAULTS = {
    "mcp_ask_wait_seconds": 30,
    "outside_inflight_per_key": 2,
    "outside_inflight_per_org": 4,
    "outside_inflight_per_provider": 6,
}


class _Rollback(Exception):
    pass


async def _conn():
    import asyncpg

    return await asyncpg.connect(PG_TEST_DSN)


async def _member(conn) -> tuple[str, str]:
    """A real (user_id, org_id) membership — the authenticated statements need real claims."""
    row = await conn.fetchrow(
        "SELECT m.user_id, m.org_id FROM public.org_members m "
        "JOIN auth.users u ON u.id = m.user_id ORDER BY m.user_id, m.org_id LIMIT 1"
    )
    assert row is not None, "no org member on the local DB to act as"
    return str(row["user_id"]), str(row["org_id"])


async def _as_service_role(conn) -> None:
    await conn.execute("SET LOCAL ROLE service_role")


async def _as_member(conn, uid: str) -> None:
    from app.dependencies import _apply_rls_user_context

    await _apply_rls_user_context(conn, uid)
    await assert_auth_uid(conn, uid)
    assert await conn.fetchval("SELECT current_user") == "authenticated"


async def _insert_mcp_thread(conn, uid: str, org: str, ref: uuid.UUID) -> uuid.UUID:
    return await conn.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title, origin_kind, origin_label, origin_ref) "
        "VALUES ($1, $2, '306-01 live probe', 'mcp', 'Probe key', $3) RETURNING id",
        uuid.UUID(uid), uuid.UUID(org), ref,
    )


async def _origin(conn, tid) -> tuple:
    row = await conn.fetchrow(
        "SELECT origin_kind, origin_label, origin_ref, title FROM public.threads WHERE id = $1", tid
    )
    assert row is not None
    return row["origin_kind"], row["origin_label"], row["origin_ref"], row["title"]


# ── the check script + idempotent re-run ────────────────────────────────────────────────────


def test_the_check_script_reads_223_live():
    proc = subprocess.run(
        [sys.executable, str(CHECK_SCRIPT)], cwd=REPO_ROOT,
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert proc.stdout.strip().splitlines()[-1] == "223 live"


async def test_the_migration_reruns_cleanly():
    c = await _conn()
    try:
        await c.execute(MIGRATION.read_text(encoding="utf-8"))
        assert await c.fetchval(
            "SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.threads'::regclass "
            "AND tgname IN ('threads_origin_freeze_update', 'threads_origin_freeze_insert')"
        ) == 2
    finally:
        await c.close()


# ── the freeze (T-306-08) ───────────────────────────────────────────────────────────────────


async def test_a_service_role_insert_keeps_its_origin_and_an_update_cannot_rewrite_it():
    c = await _conn()
    try:
        uid, org = await _member(c)
        ref = uuid.uuid4()
        try:
            async with c.transaction():
                await _as_service_role(c)
                tid = await _insert_mcp_thread(c, uid, org, ref)
                assert (await _origin(c, tid))[:3] == ("mcp", "Probe key", ref)
                status = await c.execute(
                    "UPDATE public.threads SET origin_kind = 'app', origin_label = NULL, "
                    "origin_ref = NULL, title = 'renamed by service' WHERE id = $1", tid
                )
                assert status == "UPDATE 1"
                kind, label, got_ref, title = await _origin(c, tid)
                assert (kind, label, got_ref) == ("mcp", "Probe key", ref)
                assert title == "renamed by service"  # the unrelated column DID change
                raise _Rollback
        except _Rollback:
            pass
    finally:
        await c.close()


async def test_an_authenticated_member_cannot_rewrite_an_origin():
    c = await _conn()
    try:
        uid, org = await _member(c)
        ref = uuid.uuid4()
        try:
            async with c.transaction():
                await _as_service_role(c)
                tid = await _insert_mcp_thread(c, uid, org, ref)
                await c.execute("RESET ROLE")
                await _as_member(c, uid)
                status = await c.execute(
                    "UPDATE public.threads SET origin_kind = 'app', origin_label = 'forged', "
                    "origin_ref = $2, title = 'renamed by member' WHERE id = $1",
                    tid, uuid.uuid4(),
                )
                assert status == "UPDATE 1", "the member's own thread must be updatable (non-vacuous)"
                kind, label, got_ref, title = await _origin(c, tid)
                assert (kind, label, got_ref) == ("mcp", "Probe key", ref)
                assert title == "renamed by member"
                raise _Rollback
        except _Rollback:
            pass
    finally:
        await c.close()


async def test_an_authenticated_insert_cannot_claim_an_origin():
    c = await _conn()
    try:
        uid, org = await _member(c)
        try:
            async with c.transaction():
                await _as_member(c, uid)
                tid = await _insert_mcp_thread(c, uid, org, uuid.uuid4())
                assert tid is not None
                kind, label, ref, _title = await _origin(c, tid)
                assert (kind, label, ref) == (None, None, None)
                raise _Rollback
        except _Rollback:
            pass
    finally:
        await c.close()


async def test_an_unknown_origin_kind_is_refused():
    import asyncpg

    c = await _conn()
    try:
        uid, org = await _member(c)
        with pytest.raises(asyncpg.CheckViolationError):
            async with c.transaction():
                await _as_service_role(c)
                await c.execute(
                    "INSERT INTO public.threads (user_id, org_id, title, origin_kind) "
                    "VALUES ($1, $2, '306-01 bogus probe', 'bogus')",
                    uuid.UUID(uid), uuid.UUID(org),
                )
    finally:
        await c.close()


async def test_the_index_and_check_are_in_the_catalog():
    c = await _conn()
    try:
        idx = await c.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' "
            "AND indexname = 'threads_mcp_origin_ref_idx'"
        )
        assert idx is not None and "(origin_ref)" in idx and "'mcp'" in idx
        check = await c.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conname = 'threads_origin_kind_check'"
        )
        assert check is not None and all(f"'{k}'" in check for k in ("app", "schedule", "key", "mcp"))
    finally:
        await c.close()


# ── the four knobs (T-306-26) ───────────────────────────────────────────────────────────────


async def test_the_four_knobs_read_their_defaults_on_the_existing_row():
    c = await _conn()
    try:
        row = await c.fetchrow(
            "SELECT " + ", ".join(KNOB_DEFAULTS) + " FROM public.app_settings LIMIT 1"
        )
        assert row is not None, "no app_settings row"
        assert dict(row) == KNOB_DEFAULTS
    finally:
        await c.close()


@pytest.mark.parametrize("col,bad,good", [
    ("mcp_ask_wait_seconds", 46, 45),
    ("mcp_ask_wait_seconds", 4, 5),
    ("outside_inflight_per_key", 0, 1),
    ("outside_inflight_per_org", 51, 50),
    ("outside_inflight_per_provider", 0, 50),
])
async def test_a_knob_out_of_bounds_is_refused(col, bad, good):
    import asyncpg

    c = await _conn()
    try:
        with pytest.raises(asyncpg.CheckViolationError):
            async with c.transaction():
                await c.execute(f"UPDATE public.app_settings SET {col} = $1", bad)
        try:
            async with c.transaction():
                status = await c.execute(f"UPDATE public.app_settings SET {col} = $1", good)
                assert status.startswith("UPDATE ") and status != "UPDATE 0"
                raise _Rollback
        except _Rollback:
            pass
        assert await c.fetchval(f"SELECT {col} FROM public.app_settings LIMIT 1") == KNOB_DEFAULTS[col]
    finally:
        await c.close()


# ── the function ACL (T-306-23) ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("role,expected", [
    ("anon", False), ("authenticated", False), ("service_role", True),
])
async def test_only_the_service_role_may_execute_the_trigger_function(role, expected):
    c = await _conn()
    try:
        assert await c.fetchval(
            "SELECT has_function_privilege($1, $2, 'EXECUTE')", role, FN
        ) is expected
    finally:
        await c.close()
