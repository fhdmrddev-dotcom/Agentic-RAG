"""Phase 222 — the auth scheme is RESOLVED, not inferred from the credential's characters.

⚠ THIS PINS A DEFECT FOUND BY A LIVE DRIVE AND BY NOTHING ELSE.

`_build_auth_headers` decided the scheme by inspecting the string: anything containing a
colon became a `user:token` Basic pair. That is right for a Jira `email:api_token` and wrong
for an OAuth access token that merely happens to contain one. **Notion's does.**

Measured 2026-09-01 against the real `mcp.notion.com`: a freshly minted, entirely valid
token was base64'd into `Basic …` and the server answered `401 invalid_token`. The SAME
token with an explicit `Bearer` header returned **HTTP 200 and 41 tools**.

⚠ THE WRONG DIAGNOSIS WAS THE EXPENSIVE PART. `invalid_token` reads as *"your credential is
bad"* — it sends somebody to re-authorize, re-consent, or hunt for a missing scope, and
every one of those mints another colon-bearing token that fails identically. A heuristic
that is confidently wrong costs more than an absent one.
"""

from __future__ import annotations

import base64

import pytest

from app.services.connector_service import ResolvedConnection
from app.services.mcp_client import McpClient

#: The shape that broke it: an opaque OAuth token containing a colon.
OAUTH_LIKE = "3c9d872b0a1f4e2b:9f81c7d6e5a4b3c2d1e0f9a8b7c6d5e4"


def _auth(secret, scheme="auto"):
    return McpClient._build_auth_headers(secret, scheme).get("Authorization")


# ── the defect ────────────────────────────────────────────────────────────────────────


def test_an_explicit_bearer_survives_a_colon_in_the_token():
    """⚠ THE HEADLINE. Under `auto` this exact string becomes Basic and Notion 401s."""
    assert _auth(OAUTH_LIKE, "bearer") == f"Bearer {OAUTH_LIKE}"


def test_the_auto_heuristic_really_does_mangle_it_a_negative_control():
    """The defect is asserted rather than described, so the fix cannot be read as cosmetic.

    ⚠ `auto` is UNCHANGED ON PURPOSE — every shipped `static_key` row was stored against
    exactly these rules, so tightening them would break connections that work today.
    """
    got = _auth(OAUTH_LIKE, "auto")
    assert got.startswith("Basic ")
    assert base64.b64decode(got.split(" ", 1)[1]).decode() == OAUTH_LIKE
    assert got != f"Bearer {OAUTH_LIKE}"


def test_an_explicit_scheme_never_inspects_the_value():
    """A token that LOOKS like a bearer prefix is still base64'd when basic is declared —
    proving the explicit arm short-circuits before any string inspection."""
    assert _auth("bearer abc", "basic").startswith("Basic ")
    assert _auth("user:pass", "bearer") == "Bearer user:pass"


# ── the historical behaviour must not move ────────────────────────────────────────────


@pytest.mark.parametrize(
    "secret,expected_prefix",
    [
        ("xoxb-slack-token", "Bearer "),          # no colon -> bearer
        ("me@example.com:api_token", "Basic "),   # Jira pair -> basic, still correct
        ("Bearer already-prefixed", "Bearer "),   # passed through
        ("Basic already-prefixed", "Basic "),     # passed through
    ],
)
def test_auto_is_byte_unchanged_for_every_shipped_shape(secret, expected_prefix):
    assert _auth(secret, "auto").startswith(expected_prefix)


def test_no_credential_sends_no_authorization_header():
    assert _auth(None) is None
    assert _auth("   ") is None


# ── the resolver is where the knowledge lives ─────────────────────────────────────────


def test_a_resolved_connection_defaults_to_auto():
    """A capability or pasted-token row keeps the historical path."""
    rc = ResolvedConnection(
        connection_id="c", org_id="o", capability="post_message",
        name="Slack", config={}, secret_ciphertext=None,
    )
    assert rc.auth_scheme == "auto"


def test_the_resolver_carries_the_scheme_so_the_transport_need_not_guess():
    """⚠ THE STRUCTURAL POINT. The resolver knows where a credential CAME FROM; the
    transport only ever sees characters. Putting the decision here is what makes the
    Notion case knowable at all."""
    rc = ResolvedConnection(
        connection_id="c", org_id="o", capability=None,
        name="Notion", config={}, secret_ciphertext=None,
        mcp_server_url="https://mcp.notion.com/mcp", auth_scheme="bearer",
    )
    assert rc.auth_scheme == "bearer"
    assert _auth(OAUTH_LIKE, rc.auth_scheme) == f"Bearer {OAUTH_LIKE}"


def test_every_mcp_call_site_forwards_the_scheme():
    """⚠ A SEAM CHECK, because a resolved field that no call site passes is inert — the
    `WorkflowRunPhaseRead` shape this project has recorded three times: widened by a task,
    populated by none, and every test green because the absent arm renders honestly."""
    import ast
    import inspect

    from app.services import connector_service, tool_dispatcher
    from app.services.harness import phase_types

    for mod in (connector_service, tool_dispatcher, phase_types):
        src = inspect.getsource(mod)
        tree = ast.parse(src)
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            fn = node.func
            name = getattr(fn, "attr", None)
            if name not in {"list_tools", "call_tool"}:
                continue
            kwargs = {k.arg for k in node.keywords}
            assert "auth_scheme" in kwargs, (
                f"{mod.__name__} calls {name}() without auth_scheme at line {node.lineno} — "
                "the resolved scheme would be dropped and the transport would guess again"
            )
