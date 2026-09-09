"""Phase 241 (241-02 / QUEUE-06 / T-241-07) — the guard that makes the recall bench
safe to run at all: ``scripts/build-recall-bench.py`` CANNOT be pointed at the
operator's real database.

This module needs **no network, no database and no environment variable**. It imports
the builder's pure validation seam and asserts on it, plus one SOURCE fence proving
that every destructive ``CREATE DATABASE`` / ``DROP DATABASE`` statement in the builder
is preceded, *in its own function*, by a call to that seam.

⛔ Why this exists. The builder issues ``DROP DATABASE`` against a real local Postgres
cluster that also holds the operator's live Supabase development data — 159 documents
and 7,953 chunks that no migration, no backup and no test fixture can restore. The one
property that keeps that irreversible statement safe is that the target database name
equals ``recall_bench`` **exactly** and the host is loopback. An ``in`` where an ``==``
belongs would accept ``recall_bench_prod``; a missing host check would accept a
``recall_bench`` on a remote cluster. Both defects are driven RED here before the
builder is allowed to contain a ``DROP DATABASE`` at all.

``build-recall-bench.py`` is a SCRIPT (it lives under ``scripts/``, not in an importable
package — deliberately: a throwaway harness must not acquire a hot-file-ledger
obligation nor a place in the shipped ``backend/app`` package), so it is loaded via
``importlib`` from the repo root, following the house idiom in
``tests/unit/test_eval_forced_emit.py``.
"""

from __future__ import annotations

import ast
import importlib.util
import pathlib
import re
import sys

import pytest

# ── load the script module (it is not on the import path) ──────────────────────
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "build-recall-bench.py"


def _load_builder():
    """Import scripts/build-recall-bench.py as a module (cached on sys.modules)."""
    if "build_recall_bench_under_test" in sys.modules:
        return sys.modules["build_recall_bench_under_test"]
    if not _SCRIPT.exists():
        raise ImportError(
            f"the recall-bench builder does not exist yet: {_SCRIPT} "
            "(this is the RED state of 241-02 Task 1)"
        )
    spec = importlib.util.spec_from_file_location(
        "build_recall_bench_under_test", _SCRIPT
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["build_recall_bench_under_test"] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


brb = _load_builder()


def _dsn(host: str, database: str, port: int = 54322) -> str:
    hostpart = f"[{host}]" if ":" in host else host
    return f"postgresql://postgres:postgres@{hostpart}:{port}/{database}"


# ── the accepted target ────────────────────────────────────────────────────────


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "::1"])
def test_a_loopback_recall_bench_database_is_the_one_accepted_target(host: str) -> None:
    """127.0.0.1 / localhost / ::1 + database `recall_bench` — the only shape allowed."""
    brb.assert_bench_target(_dsn(host, brb.BENCH_DB_NAME))


def test_the_bench_database_name_is_a_module_constant() -> None:
    """The name is one constant, so the guard and the builder cannot disagree."""
    assert brb.BENCH_DB_NAME == "recall_bench"
    assert brb.LOOPBACK_HOSTS == frozenset({"127.0.0.1", "::1", "localhost"})


# ── the operator's real database ───────────────────────────────────────────────


def test_the_operators_real_database_is_refused_and_the_refusal_names_it() -> None:
    """`postgres` on loopback is the operator's LIVE dev data. Refused, by name."""
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        )
    assert "postgres" in str(exc.value)


@pytest.mark.parametrize("database", ["postgres", "template1", "supabase", ""])
def test_any_database_that_is_not_recall_bench_is_refused(database: str) -> None:
    with pytest.raises(brb.BenchTargetRefused):
        brb.assert_bench_target(_dsn("127.0.0.1", database))


# ── the host arm ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "host",
    [
        "db.abcdefgh.supabase.co",
        "10.0.0.5",
        "192.168.1.20",
        "recall-bench.example.com",
        "127.0.0.1.evil.example.com",
    ],
)
def test_a_recall_bench_on_a_non_loopback_host_is_refused(host: str) -> None:
    """The right database name on the WRONG cluster is still the wrong cluster."""
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(_dsn(host, brb.BENCH_DB_NAME))
    assert host in str(exc.value)


def test_a_dsn_with_no_host_at_all_is_refused() -> None:
    """A keyword or unix-socket DSN cannot be proven loopback, so it is refused."""
    with pytest.raises(brb.BenchTargetRefused):
        brb.assert_bench_target("dbname=recall_bench")


# ── the `in` vs `==` defect: THE reason this file exists ───────────────────────


@pytest.mark.parametrize(
    "database",
    ["recall_bench_prod", "myrecall_bench", "recall_bench2", "prod_recall_bench_live"],
)
def test_a_database_merely_containing_recall_bench_is_refused(database: str) -> None:
    """The check is EQUALITY, never `in` — `recall_bench_prod` is somebody's database."""
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(_dsn("127.0.0.1", database))
    assert database in str(exc.value)


# ── the source fence over every destructive statement ─────────────────────────

_DESTRUCTIVE = re.compile(r"\b(?:DROP|CREATE)\s+DATABASE\b", re.IGNORECASE)
_GUARD_CALL = re.compile(r"\bassert_bench_target\s*\(")


def _source_lines_without_comments() -> list[str]:
    """The builder's source with whole-line `#` comments blanked out.

    ⚠ A fence a comment can satisfy is not a fence: without this, writing
    ``# assert_bench_target(dsn)`` above a bare DROP would make the guard pass.
    """
    out: list[str] = []
    for line in _SCRIPT.read_text(encoding="utf-8").splitlines():
        out.append("" if line.lstrip().startswith("#") else line)
    return out


def test_every_destructive_statement_sits_in_a_function_guarded_above_it() -> None:
    """No `DROP DATABASE` / `CREATE DATABASE` may be reached without the guard first."""
    lines = _source_lines_without_comments()
    tree = ast.parse("\n".join(lines), filename=str(_SCRIPT))

    functions = [
        node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]

    offenders: list[str] = []
    for lineno, line in enumerate(lines, start=1):
        if not _DESTRUCTIVE.search(line):
            continue
        enclosing = [
            fn
            for fn in functions
            if fn.lineno <= lineno <= (fn.end_lineno or fn.lineno)
        ]
        if not enclosing:
            offenders.append(
                f"line {lineno}: destructive statement at module scope "
                f"(no function, so no guard can precede it): {line.strip()!r}"
            )
            continue
        # innermost enclosing function
        fn = min(enclosing, key=lambda f: (f.end_lineno or f.lineno) - f.lineno)
        guarded = any(
            _GUARD_CALL.search(lines[i - 1])
            for i in range(fn.lineno, lineno)
        )
        if not guarded:
            offenders.append(
                f"line {lineno}: destructive statement in {fn.name}() with no "
                f"assert_bench_target(...) above it: {line.strip()!r}"
            )

    assert not offenders, "unguarded destructive statements:\n" + "\n".join(offenders)


def test_the_guard_is_not_dead_code_when_destructive_statements_exist() -> None:
    """If the builder can drop a database, the guard must actually be called."""
    lines = _source_lines_without_comments()
    has_destructive = any(_DESTRUCTIVE.search(line) for line in lines)
    if not has_destructive:
        pytest.skip("no destructive statement in the builder yet (241-02 Task 1 state)")
    assert any(_GUARD_CALL.search(line) for line in lines)
