"""Phase 163 (TEN-02 / D-08) — the asyncpg two-user, two-org LEAK CORE (RED until 163-05 applies 107+108).

The mechanism-level proof that the crux's RLS isolates on the asyncpg path BEFORE any
app-wide router swap: two seeded users in two DISJOINT orgs, driven through the SHIPPED
role-first + both-GUC-forms context (``_apply_rls_user_context`` via the harness), asserting
user B reads / updates / deletes ZERO of user A's rows across a representative table set.

The four non-negotiable design invariants (RESEARCH §"The Live Two-User Leak Test Design"):
  * FAIL-LOUD PREFLIGHT FIRST — each user's FIRST assertion is ``assert_auth_uid`` (step 2):
    a NULL ``auth.uid()`` (wrong GUC variant / forgotten role swap) would false-PASS an
    isolation check at "0 rows", so the preflight raises BEFORE any isolation assert runs.
  * POSITIVE CONTROL (step 3) — user B CAN read user B's own rows (>0), so an over-restricting
    harness fails loudly instead of false-greening at 0-for-everyone.
  * ISOLATION (step 4) — id-scoped ``count`` / ``UPDATE`` / ``DELETE`` of the OTHER user's
    rows == 0, across ``documents / folders / threads / skills`` (+ owner-scoped
    ``messages / user_memory``).
  * GUC-VARIANT ARBITRATION (step 7 / D-02) — parameterized over legacy-only / JSON-only /
    both, recording which make ``auth.uid()`` resolve on THIS DB; ``both`` is the shipped,
    D-11-portable default and must resolve.

STATE CONTRACT: RED *now* — GREEN after plan 163-05 applies 107 then 108. For THIS plan the
bar is ``pytest ... --collect-only`` (imports resolve) — do NOT try to make it pass here.
Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

import json
from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import (
    assert_auth_uid,
    open_user_conn,
    requires_pg,
)

pytestmark = requires_pg


# The representative SEEDED table set — the fixture seeds each user ONE owned row per table
# and records its id, so both the positive control (own row == 1) and the isolation assert
# (id-scoped == 0 of the other user's row) are EXACT, not merely "count didn't grow".
_SEEDED_TABLES = (
    ("documents", "doc_id"),
    ("folders", "folder_id"),
    ("threads", "thread_id"),
    ("skills", "skill_id"),
)

# Representative tables the fixture seeds NO positive in — isolation is proven owner-scoped
# (0 of the other user's rows) and guarded on table presence so a lean DB skips, not errors.
_UNSEEDED_TABLES = ("messages", "user_memory")

_GUC_VARIANTS = ("legacy", "json", "both")

# Behavioral D-02 arbitration record: which GUC form(s) make auth.uid() resolve on THIS DB.
GUC_RESOLUTION: dict[str, bool] = {}


async def _apply_rls_variant(conn, uid: str, variant: str) -> None:
    """Role swap + a SELECTABLE subset of the two GUC forms (D-02 arbitration only).

    ``both`` is exactly what the shipped ``_apply_rls_user_context`` sets; ``legacy`` /
    ``json`` set a single form so the test can RECORD which one THIS DB's ``auth.uid()``
    reads. The role swap is ALWAYS applied — without it RLS is a silent no-op (Pitfall 1).
    Parameterized, never string-interpolated (SQLi).
    """
    await conn.execute("SET LOCAL ROLE authenticated")
    if variant in ("legacy", "both"):
        await conn.execute(
            "SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid)
        )
    if variant in ("json", "both"):
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",
            json.dumps({"sub": str(uid), "role": "authenticated"}),
        )


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _assert_isolated(pool, viewer: dict, other: dict) -> None:
    """As ``viewer`` (role + both GUC forms): fail-loud preflight FIRST, then positive
    control (own row visible), then isolation (0 of ``other``'s seeded row) per table.

    The preflight is the FIRST assertion on this connection so a NULL ``auth.uid()`` can
    never let an isolation check false-pass at "0 rows".
    """
    async with open_user_conn(pool, viewer["uid"]) as conn:
        # (2) FAIL-LOUD PREFLIGHT — MUST precede every isolation assertion on this conn.
        await assert_auth_uid(conn, viewer["uid"])

        for table, id_key in _SEEDED_TABLES:
            # (3) POSITIVE CONTROL — viewer sees its OWN row (an over-restricting harness
            # that returns 0-for-everyone fails loudly HERE instead of false-greening).
            own = await conn.fetchval(
                f"SELECT count(*) FROM public.{table} WHERE id = $1", viewer[id_key]
            )
            assert own == 1, (
                f"positive-control failure: {viewer['uid']} cannot see its OWN {table} "
                f"row {viewer[id_key]} — the harness over-restricts (a 0-for-everyone bug "
                f"would false-green the isolation assertion below)."
            )
            # (4) ISOLATION — viewer sees 0 of the OTHER user's row on this table.
            leaked = await conn.fetchval(
                f"SELECT count(*) FROM public.{table} WHERE id = $1", other[id_key]
            )
            assert leaked == 0, (
                f"cross-org leak: {viewer['uid']} can read {other['uid']}'s {table} "
                f"row {other[id_key]} (their orgs are disjoint)."
            )


# ── (4) isolation — read, both directions (two-user non-vacuity) ──

@pytest.mark.asyncio
async def test_asyncpg_user_b_reads_zero_of_user_a(pg_pool, two_orgs_two_users):
    """User B (Org Y) reads 0 of user A's (Org X) rows across the seeded table set —
    fail-loud-preflighted and positive-controlled."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _assert_isolated(pg_pool, viewer=b, other=a)


@pytest.mark.asyncio
async def test_asyncpg_user_a_reads_zero_of_user_b(pg_pool, two_orgs_two_users):
    """Symmetric direction — user A reads 0 of user B's rows (so a one-way bug can't hide)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _assert_isolated(pg_pool, viewer=a, other=b)


# ── (4) isolation — write (UPDATE / DELETE of A's rows affect 0; always rolled back) ──

@pytest.mark.asyncio
async def test_asyncpg_cross_org_write_affects_zero_rows(pg_pool, two_orgs_two_users):
    """As user B, an UPDATE and a DELETE targeting user A's rows each affect 0 rows — RLS
    blocks the WRITE path too, not only reads. Runs in a transaction that is ALWAYS rolled
    back so the seeded corpus is never mutated even if a leak makes a row match."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, b["uid"])
            await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
            for table, id_key in _SEEDED_TABLES:
                updated = await conn.fetch(
                    f"UPDATE public.{table} SET user_id = user_id WHERE id = $1 RETURNING id",
                    a[id_key],
                )
                assert len(updated) == 0, (
                    f"cross-org write leak: user B updated user A's {table} row {a[id_key]}"
                )
                deleted = await conn.fetch(
                    f"DELETE FROM public.{table} WHERE id = $1 RETURNING id", a[id_key]
                )
                assert len(deleted) == 0, (
                    f"cross-org write leak: user B deleted user A's {table} row {a[id_key]}"
                )
        finally:
            await tx.rollback()  # never mutate the seeded corpus


# ── (4) isolation extends to representative tables with no seeded positive ──

@pytest.mark.asyncio
async def test_asyncpg_isolation_extends_to_unseeded_tables(pg_pool, two_orgs_two_users):
    """Isolation holds on representative tables the fixture seeds no positive in
    (``messages`` / ``user_memory``): as user B, 0 rows OWNED by user A are visible.
    Guarded on table presence so a DB missing them skips rather than errors."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    present = [t for t in _UNSEEDED_TABLES if await _table_exists(pg_pool, t)]
    if not present:
        pytest.skip("neither messages nor user_memory present on this DB")
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        for table in present:
            leaked = await conn.fetchval(
                f"SELECT count(*) FROM public.{table} WHERE user_id = $1", a["uid"]
            )
            assert leaked == 0, (
                f"cross-org leak: user B can see user A's {table} rows"
            )


# ── (7) GUC-variant arbitration (D-02 deliverable) — behavioral ──

@pytest.mark.asyncio
@pytest.mark.parametrize("variant", _GUC_VARIANTS)
async def test_guc_variant_arbitration(pg_pool, two_orgs_two_users, variant):
    """D-02: apply the role swap + ONE GUC-form subset and RECORD whether ``auth.uid()``
    resolves on THIS DB. ``both`` is the shipped, D-11-portable default and MUST resolve;
    ``legacy`` / ``json`` are DB-dependent (recorded, not hard-asserted) — but IF a variant
    resolves it must resolve to the CORRECT uid (never a stale / other id)."""
    b = two_orgs_two_users["b"]
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_variant(conn, b["uid"], variant)
            got = await conn.fetchval("SELECT auth.uid()")
    resolves = got is not None and str(got) == b["uid"]
    GUC_RESOLUTION[variant] = resolves
    print(f"[GUC-ARBITRATION] variant={variant} resolves={resolves} auth_uid={got}")
    if got is not None:
        assert str(got) == b["uid"], (
            f"variant {variant}: auth.uid()={got} != expected {b['uid']} — wrong claim resolved"
        )
    if variant == "both":
        assert resolves, (
            "the shipped both-GUC-forms variant must resolve auth.uid() on this DB — it is "
            "the D-11-portable default get_user_pg_connection sets unconditionally."
        )


# ── (7) GUC-variant arbitration — structural (what the DB's auth.uid() body reads) ──

@pytest.mark.asyncio
async def test_structural_guc_variant_recorded(auth_uid_variant):
    """Record the STRUCTURAL side of the arbitration: which GUC form(s) THIS DB's
    ``auth.uid()`` function body references. Pairs with the behavioral record above;
    together they are the D-02 deliverable. The DB must read at least one known form,
    else the SET-LOCAL claims could never resolve."""
    print(
        f"[GUC-STRUCTURAL] reads_legacy={auth_uid_variant['reads_legacy']} "
        f"reads_json={auth_uid_variant['reads_json']}"
    )
    assert auth_uid_variant["reads_legacy"] or auth_uid_variant["reads_json"], (
        "auth.uid() references neither request.jwt.claim.sub nor request.jwt.claims — "
        "unknown GUC shape; the SET LOCAL claims would never resolve to a uid."
    )
