"""Phase 163 (TEN-01) — IDENTITY-AUDIT cluster membership-RLS contract (RED until plan 163-05).

Cluster tables (2): profiles, audit_log — the two special cases of the rewrite.

  * profiles — has NO org_id column (verified live at head 107; mig 104 excluded it as the identity row
    keyed by id = auth.uid()). Its policies keep the OWNER branch ONLY (auth.uid() = id) — a membership
    prefix would reference a non-existent column and abort the whole migration at apply. This is a
    documented DEVIATION from the plan's action prose (see 108 header + 163-03-SUMMARY): the load-bearing
    must-have is "profiles uses id", which this file pins.
  * audit_log — insert-only for authenticated callers; its INSERT WITH CHECK carries an explicit
    ``org_id IS NULL`` branch (D-10) so genuinely org-agnostic operator/system audit rows are never
    rejected, in addition to the membership branch.

Assertions:
  (a) CROSS-ORG / cross-user ISOLATION (behavioral) — user B reads ZERO of user A's profile row
      (auth.uid() = id — byte-identical self-only isolation, preserved through the rewrite).
  (b) profiles SPECIAL (structural) — profiles predicates reference the ``id`` owner and DO NOT
      reference ``current_user_org_ids`` (no org_id column → no membership macro, by design).
  (c) audit_log MEMBERSHIP + NULL branch (structural) — audit_log's WITH CHECK references
      ``current_user_org_ids`` (RED→GREEN membership proof) AND carries an explicit ``org_id IS NULL``
      branch (D-10).

STATE: RED now (audit_log membership + NULL-branch asserts fail on the pre-163 policy), GREEN after
plan 163-05. THIS plan only needs ``--collect-only``. Skip-guarded on local Postgres :54322.
"""
from __future__ import annotations

import pytest

from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg


async def _policy_text(pool, table: str) -> str:
    rows = await pool.fetch(
        "SELECT COALESCE(qual, '') AS qual, COALESCE(with_check, '') AS with_check "
        "FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        table,
    )
    return "\n".join(f"{r['qual']} {r['with_check']}" for r in rows)


# ── (a) cross-user isolation on profiles (auth.uid() = id, preserved through the rewrite) ──

@pytest.mark.asyncio
async def test_cross_user_cannot_read_other_profile(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])
        seen = await conn.fetchval(
            "SELECT count(*) FROM public.profiles WHERE id = $1", a["uid"]
        )
    assert seen == 0, "leak: user B can see user A's profile row (profiles is self-only: auth.uid() = id)"


# ── (b) profiles SPECIAL — owner-only, NO membership macro (documents the deviation) ──

@pytest.mark.asyncio
async def test_profiles_is_owner_only_no_membership_macro(pg_pool):
    text = await _policy_text(pg_pool, "profiles")
    assert text.strip(), "profiles has no RLS policies at all — expected 3 owner-only policies"
    assert "current_user_org_ids" not in text, (
        "profiles must NOT carry the membership macro — it has no org_id column (Rule 1/3 deviation): "
        "a membership predicate would reference a non-existent column and abort the migration at apply."
    )
    assert "id" in text, "profiles must key ownership off id (= auth.uid())"


# ── (c) audit_log — membership proof (RED→GREEN) + explicit NULL branch (D-10) ──

@pytest.mark.asyncio
async def test_audit_log_enforces_membership(pg_pool):
    text = await _policy_text(pg_pool, "audit_log")
    assert "current_user_org_ids" in text, (
        "audit_log WITH CHECK does not reference current_user_org_ids — migration 108 not applied "
        "(expected RED until plan 163-05)."
    )


@pytest.mark.asyncio
async def test_audit_log_has_explicit_null_org_branch(pg_pool):
    text = await _policy_text(pg_pool, "audit_log")
    assert "org_id IS NULL" in text, (
        "audit_log must carry an explicit `org_id IS NULL` branch (D-10) so genuinely org-agnostic "
        "operator/system audit rows are not rejected by the membership predicate."
    )
