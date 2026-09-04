"""Phase 222 — an undefined NAME in a router is invisible until somebody presses the button.

⚠ THIS FILE EXISTS BECAUSE THE SAME DEFECT HAS NOW HAPPENED TWICE IN ONE MODULE.

  · 2026-08-31 (`BUS-037` item 1): `logger` was an undefined name in `app/api/connectors.py`
    — six uses, zero definitions. The `NameError` lands AFTER the response has begun, so
    there is no status, no CORS header, and **nothing in the log**. The operator saw only
    *"Failed to fetch"*.
  · 2026-09-01 (this): `aexec` was an undefined name in the SAME FILE — three call sites,
    zero imports — reached by `create_oauth_authorize_url` (Phase 215's OAuth Connect path)
    and `import_connection_file` (Phase 216). Both shipped.

⚠ WHY NO EXISTING GATE CATCHES THIS. Python binds names at RUN time, so the module imports
cleanly and every test that does not execute the specific branch passes. `tsc` has no
backend equivalent here, and the routes in question need live DNS, a live DB or a real
OAuth round trip to reach — which is exactly why both defects were found by a person
clicking rather than by 3392 passing tests.

So the check is STATIC and it walks the whole module rather than looking for the two names
that have already bitten. A test that pinned `logger` would not have caught `aexec`.
"""

from __future__ import annotations

import ast
import builtins
import io
from pathlib import Path

import pytest

#: Routers are the highest-value place for this: they are the modules whose failures reach a
#: person as a blank error, and whose branches are hardest to reach from a unit test.
BACKEND = Path(__file__).resolve().parents[2] / "app"
TARGETS = sorted((BACKEND / "api").glob("*.py"))


def _undefined_global_calls(path: Path) -> list[tuple[str, int]]:
    """Names CALLED as functions that are bound nowhere the module can see.

    Deliberately narrow: only `name(...)` call targets, only names with no module-level
    binding, no local binding in the enclosing function, no parameter of it, and not a
    builtin. Anything subtler (attributes, conditional rebinds) is left alone — a fence that
    cries wolf gets deleted, and this one has to survive to catch the third occurrence.
    """
    tree = ast.parse(io.open(path, encoding="utf-8").read())

    module_names: set[str] = set(dir(builtins))
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                module_names.add(a.asname or a.name.split(".")[0])
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            module_names.add(node.name)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            module_names.add(node.id)
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            module_names.update(node.names)

    missing: list[tuple[str, int]] = []
    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        args = fn.args
        local = {a.arg for a in [*args.posonlyargs, *args.args, *args.kwonlyargs]}
        if args.vararg:
            local.add(args.vararg.arg)
        if args.kwarg:
            local.add(args.kwarg.arg)
        for node in ast.walk(fn):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                local.add(node.id)
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                for a in node.names:
                    local.add(a.asname or a.name.split(".")[0])

        for node in ast.walk(fn):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id not in module_names
                and node.func.id not in local
            ):
                missing.append((node.func.id, node.lineno))
    return missing


@pytest.mark.parametrize("path", TARGETS, ids=lambda p: p.name)
def test_no_router_calls_a_name_nothing_binds(path: Path):
    """⚠ A NameError in a router reaches a person as a blank failure, not as an error.

    It is raised after the response has begun, so FastAPI cannot turn it into a status and
    the browser gets no CORS header — the operator sees *"Failed to fetch"* and the server
    log is silent. That is why this is worth a static check rather than a runtime one.
    """
    missing = _undefined_global_calls(path)
    assert not missing, (
        f"{path.name} calls name(s) nothing binds: "
        + ", ".join(f"{n!r} at line {ln}" for n, ln in missing)
        + " — each raises NameError when its branch is reached"
    )


def test_the_fence_would_have_caught_both_recorded_occurrences(tmp_path):
    """⚠ A POSITIVE CONTROL. A guard nobody has seen fire is not a guard, and this one
    cannot be driven RED against the real file any more — the defect is fixed. So it is
    driven against a reconstruction of BOTH recorded shapes instead."""
    planted = tmp_path / "planted_router.py"
    planted.write_text(
        "async def handler():\n"
        "    logger.warning('boom')\n"          # BUS-037's shape: undefined attribute owner
        "    return await aexec(query())\n",    # 2026-09-01's shape: undefined call target
        encoding="utf-8",
    )
    found = {name for name, _ln in _undefined_global_calls(planted)}
    assert "aexec" in found
    assert "query" in found


def test_the_fence_does_not_fire_on_a_clean_module(tmp_path):
    """The other half of the control: it must stay quiet on names that ARE bound, including
    locals, parameters, function-local imports and builtins."""
    clean = tmp_path / "clean_router.py"
    clean.write_text(
        "from app.utils.db import aexec\n"
        "\n"
        "def helper():\n"
        "    return 1\n"
        "\n"
        "async def handler(builder):\n"
        "    from json import loads\n"
        "    local = helper\n"
        "    return len(loads('{}')), await aexec(builder()), local()\n",
        encoding="utf-8",
    )
    assert _undefined_global_calls(clean) == []
