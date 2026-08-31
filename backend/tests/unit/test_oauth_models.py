"""Phase 215 (OAUTH-01, OAUTH-02) — Unit tests for OAuth Pydantic models."""
import pytest
from pydantic import ValidationError

from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthConnectionConfig,
    OAuthTokenResponse,
)


def test_oauth_token_response_forbids_ciphertext_fields():
    """T7 gate: OAuthTokenResponse must NEVER accept or expose ciphertext fields."""
    with pytest.raises(ValidationError) as exc:
        OAuthTokenResponse(
            id="tok-1",
            connection_id="conn-1",
            access_token_ciphertext="enc:v1:secret",
            expires_at="2026-08-30T12:00:00Z",
        )
    assert "extra_forbidden" in str(exc.value)


def test_oauth_token_response_valid():
    """OAuthTokenResponse constructs cleanly with safe public fields."""
    resp = OAuthTokenResponse(
        id="tok-1",
        connection_id="conn-1",
        account_email="alex@company.com",
        account_name="Alex Developer",
        token_type="Bearer",
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
        expires_at="2026-08-30T12:00:00Z",
        status="active",
    )
    assert resp.account_email == "alex@company.com"
    assert resp.status == "active"
    assert "access_token" not in resp.model_dump()


def test_oauth_connection_config_valid():
    """OAuthConnectionConfig validates provider and optional overrides."""
    config = OAuthConnectionConfig(
        provider="google",
        custom_client_id="my-google-app-id",

        scopes=["drive.readonly", "gmail.send"],
    )
    assert config.provider == "google"
    assert config.custom_client_id == "my-google-app-id"
    assert len(config.scopes) == 2


def test_connector_connection_response_with_oauth():
    """ConnectorConnectionResponse includes auth_type, status, and account info."""
    resp = ConnectorConnectionResponse(
        id="conn-123",
        org_id="org-default",
        service_id="google-drive",
        name="Team Google Drive",
        auth_type="oauth_byo",
        status="active",
        account_email="admin@acme.org",
        account_name="Acme Admin",
    )
    assert resp.auth_type == "oauth_byo"
    assert resp.status == "active"
    assert resp.account_email == "admin@acme.org"


def test_oauth_authorize_request_and_response():
    """OAuthAuthorizeRequest & Response validate properly."""
    req = OAuthAuthorizeRequest(
        provider="microsoft",
        connection_id="conn-ms-1",
        custom_client_id="ms-client-123",
        custom_scopes=["Files.Read.All", "offline_access"],
    )
    assert req.provider == "microsoft"

    res = OAuthAuthorizeResponse(
        authorization_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=ms-client-123",
        state="signed-state-token-123",
    )
    assert "https://login.microsoftonline.com" in res.authorization_url
    assert res.state == "signed-state-token-123"

def test_a_client_secret_is_unconstructable_inside_config():
    """The module's own contract, quoted from migration 116's COMMENT ON COLUMN:
    "No token, no password, no API key ever lands here". The per-capability
    `extra='forbid'` models exist so that a password key in `config` is UNCONSTRUCTABLE
    rather than merely discouraged — and Phase 215 declared one anyway.

    Measured 2026-08-31 on the live database: `config` IS SELECT-granted to
    `authenticated` while `secret_ciphertext` is not, so a client secret written there
    was returned to every member of the org by the ordinary connections list. It now
    lives in `oauth_client_secret_ciphertext` (migration 150), encrypted and ungranted.

    This test is the fence: the model must REFUSE the key, so the exposure cannot come
    back as a one-line field addition.
    """
    import pytest
    from pydantic import ValidationError

    from app.models.connector import OAuthConnectionConfig

    with pytest.raises(ValidationError):
        OAuthConnectionConfig(provider="google", custom_client_secret="leaked")

    assert "custom_client_secret" not in OAuthConnectionConfig.model_fields
    # The id is NOT a secret and deliberately stays: it travels in the authorization URL,
    # through the browser, in the address bar.
    assert "custom_client_id" in OAuthConnectionConfig.model_fields
