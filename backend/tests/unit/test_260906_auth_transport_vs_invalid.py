"""BUG-260906-02 — a slow auth service reported itself as a bad credential.

⛔ WHAT `get_current_user` DID: called the SYNCHRONOUS `supabase.auth.get_user(token)` inside
an `async def` dependency (blocking the event loop on EVERY authed request, uncached) wrapped
in a bare `except Exception: raise HTTPException(401, "Invalid or expired token")`.

⚠ MEASURED FROM THE OPERATOR'S LOG — bursts of
      GET /connectors/connections 401 · GET /sources/watches 401 · GET /sources/health 401
  across CONCURRENT requests, no user action, recovering to 200 unaided. The token was fine;
  the auth service was slow under the burst and every timeout became a credentials error.

⛔ A TRANSPORT FAILURE IS NOT AN AUTH FAILURE. 401 invites a client to throw away a good
  session and re-authenticate. 503 says "I could not check" — honest, and still fail-closed:
  no access is granted on either path.
"""
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


def _creds(token: str = "tok") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _supabase_raising(exc: Exception) -> MagicMock:
    sb = MagicMock()
    sb.auth.get_user.side_effect = exc
    return sb


def _supabase_returning(user) -> MagicMock:
    sb = MagicMock()
    sb.auth.get_user.return_value = MagicMock(user=user)
    return sb


@pytest.mark.asyncio
async def test_a_transport_failure_is_503_not_401():
    """⛔ THE BUG, DRIVEN. A connect error must never read as a bad token."""
    from app.dependencies import get_current_user

    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_raising(httpx.ConnectError("refused")))
    assert ei.value.status_code == 503
    assert "verify" in str(ei.value.detail).lower()


@pytest.mark.asyncio
async def test_a_timeout_is_503_not_401():
    """The exact shape the operator hit: the auth service was slow, not wrong."""
    from app.dependencies import get_current_user

    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_raising(httpx.ReadTimeout("slow")))
    assert ei.value.status_code == 503


@pytest.mark.asyncio
async def test_an_upstream_5xx_is_503_not_401():
    """A 500 from the auth service says nothing about the caller's credentials."""
    from app.dependencies import get_current_user

    exc = Exception("upstream exploded")
    exc.status = 500  # the shape gotrue's AuthApiError carries
    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_raising(exc))
    assert ei.value.status_code == 503


@pytest.mark.asyncio
async def test_a_genuinely_rejected_token_is_still_401():
    """⚠ THE COUNTER-GUARD. Widening 401→503 everywhere would be a security hole."""
    from app.dependencies import get_current_user

    exc = Exception("bad jwt")
    exc.status = 401
    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_raising(exc))
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_an_unclassifiable_error_defaults_to_401_not_503():
    """Fail-closed on the credential, not open. An unknown error must not grant a retry hint
    that implies the session is fine."""
    from app.dependencies import get_current_user

    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_raising(ValueError("who knows")))
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_no_user_on_the_response_is_401():
    from app.dependencies import get_current_user

    with pytest.raises(HTTPException) as ei:
        await get_current_user(_creds(), _supabase_returning(None))
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_the_blocking_call_runs_OFF_the_event_loop(monkeypatch):
    """⛔ D-v2.5-01. `supabase.auth.get_user` is SYNC supabase-py; calling it inline blocked
    the loop on every authed request. The file's own docblock ~20 lines below the function
    already stated this rule — the function did not follow it."""
    from app import dependencies

    seen = {}

    async def _spy(fn, *args, **kwargs):
        seen["threadpooled"] = True
        return fn(*args, **kwargs)

    monkeypatch.setattr(dependencies, "run_in_threadpool", _spy)
    monkeypatch.setattr(dependencies, "_is_banned", lambda _uid: _false())

    user = MagicMock(id="u1", email="a@b.c")
    await dependencies.get_current_user(_creds(), _supabase_returning(user))
    assert seen.get("threadpooled"), "auth validation ran inline on the event loop"


async def _false() -> bool:
    return False
