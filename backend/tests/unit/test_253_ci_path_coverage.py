"""Phase 253 plan 03 (WR-08) — every non-``backend/`` file a backend unit test READS must
sit inside ``backend-tests.yml``'s path filters, in BOTH trigger arms.

⛔ WHY THIS EXISTS. ``tests/unit/test_253_supplement_column_parity.py`` is a fence over
``scripts/full-schema-supplement.sql``. ``backend-tests.yml`` triggers on ``backend/**``,
``supabase/migrations/**`` and its own file — so **a pull request that edits only the
supplement runs that fence in no CI job at all**. The one change that can break the fence
is the one change that does not run it. Same for the harness loaded by
``test_253_greenfield_sql_lexer.py``.

This module needs **no database, no network and no environment variable**. PyYAML is
already a backend dependency (``backend/requirements.txt``).

⚠ THE YAML TRAP, named so it is not rediscovered: PyYAML follows YAML 1.1, where the bare
key ``on`` parses as the **boolean ``True``**, not the string ``"on"``. A fence that reads
``doc["on"]`` raises ``KeyError`` — or worse, ``doc.get("on", {})`` silently tests nothing
and passes. Both lookups are tried below and the result is asserted non-empty.

⚠ WHAT THE MATCHER COVERS, stated rather than implied: the two GitHub ``paths:`` forms this
repository actually uses — a ``prefix/**`` glob and an exact path. It is deliberately NOT a
general ``fnmatch``/``minimatch`` implementation, and it does not handle ``!`` negations,
``*`` single-segment wildcards or ``?``. If a new form appears in the workflow, extend the
matcher rather than trusting it — the false-positive control below is what catches a
matcher that has become too permissive.
"""

from __future__ import annotations

import importlib
import pathlib
import sys

import pytest
import yaml

_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_WORKFLOW = _REPO_ROOT / ".github" / "workflows" / "backend-tests.yml"

#: The backend unit-test modules whose module-level ``pathlib.Path`` constants are scanned.
#: Named explicitly rather than by a directory walk: a walk would import every test module
#: in the suite as a side effect, and the two modules that reach outside ``backend/`` are a
#: deliberate, auditable set.
_MODULES_THAT_REACH_OUTSIDE_BACKEND = (
    "tests.unit.test_253_supplement_column_parity",
    "tests.unit.test_253_greenfield_sql_lexer",
)


def _matches(glob: str, rel_path: str) -> bool:
    """Does a GitHub ``paths:`` entry match a repo-relative POSIX path?

    Supports exactly the two forms this workflow uses: ``prefix/**`` and an exact path.
    """
    glob = glob.strip()
    if glob.endswith("/**"):
        return rel_path == glob[:-3] or rel_path.startswith(glob[:-2])
    return rel_path == glob


def _trigger_paths() -> tuple[list[str], list[str]]:
    """``(push_paths, pull_request_paths)`` from the workflow, YAML-1.1 trap handled."""
    doc = yaml.safe_load(_WORKFLOW.read_text(encoding="utf-8"))
    triggers = doc.get("on")
    if triggers is None:
        triggers = doc.get(True)  # YAML 1.1: the bare key `on` IS the boolean True
    assert triggers, (
        "the trigger mapping was found under neither 'on' nor True — PyYAML's YAML-1.1 "
        "boolean coercion means a fence that guesses one of them silently tests nothing."
    )
    push = list(triggers.get("push", {}).get("paths", []))
    pull = list(triggers.get("pull_request", {}).get("paths", []))
    assert push and pull, f"push={push!r} pull_request={pull!r}"
    return push, pull


def _derived_subject_set() -> dict[str, str]:
    """``{repo-relative POSIX path: the test module that reads it}``.

    DERIVED, never typed: each module is imported and every module-level ``pathlib.Path``
    constant that resolves under the repo root and OUTSIDE ``backend/`` is collected.
    """
    sys.path.insert(0, str(_REPO_ROOT / "backend"))
    subjects: dict[str, str] = {}
    backend = (_REPO_ROOT / "backend").resolve()
    for mod_name in _MODULES_THAT_REACH_OUTSIDE_BACKEND:
        mod = importlib.import_module(mod_name)
        for attr in vars(mod).values():
            if not isinstance(attr, pathlib.Path):
                continue
            resolved = attr.resolve()
            if not resolved.is_relative_to(_REPO_ROOT):
                continue
            if resolved == backend or resolved.is_relative_to(backend):
                continue
            if resolved == _REPO_ROOT:
                continue
            subjects.setdefault(
                resolved.relative_to(_REPO_ROOT).as_posix(), mod_name
            )
    return subjects


# ── NON-VACUITY FLOOR ──────────────────────────────────────────────────────────


def test_the_derived_subject_set_is_not_empty():
    """⛔ A DERIVED-SET FENCE THAT PASSES OVER NOTHING IS THE DEFECT IT GUARDS AGAINST.

    Phase 242 measured two guards in this repo exiting 0 over zero parsed files. If the
    scan ever yields nothing — a rename, a moved constant, an import failure swallowed
    somewhere — this arm reds before any coverage claim is made.
    """
    subjects = _derived_subject_set()
    assert len(subjects) >= 2, subjects
    assert "scripts/full-schema-supplement.sql" in subjects, subjects
    assert "scripts/check-greenfield-privileges.py" in subjects, subjects


# ── THE COVERAGE ASSERTION ─────────────────────────────────────────────────────


def test_every_out_of_backend_path_a_unit_test_reads_is_in_both_trigger_arms():
    """RED against the unmodified workflow: the supplement is matched by nothing."""
    push, pull = _trigger_paths()
    subjects = _derived_subject_set()

    uncovered: list[str] = []
    for rel, reader in sorted(subjects.items()):
        in_push = any(_matches(g, rel) for g in push)
        in_pull = any(_matches(g, rel) for g in pull)
        if not (in_push and in_pull):
            uncovered.append(
                f"{rel} (read by {reader}) — push={in_push} pull_request={in_pull}"
            )

    assert not uncovered, (
        "these files are READ by a backend unit test and matched by NO path filter in "
        "backend-tests.yml, so the one change that breaks the fence is the one change "
        "that does not run it:\n  " + "\n  ".join(uncovered)
        + f"\n\npush.paths={push}\npull_request.paths={pull}"
    )


# ── FALSE-POSITIVE CONTROL ─────────────────────────────────────────────────────


def test_the_matcher_does_not_match_an_uncovered_path():
    """A matcher that returns True for everything would make the arm above vacuous."""
    push, pull = _trigger_paths()
    for probe in ("docs/OPERATOR.md", "frontend/src/App.tsx", "README.md"):
        assert not any(_matches(g, probe) for g in push + pull), (
            f"{probe} is not supposed to be covered by backend-tests.yml's filters; a "
            "matcher that says it is cannot fail the coverage assertion either."
        )


def test_the_matcher_distinguishes_a_prefix_glob_from_a_sibling_directory():
    assert _matches("backend/**", "backend/app/main.py")
    assert _matches("backend/**", "backend")
    assert not _matches("backend/**", "backend-extra/app/main.py")
    assert _matches("scripts/full-schema-supplement.sql", "scripts/full-schema-supplement.sql")
    assert not _matches("scripts/full-schema-supplement.sql", "scripts/full-schema-supplement.sql.bak")


# ── the workflow's own known asymmetry, recorded rather than silently repaired ──


def test_the_workflows_own_file_is_in_the_push_arm_only():
    """⚠ PRE-EXISTING and OUT OF THIS ROUND'S LOCKED SCOPE — pinned, not fixed.

    ``.github/workflows/backend-tests.yml`` appears in ``push.paths`` and NOT in
    ``pull_request.paths``. Editing the workflow in a PR therefore does not run it.
    The operator's five-finding lock for this gap-closure round does not include that,
    so it is pinned here so a future reader meets a FACT rather than an accident, and so
    that fixing it is a deliberate act that turns this arm red on purpose.
    """
    push, pull = _trigger_paths()
    own = ".github/workflows/backend-tests.yml"
    assert own in push
    assert own not in pull, (
        "the asymmetry this arm pins has been repaired — good; delete this arm in the "
        "same commit and say so, rather than leaving a fence that asserts a defect."
    )


# ── the must-pass fence step itself — 252-REVIEW-R2.md WR-09 ──────────────────


_FENCE_STEP_NAME = "scripts/ parity fences (must pass)"

_FENCE_SUITES = (
    "tests/unit/test_253_supplement_column_parity.py",
    "tests/unit/test_253_greenfield_sql_lexer.py",
    "tests/unit/test_253_ci_path_coverage.py",
)


def _fence_step() -> dict:
    """The one step in ``backend-tests.yml`` that is allowed to be read as a signal."""
    doc = yaml.safe_load(_WORKFLOW.read_text(encoding="utf-8"))
    steps = doc["jobs"]["pytest"]["steps"]
    named = [s for s in steps if s.get("name") == _FENCE_STEP_NAME]
    assert len(named) == 1, (
        f"expected exactly one {_FENCE_STEP_NAME!r} step, found {len(named)}. "
        f"steps present: {[s.get('name') for s in steps]}"
    )
    return named[0]


def test_the_fence_step_survives_a_red_predecessor():
    """⛔ ``if: always()`` IS LOAD-BEARING AND WAS MISSING WHEN THE STEP WAS FIRST ADDED.

    A GitHub step with no ``if:`` is SKIPPED once an earlier step fails. ``Run pytest``
    above it can NEVER succeed — the project baseline is 71 failures (CLAUDE.md) — so
    without a condition this fence is structurally unreachable. Measured on run
    ``35231275118``: ``Run pytest`` cancelled and this step reported ``skipped``, which is
    the "guard that cannot fire" defect shipped by the fix for that same defect class.

    Nothing pinned the repair (``grep -rn "always()"`` over ``backend/tests/`` and
    ``scripts/`` returned ZERO), so the next workflow edit could silently delete it.
    """
    cond = _fence_step().get("if")
    assert cond is not None, (
        "the fence step has no `if:` — it will be SKIPPED whenever `Run pytest` fails, "
        "and `Run pytest` can never pass. Restore `if: always()`."
    )
    assert "always()" in str(cond), (
        f"the fence step's condition is {cond!r}, which does not survive a failed "
        "predecessor. `success()` and a bare condition both skip after a red step."
    )


def test_the_fence_step_actually_names_the_three_suites():
    """A condition on a step that runs the wrong thing is not a fence.

    ⚠ This asserts the step's rendered CONTENT, not merely that the step is PRESENT —
    CLAUDE.md: *presence assertions cannot see content drift*.
    """
    run = _fence_step().get("run") or ""
    missing = [s for s in _FENCE_SUITES if s not in run]
    assert not missing, (
        f"the fence step no longer runs {missing} — its `run:` block is:\n{run}"
    )


def test_the_full_suite_step_cannot_hang_the_job():
    """``--continue-on-collection-errors`` let the integration tests actually START.

    Measured: the step then blocked on a Postgres/Supabase that does not exist on the
    runner and ran 37 minutes before being cancelled, against 3m30s when it used to die
    at collection. A bound is what stops that, and ``continue-on-error`` is what stops an
    unbounded baseline-red step deciding the job.
    """
    doc = yaml.safe_load(_WORKFLOW.read_text(encoding="utf-8"))
    steps = doc["jobs"]["pytest"]["steps"]
    pytest_steps = [s for s in steps if s.get("name") == "Run pytest"]
    assert len(pytest_steps) == 1, f"expected one 'Run pytest' step, found {len(pytest_steps)}"
    step = pytest_steps[0]
    assert step.get("timeout-minutes"), (
        "'Run pytest' has no timeout-minutes — it hung for 37 minutes once already."
    )
    assert step.get("continue-on-error") is True, (
        "'Run pytest' must be continue-on-error: its baseline is 71 failures, so its exit "
        "code was never a pass/fail signal and letting it fail the job hides the fence below."
    )
