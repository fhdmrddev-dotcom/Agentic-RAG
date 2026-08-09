"""Phase 168 secure-phase gap-closure — T-168-11 / WR-02: metadata_url SSRF boundary guard.

`SsoProviderBody._validate_metadata_url` (app/api/org.py) is the single choke point before any
provider-CRUD call. GoTrue fetches the metadata URL server-side, so on the self-hosted tier an
authenticated `sso:manage` org-admin could otherwise aim GoTrue at internal/loopback targets.
These tests pin the guard: only public https URLs pass; non-https schemes and loopback /
link-local / RFC-1918 / reserved hosts (and `localhost`) are rejected at model construction.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.org import SsoProviderBody


def _build(url: str) -> SsoProviderBody:
    return SsoProviderBody(metadata_url=url, email_domain="acme.com")


@pytest.mark.parametrize(
    "url",
    [
        "https://idp.acme.com/saml/metadata",
        "https://login.microsoftonline.com/abc/federationmetadata/2007-06/federationmetadata.xml",
        "https://8.8.8.8/metadata",  # public IP literal is allowed
    ],
)
def test_public_https_metadata_url_accepted(url: str):
    assert _build(url).metadata_url == url


@pytest.mark.parametrize(
    "url",
    [
        "http://idp.acme.com/metadata",          # non-https scheme
        "file:///etc/passwd",                     # file scheme
        "ftp://idp.acme.com/metadata",            # non-https scheme
        "https://127.0.0.1/metadata",             # loopback
        "https://localhost/metadata",             # localhost name
        "https://sub.localhost/metadata",         # .localhost suffix
        "https://169.254.169.254/latest/meta-data",  # cloud metadata / link-local
        "https://10.0.0.5/metadata",              # RFC-1918
        "https://172.16.4.2/metadata",            # RFC-1918
        "https://192.168.1.10/metadata",          # RFC-1918
        "https://[::1]/metadata",                 # IPv6 loopback
        "https://[fe80::1]/metadata",             # IPv6 link-local
        "https://0.0.0.0/metadata",               # unspecified
        "not-a-url",                              # no scheme/host
        "",                                       # empty
    ],
)
def test_ssrf_and_malformed_metadata_url_rejected(url: str):
    with pytest.raises(ValidationError):
        _build(url)
