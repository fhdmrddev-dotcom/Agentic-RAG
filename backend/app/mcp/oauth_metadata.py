"""Phase 307 (OAUTH-05; D-02, D-04, D-22, D-49; T-307-04) — the discovery documents. PURE.

Every value here is a pure function of ``mcp_public_base()`` — the ONE refuse-mount predicate.
Never ``request.url``, never ``Host``, never ``X-Forwarded-*``: an absolute URL a client trusts
must not be steerable by the request that asked for it.

* **issuer** = ``mcp_public_base()`` exactly (no trailing slash). It appears byte-identical in the
  authorization-server document, as the protected-resource document's ``authorization_servers[0]``
  and as every ``iss`` parameter on an authorization response (RFC 9207, D-49) — Claude compares
  them byte-for-byte.
* **PRM URL** (RFC 9728 path insertion): ``<origin>/.well-known/oauth-protected-resource<bp>/mcp``,
  where ``<bp>`` is the base's path (``""`` local / cloud, ``"/api"`` one-box). It is what the /mcp
  401 points at (D-22).
* **AS metadata URL** (RFC 8414 path insertion): ``<origin>/.well-known/oauth-authorization-server<bp>``.

The documents are built with the SDK's Pydantic models only (``mcp.shared.auth``, D-44). Nothing
else from the SDK's auth package is used.
"""
from __future__ import annotations

from urllib.parse import urlsplit

PRM_PREFIX = "/.well-known/oauth-protected-resource"
AS_PREFIX = "/.well-known/oauth-authorization-server"
SCOPE = "mcp"
RESOURCE_NAME = "Syrel"


def issuer() -> str | None:
    """The authorization server's issuer — ``mcp_public_base()`` byte-for-byte, or ``None``."""
    from app.services.mcp_tool_catalogue import mcp_public_base  # noqa: PLC0415 — lazy, like the catalogue

    return mcp_public_base()


def _split() -> tuple[str, str] | None:
    base = issuer()
    if base is None:
        return None
    parts = urlsplit(base)
    return f"{parts.scheme}://{parts.netloc}", parts.path.rstrip("/")


def base_path() -> str:
    """``""`` when the base has no path (local, cloud), ``"/api"`` on the one-box."""
    split = _split()
    return split[1] if split else ""


def well_known_paths() -> dict[str, str]:
    """The three backend paths the discovery documents are served at (the proxy passes the
    origin-root ``.well-known`` paths through unchanged)."""
    from app.services.mcp_tool_catalogue import MCP_PATH  # noqa: PLC0415

    bp = base_path()
    return {
        "prm_suffixed": f"{PRM_PREFIX}{bp}{MCP_PATH}",
        "prm_root": PRM_PREFIX,
        "as_metadata": f"{AS_PREFIX}{bp}",
    }


def prm_url() -> str | None:
    """The absolute protected-resource-metadata URL the 401 challenge names, or ``None``."""
    split = _split()
    if split is None:
        return None
    return f"{split[0]}{well_known_paths()['prm_suffixed']}"


def endpoint(name: str) -> str:
    """``<issuer>/oauth/<name>``. Only called when the issuer exists (routes are not mounted
    otherwise)."""
    base = issuer()
    if base is None:
        raise RuntimeError("no OAuth endpoints exist without a public base")
    return f"{base}/oauth/{name}"


def authorization_server_metadata() -> dict:
    """The RFC 8414 document (exact field set, 307-RESEARCH §Metadata)."""
    from mcp.shared.auth import OAuthMetadata  # noqa: PLC0415

    iss = issuer()
    if iss is None:
        raise RuntimeError("no authorization server metadata without a public base")
    doc = OAuthMetadata(
        issuer=iss,
        authorization_endpoint=endpoint("authorize"),
        token_endpoint=endpoint("token"),
        registration_endpoint=endpoint("register"),
        revocation_endpoint=endpoint("revoke"),
        scopes_supported=[SCOPE],
        response_types_supported=["code"],
        grant_types_supported=["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported=["none"],
        revocation_endpoint_auth_methods_supported=["none"],
        code_challenge_methods_supported=["S256"],
        client_id_metadata_document_supported=True,
        authorization_response_iss_parameter_supported=True,
    ).model_dump(mode="json", exclude_none=True)
    # The issuer is compared byte-for-byte by every client (RFC 8414 §3.3, RFC 9207). Measured: the
    # model keeps it exact for all three topologies — this makes any future drift loud, not silent.
    if doc["issuer"] != iss:
        raise RuntimeError("the serialised issuer drifted from mcp_public_base()")
    return doc


def protected_resource_metadata() -> dict:
    """The RFC 9728 document: ``resource`` is the MCP URL, the issuer the only AS."""
    from mcp.shared.auth import ProtectedResourceMetadata  # noqa: PLC0415

    from app.services.mcp_tool_catalogue import mcp_url  # noqa: PLC0415

    iss = issuer()
    resource = mcp_url()
    if iss is None or resource is None:
        raise RuntimeError("no protected resource metadata without a public base")
    doc = ProtectedResourceMetadata(
        resource=resource,
        authorization_servers=[iss],
        scopes_supported=[SCOPE],
        bearer_methods_supported=["header"],
        resource_name=RESOURCE_NAME,
    ).model_dump(mode="json", exclude_none=True)
    if doc["authorization_servers"][0] != iss or doc["resource"] != resource:
        raise RuntimeError("the serialised resource metadata drifted from mcp_public_base()")
    return doc
