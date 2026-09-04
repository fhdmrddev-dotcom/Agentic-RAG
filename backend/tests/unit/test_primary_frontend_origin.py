"""BUG-260904-04 — FRONTEND_URL is a LIST, and four sites interpolated it raw.

Measured on live production 2026-09-04: every OAuth callback emitted
`Location: https://superrag.cloud,https://agentic-rag-rho.vercel.app/app?...`, whose
authority is `superrag.cloud,https:` — not a host. Every consent landed on an error page.

⚠ These cases are driven against the MULTI-origin value on purpose. A single-origin value
(what every local install and every prior test used) passes even with the defect present,
which is exactly why 225-VALIDATION.md verified all eight redirect sites and still missed it.
"""
import pytest

from app.config import primary_frontend_origin, settings


CLOUD = "https://superrag.cloud,https://agentic-rag-rho.vercel.app"


@pytest.fixture
def frontend_url(monkeypatch):
    def _set(value):
        monkeypatch.setattr(settings, "frontend_url", value, raising=False)
    return _set


def test_multi_origin_yields_only_the_first(frontend_url):
    """THE REGRESSION. RED before the fix: returns the whole comma-joined string."""
    frontend_url(CLOUD)
    assert primary_frontend_origin() == "https://superrag.cloud"


def test_multi_origin_result_has_no_comma(frontend_url):
    """A comma anywhere means the authority is not a host — the actual failure mode."""
    frontend_url(CLOUD)
    assert "," not in primary_frontend_origin()


def test_composed_redirect_is_a_parseable_url(frontend_url):
    """What the callback really builds, checked the way a browser would read it."""
    from urllib.parse import urlparse

    frontend_url(CLOUD)
    parsed = urlparse(f"{primary_frontend_origin()}/app?connections=1&oauth_connected=1")
    assert parsed.scheme == "https"
    assert parsed.netloc == "superrag.cloud"
    assert parsed.path == "/app"


def test_single_origin_is_unchanged(frontend_url):
    """The local shape must not move — this is why the defect was invisible."""
    frontend_url("http://localhost:5173")
    assert primary_frontend_origin() == "http://localhost:5173"


def test_trailing_slash_is_stripped(frontend_url):
    frontend_url("https://superrag.cloud/")
    assert primary_frontend_origin() == "https://superrag.cloud"


def test_whitespace_around_separators_is_tolerated(frontend_url):
    """The runbook shows no spaces, but a human editing a Coolify field adds them."""
    frontend_url("  https://superrag.cloud ,  https://alt.example.com  ")
    assert primary_frontend_origin() == "https://superrag.cloud"


def test_empty_falls_back_rather_than_emitting_a_bare_path(frontend_url):
    frontend_url("")
    assert primary_frontend_origin() == "http://localhost:5173"


def test_leading_comma_does_not_yield_an_empty_origin(frontend_url):
    frontend_url(",https://superrag.cloud")
    assert primary_frontend_origin() == "https://superrag.cloud"
