"""Phase 307 (OAUTH-04, OAUTH-05; D-05, D-06, D-07, D-08, D-09) — the OAuth client rules.

Everything here is PURE except ``fetch_cimd_document``, whose only I/O is one call to
``egress.send_pinned_http("client_metadata", ...)``.

* **Redirect matching (D-07, T-307-01).** A redirect URI decides where a browser carrying an
  authorization code goes. After a STRICT parse (no fragment, no userinfo, ASCII only, no custom
  scheme) the rule is raw string equality, with one exception: ``http`` on exactly ``localhost``,
  ``127.0.0.1`` or ``[::1]`` matches the same scheme + host on ANY port, path and query byte-exact
  (Claude Code publishes ``http://localhost/callback`` and listens on a random port). ``localhost``
  and ``127.0.0.1`` are not interchangeable. Every other ``http`` is refused. Nothing here goes
  through a URL model that normalises (host case, empty path): strings are compared as sent.
* **The host allowlist (D-08).** Every non-loopback redirect host must be on
  ``app_settings.mcp_oauth_redirect_hosts`` — read LIVE by the caller at registration and at every
  authorize. ``/oauth/token`` never reads it: removing a host stops new sign-ins only.
* **DCR (D-09).** Public clients only (``token_endpoint_auth_method`` absent or ``none``), 1..10
  redirect URIs, no secret ever. Client-supplied strings are stored as DATA: no logo fetch, no HTML.
* **CIMD (D-06, T-307-09).** A ``client_id`` that is an https URL names a JSON document fetched
  ONLY through the egress guard (public addresses, pinned DNS, no redirects, 16 KB), bounded by
  ``asyncio.wait_for(..., 5.0)`` because the DNS lookup is not bounded by the httpx timeout.
  The document's ``client_id`` must equal the URL byte-for-byte.

⚠ No module named ``oauth_*`` opens an HTTP client of its own (``test_307_client_rules`` AST fence).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Literal, Sequence
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict

from app.security import egress

logger = logging.getLogger(__name__)

LOOPBACK_HOSTS: tuple[str, ...] = ("localhost", "127.0.0.1", "[::1]")
MAX_REDIRECT_URIS = 10
MAX_CLIENT_NAME = 200
MAX_CLIENT_URI = 2_048
MAX_URI_LENGTH = 2_048
DCR_MAX_BODY = 16_384
CIMD_MAX_BYTES = 16_384
CIMD_TTL_MIN = 300
CIMD_TTL_MAX = 86_400
CIMD_TTL_DEFAULT = 3_600
CIMD_FETCH_TIMEOUT = 4.0     # the transport's own budget
CIMD_FETCH_BOUND = 5.0       # the hard bound around the whole fetch, DNS included (D-05)

ALLOWED_GRANT_TYPES = frozenset({"authorization_code", "refresh_token"})
ALLOWED_RESPONSE_TYPES = frozenset({"code"})
DEFAULT_GRANT_TYPES = ["authorization_code", "refresh_token"]
DEFAULT_RESPONSE_TYPES = ["code"]

METADATA_UNREADABLE = "metadata_unreadable"

# Printable ASCII with no space: the strict-parse alphabet for a redirect URI (RFC 3986 chars).
_URI_CHARS = re.compile(r"[\x21-\x7e]+")
_PORT = re.compile(r"[0-9]{1,5}")
_MAX_AGE = re.compile(r"(?:^|,)\s*max-age\s*=\s*\"?([^,\s\"]*)\"?", re.IGNORECASE)


# ── redirect URIs (D-07) ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ParsedRedirect:
    """A redirect URI that passed the strict parse. ``host`` is RAW (brackets kept for IPv6);
    ``rest`` is the raw path + query exactly as sent."""

    scheme: Literal["https", "http"]
    host: str
    port: int | None
    rest: str


def parse_redirect(uri: Any) -> ParsedRedirect | None:
    """Strictly parse a redirect URI, or ``None``. Refuses a fragment, userinfo, a non-ASCII or
    whitespace character, any scheme other than lowercase ``https`` / loopback ``http``, a missing
    host and a bad port."""
    if not isinstance(uri, str) or not uri or len(uri) > MAX_URI_LENGTH:
        return None
    if not _URI_CHARS.fullmatch(uri):
        return None
    if "#" in uri:
        return None
    if uri.startswith("https://"):
        scheme: Literal["https", "http"] = "https"
    elif uri.startswith("http://"):
        scheme = "http"
    else:
        return None
    after = uri[len(scheme) + 3:]
    cut = len(after)
    for sep in ("/", "?"):
        idx = after.find(sep)
        if idx != -1:
            cut = min(cut, idx)
    netloc, rest = after[:cut], after[cut:]
    if not netloc or "@" in netloc:
        return None
    if netloc.startswith("["):
        close = netloc.find("]")
        if close == -1:
            return None
        host, port_part = netloc[: close + 1], netloc[close + 1:]
    else:
        host, colon, port_text = netloc.partition(":")
        port_part = f"{colon}{port_text}"
    if not host:
        return None
    port: int | None = None
    if port_part:
        if not port_part.startswith(":") or not _PORT.fullmatch(port_part[1:]):
            return None
        port = int(port_part[1:])
        if not 0 < port <= 65_535:
            return None
    try:  # a second, independent parser must agree there is a host and a sane port
        parts = urlsplit(uri)
        _ = parts.port
    except ValueError:
        return None
    if not parts.hostname:
        return None
    if scheme == "http" and host not in LOOPBACK_HOSTS:
        return None
    return ParsedRedirect(scheme=scheme, host=host, port=port, rest=rest)


def redirect_matches(presented: str, registered: Sequence[str]) -> bool:
    """True when ``presented`` matches one ``registered`` entry under D-07."""
    p = parse_redirect(presented)
    if p is None:
        return False
    for entry in registered or ():
        r = parse_redirect(entry)
        if r is None:
            continue
        if p.scheme == "https":
            if r.scheme == "https" and presented == entry:
                return True
            continue
        # loopback http: same scheme, same RAW host, any port on either side, path+query exact
        if r.scheme == "http" and r.host == p.host and r.rest == p.rest:
            return True
    return False


def redirect_host_kind(uri: str) -> tuple[Literal["web", "loopback"], str] | None:
    """``("loopback", host)`` for a loopback http redirect, ``("web", host)`` (lowercased) for an
    https one, ``None`` for anything the strict parse refuses."""
    p = parse_redirect(uri)
    if p is None:
        return None
    if p.scheme == "http":
        return ("loopback", p.host)
    return ("web", p.host.lower())


def host_allowed(host: str, allowlist: Sequence[Any]) -> bool:
    """A loopback host always; a web host only when it is an EXACT entry of the live allowlist
    (``[{"host": "claude.ai"}, ...]``). No suffix match: ``sub.claude.ai`` is not ``claude.ai``."""
    if not isinstance(host, str) or not host:
        return False
    if host in LOOPBACK_HOSTS:
        return True
    wanted = host.lower()
    for entry in allowlist or ():
        if isinstance(entry, dict) and isinstance(entry.get("host"), str):
            if entry["host"].strip().lower() == wanted:
                return True
    return False


def _redirect_allowed(uri: Any, allowlist: Sequence[Any]) -> bool:
    kind = redirect_host_kind(uri) if isinstance(uri, str) else None
    return kind is not None and host_allowed(kind[1], allowlist)


# ── OAuth errors and client shapes ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class OAuthError:
    """An RFC 6749 / 7591 error: ``error`` is the code a client reads; ``description`` is fixed
    wording — never an echo of client input."""

    error: str
    description: str


@dataclass(frozen=True)
class DcrClient:
    client_name: str | None
    client_uri: str | None
    redirect_uris: list[str]
    grant_types: list[str] = field(default_factory=lambda: list(DEFAULT_GRANT_TYPES))
    response_types: list[str] = field(default_factory=lambda: list(DEFAULT_RESPONSE_TYPES))


@dataclass(frozen=True)
class CimdClient:
    client_id: str
    client_name: str
    client_uri: str | None
    redirect_uris: list[str]


class DcrRequest(BaseModel):
    """The RFC 7591 fields this server reads. Loosely typed on purpose: every field is checked by
    hand below, so a wrong type is an OAuth error with a fixed sentence, not a pydantic dump."""

    model_config = ConfigDict(extra="ignore")

    redirect_uris: Any = None
    token_endpoint_auth_method: Any = None
    grant_types: Any = None
    response_types: Any = None
    client_name: Any = None
    client_uri: Any = None


_BAD_REDIRECT = OAuthError(
    "invalid_redirect_uri",
    "Every redirect URI must be https on an allowed host, or http on localhost, 127.0.0.1 or [::1].",
)
_BAD_METADATA = OAuthError(
    "invalid_client_metadata",
    "Only public clients are accepted: token_endpoint_auth_method none, the authorization_code "
    "and refresh_token grants, and the code response type.",
)


def _string_list(value: Any) -> list[str] | None:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None
    return list(value)


def _subset(value: Any, allowed: frozenset[str], default: list[str]) -> list[str] | None:
    if value is None:
        return list(default)
    items = _string_list(value)
    if items is None or not items or not set(items) <= allowed:
        return None
    return items


def _optional_text(value: Any, cap: int) -> tuple[bool, str | None]:
    if value is None:
        return True, None
    if not isinstance(value, str) or len(value) > cap:
        return False, None
    return True, value


def validate_dcr_body(body: Any, allowlist: Sequence[Any]) -> DcrClient | OAuthError:
    """Validate an RFC 7591 registration body against D-07 / D-08 / D-09."""
    if not isinstance(body, dict):
        return _BAD_METADATA
    req = DcrRequest.model_validate(body)
    uris = _string_list(req.redirect_uris)
    if not uris or len(uris) > MAX_REDIRECT_URIS:
        return _BAD_REDIRECT
    if not all(_redirect_allowed(u, allowlist) for u in uris):
        return _BAD_REDIRECT
    if req.token_endpoint_auth_method not in (None, "none"):
        return _BAD_METADATA
    grants = _subset(req.grant_types, ALLOWED_GRANT_TYPES, DEFAULT_GRANT_TYPES)
    responses = _subset(req.response_types, ALLOWED_RESPONSE_TYPES, DEFAULT_RESPONSE_TYPES)
    if grants is None or responses is None:
        return _BAD_METADATA
    ok_name, name = _optional_text(req.client_name, MAX_CLIENT_NAME)
    ok_uri, client_uri = _optional_text(req.client_uri, MAX_CLIENT_URI)
    if not (ok_name and ok_uri):
        return _BAD_METADATA
    return DcrClient(
        client_name=name, client_uri=client_uri, redirect_uris=uris,
        grant_types=grants, response_types=responses,
    )


# ── CIMD (D-06) ───────────────────────────────────────────────────────────────────────────────


def cimd_url_ok(client_id: Any) -> bool:
    """True when ``client_id`` is a URL this server will fetch as a metadata document: https, an
    ASCII host, the DEFAULT port only (no explicit port), a non-root path, no query, no fragment,
    no userinfo. Checked before any lookup."""
    if not isinstance(client_id, str) or not client_id or len(client_id) > MAX_URI_LENGTH:
        return False
    if not _URI_CHARS.fullmatch(client_id) or not client_id.startswith("https://"):
        return False
    if "#" in client_id or "?" in client_id:
        return False
    try:
        parts = urlsplit(client_id)
        port = parts.port
    except ValueError:
        return False
    if "@" in parts.netloc or port is not None or ":" in parts.netloc:
        return False
    if not parts.hostname or parts.path in ("", "/"):
        return False
    return True


def validate_cimd_document(url: str, doc: Any) -> CimdClient | str:
    """Validate a fetched Client ID Metadata Document, or return ``"metadata_unreadable"``.

    The document's ``client_id`` must equal ``url`` byte-for-byte; ``client_name`` and 1..10
    D-07-valid ``redirect_uris`` are required; ``token_endpoint_auth_method`` absent or ``none``.
    The redirect HOST policy (D-08) is NOT applied here — it is applied to the redirect actually
    presented at authorize, so that a refusal reads ``host_not_allowed`` and not "unreadable".
    """
    if not cimd_url_ok(url) or not isinstance(doc, dict):
        return METADATA_UNREADABLE
    if doc.get("client_id") != url:
        return METADATA_UNREADABLE
    name = doc.get("client_name")
    if not isinstance(name, str) or not name.strip() or len(name) > MAX_CLIENT_NAME:
        return METADATA_UNREADABLE
    uris = _string_list(doc.get("redirect_uris"))
    if not uris or len(uris) > MAX_REDIRECT_URIS:
        return METADATA_UNREADABLE
    if not all(parse_redirect(u) is not None for u in uris):
        return METADATA_UNREADABLE
    if doc.get("token_endpoint_auth_method") not in (None, "none"):
        return METADATA_UNREADABLE
    if _subset(doc.get("grant_types"), ALLOWED_GRANT_TYPES, DEFAULT_GRANT_TYPES) is None:
        return METADATA_UNREADABLE
    if _subset(doc.get("response_types"), ALLOWED_RESPONSE_TYPES, DEFAULT_RESPONSE_TYPES) is None:
        return METADATA_UNREADABLE
    ok_uri, client_uri = _optional_text(doc.get("client_uri"), MAX_CLIENT_URI)
    return CimdClient(
        client_id=url, client_name=name, client_uri=client_uri if ok_uri else None, redirect_uris=uris
    )


def _ttl_from_cache_control(value: str | None) -> int:
    """``max-age`` clamped to [CIMD_TTL_MIN, CIMD_TTL_MAX]; ``no-store`` / ``no-cache`` -> the
    minimum; absent or unparseable -> CIMD_TTL_DEFAULT."""
    if not value:
        return CIMD_TTL_DEFAULT
    lowered = value.lower()
    if "no-store" in lowered or "no-cache" in lowered:
        return CIMD_TTL_MIN
    match = _MAX_AGE.search(value)
    if match is None:
        return CIMD_TTL_DEFAULT
    try:
        seconds = int(match.group(1))
    except ValueError:
        return CIMD_TTL_DEFAULT
    return max(CIMD_TTL_MIN, min(CIMD_TTL_MAX, seconds))


async def fetch_cimd_document(
    url: str,
    *,
    resolver: Any = None,
    transport: Any = None,
) -> tuple[dict, int] | str:
    """Fetch and validate one CIMD document: ``(document, ttl_seconds)`` or
    ``"metadata_unreadable"``. ``resolver`` / ``transport`` are the egress test seams; production
    passes neither. A refusal is logged by reason only (egress logs host + reason itself)."""
    if not cimd_url_ok(url):
        return METADATA_UNREADABLE
    host = (urlsplit(url).hostname or "").lower()
    try:
        response = await asyncio.wait_for(
            egress.send_pinned_http(
                "client_metadata",
                "GET",
                url,
                allowed_host=host,
                timeout=CIMD_FETCH_TIMEOUT,
                max_bytes=CIMD_MAX_BYTES,
                headers={"Accept": "application/json", "User-Agent": "Syrel-OAuth/1"},
                resolver=resolver,
                transport=transport,
            ),
            CIMD_FETCH_BOUND,
        )
    except asyncio.TimeoutError:
        logger.warning("cimd fetch refused: host=%s reason=timeout", host)
        return METADATA_UNREADABLE
    except Exception as exc:  # noqa: BLE001 — every failure is one refusal, never a traceback out
        logger.warning("cimd fetch refused: host=%s reason=%s", host, type(exc).__name__)
        return METADATA_UNREADABLE
    if response.status_code != 200:
        logger.warning("cimd fetch refused: host=%s reason=status_%s", host, response.status_code)
        return METADATA_UNREADABLE
    try:
        doc = json.loads(response.body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return METADATA_UNREADABLE
    if not isinstance(doc, dict) or not isinstance(validate_cimd_document(url, doc), CimdClient):
        return METADATA_UNREADABLE
    headers = {str(k).lower(): v for k, v in (response.headers or {}).items()}
    return doc, _ttl_from_cache_control(headers.get("cache-control"))
