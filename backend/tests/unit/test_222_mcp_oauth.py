"""Phase 222 — the PKCE join, and the properties that make it safe against an UNTRUSTED
authorization server.

⚠ MOST OF THESE ARE SECURITY ASSERTIONS, NOT BEHAVIOUR ONES. The behaviour ("a token comes
back") is one test; the rest pin things that must be true because the authorization server
in this flow is a URL a stranger pasted. `BUS-048` records what happens when they are not:
`oauth_service.generate_oauth_state` puts the client secret AND the PKCE verifier in the
authorize URL, which for the shipped Google path is bad and here would be fatal.
"""

from __future__ import annotations

import base64
import json

import httpx
import pytest

from app.security.egress import EgressRefused
from app.services import mcp_auth_discovery as disc
from app.services import mcp_oauth
from app.services.mcp_oauth import (
    McpOAuthError,
    begin_authorization,
    complete_authorization,
)

TOKEN_URL = "https://auth.example.com/token"
AUTHZ_URL = "https://auth.example.com/authorize"
SECRET = "SUPER-SECRET-CLIENT-VALUE-98765"


class FakeRedis:
    """Enough Redis to exercise the real code. `setex` is recorded so its use can be pinned."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.setex_calls: list[tuple[str, int]] = []
        self.deleted: list[str] = []

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.setex_calls.append((key, ttl))
        self.store[key] = value

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.store.pop(key, None)


@pytest.fixture
def pinned(monkeypatch):
    def _fake(url: str):
        return disc.PinnedDestination(
            ip="93.184.216.34", hostname=httpx.URL(url).host, port=443, scheme="https"
        )

    monkeypatch.setattr(disc, "validate_mcp_destination", _fake)


async def _begin(redis, **over):
    kwargs = dict(
        authorization_endpoint=AUTHZ_URL,
        token_endpoint=TOKEN_URL,
        client_id="client-abc",
        client_secret=SECRET,
        redirect_uri="https://app.example.com/cb",
        scopes=["read"],
        server_url="https://mcp.example.com/mcp",
        connection_id="conn-1",
        user_id="user-1",
        org_id="org-1",
    )
    kwargs.update(over)
    return await begin_authorization(redis, **kwargs)


# ── the reason this module exists (BUS-048) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_authorize_url_leaks_neither_the_secret_nor_the_verifier():
    """⚠ THE HEADLINE PROPERTY. `generate_oauth_state` fails this test by construction —
    it base64s the client secret and the code_verifier into `?state=`, and base64 is an
    encoding, not a cipher. Here `state` is 32 random bytes and resolves to nothing."""
    redis = FakeRedis()
    url, handle = await _begin(redis)

    assert SECRET not in url
    stored = json.loads(next(iter(redis.store.values())))
    verifier = stored["code_verifier"]
    assert verifier not in url

    # And it is not merely absent in plaintext — it is not RECOVERABLE from the URL either.
    state = httpx.URL(url).params["state"]
    assert state == handle
    for pad in ("", "=", "==", "==="):
        try:
            decoded = base64.urlsafe_b64decode(state + pad).decode("utf-8", errors="replace")
        except Exception:
            continue
        assert SECRET not in decoded
        assert verifier not in decoded


@pytest.mark.asyncio
async def test_the_verifier_travels_in_the_post_body_and_never_in_a_url(pinned, monkeypatch):
    """PKCE only works if the verifier and the code do not share a channel."""
    redis = FakeRedis()
    _url, handle = await _begin(redis)
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = request.content.decode()
        seen["ctype"] = request.headers.get("content-type")
        return httpx.Response(200, json={"access_token": "at", "token_type": "Bearer"})

    tokens, _p = await complete_authorization(
        redis, handle=handle, code="the-code", transport=httpx.MockTransport(handler)
    )
    assert tokens["access_token"] == "at"
    assert "code_verifier=" in seen["body"]
    assert "code_verifier" not in seen["url"]
    assert "the-code" not in seen["url"]
    # RFC 6749 §4.1.3 — the token request is form-encoded, never JSON.
    assert "application/x-www-form-urlencoded" in seen["ctype"]


@pytest.mark.asyncio
async def test_s256_is_hardcoded_so_a_server_cannot_negotiate_us_down_to_plain():
    """⚠ The challenge method is NOT read from the discovered metadata. Letting a server
    choose it is the downgrade PKCE exists to prevent."""
    redis = FakeRedis()
    url, _ = await _begin(redis)
    params = httpx.URL(url).params
    assert params["code_challenge_method"] == "S256"
    assert params["code_challenge"]
    assert "plain" not in url


# ── single use ────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_handle_is_single_use_so_a_replayed_redirect_cannot_re_exchange(pinned):
    redis = FakeRedis()
    _url, handle = await _begin(redis)
    ok = httpx.MockTransport(lambda r: httpx.Response(200, json={"access_token": "at"}))

    await complete_authorization(redis, handle=handle, code="c", transport=ok)

    with pytest.raises(McpOAuthError) as excinfo:
        await complete_authorization(redis, handle=handle, code="c", transport=ok)
    assert "already been used" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_failed_exchange_still_burns_the_handle(pinned):
    """⚠ The DELETE happens before the exchange, on purpose. A failure must send the person
    back through consent, not leave a handle an attacker can retry the redemption with."""
    redis = FakeRedis()
    _url, handle = await _begin(redis)
    bad = httpx.MockTransport(lambda r: httpx.Response(400, json={"error": "invalid_grant"}))

    with pytest.raises(McpOAuthError):
        await complete_authorization(redis, handle=handle, code="c", transport=bad)
    assert redis.store == {}, "the pending record must be gone even though the exchange failed"


@pytest.mark.asyncio
async def test_an_unknown_handle_is_refused_with_a_sentence_not_a_crash():
    redis = FakeRedis()
    with pytest.raises(McpOAuthError):
        await complete_authorization(redis, handle="never-existed", code="c")


@pytest.mark.asyncio
async def test_the_pending_record_is_written_with_one_command_and_a_ttl():
    """⚠ `setex`, not `set` + `expire`: a crash between two commands parks a
    credential-bearing record in Redis with no expiry, forever."""
    redis = FakeRedis()
    await _begin(redis)
    assert len(redis.setex_calls) == 1
    key, ttl = redis.setex_calls[0]
    assert key.startswith("mcp_oauth:pending:")
    assert ttl == mcp_oauth.PENDING_TTL_SECONDS
    # The key carries no user or connection identity — the handle resolves it, nothing else.
    assert "user-1" not in key and "conn-1" not in key


# ── the token endpoint is a stranger's URL too ────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_token_exchange_refuses_a_private_address():
    """⚠ NO `pinned` FIXTURE — the real validator runs. `token_endpoint` came out of metadata
    served by a host nobody curated, so it is an SSRF surface exactly like discovery was.
    `oauth_service.exchange_code_for_tokens` uses a raw client and would connect."""
    redis = FakeRedis()
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json={"access_token": "at"})

    _url, handle = await _begin(redis, token_endpoint="https://169.254.169.254/token")

    with pytest.raises(EgressRefused):
        await complete_authorization(
            redis, handle=handle, code="c", transport=httpx.MockTransport(handler)
        )
    assert called is False, "cloud metadata must never be contacted"


@pytest.mark.asyncio
async def test_a_redirect_from_the_token_endpoint_is_refused(pinned):
    redis = FakeRedis()
    _url, handle = await _begin(redis)
    with pytest.raises(EgressRefused) as excinfo:
        await complete_authorization(
            redis,
            handle=handle,
            code="c",
            transport=httpx.MockTransport(
                lambda r: httpx.Response(302, headers={"location": "https://evil.example.net/"})
            ),
        )
    assert excinfo.value.reason_code == "redirected"


# ── what we do NOT repeat back ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_providers_error_body_is_not_echoed_to_the_caller(pinned):
    """⚠ Token-endpoint error bodies routinely quote the request back. Echoing one would put
    the authorization code — and on some servers the client_secret — into our logs and into
    a sentence a person reads."""
    redis = FakeRedis()
    _url, handle = await _begin(redis)

    leaky = httpx.MockTransport(lambda r: httpx.Response(400, json={
        "error": "invalid_grant",
        "error_description": f"code=the-code client_secret={SECRET} was rejected",
    }))

    with pytest.raises(McpOAuthError) as excinfo:
        await complete_authorization(redis, handle=handle, code="the-code", transport=leaky)

    message = str(excinfo.value)
    assert SECRET not in message
    assert "the-code" not in message
    assert "400" in message  # the status IS actionable, and is kept


@pytest.mark.asyncio
async def test_a_response_without_an_access_token_is_an_error_not_a_success(pinned):
    """A 200 that carries no token is a failure. Returning it would store an empty
    credential and present a broken connection as a working one."""
    redis = FakeRedis()
    _url, handle = await _begin(redis)
    with pytest.raises(McpOAuthError):
        await complete_authorization(
            redis,
            handle=handle,
            code="c",
            transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"scope": "read"})),
        )


@pytest.mark.asyncio
async def test_a_public_client_omits_the_secret_rather_than_sending_an_empty_one(pinned):
    """RFC 7591 dynamic registration can yield a client with no secret at all."""
    redis = FakeRedis()
    _url, handle = await _begin(redis, client_secret=None)
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = request.content.decode()
        return httpx.Response(200, json={"access_token": "at"})

    await complete_authorization(
        redis, handle=handle, code="c", transport=httpx.MockTransport(handler)
    )
    assert "client_secret" not in seen["body"]
    assert "code_verifier=" in seen["body"]
