"""Phase 168 (SSO — SAML 2.0 CORE), Plan 02 — provider-CRUD proxy + blocklist unit tests.

Gate for the network seam Plan 04 wires: the env-selected transport adapter, the one identical
request body, the provider_id write-back, fail-closed-on-non-2xx, delete-via-API, the public-domain
blocklist, and the never-log-the-token discipline. No real network — httpx.AsyncClient is
monkeypatched with a recording fake; settings + the token read are monkeypatched at the boundary.

asyncio_mode = auto (pytest.ini) — async test fns run without an explicit marker.
"""
from __future__ import annotations

import logging

import httpx
import pytest

from app.config import settings
from app.services import sso_domain_blocklist as blocklist
from app.services import sso_provider_service as sso


# ── recording fake for httpx.AsyncClient (no real network) ───────────────────────────────────────
class _FakeResp:
    def __init__(self, status_code: int = 200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload


class _Recorder:
    """Captures every request the service issues + returns a canned response."""

    def __init__(self, status_code: int = 200, payload=None):
        self.status_code = status_code
        self.payload = payload
        self.calls: list[tuple[str, str, object, object]] = []  # (method, url, json, headers)

    def client_class(self):
        recorder = self

        class _FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def _record(self, method, url, json=None, headers=None):
                recorder.calls.append((method, url, json, headers))
                return _FakeResp(recorder.status_code, recorder.payload)

            async def post(self, url, json=None, headers=None):
                return await self._record("post", url, json, headers)

            async def get(self, url, headers=None):
                return await self._record("get", url, None, headers)

            async def put(self, url, json=None, headers=None):
                return await self._record("put", url, json, headers)

            async def delete(self, url, headers=None):
                return await self._record("delete", url, None, headers)

        return _FakeAsyncClient


def _install_fake_http(monkeypatch, status_code=200, payload=None) -> _Recorder:
    rec = _Recorder(status_code=status_code, payload=payload)
    monkeypatch.setattr(httpx, "AsyncClient", rec.client_class())
    return rec


async def _fake_token() -> str:
    return "sbp_test_token"


def _cloud_settings(monkeypatch, ref="myref"):
    monkeypatch.setattr(settings, "supabase_self_hosted", False)
    monkeypatch.setattr(settings, "supabase_project_ref", ref)
    monkeypatch.setattr(sso, "get_management_token", _fake_token)


def _self_hosted_settings(monkeypatch, url="https://proj.supabase.co", role="svc_role_key"):
    monkeypatch.setattr(settings, "supabase_self_hosted", True)
    monkeypatch.setattr(settings, "supabase_url", url)
    monkeypatch.setattr(settings, "supabase_service_role_key", role)


# ── transport adapter selection ──────────────────────────────────────────────────────────────────
async def test_cloud_adapter_selection(monkeypatch):
    _cloud_settings(monkeypatch, ref="abc123")
    base, headers = await sso._transport()
    assert base == "https://api.supabase.com/v1/projects/abc123/config/auth/sso/providers"
    assert headers == {"Authorization": "Bearer sbp_test_token"}
    assert "apikey" not in headers  # Cloud carries a SINGLE auth header


async def test_self_hosted_adapter_selection(monkeypatch):
    _self_hosted_settings(monkeypatch, url="https://proj.supabase.co", role="svc_role_key")
    base, headers = await sso._transport()
    assert base == "https://proj.supabase.co/auth/v1/admin/sso/providers"
    # Self-hosted needs BOTH headers, both = service_role.
    assert headers["Authorization"] == "Bearer svc_role_key"
    assert headers["apikey"] == "svc_role_key"


# ── identical, sanitized body ────────────────────────────────────────────────────────────────────
def test_build_body_shape_and_claim_sanitization():
    # Caller tries to sneak in email + role + group claims — they MUST be dropped (D-168-03).
    attribute_mapping = {
        "keys": {
            "email": {"name": "mail"},
            "role": {"name": "memberOf"},
            "group": {"name": "groups"},
            "first_name": {"name": "givenName"},
            "last_name": {"name": "sn"},
        }
    }
    body = sso.build_body("https://idp.example.com/metadata", ["example.com"], attribute_mapping)
    assert body["type"] == "saml"
    assert body["metadata_url"] == "https://idp.example.com/metadata"
    assert body["domains"] == ["example.com"]
    assert body["name_id_format"] == "emailAddress"
    # ONLY first_name/last_name — never email/role/group.
    assert set(body["attribute_mapping"]["keys"].keys()) == {"first_name", "last_name"}
    assert "email" not in body["attribute_mapping"]["keys"]
    assert "role" not in body["attribute_mapping"]["keys"]
    assert "group" not in body["attribute_mapping"]["keys"]


async def test_body_identical_across_adapters(monkeypatch):
    # Cloud create.
    _cloud_settings(monkeypatch)
    rec_cloud = _install_fake_http(monkeypatch, status_code=201, payload={"id": "p1"})
    await sso.create_provider("https://idp/m", ["acme.com"])
    cloud_body = rec_cloud.calls[0][2]

    # Self-hosted create.
    _self_hosted_settings(monkeypatch)
    rec_self = _install_fake_http(monkeypatch, status_code=201, payload={"id": "p2"})
    await sso.create_provider("https://idp/m", ["acme.com"])
    self_body = rec_self.calls[0][2]

    assert cloud_body == self_body  # ONE body — only transport differs (D-160 no-code-fork)


# ── create returns provider_id / fail-closed ─────────────────────────────────────────────────────
async def test_create_returns_provider_id(monkeypatch):
    _cloud_settings(monkeypatch, ref="r1")
    rec = _install_fake_http(monkeypatch, status_code=201, payload={"id": "prov-xyz"})
    provider_id = await sso.create_provider("https://idp/m", ["acme.com"])
    assert provider_id == "prov-xyz"
    method, url, body, headers = rec.calls[0]
    assert method == "post"
    assert url == "https://api.supabase.com/v1/projects/r1/config/auth/sso/providers"
    assert body == sso.build_body("https://idp/m", ["acme.com"])


async def test_create_fails_closed_on_4xx(monkeypatch):
    _cloud_settings(monkeypatch)
    _install_fake_http(monkeypatch, status_code=401, payload={"error": "unauthorized"})
    with pytest.raises(sso.SsoProviderError) as exc:
        await sso.create_provider("https://idp/m", ["acme.com"])
    assert exc.value.status_code == 401


async def test_create_fails_closed_when_no_id(monkeypatch):
    _cloud_settings(monkeypatch)
    _install_fake_http(monkeypatch, status_code=200, payload={})  # 2xx but no id
    with pytest.raises(sso.SsoProviderError):
        await sso.create_provider("https://idp/m", ["acme.com"])


# ── delete goes through the provider-CRUD API (never orphan the GoTrue provider) ─────────────────
async def test_delete_calls_provider_api(monkeypatch):
    _cloud_settings(monkeypatch, ref="r2")
    rec = _install_fake_http(monkeypatch, status_code=204, payload={})
    await sso.delete_provider("prov-1")
    method, url, body, headers = rec.calls[0]
    assert method == "delete"
    assert url == "https://api.supabase.com/v1/projects/r2/config/auth/sso/providers/prov-1"


async def test_delete_fails_closed_on_4xx(monkeypatch):
    _cloud_settings(monkeypatch)
    _install_fake_http(monkeypatch, status_code=404, payload={})
    with pytest.raises(sso.SsoProviderError):
        await sso.delete_provider("missing")


# ── public-domain blocklist ──────────────────────────────────────────────────────────────────────
def test_is_public_domain():
    assert blocklist.is_public_domain("gmail.com") is True
    assert blocklist.is_public_domain("outlook.com") is True
    assert blocklist.is_public_domain("acme.com") is False
    # case-insensitive
    assert blocklist.is_public_domain("GMAIL.COM") is True
    assert blocklist.is_public_domain("  Yahoo.Com  ") is True
    # non-domain inputs are not "public"
    assert blocklist.is_public_domain("") is False
    assert blocklist.is_public_domain(None) is False  # type: ignore[arg-type]


# ── token decrypt-at-call-time + never-logged ────────────────────────────────────────────────────
async def test_management_token_decrypts_at_call_time(monkeypatch):
    from cryptography.fernet import Fernet

    from app.security import secret_cipher

    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "secrets_encryption_key", key)
    cipher = secret_cipher.get_cipher()
    enc = secret_cipher.encrypt_secret("sbp_real_secret", cipher)

    async def _fake_load():
        return {"supabase_management_token": enc}

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake_load)
    token = await sso.get_management_token()
    assert token == "sbp_real_secret"


async def test_management_token_missing_fails_closed(monkeypatch):
    async def _empty_load():
        return {}

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _empty_load)
    with pytest.raises(sso.SsoProviderError):
        await sso.get_management_token()


async def test_management_token_never_logged(monkeypatch, caplog):
    # Plaintext-at-rest path (no master key) so the raw value flows through get_management_token.
    secret = "sbp_do_not_log_me_1234567890"

    async def _fake_load():
        return {"supabase_management_token": secret}

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake_load)
    monkeypatch.setattr(settings, "supabase_self_hosted", False)
    monkeypatch.setattr(settings, "supabase_project_ref", "r3")
    _install_fake_http(monkeypatch, status_code=201, payload={"id": "p"})

    with caplog.at_level(logging.DEBUG):
        provider_id = await sso.create_provider("https://idp/m", ["acme.com"])
    assert provider_id == "p"
    # The token must appear in NO log record (message or args) emitted anywhere during the call.
    assert secret not in caplog.text
    for record in caplog.records:
        assert secret not in record.getMessage()
