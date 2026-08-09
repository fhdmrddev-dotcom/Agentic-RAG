"""Phase 183-02 Task 3 (CANVAS-01 / D-183-15, correction C-1) — skip-parse parity.

THE CONTROL THAT WOULD HAVE CAUGHT C-1. The frontend's ``parseSkipTarget`` docblock
claimed parity with :func:`app.services.harness.parse_skip_target` in PROSE, and the
prose was wrong: the backend slices the literal ``skip_to_phase:`` prefix by LENGTH
while the old frontend copy split on ``lastIndexOf(":")``, so ``skip_to_phase:a:b``
resolved to ``a:b`` on the server and ``b`` in the browser. Prose parity is what
drifted; an executable, cross-language, SHARED-TABLE parity test is what cannot.

Both halves of the pin read the SAME file — this module and
``frontend/src/components/workflows/phaseVocabulary.test.ts`` parametrize over
``frontend/src/components/workflows/__fixtures__/skipParseCases.json``. There is no
Python literal case list here on purpose: a second hand-maintained copy is exactly
the drift the shared table exists to kill.

This is a TEST-ONLY backend file — the sole file Phase 183 adds under ``backend/``.
No backend source, no route, no migration.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.harness import parse_skip_target

# repo-root resolution: backend/tests/unit/test_183_skip_parse_parity.py -> parents[3] == repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CASES_PATH = (
    _REPO_ROOT
    / "frontend"
    / "src"
    / "components"
    / "workflows"
    / "__fixtures__"
    / "skipParseCases.json"
)


def _load_cases() -> list[dict]:
    """Load the ONE shared case table, failing loudly if the path ever moves."""
    assert _CASES_PATH.is_file(), (
        f"the shared skip-parse case table is missing at {_CASES_PATH} — if a file "
        "moved, fix the parents[3] arithmetic above rather than deleting this control"
    )
    return json.loads(_CASES_PATH.read_text(encoding="utf-8"))["cases"]


_CASES = _load_cases()


@pytest.mark.parametrize(
    "on_failure,expected,why",
    [(c["on_failure"], c["expected"], c["why"]) for c in _CASES],
    ids=[str(c["on_failure"]) for c in _CASES],
)
def test_parse_skip_target_matches_the_shared_table(on_failure, expected, why):
    """The backend parse agrees with every row the TypeScript half also asserts.

    A JSON ``null`` ``on_failure`` arrives as Python ``None``; the backend guards with
    ``isinstance(on_failure, str)``, so ``None`` is a legitimate input returning ``None``.
    """
    assert parse_skip_target(on_failure) == expected, why


def test_the_shared_table_is_not_truncated():
    """The same truncation guard as the TypeScript half — neither language can weaken alone."""
    assert len(_CASES) >= 12
    c1 = [c for c in _CASES if c["on_failure"] == "skip_to_phase:a:b"]
    assert c1, "the C-1 row 'skip_to_phase:a:b' must stay in the shared table"
    assert c1[0]["expected"] == "a:b", (
        "C-1: the backend slices the prefix by LENGTH, so the whole remainder 'a:b' is "
        "the target — a lastIndexOf(':') split would wrongly yield 'b'"
    )
