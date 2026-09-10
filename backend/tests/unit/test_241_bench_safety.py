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
# ⚠ `def assert_bench_target(` matches _GUARD_CALL, so the guard's OWN definition line
# would otherwise satisfy the fence for anything written inside the guard itself.
_DEF_LINE = re.compile(r"^\s*(?:async\s+)?def\s")


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
            _GUARD_CALL.search(lines[i - 1]) and not _DEF_LINE.match(lines[i - 1])
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


# -- WR-01 (241-REVIEW): the host LIST, the port, and the query string ---------
#
# THE GUARD ENFORCED A WEAKER INVARIANT THAN THE ONE ITS DOCSTRING STATES, and the
#    gap is MEASURED in this repo against the installed asyncpg 0.31.0 rather than
#    reasoned about:
#
#        dsn = "postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench"
#        urlparse(dsn).hostname   ->  'localhost'                 # what the guard read
#        asyncpg _parse_connect_dsn_and_args(dsn) addrs
#                                 ->  [('localhost', 54322), ('prod.example.com', 5432)]
#
#    asyncpg splits the URI netloc on `,` and FAILS OVER to the later addresses, while
#    `urlparse().hostname` reports only the FIRST. Local Docker being down is a
#    documented, frequent condition on this machine (CLAUDE.md's Windows
#    port-reservation trap: a container reports `Up (healthy)` while its port accepts
#    nothing), so the failover is the ORDINARY path on a bad day -- and `maintenance_dsn`
#    carried the whole host list through verbatim to
#    `DROP DATABASE IF EXISTS "recall_bench" WITH (FORCE)`.
#
# AND `urlparse(...).port` RAISES ValueError on that same DSN
#    (`Port could not be cast to integer value as '54322,prod.example.com:5432'`), so a
#    port arm can neither read `.port` unguarded nor run before the host-list arm.


_MULTI_HOST_DSNS = [
    # the review's exact bypass string, verbatim
    "postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench",
    "postgresql://127.0.0.1:54322,10.0.0.9:5432/recall_bench",
    "postgresql://postgres:postgres@127.0.0.1:54322,db.abcdefgh.supabase.co:5432/recall_bench",
    # the loopback entry SECOND -- the shape a first-host check would not help with either
    "postgresql://postgres:postgres@prod.example.com:5432,127.0.0.1:54322/recall_bench",
]


def _asyncpg_connect_addresses(dsn: str) -> list:
    """The addresses asyncpg would actually dial for ``dsn``.

    This reaches into asyncpg's PRIVATE parser on purpose: the whole finding is that the
    driver's view of a DSN differs from ``urllib.parse``'s, and only the driver can be
    asked what it would dial. The signature is filled by introspection and the case SKIPS
    rather than fails if a future asyncpg gains a parameter this file does not know -- a
    premise control must never become a maintenance trap that reds the canonical gate.
    """
    import inspect

    from asyncpg import connect_utils

    fn = connect_utils._parse_connect_dsn_and_args
    supplied = {
        "dsn": dsn,
        "host": None,
        "port": None,
        "user": "postgres",
        "password": None,
        "passfile": None,
        "database": None,
        "ssl": None,
        "direct_tls": False,
        "server_settings": None,
        "target_session_attrs": "any",
        "krbsrvname": None,
        "gsslib": "gssapi",
        "service": None,
        "servicefile": None,
    }
    accepted = set(inspect.signature(fn).parameters)
    unknown = accepted - set(supplied)
    if unknown:
        pytest.skip(f"asyncpg's private DSN parser gained parameters {sorted(unknown)}")
    addrs, _params = fn(**{k: v for k, v in supplied.items() if k in accepted})
    return list(addrs)


def test_the_premise_asyncpg_really_fails_over_to_a_second_host() -> None:
    """THE PREMISE, MEASURED. A fence built on a claim about a library must prove the claim.

    If this ever passes for the wrong reason -- because asyncpg stopped supporting host
    lists -- the refusal below becomes belt-and-braces rather than load-bearing, and this
    case is where that would be discovered.
    """
    addrs = _asyncpg_connect_addresses(_MULTI_HOST_DSNS[0])
    assert len(addrs) == 2, f"asyncpg no longer expands the host list: {addrs!r}"
    assert addrs[1][0] == "prod.example.com", addrs
    # ... and this is the single host the old guard read instead.
    import urllib.parse

    assert urllib.parse.urlparse(_MULTI_HOST_DSNS[0]).hostname == "localhost"


@pytest.mark.parametrize("dsn", _MULTI_HOST_DSNS)
def test_a_comma_separated_host_list_is_refused(dsn: str) -> None:
    """A host LIST cannot be proven loopback, so it is refused rather than half-checked."""
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(dsn)
    message = str(exc.value)
    # the refusal must name the ACTUAL problem. A DSN whose FIRST host is remote is
    # refused by the older host arm too -- but with a message about that one host, which
    # would leave the list itself unmentioned and the finding unrecorded.
    assert "list" in message.lower(), message
    assert "," in message, message


def test_the_refused_host_list_is_never_handed_to_maintenance_dsn() -> None:
    """The end-to-end property, not merely the guard's return value.

    ``maintenance_dsn`` only swaps the PATH, so anything the guard lets past reaches the
    very connection that issues ``DROP DATABASE``. The two halves are asserted together
    here so they are not separated by an act of faith.
    """
    dsn = _MULTI_HOST_DSNS[0]
    assert "prod.example.com" in brb.maintenance_dsn(dsn), (
        "maintenance_dsn no longer carries the netloc through verbatim; re-derive this case"
    )
    with pytest.raises(brb.BenchTargetRefused):
        brb.assert_bench_target(dsn)


# -- the port arm --------------------------------------------------------------


def test_the_allowed_port_is_a_module_constant() -> None:
    """One constant, so the guard and the shipped default DSNs cannot disagree."""
    assert brb.ALLOWED_PORTS == frozenset({54322})


@pytest.mark.parametrize("port", [5432, 5433, 6543, 80, 54321])
def test_a_recall_bench_on_a_non_supabase_port_is_refused(port: int) -> None:
    """Loopback is not enough: a local SSH tunnel forwards a REMOTE cluster onto 127.0.0.1.

    The port cannot prove the cluster is local either -- a tunnel can be bound to 54322 --
    but it removes every port the operator never meant to use, which is the difference
    between a typo reaching an irreversible drop and a typo being refused.
    """
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(_dsn("127.0.0.1", brb.BENCH_DB_NAME, port=port))
    assert str(port) in str(exc.value)


def test_a_dsn_with_no_port_at_all_is_refused() -> None:
    """An absent port means libpq's 5432, which is not where local Supabase lives."""
    with pytest.raises(brb.BenchTargetRefused):
        brb.assert_bench_target("postgresql://postgres:postgres@127.0.0.1/recall_bench")


# -- the query-string arm ------------------------------------------------------


@pytest.mark.parametrize(
    "query",
    [
        "host=prod.example.com",
        "hostaddr=10.0.0.9",
        "port=5432",
        "dbname=postgres",
        "sslmode=require",
    ],
)
def test_a_dsn_carrying_a_query_string_is_refused(query: str) -> None:
    """MEASURED INERT TODAY, AND REFUSED ANYWAY -- say which of the two it is.

    On asyncpg 0.31.0 a ``?host=`` / ``?port=`` / ``?dbname=`` override is IGNORED when the
    netloc already supplies that value (measured: the parser still returns
    ``[('127.0.0.1', 54322)]`` with database ``recall_bench``). So this arm closes nothing
    today. It is here because the guard's contract is *"refuse the shapes it cannot reason
    about"*, and a keyword the guard does not model is exactly such a shape -- a driver
    upgrade, or a different driver, would make it live with nobody re-reading this file.
    """
    with pytest.raises(brb.BenchTargetRefused) as exc:
        brb.assert_bench_target(f"{_dsn('127.0.0.1', brb.BENCH_DB_NAME)}?{query}")
    lowered = str(exc.value).lower()
    assert "quer" in lowered or "parameter" in lowered, lowered


def test_the_accepted_target_still_passes_after_the_three_new_arms() -> None:
    """POSITIVE CONTROL. Three new refusals could be satisfied by refusing everything; the
    shipped default ``--bench-dsn`` must still be accepted."""
    brb.assert_bench_target(
        f"postgresql://postgres:postgres@127.0.0.1:54322/{brb.BENCH_DB_NAME}"
    )
