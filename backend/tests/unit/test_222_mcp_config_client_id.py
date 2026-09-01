"""Phase 222 — an OAuth client id on an MCP row, and the blast radius when it does not fit.

⚠ THIS PINS A DEFECT I SHIPPED INTO A LIVE DATABASE AND THEN HAD TO REPAIR BY HAND, so the
shape is recorded rather than just the fix.

RFC 7591 dynamic registration mints a `client_id` for an MCP connection. Writing it through
the shipped `store_oauth_client_credentials` put that key into an MCP row's `config` — and
every config model here is `extra='forbid'`, so the row matched NO member of the
`ConnectorConfig` union.

⚠ THE CONSEQUENCE WAS NOT LOCAL. `_to_response` validates each row inside the list
comprehension, so ONE unparseable row made **every connection in the org** unreadable: the
API answered 503 and the page read *"Could not load connections. Nothing is wrong with them
— this page could not read them."* That copy was exactly true, which is what made it hard
to place: eight rows were fine and one key on a ninth stopped the projection.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.connector import (
    ConnectorConnectionResponse,
    McpConfig,
)


def test_an_mcp_row_accepts_a_registered_client_id():
    """The direct fix: RFC 7591 mints this, so the model must hold it."""
    cfg = McpConfig(headers={}, custom_client_id="bD78Ksp3xBJew1kL")
    assert cfg.custom_client_id == "bD78Ksp3xBJew1kL"


def test_an_mcp_row_still_refuses_a_client_SECRET_in_config():
    """⚠ THE HALF THAT MUST NOT LOOSEN. `OAuthConnectionConfig` records why
    `custom_client_secret` was removed from `config`: migration 150 measured that column
    readable by every member of the org. Widening this model for an ID must not reopen it
    for a secret."""
    with pytest.raises(ValidationError):
        McpConfig(headers={}, custom_client_secret="super-secret")


def test_the_live_shape_that_broke_the_page_now_validates():
    """The exact `config` this session wrote to the real Notion row, byte for byte."""
    cfg = McpConfig.model_validate({"headers": {}, "custom_client_id": "bD78Ksp3xBJew1kL"})
    assert cfg.headers == {}


def test_a_connection_response_carrying_that_config_validates():
    """⚠ THE ASSERTION THAT ACTUALLY FAILED IN PRODUCTION. `McpConfig` alone passing is not
    enough — the union resolution inside `ConnectorConnectionResponse` is what raised, and a
    test that only built the leaf would have stayed green through the whole outage."""
    row = {
        "id": "1a8ac306-78d1-4398-bee6-86eb85e7ae20",
        "org_id": "22f9c615-0eec-440a-8804-ed4784d6f57f",
        "name": "Notion",
        "service_id": "notion",
        "capability": None,
        "config": {"headers": {}, "custom_client_id": "bD78Ksp3xBJew1kL"},
        "is_enabled": True,
        "mcp_server_url": "https://mcp.notion.com/mcp",
        "auth_type": "mcp",
        "status": "active",
        "created_at": "2026-08-27T00:00:00Z",
        "updated_at": "2026-09-01T00:00:00Z",
    }
    parsed = ConnectorConnectionResponse.model_validate(row)
    assert parsed.name == "Notion"
    # And the response model still refuses to carry a credential (T7).
    assert not hasattr(parsed, "secret_ciphertext")
