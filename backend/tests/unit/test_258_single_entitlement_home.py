"""AST Single-Home Fence for Capability Entitlements and Subscription Tiers (TIER-04 / D-258-04).

Phase 258: A Tier Becomes Enforceable.
Enforces that:
  1. Exactly ONE commercial entitlement home exists:
     - backend/app/services/entitlement_service.py (service boundary)
     - backend/app/db/entitlements.py (data access layer)
  2. No other module across backend/app/ directly queries or inspects
     organizations.subscription_tier or defines ad-hoc tier check functions
     (e.g., _is_tier_pro_or_higher, check_tier, require_tier).
"""

from __future__ import annotations

import ast
import os
import pathlib
import pytest

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"

ALLOWED_HOMES = {
    pathlib.Path("services") / "entitlement_service.py",
    pathlib.Path("db") / "entitlements.py",
}

FORBIDDEN_COLUMNS = ("subscription_tier", "add_ons")

FORBIDDEN_FUNCTION_SUBSTRINGS = (
    "check_tier",
    "is_tier_",
    "require_tier",
    "has_tier",
    "tier_check",
    "tier_is_",
    "check_addon",
    "require_addon",
    "check_add_on",
    "require_add_on",
)


def _is_allowed_file(rel_path: pathlib.Path) -> bool:
    for allowed in ALLOWED_HOMES:
        if rel_path == allowed or str(rel_path).replace("\\", "/") == str(allowed).replace("\\", "/"):
            return True
    return False


def test_no_ad_hoc_tier_checks_or_direct_subscription_tier_reads():
    """TIER-04: AST fence banning direct subscription_tier or add_ons reads outside canonical homes (SC#1)."""
    violations: list[str] = []

    for root, _, files in os.walk(APP_DIR):
        for file in files:
            if not file.endswith(".py"):
                continue
            full_path = pathlib.Path(root) / file
            rel_path = full_path.relative_to(APP_DIR)

            if _is_allowed_file(rel_path):
                continue

            try:
                tree = ast.parse(
                    full_path.read_text(encoding="utf-8-sig", errors="replace"),
                    filename=str(full_path),
                )
            except Exception as exc:
                violations.append(f"Failed to parse {rel_path}: {exc}")
                continue

            for node in ast.walk(tree):
                # 1. Check for forbidden function definitions or calls
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    name_lower = node.name.lower()
                    if any(sub in name_lower for sub in FORBIDDEN_FUNCTION_SUBSTRINGS):
                        violations.append(
                            f"{rel_path}:{node.lineno} defines forbidden tier/add_on check function '{node.name}'"
                        )
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    func_lower = node.func.id.lower()
                    if any(sub in func_lower for sub in FORBIDDEN_FUNCTION_SUBSTRINGS):
                        violations.append(
                            f"{rel_path}:{node.lineno} calls forbidden tier/add_on check function '{node.func.id}'"
                        )

                # 2. Check for attribute access: *.subscription_tier or *.add_ons
                if isinstance(node, ast.Attribute):
                    if node.attr in FORBIDDEN_COLUMNS:
                        violations.append(
                            f"{rel_path}:{node.lineno} directly accesses attribute '{node.attr}': '{ast.unparse(node)}'"
                        )

                # 3. Check for subscript access: *["subscription_tier"] or *["add_ons"]
                if isinstance(node, ast.Subscript):
                    slice_node = node.slice
                    if isinstance(slice_node, ast.Constant) and slice_node.value in FORBIDDEN_COLUMNS:
                        violations.append(
                            f"{rel_path}:{node.lineno} directly reads dictionary key '{slice_node.value}': '{ast.unparse(node)}'"
                        )

                # 4. Check for string constants containing SQL querying subscription_tier or add_ons
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    val_lower = node.value.lower()
                    for col in FORBIDDEN_COLUMNS:
                        if col in val_lower and ("select" in val_lower or "from" in val_lower or "organizations" in val_lower):
                            violations.append(
                                f"{rel_path}:{node.lineno} contains SQL query referencing '{col}'"
                            )

    assert not violations, (
        "TIER-04 AST single-home fence violated (direct subscription_tier/add_ons read outside canonical home):\n"
        + "\n".join(violations)
    )


def test_ast_fence_detects_planted_add_ons_and_tier_violations():
    """SC#1 / TIER-04: Non-vacuity test verifying AST fence detects planted add_ons and tier checks."""
    code_snippets = [
        "def bad_subscript(org): return org['add_ons'].get('workflows')",
        "def bad_attr(org): return org.add_ons",
        "def bad_sql(): return 'SELECT add_ons FROM organizations'",
        "def bad_tier_subscript(org): return org['subscription_tier']",
        "def bad_tier_attr(org): return org.subscription_tier",
        "def bad_tier_func(): return check_tier('pro')",
        "def bad_addon_func(): return check_add_on('workflows')",
        "def check_tier(tier): return tier == 'pro'",
    ]
    for snippet in code_snippets:
        tree = ast.parse(snippet)
        detected = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in FORBIDDEN_COLUMNS:
                detected = True
            elif isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Constant) and node.slice.value in FORBIDDEN_COLUMNS:
                detected = True
            elif isinstance(node, ast.Constant) and isinstance(node.value, str):
                val_lower = node.value.lower()
                if any(col in val_lower and ("select" in val_lower or "from" in val_lower or "organizations" in val_lower) for col in FORBIDDEN_COLUMNS):
                    detected = True
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if any(sub in node.name.lower() for sub in FORBIDDEN_FUNCTION_SUBSTRINGS):
                    detected = True
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if any(sub in node.func.id.lower() for sub in FORBIDDEN_FUNCTION_SUBSTRINGS):
                    detected = True
        assert detected, f"Expected AST fence detection for snippet: {snippet}"
