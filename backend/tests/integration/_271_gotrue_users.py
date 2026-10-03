"""Phase 271 (P-04) — real GoTrue users with real access tokens, for the live Find suites.

Why this helper exists: the SC#5 fence must run on THE REAL RLS PATH that `POST
/document-search` uses in production — a per-request supabase-py client built from the ANON
key plus the caller's GoTrue-issued ``Authorization: Bearer <access_token>`` (the
``app.dependencies.get_user_supabase`` shape), so PostgREST evaluates RLS as
``authenticated``. The asyncpg ``open_user_conn`` harness and ``_reembed_adapter`` cannot
stand in for that: the adapter does not speak ``in_`` / ``ilike`` / ``is_`` / ``range`` /
``count`` (RESEARCH Pitfall 8).

Invariants:
  * The service-role key is used ONLY for the GoTrue admin API (create / delete a user). It
    is never handed to a search call: ``user_client`` takes nothing but an access token
    (T-271-19).
  * Every user ends with exactly ONE membership — the org the test names. The signup
    trigger (``handle_new_user``) gives a new user a personal org; it is removed here, the
    ``test_163_rls_documents._add_comember`` shape, BEFORE the user signs in. A two-org
    subject would make a fence vacuous (the dev account is in two orgs).
  * Deleting a GoTrue user does NOT delete its personal org (measured 2026-10-03: two probe
    orgs were left behind). That is why the personal org is deleted at creation, and why
    ``drop`` also removes any org still named after the user's e-mail.
  * :54321 unreachable → ``pytest.skip`` with the reason. A skip is a SKIP, never a pass.
"""
from __future__ import annotations

import os
import socket
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from supabase import Client, ClientOptions, create_client

from tests.integration.test_163_rls_documents import _drop_user

_KEYS = ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")


def _local_env() -> dict[str, str]:
    """The LOCAL stack's URL and keys, read from ``backend/.env``.

    Not ``app.config.settings``: ``tests/conftest.py`` sets placeholder ``SUPABASE_URL`` /
    ``SUPABASE_SERVICE_ROLE_KEY`` env vars before any app import (the unit suite must never
    reach a real project), and a real env var outranks ``.env`` in pydantic-settings. The
    ``test_114_resolve_adhoc._read_local_supabase_env`` precedent.
    """
    path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    out: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k in _KEYS:
                    out[k] = v
    except OSError:
        pass
    return out


def _gotrue_reachable(url_text: str) -> tuple[bool, str]:
    url = urlparse(url_text or "")
    host, port = url.hostname or "127.0.0.1", url.port or (443 if url.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=2.0):
            return True, f"{host}:{port}"
    except OSError as e:
        return False, f"{host}:{port} ({type(e).__name__}: {e})"


def require_gotrue() -> None:
    """Skip (with the exact port) when the local Supabase API gateway is not usable."""
    env = _local_env()
    missing = [k for k in _KEYS if not env.get(k)]
    if missing:
        pytest.skip(f"backend/.env lacks {', '.join(missing)}")
    if "test.supabase.co" in env["SUPABASE_URL"]:
        pytest.skip("backend/.env SUPABASE_URL is a placeholder")
    ok, where = _gotrue_reachable(env["SUPABASE_URL"])
    if not ok:
        pytest.skip(f"Supabase API (GoTrue/PostgREST) not reachable at {where}")


def _admin() -> Client:
    env = _local_env()
    return create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])


def user_client(access_token: str) -> Client:
    """The ``get_user_supabase`` shape: ANON key + the user's Bearer token (RLS ENFORCED)."""
    env = _local_env()
    return create_client(
        env["SUPABASE_URL"],
        env["SUPABASE_ANON_KEY"],
        options=ClientOptions(headers={"Authorization": f"Bearer {access_token}"}),
    )


async def memberships(pool, uid: str) -> set[str]:
    rows = await pool.fetch("SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(uid))
    return {str(r["org_id"]) for r in rows}


async def create_org(pool, label: str) -> str:
    org_id = uuid4()
    await pool.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
        org_id, f"phase-271-{label}-{org_id.hex[:8]}",
    )
    return str(org_id)


async def drop_org(pool, org_id: str | None) -> None:
    if not org_id:
        return
    try:
        await pool.execute("DELETE FROM public.organizations WHERE id = $1", UUID(org_id))
    except Exception:
        pass


class GoTrueUsers:
    """Creates signed-in users and remembers them, so ``drop_all`` can tear every one down."""

    def __init__(self, pool):
        self.pool = pool
        self.created: list[tuple[str, str]] = []  # (uid, email)

    async def create_signed_in_user(
        self, org_id: str, *, role: str = "member", label: str = "u"
    ) -> tuple[str, str]:
        """GoTrue admin create → single-membership cleanup → sign in. Returns ``(uid, token)``."""
        email = f"phase-271-{label}-{uuid4().hex[:10]}@test.local"
        password = "P271-" + uuid4().hex
        admin = _admin()
        created = admin.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
        uid = str(created.user.id)
        self.created.append((uid, email))

        # The _add_comember shape: drop the signup trigger's personal org, then add the ONE
        # membership the test names. Done BEFORE sign-in so no token predates it.
        personal = await self.pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(uid)
        )
        await self.pool.execute("DELETE FROM public.org_members WHERE user_id = $1", UUID(uid))
        for row in personal:
            if str(row["org_id"]) != str(org_id):
                await self.pool.execute(
                    "DELETE FROM public.organizations WHERE id = $1", row["org_id"]
                )
        await self.pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3)",
            UUID(org_id), UUID(uid), role,
        )

        env = _local_env()
        anon = create_client(env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"])
        session = anon.auth.sign_in_with_password({"email": email, "password": password}).session
        assert session is not None and session.access_token, "GoTrue sign-in returned no session"
        return uid, session.access_token

    async def drop_all(self) -> None:
        admin = _admin()
        for uid, email in self.created:
            try:
                admin.auth.admin.delete_user(uid)
            except Exception:
                pass
            await _drop_user(self.pool, uid)
            try:
                await self.pool.execute(
                    "DELETE FROM public.organizations WHERE name = $1", f"{email}'s Organization"
                )
            except Exception:
                pass
        self.created.clear()
