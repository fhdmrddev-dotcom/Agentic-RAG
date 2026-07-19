"""Phase 163 (TEN-01) — PLATFORM-UNIVERSAL cross-org RLS contract (FIX-A gap closure; RED until 109).

The cross-org COMPLEMENT to ``test_163_rls_skills.py`` — the same-org test that MISSED the 163-UAT
Test-7 regression. Migration 108 org-gated the preserved global / ``is_system`` OR-branch, so in the
post-162 solo-org topology the built-in ``skill-creator`` (``is_system=true``, owned by seed …0001)
and the seeded ``is_global`` starter workflows lost cross-user visibility. ``test_163_rls_skills.py``
only ever probes a SAME-ORG co-member, so it never observed the platform-content drop. This file
probes a genuine NON-CO-MEMBER (a member of a DIFFERENT org), which is where FIX-A must hold.

Assertions (RED until plan 163-11 Task 2 applies migration 109):
  (1) PLATFORM-UNIVERSAL READ — a non-co-member SEES an ``is_system=true`` skill (RED pre-109: the
      org-gate hides it → 0 rows; GREEN post-109: the is_system universal escape → 1).
  (2) PLATFORM WORKFLOW — a non-co-member SEES a seed-owned ``is_global=true`` workflow_definition.
  (3) USER is_global STAYS ORG-SCOPED (invariant guard — GREEN in BOTH states) — a non-co-member does
      NOT see user A's OWN is_global skill, A's is_global FOLDER, or a DOCUMENT inside that global
      folder (the composed folder_is_globally_visible path — 163-UAT Test-7 symptom two).
  (4) BADGE-SPOOF BLOCKED (T-163-11) — as user A (role authenticated, A's claims) an INSERT / UPDATE
      self-setting ``is_system=true`` is REJECTED by the write check (RED pre-109: the 108 checks omit
      is_system so the write succeeds; GREEN post-109: 42501). A plain ``is_system=false`` insert /
      owner update SUCCEEDS (positive control — GREEN both states).
  (5) NON-VACUITY — the same non-co-member still SEES their OWN skill (the gate isn't all/nothing).

STATE: RED now (assertions 1/2/4 fail pre-109), GREEN after the operator applies 109. THIS plan
(163-11 Task 1) only needs ``--collect-only``. Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg

# The built-in skill-creator's owner (migration 087 / 018) — the system principal that owns all
# is_system / seeded platform content.
SYSTEM_SEED_UID = "00000000-0000-0000-0000-000000000001"

# SQLSTATE for "new row violates row-level security policy" — what a WITH CHECK rejection raises.
_RLS_VIOLATION_SQLSTATE = "42501"


# ── seed helpers (all run via the pool = postgres / BYPASSRLS, so RLS write checks don't gate them) ──

async def _ensure_system_seed_user(pool) -> None:
    """Ensure the system seed user exists so an is_system seed satisfies the skills.user_id FK.

    Idempotent (ON CONFLICT DO NOTHING); it is normally already present from migration 087. NEVER torn
    down — it is a shared system principal that owns the real built-in skill-creator.
    """
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        SYSTEM_SEED_UID, "seed@system.local",
    )


async def _seed_system_skill(pool, org_id: str) -> str:
    """Seed an ``is_system=true`` skill owned by the system seed, in org ``org_id`` (org X).

    Mirrors the real skill-creator (is_system=true + is_global=true). org_id is provided explicitly so
    the mig-106 autofill trigger no-ops (the system seed has no org membership to resolve).
    """
    sid = uuid4()
    await pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_system, is_global) "
        "VALUES ($1, $2, $3, $4, true, true)",
        sid, SYSTEM_SEED_UID, org_id, f"163-systemskill-{sid}",
    )
    return str(sid)


async def _seed_platform_workflow(pool, org_id: str) -> str:
    """Seed a seed-owned ``is_global=true`` published workflow_definition in org ``org_id`` (org X).

    Owner column is ``created_by`` (workflow_definitions special case). org_id explicit -> trigger no-op.
    """
    wid = uuid4()
    await pool.execute(
        "INSERT INTO public.workflow_definitions "
        "(id, slug, name, created_by, org_id, is_global, status) "
        "VALUES ($1, $2, $3, $4, $5, true, 'published')",
        wid, f"163-plat-{wid}", f"163-platform-workflow-{wid}", SYSTEM_SEED_UID, org_id,
    )
    return str(wid)


async def _cleanup(pool, sql: str, arg) -> None:
    try:
        await pool.execute(sql, arg)
    except Exception:  # teardown is best-effort — never fail a test on cleanup
        pass


# ── (1) platform-universal READ — a non-co-member sees the is_system built-in ──

@pytest.mark.asyncio
async def test_platform_is_system_skill_visible_to_non_comember(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _ensure_system_seed_user(pg_pool)
    sys_skill = await _seed_system_skill(pg_pool, a["org_id"])  # in org X; B is a non-co-member (org Y)
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            seen = await conn.fetchval(
                "SELECT count(*) FROM public.skills WHERE id = $1", sys_skill
            )
        assert seen == 1, (
            "FIX-A regression (163-UAT Test 7): a non-co-member cannot see the is_system built-in "
            "skill-creator. The is_system universal escape must lift it OUTSIDE the org-gate "
            "(RED until migration 109 is applied)."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", sys_skill)


# ── (2) platform workflow — a non-co-member sees a seed-owned is_global workflow_definition ──

@pytest.mark.asyncio
async def test_platform_global_workflow_visible_to_non_comember(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _ensure_system_seed_user(pg_pool)
    wid = await _seed_platform_workflow(pg_pool, a["org_id"])
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            seen = await conn.fetchval(
                "SELECT count(*) FROM public.workflow_definitions WHERE id = $1", wid
            )
        assert seen == 1, (
            "FIX-A regression: a seeded is_global platform workflow is invisible cross-org. is_global "
            "on workflow_definitions is hard-set-false-for-users, so is_global=true is platform-only "
            "and must escape the org-gate (RED until migration 109)."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.workflow_definitions WHERE id = $1", wid)


# ── (3) USER-self-served is_global STAYS org-scoped (invariant guard — GREEN in BOTH states) ──

@pytest.mark.asyncio
async def test_user_is_global_skill_stays_org_scoped(pg_pool, two_orgs_two_users):
    """A user's OWN is_global skill (owner-toggled, org-shared) must NOT leak to a non-co-member.

    Fix A deliberately keeps skills.is_global INSIDE the org-gate — it becomes cross-user-visible only
    when orgs gain members (Phases 166/167). Holds pre AND post-109 (this is the over-widening guard).
    """
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    own_global_skill = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_global) VALUES ($1, $2, $3, $4, true)",
        own_global_skill, a["uid"], a["org_id"], f"163-ownglobal-{own_global_skill}",
    )
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            seen = await conn.fetchval(
                "SELECT count(*) FROM public.skills WHERE id = $1", str(own_global_skill)
            )
        assert seen == 0, (
            "over-widening: Fix A leaked user A's ORG-scoped is_global skill to a non-co-member. Only "
            "is_system (platform) escapes the gate; user-self-served skills.is_global stays org-scoped."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", str(own_global_skill))


@pytest.mark.asyncio
async def test_user_global_folder_and_its_document_stay_org_scoped(pg_pool, two_orgs_two_users):
    """A user's is_global FOLDER — and a DOCUMENT inside it — must NOT leak to a non-co-member.

    The composed ``folder_is_globally_visible`` path on documents is 163-UAT Test-7 symptom two. Fix A
    leaves the documents + folders read policies UNCHANGED (user-self-served, org-scoped), so this holds
    pre AND post-109. Guards against Fix A accidentally widening the folder-derived document branch.
    """
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    global_folder = uuid4()
    doc_in_folder = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_global) VALUES ($1, $2, $3, $4, true)",
        global_folder, a["uid"], a["org_id"], f"163-globalfolder-{global_folder}",
    )
    await pg_pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
        "file_size, mime_type, status, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 1)",
        doc_in_folder, a["uid"], a["org_id"], global_folder, f"163-{doc_in_folder}.txt",
        f"{a['uid']}/{doc_in_folder}.txt", 100, "text/plain", "completed",
    )
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            sees_folder = await conn.fetchval(
                "SELECT count(*) FROM public.folders WHERE id = $1", str(global_folder)
            )
            sees_doc = await conn.fetchval(
                "SELECT count(*) FROM public.documents WHERE id = $1", str(doc_in_folder)
            )
        assert sees_folder == 0, (
            "over-widening: user A's is_global FOLDER leaked to a non-co-member (folders.is_global is "
            "user-self-served and must stay org-scoped under Fix A)."
        )
        assert sees_doc == 0, (
            "over-widening: a document inside user A's global folder leaked cross-org via the composed "
            "folder_is_globally_visible path (163-UAT Test-7 symptom two — must stay org-scoped)."
        )
    finally:
        # children before parent (documents FK folders); best-effort.
        await _cleanup(pg_pool, "DELETE FROM public.documents WHERE id = $1", str(doc_in_folder))
        await _cleanup(pg_pool, "DELETE FROM public.folders WHERE id = $1", str(global_folder))


# ── (4) badge-spoof blocked (T-163-11) — self-set is_system=true is REJECTED on INSERT and UPDATE ──

@pytest.mark.asyncio
async def test_badge_spoof_is_system_insert_rejected(pg_pool, two_orgs_two_users):
    a = two_orgs_two_users["a"]
    spoof = uuid4()
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, a["uid"])
            await assert_auth_uid(conn, a["uid"])
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(
                    "INSERT INTO public.skills (id, user_id, org_id, name, is_system) "
                    "VALUES ($1, $2, $3, $4, true)",
                    spoof, a["uid"], a["org_id"], f"163-spoof-ins-{spoof}",
                )
            assert exc.value.sqlstate == _RLS_VIOLATION_SQLSTATE, (
                f"expected an RLS write-check violation ({_RLS_VIOLATION_SQLSTATE}), got "
                f"{exc.value.sqlstate!r}. An authenticated user self-setting is_system=true on INSERT "
                "must be REJECTED (T-163-11 badge-spoof; RED until migration 109)."
            )
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_badge_spoof_is_system_update_rejected(pg_pool, two_orgs_two_users):
    a = two_orgs_two_users["a"]
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, a["uid"])
            await assert_auth_uid(conn, a["uid"])
            with pytest.raises(asyncpg.PostgresError) as exc:
                # A owns this skill (USING passes) so the row IS modifiable; the write check on the
                # NEW row (is_system=true) is what must reject it.
                await conn.execute(
                    "UPDATE public.skills SET is_system = true WHERE id = $1", a["skill_id"]
                )
            assert exc.value.sqlstate == _RLS_VIOLATION_SQLSTATE, (
                f"expected an RLS write-check violation ({_RLS_VIOLATION_SQLSTATE}), got "
                f"{exc.value.sqlstate!r}. Self-setting is_system=true on UPDATE of an owned skill must "
                "be REJECTED (T-163-11 badge-spoof; RED until migration 109)."
            )
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_plain_is_system_false_write_succeeds(pg_pool, two_orgs_two_users):
    """Positive control (GREEN both states) — the T-163-11 hardening is NOT over-broad: a plain
    ``is_system=false`` INSERT and a plain owner UPDATE (no is_system change) by the owner succeed."""
    a = two_orgs_two_users["a"]
    ins = uuid4()
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, a["uid"])
            await assert_auth_uid(conn, a["uid"])
            row = await conn.fetchrow(
                "INSERT INTO public.skills (id, user_id, org_id, name, is_system) "
                "VALUES ($1, $2, $3, $4, false) RETURNING id",
                ins, a["uid"], a["org_id"], f"163-plain-ins-{ins}",
            )
            assert row is not None, (
                "a plain is_system=false INSERT by the owner was blocked — the T-163-11 write check is "
                "too broad (it must reject ONLY is_system=true)."
            )
            updated = await conn.fetch(
                "UPDATE public.skills SET name = name WHERE id = $1 RETURNING id", a["skill_id"]
            )
            assert len(updated) == 1, (
                "a plain owner UPDATE (no is_system change) was blocked — the T-163-11 write check is "
                "too broad."
            )
        finally:
            await tx.rollback()  # neither op is persisted; we only assert they are not rejected


# ── (5) non-vacuity — the non-co-member still sees their OWN skill (gate isn't all/nothing) ──

@pytest.mark.asyncio
async def test_non_comember_still_sees_own_skills(pg_pool, two_orgs_two_users):
    b = two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])
        own = await conn.fetchval(
            "SELECT count(*) FROM public.skills WHERE id = $1", b["skill_id"]
        )
    assert own == 1, (
        "non-vacuity failure: user B cannot see their OWN skill — the corrected gate is returning "
        "nothing (a broken gate would false-green the platform-universal read assertions)."
    )
