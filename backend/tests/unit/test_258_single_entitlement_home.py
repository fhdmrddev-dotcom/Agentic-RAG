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

FORBIDDEN_FUNCTION_SUBSTRINGS = (
    "check_tier",
    "is_tier_",
    "require_tier",
    "has_tier",
    "tier_check",
    "tier_is_",
)


def _is_allowed_file(rel_path: pathlib.Path) -> bool:
    for allowed in ALLOWED_HOMES:
        if rel_path == allowed or str(rel_path).replace("\\", "/") == str(allowed).replace("\\", "/"):
            return True
    return False


def test_no_ad_hoc_tier_checks_or_direct_subscription_tier_reads():
    """TIER-04: AST fence banning direct subscription_tier reads and ad-hoc tier checks."""
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
                # 1. Check for forbidden function definitions
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    name_lower = node.name.lower()
                    if any(sub in name_lower for sub in FORBIDDEN_FUNCTION_SUBSTRINGS):
                        violations.append(
                            f"{rel_path}:{node.lineno} defines forbidden tier check function '{node.name}'"
                        )

                # 2. Check for attribute access: *.subscription_tier
                if isinstance(node, ast.Attribute):
                    if node.attr == "subscription_tier":
                        violations.append(
                            f"{rel_path}:{node.lineno} directly accesses attribute 'subscription_tier': '{ast.unparse(node)}'"
                        )

                # 3. Check for subscript access: *["subscription_tier"]
                if isinstance(node, ast.Subscript):
                    slice_node = node.slice
                    if isinstance(slice_node, ast.Constant) and slice_node.value == "subscription_tier":
                        violations.append(
                            f"{rel_path}:{node.lineno} directly reads dictionary key 'subscription_tier': '{ast.unparse(node)}'"
                        )

                # 4. Check for string constants containing SQL querying subscription_tier
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    val_lower = node.value.lower()
                    if "subscription_tier" in val_lower and ("select" in val_lower or "from" in val_lower or "organizations" in val_lower):
                        violations.append(
                            f"{rel_path}:{node.lineno} contains SQL query referencing 'subscription_tier'"
                        )

    assert not violations, (
        "TIER-04 AST single-home fence violated (direct subscription_tier read or ad-hoc check outside canonical home):\n"
        + "\n".join(violations)
    )
