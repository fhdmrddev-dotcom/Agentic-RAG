"""Phase 163-01 — smoke tests for the three Front-B DB-context factories.

The atomic-crux seam (TEN-01/TEN-02): turn a validated request identity into an
RLS-ENFORCED DB context. The factories are ADDITIVE + dead-until-wired (Wave-4
swaps the router `Depends` seams onto them); this file proves their CONTRACTS.

Two layers:
  * UNIT (Task 1, no live DB) — the factories exist; get_service_role_supabase
    REFUSES a missing org; get_user_supabase builds a per-request ANON-key client
    WITHOUT mutating the shared service-role singleton (Pitfall 2).
  * LIVE (Task 2, skip-guarded on Postgres :54322) — get_user_pg_connection yields
    a connection reporting `current_user = authenticated` (the role swap took
    effect — a bare-claims conn would report `postgres`) AND `auth.uid() = <uid>`
    (claims resolve on THIS DB). Plus the two-user/two-org non-vacuity proof.
"""
import pytest

from app.dependencies import (
    get_service_role_supabase,
    get_supabase,
    get_user_pg_connection,
    get_user_supabase,
)


# ── UNIT: factory contracts (no live DB) ───────────────────────────────────────

def test_factory_symbols_exist_and_are_callable():
    """All three Front-B factories are importable + callable (the contract Wave-4 consumes)."""
    assert callable(get_user_pg_connection)
    assert callable(get_user_supabase)
    assert callable(get_service_role_supabase)


@pytest.mark.parametrize("bad_org", ["", None])
def test_get_service_role_supabase_refuses_missing_org(bad_org):
    """D-05: a BYPASSRLS client must NEVER be constructed without an explicit org scope."""
    with pytest.raises(ValueError):
        get_service_role_supabase(bad_org)


def test_get_service_role_supabase_returns_client_for_explicit_org():
    """With an explicit org it returns a service-role (BYPASSRLS) client — retained for
    the four async writers + legitimate cross-tenant ops."""
    from app.config import settings

    client = get_service_role_supabase("11111111-1111-1111-1111-111111111111")
    assert client is not None
    assert client.supabase_key == settings.supabase_service_role_key


def test_get_user_supabase_uses_anon_key_and_never_mutates_singleton(monkeypatch):
    """D-03: get_user_supabase builds a NEW per-request client with the ANON key (NOT
    service_role → RLS is ENFORCED) and leaves the shared get_supabase() singleton
    untouched (no `.postgrest.auth()` mutation → no cross-request identity bleed)."""
    import app.dependencies as deps

    monkeypatch.setattr(deps.settings, "supabase_anon_key", "anon-sentinel-key")
    monkeypatch.setattr(deps.settings, "supabase_service_role_key", "service-role-sentinel-key")

    singleton = get_supabase()  # materialize the shared service-role singleton
    singleton_key_before = singleton.supabase_key

    client = get_user_supabase(None, {"id": "u-1"}, "user-jwt-token")

    # per-request client built with the ANON key, distinct from the service_role key
    assert client.supabase_key == "anon-sentinel-key"
    assert client.supabase_key != deps.settings.supabase_service_role_key
    # the shared singleton is a DIFFERENT object AND is byte-unchanged (Pitfall 2)
    assert client is not singleton
    assert get_supabase() is singleton
    assert singleton.supabase_key == singleton_key_before


# ── LIVE two-user/two-org proofs (skip-guarded on Postgres :54322) ──────────────

from tests.integration._rls_harness import assert_auth_uid, requires_pg


@requires_pg
async def test_get_user_pg_connection_yields_authenticated_rls_context(two_orgs_two_users):
    """THE load-bearing proof (D-02 / T-163-01): get_user_pg_connection yields a
    connection reporting ``current_user = authenticated`` (the role swap took effect —
    a bare-claims connection would still be ``postgres`` and BYPASS RLS) AND
    ``auth.uid() = <passed uid>`` (both GUC forms resolve on THIS live DB)."""
    uid_a = two_orgs_two_users["a"]["uid"]

    async with get_user_pg_connection(None, {"id": uid_a}) as conn:
        current_role = await conn.fetchval("SELECT current_user")
        assert current_role == "authenticated", (
            f"role swap failed: current_user={current_role!r} — BYPASSRLS was NOT dropped, "
            "so RLS would be a silent no-op (Pitfall 1)"
        )
        # fail-loud preflight: a NULL/mismatched auth.uid() raises instead of false-passing.
        resolved = await assert_auth_uid(conn, uid_a)
        assert str(resolved) == uid_a


@requires_pg
async def test_two_orgs_two_users_seed_is_non_vacuous_and_disjoint(two_orgs_two_users):
    """Non-vacuity + isolation precondition: both users own >=1 real row in a shared
    table type, and the two users live in DISJOINT orgs (so a later leak test cannot
    false-green on an all-empty DB, and org-scoped isolation is meaningful)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]

    # both users own real positives across the representative table set
    for user in (a, b):
        assert user["doc_id"] and user["folder_id"] and user["thread_id"] and user["skill_id"]

    # the two users are in DIFFERENT orgs
    assert a["org_id"] != b["org_id"], "the two seeded users must be in disjoint orgs"
    assert a["uid"] != b["uid"]


@requires_pg
async def test_auth_uid_variant_probe_reads_a_resolvable_form(auth_uid_variant):
    """The auth.uid() live-variant probe records a GUC form THIS DB can resolve, so
    setting BOTH forms in get_user_pg_connection is guaranteed to make auth.uid()
    non-NULL here (D-02 — variant-independent by construction)."""
    assert auth_uid_variant["definition"], "pg_get_functiondef(auth.uid()) returned empty"
    assert auth_uid_variant["reads_legacy"] or auth_uid_variant["reads_json"], (
        "auth.uid() reads NEITHER GUC form on this DB — the leak tests could not resolve "
        "an identity; investigate before shipping"
    )
