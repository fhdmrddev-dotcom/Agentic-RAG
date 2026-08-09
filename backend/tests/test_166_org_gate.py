"""Phase 166 (ADMIN-01/02/04) — org authz regression suite.

THE security-critical assertions for the phase's threat model:
  - T-166-01 (Spoofing): an ``X-Org-Id`` header for an org the caller is NOT a member of
    is rejected 403 — never trusted (get_active_org_id's org_members lookup returns None).
  - T-166-02 (Elevation): ``GET /org/members`` is default-deny — a caller without
    ``org:manage`` gets 403.
  - T-166-03 (Information Disclosure): ``GET /org/audit`` degrades honestly by
    ``org:audit_view`` — False → scope="own" + a ``.eq("user_id", caller)`` filter (never
    another member's rows); True → scope="all" + NO user_id filter beyond the org.
  - ADMIN-02: ``GET /org/me`` returns can_manage / can_audit_view booleans + memberships[].

Test seams (the operator-gate precedent, test_146_operator_gate.py):
  - ``get_current_user`` is conftest-overridden to a fake identity (mock_user_data).
  - ``app.dependencies._pg_pool`` → mock_asyncpg_pool drives get_active_org_id's org_members
    membership lookup (``set_fetchrow_result``) and the /org/me memberships fetch
    (``set_fetch_result``).
  - ``app.dependencies._has_org_permission`` is monkeypatched per-key so org:manage and
    org:audit_view can be set INDEPENDENTLY (require_org_manage + the audit branch both read
    the same module-global seam).
  - ``org._get_org_audit_supabase`` is overridden with a query-builder spy so the audit test
    asserts the ``.eq`` chain (org_id always; user_id only on the own-only branch).
"""
from types import SimpleNamespace

from app.main import app
from app.api import org

# Matches conftest.mock_user_data (the get_current_user override identity).
CALLER_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
SECOND_ORG = "22222222-2222-2222-2222-222222222222"
SPOOF_ORG = "99999999-9999-9999-9999-999999999999"

# A 2+-membership caller (the Phase-167 multi-org shape). The soft /org/me resolver reads
# rows[0] (org_id + role) as the default org; the /org/me memberships JOIN reads all three
# keys. One canned fetch result satisfies both reads (the mock returns it for every .fetch()).
MULTI_ORG_MEMBERSHIPS = [
    {"org_id": ACTIVE_ORG, "name": "Acme", "role": "org-admin"},
    {"org_id": SECOND_ORG, "name": "Beta", "role": "member"},
]


def _install_perms(monkeypatch, perms: dict):
    """Monkeypatch the single ``_has_org_permission`` seam to return per-key booleans.

    require_org_manage (org:manage) AND the /org/audit + /org/me branches (org:audit_view)
    all resolve this module-global, so one patch controls every permission decision.
    """
    async def _fake(request, current_user, org_id, permission_key):
        return perms.get(permission_key, False)

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


class _AuditSupabaseSpy:
    """Fluent supabase-py query-builder spy — records every ``.eq(col, val)`` call.

    Reused for both the count + data queries (each ``.table()`` returns self), so
    ``eq_calls`` accumulates the org_id predicate (always) and the user_id predicate (only on
    the own-only degrade branch). ``execute`` returns a JSON-serializable result.
    """

    def __init__(self):
        self.eq_calls: list[tuple] = []

    def table(self, _name):
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, col, val):
        self.eq_calls.append((col, val))
        return self

    def gte(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[], count=0)


def test_spoofed_x_org_id_is_rejected_403(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-166-01: an X-Org-Id for an org the caller does NOT belong to → 403 (never trusted)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    # get_active_org_id's org_members membership lookup returns NO row for the spoofed org.
    mock_asyncpg_pool.set_fetchrow_result(None)

    res = client.get("/org/me", headers={**auth_headers, "X-Org-Id": SPOOF_ORG})

    assert res.status_code == 403, res.text


def test_members_default_deny_without_org_manage(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-166-02 / ADMIN-01: GET /org/members without org:manage → 403 (default-deny)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    # The caller IS a member of the active org (get_active_org_id passes) ...
    mock_asyncpg_pool.set_fetchrow_result({"role": "member"})
    # ... but holds NO org:manage → require_org_manage refuses.
    _install_perms(monkeypatch, {"org:manage": False})

    res = client.get("/org/members", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 403, res.text


def test_audit_own_only_when_no_audit_view(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-166-03 / ADMIN-04: no org:audit_view → scope="own" + a .eq("user_id", caller) filter."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})  # member (get_active_org_id passes)
    # Manager (reaches the endpoint) but WITHOUT the cross-member audit read.
    _install_perms(monkeypatch, {"org:manage": True, "org:audit_view": False})

    spy = _AuditSupabaseSpy()
    monkeypatch.setitem(app.dependency_overrides, org._get_org_audit_supabase, lambda: spy)

    res = client.get("/org/audit", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    assert res.json()["scope"] == "own"
    # The load-bearing ADMIN-04 filter: the caller's own rows only, never another member's.
    assert ("user_id", CALLER_ID) in spy.eq_calls, spy.eq_calls
    assert ("org_id", ACTIVE_ORG) in spy.eq_calls, spy.eq_calls


def test_audit_all_org_rows_when_audit_view(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-166-03 / ADMIN-04: org:audit_view → scope="all" + NO user_id filter beyond the org."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})
    _install_perms(monkeypatch, {"org:manage": True, "org:audit_view": True})

    spy = _AuditSupabaseSpy()
    monkeypatch.setitem(app.dependency_overrides, org._get_org_audit_supabase, lambda: spy)

    res = client.get("/org/audit", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    assert res.json()["scope"] == "all"
    assert ("org_id", ACTIVE_ORG) in spy.eq_calls, spy.eq_calls
    # Cross-member read: NO own-only user_id predicate.
    assert not any(col == "user_id" for col, _ in spy.eq_calls), spy.eq_calls


def test_org_me_bootstraps_multi_org_without_header(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """WR-01: a 2+-org caller with NO X-Org-Id header can still GET /org/me → 200 + memberships[].

    The switcher is delivered ONLY by /org/me; before WR-01 the router-level strict gate 400'd
    this exact call (absent header + 2+ memberships), a deadlock (the one read that seeds the
    header is the one that 400s). The soft resolver resolves the caller's default org instead.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    # No fetchrow (header-absent branch never calls it); the memberships fetch returns 2 rows.
    mock_asyncpg_pool.set_fetch_result(MULTI_ORG_MEMBERSHIPS)
    _install_perms(monkeypatch, {"org:manage": True, "org:audit_view": True})

    res = client.get("/org/me", headers=auth_headers)  # NO X-Org-Id header

    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["memberships"]) == 2, body
    # The soft resolver adopted the first membership (by created_at) as the default active org.
    assert body["org_id"] == ACTIVE_ORG, body


def test_members_still_400s_multi_org_without_header(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """WR-01 invariant: /org/members KEEPS the strict gate — a 2+-org caller with NO X-Org-Id
    header still 400s (default-deny unchanged; only /org/me relaxes to bootstrap the switcher)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    # get_active_org_id (via require_org_manage) header-absent branch: 2+ memberships → 400.
    mock_asyncpg_pool.set_fetch_result(MULTI_ORG_MEMBERSHIPS)
    _install_perms(monkeypatch, {"org:manage": True})

    res = client.get("/org/members", headers=auth_headers)  # NO X-Org-Id header

    assert res.status_code == 400, res.text


def test_org_me_returns_permissions_and_memberships(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """ADMIN-02: GET /org/me for a member → 200 with can_manage/can_audit_view + memberships[]."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "org-admin"})  # get_active_org_id membership
    # The /org/me handler's memberships fetch (org_members JOIN organizations).
    mock_asyncpg_pool.set_fetch_result(
        [{"org_id": ACTIVE_ORG, "name": "Acme", "role": "org-admin"}]
    )
    _install_perms(monkeypatch, {"org:manage": True, "org:audit_view": True})

    res = client.get("/org/me", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["org_id"] == ACTIVE_ORG
    assert body["can_manage"] is True
    assert body["can_audit_view"] is True
    assert isinstance(body["memberships"], list)
    assert body["memberships"][0]["name"] == "Acme"
