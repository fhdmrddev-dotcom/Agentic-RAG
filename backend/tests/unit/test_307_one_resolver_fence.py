"""Phase 307-01 (D-21, D-48; T-307-20) — ONE resolver, ONE liveness call site. An AST fence.

Read by the parser, never by substring, so a comment or docstring can neither satisfy nor break it:

* ``principal_still_allowed`` is CALLED exactly once in ``security/api_key_auth.py``, inside the
  private ``_liveness``;
* ``_liveness`` is called only from ``_admit`` (the one admission tail) and
  ``grant_still_live_for_refresh`` (the D-48 pre-check ``/oauth/token`` uses);
* both credential lookups — ``authenticate_presented_key`` and
  ``authenticate_presented_access_token`` — end in ``_admit``;
* no module under ``backend/app/mcp/`` or ``backend/app/security/`` other than
  ``principal_liveness.py`` and ``api_key_auth.py`` calls ``principal_still_allowed`` or
  ``is_org_member``. ⛔ This clause is NOT relaxed for any later 307 plan: it is what keeps the
  OAuth server on ``grant_still_live_for_refresh`` instead of a second liveness path;
* ``mcp_principal.py`` defines exactly one class (``McpPrincipal``) — no second principal type;
* ``principal_liveness.py`` and ``mcp/edge.py`` are byte-unchanged since the phase base.
"""
from __future__ import annotations

import ast
import subprocess
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
SECURITY = BACKEND / "app" / "security"
MCP = BACKEND / "app" / "mcp"
API_KEY_AUTH = SECURITY / "api_key_auth.py"

# The commit Phase 307 was planned on (307-01's worktree base).
PHASE_BASE_SHA = "3ad306b63dcba9439bcbb08ac5f448dc7cd3a7ed"

_LIVENESS_NAMES = {"principal_still_allowed", "is_org_member"}


def _tree(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _callee(node: ast.Call) -> str | None:
    f = node.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        return f.attr
    return None


def _calls_by_function(tree: ast.Module) -> list[tuple[str | None, str]]:
    """``(enclosing top-level function, callee)`` for every call in the module."""
    out: list[tuple[str | None, str]] = []
    for top in tree.body:
        owner = top.name if isinstance(top, (ast.FunctionDef, ast.AsyncFunctionDef)) else None
        for node in ast.walk(top):
            if isinstance(node, ast.Call):
                name = _callee(node)
                if name:
                    out.append((owner, name))
    return out


def _defined(tree: ast.Module) -> set[str]:
    return {n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}


def test_principal_still_allowed_is_called_once_inside_liveness():
    calls = [(o, c) for o, c in _calls_by_function(_tree(API_KEY_AUTH)) if c == "principal_still_allowed"]
    assert calls == [("_liveness", "principal_still_allowed")], calls


def test_liveness_is_reached_only_by_the_tail_and_the_refresh_precheck():
    tree = _tree(API_KEY_AUTH)
    assert {"_liveness", "_admit", "grant_still_live_for_refresh"} <= _defined(tree)
    owners = sorted(o for o, c in _calls_by_function(tree) if c == "_liveness")
    assert owners == ["_admit", "grant_still_live_for_refresh"], owners


def test_both_lookups_end_in_the_one_admission_tail():
    tree = _tree(API_KEY_AUTH)
    callers = {o for o, c in _calls_by_function(tree) if c == "_admit"}
    assert {"authenticate_presented_key", "authenticate_presented_access_token"} <= callers, callers
    assert callers <= {"authenticate_presented_key", "authenticate_presented_access_token"}, callers


def _fenced_modules() -> list[Path]:
    paths = sorted(MCP.glob("*.py")) + sorted(SECURITY.glob("*.py"))
    assert len(paths) >= 8, "the scan set collapsed"
    return [p for p in paths if p.name not in ("principal_liveness.py", "api_key_auth.py")]


def test_no_other_mcp_or_security_module_calls_a_liveness_check():
    offenders = []
    for path in _fenced_modules():
        for owner, callee in _calls_by_function(_tree(path)):
            if callee in _LIVENESS_NAMES:
                offenders.append(f"{path.relative_to(BACKEND)}::{owner}: {callee}")
    assert offenders == []


def test_the_fence_sees_a_planted_call(tmp_path):
    probe = tmp_path / "probe.py"
    probe.write_text(
        '"""principal_still_allowed in a docstring is prose"""\n'
        "async def f(pool, row):\n"
        "    # principal_still_allowed(pool, key_row=row) in a comment is prose\n"
        "    return await liveness.principal_still_allowed(pool, key_row=row)\n",
        encoding="utf-8",
    )
    assert _calls_by_function(_tree(probe)) == [("f", "principal_still_allowed")]


def test_mcp_principal_defines_one_principal_type():
    tree = _tree(SECURITY / "mcp_principal.py")
    classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
    assert classes == ["McpPrincipal"], classes


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=str(REPO), capture_output=True, text=True)


@pytest.mark.parametrize("rel", ["backend/app/security/principal_liveness.py", "backend/app/mcp/edge.py"])
def test_leaf_and_edge_are_byte_unchanged_since_the_phase_base(rel):
    if _git("cat-file", "-e", f"{PHASE_BASE_SHA}^{{commit}}").returncode != 0:
        pytest.skip(f"phase base {PHASE_BASE_SHA[:9]} is not in this clone")
    diff = _git("diff", "--exit-code", "--stat", PHASE_BASE_SHA, "--", rel)
    assert diff.returncode == 0, diff.stdout
