"""AST Single-Home Fence for Expert Authoring Permissions (PACK-08 / D-261-03).

Phase 261: An Expert You Can Author.
Enforces that:
  1. All mutating expert endpoints (POST, PATCH, DELETE) and grant endpoints
     in backend/app/api/experts.py are strictly protected by Depends(require_expert_manage).
  2. Expert management permissions are data-driven via role_permissions(role, 'experts:manage')
     with ZERO hardcoded role checks (e.g. `role == 'org-admin'`, `role in ['super-admin', ...]`)
     across expert API, services, and db layers.
"""

from __future__ import annotations

import ast
import pathlib
import pytest

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
API_EXPERTS_PATH = BACKEND_DIR / "app" / "api" / "experts.py"

EXPERT_MODULE_PATHS = [
    BACKEND_DIR / "app" / "api" / "experts.py",
    BACKEND_DIR / "app" / "services" / "expert_service.py",
    BACKEND_DIR / "app" / "services" / "expert_authoring.py",
    BACKEND_DIR / "app" / "db" / "experts.py",
]

MUTATING_HTTP_METHODS = {"post", "patch", "delete"}
HARDCODED_ROLE_VALUES = {"org-admin", "super-admin", "admin"}


def _get_route_method(decorator: ast.expr) -> str | None:
    """Return the HTTP method from a @router.<method>(...) decorator."""
    if isinstance(decorator, ast.Call):
        func = decorator.func
        if isinstance(func, ast.Attribute) and func.attr in {"post", "patch", "delete", "get", "put"}:
            if isinstance(func.value, ast.Name) and func.value.id == "router":
                return func.attr
    return None


def _has_expert_manage_dependency(fn_node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """Check if function parameters include Depends(require_expert_manage)."""
    for default in fn_node.args.defaults:
        if isinstance(default, ast.Call):
            func_name = getattr(default.func, "id", None)
            if func_name == "Depends" and default.args:
                dep_arg = getattr(default.args[0], "id", None)
                if dep_arg == "require_expert_manage":
                    return True
    return False


def _detect_hardcoded_role_comparisons(tree: ast.AST) -> list[str]:
    """Detect AST nodes comparing against hardcoded admin role literals."""
    violations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Compare):
            # Check left and comparators for hardcoded role string constants
            all_operands = [node.left] + node.comparators
            for operand in all_operands:
                # Direct string literal comparison: role == 'org-admin'
                if isinstance(operand, ast.Constant) and isinstance(operand.value, str):
                    if operand.value in HARDCODED_ROLE_VALUES:
                        violations.append(f"Line {node.lineno}: hardcoded role comparison with '{operand.value}'")
                # Tuple/list membership: role in ('org-admin', 'super-admin')
                elif isinstance(operand, (ast.Tuple, ast.List)):
                    for elt in operand.elts:
                        if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                            if elt.value in HARDCODED_ROLE_VALUES:
                                violations.append(f"Line {node.lineno}: hardcoded role check in sequence '{elt.value}'")
    return violations


def test_all_mutating_endpoints_gated_by_require_expert_manage():
    """PACK-08: Verify all POST, PATCH, DELETE endpoints in api/experts.py require require_expert_manage."""
    source = API_EXPERTS_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(API_EXPERTS_PATH))

    mutating_endpoints_checked = 0
    missing_protection: list[str] = []

    for node in (tree.body if isinstance(tree, ast.Module) else []):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                method = _get_route_method(decorator)
                if method and method in MUTATING_HTTP_METHODS:
                    mutating_endpoints_checked += 1
                    if not _has_expert_manage_dependency(node):
                        missing_protection.append(f"{node.name} (@router.{method}) lacks Depends(require_expert_manage)")

    assert mutating_endpoints_checked >= 6, (
        f"Expected at least 6 mutating endpoints in api/experts.py, found {mutating_endpoints_checked}"
    )
    assert not missing_protection, (
        "Mutating expert endpoints found without require_expert_manage gate:\n"
        + "\n".join(missing_protection)
    )


def test_no_hardcoded_role_checks_in_expert_backend():
    """PACK-08: Verify zero hardcoded role checks exist in expert API, service, and DB layers."""
    all_violations: list[str] = []

    for path in EXPERT_MODULE_PATHS:
        assert path.exists(), f"Expected expert module {path} to exist"
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
        violations = _detect_hardcoded_role_comparisons(tree)
        for v in violations:
            all_violations.append(f"{path.name} - {v}")

    assert not all_violations, (
        "PACK-08 fence violated: hardcoded role check found (permission must be data-driven via role_permissions):\n"
        + "\n".join(all_violations)
    )


def test_ast_fence_detects_planted_hardcoded_role_check():
    """PACK-08: Non-vacuity test verifying AST detector catches planted hardcoded role checks."""
    bad_code_samples = [
        "if user.role == 'org-admin': pass",
        "if user_role == 'super-admin': allow()",
        "if role in ('org-admin', 'super-admin'): return True",
        "if 'admin' == current_user['role']: grant()",
    ]
    for sample in bad_code_samples:
        tree = ast.parse(sample)
        violations = _detect_hardcoded_role_comparisons(tree)
        assert len(violations) >= 1, f"Expected violation in planted sample: {sample}"


def test_ast_fence_detects_unprotected_mutating_endpoint():
    """PACK-08: Non-vacuity test verifying detector catches endpoint missing require_expert_manage."""
    unprotected_endpoint_code = """
@router.post("/unsafe")
async def unsafe_post(payload: dict, current_user = Depends(get_current_user)):
    return {"ok": True}
"""
    tree = ast.parse(unprotected_endpoint_code)
    fn = tree.body[0]
    assert isinstance(fn, ast.AsyncFunctionDef)
    assert not _has_expert_manage_dependency(fn)
