"""Phase 305-01 (D-07 / D-09 / D-10 / D-46; T-305-01 / T-305-02 / T-305-15) — what app/mcp may never say.

The MCP package authenticates through the ONE resolver (``resolve_mcp_principal`` ->
``authenticate_presented_key``) and acts only through the principal it returns. So no module in
``backend/app/mcp`` may digest or look up a key itself, read an app session JWT, take an org from
a header, switch role, touch the acting-org ContextVar, or use the middleware/verifier shapes the
research rejected. Comments and docstrings are stripped first: prose cannot satisfy or break a
fence (the test_304_acting_reads_fence tokenizer, imported rather than copied).
"""
from __future__ import annotations

from pathlib import Path

from tests.unit.test_304_acting_reads_fence import _code_only

BACKEND = Path(__file__).resolve().parents[2]
MCP = BACKEND / "app" / "mcp"

EXPECTED_MODULES = {
    "__init__.py", "server.py", "dispatch.py", "tools.py", "edge.py", "transport.py", "access_log.py",
}

BANNED = (
    "org_members",
    "get_service_role_supabase",
    "get_current_user",
    "SET ROLE",
    "anon",
    "X-Org-Id",
    "x-org-id",
    "_acting_org",
    "BaseHTTPMiddleware",
    "digest_key",
    "get_key_for_auth",
    "TokenVerifier",
)


def _modules() -> list[Path]:
    return sorted(p for p in MCP.glob("*.py"))


def test_the_package_has_the_seven_modules():
    assert MCP.is_dir(), "backend/app/mcp does not exist"
    names = {p.name for p in _modules()}
    assert EXPECTED_MODULES <= names, EXPECTED_MODULES - names


def test_no_mcp_module_carries_a_banned_token():
    offenders = []
    for path in _modules():
        code = _code_only(path)
        for banned in BANNED:
            if banned in code:
                offenders.append(f"{path.name}: {banned}")
    assert offenders == []


def test_the_edge_calls_the_one_resolver():
    code = _code_only(MCP / "edge.py")
    assert "resolve_mcp_principal" in code
    assert "authenticate_presented_key" not in code


def test_nothing_in_app_mcp_touches_the_chat_tool_registry():
    for path in _modules():
        assert "_TOOL_REGISTRY" not in _code_only(path), path.name


def test_the_fence_is_not_vacuous(tmp_path):
    probe = tmp_path / "probe.py"
    probe.write_text('"""digest_key in a docstring is fine"""\nx = get_key_for_auth\n', encoding="utf-8")
    code = _code_only(probe)
    assert "get_key_for_auth" in code
    assert "digest_key" not in code
