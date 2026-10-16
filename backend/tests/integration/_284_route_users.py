"""Phase 284 (284-04, D-10 / D-18 / R-02) — callers with REAL GoTrue JWTs for the saved-view route suites.

WHY THIS EXISTS. The Phase 113/114 resolve suites drove ``resolve_view`` / ``resolve_adhoc`` with the
SERVICE-ROLE client and proved the route's per-caller scoping in Python (the two legs). Since 284 the
routes read migration 207's ``public.library_documents``, a ``security_invoker`` view keyed on
``auth.uid()`` — and ``auth.uid()`` is NULL for the service role, so it reads ZERO rows (fail-closed,
by design). A route suite run through the service role therefore proves nothing about the route
(RESEARCH anti-pattern: "a test that passes through the service role proves nothing", D-18). These
helpers give each suite's callers a real user client, so the same assertions now run through
PostgREST + RLS exactly as production does.

  * ``RouteUsers.create(label)`` → a GoTrue admin-created, e-mail-confirmed user (the signup trigger
    provisions their personal org, and ``autofill_org_id_by_owner`` stamps that org on every document
    and folder the suite seeds for them), signed in; returns its ``uuid.UUID`` and registers the
    client under it.
  * ``RouteUsers.client(uid)`` → that user's RLS-enforced client (anon key + Bearer token).
  * ``RouteUsers.join_org_of(member, owner)`` → ``member`` joins ``owner``'s personal org, for the
    cross-user cases whose ORG-SHARED folder must be visible to the other user (org sharing is
    org-scoped under RLS; the pre-284 service-role suites never had to say so).
  * ``RouteUsers.drop_all()`` → deletes every row the suites seed for those users, the users and
    their personal orgs.

Local stack only (callers skip via ``require_gotrue``). Writes only throwaway rows it cleans up.
"""
from __future__ import annotations

from uuid import UUID, uuid4

from supabase import Client, create_client

from tests.integration._271_gotrue_users import _admin, _local_env, require_gotrue, user_client

#: uid → that user's client, for every live ``RouteUsers`` (so a suite can write ``as_user(uid)``).
_REGISTRY: dict[str, Client] = {}


def as_user(uid) -> Client:
    """The RLS-enforced client of a user made by a live ``RouteUsers`` (KeyError otherwise)."""
    return _REGISTRY[str(uid)]


_CLEANUP = (
    "DELETE FROM public.documents WHERE user_id = $1",
    "DELETE FROM public.document_views WHERE user_id = $1",
    "DELETE FROM public.metadata_field_definitions WHERE user_id = $1",
    "DELETE FROM public.folders WHERE user_id = $1",
    "DELETE FROM public.audit_log WHERE user_id = $1",
)


class RouteUsers:
    """Real signed-in users for one test; ``drop_all`` tears every one of them down."""

    def __init__(self, pool):
        require_gotrue()
        self.pool = pool
        self._made: list[tuple[UUID, str]] = []  # (uid, email)
        self._clients: dict[str, Client] = {}

    async def create(self, label: str = "u") -> UUID:
        email = f"phase-284-route-{label}-{uuid4().hex[:10]}@test.local"
        password = "P284-" + uuid4().hex
        created = _admin().auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
        uid = UUID(str(created.user.id))
        self._made.append((uid, email))
        env = _local_env()
        anon = create_client(env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"])
        session = anon.auth.sign_in_with_password({"email": email, "password": password}).session
        assert session is not None and session.access_token, "GoTrue sign-in returned no session"
        self._clients[str(uid)] = _REGISTRY[str(uid)] = user_client(session.access_token)
        return uid

    def client(self, uid) -> Client:
        return self._clients[str(uid)]

    async def personal_org(self, uid) -> UUID:
        org = await self.pool.fetchval(
            "SELECT org_id FROM public.org_members WHERE user_id = $1 ORDER BY org_id LIMIT 1", UUID(str(uid))
        )
        assert org is not None, f"user {uid} has no org (the signup trigger did not run)"
        return org

    async def join_org_of(self, member, owner) -> None:
        """``member`` becomes a plain member of ``owner``'s personal org (org-shared folders are
        visible within an org only). Done before any token of ``member`` is used for a read that
        depends on it — RLS reads ``org_members`` per statement, so the existing token sees it."""
        await self.pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member') "
            "ON CONFLICT (org_id, user_id) DO NOTHING",
            await self.personal_org(owner), UUID(str(member)),
        )

    async def drop_all(self) -> None:
        admin = _admin()
        # 1. every row the suites seed, for every user (documents before folders: FK order).
        for uid, _email in self._made:
            for sql in _CLEANUP:
                try:
                    await self.pool.execute(sql, uid)
                except Exception:
                    pass
        # 2. every membership, then the users — so no org is still referenced in step 3.
        for uid, _email in self._made:
            try:
                await self.pool.execute("DELETE FROM public.org_members WHERE user_id = $1", uid)
            except Exception:
                pass
            try:
                admin.auth.admin.delete_user(str(uid))
            except Exception:
                pass
            try:
                await self.pool.execute("DELETE FROM auth.users WHERE id = $1", uid)
            except Exception:
                pass
        # 3. the personal orgs the signup trigger made (matched by its exact name).
        for _uid, email in self._made:
            try:
                await self.pool.execute(
                    "DELETE FROM public.organizations WHERE name = $1", f"{email}'s Organization"
                )
            except Exception:
                pass
        for uid, _email in self._made:
            _REGISTRY.pop(str(uid), None)
        self._made.clear()
        self._clients.clear()
