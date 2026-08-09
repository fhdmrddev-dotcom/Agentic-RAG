"""Phase 168 (SSO — SAML 2.0 CORE), Plan 02 — the provider-CRUD proxy (ONE service, TWO adapters).

Supabase Auth IS the SAML SP. Every SSO endpoint (Plan 04) calls THIS service to make ONE
authenticated HTTP call per operation to Supabase's provider-CRUD API and get back the GoTrue
provider UUID. The Cloud Management API and the self-hosted GoTrue Admin API share the SAME
request/response body — only the base URL + auth headers differ — so this is one service with two
thin transport adapters selected by env (honoring the Phase-160 4-tier no-code-fork contract, D-160).

Async, non-blocking: every HTTP call goes through ``httpx.AsyncClient`` inside ``async with`` — the
``model_discovery_service.py`` idiom — NEVER a blocking ``httpx.Client``/``requests`` call inside an
async function (CLAUDE.md: "no blocking I/O in async handlers").

Fail-closed: any non-2xx from the provider-CRUD API raises ``SsoProviderError`` (T-168-05a); the
caller (Plan 04) maps it to an HTTPException and writes NO ``sso_configs`` row for a connection that
was not actually created. ``delete_provider`` issues the provider-CRUD DELETE FIRST so a GoTrue
provider is never orphaned (T-168-09).

Secret discipline (T-168-04): the Cloud ``sbp_`` management token is decrypted (Phase-150 cipher)
ONLY at call time and NEVER logged — log lines carry the column NAME / operation / status only, per
``secret_cipher`` discipline. ``attribute_mapping`` is sanitized to first_name/last_name ONLY — email
is auto-detected and a role/group claim is never mapped (D-168-03, the SSO escalation footgun).
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.security.secret_cipher import decrypt_secret, get_cipher, is_encrypted

logger = logging.getLogger(__name__)

# The app_settings column holding the encrypted Cloud Management/PAT (sbp_) token (mig 113; added to
# secret_cipher.SECRET_COLUMNS in Task 1 so the boot sweep encrypts it at rest generically).
_MGMT_TOKEN_COLUMN = "supabase_management_token"

# Per-call HTTP timeout. Provider-CRUD talks to GoTrue (which may fetch the IdP metadata URL); keep
# it bounded so a hung upstream never wedges the request path.
_HTTP_TIMEOUT = 10.0

# Attribute-mapping allowlist (D-168-03): map ONLY first_name/last_name. email is auto-detected by
# GoTrue (never mapped); a role/group claim is NEVER mapped — attribute-driven role elevation is the
# SSO escalation footgun (every JIT membership is 'member'). Callers may override the SOURCE
# attribute name for these two claims; anything else in the incoming mapping is dropped.
_ALLOWED_CLAIM_KEYS: tuple[str, ...] = ("first_name", "last_name")
_DEFAULT_CLAIM_SOURCE: dict[str, str] = {"first_name": "givenName", "last_name": "sn"}


class SsoProviderError(Exception):
    """A provider-CRUD call failed (a non-2xx response, or a missing/undecryptable mgmt token).

    Carries the upstream ``status_code`` when the failure was an HTTP response so Plan 04 can map it
    to a clean HTTPException. Fail-closed: on this error the caller MUST NOT write ``sso_configs``.
    """

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


async def get_management_token() -> str:
    """Return the decrypted Cloud ``sbp_`` management token — call-time only, NEVER logged.

    Reads the raw ``app_settings`` row via the same asyncpg-backed 30s-TTL seam Phase 150 reads
    secrets from, then strips the ``enc:v1:`` envelope with the Phase-150 cipher. Fails closed
    (``SsoProviderError``) when the token is unset or cannot be decrypted. Logs by COLUMN NAME only —
    never the value/token.
    """
    from app.models.user_settings import _load_settings_from_db  # lazy — avoid an import cycle

    row = await _load_settings_from_db()
    raw = row.get(_MGMT_TOKEN_COLUMN) if isinstance(row, dict) else None
    if not isinstance(raw, str) or not raw:
        logger.error(
            "sso_provider_service: %s is not configured — cannot authenticate to the Cloud "
            "Management API (fail closed)", _MGMT_TOKEN_COLUMN,
        )
        raise SsoProviderError(
            "Supabase management token is not configured (app_settings.supabase_management_token)"
        )
    if is_encrypted(raw):
        cipher = get_cipher()
        if cipher is None:
            logger.error(
                "sso_provider_service: %s is encrypted but no SECRETS_ENCRYPTION_KEY is configured "
                "— cannot decrypt (fail closed)", _MGMT_TOKEN_COLUMN,
            )
            raise SsoProviderError(
                "management token is encrypted but SECRETS_ENCRYPTION_KEY is not configured"
            )
        return decrypt_secret(raw, cipher)
    # No envelope: the value is plaintext at rest (fail-open D-150-01 — no master key). Return as-is.
    return raw


async def _transport() -> tuple[str, dict[str, str]]:
    """Select ``(base_url, headers)`` by env — the ONE code-fork-free adapter switch (D-160).

    * self-hosted: GoTrue Admin API under the project origin, BOTH ``Authorization`` + ``apikey`` =
      service_role (already in config; no management token needed).
    * Cloud (default): the Management API under ``api.supabase.com``, a SINGLE
      ``Authorization: Bearer <sbp_ token>`` header (decrypted at call time).
    """
    if settings.supabase_self_hosted:
        key = settings.supabase_service_role_key
        base = f"{settings.supabase_url}/auth/v1/admin/sso/providers"
        return base, {"Authorization": f"Bearer {key}", "apikey": key}
    base = (
        f"https://api.supabase.com/v1/projects/"
        f"{settings.supabase_project_ref}/config/auth/sso/providers"
    )
    token = await get_management_token()
    return base, {"Authorization": f"Bearer {token}"}


def build_body(
    metadata_url: str,
    domains: list[str],
    attribute_mapping: dict | None = None,
) -> dict:
    """Build the IDENTICAL provider-CRUD create/update body used by BOTH adapters.

    ``attribute_mapping`` is sanitized to first_name/last_name ONLY (D-168-03): email is auto-detected
    (never mapped) and any role/group claim is dropped — attribute-driven role elevation is the SSO
    escalation surface. A caller may override the SOURCE attribute name for first_name/last_name;
    every other incoming key is ignored.
    """
    incoming: dict = {}
    if isinstance(attribute_mapping, dict):
        maybe = attribute_mapping.get("keys")
        if isinstance(maybe, dict):
            incoming = maybe
    keys: dict[str, dict] = {}
    for claim in _ALLOWED_CLAIM_KEYS:
        override = incoming.get(claim)
        if isinstance(override, dict) and override.get("name"):
            keys[claim] = {"name": str(override["name"])}
        else:
            keys[claim] = {"name": _DEFAULT_CLAIM_SOURCE[claim]}
    return {
        "type": "saml",
        "metadata_url": metadata_url,
        "domains": list(domains),
        "attribute_mapping": {"keys": keys},
        "name_id_format": "emailAddress",
    }


def _raise_for_status(resp: httpx.Response, op: str) -> None:
    """Fail closed on any non-2xx. Logs op + status ONLY — never the token / headers / body."""
    if resp.status_code >= 400:
        logger.error(
            "sso_provider_service: provider-CRUD %s failed (status %s)", op, resp.status_code
        )
        raise SsoProviderError(
            f"provider-CRUD {op} failed (status {resp.status_code})",
            status_code=resp.status_code,
        )


async def create_provider(
    metadata_url: str,
    domains: list[str],
    attribute_mapping: dict | None = None,
) -> str:
    """Create a SAML provider; return the GoTrue provider UUID (written to sso_configs.provider_id).

    Fail-closed: a non-2xx (or a 2xx that carries no id) raises ``SsoProviderError`` and returns no
    id, so the caller never writes ``sso_configs`` for a connection that was not created.
    """
    base, headers = await _transport()
    body = build_body(metadata_url, domains, attribute_mapping)
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(base, json=body, headers=headers)
    _raise_for_status(resp, "create")
    provider_id = (resp.json() or {}).get("id")
    if not provider_id:
        logger.error("sso_provider_service: provider-CRUD create returned no provider id")
        raise SsoProviderError("provider-CRUD create returned no provider id")
    return provider_id


async def list_providers() -> list[dict]:
    """List the project's SAML providers (the raw provider objects). Fail-closed on non-2xx."""
    base, headers = await _transport()
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(base, headers=headers)
    _raise_for_status(resp, "list")
    data = resp.json()
    if isinstance(data, dict):
        items = data.get("items") or data.get("providers")
        return items if isinstance(items, list) else []
    return data if isinstance(data, list) else []


async def update_provider(
    provider_id: str,
    metadata_url: str,
    domains: list[str],
    attribute_mapping: dict | None = None,
) -> dict:
    """Update a SAML provider by id; return the updated provider object. Fail-closed on non-2xx."""
    base, headers = await _transport()
    body = build_body(metadata_url, domains, attribute_mapping)
    url = f"{base}/{provider_id}"
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.put(url, json=body, headers=headers)
    _raise_for_status(resp, "update")
    return resp.json() or {}


async def delete_provider(provider_id: str) -> None:
    """Delete the GoTrue provider via the provider-CRUD API FIRST (never orphan it — T-168-09).

    Fail-closed on non-2xx: the caller keeps the ``sso_configs`` row and surfaces the error rather
    than deleting a row while the GoTrue provider still routes a domain.
    """
    base, headers = await _transport()
    url = f"{base}/{provider_id}"
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.delete(url, headers=headers)
    _raise_for_status(resp, "delete")


__all__ = [
    "SsoProviderError",
    "get_management_token",
    "build_body",
    "create_provider",
    "list_providers",
    "update_provider",
    "delete_provider",
]
