"""Phase 307 (OAUTH-05, OAUTH-06; D-01, D-17, D-18, D-47) — the OAuth token primitives. PURE.

No I/O, no database, no network: this module mints the two opaque token shapes, digests a
presented token of ONE kind, verifies a PKCE S256 pair in constant time, and canonicalises a
resource URL so two spellings of the same ``/mcp`` address compare equal.

* An **access token** is ``srl_oat_`` + ``secrets.token_urlsafe(32)``; it acts at ``/mcp`` for
  ``ACCESS_TTL_SECONDS`` (1 hour).
* A **refresh token** is ``srl_ort_`` + ``secrets.token_urlsafe(32)``; it only ever buys a new pair
  at ``/oauth/token`` and rotates on every use (D-19, with the bounded grace of D-46).
* Both are stored ONLY as their SHA-256 hex digest (``public.oauth_tokens.token_hash``), the same
  one-way shape as an API key's ``key_hash`` — a token never needs reading back.

⚠ A TOKEN IS NEVER LOGGED, NEVER PUT IN A URL, NEVER PUT IN AUDIT METADATA (D-17). Nothing here
logs at all; callers must not either. A refusal is described by its reason, never its token.

⚠ The tokens are opaque on purpose (T-307-12): not JWTs, so PostgREST / GoTrue can never mistake
one for a session, and revocation is a row update rather than a deny list.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from typing import Literal
from urllib.parse import urlsplit

TokenKind = Literal["access", "refresh"]

ACCESS_TOKEN_PREFIX = "srl_oat_"
REFRESH_TOKEN_PREFIX = "srl_ort_"
ACCESS_TTL_SECONDS = 3600
GRANT_TTL_DAYS = 90            # D-16: a grant slides to now + 90 days on every refresh
REFRESH_GRACE_SECONDS = 60     # D-46: the bounded re-rotation window

_PREFIXES: dict[str, str] = {"access": ACCESS_TOKEN_PREFIX, "refresh": REFRESH_TOKEN_PREFIX}
_MAX_PRESENTED_LEN = 128
_TOKEN_BODY = re.compile(r"[A-Za-z0-9_-]+")
# RFC 7636 §4.1: code_verifier = 43*128unreserved, unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
_PKCE_VERIFIER = re.compile(r"[A-Za-z0-9\-._~]{43,128}")
_DEFAULT_PORTS = {"http": 80, "https": 443}


def mint_token(kind: TokenKind) -> str:
    """A new opaque token of ``kind``. The caller stores ``digest_token(token, kind)`` only."""
    return _PREFIXES[kind] + secrets.token_urlsafe(32)


def digest_token(presented: str, kind: TokenKind) -> str | None:
    """The SHA-256 hex digest of a presented token of THIS kind, or ``None`` if it cannot be one.

    The ``api_key_auth.digest_key`` shape: the kind's prefix, at most 128 characters, and a body in
    the urlsafe alphabet ``token_urlsafe`` produces. A malformed string is refused before any read.
    """
    prefix = _PREFIXES.get(kind)
    if prefix is None or not isinstance(presented, str):
        return None
    if not presented or len(presented) > _MAX_PRESENTED_LEN:
        return None
    if not presented.startswith(prefix):
        return None
    if not _TOKEN_BODY.fullmatch(presented[len(prefix):]):
        return None
    return hashlib.sha256(presented.encode()).hexdigest()


def pkce_s256_matches(verifier: str, challenge: str) -> bool:
    """RFC 7636 S256: ``BASE64URL-NOPAD(SHA256(ASCII(verifier))) == challenge``, in constant time.

    A verifier outside 43..128 characters of the unreserved set is refused outright.
    """
    if not isinstance(verifier, str) or not isinstance(challenge, str):
        return False
    if not _PKCE_VERIFIER.fullmatch(verifier):
        return False
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=")
    return hmac.compare_digest(expected, challenge.encode("utf-8"))


def canonical_resource(value: str | None) -> str | None:
    """The canonical form of a resource URL (RFC 8707), or ``None`` if it is not one we accept.

    Strict: refuses a fragment, userinfo, a missing host, a bad port and any scheme other than
    http / https. Lower-cases scheme and host, drops the scheme's default port and strips ONE
    trailing ``/`` from the path, so ``HTTP://LocalHost:8000/mcp/`` == ``http://localhost:8000/mcp``.
    The query (rare on a resource) is kept byte-for-byte.
    """
    if not isinstance(value, str) or not value:
        return None
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    scheme = parts.scheme.lower()
    if scheme not in _DEFAULT_PORTS:
        return None
    if parts.fragment or "#" in value:
        return None
    if "@" in parts.netloc or parts.username is not None or parts.password is not None:
        return None
    host = (parts.hostname or "").lower()
    if not host:
        return None
    if ":" in host:  # an IPv6 literal: hostname drops the brackets
        host = f"[{host}]"
    netloc = host if port is None or port == _DEFAULT_PORTS[scheme] else f"{host}:{port}"
    path = parts.path[:-1] if parts.path.endswith("/") else parts.path
    query = f"?{parts.query}" if parts.query else ""
    return f"{scheme}://{netloc}{path}{query}"
