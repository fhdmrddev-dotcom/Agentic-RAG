"""Phase 248 (CRED-01) — The connector credential boundary test suite.

Fences:
1. Negative credential-smell validation on custom_client_id across McpConfig,
   OAuthConnectionConfig, and OAuthAuthorizeRequest (CRED-01):
   - Over-length (>128 chars) rejected with ValidationError.
   - Microsoft Entra client secret format (<prefix>~<body>) rejected with ValidationError.
   - Known secret/token prefixes (sk-, ghp-, xoxb-, xoxp-, secret_, whsec_, etc.) rejected.
   - Secret strings are NEVER echoed in ValidationError messages (TM-248-06).
   - Clean client IDs (UUID, Google client ID, RFC 7591 dynamic mcp_client_12345, None) pass.
2. Read-path resilience (SEED-239 / TM-248-05):
   - connector_service._to_response catches ValidationError on malformed config rows and
     degrades safely to status="error" without failing the entire org's connection listing.
3. Dual-role database access against real PostgreSQL (D-248-04):
   - Real SQL queries executed under SET ROLE authenticated and SET ROLE anon.
   - Under authenticated: non-secret columns can be selected; secret_ciphertext raises 42501.
   - Under anon: table access raises 42501 (InsufficientPrivilege).
"""

from __future__ import annotations

import os
import psycopg2
import pytest
from pydantic import ValidationError

from app.models.connector import (
    McpConfig,
    OAuthAuthorizeRequest,
    OAuthConnectionConfig,
    CustomClientId,
)
from app.services.connector_service import _to_response


# ─────────────────────────────────────────────────────────────────────────────
# 1 · Negative credential-smell validation (unit tests, no DB required)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad_client_id", [
    # Over 128 characters
    "a" * 129,
    "mcp-client-" + "x" * 120,
    # Microsoft Entra ID client secret smell (<prefix>~<body>)
    "abc8Q~1234567890abcdef1234567890abcdef123",
    "xyz~verylongsecretpayloadfromazureportalhere",
    "foo~bar",
    # Known secret prefixes
    "sk-proj-1234567890abcdef",
    "SK-PROJ-CAPS-CHECK",
    "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
    "gho_1234567890abcdefghijklmnopqrstuvwxyz",
    "xoxb-1234567890-1234567890",
    "xoxp-1234567890-1234567890",
    "secret_live_abcdef123456",
    "whsec_webhooksigningsecret12345",
    "client_secret_pasted_here",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
])
def test_custom_client_id_rejects_credential_smells(bad_client_id: str):
    """CRED-01: custom_client_id refuses tokens, Entra secrets, and over-length inputs."""
    # 1. McpConfig
    with pytest.raises(ValidationError) as exc_info_mcp:
        McpConfig(headers={}, custom_client_id=bad_client_id)
    # TM-248-06: Error message must NEVER echo the secret
    assert bad_client_id not in exc_info_mcp.value.errors()[0]["msg"]

    # 2. OAuthConnectionConfig
    with pytest.raises(ValidationError) as exc_info_oauth:
        OAuthConnectionConfig(provider="google", custom_client_id=bad_client_id)
    assert bad_client_id not in exc_info_oauth.value.errors()[0]["msg"]

    # 3. OAuthAuthorizeRequest
    with pytest.raises(ValidationError) as exc_info_req:
        OAuthAuthorizeRequest(provider="google", custom_client_id=bad_client_id)
    assert bad_client_id not in exc_info_req.value.errors()[0]["msg"]


def test_custom_client_id_length_specific_message():
    """Verify that length > 128 raises our specific custom error message."""
    with pytest.raises(ValidationError) as exc_info:
        McpConfig(headers={}, custom_client_id="a" * 129)
    err_msg = exc_info.value.errors()[0]["msg"]
    assert "exceeds maximum length of 128 characters" in err_msg


@pytest.mark.parametrize("valid_client_id", [
    None,
    "12345678-1234-1234-1234-123456789abc",
    "12345.apps.googleusercontent.com",
    "client-abc-123",
    "bD78Ksp3xBJew1kL",
    "mcp_client_rfc7591_dynamic",
    "my_custom_client_id",
])
def test_custom_client_id_accepts_valid_identifiers(valid_client_id: str | None):
    """CRED-01: Legitimate client IDs and RFC 7591 dynamic client IDs pass cleanly."""
    # McpConfig
    mcp = McpConfig(headers={}, custom_client_id=valid_client_id)
    assert mcp.custom_client_id == valid_client_id

    # OAuthConnectionConfig
    oauth = OAuthConnectionConfig(provider="google", custom_client_id=valid_client_id)
    assert oauth.custom_client_id == valid_client_id

    # OAuthAuthorizeRequest
    req = OAuthAuthorizeRequest(provider="google", custom_client_id=valid_client_id)
    assert req.custom_client_id == valid_client_id


# ─────────────────────────────────────────────────────────────────────────────
# 2 · Read-path resilience on malformed rows (SEED-239 / TM-248-05)
# ─────────────────────────────────────────────────────────────────────────────

def test_to_response_degrades_safely_on_invalid_stored_config():
    """SEED-239: A stored row violating custom_client_id validation must NOT crash list_connections."""
    malformed_row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "org_id": "22222222-2222-2222-2222-222222222222",
        "service_id": "notion",
        "name": "Malformed Connection",
        "auth_type": "static_key",
        "status": "active",
        "config": {
            "headers": {},
            # Trips the Entra smell validator
            "custom_client_id": "abc~secret_pasted_into_client_id_column",
        },
    }

    resp = _to_response(malformed_row)
    assert resp.id == malformed_row["id"]
    assert resp.name == malformed_row["name"]
    # Safely degraded rather than failing with 503
    assert resp.status == "error"
    assert resp.error_message is not None
    # ⚠ Phase 252 / D-13 re-worded this sentence. It used to read *"Connection configuration
    #   requires update (validation failed)"*, which named nothing a person could act on; the
    #   repair path existed structurally all along and was simply never stated. The PROPERTY
    #   this test guards is unchanged — one bad row degrades instead of 503-ing the org — so
    #   the assertion moves to the repair the row now names, never the value it holds.
    assert "application id" in resp.error_message.lower()
    assert "settings" in resp.error_message.lower()
    assert malformed_row["config"]["custom_client_id"] not in resp.error_message


# ─────────────────────────────────────────────────────────────────────────────
# 3 · Dual-role real PostgreSQL query tests (D-248-04)
# ─────────────────────────────────────────────────────────────────────────────

_DSN = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
_INSUFFICIENT_PRIVILEGE = "42501"


def _pg_available() -> bool:
    try:
        conn = psycopg2.connect(_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _pg_available(), reason="PostgreSQL not available on :54322")
class TestDualRoleDatabasePrivileges:
    """Real database execution tests confirming column and table privilege boundaries."""

    @pytest.fixture()
    def db_conn(self):
        conn = psycopg2.connect(_DSN)
        conn.autocommit = True
        try:
            yield conn
        finally:
            conn.close()

    def test_authenticated_cannot_select_secret_ciphertext(self, db_conn):
        """Under SET ROLE authenticated, selecting secret_ciphertext raises 42501."""
        cur = db_conn.cursor()
        try:
            cur.execute("SET ROLE authenticated")
            # Non-secret column query must succeed (subject to RLS)
            cur.execute("SELECT id, name, config FROM connector_connections LIMIT 1")
            cur.fetchall()

            # Secret column query MUST raise InsufficientPrivilege (42501)
            with pytest.raises(psycopg2.Error) as exc_info:
                cur.execute("SELECT secret_ciphertext FROM connector_connections LIMIT 1")
            assert exc_info.value.pgcode == _INSUFFICIENT_PRIVILEGE
        finally:
            cur.execute("RESET ROLE")
            cur.close()

    def test_anon_cannot_select_connector_connections(self, db_conn):
        """Under SET ROLE anon, querying connector_connections raises 42501."""
        cur = db_conn.cursor()
        try:
            cur.execute("SET ROLE anon")
            with pytest.raises(psycopg2.Error) as exc_info:
                cur.execute("SELECT id FROM connector_connections LIMIT 1")
            assert exc_info.value.pgcode == _INSUFFICIENT_PRIVILEGE
        finally:
            cur.execute("RESET ROLE")
            cur.close()
