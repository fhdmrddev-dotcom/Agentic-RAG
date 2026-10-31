"""Phase 304 (KEY-02..KEY-06; D-20) — who an MCP call acts as.

``McpPrincipal`` is a FROZEN value built ONLY from a resolved key, never from request data: the
member it acts as (``user_id``), the org it is pinned to (``org_id``), and the key's narrowing
(``folder_ids``, ``tools``, ``include_external``). 305's transport resolves one per connection;
306/307/308 re-check it per call with ``principal_liveness.recheck_principal``.

``credential_kind`` is ``'key'`` today. It is a field rather than an assumption so a later
credential (an OAuth grant) can carry the same principal shape without a second consumer contract.

``KeyRefused`` from the resolver core propagates unchanged; 305 maps it onto its transport.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.security import api_key_auth


@dataclass(frozen=True)
class McpPrincipal:
    key_id: str
    user_id: str
    org_id: str
    folder_ids: tuple[str, ...] | None   # None = not narrowed by folder; () = nothing
    tools: tuple[str, ...]
    include_external: bool
    credential_kind: Literal["key"] = "key"
    # 305-03 (D-26): the key's label, so every MCP audit row names the key it was made with.
    label: str | None = None


async def resolve_mcp_principal(presented: str, *, pool, redis) -> McpPrincipal:
    """Authenticate an ``srl_mcp_`` key through the ONE resolver core and return its principal.

    ``call="read"``: an MCP refusal must render as a read in the key's activity strip, never as a
    "start" (``_call_from_audit`` maps start/read only — 304-RESEARCH pitfall 9).
    """
    key = await api_key_auth.authenticate_presented_key(
        presented, pool=pool, redis=redis, call="read", expected_kind="mcp"
    )
    return McpPrincipal(
        key_id=key.id,
        user_id=key.user_id,
        org_id=key.org_id,
        folder_ids=key.folder_ids,
        # An MCP row always carries tools (mig 220 CHECK); a missing list grants nothing.
        tools=tuple(key.tools or ()),
        include_external=key.include_external,
        label=key.label,
    )
