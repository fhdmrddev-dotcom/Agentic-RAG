"""
AST Single-Home Fence for Token-to-USD Pricing (METER-02 / D-257-14).

Enforces that:
  1. Exactly ONE home exists for token-to-USD conversion:
     backend/app/services/pricing_service.py (and database rate aggregations in backend/app/db/rates.py).
  2. No other module across backend/app/ defines token conversion functions or performs
     ad-hoc token * rate / 1_000_000 arithmetic.
"""

import ast
import os
import pathlib
import pytest

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"

ALLOWED_HOMES = {
    pathlib.Path("services") / "pricing_service.py",
    pathlib.Path("db") / "rates.py",
}

FORBIDDEN_FUNCTION_NAMES = {
    "token_to_usd",
    "tokens_to_usd",
    "compute_token_cost",
    "compute_token_cost_usd",
    "calculate_token_cost",
    "token_cost_usd",
}


def _is_allowed_file(rel_path: pathlib.Path) -> bool:
    for allowed in ALLOWED_HOMES:
        if rel_path == allowed or str(rel_path).replace("\\", "/") == str(allowed).replace("\\", "/"):
            return True
    return False


def test_no_external_token_to_usd_conversion_homes():
    """METER-02: Banning duplicate token-to-USD conversion functions outside pricing_service."""
    violations = []

    for root, _, files in os.walk(APP_DIR):
        for file in files:
            if not file.endswith(".py"):
                continue
            full_path = pathlib.Path(root) / file
            rel_path = full_path.relative_to(APP_DIR)

            if _is_allowed_file(rel_path):
                continue

            try:
                tree = ast.parse(full_path.read_text(encoding="utf-8-sig", errors="replace"), filename=str(full_path))
            except Exception as exc:
                violations.append(f"Failed to parse {rel_path}: {exc}")
                continue

            for node in ast.walk(tree):
                # Check for forbidden function definitions
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.lower() in FORBIDDEN_FUNCTION_NAMES:
                        violations.append(
                            f"{rel_path}:{node.lineno} defines forbidden token conversion function '{node.name}'"
                        )

                # Check for ad-hoc token * rate / 1_000_000 arithmetic
                if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
                    # Check if right-hand side is 1_000_000 or 1000000
                    if isinstance(node.right, ast.Constant) and node.right.value in (1_000_000, 1000000, "1000000", "1_000_000"):
                        # Check if left-hand side contains token/cost multiplication
                        left_str = ast.unparse(node.left).lower()
                        if ("token" in left_str or "rate" in left_str or "cost" in left_str):
                            violations.append(
                                f"{rel_path}:{node.lineno} performs inline token-to-USD division: '{ast.unparse(node)}'"
                            )

    assert not violations, "METER-02 AST single-home fence violated:\n" + "\n".join(violations)
