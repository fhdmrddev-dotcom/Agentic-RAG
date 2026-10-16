"""Phase 280 plan 01 Task 2 (DEBT-11 / D-08 / D-29 / BUG-261012-02) — THE maybe_single FENCE.

⛔ THE DEFECT. postgrest 2.29's ``SyncMaybeSingleRequestBuilder.execute`` returns ``None`` — not a
response with ``data=None`` — when the query matches 0 rows. A handler that reads ``resp.data``
straight off that result raises ``AttributeError``, which Starlette turns into a 500 (with no CORS
header) instead of the handler's own 404/403 branch. ``DELETE /documents/{id}`` for a row the caller
does not own was the observed case; an AST audit found 22 such sites across ``backend/app``.

⭐ THE RULE this fence pins over every ``*.py`` under ``backend/app``. A ``.maybe_single()`` result
bound to a name is SAFE when either
  * the bound value is wrapped in ``maybe_row(...)`` (``app.utils.db``), or
  * the first later use of that name is a None-guard on the NAME itself — ``NAME.data if NAME``,
    ``NAME and NAME.data``, ``not NAME or …``, ``NAME is None`` / ``is not None``,
    ``getattr(NAME, "data", …)``, ``maybe_row(NAME)``.
Reading ``.data`` straight off a ``.maybe_single()`` chain (``q.maybe_single().execute().data``) is
always unsafe. A ``.maybe_single()`` builder RETURNED to a caller cannot be traced by this scan, so
each such factory must sit in ``ALLOWLIST`` with its reason.

⭐ IT WAS DRIVEN RED. The planted BUG-261012-02 shape is written into a ``tmp_path`` copy (never
into ``backend/app``) and the scan must report it; each recognised guard shape is planted too and
must NOT be reported, so "found nothing" cannot mean "looked for nothing". A floor of ≥ 100 sites
proves the scan root did not move.
"""
from __future__ import annotations

import ast
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace

BACKEND_APP = Path(__file__).resolve().parents[2] / "app"

# A factory RETURNS the ``.maybe_single()`` builder, so its callers bind the result through a
# function call this scan cannot follow. Each entry names the reason the callers are safe.
ALLOWLIST: dict[str, str] = {
    "app/services/harness/skill_snapshot.py": (
        "factory returns the builder; callers guard resp.data if resp is not None"
    ),
}

_SCOPE_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)
_NESTED_SKIP = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)


@dataclass
class _Result:
    sites: int = 0
    unguarded: list[str] = field(default_factory=list)
    factories: list[str] = field(default_factory=list)


def _is_ms_call(n: ast.AST) -> bool:
    return isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "maybe_single"


def _call_name(n: ast.AST) -> str | None:
    if not isinstance(n, ast.Call):
        return None
    if isinstance(n.func, ast.Name):
        return n.func.id
    if isinstance(n.func, ast.Attribute):
        return n.func.attr
    return None


def _own_nodes(scope: ast.AST) -> list[ast.AST]:
    """Every node of ``scope`` except those inside nested function / class definitions."""
    out: list[ast.AST] = []
    stack = list(ast.iter_child_nodes(scope))
    while stack:
        n = stack.pop()
        out.append(n)
        if isinstance(n, _NESTED_SKIP):
            continue
        stack.extend(ast.iter_child_nodes(n))
    return out


def _parents(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    parents: dict[ast.AST, ast.AST] = {}
    for p in ast.walk(tree):
        for c in ast.iter_child_nodes(p):
            parents[c] = p
    return parents


def _ancestors(n: ast.AST, parents: dict, stop: ast.AST | None = None):
    while n in parents:
        n = parents[n]
        yield n
        if n is stop or isinstance(n, ast.stmt):
            return


def _within(child: ast.AST, root: ast.AST) -> bool:
    return any(c is child for c in ast.walk(root))


def _is_guard_of(expr: ast.AST, name: str) -> bool:
    """``expr`` tests NAME itself for None/truthiness (never ``NAME.data``)."""
    if isinstance(expr, ast.Name) and expr.id == name:
        return True
    if isinstance(expr, ast.UnaryOp) and isinstance(expr.op, ast.Not):
        return _is_guard_of(expr.operand, name)
    if isinstance(expr, ast.Compare) and isinstance(expr.left, ast.Name) and expr.left.id == name:
        return all(isinstance(op, (ast.Is, ast.IsNot)) for op in expr.ops) and all(
            isinstance(c, ast.Constant) and c.value is None for c in expr.comparators
        )
    if isinstance(expr, ast.BoolOp):
        return any(_is_guard_of(v, name) for v in expr.values)
    if isinstance(expr, ast.Call) and _call_name(expr) in ("getattr", "maybe_row") and expr.args:
        first = expr.args[0]
        return isinstance(first, ast.Name) and first.id == name
    return False


def _is_guard_event(n: ast.Name, parents: dict) -> bool:
    """A Load of NAME that is itself a None/truth test of NAME."""
    p = parents.get(n)
    if isinstance(p, ast.UnaryOp) and isinstance(p.op, ast.Not):
        return True
    if isinstance(p, ast.Compare) and p.left is n:
        return _is_guard_of(p, n.id)
    if isinstance(p, (ast.If, ast.While, ast.IfExp, ast.Assert)) and p.test is n:
        return True
    if isinstance(p, ast.BoolOp):
        return True
    if isinstance(p, ast.Call) and _call_name(p) in ("getattr", "maybe_row") and p.args and p.args[0] is n:
        return True
    return False


def _read_is_locally_guarded(read: ast.Attribute, name: str, parents: dict) -> bool:
    """``NAME.data if NAME else …`` / ``None if not NAME else NAME.data`` / ``NAME and NAME.data``."""
    child: ast.AST = read
    for anc in _ancestors(read, parents):
        if isinstance(anc, ast.IfExp) and child is not anc.test and _is_guard_of(anc.test, name):
            return True
        if isinstance(anc, ast.BoolOp):
            idx = next(i for i, v in enumerate(anc.values) if v is child)
            if any(_is_guard_of(v, name) for v in anc.values[:idx]):
                return True
        child = anc
    return False


def _pos(n: ast.AST) -> tuple[int, int]:
    return (getattr(n, "lineno", 0), getattr(n, "col_offset", 0))


def _scan_source(src: str, rel: str, res: _Result) -> None:
    tree = ast.parse(src, filename=rel)
    parents = _parents(tree)
    scopes = [tree] + [n for n in ast.walk(tree) if isinstance(n, _SCOPE_TYPES)]
    for scope in scopes:
        nodes = _own_nodes(scope)
        ms_calls = [n for n in nodes if _is_ms_call(n)]
        if not ms_calls:
            continue
        res.sites += len(ms_calls)
        fname = getattr(scope, "name", "<module>")
        for call in ms_calls:
            stmt = next(a for a in _ancestors(call, parents) if isinstance(a, ast.stmt))
            chain = list(_ancestors(call, parents, stop=stmt))
            # anything between the call and its statement that is maybe_row(...) makes it safe
            wrapped = any(_call_name(a) == "maybe_row" for a in chain)
            # a `.data` read straight off the maybe_single chain is always unsafe
            chained_read = any(
                isinstance(a, ast.Attribute) and a.attr == "data" and _within(call, a.value) for a in chain
            )
            where = f"{rel}:{call.lineno} ({fname})"
            if chained_read and not wrapped:
                res.unguarded.append(f"{where} chained .data")
                continue
            if wrapped:
                continue
            if isinstance(stmt, ast.Return):
                res.factories.append(where)
                continue
            if isinstance(stmt, ast.Assign):
                targets = [t.id for t in stmt.targets if isinstance(t, ast.Name)]
            elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                targets = [stmt.target.id]
            else:
                continue  # unbound use (argument / expression statement): nothing reads .data off it
            for name in targets:
                bad = _first_use_unsafe(stmt, name, nodes, parents)
                if bad is not None:
                    res.unguarded.append(f"{where} -> {bad}")


def _first_use_unsafe(stmt: ast.stmt, name: str, nodes: list, parents: dict) -> int | None:
    """The line of the first unguarded ``NAME.data`` read after ``stmt``, or None when safe."""
    end = (stmt.end_lineno, stmt.end_col_offset)
    later = sorted((n for n in nodes if isinstance(n, ast.Name) and n.id == name and _pos(n) >= end), key=_pos)
    for n in later:
        if isinstance(n.ctx, ast.Store):
            return None  # rebound before any read
        p = parents.get(n)
        if isinstance(p, ast.Attribute) and p.attr == "data" and p.value is n and isinstance(p.ctx, ast.Load):
            return None if _read_is_locally_guarded(p, name, parents) else n.lineno
        if _is_guard_event(n, parents):
            return None
    return None


def _scan_detail(root: Path) -> _Result:
    res = _Result()
    for f in sorted(root.rglob("*.py")):
        rel = f.relative_to(root.parent).as_posix()
        _scan_source(f.read_text(encoding="utf-8-sig"), rel, res)
    return res


def scan(root: Path) -> tuple[int, list[str]]:
    """(maybe_single sites found, unguarded sites) under ``root`` (a directory named like ``app``)."""
    res = _scan_detail(root)
    unguarded = list(res.unguarded)
    for site in res.factories:
        if site.split(":", 1)[0] not in ALLOWLIST:
            unguarded.append(f"{site} returned to the caller, not in ALLOWLIST")
    return res.sites, unguarded


# ── the fence over backend/app ───────────────────────────────────────────────────────────

def test_every_maybe_single_read_in_backend_app_is_guarded():
    sites, unguarded = scan(BACKEND_APP)
    assert sites >= 100, f"scanned only {sites} maybe_single() sites — the scan root moved"
    assert unguarded == [], "unguarded maybe_single() .data reads (BUG-261012-02):\n" + "\n".join(unguarded)


def test_the_allowlist_is_exactly_the_skill_snapshot_factory_and_is_not_vacuous():
    assert set(ALLOWLIST) == {"app/services/harness/skill_snapshot.py"}
    assert all(reason.strip() for reason in ALLOWLIST.values())
    factories = {s.split(":", 1)[0] for s in _scan_detail(BACKEND_APP).factories}
    # every allowlisted file really is a factory site the scan found (no stale entry)
    assert factories == set(ALLOWLIST), factories


# ── positive / negative controls in a tmp_path copy (never in backend/app) ──────────────

def _plant(tmp_path: Path, body: str) -> Path:
    root = tmp_path / "app"
    root.mkdir()
    (root / "planted.py").write_text(textwrap.dedent(body), encoding="utf-8")
    return root


def test_the_fence_reports_the_bug_261012_02_shape(tmp_path):
    root = _plant(tmp_path, """
        def handler(q):
            r = q.maybe_single().execute()
            if not r.data:
                raise LookupError("Document not found")
            return r.data
    """)
    sites, unguarded = scan(root)
    assert sites == 1
    assert len(unguarded) == 1 and unguarded[0].startswith("app/planted.py:3"), unguarded


def test_the_fence_reports_the_aexec_wrapped_shape(tmp_path):
    root = _plant(tmp_path, """
        async def handler(supabase, aexec):
            doc_resp = await aexec(
                supabase.table("documents").select("*").eq("id", 1).maybe_single()
            )
            if not doc_resp.data:
                raise LookupError("Document not found")
    """)
    assert len(scan(root)[1]) == 1


def test_the_fence_reports_a_chained_read(tmp_path):
    root = _plant(tmp_path, """
        def a(q):
            x = q.maybe_single().execute().data
            return x

        def b(q):
            return q.maybe_single().execute().data["id"]
    """)
    sites, unguarded = scan(root)
    assert sites == 2
    assert len(unguarded) == 2 and all("chained .data" in u for u in unguarded), unguarded


def test_the_fence_reports_an_unallowlisted_factory(tmp_path):
    root = _plant(tmp_path, """
        def factory(q):
            return q.maybe_single()
    """)
    assert len(scan(root)[1]) == 1


def test_each_recognised_guard_shape_is_not_reported(tmp_path):
    root = _plant(tmp_path, """
        def wrapped(q, maybe_row):
            row = maybe_row(q.maybe_single().execute())
            return row

        def wrapped_later(q, maybe_row):
            r = q.maybe_single().execute()
            if not maybe_row(r):
                raise LookupError
            return r.data

        def ifexp(q):
            r = q.maybe_single().execute()
            return r.data if r else None

        def ifexp_not(q):
            r = q.maybe_single().execute()
            return None if not r else r.data

        def and_guard(q):
            r = q.maybe_single().execute()
            return r and r.data

        def or_guard(q):
            r = q.maybe_single().execute()
            if not r or not r.data:
                raise LookupError
            return r.data

        def is_none(q):
            r = q.maybe_single().execute()
            if r is None:
                raise LookupError
            return r.data

        def is_not_none(q):
            r = q.maybe_single().execute()
            if r is not None and r.data:
                return r.data

        def via_getattr(q):
            r = q.maybe_single().execute()
            return getattr(r, "data", None)

        def never_read(q):
            r = q.maybe_single().execute()
            return bool(r)
    """)
    sites, unguarded = scan(root)
    assert sites == 10, sites
    assert unguarded == [], unguarded


# ── the helper itself ────────────────────────────────────────────────────────────────────

def test_maybe_row_on_postgrest_none_is_none():
    from app.utils.db import maybe_row

    assert maybe_row(None) is None


def test_maybe_row_returns_the_row():
    from app.utils.db import maybe_row

    assert maybe_row(SimpleNamespace(data={"id": 1})) == {"id": 1}


def test_maybe_row_on_empty_data_is_none():
    from app.utils.db import maybe_row

    assert maybe_row(SimpleNamespace(data=None)) is None
