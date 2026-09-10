"""Phase 241 Plan 01 — the recall harness's HONESTY guard (D-02, D-03, D-06, D-16).

**Authored in Task 1 and OBSERVED RED before any Task-2 source existed.**

241-CONTEXT F-1 measured the Phase 230 harness and found it *structurally incapable of
reporting a failure*: `scripts/measure-recall.py` never touched the vector path, scored every
un-found target as rank one under the comment *"Standard ground truth baseline"*, and on a
connection failure printed a hardcoded synthetic rank list and **returned 0**. Run live against
the real 159-document corpus it printed ``MRR 1.000``.

This file exists so that shape cannot come back. It pins the **arithmetic** and the **honesty**,
and it deliberately pins **nothing about the environment**:

  ⛔ NO corpus size, NO document count, NO recall threshold, NO live database fact.
     ``assert count == 77`` is exactly the mistake this file replaces — it was RED against the
     live 159 documents and *invisible to the canonical gate*, because ``pytest tests/unit``
     does not reach ``tests/eval``. Environment facts belong in the JSON report, never in a test.

  ⛔ NO database, NO network, NO environment variable. Everything here is pure.

Cases, one per honesty property:

  * **A — the miss arm.** A probe whose target is absent from the result set scores ``None``,
    and ``compute_metrics`` over a list containing that ``None`` yields ``hit_at_1 < 1.0``.
  * **B — the miss arm as a SOURCE fence.** No ``rank`` assignment to the literal 1 survives in
    either harness file, and neither carries the tokens ``mock_ranks`` / ``simulated_ranks``.
  * **C — the cannot-connect arm.** An unreachable DSN raises ``RecallUnmeasurable``; the message
    names the host and database and never the password (T-241-01).
  * **D — the exit-code arm.** The CLI's ``main()`` on an unreachable DSN returns non-zero and
    prints no metric line. *Could not measure* and *measured, and it was fine* never share an
    exit code.
  * **E — the one-home arm.** ``EVAL_PROBES`` has exactly one definition site; the CLI imports it.
  * **F — the arithmetic arm.** The three ``compute_metrics`` cases that used to live in
    ``backend/tests/eval/`` land on the canonical gate for the first time.

⚠ **The Task-2 imports are LOCAL to each case, deliberately.** A module-scope import of a
name that does not exist yet collapses the whole module into one collection error, and the RED
drive needs each honesty property to fail *by its own name and for its own reason*.
"""

from __future__ import annotations

import ast
import importlib.util
import re
from pathlib import Path

import pytest

from app.services.recall_eval import compute_metrics

# backend/tests/unit/<this file>  ->  parents[2] == backend/  ->  parents[3] == repo root
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_ROOT.parent

_RECALL_EVAL = _BACKEND_ROOT / "app" / "services" / "recall_eval.py"
_MEASURE_CLI = _REPO_ROOT / "scripts" / "measure-recall.py"

# An unreachable DSN. Port 1 refuses immediately on every platform, so this case is fast and
# never flakes on a timeout. The password is a distinctive literal so Case C can prove it is
# NOT echoed anywhere (T-241-01).
_DEAD_PASSWORD = "hunter2SHOULDNEVERAPPEAR"
_DEAD_DSN = f"postgresql://nobody:{_DEAD_PASSWORD}@127.0.0.1:1/nonesuchdb"
_DEAD_USER_ID = "00000000-0000-0000-0000-000000000000"

# The metric tokens a refusal may never print (D-03).
_METRIC_TOKENS = ("Hit@1", "Hit@5", "MRR", "recall@")


# ─────────────────────────────────────────────────────────────────────────────
# Source-fence helpers (Case B, Case E)
# ─────────────────────────────────────────────────────────────────────────────

# ⚠ ANCHORED ON THE ASSIGNMENT FORM, not on the bare substring.
#
# Phase 240 shipped a fence asserting `'"user_id"' in body` that stayed GREEN when the real
# call was deleted, because a neighbouring line happened to contain the string. A bare
# `"rank = 1" in text` fence has the mirror-image defect: it goes RED the moment a docstring
# *quotes* the retired defect in order to explain it. So the matcher requires an assignment at
# statement position, and the scan drops whole-line `#` comments first — a commented-out
# statement is not code, and a fence that fires on a comment is a fence that will be silenced.
_RANK_IS_ONE = re.compile(r"^[ \t]*rank[ \t]*=[ \t]*1[ \t]*(?:#.*)?$")

# These tokens are the shipped synthetic-benchmark fallbacks. They may not appear at all —
# not in code, not in a comment — because their only purpose was to manufacture a number.
_SYNTHETIC_TOKENS = ("mock_ranks", "simulated_ranks")


def _drop_comment_lines(lines: list[str]) -> list[str]:
    """Drop whole-line `#` comments. A commented-out statement is not code."""
    return [line for line in lines if not line.lstrip().startswith("#")]


def _code_lines(path: Path) -> list[str]:
    """Return the file's lines with whole-line `#` comments removed."""
    return _drop_comment_lines(path.read_text(encoding="utf-8").splitlines())


def _has_rank_is_one(lines: list[str]) -> bool:
    return any(_RANK_IS_ONE.match(line) for line in lines)


# ─────────────────────────────────────────────────────────────────────────────
# Case A — the miss arm: an un-found target is None, and it MOVES the metric
# ─────────────────────────────────────────────────────────────────────────────

def test_a_absent_target_scores_none_not_rank_one():
    """A probe whose target is not in the result set scores ``None``. D-02."""
    from app.services.recall_eval import score_probe_ranks

    hit_rows = [
        {"id": "c1", "document_id": "doc-other"},
        {"id": "c2", "document_id": "doc-target"},
    ]
    miss_rows = [
        {"id": "c3", "document_id": "doc-other"},
        {"id": "c4", "document_id": "doc-elsewhere"},
    ]

    ranks = score_probe_ranks([hit_rows, miss_rows], ["doc-target", "doc-target"])

    # First-occurrence DOCUMENT order: doc-other is 1st, doc-target is 2nd.
    assert ranks == [2, None]


def test_a_empty_result_set_scores_none():
    """A probe that returned nothing at all is a miss, never a hit. D-02."""
    from app.services.recall_eval import score_probe_ranks

    assert score_probe_ranks([[]], ["doc-target"]) == [None]


def test_a_a_miss_drags_hit_at_1_below_one():
    """The honest miss must be VISIBLE in the metric — that is the whole point. D-02."""
    from app.services.recall_eval import score_probe_ranks

    rows_per_probe = [
        [{"id": "c1", "document_id": "doc-a"}],
        [{"id": "c2", "document_id": "doc-somethingelse"}],
    ]
    ranks = score_probe_ranks(rows_per_probe, ["doc-a", "doc-b"])
    metrics = compute_metrics(ranks)

    assert metrics["hit_at_1"] < 1.0
    assert metrics["hit_at_1"] == 0.5
    assert metrics["mrr"] == 0.5


def test_a_repeated_document_collapses_to_first_occurrence():
    """Chunk hits collapse to DOCUMENT order; a document's 2nd chunk does not re-rank it."""
    from app.services.recall_eval import score_probe_ranks

    rows = [
        {"id": "c1", "document_id": "doc-a"},
        {"id": "c2", "document_id": "doc-a"},
        {"id": "c3", "document_id": "doc-target"},
    ]
    assert score_probe_ranks([rows], ["doc-target"]) == [2]


# ─────────────────────────────────────────────────────────────────────────────
# Case B — the miss arm as a SOURCE fence
# ─────────────────────────────────────────────────────────────────────────────

def test_b_matcher_positive_control():
    """A fence with no positive control is a fence that can pass vacuously.

    Drive the matcher against a haystack that DOES carry the shipped defect (verbatim from
    ``scripts/measure-recall.py:128`` as it stood at the phase base), and against the same line
    commented out. A typo in the regex would otherwise turn this gate green forever.
    """
    guilty = ["                        rank = 1  # Standard ground truth baseline"]
    innocent_comment = ["    # rank = 1  # retired at Phase 241, see D-02"]
    innocent_prose = ['    """The retired defect scored a miss as ``rank`` = 1."""']

    assert _has_rank_is_one(guilty) is True
    assert _has_rank_is_one(_drop_comment_lines(innocent_comment)) is False
    assert _has_rank_is_one(innocent_prose) is False


def test_b_harness_files_exist_and_are_substantial():
    """Vacuity guard: a fence over a missing or stub file proves nothing."""
    for path in (_RECALL_EVAL, _MEASURE_CLI):
        assert path.is_file(), f"{path} is missing — the fence below would pass vacuously"
        assert len(path.read_text(encoding="utf-8").splitlines()) > 40, (
            f"{path} is implausibly short — the fence below would pass vacuously"
        )


def test_b_no_rank_is_one_in_recall_eval():
    """D-02: nothing in the harness module may assign a miss the value 1."""
    assert not _has_rank_is_one(_code_lines(_RECALL_EVAL))


def test_b_no_rank_is_one_in_measure_cli():
    """D-02: nothing in the CLI may assign a miss the value 1."""
    assert not _has_rank_is_one(_code_lines(_MEASURE_CLI))


@pytest.mark.parametrize("token", _SYNTHETIC_TOKENS)
def test_b_no_synthetic_rank_fallbacks(token: str):
    """D-03: the synthetic-benchmark fallbacks are gone from BOTH files, comments included."""
    for path in (_RECALL_EVAL, _MEASURE_CLI):
        assert token not in path.read_text(encoding="utf-8"), (
            f"{path.name} still carries the manufactured-number token {token!r}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Case C — the cannot-connect arm raises, and leaks no password
# ─────────────────────────────────────────────────────────────────────────────

async def test_c_unreachable_dsn_raises_recall_unmeasurable():
    """D-03: an unreachable database RAISES. It does not return metrics."""
    from app.services.recall_eval import RecallUnmeasurable, run_measurement

    with pytest.raises(RecallUnmeasurable):
        await run_measurement(dsn=_DEAD_DSN, user_id=_DEAD_USER_ID, layers=("2",))


async def test_c_refusal_names_the_host_and_never_the_password():
    """T-241-01: the refusal must be diagnosable without disclosing the credential."""
    from app.services.recall_eval import RecallUnmeasurable, run_measurement

    with pytest.raises(RecallUnmeasurable) as excinfo:
        await run_measurement(dsn=_DEAD_DSN, user_id=_DEAD_USER_ID, layers=("2",))

    message = str(excinfo.value)
    assert "127.0.0.1" in message
    assert "nonesuchdb" in message
    assert _DEAD_PASSWORD not in message


def test_c_describe_dsn_drops_the_password():
    """T-241-01: the DSN summary that reaches every report and every message is host+db only."""
    from app.services.recall_eval import describe_dsn

    described = describe_dsn(_DEAD_DSN)

    assert described["host"] == "127.0.0.1"
    assert described["database"] == "nonesuchdb"
    assert _DEAD_PASSWORD not in repr(described)
    assert "nobody" not in repr(described)


def test_c_recall_unmeasurable_is_an_exception():
    from app.services.recall_eval import RecallUnmeasurable

    assert issubclass(RecallUnmeasurable, Exception)


# ─────────────────────────────────────────────────────────────────────────────
# Case D — the exit-code arm
# ─────────────────────────────────────────────────────────────────────────────

def _load_cli():
    """Import ``scripts/measure-recall.py`` by path — its filename is not a Python identifier."""
    spec = importlib.util.spec_from_file_location("measure_recall_cli", _MEASURE_CLI)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_d_cli_returns_non_zero_on_unreachable_dsn(capsys):
    """D-03: *could not measure* and *measured, and it was fine* never share an exit code."""
    cli = _load_cli()

    exit_code = cli.main(["--dsn", _DEAD_DSN, "--user-id", _DEAD_USER_ID])

    assert isinstance(exit_code, int)
    assert exit_code != 0

    captured = capsys.readouterr()
    for token in _METRIC_TOKENS:
        assert token not in captured.out, (
            f"a refusal printed the metric token {token!r} — that is the Phase 230 defect"
        )


def test_d_cli_refusal_does_not_leak_the_password(capsys):
    """T-241-01: neither stream may carry the credential."""
    cli = _load_cli()

    cli.main(["--dsn", _DEAD_DSN, "--user-id", _DEAD_USER_ID])

    captured = capsys.readouterr()
    assert _DEAD_PASSWORD not in captured.out
    assert _DEAD_PASSWORD not in captured.err


# ─────────────────────────────────────────────────────────────────────────────
# Case E — the one-home arm (D-01)
# ─────────────────────────────────────────────────────────────────────────────

def _imported_names_from(path: Path, module: str) -> set[str]:
    """Names the file imports from ``module``, read from its AST.

    ⚠ **This was a line-anchored regex until it fired on the CLI's parenthesised import block,
    which is the house idiom.** A fence that reads formatting instead of meaning fails in both
    directions: it goes red on a correct multi-line import, and it would go green on the string
    ``EVAL_PROBES`` appearing in a comment beside an ``import`` keyword. The AST cannot be fooled
    by either, so it asserts the FACT D-01 actually claims — the CLI *imports* the probe set.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == module:
            names.update(alias.name for alias in node.names)
    return names


def _module_level_assignments(path: Path) -> set[str]:
    """Every name assigned at module scope, read from the AST."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    assigned: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    assigned.add(target.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            assigned.add(node.target.id)
    return assigned


def test_e_ast_helpers_positive_control(tmp_path: Path):
    """A fence with no positive control is a fence that can pass vacuously."""
    sample = tmp_path / "sample.py"
    sample.write_text(
        "from app.services.recall_eval import (\n"
        "    EVAL_PROBES,\n"
        "    compute_metrics,\n"
        ")\n"
        "OWN_COPY = [1]\n",
        encoding="utf-8",
    )

    assert _imported_names_from(sample, "app.services.recall_eval") == {
        "EVAL_PROBES",
        "compute_metrics",
    }
    assert _module_level_assignments(sample) == {"OWN_COPY"}


def test_e_cli_imports_eval_probes_rather_than_redefining_them():
    """D-01: ``EVAL_PROBES`` has exactly ONE definition site and the CLI imports it."""
    assert "EVAL_PROBES" not in _module_level_assignments(_MEASURE_CLI), (
        "scripts/measure-recall.py owns a second EVAL_PROBES copy — that is drift by construction"
    )
    assert "EVAL_PROBES" in _imported_names_from(_MEASURE_CLI, "app.services.recall_eval"), (
        "the CLI must IMPORT EVAL_PROBES from app.services.recall_eval"
    )


def test_e_cli_imports_from_the_one_home():
    """The CLI's numbers come from the harness module, not from a second implementation."""
    assert _imported_names_from(_MEASURE_CLI, "app.services.recall_eval"), (
        "the CLI imports nothing from app.services.recall_eval — it owns measurement logic again"
    )
    assert "run_measurement" in _imported_names_from(_MEASURE_CLI, "app.services.recall_eval")


def test_e_no_hardcoded_dsn_in_either_file():
    """D-16: one script, one ``--dsn`` flag, no module-scope DSN constant."""
    for path in (_RECALL_EVAL, _MEASURE_CLI):
        code = "\n".join(_code_lines(path))
        assert "postgresql://" not in code, (
            f"{path.name} still hardcodes a DSN — SC#3 (cloud) is unsatisfiable by construction"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Case F — the arithmetic arm (ported from backend/tests/eval/, which Task 3 retires)
# ─────────────────────────────────────────────────────────────────────────────

def test_f_compute_metrics_mathematical_precision():
    """ranks [1, 2, 5, None] -> Hit@1 .25, Hit@3 .50, Hit@5 .75, MRR (1 + .5 + .2)/4 = .425."""
    metrics = compute_metrics([1, 2, 5, None])

    assert metrics["hit_at_1"] == 0.25
    assert metrics["hit_at_3"] == 0.50
    assert metrics["hit_at_5"] == 0.75
    assert metrics["mrr"] == 0.425


def test_f_compute_metrics_perfect_retrieval():
    metrics = compute_metrics([1, 1, 1, 1, 1])

    assert metrics["hit_at_1"] == 1.0
    assert metrics["hit_at_3"] == 1.0
    assert metrics["hit_at_5"] == 1.0
    assert metrics["mrr"] == 1.0


def test_f_compute_metrics_empty_ranks():
    metrics = compute_metrics([])

    assert metrics["hit_at_1"] == 0.0
    assert metrics["hit_at_5"] == 0.0
    assert metrics["mrr"] == 0.0


def test_f_compute_metrics_all_misses_is_zero_not_one():
    """The case the Phase 230 harness could never reach, pinned explicitly."""
    metrics = compute_metrics([None, None, None])

    assert metrics["hit_at_1"] == 0.0
    assert metrics["hit_at_5"] == 0.0
    assert metrics["mrr"] == 0.0


# -----------------------------------------------------------------------------
# Case G -- the interpolated GUC value is constrained WHERE IT IS INTERPOLATED (WR-08)
# -----------------------------------------------------------------------------
#
# `_apply_hnsw_knobs` splices `iterative_scan` into `SET LOCAL hnsw.iterative_scan = '<...>'`
# with no escaping, on a connection carrying `SET LOCAL ROLE authenticated`, and its docstring
# says both values are "constrained first ... `iterative_scan` through a closed allow-list. An
# unknown value refuses (T-241-02)."
#
# NEITHER CONSTRAINT WAS IN THAT FUNCTION. `int()` was applied inline, so `ef_search` was
# genuinely safe -- but the allow-list lived in `validate_knobs`, a separate function that only
# `run_measurement` calls. `measure_layer1` and `measure_layer2` are PUBLIC, take
# `iterative_scan: str | None`, and passed it straight through. `_match`'s docstring makes the
# same claim one register wider: *"the only interpolated text in this module is the two
# allow-listed GUC values"* -- true of one caller, not of the module.
#
# This is the class of finding this project asks for by name: a claim in prose the code does
# not have. The remedy is to make the prose true, which is also the cheapest correct fix --
# `validate_knobs` is idempotent, so `run_measurement` keeps working unchanged.

_HOSTILE_SCAN = "'; DROP TABLE public.documents --"


class _RecordingConn:
    """Records every statement it is handed and touches no database."""

    def __init__(self):
        self.statements: list[str] = []

    async def execute(self, sql: str, *args):
        self.statements.append(sql)
        return "SET"

    async def fetch(self, sql: str, *args):
        self.statements.append(sql)
        return []

    async def fetchval(self, sql: str, *args):
        self.statements.append(sql)
        return None


def _none_shape():
    from app.services.recall_eval import FILTER_SHAPES

    return next(s for s in FILTER_SHAPES if s.name == "none")


async def test_g_the_interpolating_function_refuses_a_mode_outside_the_allow_list():
    """The check belongs where the splice happens, not in one of its callers."""
    from app.services.recall_eval import RecallUnmeasurable, _apply_hnsw_knobs

    conn = _RecordingConn()
    with pytest.raises(RecallUnmeasurable):
        await _apply_hnsw_knobs(conn, ef_search=None, iterative_scan=_HOSTILE_SCAN)
    assert not any("DROP TABLE" in s for s in conn.statements), conn.statements


async def test_g_measure_layer1_is_public_and_refuses_it_too():
    """`measure_layer1` is public and documented; calling it directly is a reasonable thing
    for a later plan, a test or a notebook to do. Its docstring said that could not execute."""
    from app.services.recall_eval import RecallUnmeasurable, measure_layer1

    conn = _RecordingConn()
    with pytest.raises(RecallUnmeasurable):
        await measure_layer1(
            conn,
            filter_shape=_none_shape(),
            query_vectors=["[0.0,0.0]"],
            user_id="00000000-0000-0000-0000-000000000000",
            iterative_scan=_HOSTILE_SCAN,
        )
    assert not any("DROP TABLE" in s for s in conn.statements), conn.statements


async def test_g_measure_layer2_is_public_and_refuses_it_too():
    from app.services.recall_eval import RecallUnmeasurable, measure_layer2

    conn = _RecordingConn()
    with pytest.raises(RecallUnmeasurable):
        await measure_layer2(
            conn,
            probes=[{"query": "q", "target_filename": "a.pdf"}],
            query_vectors=["[0.0,0.0]"],
            user_id="00000000-0000-0000-0000-000000000000",
            iterative_scan=_HOSTILE_SCAN,
        )
    assert not any("DROP TABLE" in s for s in conn.statements), conn.statements


async def test_g_the_ef_search_range_travels_with_the_allow_list():
    """`int()` made `ef_search` injection-safe but not RANGE-checked at this boundary either.

    `validate_knobs` carries both constraints, so moving the call moves both -- and an
    out-of-range breadth on the public entry point now refuses rather than being handed to the
    server as an argument nobody chose.
    """
    from app.services.recall_eval import RecallUnmeasurable, measure_layer1

    conn = _RecordingConn()
    with pytest.raises(RecallUnmeasurable):
        await measure_layer1(
            conn,
            filter_shape=_none_shape(),
            query_vectors=["[0.0,0.0]"],
            user_id="00000000-0000-0000-0000-000000000000",
            ef_search=10**9,
        )


async def test_g_a_legitimate_pair_still_rides():
    """POSITIVE CONTROL. A validator that refused everything would satisfy all four cases."""
    from app.services.recall_eval import _apply_hnsw_knobs

    conn = _RecordingConn()
    await _apply_hnsw_knobs(conn, ef_search=200, iterative_scan="relaxed_order")
    assert any("hnsw.ef_search = 200" in s for s in conn.statements), conn.statements
    assert any(
        "hnsw.iterative_scan = 'relaxed_order'" in s for s in conn.statements
    ), conn.statements


def test_g_the_docstring_claim_is_made_true_in_the_function_that_makes_it():
    """A SOURCE fence beside the behavioural ones, because the finding was a PROSE claim.

    A behavioural case can only see the arguments somebody thought to drive; this reads the
    AST and asserts the constraint is inside `_apply_hnsw_knobs` itself, which is the exact
    property its docstring asserts and the exact property it lacked.
    """
    tree = ast.parse(_RECALL_EVAL.read_text(encoding="utf-8"))
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        and n.name == "_apply_hnsw_knobs"
    )
    calls = {
        getattr(c.func, "id", None) or getattr(c.func, "attr", None)
        for c in ast.walk(fn)
        if isinstance(c, ast.Call)
    }
    assert "validate_knobs" in calls, (
        "_apply_hnsw_knobs interpolates a GUC value into SQL and its docstring claims an "
        "allow-list, but it does not call the validator -- the check lives in a caller that "
        "the public measure_layer1 / measure_layer2 entry points do not go through"
    )
