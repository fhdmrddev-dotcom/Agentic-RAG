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

# ⚠ `db/rates.py` WAS ALSO ALLOWLISTED HERE until 2026-09-23, and that allowlist is how F-13
# hid: the SQL expression was hand-written FOUR times inside it and nothing could fire. It now
# interpolates `pricing_service.cost_usd_sql()` and holds no arithmetic, so it is no longer a home.
ALLOWED_HOMES = {
    pathlib.Path("services") / "pricing_service.py",
}

FORBIDDEN_FUNCTION_NAMES = {
    "token_to_usd",
    "tokens_to_usd",
    "compute_token_cost",
    "compute_token_cost_usd",
    "calculate_token_cost",
    "token_cost_usd",
}


_MONEY_HINTS = ("token", "rate", "cost", "price", "usd", "million", "spend")

# ⚠ PROVEN BLIND, 2026-09-19 (Phase 257 review, Claude as reviewer). THE ORIGINAL DETECTOR
# IS RECORDED HERE RATHER THAN DELETED, BECAUSE HOW IT FAILED IS THE FINDING. It read:
#
#     if isinstance(node.right, ast.Constant) and node.right.value in (1_000_000, 1000000, …):
#
# i.e. it fired ONLY on division by a LITERAL one million. `pricing_service.py` — the one
# legitimate home, and therefore the exact thing anyone duplicating this would copy — does
# not write a literal. It writes `/ ONE_MILLION`, a module-level `Decimal("1000000")`.
#
# DRIVEN, not argued. A probe planted at `app/services/_plant257_probe.py`:
#
#     ONE_MILLION = Decimal("1000000")
#     def price_tokens(input_tokens, output_tokens, input_rate, output_rate):
#         in_cost  = (Decimal(input_tokens)  * input_rate)  / ONE_MILLION
#         out_cost = (Decimal(output_tokens) * output_rate) / ONE_MILLION
#         return in_cost + out_cost
#
# …is a verbatim second conversion home, and the fence reported **1 passed**. So METER-02 /
# ROADMAP SC#3 — *"a second conversion site added anywhere makes a fence fail"* — was FALSE
# as shipped, and it was false for the single most likely way a duplicate ever appears:
# somebody copies the canonical function.
#
# The detector below is therefore SEMANTIC rather than textual: it resolves module-level
# numeric constants, so a named divisor is not a hiding place, and it catches the
# multiplicative spelling (`* 0.000001`, `* 1e-6`) as well as the divisive one.
#
# ⛔ STILL OUT OF REACH, NAMED RATHER THAN LEFT SILENT: this walks Python under
# `backend/app/` only. SC#3 says a second site added *anywhere*. A `tokens * rate / 1e6`
# written in a `.tsx` trips nothing here, and Phase 257 renders dollars in the frontend.
# A frontend counterpart fence is OWED.


def _as_number(node: ast.AST, const_env: dict) -> float | None:
    """Best-effort numeric value of an expression node, or None if it is not a constant."""
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    # Decimal("1000000") / Decimal(1000000)
    if isinstance(node, ast.Call):
        fn = node.func
        fn_name = getattr(fn, "id", None) or getattr(fn, "attr", None)
        if fn_name in {"Decimal", "float", "int"} and node.args:
            arg = node.args[0]
            if isinstance(arg, ast.Constant):
                try:
                    return float(arg.value)
                except (TypeError, ValueError):
                    return None
    if isinstance(node, ast.Name):
        return const_env.get(node.id)
    # 1000 * 1000
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
        lhs, rhs = _as_number(node.left, const_env), _as_number(node.right, const_env)
        if lhs is not None and rhs is not None:
            return lhs * rhs
    return None


def _module_numeric_constants(tree: ast.Module) -> dict:
    """Map module-level NAME -> numeric value, so `/ ONE_MILLION` resolves to 1e6."""
    env: dict = {}
    for stmt in tree.body:
        targets = []
        if isinstance(stmt, ast.Assign):
            targets = [t for t in stmt.targets if isinstance(t, ast.Name)]
            value = stmt.value
        elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            targets, value = [stmt.target], stmt.value
        else:
            continue
        if value is None:
            continue
        num = _as_number(value, env)
        if num is not None:
            for t in targets:
                env[t.id] = num
    return env


def _divisor_is_one_million(node: ast.AST, const_env: dict) -> bool:
    num = _as_number(node, const_env)
    return num is not None and abs(num - 1_000_000.0) < 1e-6


def _multiplier_is_one_millionth(node: ast.AST, const_env: dict) -> bool:
    num = _as_number(node, const_env)
    return num is not None and num != 0 and abs(num - 0.000001) < 1e-12


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

            # ── Resolve module-level numeric constants so a NAMED divisor is not a hiding
            # ── place. See the "PROVEN BLIND" note on _divisor_is_one_million below.
            const_env = _module_numeric_constants(tree)

            for node in ast.walk(tree):
                # Check for forbidden function definitions
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.lower() in FORBIDDEN_FUNCTION_NAMES:
                        violations.append(
                            f"{rel_path}:{node.lineno} defines forbidden token conversion function '{node.name}'"
                        )

                # Check for ad-hoc token-to-USD arithmetic, in ANY of its spellings.
                if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Div, ast.Mult)):
                    if isinstance(node.op, ast.Div):
                        scaled = _divisor_is_one_million(node.right, const_env)
                    else:
                        scaled = _multiplier_is_one_millionth(node.right, const_env)
                    if scaled:
                        left_str = ast.unparse(node.left).lower()
                        if any(k in left_str for k in _MONEY_HINTS):
                            violations.append(
                                f"{rel_path}:{node.lineno} performs inline token-to-USD scaling: "
                                f"'{ast.unparse(node)}'"
                            )

    assert not violations, "METER-02 AST single-home fence violated:\n" + "\n".join(violations)


# ── 257 F-13 — the SQL spelling has ONE home too ──────────────────────────────────────
# The AST detector above cannot see SQL inside a string, which is exactly why four copies
# of the conversion lived in db/rates.py while this file stayed green. This scan reads
# every .py under app/ as TEXT and fails on the SQL arithmetic anywhere but its home.
import re as _re

_SQL_CONVERSION = _re.compile(r"_cost_per_million\s*/\s*[0-9]")


def test_sql_token_conversion_is_written_only_in_pricing_service():
    offenders = []
    for path in APP_DIR.rglob("*.py"):
        rel = path.relative_to(APP_DIR)
        if rel in ALLOWED_HOMES:
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if _SQL_CONVERSION.search(line):
                offenders.append(f"{rel}:{n}: {line.strip()}")
    assert not offenders, "SQL token->USD conversion outside pricing_service: " + " | ".join(offenders)


def test_sql_spelling_is_built_from_the_python_constants():
    from app.services import pricing_service as ps

    sql = ps.cost_usd_sql()
    assert f"/ {ps.ONE_MILLION}.0" in sql
    assert sql.rstrip().endswith(f"{-ps.QUANTIZE_FOUR_PLACES.as_tuple().exponent}) END")
    assert "IS NULL THEN NULL" in sql  # unrated / unmeasured are NULL, never 0


_PARITY_CASES = [
    (1234, 5678, "2.50", "10.00"),
    (0, 0, "3.00", "15.00"),
    (None, 999_999, "0.15", "0.60"),
    (7, None, "1.25", "5.00"),
    (None, None, "3.00", "15.00"),       # unmeasured -> NULL
    (50, 50, None, None),                # unrated -> NULL
    (333_333, 1, "0.0015", "0.0045"),    # rounding boundary
]


@pytest.mark.asyncio
async def test_sql_and_python_spellings_agree_in_postgres():
    """Parity bridge: evaluate the generated SQL in real Postgres against the Python arm."""
    asyncpg = pytest.importorskip("asyncpg")
    from decimal import Decimal
    from datetime import datetime, timezone
    from app.services import pricing_service as ps

    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=3)
    except Exception:  # noqa: BLE001
        pytest.skip("local Postgres not reachable on :54322")
    try:
        for it, ot, ir, orr in _PARITY_CASES:
            sql = (
                "SELECT " + ps.cost_usd_sql() + " FROM (SELECT $1::bigint AS input_tokens, "
                "$2::bigint AS output_tokens) r, (SELECT $3::numeric AS input_cost_per_million, "
                "$4::numeric AS output_cost_per_million) rate"
            )
            got = await conn.fetchval(sql, it, ot, ir, orr)
            rate = None if ir is None else ps.ModelRate(
                model_id="m", input_cost_per_million=Decimal(ir),
                output_cost_per_million=Decimal(orr),
                effective_from=datetime.now(timezone.utc),
            )
            want = ps.compute_token_cost_usd(it, ot, rate).cost_usd
            assert (got is None and want is None) or Decimal(got) == want, (it, ot, ir, orr, got, want)
    finally:
        await conn.close()
