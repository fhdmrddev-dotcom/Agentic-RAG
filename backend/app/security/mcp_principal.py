"""Phase 304 (KEY-02..KEY-06; D-20) — who an MCP call acts as.

``McpPrincipal`` is a FROZEN value built ONLY from a resolved key, never from request data: the
member it acts as (``user_id``), the org it is pinned to (``org_id``), and the key's narrowing
(``folder_ids``, ``tools``, ``include_external``). 305's transport resolves one per connection;
306/307/308 re-check it per call with ``principal_liveness.recheck_principal``.

``credential_kind`` is ``'key'`` for a personal MCP key and ``'oauth'`` for an OAuth access token
(Phase 307). A grant is a credential lookup in front of the same chain (D-21): the token resolves
to its GRANT's ``api_keys`` row and goes through the one admission tail, so ``key_id`` is the
grant's id and every liveness, narrowing and kill-switch rule applies to it by construction. There
is no second principal type.

``KeyRefused`` from the resolver core propagates unchanged; 305 maps it onto its transport.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.security import api_key_auth, oauth_tokens
from app.services.mcp_tool_catalogue import mcp_url


@dataclass(frozen=True)
class McpPrincipal:
    key_id: str
    user_id: str
    org_id: str
    folder_ids: tuple[str, ...] | None   # None = not narrowed by folder; () = nothing
    tools: tuple[str, ...]
    include_external: bool
    credential_kind: Literal["key", "oauth"] = "key"
    # 305-03 (D-26): the key's label, so every MCP audit row names the key it was made with.
    label: str | None = None


async def resolve_mcp_principal(presented: str, *, pool, redis) -> McpPrincipal:
    """Authenticate an ``srl_mcp_`` key or an ``srl_oat_`` access token through the ONE resolver
    core and return its principal. The prefix picks the LOOKUP; the admission tail is shared.

    ``call="read"``: an MCP refusal must render as a read in the key's activity strip, never as a
    "start" (``_call_from_audit`` maps start/read only — 304-RESEARCH pitfall 9).
    """
    if presented.startswith(oauth_tokens.ACCESS_TOKEN_PREFIX):
        key = await api_key_auth.authenticate_presented_access_token(
            presented, pool=pool, redis=redis, call="read", resource=mcp_url()
        )
        credential_kind = "oauth"
    else:
        key = await api_key_auth.authenticate_presented_key(
            presented, pool=pool, redis=redis, call="read", expected_kind="mcp"
        )
        credential_kind = "key"
    return McpPrincipal(
        key_id=key.id,
        user_id=key.user_id,
        org_id=key.org_id,
        folder_ids=key.folder_ids,
        # An MCP row always carries tools (mig 220 CHECK); a missing list grants nothing.
        tools=tuple(key.tools or ()),
        include_external=key.include_external,
        credential_kind=credential_kind,
        label=key.label,
    )
