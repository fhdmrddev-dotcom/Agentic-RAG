"""Phase 239 (D-239-01 / TM-239-04) — `source_tools` on an MCP row, and the blast radius.

⚠ THIS IS THE SAME DEFECT SHAPE PHASE 222 SHIPPED INTO A LIVE DATABASE, one key over, and it
is fenced BEFORE the key is ever written rather than after an outage. Read
`test_222_mcp_config_client_id.py` first — it records the measured incident.

D-239-01 stores MCP tool bindings as DATA on `connector_connections.config`:

    {"source_tools": {"list_tool": "list_directory", "read_tool": "read_file"}}

Every config model in `app.models.connector` is `extra='forbid'`. So the instant the first
connection is bound to a file surface, that row matches NO member of the `ConnectorConfig`
union — and because `_to_response` validates each row INSIDE a list comprehension, ONE such
row makes **every connection in the org** unreadable (503, *"Could not load connections"*).

⭐ DRIVEN RED BEFORE THE FIX, at `69a8da589`:

    pydantic_core._pydantic_core.ValidationError: 1 validation error for McpConfig
    source_tools
      Extra inputs are not permitted [type=extra_forbidden,
        input_value={'list_tool': 'list_dir', 'read_tool': 'cat'}, input_type=dict]

A fence nobody has seen fire is not a fence.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.connector import ConnectorConnectionResponse, McpConfig


def test_an_mcp_row_accepts_source_tool_bindings():
    """The direct fix. D-239-01's binding is data on the existing JSONB column."""
    cfg = McpConfig(source_tools={"list_tool": "list_directory", "read_tool": "read_file"})
    assert cfg.source_tools == {"list_tool": "list_directory", "read_tool": "read_file"}


def test_absent_source_tools_stays_absent():
    """⚠ `None`, never `{}`. Absence means *"nobody bound this connection to a file surface"*,
    and an empty dict would claim somebody looked and found nothing. The adapter's defaults
    only apply once a row is source-bound at all."""
    assert McpConfig().source_tools is None


def test_a_second_server_with_completely_different_tool_names_is_just_a_ROW():
    """⭐ THE PHASE'S WHOLE CLAIM, asserted at the layer that stores it.

    `ls`/`cat` is not a name this codebase knows. If adding a second, differently-worded MCP
    file server needed a code change, it would show up HERE first — as a model that only
    accepts the vocabulary somebody already thought of."""
    cfg = McpConfig(source_tools={"list_tool": "ls", "read_tool": "cat"})
    assert cfg.source_tools == {"list_tool": "ls", "read_tool": "cat"}


def test_source_tools_values_must_be_strings():
    """A tool NAME is a string. A nested object here would reach `call_tool`'s `tool_name`
    and be interpolated into a JSON-RPC `params.name` — so the model refuses the shape
    rather than letting the transport discover it."""
    with pytest.raises(ValidationError):
        McpConfig(source_tools={"list_tool": {"nested": "object"}})


def test_widening_for_source_tools_did_not_reopen_the_secret_hole():
    """⚠ THE HALF THAT MUST NOT LOOSEN. Migration 150 measured `config` readable by every
    member of the org (`has_column_privilege('authenticated', …, 'config', 'SELECT')` TRUE).
    Widening this model for a tool NAME must not widen it for a credential."""
    with pytest.raises(ValidationError):
        McpConfig(source_tools={"list_tool": "ls"}, custom_client_secret="super-secret")


def test_a_connection_response_carrying_source_tools_validates():
    """⚠ THE ASSERTION THAT ACTUALLY MATTERS, and the one Phase 222 proved a leaf test cannot
    replace. `McpConfig` passing alone is not enough — the UNION resolution inside
    `ConnectorConnectionResponse` is what raised during the live outage, and a test that only
    built the leaf stayed green through all of it."""
    row = {
        "id": "3b1f0c22-4d5e-4a77-9c31-0f2b7a6de901",
        "org_id": "22f9c615-0eec-440a-8804-ed4784d6f57f",
        "name": "Filesystem",
        "service_id": "custom_mcp",
        "capability": None,
        "config": {
            "headers": {},
            "source_tools": {"list_tool": "list_directory", "read_tool": "read_file"},
        },
        "is_enabled": True,
        "mcp_server_url": "https://files.example.com/mcp",
        "auth_type": "mcp",
        "status": "active",
    }
    parsed = ConnectorConnectionResponse.model_validate(row)
    assert parsed.config.source_tools == {
        "list_tool": "list_directory",
        "read_tool": "read_file",
    }
    assert not hasattr(parsed, "secret_ciphertext")


def test_ONE_source_bound_row_does_not_take_the_whole_org_down():
    """⭐ THE OUTAGE SHAPE ITSELF, not a proxy for it.

    `_to_response` validates each row inside a list comprehension, so the failure mode is not
    *"one row is unreadable"* — it is *"the list raises"*. This drives the list, mixing a
    source-bound MCP row in with ordinary ones, exactly as the live table would."""
    base = {
        "org_id": "22f9c615-0eec-440a-8804-ed4784d6f57f",
        "status": "active",
        "is_enabled": True,
    }
    rows = [
        {**base, "id": "r1", "name": "Slack", "service_id": "slack",
         "capability": "post_message", "config": {}},
        {**base, "id": "r2", "name": "Notion", "service_id": "notion", "capability": None,
         "auth_type": "mcp", "mcp_server_url": "https://mcp.notion.com/mcp",
         "config": {"headers": {}, "custom_client_id": "bD78Ksp3xBJew1kL"}},
        {**base, "id": "r3", "name": "Filesystem", "service_id": "custom_mcp",
         "capability": None, "auth_type": "mcp",
         "mcp_server_url": "https://files.example.com/mcp",
         "config": {"source_tools": {"list_tool": "ls", "read_tool": "cat"}}},
    ]
    parsed = [ConnectorConnectionResponse.model_validate(r) for r in rows]
    assert [p.name for p in parsed] == ["Slack", "Notion", "Filesystem"]
