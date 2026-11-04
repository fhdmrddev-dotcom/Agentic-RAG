"""Phase 308-02 (D-27 / D-46 / D-51; T-308-04, T-308-15) — the URL rules, in ONE pure module.

``check_webhook_url`` is used by the route validator (308-04) AND re-asserted by the sender before
every send (D-46): egress reads ``.host`` only, so ``https://user:pw@host/`` passes egress and httpx
would send Basic auth. ``admin_display`` is what an org admin sees: host and a masked path, never the
query (receiver tokens live in Zapier/Slack-style paths and in queries).
"""
from __future__ import annotations

import ast
import inspect

import pytest

from app.services import webhook_urls
from app.services.webhook_urls import (
    MAX_URL_LENGTH,
    PATH_HIDDEN,
    WebhookUrlError,
    admin_display,
    check_webhook_url,
    display_host,
    host_of,
)


@pytest.mark.parametrize("url", [
    "https://hooks.example.com/syrel",
    "https://hooks.example.com:8443/a?token=x",
    "https://hooks.example.com",
])
def test_good_urls_are_returned_unchanged(url):
    assert check_webhook_url(url) == url


def test_the_url_is_never_normalised():
    url = "https://Hooks.Example.com/Path/?b=2&a=1"
    assert check_webhook_url(url) == url


def test_max_length_is_2048():
    assert MAX_URL_LENGTH == 2048
    base = "https://hooks.example.com/"
    exact = base + "a" * (MAX_URL_LENGTH - len(base))
    assert check_webhook_url(exact) == exact


@pytest.mark.parametrize("url, code", [
    ("http://hooks.example.com/syrel", "not_https"),
    ("ftp://hooks.example.com/syrel", "not_https"),
    ("hooks.example.com/syrel", "not_https"),
    ("https://hooks.example.com/" + "a" * (MAX_URL_LENGTH - 25), "too_long"),
    ("https://u:p@hooks.example.com/x", "userinfo"),
    ("https://u@hooks.example.com/", "userinfo"),
    ("https://:p@hooks.example.com/", "userinfo"),
    ("https://hooks.example.com/x#f", "fragment"),
    ("https://hooks.example.com/x#", "fragment"),
    ("https://", "not_url"),
    ("https://hooks.example.com/a b", "not_url"),
    (" https://hooks.example.com/a", "not_url"),
    ("https://hooks.example.com/a\n", "not_url"),
    ("https://hooks.example.com/a\x00", "not_url"),
    ("https://hooks.example.com/a\x7f", "not_url"),
    ("https://hooks.example.com/a\t", "not_url"),
    ("https://0177.0.0.1/", "not_url"),
    ("https://[::1/", "not_url"),
    ("https://hooks.example.com:99999/", "not_url"),
    ("", "not_url"),
    ("https:///path", "no_host"),
    ("https://:443/path", "no_host"),
])
def test_bad_urls_are_refused_with_a_code(url, code):
    with pytest.raises(WebhookUrlError) as err:
        check_webhook_url(url)
    assert err.value.code == code
    assert isinstance(err.value, ValueError)


def test_a_too_long_url_is_too_long_even_when_otherwise_good():
    url = "https://hooks.example.com/" + "a" * MAX_URL_LENGTH
    assert len(url) > MAX_URL_LENGTH
    with pytest.raises(WebhookUrlError) as err:
        check_webhook_url(url)
    assert err.value.code == "too_long"


def test_the_error_never_carries_the_url():
    secret_url = "https://u:hunter2@hooks.example.com/x"
    with pytest.raises(WebhookUrlError) as err:
        check_webhook_url(secret_url)
    assert "hunter2" not in str(err.value)
    assert "hooks.example.com" not in str(err.value)


def test_host_of_is_lower_cased_and_portless():
    assert host_of("https://Hooks.Example.com:8443/x") == "hooks.example.com"
    assert host_of("https://hooks.example.com/x") == "hooks.example.com"


# ── CR-01 / D-59: the admin view shows the HOST only, plus a neutral "path hidden" marker ─────────
#
# D-51 masked path segments of 16+ characters. Measured by the 308 review: a real Zapier catch hook
# (``/hooks/catch/<7-digit id>/<7-char token>/``) has no segment that long, so the whole working
# capability URL reached every org admin. A length rule cannot know which segment is the token, so
# no path segment is shown at all.


def test_admin_display_hides_a_zapier_catch_hook_path_entirely():
    url = "https://hooks.zapier.com/hooks/catch/1234567/abc1234/"
    host, path, has_query = admin_display(url)
    assert (host, path, has_query) == ("hooks.zapier.com", PATH_HIDDEN, False)
    for piece in ("hooks/catch", "1234567", "abc1234"):
        assert piece not in path


def test_admin_display_hides_every_path_and_drops_the_query():
    assert admin_display(
        "https://hooks.zapier.com/hooks/catch/123/abcdefghijklmnopqrstu/?t=1"
    ) == ("hooks.zapier.com", PATH_HIDDEN, True)


def test_admin_display_without_a_query():
    host, path, has_query = admin_display("https://hooks.example.com/a/b")
    assert (host, path, has_query) == ("hooks.example.com", PATH_HIDDEN, False)


@pytest.mark.parametrize("url", ["https://hooks.example.com", "https://hooks.example.com/"])
def test_admin_display_with_no_path_says_nothing_is_hidden(url):
    assert admin_display(url) == ("hooks.example.com", "", False)


def test_admin_display_short_segments_are_hidden_too():
    _, path, _ = admin_display("https://h.example.com/a/b1")
    assert path == PATH_HIDDEN


def test_admin_display_slack_style_path_is_masked():
    host, path, has_query = admin_display(
        "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
    )
    assert host == "hooks.slack.com"
    assert path == PATH_HIDDEN
    assert "XXXX" not in path and "T00000000" not in path
    assert has_query is False


@pytest.mark.parametrize("url, shown", [
    # Pipedream: the per-endpoint subdomain IS the credential.
    ("https://eo3x9k2m7q1zpd4.m.pipedream.net/", "….m.pipedream.net"),
    # ngrok-style tunnels: a hex / digit label.
    ("https://1a2b-3c4d-5e6f.ngrok-free.app/hook", "….ngrok-free.app"),
    ("https://abcd1234.ngrok.io/hook", "….ngrok.io"),
    # long leftmost label (12+): masked whatever it spells
    ("https://my-team-receiver.example.com/x", "….example.com"),
    # ordinary names are kept
    ("https://hooks.example.com/x", "hooks.example.com"),
    ("https://hooks.zapier.com/x", "hooks.zapier.com"),
    ("https://api2.example.com/x", "api2.example.com"),
    ("https://eu-west-1.example.com/x", "eu-west-1.example.com"),
    # a registrable domain (two labels) is never masked — it is the receiver's own name
    ("https://abcdef123456789.com/x", "abcdef123456789.com"),
    # an IP literal is an address, not a token
    ("https://203.0.113.7/x", "203.0.113.7"),
])
def test_display_host_masks_a_token_looking_leftmost_label(url, shown):
    assert display_host(url) == shown
    assert admin_display(url)[0] == shown


def test_display_host_is_lower_cased_and_portless():
    assert display_host("https://Hooks.Example.com:8443/x") == "hooks.example.com"


def test_display_host_of_an_unparseable_url_is_empty():
    assert display_host("https://[::1/") == ""


def test_admin_display_never_returns_the_query_text():
    out = admin_display("https://hooks.example.com/a?token=SECRETVALUE")
    assert "SECRETVALUE" not in repr(out)
    assert out[2] is True


def test_the_module_is_pure_and_never_logs():
    src = inspect.getsource(webhook_urls)
    assert "logger" not in src
    assert "logging" not in src
    tree = ast.parse(src)
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert imported <= {"__future__", "typing", "urllib", "httpx"}, imported
