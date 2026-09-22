"""Phase 256 (METER-04 / SC#2) — Fence 1: the ``parent_run_id IS NULL`` narrowing.

D-256-02
--------
A site that AGGREGATES the ``runs`` table's token columns (``input_tokens`` /
``output_tokens``) without the ``parent_run_id IS NULL`` narrowing double-counts a
sub-agent's spend: a sub-agent run lives on the SAME thread as its producer, with its own
``runs`` row, and ``phase_types.py:768 _record_run_usage`` already rolls that child's usage
INTO the parent's box. So the parent row is INCLUSIVE of its children.

D-256-01 is a HIERARCHY, not a de-duplication
---------------------------------------------
A child row plus an INCLUSIVE parent row is a TREE, not a double count. What SC#2 forbids
("a sub-agent's tokens appear in exactly one place rather than twice or nowhere") is more
than one NON-OVERLAPPING sum — i.e. summing parents AND children into the same total.
Reading a child row on its own (the per-sub-agent breakdown) is legitimate and this fence
does not forbid it; summing the whole table is what must be narrowed.

⛔ THE SUBJECT SET WAS MEASURED **EMPTY** AT ``edf2d1024``
----------------------------------------------------------
256-RESEARCH.md §Q3 ran seven independent search strategies and found that NOTHING in this
codebase aggregates those columns at all — no SUM, no total, no per-thread/per-org roll-up,
in Python or in SQL. Phase 257 is the FIRST consumer. That is the good news (the read rule
is fenced BEFORE its first reader exists) and it is also why the vacuity controls below are
MANDATORY rather than advisable: a fence over an empty set passes forever, which is the
textbook vacuous pass this project has recorded twice.

D-256-03 — the rule binds the ``runs`` table ONLY
-------------------------------------------------
``workflow_runs`` is a DIFFERENT GRAIN: it has no ``parent_run_id`` column at all, so its
token columns are never a parent/child tree and must never be narrowed. The table matcher
below is deliberately written so that ``workflow_runs`` (and any other ``*_runs``) cannot
match. This is what keeps the fence green over plan 256-01's ``persist_run_usage`` writer.

⚠ PROVENANCE OF THE MECHANICS — 256-RESEARCH.md's citation is WRONG and is corrected here
------------------------------------------------------------------------------------------
RESEARCH.md names ``test_189_no_egress.py`` as "the" analog and
``test_255_extension_contract_guard.py`` as "the AST mechanics". Measured, neither is true
on its own:

* ``test_255_extension_contract_guard.py`` imports ``ast`` at :15 and NEVER USES IT
  (``grep -c "ast\\."`` -> 0). It is a REGEX fence. Only its REPORTING shape is taken here:
  a collected ``violations`` list reported as ONE assertion, each entry ``file:line -> ...``,
  and a MISSING SUBJECT IS A VIOLATION, not a skip (control C below).
* ``test_189_no_egress.py``'s walk helper ``_app_python_files`` (:80) has ZERO callers and
  its gate was retired to a 2-line import assert under D-206-07, so its promised file-count
  vacuity guard executes NOWHERE. Control B below is written LIVE rather than copied.
* The real ``ast.parse`` mechanics are taken from ``test_222_no_undefined_names.py``.

WHY AN AST FENCE AND NOT A GREP
-------------------------------
This codebase assembles SQL from implicitly-concatenated string literals spread across many
lines (``api/runs.py:1556-1566``, ``api/workflows.py:1756-1774``). A line-oriented grep
cannot see a ``SUM(`` on one line and a missing ``WHERE`` four lines down. The matcher below
is a CONJUNCTION over a whole STATEMENT, not a test of one line.
"""

import ast
import re
from pathlib import Path

import pytest

#: Walk root. ``parents[2]`` is ``backend/``; the subject tree is ``backend/app``.
APP_ROOT = Path(__file__).resolve().parents[2] / "app"

#: The two ``runs``-table columns whose aggregation this rule binds.
TOKEN_COLUMNS = ("input_tokens", "output_tokens")

#: Aggregation tokens. Deliberately NOT including COALESCE/GREATEST — those are per-row
#: scalar guards (``persist_run_usage``'s ``COALESCE(input_tokens, 0) + $2``), not roll-ups.
_AGG_RE = re.compile(r"\b(sum|count|avg|total)\s*\(", re.IGNORECASE)

#: The ``runs`` table as a STANDALONE word. The negative lookbehind on ``[\w.]`` is
#: LOAD-BEARING for D-256-03: it makes ``workflow_runs``, ``eval_runs`` and ``r.runs``
#: unmatchable, so a different grain can never be dragged under this rule.
_RUNS_TABLE_RE = re.compile(r"(?<![\w.])runs\b")

#: The narrowing, raw-SQL form.
_NARROWING_SQL_RE = re.compile(r"parent_run_id\s+is\s+null", re.IGNORECASE)

#: The narrowing, supabase-py builder form: ``.is_("parent_run_id", "null")``.
_NARROWING_BUILDER_RE = re.compile(
    r"""is_\s*\(\s*['"]parent_run_id['"]\s*,\s*['"]null['"]""", re.IGNORECASE
)

#: A supabase-py read of the ``runs`` table: ``.table("runs")`` / ``.from_("runs")``.
_BUILDER_TABLE_RE = re.compile(r"""(?:table|from_)\s*\(\s*['"]runs['"]\s*\)""")

#: A supabase-py ``.select(...)`` call.
_BUILDER_SELECT_RE = re.compile(r"\.select\s*\(")


def _leaf_statements(tree: ast.AST) -> list[ast.stmt]:
    """Innermost statements only.

    A compound statement (``FunctionDef``, ``With``, ``If`` ...) textually contains every
    statement beneath it, so checking those too would let an unrelated narrowing four
    statements away silently satisfy the conjunction. Restricting to leaves makes the
    conjunction bind to ONE statement, which is the grain SQL is actually built at here.
    """
    leaves: list[ast.stmt] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.stmt):
            continue
        if any(isinstance(child, ast.stmt) for child in ast.walk(node) if child is not node):
            continue
        leaves.append(node)
    return leaves


def _violations_in_source(source: str, label: str) -> list[str]:
    """Return ``label:line -> reason`` for every un-narrowed token aggregation in *source*.

    The real walk AND every in-test haystack control go through THIS function, so a control
    cannot pass against a matcher the fence does not actually use.

    ``ast.unparse`` is used rather than hand-joining ``ast.Constant`` pieces because the
    parser has ALREADY merged implicitly-concatenated literals into a single constant, and
    unparse additionally preserves the attribute-call chain (``.is_(...)``, ``.select(...)``)
    that the supabase-py builder form is expressed in. One text, both dialects.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:  # pragma: no cover - a parse failure is itself a violation
        return [f"{label}:{exc.lineno or 0} -> could not be parsed: {exc}"]

    violations: list[str] = []
    for stmt in _leaf_statements(tree):
        text = ast.unparse(stmt)
        if not any(col in text for col in TOKEN_COLUMNS):
            continue
        if not _RUNS_TABLE_RE.search(text):
            continue

        narrowed = bool(
            _NARROWING_SQL_RE.search(text) or _NARROWING_BUILDER_RE.search(text)
        )

        # Dialect 1 — raw SQL: an aggregation token over the runs table.
        if _AGG_RE.search(text) and not narrowed:
            violations.append(
                f"{label}:{stmt.lineno} -> aggregates a runs-table token column "
                f"without `parent_run_id IS NULL` (D-256-02)"
            )
            continue

        # Dialect 2 — supabase-py builder: a chained select of a token column off `runs`
        # with no sibling `.is_("parent_run_id", "null")` in the same statement.
        if (
            _BUILDER_TABLE_RE.search(text)
            and _BUILDER_SELECT_RE.search(text)
            and not narrowed
        ):
            violations.append(
                f'{label}:{stmt.lineno} -> supabase-py select of a runs-table token column '
                f'without `.is_("parent_run_id", "null")` (D-256-02)'
            )
    return violations


def _app_python_files() -> list[Path]:
    """Every ``.py`` under ``backend/app``. LIVE — control B below asserts it found files."""
    return sorted(APP_ROOT.rglob("*.py"))


def _read_source(path: Path) -> str:
    """Read a module for parsing.

    ⚠ ``utf-8-sig``, not ``utf-8``, and that is a MEASURED necessity rather than caution:
    ``backend/app/services/email_extraction_service.py`` carries a UTF-8 BOM, and
    ``ast.parse`` refuses a leading ``U+FEFF`` with
    ``SyntaxError: invalid non-printable character U+FEFF``. CPython's own importer strips
    the BOM, so the file is perfectly valid at runtime — only a hand-rolled ``ast.parse``
    sees it. Found by this fence's first RED drive. Stripping the BOM does NOT weaken the
    matcher: the parse-failure arm below stays live, so a genuinely unparseable module is
    still reported as a violation rather than silently skipped.
    """
    return path.read_text(encoding="utf-8-sig")


# ---------------------------------------------------------------------------
# THE FENCE
# ---------------------------------------------------------------------------


def test_no_runs_token_aggregation_escapes_the_parent_run_id_narrowing():
    """D-256-02: every runs-table token aggregation carries `parent_run_id IS NULL`."""
    if not APP_ROOT.is_dir():
        pytest.fail(
            f"VACUITY CONTROL C: walk root not found: {APP_ROOT} — a renamed or moved "
            f"subject tree must FAIL this fence, never silently empty its subject set."
        )

    violations: list[str] = []
    for path in _app_python_files():
        rel = path.relative_to(APP_ROOT.parents[1]).as_posix()
        violations.extend(_violations_in_source(_read_source(path), rel))

    assert not violations, (
        "D-256-02 violation — a runs-table token aggregation is missing the "
        "`parent_run_id IS NULL` narrowing, so a sub-agent's spend is counted TWICE "
        "(the parent row is already INCLUSIVE of its children via "
        "phase_types.py `_record_run_usage`):\n" + "\n".join(violations)
    )


# ---------------------------------------------------------------------------
# VACUITY CONTROL A — the matcher fires
# ---------------------------------------------------------------------------


def test_vacuity_control_A_matcher_fires_on_an_in_test_haystack():
    """MANDATORY: the subject set is measurably EMPTY, so without this the fence passes
    over nothing, forever. Drive the SAME matcher against a violation it must report."""
    haystack = (
        "async def total_spend(pool, org_id):\n"
        "    return await pool.fetchrow(\n"
        '        "SELECT SUM(input_tokens) AS t FROM runs WHERE org_id = $1", org_id\n'
        "    )\n"
    )
    found = _violations_in_source(haystack, "haystack.py")
    assert len(found) == 1, f"matcher did not fire on a known violation: {found}"
    assert "haystack.py:2" in found[0], found[0]
    assert "D-256-02" in found[0], found[0]


def test_vacuity_control_A_matcher_fires_across_concatenated_literals():
    """The whole reason this is an AST fence: `SUM(` and the missing clause are four lines
    apart, assembled from implicitly-concatenated literals. A line-grep cannot see it."""
    haystack = (
        "async def total_spend(pool, org_id):\n"
        "    return await pool.fetch(\n"
        '        "SELECT r.thread_id, "\n'
        '        "SUM(r.input_tokens) AS tin, "\n'
        '        "SUM(r.output_tokens) AS tout "\n'
        '        "FROM runs r "\n'
        '        "WHERE r.org_id = $1 "\n'
        '        "GROUP BY r.thread_id",\n'
        "        org_id,\n"
        "    )\n"
    )
    found = _violations_in_source(haystack, "haystack.py")
    assert len(found) == 1, f"matcher did not fire across concatenated literals: {found}"


def test_vacuity_control_A_matcher_fires_on_the_supabase_builder_form():
    """Dialect 2 — the builder form must be seen too, or half the codebase is unguarded."""
    haystack = (
        'rows = supabase.table("runs").select("run_id, input_tokens")'
        '.eq("org_id", org).execute()\n'
    )
    found = _violations_in_source(haystack, "haystack.py")
    assert len(found) == 1, f"matcher did not fire on the builder form: {found}"
    assert "parent_run_id" in found[0], found[0]


# ---------------------------------------------------------------------------
# VACUITY CONTROL B — the walk visited something
# ---------------------------------------------------------------------------


def test_vacuity_control_B_the_walk_visited_a_plausible_number_of_files():
    """Written LIVE, not copied: `test_189_no_egress.py`'s file-count guard is DEAD CODE
    with zero callers, so copying it by reference would have guarded nothing."""
    parsed = _app_python_files()
    assert len(parsed) >= 150, (
        f"VACUITY CONTROL B: only {len(parsed)} .py files found under {APP_ROOT}. "
        f"The fence's subject set has collapsed — it is passing over nothing."
    )


# ---------------------------------------------------------------------------
# VACUITY CONTROL C — a missing subject is a VIOLATION, not a skip
# ---------------------------------------------------------------------------


def test_vacuity_control_C_a_missing_walk_root_is_a_violation_not_a_skip():
    """A renamed subject tree must FAIL, never silently empty the set
    (`test_255_extension_contract_guard.py`'s "File not found" arm)."""
    assert APP_ROOT.is_dir(), f"walk root missing: {APP_ROOT}"
    missing = APP_ROOT.parent / "app_this_directory_does_not_exist"
    assert not missing.is_dir()
    # The fence's own guard clause is `if not APP_ROOT.is_dir(): pytest.fail(...)`.
    # Assert that shape is present in this module's source, so a future edit that downgrades
    # the guard to a silent bypass cannot pass unnoticed. The forbidden token is assembled
    # rather than written, so this assertion cannot be tripped by its own source text.
    own_source = Path(__file__).read_text(encoding="utf-8")
    bypass_token = "pytest." + "s" + "kip"
    assert "pytest.fail(" in own_source
    assert bypass_token not in own_source, (
        "VACUITY CONTROL C has been downgraded: the missing-root guard must FAIL, "
        "never bypass — a renamed subject tree would otherwise empty the set in silence."
    )


# ---------------------------------------------------------------------------
# NEGATIVE CONTROLS — the things that must NOT be flagged
# ---------------------------------------------------------------------------


def test_negative_control_persist_run_usage_writer_is_not_a_violation():
    """This is what stops Fence 1 breaking plan 256-01's merge.

    `persist_run_usage` writes `workflow_runs`, which is a DIFFERENT GRAIN with no
    `parent_run_id` column at all (D-256-03), and its `COALESCE(x, 0) + $2` is a per-row
    scalar guard, not an aggregation.
    """
    haystack = (
        "async def persist_run_usage(pool, run_id, d_in, d_out):\n"
        "    await pool.execute(\n"
        '        "UPDATE workflow_runs "\n'
        '        "SET input_tokens = COALESCE(input_tokens, 0) + $2, "\n'
        '        "    output_tokens = COALESCE(output_tokens, 0) + $3 "\n'
        '        "WHERE id = $1",\n'
        "        run_id, d_in, d_out,\n"
        "    )\n"
    )
    assert _violations_in_source(haystack, "haystack.py") == []


def test_negative_control_finalize_run_writer_is_not_a_violation():
    """`db/runs.py`'s `finalize_run` WRITES the two columns on ONE row by primary key.
    A writer is not a roll-up and must never be flagged."""
    haystack = (
        "async def finalize_run(pool, run_id, input_tokens, output_tokens):\n"
        "    await pool.execute(\n"
        '        "UPDATE runs "\n'
        '        "SET input_tokens = $6, "\n'
        '        "    output_tokens = $7 "\n'
        '        "WHERE run_id = $1",\n'
        "        run_id, input_tokens, output_tokens,\n"
        "    )\n"
    )
    assert _violations_in_source(haystack, "haystack.py") == []


def test_negative_control_the_four_shipped_narrowed_joins_are_not_violations():
    """RESEARCH.md C-3: `api/workflows.py:1772`, `api/runs.py:1563`, `api/threads.py:384`
    and `:468` are cancel/reconcile IDENTITY guards that select NO token column. The fence
    must be green over them today — and it is, because they never mention a token column."""
    haystack = (
        "inflight = await pool.fetch(\n"
        '    "SELECT wr.id AS wf_id, wr.thread_id, "\n'
        '    "r.run_id AS producer_id, r.status AS producer_status "\n'
        '    "FROM workflow_runs wr "\n'
        "    \"LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming' \"\n"
        '    "AND r.parent_run_id IS NULL "\n'
        '    "WHERE wd.slug = $1",\n'
        "    slug,\n"
        ")\n"
    )
    assert _violations_in_source(haystack, "haystack.py") == []


def test_negative_control_a_correctly_narrowed_aggregation_passes():
    """The rule is satisfiable: the SAME query WITH the narrowing must be green, or the
    fence forbids the thing Phase 257 is supposed to build."""
    haystack = (
        "row = await pool.fetchrow(\n"
        '    "SELECT SUM(input_tokens) AS tin, SUM(output_tokens) AS tout "\n'
        '    "FROM runs "\n'
        '    "WHERE org_id = $1 AND parent_run_id IS NULL",\n'
        "    org_id,\n"
        ")\n"
    )
    assert _violations_in_source(haystack, "haystack.py") == []


def test_negative_control_a_correctly_narrowed_builder_read_passes():
    """Builder dialect, satisfied form."""
    haystack = (
        'rows = supabase.table("runs").select("run_id, input_tokens")'
        '.eq("org_id", org).is_("parent_run_id", "null").execute()\n'
    )
    assert _violations_in_source(haystack, "haystack.py") == []


def test_negative_control_a_per_row_child_read_is_not_a_violation():
    """D-256-01 as a HIERARCHY: reading a CHILD row on its own (the per-sub-agent
    breakdown) is legitimate and must not be forbidden — only a non-overlapping SUM is."""
    haystack = (
        "row = await pool.fetchrow(\n"
        '    "SELECT input_tokens, output_tokens FROM runs WHERE run_id = $1",\n'
        "    run_id,\n"
        ")\n"
    )
    assert _violations_in_source(haystack, "haystack.py") == []
