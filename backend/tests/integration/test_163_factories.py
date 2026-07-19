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


# ── LIVE two-user/two-org proofs are appended in Task 2 (below) ─────────────────
